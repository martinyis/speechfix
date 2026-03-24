import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors, alpha, spacing, glass, typography } from '../theme';
import { formatTimeOfDay, formatDurationLong } from '../lib/formatters';
import type { SessionListItem } from '../types/session';

// -- Score badge color by range --

function getScoreBadgeStyle(score: number) {
  if (score >= 90) {
    return {
      backgroundColor: 'rgba(52, 211, 153, 0.15)',
      borderColor: 'rgba(52, 211, 153, 0.25)',
      textColor: colors.severityPolish,
    };
  }
  if (score >= 70) {
    return {
      backgroundColor: 'rgba(204, 151, 255, 0.15)',
      borderColor: 'rgba(204, 151, 255, 0.25)',
      textColor: colors.primary,
    };
  }
  if (score >= 50) {
    return {
      backgroundColor: 'rgba(105, 156, 255, 0.15)',
      borderColor: 'rgba(105, 156, 255, 0.25)',
      textColor: colors.secondary,
    };
  }
  return {
    backgroundColor: 'rgba(255, 110, 132, 0.15)',
    borderColor: 'rgba(255, 110, 132, 0.25)',
    textColor: colors.error,
  };
}

function ScoreBadge({ score }: { score: number }) {
  const badgeStyle = getScoreBadgeStyle(score);
  return (
    <View
      style={[
        styles.scoreBadge,
        {
          backgroundColor: badgeStyle.backgroundColor,
          borderColor: badgeStyle.borderColor,
        },
      ]}
    >
      <Text style={[styles.scoreText, { color: badgeStyle.textColor }]}>
        {score}%
      </Text>
    </View>
  );
}

// -- Severity dots --

function SeverityDots({
  errors,
  improvements,
  polish,
}: {
  errors: number;
  improvements: number;
  polish: number;
}) {
  const total = errors + improvements + polish;
  if (total === 0) return null;

  return (
    <View style={styles.dotsRow}>
      {errors > 0 && (
        <View style={styles.dotItem}>
          <View style={[styles.dot, { backgroundColor: colors.severityError }]} />
          <Text style={[styles.dotCount, { color: colors.severityError }]}>{errors}</Text>
        </View>
      )}
      {improvements > 0 && (
        <View style={styles.dotItem}>
          <View style={[styles.dot, { backgroundColor: colors.severityImprovement }]} />
          <Text style={[styles.dotCount, { color: colors.severityImprovement }]}>{improvements}</Text>
        </View>
      )}
      {polish > 0 && (
        <View style={styles.dotItem}>
          <View style={[styles.dot, { backgroundColor: colors.severityPolish }]} />
          <Text style={[styles.dotCount, { color: colors.severityPolish }]}>{polish}</Text>
        </View>
      )}
    </View>
  );
}

// -- Session row --

export function SessionRow({ item }: { item: SessionListItem }) {
  const fillerCount = item.totalFillerCount ?? 0;
  const score = item.clarityScore ?? null;

  // Fallback title: time of day for old sessions without AI title
  const title = item.title || formatTimeOfDay(item.createdAt);

  // Build meta line: fillers + duration
  const metaParts: string[] = [];
  if (fillerCount > 0) {
    metaParts.push(`${fillerCount} filler${fillerCount !== 1 ? 's' : ''}`);
  }
  metaParts.push(formatDurationLong(item.durationSeconds));

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
      {score !== null ? (
        <ScoreBadge score={score} />
      ) : (
        <View style={styles.scoreBadgePlaceholder} />
      )}

      <View style={styles.content}>
        {/* Row 1: Title + Time */}
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          <Text style={styles.time}>{formatTimeOfDay(item.createdAt)}</Text>
        </View>

        {/* Row 2: Description */}
        {item.description ? (
          <Text style={styles.description} numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}

        {/* Row 3: Severity dots + meta */}
        <View style={styles.statsRow}>
          <View style={styles.statsLeft}>
            <SeverityDots
              errors={item.errorCount}
              improvements={item.improvementCount}
              polish={item.polishCount}
            />
            <Text style={styles.meta}>{metaParts.join('  \u00B7  ')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={alpha(colors.white, 0.15)} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    ...glass.card,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  scoreBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    borderWidth: 1,
  },
  scoreBadgePlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 12,
    marginRight: spacing.md,
    backgroundColor: alpha(colors.white, 0.05),
    borderWidth: 1,
    borderColor: alpha(colors.white, 0.08),
  },
  scoreText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  content: {
    flex: 1,
    gap: 4,
  },

  // Row 1
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    ...typography.bodyMdMedium,
    color: colors.onSurface,
    flex: 1,
    marginRight: spacing.sm,
  },
  time: {
    ...typography.bodySm,
    color: alpha(colors.white, 0.5),
  },

  // Row 2
  description: {
    ...typography.bodySm,
    color: alpha(colors.white, 0.6),
    lineHeight: 18,
  },

  // Row 3
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  statsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dotItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotCount: {
    fontSize: 12,
    fontWeight: '600',
  },
  meta: {
    ...typography.bodySm,
    color: alpha(colors.white, 0.4),
  },
});
