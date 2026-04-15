import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

function getApiError(error) {
  if (error?.response?.data?.errors) {
    const fields = Object.values(error.response.data.errors).flat().filter(Boolean);
    if (fields.length) return fields.join(' ');
  }
  return error?.response?.data?.message || 'Login failed';
}

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await login(form);
      navigate('/dashboard');
    } catch (err) {
      setError(getApiError(err));
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-slate-100 p-4">
      <form onSubmit={submit} className="bg-white p-8 rounded-2xl w-full max-w-md shadow">
        <h1 className="text-2xl font-bold">Sign in to TimeFlow</h1>
        <p className="text-sm text-slate-500 mt-1">Track work, breaks, and leave in one place.</p>
        {error && <p className="text-red-600 text-sm mt-3">{error}</p>}
        <input type="email" className="mt-4 w-full border p-2 rounded" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input type="password" className="mt-3 w-full border p-2 rounded" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <button className="mt-4 w-full bg-accent text-white rounded p-2">Login</button>
        <p className="mt-4 text-sm">New company? <Link className="text-accent" to="/register">Register</Link></p>
      </form>
    </div>
  );
}
