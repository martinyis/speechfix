import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, LayoutChangeEvent, Dimensions } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { ExpoPlayAudioStream } from '@mykin-ai/expo-audio-stream';
import { AISpeakingOrb } from '../../components/AISpeakingOrb';
import { useIntroAudio } from '../../hooks/useIntroAudio';
import { colors, alpha } from '../../theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const TEXT_AREA_HEIGHT = SCREEN_HEIGHT * 0.30;
// Mask width for left-to-right text reveal (wider than text for soft trailing edge)
const MASK_WIDTH = (SCREEN_WIDTH - 56) * 1.4;

/** Progressive opacity based on distance from active segment */
function getTargetOpacity(distance: number): number {
  if (distance <= 0) return 1.0;
  if (distance === 1) return 0.5;
  if (distance === 2) return 0.28;
  if (distance === 3) return 0.15;
  return 0.06;
}

/** Single lyric segment — left-to-right reveal on mount, progressive dimming */
function LyricSegment({
  text,
  isActive,
  targetOpacity,
  onLayout,
}: {
  text: string;
  isActive: boolean;
  targetOpacity: number;
  onLayout: (e: LayoutChangeEvent) => void;
}) {
  const revealProgress = useSharedValue(0);
  const dimOpacity = useSharedValue(0);
  const hasEntered = useRef(false);

  useEffect(() => {
    if (!hasEntered.current) {
      hasEntered.current = true;
      revealProgress.value = withTiming(1, {
        duration: 800,
        easing: Easing.out(Easing.cubic),
      });
      dimOpacity.value = withTiming(targetOpacity, { duration: 800 });
    }
  }, []);

  useEffect(() => {
    if (hasEntered.current) {
      dimOpacity.value = withTiming(targetOpacity, { duration: 600 });
    }
  }, [targetOpacity]);

  // Animated gradient mask slides from left to right
  const maskAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (revealProgress.value - 1) * MASK_WIDTH }],
  }));

  const containerStyle = useAnimatedStyle(() => ({
    opacity: dimOpacity.value,
  }));

  return (
    <Animated.View onLayout={onLayout} style={[styles.segmentWrap, containerStyle]}>
      <MaskedView
        maskElement={
          <View style={{ flex: 1 }}>
            <Animated.View style={[{ width: MASK_WIDTH, height: '100%' }, maskAnimStyle]}>
              <LinearGradient
                colors={['black', 'black', alpha('#000000', 0)]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                locations={[0, 0.82, 1]}
                style={{ flex: 1 }}
              />
            </Animated.View>
          </View>
        }
      >
        <Text style={isActive ? styles.activeSegment : styles.pastSegment}>
          {text}
        </Text>
      </MaskedView>
    </Animated.View>
  );
}

export default function IntroAgentScreen() {
  const insets = useSafeAreaInsets();
  const {
    isLoading,
    isPlaying,
    isComplete,
    error,
    visibleText,
    currentBatchIndices,
    play,
    skip,
  } = useIntroAudio();
  const hasStartedRef = useRef(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const segmentYPositions = useRef<Record<number, number>>({});
  const scrollAreaHeight = useRef(0);
  const lastScrollY = useRef(0);

  const [showMicPrompt, setShowMicPrompt] = useState(false);

  // First active segment index for distance-based dimming
  const firstActiveIdx = useMemo(
    () => currentBatchIndices.length > 0 ? Math.min(...currentBatchIndices) : -1,
    [currentBatchIndices],
  );

  // Auto-play when audio is loaded
  useEffect(() => {
    if (!isLoading && !error && !hasStartedRef.current) {
      hasStartedRef.current = true;
      play();
    }
  }, [isLoading, error, play]);

  // Show mic prompt when audio completes
  useEffect(() => {
    if (isComplete) setShowMicPrompt(true);
  }, [isComplete]);

  // Smooth auto-scroll: only scroll when active segment is past 50% of visible area
  useEffect(() => {
    if (currentBatchIndices.length === 0) return;
    const idx = currentBatchIndices[0];

    const timer = setTimeout(() => {
      const y = segmentYPositions.current[idx];
      if (y == null || !scrollViewRef.current) return;

      const visibleBottom = lastScrollY.current + scrollAreaHeight.current;
      const threshold = lastScrollY.current + scrollAreaHeight.current * 0.5;

      // Only scroll if the segment is past the midpoint of the visible area
      if (y > threshold || y < lastScrollY.current) {
        const targetY = Math.max(0, y - scrollAreaHeight.current * 0.3);
        lastScrollY.current = targetY;
        scrollViewRef.current.scrollTo({ y: targetY, animated: true });
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [currentBatchIndices]);

  const handleScrollAreaLayout = useCallback((e: LayoutChangeEvent) => {
    scrollAreaHeight.current = e.nativeEvent.layout.height;
  }, []);

  const handleSegmentLayout = useCallback((index: number, e: LayoutChangeEvent) => {
    segmentYPositions.current[index] = e.nativeEvent.layout.y;
  }, []);

  const handleSkip = useCallback(() => {
    skip();
    setShowMicPrompt(true);
  }, [skip]);

  const handleRetry = useCallback(() => {
    hasStartedRef.current = false;
  }, []);

  const handleEnableMic = useCallback(async () => {
    skip();
    const { granted } = await ExpoPlayAudioStream.requestPermissionsAsync();
    if (granted) {
      router.push('/(onboarding)/voice-session');
    }
  }, [skip]);

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
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Skip button */}
      {(isPlaying || isLoading) && !showMicPrompt && (
        <Animated.View entering={FadeIn.delay(2000).duration(400)} style={styles.skipButtonWrap}>
          <Pressable onPress={handleSkip} hitSlop={12}>
            <Text style={styles.skipButtonText}>Skip</Text>
          </Pressable>
        </Animated.View>
      )}

      {/* AI Speaking Orb — flex:1 fills available space, pushes text to bottom */}
      <View style={styles.orbSection}>
        <AISpeakingOrb state={isPlaying ? 'speaking' : 'idle'} />
      </View>

      {/* Bottom: text reveal area */}
      {!showMicPrompt && (
        <Animated.View
          exiting={FadeOut.duration(300)}
          style={styles.textArea}
          onLayout={handleScrollAreaLayout}
        >
          <ScrollView
            ref={scrollViewRef}
            style={styles.textScroll}
            contentContainerStyle={styles.textScrollContent}
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={(e) => { lastScrollY.current = e.nativeEvent.contentOffset.y; }}
          >
            {visibleText.map((text, index) => {
              const isActive = currentBatchIndices.includes(index);
              const distance = firstActiveIdx >= 0 ? firstActiveIdx - index : 0;
              const targetOpacity = isActive ? 1.0 : getTargetOpacity(distance);

              return (
                <LyricSegment
                  key={index}
                  text={text}
                  isActive={isActive}
                  targetOpacity={targetOpacity}
                  onLayout={(e) => handleSegmentLayout(index, e)}
                />
              );
            })}
          </ScrollView>

          {/* Top fade — seamless blend into background (no transparent→black fringing) */}
          <LinearGradient
            colors={[colors.background, alpha(colors.background, 0.7), alpha(colors.background, 0)]}
            locations={[0, 0.5, 1]}
            style={styles.gradientTop}
            pointerEvents="none"
          />

          {/* Bottom fade */}
          <LinearGradient
            colors={[alpha(colors.background, 0), alpha(colors.background, 0.7), colors.background]}
            locations={[0, 0.5, 1]}
            style={styles.gradientBottom}
            pointerEvents="none"
          />

          {isLoading && (
            <Animated.Text entering={FadeIn.duration(400)} style={styles.loadingText}>
              Preparing your introduction...
            </Animated.Text>
          )}
        </Animated.View>
      )}

      {/* Inline mic permission prompt */}
      {showMicPrompt && (
        <Animated.View
          entering={FadeIn.delay(200).duration(300)}
          style={styles.micPromptArea}
        >
          <Pressable style={styles.micButton} onPress={handleEnableMic}>
            <Text style={styles.micButtonText}>Enable Microphone</Text>
          </Pressable>
          <Text style={styles.micFootnote}>Audio is never stored</Text>
        </Animated.View>
      )}
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
    height: TEXT_AREA_HEIGHT,
    paddingHorizontal: 28,
    marginTop: -40,
  },
  textScroll: {
    flex: 1,
  },
  textScrollContent: {
    paddingTop: 50,
    paddingBottom: 120,
  },
  segmentWrap: {
    marginBottom: 4,
  },
  activeSegment: {
    color: colors.primary,
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 28,
    textAlign: 'center',
  },
  pastSegment: {
    color: colors.primary,
    fontSize: 17,
    lineHeight: 24,
    textAlign: 'center',
  },
  gradientTop: {
    position: 'absolute',
    top: 0,
    left: -28,
    right: -28,
    height: 80,
    zIndex: 2,
  },
  gradientBottom: {
    position: 'absolute',
    bottom: 0,
    left: -28,
    right: -28,
    height: 80,
    zIndex: 2,
  },
  loadingText: {
    fontSize: 14,
    color: alpha(colors.white, 0.4),
    textAlign: 'center',
    position: 'absolute',
    alignSelf: 'center',
    top: '40%',
  },
  micPromptArea: {
    marginTop: 'auto',
    paddingHorizontal: 24,
    alignItems: 'center',
    paddingBottom: 20,
  },
  micButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 16,
    alignItems: 'center',
    width: '100%',
  },
  micButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.background,
  },
  micFootnote: {
    color: alpha(colors.white, 0.25),
    fontSize: 12,
    textAlign: 'center',
    marginTop: 16,
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
