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

    // ----- helpers -----

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