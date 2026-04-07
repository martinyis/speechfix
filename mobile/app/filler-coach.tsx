import { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { VoiceSessionOverlay } from '../components/VoiceSessionOverlay';
import { useSessionStore } from '../stores/sessionStore';
import { useVoiceSession } from '../hooks/useVoiceSession';
import { colors } from '../theme';

export default function FillerCoachScreen() {
  const hasStarted = useRef(false);

  const isActive = useSessionStore((s) => s.isVoiceSessionActive);
  const voiceState = useSessionStore((s) => s.voiceSessionState);
  const elapsedTime = useSessionStore((s) => s.elapsedTime);
  const isMuted = useSessionStore((s) => s.isMuted);

  const { start, stop, toggleMute } = useVoiceSession({
    mode: 'filler-coach',
    onSessionEnd: (results, dbSessionId) => {
      // If no data, just go back
      if (results.fillerWords.length === 0 && results.sentences.length === 0) {
        router.back();
        return;
      }
      router.replace({
        pathname: '/filler-coach-results',
        params: { fillerCoachSessionId: String(dbSessionId), fresh: 'true' },
      });
    },
    onError: (message) => {
      console.warn('Filler coach error:', message);
      router.back();
    },
  });

  // Auto-start session on mount
  useEffect(() => {
    if (!hasStarted.current) {
      hasStarted.current = true;
      start();
    }
  }, [start]);

  return (
    <View style={styles.container}>
      <VoiceSessionOverlay
        voiceState={isActive ? voiceState : 'listening'}
        elapsedTime={elapsedTime}
        isMuted={isMuted}
        onToggleMute={toggleMute}
        onStop={stop}
        agentName="Filler Coach"
        sessionMode="filler-coach"
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
