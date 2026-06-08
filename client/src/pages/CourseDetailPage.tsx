import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { coursesApi, gradesApi, attendancesApi, enrollmentsApi } from '../api';
import { useAuth } from '../context/AuthContext';
import type { Course, Grade, ClassSession, AttendanceRate, Enrollment, EvaluationWeight } from '../types';
import {
  Button, Input, Select, Modal, PageHeader, Alert, Spinner, Table, Td, Badge,
} from '../components/ui';

type Tab = 'overview' | 'grades' | 'sessions' | 'attendance';

export function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('overview');
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const isTeacherOrAdmin = user?.role === 'TEACHER' || user?.role === 'ADMIN';
  const isStudent = user?.role === 'STUDENT';

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    coursesApi.findById(id)
      .then(setCourse)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    ...(isTeacherOrAdmin ? [{ key: 'grades' as Tab, label: 'Grades' }] : []),
    ...(isStudent ? [{ key: 'grades' as Tab, label: 'My Grades' }] : []),
    ...(isTeacherOrAdmin ? [{ key: 'sessions' as Tab, label: 'Sessions' }] : []),
    ...(isTeacherOrAdmin ? [{ key: 'attendance' as Tab, label: 'Attendance' }] : []),
  ];

  if (loading) return <div className="p-6"><Spinner /></div>;
  if (error) return <div className="p-6"><Alert type="error">{error}</Alert></div>;
  if (!course) return null;

  return (
    <div className="p-6">
      <PageHeader
        title={course.title}
        subtitle={`${course.code} · ${course.semester}`}
      />

      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`cursor-pointer px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              tab === t.key
                ? 'border-b-2 border-indigo-600 text-indigo-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab course={course} isTeacherOrAdmin={isTeacherOrAdmin} onUpdate={setCourse} />}
      {tab === 'grades' && <GradesTab courseId={id!} isTeacherOrAdmin={isTeacherOrAdmin} weights={course.evaluationWeights ?? []} />}
      {tab === 'sessions' && <SessionsTab courseId={id!} />}
      {tab === 'attendance' && <AttendanceTab courseId={id!} />}
    </div>
  );
}

// ── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ course, isTeacherOrAdmin, onUpdate }: {
  course: Course;
  isTeacherOrAdmin: boolean;
  onUpdate: (c: Course) => void;
}) {
  const [weights, setWeights] = useState<EvaluationWeight[]>(course.evaluationWeights ?? []);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [editTitle, setEditTitle] = useState(course.title);
  const [editCapacity, setEditCapacity] = useState(course.capacity);
  const [savingMeta, setSavingMeta] = useState(false);

  async function saveWeights() {
    setSaving(true);
    setMsg('');
    try {
      const updated = await coursesApi.setWeights(course.id, weights);
      onUpdate(updated);
      setMsg('Weights saved.');
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  }

  async function saveMeta(e: React.FormEvent) {
    e.preventDefault();
    setSavingMeta(true);
    try {
      const updated = await coursesApi.update(course.id, { title: editTitle, capacity: editCapacity });
      onUpdate(updated);
      setMsg('Course updated.');
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSavingMeta(false);
    }
  }

  function addWeight() {
    setWeights(w => [...w, { type: '', weight: 0 }]);
  }

  function removeWeight(i: number) {
    setWeights(w => w.filter((_, idx: number) => idx !== i));
  }

  return (
    <div className="space-y-8 max-w-xl">
      {msg && <Alert type="success">{msg}</Alert>}

      {isTeacherOrAdmin && (
        <section>
          <h2 className="font-semibold text-gray-900 mb-3">Course Details</h2>
          <form onSubmit={saveMeta} className="space-y-3">
            <Input label="Title" value={editTitle} onChange={e => setEditTitle(e.target.value)} required />
            <Input label="Capacity" type="number" value={editCapacity} onChange={e => setEditCapacity(Number(e.target.value))} min={1} required />
            <Button type="submit" disabled={savingMeta}>{savingMeta ? 'Saving…' : 'Save Details'}</Button>
          </form>
        </section>
      )}

      {isTeacherOrAdmin && (
        <section>
          <h2 className="font-semibold text-gray-900 mb-3">Evaluation Weights</h2>
          <div className="space-y-2">
            {weights.map((w: EvaluationWeight, i: number) => (
              <div key={i} className="flex gap-2 items-end">
                <Input
                  label={i === 0 ? 'Type' : undefined}
                  value={w.type}
                  onChange={e => setWeights((ws: EvaluationWeight[]) => ws.map((x: EvaluationWeight, j: number) => j === i ? { ...x, type: e.target.value } : x))}
                  placeholder="e.g. EXAM"
                  className="flex-1"
                />
                <Input
                  label={i === 0 ? 'Weight (%)' : undefined}
                  type="number"
                  value={w.weight}
                  onChange={e => setWeights((ws: EvaluationWeight[]) => ws.map((x: EvaluationWeight, j: number) => j === i ? { ...x, weight: Number(e.target.value) } : x))}
                  min={0}
                  max={100}
                  className="w-24"
                />
                <Button variant="danger" size="sm" onClick={() => removeWeight(i)} className="mb-0.5">✕</Button>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-3">
            <Button variant="secondary" size="sm" onClick={addWeight}>+ Add Weight</Button>
            <Button size="sm" onClick={saveWeights} disabled={saving}>{saving ? 'Saving…' : 'Save Weights'}</Button>
          </div>
        </section>
      )}

      {!isTeacherOrAdmin && (
        <section>
          <h2 className="font-semibold text-gray-900 mb-3">Evaluation Weights</h2>
          {course.evaluationWeights?.length ? (
            <Table headers={['Type', 'Weight (%)']}>
              {course.evaluationWeights.map((w, i) => (
                <tr key={i}>
                  <Td>{w.type}</Td>
                  <Td>{w.weight}</Td>
                </tr>
              ))}
            </Table>
          ) : (
            <p className="text-gray-500 text-sm">No weights configured.</p>
          )}
        </section>
      )}
    </div>
  );
}

// ── Grades Tab ────────────────────────────────────────────────────────────────

function GradesTab({ courseId, isTeacherOrAdmin, weights }: {
  courseId: string;
  isTeacherOrAdmin: boolean;
  weights: EvaluationWeight[];
}) {
  const [grades, setGrades] = useState<Grade[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ studentId: '', type: '', value: 0, comment: '' });
  const [adding, setAdding] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importMsg, setImportMsg] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await gradesApi.list({ courseId });
      setGrades(data);
      if (isTeacherOrAdmin) {
        const enrs = await enrollmentsApi.listByCourse(courseId);
        setEnrollments(enrs);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load grades');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [courseId]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    try {
      await gradesApi.create({ ...addForm, courseId, value: Number(addForm.value) });
      setShowAdd(false);
      setAddForm({ studentId: '', type: '', value: 0, comment: '' });
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this grade?')) return;
    try {
      await gradesApi.remove(id);
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  async function handleImport() {
    if (!importFile) return;
    setImportMsg('');
    try {
      const res = await gradesApi.importCsv(courseId, importFile);
      setImportMsg(`Imported ${res.imported} grade(s). Errors: ${res.errors.length}`);
      setImportFile(null);
      load();
    } catch (e: unknown) {
      setImportMsg(e instanceof Error ? e.message : 'Import failed');
    }
  }

  if (loading) return <Spinner />;

  return (
    <div className="space-y-4">
      {error && <Alert type="error">{error}</Alert>}
      {importMsg && <Alert type="info">{importMsg}</Alert>}

      {isTeacherOrAdmin && (
        <div className="flex gap-2 flex-wrap items-center">
          <Button onClick={() => setShowAdd(true)}>+ Add Grade</Button>
          <div className="flex items-center gap-2">
            <input
              type="file"
              accept=".csv"
              id="grade-csv"
              className="hidden"
              onChange={e => setImportFile(e.target.files?.[0] ?? null)}
            />
            <label htmlFor="grade-csv" className="cursor-pointer px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white text-gray-700 hover:bg-gray-50">
              {importFile ? importFile.name : 'Choose CSV…'}
            </label>
            {importFile && (
              <Button size="sm" variant="secondary" onClick={handleImport}>Import</Button>
            )}
          </div>
        </div>
      )}

      <Table headers={['Student', 'Type', 'Value', 'Comment', ...(isTeacherOrAdmin ? ['Actions'] : [])]}>
        {grades.map(g => (
          <tr key={g.id} className="hover:bg-gray-50">
            <Td>{g.student?.name ?? g.studentId}</Td>
            <Td><Badge value={g.type} /></Td>
            <Td className="font-medium">{g.value}</Td>
            <Td>{g.comment ?? '—'}</Td>
            {isTeacherOrAdmin && (
              <Td>
                <Button size="sm" variant="danger" onClick={() => handleDelete(g.id)}>Delete</Button>
              </Td>
            )}
          </tr>
        ))}
      </Table>

      {showAdd && (
        <Modal
          title="Add Grade"
          onClose={() => setShowAdd(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button onClick={handleAdd} disabled={adding}>{adding ? 'Adding…' : 'Add'}</Button>
            </>
          }
        >
          <form id="add-grade" onSubmit={handleAdd} className="space-y-3">
            {enrollments.length > 0 ? (
              <Select
                label="Student"
                value={addForm.studentId}
                onChange={e => setAddForm(f => ({ ...f, studentId: e.target.value }))}
                required
              >
                <option value="">Select student…</option>
                {enrollments.map(en => (
                  <option key={en.studentId} value={en.studentId}>
                    {en.student ? `${en.student.name} (${en.student.email})` : en.studentId}
                  </option>
                ))}
              </Select>
            ) : (
              <Input
                label="Student"
                value={addForm.studentId}
                onChange={e => setAddForm(f => ({ ...f, studentId: e.target.value }))}
                placeholder="No enrolled students"
                disabled
              />
            )}
            {weights.length > 0 ? (
              <Select
                label="Type"
                value={addForm.type}
                onChange={e => setAddForm(f => ({ ...f, type: e.target.value }))}
                required
              >
                <option value="">Select type…</option>
                {weights.map(w => (
                  <option key={w.type} value={w.type}>{w.type}</option>
                ))}
              </Select>
            ) : (
              <Input label="Type" value={addForm.type} onChange={e => setAddForm(f => ({ ...f, type: e.target.value }))} placeholder="EXAM / QUIZ / HW…" required />
            )}
            <Input label="Value" type="number" value={addForm.value} onChange={e => setAddForm(f => ({ ...f, value: Number(e.target.value) }))} min={0} max={100} required />
            <Input label="Comment (optional)" value={addForm.comment} onChange={e => setAddForm(f => ({ ...f, comment: e.target.value }))} />
          </form>
        </Modal>
      )}
    </div>
  );
}

// ── Sessions Tab ──────────────────────────────────────────────────────────────

function SessionsTab({ courseId }: { courseId: string }) {
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ date: '', topic: '' });
  const [adding, setAdding] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await attendancesApi.listSessions(courseId);
      setSessions(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [courseId]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    try {
      await attendancesApi.createSession(courseId, form);
      setShowAdd(false);
      setForm({ date: '', topic: '' });
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setAdding(false);
    }
  }

  if (loading) return <Spinner />;

  return (
    <div className="space-y-4">
      {error && <Alert type="error">{error}</Alert>}
      <Button onClick={() => setShowAdd(true)}>+ New Session</Button>

      <Table headers={['Date', 'Topic', 'Attendances']}>
        {sessions.map(s => (
          <tr key={s.id} className="hover:bg-gray-50">
            <Td className="font-mono">{s.date}</Td>
            <Td>{s.topic ?? '—'}</Td>
            <Td>{s._count.attendances}</Td>
          </tr>
        ))}
      </Table>

      {showAdd && (
        <Modal
          title="New Session"
          onClose={() => setShowAdd(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button onClick={handleAdd} disabled={adding}>{adding ? 'Creating…' : 'Create'}</Button>
            </>
          }
        >
          <form onSubmit={handleAdd} className="space-y-3">
            <Input label="Date" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
            <Input label="Topic (optional)" value={form.topic} onChange={e => setForm(f => ({ ...f, topic: e.target.value }))} />
          </form>
        </Modal>
      )}
    </div>
  );
}

// ── Attendance Tab ────────────────────────────────────────────────────────────

function AttendanceTab({ courseId }: { courseId: string }) {
  const [rates, setRates] = useState<AttendanceRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    attendancesApi.getAttendanceRate(courseId)
      .then(setRates)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [courseId]);

  if (loading) return <Spinner />;

  return (
    <div className="space-y-4">
      {error && <Alert type="error">{error}</Alert>}

      <Table headers={['Student', 'Sessions', 'Attended', 'Rate']}>
        {rates.map(r => (
          <tr key={r.studentId} className="hover:bg-gray-50">
            <Td>{r.name}</Td>
            <Td>{r.totalSessions}</Td>
            <Td>{r.attended}</Td>
            <Td>
              <span className={`font-medium ${(r.attendanceRate ?? 100) < 70 ? 'text-red-600' : 'text-green-700'}`}>
                {r.attendanceRate != null ? `${r.attendanceRate.toFixed(1)}%` : '—'}
              </span>
            </Td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
