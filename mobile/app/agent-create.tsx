import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
  LayoutChangeEvent,
  useWindowDimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  Easing,
  SharedValue,
} from 'react-native-reanimated';
import { colors, alpha, glass, spacing, layout, typography } from '../theme';
import { authFetch } from '../lib/api';
import { useVoices } from '../hooks/useVoices';
import { useAgentStore } from '../stores/agentStore';
import { useSessionStore } from '../stores/sessionStore';
import { useAgentCreatorVoiceSession } from '../hooks/useAgentCreatorVoiceSession';
import { VoicePicker } from '../components/VoicePicker';
import { VoiceSessionOverlay } from '../components/VoiceSessionOverlay';
import { StyleChips } from '../components/StyleChips';
import { AgentAvatar } from '../components/AgentAvatar';
import { Button, ScreenHeader } from '../components/ui';
import type { Agent } from '../types/session';

const STYLE_OPTIONS = ['Casual', 'Professional', 'Challenging', 'Supportive', 'Direct'];

// ── Focusable Input ────────────────────────────────────────────────────
function FocusableInput({
  value,
  onChangeText,
  placeholder,
  multiline,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  multiline?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      style={[
        styles.input,
        multiline && styles.inputMultiline,
        focused && styles.inputFocused,
      ]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={alpha(colors.white, 0.25)}
      multiline={multiline}
      textAlignVertical={multiline ? 'top' : 'auto'}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    />
  );
}

function generateSeeds(count: number): string[] {
  return Array.from({ length: count }, () => Math.random().toString(36).slice(2, 10));
}

// ── IntroHero — floating agent avatar + text, overlaid above form ────────
function IntroHero({
  focusIdx,
  scrollAreaHeight,
  avatarSeed,
  name: agentName,
}: {
  focusIdx: SharedValue<number>;
  scrollAreaHeight: number;
  avatarSeed: string | null;
  name: string;
}) {
  const float = useSharedValue(0);

  useEffect(() => {
    float.value = withRepeat(
      withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, []);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: withTiming(focusIdx.value === 0 ? 1 : 0, { duration: 400 }),
  }));

  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: float.value * -8 }],
  }));

  const topOffset = scrollAreaHeight > 0 ? scrollAreaHeight * 0.15 : 100;
  const displaySeed = avatarSeed ?? (agentName.trim() || 'new-agent');

  return (
    <Animated.View
      style={[styles.introContainer, containerStyle, { top: topOffset }]}
      pointerEvents="none"
    >
      <Animated.View style={[styles.introAvatarWrap, floatStyle]}>
        <View style={styles.introAvatarGlow} />
        <AgentAvatar seed={displaySeed} size={88} />
      </Animated.View>

      <Text style={styles.introHeadline}>Make it yours</Text>
      <Text style={styles.introSub}>
        A few details to give your agent{'\n'}some personality.
      </Text>
    </Animated.View>
  );
}

// ── FormSection — progressive focus wrapper ─────────────────────────────
function FormSection({
  index,
  focusIdx,
  focusIndex,
  label,
  onContinue,
  onTap,
  isLast,
  onLayout,
  children,
}: {
  index: number;
  focusIdx: SharedValue<number>;
  focusIndex: number;
  label: string;
  onContinue: () => void;
  onTap: (i: number) => void;
  isLast?: boolean;
  onLayout?: (e: LayoutChangeEvent) => void;
  children: React.ReactNode;
}) {
  const animStyle = useAnimatedStyle(() => {
    const target = index === focusIdx.value ? 1.0 : 0.25;
    return {
      opacity: withTiming(target, { duration: 300 }),
    };
  });

  const isFocused = index === focusIndex;

  return (
    <Animated.View style={[styles.sectionWrapper, animStyle]} onLayout={onLayout}>
      <Pressable onPress={() => onTap(index)} disabled={isFocused}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {children}
        {isFocused && !isLast && (
          <Pressable onPress={onContinue} hitSlop={8} style={styles.continueLink}>
            <Text style={styles.continueLinkText}>Continue →</Text>
          </Pressable>
        )}
      </Pressable>
    </Animated.View>
  );
}

export default function AgentCreateScreen() {
  const router = useRouter();
  const { startVoice } = useLocalSearchParams<{ startVoice?: string }>();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { data: voices = [] } = useVoices();

  const [phase, setPhase] = useState<'form' | 'voice' | 'success'>(
    startVoice === 'true' ? 'voice' : 'form',
  );

  // Focus state
  const { height: windowHeight } = useWindowDimensions();
  const focusIdx = useSharedValue(0);
  const [focusIndex, setFocusIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const sectionYs = useRef<number[]>([]);
  const sectionHeights = useRef<number[]>([]);
  const scrollAreaHeight = useRef(0);

  const setFocus = useCallback((i: number) => {
    focusIdx.value = i;
    setFocusIndex(i);
    const y = sectionYs.current[i];
    const h = sectionHeights.current[i];
    if (y != null && h != null && scrollAreaHeight.current > 0) {
      // Center the section in the visible scroll area
      const targetY = y - (scrollAreaHeight.current / 2) + (h / 2);
      scrollRef.current?.scrollTo({ y: Math.max(0, targetY), animated: true });
    }
  }, []);

  const handleSectionLayout = useCallback((index: number, e: LayoutChangeEvent) => {
    sectionYs.current[index] = e.nativeEvent.layout.y;
    sectionHeights.current[index] = e.nativeEvent.layout.height;
  }, []);

  // Form state
  const [name, setName] = useState('');
  const [voiceId, setVoiceId] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [focusArea, setFocusArea] = useState('');
  const [conversationStyle, setConversationStyle] = useState<string | null>(null);
  const [customRules, setCustomRules] = useState('');
  const [createdAgent, setCreatedAgent] = useState<Agent | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [avatarOptions, setAvatarOptions] = useState(() => generateSeeds(8));
  const [avatarSeed, setAvatarSeed] = useState<string | null>(null);

  // Voice session state from store
  const voiceState = useSessionStore((s) => s.voiceSessionState);
  const elapsedTime = useSessionStore((s) => s.elapsedTime);
  const isMuted = useSessionStore((s) => s.isMuted);

  const formContext = {
    name,
    voiceId,
    description,
    focusArea,
    conversationStyle,
    customRules,
    avatarSeed: avatarSeed ?? (name.trim() || undefined),
  };

  const handleAgentCreated = useCallback(
    (agent: Agent) => {
      setCreatedAgent(agent);
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      setPhase('success');
    },
    [queryClient],
  );

  const handleError = useCallback((message: string) => {
    Alert.alert('Error', message);
    setPhase('form');
  }, []);

  const { start, stop, toggleMute, cleanup } = useAgentCreatorVoiceSession({
    onAgentCreated: handleAgentCreated,
    onError: handleError,
    formContext,
  });

  const createViaApi = async () => {
    setIsCreating(true);
    try {
      const res = await authFetch('/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() || undefined,
          voiceId,
          description: description.trim() || undefined,
          focusArea: focusArea.trim() || undefined,
          conversationStyle: conversationStyle || undefined,
          customRules: customRules.trim() || undefined,
          avatarSeed: avatarSeed ?? (name.trim() || undefined),
        }),
      });
      if (!res.ok) throw new Error('Failed to create agent');
      const data = await res.json();
      const agent: Agent = data.agent;
      useAgentStore.getState().addAgent(agent);
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      setCreatedAgent(agent);
      setPhase('success');
    } catch {
      Alert.alert('Error', 'Failed to create agent. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleSkipVoice = async () => {
    await stop();
    await cleanup();
    await createViaApi();
  };

  useEffect(() => {
    if (phase === 'voice') {
      start();
    }
  }, [phase]);

  const handleStartPracticing = () => {
    if (createdAgent) {
      useAgentStore.getState().selectAgent(createdAgent.id);
      router.replace({
        pathname: '/(tabs)',
        params: {
          agentId: createdAgent.id.toString(),
          agentName: createdAgent.name,
        },
      });
    }
  };

  // ── Form Phase (Progressive Focus) ──────────────────────────────────
  if (phase === 'form') {
    return (
      <View style={styles.container}>
        <ScreenHeader variant="modal" title="Create Agent" />

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={100}
        >
          <View
            style={styles.flex}
            onLayout={(e) => { scrollAreaHeight.current = e.nativeEvent.layout.height; }}
          >
            {/* Intro hero — absolutely positioned, doesn't affect scroll content */}
            <IntroHero
              focusIdx={focusIdx}
              scrollAreaHeight={scrollAreaHeight.current}
              avatarSeed={avatarSeed}
              name={name}
            />

            <ScrollView
              ref={scrollRef}
              style={styles.inputScroll}
              contentContainerStyle={[
                styles.inputScrollContent,
                {
                  paddingTop: scrollAreaHeight.current > 0
                    ? scrollAreaHeight.current / 2 - 40
                    : windowHeight * 0.35,
                  paddingBottom: scrollAreaHeight.current > 0
                    ? scrollAreaHeight.current / 2 - 40
                    : windowHeight * 0.35,
                },
              ]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >

            {/* 0 — Name */}
            <FormSection
              index={0} focusIdx={focusIdx} focusIndex={focusIndex}
              label="NAME" onContinue={() => setFocus(1)} onTap={setFocus}
              onLayout={(e) => handleSectionLayout(0, e)}
            >
              <FocusableInput value={name} onChangeText={setName} placeholder="Agent name" />
            </FormSection>

            {/* 1 — Description */}
            <FormSection
              index={1} focusIdx={focusIdx} focusIndex={focusIndex}
              label="DESCRIPTION" onContinue={() => setFocus(2)} onTap={setFocus}
              onLayout={(e) => handleSectionLayout(1, e)}
            >
              <FocusableInput
                value={description} onChangeText={setDescription}
                placeholder="Who is this agent? What's their personality?" multiline
              />
            </FormSection>

            {/* 2 — Avatar */}
            <FormSection
              index={2} focusIdx={focusIdx} focusIndex={focusIndex}
              label="AVATAR" onContinue={() => setFocus(3)} onTap={setFocus}
              onLayout={(e) => handleSectionLayout(2, e)}
            >
              <View style={styles.avatarGrid}>
                {avatarOptions.map((seed) => (
                  <Pressable
                    key={seed}
                    onPress={() => setAvatarSeed(seed)}
                    style={[
                      styles.avatarOption,
                      avatarSeed === seed && styles.avatarOptionSelected,
                    ]}
                  >
                    <AgentAvatar seed={seed} size={48} />
                  </Pressable>
                ))}
              </View>
              <Pressable
                onPress={() => { setAvatarOptions(generateSeeds(8)); setAvatarSeed(null); }}
                style={styles.shuffleButton}
              >
                <Ionicons name="shuffle" size={16} color={colors.primary} />
                <Text style={styles.shuffleText}>Shuffle</Text>
              </Pressable>
            </FormSection>

            {/* 3 — Voice */}
            <FormSection
              index={3} focusIdx={focusIdx} focusIndex={focusIndex}
              label="VOICE" onContinue={() => setFocus(4)} onTap={setFocus}
              onLayout={(e) => handleSectionLayout(3, e)}
            >
              <VoicePicker voices={voices} selectedVoiceId={voiceId} onSelect={setVoiceId} compact />
            </FormSection>

            {/* 4 — Focus Area */}
            <FormSection
              index={4} focusIdx={focusIdx} focusIndex={focusIndex}
              label="FOCUS AREA" onContinue={() => setFocus(5)} onTap={setFocus}
              onLayout={(e) => handleSectionLayout(4, e)}
            >
              <FocusableInput
                value={focusArea} onChangeText={setFocusArea}
                placeholder="e.g., Interview prep, casual chat"
              />
            </FormSection>

            {/* 5 — Style */}
            <FormSection
              index={5} focusIdx={focusIdx} focusIndex={focusIndex}
              label="STYLE" onContinue={() => setFocus(6)} onTap={setFocus}
              onLayout={(e) => handleSectionLayout(5, e)}
            >
              <StyleChips
                options={STYLE_OPTIONS}
                selected={conversationStyle}
                onSelect={setConversationStyle}
              />
            </FormSection>

            {/* 6 — Custom Rules (last) */}
            <FormSection
              index={6} focusIdx={focusIdx} focusIndex={focusIndex}
              label="CUSTOM RULES" onContinue={() => {}} onTap={setFocus} isLast
              onLayout={(e) => handleSectionLayout(6, e)}
            >
              <FocusableInput
                value={customRules} onChangeText={setCustomRules}
                placeholder="e.g., Always challenge my ideas" multiline
              />
              {focusIndex === 6 && (
                <View style={styles.lastSectionButtons}>
                  <Button
                    variant="primary" label="Create Agent"
                    onPress={createViaApi} loading={isCreating} fullWidth
                  />
                  <Button
                    variant="secondary" label="Refine with Voice"
                    onPress={() => setPhase('voice')} fullWidth
                  />
                </View>
              )}
            </FormSection>
            </ScrollView>

            {/* Edge fade gradients */}
            <LinearGradient
              colors={[colors.background, 'transparent'] as const}
              style={styles.fadeTop}
              pointerEvents="none"
            />
            <LinearGradient
              colors={['transparent', colors.background] as const}
              style={styles.fadeBottom}
              pointerEvents="none"
            />
          </View>
        </KeyboardAvoidingView>
      </View>
    );
  }

  // ── Voice Phase ──────────────────────────────────────────────────────
  if (phase === 'voice') {
    return (
      <View style={styles.voiceContainer}>
        <VoiceSessionOverlay
          voiceState={voiceState}
          elapsedTime={elapsedTime}
          isMuted={isMuted}
          onToggleMute={toggleMute}
          onStop={stop}
          mode="session"
          agentName="Creating Agent"
        />
        {voiceState !== 'analyzing' && (
          <Pressable
            style={[styles.skipButton, { bottom: insets.bottom + 180 }]}
            onPress={handleSkipVoice}
          >
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        )}
      </View>
    );
  }

  // ── Success Phase ────────────────────────────────────────────────────
  return (
    <View style={[styles.successContainer, { paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.successContent}>
        <Ionicons name="checkmark-circle" size={64} color={colors.primary} />
        <Text style={styles.successTitle}>
          {createdAgent?.name ?? 'Agent'} is ready
        </Text>
      </View>

      <View style={styles.successButtons}>
        <Button
          variant="primary"
          label="Start Practicing Now"
          onPress={handleStartPracticing}
          fullWidth
        />
        <Button
          variant="secondary"
          label="Back to Agents"
          onPress={() => router.back()}
          fullWidth
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },

  // ── Section layout ──────────────────────────────────────────────────
  sectionWrapper: {
    marginBottom: spacing.xxl,
  },
  fieldLabel: {
    ...typography.labelSm,
    color: alpha(colors.white, 0.4),
    marginBottom: spacing.sm,
  },
  continueLink: {
    alignSelf: 'flex-end',
    marginTop: spacing.md,
    paddingVertical: spacing.xs,
  },
  continueLinkText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  lastSectionButtons: {
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  introContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 5,
  },
  introAvatarWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  introAvatarGlow: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: alpha(colors.primary, 0.15),
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 40,
  },
  introHeadline: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -1,
    color: colors.onSurface,
    textAlign: 'center',
  },
  introSub: {
    fontSize: 16,
    color: alpha(colors.white, 0.35),
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 24,
  },
  inputScroll: {
    flex: 1,
  },
  inputScrollContent: {
    paddingHorizontal: layout.screenPadding,
    // Top/bottom padding set dynamically so first/last sections can center
  },

  // ── Edge fade gradients ───────────────────────────────────────────────
  fadeTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
    zIndex: 10,
  },
  fadeBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 120,
    zIndex: 10,
  },

  // ── Inputs ───────────────────────────────────────────────────────────
  input: {
    ...glass.cardElevated,
    padding: spacing.lg,
    fontSize: 15,
    color: colors.onSurface,
  },
  inputMultiline: {
    minHeight: 100,
    paddingTop: spacing.lg,
  },
  inputFocused: {
    borderColor: alpha(colors.primary, 0.4),
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },

  // ── Avatar picker ────────────────────────────────────────────────────
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  avatarOption: {
    borderRadius: 28,
    padding: 4,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  avatarOptionSelected: {
    borderColor: colors.primary,
  },
  shuffleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: spacing.md,
    paddingVertical: spacing.xs,
  },
  shuffleText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },

  // ── Voice phase ──────────────────────────────────────────────────────
  voiceContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  skipButton: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 20,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  skipText: {
    fontSize: 15,
    fontWeight: '600',
    color: alpha(colors.white, 0.6),
    textDecorationLine: 'underline',
  },

  // ── Success phase ────────────────────────────────────────────────────
  successContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    paddingHorizontal: layout.screenPadding,
  },
  successContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  successTitle: {
    ...typography.headlineMd,
    color: colors.onSurface,
    textAlign: 'center',
  },
  successButtons: {
    gap: spacing.md,
  },
});
