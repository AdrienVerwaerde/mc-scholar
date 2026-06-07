import {
    BadRequestException,
    ForbiddenException,
    NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { GradesService } from './grades.service';

// ---------- helpers ----------

const TEACHER = { id: 'teacher-1', role: Role.TEACHER };
const ADMIN = { id: 'admin-1', role: Role.ADMIN };
const STUDENT = { id: 'student-1', role: Role.STUDENT };

const COURSE = {
    id: 'course-1',
    teacherId: 'teacher-1',
    evaluationWeights: [
        { type: 'EXAM', weight: 0.6 },
        { type: 'MIDTERM', weight: 0.4 },
    ],
};

const makePrisma = () => ({
    course: { findUnique: jest.fn() },
    enrollment: { findUnique: jest.fn(), findMany: jest.fn() },
    grade: { create: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn(), delete: jest.fn() },
    $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
});

// ---------- create ----------

describe('GradesService.create', () => {
    let service: GradesService;
    let prisma: ReturnType<typeof makePrisma>;

    beforeEach(() => {
        prisma = makePrisma();
        service = new GradesService(prisma as any);
    });

    const dto = { studentId: 'student-1', courseId: 'course-1', type: 'EXAM' as any, value: 14.5 };

    it('creates and returns the grade on happy path', async () => {
        prisma.course.findUnique.mockResolvedValue(COURSE);
        prisma.enrollment.findUnique.mockResolvedValue({ id: 'enroll-1' });
        prisma.grade.create.mockResolvedValue({ id: 'grade-1', ...dto });

        const result = await service.create(dto, TEACHER);

        expect(prisma.grade.create).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ value: 14.5, type: 'EXAM' }) }),
        );
        expect(result).toMatchObject({ id: 'grade-1' });
    });

    it('throws NotFoundException when course does not exist', async () => {
        prisma.course.findUnique.mockResolvedValue(null);

        await expect(service.create(dto, TEACHER)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when TEACHER does not own the course', async () => {
        prisma.course.findUnique.mockResolvedValue({ ...COURSE, teacherId: 'other-teacher' });

        await expect(service.create(dto, TEACHER)).rejects.toThrow(ForbiddenException);
    });

    it('allows ADMIN to grade on any course', async () => {
        prisma.course.findUnique.mockResolvedValue({ ...COURSE, teacherId: 'someone-else' });
        prisma.enrollment.findUnique.mockResolvedValue({ id: 'enroll-1' });
        prisma.grade.create.mockResolvedValue({ id: 'grade-1', ...dto });

        await expect(service.create(dto, ADMIN)).resolves.toBeDefined();
    });

    it('throws BadRequestException when student is not enrolled', async () => {
        prisma.course.findUnique.mockResolvedValue(COURSE);
        prisma.enrollment.findUnique.mockResolvedValue(null);

        await expect(service.create(dto, TEACHER)).rejects.toThrow(
            new BadRequestException('Student is not enrolled in this course'),
        );
    });

    it('throws BadRequestException when evaluation type is not configured', async () => {
        prisma.course.findUnique.mockResolvedValue(COURSE);
        prisma.enrollment.findUnique.mockResolvedValue({ id: 'enroll-1' });

        await expect(
            service.create({ ...dto, type: 'PROJECT' as any }, TEACHER),
        ).rejects.toThrow(/not configured/);
    });
});

// ---------- importCsv ----------

describe('GradesService.importCsv', () => {
    let service: GradesService;
    let prisma: ReturnType<typeof makePrisma>;

    const makeCsv = (body: string) => ({
        buffer: Buffer.from(`studentId,type,value,comment\n${body}`),
        originalname: 'grades.csv',
    });

    beforeEach(() => {
        prisma = makePrisma();
        service = new GradesService(prisma as any);
        prisma.course.findUnique.mockResolvedValue(COURSE);
        prisma.enrollment.findMany.mockResolvedValue([{ studentId: 'student-1' }]);
    });

    it('imports all rows and returns success when CSV is valid', async () => {
        prisma.grade.create.mockResolvedValue({});

        const result = await service.importCsv('course-1', makeCsv('student-1,EXAM,14.5,Good'), TEACHER);

        expect(result).toEqual({ success: true, imported: 1, errors: [] });
        expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('returns error report and skips transaction when an eval type is wrong', async () => {
        const result = await service.importCsv('course-1', makeCsv('student-1,PROJECT,14.5'), TEACHER);

        expect(result).toMatchObject({ success: false, imported: 0 });
        expect((result as any).errors[0].error).toMatch(/not configured/);
        expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('returns error report when value is out of range', async () => {
        const result = await service.importCsv('course-1', makeCsv('student-1,EXAM,25'), TEACHER);

        expect(result).toMatchObject({ success: false, imported: 0 });
        expect((result as any).errors[0].error).toMatch(/0 and 20/);
    });

    it('returns error report when student is not enrolled', async () => {
        const result = await service.importCsv('course-1', makeCsv('unknown-student,EXAM,14'), TEACHER);

        expect(result).toMatchObject({ success: false, imported: 0 });
        expect((result as any).errors[0].error).toMatch(/not enrolled/);
    });

    it('collects errors from multiple rows without touching the DB', async () => {
        const csv = makeCsv([
            'student-1,PROJECT,14',
            'student-1,EXAM,99',
        ].join('\n'));

        const result = await service.importCsv('course-1', csv, TEACHER) as any;

        expect(result.success).toBe(false);
        expect(result.errors).toHaveLength(2);
        expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when TEACHER does not own the course', async () => {
        prisma.course.findUnique.mockResolvedValue({ ...COURSE, teacherId: 'other' });

        await expect(
            service.importCsv('course-1', makeCsv('student-1,EXAM,14'), TEACHER),
        ).rejects.toThrow(ForbiddenException);
    });
});

// ---------- getAverage ----------

describe('GradesService.getAverage', () => {
    let service: GradesService;
    let prisma: ReturnType<typeof makePrisma>;

    beforeEach(() => {
        prisma = makePrisma();
        service = new GradesService(prisma as any);
    });

    it('throws ForbiddenException when TEACHER does not own the course', async () => {
        prisma.course.findUnique.mockResolvedValue({ ...COURSE, teacherId: 'other' });

        await expect(
            service.getAverage(TEACHER, { courseId: 'course-1' }),
        ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when no weights are configured', async () => {
        prisma.course.findUnique.mockResolvedValue({ ...COURSE, evaluationWeights: [] });

        await expect(
            service.getAverage(STUDENT, { courseId: 'course-1' }),
        ).rejects.toThrow(BadRequestException);
    });

    it('returns weightedAverage=null and isPartial=true when student has no grades', async () => {
        prisma.course.findUnique.mockResolvedValue(COURSE);
        prisma.grade.findMany.mockResolvedValue([]);

        const [result] = await service.getAverage(STUDENT, { courseId: 'course-1' });

        expect(result.weightedAverage).toBeNull();
        expect(result.isPartial).toBe(true);
    });

    it('computes correct weighted average when all types are graded', async () => {
        prisma.course.findUnique.mockResolvedValue(COURSE); // EXAM 0.6, MIDTERM 0.4
        prisma.grade.findMany.mockResolvedValue([
            { type: 'EXAM', value: 15 },
            { type: 'MIDTERM', value: 10 },
        ]);

        const [result] = await service.getAverage(STUDENT, { courseId: 'course-1' });

        // (15 * 0.6 + 10 * 0.4) / 1.0 = 9 + 4 = 13
        expect(result.weightedAverage).toBe(13);
        expect(result.isPartial).toBe(false);
    });

    it('normalizes over graded types only and flags isPartial when a type is missing', async () => {
        prisma.course.findUnique.mockResolvedValue(COURSE); // EXAM 0.6, MIDTERM 0.4
        prisma.grade.findMany.mockResolvedValue([
            { type: 'EXAM', value: 15 },
        ]);

        const [result] = await service.getAverage(STUDENT, { courseId: 'course-1' });

        // Only EXAM graded: 15 * 0.6 / 0.6 = 15
        expect(result.weightedAverage).toBe(15);
        expect(result.isPartial).toBe(true);
    });

    it('averages multiple grades of the same type before weighting', async () => {
        prisma.course.findUnique.mockResolvedValue(COURSE);
        prisma.grade.findMany.mockResolvedValue([
            { type: 'EXAM', value: 10 },
            { type: 'EXAM', value: 20 },   // avg → 15
            { type: 'MIDTERM', value: 10 },
        ]);

        const [result] = await service.getAverage(STUDENT, { courseId: 'course-1' });

        // (15 * 0.6 + 10 * 0.4) / 1.0 = 9 + 4 = 13
        expect(result.weightedAverage).toBe(13);
    });
});

// ---------- remove ----------

describe('GradesService.remove', () => {
    let service: GradesService;
    let prisma: ReturnType<typeof makePrisma>;

    beforeEach(() => {
        prisma = makePrisma();
        service = new GradesService(prisma as any);
    });

    it('deletes grade and returns { deleted: true }', async () => {
        prisma.grade.findUnique.mockResolvedValue({ id: 'grade-1', courseId: 'course-1' });
        prisma.course.findUnique.mockResolvedValue(COURSE);
        prisma.grade.delete.mockResolvedValue({});

        const result = await service.remove('grade-1', TEACHER);

        expect(prisma.grade.delete).toHaveBeenCalledWith({ where: { id: 'grade-1' } });
        expect(result).toEqual({ deleted: true });
    });

    it('throws NotFoundException when grade does not exist', async () => {
        prisma.grade.findUnique.mockResolvedValue(null);

        await expect(service.remove('grade-1', TEACHER)).rejects.toThrow(NotFoundException);
    });

    it('allows ADMIN to delete any grade', async () => {
        prisma.grade.findUnique.mockResolvedValue({ id: 'grade-1', courseId: 'course-1' });
        prisma.grade.delete.mockResolvedValue({});

        await expect(service.remove('grade-1', ADMIN)).resolves.toEqual({ deleted: true });
    });
});

// ---------- listForCaller ----------

describe('GradesService.listForCaller', () => {
    let service: GradesService;
    let prisma: ReturnType<typeof makePrisma>;

    beforeEach(() => {
        prisma = makePrisma();
        service = new GradesService(prisma as any);
        prisma.grade.findMany.mockResolvedValue([]);
    });

    it('restricts STUDENT to their own grades', async () => {
        await service.listForCaller(STUDENT, {});

        expect(prisma.grade.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ studentId: STUDENT.id }),
            }),
        );
    });

    it('restricts TEACHER to courses they teach', async () => {
        await service.listForCaller(TEACHER, {});

        expect(prisma.grade.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ course: { teacherId: TEACHER.id } }),
            }),
        );
    });

    it('applies no extra filter for ADMIN', async () => {
        await service.listForCaller(ADMIN, {});

        const call = prisma.grade.findMany.mock.calls[0][0];
        expect(call.where).not.toHaveProperty('studentId');
        expect(call.where).not.toHaveProperty('course');
    });

    it('applies courseId and type filters when provided', async () => {
        await service.listForCaller(ADMIN, { courseId: 'c1', type: 'EXAM' });

        expect(prisma.grade.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ courseId: 'c1', type: 'EXAM' }),
            }),
        );
    });
});

// ---------- getAverage — extra paths ----------

describe('GradesService.getAverage — extra paths', () => {
    let service: GradesService;
    let prisma: ReturnType<typeof makePrisma>;

    beforeEach(() => {
        prisma = makePrisma();
        service = new GradesService(prisma as any);
        prisma.course.findUnique.mockResolvedValue(COURSE);
    });

    it('returns average for a specific studentId when TEACHER queries it', async () => {
        prisma.grade.findMany.mockResolvedValue([{ type: 'EXAM', value: 12 }]);

        const [result] = await service.getAverage(TEACHER, { courseId: 'course-1', studentId: 'student-1' });

        expect(result.weightedAverage).toBe(12);
    });

    it('returns averages for all enrolled students when called without studentId', async () => {
        prisma.enrollment.findMany.mockResolvedValue([
            { studentId: 'student-1', student: { name: 'Alice', email: 'alice@test.com' } },
            { studentId: 'student-2', student: { name: 'Bob', email: 'bob@test.com' } },
        ]);
        prisma.grade.findMany.mockResolvedValue([]);

        const results = await service.getAverage(TEACHER, { courseId: 'course-1' });

        expect(results).toHaveLength(2);
    });

    it('throws NotFoundException when course does not exist', async () => {
        prisma.course.findUnique.mockResolvedValue(null);

        await expect(service.getAverage(STUDENT, { courseId: 'nope' })).rejects.toThrow(NotFoundException);
    });
});

// ---------- importCsv — extra paths ----------

describe('GradesService.importCsv — extra paths', () => {
    let service: GradesService;
    let prisma: ReturnType<typeof makePrisma>;

    const makeCsv = (body: string) => ({
        buffer: Buffer.from(`studentId,type,value\n${body}`),
        originalname: 'grades.csv',
    });

    beforeEach(() => {
        prisma = makePrisma();
        service = new GradesService(prisma as any);
        prisma.course.findUnique.mockResolvedValue(COURSE);
        prisma.enrollment.findMany.mockResolvedValue([{ studentId: 'student-1' }]);
    });

    it('returns error when value field is missing', async () => {
        const csv = {
            buffer: Buffer.from('studentId,type\nstudent-1,EXAM'),
            originalname: 'grades.csv',
        };
        const result = await service.importCsv('course-1', csv, TEACHER) as any;

        expect(result.success).toBe(false);
        expect(result.errors[0].error).toMatch(/missing value/);
    });

    it('handles quoted fields in CSV correctly', async () => {
        const csv = {
            buffer: Buffer.from(`studentId,type,value,comment\nstudent-1,EXAM,15,"Good, well done"`),
            originalname: 'grades.csv',
        };
        prisma.grade.create.mockResolvedValue({});

        const result = await service.importCsv('course-1', csv, TEACHER);

        expect(result).toMatchObject({ success: true, imported: 1 });
    });
});
