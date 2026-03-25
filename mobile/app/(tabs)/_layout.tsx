import { useEffect, useCallback } from 'react';
import { Tabs } from 'expo-router';
import { View, StyleSheet, Pressable, LayoutChangeEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  interpolate,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors, alpha } from '../../theme';
import { useSessionStore } from '../../stores/sessionStore';

// ---------------------------------------------------------------------------
// Spring / timing configs
// ---------------------------------------------------------------------------

const INDICATOR_SPRING = { damping: 18, stiffness: 200, mass: 0.8 };
const ICON_BOUNCE_SPRING = { damping: 12, stiffness: 280 };
const ICON_SETTLE_SPRING = { damping: 15, stiffness: 200 };
const OPACITY_DURATION = 220;
const DOT_FADE_IN = 200;
const DOT_FADE_OUT = 150;

// ---------------------------------------------------------------------------
// Tab icon map
// ---------------------------------------------------------------------------

const TAB_ICONS: Record<string, { active: string; inactive: string }> = {
  index: { active: 'home', inactive: 'home-outline' },
  practice: { active: 'chatbubble', inactive: 'chatbubble-outline' },
  patterns: { active: 'time', inactive: 'time-outline' },
  profile: { active: 'person', inactive: 'person-outline' },
};

// ---------------------------------------------------------------------------
// AnimatedTabItem
// ---------------------------------------------------------------------------

interface TabItemProps {
  routeKey: string;
  routeName: string;
  title: string | undefined;
  focused: boolean;
  onPress: () => void;
}

function AnimatedTabItem({ routeKey, routeName, title, focused, onPress }: TabItemProps) {
  const icons = TAB_ICONS[routeName];
  const iconScale = useSharedValue(focused ? 1 : 1);
  const iconOpacity = useSharedValue(focused ? 1 : 0.35);
  const dotOpacity = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    if (focused) {
      // Bounce: scale up then settle
      iconScale.value = withSequence(
        withSpring(1.15, ICON_BOUNCE_SPRING),
        withSpring(1, ICON_SETTLE_SPRING),
      );
      iconOpacity.value = withTiming(1, { duration: OPACITY_DURATION });
      dotOpacity.value = withTiming(1, { duration: DOT_FADE_IN });
    } else {
      iconScale.value = withSpring(1, ICON_SETTLE_SPRING);
      iconOpacity.value = withTiming(0.35, { duration: OPACITY_DURATION });
      dotOpacity.value = withTiming(0, { duration: DOT_FADE_OUT });
    }
  }, [focused]);

  const iconAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
    opacity: iconOpacity.value,
  }));

  const dotAnimStyle = useAnimatedStyle(() => ({
    opacity: dotOpacity.value,
  }));

  if (!icons) return null;

  return (
    <Pressable
      key={routeKey}
      onPress={onPress}
      style={styles.tabItem}
      accessibilityRole="button"
      accessibilityState={focused ? { selected: true } : {}}
      accessibilityLabel={title}
    >
      <Animated.View style={iconAnimStyle}>
        <Ionicons
          name={(focused ? icons.active : icons.inactive) as any}
          size={22}
          color={focused ? colors.primary : alpha(colors.white, 0.35)}
          style={focused ? styles.activeIcon : undefined}
        />
      </Animated.View>
      <Animated.View style={[styles.activeDot, dotAnimStyle]} />
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// CustomTabBar
// ---------------------------------------------------------------------------

function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const isVoiceActive = useSessionStore((s) => s.isVoiceSessionActive);

  // Voice session fade (reanimated)
  const voiceFade = useSharedValue(1);
  useEffect(() => {
    voiceFade.value = withTiming(isVoiceActive ? 0 : 1, { duration: 250 });
  }, [isVoiceActive]);

  const voiceFadeStyle = useAnimatedStyle(() => ({
    opacity: voiceFade.value,
  }));

  // Sliding indicator
  const barWidth = useSharedValue(0);
  const activeIndex = useSharedValue(state.index);
  const tabCount = state.routes.filter((r) => TAB_ICONS[r.name]).length;

  useEffect(() => {
    activeIndex.value = withSpring(state.index, INDICATOR_SPRING);
  }, [state.index]);

  const onBarLayout = useCallback((e: LayoutChangeEvent) => {
    barWidth.value = e.nativeEvent.layout.width;
  }, []);

  const indicatorStyle = useAnimatedStyle(() => {
    if (barWidth.value === 0 || tabCount === 0) return { opacity: 0 };
    const tabW = barWidth.value / tabCount;
    const pillWidth = tabW - 16; // 8px margin each side
    const translateX = interpolate(
      activeIndex.value,
      [0, tabCount - 1],
      [8, barWidth.value - pillWidth - 8],
    );
    return {
      opacity: 1,
      width: pillWidth,
      transform: [{ translateX }],
    };
  });

  // Haptic on tab press (only when switching)
  const fireHaptic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  return (
    <Animated.View
      pointerEvents={isVoiceActive ? 'none' : 'auto'}
      style={[
        styles.tabBar,
        { bottom: Math.max(insets.bottom, 12) },
        voiceFadeStyle,
      ]}
      onLayout={onBarLayout}
    >
      {/* Glass background */}
      <View style={styles.tabBarBg}>
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.tabBarOverlay} />
      </View>

      {/* Sliding indicator pill */}
      <Animated.View style={[styles.indicatorPill, indicatorStyle]} />

      {/* Tab items */}
      {state.routes.map((route, index) => {
        if (!TAB_ICONS[route.name]) return null;
        const focused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            fireHaptic();
            navigation.navigate(route.name);
          }
        };

        return (
          <AnimatedTabItem
            key={route.key}
            routeKey={route.key}
            routeName={route.name}
            title={descriptors[route.key].options.title}
            focused={focused}
            onPress={onPress}
          />
        );
      })}
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// TabLayout
// ---------------------------------------------------------------------------

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.onSurface,
        headerShown: false,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="practice" options={{ title: 'Practice' }} />
      <Tabs.Screen name="patterns" options={{ title: 'Patterns' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    left: 24,
    right: 24,
    height: 64,
    borderRadius: 32,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 0,
  },
  tabBarBg: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 32,
    overflow: 'hidden',
    backgroundColor: 'rgba(20,20,20,0.85)',
    borderWidth: 1,
    borderColor: alpha(colors.white, 0.08),
  },
  tabBarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: alpha(colors.background, 0.5),
  },
  indicatorPill: {
    position: 'absolute',
    top: 8,
    left: 0,
    height: 48,
    borderRadius: 24,
    backgroundColor: alpha(colors.primary, 0.12),
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  activeIcon: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
    marginTop: 4,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 5,
  },
});
