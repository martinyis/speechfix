import { useQuery } from '@tanstack/react-query';
import { authFetch } from '../lib/api';
import type { FillerSummary } from '../types/session';

export function useFillerSummary() {
  return useQuery({
    queryKey: ['filler-summary'],
    queryFn: async (): Promise<FillerSummary> => {
      const res = await authFetch('/filler-summary');
      if (!res.ok) throw new Error('Failed to fetch filler summary');
      return res.json();
    },
  });
}
