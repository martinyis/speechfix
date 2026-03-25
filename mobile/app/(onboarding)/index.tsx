import { useEffect, useRef, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, LayoutChangeEvent } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import MicBloomOrb from '../../components/MicBloomOrb';
import { WordRevealText } from '../../components/WordRevealText';
import { useIntroAudio } from '../../hooks/useIntroAudio';
import { colors, alpha } from '../../theme';

export default function IntroAgentScreen() {
  const insets = useSafeAreaInsets();
  const {
    isLoading,
    isPlaying,
    isComplete,
    error,
    visibleText,
    currentSegmentIndex,
    revealedWords,
    play,
    skip,
  } = useIntroAudio();
  const hasStartedRef = useRef(false);
  const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const segmentYPositions = useRef<Record<number, number>>({});
  const scrollAreaHeight = useRef(0);

  // Auto-play when audio is loaded
  useEffect(() => {
    console.log('[IntroScreen] State:', { isLoading, error, hasStarted: hasStartedRef.current, isPlaying, isComplete });
    if (!isLoading && !error && !hasStartedRef.current) {
      console.log('[IntroScreen] Audio ready — triggering play()');
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

  // Auto-scroll to center current segment
  useEffect(() => {
    if (currentSegmentIndex < 0) return;
    const y = segmentYPositions.current[currentSegmentIndex];
    if (y != null && scrollViewRef.current) {
      const targetY = Math.max(0, y - scrollAreaHeight.current / 2 + 20);
      scrollViewRef.current.scrollTo({ y: targetY, animated: true });
    }
  }, [currentSegmentIndex]);

  const handleScrollAreaLayout = useCallback((e: LayoutChangeEvent) => {
    scrollAreaHeight.current = e.nativeEvent.layout.height;
  }, []);

  const handleSegmentLayout = useCallback((index: number, e: LayoutChangeEvent) => {
    segmentYPositions.current[index] = e.nativeEvent.layout.y;
  }, []);

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
      <View style={styles.textArea} onLayout={handleScrollAreaLayout}>
        <ScrollView
          ref={scrollViewRef}
          style={styles.textScroll}
          contentContainerStyle={styles.textScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {visibleText.map((text, index) => {
            const words = text.split(/\s+/);
            const isPast = index < currentSegmentIndex;
            const isCurrent = index === currentSegmentIndex;

            return (
              <Animated.View
                key={index}
                entering={FadeInDown.duration(300)}
                onLayout={(e) => handleSegmentLayout(index, e)}
                style={styles.segmentWrap}
              >
                <WordRevealText
                  words={words}
                  revealedCount={
                    isPast
                      ? words.length
                      : isCurrent
                        ? (revealedWords[index] ?? 0)
                        : 0
                  }
                  activeStyle={isPast ? styles.dimmedWord : styles.activeWord}
                />
              </Animated.View>
            );
          })}
        </ScrollView>

        {/* Top gradient fade */}
        <LinearGradient
          colors={[colors.background, 'transparent']}
          style={styles.gradientTop}
          pointerEvents="none"
        />

        {/* Bottom gradient fade */}
        <LinearGradient
          colors={['transparent', colors.background]}
          style={styles.gradientBottom}
          pointerEvents="none"
        />

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
    flex: 0.6,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'visible',
  },
  textArea: {
    flex: 1,
    maxHeight: 320,
    paddingHorizontal: 32,
  },
  textScroll: {
    flex: 1,
  },
  textScrollContent: {
    paddingTop: 48,
    paddingBottom: 48,
  },
  segmentWrap: {
    marginBottom: 12,
  },
  activeWord: {
    color: colors.onSurface,
    fontSize: 20,
    lineHeight: 30,
  },
  dimmedWord: {
    color: alpha(colors.white, 0.25),
    fontSize: 20,
    lineHeight: 30,
  },
  gradientTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 48,
    zIndex: 2,
  },
  gradientBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 48,
    zIndex: 2,
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
