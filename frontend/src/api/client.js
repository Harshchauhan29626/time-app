import axios from 'axios';
import { useAuthStore } from '../context/authStore';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api' });

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry && useAuthStore.getState().refreshToken) {
      original._retry = true;
      try {
        const { refreshToken } = useAuthStore.getState();
        const res = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:4000/api'}/auth/refresh`, { refreshToken });
        useAuthStore.getState().setAccessToken(res.data.accessToken);
        original.headers.Authorization = `Bearer ${res.data.accessToken}`;
        return api(original);
      } catch {
        useAuthStore.getState().logout();
      }
    }
    return Promise.reject(error);
  },
);

export default api;
