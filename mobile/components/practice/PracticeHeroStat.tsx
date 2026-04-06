import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  interpolate,
  type SharedValue,
} from 'react-native-reanimated';
import { colors, alpha, fonts, spacing, layout, typography } from '../../theme';
import type { PracticeModeInfo } from '../../hooks/usePracticeModes';

const SEVERITY_COLOR: Record<string, string> = {
  error: colors.severityError,
  improvement: colors.severityImprovement,
  polish: colors.severityPolish,
};

interface PracticeHeroStatProps {
  modes: PracticeModeInfo[];
  severityCounts: Record<string, number>;
  activeIndex: SharedValue<number>;
}

export function PracticeHeroStat({ modes, severityCounts, activeIndex }: PracticeHeroStatProps) {
  return (
    <View style={styles.container}>
      {modes.map((mode, i) => (
        <HeroSlide
          key={mode.key}
          mode={mode}
          index={i}
          activeIndex={activeIndex}
          severityCounts={mode.key === 'corrections' ? severityCounts : undefined}
        />
      ))}
    </View>
  );
}

function HeroSlide({
  mode,
  index,
  activeIndex,
  severityCounts,
}: {
  mode: PracticeModeInfo;
  index: number;
  activeIndex: SharedValue<number>;
  severityCounts?: Record<string, number>;
}) {
  // Crossfade at 1.2x speed: narrower interpolation range
  const animStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      activeIndex.value,
      [index - 0.4, index, index + 0.4],
      [0, 1, 0],
      'clamp',
    );
    const translateX = interpolate(
      activeIndex.value,
      [index - 1, index, index + 1],
      [-30, 0, 30],
    );
    return {
      opacity,
      transform: [{ translateX }],
    };
  });

  return (
    <Animated.View style={[styles.slide, animStyle]}>
      {mode.key === 'corrections' && (
        <CorrectionsHero remaining={mode.stats.remaining} total={mode.stats.total} severityCounts={severityCounts} />
      )}
      {mode.key === 'filler_words' && <FillerWordsHero />}
      {mode.key === 'patterns' && (
        <PatternsHero remaining={mode.stats.remaining} />
      )}
    </Animated.View>
  );
}

function CorrectionsHero({
  remaining,
  total,
  severityCounts,
}: {
  remaining: number;
  total: number;
  severityCounts?: Record<string, number>;
}) {
  return (
    <View style={styles.heroContent}>
      <Text style={styles.heroNumber}>{remaining}</Text>
      <Text style={styles.heroLabel}>corrections remaining</Text>
      {severityCounts && Object.keys(severityCounts).length > 0 && (
        <View style={styles.severityRow}>
          {(['error', 'improvement', 'polish'] as const).map((sev) => {
            const count = severityCounts[sev];
            if (!count) return null;
            return (
              <View key={sev} style={styles.severityItem}>
                <View style={[styles.severityDot, { backgroundColor: SEVERITY_COLOR[sev] }]} />
                <Text style={styles.severityText}>{count}</Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

function FillerWordsHero() {
  return (
    <View style={styles.heroContent}>
      <Ionicons
        name="chatbubbles-outline"
        size={36}
        color={colors.secondary}
        style={{ marginBottom: spacing.sm }}
      />
      <Text style={styles.heroTitle}>Filler Word Coach</Text>
      <Text style={styles.heroSubtitle}>Practice in live conversation</Text>
    </View>
  );
}

function PatternsHero({ remaining }: { remaining: number }) {
  return (
    <View style={styles.heroContent}>
      <Text style={styles.heroNumber}>{remaining}</Text>
      <Text style={styles.heroLabel}>patterns remaining</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  slide: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroContent: {
    alignItems: 'center',
  },
  heroNumber: {
    ...typography.displayLg,
    color: colors.onSurface,
    lineHeight: 52,
  },
  heroLabel: {
    fontSize: 15,
    fontFamily: fonts.regular,
    color: alpha(colors.white, 0.4),
    marginTop: 4,
  },
  heroTitle: {
    fontSize: 20,
    fontFamily: fonts.extrabold,
    color: colors.onSurface,
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: alpha(colors.white, 0.4),
    marginTop: 4,
  },
  severityRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: spacing.md,
  },
  severityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  severityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  severityText: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: alpha(colors.white, 0.5),
  },
});
