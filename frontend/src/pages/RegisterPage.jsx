import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ companyName: '', name: '', email: '', password: '', timezone: 'UTC' });
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    try {
      await register(form);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-slate-100 p-4">
      <form onSubmit={submit} className="bg-white p-8 rounded-2xl w-full max-w-lg shadow">
        <h1 className="text-2xl font-bold">Create your TimeFlow workspace</h1>
        {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
        {['companyName', 'name', 'email', 'password', 'timezone'].map((key) => (
          <input key={key} type={key === 'password' ? 'password' : 'text'} className="mt-3 w-full border p-2 rounded" placeholder={key} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
        ))}
        <button className="mt-4 w-full bg-accent text-white rounded p-2">Register</button>
        <p className="mt-4 text-sm">Already have account? <Link className="text-accent" to="/login">Login</Link></p>
      </form>
    </div>
  );
}
