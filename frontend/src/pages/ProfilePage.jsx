import { useEffect, useState } from 'react';
import api from '../api/client';

export default function ProfilePage() {
  const [user, setUser] = useState(null);
  useEffect(() => { api.get('/me').then((res) => setUser(res.data)); }, []);
  if (!user) return <p>Loading profile...</p>;
  const save = async () => { const { data } = await api.patch('/me', { name: user.name, timezone: user.timezone }); setUser((u) => ({ ...u, ...data })); };
  return <div className="bg-white p-5 rounded-xl shadow-sm max-w-xl"><h2 className="text-xl font-semibold">Profile</h2><div className="mt-3 h-16 w-16 rounded-full bg-slate-200 grid place-items-center">{user.name[0]}</div><input className="border rounded p-2 w-full mt-3" value={user.name} onChange={(e)=>setUser({...user,name:e.target.value})}/><input className="border rounded p-2 w-full mt-3" value={user.email} readOnly/><input className="border rounded p-2 w-full mt-3" value={user.timezone} onChange={(e)=>setUser({...user,timezone:e.target.value})}/><button onClick={save} className="mt-4 bg-accent text-white px-3 py-2 rounded">Save</button></div>;
}
