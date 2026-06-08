import { useEffect, useState } from 'react';
import { gradesApi } from '../api';
import type { Grade } from '../types';
import { PageHeader, Alert, Spinner, Table, Td, Badge } from '../components/ui';

export function MyGradesPage() {
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    gradesApi.list()
      .then(setGrades)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6">
      <PageHeader title="My Grades" subtitle="Your academic results" />
      {error && <div className="mb-4"><Alert type="error">{error}</Alert></div>}
      {loading ? (
        <Spinner />
      ) : (
        <Table headers={['Course', 'Type', 'Value', 'Comment']}>
          {grades.map(g => (
            <tr key={g.id} className="hover:bg-gray-50">
              <Td className="font-mono text-xs">{g.courseId}</Td>
              <Td><Badge value={g.type} /></Td>
              <Td className="font-medium">{g.value}</Td>
              <Td>{g.comment ?? '—'}</Td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
