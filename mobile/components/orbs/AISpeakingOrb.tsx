import { useEffect } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
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
} from 'react-native-reanimated';
import { colors, alpha } from '../../theme';

// -- Orb dimensions --
const ORB_SIZE = 170;
const BORDER_WIDTH = 2.5;
const BORDER_RING_SIZE = ORB_SIZE + BORDER_WIDTH * 2;
const OUTER_CIRCLE_SIZE = 240;

export type AISpeakingOrbState = 'speaking' | 'listening' | 'idle';

interface AISpeakingOrbProps {
  state: AISpeakingOrbState;
}

export function AISpeakingOrb({ state }: AISpeakingOrbProps) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  // Bloom canvas dimensions
  const BLOOM_W = screenWidth;
  const BLOOM_H = screenHeight * 1.0;
  const bloomCx = BLOOM_W / 2;
  const bloomCy = BLOOM_H / 2;
  const bloomRadius = Math.sqrt(bloomCx * bloomCx + bloomCy * bloomCy);

  // Bloom animation values
  const bloomScale = useSharedValue(1);
  const bloomOpacity = useSharedValue(0.6);

  // Waveform bar heights (5 bars)
  const bar0 = useSharedValue(4);
  const bar1 = useSharedValue(4);
  const bar2 = useSharedValue(4);
  const bar3 = useSharedValue(4);
  const bar4 = useSharedValue(4);

  // Drive animations from state
  useEffect(() => {
    cancelAnimation(bloomScale);
    cancelAnimation(bloomOpacity);
    cancelAnimation(bar0);
    cancelAnimation(bar1);
    cancelAnimation(bar2);
    cancelAnimation(bar3);
    cancelAnimation(bar4);

    if (state === 'speaking') {
      bloomScale.value = withRepeat(
        withSequence(
          withTiming(1.15, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(1.0, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      );
      bloomOpacity.value = withTiming(1, { duration: 500 });

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
    } else if (state === 'listening') {
      bloomScale.value = withRepeat(
        withSequence(
          withTiming(1.06, { duration: 1600, easing: Easing.inOut(Easing.ease) }),
          withTiming(1.0, { duration: 1600, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      );
      bloomOpacity.value = withTiming(0.75, { duration: 500 });

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
      bloomScale.value = withTiming(1, { duration: 500 });
      bloomOpacity.value = withTiming(0.5, { duration: 500 });
      [bar0, bar1, bar2, bar3, bar4].forEach((b) => {
        b.value = withTiming(4, { duration: 400 });
      });
    }
  }, [state]);

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
    <View style={styles.orbCenter}>
      {/* Layer 1: Massive animated bloom (Skia) */}
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
              positions={[0, 0.20, 0.45, 0.72, 1]}
            />
          </Rect>

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
          {/* Waveform bars */}
          <View style={styles.orbWaveform}>
            {barStyles.map((style, i) => (
              <Animated.View key={i} style={[styles.orbWaveBar, style]} />
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  orbCenter: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  bloomAnchor: {
    position: 'absolute',
    left: '50%',
    top: '50%',
  },
  outerCircle: {
    position: 'absolute',
    width: OUTER_CIRCLE_SIZE,
    height: OUTER_CIRCLE_SIZE,
    borderRadius: OUTER_CIRCLE_SIZE / 2,
    borderWidth: 1,
    borderColor: 'rgba(160, 140, 220, 0.12)',
    overflow: 'hidden',
  },
  borderRing: {
    width: BORDER_RING_SIZE,
    height: BORDER_RING_SIZE,
    borderRadius: BORDER_RING_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
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
});
