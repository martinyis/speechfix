import { useCallback, useEffect } from 'react';
import { View, ScrollView, Pressable, StyleSheet, Text } from 'react-native';
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
import { colors, alpha, typography, spacing, fonts } from '../../theme';
import type { MockMode } from './mockModes';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BAND_WIDTH = 80;
const AREA_HEIGHT = 120;
const WAVE_ROWS = 12; // number of horizontal slices per band
const ACTIVE_AMP = 50;
const INACTIVE_AMP = 8;

// ---------------------------------------------------------------------------
// WaveBand — single animated waveform column
// ---------------------------------------------------------------------------

interface WaveBandProps {
  mode: MockMode;
  isActive: boolean;
  onPress: () => void;
  phase: SharedValue<number>;
}

function WaveBand({ mode, isActive, onPress, phase }: WaveBandProps) {
  const amp = useSharedValue(isActive ? ACTIVE_AMP : INACTIVE_AMP);
  const bandOpacity = useSharedValue(isActive ? 1 : 0.35);

  useEffect(() => {
    amp.value = withSpring(isActive ? ACTIVE_AMP : INACTIVE_AMP, {
      damping: 14,
      stiffness: 120,
    });
    bandOpacity.value = withTiming(isActive ? 1 : 0.35, { duration: 300 });
  }, [isActive]);

  return (
    <Pressable onPress={onPress} style={styles.bandContainer}>
      <Animated.View style={useAnimatedStyle(() => ({ opacity: bandOpacity.value }))}>
        <View style={styles.waveArea}>
          {Array.from({ length: WAVE_ROWS }).map((_, i) => (
            <WaveSlice
              key={i}
              index={i}
              color={mode.color}
              phase={phase}
              amp={amp}
            />
          ))}
        </View>
      </Animated.View>
      <Text
        style={[styles.bandLabel, { color: isActive ? mode.color : alpha(colors.white, 0.4) }]}
        numberOfLines={1}
      >
        {mode.label}
      </Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// WaveSlice — individual horizontal bar within a band
// ---------------------------------------------------------------------------

interface WaveSliceProps {
  index: number;
  color: string;
  phase: SharedValue<number>;
  amp: SharedValue<number>;
}

function WaveSlice({ index, color, phase, amp }: WaveSliceProps) {
  const animStyle = useAnimatedStyle(() => {
    // sin wave: each slice offset by index to create wave pattern
    const sin = Math.sin((phase.value + index * 0.55) * Math.PI * 2);
    const width = interpolate(sin, [-1, 1], [4, amp.value]);
    return {
      width,
      backgroundColor: color,
    };
  });

  return <Animated.View style={[styles.waveSlice, animStyle]} />;
}

// ---------------------------------------------------------------------------
// FrequencySwitcher
// ---------------------------------------------------------------------------

interface FrequencySwitcherProps {
  modes: MockMode[];
  activeKey: string;
  onSelect: (key: string) => void;
}

export function FrequencySwitcher({ modes, activeKey, onSelect }: FrequencySwitcherProps) {
  // Shared phase drives all wave animations
  const phase = useSharedValue(0);

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

  const activeMode = modes.find((m) => m.key === activeKey);

  return (
    <View style={styles.root}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {modes.map((mode) => (
          <WaveBand
            key={mode.key}
            mode={mode}
            isActive={mode.key === activeKey}
            onPress={() => handlePress(mode.key)}
            phase={phase}
          />
        ))}
      </ScrollView>
      {activeMode && (
        <View style={styles.infoRow}>
          <Text style={[styles.activeName, { color: activeMode.color }]}>
            {activeMode.label}
          </Text>
          <Text style={styles.activeStat}>{activeMode.stat}</Text>
        </View>
      )}
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
  scrollContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  bandContainer: {
    width: BAND_WIDTH,
    alignItems: 'center',
    gap: spacing.xs,
  },
  waveArea: {
    height: AREA_HEIGHT,
    width: BAND_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
  },
  waveSlice: {
    height: 4,
    borderRadius: 2,
    minWidth: 4,
  },
  bandLabel: {
    fontSize: 11,
    fontFamily: fonts.semibold,
    letterSpacing: 0.3,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  activeName: {
    ...typography.headlineSm,
  },
  activeStat: {
    ...typography.bodySmMedium,
    color: alpha(colors.white, 0.5),
  },
});
