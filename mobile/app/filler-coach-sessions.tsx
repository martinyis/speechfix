import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFillerCoachSessions } from '../hooks/data/useFillerCoachSessions';
import { EmptyState } from '../components/ui';
import { colors, alpha, fonts, spacing, layout, typography, borderRadius } from '../theme';
import type { FillerCoachSession } from '../types/session';

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

function SessionRow({ session }: { session: FillerCoachSession }) {
  const rate = fillersPerMin(session.totalFillerCount, session.durationSeconds);
  const fillerWords = session.fillerData?.fillerWords ?? [];
  const topWords = fillerWords
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

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
          <Text style={styles.sessionDate}>{relativeDate(session.createdAt)}</Text>
          <Text style={styles.sessionDuration}>{formatDuration(session.durationSeconds)}</Text>
        </View>
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

export default function FillerCoachSessionsScreen() {
  const insets = useSafeAreaInsets();
  const { data: sessions } = useFillerCoachSessions();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Practice Sessions</Text>
        <View style={styles.backBtn} />
      </View>

      {/* Content */}
      {!sessions || sessions.length === 0 ? (
        <View style={styles.emptyContainer}>
          <EmptyState
            icon="mic-outline"
            title="No Practice Sessions"
            subtitle="Start a filler word coaching session to practice speaking with fewer fillers"
            action={{
              label: 'Start Practice',
              onPress: () => router.push('/filler-coach'),
            }}
          />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + 24 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {sessions.map((session) => (
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

  list: {
    paddingHorizontal: layout.screenPadding,
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
