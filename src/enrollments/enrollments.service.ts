import {
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EnrollmentsService {
    constructor(private readonly prisma: PrismaService) { }

    /**
     * Enrolls a student in a course. Capacity check is enforced by
     * the CourseCapacityPipe at the controller level — by the time
     * we get here, capacity is guaranteed.
     *
     * Throws ConflictException if the student is already enrolled.
     */
    async enroll(courseId: string, studentId: string) {
        const existing = await this.prisma.enrollment.findUnique({
            where: { studentId_courseId: { studentId, courseId } },
        });
        if (existing) {
            throw new ConflictException('You are already enrolled in this course');
        }

        return this.prisma.enrollment.create({
            data: { studentId, courseId },
            include: {
                course: {
                    select: { id: true, code: true, title: true, semester: true },
                },
            },
        });
    }

    /**
     * Removes a student's enrollment from a course.
     * Idempotent-ish: returns 404 if not enrolled.
     */
    async unenroll(courseId: string, studentId: string) {
        const enrollment = await this.prisma.enrollment.findUnique({
            where: { studentId_courseId: { studentId, courseId } },
        });
        if (!enrollment) {
            throw new NotFoundException('You are not enrolled in this course');
        }
        await this.prisma.enrollment.delete({
            where: { id: enrollment.id },
        });
        return { deleted: true };
    }

    /** Lists the enrollments of a given student (used by /me/enrollments). */
    async listMine(studentId: string) {
        return this.prisma.enrollment.findMany({
            where: { studentId },
            orderBy: { enrolledAt: 'desc' },
            include: {
                course: {
                    select: {
                        id: true,
                        code: true,
                        title: true,
                        semester: true,
                        teacher: { select: { id: true, name: true } },
                    },
                },
            },
        });
    }
}