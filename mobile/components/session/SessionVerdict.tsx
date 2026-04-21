import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { colors, alpha, fonts, spacing, layout } from '../../theme';
import type { SessionInsight, FillerWord } from '../../types/session';

interface SessionVerdictProps {
  insights: SessionInsight[];
  fillerWords: FillerWord[];
  durationSeconds: number;
  isFresh?: boolean;
  isLoading?: boolean;
}

const NARRATIVE_DELAY_MS = 400;

export function SessionVerdict({
  insights,
  isFresh,
  isLoading,
}: SessionVerdictProps) {
  const qualityAssessment = insights.find(i => i.type === 'quality_assessment');

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={styles.loadingText}>Generating insights...</Text>
      </View>
    );
  }

  if (!qualityAssessment) return null;

  return (
    <View style={styles.container}>
      <Animated.Text
        entering={isFresh ? FadeIn.duration(500).delay(NARRATIVE_DELAY_MS) : undefined}
        style={styles.assessment}
      >
        {qualityAssessment.description}
      </Animated.Text>
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
  assessment: {
    fontSize: 15,
    fontFamily: fonts.regular,
    color: alpha(colors.white, 0.6),
    lineHeight: 22,
    textAlign: 'center',
  },
});
