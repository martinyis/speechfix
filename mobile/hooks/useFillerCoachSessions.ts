import { useQuery } from '@tanstack/react-query';
import { authFetch } from '../lib/api';
import type { FillerCoachSession } from '../types/session';

export function useFillerCoachSessions() {
  return useQuery({
    queryKey: ['filler-coach-sessions'],
    queryFn: async (): Promise<FillerCoachSession[]> => {
      const res = await authFetch('/filler-coach/sessions');
      if (!res.ok) throw new Error('Failed to fetch filler coach sessions');
      const data = await res.json();
      return data.sessions;
    },
  });
}
