import { useEffect } from 'react';
import { StyleSheet, Pressable, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { colors, alpha } from '../../theme';
import type { DeepInsight } from '../../types/session';

const DOT_SIZE = 10;
const BRACKET_HEIGHT = 3;
const MIN_BRACKET_WIDTH = 12;
const EDGE_PADDING = 4;

interface InsightMarkersProps {
  insights: DeepInsight[];
  durationSeconds: number;
  pxPerSecond: number;
  /** Height of the RN overlay layer. */
  overlayHeight: number;
  /** Y position for point markers (sit just above the ribbon). */
  pointY: number;
  /** Y position for range brackets (just below the ribbon baseline). */
  bracketY: number;
  onMarkerPress: (insight: DeepInsight) => void;
  activeInsight: DeepInsight | null;
}

export function InsightMarkers({
  insights,
  durationSeconds,
  pxPerSecond,
  overlayHeight,
  pointY,
  bracketY,
  onMarkerPress,
  activeInsight,
}: InsightMarkersProps) {
  const markers = insights.filter(i => i.type === 'specific' && i.anchor);
  if (markers.length === 0) return null;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.layer, { height: overlayHeight }]}
    >
      {markers.map((m, idx) => {
        const a = m.anchor!;
        const isActive = activeInsight === m;
        const startClamped = Math.max(0, Math.min(durationSeconds, a.start_seconds));
        const startX = Math.max(EDGE_PADDING, startClamped * pxPerSecond);

        if (a.kind === 'point') {
          return (
            <PointMarker
              key={`p-${idx}`}
              x={startX}
              y={pointY}
              isActive={isActive}
              onPress={() => onMarkerPress(m)}
            />
          );
        }

        const endClamped = Math.max(startClamped, Math.min(durationSeconds, a.end_seconds));
        const endX = endClamped * pxPerSecond;
        const rawWidth = Math.max(MIN_BRACKET_WIDTH, endX - startX);
        return (
          <RangeMarker
            key={`r-${idx}`}
            x={startX}
            y={bracketY}
            width={rawWidth}
            isActive={isActive}
            onPress={() => onMarkerPress(m)}
          />
        );
      })}
    </View>
  );
}

function PointMarker({
  x,
  y,
  isActive,
  onPress,
}: {
  x: number;
  y: number;
  isActive: boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);

  useEffect(() => {
    if (isActive) {
      scale.value = withTiming(1, { duration: 180 });
      return;
    }
    scale.value = withRepeat(
      withTiming(1.15, { duration: 800, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [isActive, scale]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: isActive ? 1 : 0.95,
  }));

  return (
    <Pressable
      hitSlop={14}
      onPress={onPress}
      style={[
        styles.pointPressable,
        { left: x - DOT_SIZE / 2, top: y - DOT_SIZE / 2 },
      ]}
    >
      <Animated.View style={[styles.pointDot, animStyle]} />
    </Pressable>
  );
}

function RangeMarker({
  x,
  y,
  width,
  isActive,
  onPress,
}: {
  x: number;
  y: number;
  width: number;
  isActive: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      hitSlop={10}
      onPress={onPress}
      style={[
        styles.rangePressable,
        { left: x, top: y - BRACKET_HEIGHT / 2, width },
      ]}
    >
      <View
        style={[
          styles.rangeBar,
          { opacity: isActive ? 1 : 0.6 },
        ]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  pointPressable: {
    position: 'absolute',
    width: DOT_SIZE,
    height: DOT_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointDot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.7,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  rangePressable: {
    position: 'absolute',
    height: BRACKET_HEIGHT + 12,
    justifyContent: 'center',
  },
  rangeBar: {
    height: BRACKET_HEIGHT,
    borderRadius: BRACKET_HEIGHT / 2,
    backgroundColor: alpha(colors.primary, 1),
  },
});
