import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import {
  Canvas,
  Circle,
  Path,
  Skia,
  RadialGradient,
  vec,
} from '@shopify/react-native-skia';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useDerivedValue,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  Easing,
  cancelAnimation,
  type SharedValue,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// -- Dimensions (scaled ~36% from MicBloomOrb's 100px radius) --
const ORB_RADIUS = 36;
const CANVAS_SIZE = 200;
const HALO_RADIUS = 68;
const OUTER_RING_RADIUS = 39;
const SPECULAR_RADIUS = 20;
const DEPTH_RADIUS = 25;
const CX = CANVAS_SIZE / 2;
const CY = CANVAS_SIZE / 2;

// Pulse ring config
const RING_COUNT = 3;
const RING_STAGGER = 600;
const RING_DURATION = 1800;
const RING_BASE_SIZE = 72; // diameter matching orb
const RING_COLOR = 'rgba(180, 140, 255, 0.25)';

// Audio bar config
const BAR_COUNT = 13;
const BAR_WIDTH = 2.5;
const BAR_GAP = 2.5;
const BAR_MIN_H = 4;
const BAR_MAX_H = 36;
// Center-biased bell envelope — shapes the waveform silhouette
const BAR_ENVELOPE = [
  0.30, 0.40, 0.52, 0.65, 0.78, 0.88, 1.0,
  0.90, 0.78, 0.62, 0.50, 0.38, 0.28,
];

// Reuse purple palette from MicBloomOrb
const palette = {
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

export interface PracticeRecordOrbProps {
  state: 'idle' | 'recording' | 'evaluating' | 'success';
  audioLevel: SharedValue<number>;
  onPress: () => void;
}

export default function PracticeRecordOrb({
  state,
  audioLevel,
  onPress,
}: PracticeRecordOrbProps) {
  // -- Evaluating arc sweep --
  const arcPath = useMemo(() => {
    const path = Skia.Path.Make();
    path.addArc(
      { x: CX - OUTER_RING_RADIUS, y: CY - OUTER_RING_RADIUS, width: OUTER_RING_RADIUS * 2, height: OUTER_RING_RADIUS * 2 },
      -90, // start from top
      90,  // 90° sweep
    );
    return path;
  }, []);

  const arcRotation = useSharedValue(0);
  const arcOpacity = useSharedValue(0);
  const iconDim = useSharedValue(1);

  useEffect(() => {
    if (state === 'evaluating') {
      arcRotation.value = 0;
      arcRotation.value = withRepeat(
        withTiming(360, { duration: 1500, easing: Easing.linear }),
        -1,
        false,
      );
      arcOpacity.value = withTiming(1, { duration: 300 });
      iconDim.value = withTiming(0.3, { duration: 250 });
    } else {
      cancelAnimation(arcRotation);
      arcOpacity.value = withTiming(0, { duration: 200 });
      iconDim.value = withTiming(1, { duration: 200 });
    }
  }, [state, arcRotation, arcOpacity, iconDim]);

  const arcStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${arcRotation.value}deg` }],
    opacity: arcOpacity.value,
  }));

  const iconDimStyle = useAnimatedStyle(() => ({
    opacity: iconDim.value,
  }));

  // -- Press animation --
  const pressScale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  // -- Breathing (idle) / Success bloom --
  const breathScale = useSharedValue(1);

  useEffect(() => {
    if (state === 'success') {
      cancelAnimation(breathScale);
      breathScale.value = withSequence(
        withSpring(1.2, { damping: 12, stiffness: 200 }),
        withDelay(600, withTiming(1.0, { duration: 300 })),
      );
    } else if (state === 'idle' || state === 'evaluating') {
      breathScale.value = withRepeat(
        withSequence(
          withTiming(1.04, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
          withTiming(1.0, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      );
    } else {
      cancelAnimation(breathScale);
      breathScale.value = withTiming(1.0, { duration: 200 });
    }
  }, [state, breathScale]);

  const breathStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breathScale.value }],
  }));

  // -- Bloom opacity --
  const bloomOpacity = useSharedValue(0.7);

  useEffect(() => {
    bloomOpacity.value = withTiming(
      state === 'recording' || state === 'success' ? 1.0 : 0.7,
      { duration: 300 },
    );
  }, [state, bloomOpacity]);

  const bloomStyle = useAnimatedStyle(() => ({
    opacity: bloomOpacity.value,
  }));

  // -- Pulse rings (recording) --
  const ringProgress = [
    useSharedValue(0),
    useSharedValue(0),
    useSharedValue(0),
  ];

  useEffect(() => {
    if (state === 'recording') {
      ringProgress.forEach((sv, i) => {
        sv.value = 0;
        sv.value = withDelay(
          i * RING_STAGGER,
          withRepeat(
            withTiming(1, {
              duration: RING_DURATION,
              easing: Easing.out(Easing.ease),
            }),
            -1,
            false,
          ),
        );
      });
    } else if (state === 'success') {
      // Single pulse ring radiating outward
      ringProgress.forEach((sv, i) => {
        cancelAnimation(sv);
        if (i === 0) {
          sv.value = 0;
          sv.value = withTiming(1, {
            duration: 500,
            easing: Easing.out(Easing.ease),
          });
        } else {
          sv.value = withTiming(0, { duration: 200 });
        }
      });
    } else {
      // Collapse inward on stop
      ringProgress.forEach((sv) => {
        cancelAnimation(sv);
        sv.value = withTiming(0, { duration: 300 });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const ringStyles = ringProgress.map((sv, i) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useAnimatedStyle(() => {
      if (state === 'success' && i === 0) {
        // Success ring: scale 1→2.5, opacity 0.4→0
        const scale = 1 + sv.value * 1.5;
        const opacity = 0.4 * (1 - sv.value);
        return { transform: [{ scale }], opacity };
      }
      const scale = 1 + sv.value * 0.8; // 1.0 → 1.8
      const opacity = 0.3 * (1 - sv.value); // 0.3 → 0
      return {
        transform: [{ scale }],
        opacity,
      };
    }),
  );

  // -- Audio bars --
  const barsOpacity = useSharedValue(0);

  useEffect(() => {
    barsOpacity.value = withTiming(state === 'recording' ? 1 : 0, {
      duration: state === 'recording' ? 200 : 250,
    });
  }, [state, barsOpacity]);

  const barsOpacityStyle = useAnimatedStyle(() => ({
    opacity: barsOpacity.value,
  }));

  // Derive bar heights with per-bar pseudo-random variation
  // Each bar gets independent noise seeded by (index + audioLevel) so they don't move in lockstep
  const barHeights = BAR_ENVELOPE.map((envelope, i) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useDerivedValue(() => {
      'worklet';
      const level = audioLevel.value;
      // Deterministic noise that changes as level changes — different per bar
      const seed = level * 1000;
      const noise = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453;
      const rand = noise - Math.floor(noise); // 0–1
      // Mix envelope shape (60%) with random variation (40%)
      const barLevel = level * (envelope * 0.6 + rand * 0.4);
      return BAR_MIN_H + barLevel * (BAR_MAX_H - BAR_MIN_H);
    }),
  );

  const barHeightStyles = barHeights.map((derived) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useAnimatedStyle(() => {
      'worklet';
      return {
        height: withSpring(derived.value, {
          damping: 14,
          stiffness: 150,
          mass: 0.4,
        }),
      };
    }),
  );

  // Lock input while evaluating or during the success check-mark animation
  // (prevents the user from accidentally restarting a recording before the
  // parent screen has had a chance to advance).
  const disabled = state === 'success' || state === 'evaluating';

  return (
    <AnimatedPressable
      style={[styles.pressable, pressStyle]}
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => {
        if (disabled) return;
        pressScale.value = withSpring(0.9, { damping: 15, stiffness: 300 });
      }}
      onPressOut={() => {
        if (disabled) return;
        pressScale.value = withSpring(1.0, { damping: 15, stiffness: 300 });
      }}
    >
      <View style={styles.container}>
        {/* Audio bars above orb */}
        <Animated.View style={[styles.barsContainer, barsOpacityStyle]}>
          {BAR_ENVELOPE.map((_, i) => (
            <Animated.View
              key={i}
              style={[styles.bar, barHeightStyles[i]]}
            />
          ))}
        </Animated.View>

        {/* Orb area */}
        <View style={styles.orbArea}>
          {/* Pulse rings — behind everything */}
          {ringStyles.map((rStyle, i) => (
            <Animated.View key={i} style={[styles.pulseRing, rStyle]} />
          ))}

          {/* Skia canvas — bloom + orb body */}
          <Animated.View style={[styles.canvasWrap, breathStyle, bloomStyle]}>
            <Canvas style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}>
              {/* Halo */}
              <Circle cx={CX} cy={CY} r={HALO_RADIUS}>
                <RadialGradient
                  c={vec(CX, CY)}
                  r={HALO_RADIUS}
                  colors={palette.halo}
                  positions={[0.4, 0.75, 1]}
                />
              </Circle>

              {/* Outer ring */}
              <Circle
                cx={CX}
                cy={CY}
                r={OUTER_RING_RADIUS}
                style="stroke"
                strokeWidth={1}
                color={palette.ring}
              />

              {/* Main orb body */}
              <Circle cx={CX} cy={CY} r={ORB_RADIUS}>
                <RadialGradient
                  c={vec(CX - 7, CY - 11)}
                  r={ORB_RADIUS * 1.4}
                  colors={palette.orb}
                  positions={[0, 0.5, 1]}
                />
              </Circle>

              {/* Specular highlight */}
              <Circle cx={CX - 9} cy={CY - 11} r={SPECULAR_RADIUS}>
                <RadialGradient
                  c={vec(CX - 9, CY - 11)}
                  r={SPECULAR_RADIUS}
                  colors={[
                    'rgba(255, 255, 255, 0.14)',
                    'rgba(255, 255, 255, 0.04)',
                    'transparent',
                  ]}
                  positions={[0, 0.5, 1]}
                />
              </Circle>

              {/* Bottom depth */}
              <Circle cx={CX} cy={CY + 7} r={DEPTH_RADIUS}>
                <RadialGradient
                  c={vec(CX, CY + 7)}
                  r={DEPTH_RADIUS}
                  colors={['rgba(0, 0, 0, 0.20)', 'transparent']}
                  positions={[0.2, 1]}
                />
              </Circle>
            </Canvas>
          </Animated.View>

          {/* Arc sweep — evaluating state */}
          <Animated.View style={[styles.arcSweepWrap, arcStyle]} pointerEvents="none">
            <Canvas style={styles.arcCanvas}>
              {/* Glow */}
              <Path
                path={arcPath}
                style="stroke"
                strokeWidth={6}
                strokeCap="round"
                color="rgba(180, 140, 255, 0.25)"
              />
              {/* Main arc */}
              <Path
                path={arcPath}
                style="stroke"
                strokeWidth={2}
                strokeCap="round"
                color="rgba(180, 140, 255, 0.85)"
              />
            </Canvas>
          </Animated.View>

          {/* Icon overlay — centered on orb */}
          <View style={styles.iconOverlay}>
            {state === 'recording' ? (
              <View style={styles.stopSquare} />
            ) : state === 'success' ? (
              <Ionicons name="checkmark" size={28} color="#fff" style={styles.micIcon} />
            ) : (
              <Animated.View style={iconDimStyle}>
                <Ionicons name="mic" size={24} color="#fff" style={styles.micIcon} />
              </Animated.View>
            )}
          </View>
        </View>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    alignItems: 'center',
  },
  container: {
    width: 200,
    alignItems: 'center',
  },
  // Audio bars — bars expand from center (up + down) like a waveform
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: BAR_GAP,
    height: BAR_MAX_H,
    marginBottom: -30,
    zIndex: 1,
  },
  bar: {
    width: BAR_WIDTH,
    borderRadius: BAR_WIDTH,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    minHeight: BAR_MIN_H,
  },
  // Orb area
  orbArea: {
    width: CANVAS_SIZE,
    height: CANVAS_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: RING_BASE_SIZE,
    height: RING_BASE_SIZE,
    borderRadius: RING_BASE_SIZE / 2,
    borderWidth: 1.5,
    borderColor: RING_COLOR,
  },
  canvasWrap: {
    width: CANVAS_SIZE,
    height: CANVAS_SIZE,
  },
  arcSweepWrap: {
    position: 'absolute',
    width: CANVAS_SIZE,
    height: CANVAS_SIZE,
  },
  arcCanvas: {
    width: CANVAS_SIZE,
    height: CANVAS_SIZE,
  },
  iconOverlay: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: ORB_RADIUS * 2,
    height: ORB_RADIUS * 2,
  },
  stopSquare: {
    width: 20,
    height: 20,
    borderRadius: 4,
    backgroundColor: '#ffffff',
  },
  micIcon: {
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
});
