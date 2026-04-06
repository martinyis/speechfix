import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { QueuedPatternCard } from '../QueuedPatternCard';
import { GlassIconPillButton } from '../ui';
import { colors, alpha, fonts, spacing, layout } from '../../theme';
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

  return (
    <View style={styles.container}>
      {/* Active pattern */}
      {active && (
        <>
          <Text style={styles.sectionLabel}>ACTIVE PATTERN</Text>
          <View style={styles.activeCard}>
            <View style={styles.activeHeader}>
              <Text style={styles.activeTitle} numberOfLines={1}>
                {active.identifier ? `"${active.identifier}"` : PATTERN_TYPE_LABEL[active.type] ?? active.type}
              </Text>
              {active.isReturning && (
                <View style={styles.returningBadge}>
                  <Text style={styles.returningText}>Came back</Text>
                </View>
              )}
            </View>
            {active.identifier && (
              <Text style={styles.activeType}>
                {PATTERN_TYPE_LABEL[active.type] ?? active.type}
              </Text>
            )}

            {/* Level indicator */}
            <Text style={styles.levelLabel}>
              {LEVEL_LABEL[active.currentLevel] ?? `Level ${active.currentLevel}`}
            </Text>

            {/* Progress bar */}
            <View style={styles.progressRow}>
              <View style={styles.progressBarBg}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: active.levelProgress.total > 0
                        ? `${(active.levelProgress.completed / active.levelProgress.total) * 100}%`
                        : '0%',
                    },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                {active.levelProgress.completed}/{active.levelProgress.total}
              </Text>
            </View>

            <GlassIconPillButton
              label="Continue Practicing"
              icon="play"
              variant="primary"
              fullWidth
              onPress={handleStartPracticing}
            />
          </View>
        </>
      )}

      {/* Queued patterns */}
      {queued.length > 0 && (
        <>
          <Text style={[styles.sectionLabel, active && { marginTop: spacing.xl }]}>
            UP NEXT
          </Text>
          {queued.map((pattern) => (
            <QueuedPatternCard key={pattern.patternId} pattern={pattern} />
          ))}
        </>
      )}

      {/* See all link */}
      <View style={styles.buttonsWrap}>
        <GlassIconPillButton
          label="See All Patterns"
          variant="secondary"
          fullWidth
          noIcon
          onPress={() => router.push('/patterns-list')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  sectionLabel: {
    fontSize: 10,
    fontFamily: fonts.bold,
    color: alpha(colors.white, 0.2),
    letterSpacing: 1.5,
    paddingHorizontal: layout.screenPadding,
    marginBottom: 12,
  },
  activeCard: {
    marginHorizontal: layout.screenPadding,
    gap: 12,
  },
  activeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activeTitle: {
    fontSize: 22,
    fontFamily: fonts.extrabold,
    color: colors.onSurface,
    letterSpacing: -0.5,
    flex: 1,
  },
  activeType: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: alpha(colors.white, 0.35),
    marginTop: -6,
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
  levelLabel: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: alpha(colors.primary, 0.7),
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
  progressText: {
    fontSize: 12,
    fontFamily: fonts.semibold,
    color: alpha(colors.white, 0.35),
  },
  buttonsWrap: {
    gap: 10,
    paddingHorizontal: layout.screenPadding,
    marginTop: spacing.xxl,
  },
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
