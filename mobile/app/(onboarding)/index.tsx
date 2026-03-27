import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, LayoutChangeEvent, Dimensions } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  useAnimatedRef,
  withTiming,
  scrollTo,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { scheduleOnUI } from 'react-native-worklets';
import { ExpoPlayAudioStream } from '@mykin-ai/expo-audio-stream';
import { AISpeakingOrb } from '../../components/AISpeakingOrb';
import { useIntroAudio } from '../../hooks/useIntroAudio';
import { INTRO_SEGMENTS, type SegmentTimings } from '../../lib/introTimestamps';
import { colors, alpha } from '../../theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const TEXT_AREA_HEIGHT = SCREEN_HEIGHT * 0.30;
const GRADIENT_HEIGHT = TEXT_AREA_HEIGHT * 0.40;

const SEGMENT_DIM_MAP = [1.0, 0.45, 0.25, 0.12];
const BASE_DIM = 0.06;

function WordToken({ word, isActive, isRevealed }: { word: string; isActive: boolean; isRevealed: boolean }) {
  const opacity = useSharedValue(0.18);
  const wasRevealed = useRef(false);

  useEffect(() => {
    if (isRevealed && !wasRevealed.current) {
      wasRevealed.current = true;
      opacity.value = withTiming(1.0, {
        duration: 2000,
        easing: Easing.out(Easing.cubic),
      });
    }
  }, [isRevealed]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.Text style={[styles.word, isActive && styles.wordActive, animStyle]}>
      {word + ' '}
    </Animated.Text>
  );
}

function SegmentBlock({
  segment,
  segmentIndex,
  revealedWordCount,
  currentWordIndex,
  currentSegmentIndex,
  globalWordOffset,
  onLayout,
}: {
  segment: SegmentTimings;
  segmentIndex: number;
  revealedWordCount: number;
  currentWordIndex: number;
  currentSegmentIndex: number;
  globalWordOffset: number;
  onLayout: (index: number, e: LayoutChangeEvent) => void;
}) {
  const segmentOpacity = useMemo(() => {
    if (currentSegmentIndex < 0) return 0.12;
    const distance = Math.abs(currentSegmentIndex - segmentIndex);
    return SEGMENT_DIM_MAP[distance] ?? BASE_DIM;
  }, [segmentIndex, currentSegmentIndex]);

  const dimOpacity = useSharedValue(segmentOpacity);

  useEffect(() => {
    dimOpacity.value = withTiming(segmentOpacity, { duration: 600 });
  }, [segmentOpacity]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: dimOpacity.value,
  }));

  return (
    <Animated.View
      style={[styles.segmentBlock, containerStyle]}
      onLayout={(e) => onLayout(segmentIndex, e)}
    >
      {segment.words.map((wordTiming, i) => {
        const globalIdx = globalWordOffset + i;
        const isRevealed = globalIdx < revealedWordCount;
        const isActive = globalIdx === currentWordIndex;
        return (
          <WordToken
            key={i}
            word={wordTiming.word}
            isActive={isActive}
            isRevealed={isRevealed}
          />
        );
      })}
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
    revealedWordCount,
    currentWordIndex,
    currentSegmentIndex,
    play,
    skip,
  } = useIntroAudio();
  const hasStartedRef = useRef(false);
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const segmentYPositions = useRef<Record<number, number>>({});
  const segmentHeights = useRef<Record<number, number>>({});
  const scrollAreaHeight = useRef(0);

  const [showMicPrompt, setShowMicPrompt] = useState(false);

  // Precompute global word offsets per segment
  const globalWordOffsets = useMemo(() => {
    const offsets: number[] = [];
    let cumulative = 0;
    for (const seg of INTRO_SEGMENTS) {
      offsets.push(cumulative);
      cumulative += seg.words.length;
    }
    return offsets;
  }, []);

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

  // Auto-scroll: center active segment vertically
  // scrollTo is a UI-thread API — must dispatch via scheduleOnUI
  useEffect(() => {
    if (currentSegmentIndex < 0) return;

    const y = segmentYPositions.current[currentSegmentIndex];
    const h = segmentHeights.current[currentSegmentIndex];
    if (y == null || h == null) return;

    const areaH = scrollAreaHeight.current;
    const targetY = Math.max(0, y - (areaH / 2) + (h / 2));

    scheduleOnUI(() => {
      'worklet';
      scrollTo(scrollRef, 0, targetY, true);
    });
  }, [currentSegmentIndex, scrollRef]);

  const handleScrollAreaLayout = useCallback((e: LayoutChangeEvent) => {
    scrollAreaHeight.current = e.nativeEvent.layout.height;
  }, []);

  const handleSegmentLayout = useCallback((index: number, e: LayoutChangeEvent) => {
    segmentYPositions.current[index] = e.nativeEvent.layout.y;
    segmentHeights.current[index] = e.nativeEvent.layout.height;
  }, []);

  const handleSkip = useCallback(() => {
    console.log('[onboarding] Intro skipped');
    skip();
    setShowMicPrompt(true);
  }, [skip]);

  const handleRetry = useCallback(() => {
    hasStartedRef.current = false;
  }, []);

  const handleEnableMic = useCallback(async () => {
    skip();
    const { granted } = await ExpoPlayAudioStream.requestPermissionsAsync();
    console.log('[onboarding] Enable mic tapped, permission:', granted ? 'granted' : 'denied');
    if (granted) {
      router.push('/(onboarding)/voice-session');
    }
  }, [skip]);

  const contentPaddingVertical = scrollAreaHeight.current
    ? scrollAreaHeight.current * 0.5
    : TEXT_AREA_HEIGHT * 0.5;

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
          <Animated.ScrollView
            ref={scrollRef}
            style={styles.textScroll}
            contentContainerStyle={[
              styles.textScrollContent,
              { paddingTop: contentPaddingVertical, paddingBottom: contentPaddingVertical },
            ]}
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
          >
            {INTRO_SEGMENTS.map((segment, idx) => (
              <SegmentBlock
                key={idx}
                segment={segment}
                segmentIndex={idx}
                revealedWordCount={revealedWordCount}
                currentWordIndex={currentWordIndex}
                currentSegmentIndex={currentSegmentIndex}
                globalWordOffset={globalWordOffsets[idx]}
                onLayout={handleSegmentLayout}
              />
            ))}
          </Animated.ScrollView>

          {/* Top fade — iOS picker style vignette */}
          <LinearGradient
            colors={[colors.background, alpha(colors.background, 0.85), alpha(colors.background, 0.3), alpha(colors.background, 0)]}
            locations={[0, 0.3, 0.7, 1]}
            style={styles.gradientTop}
            pointerEvents="none"
          />

          {/* Bottom fade */}
          <LinearGradient
            colors={[alpha(colors.background, 0), alpha(colors.background, 0.3), alpha(colors.background, 0.85), colors.background]}
            locations={[0, 0.3, 0.7, 1]}
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
    // paddingTop/paddingBottom set dynamically via contentPaddingVertical
  },
  segmentBlock: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 6,
  },
  word: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 30,
    color: '#c9a0f0',
  },
  wordActive: {
    color: '#e0c4ff',
  },
  gradientTop: {
    position: 'absolute',
    top: 0,
    left: -28,
    right: -28,
    height: GRADIENT_HEIGHT,
    zIndex: 2,
  },
  gradientBottom: {
    position: 'absolute',
    bottom: 0,
    left: -28,
    right: -28,
    height: GRADIENT_HEIGHT,
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
