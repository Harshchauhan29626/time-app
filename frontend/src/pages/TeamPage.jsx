import { useCallback, useEffect, useState } from 'react';
import api from '../api/client';
import PageHeader from '../components/ui/PageHeader';
import ErrorState from '../components/ui/ErrorState';
import EmptyState from '../components/ui/EmptyState';
import LoadingSkeleton from '../components/ui/LoadingSkeleton';
import { getErrorMessage } from '../utils/http';

const initialForm = { name: '', email: '', password: 'Password123!', role: 'employee', workScheduleId: '' };

export default function TeamPage() {
  const [rows, setRows] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState(initialForm);

  const loadTeam = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [teamRes, schedulesRes] = await Promise.all([api.get('/team'), api.get('/work-schedules')]);
      const nextSchedules = Array.isArray(schedulesRes.data) ? schedulesRes.data : [];
      setRows(Array.isArray(teamRes.data) ? teamRes.data : []);
      setSchedules(nextSchedules);
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to load team data.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTeam(); }, [loadTeam]);

  const add = async (event) => {
    event.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.password || !form.role) {
      setError('Name, email, password, and role are required.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
        workScheduleId: form.workScheduleId ? String(form.workScheduleId) : null,
      };
      const { data } = await api.post('/team', payload);
      setSuccess(data?.message || 'Team member created successfully');
      setForm(initialForm);
      await loadTeam();
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to create team member.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Team" description="Manage users and role assignments." />
      {error ? <ErrorState message={error} onRetry={loadTeam} /> : null}
      {success ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div> : null}
      {loading ? <LoadingSkeleton rows={4} /> : null}

      {!loading ? (
        <form onSubmit={add} className="rounded-2xl bg-white p-5 shadow-sm border border-slate-100">
          <h3 className="font-semibold">Add team member</h3>
          <div className="grid md:grid-cols-6 gap-2 mt-3">
            {['name', 'email', 'password'].map((key) => <input key={key} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder={key} value={form[key]} onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))} />)}
            <select className="rounded-lg border border-slate-300 px-3 py-2 text-sm" value={form.role} onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}><option value="employee">employee</option><option value="manager">manager</option></select>
            <select className="rounded-lg border border-slate-300 px-3 py-2 text-sm" value={form.workScheduleId} onChange={(e) => setForm((prev) => ({ ...prev, workScheduleId: e.target.value }))}>
              <option value="">No schedule</option>
              {schedules.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <button type="submit" disabled={saving} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60">{saving ? 'Creating...' : 'Create'}</button>
          </div>
        </form>
      ) : null}

      {!loading && !error && rows.length === 0 ? <EmptyState title="No team members" message="Members will appear here once created." /> : null}

      {!loading && rows.length > 0 ? (
        <div className="rounded-2xl bg-white p-5 shadow-sm border border-slate-100 space-y-2">
          {rows.map((u) => <div key={u.id} className="rounded-xl border border-slate-100 p-3 text-sm">{u.name} · {u.email} · <span className="capitalize">{u.role}</span></div>)}
        </div>
      ) : null}
    </div>
  );
}
