import { useQuery } from '@tanstack/react-query';
import { authFetch } from '../lib/api';
import type { FillerCoachStats } from '../types/session';

export function useFillerCoachStats() {
  return useQuery({
    queryKey: ['filler-coach-stats'],
    queryFn: async (): Promise<FillerCoachStats> => {
      const res = await authFetch('/filler-coach/stats');
      if (!res.ok) throw new Error('Failed to fetch filler coach stats');
      return res.json();
    },
  });
}
