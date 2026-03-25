import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors, alpha, spacing, glass, typography } from '../theme';
import { formatTimeOfDay, formatDurationLong } from '../lib/formatters';
import { AgentAvatar } from './AgentAvatar';
import type { SessionListItem, TopicCategory } from '../types/session';

// -- Score color by range --

function getScoreColor(score: number): string {
  if (score >= 90) return colors.severityPolish;
  if (score >= 70) return colors.primary;
  if (score >= 50) return colors.secondary;
  return colors.error;
}

// -- Topic label mapping --

const TOPIC_LABELS: Record<TopicCategory, string> = {
  work: 'Work',
  daily_life: 'Daily Life',
  travel: 'Travel',
  social: 'Social',
  education: 'Education',
  technology: 'Tech',
  health: 'Health',
  general: 'General',
};

// -- Severity bar (thin stacked horizontal bar) --

function SeverityBar({
  errors,
  improvements,
  polish,
}: {
  errors: number;
  improvements: number;
  polish: number;
}) {
  const total = errors + improvements + polish;
  if (total === 0) return <View style={styles.barEmpty} />;

  return (
    <View style={styles.barContainer}>
      {errors > 0 && (
        <View
          style={[
            styles.barSegment,
            {
              flex: errors,
              backgroundColor: colors.severityError,
              borderTopLeftRadius: 2,
              borderBottomLeftRadius: 2,
            },
          ]}
        />
      )}
      {improvements > 0 && (
        <View
          style={[
            styles.barSegment,
            {
              flex: improvements,
              backgroundColor: colors.severityImprovement,
              ...(errors === 0 && { borderTopLeftRadius: 2, borderBottomLeftRadius: 2 }),
            },
          ]}
        />
      )}
      {polish > 0 && (
        <View
          style={[
            styles.barSegment,
            {
              flex: polish,
              backgroundColor: colors.severityPolish,
              borderTopRightRadius: 2,
              borderBottomRightRadius: 2,
            },
          ]}
        />
      )}
    </View>
  );
}

// -- Session row (Variant D — Conversation Personality Card) --

export function SessionRow({ item }: { item: SessionListItem }) {
  const fillerCount = item.totalFillerCount ?? 0;
  const score = item.clarityScore ?? null;
  const agentName = item.agentName ?? 'Reflexa';
  const avatarSeed = item.agentAvatarSeed ?? null;

  const title = item.title || formatTimeOfDay(item.createdAt);

  // Meta line: duration · topic
  const metaParts: string[] = [formatDurationLong(item.durationSeconds)];
  if (item.topicCategory) {
    metaParts.push(TOPIC_LABELS[item.topicCategory] ?? item.topicCategory);
  }

  return (
    <Pressable
      style={styles.row}
      onPress={() =>
        router.push({
          pathname: '/session-detail',
          params: { sessionId: String(item.id) },
        })
      }
    >
      {/* Top section: Avatar + text */}
      <View style={styles.topSection}>
        <AgentAvatar seed={avatarSeed} size={40} />
        <View style={styles.textWrap}>
          <View style={styles.nameRow}>
            <Text style={styles.agentName} numberOfLines={1}>{agentName}</Text>
            <Text style={styles.time}>{formatTimeOfDay(item.createdAt)}</Text>
          </View>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          <Text style={styles.meta}>{metaParts.join('  \u00B7  ')}</Text>
        </View>
      </View>

      {/* Bottom section: score + severity bar + fillers + chevron */}
      <View style={styles.bottomSection}>
        <View style={styles.bottomLeft}>
          {score !== null && (
            <Text style={[styles.scoreInline, { color: getScoreColor(score) }]}>
              {score}%
            </Text>
          )}
          <View style={styles.barWrap}>
            <SeverityBar
              errors={item.errorCount}
              improvements={item.improvementCount}
              polish={item.polishCount}
            />
          </View>
          {fillerCount > 0 && (
            <Text style={styles.fillerCount}>
              {fillerCount} filler{fillerCount !== 1 ? 's' : ''}
            </Text>
          )}
        </View>
        <Ionicons name="chevron-forward" size={16} color={alpha(colors.white, 0.15)} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    ...glass.card,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },

  // -- Top section --
  topSection: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  textWrap: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  agentName: {
    ...typography.bodyMdMedium,
    color: colors.onSurface,
    flex: 1,
    marginRight: spacing.sm,
  },
  time: {
    ...typography.bodySm,
    color: alpha(colors.white, 0.4),
  },
  title: {
    ...typography.bodySm,
    color: alpha(colors.white, 0.6),
  },
  meta: {
    ...typography.bodySm,
    color: alpha(colors.white, 0.35),
    fontSize: 12,
  },

  // -- Bottom section --
  bottomSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: alpha(colors.white, 0.08),
  },
  bottomLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.sm,
  },
  scoreInline: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  barWrap: {
    flex: 1,
    maxWidth: 120,
  },
  fillerCount: {
    ...typography.bodySm,
    color: alpha(colors.white, 0.4),
    fontSize: 12,
  },

  // -- Severity bar --
  barContainer: {
    flexDirection: 'row',
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
  },
  barSegment: {
    height: 3,
  },
  barEmpty: {
    height: 3,
    borderRadius: 2,
    backgroundColor: alpha(colors.white, 0.06),
  },
});
