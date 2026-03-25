import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
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
  withSpring,
  useDerivedValue,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors, alpha, glass, typography, spacing, layout } from '../theme';
import { ScreenHeader, Button } from '../components/ui';

// ── Palette (inline from MicBloomOrb) ──────────────────────────────────
const PURPLE_PALETTE = {
  bloom: [
    'rgba(90, 30, 160, 0.35)',
    'rgba(80, 25, 145, 0.22)',
    'rgba(65, 18, 120, 0.12)',
    'rgba(50, 10, 100, 0.05)',
    'transparent',
  ],
  mid: [
    'rgba(130, 60, 230, 0.28)',
    'rgba(110, 45, 200, 0.12)',
    'transparent',
  ],
  halo: [
    'rgba(160, 110, 250, 0.25)',
    'rgba(140, 90, 220, 0.10)',
    'transparent',
  ],
  ring: 'rgba(200, 180, 255, 0.22)',
  orb: [
    'rgba(190, 160, 240, 0.65)',
    'rgba(150, 120, 210, 0.50)',
    'rgba(110, 85, 180, 0.38)',
  ],
};

// ── Mini Bloom Orb ─────────────────────────────────────────────────────
const MINI_SIZE = 240;
const MINI_ORB_R = 60;

function MiniBloomOrb() {
  const cx = MINI_SIZE / 2;
  const cy = MINI_SIZE / 2;
  const bloomR = MINI_SIZE * 0.7;

  const pulse = useSharedValue(1);
  pulse.value = withRepeat(
    withSequence(
      withTiming(1.05, { duration: 1600 }),
      withTiming(1.0, { duration: 1600 }),
    ),
    -1,
    false,
  );

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  return (
    <Animated.View style={pulseStyle}>
      <Canvas style={{ width: MINI_SIZE, height: MINI_SIZE }}>
        {/* Bloom */}
        <Rect x={0} y={0} width={MINI_SIZE} height={MINI_SIZE}>
          <RadialGradient
            c={vec(cx, cy)}
            r={bloomR}
            colors={PURPLE_PALETTE.bloom}
            positions={[0, 0.18, 0.38, 0.65, 1]}
          />
        </Rect>
        {/* Mid */}
        <Rect x={0} y={0} width={MINI_SIZE} height={MINI_SIZE}>
          <RadialGradient
            c={vec(cx, cy)}
            r={bloomR * 0.5}
            colors={PURPLE_PALETTE.mid}
            positions={[0, 0.5, 1]}
          />
        </Rect>
        {/* Halo */}
        <Circle cx={cx} cy={cy} r={MINI_ORB_R + 40}>
          <RadialGradient
            c={vec(cx, cy)}
            r={MINI_ORB_R + 40}
            colors={PURPLE_PALETTE.halo}
            positions={[0.4, 0.75, 1]}
          />
        </Circle>
        {/* Ring */}
        <Circle
          cx={cx}
          cy={cy}
          r={MINI_ORB_R + 6}
          style="stroke"
          strokeWidth={1.5}
          color={PURPLE_PALETTE.ring}
        />
        {/* Orb */}
        <Circle cx={cx} cy={cy} r={MINI_ORB_R}>
          <RadialGradient
            c={vec(cx - 12, cy - 18)}
            r={MINI_ORB_R * 1.4}
            colors={PURPLE_PALETTE.orb}
            positions={[0, 0.5, 1]}
          />
        </Circle>
        {/* Specular */}
        <Circle cx={cx - 15} cy={cy - 18} r={35}>
          <RadialGradient
            c={vec(cx - 15, cy - 18)}
            r={35}
            colors={[
              'rgba(255, 255, 255, 0.14)',
              'rgba(255, 255, 255, 0.04)',
              'transparent',
            ]}
            positions={[0, 0.5, 1]}
          />
        </Circle>
      </Canvas>
      {/* Mic icon centered */}
      <View style={styles.orbIconWrap}>
        <Ionicons name="mic" size={36} color="#fff" style={styles.orbIcon} />
      </View>
    </Animated.View>
  );
}

// ── Orbiting Dots Icon ─────────────────────────────────────────────────
const ORBIT_R = 70;
const DOT_R = 5;
const DOT_COLORS = [
  alpha(colors.primary, 0.7),
  alpha(colors.secondary, 0.5),
  alpha(colors.primary, 0.7),
  alpha(colors.secondary, 0.5),
];

function OrbitingDotsIcon() {
  const cx = MINI_SIZE / 2;
  const cy = MINI_SIZE / 2;
  const orbitAngle = useSharedValue(0);

  orbitAngle.value = withRepeat(
    withTiming(Math.PI * 2, { duration: 6000, easing: Easing.linear }),
    -1,
    false,
  );

  const dot0x = useDerivedValue(() => cx + ORBIT_R * Math.cos(orbitAngle.value));
  const dot0y = useDerivedValue(() => cy + ORBIT_R * Math.sin(orbitAngle.value));
  const dot1x = useDerivedValue(() => cx + ORBIT_R * Math.cos(orbitAngle.value + Math.PI / 2));
  const dot1y = useDerivedValue(() => cy + ORBIT_R * Math.sin(orbitAngle.value + Math.PI / 2));
  const dot2x = useDerivedValue(() => cx + ORBIT_R * Math.cos(orbitAngle.value + Math.PI));
  const dot2y = useDerivedValue(() => cy + ORBIT_R * Math.sin(orbitAngle.value + Math.PI));
  const dot3x = useDerivedValue(() => cx + ORBIT_R * Math.cos(orbitAngle.value + (3 * Math.PI) / 2));
  const dot3y = useDerivedValue(() => cy + ORBIT_R * Math.sin(orbitAngle.value + (3 * Math.PI) / 2));

  return (
    <View>
      <Canvas style={{ width: MINI_SIZE, height: MINI_SIZE }}>
        {/* Subtle glow behind icon area */}
        <Circle cx={cx} cy={cy} r={50}>
          <RadialGradient
            c={vec(cx, cy)}
            r={50}
            colors={[alpha(colors.primary, 0.15), 'transparent']}
            positions={[0, 1]}
          />
        </Circle>
        {/* Orbit track */}
        <Circle
          cx={cx}
          cy={cy}
          r={ORBIT_R}
          style="stroke"
          strokeWidth={1}
          color={alpha(colors.white, 0.06)}
        />
        {/* Dots */}
        <Circle cx={dot0x} cy={dot0y} r={DOT_R} color={DOT_COLORS[0]} />
        <Circle cx={dot1x} cy={dot1y} r={DOT_R} color={DOT_COLORS[1]} />
        <Circle cx={dot2x} cy={dot2y} r={DOT_R} color={DOT_COLORS[2]} />
        <Circle cx={dot3x} cy={dot3y} r={DOT_R} color={DOT_COLORS[3]} />
      </Canvas>
      {/* Pencil icon centered */}
      <View style={styles.orbIconWrap}>
        <Ionicons
          name="create-outline"
          size={48}
          color={colors.primary}
          style={styles.pencilIcon}
        />
      </View>
    </View>
  );
}

// ── Mode content data ──────────────────────────────────────────────────
const MODES = {
  voice: {
    title: 'Create with Voice',
    subtitle: 'Describe your ideal agent in a natural conversation',
  },
  manual: {
    title: 'Create Manually',
    subtitle: 'Fill out a step-by-step form to define your agent',
  },
} as const;

type Mode = keyof typeof MODES;

// ── Animated pill ──────────────────────────────────────────────────────
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function TogglePill({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.93, { damping: 15, stiffness: 400 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 12, stiffness: 300 });
      }}
      style={[
        styles.pill,
        selected ? styles.pillSelected : styles.pillUnselected,
        animStyle,
      ]}
    >
      <Text
        style={[
          styles.pillText,
          selected ? styles.pillTextSelected : styles.pillTextUnselected,
        ]}
      >
        {label}
      </Text>
    </AnimatedPressable>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────
export default function AgentCreationChoiceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>('voice');

  // Crossfade shared values
  const voiceOpacity = useSharedValue(1);
  const manualOpacity = useSharedValue(0);
  const voiceScale = useSharedValue(1);
  const manualScale = useSharedValue(0.92);

  const voiceStyle = useAnimatedStyle(() => ({
    opacity: voiceOpacity.value,
    transform: [{ scale: voiceScale.value }],
  }));

  const manualStyle = useAnimatedStyle(() => ({
    opacity: manualOpacity.value,
    transform: [{ scale: manualScale.value }],
  }));

  const textVoiceStyle = useAnimatedStyle(() => ({
    opacity: voiceOpacity.value,
  }));

  const textManualStyle = useAnimatedStyle(() => ({
    opacity: manualOpacity.value,
  }));

  const switchMode = (next: Mode) => {
    if (next === mode) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMode(next);

    const dur = { duration: 250 };
    if (next === 'voice') {
      voiceOpacity.value = withTiming(1, dur);
      voiceScale.value = withTiming(1, dur);
      manualOpacity.value = withTiming(0, dur);
      manualScale.value = withTiming(0.92, dur);
    } else {
      voiceOpacity.value = withTiming(0, dur);
      voiceScale.value = withTiming(0.92, dur);
      manualOpacity.value = withTiming(1, dur);
      manualScale.value = withTiming(1, dur);
    }
  };

  const handleGetStarted = () => {
    if (mode === 'voice') {
      router.replace({ pathname: '/agent-create', params: { startVoice: 'true' } });
    } else {
      router.replace('/agent-create');
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader variant="modal" title="New Agent" />

      {/* Center showcase area */}
      <View style={styles.showcase}>
        <View style={styles.visualWrap}>
          <Animated.View style={[styles.visualLayer, voiceStyle]}>
            <MiniBloomOrb />
          </Animated.View>
          <Animated.View style={[styles.visualLayer, manualStyle]}>
            <OrbitingDotsIcon />
          </Animated.View>
        </View>

        {/* Title / subtitle crossfade */}
        <View style={styles.textArea}>
          <View>
            <Animated.View style={[styles.textLayer, textVoiceStyle]}>
              <Text style={styles.modeTitle}>{MODES.voice.title}</Text>
              <Text style={styles.modeSubtitle}>{MODES.voice.subtitle}</Text>
            </Animated.View>
            <Animated.View style={[styles.textLayer, styles.textLayerAbsolute, textManualStyle]}>
              <Text style={styles.modeTitle}>{MODES.manual.title}</Text>
              <Text style={styles.modeSubtitle}>{MODES.manual.subtitle}</Text>
            </Animated.View>
          </View>
        </View>
      </View>

      {/* Bottom: toggle + CTA */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.toggleBar}>
          <TogglePill
            label="Voice"
            selected={mode === 'voice'}
            onPress={() => switchMode('voice')}
          />
          <TogglePill
            label="Manual"
            selected={mode === 'manual'}
            onPress={() => switchMode('manual')}
          />
        </View>

        <Button
          variant="primary"
          label="Get Started"
          onPress={handleGetStarted}
          fullWidth
        />
      </View>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  showcase: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  visualWrap: {
    width: MINI_SIZE,
    height: MINI_SIZE,
  },
  visualLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: MINI_SIZE,
    height: MINI_SIZE,
  },
  textArea: {
    alignItems: 'center',
    marginTop: spacing.xl,
    minHeight: 60,
  },
  textLayer: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  textLayerAbsolute: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  modeTitle: {
    ...typography.headlineSm,
    color: colors.onSurface,
    textAlign: 'center',
  },
  modeSubtitle: {
    ...typography.bodyMd,
    color: alpha(colors.white, 0.5),
    textAlign: 'center',
    paddingHorizontal: spacing.xxl,
  },
  orbIconWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbIcon: {
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  pencilIcon: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  // Toggle bar
  bottom: {
    paddingHorizontal: layout.screenPadding,
    gap: spacing.xl,
  },
  toggleBar: {
    ...glass.navBar,
    flexDirection: 'row',
    padding: 4,
    alignSelf: 'center',
  },
  pill: {
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderRadius: 44,
  },
  pillSelected: {
    backgroundColor: colors.primary,
  },
  pillUnselected: {
    backgroundColor: 'transparent',
  },
  pillText: {
    fontSize: 15,
    fontWeight: '700',
  },
  pillTextSelected: {
    color: colors.black,
  },
  pillTextUnselected: {
    color: alpha(colors.white, 0.4),
  },
});
