import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { colors, alpha, fonts, spacing, layout } from '../../theme';
import type { DeepInsight } from '../../types/session';

interface InsightsOverallProps {
  insights: DeepInsight[];
  animate?: boolean;
}

export function InsightsOverall({ insights, animate }: InsightsOverallProps) {
  const overall = insights.filter(i => i.type === 'overall');
  if (overall.length === 0) return null;

  return (
    <Animated.View
      style={styles.container}
      entering={animate ? FadeIn.duration(400) : undefined}
    >
      {overall.map((ins, i) => (
        <View key={i} style={styles.item}>
          <Text style={styles.tag}>OVERALL</Text>
          <Text style={styles.headline}>{ins.headline}</Text>
          <Text style={styles.unpack}>{ins.unpack}</Text>
        </View>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: layout.screenPadding,
    paddingVertical: spacing.lg,
  },
  item: {
    marginBottom: 40,
  },
  tag: {
    fontSize: 10,
    fontFamily: fonts.semibold,
    color: alpha(colors.white, 0.25),
    letterSpacing: 1.8,
    marginBottom: 8,
  },
  headline: {
    fontSize: 22,
    lineHeight: 28,
    fontFamily: fonts.extrabold,
    letterSpacing: -0.5,
    color: alpha(colors.white, 0.95),
    marginBottom: 6,
  },
  unpack: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: fonts.regular,
    color: alpha(colors.white, 0.55),
  },
});
