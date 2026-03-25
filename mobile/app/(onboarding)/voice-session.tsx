import { useEffect, useCallback, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { VoiceSessionOverlay } from '../../components/VoiceSessionOverlay';
import { useOnboardingVoiceSession } from '../../hooks/useOnboardingVoiceSession';
import { useSessionStore } from '../../stores/sessionStore';
import { useOnboardingStore } from '../../stores/onboardingStore';
import { useAuthStore } from '../../stores/authStore';
import { colors, alpha, typography } from '../../theme';

export default function VoiceSessionScreen() {
  const insets = useSafeAreaInsets();
  const voiceState = useSessionStore((s) => s.voiceSessionState);
  const elapsedTime = useSessionStore((s) => s.elapsedTime);
  const isMuted = useSessionStore((s) => s.isMuted);
  const startedRef = useRef(false);

  const [showFarewell, setShowFarewell] = useState(false);
  const [farewellData, setFarewellData] = useState<{ greeting: string; message: string } | null>(null);
  const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleComplete = useCallback((displayName: string | null, speechObservation: string | null, farewellMessage: string | null) => {
    useOnboardingStore.getState().setOnboardingResult(displayName, speechObservation, farewellMessage);
    useAuthStore.getState().setOnboardingComplete();

    const greeting = displayName ? `Nice to meet you, ${displayName}` : 'Nice to meet you';
    const message = farewellMessage || "You're all set! Explore the app and start improving your speech.";

    setFarewellData({ greeting, message });
    setShowFarewell(true);
  }, []);

  const handleError = useCallback((message: string) => {
    console.warn('Onboarding voice error:', message);
    useAuthStore.getState().setOnboardingComplete();
    useAuthStore.getState().setSigningUp(false);
    useOnboardingStore.getState().reset();
    router.replace('/(tabs)');
  }, []);

  const { start, stop, toggleMute } = useOnboardingVoiceSession({
    onComplete: handleComplete,
    onError: handleError,
  });

  // Auto-start voice session on mount
  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true;
      start();
    }
  }, [start]);

  // Auto-advance after farewell shows
  useEffect(() => {
    if (showFarewell) {
      autoAdvanceRef.current = setTimeout(() => {
        navigateToHome();
      }, 5000);
    }
    return () => {
      if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
    };
  }, [showFarewell]);

  const navigateToHome = useCallback(() => {
    if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
    useAuthStore.getState().setSigningUp(false);
    useOnboardingStore.getState().reset();
    router.replace('/(tabs)');
  }, []);

  const handleStop = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    stop();
  }, [stop]);

  const handleToggleMute = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleMute();
  }, [toggleMute]);

  if (showFarewell && farewellData) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 40 }]}>
        <View style={styles.farewellContent}>
          <Animated.Text entering={FadeIn.duration(600)} style={styles.farewellGreeting}>
            {farewellData.greeting}
          </Animated.Text>
          <Animated.Text entering={FadeInUp.delay(400).duration(500)} style={styles.farewellMessage}>
            {farewellData.message}
          </Animated.Text>
        </View>
        <Animated.View entering={FadeInUp.delay(800).duration(400)}>
          <Pressable style={styles.startButton} onPress={navigateToHome}>
            <Text style={styles.startButtonText}>Start exploring</Text>
          </Pressable>
        </Animated.View>
      </View>
    );
  }

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  farewellContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  farewellGreeting: {
    ...typography.headlineLg,
    color: colors.onSurface,
    textAlign: 'center',
    marginBottom: 16,
  },
  farewellMessage: {
    ...typography.bodyLg,
    color: alpha(colors.white, 0.55),
    textAlign: 'center',
    lineHeight: 26,
    maxWidth: 300,
  },
  startButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginHorizontal: 24,
  },
  startButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.background,
  },
});
