import { useQuery } from '@tanstack/react-query';
import { authFetch } from '../../lib/api';
import type { Agent } from '../../types/session';

export function useAgents() {
  return useQuery({
    queryKey: ['agents'],
    queryFn: async (): Promise<Agent[]> => {
      const res = await authFetch('/agents');
      if (!res.ok) throw new Error('Failed to fetch agents');
      const data = await res.json();
      return data.agents;
    },
  });
}
