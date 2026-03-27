import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AISpeakingOrb } from './AISpeakingOrb';
import type { AISpeakingOrbState } from './AISpeakingOrb';
import { colors, alpha } from '../theme';
import { formatTime } from '../lib/formatters';
import type { VoiceSessionState } from '../stores/sessionStore';

interface VoiceSessionOverlayProps {
  voiceState: VoiceSessionState;
  elapsedTime: number;
  isMuted: boolean;
  onToggleMute: () => void;
  onStop: () => void;
  mode?: 'session' | 'onboarding';
  agentName?: string;
}

export function VoiceSessionOverlay({
  voiceState,
  elapsedTime,
  isMuted,
  onToggleMute,
  onStop,
  mode = 'session',
  agentName,
}: VoiceSessionOverlayProps) {
  const insets = useSafeAreaInsets();

  // Map voiceState to orb state
  const orbState: AISpeakingOrbState =
    voiceState === 'speaking' ? 'speaking' :
    voiceState === 'listening' ? 'listening' :
    'idle';

  return (
    <View style={[styles.overlay, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }]}>
      {/* Top: Badge row */}
      <View style={styles.topBadgeRow}>
        <View style={styles.liveBadge}>
          <View style={styles.liveBadgeAvatar}>
            <Ionicons name="person" size={18} color={alpha(colors.white, 0.6)} />
          </View>
          <View style={styles.liveBadgeText}>
            <Text style={styles.liveModeLabel}>{mode === 'onboarding' ? 'ONBOARDING' : 'LIVE MODE'}</Text>
            <Text style={styles.liveModeName}>{agentName ?? 'Reflexa'}</Text>
          </View>
          <View style={styles.timerPill}>
            <Text style={styles.timerPillText}>{formatTime(elapsedTime)}</Text>
          </View>
        </View>
      </View>

      {/* Secure connection */}
      <View style={styles.secureRow}>
        <Ionicons name="cellular" size={12} color={alpha(colors.white, 0.4)} />
        <Text style={styles.secureText}>SECURE CONNECTION</Text>
      </View>

      {/* Center: Animated AI orb */}
      <AISpeakingOrb state={orbState} />

      {/* Spacer — orb is the hero, no labels needed */}
      <View style={styles.stateSpacer} />

      {/* Bottom controls — edge-pinned with glow */}
      {voiceState !== 'analyzing' && (
        <View style={styles.controlsRow}>
          <Pressable style={styles.controlWrap} onPress={onToggleMute}>
            <View style={[styles.muteGlow, isMuted && styles.muteGlowActive]}>
              <Ionicons
                name={isMuted ? 'mic-off' : 'mic-off-outline'}
                size={22}
                color={isMuted ? colors.primary : alpha(colors.white, 0.7)}
              />
            </View>
            <Text style={[styles.controlLabel, isMuted && { color: colors.primary }]}>
              {isMuted ? 'Unmute' : 'Mute'}
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

      {voiceState === 'analyzing' && (
        <Animated.View entering={FadeIn.duration(200)} style={styles.analyzingHint}>
          <Text style={styles.analyzingText}>Processing your session...</Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background,
    zIndex: 10,
  },
  topBadgeRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: alpha(colors.white, 0.06),
    borderRadius: 24,
    borderWidth: 1,
    borderColor: alpha(colors.white, 0.1),
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: 8,
    gap: 8,
  },
  liveBadgeAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: alpha(colors.white, 0.08),
    borderWidth: 1,
    borderColor: alpha(colors.primary, 0.3),
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  liveBadgeText: {
    gap: 1,
  },
  liveModeLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2,
    color: colors.primary,
    textTransform: 'uppercase',
  },
  liveModeName: {
    fontSize: 12,
    fontWeight: '600',
    color: alpha(colors.white, 0.8),
  },
  timerPill: {
    backgroundColor: alpha(colors.primary, 0.12),
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginLeft: 4,
  },
  timerPillText: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 2,
    color: colors.primary,
    fontVariant: ['tabular-nums'],
  },
  secureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 16,
  },
  secureText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2.5,
    color: alpha(colors.white, 0.35),
    textTransform: 'uppercase',
  },
  stateSpacer: {
    marginBottom: 16,
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
    borderColor: alpha(colors.primary, 0.4),
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  controlLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: alpha(colors.white, 0.45),
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
    fontWeight: '600',
    color: alpha(colors.error, 0.7),
  },
  analyzingHint: {
    alignItems: 'center',
    paddingBottom: 20,
  },
  analyzingText: {
    fontSize: 15,
    color: alpha(colors.white, 0.5),
  },
});
