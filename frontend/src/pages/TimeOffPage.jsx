import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../api/client';
import PageHeader from '../components/ui/PageHeader';
import ErrorState from '../components/ui/ErrorState';
import EmptyState from '../components/ui/EmptyState';
import LoadingSkeleton from '../components/ui/LoadingSkeleton';
import { getErrorMessage } from '../utils/http';
import { useAuth } from '../hooks/useAuth';

export default function TimeOffPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canReviewRequests = user?.role === 'admin' || user?.role === 'manager';

  const [rows, setRows] = useState([]);
  const [pendingRows, setPendingRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(Boolean(location.state?.requestCreated));
  const [statusUpdatingId, setStatusUpdatingId] = useState('');

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const requestsPromise = api.get('/time-off-requests');
      const pendingPromise = canReviewRequests ? api.get('/admin/time-off-requests/pending') : Promise.resolve({ data: { data: [] } });
      const [requestsRes, pendingRes] = await Promise.all([requestsPromise, pendingPromise]);
      setRows(Array.isArray(requestsRes.data) ? requestsRes.data : []);
      setPendingRows(Array.isArray(pendingRes?.data?.data) ? pendingRes.data.data : []);
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to load time off requests.'));
    } finally {
      setLoading(false);
    }
  }, [canReviewRequests]);

  useEffect(() => { loadRequests(); }, [loadRequests]);
  useEffect(() => {
    if (location.state?.requestCreated) {
      setSuccess(true);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.pathname, location.state, navigate]);

  const updateStatus = async (id, status) => {
    setStatusUpdatingId(String(id));
    setError('');
    try {
      const { data } = await api.patch(`/admin/time-off-requests/${id}/status`, { status });
      setSuccess(data?.message || `Request ${status} successfully`);
      await loadRequests();
    } catch (err) {
      setError(getErrorMessage(err, `Unable to ${status} request.`));
    } finally {
      setStatusUpdatingId('');
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Time Off" description="Track leave requests and statuses." actions={<Link to="/time-off/new" className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white">Request Time Off</Link>} />
      {success ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success === true ? 'Time off request submitted successfully.' : success}</div> : null}
      {error ? <ErrorState message={error} onRetry={loadRequests} /> : null}
      {loading ? <LoadingSkeleton rows={4} /> : null}

      {!loading && canReviewRequests ? (
        <div className="rounded-2xl bg-white p-5 shadow-sm border border-slate-100 space-y-3">
          <h3 className="text-base font-semibold">Pending requests for approval</h3>
          {pendingRows.length === 0 ? <p className="text-sm text-slate-500">No pending requests.</p> : null}
          {pendingRows.map((r) => (
            <div key={r.id} className="rounded-xl border border-slate-100 p-3 text-sm flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-medium text-slate-800">{r.user?.name || 'Employee'} · {r.timeOffType?.name || 'Leave'}</p>
                <p className="text-slate-500 mt-1">{dayjs(r.startDate).format('MMM D')} - {dayjs(r.endDate).format('MMM D, YYYY')}</p>
              </div>
              <div className="flex gap-2">
                <button type="button" disabled={statusUpdatingId === String(r.id)} onClick={() => updateStatus(r.id, 'approved')} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white disabled:opacity-60">Approve</button>
                <button type="button" disabled={statusUpdatingId === String(r.id)} onClick={() => updateStatus(r.id, 'rejected')} className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-medium text-white disabled:opacity-60">Reject</button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {!loading && !error && rows.length === 0 ? <EmptyState title="No requests found" message="Create a request to get started." /> : null}
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
