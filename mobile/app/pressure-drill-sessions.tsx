import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePressureDrillSessions } from '../hooks/data/usePressureDrillSessions';
import { EmptyState } from '../components/ui';
import { colors, alpha, fonts, spacing, layout, typography, borderRadius } from '../theme';
import type { PressureDrillSession, DurationPreset } from '../types/pressureDrill';
import { DURATION_PRESETS } from '../types/pressureDrill';
import { SCENARIOS, DURATION_LABELS } from '../lib/pressureDrillScenarios';

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

// ── Session Row ───────────────────────────────────────────────────────

function SessionRow({ session }: { session: PressureDrillSession }) {
  const rate = fillersPerMin(session.totalFillerCount, session.durationSeconds);
  const fillerWords = session.fillerData?.fillerWords ?? [];
  const topWords = [...fillerWords]
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  return (
    <Pressable
      style={styles.sessionRow}
      onPress={() =>
        router.push({
          pathname: '/pressure-drill-results',
          params: { sessionId: String(session.id) },
        })
      }
    >
      <View style={styles.sessionLeft}>
        <View style={styles.sessionTopRow}>
          <Text style={styles.sessionDate}>{relativeDate(session.createdAt)}</Text>
          <Text style={styles.sessionDuration}>{formatDuration(session.durationSeconds)}</Text>
        </View>
        <Text style={styles.sessionScenario} numberOfLines={1}>
          {SCENARIOS.find((s) => s.slug === session.scenarioSlug)?.label ?? 'Session'} · {DURATION_LABELS[session.durationSelectedSeconds]}
        </Text>
        {topWords.length > 0 && (
          <Text style={styles.sessionFillers} numberOfLines={1}>
            {topWords.map((fw) => `${fw.word} x${fw.count}`).join(', ')}
          </Text>
        )}
      </View>
      <View style={styles.sessionRight}>
        <Text style={[styles.sessionRate, { color: rateColor(rate) }]}>
          {rate.toFixed(1)}/min
        </Text>
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

// ── Main Screen ───────────────────────────────────────────────────────

export default function PressureDrillSessionsScreen() {
  const insets = useSafeAreaInsets();
  const { data: sessions } = usePressureDrillSessions();
  const [filter, setFilter] = useState<DurationPreset | 'all'>('all');

  const visible =
    filter === 'all'
      ? sessions
      : sessions?.filter((s) => s.durationSelectedSeconds === filter);

  const hasAnySessions = !!sessions && sessions.length > 0;
  const filteredIsEmpty = hasAnySessions && (!visible || visible.length === 0);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Drill History</Text>
        <View style={styles.backBtn} />
      </View>

      {/* Filter pills */}
      {hasAnySessions && (
        <View style={styles.filterRow}>
          <Pressable
            onPress={() => setFilter('all')}
            style={[styles.filterPill, filter === 'all' && styles.filterPillActive]}
          >
            <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
              All
            </Text>
          </Pressable>
          {DURATION_PRESETS.map((d) => (
            <Pressable
              key={d}
              onPress={() => setFilter(d)}
              style={[styles.filterPill, filter === d && styles.filterPillActive]}
            >
              <Text style={[styles.filterText, filter === d && styles.filterTextActive]}>
                {DURATION_LABELS[d]}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Content */}
      {!hasAnySessions ? (
        <View style={styles.emptyContainer}>
          <EmptyState
            icon="flash-outline"
            title="No Drills Yet"
            subtitle="Run a Pressure Drill to see your history here."
            action={{
              label: 'Start Drill',
              onPress: () => router.push('/pressure-drill'),
            }}
          />
        </View>
      ) : filteredIsEmpty ? (
        <View style={styles.subEmptyContainer}>
          <Text style={styles.subEmptyText}>No drills at this duration yet</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + 24 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {visible!.map((session) => (
            <SessionRow key={session.id} session={session} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.headlineSm,
    color: colors.onSurface,
  },

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  subEmptyContainer: {
    paddingTop: spacing.xxl,
    alignItems: 'center',
  },
  subEmptyText: {
    ...typography.bodyMd,
    color: alpha(colors.white, 0.35),
  },

  list: {
    paddingHorizontal: layout.screenPadding,
  },

  // Filter pills
  filterRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: layout.screenPadding,
    marginBottom: spacing.md,
    flexWrap: 'wrap',
  },
  filterPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: alpha(colors.white, 0.08),
  },
  filterPillActive: {
    borderColor: colors.primary,
    backgroundColor: alpha(colors.primary, 0.12),
  },
  filterText: {
    ...typography.bodySm,
    color: alpha(colors.white, 0.5),
  },
  filterTextActive: {
    color: colors.primary,
    fontFamily: fonts.semibold,
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
    ...typography.bodyMdMedium,
    color: alpha(colors.white, 0.6),
  },
  sessionDuration: {
    ...typography.bodySm,
    color: alpha(colors.white, 0.3),
  },
  sessionScenario: {
    ...typography.bodySm,
    color: alpha(colors.white, 0.45),
    marginTop: 2,
  },
  sessionFillers: {
    ...typography.bodySm,
    color: alpha(colors.white, 0.35),
    marginTop: 3,
  },
  sessionRight: {
    alignItems: 'flex-end',
    marginRight: spacing.sm,
  },
  sessionRate: {
    ...typography.bodyMdMedium,
  },
  sessionChevron: {
    marginLeft: spacing.xxs,
  },
});
