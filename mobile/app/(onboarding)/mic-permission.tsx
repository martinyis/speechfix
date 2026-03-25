import { useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ExpoPlayAudioStream } from '@mykin-ai/expo-audio-stream';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { colors, alpha, typography } from '../../theme';
import MicBloomOrb from '../../components/MicBloomOrb';

export default function MicPermissionScreen() {
  const insets = useSafeAreaInsets();

  const handleContinue = useCallback(async () => {
    const { granted } = await ExpoPlayAudioStream.requestPermissionsAsync();
    if (granted) {
      router.push('/(onboarding)/voice-session');
    }
    // If denied, the system dialog handles it — user can tap again
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 40 }]}>
      <View style={styles.content}>
        {/* Bloom orb */}
        <Animated.View entering={FadeIn.duration(400)} style={styles.orbWrap}>
          <MicBloomOrb />
        </Animated.View>

        {/* Title */}
        <Animated.Text entering={FadeInUp.delay(100).duration(400).springify().damping(15)} style={styles.title}>
          Enable your microphone
        </Animated.Text>

        {/* Subtitle */}
        <Animated.Text entering={FadeInUp.delay(200).duration(400).springify().damping(15)} style={styles.subtitle}>
          Reflexa listens to your speech and coaches you in real time.
        </Animated.Text>
      </View>

      {/* Continue button */}
      <Animated.View entering={FadeInUp.delay(300).duration(400).springify().damping(15)}>
        <Pressable style={styles.continueButton} onPress={handleContinue}>
          <Text style={styles.continueButtonText}>Continue</Text>
        </Pressable>
        <Text style={styles.footnote}>Audio is never stored</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 24,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orbWrap: {
    marginBottom: 40,
  },
  title: {
    ...typography.headlineMd,
    color: colors.onSurface,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    ...typography.bodyLg,
    color: alpha(colors.white, 0.55),
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 300,
  },
  continueButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  continueButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.background,
  },
  footnote: {
    color: alpha(colors.white, 0.25),
    fontSize: 12,
    textAlign: 'center',
    marginTop: 16,
  },
});
