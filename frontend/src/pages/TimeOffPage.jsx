import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../api/client';
import PageHeader from '../components/ui/PageHeader';
import ErrorState from '../components/ui/ErrorState';
import EmptyState from '../components/ui/EmptyState';
import LoadingSkeleton from '../components/ui/LoadingSkeleton';
import { getErrorMessage } from '../utils/http';

export default function TimeOffPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(Boolean(location.state?.requestCreated));

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/time-off-requests');
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to load time off requests.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadRequests(); }, [loadRequests]);
  useEffect(() => {
    if (location.state?.requestCreated) {
      setSuccess(true);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.pathname, location.state, navigate]);

  return (
    <div className="space-y-4">
      <PageHeader title="Time Off" description="Track leave requests and statuses." actions={<Link to="/time-off/new" className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white">Request Time Off</Link>} />
      {success ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">Time off request submitted successfully.</div> : null}
      {error ? <ErrorState message={error} onRetry={loadRequests} /> : null}
      {loading ? <LoadingSkeleton rows={4} /> : null}
      {!loading && rows.length === 0 ? <EmptyState title="No requests found" message="Create a request to get started." /> : null}
      {!loading && rows.length > 0 ? (
        <div className="rounded-2xl bg-white p-5 shadow-sm border border-slate-100 space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="rounded-xl border border-slate-100 p-3 text-sm">
              <p className="font-medium text-slate-800">{r.timeOffType?.name || 'Leave'} · <span className="capitalize">{r.status}</span></p>
              <p className="text-slate-500 mt-1">{dayjs(r.startDate).format('MMM D')} - {dayjs(r.endDate).format('MMM D, YYYY')}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
