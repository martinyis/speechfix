import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import Svg, { Polyline, Defs, LinearGradient, Stop, Polygon, Circle } from 'react-native-svg';
import { colors, alpha, fonts, spacing } from '../../theme';

interface TrendSparklineProps {
  dataPoints: number[];
  width: number;
  height?: number;
}

export function TrendSparkline({ dataPoints, width, height = 72 }: TrendSparklineProps) {
  const points = dataPoints.slice(-20);

  // Not enough data
  if (points.length < 3) {
    const remaining = 3 - points.length;
    return (
      <View style={[styles.placeholder, { height }]}>
        <Text style={styles.placeholderText}>
          {remaining} more session{remaining !== 1 ? 's' : ''} to unlock trend
        </Text>
      </View>
    );
  }

  const padding = { top: 8, bottom: 4, left: 4, right: 4 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  const coords = points.map((val, i) => {
    const x = padding.left + (i / (points.length - 1)) * chartWidth;
    const y = padding.top + (1 - (val - min) / range) * chartHeight;
    return { x, y };
  });

  const polylinePoints = coords.map(c => `${c.x},${c.y}`).join(' ');

  // Polygon for gradient fill (line + bottom edge)
  const polygonPoints = [
    ...coords.map(c => `${c.x},${c.y}`),
    `${coords[coords.length - 1].x},${height}`,
    `${coords[0].x},${height}`,
  ].join(' ');

  // Trend: compare avg of last 3 to avg of previous 3
  const last3 = points.slice(-3);
  const prev3 = points.slice(-6, -3);
  const last3Avg = last3.reduce((a, b) => a + b, 0) / last3.length;
  const prev3Avg = prev3.length > 0 ? prev3.reduce((a, b) => a + b, 0) / prev3.length : last3Avg;
  const improving = last3Avg <= prev3Avg;

  const lineColor = improving ? colors.severityPolish : colors.primary;
  const endPoint = coords[coords.length - 1];

  return (
    <Animated.View entering={FadeIn.duration(500)} style={{ width, height }}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={lineColor} stopOpacity="0.25" />
            <Stop offset="1" stopColor={lineColor} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Polygon points={polygonPoints} fill="url(#sparkFill)" />
        <Polyline
          points={polylinePoints}
          fill="none"
          stroke={lineColor}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Circle cx={endPoint.x} cy={endPoint.y} r={3.5} fill={lineColor} />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: alpha(colors.white, 0.3),
  },
});
