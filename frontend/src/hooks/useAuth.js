import { useCallback } from 'react';
import api from '../api/client';
import { useAuthStore } from '../context/authStore';

function normalizeAuthPayload(data) {
  return {
    user: data.user,
    accessToken: data.accessToken || data.token,
    refreshToken: data.refreshToken,
  };
}

export function useAuth() {
  const store = useAuthStore();

  const login = async (payload) => {
    const { data } = await api.post('/auth/login', payload);
    store.setAuth(normalizeAuthPayload(data));
  };

  const register = async (payload) => {
    const { data } = await api.post('/auth/register', payload);
    store.setAuth(normalizeAuthPayload(data));
  };

  const logout = async () => {
    if (store.refreshToken) {
      await api.post('/auth/logout', { refreshToken: store.refreshToken });
    }
    store.logout();
  };

  const loadMe = useCallback(async () => {
    if (!store.accessToken) return;
    const { data } = await api.get('/me');
    store.setUser(data);
  }, [store]);

  return { ...store, login, register, logout, loadMe };
}
