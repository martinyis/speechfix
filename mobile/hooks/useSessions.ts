import { useQuery } from '@tanstack/react-query';
import { authFetch } from '../lib/api';
import { SessionListItem } from '../types/session';

export function useSessions() {
  return useQuery({
    queryKey: ['sessions'],
    queryFn: async (): Promise<SessionListItem[]> => {
      const res = await authFetch('/sessions');
      if (!res.ok) throw new Error('Failed to fetch sessions');
      const data = await res.json();
      return data.sessions;
    },
  });
}
