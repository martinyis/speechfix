import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, alpha, spacing, typography, borderRadius } from '../../theme';
import { formatTimeOfDay, formatDurationLong } from '../../lib/formatters';
import { AgentAvatar } from '../AgentAvatar';
import type { SessionListItem, TopicCategory } from '../../types/session';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getScoreColor(score: number): string {
  if (score >= 90) return colors.severityPolish;
  if (score >= 70) return colors.primary;
  if (score >= 50) return colors.secondary;
  return colors.error;
}

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
// Correction Dot Badges — small colored circles with counts
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

export function SessionRowVariantC({ item }: { item: SessionListItem }) {
  const score = item.clarityScore ?? null;
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
    <View style={styles.threadRow}>
      {/* ---- Left column: Avatar + thread line ---- */}
      <View style={styles.avatarColumn}>
        <AgentAvatar seed={avatarSeed} size={38} />
        <View style={styles.threadLine} />
      </View>

      {/* ---- Right column: Chat bubble area ---- */}
      <View style={styles.bubbleColumn}>
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
          {/* Bubble tail / notch */}
          <View style={styles.bubbleTail} />

          {/* Title as the "message" text */}
          <Text style={styles.bubbleTitle} numberOfLines={2}>
            {title}
          </Text>

          {/* Meta line inside the bubble */}
          <Text style={styles.bubbleMeta}>
            {metaParts.join('  \u00B7  ')}
          </Text>

          {/* Bottom row: correction dots + score tag */}
          {(totalCorrections > 0 || score !== null) && (
            <View style={styles.bubbleFooter}>
              <CorrectionDots
                errors={item.errorCount}
                improvements={item.improvementCount}
                polish={item.polishCount}
              />

              {score !== null && (
                <View
                  style={[
                    styles.scoreTag,
                    { backgroundColor: alpha(getScoreColor(score), 0.12) },
                  ]}
                >
                  <Ionicons
                    name="analytics-outline"
                    size={11}
                    color={alpha(getScoreColor(score), 0.8)}
                  />
                  <Text
                    style={[
                      styles.scoreText,
                      { color: getScoreColor(score) },
                    ]}
                  >
                    {score}%
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const BUBBLE_RADIUS = 14;
const TAIL_SIZE = 8;

const styles = StyleSheet.create({
  // -- Thread layout --
  threadRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },

  // -- Avatar column --
  avatarColumn: {
    alignItems: 'center',
    width: 38,
    marginRight: spacing.md,
  },
  threadLine: {
    flex: 1,
    width: 1.5,
    marginTop: spacing.xs,
    backgroundColor: alpha(colors.white, 0.06),
    borderRadius: 1,
  },

  // -- Bubble column --
  bubbleColumn: {
    flex: 1,
    paddingBottom: spacing.xs,
  },

  // -- Sender row --
  senderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  senderName: {
    ...typography.bodySmMedium,
    color: colors.onSurface,
    flex: 1,
  },
  timestamp: {
    ...typography.bodySm,
    fontSize: 11,
    color: alpha(colors.white, 0.3),
  },

  // -- Chat bubble --
  bubble: {
    backgroundColor: alpha(colors.white, 0.05),
    borderWidth: 1,
    borderColor: alpha(colors.white, 0.08),
    borderRadius: BUBBLE_RADIUS,
    borderTopLeftRadius: 4, // flattened corner near the "tail" for chat feel
    padding: spacing.md,
    gap: spacing.xs,
  },
  bubbleTail: {
    position: 'absolute',
    top: 6,
    left: -TAIL_SIZE + 1,
    width: 0,
    height: 0,
    borderTopWidth: TAIL_SIZE / 2,
    borderBottomWidth: TAIL_SIZE / 2,
    borderRightWidth: TAIL_SIZE,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderRightColor: alpha(colors.white, 0.08),
  },
  bubbleTitle: {
    ...typography.bodyMdMedium,
    color: alpha(colors.white, 0.88),
    lineHeight: 20,
  },
  bubbleMeta: {
    ...typography.bodySm,
    fontSize: 11,
    color: alpha(colors.white, 0.35),
    marginTop: 2,
  },

  // -- Bubble footer (corrections + score) --
  bubbleFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: alpha(colors.white, 0.06),
  },

  // -- Correction dot badges --
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
    fontWeight: '600',
    letterSpacing: -0.2,
  },

  // -- Score tag --
  scoreTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
  },
  scoreText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
});
