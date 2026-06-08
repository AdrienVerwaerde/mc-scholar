import {
    ArgumentMetadata,
    ConflictException,
    Injectable,
    NotFoundException,
    PipeTransform,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface CourseWithCapacityCheck {
    id: string;
    code: string;
    capacity: number;
    currentEnrollments: number;
}

/**
 * Pipe that takes a course id (string) and:
 *   1. Verifies the course exists (404 if not)
 *   2. Verifies the course is not at capacity (409 if full)
 *   3. Returns the course + its current enrollment count
 *
 * Designed to be plugged on a @Param('id') in enrollment routes.
 */
@Injectable()
export class CourseCapacityPipe implements PipeTransform<string, Promise<CourseWithCapacityCheck>> {
    constructor(private readonly prisma: PrismaService) { }

    async transform(
        courseId: string,
        _metadata: ArgumentMetadata,
    ): Promise<CourseWithCapacityCheck> {
        const course = await this.prisma.course.findUnique({
            where: { id: courseId },
            select: {
                id: true,
                code: true,
                capacity: true,
                _count: { select: { enrollments: true } },
            },
        });

        if (!course) {
            throw new NotFoundException(`Course ${courseId} not found`);
        }

        const currentEnrollments = course._count.enrollments;

        if (currentEnrollments >= course.capacity) {
            throw new ConflictException(
                `Course ${course.code} is full (${currentEnrollments}/${course.capacity})`,
            );
        }

        return {
            id: course.id,
            code: course.code,
            capacity: course.capacity,
            currentEnrollments,
        };
    }
}