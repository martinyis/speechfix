import { useQuery } from '@tanstack/react-query';
import { authFetch } from '../../lib/api';
import type { DeepInsight } from '../../types/session';

/**
 * Fetch deep insights for a session.
 *
 * Pass `generate: true` to trigger a one-off LLM backfill on the server
 * (~10s, Opus) — only when the user explicitly asked for it.
 *
 * Pass `polling: true` for freshly-completed sessions. The deep-insights
 * generator runs fire-and-forget on the server after `analysis_complete`,
 * and the WS gets closed client-side before it finishes. Polling the REST
 * endpoint every few seconds is how the client picks up the result.
 *
 * Stops polling as soon as a non-empty array is returned.
 */
export function useDeepInsights(
  sessionId: number | null,
  options: { generate?: boolean; polling?: boolean } = {},
) {
  const { generate, polling } = options;
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
    staleTime: polling ? 0 : 5 * 60 * 1000,
    refetchInterval: polling
      ? (query) => {
          const data = query.state.data as DeepInsight[] | null | undefined;
          // Stop polling the moment any non-empty array lands.
          if (data && data.length > 0) return false;
          return 3000;
        }
      : false,
  });
}
