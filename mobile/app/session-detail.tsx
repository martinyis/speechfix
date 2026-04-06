import { useMemo, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import Animated, {
  FadeIn,
  FadeInDown,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';

import { useSessionStore } from '../stores/sessionStore';
import { useSession } from '../hooks/useSession';
import { usePracticeTasks } from '../hooks/usePracticeTasks';
import { SessionVerdict } from '../components/SessionVerdict';
import { CorrectionsPreview } from '../components/CorrectionsPreview';
import { AnalyzingBanner } from '../components/AnalyzingBanner';
import { ScreenHeader, EmptyState, GlassIconPillButton } from '../components/ui';
import { formatDuration } from '../lib/formatters';
import { colors, alpha, fonts } from '../theme';
import type { SessionDetail } from '../types/session';

export default function SessionDetailScreen() {
  const { sessionId, fresh } = useLocalSearchParams<{
    sessionId: string;
    fresh?: string;
  }>();
  const insets = useSafeAreaInsets();
  const isFresh = fresh === 'true';

  // Data sources
  const storeData = useSessionStore((s) => s.currentSessionData);
  const isStreaming = useSessionStore((s) => s.isStreamingAnalysis);
  const isInsightsReady = useSessionStore((s) => s.isInsightsReady);
  const storeSessionId = useSessionStore((s) => s.currentSessionId);
  const {
    data: fetchedData,
    isLoading,
    isError,
  } = useSession(isFresh ? null : Number(sessionId));

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

  useFocusEffect(
    useCallback(() => {
      refetchPracticeTasks();
    }, [refetchPracticeTasks]),
  );

  // Refetch practice tasks when streaming ends
  const wasStreamingRef = useRef(isStreaming);
  useEffect(() => {
    if (wasStreamingRef.current && !isStreaming) {
      const timer = setTimeout(() => refetchPracticeTasks(), 500);
      return () => clearTimeout(timer);
    }
    wasStreamingRef.current = isStreaming;
  }, [isStreaming, refetchPracticeTasks]);

  // Handlers
  const handleBack = useCallback(() => {
    if (isFresh) {
      router.replace('/(tabs)');
    } else {
      router.back();
    }
  }, [isFresh]);

  const handlePracticeCorrection = useCallback((correctionId: number) => {
    router.push({
      pathname: '/practice-session',
      params: {
        correctionId: String(correctionId),
        sessionId: String(resolvedSessionId),
        mode: 'say_it_right',
      },
    });
  }, [resolvedSessionId]);

  const handleSeeAllCorrections = useCallback(() => {
    router.push('/corrections-list');
  }, []);

  const handlePracticeAll = useCallback(() => {
    router.push({
      pathname: '/practice-session',
      params: { sessionId: String(resolvedSessionId), mode: 'say_it_right' },
    });
  }, [resolvedSessionId]);

  // -- Loading / error states --
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

  // Determine what phase we're in for fresh sessions
  const showAnalyzingBanner = isFresh && !isInsightsReady && !session;
  const insightsAvailable = isFresh ? isInsightsReady : true;
  const correctionsStillStreaming = isFresh && isStreaming && isInsightsReady;

  // -- Fresh mode: still analyzing (no insights yet) --
  if (showAnalyzingBanner) {
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

  if (!session) return null;

  const hasCorrections = session.corrections.length > 0;
  const hasInsights = session.sessionInsights.length > 0;
  const isClean = !hasCorrections && !correctionsStillStreaming;
  const analysisComplete = !isStreaming;

  return (
    <View style={styles.container}>
      <ScreenHeader
        variant="back"
        onBack={handleBack}
        rightAction={
          <Text style={styles.topBarDuration}>
            {formatDuration(session.durationSeconds)}
          </Text>
        }
      />

      <Animated.ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Session Verdict — score, assessment, fillers, strength, focus */}
        {insightsAvailable && (
          <Animated.View entering={isFresh ? FadeIn.duration(300) : undefined}>
            <SessionVerdict
              insights={session.sessionInsights}
              fillerWords={session.fillerWords}
              durationSeconds={session.durationSeconds}
              isFresh={isFresh}
              isLoading={isFresh && !hasInsights && !isClean}
            />
          </Animated.View>
        )}

        {/* "Checking grammar..." indicator while corrections stream in */}
        {correctionsStillStreaming && !hasCorrections && (
          <Animated.View
            style={styles.grammarIndicator}
            entering={FadeIn.duration(200)}
          >
            <ActivityIndicator size="small" color={alpha(colors.white, 0.3)} />
            <Text style={styles.grammarIndicatorText}>Checking grammar...</Text>
          </Animated.View>
        )}

        {/* Corrections Preview — flat layout */}
        {(hasCorrections || correctionsStillStreaming) && (
          <CorrectionsPreview
            corrections={session.corrections}
            sentences={session.sentences}
            practicedIds={practicedIds}
            totalCount={session.corrections.length}
            onPractice={handlePracticeCorrection}
            onSeeAll={handleSeeAllCorrections}
            isStreaming={isStreaming}
            isFresh={isFresh}
          />
        )}

        {/* Clean session empty state — only show after analysis is complete */}
        {analysisComplete && isClean && (
          <EmptyState
            icon="checkmark-circle-outline"
            iconColor={alpha(colors.severityPolish, 0.5)}
            title="Clean session"
            subtitle="No corrections detected"
          />
        )}

        {/* Bottom padding */}
        <View style={{ height: insets.bottom + (unpracticedCount > 0 && analysisComplete ? 120 : 60) }} />
      </Animated.ScrollView>

      {/* Floating Practice All button */}
      {unpracticedCount > 0 && analysisComplete && (
        <Animated.View
          style={[styles.floatingButton, { bottom: insets.bottom + 16 }]}
          entering={FadeInDown.duration(300).delay(200)}
        >
          <GlassIconPillButton
            label={`Practice All (${unpracticedCount})`}
            icon="fitness-outline"
            variant="primary"
            fullWidth
            onPress={handlePracticeAll}
          />
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
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 20,
    paddingTop: 8,
  },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  topBarDuration: {
    fontSize: 13,
    color: alpha(colors.white, 0.3),
    fontFamily: fonts.medium,
    letterSpacing: 0.5,
  },
  grammarIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  grammarIndicatorText: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: alpha(colors.white, 0.35),
  },
  floatingButton: {
    position: 'absolute',
    left: 20,
    right: 20,
  },
});
