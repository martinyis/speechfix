import { useQuery } from '@tanstack/react-query';
import { authFetch } from '../lib/api';
import type { PracticeTask } from '../types/practice';

export function usePracticeTasks() {
  return useQuery({
    queryKey: ['practice-tasks'],
    queryFn: async (): Promise<PracticeTask[]> => {
      const res = await authFetch('/practice/tasks');
      if (!res.ok) throw new Error('Failed to fetch practice tasks');
      const data = await res.json();
      return data.tasks;
    },
    refetchOnMount: 'always',
  });
}
