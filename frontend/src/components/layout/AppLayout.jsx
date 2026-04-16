import { Bell, Calendar, ClipboardList, Clock3, LogOut, Settings, Shield, Users } from 'lucide-react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import dayjs from 'dayjs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../api/client';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: Shield },
  { to: '/timesheets', label: 'Timesheets', icon: ClipboardList },
  { to: '/time-off', label: 'Time Off', icon: Calendar },
  { to: '/work-schedules', label: 'Work Schedules', icon: Clock3 },
  { to: '/holidays', label: 'Holidays', icon: Calendar },
  { to: '/team', label: 'Team', icon: Users },
  { to: '/settings', label: 'Settings', icon: Settings },
];

function formatDuration(totalSeconds) {
  const normalized = Math.max(0, totalSeconds || 0);
  const h = String(Math.floor(normalized / 3600)).padStart(2, '0');
  const m = String(Math.floor((normalized % 3600) / 60)).padStart(2, '0');
  const s = String(normalized % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function findActiveBreak(entry, payload) {
  const payloadBreak = payload?.activeBreak || payload?.active_break;
  if (payloadBreak) return payloadBreak;

  const breaks = entry?.breakEntries || entry?.breaks || [];
  return breaks.find((item) => !(item.breakEnd || item.break_end || item.endAt || item.end_at)) || null;
}

function normalizeEntryState(payload) {
  const entry = payload?.currentActiveEntry || payload?.current_active_entry || payload;
  if (!entry) return { currentEntry: null, activeBreak: null, timerMode: 'idle' };

  const clockIn = entry.clockIn || entry.clock_in || null;
  const clockOut = entry.clockOut || entry.clock_out || null;

  if (!clockIn || clockOut) return { currentEntry: null, activeBreak: null, timerMode: 'idle' };

  const activeBreak = findActiveBreak(entry, payload);
  const normalizedBreak = activeBreak
    ? {
      ...activeBreak,
      breakStart: activeBreak.breakStart || activeBreak.break_start,
      breakEnd: activeBreak.breakEnd || activeBreak.break_end,
    }
    : null;

  return {
    currentEntry: { ...entry, clockIn, clockOut },
    activeBreak: normalizedBreak,
    timerMode: normalizedBreak ? 'break' : 'tracking',
  };
}

export default function AppLayout() {
  const { user, logout } = useAuth();
  const [currentEntry, setCurrentEntry] = useState(null);
  const [activeBreak, setActiveBreak] = useState(null);
  const [timerMode, setTimerMode] = useState('idle');
  const [liveTimer, setLiveTimer] = useState('00:00:00');

  const fetchCurrentEntry = useCallback(async () => {
    try {
      const res = await api.get('/time/current');
      const nextState = normalizeEntryState(res.data);
      setCurrentEntry(nextState.currentEntry);
      setActiveBreak(nextState.activeBreak);
      setTimerMode(nextState.timerMode);
    } catch {
      setCurrentEntry(null);
      setActiveBreak(null);
      setTimerMode('idle');
    }
  }, []);

  useEffect(() => {
    fetchCurrentEntry();

    const onTrackingChanged = () => fetchCurrentEntry();
    window.addEventListener('timeflow:tracking-changed', onTrackingChanged);

    const pollId = setInterval(fetchCurrentEntry, 15000);
    return () => {
      clearInterval(pollId);
      window.removeEventListener('timeflow:tracking-changed', onTrackingChanged);
    };
  }, [fetchCurrentEntry]);

  useEffect(() => {
    const startAt = timerMode === 'break'
      ? (activeBreak?.breakStart || null)
      : (timerMode === 'tracking' ? currentEntry?.clockIn : null);

    if (!startAt) {
      setLiveTimer('00:00:00');
      return () => {};
    }

    const update = () => {
      const elapsed = dayjs().diff(dayjs(startAt), 'second');
      setLiveTimer(formatDuration(elapsed));
    };

    update();
    const timerId = setInterval(update, 1000);

    return () => clearInterval(timerId);
  }, [timerMode, currentEntry, activeBreak]);

  const timerColorClass = useMemo(() => {
    if (timerMode === 'tracking') return 'text-emerald-600';
    if (timerMode === 'break') return 'text-amber-500';
    return 'text-accent';
  }, [timerMode]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      <aside className="w-64 bg-white border-r p-5 hidden md:block">
        <h1 className="text-2xl font-bold text-accent">TimeFlow</h1>
        <p className="text-xs text-slate-500 mt-1">Workforce time intelligence</p>
        <nav className="mt-6 space-y-1">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => `flex items-center gap-2 p-2 rounded-lg ${isActive ? 'bg-indigo-50 text-accent font-medium' : 'hover:bg-slate-100'}`}>
              <item.icon size={16} /> {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="flex-1">
        <header className="h-16 bg-white border-b px-6 flex items-center justify-between">
          <div className="font-semibold">Live timer: <span className={timerColorClass}>{liveTimer}</span></div>
          <div className="flex items-center gap-4 text-sm">
            <span className="px-3 py-1 rounded-full bg-slate-100">{user?.company?.name || 'Company'}</span>
            <button type="button"><Bell size={18} /></button>
            <Link to="/profile" className="font-medium">{user?.name}</Link>
            <button type="button" onClick={logout} className="inline-flex items-center gap-1 text-red-500"><LogOut size={16} />Logout</button>
          </div>
        </header>
        <section className="p-6"><Outlet /></section>
      </main>
    </div>
  );
}
