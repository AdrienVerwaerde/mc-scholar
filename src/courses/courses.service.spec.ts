import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    NotFoundException,
} from '@nestjs/common';
import { CoursesService } from './courses.service';

const makePrisma = () => ({
    course: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
    },
    evaluationWeight: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
    },
    $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
});

const COURSE = {
    id: 'c1',
    code: 'MATH101',
    title: 'Math',
    semester: '2026-S1',
    capacity: 30,
    teacherId: 'teacher-1',
    teacher: { id: 'teacher-1', name: 'Alice', email: 'alice@test.com' },
    evaluationWeights: [],
    _count: { enrollments: 0 },
};

// ---------- create ----------

describe('CoursesService.create', () => {
    let service: CoursesService;
    let prisma: ReturnType<typeof makePrisma>;

    beforeEach(() => {
        prisma = makePrisma();
        service = new CoursesService(prisma as any);
    });

    const dto = { code: 'MATH101', title: 'Math', semester: '2026-S1', capacity: 30 };

    it('creates course on happy path', async () => {
        prisma.course.findUnique.mockResolvedValue(null);
        prisma.course.create.mockResolvedValue(COURSE);

        const result = await service.create(dto, 'teacher-1');

        expect(prisma.course.create).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ code: 'MATH101', teacherId: 'teacher-1' }) }),
        );
        expect(result).toMatchObject({ id: 'c1' });
    });

    it('throws ConflictException when course code already exists', async () => {
        prisma.course.findUnique.mockResolvedValue(COURSE);

        await expect(service.create(dto, 'teacher-1')).rejects.toThrow(ConflictException);
        expect(prisma.course.create).not.toHaveBeenCalled();
    });
});

// ---------- list ----------

describe('CoursesService.list', () => {
    let service: CoursesService;
    let prisma: ReturnType<typeof makePrisma>;

    beforeEach(() => {
        prisma = makePrisma();
        service = new CoursesService(prisma as any);
        prisma.$transaction.mockImplementation((ops: unknown[]) => Promise.all(ops as Promise<unknown>[]));
        prisma.course.findMany.mockResolvedValue([COURSE]);
        prisma.course.count.mockResolvedValue(1);
    });

    it('returns paginated list with default query', async () => {
        const result = await service.list({ page: 1, limit: 10 } as any);

        expect(result.items).toHaveLength(1);
        expect(result.pagination).toMatchObject({ page: 1, limit: 10, total: 1, totalPages: 1 });
    });

    it('applies semester filter when provided', async () => {
        await service.list({ page: 1, limit: 10, semester: '2026-S1' } as any);

        expect(prisma.course.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: expect.objectContaining({ semester: '2026-S1' }) }),
        );
    });

    it('applies search filter across code and title', async () => {
        await service.list({ page: 1, limit: 10, search: 'math' } as any);

        expect(prisma.course.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: expect.objectContaining({ OR: expect.any(Array) }) }),
        );
    });
});

// ---------- findOne ----------

describe('CoursesService.findOne', () => {
    let service: CoursesService;
    let prisma: ReturnType<typeof makePrisma>;

    beforeEach(() => {
        prisma = makePrisma();
        service = new CoursesService(prisma as any);
    });

    it('returns course when found', async () => {
        prisma.course.findUnique.mockResolvedValue(COURSE);

        const result = await service.findOne('c1');
        expect(result).toMatchObject({ id: 'c1' });
    });

    it('throws NotFoundException when course not found', async () => {
        prisma.course.findUnique.mockResolvedValue(null);

        await expect(service.findOne('c1')).rejects.toThrow(NotFoundException);
    });
});

// ---------- update ----------

describe('CoursesService.update', () => {
    let service: CoursesService;
    let prisma: ReturnType<typeof makePrisma>;

    beforeEach(() => {
        prisma = makePrisma();
        service = new CoursesService(prisma as any);
    });

    it('updates course on happy path', async () => {
        prisma.course.findUnique.mockResolvedValue(COURSE);
        prisma.course.update.mockResolvedValue({ ...COURSE, title: 'Updated' });

        const result = await service.update('c1', { title: 'Updated' });
        expect(result.title).toBe('Updated');
    });

    it('throws NotFoundException when course not found', async () => {
        prisma.course.findUnique.mockResolvedValue(null);

        await expect(service.update('c1', { title: 'X' })).rejects.toThrow(NotFoundException);
    });
});

// ---------- remove ----------

describe('CoursesService.remove', () => {
    let service: CoursesService;
    let prisma: ReturnType<typeof makePrisma>;

    beforeEach(() => {
        prisma = makePrisma();
        service = new CoursesService(prisma as any);
    });

    it('deletes course and returns { deleted: true }', async () => {
        prisma.course.findUnique.mockResolvedValue(COURSE);
        prisma.course.delete.mockResolvedValue({});

        const result = await service.remove('c1');
        expect(result).toEqual({ deleted: true });
    });

    it('throws NotFoundException when course not found', async () => {
        prisma.course.findUnique.mockResolvedValue(null);

        await expect(service.remove('c1')).rejects.toThrow(NotFoundException);
    });
});

// ---------- setWeights ----------

describe('CoursesService.setWeights', () => {
    let service: CoursesService;
    let prisma: ReturnType<typeof makePrisma>;

    beforeEach(() => {
        prisma = makePrisma();
        service = new CoursesService(prisma as any);
        prisma.course.findUnique.mockResolvedValue(COURSE);
        prisma.evaluationWeight.deleteMany.mockResolvedValue({});
        prisma.evaluationWeight.createMany.mockResolvedValue({});
        prisma.course.update.mockResolvedValue(COURSE);
    });

    it('replaces weights on happy path', async () => {
        const dto = { weights: [{ type: 'EXAM', weight: 0.6 }, { type: 'MIDTERM', weight: 0.4 }] };

        await service.setWeights('c1', dto as any);

        expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('throws BadRequestException when weights do not sum to 1', async () => {
        const dto = { weights: [{ type: 'EXAM', weight: 0.5 }] };

        await expect(service.setWeights('c1', dto as any)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when duplicate types are provided', async () => {
        const dto = { weights: [{ type: 'EXAM', weight: 0.5 }, { type: 'EXAM', weight: 0.5 }] };

        await expect(service.setWeights('c1', dto as any)).rejects.toThrow(/Duplicate/);
    });

    it('throws NotFoundException when course not found', async () => {
        prisma.course.findUnique.mockResolvedValue(null);

        const dto = { weights: [{ type: 'EXAM', weight: 1.0 }] };
        await expect(service.setWeights('c1', dto as any)).rejects.toThrow(NotFoundException);
    });
});

// ---------- assertTeacherOwns ----------

describe('CoursesService.assertTeacherOwns', () => {
    let service: CoursesService;
    let prisma: ReturnType<typeof makePrisma>;

    beforeEach(() => {
        prisma = makePrisma();
        service = new CoursesService(prisma as any);
    });

    it('resolves when teacher owns the course', async () => {
        prisma.course.findUnique.mockResolvedValue({ teacherId: 'teacher-1' });

        await expect(service.assertTeacherOwns('c1', 'teacher-1')).resolves.toBeUndefined();
    });

    it('throws ForbiddenException when teacher does not own the course', async () => {
        prisma.course.findUnique.mockResolvedValue({ teacherId: 'other' });

        await expect(service.assertTeacherOwns('c1', 'teacher-1')).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when course does not exist', async () => {
        prisma.course.findUnique.mockResolvedValue(null);

        await expect(service.assertTeacherOwns('c1', 'teacher-1')).rejects.toThrow(NotFoundException);
    });
});
