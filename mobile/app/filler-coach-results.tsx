import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { useSessionStore } from '../stores/sessionStore';
import { useFillerCoachSessions } from '../hooks/data/useFillerCoachSessions';
import { ScreenHeader } from '../components/ui';
import { GlassIconPillButton } from '../components/ui';
import { colors, alpha, fonts, spacing, layout, typography, borderRadius } from '../theme';
import type { FillerCoachSession } from '../types/session';

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
  if (rate <= 1.5) return colors.severityPolish;   // great
  if (rate <= 3.0) return colors.secondary;         // ok
  return colors.error;                               // needs work
}

export default function FillerCoachResultsScreen() {
  const { fillerCoachSessionId, fresh } = useLocalSearchParams<{
    fillerCoachSessionId?: string;
    fresh?: string;
  }>();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const isFresh = fresh === 'true';
  const sessionId = Number(fillerCoachSessionId) || 0;

  // For fresh sessions, read from store (just-finished data)
  const storeData = useSessionStore((s) => s.currentSessionData);

  // For non-fresh (tapped from history), look up from react-query cache
  const { data: allSessions } = useFillerCoachSessions();
  const cachedSession = allSessions?.find((s) => s.id === sessionId);

  // Build display data from whichever source is available
  const fillerWords = isFresh
    ? (storeData?.fillerWords ?? [])
    : (cachedSession?.fillerData?.fillerWords ?? []);

  const durationSeconds = isFresh
    ? (storeData?.durationSeconds ?? 0)
    : (cachedSession?.durationSeconds ?? 0);

  const totalFillers = fillerWords.reduce((sum, fw) => sum + fw.count, 0);
  const rate = fillersPerMin(totalFillers, durationSeconds);
  const rateCol = rateColor(rate);

  // Compute delta vs previous session
  let delta: number | null = null;
  if (allSessions && allSessions.length >= 2) {
    // Find the session just before this one
    const idx = allSessions.findIndex((s) => s.id === sessionId);
    const prevSession = idx >= 0 && idx < allSessions.length - 1
      ? allSessions[idx + 1] // sorted newest first
      : isFresh && allSessions.length > 0
        ? allSessions[0] // if fresh, the first cached one is the previous
        : null;

    if (prevSession) {
      const prevRate = fillersPerMin(prevSession.totalFillerCount, prevSession.durationSeconds);
      delta = Number((rate - prevRate).toFixed(1));
    }
  }

  const handleDone = () => {
    queryClient.invalidateQueries({ queryKey: ['filler-coach-sessions'] });
    queryClient.invalidateQueries({ queryKey: ['filler-coach-stats'] });
    queryClient.invalidateQueries({ queryKey: ['filler-summary'] });
    router.replace('/(tabs)/practice');
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <ScreenHeader
        variant="back"
        title="Filler Coach"
        onBack={handleDone}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero metric */}
        <View style={styles.heroSection}>
          <Text style={[styles.heroNumber, { color: rateCol }]}>
            {rate}
          </Text>
          <Text style={styles.heroLabel}>fillers / min</Text>

          {delta !== null && (
            <View style={[
              styles.deltaBadge,
              { backgroundColor: alpha(delta <= 0 ? colors.severityPolish : colors.error, 0.15) },
            ]}>
              <Text style={[
                styles.deltaText,
                { color: delta <= 0 ? colors.severityPolish : colors.error },
              ]}>
                {delta <= 0 ? '\u2193' : '\u2191'} {Math.abs(delta)}/min vs last
              </Text>
            </View>
          )}
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{totalFillers}</Text>
            <Text style={styles.statLabel}>total fillers</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{formatDuration(durationSeconds)}</Text>
            <Text style={styles.statLabel}>duration</Text>
          </View>
        </View>

        {/* Filler breakdown */}
        {fillerWords.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>BREAKDOWN</Text>
            <View style={styles.chipRow}>
              {fillerWords
                .sort((a, b) => b.count - a.count)
                .map((fw) => (
                  <View key={fw.word} style={styles.chip}>
                    <Text style={styles.chipWord}>{fw.word}</Text>
                    <Text style={styles.chipCount}>{fw.count}</Text>
                  </View>
                ))}
            </View>
          </View>
        )}

        {totalFillers === 0 && (
          <View style={styles.section}>
            <Text style={styles.emptyText}>
              No fillers detected — nice work!
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Done button */}
      <View style={styles.bottomBar}>
        <GlassIconPillButton
          label="Done"
          icon="checkmark"
          variant="primary"
          fullWidth
          onPress={handleDone}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.xxl,
    paddingBottom: 100,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  heroNumber: {
    fontSize: 72,
    fontFamily: fonts.extrabold,
    letterSpacing: -2,
  },
  heroLabel: {
    ...typography.labelMd,
    color: alpha(colors.white, 0.45),
    marginTop: spacing.xs,
  },
  deltaBadge: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  deltaText: {
    fontSize: 13,
    fontFamily: fonts.semibold,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xxl,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 22,
    fontFamily: fonts.bold,
    color: colors.onSurface,
  },
  statLabel: {
    ...typography.labelSm,
    color: alpha(colors.white, 0.4),
    marginTop: spacing.xxs,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: alpha(colors.white, 0.1),
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    ...typography.labelMd,
    color: alpha(colors.white, 0.4),
    marginBottom: spacing.md,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: alpha(colors.white, 0.06),
    borderWidth: 1,
    borderColor: alpha(colors.white, 0.08),
  },
  chipWord: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: alpha(colors.white, 0.7),
  },
  chipCount: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  emptyText: {
    fontSize: 15,
    fontFamily: fonts.medium,
    color: colors.severityPolish,
    textAlign: 'center',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: layout.screenPadding,
    paddingBottom: spacing.lg,
    paddingTop: spacing.md,
  },
});
