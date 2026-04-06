import { useCallback, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, LayoutChangeEvent } from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  interpolate,
  type SharedValue,
} from 'react-native-reanimated';
import { colors, alpha, fonts, spacing } from '../../theme';
import type { PracticeModeInfo } from '../../hooks/usePracticeModes';

const PILL_PADDING_H = 6;

interface PracticeBubbleBarProps {
  modes: PracticeModeInfo[];
  activeIndex: SharedValue<number>;
  onTap: (index: number) => void;
}

export function PracticeBubbleBar({ modes, activeIndex, onTap }: PracticeBubbleBarProps) {
  const barWidth = useSharedValue(0);
  const tabCount = modes.length;

  // Pre-compute input range on JS thread (worklet-safe plain array)
  const inputRange = useMemo(() => {
    const arr: number[] = [];
    for (let i = 0; i < tabCount; i++) arr.push(i);
    return arr;
  }, [tabCount]);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    barWidth.value = e.nativeEvent.layout.width;
  }, []);

  const indicatorStyle = useAnimatedStyle(() => {
    if (barWidth.value === 0 || tabCount === 0) return { opacity: 0 };
    const tabW = (barWidth.value - PILL_PADDING_H * 2) / tabCount;
    const pw = tabW - 4; // 2px gap each side

    // Build output positions on UI thread with simple loop
    const outPositions: number[] = [];
    for (let i = 0; i < tabCount; i++) {
      outPositions.push(PILL_PADDING_H + 2 + i * tabW);
    }

    const translateX = interpolate(
      activeIndex.value,
      inputRange,
      outPositions,
    );
    return {
      opacity: 1,
      width: pw,
      transform: [{ translateX }],
    };
  });

  return (
    <View style={styles.wrapper}>
      <View style={styles.bar} onLayout={onLayout}>
        {/* Glass background */}
        <View style={styles.barBg}>
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.barOverlay} />
        </View>

        {/* Sliding indicator */}
        <Animated.View style={[styles.indicator, indicatorStyle]} />

        {/* Tab labels */}
        {modes.map((mode, i) => (
          <TabLabel
            key={mode.key}
            mode={mode}
            index={i}
            activeIndex={activeIndex}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onTap(i);
            }}
          />
        ))}
      </View>
    </View>
  );
}

function TabLabel({
  mode,
  index,
  activeIndex,
  onPress,
}: {
  mode: PracticeModeInfo;
  index: number;
  activeIndex: SharedValue<number>;
  onPress: () => void;
}) {
  const textStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      activeIndex.value,
      [index - 1, index, index + 1],
      [0.4, 1, 0.4],
      'clamp',
    );
    return { opacity };
  });

  const countLabel = mode.stats.remaining > 0 ? `(${mode.stats.remaining})` : '';

  return (
    <Pressable style={styles.tabLabel} onPress={onPress}>
      <Animated.View style={[styles.labelRow, textStyle]}>
        <Text style={styles.labelText}>{mode.label}</Text>
        {countLabel ? (
          <Text style={styles.countText}>{countLabel}</Text>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 20,
    marginBottom: spacing.xl,
  },
  bar: {
    height: 44,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  barBg: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: 'rgba(20,20,20,0.85)',
    borderWidth: 1,
    borderColor: alpha(colors.white, 0.10),
  },
  barOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: alpha(colors.background, 0.5),
  },
  indicator: {
    position: 'absolute',
    top: 4,
    left: 0,
    height: 36,
    borderRadius: 18,
    backgroundColor: alpha(colors.primary, 0.12),
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  tabLabel: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  labelText: {
    fontSize: 13,
    fontFamily: fonts.semibold,
    color: colors.white,
  },
  countText: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: alpha(colors.white, 0.5),
  },
});
