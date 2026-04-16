import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import PageHeader from '../components/ui/PageHeader';
import ErrorState from '../components/ui/ErrorState';
import LoadingSkeleton from '../components/ui/LoadingSkeleton';
import { getErrorMessage } from '../utils/http';

export default function NewTimeOffPage() {
  const nav = useNavigate();
  const [types, setTypes] = useState([]);
  const [form, setForm] = useState({ timeOffTypeId: '', startDate: '', endDate: '', reason: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadTypes = async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await api.get('/time-off-types');
        const rows = Array.isArray(data) ? data : [];
        setTypes(rows);
        setForm((prev) => ({ ...prev, timeOffTypeId: rows[0]?.id || '' }));
      } catch (err) {
        setError(getErrorMessage(err, 'Unable to load time off types.'));
      } finally {
        setLoading(false);
      }
    };
    loadTypes();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/time-off-requests', form);
      nav('/time-off');
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to submit request.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 max-w-xl">
      <PageHeader title="Request Time Off" description="Submit a new leave request." />
      {error ? <ErrorState message={error} /> : null}
      {loading ? <LoadingSkeleton rows={3} /> : null}
      {!loading ? (
        <form onSubmit={submit} className="rounded-2xl bg-white p-5 shadow-sm border border-slate-100 space-y-3">
          <select className="border rounded-lg p-2 w-full" value={form.timeOffTypeId} onChange={(e) => setForm({ ...form, timeOffTypeId: e.target.value })}>{types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
          <input type="date" className="border rounded-lg p-2 w-full" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
          <input type="date" className="border rounded-lg p-2 w-full" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
          <textarea className="border rounded-lg p-2 w-full" placeholder="Reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          <button disabled={saving} className="bg-indigo-600 text-white px-3 py-2 rounded-lg">{saving ? 'Submitting...' : 'Submit'}</button>
        </form>
      ) : null}
    </div>
  );
}
