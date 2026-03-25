import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { colors, alpha, typography, spacing } from '../../theme';
import type { FeaturedPattern } from './mockData';

interface FeaturedPatternCardProps {
  pattern: FeaturedPattern;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function FeaturedPatternCardInner({ pattern }: FeaturedPatternCardProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const onPressIn = () => {
    scale.value = withSpring(0.97, { damping: 15, stiffness: 200 });
  };

  const onPressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 200 });
  };

  return (
    <AnimatedPressable
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[styles.card, animatedStyle]}
    >
      {/* Gradient background */}
      <LinearGradient
        colors={[
          alpha(colors.primary, 0.12),
          alpha(colors.secondary, 0.08),
          alpha(colors.white, 0.02),
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={styles.content}>
        {/* Label */}
        <Text style={styles.label}>{pattern.label}</Text>

        {/* Title + subtitle */}
        <Text style={styles.title}>{pattern.title}</Text>
        <Text style={styles.subtitle}>{pattern.subtitle}</Text>

        {/* Correction diff */}
        <View style={styles.diffContainer}>
          <Text style={styles.diffOriginal}>{pattern.original}</Text>
          <Ionicons
            name="arrow-forward"
            size={14}
            color={alpha(colors.white, 0.3)}
            style={styles.diffArrow}
          />
          <Text style={styles.diffCorrected}>{pattern.corrected}</Text>
        </View>

        {/* Bottom row */}
        <View style={styles.bottomRow}>
          <Text style={styles.occurrences}>
            {pattern.occurrences} occurrences
          </Text>
          <View style={styles.trendIndicator}>
            <Ionicons
              name="trending-up"
              size={12}
              color={colors.severityPolish}
            />
            <Text style={styles.trendText}>+{pattern.trend}%</Text>
          </View>
        </View>
      </View>
    </AnimatedPressable>
  );
}

export const FeaturedPatternCard = React.memo(FeaturedPatternCardInner);

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: alpha(colors.white, 0.08),
  },
  content: {
    padding: spacing.xl,
  },
  label: {
    ...typography.labelSm,
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.headlineSm,
    color: colors.onSurface,
  },
  subtitle: {
    ...typography.bodyMd,
    color: colors.onSurfaceVariant,
    marginTop: 4,
    marginBottom: spacing.lg,
  },
  diffContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    backgroundColor: alpha(colors.white, 0.04),
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  diffOriginal: {
    ...typography.bodyMd,
    color: alpha(colors.white, 0.4),
    textDecorationLine: 'line-through',
  },
  diffArrow: {
    marginHorizontal: 2,
  },
  diffCorrected: {
    ...typography.bodyMdMedium,
    color: colors.primary,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  occurrences: {
    ...typography.bodySm,
    color: alpha(colors.white, 0.4),
  },
  trendIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trendText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.severityPolish,
  },
});
