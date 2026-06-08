import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGradeDto } from './dto/create-grade.dto';
import { UpdateGradeDto } from './dto/update-grade.dto';
import { GetAverageQueryDto } from './dto/get-average.query.dto';

@Injectable()
export class GradesService {
    constructor(private readonly prisma: PrismaService) { }

    /**
     * Creates a grade after enforcing three invariants:
     * 1. The course exists
     * 2. The caller is the course's teacher (or ADMIN)
     * 3. The student is enrolled in that course
     * 4. The evaluation type is configured on that course
     */
    async create(
        dto: CreateGradeDto,
        caller: { id: string; role: Role },
    ) {
        const course = await this.prisma.course.findUnique({
            where: { id: dto.courseId },
            select: {
                id: true,
                teacherId: true,
                evaluationWeights: { select: { type: true } },
            },
        });
        if (!course) {
            throw new NotFoundException(`Course ${dto.courseId} not found`);
        }

        if (caller.role !== Role.ADMIN && course.teacherId !== caller.id) {
            throw new ForbiddenException('You do not teach this course');
        }

        const enrollment = await this.prisma.enrollment.findUnique({
            where: {
                studentId_courseId: {
                    studentId: dto.studentId,
                    courseId: dto.courseId,
                },
            },
        });
        if (!enrollment) {
            throw new BadRequestException(
                'Student is not enrolled in this course',
            );
        }

        const configuredTypes = course.evaluationWeights.map((w) => w.type);
        if (!configuredTypes.includes(dto.type)) {
            throw new BadRequestException(
                `Evaluation type "${dto.type}" is not configured for this course`,
            );
        }

        return this.prisma.grade.create({
            data: {
                studentId: dto.studentId,
                courseId: dto.courseId,
                type: dto.type,
                value: dto.value,
                comment: dto.comment,
            },
        });
    }

    /** Updates a grade's value/comment. Caller must own the course or be ADMIN. */
    async update(
        gradeId: string,
        dto: UpdateGradeDto,
        caller: { id: string; role: Role },
    ) {
        const grade = await this.getGradeOrThrow(gradeId);
        await this.assertCallerOwnsCourse(grade.courseId, caller);

        return this.prisma.grade.update({
            where: { id: gradeId },
            data: dto,
        });
    }

    /** Deletes a grade. Caller must own the course or be ADMIN. */
    async remove(gradeId: string, caller: { id: string; role: Role }) {
        const grade = await this.getGradeOrThrow(gradeId);
        await this.assertCallerOwnsCourse(grade.courseId, caller);

        await this.prisma.grade.delete({ where: { id: gradeId } });
        return { deleted: true };
    }

    /**
     * Lists grades visible to the caller.
     * - STUDENT: only their own grades, optional courseId filter
     * - TEACHER: only grades on courses they teach
     * - ADMIN: all grades, optional filters
     */
    async listForCaller(
        caller: { id: string; role: Role },
        filters: { courseId?: string; type?: string },
    ) {
        const where: any = {
            ...(filters.courseId && { courseId: filters.courseId }),
            ...(filters.type && { type: filters.type }),
        };

        if (caller.role === Role.STUDENT) {
            where.studentId = caller.id;
        } else if (caller.role === Role.TEACHER) {
            where.course = { teacherId: caller.id };
        }
        // ADMIN: no extra constraint

        return this.prisma.grade.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                student: { select: { id: true, name: true, email: true } },
                course: { select: { id: true, code: true, title: true } },
            },
        });
    }

    async getAverage(
        caller: { id: string; role: Role },
        query: GetAverageQueryDto,
    ) {
        const course = await this.prisma.course.findUnique({
            where: { id: query.courseId },
            select: { teacherId: true, evaluationWeights: { select: { type: true, weight: true } } },
        });
        if (!course) throw new NotFoundException(`Course ${query.courseId} not found`);

        if (caller.role === Role.TEACHER && course.teacherId !== caller.id) {
            throw new ForbiddenException('You do not teach this course');
        }

        if (!course.evaluationWeights.length) {
            throw new BadRequestException('No evaluation weights configured for this course');
        }

        // Determine which student(s) to compute averages for
        if (caller.role === Role.STUDENT) {
            return Promise.all([this.computeForStudent(caller.id, query.courseId, course.evaluationWeights)]);
        }

        const targetStudentId = query.studentId;
        if (targetStudentId) {
            return Promise.all([this.computeForStudent(targetStudentId, query.courseId, course.evaluationWeights)]);
        }

        // Return averages for every enrolled student
        const enrollments = await this.prisma.enrollment.findMany({
            where: { courseId: query.courseId },
            select: { studentId: true, student: { select: { name: true, email: true } } },
        });

        return Promise.all(
            enrollments.map((e) =>
                this.computeForStudent(e.studentId, query.courseId, course.evaluationWeights, {
                    name: e.student.name,
                    email: e.student.email,
                }),
            ),
        );
    }

    async importCsv(
        courseId: string,
        file: { buffer: Buffer; originalname: string },
        caller: { id: string; role: Role },
    ) {
        const course = await this.prisma.course.findUnique({
            where: { id: courseId },
            select: {
                teacherId: true,
                evaluationWeights: { select: { type: true } },
            },
        });
        if (!course) throw new NotFoundException(`Course ${courseId} not found`);

        if (caller.role !== Role.ADMIN && course.teacherId !== caller.id) {
            throw new ForbiddenException('You do not teach this course');
        }

        const configuredTypes = new Set(course.evaluationWeights.map((w) => w.type));

        // Fetch enrolled student ids once — used to check every row
        const enrollments = await this.prisma.enrollment.findMany({
            where: { courseId },
            select: { studentId: true },
        });
        const enrolledIds = new Set(enrollments.map((e) => e.studentId));

        const rows = this.parseCsv(file.buffer.toString('utf8'));
        const errors: { row: number; field?: string; error: string }[] = [];
        type GradeData = { studentId: string; courseId: string; type: string; value: number; comment?: string };
        const toInsert: GradeData[] = [];

        for (const { index, data } of rows) {
            const rowErrors: string[] = [];

            const { studentId, type, value: rawValue, comment } = data;

            if (!studentId) rowErrors.push('missing studentId');
            if (!type) rowErrors.push('missing type');
            else if (!configuredTypes.has(type as any))
                rowErrors.push(`evaluation type "${type}" is not configured for this course`);

            const value = parseFloat(rawValue ?? '');
            if (rawValue === undefined || rawValue === '') {
                rowErrors.push('missing value');
            } else if (isNaN(value) || value < 0 || value > 20) {
                rowErrors.push('value must be a number between 0 and 20');
            }

            if (comment && comment.length > 300) rowErrors.push('comment exceeds 300 characters');

            if (studentId && !enrolledIds.has(studentId)) {
                rowErrors.push('student is not enrolled in this course');
            }

            if (rowErrors.length) {
                errors.push({ row: index, ...( studentId && { studentId }), ...( type && { type }), error: rowErrors.join('; ') });
            } else {
                toInsert.push({ studentId: studentId!, courseId, type: type!, value, comment: comment || undefined });
            }
        }

        if (errors.length) {
            return { success: false, imported: 0, errors };
        }

        await this.prisma.$transaction(
            toInsert.map((d) => this.prisma.grade.create({ data: d as any })),
        );

        return { success: true, imported: toInsert.length, errors: [] };
    }

    // ----- helpers -----

    private parseCsv(content: string): { index: number; data: Record<string, string | undefined> }[] {
        const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter((l) => l.trim());
        if (!lines.length) return [];

        const headers = this.splitCsvLine(lines[0]).map((h) => h.trim());

        return lines.slice(1).map((line, i) => {
            const values = this.splitCsvLine(line);
            const data: Record<string, string | undefined> = {};
            headers.forEach((h, idx) => { data[h] = values[idx]?.trim(); });
            return { index: i + 2, data }; // row 1 = header, data starts at row 2
        });
    }

    private splitCsvLine(line: string): string[] {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
                if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
                else { inQuotes = !inQuotes; }
            } else if (ch === ',' && !inQuotes) {
                result.push(current); current = '';
            } else {
                current += ch;
            }
        }
        result.push(current);
        return result;
    }

    private async computeForStudent(
        studentId: string,
        courseId: string,
        weights: { type: string; weight: number }[],
        studentInfo?: { name: string | null; email: string },
    ) {
        const grades = await this.prisma.grade.findMany({
            where: { studentId, courseId },
            select: { type: true, value: true },
        });

        const weightMap = new Map(weights.map((w) => [w.type, w.weight]));

        // Average per type
        const byType = new Map<string, number[]>();
        for (const g of grades) {
            const list = byType.get(g.type) ?? [];
            list.push(g.value);
            byType.set(g.type, list);
        }

        const breakdown = weights.map((w) => {
            const values = byType.get(w.type) ?? [];
            const typeAverage = values.length
                ? values.reduce((s, v) => s + v, 0) / values.length
                : null;
            return { type: w.type, weight: w.weight, gradeCount: values.length, typeAverage };
        });

        // Normalize over types that have at least one grade
        const gradedBreakdown = breakdown.filter((b) => b.typeAverage !== null);
        const totalWeight = gradedBreakdown.reduce((s, b) => s + (weightMap.get(b.type) ?? 0), 0);
        const weightedAverage =
            totalWeight > 0
                ? gradedBreakdown.reduce(
                      (s, b) => s + b.typeAverage! * (weightMap.get(b.type) ?? 0),
                      0,
                  ) / totalWeight
                : null;

        return {
            studentId,
            ...(studentInfo ?? {}),
            courseId,
            weightedAverage: weightedAverage !== null ? Math.round(weightedAverage * 100) / 100 : null,
            isPartial: gradedBreakdown.length < weights.length,
            breakdown,
        };
    }


    private async getGradeOrThrow(id: string) {
        const grade = await this.prisma.grade.findUnique({ where: { id } });
        if (!grade) throw new NotFoundException(`Grade ${id} not found`);
        return grade;
    }

    private async assertCallerOwnsCourse(
        courseId: string,
        caller: { id: string; role: Role },
    ) {
        if (caller.role === Role.ADMIN) return;
        const course = await this.prisma.course.findUnique({
            where: { id: courseId },
            select: { teacherId: true },
        });
        if (!course || course.teacherId !== caller.id) {
            throw new ForbiddenException('You do not teach this course');
        }
    }
}