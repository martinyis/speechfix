import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, alpha, spacing, glass, typography, borderRadius } from '../../theme';
import { formatTimeOfDay, formatDurationLong } from '../../lib/formatters';
import type { SessionListItem, TopicCategory } from '../../types/session';

// -- Score color by range --

function getScoreColor(score: number): string {
  if (score >= 90) return colors.severityPolish;
  if (score >= 70) return colors.primary;
  if (score >= 50) return colors.secondary;
  return colors.error;
}

// -- Topic icons --

const TOPIC_ICONS: Record<TopicCategory, keyof typeof Ionicons.glyphMap> = {
  work: 'briefcase',
  daily_life: 'cafe',
  travel: 'airplane',
  social: 'people',
  education: 'school',
  technology: 'code-slash',
  health: 'fitness',
  general: 'chatbubble-ellipses',
};

// -- Tiny severity dots --

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

  // Show up to 12 dots, proportionally distributed
  const maxDots = 12;
  const scale = total <= maxDots ? 1 : maxDots / total;

  const eDots = Math.max(errors > 0 ? 1 : 0, Math.round(errors * scale));
  const iDots = Math.max(improvements > 0 ? 1 : 0, Math.round(improvements * scale));
  const pDots = Math.max(polish > 0 ? 1 : 0, Math.round(polish * scale));

  const dots: { color: string }[] = [
    ...Array(eDots).fill({ color: colors.severityError }),
    ...Array(iDots).fill({ color: colors.severityImprovement }),
    ...Array(pDots).fill({ color: colors.severityPolish }),
  ];

  return (
    <View style={styles.dotsRow}>
      {dots.map((dot, i) => (
        <View key={i} style={[styles.dot, { backgroundColor: dot.color }]} />
      ))}
    </View>
  );
}

// -- Compact Metric Strip --

export function SessionRowVariantA({ item }: { item: SessionListItem }) {
  const score = item.clarityScore ?? null;
  const fillerCount = item.totalFillerCount ?? 0;
  const totalCorrections = item.errorCount + item.improvementCount + item.polishCount;

  const title = item.title || formatTimeOfDay(item.createdAt);
  const topicIcon = item.topicCategory
    ? TOPIC_ICONS[item.topicCategory]
    : null;

  return (
    <View style={styles.card}>
      {/* Left: Score as dominant anchor */}
      {score !== null ? (
        <View style={styles.scoreBlock}>
          <Text style={[styles.scoreNumber, { color: getScoreColor(score) }]}>
            {score}
          </Text>
          <Text style={styles.scoreUnit}>%</Text>
        </View>
      ) : (
        <View style={styles.scoreBlock}>
          <Ionicons
            name="mic-outline"
            size={20}
            color={alpha(colors.white, 0.25)}
          />
        </View>
      )}

      {/* Thin vertical divider */}
      <View style={styles.divider} />

      {/* Center: Title, meta, severity dots */}
      <View style={styles.center}>
        <View style={styles.titleRow}>
          {topicIcon && (
            <Ionicons
              name={topicIcon}
              size={12}
              color={alpha(colors.white, 0.3)}
              style={styles.topicIcon}
            />
          )}
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>
            {formatDurationLong(item.durationSeconds)}
          </Text>
          {totalCorrections > 0 && (
            <>
              <Text style={styles.metaDot}>{'\u00B7'}</Text>
              <Text style={styles.metaText}>
                {totalCorrections} correction{totalCorrections !== 1 ? 's' : ''}
              </Text>
            </>
          )}
          {fillerCount > 0 && (
            <>
              <Text style={styles.metaDot}>{'\u00B7'}</Text>
              <Text style={styles.metaText}>
                {fillerCount} filler{fillerCount !== 1 ? 's' : ''}
              </Text>
            </>
          )}
        </View>
        <SeverityDots
          errors={item.errorCount}
          improvements={item.improvementCount}
          polish={item.polishCount}
        />
      </View>

      {/* Right: timestamp */}
      <Text style={styles.timestamp}>
        {formatTimeOfDay(item.createdAt)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    ...glass.card,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    gap: spacing.md,
    overflow: 'hidden',
  },

  // -- Score anchor --
  scoreBlock: {
    width: 44,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
  },
  scoreNumber: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -1,
    fontFamily: 'Manrope',
  },
  scoreUnit: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginLeft: 1,
    opacity: 0.6,
  },

  // -- Divider --
  divider: {
    width: 1,
    height: 28,
    backgroundColor: alpha(colors.white, 0.08),
    borderRadius: 1,
  },

  // -- Center content --
  center: {
    flex: 1,
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  topicIcon: {
    marginRight: spacing.xs,
  },
  title: {
    ...typography.bodySmMedium,
    color: colors.onSurface,
    flex: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  metaText: {
    fontSize: 11,
    fontWeight: '400',
    color: alpha(colors.white, 0.35),
  },
  metaDot: {
    fontSize: 11,
    color: alpha(colors.white, 0.2),
  },

  // -- Severity dots --
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },

  // -- Timestamp --
  timestamp: {
    fontSize: 11,
    fontWeight: '400',
    color: alpha(colors.white, 0.3),
    letterSpacing: -0.2,
  },
});
