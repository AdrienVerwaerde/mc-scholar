import { BadRequestException } from '@nestjs/common';
import { AdminService } from './admin.service';

// ---------- helpers ----------

const makePrisma = () => ({
    course: {
        findMany: jest.fn(),
    },
    enrollment: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        groupBy: jest.fn(),
    },
    grade: {
        findMany: jest.fn(),
        aggregate: jest.fn(),
        groupBy: jest.fn(),
    },
    classSession: {
        findMany: jest.fn(),
        groupBy: jest.fn(),
    },
    attendance: {
        findMany: jest.fn(),
    },
    user: {
        findMany: jest.fn(),
    },
    $transaction: jest.fn((ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
});

// ---------- exportSemesterCsv ----------

describe('AdminService.exportSemesterCsv', () => {
    let service: AdminService;
    let prisma: ReturnType<typeof makePrisma>;

    beforeEach(() => {
        prisma = makePrisma();
        service = new AdminService(prisma as any);
    });

    it('throws BadRequestException when semester is missing', async () => {
        await expect(service.exportSemesterCsv('')).rejects.toThrow(BadRequestException);
    });

    it('returns CSV header-only when no courses exist for the semester', async () => {
        prisma.course.findMany.mockResolvedValue([]);

        const result = await service.exportSemesterCsv('2026-S1');

        expect(result).toContain('studentName');
        expect(result).not.toContain('Alice');
    });

    it('generates CSV with one row per enrollment', async () => {
        const course = {
            id: 'c1',
            code: 'MATH101',
            title: 'Math',
            semester: '2026-S1',
            teacher: { name: 'Prof. Alice' },
            evaluationWeights: [{ type: 'EXAM', weight: 1.0 }],
        };
        prisma.course.findMany.mockResolvedValue([course]);
        prisma.enrollment.findMany.mockResolvedValue([
            { studentId: 's1', courseId: 'c1', student: { name: 'Bob', email: 'bob@test.com' } },
        ]);
        prisma.grade.findMany.mockResolvedValue([
            { studentId: 's1', courseId: 'c1', type: 'EXAM', value: 15 },
        ]);
        prisma.classSession.findMany.mockResolvedValue([{ id: 'sess-1', courseId: 'c1' }]);
        prisma.attendance.findMany.mockResolvedValue([]);

        const result = await service.exportSemesterCsv('2026-S1');

        expect(result).toContain('Bob');
        expect(result).toContain('MATH101');
        expect(result).toContain('15');
    });

    it('computes weighted average across multiple grade types', async () => {
        const course = {
            id: 'c1',
            code: 'MATH101',
            title: 'Math',
            semester: '2026-S1',
            teacher: { name: 'Prof. Alice' },
            evaluationWeights: [
                { type: 'EXAM', weight: 0.6 },
                { type: 'MIDTERM', weight: 0.4 },
            ],
        };
        prisma.course.findMany.mockResolvedValue([course]);
        prisma.enrollment.findMany.mockResolvedValue([
            { studentId: 's1', courseId: 'c1', student: { name: 'Bob', email: 'bob@test.com' } },
        ]);
        prisma.grade.findMany.mockResolvedValue([
            { studentId: 's1', courseId: 'c1', type: 'EXAM', value: 10 },
            { studentId: 's1', courseId: 'c1', type: 'MIDTERM', value: 20 },
        ]);
        prisma.classSession.findMany.mockResolvedValue([]);
        prisma.attendance.findMany.mockResolvedValue([]);

        const csv = await service.exportSemesterCsv('2026-S1');
        // 10*0.6 + 20*0.4 = 6+8 = 14
        expect(csv).toContain('14');
    });

    it('marks atRisk when absence rate exceeds threshold', async () => {
        const course = {
            id: 'c1',
            code: 'MATH101',
            title: 'Math',
            semester: '2026-S1',
            teacher: { name: 'Prof. Alice' },
            evaluationWeights: [],
        };
        prisma.course.findMany.mockResolvedValue([course]);
        prisma.enrollment.findMany.mockResolvedValue([
            { studentId: 's1', courseId: 'c1', student: { name: 'Bob', email: 'bob@test.com' } },
        ]);
        prisma.grade.findMany.mockResolvedValue([]);
        prisma.classSession.findMany.mockResolvedValue([
            { id: 'sess-1', courseId: 'c1' },
            { id: 'sess-2', courseId: 'c1' },
            { id: 'sess-3', courseId: 'c1' },
        ]);
        prisma.attendance.findMany.mockResolvedValue([
            { studentId: 's1', sessionId: 'sess-1', status: 'ABSENT' },
        ]);

        const csv = await service.exportSemesterCsv('2026-S1');
        // 1 absent / 3 sessions = 0.333 > 0.20 → atRisk = true
        expect(csv).toContain('true');
    });
});

// ---------- getSemesterStats ----------

describe('AdminService.getSemesterStats', () => {
    let service: AdminService;
    let prisma: ReturnType<typeof makePrisma>;

    beforeEach(() => {
        prisma = makePrisma();
        service = new AdminService(prisma as any);
    });

    it('throws BadRequestException when semester is missing', async () => {
        await expect(service.getSemesterStats('')).rejects.toThrow(BadRequestException);
    });

    it('returns zeroed stats when no courses exist', async () => {
        prisma.course.findMany.mockResolvedValue([]);

        const result = await service.getSemesterStats('2026-S1');

        expect(result).toMatchObject({
            semester: '2026-S1',
            totalCourses: 0,
            totalStudents: 0,
            averageGrade: null,
        });
    });

    it('returns aggregated stats for a semester with courses', async () => {
        prisma.course.findMany.mockResolvedValue([
            { id: 'c1', code: 'MATH101', title: 'Math', teacher: { name: 'Alice' }, _count: { enrollments: 2 } },
        ]);

        // Parallel queries result
        prisma.enrollment.groupBy.mockResolvedValue([{ studentId: 's1' }, { studentId: 's2' }]);
        prisma.grade.aggregate.mockResolvedValue({ _avg: { value: 13.5 }, _count: { value: 4 } });
        prisma.grade.groupBy.mockResolvedValue([
            { courseId: 'c1', _count: { value: 4 }, _avg: { value: 13.5 } },
        ]);
        prisma.classSession.groupBy.mockResolvedValue([
            { courseId: 'c1', _count: { id: 5 } },
        ]);
        prisma.attendance.findMany.mockResolvedValue([]);
        prisma.enrollment.findMany.mockResolvedValue([
            { studentId: 's1', courseId: 'c1' },
            { studentId: 's2', courseId: 'c1' },
        ]);

        const result = await service.getSemesterStats('2026-S1');

        expect(result.totalCourses).toBe(1);
        expect(result.totalStudents).toBe(2);
        expect(result.averageGrade).toBe(13.5);
        expect(result.totalSessions).toBe(5);
        expect(result.atRiskStudents).toBe(0);
    });

    it('counts atRisk students when absence rate exceeds threshold', async () => {
        prisma.course.findMany.mockResolvedValue([
            { id: 'c1', code: 'MATH101', title: 'Math', teacher: { name: 'Alice' }, _count: { enrollments: 1 } },
        ]);
        prisma.enrollment.groupBy.mockResolvedValue([{ studentId: 's1' }]);
        prisma.grade.aggregate.mockResolvedValue({ _avg: { value: null }, _count: { value: 0 } });
        prisma.grade.groupBy.mockResolvedValue([]);
        prisma.classSession.groupBy.mockResolvedValue([{ courseId: 'c1', _count: { id: 10 } }]);
        prisma.attendance.findMany.mockResolvedValue([
            { studentId: 's1', session: { courseId: 'c1' } },
            { studentId: 's1', session: { courseId: 'c1' } },
            { studentId: 's1', session: { courseId: 'c1' } },
        ]);
        prisma.enrollment.findMany.mockResolvedValue([{ studentId: 's1', courseId: 'c1' }]);

        const result = await service.getSemesterStats('2026-S1');

        // 3 absences / 10 sessions = 0.30 > 0.20 → atRisk
        expect(result.atRiskStudents).toBe(1);
    });
});

// ---------- importEnrollmentsCsv ----------

describe('AdminService.importEnrollmentsCsv', () => {
    let service: AdminService;
    let prisma: ReturnType<typeof makePrisma>;

    const makeCsv = (body: string) => ({
        buffer: Buffer.from(`studentId,courseId\n${body}`),
    });

    beforeEach(() => {
        prisma = makePrisma();
        service = new AdminService(prisma as any);
    });

    it('throws BadRequestException when file is empty', async () => {
        await expect(
            service.importEnrollmentsCsv({ buffer: Buffer.from('') }),
        ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when required columns are missing', async () => {
        await expect(
            service.importEnrollmentsCsv({ buffer: Buffer.from('name,email\nBob,bob@test.com') }),
        ).rejects.toThrow(BadRequestException);
    });

    it('enrolls valid rows and returns summary', async () => {
        prisma.course.findMany.mockResolvedValue([
            { id: 'c1', code: 'MATH', capacity: 30, _count: { enrollments: 0 } },
        ]);
        prisma.user.findMany.mockResolvedValue([{ id: 's1' }]);
        prisma.enrollment.findMany.mockResolvedValue([]);
        prisma.enrollment.create.mockResolvedValue({});

        const result = await service.importEnrollmentsCsv(makeCsv('s1,c1')) as any;

        expect(result.enrolled).toBe(1);
        expect(result.skipped).toBe(0);
        expect(result.failed).toBe(0);
        expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('skips already-enrolled rows', async () => {
        prisma.course.findMany.mockResolvedValue([
            { id: 'c1', code: 'MATH', capacity: 30, _count: { enrollments: 1 } },
        ]);
        prisma.user.findMany.mockResolvedValue([{ id: 's1' }]);
        prisma.enrollment.findMany.mockResolvedValue([{ studentId: 's1', courseId: 'c1' }]);

        const result = await service.importEnrollmentsCsv(makeCsv('s1,c1')) as any;

        expect(result.skipped).toBe(1);
        expect(result.enrolled).toBe(0);
    });

    it('fails rows when course is at capacity', async () => {
        prisma.course.findMany.mockResolvedValue([
            { id: 'c1', code: 'MATH', capacity: 2, _count: { enrollments: 2 } },
        ]);
        prisma.user.findMany.mockResolvedValue([{ id: 's1' }]);
        prisma.enrollment.findMany.mockResolvedValue([]);

        const result = await service.importEnrollmentsCsv(makeCsv('s1,c1')) as any;

        expect(result.failed).toBe(1);
        expect(result.results[0].reason).toMatch(/full/);
    });

    it('fails rows when student not found', async () => {
        prisma.course.findMany.mockResolvedValue([
            { id: 'c1', code: 'MATH', capacity: 30, _count: { enrollments: 0 } },
        ]);
        prisma.user.findMany.mockResolvedValue([]); // no students found
        prisma.enrollment.findMany.mockResolvedValue([]);

        const result = await service.importEnrollmentsCsv(makeCsv('unknown-student,c1')) as any;

        expect(result.failed).toBe(1);
        expect(result.results[0].reason).toMatch(/student not found/);
    });

    it('fails rows when course not found', async () => {
        prisma.course.findMany.mockResolvedValue([]); // no courses found
        prisma.user.findMany.mockResolvedValue([{ id: 's1' }]);
        prisma.enrollment.findMany.mockResolvedValue([]);

        const result = await service.importEnrollmentsCsv(makeCsv('s1,unknown-course')) as any;

        expect(result.failed).toBe(1);
        expect(result.results[0].reason).toMatch(/course not found/);
    });

    it('prevents two rows from both claiming the last seat', async () => {
        prisma.course.findMany.mockResolvedValue([
            { id: 'c1', code: 'MATH', capacity: 1, _count: { enrollments: 0 } },
        ]);
        prisma.user.findMany.mockResolvedValue([{ id: 's1' }, { id: 's2' }]);
        prisma.enrollment.findMany.mockResolvedValue([]);
        prisma.enrollment.create.mockResolvedValue({});

        const result = await service.importEnrollmentsCsv({
            buffer: Buffer.from('studentId,courseId\ns1,c1\ns2,c1'),
        }) as any;

        expect(result.enrolled).toBe(1);
        expect(result.failed).toBe(1);
    });

    it('does not call $transaction when there is nothing to insert', async () => {
        prisma.course.findMany.mockResolvedValue([]);
        prisma.user.findMany.mockResolvedValue([]);
        prisma.enrollment.findMany.mockResolvedValue([]);

        await service.importEnrollmentsCsv(makeCsv('s1,c1'));

        expect(prisma.$transaction).not.toHaveBeenCalled();
    });
});
