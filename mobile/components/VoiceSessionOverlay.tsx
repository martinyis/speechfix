import { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Canvas,
  Circle,
  RadialGradient,
  Rect,
  vec,
} from '@shopify/react-native-skia';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  cancelAnimation,
  Easing,
  FadeIn,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, alpha } from '../theme';
import { formatTime } from '../lib/formatters';
import type { VoiceSessionState } from '../stores/sessionStore';

// -- State label map --

const STATE_LABELS: Record<string, string> = {
  connecting: 'Connecting...',
  listening: 'Listening',
  speaking: 'Speaking',
  thinking: 'Thinking',
  muted: 'Muted',
  analyzing: 'Analyzing...',
};

// -- Orb dimensions --
const ORB_SIZE = 170;
const BORDER_WIDTH = 2.5;
const BORDER_RING_SIZE = ORB_SIZE + BORDER_WIDTH * 2;
const OUTER_CIRCLE_SIZE = 240;

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
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  // Bloom canvas — very large, overflows orbCenter
  const BLOOM_W = screenWidth;
  const BLOOM_H = screenHeight * 0.75;
  const bloomCx = BLOOM_W / 2;
  const bloomCy = BLOOM_H / 2;
  const bloomRadius = Math.sqrt(bloomCx * bloomCx + bloomCy * bloomCy);

  // Bloom animation values
  const bloomScale = useSharedValue(1);
  const bloomOpacity = useSharedValue(0.6);

  // Waveform bar heights (5 bars, each animated independently)
  const bar0 = useSharedValue(4);
  const bar1 = useSharedValue(4);
  const bar2 = useSharedValue(4);
  const bar3 = useSharedValue(4);
  const bar4 = useSharedValue(4);

  const stateLabel = STATE_LABELS[voiceState] ?? '';

  // Drive animations from voice state
  useEffect(() => {
    cancelAnimation(bloomScale);
    cancelAnimation(bloomOpacity);
    cancelAnimation(bar0);
    cancelAnimation(bar1);
    cancelAnimation(bar2);
    cancelAnimation(bar3);
    cancelAnimation(bar4);

    if (voiceState === 'speaking') {
      // Bloom intensifies — slower, more dramatic
      bloomScale.value = withRepeat(
        withSequence(
          withTiming(1.15, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(1.0, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      );
      bloomOpacity.value = withTiming(1, { duration: 500 });

      // Waveform — slower, organic rhythm per bar
      const heights = [22, 34, 48, 30, 20];
      const mins = [5, 7, 8, 6, 4];
      const durations = [700, 850, 600, 750, 900];
      const bars = [bar0, bar1, bar2, bar3, bar4];
      bars.forEach((b, i) => {
        b.value = withDelay(
          i * 80,
          withRepeat(
            withSequence(
              withTiming(heights[i], { duration: durations[i], easing: Easing.inOut(Easing.sin) }),
              withTiming(mins[i], { duration: durations[i], easing: Easing.inOut(Easing.sin) }),
            ),
            -1,
            true,
          ),
        );
      });
    } else if (voiceState === 'listening') {
      // Gentle bloom breathing
      bloomScale.value = withRepeat(
        withSequence(
          withTiming(1.06, { duration: 1600, easing: Easing.inOut(Easing.ease) }),
          withTiming(1.0, { duration: 1600, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      );
      bloomOpacity.value = withTiming(0.75, { duration: 500 });

      // Subtle waveform — very slow
      const heights = [12, 20, 26, 16, 10];
      const durations = [1400, 1200, 1100, 1300, 1500];
      const bars = [bar0, bar1, bar2, bar3, bar4];
      bars.forEach((b, i) => {
        b.value = withDelay(
          i * 100,
          withRepeat(
            withSequence(
              withTiming(heights[i], { duration: durations[i], easing: Easing.inOut(Easing.sin) }),
              withTiming(4, { duration: durations[i], easing: Easing.inOut(Easing.sin) }),
            ),
            -1,
            true,
          ),
        );
      });
    } else {
      // Idle / other states
      bloomScale.value = withTiming(1, { duration: 500 });
      bloomOpacity.value = withTiming(0.5, { duration: 500 });
      [bar0, bar1, bar2, bar3, bar4].forEach((b) => {
        b.value = withTiming(4, { duration: 400 });
      });
    }
  }, [voiceState]);

  // Animated styles
  const bloomAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: bloomScale.value }],
    opacity: bloomOpacity.value,
  }));

  const bar0Style = useAnimatedStyle(() => ({ height: bar0.value }));
  const bar1Style = useAnimatedStyle(() => ({ height: bar1.value }));
  const bar2Style = useAnimatedStyle(() => ({ height: bar2.value }));
  const bar3Style = useAnimatedStyle(() => ({ height: bar3.value }));
  const bar4Style = useAnimatedStyle(() => ({ height: bar4.value }));
  const barStyles = [bar0Style, bar1Style, bar2Style, bar3Style, bar4Style];

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

      {/* Center: Bloom + Outer circle + Border ring + Orb */}
      <View style={styles.orbCenter}>
        {/* Layer 1: Massive animated bloom (Skia) — overflows container */}
        <Animated.View
          style={[
            styles.bloomAnchor,
            {
              width: BLOOM_W,
              height: BLOOM_H,
              marginLeft: -(BLOOM_W / 2),
              marginTop: -(BLOOM_H / 2),
            },
            bloomAnimStyle,
          ]}
        >
          <Canvas style={{ width: BLOOM_W, height: BLOOM_H }}>
            {/* Full-screen bloom spread */}
            <Rect x={0} y={0} width={BLOOM_W} height={BLOOM_H}>
              <RadialGradient
                c={vec(bloomCx, bloomCy)}
                r={bloomRadius}
                colors={[
                  'rgba(90, 30, 160, 0.40)',
                  'rgba(80, 25, 145, 0.28)',
                  'rgba(65, 18, 120, 0.16)',
                  'rgba(50, 10, 100, 0.06)',
                  'transparent',
                ]}
                positions={[0, 0.18, 0.38, 0.65, 1]}
              />
            </Rect>

            {/* Mid reinforcement — concentrated glow */}
            <Rect x={0} y={0} width={BLOOM_W} height={BLOOM_H}>
              <RadialGradient
                c={vec(bloomCx, bloomCy)}
                r={bloomRadius * 0.45}
                colors={[
                  'rgba(140, 60, 240, 0.35)',
                  'rgba(120, 45, 210, 0.18)',
                  'transparent',
                ]}
                positions={[0, 0.5, 1]}
              />
            </Rect>

            {/* Close halo right around orb area */}
            <Circle cx={bloomCx} cy={bloomCy} r={OUTER_CIRCLE_SIZE * 0.8}>
              <RadialGradient
                c={vec(bloomCx, bloomCy)}
                r={OUTER_CIRCLE_SIZE * 0.8}
                colors={[
                  'rgba(170, 110, 255, 0.25)',
                  'rgba(140, 80, 220, 0.10)',
                  'transparent',
                ]}
                positions={[0.3, 0.7, 1]}
              />
            </Circle>
          </Canvas>
        </Animated.View>

        {/* Layer 2: Low-opacity outer circle */}
        <View style={styles.outerCircle}>
          <LinearGradient
            colors={['rgba(100, 90, 150, 0.20)', 'rgba(70, 60, 120, 0.12)']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0.3, y: 0 }}
            end={{ x: 0.7, y: 1 }}
          />
        </View>

        {/* Layer 3: Gradient border ring */}
        <View style={styles.borderRing}>
          <LinearGradient
            colors={['rgba(160, 200, 255, 0.50)', 'rgba(180, 130, 240, 0.35)', 'rgba(200, 100, 200, 0.45)']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
          />

          {/* Layer 4: Inner orb with gradient fill */}
          <View style={styles.orbInner}>
            <LinearGradient
              colors={['#c0d4ff', '#a8b8ee', '#9080d0', '#a868c8']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0.85, y: 0.1 }}
              end={{ x: 0.15, y: 0.9 }}
            />
            {/* Waveform bars — lower placement, animated per-bar */}
            <View style={styles.orbWaveform}>
              {barStyles.map((style, i) => (
                <Animated.View key={i} style={[styles.orbWaveBar, style]} />
              ))}
            </View>
          </View>
        </View>
      </View>

      {/* State label */}
      <View style={styles.stateLabelWrap}>
        <Text style={styles.stateLabelText}>{stateLabel}</Text>
        <View style={styles.stateSubRow}>
          <View style={[styles.stateDot, { backgroundColor: colors.secondary }]} />
          <Text style={styles.stateSubText}>VOICE AI IS ACTIVE</Text>
        </View>
      </View>

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
  orbCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },

  // Bloom — absolutely positioned, centered via negative margins
  bloomAnchor: {
    position: 'absolute',
    left: '50%',
    top: '50%',
  },

  // Low-opacity outer circle
  outerCircle: {
    position: 'absolute',
    width: OUTER_CIRCLE_SIZE,
    height: OUTER_CIRCLE_SIZE,
    borderRadius: OUTER_CIRCLE_SIZE / 2,
    borderWidth: 1,
    borderColor: 'rgba(160, 140, 220, 0.12)',
    overflow: 'hidden',
  },

  // Gradient border ring — slightly larger than orb, acts as border
  borderRing: {
    width: BORDER_RING_SIZE,
    height: BORDER_RING_SIZE,
    borderRadius: BORDER_RING_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  // Inner orb — gradient fill, sits inside border ring
  orbInner: {
    width: ORB_SIZE,
    height: ORB_SIZE,
    borderRadius: ORB_SIZE / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#9060d0',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 40,
    elevation: 16,
  },

  // Waveform — positioned in lower third of orb
  orbWaveform: {
    position: 'absolute',
    bottom: 34,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 5,
  },
  orbWaveBar: {
    width: 4,
    backgroundColor: alpha(colors.white, 0.8),
    borderRadius: 2,
  },

  stateLabelWrap: {
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  stateLabelText: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: colors.onSurface,
  },
  stateSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stateDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  stateSubText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 3,
    color: alpha(colors.white, 0.35),
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
