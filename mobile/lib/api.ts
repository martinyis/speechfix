import { useAuthStore } from '../stores/authStore';
import { API_BASE_URL, WS_BASE_URL } from './config';

export { API_BASE_URL, WS_BASE_URL };

export async function authFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = useAuthStore.getState().token;
  const headers = new Headers(options.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });

  if (res.status === 401) {
    await useAuthStore.getState().clearAuth();
  }

  return res;
}

export function wsUrl(path: string): string {
  const token = useAuthStore.getState().token;
  return `${WS_BASE_URL}${path}?token=${encodeURIComponent(token ?? '')}`;
}

export const api = {
  baseUrl: API_BASE_URL,
};
