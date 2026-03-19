import { useQuery } from '@tanstack/react-query';
import { API_BASE_URL } from '../lib/api';
import { SessionDetail } from '../types/session';

export function useSession(sessionId: number | null) {
  return useQuery({
    queryKey: ['session', sessionId],
    queryFn: async (): Promise<SessionDetail> => {
      const res = await fetch(`${API_BASE_URL}/sessions/${sessionId}`);
      if (!res.ok) throw new Error('Failed to fetch session');
      const data = await res.json();
      return data.session;
    },
    enabled: sessionId !== null,
  });
}
