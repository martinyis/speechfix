import { useMemo } from 'react';
import type { PatternTasksResponse, WeakSpotsResponse } from '../types/practice';

export type PracticeModeName = 'weak_spots' | 'filler_words' | 'patterns';

export interface PracticeModeInfo {
  key: PracticeModeName;
  label: string;
  icon: string;
  enabled: boolean;
  stats: { total: number; remaining: number };
}

export function usePracticeModes(
  weakSpotsData: WeakSpotsResponse | undefined,
  patternData: PatternTasksResponse | undefined,
) {
  return useMemo(() => {
    const activeCount = weakSpotsData?.activeSpots.length ?? 0;
    const quickFixCount = weakSpotsData?.quickFixes.length ?? 0;
    const dueCount = weakSpotsData?.activeSpots.filter((ws) => ws.isDue).length ?? 0;

    const hasPatterns = !!(patternData?.active || (patternData?.queued && patternData.queued.length > 0));
    const patternTotal = patternData?.active?.exercises.length ?? 0;
    const patternRemaining = patternData?.active
      ? patternData.active.exercises.filter((e) => !e.practiced).length
      : 0;

    const modes: PracticeModeInfo[] = [
      {
        key: 'weak_spots',
        label: 'Weak Spots',
        icon: 'fitness-outline',
        enabled: activeCount > 0 || quickFixCount > 0,
        stats: { total: activeCount + quickFixCount, remaining: dueCount + quickFixCount },
      },
      {
        key: 'filler_words',
        label: 'Filler Words',
        icon: 'chatbubbles-outline',
        enabled: true,
        stats: { total: 0, remaining: 0 },
      },
      {
        key: 'patterns',
        label: 'Patterns',
        icon: 'repeat-outline',
        enabled: hasPatterns,
        stats: { total: patternTotal, remaining: patternRemaining },
      },
    ];

    const enabledModes = modes.filter((m) => m.enabled);

    const defaultMode: PracticeModeName =
      enabledModes.find((m) => m.key === 'weak_spots')?.key ??
      enabledModes[0]?.key ??
      'filler_words';

    return { modes, enabledModes, defaultMode };
  }, [weakSpotsData, patternData]);
}
