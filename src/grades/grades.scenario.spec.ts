/**
 * Integration scenario: complete grading workflow
 *
 * Uses a stateful in-memory Prisma mock so no real database is needed.
 * Tests the full service chain: create grades → compute weighted average
 * → update a grade → re-check average → CSV import → verify all grades.
 */

import { Role } from '@prisma/client';
import { GradesService } from './grades.service';

// ---------- stateful in-memory store ----------

class InMemoryStore {
    grades: any[] = [];
    private nextId = 1;

    createGrade(data: any) {
        const g = { id: `grade-${this.nextId++}`, createdAt: new Date(), updatedAt: new Date(), ...data };
        this.grades.push(g);
        return g;
    }

    updateGrade(id: string, data: any) {
        const idx = this.grades.findIndex((g) => g.id === id);
        if (idx === -1) return null;
        this.grades[idx] = { ...this.grades[idx], ...data, updatedAt: new Date() };
        return this.grades[idx];
    }

    findGrades(where: { studentId?: string; courseId?: string }) {
        return this.grades.filter((g) => {
            if (where.studentId && g.studentId !== where.studentId) return false;
            if (where.courseId && g.courseId !== where.courseId) return false;
            return true;
        });
    }
}

// ---------- fixtures ----------

const COURSE_ID = 'course-1';
const STUDENT_ID = 'student-1';
const TEACHER = { id: 'teacher-1', role: Role.TEACHER };
const ADMIN = { id: 'admin-1', role: Role.ADMIN };

const COURSE = {
    id: COURSE_ID,
    teacherId: TEACHER.id,
    evaluationWeights: [
        { type: 'EXAM', weight: 0.6 },
        { type: 'MIDTERM', weight: 0.3 },
        { type: 'QUIZ', weight: 0.1 },
    ],
};

const ENROLLMENT = { studentId: STUDENT_ID, courseId: COURSE_ID };

// ---------- build a Prisma mock backed by the store ----------

function buildPrisma(store: InMemoryStore) {
    return {
        course: {
            findUnique: jest.fn().mockResolvedValue(COURSE),
        },
        enrollment: {
            findUnique: jest.fn().mockResolvedValue(ENROLLMENT),
            findMany: jest.fn().mockResolvedValue([ENROLLMENT]),
        },
        grade: {
            create: jest.fn().mockImplementation(({ data }) => Promise.resolve(store.createGrade(data))),
            findUnique: jest.fn().mockImplementation(({ where }) =>
                Promise.resolve(store.grades.find((g) => g.id === where.id) ?? null),
            ),
            findMany: jest.fn().mockImplementation(({ where }) =>
                Promise.resolve(store.findGrades(where ?? {})),
            ),
            update: jest.fn().mockImplementation(({ where, data }) =>
                Promise.resolve(store.updateGrade(where.id, data)),
            ),
        },
        $transaction: jest.fn().mockImplementation((ops: any[]) => Promise.all(ops)),
    };
}

// ---------- scenario ----------

describe('Grades — complete workflow scenario', () => {
    let service: GradesService;
    let store: InMemoryStore;
    let prisma: ReturnType<typeof buildPrisma>;

    let examGradeId: string;

    beforeAll(() => {
        store = new InMemoryStore();
        prisma = buildPrisma(store);
        service = new GradesService(prisma as any);
    });

    // ── Step 1: teacher records grades for all three configured types ──

    it('step 1a — teacher records EXAM grade (14)', async () => {
        const result = await service.create(
            { studentId: STUDENT_ID, courseId: COURSE_ID, type: 'EXAM' as any, value: 14 },
            TEACHER,
        );
        examGradeId = result.id;
        expect(result.value).toBe(14);
        expect(store.grades).toHaveLength(1);
    });

    it('step 1b — teacher records MIDTERM grade (12)', async () => {
        await service.create(
            { studentId: STUDENT_ID, courseId: COURSE_ID, type: 'MIDTERM' as any, value: 12 },
            TEACHER,
        );
        expect(store.grades).toHaveLength(2);
    });

    it('step 1c — teacher records QUIZ grade (18)', async () => {
        await service.create(
            { studentId: STUDENT_ID, courseId: COURSE_ID, type: 'QUIZ' as any, value: 18 },
            TEACHER,
        );
        expect(store.grades).toHaveLength(3);
    });

    // ── Step 2: student queries weighted average ──

    it('step 2 — weighted average is correct and isPartial=false', async () => {
        prisma.grade.findMany.mockImplementation(({ where }) =>
            Promise.resolve(store.findGrades(where ?? {})),
        );

        const STUDENT_CALLER = { id: STUDENT_ID, role: Role.STUDENT };
        const [result] = await service.getAverage(STUDENT_CALLER, { courseId: COURSE_ID });

        // EXAM 14 × 0.6 + MIDTERM 12 × 0.3 + QUIZ 18 × 0.1 = 8.4 + 3.6 + 1.8 = 13.8
        expect(result.weightedAverage).toBe(13.8);
        expect(result.isPartial).toBe(false);
        expect(result.breakdown).toHaveLength(3);
    });

    // ── Step 3: teacher corrects the EXAM grade ──

    it('step 3 — teacher updates EXAM to 16, average rises', async () => {
        await service.update(examGradeId, { value: 16 }, TEACHER);

        const STUDENT_CALLER = { id: STUDENT_ID, role: Role.STUDENT };
        const [result] = await service.getAverage(STUDENT_CALLER, { courseId: COURSE_ID });

        // EXAM 16 × 0.6 + MIDTERM 12 × 0.3 + QUIZ 18 × 0.1 = 9.6 + 3.6 + 1.8 = 15
        expect(result.weightedAverage).toBe(15);
    });

    // ── Step 4: admin bulk-imports a second QUIZ grade via CSV ──

    it('step 4 — admin imports a second QUIZ grade (20) via CSV', async () => {
        const csv = {
            buffer: Buffer.from(`studentId,type,value\n${STUDENT_ID},QUIZ,20`),
            originalname: 'import.csv',
        };

        const result = await service.importCsv(COURSE_ID, csv, ADMIN);

        expect(result).toEqual({ success: true, imported: 1, errors: [] });
        expect(store.grades).toHaveLength(4);
    });

    // ── Step 5: average reflects the two QUIZ grades (avg 19) ──

    it('step 5 — average uses mean of two QUIZ grades', async () => {
        const STUDENT_CALLER = { id: STUDENT_ID, role: Role.STUDENT };
        const [result] = await service.getAverage(STUDENT_CALLER, { courseId: COURSE_ID });

        // EXAM 16 × 0.6 + MIDTERM 12 × 0.3 + QUIZ avg(18,20)=19 × 0.1
        // = 9.6 + 3.6 + 1.9 = 15.1
        expect(result.weightedAverage).toBe(15.1);
        expect(result.breakdown.find((b: any) => b.type === 'QUIZ')?.gradeCount).toBe(2);
    });

    // ── Step 6: admin sees all 4 grades ──

    it('step 6 — admin lists all grades for the course', async () => {
        const grades = await service.listForCaller(ADMIN, { courseId: COURSE_ID });
        expect(grades).toHaveLength(4);
    });
});
