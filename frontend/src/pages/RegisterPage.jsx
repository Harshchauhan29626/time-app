import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

function getApiError(error) {
  if (error?.response?.data?.errors) {
    const fields = Object.values(error.response.data.errors).flat().filter(Boolean);
    if (fields.length) return fields.join(' ');
  }
  return error?.response?.data?.message || 'Registration failed';
}

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    companyName: '',
    name: '',
    email: '',
    password: '',
    timezone: 'UTC',
  });
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await register(form);
      navigate('/dashboard');
    } catch (err) {
      setError(getApiError(err));
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-slate-100 p-4">
      <form onSubmit={submit} className="bg-white p-8 rounded-2xl w-full max-w-lg shadow">
        <h1 className="text-2xl font-bold">Create your TimeFlow workspace</h1>
        {error && <p className="text-red-600 text-sm mt-3">{error}</p>}

        <input className="mt-3 w-full border p-2 rounded" placeholder="Company name" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} />
        <input className="mt-3 w-full border p-2 rounded" placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input type="email" className="mt-3 w-full border p-2 rounded" placeholder="Work email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input type="password" className="mt-3 w-full border p-2 rounded" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <input className="mt-3 w-full border p-2 rounded" placeholder="Timezone (e.g. UTC)" value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} />

        <button className="mt-4 w-full bg-accent text-white rounded p-2">Register</button>
        <p className="mt-4 text-sm">
          Already have account? <Link className="text-accent" to="/login">Login</Link>
        </p>
      </form>
    </div>
  );
}
