import { View, Text, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import { colors, alpha, spacing, typography, fonts } from '../../theme';
import { formatTimeOfDay, formatDurationLong } from '../../lib/formatters';
import { AgentAvatar } from '../agent/AgentAvatar';
import type { SessionListItem, TopicCategory } from '../../types/session';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Correction Dot Badges
// ---------------------------------------------------------------------------

function CorrectionDots({
  errors,
  improvements,
  polish,
}: {
  errors: number;
  improvements: number;
  polish: number;
}) {
  const items: { count: number; color: string; label: string }[] = [];
  if (errors > 0) items.push({ count: errors, color: colors.severityError, label: 'err' });
  if (improvements > 0) items.push({ count: improvements, color: colors.severityImprovement, label: 'imp' });
  if (polish > 0) items.push({ count: polish, color: colors.severityPolish, label: 'pol' });

  if (items.length === 0) return null;

  return (
    <View style={styles.dotsRow}>
      {items.map((item) => (
        <View key={item.label} style={styles.dotBadge}>
          <View style={[styles.dot, { backgroundColor: item.color }]} />
          <Text style={[styles.dotCount, { color: alpha(item.color, 0.9) }]}>
            {item.count}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function SessionRow({ item }: { item: SessionListItem }) {
  const agentName = item.agentName ?? 'Reflexa';
  const avatarSeed = item.agentAvatarSeed ?? null;
  const fillerCount = item.totalFillerCount ?? 0;
  const title = item.title || 'Practice session';

  const metaParts: string[] = [formatDurationLong(item.durationSeconds)];
  if (item.topicCategory) {
    metaParts.push(TOPIC_LABELS[item.topicCategory] ?? item.topicCategory);
  }
  if (fillerCount > 0) {
    metaParts.push(`${fillerCount} filler${fillerCount !== 1 ? 's' : ''}`);
  }

  const totalCorrections = item.errorCount + item.improvementCount + item.polishCount;

  return (
    <Pressable
      style={styles.threadRow}
      onPress={() =>
        router.push({
          pathname: '/session-detail',
          params: { sessionId: String(item.id) },
        })
      }
    >
      {/* ---- Left column: Avatar + thread line ---- */}
      <View style={styles.avatarColumn}>
        <AgentAvatar seed={avatarSeed} size={36} />
        <View style={styles.threadLine} />
      </View>

      {/* ---- Right column ---- */}
      <View style={styles.contentColumn}>
        {/* Sender name + timestamp */}
        <View style={styles.senderRow}>
          <Text style={styles.senderName} numberOfLines={1}>
            {agentName}
          </Text>
          <Text style={styles.timestamp}>
            {formatTimeOfDay(item.createdAt)}
          </Text>
        </View>

        {/* Chat bubble */}
        <View style={styles.bubble}>
          {/* Title */}
          <Text style={styles.bubbleTitle} numberOfLines={2}>
            {title}
          </Text>

          {/* Meta */}
          <Text style={styles.bubbleMeta}>
            {metaParts.join('  \u00B7  ')}
          </Text>

          {/* Footer: correction dots */}
          {totalCorrections > 0 && (
            <View style={styles.bubbleFooter}>
              <CorrectionDots
                errors={item.errorCount}
                improvements={item.improvementCount}
                polish={item.polishCount}
              />
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  threadRow: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },

  // -- Avatar column --
  avatarColumn: {
    alignItems: 'center',
    width: 36,
    marginRight: spacing.md,
  },
  threadLine: {
    flex: 1,
    width: 1.5,
    marginTop: spacing.xs,
    backgroundColor: alpha(colors.white, 0.06),
    borderRadius: 1,
    minHeight: 8,
  },

  // -- Content column --
  contentColumn: {
    flex: 1,
    paddingBottom: spacing.xs,
  },

  // -- Sender row --
  senderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: spacing.sm,
  },
  senderName: {
    ...typography.bodySmMedium,
    color: alpha(colors.white, 0.7),
    flex: 1,
  },
  timestamp: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: alpha(colors.white, 0.25),
  },

  // -- Chat bubble --
  bubble: {
    backgroundColor: alpha(colors.white, 0.05),
    borderWidth: 1,
    borderColor: alpha(colors.white, 0.08),
    borderRadius: 14,
    borderTopLeftRadius: 4,
    padding: spacing.md,
    gap: 4,
  },

  bubbleTitle: {
    ...typography.bodyMdMedium,
    color: alpha(colors.white, 0.88),
    lineHeight: 20,
  },
  bubbleMeta: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: alpha(colors.white, 0.3),
    marginTop: 2,
  },

  // -- Bubble footer --
  bubbleFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: alpha(colors.white, 0.06),
  },

  // -- Correction dots --
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  dotBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotCount: {
    fontSize: 11,
    fontFamily: fonts.semibold,
    letterSpacing: -0.2,
  },
});
