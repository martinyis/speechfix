import { useEffect, useRef } from 'react';
import { Tabs } from 'expo-router';
import { View, StyleSheet, Pressable, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { colors, alpha } from '../../theme';
import { useSessionStore } from '../../stores/sessionStore';

const TAB_ICONS: Record<string, { active: string; inactive: string }> = {
  index: { active: 'home', inactive: 'home-outline' },
  practice: { active: 'chatbubble', inactive: 'chatbubble-outline' },
  patterns: { active: 'time', inactive: 'time-outline' },
  profile: { active: 'person', inactive: 'person-outline' },
};

function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const isVoiceActive = useSessionStore((s) => s.isVoiceSessionActive);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: isVoiceActive ? 0 : 1,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [isVoiceActive]);

  return (
    <Animated.View
      pointerEvents={isVoiceActive ? 'none' : 'auto'}
      style={[
        styles.tabBar,
        { bottom: Math.max(insets.bottom, 12), opacity: fadeAnim },
      ]}
    >
      <View style={styles.tabBarBg}>
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.tabBarOverlay} />
      </View>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const icons = TAB_ICONS[route.name];
        if (!icons) return null;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            style={styles.tabItem}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            accessibilityLabel={descriptors[route.key].options.title}
          >
            <Ionicons
              name={(focused ? icons.active : icons.inactive) as any}
              size={22}
              color={focused ? colors.primary : alpha(colors.white, 0.35)}
              style={focused ? styles.activeIcon : undefined}
            />
            {focused && <View style={styles.activeDot} />}
          </Pressable>
        );
      })}
    </Animated.View>
  );
}

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
