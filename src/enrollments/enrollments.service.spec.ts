import { ConflictException, NotFoundException } from '@nestjs/common';
import { EnrollmentsService } from './enrollments.service';

const makePrisma = () => ({
    enrollment: {
        findUnique: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        delete: jest.fn(),
    },
});

describe('EnrollmentsService', () => {
    let service: EnrollmentsService;
    let prisma: ReturnType<typeof makePrisma>;

    beforeEach(() => {
        prisma = makePrisma();
        service = new EnrollmentsService(prisma as any);
    });

    // ---------- enroll ----------

    describe('enroll', () => {
        it('creates enrollment when not already enrolled', async () => {
            prisma.enrollment.findUnique.mockResolvedValue(null);
            prisma.enrollment.create.mockResolvedValue({ id: 'e1', studentId: 's1', courseId: 'c1' });

            const result = await service.enroll('c1', 's1');

            expect(prisma.enrollment.create).toHaveBeenCalledWith(
                expect.objectContaining({ data: { studentId: 's1', courseId: 'c1' } }),
            );
            expect(result).toMatchObject({ id: 'e1' });
        });

        it('throws ConflictException when student is already enrolled', async () => {
            prisma.enrollment.findUnique.mockResolvedValue({ id: 'e1' });

            await expect(service.enroll('c1', 's1')).rejects.toThrow(ConflictException);
            expect(prisma.enrollment.create).not.toHaveBeenCalled();
        });
    });

    // ---------- unenroll ----------

    describe('unenroll', () => {
        it('deletes enrollment and returns { deleted: true }', async () => {
            prisma.enrollment.findUnique.mockResolvedValue({ id: 'e1' });
            prisma.enrollment.delete.mockResolvedValue({});

            const result = await service.unenroll('c1', 's1');

            expect(prisma.enrollment.delete).toHaveBeenCalledWith({ where: { id: 'e1' } });
            expect(result).toEqual({ deleted: true });
        });

        it('throws NotFoundException when student is not enrolled', async () => {
            prisma.enrollment.findUnique.mockResolvedValue(null);

            await expect(service.unenroll('c1', 's1')).rejects.toThrow(NotFoundException);
            expect(prisma.enrollment.delete).not.toHaveBeenCalled();
        });
    });

    // ---------- listMine ----------

    describe('listMine', () => {
        it('returns enrollments with course info for the student', async () => {
            const rows = [
                { id: 'e1', course: { id: 'c1', code: 'MATH', title: 'Math 101', semester: '2026-S1', teacher: { id: 't1', name: 'Alice' } } },
            ];
            prisma.enrollment.findMany.mockResolvedValue(rows);

            const result = await service.listMine('s1');

            expect(prisma.enrollment.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ where: { studentId: 's1' } }),
            );
            expect(result).toEqual(rows);
        });

        it('returns empty array when student has no enrollments', async () => {
            prisma.enrollment.findMany.mockResolvedValue([]);

            const result = await service.listMine('s1');
            expect(result).toEqual([]);
        });
    });
});
