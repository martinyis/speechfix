import { useMemo } from 'react';
import type { PracticeTask, PatternTasksResponse } from '../types/practice';

export type PracticeModeName = 'corrections' | 'filler_words' | 'patterns';

export interface PracticeModeInfo {
  key: PracticeModeName;
  label: string;
  icon: string;
  enabled: boolean;
  stats: { total: number; remaining: number };
}

export function usePracticeModes(
  tasks: PracticeTask[] | undefined,
  patternData: PatternTasksResponse | undefined,
) {
  return useMemo(() => {
    const correctionTotal = tasks?.length ?? 0;
    const unpracticedTasks = tasks?.filter((t) => !t.practiced) ?? [];
    const correctionRemaining = unpracticedTasks.length;

    // Severity counts for hero stat
    const severityCounts: Record<string, number> = {};
    for (const t of unpracticedTasks) {
      severityCounts[t.severity] = (severityCounts[t.severity] ?? 0) + 1;
    }

    const hasPatterns = !!(patternData?.active || (patternData?.queued && patternData.queued.length > 0));
    const patternTotal = patternData?.active?.exercises.length ?? 0;
    const patternRemaining = patternData?.active
      ? patternData.active.exercises.filter((e) => !e.practiced).length
      : 0;

    const modes: PracticeModeInfo[] = [
      {
        key: 'corrections',
        label: 'Corrections',
        icon: 'create-outline',
        enabled: correctionTotal > 0,
        stats: { total: correctionTotal, remaining: correctionRemaining },
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
      enabledModes.find((m) => m.key === 'corrections')?.key ??
      enabledModes[0]?.key ??
      'filler_words';

    return { modes, enabledModes, defaultMode, severityCounts };
  }, [tasks, patternData]);
}
