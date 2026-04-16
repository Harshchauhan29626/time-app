import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import api from '../api/client';
import { useAuth } from '../hooks/useAuth';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/ui/StatCard';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import LoadingSkeleton, { SkeletonBlock } from '../components/ui/LoadingSkeleton';
import { getErrorMessage, minutesToCompact, minutesToHours } from '../utils/http';

export default function DashboardPage() {
  const { user } = useAuth();
  const [range, setRange] = useState('week');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState('');
  const [data, setData] = useState(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data: payload } = await api.get(`/dashboard/summary?range=${range}`);
      setData(payload);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load dashboard summary.'));
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  const currentEntry = data?.currentActiveEntry;
  const breaks = currentEntry?.breakEntries || currentEntry?.breaks || [];
  const activeBreak = breaks.find((item) => !(item.breakEnd || item.endAt));
  const isTracking = Boolean(currentEntry);
  const isOnBreak = Boolean(activeBreak);

  const cards = useMemo(() => ([
    { label: 'Worked Hours', value: minutesToHours(data?.workedMinutes), hint: `(${minutesToCompact(data?.workedMinutes)})` },
    { label: 'Break Time', value: minutesToHours(data?.breakMinutes), hint: `(${minutesToCompact(data?.breakMinutes)})` },
    { label: 'Overtime', value: minutesToHours(data?.overtimeMinutes), hint: `(${minutesToCompact(data?.overtimeMinutes)})` },
    { label: 'Current Status', value: isTracking ? (isOnBreak ? 'On break' : 'Clocked in') : 'Not tracking', hint: isTracking ? `Since ${dayjs(currentEntry.clockIn).format('HH:mm')}` : 'Ready to start your day' },
  ]), [currentEntry, data, isOnBreak, isTracking]);

  const action = async (path) => {
    setActionLoading(path);
    try {
      await api.post(path);
      await loadDashboard();
      window.dispatchEvent(new Event('timeflow:tracking-changed'));
    } catch (err) {
      setError(getErrorMessage(err, 'Action failed.'));
    } finally {
      setActionLoading('');
    }
  };

  if (loading) {
    return (
      <div className="space-y-5">
        <SkeletonBlock className="h-20 w-full" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <SkeletonBlock key={i} className="h-28" />)}</div>
        <LoadingSkeleton rows={3} />
      </div>
    );
  }

  if (error && !data) return <ErrorState message={error} onRetry={loadDashboard} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${user?.name || 'Team member'}`}
        description={`Workspace: ${user?.company?.name || 'Your company'}`}
        actions={(
          <div className="flex rounded-xl bg-white p-1 border border-slate-200 shadow-sm">
            {['day', 'week', 'month'].map((option) => (
              <button key={option} type="button" onClick={() => setRange(option)} className={`px-3 py-1 rounded-lg text-sm capitalize ${range === option ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                {option}
              </button>
            ))}
          </div>
        )}
      />

      {error ? <ErrorState title="Some actions failed" message={error} onRetry={loadDashboard} /> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{cards.map((c) => <StatCard key={c.label} {...c} />)}</div>

      <div className="rounded-2xl bg-white p-4 shadow-sm border border-slate-100">
        <p className="font-medium">Quick Actions</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {!isTracking ? (
            <button type="button" disabled={Boolean(actionLoading)} onClick={() => action('/time/clock-in')} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
              {actionLoading === '/time/clock-in' ? 'Clocking In...' : 'Clock In'}
            </button>
          ) : (
            <>
              <button type="button" disabled={Boolean(actionLoading)} onClick={() => action('/time/clock-out')} className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
                {actionLoading === '/time/clock-out' ? 'Clocking Out...' : 'Clock Out'}
              </button>

              {!isOnBreak ? (
                <button type="button" disabled={Boolean(actionLoading)} onClick={() => action('/time/break/start')} className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
                  {actionLoading === '/time/break/start' ? 'Starting Break...' : 'Start Break'}
                </button>
              ) : (
                <button type="button" disabled={Boolean(actionLoading)} onClick={() => action('/time/break/end')} className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
                  {actionLoading === '/time/break/end' ? 'Ending Break...' : 'End Break'}
                </button>
              )}
            </>
          )}

          <Link to="/time-off/new" className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white">Request Time Off</Link>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="lg:col-span-2 rounded-2xl bg-white p-5 shadow-sm border border-slate-100">
          <h3 className="font-semibold">Timesheet Overview</h3>
          {data?.chartData?.length ? (
            <div className="h-64 mt-4"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.chartData}><XAxis dataKey="date" /><YAxis /><Tooltip /><Bar dataKey="hours" fill="#4f46e5" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer></div>
          ) : (
            <div className="mt-4"><EmptyState title="No tracked hours yet" message="Clock in to start generating your timesheet chart." /></div>
          )}
        </section>

        <section className="space-y-4">
          <div className="rounded-2xl bg-white p-4 shadow-sm border border-slate-100">
            <h4 className="font-semibold">Upcoming Holidays</h4>
            {(data?.upcomingHolidays?.length ?? 0) > 0 ? data.upcomingHolidays.map((h) => <p key={h.id} className="text-sm mt-2 text-slate-600">{h.name} · {dayjs(h.holidayDate).format('MMM D, YYYY')}</p>) : <p className="text-sm mt-2 text-slate-500">No holidays configured.</p>}
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm border border-slate-100">
            <h4 className="font-semibold">Recent Activity</h4>
            {(data?.recentActivities?.length ?? 0) > 0 ? data.recentActivities.slice(0, 5).map((a) => <p key={a.id} className="text-sm mt-2 text-slate-600">{a.message}</p>) : <p className="text-sm mt-2 text-slate-500">No activity yet.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
