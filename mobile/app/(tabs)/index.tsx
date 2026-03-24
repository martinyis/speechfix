import { useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  interpolateColor,
} from 'react-native-reanimated';
import MicBloomOrb from '../../components/MicBloomOrb';
import { VoiceSessionOverlay } from '../../components/VoiceSessionOverlay';
import { SessionRow } from '../../components/SessionRow';
import { useSessionStore } from '../../stores/sessionStore';
import { useSessions } from '../../hooks/useSessions';
import { useVoiceSession } from '../../hooks/useVoiceSession';
import { colors, alpha } from '../../theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { data: sessions, refetch } = useSessions();
  const isActive = useSessionStore((s) => s.isVoiceSessionActive);
  const voiceState = useSessionStore((s) => s.voiceSessionState);
  const elapsedTime = useSessionStore((s) => s.elapsedTime);
  const isMuted = useSessionStore((s) => s.isMuted);

  // Refetch sessions when screen focuses
  useFocusEffect(
    useCallback(() => {
      if (!isActive) refetch();
    }, [isActive]),
  );

  // Voice session hook
  const { start, stop, toggleMute } = useVoiceSession({
    onSessionEnd: (_results, dbSessionId) => {
      router.push({
        pathname: '/session-detail',
        params: { sessionId: String(dbSessionId), fresh: 'true' },
      });
    },
    onError: (message) => {
      console.warn('Voice session error:', message);
    },
  });

  // -- Animations --

  const bgProgress = useSharedValue(0);
  const micScale = useSharedValue(1);
  const listOpacity = useSharedValue(1);
  const sessionUIOpacity = useSharedValue(0);

  useEffect(() => {
    bgProgress.value = withTiming(isActive ? 1 : 0, { duration: 280 });
    listOpacity.value = withTiming(isActive ? 0 : 1, { duration: 200 });
    sessionUIOpacity.value = withTiming(isActive ? 1 : 0, { duration: 250 });
  }, [isActive]);

  const containerStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(bgProgress.value, [0, 1], [colors.background, colors.background]),
  }));

  const listAnimStyle = useAnimatedStyle(() => ({
    opacity: listOpacity.value,
  }));

  const sessionOverlayStyle = useAnimatedStyle(() => ({
    opacity: sessionUIOpacity.value,
  }));

  // -- Handlers --

  const handleMicPress = useCallback(() => {
    if (!isActive) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      start();
    }
  }, [isActive, start]);

  const handleMicPressIn = useCallback(() => {
    if (!isActive) {
      micScale.value = withSpring(0.93, { damping: 15, stiffness: 300 });
    }
  }, [isActive]);

  const handleMicPressOut = useCallback(() => {
    if (!isActive) {
      micScale.value = withSpring(1, { damping: 15, stiffness: 300 });
    }
  }, [isActive]);

  const micAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: micScale.value }],
  }));

  const handleToggleMute = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleMute();
  }, [toggleMute]);

  const handleStop = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    stop();
  }, [stop]);

  // -- Data --

  const hasSessions = (sessions?.length ?? 0) > 0;

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      <StatusBar style="light" />

      {/* ===== VOICE SESSION OVERLAY ===== */}
      {isActive && (
        <Animated.View
          style={[StyleSheet.absoluteFill, sessionOverlayStyle]}
          pointerEvents={isActive ? 'auto' : 'none'}
        >
          <VoiceSessionOverlay
            voiceState={voiceState}
            elapsedTime={elapsedTime}
            isMuted={isMuted}
            onToggleMute={handleToggleMute}
            onStop={handleStop}
          />
        </Animated.View>
      )}

      {/* ===== HOME CONTENT ===== */}
      <Animated.View style={[styles.homeContent, listAnimStyle]} pointerEvents={isActive ? 'none' : 'auto'}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Mic Orb Section */}
          <View style={styles.micSection}>
            <AnimatedPressable
              onPress={handleMicPress}
              onPressIn={handleMicPressIn}
              onPressOut={handleMicPressOut}
              accessibilityLabel="Start practice session"
              accessibilityRole="button"
            >
              <Animated.View style={micAnimStyle}>
                <MicBloomOrb />
              </Animated.View>
            </AnimatedPressable>

            {/* Hint text */}
            <View style={styles.hintContainer}>
              <Text style={styles.hintText}>TAP TO BEGIN PRACTICE</Text>
              <View style={styles.hintDots}>
                <View style={[styles.hintDot, styles.hintDotActive]} />
                <View style={styles.hintDot} />
                <View style={styles.hintDot} />
              </View>
            </View>
          </View>

          {/* History Section */}
          {hasSessions && (
            <View style={styles.historySection}>
              <View style={styles.historyHeader}>
                <View>
                  <Text style={styles.historyTitle}>History</Text>
                  <Text style={styles.historySubtitle}>Your recent vocal breakthroughs</Text>
                </View>
                <Pressable hitSlop={8} onPress={() => router.push('/all-sessions')}>
                  <Text style={styles.viewAllText}>VIEW ALL</Text>
                </Pressable>
              </View>

              <View>
                {(sessions ?? []).slice(0, 3).map((item) => (
                  <SessionRow key={item.id} item={item} />
                ))}
              </View>
            </View>
          )}

        </ScrollView>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  homeContent: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 24,
  },
  micSection: {
    alignItems: 'center',
    marginHorizontal: -24,
    paddingTop: 72,
    paddingBottom: 8,
    overflow: 'visible',
  },
  hintContainer: {
    alignItems: 'center',
    marginTop: 16,
    gap: 8,
  },
  hintText: {
    fontSize: 11,
    fontWeight: '500',
    color: alpha(colors.white, 0.6),
    letterSpacing: 2.5,
    textTransform: 'uppercase',
  },
  hintDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  hintDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: alpha(colors.primary, 0.4),
  },
  hintDotActive: {
    backgroundColor: colors.primary,
  },
  historySection: {
    marginTop: 20,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 12,
  },
  historyTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.onSurface,
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  historySubtitle: {
    fontSize: 12,
    color: alpha(colors.white, 0.5),
    marginTop: 0,
  },
  viewAllText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
});
