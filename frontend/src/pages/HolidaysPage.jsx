import { useCallback, useEffect, useState } from 'react';
import dayjs from 'dayjs';
import api from '../api/client';
import PageHeader from '../components/ui/PageHeader';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import LoadingSkeleton from '../components/ui/LoadingSkeleton';
import TableCard from '../components/ui/TableCard';
import { getErrorMessage } from '../utils/http';

export default function HolidaysPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', holidayDate: '', type: 'public', description: '' });

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
    if (!form.name || !form.holidayDate) return;
    setSaving(true);
    try {
      await api.post('/holidays', form);
      setForm({ name: '', holidayDate: '', type: 'public', description: '' });
      await loadHolidays();
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to create holiday.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Holidays"
        description="Track public and company holidays."
        actions={(
          <form className="grid grid-cols-2 md:grid-cols-4 gap-2" onSubmit={submit}>
            <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Holiday name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input type="date" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" value={form.holidayDate} onChange={(e) => setForm({ ...form, holidayDate: e.target.value })} />
            <select className="rounded-lg border border-slate-300 px-3 py-2 text-sm" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}><option value="public">Public</option><option value="company">Company</option><option value="optional">Optional</option></select>
            <button type="submit" disabled={saving} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60">Add Holiday</button>
          </form>
        )}
      />

      {error ? <ErrorState message={error} onRetry={loadHolidays} /> : null}
      {loading ? <LoadingSkeleton rows={4} /> : null}

      {!loading && rows.length === 0 ? <EmptyState title="No holidays added" message="Create holidays to keep your team informed." /> : null}

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
