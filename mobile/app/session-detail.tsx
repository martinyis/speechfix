import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import Animated, {
  FadeIn,
  FadeInDown,
  useSharedValue,
  useAnimatedScrollHandler,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';

import { useSessionStore } from '../stores/sessionStore';
import { useSession } from '../hooks/useSession';
import { usePracticeTasks } from '../hooks/usePracticeTasks';
import { SessionSummaryCard } from '../components/SessionSummaryCard';
import { StickySessionBar } from '../components/StickySessionBar';
import { CorrectionFilterChips } from '../components/CorrectionFilterChips';
import { CorrectionCard } from '../components/CorrectionCard';
import { AnalyzingBanner } from '../components/AnalyzingBanner';
import { ScreenHeader, EmptyState, GlassIconPillButton } from '../components/ui';
import { formatDuration } from '../lib/formatters';
import { colors, alpha, fonts } from '../theme';
import type { SessionDetail, CorrectionFilter } from '../types/session';

const INITIAL_CORRECTION_LIMIT = 5;

export default function SessionDetailScreen() {
  const { sessionId, fresh } = useLocalSearchParams<{
    sessionId: string;
    fresh?: string;
  }>();
  const insets = useSafeAreaInsets();
  const isFresh = fresh === 'true';

  // Filter state
  const [correctionFilter, setCorrectionFilter] = useState<CorrectionFilter>('all');
  const [showAllCorrections, setShowAllCorrections] = useState(false);

  // Scroll tracking for sticky bar
  const scrollY = useSharedValue(0);
  const [summaryCardBottom, setSummaryCardBottom] = useState(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  // Data sources
  const storeData = useSessionStore((s) => s.currentSessionData);
  const isStreaming = useSessionStore((s) => s.isStreamingAnalysis);
  const storeSessionId = useSessionStore((s) => s.currentSessionId);
  const {
    data: fetchedData,
    isLoading,
    isError,
  } = useSession(isFresh ? null : Number(sessionId));

  // Use real dbSessionId once available (replaces placeholder '0')
  const resolvedSessionId = isFresh && storeSessionId ? storeSessionId : Number(sessionId);

  const session: SessionDetail | null | undefined = isFresh
    ? storeData
    : fetchedData;

  // Practice tasks for floating button
  const { data: allTasks, refetch: refetchPracticeTasks } = usePracticeTasks();
  const unpracticedCount = useMemo(() => {
    if (!allTasks || !resolvedSessionId) return 0;
    return allTasks.filter(t => t.sessionId === resolvedSessionId && !t.practiced).length;
  }, [allTasks, resolvedSessionId]);

  const practicedIds = useMemo(() => {
    if (!allTasks) return new Set<number>();
    return new Set(allTasks.filter(t => t.practiced).map(t => t.correctionId));
  }, [allTasks]);

  // Refetch practice tasks when screen regains focus
  useFocusEffect(
    useCallback(() => {
      refetchPracticeTasks();
    }, [refetchPracticeTasks]),
  );

  // Refetch practice tasks when streaming ends (corrections now exist in DB)
  const wasStreamingRef = useRef(isStreaming);
  useEffect(() => {
    if (wasStreamingRef.current && !isStreaming) {
      // Small delay to ensure DB writes have settled
      const timer = setTimeout(() => refetchPracticeTasks(), 500);
      return () => clearTimeout(timer);
    }
    wasStreamingRef.current = isStreaming;
  }, [isStreaming, refetchPracticeTasks]);

  // Compute summary counts
  const counts = useMemo(() => {
    if (!session) return null;
    const errorCount = session.corrections.filter(
      (c) => c.severity === 'error',
    ).length;
    const improvementCount = session.corrections.filter(
      (c) => c.severity === 'improvement',
    ).length;
    const polishCount = session.corrections.filter(
      (c) => c.severity === 'polish',
    ).length;
    const sentencesWithCorrections = new Set(
      session.corrections.map((c) => c.sentenceIndex),
    ).size;
    return {
      errorCount,
      improvementCount,
      polishCount,
      sentencesWithCorrections,
    };
  }, [session]);

  // Filtered + limited corrections
  const filteredCorrections = useMemo(() => {
    if (!session) return [];
    if (correctionFilter === 'all') return session.corrections;
    return session.corrections.filter((c) => c.severity === correctionFilter);
  }, [session, correctionFilter]);

  const visibleCorrections = showAllCorrections
    ? filteredCorrections
    : filteredCorrections.slice(0, INITIAL_CORRECTION_LIMIT);

  const hiddenCount = filteredCorrections.length - visibleCorrections.length;

  // Filter chip tap -> set filter + reset "show all"
  const handleFilterChipPress = useCallback((filter: CorrectionFilter) => {
    setCorrectionFilter(filter);
    setShowAllCorrections(false);
  }, []);

  const handleBack = useCallback(() => {
    if (isFresh) {
      router.replace('/(tabs)');
    } else {
      router.back();
    }
  }, [isFresh]);

  // -- Loading / error states for historical mode --
  if (!isFresh && isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!isFresh && isError) {
    return (
      <EmptyState
        fullScreen
        icon="alert-circle-outline"
        iconColor={alpha(colors.white, 0.2)}
        title="Session not found"
      />
    );
  }

  // -- Fresh mode: still analyzing (no corrections yet) --
  if (isFresh && !session && !isStreaming) {
    return (
      <View style={styles.container}>
        <ScreenHeader
          variant="back"
          onBack={() => router.replace('/(tabs)')}
        />

        <AnalyzingBanner visible />
      </View>
    );
  }

  // -- Session data available (or streaming with corrections) --
  if (!session || !counts) return null;

  const totalSentences = session.sentences.length;
  const cleanSentences = Math.max(0, totalSentences - counts.sentencesWithCorrections);
  const clarityScore =
    totalSentences > 0
      ? Math.round((cleanSentences / totalSentences) * 100)
      : 100;

  const hasCorrections = session.corrections.length > 0;

  // Animation wrapper helper
  const maybeAnimate = (
    node: React.ReactNode,
    entering: Parameters<typeof Animated.View>[0]['entering'],
    key?: string,
  ) =>
    isFresh ? (
      <Animated.View key={key} entering={entering}>
        {node}
      </Animated.View>
    ) : (
      node
    );

  return (
    <View style={styles.container}>
      {/* Sticky top bar (normal header) */}
      <ScreenHeader
        variant="back"
        onBack={handleBack}
        rightAction={
          <Text style={styles.topBarDuration}>
            {formatDuration(session.durationSeconds)}
          </Text>
        }
      />

      {/* Sticky session bar (appears on scroll — hidden while streaming) */}
      {!isStreaming && (
        <StickySessionBar
          scrollY={scrollY}
          threshold={summaryCardBottom}
          clarityScore={clarityScore}
          errorCount={counts.errorCount}
          improvementCount={counts.improvementCount}
          polishCount={counts.polishCount}
          durationSeconds={session.durationSeconds}
          onBack={handleBack}
          activeFilter={correctionFilter}
          onFilterChange={handleFilterChipPress}
          totalCorrections={session.corrections.length}
        />
      )}

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Analyzing banner during streaming */}
        {isStreaming && <AnalyzingBanner visible />}

        {/* Summary strip — hidden while streaming (needs clarityScore) */}
        {!isStreaming && (
          <View
            onLayout={(e) => {
              const { y, height } = e.nativeEvent.layout;
              setSummaryCardBottom(y + height);
            }}
          >
            {maybeAnimate(
              <SessionSummaryCard
                clarityScore={clarityScore}
                errorCount={counts.errorCount}
                improvementCount={counts.improvementCount}
                polishCount={counts.polishCount}
                fillerWords={session.fillerWords}
                durationSeconds={session.durationSeconds}
              />,
              FadeIn.duration(300),
            )}
          </View>
        )}

        {/* Refinements section */}
        <View style={styles.refinementsSection}>
          <Text style={styles.refinementsLabel}>REFINEMENTS</Text>

          <View style={styles.filterChipsWrap}>
            <CorrectionFilterChips
              activeFilter={correctionFilter}
              onFilterChange={handleFilterChipPress}
              counts={{
                all: session.corrections.length,
                error: counts.errorCount,
                improvement: counts.improvementCount,
                polish: counts.polishCount,
              }}
            />
          </View>

          {visibleCorrections.length > 0 ? (
            <>
              {visibleCorrections.map((c, i) => {
                const sentence =
                  session.sentences[c.sentenceIndex] ?? '';
                const key = c.id ?? i;
                const card = (
                  <CorrectionCard
                    key={key}
                    sentence={sentence}
                    originalText={c.originalText}
                    correctedText={c.correctedText}
                    explanation={c.explanation}
                    correctionType={c.correctionType}
                    severity={c.severity}
                    practiced={c.id != null && practicedIds.has(c.id)}
                  />
                );
                if (isFresh) {
                  const baseDelay = 200;
                  return (
                    <Animated.View
                      key={key}
                      entering={FadeInDown.duration(300).delay(baseDelay + i * 100)}
                    >
                      {card}
                    </Animated.View>
                  );
                }
                return card;
              })}

              {/* Show remaining strip */}
              {hiddenCount > 0 && (
                <Pressable
                  style={styles.showRemainingStrip}
                  onPress={() => setShowAllCorrections(true)}
                >
                  <Text style={styles.showRemainingText}>
                    Showing {visibleCorrections.length} of {filteredCorrections.length}
                  </Text>
                  <Text style={styles.showRemainingAction}> Show remaining</Text>
                </Pressable>
              )}
            </>
          ) : hasCorrections ? (
            <EmptyState
              title={`No ${correctionFilter === 'error' ? 'errors' : correctionFilter === 'improvement' ? 'improvements' : 'polish suggestions'} found`}
            />
          ) : (
            <EmptyState
              icon="checkmark-circle-outline"
              iconColor={alpha(colors.severityPolish, 0.5)}
              title="No issues found"
              subtitle="Your speech was grammatically clean"
            />
          )}
        </View>

        {/* Bottom padding — extra space when floating button visible */}
        <View style={{ height: insets.bottom + (unpracticedCount > 0 && !isStreaming ? 120 : 60) }} />
      </Animated.ScrollView>

      {/* Floating Practice button */}
      {unpracticedCount > 0 && !isStreaming && (
        <View style={[styles.floatingButton, { bottom: insets.bottom + 16 }]}>
          <GlassIconPillButton
            label={`Practice (${unpracticedCount})`}
            icon="fitness-outline"
            variant="primary"
            fullWidth
            onPress={() => {
              router.push({
                pathname: '/practice-session',
                params: { sessionId: String(resolvedSessionId), mode: 'say_it_right' },
              });
            }}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 20,
  },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },

  // Header
  topBarDuration: {
    fontSize: 13,
    color: alpha(colors.white, 0.3),
    fontFamily: fonts.medium,
    letterSpacing: 0.5,
  },

  // Refinements
  refinementsSection: {
    marginTop: 28,
  },
  refinementsLabel: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: alpha(colors.white, 0.25),
    letterSpacing: 1.2,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  filterChipsWrap: {
    marginBottom: 16,
  },

  // Show remaining
  showRemainingStrip: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    marginHorizontal: 20,
    marginTop: 4,
    borderRadius: 12,
    backgroundColor: alpha(colors.white, 0.03),
    borderWidth: 1,
    borderColor: alpha(colors.white, 0.06),
  },
  showRemainingText: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: alpha(colors.white, 0.35),
  },
  showRemainingAction: {
    fontSize: 13,
    fontFamily: fonts.semibold,
    color: colors.primary,
  },

  // Floating practice button
  floatingButton: {
    position: 'absolute',
    left: 20,
    right: 20,
  },
});
