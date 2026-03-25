import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, alpha, spacing, glass, typography, borderRadius } from '../../theme';
import { formatTimeOfDay, formatDurationLong } from '../../lib/formatters';
import { AgentAvatar } from '../AgentAvatar';
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

const TOPIC_ICONS: Record<TopicCategory, keyof typeof Ionicons.glyphMap> = {
  work: 'briefcase-outline',
  daily_life: 'cafe-outline',
  travel: 'airplane-outline',
  social: 'people-outline',
  education: 'school-outline',
  technology: 'code-slash-outline',
  health: 'fitness-outline',
  general: 'chatbubble-outline',
};

function getScoreColor(score: number): string {
  if (score >= 90) return colors.severityPolish;
  if (score >= 70) return colors.primary;
  if (score >= 50) return colors.secondary;
  return colors.error;
}

// ---------------------------------------------------------------------------
// Circular Score Indicator (View + border, no Skia)
// ---------------------------------------------------------------------------

const RING_SIZE = 56;
const RING_STROKE = 4;

/**
 * Renders a circular progress ring using two half-circle Views clipped
 * behind overflow-hidden containers. The ring fills clockwise from the top.
 */
function ScoreRing({ score }: { score: number }) {
  const color = getScoreColor(score);
  const progress = Math.min(Math.max(score / 100, 0), 1);
  const degrees = progress * 360;

  // Right half: 0-180 degrees
  const rightDeg = Math.min(degrees, 180);
  // Left half: 180-360 degrees
  const leftDeg = Math.max(degrees - 180, 0);

  return (
    <View style={ringStyles.container}>
      {/* Track (full muted ring) */}
      <View
        style={[
          ringStyles.track,
          { borderColor: alpha(colors.white, 0.06) },
        ]}
      />

      {/* Right half clip */}
      <View style={ringStyles.halfClipRight}>
        <View
          style={[
            ringStyles.halfCircle,
            {
              borderColor: color,
              borderLeftColor: 'transparent',
              borderBottomColor: 'transparent',
              transform: [{ rotate: `${rightDeg - 45}deg` }],
            },
          ]}
        />
      </View>

      {/* Left half clip */}
      <View style={ringStyles.halfClipLeft}>
        <View
          style={[
            ringStyles.halfCircle,
            {
              borderColor: color,
              borderRightColor: 'transparent',
              borderTopColor: 'transparent',
              transform: [{ rotate: `${leftDeg + 135}deg` }],
            },
          ]}
        />
      </View>

      {/* Center label */}
      <View style={ringStyles.labelWrap}>
        <Text style={[ringStyles.scoreText, { color }]}>{score}</Text>
        <Text style={ringStyles.percentText}>%</Text>
      </View>
    </View>
  );
}

const ringStyles = StyleSheet.create({
  container: {
    width: RING_SIZE,
    height: RING_SIZE,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: RING_SIZE / 2,
    borderWidth: RING_STROKE,
  },
  halfClipRight: {
    position: 'absolute',
    width: RING_SIZE / 2,
    height: RING_SIZE,
    right: 0,
    overflow: 'hidden',
  },
  halfClipLeft: {
    position: 'absolute',
    width: RING_SIZE / 2,
    height: RING_SIZE,
    left: 0,
    overflow: 'hidden',
  },
  halfCircle: {
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: RING_STROKE,
    position: 'absolute',
  },
  labelWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  scoreText: {
    fontSize: 18,
    fontWeight: '800',
    fontFamily: 'Manrope',
    letterSpacing: -0.5,
  },
  percentText: {
    fontSize: 10,
    fontWeight: '600',
    color: alpha(colors.white, 0.35),
    marginLeft: 1,
  },
});

// ---------------------------------------------------------------------------
// Severity Pill
// ---------------------------------------------------------------------------

function SeverityPill({
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
    <View style={[pillStyles.pill, { backgroundColor: alpha(color, 0.12) }]}>
      <View style={[pillStyles.dot, { backgroundColor: color }]} />
      <Text style={[pillStyles.count, { color }]}>{count}</Text>
      <Text style={[pillStyles.label, { color: alpha(color, 0.7) }]}>
        {label}
      </Text>
    </View>
  );
}

const pillStyles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  count: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
  },
});

// ---------------------------------------------------------------------------
// Filler Badge
// ---------------------------------------------------------------------------

function FillerBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <View style={fillerStyles.badge}>
      <Text style={fillerStyles.text}>
        {count} filler{count !== 1 ? 's' : ''}
      </Text>
    </View>
  );
}

const fillerStyles = StyleSheet.create({
  badge: {
    backgroundColor: alpha(colors.tertiary, 0.1),
    borderRadius: borderRadius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  text: {
    fontSize: 11,
    fontWeight: '600',
    color: alpha(colors.tertiary, 0.75),
  },
});

// ---------------------------------------------------------------------------
// MetaItem (icon + text pair)
// ---------------------------------------------------------------------------

function MetaItem({
  icon,
  text,
  color: textColor,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  color?: string;
}) {
  const c = textColor ?? alpha(colors.white, 0.45);
  return (
    <View style={metaStyles.item}>
      <Ionicons name={icon} size={13} color={c} />
      <Text style={[metaStyles.text, { color: c }]}>{text}</Text>
    </View>
  );
}

const metaStyles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  text: {
    fontSize: 12,
    fontWeight: '500',
  },
});

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function SessionRowVariantE({ item }: { item: SessionListItem }) {
  const fillerCount = item.totalFillerCount ?? 0;
  const score = item.clarityScore ?? null;
  const agentName = item.agentName ?? 'Reflexa';
  const avatarSeed = item.agentAvatarSeed ?? null;
  const title = item.title || formatTimeOfDay(item.createdAt);
  const totalCorrections =
    item.errorCount + item.improvementCount + item.polishCount;

  return (
    <View style={styles.card}>
      {/* ── Header: Agent info + timestamp ── */}
      <View style={styles.header}>
        <View style={styles.agentRow}>
          <AgentAvatar seed={avatarSeed} size={28} />
          <Text style={styles.agentName} numberOfLines={1}>
            {agentName}
          </Text>
        </View>
        <Text style={styles.timestamp}>{formatTimeOfDay(item.createdAt)}</Text>
      </View>

      {/* ── Title ── */}
      <Text style={styles.title} numberOfLines={2}>
        {title}
      </Text>

      {/* ── Dashboard body: Score ring + metrics grid ── */}
      <View style={styles.body}>
        {/* Left: Score ring (or placeholder if no score) */}
        {score !== null ? (
          <ScoreRing score={score} />
        ) : (
          <View style={styles.noScore}>
            <Ionicons
              name="analytics-outline"
              size={22}
              color={alpha(colors.white, 0.15)}
            />
            <Text style={styles.noScoreText}>--</Text>
          </View>
        )}

        {/* Right: Metrics column */}
        <View style={styles.metricsColumn}>
          {/* Severity pills row */}
          <View style={styles.pillsRow}>
            <SeverityPill
              count={item.errorCount}
              color={colors.severityError}
              label="err"
            />
            <SeverityPill
              count={item.improvementCount}
              color={colors.severityImprovement}
              label="imp"
            />
            <SeverityPill
              count={item.polishCount}
              color={colors.severityPolish}
              label="pol"
            />
          </View>

          {/* Meta row: duration, topic, fillers */}
          <View style={styles.metaRow}>
            <MetaItem
              icon="time-outline"
              text={formatDurationLong(item.durationSeconds)}
            />
            {item.topicCategory && (
              <MetaItem
                icon={TOPIC_ICONS[item.topicCategory]}
                text={TOPIC_LABELS[item.topicCategory] ?? item.topicCategory}
              />
            )}
            <FillerBadge count={fillerCount} />
          </View>
        </View>
      </View>

      {/* ── Footer: Total corrections summary ── */}
      <View style={styles.footer}>
        <View style={styles.footerLeft}>
          <View style={styles.totalBadge}>
            <Text style={styles.totalBadgeText}>{totalCorrections}</Text>
          </View>
          <Text style={styles.footerLabel}>
            correction{totalCorrections !== 1 ? 's' : ''} total
          </Text>
        </View>
        {item.description ? (
          <Text style={styles.description} numberOfLines={1}>
            {item.description}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  card: {
    ...glass.card,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  agentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
    marginRight: spacing.sm,
  },
  agentName: {
    ...typography.bodySmMedium,
    color: colors.onSurface,
    flex: 1,
  },
  timestamp: {
    ...typography.bodySm,
    color: alpha(colors.white, 0.35),
    fontSize: 12,
  },

  // Title
  title: {
    ...typography.bodyMdMedium,
    color: alpha(colors.white, 0.8),
    lineHeight: 20,
  },

  // Body (dashboard area)
  body: {
    flexDirection: 'row',
    gap: spacing.lg,
    alignItems: 'flex-start',
    paddingTop: spacing.xs,
  },

  // No-score placeholder
  noScore: {
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: RING_STROKE,
    borderColor: alpha(colors.white, 0.06),
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  noScoreText: {
    fontSize: 14,
    fontWeight: '700',
    color: alpha(colors.white, 0.2),
  },

  // Metrics column (right of score ring)
  metricsColumn: {
    flex: 1,
    gap: spacing.sm,
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 2,
  },

  // Footer
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: alpha(colors.white, 0.06),
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  totalBadge: {
    backgroundColor: alpha(colors.primary, 0.12),
    borderRadius: borderRadius.full,
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  totalBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
  },
  footerLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: alpha(colors.white, 0.4),
  },
  description: {
    flex: 1,
    fontSize: 12,
    fontWeight: '400',
    color: alpha(colors.white, 0.25),
    textAlign: 'right',
  },
});
