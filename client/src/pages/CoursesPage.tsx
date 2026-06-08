import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { coursesApi, enrollmentsApi } from '../api';
import { useAuth } from '../context/AuthContext';
import type { Course, Enrollment } from '../types';
import {
  Button, Input, Modal, PageHeader, Alert, Spinner, Table, Td,
} from '../components/ui';

export function CoursesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [courses, setCourses] = useState<Course[]>([]);
  const [myEnrollments, setMyEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [semester, setSemester] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [form, setForm] = useState({ code: '', title: '', semester: '', capacity: 30 });

  const isTeacherOrAdmin = user?.role === 'TEACHER' || user?.role === 'ADMIN';
  const isStudent = user?.role === 'STUDENT';

  async function load() {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (semester) params.semester = semester;
      const data = await coursesApi.list(params);
      setCourses(data.items);
      if (isStudent) {
        const enrs = await enrollmentsApi.listMine();
        setMyEnrollments(enrs);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load courses');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [search, semester]);

  function isEnrolled(courseId: string) {
    return myEnrollments.some(e => e.courseId === courseId);
  }

  async function handleEnroll(courseId: string) {
    try {
      await enrollmentsApi.enroll(courseId);
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Enrollment failed');
    }
  }

  async function handleUnenroll(courseId: string) {
    try {
      await enrollmentsApi.unenroll(courseId);
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unenrollment failed');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this course?')) return;
    try {
      await coursesApi.remove(id);
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError('');
    try {
      await coursesApi.create({ ...form, capacity: Number(form.capacity) });
      setShowCreate(false);
      setForm({ code: '', title: '', semester: '', capacity: 30 });
      load();
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="p-6">
      <PageHeader
        title="Courses"
        subtitle="Browse and manage courses"
        action={
          isTeacherOrAdmin ? (
            <Button onClick={() => setShowCreate(true)}>+ New Course</Button>
          ) : undefined
        }
      />

      {error && <div className="mb-4"><Alert type="error">{error}</Alert></div>}

      <div className="flex gap-3 mb-5">
        <Input
          placeholder="Search…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-52"
        />
        <Input
          placeholder="Semester (e.g. S1-2024)"
          value={semester}
          onChange={e => setSemester(e.target.value)}
          className="w-48"
        />
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <Table headers={['Code', 'Title', 'Semester', 'Capacity', 'Actions']}>
          {courses.map(course => (
            <tr key={course.id} className="hover:bg-gray-50">
              <Td className="font-mono font-medium">{course.code}</Td>
              <Td>
                <button
                  className="cursor-pointer text-indigo-600 hover:underline text-left"
                  onClick={() => navigate(`/courses/${course.id}`)}
                >
                  {course.title}
                </button>
              </Td>
              <Td>{course.semester}</Td>
              <Td>{course.capacity}</Td>
              <Td>
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" variant="ghost" onClick={() => navigate(`/courses/${course.id}`)}>
                    View
                  </Button>
                  {isStudent && (
                    isEnrolled(course.id) ? (
                      <Button size="sm" variant="secondary" onClick={() => handleUnenroll(course.id)}>
                        Unenroll
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => handleEnroll(course.id)}>
                        Enroll
                      </Button>
                    )
                  )}
                  {isTeacherOrAdmin && (
                    <Button size="sm" variant="danger" onClick={() => handleDelete(course.id)}>
                      Delete
                    </Button>
                  )}
                </div>
              </Td>
            </tr>
          ))}
        </Table>
      )}

      {showCreate && (
        <Modal
          title="New Course"
          onClose={() => setShowCreate(false)}
          footer={
            <>
              <Button variant="secondary" className="cursor-pointer" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button className="cursor-pointer" onClick={handleCreate} disabled={creating} form="create-form" type="submit">
                {creating ? 'Creating…' : 'Create'}
              </Button>
            </>
          }
        >
          {createError && <Alert type="error">{createError}</Alert>}
          <form id="create-form" onSubmit={handleCreate} className="space-y-3">
            <Input label="Code" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} required />
            <Input label="Title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
            <Input label="Semester" value={form.semester} onChange={e => setForm(f => ({ ...f, semester: e.target.value }))} placeholder="e.g. S1-2024" required />
            <Input label="Capacity" type="number" value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: Number(e.target.value) }))} min={1} required />
          </form>
        </Modal>
      )}
    </div>
  );
}
