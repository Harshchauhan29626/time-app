import { useEffect, useState } from 'react';
import api from '../api/client';

export default function SettingsPage() {
  const [settings, setSettings] = useState(null);
  useEffect(() => { api.get('/settings').then((res) => setSettings(res.data)); }, []);
  if (!settings) return <p>Loading settings...</p>;
  const save = async () => { const { data } = await api.patch('/settings', settings); setSettings(data); };
  return <div className="bg-white p-5 rounded-xl shadow-sm max-w-xl"><h2 className="text-xl font-semibold">Company Settings</h2><input className="border rounded p-2 w-full mt-3" value={settings.name} onChange={(e)=>setSettings({...settings,name:e.target.value})}/><input className="border rounded p-2 w-full mt-3" value={settings.timezone} onChange={(e)=>setSettings({...settings,timezone:e.target.value})}/><label className="mt-3 block"><input type="checkbox" checked readOnly /> Notifications placeholder</label><button onClick={save} className="mt-4 bg-accent text-white px-3 py-2 rounded">Save</button></div>;
}
