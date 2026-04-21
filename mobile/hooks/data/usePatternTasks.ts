import { useQuery } from '@tanstack/react-query';
import { authFetch } from '../../lib/api';
import type { PatternTasksResponse } from '../../types/practice';

export function usePatternTasks() {
  return useQuery({
    queryKey: ['pattern-tasks'],
    queryFn: async (): Promise<PatternTasksResponse> => {
      const res = await authFetch('/practice/pattern-tasks');
      if (!res.ok) throw new Error('Failed to fetch pattern tasks');
      return res.json();
    },
  });
}
