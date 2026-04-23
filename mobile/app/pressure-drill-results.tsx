import { useMemo } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { SuccessScreen } from '../components/success';
import { SCENARIOS } from '../lib/pressureDrillScenarios';
import { usePressureDrillSessions } from '../hooks/data/usePressureDrillSessions';
import type { PressureDrillSession } from '../types/pressureDrill';
import { colors } from '../theme';

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function fillersPerMin(totalFillers: number, durationSeconds: number): number {
  const mins = Math.max(durationSeconds / 60, 0.5);
  return Number((totalFillers / mins).toFixed(1));
}

function rateColor(rate: number): string {
  if (rate <= 1.5) return colors.severityPolish;
  if (rate <= 3.0) return colors.secondary;
  return colors.error;
}

function rateTone(rate: number): 'polish' | 'calm' | 'neutral' {
  if (rate <= 1.5) return 'polish';
  if (rate <= 3.0) return 'calm';
  return 'neutral';
}

function deltaFromPrevious(
  current: PressureDrillSession,
  all: PressureDrillSession[] | undefined,
): { value: number; prev: number } | null {
  if (!all || all.length < 2) return null;
  // Find the most recent session with the same durationSelectedSeconds that is NOT this one.
  const prevSameDuration = all.find(
    (s) => s.id !== current.id && s.durationSelectedSeconds === current.durationSelectedSeconds,
  );
  if (!prevSameDuration) return null;
  const prevRate = fillersPerMin(prevSameDuration.totalFillerCount, prevSameDuration.durationSeconds);
  const curRate = fillersPerMin(current.totalFillerCount, current.durationSeconds);
  return { value: Number((curRate - prevRate).toFixed(1)), prev: prevRate };
}

export default function PressureDrillResultsScreen() {
  const { sessionId, scenarioSlug: scenarioSlugParam } = useLocalSearchParams<{
    sessionId?: string;
    fresh?: string;
    scenarioSlug?: string;
  }>();
  const queryClient = useQueryClient();

  const id = Number(sessionId) || 0;
  const { data: allSessions } = usePressureDrillSessions();

  const session: PressureDrillSession | undefined = useMemo(
    () => allSessions?.find((s) => s.id === id),
    [allSessions, id],
  );

  const scenario = useMemo(() => {
    const slug = session?.scenarioSlug ?? scenarioSlugParam ?? 'pitch_idea';
    return SCENARIOS.find((s) => s.slug === slug) ?? SCENARIOS[0];
  }, [session?.scenarioSlug, scenarioSlugParam]);

  const handleDone = () => {
    queryClient.invalidateQueries({ queryKey: ['pressure-drill-sessions'] });
    queryClient.invalidateQueries({ queryKey: ['filler-summary'] });
    router.replace('/(tabs)/practice');
  };

  const handleAgain = () => {
    router.replace('/pressure-drill');
  };

  if (!session) {
    // Brief loading / empty state — SuccessScreen still wants a title.
    return (
      <SuccessScreen
        headerTitle="Pressure Drill"
        onBack={handleDone}
        eyebrow="Pressure Drill"
        title="Loading"
        tone="neutral"
        actions={[{ label: 'Done', variant: 'primary', onPress: handleDone, icon: 'checkmark' }]}
      />
    );
  }

  const totalFillers = session.totalFillerCount;
  const rate = fillersPerMin(totalFillers, session.durationSeconds);
  const rateCol = rateColor(rate);
  const tone = rateTone(rate);

  const delta = deltaFromPrevious(session, allSessions);

  const isClean = totalFillers === 0;

  return (
    <SuccessScreen
      headerTitle="Pressure Drill"
      onBack={handleDone}
      eyebrow={scenario.label.toUpperCase()}
      title={isClean ? 'Clean Run' : 'Drill Complete'}
      tone={tone}
      heroMetric={
        isClean
          ? undefined
          : {
              value: rate,
              unit: 'fillers / min',
              color: rateCol,
              delta:
                delta !== null
                  ? {
                      value: `${Math.abs(delta.value)}/min`,
                      direction: delta.value <= 0 ? 'down' : 'up',
                      good: delta.value <= 0,
                      caption: 'vs last',
                    }
                  : undefined,
            }
      }
      stats={[{ label: 'Duration', value: formatDuration(session.durationSeconds) }]}
      actions={[
        { label: 'Again', icon: 'refresh', variant: 'secondary', onPress: handleAgain },
        { label: 'Done', icon: 'checkmark', variant: 'primary', onPress: handleDone },
      ]}
    />
  );
}
