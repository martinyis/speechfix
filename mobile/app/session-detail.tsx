import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSessionStore } from '../stores/sessionStore';
import { useSession } from '../hooks/data/useSession';
import { useDeepInsights } from '../hooks/data/useDeepInsights';
import { useAudioPlayback } from '../hooks/useAudioPlayback';
import { InsightOverhead } from '../components/session/InsightOverhead';
import { CorrectionsPreview } from '../components/correction/CorrectionsPreview';
import { ConversationRhythmStrip } from '../components/session/ConversationRhythmStrip';
import { PitchRibbon } from '../components/session/PitchRibbon';
import { PitchRibbonTransport } from '../components/session/PitchRibbonTransport';
import { SessionKaraoke } from '../components/session/SessionKaraoke';
import { SessionFullReport } from '../components/session/SessionFullReport';
import { AnalyzingBanner } from '../components/session/AnalyzingBanner';
import { ScreenHeader, EmptyState } from '../components/ui';
import { formatDuration } from '../lib/formatters';
import { colors, alpha, fonts } from '../theme';
import type { DeepInsight, SessionDetail } from '../types/session';

export default function SessionDetailScreen() {
  const { sessionId, fresh, expanded: expandedParam } = useLocalSearchParams<{
    sessionId: string;
    fresh?: string;
    expanded?: string;
  }>();
  const insets = useSafeAreaInsets();
  const isFresh = fresh === 'true';

  const storeData = useSessionStore((s) => s.currentSessionData);
  const isStreaming = useSessionStore((s) => s.isStreamingAnalysis);
  const isInsightsReady = useSessionStore((s) => s.isInsightsReady);
  const storeSessionId = useSessionStore((s) => s.currentSessionId);
  const storeDeepInsights = useSessionStore((s) => s.deepInsights);
  const {
    data: fetchedData,
    isLoading,
    isError,
  } = useSession(isFresh ? null : Number(sessionId));

  const resolvedSessionId = isFresh && storeSessionId ? storeSessionId : Number(sessionId);

  // See header comment on `pollDeepInsights` — fresh sessions fire-and-forget
  // generation server-side; polling is the reliable delivery path client-side.
  const [pollDeepInsights, setPollDeepInsights] = useState(isFresh);
  useEffect(() => {
    if (!isFresh) return;
    const timer = setTimeout(() => setPollDeepInsights(false), 60_000);
    return () => clearTimeout(timer);
  }, [isFresh]);

  const validSessionId = Number.isFinite(resolvedSessionId) && resolvedSessionId > 0
    ? resolvedSessionId
    : null;
  const { data: fetchedDeepInsights } = useDeepInsights(
    validSessionId,
    { polling: pollDeepInsights, generate: !isFresh },
  );
  const deepInsights =
    (isFresh && storeDeepInsights && storeDeepInsights.length > 0
      ? storeDeepInsights
      : fetchedDeepInsights) ?? [];

  const session: SessionDetail | null | undefined = isFresh
    ? storeData
    : fetchedData;

  const handleBack = useCallback(() => {
    if (isFresh) router.replace('/(tabs)');
    else router.back();
  }, [isFresh]);

  const handlePracticeCorrection = useCallback((correctionId: number) => {
    router.push({
      pathname: '/practice-session',
      params: {
        correctionId: String(correctionId),
        mode: 'say_it_right',
      },
    });
  }, []);

  // Specific (anchored) insights sorted chronologically — each gets a
  // numbered chip on the ribbon that drives the Overhead display.
  const specificInsights = useMemo<DeepInsight[]>(
    () =>
      deepInsights
        .filter((i): i is DeepInsight => i.type === 'specific' && !!i.anchor)
        .sort((a, b) => a.anchor!.start_seconds - b.anchor!.start_seconds),
    [deepInsights],
  );

  const [selectedInsightIdx, setSelectedInsightIdx] = useState<number | null>(null);
  const [transcriptVisible, setTranscriptVisible] = useState(false);

  // Shared audio across the ribbon, transport, and karaoke. Hook is always
  // called so the order of hooks is stable; `enabled` gates real playback.
  const audio = useAudioPlayback({
    sessionId: Number.isFinite(resolvedSessionId) ? resolvedSessionId : 0,
    enabled: !!session?.audioPath,
  });

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

  const showAnalyzingBanner = isFresh && !isInsightsReady && !session;
  const insightsAvailable = isFresh ? isInsightsReady : true;
  const correctionsStillStreaming = isFresh && isStreaming && isInsightsReady;

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
  const isClean = !hasCorrections && !correctionsStillStreaming;
  const analysisComplete = !isStreaming;

  const prosodySamples = session.speechTimeline?.prosodySamples ?? [];
  const showPitchRibbon = prosodySamples.length > 0;
  const utterances = session.speechTimeline?.utterances ?? [];

  const selectedInsight =
    selectedInsightIdx !== null ? specificInsights[selectedInsightIdx] ?? null : null;

  const handleInsightTap = (idx: number) => {
    setSelectedInsightIdx(prev => (prev === idx ? null : idx));
    const t = specificInsights[idx]?.anchor?.start_seconds;
    if (typeof t === 'number') {
      audio.seekTo(t);
    }
  };

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
        {/* Overhead display — big editorial type above the ribbon. Shows
            overall insights by default; swaps to a specific insight when a
            numbered chip is tapped. Replaces the old bottom-sheet modal. */}
        {insightsAvailable && deepInsights.length > 0 && (
          <InsightOverhead
            insights={deepInsights}
            selectedSpecific={selectedInsight}
            selectedNumber={selectedInsightIdx !== null ? selectedInsightIdx + 1 : null}
            onClear={() => setSelectedInsightIdx(null)}
            animate={isFresh}
          />
        )}

        {insightsAvailable && showPitchRibbon && session.speechTimeline && (
          <>
            <PitchRibbon
              sessionId={session.id}
              samples={prosodySamples}
              fillers={session.fillerPositions}
              durationSeconds={session.durationSeconds}
              audioPath={session.audioPath ?? null}
              specificInsights={specificInsights}
              selectedInsightIdx={selectedInsightIdx}
              onInsightTap={handleInsightTap}
              audio={audio}
            />
            {session.audioPath && (
              <PitchRibbonTransport
                audio={audio}
                fallbackDurationSeconds={session.durationSeconds}
                transcriptVisible={transcriptVisible}
                onToggleTranscript={() => setTranscriptVisible(v => !v)}
              />
            )}
            {transcriptVisible && utterances.length > 0 && (
              <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)}>
                <SessionKaraoke
                  utterances={utterances}
                  positionSeconds={audio.positionSeconds}
                />
              </Animated.View>
            )}
          </>
        )}

        {insightsAvailable && !showPitchRibbon && session.speechTimeline && session.speechTimeline.utterances.length > 1 && (
          <ConversationRhythmStrip
            timeline={session.speechTimeline}
            animate={isFresh}
          />
        )}

        {correctionsStillStreaming && !hasCorrections && (
          <Animated.View
            style={styles.grammarIndicator}
            entering={FadeIn.duration(200)}
          >
            <ActivityIndicator size="small" color={alpha(colors.white, 0.3)} />
            <Text style={styles.grammarIndicatorText}>Checking grammar...</Text>
          </Animated.View>
        )}

        {(hasCorrections || correctionsStillStreaming) && (
          <View style={styles.correctionsWrap}>
            <CorrectionsPreview
              corrections={session.corrections}
              sentences={session.sentences}
              practicedIds={new Set<number>()}
              totalCount={session.corrections.length}
              onPractice={handlePracticeCorrection}
              isStreaming={isStreaming}
              isFresh={isFresh}
            />
          </View>
        )}

        {analysisComplete && isClean && (
          <EmptyState
            icon="checkmark-circle-outline"
            iconColor={alpha(colors.severityPolish, 0.5)}
            title="Clean session"
            subtitle="No corrections detected"
          />
        )}

        {insightsAvailable && analysisComplete && (
          <SessionFullReport
            session={session}
            initialExpanded={expandedParam === '1'}
          />
        )}

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
  correctionsWrap: {
    marginTop: 32,
  },
});
