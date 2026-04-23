import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';
import { colors, alpha } from '../../theme';

export type StateIndicatorVariant =
  | 'active'
  | 'queued'
  | 'watching'
  | 'mastered'
  | 'returning';

interface StateIndicatorProps {
  state: StateIndicatorVariant;
  /** Optional override color for custom contexts. Falls back to variant default. */
  color?: string;
}

/**
 * Left-edge state marker used across the patterns-list surface.
 *
 * Variants:
 * - active:    solid 3×20 pill bar (purple)
 * - queued:    hollow 6×6 dot ring (white @ 0.25)
 * - watching:  pulsing 6×6 dot (blue, opacity 0.5→1.0 on 2s cycle)
 * - mastered:  solid 6×6 dot (severityPolish green)
 * - returning: pulsing 6×6 dot (pink, same cycle as watching)
 */
export function StateIndicator({ state, color }: StateIndicatorProps) {
  const opacity = useSharedValue(1);

  const shouldPulse = state === 'watching' || state === 'returning';

  useEffect(() => {
    if (!shouldPulse) {
      opacity.value = 1;
      return;
    }
    opacity.value = 0.5;
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.5, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
    return () => {
      cancelAnimation(opacity);
    };
  }, [shouldPulse, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  if (state === 'active') {
    const bg = color ?? colors.primary;
    return (
      <View style={styles.slot}>
        <View style={[styles.activeBar, { backgroundColor: bg }]} />
      </View>
    );
  }

  if (state === 'queued') {
    const border = color ?? alpha(colors.white, 0.25);
    return (
      <View style={styles.slot}>
        <View style={[styles.queuedDot, { borderColor: border }]} />
      </View>
    );
  }

  if (state === 'mastered') {
    const bg = color ?? colors.severityPolish;
    return (
      <View style={styles.slot}>
        <View style={[styles.solidDot, { backgroundColor: bg }]} />
      </View>
    );
  }

  // watching | returning
  const bg =
    color ?? (state === 'returning' ? colors.tertiary : colors.secondary);
  return (
    <View style={styles.slot}>
      <Animated.View
        style={[styles.solidDot, { backgroundColor: bg }, animatedStyle]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    width: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeBar: {
    width: 3,
    height: 20,
    borderRadius: 1.5,
  },
  queuedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  solidDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
