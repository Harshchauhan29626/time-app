import { Bell, Calendar, ClipboardList, Clock3, LogOut, Settings, Shield, Users } from 'lucide-react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
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

export default function AppLayout() {
  const { user, logout } = useAuth();
  const [now, setNow] = useState(dayjs());
  const [current, setCurrent] = useState(null);

  useEffect(() => {
    const i = setInterval(() => setNow(dayjs()), 1000);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    api.get('/time/current').then((res) => setCurrent(res.data)).catch(() => {});
  }, []);

  const timer = useMemo(() => {
    if (!current) return 'Not tracking';
    const seconds = now.diff(dayjs(current.clockIn), 'second');
    const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
    const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
    const s = String(seconds % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
  }, [current, now]);

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
          <div className="font-semibold">Live timer: <span className="text-accent">{timer}</span></div>
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
