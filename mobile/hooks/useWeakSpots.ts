import { useQuery } from '@tanstack/react-query';
import { authFetch } from '../lib/api';
import type { WeakSpotsResponse } from '../types/practice';

export function useWeakSpots() {
  return useQuery({
    queryKey: ['weak-spots'],
    queryFn: async (): Promise<WeakSpotsResponse> => {
      const res = await authFetch('/practice/weak-spots');
      if (!res.ok) throw new Error('Failed to fetch weak spots');
      return res.json();
    },
    refetchOnMount: 'always',
  });
}
