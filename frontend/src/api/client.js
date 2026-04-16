import axios from 'axios';
import { useAuthStore } from '../context/authStore';

const DEFAULT_API_URL = 'http://localhost:5000/api';

function resolveApiUrl() {
  const configured = import.meta.env.VITE_API_URL?.trim();
  if (!configured) return DEFAULT_API_URL;

  if (configured.includes('localhost:5173') || configured.includes('localhost:5174')) {
    return DEFAULT_API_URL;
  }

  return configured;
}

const BASE_URL = resolveApiUrl();

function getTokenFromStorage() {
  try {
    const raw = localStorage.getItem('timeflow-auth');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.state?.accessToken || null;
  } catch {
    return null;
  }
}

const api = axios.create({ baseURL: BASE_URL });

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken || getTokenFromStorage();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && !original?._retry && useAuthStore.getState().refreshToken) {
      original._retry = true;
      try {
        const { refreshToken } = useAuthStore.getState();
        const refreshRes = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
        useAuthStore.getState().setAccessToken(refreshRes.data.accessToken);
        original.headers.Authorization = `Bearer ${refreshRes.data.accessToken}`;
        return api(original);
      } catch {
        useAuthStore.getState().logout();
      }
    }

    return Promise.reject(error);
  },
);

export default api;
