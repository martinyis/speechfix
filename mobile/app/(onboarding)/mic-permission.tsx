import { useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ExpoPlayAudioStream } from '@mykin-ai/expo-audio-stream';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { colors, alpha, glass } from '../../theme';

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
        {/* Mic icon */}
        <Animated.View entering={FadeIn.duration(400)} style={styles.iconWrap}>
          <View style={styles.iconCircle}>
            <Ionicons name="mic" size={40} color={colors.primary} />
          </View>
        </Animated.View>

        {/* Title */}
        <Animated.Text entering={FadeInUp.delay(100).duration(400)} style={styles.title}>
          Enable your microphone
        </Animated.Text>

        {/* Subtitle */}
        <Animated.Text entering={FadeInUp.delay(200).duration(400)} style={styles.subtitle}>
          Reflexa needs mic access to listen to your speech and provide real-time coaching.
        </Animated.Text>

        {/* Privacy */}
        <Animated.View entering={FadeInUp.delay(300).duration(400)} style={styles.privacyRow}>
          <Ionicons name="lock-closed" size={14} color={alpha(colors.white, 0.4)} />
          <Text style={styles.privacyText}>Audio is processed in real-time and never stored</Text>
        </Animated.View>
      </View>

      {/* Continue button */}
      <Animated.View entering={FadeInUp.delay(400).duration(400)}>
        <Pressable style={styles.continueButton} onPress={handleContinue}>
          <Text style={styles.continueButtonText}>Continue</Text>
        </Pressable>
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
  iconWrap: {
    marginBottom: 32,
  },
  iconCircle: {
    width: 88,
    height: 88,
    ...glass.cardElevated,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.onSurface,
    letterSpacing: -0.5,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '400',
    color: alpha(colors.white, 0.55),
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
    maxWidth: 300,
  },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  privacyText: {
    fontSize: 13,
    color: alpha(colors.white, 0.4),
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
});
