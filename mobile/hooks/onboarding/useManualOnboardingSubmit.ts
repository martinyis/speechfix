import { useCallback, useState } from 'react';
import { router } from 'expo-router';
import { authFetch } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { useOnboardingStore } from '../../stores/onboardingStore';

export type EnglishLevel = 'native' | 'advanced' | 'intermediate' | 'beginner';

export interface ManualOnboardingPayload {
  name: string;
  context: string;
  goals: string[];
  englishLevel: EnglishLevel;
}

export function useManualOnboardingSubmit() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(
    async (payload: ManualOnboardingPayload): Promise<boolean> => {
      setError(null);
      setIsSubmitting(true);
      try {
        const res = await authFetch('/onboarding/manual', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data?.error ?? 'Could not save your answers. Please try again.');
          return false;
        }

        useOnboardingStore.getState().reset();
        useAuthStore.getState().setOnboardingComplete();
        useAuthStore.getState().setSigningUp(false);
        router.replace('/(tabs)');
        return true;
      } catch {
        setError('Network error. Check your connection and try again.');
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [],
  );

  return { submit, isSubmitting, error };
}
