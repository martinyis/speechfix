import { useEffect, useRef, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import MicBloomOrb from '../../components/MicBloomOrb';
import { useIntroAudio } from '../../hooks/useIntroAudio';
import { colors, alpha } from '../../theme';

export default function IntroAgentScreen() {
  const insets = useSafeAreaInsets();
  const { isLoading, isPlaying, isComplete, error, visibleText, currentSegmentIndex, play, skip } = useIntroAudio();
  const hasStartedRef = useRef(false);
  const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-play when audio is loaded
  useEffect(() => {
    if (!isLoading && !error && !hasStartedRef.current) {
      hasStartedRef.current = true;
      play();
    }
  }, [isLoading, error, play]);

  // Auto-advance after completion
  useEffect(() => {
    if (isComplete) {
      autoAdvanceRef.current = setTimeout(() => {
        router.push('/(onboarding)/mic-permission');
      }, 1200);
    }
    return () => {
      if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
    };
  }, [isComplete]);

  const handleSkip = useCallback(() => {
    if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
    skip();
    router.push('/(onboarding)/mic-permission');
  }, [skip]);

  const handleRetry = useCallback(() => {
    hasStartedRef.current = false;
  }, []);

  if (error) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Couldn't load intro</Text>
          <Text style={styles.errorSubtext}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={handleRetry}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
          <Pressable style={styles.skipLink} onPress={handleSkip}>
            <Text style={styles.skipLinkText}>Skip intro</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom + 20 }]}>
      {/* Skip button */}
      {(isPlaying || isLoading) && (
        <Animated.View entering={FadeIn.delay(2000).duration(400)} style={styles.skipButtonWrap}>
          <Pressable onPress={handleSkip} hitSlop={12}>
            <Text style={styles.skipButtonText}>Skip</Text>
          </Pressable>
        </Animated.View>
      )}

      {/* Center: Orb */}
      <View style={styles.orbSection}>
        <MicBloomOrb />
      </View>

      {/* Bottom: Text reveal area */}
      <View style={styles.textArea}>
        <ScrollView
          style={styles.textScroll}
          contentContainerStyle={styles.textScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {visibleText.map((text, index) => (
            <Animated.Text
              key={index}
              entering={FadeInDown.duration(300)}
              style={[
                styles.segmentText,
                index === currentSegmentIndex && styles.segmentTextActive,
              ]}
            >
              {text}
            </Animated.Text>
          ))}
        </ScrollView>

        {isLoading && (
          <Animated.Text entering={FadeIn.duration(400)} style={styles.loadingText}>
            Preparing your introduction...
          </Animated.Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  skipButtonWrap: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 10,
  },
  skipButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: alpha(colors.white, 0.5),
  },
  orbSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'visible',
  },
  textArea: {
    height: 180,
    paddingHorizontal: 32,
  },
  textScroll: {
    flex: 1,
  },
  textScrollContent: {
    paddingBottom: 16,
  },
  segmentText: {
    fontSize: 18,
    fontWeight: '400',
    color: alpha(colors.white, 0.35),
    lineHeight: 28,
    textAlign: 'center',
  },
  segmentTextActive: {
    color: colors.primary,
    fontWeight: '500',
  },
  loadingText: {
    fontSize: 14,
    color: alpha(colors.white, 0.4),
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.onSurface,
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 14,
    color: alpha(colors.white, 0.5),
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 16,
    marginBottom: 16,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.background,
  },
  skipLink: {
    padding: 8,
  },
  skipLinkText: {
    fontSize: 14,
    color: alpha(colors.white, 0.4),
  },
});
