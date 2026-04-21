import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import Animated, {
  FadeIn,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSessionStore } from '../stores/sessionStore';
import { useSession } from '../hooks/useSession';
import { SessionVerdict } from '../components/SessionVerdict';
import { CorrectionsPreview } from '../components/correction/CorrectionsPreview';
import { ConversationRhythmStrip } from '../components/ConversationRhythmStrip';
import { PitchRibbon } from '../components/PitchRibbon';
import { PitchRibbonCaption } from '../components/PitchRibbonCaption';
import { SessionFullReport } from '../components/SessionFullReport';
import { AnalyzingBanner } from '../components/AnalyzingBanner';
import { ScreenHeader, EmptyState } from '../components/ui';
import { formatDuration } from '../lib/formatters';
import { colors, alpha, fonts } from '../theme';
import type { SessionDetail } from '../types/session';

export default function SessionDetailScreen() {
  const { sessionId, fresh, expanded: expandedParam } = useLocalSearchParams<{
    sessionId: string;
    fresh?: string;
    expanded?: string;
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

  // Handlers
  const handleBack = useCallback(() => {
    if (isFresh) {
      router.replace('/(tabs)');
    } else {
      router.back();
    }
  }, [isFresh]);

  const handleSeeAllCorrections = useCallback(() => {
    router.push('/corrections-list');
  }, []);

  // Pitch Ribbon caption state (shown when user taps a moment on the ribbon)
  const [caption, setCaption] = useState<{
    visible: boolean;
    timeSeconds: number;
    sentence: string;
    confidence: number;
  }>({ visible: false, timeSeconds: 0, sentence: '', confidence: 0 });

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

  // Pitch Ribbon availability (Phase 2) — only when server captured prosody samples.
  const prosodySamples = session.speechTimeline?.prosodySamples ?? [];
  const showPitchRibbon = prosodySamples.length > 0;

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

        {/* Pitch Ribbon — prosody timeline with tap-to-play (Phase 2) */}
        {insightsAvailable && showPitchRibbon && session.speechTimeline && (
          <>
            <PitchRibbon
              sessionId={session.id}
              samples={prosodySamples}
              fillers={session.fillerPositions}
              durationSeconds={session.durationSeconds}
              utterances={session.speechTimeline.utterances}
              sentences={session.sentences}
              audioPath={session.audioPath ?? null}
              onScrub={(t, meta) => setCaption({ visible: true, timeSeconds: t, sentence: meta.sentence, confidence: meta.confidence })}
            />
            <PitchRibbonCaption
              visible={caption.visible}
              timeSeconds={caption.timeSeconds}
              sentence={caption.sentence}
              confidence={caption.confidence}
              onTimeout={() => setCaption(c => ({ ...c, visible: false }))}
            />
          </>
        )}

        {/* Conversation Rhythm Strip — legacy timeline fallback when no prosody samples */}
        {insightsAvailable && !showPitchRibbon && session.speechTimeline && session.speechTimeline.utterances.length > 1 && (
          <ConversationRhythmStrip
            timeline={session.speechTimeline}
            animate={isFresh}
          />
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
            practicedIds={new Set<number>()}
            totalCount={session.corrections.length}
            onPractice={() => {}}
            onSeeAll={handleSeeAllCorrections}
            isStreaming={isStreaming}
            isFresh={isFresh}
          />
        )}

        {/* Practice link */}
        {hasCorrections && analysisComplete && (
          <Pressable
            style={styles.practiceLink}
            onPress={() => router.push('/(tabs)/practice')}
          >
            <Text style={styles.practiceLinkText}>
              Practice these in the Practice tab
            </Text>
          </Pressable>
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

        {/* Full report expand — delivery strip, patterns, strengths, focus, transcript */}
        {insightsAvailable && analysisComplete && (
          <SessionFullReport
            session={session}
            animate={isFresh}
            initialExpanded={expandedParam === '1'}
          />
        )}

        {/* Bottom padding */}
        <View style={{ height: insets.bottom + 60 }} />
      </Animated.ScrollView>
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
  practiceLink: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  practiceLinkText: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: alpha(colors.primary, 0.6),
  },
});
