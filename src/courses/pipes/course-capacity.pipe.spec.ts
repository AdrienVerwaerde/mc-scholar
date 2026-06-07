import {
    ConflictException,
    NotFoundException,
} from '@nestjs/common';
import { CourseCapacityPipe } from './course-capacity.pipe';

describe('CourseCapacityPipe', () => {
    let pipe: CourseCapacityPipe;
    let mockPrisma: { course: { findUnique: jest.Mock } };

    const buildCourseRow = (overrides: Partial<{
        id: string;
        code: string;
        capacity: number;
        enrollments: number;
    }> = {}) => ({
        id: overrides.id ?? 'course-1',
        code: overrides.code ?? 'MATH101',
        capacity: overrides.capacity ?? 30,
        _count: { enrollments: overrides.enrollments ?? 0 },
    });

    beforeEach(() => {
        mockPrisma = { course: { findUnique: jest.fn() } };
        pipe = new CourseCapacityPipe(mockPrisma as any);
    });

    it('returns the course when capacity is not reached', async () => {
        mockPrisma.course.findUnique.mockResolvedValue(buildCourseRow({ enrollments: 5 }));

        const result = await pipe.transform('course-1', {} as any);

        expect(result).toEqual({
            id: 'course-1',
            code: 'MATH101',
            capacity: 30,
            currentEnrollments: 5,
        });
    });

    it('returns the course on the last available seat', async () => {
        mockPrisma.course.findUnique.mockResolvedValue(buildCourseRow({ enrollments: 29 }));
        const result = await pipe.transform('course-1', {} as any);
        expect(result.currentEnrollments).toBe(29);
    });

    it('throws ConflictException when course is exactly at capacity', async () => {
        mockPrisma.course.findUnique.mockResolvedValue(buildCourseRow({ enrollments: 30 }));

        await expect(pipe.transform('course-1', {} as any)).rejects.toThrow(
            ConflictException,
        );
    });

    it('throws ConflictException when course is over capacity', async () => {
        mockPrisma.course.findUnique.mockResolvedValue(buildCourseRow({ enrollments: 999 }));

        await expect(pipe.transform('course-1', {} as any)).rejects.toThrow(
            /full/,
        );
    });

    it('throws NotFoundException when course does not exist', async () => {
        mockPrisma.course.findUnique.mockResolvedValue(null);

        await expect(pipe.transform('missing-id', {} as any)).rejects.toThrow(
            NotFoundException,
        );
    });

    it('queries Prisma with the right where + _count select', async () => {
        mockPrisma.course.findUnique.mockResolvedValue(buildCourseRow());

        await pipe.transform('course-xyz', {} as any);

        expect(mockPrisma.course.findUnique).toHaveBeenCalledWith({
            where: { id: 'course-xyz' },
            select: expect.objectContaining({
                _count: { select: { enrollments: true } },
            }),
        });
    });
});