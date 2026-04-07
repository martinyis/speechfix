import { forwardRef, useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Canvas,
  Circle,
  RadialGradient,
  RoundedRect,
  Rect,
  vec,
} from '@shopify/react-native-skia';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  useDerivedValue,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import {
  colors,
  alpha,
  typography,
  spacing,
  layout,
} from '../theme';
import { GlassIconPillButton } from './ui';
import { GradientText } from './GradientText';

// ── Palette ──────────────────────────────────────────────────────────────
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

// ── Mini Bloom Orb (Voice mode) ─────────────────────────────────────────
const CANVAS_SIZE = 280;
const ORB_R = 50;
const ICON_SIZE = 96;
const ICON_SCALE = ICON_SIZE / CANVAS_SIZE;

function MiniBloomOrb() {
  const cx = CANVAS_SIZE / 2;
  const cy = CANVAS_SIZE / 2;
  const bloomR = CANVAS_SIZE * 0.48;

  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 1600 }),
        withTiming(1.0, { duration: 1600 }),
      ),
      -1,
      false,
    );
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  return (
    <Animated.View style={pulseStyle}>
      <Canvas style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}>
        <Rect x={0} y={0} width={CANVAS_SIZE} height={CANVAS_SIZE}>
          <RadialGradient
            c={vec(cx, cy)}
            r={bloomR}
            colors={PURPLE_PALETTE.bloom}
            positions={[0, 0.18, 0.38, 0.65, 1]}
          />
        </Rect>
        <Rect x={0} y={0} width={CANVAS_SIZE} height={CANVAS_SIZE}>
          <RadialGradient
            c={vec(cx, cy)}
            r={bloomR * 0.5}
            colors={PURPLE_PALETTE.mid}
            positions={[0, 0.5, 1]}
          />
        </Rect>
        <Circle cx={cx} cy={cy} r={ORB_R + 34}>
          <RadialGradient
            c={vec(cx, cy)}
            r={ORB_R + 34}
            colors={PURPLE_PALETTE.halo}
            positions={[0.4, 0.75, 1]}
          />
        </Circle>
        <Circle
          cx={cx}
          cy={cy}
          r={ORB_R + 5}
          style="stroke"
          strokeWidth={1.5}
          color={PURPLE_PALETTE.ring}
        />
        <Circle cx={cx} cy={cy} r={ORB_R}>
          <RadialGradient
            c={vec(cx - 10, cy - 14)}
            r={ORB_R * 1.4}
            colors={PURPLE_PALETTE.orb}
            positions={[0, 0.5, 1]}
          />
        </Circle>
        <Circle cx={cx - 12} cy={cy - 14} r={28}>
          <RadialGradient
            c={vec(cx - 12, cy - 14)}
            r={28}
            colors={[
              'rgba(255, 255, 255, 0.14)',
              'rgba(255, 255, 255, 0.04)',
              'transparent',
            ]}
            positions={[0, 0.5, 1]}
          />
        </Circle>
      </Canvas>
    </Animated.View>
  );
}

// ── Assembling Document Icon (Manual mode) ──────────────────────────────
const CARD_W = 90;
const CARD_H = 64;
const CARD_R = 10;

const CARD_BACK_COLOR = alpha(colors.secondary, 0.18);
const CARD_MID_COLOR = alpha(colors.primary, 0.15);
const CARD_FRONT_COLOR = alpha(colors.primary, 0.25);
const CARD_STROKE_COLOR = alpha(colors.primary, 0.20);
const LINE_PURPLE = alpha(colors.primary, 0.50);
const LINE_BLUE = alpha(colors.secondary, 0.40);
const GLOW_PRIMARY = alpha(colors.primary, 0.14);
const GLOW_SECONDARY = alpha(colors.secondary, 0.05);
const DOT_COLOR = alpha(colors.primary, 0.55);

const CARD_OFFSETS = [
  { dx: -10, dy: -14 },
  { dx: -4, dy: -6 },
  { dx: 2, dy: 2 },
];

const LINE_SPECS = [
  { y: 16, maxW: 56 },
  { y: 26, maxW: 42 },
  { y: 36, maxW: 50 },
  { y: 46, maxW: 32 },
];

function AssemblingDocIcon() {
  const cx = CANVAS_SIZE / 2;
  const cy = CANVAS_SIZE / 2;

  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2400, easing: Easing.out(Easing.cubic) }),
        withTiming(1, { duration: 1800 }),
        withTiming(0, { duration: 600, easing: Easing.in(Easing.cubic) }),
        withTiming(0, { duration: 400 }),
      ),
      -1,
      false,
    );
  }, []);

  const card0Y = useDerivedValue(() =>
    interpolate(progress.value, [0, 0.25], [24, 0], 'clamp'),
  );
  const card1Y = useDerivedValue(() =>
    interpolate(progress.value, [0.08, 0.30], [24, 0], 'clamp'),
  );
  const card2Y = useDerivedValue(() =>
    interpolate(progress.value, [0.16, 0.38], [24, 0], 'clamp'),
  );

  const card0Op = useDerivedValue(() =>
    interpolate(progress.value, [0, 0.2], [0, 1], 'clamp'),
  );
  const card1Op = useDerivedValue(() =>
    interpolate(progress.value, [0.08, 0.25], [0, 1], 'clamp'),
  );
  const card2Op = useDerivedValue(() =>
    interpolate(progress.value, [0.16, 0.32], [0, 1], 'clamp'),
  );

  const line0W = useDerivedValue(() =>
    interpolate(progress.value, [0.40, 0.56], [0, LINE_SPECS[0].maxW], 'clamp'),
  );
  const line1W = useDerivedValue(() =>
    interpolate(progress.value, [0.46, 0.62], [0, LINE_SPECS[1].maxW], 'clamp'),
  );
  const line2W = useDerivedValue(() =>
    interpolate(progress.value, [0.52, 0.68], [0, LINE_SPECS[2].maxW], 'clamp'),
  );
  const line3W = useDerivedValue(() =>
    interpolate(progress.value, [0.58, 0.74], [0, LINE_SPECS[3].maxW], 'clamp'),
  );

  const frontX = cx - CARD_W / 2 + CARD_OFFSETS[2].dx;
  const frontBaseY = cy - CARD_H / 2 + CARD_OFFSETS[2].dy;

  const backCardY = useDerivedValue(() => cy - CARD_H / 2 + CARD_OFFSETS[0].dy + card0Y.value);
  const midCardY = useDerivedValue(() => cy - CARD_H / 2 + CARD_OFFSETS[1].dy + card1Y.value);
  const frontCardY = useDerivedValue(() => frontBaseY + card2Y.value);

  const line0Y = useDerivedValue(() => frontBaseY + card2Y.value + LINE_SPECS[0].y);
  const line1Y = useDerivedValue(() => frontBaseY + card2Y.value + LINE_SPECS[1].y);
  const line2Y = useDerivedValue(() => frontBaseY + card2Y.value + LINE_SPECS[2].y);
  const line3Y = useDerivedValue(() => frontBaseY + card2Y.value + LINE_SPECS[3].y);

  const dotY = useDerivedValue(() => frontBaseY + card2Y.value + 16);
  const lineX = frontX + 14;

  return (
    <Canvas style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}>
      <Circle cx={cx} cy={cy} r={70}>
        <RadialGradient
          c={vec(cx, cy)}
          r={70}
          colors={[GLOW_PRIMARY, GLOW_SECONDARY, 'transparent']}
          positions={[0, 0.5, 1]}
        />
      </Circle>

      <RoundedRect
        x={cx - CARD_W / 2 + CARD_OFFSETS[0].dx}
        y={backCardY}
        width={CARD_W}
        height={CARD_H}
        r={CARD_R}
        color={CARD_BACK_COLOR}
        opacity={card0Op}
      />
      <RoundedRect
        x={cx - CARD_W / 2 + CARD_OFFSETS[1].dx}
        y={midCardY}
        width={CARD_W}
        height={CARD_H}
        r={CARD_R}
        color={CARD_MID_COLOR}
        opacity={card1Op}
      />
      <RoundedRect
        x={frontX} y={frontCardY}
        width={CARD_W} height={CARD_H} r={CARD_R}
        color={CARD_FRONT_COLOR} opacity={card2Op}
      />
      <RoundedRect
        x={frontX} y={frontCardY}
        width={CARD_W} height={CARD_H} r={CARD_R}
        style="stroke" strokeWidth={1}
        color={CARD_STROKE_COLOR} opacity={card2Op}
      />

      <RoundedRect x={lineX} y={line0Y} width={line0W} height={3} r={1.5}
        color={LINE_PURPLE} opacity={card2Op} />
      <RoundedRect x={lineX} y={line1Y} width={line1W} height={3} r={1.5}
        color={LINE_BLUE} opacity={card2Op} />
      <RoundedRect x={lineX} y={line2Y} width={line2W} height={3} r={1.5}
        color={LINE_PURPLE} opacity={card2Op} />
      <RoundedRect x={lineX} y={line3Y} width={line3W} height={3} r={1.5}
        color={LINE_BLUE} opacity={card2Op} />

      <Circle
        cx={frontX + CARD_W - 14}
        cy={dotY} r={3.5}
        color={DOT_COLOR} opacity={card2Op}
      />
    </Canvas>
  );
}

// ── Mode content data ────────────────────────────────────────────────────
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

// ── Option Column ───────────────────────────────────────────────────────
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function OptionColumn({
  mode,
  selected,
  onSelect,
  children,
}: {
  mode: Mode;
  selected: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  const progress = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(selected ? 1 : 0, { duration: 250 });
  }, [selected]);

  const columnStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0.40, 1]),
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.96, 1.0]) }],
  }));

  return (
    <AnimatedPressable
      style={[styles.optionColumn, columnStyle]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onSelect();
      }}
    >
      {/* Skia icon */}
      <View style={styles.iconContainer}>
        <View style={styles.iconScaler}>
          {children}
        </View>
      </View>

      {/* Text */}
      <Text style={[styles.columnTitle, selected && styles.columnTitleSelected]}>
        {MODES[mode].title}
      </Text>
      <Text style={styles.columnSubtitle}>
        {MODES[mode].subtitle}
      </Text>
    </AnimatedPressable>
  );
}

// ── Bottom Sheet Component ───────────────────────────────────────────────
export const AgentCreationSheet = forwardRef<BottomSheetModal>((_props, ref) => {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('voice');

  const handleGetStarted = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (typeof ref === 'object' && ref?.current) {
      ref.current.dismiss();
    }
    if (mode === 'voice') {
      router.push({ pathname: '/agent-create', params: { startVoice: 'true' } });
    } else {
      router.push('/agent-create');
    }
  }, [mode, ref, router]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
        pressBehavior="close"
      />
    ),
    [],
  );

  const snapPoints = useMemo(() => ['52%'], []);

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={snapPoints}
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={styles.handleIndicator}
      backgroundStyle={styles.sheetBackground}
    >
      <BottomSheetView style={styles.sheetContent}>
        {/* Header */}
        <View style={styles.header}>
          <GradientText
            text="New Practice Partner"
            style={typography.headlineSm}
            colors={[colors.primary, colors.secondary]}
          />
          <LinearGradient
            colors={[colors.primary, colors.secondary, 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.accentLine}
          />
        </View>

        {/* Options — two columns side by side */}
        <View style={styles.columnsWrap}>
          <OptionColumn
            mode="voice"
            selected={mode === 'voice'}
            onSelect={() => setMode('voice')}
          >
            <MiniBloomOrb />
          </OptionColumn>

          <OptionColumn
            mode="manual"
            selected={mode === 'manual'}
            onSelect={() => setMode('manual')}
          >
            <AssemblingDocIcon />
          </OptionColumn>
        </View>

        {/* CTA */}
        <View style={styles.bottom}>
          <GlassIconPillButton
            variant="primary"
            fullWidth
            label="Continue"
            icon="arrow-forward"
            onPress={handleGetStarted}
          />
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
});
AgentCreationSheet.displayName = 'AgentCreationSheet';

// ── Styles ───────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  handleIndicator: {
    backgroundColor: alpha(colors.white, 0.25),
    width: 40,
  },
  sheetBackground: {
    backgroundColor: colors.surfaceContainerLow,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  sheetContent: {
    flex: 1,
    paddingHorizontal: layout.screenPadding,
  },

  // Header
  header: {
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  accentLine: {
    width: 40,
    height: 2,
    borderRadius: 1,
  },

  // Columns layout
  columnsWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  optionColumn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  iconContainer: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  iconScaler: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    transform: [{ scale: ICON_SCALE }],
    transformOrigin: 'left top',
  },
  columnTitle: {
    ...typography.bodyMdMedium,
    color: colors.onSurface,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  columnTitleSelected: {
    color: colors.primary,
  },
  columnSubtitle: {
    ...typography.bodySm,
    color: alpha(colors.white, 0.50),
    textAlign: 'center',
    lineHeight: 18,
  },

  // Bottom CTA
  bottom: {
    paddingBottom: spacing.xxl,
    paddingTop: spacing.lg,
  },
});
