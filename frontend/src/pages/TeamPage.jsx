import { useCallback, useEffect, useState } from 'react';
import api from '../api/client';
import PageHeader from '../components/ui/PageHeader';
import ErrorState from '../components/ui/ErrorState';
import EmptyState from '../components/ui/EmptyState';
import LoadingSkeleton from '../components/ui/LoadingSkeleton';
import { getErrorMessage } from '../utils/http';

export default function TeamPage() {
  const [rows, setRows] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: 'Password123!', role: 'employee', workScheduleId: '' });

  const loadTeam = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [teamRes, schedulesRes] = await Promise.all([api.get('/team'), api.get('/work-schedules')]);
      const nextSchedules = Array.isArray(schedulesRes.data) ? schedulesRes.data : [];
      setRows(Array.isArray(teamRes.data) ? teamRes.data : []);
      setSchedules(nextSchedules);
      setForm((prev) => ({ ...prev, workScheduleId: prev.workScheduleId || nextSchedules[0]?.id || '' }));
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to load team data.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTeam(); }, [loadTeam]);

  const add = async () => {
    try {
      await api.post('/team', form);
      await loadTeam();
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to create team member.'));
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Team" description="Manage users and role assignments." />
      {error ? <ErrorState message={error} onRetry={loadTeam} /> : null}
      {loading ? <LoadingSkeleton rows={4} /> : null}

      {!loading ? (
        <div className="rounded-2xl bg-white p-5 shadow-sm border border-slate-100">
          <h3 className="font-semibold">Add team member</h3>
          <div className="grid md:grid-cols-6 gap-2 mt-3">
            {['name', 'email', 'password'].map((key) => <input key={key} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder={key} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />)}
            <select className="rounded-lg border border-slate-300 px-3 py-2 text-sm" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option value="employee">employee</option><option value="manager">manager</option></select>
            <select className="rounded-lg border border-slate-300 px-3 py-2 text-sm" value={form.workScheduleId} onChange={(e) => setForm({ ...form, workScheduleId: e.target.value })}>{schedules.length === 0 ? <option value="">No schedules</option> : schedules.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
            <button type="button" onClick={add} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white">Create</button>
          </div>
        </div>
      ) : null}

      {!loading && rows.length === 0 ? <EmptyState title="No team members" message="Members will appear here once created." /> : null}

      {!loading && rows.length > 0 ? (
        <div className="rounded-2xl bg-white p-5 shadow-sm border border-slate-100 space-y-2">
          {rows.map((u) => <div key={u.id} className="rounded-xl border border-slate-100 p-3 text-sm">{u.name} · {u.email} · <span className="capitalize">{u.role}</span></div>)}
        </div>
      ) : null}
    </div>
  );
}
