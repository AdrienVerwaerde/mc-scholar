import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { enrollmentsApi } from '../api';
import type { Enrollment } from '../types';
import { Button, PageHeader, Alert, Spinner, Table, Td } from '../components/ui';

export function EnrollmentsPage() {
  const navigate = useNavigate();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await enrollmentsApi.listMine();
      setEnrollments(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load enrollments');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleUnenroll(courseId: string) {
    if (!confirm('Unenroll from this course?')) return;
    try {
      await enrollmentsApi.unenroll(courseId);
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unenroll failed');
    }
  }

  return (
    <div className="p-6">
      <PageHeader title="My Enrollments" subtitle="Courses you are enrolled in" />
      {error && <div className="mb-4"><Alert type="error">{error}</Alert></div>}
      {loading ? (
        <Spinner />
      ) : (
        <Table headers={['Course', 'Semester', 'Actions']}>
          {enrollments.map(e => (
            <tr key={e.courseId} className="hover:bg-gray-50">
              <Td>
                <button
                  className="cursor-pointer text-indigo-600 hover:underline"
                  onClick={() => navigate(`/courses/${e.courseId}`)}
                >
                  {e.course?.title ?? e.courseId}
                </button>
              </Td>
              <Td>{e.course?.semester ?? '—'}</Td>
              <Td>
                <Button size="sm" variant="secondary" onClick={() => handleUnenroll(e.courseId)}>
                  Unenroll
                </Button>
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
