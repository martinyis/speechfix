import { Platform } from 'react-native';
import { useAuthStore } from '../stores/authStore';

const DEV_MACHINE_IP = '10.183.25.195';

export const API_BASE_URL = __DEV__
  ? Platform.OS === 'ios'
    ? `http://${DEV_MACHINE_IP}:3005`
    : 'http://10.0.2.2:3005'
  : 'https://api.example.com';

export const WS_BASE_URL = __DEV__
  ? Platform.OS === 'ios'
    ? `ws://${DEV_MACHINE_IP}:3005`
    : 'ws://10.0.2.2:3005'
  : 'wss://api.example.com';

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
