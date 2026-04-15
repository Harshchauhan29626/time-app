import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';

export default function NewTimeOffPage() {
  const [types, setTypes] = useState([]);
  const [form, setForm] = useState({ timeOffTypeId: '', startDate: '', endDate: '', reason: '' });
  const nav = useNavigate();
  useEffect(() => { api.get('/time-off-types').then((res) => { setTypes(res.data); setForm((f) => ({ ...f, timeOffTypeId: res.data[0]?.id || '' })); }); }, []);

  const submit = async (e) => { e.preventDefault(); await api.post('/time-off-requests', form); nav('/time-off'); };
  return <form onSubmit={submit} className="bg-white p-5 rounded-xl shadow-sm max-w-xl space-y-3"><h2 className="text-xl font-semibold">New Leave Request</h2><select className="border rounded p-2 w-full" value={form.timeOffTypeId} onChange={(e)=>setForm({...form,timeOffTypeId:e.target.value})}>{types.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select><input type="date" className="border rounded p-2 w-full" onChange={(e)=>setForm({...form,startDate:e.target.value})}/><input type="date" className="border rounded p-2 w-full" onChange={(e)=>setForm({...form,endDate:e.target.value})}/><textarea className="border rounded p-2 w-full" placeholder="Reason" onChange={(e)=>setForm({...form,reason:e.target.value})}/><button className="bg-accent text-white px-3 py-2 rounded">Submit</button></form>;
}
