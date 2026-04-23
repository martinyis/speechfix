import { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AgentAvatar } from '../agent/AgentAvatar';
import { IrisRingOrb, type IrisRingOrbState } from '../orbs/IrisRingOrb';
import { colors, alpha, fonts, typography } from '../../theme';
import { formatTime } from '../../lib/formatters';
import { getSessionAvatarId } from '../../lib/avatars';
import { voiceAudioLevel } from '../../lib/voiceAudioLevel';
import type { VoiceSessionState } from '../../stores/sessionStore';

// ----------------------------------------------------------------------
// State → visual mapping
// ----------------------------------------------------------------------

const STATE_DOMINANT: Record<IrisRingOrbState, string> = {
  connecting: '#8a8f9e',
  listening: '#699cff',
  thinking: '#a58bd1',
  speaking: '#cc97ff',
  muted: '#4a4a4a',
  idle: '#6a6a6a',
};

const STATE_LABEL: Record<IrisRingOrbState, string> = {
  connecting: 'Connecting',
  listening: 'Listening',
  thinking: 'Thinking',
  speaking: 'Speaking',
  muted: 'Muted',
  idle: '',
};

function resolveVisualState(voiceState: VoiceSessionState, isMuted: boolean): IrisRingOrbState {
  // Muted is surfaced via the control chip + button, not the orb — orb keeps its natural color.
  if (isMuted) return 'listening';
  switch (voiceState) {
    case 'connecting': return 'connecting';
    case 'listening': return 'listening';
    case 'thinking': return 'thinking';
    case 'speaking': return 'speaking';
    case 'muted': return 'listening';
    case 'analyzing':
    case 'done':
    default: return 'idle';
  }
}

// ----------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------

interface VoiceSessionOverlayProps {
  voiceState: VoiceSessionState;
  elapsedTime: number;
  isMuted: boolean;
  onToggleMute: () => void;
  onStop: () => void;
  mode?: 'session' | 'onboarding';
  agentName?: string;
  hideHeader?: boolean;
  /** Avatar seed for the active agent (null = system mode avatar). */
  avatarSeed?: string | null;
  /** Voice session mode key (e.g. 'conversation', 'agent-creator') for system avatar lookup. */
  sessionMode?: string;
}

export function VoiceSessionOverlay({
  voiceState,
  elapsedTime,
  isMuted,
  onToggleMute,
  onStop,
  mode = 'session',
  agentName,
  hideHeader,
  avatarSeed,
  sessionMode,
}: VoiceSessionOverlayProps) {
  const insets = useSafeAreaInsets();
  const visualState = resolveVisualState(voiceState, isMuted);
  const label = isMuted ? '' : STATE_LABEL[visualState];
  const isAnalyzing = voiceState === 'analyzing';

  const avatarId = useMemo(
    () => getSessionAvatarId(sessionMode, avatarSeed),
    [sessionMode, avatarSeed],
  );

  return (
    <View style={[styles.overlay, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }]}>
      {!hideHeader && (
        <View style={styles.topChrome}>
          <View style={styles.agentRow}>
            <AgentAvatar seed={avatarId} size={28} />
            <View style={styles.agentNameBlock}>
              <Text style={styles.agentName}>{agentName ?? 'Reflexa'}</Text>
              {mode === 'onboarding' ? (
                <Text style={styles.agentMode}>Onboarding</Text>
              ) : null}
            </View>
          </View>
          <View pointerEvents="none" style={styles.timerCenter}>
            <Text style={styles.timerText}>{formatTime(elapsedTime)}</Text>
          </View>
        </View>
      )}

      <View style={styles.stage}>
        <IrisRingOrb state={visualState} audioLevel={voiceAudioLevel} />

        <View style={styles.stateLabelWrap} pointerEvents="none">
          {label ? (
            <Animated.Text
              key={visualState}
              entering={FadeIn.duration(220)}
              exiting={FadeOut.duration(140)}
              style={[styles.stateLabel, { color: STATE_DOMINANT[visualState] }]}
            >
              {label}
              {visualState === 'thinking' || visualState === 'connecting' ? '…' : ''}
            </Animated.Text>
          ) : null}
        </View>
      </View>

      {isAnalyzing ? (
        <Animated.View entering={FadeIn.duration(200)} style={styles.analyzingHint}>
          <Text style={styles.analyzingText}>Processing your session...</Text>
        </Animated.View>
      ) : (
        <View style={styles.controlsRow}>
          <Pressable style={styles.controlWrap} onPress={onToggleMute} hitSlop={8}>
            {isMuted ? (
              <Animated.View
                entering={FadeIn.duration(220)}
                exiting={FadeOut.duration(140)}
                style={styles.mutedChip}
                pointerEvents="none"
              >
                <Ionicons name="mic-off" size={11} color={colors.primary} />
                <Text style={styles.mutedChipText}>Muted</Text>
              </Animated.View>
            ) : null}
            <View style={[styles.muteGlow, isMuted && styles.muteGlowActive]}>
              <Ionicons
                name={isMuted ? 'mic-off' : 'mic-off-outline'}
                size={22}
                color={isMuted ? colors.white : alpha(colors.white, 0.7)}
              />
            </View>
            <Text style={[styles.controlLabel, isMuted && styles.controlLabelActive]}>
              {isMuted ? 'Tap to speak' : 'Mute'}
            </Text>
          </Pressable>

          <Pressable style={styles.controlWrap} onPress={onStop}>
            <View style={styles.endGlow}>
              <MaterialCommunityIcons name="phone-hangup" size={22} color={colors.onSurface} />
            </View>
            <Text style={styles.endLabel}>End</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

// ----------------------------------------------------------------------
// Styles
// ----------------------------------------------------------------------

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background,
    zIndex: 10,
  },
  topChrome: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  agentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timerCenter: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 4,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agentNameBlock: {
    gap: 1,
  },
  agentName: {
    fontSize: 13,
    fontFamily: fonts.semibold,
    color: alpha(colors.white, 0.8),
  },
  agentMode: {
    ...typography.labelSm,
    fontSize: 9,
    color: alpha(colors.white, 0.4),
  },
  timerText: {
    fontSize: 15,
    fontFamily: fonts.extrabold,
    letterSpacing: 2,
    color: alpha(colors.white, 0.65),
    fontVariant: ['tabular-nums'],
  },
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateLabelWrap: {
    marginTop: 56,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateLabel: {
    ...typography.labelMd,
    letterSpacing: 2.5,
    fontSize: 13,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
    marginBottom: 12,
  },
  controlWrap: {
    alignItems: 'center',
    gap: 8,
    position: 'relative',
  },
  muteGlow: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: alpha(colors.white, 0.15),
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  muteGlowActive: {
    backgroundColor: alpha(colors.primary, 0.22),
    borderColor: alpha(colors.primary, 0.7),
    shadowOpacity: 0.6,
    shadowRadius: 22,
  },
  mutedChip: {
    position: 'absolute',
    bottom: '100%',
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: alpha(colors.primary, 0.14),
    borderWidth: 1,
    borderColor: alpha(colors.primary, 0.45),
  },
  mutedChipText: {
    fontSize: 10.5,
    fontFamily: fonts.semibold,
    letterSpacing: 1.2,
    color: colors.primary,
    textTransform: 'uppercase',
  },
  controlLabel: {
    fontSize: 12,
    fontFamily: fonts.semibold,
    color: alpha(colors.white, 0.45),
  },
  controlLabelActive: {
    color: colors.primary,
  },
  endGlow: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: alpha(colors.error, 0.4),
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.error,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  endLabel: {
    fontSize: 12,
    fontFamily: fonts.semibold,
    color: alpha(colors.error, 0.7),
  },
  analyzingHint: {
    alignItems: 'center',
    paddingBottom: 20,
  },
  analyzingText: {
    fontSize: 15,
    fontFamily: fonts.regular,
    color: alpha(colors.white, 0.5),
  },
});
