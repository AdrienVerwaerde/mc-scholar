import { useState } from 'react';
import { adminApi } from '../api';
import type { SemesterStats } from '../types';
import {
  Button, Input, PageHeader, Alert, Spinner, Table, Td,
} from '../components/ui';

export function AdminPage() {
  const [semester, setSemester] = useState('');
  const [stats, setStats] = useState<SemesterStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [statsError, setStatsError] = useState('');

  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState('');

  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState('');

  async function handleLoadStats() {
    if (!semester) return;
    setLoadingStats(true);
    setStatsError('');
    setStats(null);
    try {
      const data = await adminApi.getStats(semester);
      setStats(data);
    } catch (e: unknown) {
      setStatsError(e instanceof Error ? e.message : 'Failed to load stats');
    } finally {
      setLoadingStats(false);
    }
  }

  async function handleExport() {
    if (!semester) return;
    setExporting(true);
    setExportMsg('');
    try {
      const res = await adminApi.exportCsv(semester);
      if (!res.ok) throw new Error(res.statusText);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `semester-${semester}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setExportMsg('Download started.');
    } catch (e: unknown) {
      setExportMsg(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  }

  async function handleImport() {
    if (!importFile) return;
    setImporting(true);
    setImportResult('');
    try {
      const res = await adminApi.importEnrollments(importFile);
      setImportResult(`Enrolled: ${res.enrolled}, Skipped: ${res.skipped}, Failed: ${res.failed}`);
      setImportFile(null);
    } catch (e: unknown) {
      setImportResult(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="p-6 space-y-10">
      <PageHeader title="Admin Dashboard" subtitle="Semester statistics and bulk operations" />

      {/* Stats section */}
      <section className="max-w-2xl">
        <h2 className="font-semibold text-gray-900 mb-3">Semester Statistics</h2>
        <div className="flex gap-2 mb-4">
          <Input
            placeholder="Semester (e.g. S1-2024)"
            value={semester}
            onChange={e => setSemester(e.target.value)}
            className="w-52"
          />
          <Button onClick={handleLoadStats} disabled={!semester || loadingStats}>
            {loadingStats ? 'Loading…' : 'Load Stats'}
          </Button>
          <Button variant="secondary" onClick={handleExport} disabled={!semester || exporting}>
            {exporting ? 'Exporting…' : 'Export CSV'}
          </Button>
        </div>
        {exportMsg && <div className="mb-3"><Alert type="info">{exportMsg}</Alert></div>}
        {statsError && <Alert type="error">{statsError}</Alert>}
        {loadingStats && <Spinner />}
        {stats && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <StatCard label="Courses" value={stats.totalCourses} />
              <StatCard label="Students" value={stats.totalStudents} />
              <StatCard label="At Risk" value={stats.atRiskStudents} danger />
            </div>

            {stats.courses?.length > 0 && (
              <Table headers={['Course', 'Students', 'Avg Grade', 'At Risk']}>
                {stats.courses.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <Td className="font-medium">{c.title}</Td>
                    <Td>{c.enrollments}</Td>
                    <Td>{c.averageGrade != null ? c.averageGrade.toFixed(1) : '—'}</Td>
                    <Td>
                      {c.atRiskStudents > 0 ? (
                        <span className="text-red-600 font-medium">{c.atRiskStudents}</span>
                      ) : '0'}
                    </Td>
                  </tr>
                ))}
              </Table>
            )}
          </div>
        )}
      </section>

      {/* Bulk enrollment import */}
      <section className="max-w-lg">
        <h2 className="font-semibold text-gray-900 mb-1">Bulk Enrollment Import</h2>
        <p className="text-sm text-gray-500 mb-3">Upload a CSV with columns: <code className="bg-gray-100 px-1 rounded">studentEmail,courseCode,semester</code></p>
        {importResult && <div className="mb-3"><Alert type={importResult.includes('failed') ? 'error' : 'success'}>{importResult}</Alert></div>}
        <div className="flex items-center gap-2">
          <input
            type="file"
            accept=".csv"
            id="enroll-csv"
            className="hidden"
            onChange={e => setImportFile(e.target.files?.[0] ?? null)}
          />
          <label htmlFor="enroll-csv" className="cursor-pointer px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-700 hover:bg-gray-50">
            {importFile ? importFile.name : 'Choose CSV…'}
          </label>
          {importFile && (
            <Button onClick={handleImport} disabled={importing}>
              {importing ? 'Importing…' : 'Import Enrollments'}
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${danger ? 'text-red-600' : 'text-gray-900'}`}>{value}</p>
    </div>
  );
}
