import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../api/client';
import PageHeader from '../components/ui/PageHeader';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import LoadingSkeleton from '../components/ui/LoadingSkeleton';
import { getErrorMessage } from '../utils/http';

const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function WorkSchedulesPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '' });
  const [saving, setSaving] = useState(false);

  const loadSchedules = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/work-schedules');
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load work schedules.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSchedules(); }, [loadSchedules]);

  const submit = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    setError('');
    try {
      await api.post('/work-schedules', { name: form.name.trim(), startTime: '09:00', endTime: '17:00', breakMinutes: 60, weeklyHours: 40, days: [1, 2, 3, 4, 5].map((d) => ({ weekday: d, scheduledMinutes: 480 })) });
      setForm({ name: '' });
      await loadSchedules();
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to create schedule.'));
    } finally {
      setSaving(false);
    }
  };

  const mapped = useMemo(() => rows.map((row) => ({
    ...row,
    workingDays: (row.days || []).map((d) => days[d.weekday]).filter(Boolean).join(', ') || 'Not configured',
  })), [rows]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Work Schedules"
        description="Manage weekly schedules for your team."
        actions={(
          <form className="flex items-center gap-2" onSubmit={submit}>
            <input className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" placeholder="Schedule name" value={form.name} onChange={(e) => setForm({ name: e.target.value })} />
            <button type="submit" disabled={saving} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60">Add Schedule</button>
          </form>
        )}
      />

      {error ? <ErrorState message={error} onRetry={loadSchedules} /> : null}
      {loading ? <LoadingSkeleton rows={4} /> : null}

      {!loading && mapped.length === 0 ? <EmptyState title="No schedules available" message="Create your first work schedule to assign it to team members." /> : null}

      {!loading && mapped.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {mapped.map((schedule) => (
            <article key={schedule.id} className="rounded-2xl bg-white p-5 shadow-sm border border-slate-100">
              <h3 className="text-lg font-semibold">{schedule.name}</h3>
              <p className="mt-2 text-sm text-slate-600">{String(schedule.startTime).slice(11, 16)} - {String(schedule.endTime).slice(11, 16)}</p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-500">
                <p>Break: <span className="text-slate-700">{schedule.breakMinutes} min</span></p>
                <p>Weekly Hours: <span className="text-slate-700">{Number(schedule.weeklyHours)} h</span></p>
              </div>
              <p className="mt-3 text-sm text-slate-500">Working Days: <span className="text-slate-700">{schedule.workingDays}</span></p>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}
