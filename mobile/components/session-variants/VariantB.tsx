import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, alpha, spacing, glass, typography, borderRadius } from '../../theme';
import { formatTimeOfDay, formatDurationLong } from '../../lib/formatters';
import { AgentAvatar } from '../AgentAvatar';
import type { SessionListItem, TopicCategory } from '../../types/session';

// -- Score color by range --

function getScoreColor(score: number): string {
  if (score >= 90) return colors.severityPolish;
  if (score >= 70) return colors.primary;
  if (score >= 50) return colors.secondary;
  return colors.error;
}

// -- Score tier label --

function getScoreTier(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Fair';
  return 'Needs Work';
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

// -- Correction dot: tiny colored circle with count --

function CorrectionDot({
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
    <View style={dotStyles.container}>
      <View style={[dotStyles.dot, { backgroundColor: color }]} />
      <Text style={[dotStyles.count, { color: alpha(colors.white, 0.7) }]}>
        {count}
      </Text>
      <Text style={dotStyles.label}>{label}</Text>
    </View>
  );
}

const dotStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  count: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  label: {
    fontSize: 11,
    fontWeight: '400',
    color: alpha(colors.white, 0.35),
  },
});

// ---------------------------------------------------------------------------
// Session Row — Variant B: "Bold Score Hero"
// ---------------------------------------------------------------------------

export function SessionRowVariantB({ item }: { item: SessionListItem }) {
  const score = item.clarityScore ?? null;
  const scoreColor = score !== null ? getScoreColor(score) : colors.primary;
  const agentName = item.agentName ?? 'Reflexa';
  const avatarSeed = item.agentAvatarSeed ?? null;
  const fillerCount = item.totalFillerCount ?? 0;
  const title = item.title || formatTimeOfDay(item.createdAt);
  const totalCorrections = item.errorCount + item.improvementCount + item.polishCount;

  return (
    <View style={styles.card}>
      {/* Colored accent strip on the left edge */}
      <View style={[styles.accentStrip, { backgroundColor: scoreColor }]} />
      {/* Score glow behind the strip */}
      <View
        style={[
          styles.accentGlow,
          {
            backgroundColor: scoreColor,
            shadowColor: scoreColor,
          },
        ]}
      />

      <View style={styles.inner}>
        {/* === TOP ROW: Hero score + session info === */}
        <View style={styles.topRow}>
          {/* Score Hero Block */}
          <View style={styles.scoreBlock}>
            {score !== null ? (
              <>
                <View
                  style={[
                    styles.scoreBg,
                    { backgroundColor: alpha(scoreColor, 0.10) },
                  ]}
                >
                  <Text
                    style={[
                      styles.scoreNumber,
                      {
                        color: scoreColor,
                        textShadowColor: alpha(scoreColor, 0.5),
                      },
                    ]}
                  >
                    {score}
                  </Text>
                  <Text style={[styles.scorePercent, { color: alpha(scoreColor, 0.6) }]}>
                    %
                  </Text>
                </View>
                <Text style={[styles.scoreTier, { color: alpha(scoreColor, 0.8) }]}>
                  {getScoreTier(score)}
                </Text>
              </>
            ) : (
              <View style={styles.scoreBgEmpty}>
                <Ionicons name="analytics-outline" size={24} color={alpha(colors.white, 0.2)} />
                <Text style={styles.noScore}>--</Text>
              </View>
            )}
          </View>

          {/* Session details */}
          <View style={styles.detailsBlock}>
            {/* Agent + time header */}
            <View style={styles.agentRow}>
              <AgentAvatar seed={avatarSeed} size={22} />
              <Text style={styles.agentName} numberOfLines={1}>
                {agentName}
              </Text>
              <Text style={styles.time}>{formatTimeOfDay(item.createdAt)}</Text>
            </View>

            {/* Session title */}
            <Text style={styles.title} numberOfLines={2}>
              {title}
            </Text>

            {/* Meta line: duration + topic */}
            <View style={styles.metaRow}>
              <Ionicons
                name="time-outline"
                size={12}
                color={alpha(colors.white, 0.35)}
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
          </View>
        </View>

        {/* === BOTTOM ROW: Correction breakdown + fillers === */}
        <View style={styles.bottomRow}>
          <View style={styles.corrections}>
            <CorrectionDot
              count={item.errorCount}
              color={colors.severityError}
              label="err"
            />
            <CorrectionDot
              count={item.improvementCount}
              color={colors.severityImprovement}
              label="imp"
            />
            <CorrectionDot
              count={item.polishCount}
              color={colors.severityPolish}
              label="pol"
            />
            {totalCorrections === 0 && (
              <Text style={styles.noneText}>No corrections</Text>
            )}
          </View>

          <View style={styles.bottomRight}>
            {fillerCount > 0 && (
              <View style={styles.fillerBadge}>
                <Text style={styles.fillerText}>
                  {fillerCount} filler{fillerCount !== 1 ? 's' : ''}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const SCORE_BLOCK_WIDTH = 76;

const styles = StyleSheet.create({
  card: {
    ...glass.card,
    overflow: 'hidden',
    marginBottom: spacing.sm,
    position: 'relative',
  },

  // -- Left accent strip --
  accentStrip: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    borderTopLeftRadius: borderRadius.default,
    borderBottomLeftRadius: borderRadius.default,
  },
  accentGlow: {
    position: 'absolute',
    left: -4,
    top: '20%' as unknown as number,
    bottom: '20%' as unknown as number,
    width: 10,
    opacity: 0.35,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 12,
    elevation: 4,
    borderRadius: 5,
  },

  // -- Inner content --
  inner: {
    padding: spacing.lg,
    paddingLeft: spacing.lg + 4, // offset from accent strip
  },

  // -- Top row: score + details side by side --
  topRow: {
    flexDirection: 'row',
    gap: spacing.lg,
  },

  // -- Score hero block --
  scoreBlock: {
    width: SCORE_BLOCK_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  scoreBg: {
    width: SCORE_BLOCK_WIDTH,
    height: 58,
    borderRadius: borderRadius.sm,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    paddingTop: 6,
  },
  scoreNumber: {
    ...typography.displayMd,
    fontSize: 38,
    lineHeight: 42,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
  },
  scorePercent: {
    fontSize: 16,
    fontWeight: '800',
    marginLeft: 1,
    marginBottom: 2,
    fontFamily: 'Manrope',
  },
  scoreTier: {
    ...typography.labelSm,
    marginTop: 2,
  },
  scoreBgEmpty: {
    width: SCORE_BLOCK_WIDTH,
    height: 58,
    borderRadius: borderRadius.sm,
    backgroundColor: alpha(colors.white, 0.04),
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  noScore: {
    fontSize: 18,
    fontWeight: '700',
    color: alpha(colors.white, 0.15),
    letterSpacing: 2,
    fontFamily: 'Manrope',
  },

  // -- Details block --
  detailsBlock: {
    flex: 1,
    gap: 4,
    justifyContent: 'center',
  },
  agentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  agentName: {
    ...typography.bodySmMedium,
    color: colors.onSurface,
    flex: 1,
  },
  time: {
    ...typography.bodySm,
    fontSize: 11,
    color: alpha(colors.white, 0.35),
  },
  title: {
    ...typography.bodyMdMedium,
    color: alpha(colors.white, 0.85),
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '400',
    color: alpha(colors.white, 0.35),
  },
  metaDot: {
    width: 2.5,
    height: 2.5,
    borderRadius: 1.25,
    backgroundColor: alpha(colors.white, 0.2),
  },

  // -- Bottom row: corrections + fillers --
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: alpha(colors.white, 0.06),
  },
  corrections: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  noneText: {
    fontSize: 12,
    fontWeight: '400',
    color: alpha(colors.white, 0.25),
  },
  bottomRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  fillerBadge: {
    backgroundColor: alpha(colors.white, 0.05),
    borderRadius: borderRadius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  fillerText: {
    fontSize: 11,
    fontWeight: '500',
    color: alpha(colors.white, 0.4),
  },
});
