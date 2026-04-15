import api from '../api/client';
import { useAuthStore } from '../context/authStore';

export function useAuth() {
  const store = useAuthStore();

  const login = async (payload) => {
    const { data } = await api.post('/auth/login', payload);
    store.setAuth(data);
  };

  const register = async (payload) => {
    const { data } = await api.post('/auth/register', payload);
    store.setAuth(data);
  };

  const logout = async () => {
    await api.post('/auth/logout', { refreshToken: store.refreshToken });
    store.logout();
  };

  const loadMe = async () => {
    if (!store.accessToken) return;
    const { data } = await api.get('/me');
    store.setAuth({ ...store, user: data });
  };

  return { ...store, login, register, logout, loadMe };
}
