import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  interpolateColor,
} from 'react-native-reanimated';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import MicBloomOrb from '../../components/MicBloomOrb';
import { AgentSelector } from '../../components/AgentSelector';
import { AgentCreationSheet } from '../../components/AgentCreationSheet';
import { VoiceSessionOverlay } from '../../components/VoiceSessionOverlay';
import { SessionRowVariantC as SessionRow } from '../../components/session-variants/VariantC';
import { SectionHeader } from '../../components/ui';
import { useSessionStore } from '../../stores/sessionStore';
import { useAgentStore, getSelectedAgentDisplay } from '../../stores/agentStore';
import { useAgents } from '../../hooks/useAgents';
import { useSessions } from '../../hooks/useSessions';
import { useVoiceSession } from '../../hooks/useVoiceSession';
import { colors, alpha, fonts } from '../../theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const agentSheetRef = useRef<BottomSheetModal>(null);
  const { data: sessions, refetch } = useSessions();
  const { data: agents = [] } = useAgents();
  const selectedAgentId = useAgentStore((s) => s.selectedAgentId);
  const selectAgent = useAgentStore((s) => s.selectAgent);

  const isActive = useSessionStore((s) => s.isVoiceSessionActive);
  const voiceState = useSessionStore((s) => s.voiceSessionState);
  const elapsedTime = useSessionStore((s) => s.elapsedTime);
  const isMuted = useSessionStore((s) => s.isMuted);

  // Derive display info for selected agent
  const agentDisplay = useMemo(
    () => getSelectedAgentDisplay(selectedAgentId, agents),
    [selectedAgentId, agents],
  );

  // Edge case: if selected agent was deleted, reset to Reflexa
  useEffect(() => {
    const currentId = useAgentStore.getState().selectedAgentId;
    if (currentId !== null && agents && !agents.find((a) => a.id === currentId)) {
      useAgentStore.getState().selectAgent(null);
    }
  }, [agents]);

  // Refetch sessions when screen focuses
  useFocusEffect(
    useCallback(() => {
      if (!isActive) refetch();
    }, [isActive]),
  );

  // Track whether we've already navigated to session-detail (prevent double nav)
  const navigatedToDetailRef = useRef(false);

  // Voice session hook
  const { start, stop, toggleMute } = useVoiceSession({
    onInsightsReady: () => {
      if (!navigatedToDetailRef.current) {
        navigatedToDetailRef.current = true;
        router.push({
          pathname: '/session-detail',
          params: { sessionId: '0', fresh: 'true' },
        });
      }
    },
    onSessionEnd: (_results, dbSessionId) => {
      // Only navigate if streaming didn't already take us there
      if (!navigatedToDetailRef.current) {
        navigatedToDetailRef.current = true;
        router.push({
          pathname: '/session-detail',
          params: { sessionId: String(dbSessionId), fresh: 'true' },
        });
      }
    },
    onError: (message) => {
      console.warn('Voice session error:', message);
    },
  });

  // -- Animations --

  const bgProgress = useSharedValue(0);
  const micScale = useSharedValue(1);
  const listOpacity = useSharedValue(1);
  const sessionUIOpacity = useSharedValue(0);

  useEffect(() => {
    bgProgress.value = withTiming(isActive ? 1 : 0, { duration: 280 });
    listOpacity.value = withTiming(isActive ? 0 : 1, { duration: 200 });
    sessionUIOpacity.value = withTiming(isActive ? 1 : 0, { duration: 250 });
  }, [isActive]);

  const containerStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(bgProgress.value, [0, 1], [colors.background, colors.background]),
  }));

  const listAnimStyle = useAnimatedStyle(() => ({
    opacity: listOpacity.value,
  }));

  const sessionOverlayStyle = useAnimatedStyle(() => ({
    opacity: sessionUIOpacity.value,
  }));

  // -- Handlers --

  const handleMicPress = useCallback(() => {
    if (!isActive) {
      navigatedToDetailRef.current = false;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      start();
    }
  }, [isActive, start]);

  const handleMicPressIn = useCallback(() => {
    if (!isActive) {
      micScale.value = withSpring(0.93, { damping: 15, stiffness: 300 });
    }
  }, [isActive]);

  const handleMicPressOut = useCallback(() => {
    if (!isActive) {
      micScale.value = withSpring(1, { damping: 15, stiffness: 300 });
    }
  }, [isActive]);

  const micAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: micScale.value }],
  }));

  const handleToggleMute = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleMute();
  }, [toggleMute]);

  const handleStop = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    stop();
  }, [stop]);

  const handleSelectAgent = useCallback(
    (id: number | null) => {
      selectAgent(id);
    },
    [selectAgent],
  );

  const handleCreateAgent = useCallback(() => {
    agentSheetRef.current?.present();
  }, []);

  // -- Data --

  const hasSessions = (sessions?.length ?? 0) > 0;

  // Dynamic hint text
  const hintText =
    selectedAgentId !== null && agentDisplay.name !== 'Reflexa'
      ? `TAP TO PRACTICE WITH ${agentDisplay.name.toUpperCase()}`
      : 'TAP TO BEGIN PRACTICE';

  // Bloom hue: purple for Reflexa, blue for custom agents
  const orbAccent = selectedAgentId !== null ? 'blue' : 'purple';

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      <StatusBar style="light" />

      {/* ===== VOICE SESSION OVERLAY ===== */}
      {isActive && (
        <Animated.View
          style={[StyleSheet.absoluteFill, sessionOverlayStyle]}
          pointerEvents={isActive ? 'auto' : 'none'}
        >
          <VoiceSessionOverlay
            voiceState={voiceState}
            elapsedTime={elapsedTime}
            isMuted={isMuted}
            onToggleMute={handleToggleMute}
            onStop={handleStop}
            agentName={agentDisplay.name}
            avatarSeed={agentDisplay.avatarSeed ?? null}
            sessionMode="conversation"
          />
        </Animated.View>
      )}

      {/* ===== AGENT SELECTOR (top-right avatar) ===== */}
      {!isActive && (
        <View style={[styles.agentSelectorWrap, { top: insets.top + 8 }]}>
          <AgentSelector
            agents={agents}
            selectedAgentId={selectedAgentId}
            onSelectAgent={handleSelectAgent}
            onCreateAgent={handleCreateAgent}
            topOffset={insets.top + 8}
          />
        </View>
      )}

      {/* ===== HOME CONTENT ===== */}
      <Animated.View style={[styles.homeContent, listAnimStyle]} pointerEvents={isActive ? 'none' : 'auto'}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Mic Orb Section */}
          <View style={[styles.micSection, { paddingTop: insets.top + 56 }]}>
            <AnimatedPressable
              onPress={handleMicPress}
              onPressIn={handleMicPressIn}
              onPressOut={handleMicPressOut}
              accessibilityLabel="Start practice session"
              accessibilityRole="button"
            >
              <Animated.View style={micAnimStyle}>
                <MicBloomOrb accentColor={orbAccent} />
              </Animated.View>
            </AnimatedPressable>

            {/* Dynamic hint text */}
            <View style={styles.hintContainer}>
              <Text style={styles.hintText}>{hintText}</Text>
            </View>
          </View>

          {/* History Section */}
          {hasSessions && (
            <View style={styles.historySection}>
              <View style={styles.historyHeaderWrap}>
                <SectionHeader
                  label="History"
                  subtitle="Your recent vocal breakthroughs"
                  action={{ label: 'VIEW ALL', onPress: () => router.push('/all-sessions') }}
                />
              </View>

              <View>
                {(sessions ?? []).slice(0, 3).map((item) => (
                  <SessionRow key={item.id} item={item} />
                ))}
              </View>
            </View>
          )}

        </ScrollView>
      </Animated.View>

      <AgentCreationSheet ref={agentSheetRef} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  homeContent: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 24,
  },
  agentSelectorWrap: {
    position: 'absolute',
    right: 24,
    zIndex: 100,
  },
  micSection: {
    alignItems: 'center',
    marginHorizontal: -24,
    paddingBottom: 8,
    overflow: 'visible',
  },
  hintContainer: {
    alignItems: 'center',
    marginTop: 16,
  },
  hintText: {
    fontSize: 11,
    fontFamily: fonts.medium,
    color: alpha(colors.white, 0.6),
    letterSpacing: 2.5,
    textTransform: 'uppercase',
  },
  historySection: {
    marginTop: 20,
  },
  historyHeaderWrap: {
    paddingHorizontal: 4,
    marginBottom: 12,
  },
});
