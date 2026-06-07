import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { BulkAttendanceDto } from './dto/bulk-attendance.dto';

@Injectable()
export class AttendancesService {
    constructor(private readonly prisma: PrismaService) { }

    /** Creates a class session for a course. Caller must be the course's teacher or ADMIN. */
    async createSession(
        courseId: string,
        dto: CreateSessionDto,
        caller: { id: string; role: Role },
    ) {
        const course = await this.prisma.course.findUnique({
            where: { id: courseId },
            select: { teacherId: true },
        });
        if (!course) throw new NotFoundException(`Course ${courseId} not found`);
        if (caller.role !== Role.ADMIN && course.teacherId !== caller.id) {
            throw new ForbiddenException('You do not teach this course');
        }

        return this.prisma.classSession.create({
            data: { courseId, date: dto.date, topic: dto.topic },
        });
    }

    /** Lists sessions for a course. TEACHER must own it; STUDENT must be enrolled; ADMIN sees any. */
    async listSessions(courseId: string, caller: { id: string; role: Role }) {
        const course = await this.prisma.course.findUnique({
            where: { id: courseId },
            select: { teacherId: true },
        });
        if (!course) throw new NotFoundException(`Course ${courseId} not found`);

        if (caller.role === Role.TEACHER && course.teacherId !== caller.id) {
            throw new ForbiddenException('You do not teach this course');
        }

        if (caller.role === Role.STUDENT) {
            const enrollment = await this.prisma.enrollment.findUnique({
                where: { studentId_courseId: { studentId: caller.id, courseId } },
            });
            if (!enrollment) throw new ForbiddenException('You are not enrolled in this course');
        }

        return this.prisma.classSession.findMany({
            where: { courseId },
            orderBy: { date: 'asc' },
            include: { _count: { select: { attendances: true } } },
        });
    }

    /**
     * Upserts attendance records for a session in a single transaction.
     * All submitted student IDs must be enrolled in the course; any unknown
     * student ID causes the whole request to be rejected (fail-fast).
     */
    async bulkRecord(
        sessionId: string,
        dto: BulkAttendanceDto,
        caller: { id: string; role: Role },
    ) {
        const session = await this.prisma.classSession.findUnique({
            where: { id: sessionId },
            select: { courseId: true, course: { select: { teacherId: true } } },
        });
        if (!session) throw new NotFoundException(`Session ${sessionId} not found`);

        if (caller.role !== Role.ADMIN && session.course.teacherId !== caller.id) {
            throw new ForbiddenException('You do not teach this course');
        }

        if (!dto.attendances.length) {
            throw new BadRequestException('attendances array must not be empty');
        }

        // Verify every submitted studentId is enrolled in this course
        const enrollments = await this.prisma.enrollment.findMany({
            where: { courseId: session.courseId },
            select: { studentId: true },
        });
        const enrolledIds = new Set(enrollments.map((e) => e.studentId));

        const notEnrolled = dto.attendances
            .map((a) => a.studentId)
            .filter((id) => !enrolledIds.has(id));

        if (notEnrolled.length) {
            throw new BadRequestException(
                `The following students are not enrolled in this course: ${notEnrolled.join(', ')}`,
            );
        }

        // Upsert all entries in a single transaction
        await this.prisma.$transaction(
            dto.attendances.map((a) =>
                this.prisma.attendance.upsert({
                    where: { sessionId_studentId: { sessionId, studentId: a.studentId } },
                    create: { sessionId, studentId: a.studentId, status: a.status },
                    update: { status: a.status },
                }),
            ),
        );

        return {
            sessionId,
            recorded: dto.attendances.length,
        };
    }

    /**
     * Returns per-student attendance stats for a course.
     * STUDENT receives only their own row; TEACHER and ADMIN see all enrolled students.
     * `atRisk` is true when absenceRate (ABSENT / totalSessions) exceeds AT_RISK_THRESHOLD.
     * EXCUSED absences and unrecorded sessions are reported separately but do not count
     * against the student for the atRisk calculation.
     */
    async getAttendanceRate(courseId: string, caller: { id: string; role: Role }) {
        const course = await this.prisma.course.findUnique({
            where: { id: courseId },
            select: { teacherId: true },
        });
        if (!course) throw new NotFoundException(`Course ${courseId} not found`);

        if (caller.role === Role.TEACHER && course.teacherId !== caller.id) {
            throw new ForbiddenException('You do not teach this course');
        }

        if (caller.role === Role.STUDENT) {
            const enrollment = await this.prisma.enrollment.findUnique({
                where: { studentId_courseId: { studentId: caller.id, courseId } },
            });
            if (!enrollment) throw new ForbiddenException('You are not enrolled in this course');
        }

        const threshold = parseFloat(process.env.AT_RISK_THRESHOLD ?? '0.20');

        const totalSessions = await this.prisma.classSession.count({ where: { courseId } });

        // Determine target students
        const enrollments = await this.prisma.enrollment.findMany({
            where: { courseId },
            select: { studentId: true, student: { select: { name: true, email: true } } },
        });

        const targetStudents =
            caller.role === Role.STUDENT
                ? enrollments.filter((e) => e.studentId === caller.id)
                : enrollments;

        // Fetch all attendance records for this course in one query
        const allAttendances = await this.prisma.attendance.findMany({
            where: { session: { courseId } },
            select: { studentId: true, status: true },
        });

        // Group by studentId
        const byStudent = new Map<string, { PRESENT: number; LATE: number; ABSENT: number; EXCUSED: number }>();
        for (const a of allAttendances) {
            if (!byStudent.has(a.studentId)) {
                byStudent.set(a.studentId, { PRESENT: 0, LATE: 0, ABSENT: 0, EXCUSED: 0 });
            }
            const entry = byStudent.get(a.studentId)!;
            entry[a.status as 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED']++;
        }

        return targetStudents.map(({ studentId, student }) => {
            const counts = byStudent.get(studentId) ?? { PRESENT: 0, LATE: 0, ABSENT: 0, EXCUSED: 0 };
            const attended = counts.PRESENT + counts.LATE;
            const absent = counts.ABSENT;
            const unrecorded = totalSessions - (attended + absent + counts.EXCUSED);
            const absenceRate = totalSessions > 0 ? absent / totalSessions : 0;
            const attendanceRate = totalSessions > 0 ? attended / totalSessions : null;

            return {
                studentId,
                name: student.name,
                email: student.email,
                totalSessions,
                attended,
                absences: absent,
                excused: counts.EXCUSED,
                unrecorded,
                attendanceRate: attendanceRate !== null ? Math.round(attendanceRate * 1000) / 1000 : null,
                absenceRate: Math.round(absenceRate * 1000) / 1000,
                atRisk: totalSessions > 0 && absenceRate > threshold,
            };
        });
    }
}
