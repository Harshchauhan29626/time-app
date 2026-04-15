import { useEffect, useState } from 'react';
import api from '../api/client';
import dayjs from 'dayjs';

export default function HolidaysPage() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ name: '', holidayDate: '', type: 'public' });
  const load = () => api.get('/holidays').then((res) => setRows(res.data));
  useEffect(load, []);
  const add = async () => { await api.post('/holidays', form); setForm({ name: '', holidayDate: '', type: 'public' }); load(); };

  return <div className="bg-white p-5 rounded-xl shadow-sm"><h2 className="text-xl font-semibold">Holidays</h2><div className="mt-3 grid md:grid-cols-4 gap-2"><input className="border p-2 rounded" placeholder="Name" value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})}/><input type="date" className="border p-2 rounded" value={form.holidayDate} onChange={(e)=>setForm({...form,holidayDate:e.target.value})}/><input className="border p-2 rounded" value={form.type} onChange={(e)=>setForm({...form,type:e.target.value})}/><button onClick={add} className="bg-accent text-white rounded">Add</button></div><div className="mt-4 space-y-2">{rows.map((h)=><div key={h.id} className="border rounded p-3">{h.name} · {dayjs(h.holidayDate).format('MMM D, YYYY')} · {h.type}</div>)}</div></div>;
}
