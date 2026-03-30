import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  type SharedValue,
} from 'react-native-reanimated';
import { colors, alpha, typography, fonts } from '../../theme';

interface MiniScoreRingProps {
  score: number;
  color: string;
  size?: number;
}

const DOT_COUNT = 20;
const DOT_SIZE = 3.5;
const UNFILLED_COLOR = alpha(colors.white, 0.06);

function MiniScoreRingInner({ score, color, size = 48 }: MiniScoreRingProps) {
  const progress = useSharedValue(0);
  const radius = (size - DOT_SIZE) / 2;
  const filledCount = Math.round((score / 100) * DOT_COUNT);
  const anglePerDot = 360 / DOT_COUNT;

  useEffect(() => {
    progress.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.cubic) });
  }, []);

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Dot ring */}
      {Array.from({ length: DOT_COUNT }).map((_, i) => {
        const angle = (i * anglePerDot - 90) * (Math.PI / 180);
        const x = radius * Math.cos(angle);
        const y = radius * Math.sin(angle);
        const isFilled = i < filledCount;

        return (
          <AnimatedDot
            key={i}
            index={i}
            filledCount={filledCount}
            isFilled={isFilled}
            color={color}
            x={size / 2 + x - DOT_SIZE / 2}
            y={size / 2 + y - DOT_SIZE / 2}
            progress={progress}
          />
        );
      })}

      {/* Center score */}
      <View style={styles.center}>
        <Text style={styles.scoreText}>{score}</Text>
      </View>
    </View>
  );
}

interface AnimatedDotProps {
  index: number;
  filledCount: number;
  isFilled: boolean;
  color: string;
  x: number;
  y: number;
  progress: SharedValue<number>;
}

function AnimatedDotInner({
  index,
  filledCount,
  isFilled,
  color,
  x,
  y,
  progress,
}: AnimatedDotProps) {
  // Precompute colors on JS thread — worklets can't call alpha()
  const filledColor = color;
  const unfilledColor = UNFILLED_COLOR;

  const animatedStyle = useAnimatedStyle(() => {
    'worklet';
    const threshold = index / filledCount;
    const isActive = isFilled && progress.value >= threshold;

    return {
      backgroundColor: isActive ? filledColor : unfilledColor,
      opacity: isActive ? 1 : 0.5,
    };
  });

  return (
    <Animated.View
      style={[
        styles.dot,
        { left: x, top: y },
        animatedStyle,
      ]}
    />
  );
}

const AnimatedDot = React.memo(AnimatedDotInner);

export const MiniScoreRing = React.memo(MiniScoreRingInner);

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreText: {
    ...typography.labelSm,
    color: colors.onSurface,
    fontSize: 11,
    fontFamily: fonts.bold,
    letterSpacing: 0,
    textTransform: 'none',
  },
});
