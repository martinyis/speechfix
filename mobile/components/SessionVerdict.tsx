import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import Animated, {
  useSharedValue,
  withTiming,
  Easing,
  runOnJS,
  useAnimatedReaction,
} from 'react-native-reanimated';
import { colors, alpha, fonts, spacing, layout } from '../theme';
import type { SessionInsight, FillerWord } from '../types/session';

interface SessionVerdictProps {
  insights: SessionInsight[];
  fillerWords: FillerWord[];
  durationSeconds: number;
  isFresh?: boolean;
  isLoading?: boolean;
}

// Score color interpolation: red (0) → amber (50) → green (80+)
function scoreColor(score: number): string {
  if (score >= 80) return '#34d399'; // green
  if (score >= 60) return '#fbbf24'; // amber
  if (score >= 40) return '#fb923c'; // orange
  return '#ff6e84'; // red
}

export function SessionVerdict({
  insights,
  fillerWords,
  durationSeconds,
  isFresh,
  isLoading,
}: SessionVerdictProps) {
  const scoreInsight = insights.find(i => i.type === 'score');
  const score = typeof scoreInsight?.value === 'number' ? scoreInsight.value : null;
  const qualityAssessment = insights.find(i => i.type === 'quality_assessment');
  const strengths = insights.filter(i => i.type === 'strength');
  const focusAreas = insights.filter(i => i.type === 'focus_area');

  // Filler data
  const totalFillers = fillerWords.reduce((sum, f) => sum + f.count, 0);
  const minutes = durationSeconds / 60;
  const fillersPerMin = minutes > 0 ? +(totalFillers / minutes).toFixed(1) : 0;
  const hasFillers = totalFillers > 0;

  // Animated score count-up using shared value → JS state bridge
  const [displayScore, setDisplayScore] = useState(isFresh ? 0 : (score ?? 0));
  const animatedScore = useSharedValue(isFresh ? 0 : (score ?? 0));

  useAnimatedReaction(
    () => Math.round(animatedScore.value),
    (current) => { runOnJS(setDisplayScore)(current); },
  );

  useEffect(() => {
    if (score != null && isFresh) {
      animatedScore.value = 0;
      animatedScore.value = withTiming(score, {
        duration: 800,
        easing: Easing.out(Easing.cubic),
      });
    } else if (score != null) {
      animatedScore.value = score;
      setDisplayScore(score);
    }
  }, [score, isFresh]);

  const color = score != null ? scoreColor(score) : alpha(colors.white, 0.3);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={styles.loadingText}>Generating insights...</Text>
      </View>
    );
  }

  // Don't render if no meaningful data
  if (!qualityAssessment && score == null) return null;

  return (
    <View style={styles.container}>
      {/* Score */}
      {score != null && (
        <View style={styles.scoreSection}>
          <Text style={[styles.scoreNumber, { color }]}>
            {displayScore}
          </Text>
          <Text style={[styles.scoreLabel, { color: alpha(color, 0.6) }]}>
            / 100
          </Text>
        </View>
      )}

      {/* Quality assessment */}
      {qualityAssessment && (
        <Text style={styles.assessment}>
          {qualityAssessment.description}
        </Text>
      )}

      {/* Filler chips */}
      {hasFillers && (
        <View style={styles.fillerRow}>
          {fillerWords.map(f => (
            <View key={f.word} style={styles.fillerChip}>
              <Text style={styles.fillerChipText}>
                "{f.word}" <Text style={styles.fillerChipCount}>{'\u00D7'}{f.count}</Text>
              </Text>
            </View>
          ))}
          <Text style={styles.fillerRate}>{fillersPerMin}/min</Text>
        </View>
      )}

      {/* Strength */}
      {strengths.length > 0 && (
        <View style={styles.insightLine}>
          <View style={[styles.dot, { backgroundColor: colors.severityPolish }]} />
          <Text style={styles.insightText}>
            {strengths.map(s => s.description).join('. ')}
          </Text>
        </View>
      )}

      {/* Focus area */}
      {focusAreas.length > 0 && (
        <View style={styles.insightLine}>
          <View style={[styles.dot, { backgroundColor: colors.secondary }]} />
          <Text style={styles.insightText}>
            {focusAreas.map(f => f.description).join('. ')}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: 8,
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
  scoreSection: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  scoreNumber: {
    fontSize: 56,
    fontFamily: fonts.extrabold,
    letterSpacing: -2,
    lineHeight: 64,
  },
  scoreLabel: {
    fontSize: 20,
    fontFamily: fonts.medium,
    marginLeft: 4,
  },
  assessment: {
    fontSize: 15,
    fontFamily: fonts.regular,
    color: alpha(colors.white, 0.55),
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  fillerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.lg,
  },
  fillerChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: alpha(colors.white, 0.05),
    borderWidth: 1,
    borderColor: alpha(colors.white, 0.08),
  },
  fillerChipText: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: alpha(colors.white, 0.55),
  },
  fillerChipCount: {
    fontFamily: fonts.bold,
    color: alpha(colors.white, 0.35),
  },
  fillerRate: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: alpha(colors.white, 0.3),
  },
  insightLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  insightText: {
    flex: 1,
    fontSize: 14,
    fontFamily: fonts.regular,
    color: alpha(colors.white, 0.5),
    lineHeight: 20,
  },
});
