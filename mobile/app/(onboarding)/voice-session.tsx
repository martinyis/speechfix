import { useEffect, useCallback, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { VoiceSessionOverlay } from '../../components/VoiceSessionOverlay';
import { useOnboardingVoiceSession } from '../../hooks/useOnboardingVoiceSession';
import { useSessionStore } from '../../stores/sessionStore';
import { useOnboardingStore } from '../../stores/onboardingStore';
import { useAuthStore } from '../../stores/authStore';
import { colors } from '../../theme';

export default function VoiceSessionScreen() {
  const voiceState = useSessionStore((s) => s.voiceSessionState);
  const elapsedTime = useSessionStore((s) => s.elapsedTime);
  const isMuted = useSessionStore((s) => s.isMuted);
  const startedRef = useRef(false);

  const navigateToHome = useCallback(() => {
    console.log('[onboarding] navigateToHome called');
    useAuthStore.getState().setSigningUp(false);
    useOnboardingStore.getState().reset();
    router.replace('/(tabs)');
  }, []);

  const handleComplete = useCallback((displayName: string | null, speechObservation: string | null, farewellMessage: string | null) => {
    console.log('[onboarding] handleComplete fired', { displayName, hasFarewell: !!farewellMessage });
    useOnboardingStore.getState().setOnboardingResult(displayName, speechObservation, farewellMessage);
    useAuthStore.getState().setOnboardingComplete();
    navigateToHome();
  }, [navigateToHome]);

  const handleError = useCallback((message: string) => {
    console.error('[onboarding] handleError:', message);
    useAuthStore.getState().setOnboardingComplete();
    navigateToHome();
  }, [navigateToHome]);

  const { start, stop, toggleMute } = useOnboardingVoiceSession({
    onComplete: handleComplete,
    onError: handleError,
  });

  // Auto-start voice session on mount
  useEffect(() => {
    console.log('[onboarding] VoiceSessionScreen mounted');
    if (!startedRef.current) {
      startedRef.current = true;
      start();
    }
  }, [start]);

  const handleStop = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    stop();
  }, [stop]);

  const handleToggleMute = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleMute();
  }, [toggleMute]);

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
});
