import { View, Text, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { GlassIconPillButton } from '../ui';
import { colors, alpha, fonts, typography, spacing, layout } from '../../theme';
import type { ActivePattern, QueuedPattern } from '../../types/practice';

const PATTERN_TYPE_LABEL: Record<string, string> = {
  overused_word: 'Overused Word',
  repetitive_starter: 'Sentence Starter',
  crutch_phrase: 'Crutch Phrase',
  hedging: 'Hedging',
  negative_framing: 'Negative Framing',
};

const LEVEL_LABEL: Record<number, string> = {
  1: 'Level 1 — Guided',
  2: 'Level 2 — Free',
};

interface PatternsModeProps {
  active: ActivePattern | null;
  queued: QueuedPattern[];
}

export function PatternsMode({ active, queued }: PatternsModeProps) {
  if (!active && queued.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <Ionicons name="pulse-outline" size={48} color={alpha(colors.white, 0.15)} />
        <Text style={styles.emptyTitle}>No patterns yet</Text>
        <Text style={styles.emptySubtitle}>
          Keep talking to discover speech patterns.
        </Text>
      </View>
    );
  }

  const handleStartPracticing = () => {
    if (!active) return;
    router.push({
      pathname: '/pattern-practice-session',
      params: { patternId: String(active.patternId) },
    });
  };

  const handleQueueTap = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/patterns-list');
  };

  const progressPct =
    active && active.levelProgress.total > 0
      ? (active.levelProgress.completed / active.levelProgress.total) * 100
      : 0;

  return (
    <View style={styles.container}>
      <InlineStats
        parts={[{ value: queued.length, label: 'in queue' }]}
      />

      {/* Hero — compact active pattern */}
      {active && (
        <View style={styles.hero}>
          <View style={styles.heroHeader}>
            <Text style={styles.heroId} numberOfLines={1}>
              {active.identifier ? `"${active.identifier}"` : PATTERN_TYPE_LABEL[active.type] ?? active.type}
            </Text>
            {active.isReturning && (
              <View style={styles.returningBadge}>
                <Text style={styles.returningText}>Came back</Text>
              </View>
            )}
          </View>

          <View style={styles.progressRow}>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${progressPct}%` }]} />
            </View>
            <Text style={styles.progressFraction}>
              {active.levelProgress.completed}/{active.levelProgress.total}
            </Text>
          </View>

          <View style={styles.heroMeta}>
            <Text style={styles.heroLevel}>
              {LEVEL_LABEL[active.currentLevel] ?? `Level ${active.currentLevel}`}
            </Text>
            {active.identifier && (
              <>
                <Text style={styles.heroMetaDot}>·</Text>
                <Text style={styles.heroType} numberOfLines={1}>
                  {PATTERN_TYPE_LABEL[active.type] ?? active.type}
                </Text>
              </>
            )}
          </View>

          <GlassIconPillButton
            icon="play"
            label="Continue Practicing"
            variant="primary"
            fullWidth
            onPress={handleStartPracticing}
          />
        </View>
      )}

      {/* UP NEXT — compact flow rows */}
      {queued.length > 0 && (
        <View style={styles.flowQueue}>
          <Text style={styles.sectionLabel}>UP NEXT</Text>
          {queued.map((p) => (
            <Pressable
              key={p.patternId}
              style={styles.flowQueueRow}
              onPress={handleQueueTap}
            >
              <Text style={styles.flowQueueId} numberOfLines={1}>
                {p.identifier ? `"${p.identifier}"` : PATTERN_TYPE_LABEL[p.type] ?? p.type}
              </Text>
              <Text style={styles.flowQueueType} numberOfLines={1}>
                {PATTERN_TYPE_LABEL[p.type] ?? p.type}
              </Text>
              <View style={{ flex: 1 }} />
              <Text style={styles.flowQueueFreq}>{p.frequency}x</Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* See all link — route to full list (incl. resolved) */}
      <View style={styles.divider} />
      <Pressable style={styles.seeAllRow} onPress={handleQueueTap}>
        <Text style={styles.seeAllText}>See all patterns</Text>
        <Ionicons name="chevron-forward" size={16} color={alpha(colors.white, 0.3)} />
      </Pressable>
    </View>
  );
}

// ── InlineStats ───────────────────────────────────────────────────────

function InlineStats({ parts }: { parts: { value: number; label: string }[] }) {
  return (
    <Text style={styles.inlineStats}>
      {parts.map((p, i) => (
        <Text key={p.label}>
          {i > 0 && <Text style={styles.inlineStatsSep}> · </Text>}
          <Text style={styles.inlineStatsValue}>{p.value}</Text> {p.label}
        </Text>
      ))}
    </Text>
  );
}

// ── Styles ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: layout.screenPadding,
    gap: spacing.lg,
  },

  // Inline stats
  inlineStats: {
    ...typography.bodySm,
    color: alpha(colors.white, 0.35),
  },
  inlineStatsValue: {
    ...typography.bodySmMedium,
    color: alpha(colors.white, 0.5),
  },
  inlineStatsSep: {
    color: alpha(colors.white, 0.2),
  },

  // Section label
  sectionLabel: {
    fontSize: 10,
    fontFamily: fonts.bold,
    color: alpha(colors.white, 0.2),
    letterSpacing: 1.5,
  },

  // Divider
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: alpha(colors.white, 0.06),
  },

  // Hero
  hero: {
    gap: spacing.md,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  heroId: {
    fontSize: 24,
    fontFamily: fonts.extrabold,
    color: colors.onSurface,
    letterSpacing: -0.75,
    flex: 1,
  },
  returningBadge: {
    backgroundColor: alpha(colors.tertiary, 0.15),
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  returningText: {
    fontSize: 10,
    fontFamily: fonts.bold,
    color: colors.tertiary,
    letterSpacing: 0.5,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  progressBarBg: {
    flex: 1,
    height: 4,
    backgroundColor: alpha(colors.white, 0.06),
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  progressFraction: {
    ...typography.bodySmMedium,
    color: alpha(colors.white, 0.4),
  },
  heroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  heroLevel: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: alpha(colors.primary, 0.7),
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  heroMetaDot: {
    ...typography.bodySm,
    color: alpha(colors.white, 0.2),
  },
  heroType: {
    ...typography.bodySm,
    color: alpha(colors.white, 0.35),
  },

  // Flow queue
  flowQueue: {
    gap: spacing.sm,
  },
  flowQueueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  flowQueueId: {
    ...typography.bodyMdMedium,
    color: colors.onSurface,
    maxWidth: '45%',
  },
  flowQueueType: {
    ...typography.bodySm,
    color: alpha(colors.white, 0.3),
  },
  flowQueueFreq: {
    ...typography.bodySmMedium,
    color: alpha(colors.white, 0.35),
  },

  // See all
  seeAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  seeAllText: {
    ...typography.bodyMdMedium,
    color: alpha(colors.white, 0.4),
  },

  // Empty
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 100,
    gap: spacing.sm,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: fonts.semibold,
    color: colors.onSurface,
    marginTop: spacing.sm,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: alpha(colors.white, 0.35),
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 20,
  },
});
