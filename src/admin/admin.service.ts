import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
    constructor(private readonly prisma: PrismaService) { }

    async exportSemesterCsv(semester: string): Promise<string> {
        if (!semester) throw new BadRequestException('semester query param is required');

        // 1. Courses for the semester with weights and teacher
        const courses = await this.prisma.course.findMany({
            where: { semester },
            select: {
                id: true,
                code: true,
                title: true,
                semester: true,
                teacher: { select: { name: true } },
                evaluationWeights: { select: { type: true, weight: true } },
            },
        });

        if (!courses.length) return this.buildCsv([]);

        const courseIds = courses.map((c) => c.id);

        // 2. All enrollments for those courses with student info
        const enrollments = await this.prisma.enrollment.findMany({
            where: { courseId: { in: courseIds } },
            select: {
                studentId: true,
                courseId: true,
                student: { select: { name: true, email: true } },
            },
        });

        // 3. All grades for those courses
        const grades = await this.prisma.grade.findMany({
            where: { courseId: { in: courseIds } },
            select: { studentId: true, courseId: true, type: true, value: true },
        });

        // 4. Session counts per course + all attendance records
        const sessions = await this.prisma.classSession.findMany({
            where: { courseId: { in: courseIds } },
            select: { id: true, courseId: true },
        });

        const sessionIds = sessions.map((s) => s.id);
        const attendances = sessionIds.length
            ? await this.prisma.attendance.findMany({
                  where: { sessionId: { in: sessionIds } },
                  select: { studentId: true, sessionId: true, status: true },
              })
            : [];

        // Build lookup maps
        const courseMap = new Map(courses.map((c) => [c.id, c]));

        // sessionCount per courseId
        const sessionCountByCourse = new Map<string, number>();
        for (const s of sessions) {
            sessionCountByCourse.set(s.courseId, (sessionCountByCourse.get(s.courseId) ?? 0) + 1);
        }

        // sessionId → courseId
        const sessionToCourse = new Map(sessions.map((s) => [s.id, s.courseId]));

        // grades: key = `${studentId}:${courseId}:${type}` → values[]
        const gradeMap = new Map<string, number[]>();
        for (const g of grades) {
            const key = `${g.studentId}:${g.courseId}:${g.type}`;
            const list = gradeMap.get(key) ?? [];
            list.push(g.value);
            gradeMap.set(key, list);
        }

        // attendances: key = `${studentId}:${courseId}` → counts
        type StatusCounts = { PRESENT: number; LATE: number; ABSENT: number; EXCUSED: number };
        const attendanceMap = new Map<string, StatusCounts>();
        for (const a of attendances) {
            const courseId = sessionToCourse.get(a.sessionId)!;
            const key = `${a.studentId}:${courseId}`;
            if (!attendanceMap.has(key)) {
                attendanceMap.set(key, { PRESENT: 0, LATE: 0, ABSENT: 0, EXCUSED: 0 });
            }
            attendanceMap.get(key)![a.status as keyof StatusCounts]++;
        }

        const threshold = parseFloat(process.env.AT_RISK_THRESHOLD ?? '0.20');

        const rows = enrollments.map(({ studentId, courseId, student }) => {
            const course = courseMap.get(courseId)!;

            // Weighted average
            const weights = course.evaluationWeights;
            const weightMap = new Map(weights.map((w) => [w.type, w.weight]));
            const gradedTypes = weights
                .map((w) => {
                    const vals = gradeMap.get(`${studentId}:${courseId}:${w.type}`) ?? [];
                    const avg = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
                    return { type: w.type, weight: w.weight, avg };
                })
                .filter((t) => t.avg !== null);

            const totalWeight = gradedTypes.reduce((s, t) => s + (weightMap.get(t.type) ?? 0), 0);
            const weightedAverage =
                totalWeight > 0
                    ? Math.round(
                          (gradedTypes.reduce((s, t) => s + t.avg! * (weightMap.get(t.type) ?? 0), 0) /
                              totalWeight) *
                              100,
                      ) / 100
                    : null;

            // Attendance
            const totalSessions = sessionCountByCourse.get(courseId) ?? 0;
            const att = attendanceMap.get(`${studentId}:${courseId}`) ?? { PRESENT: 0, LATE: 0, ABSENT: 0, EXCUSED: 0 };
            const attended = att.PRESENT + att.LATE;
            const absent = att.ABSENT;
            const attendanceRate = totalSessions > 0 ? Math.round((attended / totalSessions) * 1000) / 1000 : null;
            const absenceRate = totalSessions > 0 ? Math.round((absent / totalSessions) * 1000) / 1000 : 0;
            const atRisk = totalSessions > 0 && absent / totalSessions > threshold;

            return {
                studentName: student.name,
                studentEmail: student.email,
                courseCode: course.code,
                courseTitle: course.title,
                teacherName: course.teacher.name,
                semester: course.semester,
                weightedAverage: weightedAverage ?? '',
                attendanceRate: attendanceRate ?? '',
                absenceRate,
                atRisk,
            };
        });

        return this.buildCsv(rows);
    }

    async importEnrollmentsCsv(file: { buffer: Buffer }): Promise<object> {
        const lines = file.buffer
            .toString('utf8')
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n')
            .split('\n')
            .filter((l) => l.trim());

        if (!lines.length) throw new BadRequestException('CSV file is empty');

        const headers = lines[0].split(',').map((h) => h.trim());
        if (!headers.includes('studentId') || !headers.includes('courseId')) {
            throw new BadRequestException('CSV must have studentId and courseId columns');
        }

        const siIdx = headers.indexOf('studentId');
        const ciIdx = headers.indexOf('courseId');

        const rows = lines.slice(1).map((line, i) => {
            const cols = line.split(',').map((c) => c.trim());
            return { row: i + 2, studentId: cols[siIdx] ?? '', courseId: cols[ciIdx] ?? '' };
        });

        // Collect unique IDs to bulk-load from DB
        const courseIds = [...new Set(rows.map((r) => r.courseId).filter(Boolean))];
        const studentIds = [...new Set(rows.map((r) => r.studentId).filter(Boolean))];

        const [courses, students, existingEnrollments] = await Promise.all([
            this.prisma.course.findMany({
                where: { id: { in: courseIds } },
                select: { id: true, code: true, capacity: true, _count: { select: { enrollments: true } } },
            }),
            this.prisma.user.findMany({
                where: { id: { in: studentIds }, role: 'STUDENT' },
                select: { id: true },
            }),
            this.prisma.enrollment.findMany({
                where: {
                    studentId: { in: studentIds },
                    courseId: { in: courseIds },
                },
                select: { studentId: true, courseId: true },
            }),
        ]);

        const courseMap = new Map(courses.map((c) => [c.id, c]));
        const studentSet = new Set(students.map((s) => s.id));
        const enrolledSet = new Set(existingEnrollments.map((e) => `${e.studentId}:${e.courseId}`));

        // Track seats already claimed within this batch
        const batchEnrollCount = new Map<string, number>();

        type RowResult = { row: number; studentId: string; courseId: string; status: 'enrolled' | 'skipped' | 'failed'; reason?: string };
        const results: RowResult[] = [];
        const toInsert: { studentId: string; courseId: string }[] = [];

        for (const { row, studentId, courseId } of rows) {
            if (!studentId || !courseId) {
                results.push({ row, studentId, courseId, status: 'failed', reason: 'missing studentId or courseId' });
                continue;
            }
            if (!studentSet.has(studentId)) {
                results.push({ row, studentId, courseId, status: 'failed', reason: 'student not found' });
                continue;
            }
            const course = courseMap.get(courseId);
            if (!course) {
                results.push({ row, studentId, courseId, status: 'failed', reason: 'course not found' });
                continue;
            }
            if (enrolledSet.has(`${studentId}:${courseId}`)) {
                results.push({ row, studentId, courseId, status: 'skipped', reason: 'already enrolled' });
                continue;
            }
            const batchExtra = batchEnrollCount.get(courseId) ?? 0;
            if (course._count.enrollments + batchExtra >= course.capacity) {
                results.push({ row, studentId, courseId, status: 'failed', reason: `Course ${course.code} is full (${course.capacity}/${course.capacity})` });
                continue;
            }

            batchEnrollCount.set(courseId, batchExtra + 1);
            enrolledSet.add(`${studentId}:${courseId}`); // prevent duplicate within batch
            toInsert.push({ studentId, courseId });
            results.push({ row, studentId, courseId, status: 'enrolled' });
        }

        if (toInsert.length) {
            await this.prisma.$transaction(
                toInsert.map((d) => this.prisma.enrollment.create({ data: d })),
            );
        }

        return {
            enrolled: results.filter((r) => r.status === 'enrolled').length,
            skipped: results.filter((r) => r.status === 'skipped').length,
            failed: results.filter((r) => r.status === 'failed').length,
            results,
        };
    }

    private buildCsv(rows: Record<string, unknown>[]): string {
        const headers = [
            'studentName',
            'studentEmail',
            'courseCode',
            'courseTitle',
            'teacherName',
            'semester',
            'weightedAverage',
            'attendanceRate',
            'absenceRate',
            'atRisk',
        ];

        const escape = (v: unknown) => {
            const s = String(v ?? '');
            return s.includes(',') || s.includes('"') || s.includes('\n')
                ? `"${s.replace(/"/g, '""')}"`
                : s;
        };

        const lines = [
            headers.join(','),
            ...rows.map((r) => headers.map((h) => escape(r[h])).join(',')),
        ];

        return lines.join('\r\n');
    }
}
