import { useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInUp, SlideInUp } from 'react-native-reanimated';
import { useOnboardingStore } from '../../stores/onboardingStore';
import { useAuthStore } from '../../stores/authStore';
import { colors, alpha, glass } from '../../theme';

export default function AnalysisRevealScreen() {
  const insets = useSafeAreaInsets();
  const displayName = useOnboardingStore((s) => s.displayName);
  const speechObservation = useOnboardingStore((s) => s.speechObservation);

  const handleGetStarted = useCallback(() => {
    useAuthStore.getState().setSigningUp(false);
    useOnboardingStore.getState().reset();
    router.replace('/(tabs)');
  }, []);

  const greeting = displayName
    ? `Nice to meet you, ${displayName}`
    : 'Nice to meet you';

  return (
    <View style={[styles.container, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 }]}>
      <View style={styles.content}>
        {/* Checkmark */}
        <Animated.View entering={FadeIn.duration(500)} style={styles.checkWrap}>
          <View style={styles.checkCircle}>
            <Ionicons name="checkmark" size={36} color={colors.primary} />
          </View>
        </Animated.View>

        {/* Greeting */}
        <Animated.Text entering={FadeInUp.delay(300).duration(400)} style={styles.greeting}>
          {greeting}
        </Animated.Text>

        {/* Speech observation card */}
        {speechObservation && (
          <Animated.View entering={SlideInUp.delay(600).duration(500).springify()} style={styles.observationCard}>
            <Text style={styles.observationLabel}>FIRST OBSERVATION</Text>
            <Text style={styles.observationText}>{speechObservation}</Text>
          </Animated.View>
        )}

        {/* Teaser */}
        <Animated.Text entering={FadeInUp.delay(900).duration(400)} style={styles.teaser}>
          Full sessions give you detailed breakdowns of grammar, filler words, clarity scores, and more.
        </Animated.Text>
      </View>

      {/* CTA */}
      <Animated.View entering={FadeInUp.delay(1100).duration(400)}>
        <Pressable style={styles.ctaButton} onPress={handleGetStarted}>
          <Text style={styles.ctaButtonText}>Let's get started</Text>
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
  checkWrap: {
    marginBottom: 24,
  },
  checkCircle: {
    width: 72,
    height: 72,
    ...glass.cardElevated,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greeting: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.onSurface,
    letterSpacing: -0.5,
    textAlign: 'center',
    marginBottom: 32,
  },
  observationCard: {
    ...glass.card,
    padding: 20,
    width: '100%',
    marginBottom: 24,
  },
  observationLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: colors.primary,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  observationText: {
    fontSize: 15,
    fontWeight: '400',
    color: alpha(colors.white, 0.75),
    lineHeight: 23,
  },
  teaser: {
    fontSize: 14,
    fontWeight: '400',
    color: alpha(colors.white, 0.4),
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 300,
  },
  ctaButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  ctaButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.background,
  },
});
