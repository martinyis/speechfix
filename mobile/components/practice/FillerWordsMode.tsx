import { View, Text, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { EmptyState } from '../ui';
import { useFillerSummary } from '../../hooks/useFillerSummary';
import { useFillerCoachStats } from '../../hooks/useFillerCoachStats';
import { useFillerCoachSessions } from '../../hooks/useFillerCoachSessions';
import { TrendSparkline } from './TrendSparkline';
import { colors, alpha, fonts, spacing, layout, typography, borderRadius, shadows } from '../../theme';
import type { FillerCoachSession } from '../../types/session';

// ── Helpers ────────────────────────────────────────────────────────────

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

function relativeDate(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Floating Mic FAB ───────────────────────────────────────────────────

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function MicFAB() {
  const scale = useSharedValue(1);
  const glowOpacity = useSharedValue(0.2);

  useEffect(() => {
    // Gentle breathing pulse on the glow
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.35, { duration: 1500 }),
        withTiming(0.15, { duration: 1500 }),
      ),
      -1,
      true,
    );
  }, []);

  const fabStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  return (
    <View style={styles.fabContainer}>
      {/* Glow ring */}
      <Animated.View style={[styles.fabGlow, glowStyle]} />
      <AnimatedPressable
        style={[styles.fab, fabStyle]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          router.push('/filler-coach');
        }}
        onPressIn={() => {
          scale.value = withSpring(0.88, { damping: 15, stiffness: 400 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 12, stiffness: 300 });
        }}
        accessibilityLabel="Start practice session"
        accessibilityRole="button"
      >
        <Ionicons name="mic" size={24} color={colors.white} />
      </AnimatedPressable>
    </View>
  );
}

// ── Session Row ────────────────────────────────────────────────────────

function SessionRow({
  session,
  prevSession,
}: {
  session: FillerCoachSession;
  prevSession: FillerCoachSession | null;
}) {
  const rate = fillersPerMin(session.totalFillerCount, session.durationSeconds);
  const fillerWords = session.fillerData?.fillerWords ?? [];

  let delta: number | null = null;
  if (prevSession) {
    const prevRate = fillersPerMin(prevSession.totalFillerCount, prevSession.durationSeconds);
    delta = Number((rate - prevRate).toFixed(1));
  }

  return (
    <Pressable
      style={styles.sessionRow}
      onPress={() =>
        router.push({
          pathname: '/filler-coach-results',
          params: { fillerCoachSessionId: String(session.id) },
        })
      }
    >
      <View style={styles.sessionLeft}>
        <View style={styles.sessionTopRow}>
          <Text style={styles.sessionDate}>
            {relativeDate(session.createdAt)}
          </Text>
          <Text style={styles.sessionDuration}>
            {formatDuration(session.durationSeconds)}
          </Text>
        </View>
        {fillerWords.length > 0 && (
          <Text style={styles.sessionFillers} numberOfLines={1}>
            {fillerWords
              .sort((a, b) => b.count - a.count)
              .slice(0, 3)
              .map((fw) => `${fw.word} x${fw.count}`)
              .join(', ')}
          </Text>
        )}
      </View>
      <View style={styles.sessionRight}>
        <Text style={[styles.sessionRate, { color: rateColor(rate) }]}>
          {rate}/min
        </Text>
        {delta !== null && delta !== 0 && (
          <Text
            style={[
              styles.sessionDelta,
              { color: delta < 0 ? colors.severityPolish : colors.error },
            ]}
          >
            {delta < 0 ? '\u2193' : '\u2191'}{Math.abs(delta)}
          </Text>
        )}
      </View>
      <Ionicons
        name="chevron-forward"
        size={14}
        color={alpha(colors.white, 0.2)}
        style={styles.sessionChevron}
      />
    </Pressable>
  );
}

// ── Filler Grid Item ───────────────────────────────────────────────────

function FillerGridItem({ word, count }: { word: string; count: number }) {
  return (
    <View style={styles.gridItem}>
      <Text style={styles.gridWord}>{word}</Text>
      <Text style={styles.gridCount}>{count}</Text>
    </View>
  );
}

// ── Main Component ─────────────────────────────────────────────────────

export function FillerWordsMode() {
  const { data: summary } = useFillerSummary();
  const { data: stats } = useFillerCoachStats();
  const { data: sessions } = useFillerCoachSessions();
  const { width: screenWidth } = useWindowDimensions();

  const hasOrganicData = summary && summary.words.length > 0;
  const hasCoachSessions = stats && stats.totalSessions > 0;
  const isEmpty = !hasOrganicData && !hasCoachSessions;

  if (isEmpty) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContent}>
          <EmptyState
            icon="mic-outline"
            title="Filler Word Coach"
            subtitle="Have a conversation with AI and practice reducing fillers like 'um', 'like', and 'you know'"
            action={{
              label: 'Start Practice',
              onPress: () => router.push('/filler-coach'),
            }}
          />
        </View>
      </View>
    );
  }

  const heroRate = hasCoachSessions ? stats!.avgFillersPerMin : null;
  const totalTime = hasCoachSessions ? stats!.totalPracticeSeconds : 0;

  return (
    <View style={styles.container}>
      <View style={styles.scrollContent}>
        {/* Hero: avg fillers/min */}
        {heroRate !== null ? (
          <View style={styles.heroSection}>
            <Text style={[styles.heroNumber, { color: rateColor(heroRate) }]}>
              {heroRate}
            </Text>
            <Text style={styles.heroUnit}>/min</Text>
            <Text style={styles.heroLabel}>your current rate</Text>

            <Text style={styles.metaRow}>
              best: {stats!.bestFillersPerMin}  ·  {stats!.totalSessions} session{stats!.totalSessions !== 1 ? 's' : ''}  ·  {formatDuration(totalTime)} total
            </Text>
          </View>
        ) : (
          <View style={styles.heroSection}>
            <Ionicons name="pulse-outline" size={32} color={alpha(colors.white, 0.25)} />
            <Text style={styles.heroPrompt}>
              Practice to see your rate
            </Text>
          </View>
        )}

        {/* Trend sparkline */}
        {hasCoachSessions && sessions && sessions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>TREND</Text>
            <View style={{ marginTop: spacing.sm }}>
              <TrendSparkline
                dataPoints={[...sessions]
                  .reverse()
                  .slice(-20)
                  .map(s => {
                    const mins = Math.max(s.durationSeconds / 60, 0.5);
                    return Number((s.totalFillerCount / mins).toFixed(1));
                  })}
                width={screenWidth - layout.screenPadding * 2}
              />
            </View>
          </View>
        )}

        {/* Top Fillers (from organic data) */}
        {hasOrganicData && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>TOP FILLERS</Text>
            <Text style={styles.sectionSubtitle}>
              Detected across {summary!.totalSessions} conversation{summary!.totalSessions !== 1 ? 's' : ''}
            </Text>
            <View style={styles.fillerGrid}>
              {summary!.words.slice(0, 6).map((w) => (
                <FillerGridItem key={w.word} word={w.word} count={w.totalCount} />
              ))}
            </View>
          </View>
        )}

        {/* Sessions list */}
        {sessions && sessions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>SESSIONS</Text>
            {sessions.map((session, i) => (
              <SessionRow
                key={session.id}
                session={session}
                prevSession={i < sessions.length - 1 ? sessions[i + 1] : null}
              />
            ))}
          </View>
        )}
      </View>

      {/* Floating mic FAB */}
      <MicFAB />
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────

const FAB_SIZE = 56;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyContent: {
    flex: 1,
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.xxxl, // Clear the OrbitModeSwitcher
    paddingBottom: 80,
  },

  // Hero
  heroSection: {
    alignItems: 'center',
    paddingBottom: spacing.xxl,
  },
  heroNumber: {
    fontSize: 64,
    fontFamily: fonts.extrabold,
    letterSpacing: -2,
    lineHeight: 68,
  },
  heroUnit: {
    fontSize: 18,
    fontFamily: fonts.semibold,
    color: alpha(colors.white, 0.35),
    marginTop: -4,
  },
  heroLabel: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: alpha(colors.white, 0.35),
    marginTop: spacing.sm,
  },
  metaRow: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: alpha(colors.white, 0.3),
    marginTop: spacing.md,
  },
  heroPrompt: {
    fontSize: 15,
    fontFamily: fonts.medium,
    color: alpha(colors.white, 0.4),
    marginTop: spacing.md,
  },

  // Sections
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    ...typography.labelMd,
    color: alpha(colors.white, 0.4),
  },
  sectionSubtitle: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: alpha(colors.white, 0.25),
    marginTop: spacing.xxs,
    marginBottom: spacing.md,
  },

  // Filler grid (2 columns)
  fillerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  gridItem: {
    width: '50%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingRight: spacing.xl,
  },
  gridWord: {
    fontSize: 15,
    fontFamily: fonts.medium,
    color: alpha(colors.white, 0.7),
  },
  gridCount: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: alpha(colors.primary, 0.8),
  },

  // Session rows
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: alpha(colors.white, 0.06),
  },
  sessionLeft: {
    flex: 1,
  },
  sessionTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sessionDate: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: alpha(colors.white, 0.6),
  },
  sessionDuration: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: alpha(colors.white, 0.3),
  },
  sessionFillers: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: alpha(colors.white, 0.35),
    marginTop: 3,
  },
  sessionRight: {
    alignItems: 'flex-end',
    marginRight: spacing.sm,
  },
  sessionRate: {
    fontSize: 15,
    fontFamily: fonts.bold,
  },
  sessionDelta: {
    fontSize: 11,
    fontFamily: fonts.bold,
    marginTop: 2,
  },
  sessionChevron: {
    marginLeft: spacing.xxs,
  },

  // Floating FAB
  fabContainer: {
    position: 'absolute',
    bottom: 20,
    right: layout.screenPadding,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabGlow: {
    position: 'absolute',
    width: FAB_SIZE + 20,
    height: FAB_SIZE + 20,
    borderRadius: (FAB_SIZE + 20) / 2,
    backgroundColor: colors.primary,
  },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: colors.primaryDim,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.glow,
  },
});
