import { useEffect, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Canvas, Rect, RadialGradient, vec } from '@shopify/react-native-skia';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  withSpring,
  cancelAnimation,
  Easing,
  type SharedValue,
} from 'react-native-reanimated';
import { alpha } from '../../theme';

// ----------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------

export type IrisRingOrbState =
  | 'connecting'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'muted'
  | 'idle';

interface IrisRingOrbProps {
  /** Current visual state — drives color + motion. */
  state: IrisRingOrbState;
  /** Ring diameter in px. Default 220. */
  size?: number;
  /**
   * Optional live mic amplitude (0–1). When provided AND state is 'listening',
   * the inner waveform bars are driven by it. Otherwise bars fall back to
   * scripted animations (for AI-speaking contexts like the intro narration).
   */
  audioLevel?: SharedValue<number>;
}

// ----------------------------------------------------------------------
// Palette
// ----------------------------------------------------------------------

const STATE_PALETTE: Record<
  IrisRingOrbState,
  { dominant: string; accent: string; bloom: string }
> = {
  connecting: { dominant: '#8a8f9e', accent: '#5c6370', bloom: '#8a8f9e' },
  listening: { dominant: '#699cff', accent: '#4c7fe8', bloom: '#4c7fe8' },
  thinking: { dominant: '#a58bd1', accent: '#7a639f', bloom: '#7a639f' },
  speaking: { dominant: '#cc97ff', accent: '#9c48ea', bloom: '#9c48ea' },
  muted: { dominant: '#4a4a4a', accent: '#2a2a2a', bloom: '#3a3a3a' },
  idle: { dominant: '#6a6a6a', accent: '#3a3a3a', bloom: '#4a4a4a' },
};

const BAR_COUNT = 7;
const BAR_MIN_H = 4;
const BAR_MAX_H = 66;
const BAR_ENVELOPE = [0.35, 0.6, 0.85, 1.0, 0.85, 0.6, 0.35];

// ----------------------------------------------------------------------
// Public component
// ----------------------------------------------------------------------

export function IrisRingOrb({ state, size = 220, audioLevel }: IrisRingOrbProps) {
  const palette = STATE_PALETTE[state];
  const bloomSize = size * 2.2;

  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}
    >
      <BloomHalo state={state} size={bloomSize} />
      <IrisRing state={state} size={size} palette={palette} audioLevel={audioLevel} />
    </View>
  );
}

// ----------------------------------------------------------------------
// Bloom halo
// ----------------------------------------------------------------------

function BloomHalo({ state, size }: { state: IrisRingOrbState; size: number }) {
  const palette = STATE_PALETTE[state];
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.6);

  useEffect(() => {
    cancelAnimation(scale);
    cancelAnimation(opacity);
    if (state === 'speaking') {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.12, { duration: 850, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 850, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      );
      opacity.value = withTiming(1, { duration: 400 });
    } else if (state === 'listening') {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.05, { duration: 1600, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      );
      opacity.value = withTiming(0.8, { duration: 400 });
    } else if (state === 'thinking') {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.03, { duration: 600, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      );
      opacity.value = withTiming(0.6, { duration: 400 });
    } else if (state === 'connecting') {
      scale.value = withTiming(1, { duration: 400 });
      opacity.value = withTiming(0.45, { duration: 400 });
    } else {
      scale.value = withTiming(1, { duration: 400 });
      opacity.value = withTiming(0.3, { duration: 400 });
    }
  }, [state]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const cx = size / 2;
  const cy = size / 2;
  const inner = hexToRgba(palette.bloom, 0.55);
  const mid = hexToRgba(palette.bloom, 0.22);
  const fade = hexToRgba(palette.bloom, 0.06);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          width: size,
          height: size,
          left: '50%',
          top: '50%',
          marginLeft: -size / 2,
          marginTop: -size / 2,
        },
        animStyle,
      ]}
    >
      <Canvas style={StyleSheet.absoluteFill}>
        <Rect x={0} y={0} width={size} height={size}>
          <RadialGradient
            c={vec(cx, cy)}
            r={size / 2}
            colors={[inner, mid, fade, 'transparent']}
            positions={[0, 0.32, 0.7, 1]}
          />
        </Rect>
      </Canvas>
    </Animated.View>
  );
}

// ----------------------------------------------------------------------
// Ring + inner bars
// ----------------------------------------------------------------------

function IrisRing({
  state,
  size,
  palette,
  audioLevel,
}: {
  state: IrisRingOrbState;
  size: number;
  palette: (typeof STATE_PALETTE)[IrisRingOrbState];
  audioLevel?: SharedValue<number>;
}) {
  const ringScale = useSharedValue(1);
  const ringOpacity = useSharedValue(0.9);

  const scripted = useMemo(
    () => Array.from({ length: BAR_COUNT }, () => ({ value: 4 })),
    [],
  );

  const bar0 = useSharedValue(4);
  const bar1 = useSharedValue(4);
  const bar2 = useSharedValue(4);
  const bar3 = useSharedValue(4);
  const bar4 = useSharedValue(4);
  const bar5 = useSharedValue(4);
  const bar6 = useSharedValue(4);
  const bars = [bar0, bar1, bar2, bar3, bar4, bar5, bar6];
  void scripted;

  useEffect(() => {
    cancelAnimation(ringScale);
    cancelAnimation(ringOpacity);
    bars.forEach((b) => cancelAnimation(b));

    if (state === 'speaking') {
      ringScale.value = withRepeat(
        withSequence(
          withTiming(1.04, { duration: 720, easing: Easing.out(Easing.ease) }),
          withTiming(1, { duration: 880, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      );
      ringOpacity.value = withTiming(1, { duration: 300 });
      const heights = [16, 30, 48, 64, 48, 30, 16];
      const mins = [6, 10, 14, 18, 14, 10, 6];
      const durations = [780, 660, 560, 520, 580, 680, 820];
      bars.forEach((b, i) => {
        b.value = withDelay(
          i * 60,
          withRepeat(
            withSequence(
              withTiming(heights[i], { duration: durations[i], easing: Easing.inOut(Easing.sin) }),
              withTiming(mins[i], { duration: durations[i], easing: Easing.inOut(Easing.sin) }),
            ),
            -1,
            true,
          ),
        );
      });
    } else if (state === 'listening') {
      ringScale.value = withRepeat(
        withSequence(
          withTiming(1.02, { duration: 1600, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      );
      ringOpacity.value = withTiming(0.9, { duration: 300 });
      if (!audioLevel) {
        // No mic plumbed: show scripted breathing bars during listening
        bars.forEach((b, i) => {
          b.value = withDelay(
            i * 80,
            withRepeat(
              withSequence(
                withTiming(8 + i * 2, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
                withTiming(4, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
              ),
              -1,
              true,
            ),
          );
        });
      }
      // else: mic-driven via derived values below
    } else if (state === 'thinking') {
      ringScale.value = withRepeat(
        withSequence(
          withTiming(1.015, { duration: 550 }),
          withTiming(1, { duration: 550 }),
        ),
        -1,
        true,
      );
      ringOpacity.value = withRepeat(
        withSequence(
          withTiming(0.55, { duration: 520 }),
          withTiming(0.95, { duration: 520 }),
        ),
        -1,
        true,
      );
      bars.forEach((b, i) => {
        b.value = withDelay(
          i * 45,
          withRepeat(
            withSequence(
              withTiming(6 + (i % 2 === 0 ? 2 : 0), { duration: 380 }),
              withTiming(4, { duration: 380 }),
            ),
            -1,
            true,
          ),
        );
      });
    } else if (state === 'connecting') {
      ringScale.value = withRepeat(
        withSequence(
          withTiming(0.9, { duration: 700, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      );
      ringOpacity.value = withTiming(0.6, { duration: 300 });
      bars.forEach((b) => {
        b.value = withTiming(4, { duration: 300 });
      });
    } else {
      ringScale.value = withTiming(1, { duration: 300 });
      ringOpacity.value = withTiming(0.4, { duration: 300 });
      bars.forEach((b) => {
        b.value = withTiming(4, { duration: 300 });
      });
    }
  }, [state]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
    opacity: ringOpacity.value,
  }));

  const micMode = state === 'listening' && !!audioLevel;
  // Safe fallback when caller didn't pass audioLevel.
  const fallbackLevel = useSharedValue(0);
  const level = audioLevel ?? fallbackLevel;

  const derived0 = useDerivedValue(() => (micMode ? micBarHeight(level.value, 0) : bar0.value));
  const derived1 = useDerivedValue(() => (micMode ? micBarHeight(level.value, 1) : bar1.value));
  const derived2 = useDerivedValue(() => (micMode ? micBarHeight(level.value, 2) : bar2.value));
  const derived3 = useDerivedValue(() => (micMode ? micBarHeight(level.value, 3) : bar3.value));
  const derived4 = useDerivedValue(() => (micMode ? micBarHeight(level.value, 4) : bar4.value));
  const derived5 = useDerivedValue(() => (micMode ? micBarHeight(level.value, 5) : bar5.value));
  const derived6 = useDerivedValue(() => (micMode ? micBarHeight(level.value, 6) : bar6.value));

  const SPRING = { damping: 14, stiffness: 180, mass: 0.4 };
  const barS0 = useAnimatedStyle(() => ({ height: withSpring(derived0.value, SPRING) }));
  const barS1 = useAnimatedStyle(() => ({ height: withSpring(derived1.value, SPRING) }));
  const barS2 = useAnimatedStyle(() => ({ height: withSpring(derived2.value, SPRING) }));
  const barS3 = useAnimatedStyle(() => ({ height: withSpring(derived3.value, SPRING) }));
  const barS4 = useAnimatedStyle(() => ({ height: withSpring(derived4.value, SPRING) }));
  const barS5 = useAnimatedStyle(() => ({ height: withSpring(derived5.value, SPRING) }));
  const barS6 = useAnimatedStyle(() => ({ height: withSpring(derived6.value, SPRING) }));
  const barStyles = [barS0, barS1, barS2, barS3, barS4, barS5, barS6];

  const ringStroke = 2;
  const innerRingInset = 24;

  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: ringStroke,
            borderColor: palette.dominant,
            shadowColor: palette.dominant,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.8,
            shadowRadius: 24,
            elevation: 10,
          },
          ringStyle,
        ]}
      />
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: size - innerRingInset,
            height: size - innerRingInset,
            borderRadius: (size - innerRingInset) / 2,
            borderWidth: 1,
            borderColor: alpha(palette.dominant, 0.18),
          },
          ringStyle,
        ]}
      />
      <View style={styles.barRow}>
        {barStyles.map((s, i) => (
          <Animated.View
            key={i}
            style={[styles.bar, { backgroundColor: palette.dominant }, s]}
          />
        ))}
      </View>
    </View>
  );
}

// ----------------------------------------------------------------------
// Worklets + utils
// ----------------------------------------------------------------------

function micBarHeight(level: number, index: number): number {
  'worklet';
  const envelope = BAR_ENVELOPE[index];
  const seed = level * 1000;
  const noise = Math.sin(index * 127.1 + seed * 311.7) * 43758.5453;
  const rand = noise - Math.floor(noise);
  const barLevel = level * (envelope * 0.65 + rand * 0.35);
  return BAR_MIN_H + barLevel * (BAR_MAX_H - BAR_MIN_H);
}

function hexToRgba(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

const styles = StyleSheet.create({
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: BAR_MAX_H,
  },
  bar: {
    width: 3.5,
    minHeight: BAR_MIN_H,
    borderRadius: 2,
  },
});
