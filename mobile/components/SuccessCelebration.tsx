import React, { useEffect } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { colors } from '../theme';

// Pre-computed particle configs — positions as % of container, angles, colors
const PARTICLES = [
  // Left side
  { x: 0.08, y: 0.18, angle: -15, color: colors.primary, size: 5, delay: 0 },
  { x: 0.04, y: 0.38, angle: 25, color: colors.secondary, size: 4, delay: 60 },
  { x: 0.12, y: 0.55, angle: -30, color: colors.tertiary, size: 3.5, delay: 120 },
  { x: 0.06, y: 0.72, angle: 10, color: colors.primary, size: 4.5, delay: 40 },
  // Right side
  { x: 0.92, y: 0.15, angle: 20, color: colors.tertiary, size: 4, delay: 30 },
  { x: 0.96, y: 0.35, angle: -25, color: colors.primary, size: 5, delay: 80 },
  { x: 0.88, y: 0.52, angle: 15, color: colors.secondary, size: 3.5, delay: 140 },
  { x: 0.94, y: 0.70, angle: -10, color: colors.tertiary, size: 4.5, delay: 50 },
  // Top area
  { x: 0.25, y: 0.05, angle: 35, color: colors.secondary, size: 3.5, delay: 100 },
  { x: 0.50, y: 0.02, angle: -20, color: colors.primary, size: 4, delay: 70 },
  { x: 0.75, y: 0.06, angle: 40, color: colors.tertiary, size: 3.5, delay: 110 },
  // Scattered mid
  { x: 0.18, y: 0.30, angle: -45, color: colors.primary, size: 3, delay: 90 },
  { x: 0.82, y: 0.28, angle: 30, color: colors.secondary, size: 3, delay: 130 },
];

interface Props {
  visible: boolean;
}

function Particle({
  x,
  y,
  angle,
  color,
  size,
  delay,
  visible,
  containerWidth,
  containerHeight,
}: {
  x: number;
  y: number;
  angle: number;
  color: string;
  size: number;
  delay: number;
  visible: boolean;
  containerWidth: number;
  containerHeight: number;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      progress.value = 0;
      progress.value = withDelay(
        delay,
        withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) }),
      );
    } else {
      progress.value = 0;
    }
  }, [visible, delay, progress]);

  const style = useAnimatedStyle(() => {
    const p = progress.value;
    // Scale: 0 → 1 (at 0.3) → 0 (at 1.0)
    const scale = p < 0.3 ? p / 0.3 : 1 - (p - 0.3) / 0.7;
    // Opacity follows scale but holds longer
    const opacity = p < 0.2 ? p / 0.2 : p > 0.6 ? 1 - (p - 0.6) / 0.4 : 1;
    // Slight drift outward from center
    const drift = p * 8;
    const driftX = drift * Math.cos((angle * Math.PI) / 180);
    const driftY = drift * Math.sin((angle * Math.PI) / 180);
    // Rotation
    const rotate = p * angle * 2;

    return {
      position: 'absolute' as const,
      left: x * containerWidth + driftX,
      top: y * containerHeight + driftY,
      width: size,
      height: size,
      borderRadius: 1,
      backgroundColor: color,
      opacity: opacity * 0.9,
      transform: [
        { scale },
        { rotate: `${rotate}deg` },
      ],
    };
  });

  return <Animated.View style={style} />;
}

export default function SuccessCelebration({ visible }: Props) {
  const { width, height } = useWindowDimensions();

  if (!visible) return null;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.container]} pointerEvents="none">
      {PARTICLES.map((p, i) => (
        <Particle
          key={i}
          {...p}
          visible={visible}
          containerWidth={width}
          containerHeight={height}
        />
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    zIndex: 100,
  },
});
