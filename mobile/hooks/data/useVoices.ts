import { useQuery } from '@tanstack/react-query';
import { authFetch } from '../../lib/api';
import type { Voice } from '../../types/session';

export function useVoices() {
  return useQuery({
    queryKey: ['voices'],
    queryFn: async (): Promise<Voice[]> => {
      const res = await authFetch('/voices');
      if (!res.ok) throw new Error('Failed to fetch voices');
      const data = await res.json();
      return data.voices;
    },
    staleTime: Infinity,
  });
}
