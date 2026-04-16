import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../api/client';
import PageHeader from '../components/ui/PageHeader';
import ErrorState from '../components/ui/ErrorState';
import LoadingSkeleton from '../components/ui/LoadingSkeleton';
import { getErrorMessage } from '../utils/http';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [settings, setSettings] = useState({ name: '', timezone: '', defaultWorkScheduleId: '' });
  const [schedules, setSchedules] = useState([]);

  const canEdit = useMemo(() => !loading && !saving, [loading, saving]);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [settingsRes, schedulesRes] = await Promise.allSettled([api.get('/settings'), api.get('/work-schedules')]);
      if (settingsRes.status === 'fulfilled') {
        const company = settingsRes.value.data;
        setSettings((prev) => ({ ...prev, name: company?.name || '', timezone: company?.timezone || 'UTC' }));
      } else {
        throw settingsRes.reason;
      }
      if (schedulesRes.status === 'fulfilled') {
        const list = Array.isArray(schedulesRes.value.data) ? schedulesRes.value.data : [];
        setSchedules(list);
        setSettings((prev) => ({ ...prev, defaultWorkScheduleId: list[0]?.id || '' }));
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load company settings.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setSuccess('');
    setError('');
    try {
      await api.patch('/settings', { name: settings.name, timezone: settings.timezone });
      setSuccess('Settings saved successfully.');
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save settings.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <PageHeader title="Settings" description="Update your company preferences." />
      {error ? <ErrorState message={error} onRetry={loadSettings} /> : null}
      {success ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{success}</div> : null}
      {loading ? <LoadingSkeleton rows={3} /> : null}

      {!loading ? (
        <form onSubmit={save} className="rounded-2xl bg-white p-5 shadow-sm border border-slate-100 space-y-4">
          <label className="block text-sm">
            <span className="text-slate-600">Company Name</span>
            <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={settings.name} onChange={(e) => setSettings({ ...settings, name: e.target.value })} disabled={!canEdit} />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Timezone</span>
            <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={settings.timezone} onChange={(e) => setSettings({ ...settings, timezone: e.target.value })} disabled={!canEdit} />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Default Work Schedule</span>
            <select className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={settings.defaultWorkScheduleId} onChange={(e) => setSettings({ ...settings, defaultWorkScheduleId: e.target.value })} disabled={!canEdit || schedules.length === 0}>
              {schedules.length === 0 ? <option value="">No schedules found</option> : schedules.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <button type="submit" disabled={!canEdit} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">{saving ? 'Saving...' : 'Save Changes'}</button>
        </form>
      ) : null}
    </div>
  );
}
