import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  FadeIn,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
  Easing,
  cancelAnimation,
  interpolate,
  runOnJS,
} from 'react-native-reanimated';
import { ScreenHeader } from '../ui';
import {
  colors,
  alpha,
  spacing,
  fonts,
  layout,
  typography,
} from '../../theme';

export type LoadingTone = 'neutral' | 'calm' | 'polish' | 'victorious';

export interface LoadingScreenProps {
  title: string;
  steps: string[];
  tone?: LoadingTone;
  /** Header eyebrow label (uppercased). Default: "RUNNING" */
  eyebrow?: string;
  /** Optional meta line below the sweep bar */
  meta?: string;
  /** If provided, renders a back button in the header. Omit to block dismissal. */
  onBack?: () => void;
}

function toneAccent(tone: LoadingTone | undefined): string {
  switch (tone) {
    case 'polish':
      return colors.severityPolish;
    case 'calm':
      return colors.secondary;
    case 'victorious':
      return colors.primary;
    case 'neutral':
    default:
      return colors.primary;
  }
}

/**
 * Universal loading screen for multi-second async jobs in the app.
 *
 * Typography-forward (Arc/Linear-inspired) — the current step name IS the
 * subject, morphing via letter-spacing decompression + vertical lift. An
 * ambient indeterminate sweep bar gives motion without faking progress.
 *
 * Mirror of `components/success/SuccessScreen.tsx`. Used at completion-adjacent
 * moments: session analysis, agent creation, drill scoring, etc.
 */
export default function LoadingScreen({
  title,
  steps,
  tone,
  eyebrow = 'RUNNING',
  meta,
  onBack,
}: LoadingScreenProps) {
  const accent = toneAccent(tone);
  const [index, setIndex] = useState(0);

  const morphProgress = useSharedValue(1);
  const sweep = useSharedValue(0);
  const tick = useSharedValue(0);
  const stepIdx = useSharedValue(0);

  const cycle = useCallback(() => {
    morphProgress.value = withSequence(
      withTiming(0, { duration: 220, easing: Easing.in(Easing.cubic) }),
      withDelay(
        40,
        withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) }),
      ),
    );
    tick.value = withSequence(
      withTiming(1, { duration: 120 }),
      withTiming(0, { duration: 380 }),
    );
    setTimeout(() => {
      stepIdx.value = (stepIdx.value + 1) % steps.length;
      runOnJS(setIndex)(stepIdx.value);
    }, 220);
  }, [steps.length]);

  useEffect(() => {
    sweep.value = withRepeat(
      withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
      -1,
      false,
    );
    const t = setInterval(cycle, 2400);
    return () => {
      cancelAnimation(sweep);
      cancelAnimation(morphProgress);
      cancelAnimation(tick);
      clearInterval(t);
    };
  }, [cycle]);

  const morphStyle = useAnimatedStyle(() => ({
    opacity: morphProgress.value,
    letterSpacing: interpolate(morphProgress.value, [0, 1], [6, -1.25]),
    transform: [
      { translateY: interpolate(morphProgress.value, [0, 1], [10, 0]) },
    ],
  }));

  const sweepStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(sweep.value, [0, 1], [-120, 120]) },
    ],
    opacity: interpolate(sweep.value, [0, 0.5, 1], [0, 1, 0]),
  }));

  const tickStyle = useAnimatedStyle(() => ({
    opacity: interpolate(tick.value, [0, 1], [0.3, 1]),
    transform: [
      { scale: interpolate(tick.value, [0, 1], [1, 1.4]) },
    ],
  }));

  const counter = useMemo(
    () => `${String(index + 1).padStart(2, '0')} / ${String(steps.length).padStart(2, '0')}`,
    [index, steps.length],
  );

  return (
    <View style={styles.container}>
      {onBack && <ScreenHeader variant="back" title="" onBack={onBack} />}

      <View style={styles.body}>
        <Animated.View
          entering={FadeIn.duration(300).delay(120)}
          style={styles.topRow}
        >
          <Animated.View
            style={[styles.tickDot, { backgroundColor: accent }, tickStyle]}
          />
          <Text style={[styles.eyebrow, { color: accent }]}>
            {eyebrow.toUpperCase()}
          </Text>
          <Text style={styles.counter}>{counter}</Text>
        </Animated.View>

        <View style={styles.hero}>
          <Animated.Text
            entering={FadeInUp.duration(500).delay(200)}
            style={styles.titleSmall}
          >
            {title.toLowerCase()}
          </Animated.Text>

          <Animated.Text style={[styles.megaStep, morphStyle]}>
            {steps[index]}.
          </Animated.Text>

          <View style={styles.sweepTrack}>
            <Animated.View
              style={[styles.sweepBar, { backgroundColor: accent }, sweepStyle]}
            />
          </View>

          {meta && (
            <Animated.Text
              entering={FadeIn.duration(400).delay(360)}
              style={styles.meta}
            >
              {meta}
            </Animated.Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  body: {
    flex: 1,
    paddingHorizontal: layout.screenPadding,
    paddingBottom: spacing.xxxl,
    justifyContent: 'flex-end',
  },
  topRow: {
    position: 'absolute',
    top: 120,
    left: layout.screenPadding,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  tickDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  eyebrow: {
    ...typography.labelMd,
  },
  counter: {
    fontSize: 11,
    fontFamily: fonts.semibold,
    letterSpacing: 1.2,
    color: alpha(colors.white, 0.35),
    textTransform: 'uppercase',
  },
  hero: {
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  titleSmall: {
    fontSize: 17,
    fontFamily: fonts.medium,
    color: alpha(colors.white, 0.45),
    letterSpacing: 0,
  },
  megaStep: {
    fontSize: 56,
    lineHeight: 64,
    fontFamily: fonts.extrabold,
    color: colors.onSurface,
  },
  sweepTrack: {
    height: 2,
    width: '100%',
    backgroundColor: alpha(colors.white, 0.06),
    overflow: 'hidden',
    borderRadius: 1,
    marginTop: spacing.md,
  },
  sweepBar: {
    position: 'absolute',
    width: '40%',
    height: 2,
    left: '30%',
    borderRadius: 1,
  },
  meta: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: alpha(colors.white, 0.35),
    marginTop: spacing.sm,
    maxWidth: 300,
  },
});
