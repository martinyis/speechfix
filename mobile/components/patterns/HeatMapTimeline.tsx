import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { colors, alpha, typography, fonts } from '../../theme';
import type { HeatMapDay } from './mockData';

interface HeatMapTimelineProps {
  data: HeatMapDay[];
  accentColor?: string;
}

const CELL_SIZE = 28;
const CELL_GAP = 3;
const CELL_RADIUS = 6;

function HeatMapTimelineInner({
  data,
  accentColor = colors.primary,
}: HeatMapTimelineProps) {
  // Group into weeks (7 days per week)
  const weeks: HeatMapDay[][] = [];
  for (let i = 0; i < data.length; i += 7) {
    weeks.push(data.slice(i, i + 7));
  }

  const weekLabels = ['4w ago', '3w ago', '2w ago', 'This week'];

  return (
    <View style={styles.container}>
      {/* Week labels */}
      <View style={styles.labelRow}>
        {weekLabels.map((label, i) => (
          <Text key={i} style={[styles.weekLabel, { width: 7 * (CELL_SIZE + CELL_GAP) - CELL_GAP }]}>
            {label}
          </Text>
        ))}
      </View>

      {/* Cells */}
      <View style={styles.cellRow}>
        {data.map((day, i) => (
          <AnimatedCell
            key={day.date}
            index={i}
            intensity={day.intensity}
            accentColor={accentColor}
          />
        ))}
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <Text style={styles.legendText}>Less</Text>
        {[0, 0.25, 0.5, 0.75, 1].map((intensity) => (
          <View
            key={intensity}
            style={[
              styles.legendCell,
              {
                backgroundColor:
                  intensity === 0
                    ? alpha(colors.white, 0.06)
                    : alpha(accentColor, intensity * 0.5 + 0.05),
              },
            ]}
          />
        ))}
        <Text style={styles.legendText}>More</Text>
      </View>
    </View>
  );
}

interface AnimatedCellProps {
  index: number;
  intensity: number;
  accentColor: string;
}

function AnimatedCellInner({ index, intensity, accentColor }: AnimatedCellProps) {
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(
      index * 15,
      withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) }),
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const bgColor =
    intensity === 0
      ? alpha(colors.white, 0.06)
      : alpha(accentColor, intensity * 0.5 + 0.05);

  return (
    <Animated.View
      style={[
        styles.cell,
        { backgroundColor: bgColor },
        animatedStyle,
      ]}
    />
  );
}

const AnimatedCell = React.memo(AnimatedCellInner);

export const HeatMapTimeline = React.memo(HeatMapTimelineInner);

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  labelRow: {
    flexDirection: 'row',
    gap: 0,
  },
  weekLabel: {
    ...typography.labelSm,
    color: alpha(colors.white, 0.25),
    fontSize: 9,
    textAlign: 'center',
  },
  cellRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CELL_GAP,
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: CELL_RADIUS,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 2,
  },
  legendText: {
    fontSize: 9,
    fontFamily: fonts.medium,
    color: alpha(colors.white, 0.25),
  },
  legendCell: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
});
