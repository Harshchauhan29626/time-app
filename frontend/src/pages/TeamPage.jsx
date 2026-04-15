import { useEffect, useState } from 'react';
import api from '../api/client';

export default function TeamPage() {
  const [rows, setRows] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [form, setForm] = useState({ name: '', email: '', password: 'Password123!', role: 'employee', workScheduleId: '' });
  const load = () => api.get('/team').then((res) => setRows(res.data));
  useEffect(() => { load(); api.get('/work-schedules').then((res) => { setSchedules(res.data); setForm((f)=>({ ...f, workScheduleId: res.data[0]?.id || '' })); }); }, []);

  const add = async () => { await api.post('/team', form); load(); };

  return <div className="bg-white p-5 rounded-xl shadow-sm"><h2 className="text-xl font-semibold">Team</h2><div className="grid md:grid-cols-5 gap-2 mt-3">{['name','email','password'].map(k=><input key={k} className="border p-2 rounded" placeholder={k} value={form[k]} onChange={(e)=>setForm({...form,[k]:e.target.value})}/>)}<select className="border p-2 rounded" value={form.role} onChange={(e)=>setForm({...form,role:e.target.value})}><option value="employee">employee</option><option value="manager">manager</option></select><select className="border p-2 rounded" value={form.workScheduleId} onChange={(e)=>setForm({...form,workScheduleId:e.target.value})}>{schedules.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select><button onClick={add} className="bg-accent text-white rounded">Create</button></div><div className="mt-4 space-y-2">{rows.map((u)=><div key={u.id} className="border rounded p-3">{u.name} · {u.email} · {u.role}</div>)}</div></div>;
}
