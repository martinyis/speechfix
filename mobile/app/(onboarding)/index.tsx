import { useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import MicBloomOrb from '../../components/MicBloomOrb';
import { VoiceSessionOverlay } from '../../components/VoiceSessionOverlay';
import { useOnboardingVoiceSession } from '../../hooks/useOnboardingVoiceSession';
import { useSessionStore } from '../../stores/sessionStore';
import { useAuthStore } from '../../stores/authStore';
import { colors, alpha } from '../../theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type OnboardingMode = 'intro' | 'voice';

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<OnboardingMode>('intro');
  const [error, setError] = useState('');

  const voiceState = useSessionStore((s) => s.voiceSessionState);
  const elapsedTime = useSessionStore((s) => s.elapsedTime);
  const isMuted = useSessionStore((s) => s.isMuted);
  const isActive = useSessionStore((s) => s.isVoiceSessionActive);

  const micScale = useSharedValue(1);

  const completeOnboarding = useCallback(() => {
    useAuthStore.getState().setOnboardingComplete();
    useAuthStore.getState().setSigningUp(false);
    router.replace('/(tabs)');
  }, []);

  const { start, stop, toggleMute } = useOnboardingVoiceSession({
    onComplete: () => {
      completeOnboarding();
    },
    onError: (message) => {
      console.warn('Onboarding voice error:', message);
      setError(message);
      setMode('intro');
    },
  });

  const handleStartVoice = useCallback(() => {
    setError('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setMode('voice');
    start();
  }, [start]);

  const handleMicPressIn = useCallback(() => {
    micScale.value = withSpring(0.93, { damping: 15, stiffness: 300 });
  }, []);

  const handleMicPressOut = useCallback(() => {
    micScale.value = withSpring(1, { damping: 15, stiffness: 300 });
  }, []);

  const handleStop = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    stop();
  }, [stop]);

  const handleToggleMute = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleMute();
  }, [toggleMute]);

  const micAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: micScale.value }],
  }));

  // Voice active: show full-screen VoiceSessionOverlay (same as home screen)
  if (mode === 'voice' && isActive) {
    return (
      <View style={styles.container}>
        <VoiceSessionOverlay
          voiceState={voiceState}
          elapsedTime={elapsedTime}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          onStop={handleStop}
          mode="onboarding"
        />
      </View>
    );
  }

  // Intro mode
  return (
    <View style={[styles.container, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 20 }]}>
      <View style={styles.introContent}>
        <Text style={styles.welcomeTitle}>Welcome to Reflexa</Text>
        <Text style={styles.welcomeSubtitle}>
          Let's get to know you with a quick{'\n'}voice chat with your speaking coach
        </Text>

        {error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : null}

        {/* MicBloomOrb — same Skia component as home screen */}
        <View style={styles.orbSection}>
          <AnimatedPressable
            onPress={handleStartVoice}
            onPressIn={handleMicPressIn}
            onPressOut={handleMicPressOut}
            accessibilityLabel="Start voice onboarding"
            accessibilityRole="button"
          >
            <Animated.View style={micAnimStyle}>
              <MicBloomOrb />
            </Animated.View>
          </AnimatedPressable>

          <View style={styles.hintContainer}>
            <Text style={styles.hintText}>{error ? 'TAP TO RETRY' : 'TAP TO BEGIN'}</Text>
            <View style={styles.hintDots}>
              <View style={[styles.hintDot, styles.hintDotActive]} />
              <View style={styles.hintDot} />
              <View style={styles.hintDot} />
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // -- Intro --
  introContent: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  welcomeTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.onSurface,
    letterSpacing: -1,
    textAlign: 'center',
  },
  welcomeSubtitle: {
    fontSize: 15,
    color: alpha(colors.white, 0.50),
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 22,
  },
  errorText: {
    fontSize: 14,
    color: colors.error,
    textAlign: 'center',
    marginTop: 16,
  },
  orbSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: -24,
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
});
