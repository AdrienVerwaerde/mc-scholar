import type {
  User, Course, Grade, Enrollment, ClassSession,
  AttendanceRate, SemesterStats, PagedResponse, WeightedAverageResult,
} from './types';

const BASE = '';

async function req<T>(method: string, url: string, body?: unknown, isForm = false): Promise<T> {
  const opts: RequestInit = {
    method,
    credentials: 'include',
    headers: isForm ? {} : { 'Content-Type': 'application/json' },
    body: isForm ? (body as FormData) : body !== undefined ? JSON.stringify(body) : undefined,
  };
  const res = await fetch(`${BASE}${url}`, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

const get = <T>(url: string) => req<T>('GET', url);
const post = <T>(url: string, body?: unknown) => req<T>('POST', url, body);
const patch = <T>(url: string, body: unknown) => req<T>('PATCH', url, body);
const del = <T>(url: string) => req<T>('DELETE', url);
const postForm = <T>(url: string, form: FormData) => req<T>('POST', url, form, true);

// ── Auth ──────────────────────────────────────────────────────────────────

export const authApi = {
  signIn: (email: string, password: string) =>
    post<{ user: User }>('/api/auth/sign-in/email', { email, password }),
  signOut: () => post<void>('/api/auth/sign-out'),
  getSession: () => get<{ user: User } | null>('/api/auth/get-session'),
};

// ── Users (ADMIN) ─────────────────────────────────────────────────────────

export const usersApi = {
  list: (params?: { page?: number; limit?: number; role?: string; search?: string }) => {
    const q = new URLSearchParams(params as Record<string, string>).toString();
    return get<PagedResponse<User>>(`/admin/users${q ? `?${q}` : ''}`);
  },
  create: (data: { name: string; email: string; password: string; role: string }) =>
    post<User>('/admin/users', data),
  findById: (id: string) => get<User>(`/admin/users/${id}`),
  update: (id: string, data: { name?: string; email?: string; role?: string }) =>
    patch<User>(`/admin/users/${id}`, data),
  remove: (id: string) => del<{ deleted: boolean }>(`/admin/users/${id}`),
};

// ── Courses ───────────────────────────────────────────────────────────────

export const coursesApi = {
  list: (params?: { page?: number; limit?: number; semester?: string; search?: string }) => {
    const q = new URLSearchParams(params as Record<string, string>).toString();
    return get<PagedResponse<Course>>(`/courses${q ? `?${q}` : ''}`);
  },
  findById: (id: string) => get<Course>(`/courses/${id}`),
  create: (data: { code: string; title: string; semester: string; capacity: number }) =>
    post<Course>('/courses', data),
  update: (id: string, data: Partial<{ title: string; capacity: number }>) =>
    patch<Course>(`/courses/${id}`, data),
  remove: (id: string) => del<{ deleted: boolean }>(`/courses/${id}`),
  setWeights: (id: string, weights: { type: string; weight: number }[]) =>
    req<Course>('PUT', `/courses/${id}/weights`, { weights }),
};

// ── Enrollments ───────────────────────────────────────────────────────────

export const enrollmentsApi = {
  enroll: (courseId: string) => post<Enrollment>(`/courses/${courseId}/enroll`),
  unenroll: (courseId: string) => del<{ deleted: boolean }>(`/courses/${courseId}/enroll`),
  listMine: () => get<Enrollment[]>('/me/enrollments'),
  listByCourse: (courseId: string) => get<Enrollment[]>(`/courses/${courseId}/enrollments`),
};

// ── Grades ────────────────────────────────────────────────────────────────

export const gradesApi = {
  list: (params?: { courseId?: string; type?: string }) => {
    const q = new URLSearchParams(params as Record<string, string>).toString();
    return get<Grade[]>(`/grades${q ? `?${q}` : ''}`);
  },
  create: (data: { studentId: string; courseId: string; type: string; value: number; comment?: string }) =>
    post<Grade>('/grades', data),
  update: (id: string, data: { value?: number; comment?: string }) =>
    patch<Grade>(`/grades/${id}`, data),
  remove: (id: string) => del<{ deleted: boolean }>(`/grades/${id}`),
  getAverage: (params: { courseId: string; studentId?: string }) => {
    const q = new URLSearchParams(params as Record<string, string>).toString();
    return get<WeightedAverageResult[]>(`/grades/average?${q}`);
  },
  importCsv: (courseId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return postForm<{ success: boolean; imported: number; errors: unknown[] }>(
      `/grades/import?courseId=${courseId}`,
      form,
    );
  },
};

// ── Attendances ───────────────────────────────────────────────────────────

export const attendancesApi = {
  createSession: (courseId: string, data: { date: string; topic?: string }) =>
    post<ClassSession>(`/courses/${courseId}/sessions`, data),
  listSessions: (courseId: string) =>
    get<ClassSession[]>(`/courses/${courseId}/sessions`),
  bulkRecord: (sessionId: string, attendances: { studentId: string; status: string }[]) =>
    post<{ sessionId: string; recorded: number }>(`/sessions/${sessionId}/attendances`, { attendances }),
  getAttendanceRate: (courseId: string) =>
    get<AttendanceRate[]>(`/courses/${courseId}/attendance-rate`),
};

// ── Admin ─────────────────────────────────────────────────────────────────

export const adminApi = {
  getStats: (semester: string) =>
    get<SemesterStats>(`/admin/stats?semester=${encodeURIComponent(semester)}`),
  exportCsv: (semester: string) =>
    fetch(`/admin/export?semester=${encodeURIComponent(semester)}`, { credentials: 'include' }),
  importEnrollments: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return postForm<{ enrolled: number; skipped: number; failed: number; results: unknown[] }>(
      '/admin/import/enrollments',
      form,
    );
  },
};
