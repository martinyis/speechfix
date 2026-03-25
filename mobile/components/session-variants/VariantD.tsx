import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, alpha, spacing, typography, borderRadius } from '../../theme';
import { formatTimeOfDay, formatDurationLong } from '../../lib/formatters';
import { AgentAvatar } from '../AgentAvatar';
import type { SessionListItem, TopicCategory } from '../../types/session';

// ---------------------------------------------------------------------------
// Score color by range
// ---------------------------------------------------------------------------

function getAccentColor(score: number | null): string {
  if (score === null) return alpha(colors.white, 0.12);
  if (score >= 90) return colors.severityPolish;
  if (score >= 70) return colors.primary;
  if (score >= 50) return colors.secondary;
  return colors.severityError;
}

// ---------------------------------------------------------------------------
// Topic labels
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
// Inline correction count — colored text fragment
// ---------------------------------------------------------------------------

function CorrectionText({
  count,
  color,
  label,
}: {
  count: number;
  color: string;
  label: string;
}) {
  if (count === 0) return null;
  return (
    <Text style={[styles.correctionCount, { color }]}>
      {count} {label}
    </Text>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SessionRowVariantD({ item }: { item: SessionListItem }) {
  const score = item.clarityScore ?? null;
  const accentColor = getAccentColor(score);
  const agentName = item.agentName ?? 'Reflexa';
  const avatarSeed = item.agentAvatarSeed ?? null;
  const fillerCount = item.totalFillerCount ?? 0;
  const totalCorrections = item.errorCount + item.improvementCount + item.polishCount;

  const title = item.title || formatTimeOfDay(item.createdAt);

  return (
    <View style={styles.row}>
      {/* Left accent line */}
      <View style={[styles.accentLine, { backgroundColor: accentColor }]} />

      {/* Content */}
      <View style={styles.content}>
        {/* Header: agent + time */}
        <View style={styles.header}>
          <View style={styles.agentGroup}>
            <AgentAvatar seed={avatarSeed} size={20} />
            <Text style={styles.agentName} numberOfLines={1}>
              {agentName}
            </Text>
          </View>
          <Text style={styles.timestamp}>{formatTimeOfDay(item.createdAt)}</Text>
        </View>

        {/* Title */}
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>

        {/* Meta row: duration + topic */}
        <View style={styles.metaRow}>
          <Ionicons
            name="time-outline"
            size={12}
            color={alpha(colors.white, 0.3)}
          />
          <Text style={styles.metaText}>
            {formatDurationLong(item.durationSeconds)}
          </Text>
          {item.topicCategory && (
            <>
              <View style={styles.metaDot} />
              <Text style={styles.metaText}>
                {TOPIC_LABELS[item.topicCategory] ?? item.topicCategory}
              </Text>
            </>
          )}
        </View>

        {/* Stats line: score + inline correction counts + fillers */}
        {(score !== null || totalCorrections > 0 || fillerCount > 0) && (
          <View style={styles.statsRow}>
            {score !== null && (
              <Text style={[styles.score, { color: accentColor }]}>
                {score}%
              </Text>
            )}

            {totalCorrections > 0 && (
              <View style={styles.correctionsGroup}>
                <CorrectionText
                  count={item.errorCount}
                  color={colors.severityError}
                  label="err"
                />
                <CorrectionText
                  count={item.improvementCount}
                  color={colors.severityImprovement}
                  label="imp"
                />
                <CorrectionText
                  count={item.polishCount}
                  color={colors.severityPolish}
                  label="pol"
                />
              </View>
            )}

            {fillerCount > 0 && (
              <Text style={styles.fillerText}>
                {fillerCount} filler{fillerCount !== 1 ? 's' : ''}
              </Text>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingVertical: spacing.lg,
    paddingRight: spacing.lg,
    marginLeft: spacing.xl,
  },

  // Thin vertical accent bar
  accentLine: {
    width: 2.5,
    borderRadius: 2,
    marginRight: spacing.lg,
    // Stretches full height of content via flexbox
  },

  content: {
    flex: 1,
    gap: spacing.sm,
  },

  // Header row
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  agentGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
    marginRight: spacing.md,
  },
  agentName: {
    ...typography.bodySmMedium,
    color: alpha(colors.white, 0.6),
  },
  timestamp: {
    ...typography.bodySm,
    fontSize: 11,
    color: alpha(colors.white, 0.25),
    letterSpacing: 0.2,
  },

  // Title
  title: {
    ...typography.bodyMdMedium,
    color: colors.onSurface,
    lineHeight: 20,
  },

  // Meta
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  metaText: {
    ...typography.bodySm,
    fontSize: 12,
    color: alpha(colors.white, 0.3),
  },
  metaDot: {
    width: 2.5,
    height: 2.5,
    borderRadius: 1.25,
    backgroundColor: alpha(colors.white, 0.15),
    marginHorizontal: spacing.xxs,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xxs,
  },
  score: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  correctionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  correctionCount: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  fillerText: {
    ...typography.bodySm,
    fontSize: 11,
    color: alpha(colors.white, 0.25),
  },
});
