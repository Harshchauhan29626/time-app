import { useEffect, useState } from 'react';
import api from '../api/client';

export default function WorkSchedulesPage() {
  const [rows, setRows] = useState([]);
  const [name, setName] = useState('');

  const load = () => api.get('/work-schedules').then((res) => setRows(res.data));
  useEffect(load, []);

  const add = async () => {
    await api.post('/work-schedules', { name, startTime: '09:00', endTime: '17:00', breakMinutes: 60, weeklyHours: 40, days: [1,2,3,4,5].map((d)=>({weekday:d, scheduledMinutes:480})) });
    setName('');
    load();
  };

  return <div className="bg-white p-5 rounded-xl shadow-sm"><h2 className="text-xl font-semibold">Work Schedules</h2><div className="mt-3 flex gap-2"><input className="border rounded p-2" value={name} onChange={(e)=>setName(e.target.value)} placeholder="Schedule name"/><button onClick={add} className="bg-accent text-white px-3 rounded">Add</button></div><div className="mt-4 space-y-2">{rows.map((r)=><div key={r.id} className="border rounded p-3">{r.name} · {r.startTime}-{r.endTime} · {r.weeklyHours}h/wk</div>)}</div></div>;
}
