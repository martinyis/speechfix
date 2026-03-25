import React, { useMemo } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import {
  Canvas,
  Circle,
  RadialGradient,
  Rect,
  vec,
} from '@shopify/react-native-skia';
import { Ionicons } from '@expo/vector-icons';

const ORB_RADIUS = 100;
const LAYOUT_HEIGHT = 240;

// -- Color palettes for bloom hue --

type BloomPalette = {
  bloom: string[];
  mid: string[];
  halo: string[];
  ring: string;
  orb: string[];
};

/** Default purple palette (Reflexa) */
const PURPLE_PALETTE: BloomPalette = {
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

/** Blue palette (custom agents) */
const BLUE_PALETTE: BloomPalette = {
  bloom: [
    'rgba(30, 80, 180, 0.35)',
    'rgba(25, 70, 165, 0.22)',
    'rgba(18, 55, 140, 0.12)',
    'rgba(10, 40, 120, 0.05)',
    'transparent',
  ],
  mid: [
    'rgba(60, 120, 240, 0.28)',
    'rgba(45, 100, 220, 0.12)',
    'transparent',
  ],
  halo: [
    'rgba(110, 160, 255, 0.25)',
    'rgba(90, 140, 240, 0.10)',
    'transparent',
  ],
  ring: 'rgba(180, 200, 255, 0.22)',
  orb: [
    'rgba(160, 190, 250, 0.65)',
    'rgba(120, 160, 230, 0.50)',
    'rgba(85, 130, 200, 0.38)',
  ],
};

interface MicBloomOrbProps {
  /** Accent color hint: 'purple' for Reflexa (default), 'blue' for custom agents */
  accentColor?: 'purple' | 'blue';
}

export default function MicBloomOrb({ accentColor = 'purple' }: MicBloomOrbProps) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const palette = useMemo(
    () => (accentColor === 'blue' ? BLUE_PALETTE : PURPLE_PALETTE),
    [accentColor],
  );

  const CANVAS_W = screenWidth;
  const CANVAS_H = screenHeight * 0.85;
  const cx = CANVAS_W / 2;
  const cy = CANVAS_H / 2;
  const bloomRadius = Math.sqrt(cx * cx + cy * cy);

  return (
    <View style={styles.wrapper}>
      {/* Bloom canvas — absolutely positioned, centered via transform */}
      <View
        style={[
          styles.canvasAnchor,
          {
            width: CANVAS_W,
            height: CANVAS_H,
            transform: [
              { translateX: -(CANVAS_W / 2) },
              { translateY: -(CANVAS_H / 2) },
            ],
          },
        ]}
      >
        <Canvas style={{ width: CANVAS_W, height: CANVAS_H }}>
          {/* Layer 1: Full-screen bloom */}
          <Rect x={0} y={0} width={CANVAS_W} height={CANVAS_H}>
            <RadialGradient
              c={vec(cx, cy)}
              r={bloomRadius}
              colors={palette.bloom}
              positions={[0, 0.18, 0.38, 0.65, 1]}
            />
          </Rect>

          {/* Layer 2: Mid reinforcement */}
          <Rect x={0} y={0} width={CANVAS_W} height={CANVAS_H}>
            <RadialGradient
              c={vec(cx, cy)}
              r={bloomRadius * 0.5}
              colors={palette.mid}
              positions={[0, 0.5, 1]}
            />
          </Rect>

          {/* Layer 3: Halo around orb */}
          <Circle cx={cx} cy={cy} r={190}>
            <RadialGradient
              c={vec(cx, cy)}
              r={190}
              colors={palette.halo}
              positions={[0.4, 0.75, 1]}
            />
          </Circle>

          {/* Outer ring */}
          <Circle
            cx={cx}
            cy={cy}
            r={ORB_RADIUS + 8}
            style="stroke"
            strokeWidth={1.5}
            color={palette.ring}
          />

          {/* Main orb body */}
          <Circle cx={cx} cy={cy} r={ORB_RADIUS}>
            <RadialGradient
              c={vec(cx - 20, cy - 30)}
              r={ORB_RADIUS * 1.4}
              colors={palette.orb}
              positions={[0, 0.5, 1]}
            />
          </Circle>

          {/* Specular highlight */}
          <Circle cx={cx - 25} cy={cy - 30} r={55}>
            <RadialGradient
              c={vec(cx - 25, cy - 30)}
              r={55}
              colors={[
                'rgba(255, 255, 255, 0.14)',
                'rgba(255, 255, 255, 0.04)',
                'transparent',
              ]}
              positions={[0, 0.5, 1]}
            />
          </Circle>

          {/* Bottom depth */}
          <Circle cx={cx} cy={cy + 20} r={ORB_RADIUS * 0.7}>
            <RadialGradient
              c={vec(cx, cy + 20)}
              r={ORB_RADIUS * 0.7}
              colors={['rgba(0, 0, 0, 0.20)', 'transparent']}
              positions={[0.2, 1]}
            />
          </Circle>
        </Canvas>
      </View>

      {/* Mic icon — centered in layout box */}
      <View style={styles.iconWrap}>
        <Ionicons name="mic" size={48} color="#fff" style={styles.micIcon} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    height: LAYOUT_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  // Anchored at the center of wrapper, then shifted back by half its own size
  canvasAnchor: {
    position: 'absolute',
    left: '50%',
    top: '50%',
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  micIcon: {
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
  },
});
