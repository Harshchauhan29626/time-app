import { useCallback, useEffect, useState } from 'react';
import dayjs from 'dayjs';
import api from '../api/client';
import PageHeader from '../components/ui/PageHeader';
import ErrorState from '../components/ui/ErrorState';
import EmptyState from '../components/ui/EmptyState';
import LoadingSkeleton from '../components/ui/LoadingSkeleton';
import TableCard from '../components/ui/TableCard';
import { getErrorMessage, minutesToHours } from '../utils/http';

export default function TimesheetsPage() {
  const [range, setRange] = useState('week');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadTimesheets = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get(`/time-entries?range=${range}&page=1&pageSize=25`);
      setRows(Array.isArray(data?.data) ? data.data : []);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load timesheets.'));
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { loadTimesheets(); }, [loadTimesheets]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Timesheets"
        description="Review daily attendance, breaks, and overtime."
        actions={<select className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" value={range} onChange={(e) => setRange(e.target.value)}><option value="today">Today</option><option value="week">This week</option><option value="month">This month</option></select>}
      />

      {error ? <ErrorState message={error} onRetry={loadTimesheets} /> : null}
      {loading ? <LoadingSkeleton rows={5} /> : null}

      {!loading && !error && rows.length === 0 ? <EmptyState title="No timesheet records" message="Entries will appear here once you clock in and out." /> : null}

      {!loading && rows.length > 0 ? (
        <TableCard>
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                {['Date', 'Clock In', 'Clock Out', 'Worked', 'Break', 'Overtime', 'Status'].map((h) => <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const worked = r.workedMinutes ?? r.totalWorkMinutes ?? 0;
                const br = r.breakMinutes ?? r.totalBreakMinutes ?? 0;
                const status = r.status || (r.clockOut ? 'completed' : 'active');
                return (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="px-4 py-3">{dayjs(r.date || r.clockIn).format('YYYY-MM-DD')}</td>
                    <td className="px-4 py-3">{dayjs(r.clockIn).format('HH:mm')}</td>
                    <td className="px-4 py-3">{r.clockOut ? dayjs(r.clockOut).format('HH:mm') : 'In progress'}</td>
                    <td className="px-4 py-3">{minutesToHours(worked)}</td>
                    <td className="px-4 py-3">{minutesToHours(br)}</td>
                    <td className="px-4 py-3">{minutesToHours(r.overtimeMinutes)}</td>
                    <td className="px-4 py-3"><span className="rounded-full bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 capitalize">{status}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableCard>
      ) : null}
    </div>
  );
}
