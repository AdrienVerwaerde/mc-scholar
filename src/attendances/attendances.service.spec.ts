import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AttendancesService } from './attendances.service';

const TEACHER = { id: 'teacher-1', role: Role.TEACHER };
const ADMIN = { id: 'admin-1', role: Role.ADMIN };
const STUDENT = { id: 'student-1', role: Role.STUDENT };

const makePrisma = () => ({
    course: { findUnique: jest.fn() },
    classSession: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
    },
    enrollment: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
    },
    attendance: {
        findMany: jest.fn(),
        upsert: jest.fn(),
    },
    $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
});

// ---------- createSession ----------

describe('AttendancesService.createSession', () => {
    let service: AttendancesService;
    let prisma: ReturnType<typeof makePrisma>;

    beforeEach(() => {
        prisma = makePrisma();
        service = new AttendancesService(prisma as any);
    });

    const dto = { date: new Date('2026-01-15'), topic: 'Intro' };

    it('creates session for the course owner', async () => {
        prisma.course.findUnique.mockResolvedValue({ teacherId: 'teacher-1' });
        prisma.classSession.create.mockResolvedValue({ id: 'sess-1', courseId: 'c1', ...dto });

        const result = await service.createSession('c1', dto, TEACHER);

        expect(prisma.classSession.create).toHaveBeenCalled();
        expect(result).toMatchObject({ id: 'sess-1' });
    });

    it('allows ADMIN to create session on any course', async () => {
        prisma.course.findUnique.mockResolvedValue({ teacherId: 'someone-else' });
        prisma.classSession.create.mockResolvedValue({ id: 'sess-1' });

        await expect(service.createSession('c1', dto, ADMIN)).resolves.toBeDefined();
    });

    it('throws NotFoundException when course does not exist', async () => {
        prisma.course.findUnique.mockResolvedValue(null);

        await expect(service.createSession('c1', dto, TEACHER)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when TEACHER does not own the course', async () => {
        prisma.course.findUnique.mockResolvedValue({ teacherId: 'other-teacher' });

        await expect(service.createSession('c1', dto, TEACHER)).rejects.toThrow(ForbiddenException);
    });
});

// ---------- listSessions ----------

describe('AttendancesService.listSessions', () => {
    let service: AttendancesService;
    let prisma: ReturnType<typeof makePrisma>;

    beforeEach(() => {
        prisma = makePrisma();
        service = new AttendancesService(prisma as any);
    });

    it('returns sessions for course owner (TEACHER)', async () => {
        prisma.course.findUnique.mockResolvedValue({ teacherId: 'teacher-1' });
        prisma.classSession.findMany.mockResolvedValue([{ id: 'sess-1' }]);

        const result = await service.listSessions('c1', TEACHER);
        expect(result).toHaveLength(1);
    });

    it('returns sessions for enrolled STUDENT', async () => {
        prisma.course.findUnique.mockResolvedValue({ teacherId: 'someone' });
        prisma.enrollment.findUnique.mockResolvedValue({ id: 'enroll-1' });
        prisma.classSession.findMany.mockResolvedValue([]);

        await expect(service.listSessions('c1', STUDENT)).resolves.toBeDefined();
    });

    it('throws ForbiddenException when STUDENT is not enrolled', async () => {
        prisma.course.findUnique.mockResolvedValue({ teacherId: 'someone' });
        prisma.enrollment.findUnique.mockResolvedValue(null);

        await expect(service.listSessions('c1', STUDENT)).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when TEACHER does not own the course', async () => {
        prisma.course.findUnique.mockResolvedValue({ teacherId: 'other' });

        await expect(service.listSessions('c1', TEACHER)).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when course does not exist', async () => {
        prisma.course.findUnique.mockResolvedValue(null);

        await expect(service.listSessions('c1', ADMIN)).rejects.toThrow(NotFoundException);
    });
});

// ---------- bulkRecord ----------

describe('AttendancesService.bulkRecord', () => {
    let service: AttendancesService;
    let prisma: ReturnType<typeof makePrisma>;

    beforeEach(() => {
        prisma = makePrisma();
        service = new AttendancesService(prisma as any);
        prisma.classSession.findUnique.mockResolvedValue({
            courseId: 'c1',
            course: { teacherId: 'teacher-1' },
        });
        prisma.enrollment.findMany.mockResolvedValue([{ studentId: 'student-1' }]);
        prisma.attendance.upsert.mockResolvedValue({});
    });

    const dto = { attendances: [{ studentId: 'student-1', status: 'PRESENT' as any }] };

    it('upserts all attendance entries and returns count', async () => {
        const result = await service.bulkRecord('sess-1', dto, TEACHER);

        expect(prisma.$transaction).toHaveBeenCalled();
        expect(result).toEqual({ sessionId: 'sess-1', recorded: 1 });
    });

    it('allows ADMIN to record attendance on any course', async () => {
        prisma.classSession.findUnique.mockResolvedValue({
            courseId: 'c1',
            course: { teacherId: 'someone-else' },
        });

        await expect(service.bulkRecord('sess-1', dto, ADMIN)).resolves.toBeDefined();
    });

    it('throws NotFoundException when session does not exist', async () => {
        prisma.classSession.findUnique.mockResolvedValue(null);

        await expect(service.bulkRecord('sess-1', dto, TEACHER)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when TEACHER does not own the course', async () => {
        prisma.classSession.findUnique.mockResolvedValue({
            courseId: 'c1',
            course: { teacherId: 'other-teacher' },
        });

        await expect(service.bulkRecord('sess-1', dto, TEACHER)).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when attendances array is empty', async () => {
        await expect(
            service.bulkRecord('sess-1', { attendances: [] }, TEACHER),
        ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when a student is not enrolled', async () => {
        const dtoWithUnknown = { attendances: [{ studentId: 'unknown', status: 'PRESENT' as any }] };

        await expect(service.bulkRecord('sess-1', dtoWithUnknown, TEACHER)).rejects.toThrow(
            /not enrolled/,
        );
    });
});

// ---------- getAttendanceRate ----------

describe('AttendancesService.getAttendanceRate', () => {
    let service: AttendancesService;
    let prisma: ReturnType<typeof makePrisma>;

    beforeEach(() => {
        prisma = makePrisma();
        service = new AttendancesService(prisma as any);
    });

    it('returns attendance stats for all students (TEACHER view)', async () => {
        prisma.course.findUnique.mockResolvedValue({ teacherId: 'teacher-1' });
        prisma.classSession.count.mockResolvedValue(10);
        prisma.enrollment.findMany.mockResolvedValue([
            { studentId: 'student-1', student: { name: 'Alice', email: 'alice@test.com' } },
        ]);
        prisma.attendance.findMany.mockResolvedValue([
            { studentId: 'student-1', status: 'PRESENT' },
            { studentId: 'student-1', status: 'PRESENT' },
            { studentId: 'student-1', status: 'ABSENT' },
        ]);

        const result = await service.getAttendanceRate('c1', TEACHER);

        expect(result).toHaveLength(1);
        expect(result[0].attended).toBe(2);
        expect(result[0].absences).toBe(1);
        expect(result[0].atRisk).toBe(false); // 1/10 = 0.1 < 0.20
    });

    it('flags atRisk when absence rate exceeds threshold', async () => {
        prisma.course.findUnique.mockResolvedValue({ teacherId: 'teacher-1' });
        prisma.classSession.count.mockResolvedValue(10);
        prisma.enrollment.findMany.mockResolvedValue([
            { studentId: 'student-1', student: { name: 'Alice', email: 'alice@test.com' } },
        ]);
        prisma.attendance.findMany.mockResolvedValue([
            { studentId: 'student-1', status: 'ABSENT' },
            { studentId: 'student-1', status: 'ABSENT' },
            { studentId: 'student-1', status: 'ABSENT' },
        ]);

        const [result] = await service.getAttendanceRate('c1', TEACHER);

        expect(result.atRisk).toBe(true); // 3/10 = 0.3 > 0.20
        expect(result.absenceRate).toBe(0.3);
    });

    it('returns only own stats for STUDENT', async () => {
        prisma.course.findUnique.mockResolvedValue({ teacherId: 'teacher-1' });
        prisma.classSession.count.mockResolvedValue(5);
        prisma.enrollment.findMany.mockResolvedValue([
            { studentId: 'student-1', student: { name: 'Alice', email: 'alice@test.com' } },
            { studentId: 'student-2', student: { name: 'Bob', email: 'bob@test.com' } },
        ]);
        prisma.enrollment.findUnique.mockResolvedValue({ id: 'enroll-1' });
        prisma.attendance.findMany.mockResolvedValue([]);

        const result = await service.getAttendanceRate('c1', STUDENT);

        expect(result).toHaveLength(1);
        expect(result[0].studentId).toBe('student-1');
    });

    it('throws NotFoundException when course does not exist', async () => {
        prisma.course.findUnique.mockResolvedValue(null);

        await expect(service.getAttendanceRate('c1', TEACHER)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when TEACHER does not own the course', async () => {
        prisma.course.findUnique.mockResolvedValue({ teacherId: 'other' });

        await expect(service.getAttendanceRate('c1', TEACHER)).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when STUDENT is not enrolled', async () => {
        prisma.course.findUnique.mockResolvedValue({ teacherId: 'teacher-1' });
        prisma.enrollment.findUnique.mockResolvedValue(null);

        await expect(service.getAttendanceRate('c1', STUDENT)).rejects.toThrow(ForbiddenException);
    });

    it('returns null attendanceRate when there are no sessions', async () => {
        prisma.course.findUnique.mockResolvedValue({ teacherId: 'teacher-1' });
        prisma.classSession.count.mockResolvedValue(0);
        prisma.enrollment.findMany.mockResolvedValue([
            { studentId: 'student-1', student: { name: 'Alice', email: 'alice@test.com' } },
        ]);
        prisma.attendance.findMany.mockResolvedValue([]);

        const [result] = await service.getAttendanceRate('c1', TEACHER);

        expect(result.attendanceRate).toBeNull();
        expect(result.atRisk).toBe(false);
    });
});
