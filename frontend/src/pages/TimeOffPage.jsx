import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import dayjs from 'dayjs';

export default function TimeOffPage() {
  const [rows, setRows] = useState([]);
  useEffect(() => { api.get('/time-off-requests').then((res) => setRows(res.data)); }, []);
  return <div className="bg-white p-5 rounded-xl shadow-sm"><div className="flex justify-between"><h2 className="text-xl font-semibold">Time Off Requests</h2><Link to="/time-off/new" className="bg-accent text-white px-3 py-2 rounded">Request Leave</Link></div><div className="mt-4 space-y-2">{rows.map((r)=><div key={r.id} className="border rounded p-3 text-sm">{r.user.name} · {r.timeOffType.name} · {dayjs(r.startDate).format('MMM D')} - {dayjs(r.endDate).format('MMM D')} · <span className="capitalize">{r.status}</span></div>)}</div></div>;
}
