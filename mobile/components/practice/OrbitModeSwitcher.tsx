import { useCallback } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { colors, alpha, glass } from '../../theme';
import type { PracticeModeInfo, PracticeModeName } from '../../hooks/usePracticeModes';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ICON_SIZE = 20;
const SEGMENT_SIZE = 38;

const MODE_COLORS: Record<PracticeModeName, string> = {
  corrections: colors.tertiary,
  filler_words: colors.secondary,
  patterns: '#34d399',
};

const MODE_ICONS: Record<PracticeModeName, keyof typeof Ionicons.glyphMap> = {
  corrections: 'create-outline',
  filler_words: 'chatbubbles-outline',
  patterns: 'repeat-outline',
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface OrbitModeSwitcherProps {
  modes: PracticeModeInfo[];
  activeModeKey: PracticeModeName;
  onModeChange: (mode: PracticeModeName) => void;
  topOffset: number;
  rightOffset?: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OrbitModeSwitcher({
  modes,
  activeModeKey,
  onModeChange,
  topOffset,
  rightOffset = 20,
}: OrbitModeSwitcherProps) {
  const pressScale = useSharedValue(1);

  const handlePress = useCallback(
    (key: PracticeModeName) => {
      if (key === activeModeKey) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onModeChange(key);
    },
    [activeModeKey, onModeChange],
  );

  const containerAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  return (
    <Animated.View
      style={[
        styles.container,
        { top: topOffset, right: rightOffset },
        containerAnimStyle,
      ]}
    >
      <View style={styles.pill}>
        {modes.map((mode) => {
          const isActive = mode.key === activeModeKey;
          const modeColor = MODE_COLORS[mode.key];
          return (
            <Pressable
              key={mode.key}
              onPress={() => handlePress(mode.key)}
              onPressIn={() => {
                pressScale.value = withSpring(0.95, { damping: 15, stiffness: 300 });
              }}
              onPressOut={() => {
                pressScale.value = withSpring(1, { damping: 15, stiffness: 300 });
              }}
              style={[
                styles.segment,
                isActive && { backgroundColor: alpha(modeColor, 0.15) },
              ]}
              accessibilityLabel={`${mode.label} mode`}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
            >
              <Ionicons
                name={MODE_ICONS[mode.key]}
                size={ICON_SIZE}
                color={isActive ? modeColor : alpha(colors.white, 0.3)}
              />
            </Pressable>
          );
        })}
      </View>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 100,
  },
  pill: {
    flexDirection: 'row',
    ...glass.card,
    borderRadius: 12,
    padding: 3,
    gap: 2,
  },
  segment: {
    width: SEGMENT_SIZE,
    height: SEGMENT_SIZE,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
