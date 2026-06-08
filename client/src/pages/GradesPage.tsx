import { useEffect, useState } from 'react';
import { gradesApi, coursesApi } from '../api';
import { useAuth } from '../context/AuthContext';
import type { Grade, Course } from '../types';
import {
  Button, Input, Select, Modal, PageHeader, Alert, Spinner, Table, Td, Badge,
} from '../components/ui';

export function GradesPage() {
  const { user } = useAuth();
  const [grades, setGrades] = useState<Grade[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterCourse, setFilterCourse] = useState('');
  const [filterType, setFilterType] = useState('');

  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ studentId: '', courseId: '', type: '', value: 0, comment: '' });
  const [adding, setAdding] = useState(false);

  const [importFile, setImportFile] = useState<File | null>(null);
  const [importCourseId, setImportCourseId] = useState('');
  const [importMsg, setImportMsg] = useState('');

  const isTeacherOrAdmin = user?.role === 'TEACHER' || user?.role === 'ADMIN';

  async function load() {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, string> = {};
      if (filterCourse) params.courseId = filterCourse;
      if (filterType) params.type = filterType;
      const data = await gradesApi.list(params);
      setGrades(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load grades');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    coursesApi.list({ limit: 100 })
      .then(r => setCourses(r.items))
      .catch(() => {});
  }, []);

  useEffect(() => { load(); }, [filterCourse, filterType]);

  async function handleDelete(id: string) {
    if (!confirm('Delete this grade?')) return;
    try {
      await gradesApi.remove(id);
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    try {
      await gradesApi.create({ ...addForm, value: Number(addForm.value) });
      setShowAdd(false);
      setAddForm({ studentId: '', courseId: '', type: '', value: 0, comment: '' });
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setAdding(false);
    }
  }

  async function handleImport() {
    if (!importFile || !importCourseId) return;
    setImportMsg('');
    try {
      const res = await gradesApi.importCsv(importCourseId, importFile);
      setImportMsg(`Imported ${res.imported} grade(s). Errors: ${res.errors.length}`);
      setImportFile(null);
      load();
    } catch (e: unknown) {
      setImportMsg(e instanceof Error ? e.message : 'Import failed');
    }
  }

  return (
    <div className="p-6">
      <PageHeader
        title="Grades"
        subtitle="Manage student grades"
        action={
          isTeacherOrAdmin ? (
            <Button onClick={() => setShowAdd(true)}>+ Add Grade</Button>
          ) : undefined
        }
      />

      {error && <div className="mb-4"><Alert type="error">{error}</Alert></div>}
      {importMsg && <div className="mb-4"><Alert type="info">{importMsg}</Alert></div>}

      <div className="flex gap-3 mb-4 flex-wrap">
        <Select
          value={filterCourse}
          onChange={e => setFilterCourse(e.target.value)}
          className="w-52"
        >
          <option value="">All courses</option>
          {courses.map(c => <option key={c.id} value={c.id}>{c.code} – {c.title}</option>)}
        </Select>
        <Input
          placeholder="Filter by type…"
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="w-40"
        />

        {isTeacherOrAdmin && (
          <div className="flex items-center gap-2 ml-auto">
            <Select
              value={importCourseId}
              onChange={e => setImportCourseId(e.target.value)}
              className="w-44"
            >
              <option value="">Course for import…</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}
            </Select>
            <input
              type="file"
              accept=".csv"
              id="grades-csv"
              className="hidden"
              onChange={e => setImportFile(e.target.files?.[0] ?? null)}
            />
            <label htmlFor="grades-csv" className="cursor-pointer px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white text-gray-700 hover:bg-gray-50">
              {importFile ? importFile.name : 'CSV…'}
            </label>
            {importFile && importCourseId && (
              <Button size="sm" variant="secondary" onClick={handleImport}>Import</Button>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <Table headers={['Course', 'Student', 'Type', 'Value', 'Comment', ...(isTeacherOrAdmin ? ['Actions'] : [])]}>
          {grades.map(g => (
            <tr key={g.id} className="hover:bg-gray-50">
              <Td className="font-mono text-xs">{g.courseId}</Td>
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
      )}

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
          <form onSubmit={handleAdd} className="space-y-3">
            <Select
              label="Course"
              value={addForm.courseId}
              onChange={e => setAddForm(f => ({ ...f, courseId: e.target.value }))}
              required
            >
              <option value="">Select course…</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.code} – {c.title}</option>)}
            </Select>
            <Input label="Student ID" value={addForm.studentId} onChange={e => setAddForm(f => ({ ...f, studentId: e.target.value }))} required />
            <Input label="Type" value={addForm.type} onChange={e => setAddForm(f => ({ ...f, type: e.target.value }))} placeholder="EXAM / QUIZ / HW…" required />
            <Input label="Value" type="number" value={addForm.value} onChange={e => setAddForm(f => ({ ...f, value: Number(e.target.value) }))} min={0} max={100} required />
            <Input label="Comment (optional)" value={addForm.comment} onChange={e => setAddForm(f => ({ ...f, comment: e.target.value }))} />
          </form>
        </Modal>
      )}
    </div>
  );
}
