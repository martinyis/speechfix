import { useQuery } from '@tanstack/react-query';
import { authFetch } from '../../lib/api';
import type { PressureDrillSession } from '../../types/pressureDrill';

export function usePressureDrillSessions() {
  return useQuery({
    queryKey: ['pressure-drill-sessions'],
    queryFn: async (): Promise<PressureDrillSession[]> => {
      const res = await authFetch('/pressure-drill/sessions');
      if (!res.ok) throw new Error('Failed to fetch pressure drill sessions');
      const data = await res.json();
      return data.sessions as PressureDrillSession[];
    },
  });
}
