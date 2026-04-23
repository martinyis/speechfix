import React, { useEffect } from 'react';
import { Canvas, Circle, Group } from '@shopify/react-native-skia';
import * as Haptics from 'expo-haptics';
import {
  useSharedValue,
  withDelay,
  withTiming,
  withSequence,
  Easing,
  type SharedValue,
} from 'react-native-reanimated';
import { colors, alpha } from '../../theme';

const RING_COUNT = 4;

function Ring({
  r,
  opacity,
  color,
  cx,
  cy,
}: {
  r: SharedValue<number>;
  opacity: SharedValue<number>;
  color: string;
  cx: number;
  cy: number;
}) {
  return (
    <Circle
      cx={cx}
      cy={cy}
      r={r}
      color={color}
      style="stroke"
      strokeWidth={2}
      opacity={opacity}
    />
  );
}

export interface PulseRingsProps {
  accent: string;
  /** Canvas size. Rings expand from center to half this size. */
  size?: number;
  /** Emit triple haptic tap synced to the pulse (default: true) */
  withHaptic?: boolean;
  /** Delay before the first ring starts (ms) */
  startDelay?: number;
  /** Show small center dot (default: false) */
  centerDot?: boolean;
}

/**
 * Concentric Skia rings that radiate outward from the center on mount,
 * synced to a triple haptic tap. Used as the signature entry effect on the
 * shared SuccessScreen. Renders as a square canvas — caller is responsible
 * for positioning (typically absolutely behind a focal title).
 */
export default function PulseRings({
  accent,
  size = 380,
  withHaptic = true,
  startDelay = 0,
  centerDot = false,
}: PulseRingsProps) {
  const rings = Array.from({ length: RING_COUNT }).map(() => ({
    r: useSharedValue(0),
    opacity: useSharedValue(0),
  }));

  useEffect(() => {
    rings.forEach((ring, i) => {
      const delay = startDelay + 80 + i * 180;
      ring.opacity.value = withDelay(
        delay,
        withSequence(
          withTiming(0.55, { duration: 180 }),
          withTiming(0, { duration: 1400, easing: Easing.out(Easing.quad) }),
        ),
      );
      ring.r.value = withDelay(
        delay,
        withTiming(size / 2, {
          duration: 1600,
          easing: Easing.out(Easing.cubic),
        }),
      );
    });
    if (withHaptic) {
      setTimeout(
        () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
        startDelay,
      );
      setTimeout(
        () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
        startDelay + 260,
      );
      setTimeout(
        () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
        startDelay + 440,
      );
    }
  }, []);

  const half = size / 2;

  return (
    <Canvas style={{ width: size, height: size }}>
      <Group>
        {rings.map((ring, i) => (
          <Ring key={i} r={ring.r} opacity={ring.opacity} color={accent} cx={half} cy={half} />
        ))}
        {centerDot && (
          <>
            <Circle cx={half} cy={half} r={6} color={alpha(accent, 0.9)} />
            <Circle cx={half} cy={half} r={2.5} color={colors.white} />
          </>
        )}
      </Group>
    </Canvas>
  );
}
