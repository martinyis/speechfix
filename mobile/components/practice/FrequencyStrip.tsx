import { useCallback, useEffect } from 'react';
import { View, ScrollView, Pressable, StyleSheet, Text, useWindowDimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSpring,
  Easing,
  interpolate,
  SharedValue,
} from 'react-native-reanimated';
import { colors, alpha, spacing, fonts } from '../../theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StripMode {
  key: string;
  label: string;
  color: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BAR_COUNT = 5;
const BAR_WIDTH = 3;
const BAR_GAP = 2;
const ACTIVE_MAX_H = 20;
const INACTIVE_MAX_H = 6;
const SLOT_WIDTH = 56;
const STRIP_HEIGHT = 52;

// ---------------------------------------------------------------------------
// MiniBar — single vertical bar in a cluster
// ---------------------------------------------------------------------------

interface MiniBarProps {
  index: number;
  color: string;
  phase: SharedValue<number>;
  amp: SharedValue<number>;
  opacity: SharedValue<number>;
}

function MiniBar({ index, color, phase, amp, opacity }: MiniBarProps) {
  const style = useAnimatedStyle(() => {
    const sin = Math.sin((phase.value + index * 0.7) * Math.PI * 2);
    const height = interpolate(sin, [-1, 1], [3, amp.value]);
    return {
      height,
      opacity: opacity.value,
      backgroundColor: color,
    };
  });

  return <Animated.View style={[styles.bar, style]} />;
}

// ---------------------------------------------------------------------------
// BarCluster — group of 5 bars for one mode
// ---------------------------------------------------------------------------

interface BarClusterProps {
  mode: StripMode;
  isActive: boolean;
  onPress: () => void;
  phase: SharedValue<number>;
}

function BarCluster({ mode, isActive, onPress, phase }: BarClusterProps) {
  const amp = useSharedValue(isActive ? ACTIVE_MAX_H : INACTIVE_MAX_H);
  const barOpacity = useSharedValue(isActive ? 1 : 0.35);

  useEffect(() => {
    amp.value = withSpring(isActive ? ACTIVE_MAX_H : INACTIVE_MAX_H, {
      damping: 14,
      stiffness: 120,
    });
    barOpacity.value = withTiming(isActive ? 1 : 0.35, { duration: 250 });
  }, [isActive]);

  return (
    <Pressable onPress={onPress} style={styles.slot}>
      <View style={styles.barsRow}>
        {Array.from({ length: BAR_COUNT }).map((_, i) => (
          <MiniBar
            key={i}
            index={i}
            color={mode.color}
            phase={phase}
            amp={amp}
            opacity={barOpacity}
          />
        ))}
      </View>
      {isActive && (
        <Text style={[styles.label, { color: mode.color }]} numberOfLines={1}>
          {mode.label}
        </Text>
      )}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// FrequencyStrip
// ---------------------------------------------------------------------------

interface FrequencyStripProps {
  modes: StripMode[];
  activeKey: string;
  onSelect: (key: string) => void;
}

export function FrequencyStrip({ modes, activeKey, onSelect }: FrequencyStripProps) {
  const phase = useSharedValue(0);
  const { width: screenWidth } = useWindowDimensions();

  useEffect(() => {
    phase.value = withRepeat(
      withTiming(1, { duration: 2000, easing: Easing.linear }),
      -1,
      false,
    );
  }, []);

  const handlePress = useCallback(
    (key: string) => {
      if (key === activeKey) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onSelect(key);
    },
    [activeKey, onSelect],
  );

  const clusters = modes.map((mode) => (
    <BarCluster
      key={mode.key}
      mode={mode}
      isActive={mode.key === activeKey}
      onPress={() => handlePress(mode.key)}
      phase={phase}
    />
  ));

  // If all modes fit on screen, distribute evenly — otherwise scroll
  const fitsOnScreen = modes.length * SLOT_WIDTH + spacing.lg * 2 <= screenWidth;

  return (
    <View style={styles.root}>
      {fitsOnScreen ? (
        <View style={styles.distributedContent}>{clusters}</View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {clusters}
        </ScrollView>
      )}
      <View style={styles.separator} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    width: '100%',
  },
  distributedContent: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'flex-end',
    height: STRIP_HEIGHT,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
    alignItems: 'flex-end',
  },
  separator: {
    height: 1,
    backgroundColor: alpha(colors.white, 0.06),
    marginTop: spacing.sm,
  },
  slot: {
    width: SLOT_WIDTH,
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: STRIP_HEIGHT,
    gap: 4,
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: BAR_GAP,
    height: ACTIVE_MAX_H + 4,
  },
  bar: {
    width: BAR_WIDTH,
    borderRadius: BAR_WIDTH / 2,
    minHeight: 3,
  },
  label: {
    fontSize: 9,
    fontFamily: fonts.semibold,
    letterSpacing: 0.3,
  },
});
