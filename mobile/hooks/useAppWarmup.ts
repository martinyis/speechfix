import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { authFetch } from '../lib/api';

const MIN_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export function useAppWarmup() {
  const lastWarmupRef = useRef(0);

  useEffect(() => {
    const warmup = async () => {
      const now = Date.now();
      if (now - lastWarmupRef.current < MIN_INTERVAL_MS) return;
      lastWarmupRef.current = now;

      try {
        await authFetch('/greetings/warmup', { method: 'POST' });
      } catch (err) {
        console.warn('[warmup] Failed:', err);
      }
    };

    // Warmup on mount (app launch)
    warmup();

    // Warmup on app foreground
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') warmup();
    });

    return () => sub.remove();
  }, []);
}
