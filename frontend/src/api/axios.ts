import axios from 'axios';
import { useAuthStore, type AuthUser } from '../store/authStore';
import { languageStorageKey } from '../i18n';
import { normalizeLanguage } from '../lib/locale';

// In Docker: VITE_API_URL=/api (relative, same-origin through Nginx)
// In local dev: VITE_API_URL=http://localhost:4000/api
const API_URL = (import.meta.env['VITE_API_URL'] as string | undefined) ?? '/api';

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

// Attach JWT access token to every request
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  config.headers['Accept-Language'] = normalizeLanguage(
    typeof window === 'undefined' ? 'ru' : window.localStorage.getItem(languageStorageKey) ?? 'ru',
  );
  return config;
});

let refreshing: Promise<string | null> | null = null;

// Auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (error: unknown) => {
    if (!axios.isAxiosError(error)) return Promise.reject(error);
    const originalRequest = error.config as (typeof error.config & { _retry?: boolean }) | undefined;
    if (error.response?.status === 401 && originalRequest?.url?.includes('/auth/refresh')) {
      useAuthStore.getState().logout();
      return Promise.reject(error);
    }
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      if (!refreshing) {
        refreshing = axios.post<{ accessToken: string; user: AuthUser }>(`${API_URL}/auth/refresh`, undefined, { withCredentials: true })
          .then((r) => {
            useAuthStore.getState().setAuth(r.data.user, r.data.accessToken);
            return r.data.accessToken;
          })
          .catch(() => {
            useAuthStore.getState().logout();
            return null;
          })
          .finally(() => { refreshing = null; });
      }
      const token = await refreshing;
      if (token && originalRequest.headers) {
        originalRequest.headers['Authorization'] = `Bearer ${token}`;
        return api(originalRequest);
      }
    }
    return Promise.reject(error);
  }
);
