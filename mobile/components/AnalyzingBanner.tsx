import { useEffect, useState, useCallback } from 'react';
import { Text, StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  useDerivedValue,
  Easing,
  cancelAnimation,
  interpolate,
  runOnJS,
} from 'react-native-reanimated';
import { Canvas, Circle, BlurMask } from '@shopify/react-native-skia';
import { colors, alpha } from '../theme';

interface Props {
  visible: boolean;
}

const SIZE = 56;
const CX = SIZE / 2;
const CY = SIZE / 2;

const STEPS = [
  'Processing your session...',
  'Detecting filler words...',
  'Checking grammar...',
  'Generating insights...',
];

export function AnalyzingBanner({ visible }: Props) {
  const [shouldRender, setShouldRender] = useState(visible);
  const [stepIndex, setStepIndex] = useState(0);

  const containerOpacity = useSharedValue(visible ? 1 : 0);
  const orbit1 = useSharedValue(0);
  const orbit2 = useSharedValue(0);
  const orbit3 = useSharedValue(0);
  const pulse = useSharedValue(0);
  const textOpacity = useSharedValue(1);
  const step = useSharedValue(0);

  // Show/hide with fade
  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      containerOpacity.value = withTiming(1, { duration: 200 });
    } else {
      containerOpacity.value = withTiming(0, { duration: 300 });
      const t = setTimeout(() => setShouldRender(false), 350);
      return () => clearTimeout(t);
    }
  }, [visible]);

  // Crossfade text cycling
  const cycleText = useCallback(() => {
    textOpacity.value = withTiming(0, { duration: 150 }, (finished) => {
      if (finished) {
        step.value = (step.value + 1) % STEPS.length;
        runOnJS(setStepIndex)(step.value);
        textOpacity.value = withTiming(1, { duration: 150 });
      }
    });
  }, []);

  // Start all animations when rendered
  useEffect(() => {
    if (!shouldRender) return;

    step.value = 0;
    setStepIndex(0);

    // Orbital rotations at different speeds & directions
    orbit1.value = 0;
    orbit1.value = withRepeat(
      withTiming(Math.PI * 2, { duration: 2400, easing: Easing.linear }),
      -1,
      false,
    );

    orbit2.value = 0;
    orbit2.value = withRepeat(
      withTiming(-Math.PI * 2, { duration: 3200, easing: Easing.linear }),
      -1,
      false,
    );

    orbit3.value = 0;
    orbit3.value = withRepeat(
      withTiming(Math.PI * 2, { duration: 4000, easing: Easing.linear }),
      -1,
      false,
    );

    // Breathing pulse
    pulse.value = 0;
    pulse.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );

    const textTimer = setInterval(cycleText, 2500);

    return () => {
      cancelAnimation(orbit1);
      cancelAnimation(orbit2);
      cancelAnimation(orbit3);
      cancelAnimation(pulse);
      cancelAnimation(textOpacity);
      clearInterval(textTimer);
    };
  }, [shouldRender]);

  // --- Derived orbital dot positions ---

  // Inner ring (r=10, 2 dots, primary purple, fast CW)
  const d1x = useDerivedValue(() => CX + 10 * Math.cos(orbit1.value));
  const d1y = useDerivedValue(() => CY + 10 * Math.sin(orbit1.value));
  const d1bx = useDerivedValue(() => CX + 10 * Math.cos(orbit1.value + Math.PI));
  const d1by = useDerivedValue(() => CY + 10 * Math.sin(orbit1.value + Math.PI));

  // Middle ring (r=16, 3 dots, secondary blue, medium CCW)
  const d2x = useDerivedValue(() => CX + 16 * Math.cos(orbit2.value));
  const d2y = useDerivedValue(() => CY + 16 * Math.sin(orbit2.value));
  const d2bx = useDerivedValue(
    () => CX + 16 * Math.cos(orbit2.value + (Math.PI * 2) / 3),
  );
  const d2by = useDerivedValue(
    () => CY + 16 * Math.sin(orbit2.value + (Math.PI * 2) / 3),
  );
  const d2cx = useDerivedValue(
    () => CX + 16 * Math.cos(orbit2.value + (Math.PI * 4) / 3),
  );
  const d2cy = useDerivedValue(
    () => CY + 16 * Math.sin(orbit2.value + (Math.PI * 4) / 3),
  );

  // Outer ring (r=22, 2 dots, tertiary pink, slow CW)
  const d3x = useDerivedValue(() => CX + 22 * Math.cos(orbit3.value));
  const d3y = useDerivedValue(() => CY + 22 * Math.sin(orbit3.value));
  const d3bx = useDerivedValue(
    () => CX + 22 * Math.cos(orbit3.value + Math.PI),
  );
  const d3by = useDerivedValue(
    () => CY + 22 * Math.sin(orbit3.value + Math.PI),
  );

  // --- Glow & core intensities ---
  const outerGlow = useDerivedValue(() =>
    interpolate(pulse.value, [0, 1], [0.06, 0.18]),
  );
  const blueGlow = useDerivedValue(() =>
    interpolate(pulse.value, [0, 1], [0.03, 0.1]),
  );
  const innerGlow = useDerivedValue(() =>
    interpolate(pulse.value, [0, 1], [0.12, 0.4]),
  );
  const coreR = useDerivedValue(() =>
    interpolate(pulse.value, [0, 1], [4, 5.5]),
  );

  // --- RN animated styles ---
  const containerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
  }));

  const subtitleStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
  }));

  if (!shouldRender) return null;

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      <View style={styles.content}>
        <View style={styles.orbContainer}>
          <Canvas style={styles.canvas}>
            {/* Layered glow — purple outer + blue accent + purple inner */}
            <Circle
              cx={CX}
              cy={CY}
              r={20}
              color={colors.primary}
              opacity={outerGlow}
            >
              <BlurMask blur={10} style="normal" />
            </Circle>
            <Circle
              cx={CX}
              cy={CY}
              r={14}
              color={colors.secondary}
              opacity={blueGlow}
            >
              <BlurMask blur={8} style="normal" />
            </Circle>
            <Circle
              cx={CX}
              cy={CY}
              r={8}
              color={colors.primary}
              opacity={innerGlow}
            >
              <BlurMask blur={6} style="normal" />
            </Circle>

            {/* Faint orbital guide rings */}
            <Circle
              cx={CX}
              cy={CY}
              r={10}
              color="rgba(204,151,255,0.06)"
              style="stroke"
              strokeWidth={0.5}
            />
            <Circle
              cx={CX}
              cy={CY}
              r={16}
              color="rgba(105,156,255,0.05)"
              style="stroke"
              strokeWidth={0.5}
            />
            <Circle
              cx={CX}
              cy={CY}
              r={22}
              color="rgba(255,109,175,0.04)"
              style="stroke"
              strokeWidth={0.5}
            />

            {/* Inner orbit dots — primary purple */}
            <Circle cx={d1x} cy={d1y} r={2.5} color={colors.primary} />
            <Circle
              cx={d1bx}
              cy={d1by}
              r={1.5}
              color="rgba(204,151,255,0.45)"
            />

            {/* Middle orbit dots — secondary blue */}
            <Circle cx={d2x} cy={d2y} r={2} color={colors.secondary} />
            <Circle
              cx={d2bx}
              cy={d2by}
              r={1.5}
              color="rgba(105,156,255,0.35)"
            />
            <Circle
              cx={d2cx}
              cy={d2cy}
              r={1.5}
              color="rgba(105,156,255,0.35)"
            />

            {/* Outer orbit dots — tertiary pink */}
            <Circle cx={d3x} cy={d3y} r={2} color={colors.tertiary} />
            <Circle
              cx={d3bx}
              cy={d3by}
              r={1.5}
              color="rgba(255,109,175,0.35)"
            />

            {/* Pulsing core */}
            <Circle cx={CX} cy={CY} r={coreR} color={colors.primary} />
          </Canvas>
        </View>

        <View style={styles.textContainer}>
          <Text style={styles.title}>Analyzing speech</Text>
          <Animated.Text style={[styles.subtitle, subtitleStyle]}>
            {STEPS[stepIndex]}
          </Animated.Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginTop: 40,
    borderRadius: 20,
    backgroundColor: alpha(colors.white, 0.05),
    borderWidth: 1,
    borderColor: alpha(colors.white, 0.08),
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 24,
    gap: 20,
  },
  orbContainer: {
    width: SIZE,
    height: SIZE,
  },
  canvas: {
    width: SIZE,
    height: SIZE,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.onSurface,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    color: alpha(colors.white, 0.4),
    marginTop: 2,
    fontWeight: '400',
  },
});
