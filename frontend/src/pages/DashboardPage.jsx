import { useCallback, useEffect, useState } from 'react';
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import api from '../api/client';
import { useAuth } from '../hooks/useAuth';
import dayjs from 'dayjs';

export default function DashboardPage() {
  const [range, setRange] = useState('week');
  const [data, setData] = useState(null);
  const [currentEntry, setCurrentEntry] = useState(null);
  const { user } = useAuth();

  const load = useCallback(() => api.get(`/dashboard/summary?range=${range}`).then((res) => { setData(res.data); setCurrentEntry(res.data.currentActiveEntry); }), [range]);

  useEffect(() => { load(); }, [load]);

  const act = async (path) => { await api.post(path); await load(); };

  if (!data) return <p>Loading dashboard...</p>;

  const cards = [
    { label: 'Worked Hours', value: (data.workedMinutes / 60).toFixed(2) },
    { label: 'Break Hours', value: (data.breakMinutes / 60).toFixed(2) },
    { label: 'Overtime Hours', value: (data.overtimeMinutes / 60).toFixed(2) },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Welcome back, {user?.name}</h2>
        <div className="space-x-2">{['day', 'week', 'month'].map((r) => <button key={r} onClick={() => setRange(r)} className={`px-3 py-1 rounded ${range === r ? 'bg-accent text-white' : 'bg-white border'}`}>{r}</button>)}</div>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm flex flex-wrap gap-2 items-center">
        <p className="font-medium mr-2">Time Tracking:</p>
        <button onClick={() => act('/time/clock-in')} className="bg-emerald-600 text-white px-3 py-1 rounded disabled:opacity-40" disabled={!!currentEntry}>Clock In</button>
        <button onClick={() => act('/time/clock-out')} className="bg-rose-600 text-white px-3 py-1 rounded disabled:opacity-40" disabled={!currentEntry}>Clock Out</button>
        <button onClick={() => act('/time/break/start')} className="bg-amber-500 text-white px-3 py-1 rounded disabled:opacity-40" disabled={!currentEntry}>Start Break</button>
        <button onClick={() => act('/time/break/end')} className="bg-sky-600 text-white px-3 py-1 rounded disabled:opacity-40" disabled={!currentEntry}>End Break</button>
        <span className="text-sm text-slate-500">{currentEntry ? `Active since ${dayjs(currentEntry.clockIn).format('HH:mm')}` : 'No active entry'}</span>
      </div>

      <div className="grid md:grid-cols-3 gap-4">{cards.map((c) => <div key={c.label} className="bg-white p-5 rounded-xl shadow-sm"><p className="text-slate-500 text-sm">{c.label}</p><p className="text-2xl font-bold mt-2">{c.value}</p></div>)}</div>
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white p-5 rounded-xl shadow-sm">
          <h3 className="font-semibold mb-3">Tracked hours trend</h3>
          <div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.chartData}><XAxis dataKey="date" /><YAxis /><Tooltip /><Bar dataKey="hours" fill="#4f46e5" /></BarChart></ResponsiveContainer></div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm space-y-4">
          <div><h4 className="font-semibold">Upcoming Holidays</h4>{data.upcomingHolidays.map((h) => <p key={h.id} className="text-sm mt-1">{h.name} · {dayjs(h.holidayDate).format('MMM D')}</p>)}</div>
          <div><h4 className="font-semibold">Approved Time Off</h4>{data.upcomingTimeOff.map((t) => <p key={t.id} className="text-sm mt-1">{t.user.name} · {dayjs(t.startDate).format('MMM D')}</p>)}</div>
          <div><h4 className="font-semibold">Recent Activities</h4>{data.recentActivities.slice(0, 5).map((a) => <p key={a.id} className="text-sm mt-1">{a.message}</p>)}</div>
        </div>
      </div>
    </div>
  );
}
