import { useQuery } from '@tanstack/react-query';
import { authFetch } from '../../lib/api';
import type { DeepInsight } from '../../types/session';

/**
 * Fetch deep insights for a historical session.
 *
 * Returns `null` when the server has no insights stored (pre-migration
 * sessions). Pass `generate: true` to trigger a one-off backfill on the
 * server — expensive, ~10s LLM call, use only when the user asked for it.
 */
export function useDeepInsights(sessionId: number | null, options: { generate?: boolean } = {}) {
  const { generate } = options;
  return useQuery({
    queryKey: ['deep-insights', sessionId, generate ? 'generate' : 'stored'],
    queryFn: async (): Promise<DeepInsight[] | null> => {
      const qs = generate ? '?generate=1' : '';
      const res = await authFetch(`/sessions/${sessionId}/deep-insights${qs}`);
      if (!res.ok) throw new Error('Failed to fetch deep insights');
      const data = await res.json();
      return (data?.insights as DeepInsight[] | null) ?? null;
    },
    enabled: sessionId !== null,
    staleTime: 5 * 60 * 1000,
  });
}
