import { useQuery } from '@tanstack/react-query';
import { authFetch } from '../../lib/api';

export interface MasteredPattern {
  patternId: number;
  type: string;
  identifier: string | null;
  description: string | null;
  originalDescription: string | null;
  masteredAt: string | null;
  wasReturning: boolean;
  lastRegressedAt: string | null;
  // Optional timestamps — backend may or may not emit these; render gracefully.
  createdAt?: string | null;
  completedAt?: string | null;
  enteredWatchingAt?: string | null;
  priorMasteringsCount?: number;
}

export interface MasteredPatternsResponse {
  patterns: MasteredPattern[];
}

export function useMasteredPatterns() {
  return useQuery({
    queryKey: ['mastered-patterns'],
    queryFn: async (): Promise<MasteredPatternsResponse> => {
      const res = await authFetch('/practice/patterns/mastered');
      if (!res.ok) throw new Error('Failed to fetch mastered patterns');
      return res.json();
    },
    refetchOnMount: 'always',
  });
}
