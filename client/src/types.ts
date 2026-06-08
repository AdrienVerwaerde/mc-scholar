export type Role = 'STUDENT' | 'TEACHER' | 'ADMIN';
export type AttendanceStatus = 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: string;
}

export interface EvaluationWeight {
  type: string;
  weight: number;
}

export interface Course {
  id: string;
  code: string;
  title: string;
  semester: string;
  capacity: number;
  teacherId: string;
  teacher: { id: string; name: string; email: string };
  evaluationWeights: EvaluationWeight[];
  _count: { enrollments: number };
}

export interface Enrollment {
  id: string;
  studentId: string;
  courseId: string;
  enrolledAt: string;
  course?: Omit<Course, 'teacher' | 'evaluationWeights' | '_count'> & {
    teacher: { id: string; name: string };
  };
  student?: { id: string; name: string; email: string };
}

export interface Grade {
  id: string;
  studentId: string;
  courseId: string;
  type: string;
  value: number;
  comment?: string;
  createdAt: string;
  student: { id: string; name: string; email: string };
  course: { id: string; code: string; title: string };
}

export interface WeightedAverageResult {
  studentId: string;
  name?: string;
  email?: string;
  weightedAverage: number | null;
  isPartial: boolean;
  breakdown: { type: string; weight: number; gradeCount: number; average: number | null }[];
}

export interface ClassSession {
  id: string;
  courseId: string;
  date: string;
  topic?: string;
  _count: { attendances: number };
}

export interface AttendanceRate {
  studentId: string;
  name: string;
  email: string;
  totalSessions: number;
  attended: number;
  absences: number;
  excused: number;
  unrecorded: number;
  attendanceRate: number | null;
  absenceRate: number;
  atRisk: boolean;
}

export interface SemesterStats {
  semester: string;
  totalCourses: number;
  totalStudents: number;
  totalEnrollments: number;
  averageGrade: number | null;
  totalSessions: number;
  atRiskStudents: number;
  courses: {
    id: string;
    code: string;
    title: string;
    teacher: string;
    enrollments: number;
    grades: number;
    averageGrade: number | null;
    sessions: number;
    atRiskStudents: number;
  }[];
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PagedResponse<T> {
  items: T[];
  pagination: Pagination;
}
