import { useCallback, useEffect, useState } from 'react';
import dayjs from 'dayjs';
import api from '../api/client';
import PageHeader from '../components/ui/PageHeader';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import LoadingSkeleton from '../components/ui/LoadingSkeleton';
import TableCard from '../components/ui/TableCard';
import { getErrorMessage } from '../utils/http';

const initialForm = { name: '', holidayDate: '', type: 'public', description: '' };

export default function HolidaysPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(initialForm);

  const loadHolidays = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/holidays');
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load holidays.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadHolidays(); }, [loadHolidays]);

  const submit = async (event) => {
    event.preventDefault();
    if (!form.name.trim() || !form.holidayDate || !form.type) {
      setError('Holiday name, date, and type are required.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const payload = {
        name: form.name.trim(),
        holidayDate: form.holidayDate,
        type: form.type,
        description: form.description.trim() || undefined,
      };
      const { data } = await api.post('/holidays', payload);
      setSuccess(data?.message || 'Holiday created successfully');
      setForm(initialForm);
      await loadHolidays();
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to create holiday.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Holidays" description="Track public and company holidays." />

      <form className="rounded-2xl bg-white p-5 shadow-sm border border-slate-100 grid grid-cols-1 md:grid-cols-5 gap-2" onSubmit={submit}>
        <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Holiday name" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
        <input type="date" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" value={form.holidayDate} onChange={(e) => setForm((prev) => ({ ...prev, holidayDate: e.target.value }))} />
        <select className="rounded-lg border border-slate-300 px-3 py-2 text-sm" value={form.type} onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value }))}><option value="public">Public</option><option value="company">Company</option><option value="optional">Optional</option></select>
        <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Description (optional)" value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} />
        <button type="submit" disabled={saving} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60">{saving ? 'Creating...' : 'Add Holiday'}</button>
      </form>

      {error ? <ErrorState message={error} onRetry={loadHolidays} /> : null}
      {success ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div> : null}
      {loading ? <LoadingSkeleton rows={4} /> : null}

      {!loading && !error && rows.length === 0 ? <EmptyState title="No holidays added" message="Create holidays to keep your team informed." /> : null}

      {!loading && rows.length > 0 ? (
        <TableCard>
          <table className="w-full text-sm min-w-[680px]">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                {['Name', 'Date', 'Type', 'Description'].map((h) => <th key={h} className="text-left font-medium px-4 py-3">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((h) => (
                <tr key={h.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-800">{h.name}</td>
                  <td className="px-4 py-3 text-slate-600">{dayjs(h.holidayDate).format('MMM D, YYYY')}</td>
                  <td className="px-4 py-3"><span className="rounded-full bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 capitalize">{h.type}</span></td>
                  <td className="px-4 py-3 text-slate-600">{h.description || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableCard>
      ) : null}
    </div>
  );
}
