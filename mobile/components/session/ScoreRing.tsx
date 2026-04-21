import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  useAnimatedReaction,
  withTiming,
  withDelay,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { colors, alpha, fonts, scoreColor } from '../../theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface ScoreRingProps {
  /** 0-100 score, or null for pending state */
  score: number | null;
  label: string;
  size?: number;
  strokeWidth?: number;
  animate?: boolean;
  /** Stagger start — useful when siblings animate together */
  startDelayMs?: number;
  /** Sweep duration */
  duration?: number;
}

/**
 * Animated circular score ring with count-up number.
 *
 * When `score` is null, renders a dashed placeholder ring and an em-dash.
 * When the score transitions from null → number, the fill + count animate from 0.
 */
export function ScoreRing({
  score,
  label,
  size = 140,
  strokeWidth = 10,
  animate = true,
  startDelayMs = 0,
  duration = 1000,
}: ScoreRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const progress = useSharedValue(0);
  const [displayValue, setDisplayValue] = useState(animate ? 0 : (score ?? 0));

  // When score appears (or changes), animate progress from current → target.
  useEffect(() => {
    if (score == null) {
      progress.value = 0;
      setDisplayValue(0);
      return;
    }
    if (!animate) {
      progress.value = score;
      setDisplayValue(score);
      return;
    }
    progress.value = 0;
    progress.value = withDelay(
      startDelayMs,
      withTiming(score, { duration, easing: Easing.out(Easing.cubic) }),
    );
  }, [score, animate, startDelayMs, duration]);

  // Bridge shared value → JS state for the count-up text.
  useAnimatedReaction(
    () => Math.round(progress.value),
    (current, prev) => {
      if (current !== prev) runOnJS(setDisplayValue)(current);
    },
  );

  // Animate strokeDashoffset from full-circumference → circumference*(1 - score/100)
  const animatedProps = useAnimatedProps(() => {
    const pct = Math.max(0, Math.min(100, progress.value)) / 100;
    return {
      strokeDashoffset: circumference * (1 - pct),
    };
  });

  const isPending = score == null;
  const color = isPending ? alpha(colors.white, 0.25) : scoreColor(score);
  const trackColor = alpha(colors.white, 0.08);

  // Center of SVG
  const cx = size / 2;
  const cy = size / 2;

  return (
    <View style={styles.container}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size}>
          {/* Track */}
          <Circle
            cx={cx}
            cy={cy}
            r={radius}
            stroke={trackColor}
            strokeWidth={strokeWidth}
            strokeDasharray={isPending ? '4 6' : undefined}
            fill="none"
          />
          {/* Progress (only when we have a score) */}
          {!isPending && (
            <AnimatedCircle
              cx={cx}
              cy={cy}
              r={radius}
              stroke={color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${circumference} ${circumference}`}
              animatedProps={animatedProps}
              transform={`rotate(-90 ${cx} ${cy})`}
            />
          )}
        </Svg>

        {/* Center: number */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <View style={styles.centerStack}>
            <Text
              style={[
                styles.number,
                { color, fontSize: size * 0.34 },
              ]}
              numberOfLines={1}
            >
              {isPending ? '—' : displayValue}
            </Text>
          </View>
        </View>
      </View>

      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  centerStack: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  number: {
    fontFamily: fonts.extrabold,
    letterSpacing: -1.5,
    // Tabular numerals keep digits a fixed width during count-up so the
    // number doesn't jitter. Android Mona Sans does include tabular figures.
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
    // Fallback min-width guards against font-fallback jitter on Android.
    minWidth: Platform.OS === 'android' ? 80 : undefined,
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: alpha(colors.white, 0.5),
  },
});
