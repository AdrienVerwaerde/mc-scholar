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
}
