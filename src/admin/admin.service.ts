import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
    constructor(private readonly prisma: PrismaService) { }

    /**
     * Builds a CSV with one row per enrollment for the given semester.
     * Columns: student info, course info, weighted average (normalised over graded types),
     * attendance rate, absence rate, and atRisk flag.
     * Returns an RFC 4180-compliant CSV string (CRLF line endings, quoted special chars).
     */
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

    /**
     * Returns aggregated statistics for a semester: total courses, unique students,
     * global grade average, session count, and atRisk student count.
     * Also includes per-course breakdown. Runs 5 Prisma queries in parallel to avoid N+1.
     */
    async getSemesterStats(semester: string) {
        if (!semester) throw new BadRequestException('semester query param is required');

        const threshold = parseFloat(process.env.AT_RISK_THRESHOLD ?? '0.20');

        // All courses for the semester
        const courses = await this.prisma.course.findMany({
            where: { semester },
            select: {
                id: true,
                code: true,
                title: true,
                teacher: { select: { name: true } },
                _count: { select: { enrollments: true } },
            },
        });

        if (!courses.length) {
            return {
                semester,
                totalCourses: 0,
                totalStudents: 0,
                totalEnrollments: 0,
                averageGrade: null,
                totalSessions: 0,
                atRiskStudents: 0,
                courses: [],
            };
        }

        const courseIds = courses.map((c) => c.id);

        // Run all aggregation queries in parallel
        const [
            uniqueStudents,
            gradeAgg,
            gradesByCourse,
            sessions,
            absenceRecords,
        ] = await Promise.all([
            // Unique enrolled students
            this.prisma.enrollment.groupBy({
                by: ['studentId'],
                where: { courseId: { in: courseIds } },
            }),
            // Global grade average
            this.prisma.grade.aggregate({
                where: { courseId: { in: courseIds } },
                _avg: { value: true },
                _count: { value: true },
            }),
            // Grade count + average per course
            this.prisma.grade.groupBy({
                by: ['courseId'],
                where: { courseId: { in: courseIds } },
                _count: { value: true },
                _avg: { value: true },
            }),
            // Sessions per course
            this.prisma.classSession.groupBy({
                by: ['courseId'],
                where: { courseId: { in: courseIds } },
                _count: { id: true },
            }),
            // ABSENT records: (studentId, courseId) via session join
            this.prisma.attendance.findMany({
                where: {
                    status: 'ABSENT',
                    session: { courseId: { in: courseIds } },
                },
                select: { studentId: true, session: { select: { courseId: true } } },
            }),
        ]);

        // Build lookup maps
        const gradeMap = new Map(gradesByCourse.map((g) => [g.courseId, g]));
        const sessionMap = new Map(sessions.map((s) => [s.courseId, s._count.id]));

        // Compute at-risk per (student, course)
        const absentCount = new Map<string, number>(); // key: `${studentId}:${courseId}`
        for (const a of absenceRecords) {
            const key = `${a.studentId}:${a.session.courseId}`;
            absentCount.set(key, (absentCount.get(key) ?? 0) + 1);
        }

        // Enrollments per course (for atRisk denominator)
        const enrollmentsByCourse = await this.prisma.enrollment.findMany({
            where: { courseId: { in: courseIds } },
            select: { studentId: true, courseId: true },
        });

        const atRiskPairs = new Set<string>(); // `${studentId}:${courseId}`
        const atRiskStudentIds = new Set<string>();

        for (const { studentId, courseId } of enrollmentsByCourse) {
            const totalSessions = sessionMap.get(courseId) ?? 0;
            if (totalSessions === 0) continue;
            const absences = absentCount.get(`${studentId}:${courseId}`) ?? 0;
            if (absences / totalSessions > threshold) {
                atRiskPairs.add(`${studentId}:${courseId}`);
                atRiskStudentIds.add(studentId);
            }
        }

        // Per-course atRisk count
        const atRiskByCourse = new Map<string, number>();
        for (const pair of atRiskPairs) {
            const courseId = pair.split(':')[1];
            atRiskByCourse.set(courseId, (atRiskByCourse.get(courseId) ?? 0) + 1);
        }

        const courseStats = courses.map((c) => {
            const g = gradeMap.get(c.id);
            const avgGrade = g?._avg.value != null ? Math.round(g._avg.value * 100) / 100 : null;
            return {
                id: c.id,
                code: c.code,
                title: c.title,
                teacher: c.teacher.name,
                enrollments: c._count.enrollments,
                grades: g?._count.value ?? 0,
                averageGrade: avgGrade,
                sessions: sessionMap.get(c.id) ?? 0,
                atRiskStudents: atRiskByCourse.get(c.id) ?? 0,
            };
        });

        const globalAvg = gradeAgg._avg.value;

        return {
            semester,
            totalCourses: courses.length,
            totalStudents: uniqueStudents.length,
            totalEnrollments: enrollmentsByCourse.length,
            averageGrade: globalAvg != null ? Math.round(globalAvg * 100) / 100 : null,
            totalSessions: sessions.reduce((s, r) => s + r._count.id, 0),
            atRiskStudents: atRiskStudentIds.size,
            courses: courseStats,
        };
    }

    /**
     * Bulk-imports enrollments from a CSV with `studentId` and `courseId` columns.
     * Per-row strategy: duplicates are skipped (not errors), capacity violations are
     * reported as failed rows, valid rows are inserted in a single transaction at the end.
     * Batch seat tracking prevents two rows from both claiming the last available seat.
     */
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
