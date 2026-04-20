import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { colors, alpha, fonts, spacing, layout } from '../theme';
import { ScoreRing } from './ScoreRing';
import type { SessionInsight, FillerWord } from '../types/session';

interface SessionVerdictProps {
  insights: SessionInsight[];
  /** Not used in Phase 1 render but kept for upstream compatibility */
  fillerWords: FillerWord[];
  /** Not used in Phase 1 render but kept for upstream compatibility */
  durationSeconds: number;
  isFresh?: boolean;
  isLoading?: boolean;
}

// Narrative fades in ~1.1s after rings start, matching the ~1.0s sweep + settle
const NARRATIVE_DELAY_MS = 1100;
const LANGUAGE_STAGGER_MS = 150;

function readScore(insights: SessionInsight[], type: SessionInsight['type']): number | null {
  const hit = insights.find(i => i.type === type);
  return typeof hit?.value === 'number' ? hit.value : null;
}

export function SessionVerdict({
  insights,
  isFresh,
  isLoading,
}: SessionVerdictProps) {
  const delivery = readScore(insights, 'delivery_score');
  const language = readScore(insights, 'language_score');
  const legacy = readScore(insights, 'score');
  const qualityAssessment = insights.find(i => i.type === 'quality_assessment');

  const hasTwin = delivery !== null || language !== null;
  const hasLegacy = !hasTwin && legacy !== null;

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={styles.loadingText}>Generating insights...</Text>
      </View>
    );
  }

  // Nothing renderable
  if (!hasTwin && !hasLegacy && !qualityAssessment) return null;

  return (
    <View style={styles.container}>
      {hasTwin && (
        <View style={styles.ringsRow}>
          <View style={styles.ringCell}>
            <ScoreRing
              score={delivery}
              label="Delivery"
              size={140}
              animate={isFresh}
              startDelayMs={0}
            />
          </View>
          <View style={styles.ringCell}>
            <ScoreRing
              score={language}
              label="Language"
              size={140}
              animate={isFresh}
              startDelayMs={LANGUAGE_STAGGER_MS}
            />
          </View>
        </View>
      )}

      {hasLegacy && (
        <View style={styles.legacyWrap}>
          <ScoreRing
            score={legacy}
            label="Session"
            size={160}
            animate={isFresh}
          />
        </View>
      )}

      {qualityAssessment && (
        <Animated.Text
          entering={isFresh ? FadeIn.duration(500).delay(NARRATIVE_DELAY_MS) : undefined}
          style={styles.assessment}
        >
          {qualityAssessment.description}
        </Animated.Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: layout.screenPadding,
    paddingVertical: spacing.xl,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: alpha(colors.white, 0.4),
  },
  ringsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
  },
  ringCell: {
    flex: 1,
    alignItems: 'center',
  },
  legacyWrap: {
    alignItems: 'center',
  },
  assessment: {
    fontSize: 15,
    fontFamily: fonts.regular,
    color: alpha(colors.white, 0.6),
    lineHeight: 22,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
