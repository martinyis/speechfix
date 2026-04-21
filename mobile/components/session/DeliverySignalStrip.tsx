import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Svg, { Rect, Path } from 'react-native-svg';
import { colors, alpha, fonts, typography } from '../../theme';
import type { SpeechTimeline } from '../../types/session';

interface Props {
  timeline: SpeechTimeline;
  animate?: boolean;
}

export function DeliverySignalStrip({ timeline, animate }: Props) {
  const clarity = Math.round(timeline.avgConfidence * 100);
  const steadiness = Math.round(timeline.volumeConsistency * 100);

  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>DELIVERY</Text>

      <AnimatedRow delay={0} animate={animate}>
        <PaceRow wpm={timeline.overallWpm} variability={timeline.paceVariability} />
      </AnimatedRow>

      <AnimatedRow delay={50} animate={animate}>
        <BarRow label="Clarity" value={`${clarity}%`} percent={clarity} color={barColor(clarity)} />
      </AnimatedRow>

      <AnimatedRow delay={100} animate={animate}>
        <BarRow label="Steadiness" value={`${steadiness}%`} percent={steadiness} color={barColor(steadiness)} />
      </AnimatedRow>

      <AnimatedRow delay={150} animate={animate}>
        <PauseRow
          count={timeline.totalPauses}
          avgMs={timeline.avgPauseDurationMs}
          longestMs={timeline.longestPauseMs}
          utteranceCount={timeline.utterances.length}
        />
      </AnimatedRow>

      <AnimatedRow delay={200} animate={animate}>
        <ExpressivenessRow assessment={timeline.pitchAssessment} variation={timeline.pitchVariation} />
      </AnimatedRow>
    </View>
  );
}

function AnimatedRow({ children, delay, animate }: { children: React.ReactNode; delay: number; animate?: boolean }) {
  if (!animate) return <>{children}</>;
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(300)}>
      {children}
    </Animated.View>
  );
}

// -- Pace row with colored bar --
function PaceRow({ wpm, variability }: { wpm: number; variability: number }) {
  const color = wpm < 100 ? colors.secondary : wpm > 180 ? colors.error : colors.severityPolish;
  const label = variability > 0.3 ? 'variable' : 'steady';
  const percent = Math.min(100, Math.max(0, ((wpm - 50) / 200) * 100));

  return (
    <View style={styles.row}>
      <Text style={styles.label}>Pace</Text>
      <Text style={styles.value}>{wpm} <Text style={styles.unit}>wpm</Text></Text>
      <View style={styles.barContainer}>
        <MiniBar percent={percent} color={color} />
      </View>
      <Text style={styles.annotation}>{label}</Text>
    </View>
  );
}

// -- Generic bar row --
function BarRow({ label, value, percent, color }: { label: string; value: string; percent: number; color: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
      <View style={styles.barContainer}>
        <MiniBar percent={percent} color={color} />
      </View>
    </View>
  );
}

// -- Pause row with dot pattern --
function PauseRow({ count, avgMs, longestMs, utteranceCount }: { count: number; avgMs: number; longestMs: number; utteranceCount: number }) {
  const avgSec = (avgMs / 1000).toFixed(1);
  return (
    <View style={styles.row}>
      <Text style={styles.label}>Pauses</Text>
      <Text style={styles.value}>{count} <Text style={styles.unit}>avg {avgSec}s</Text></Text>
      <View style={styles.barContainer}>
        <PauseDots count={Math.min(count, 12)} maxCount={Math.max(utteranceCount, 1)} />
      </View>
    </View>
  );
}

// -- Expressiveness row with mini wave --
function ExpressivenessRow({ assessment, variation }: { assessment: SpeechTimeline['pitchAssessment']; variation: number }) {
  const labelMap = { monotone: 'Monotone', limited: 'Limited', varied: 'Varied', expressive: 'Expressive' };
  const colorMap = {
    monotone: colors.error,
    limited: alpha(colors.white, 0.5),
    varied: colors.secondary,
    expressive: colors.severityPolish,
  };

  return (
    <View style={styles.row}>
      <Text style={styles.label}>Expression</Text>
      <Text style={[styles.value, { color: colorMap[assessment] }]}>{labelMap[assessment]}</Text>
      <View style={styles.barContainer}>
        <PitchWave assessment={assessment} />
      </View>
    </View>
  );
}

// -- SVG micro-visualizations --

function MiniBar({ percent, color }: { percent: number; color: string }) {
  const width = 80;
  const height = 6;
  const fill = Math.max(2, (percent / 100) * width);

  return (
    <Svg width={width} height={height}>
      <Rect x={0} y={0} width={width} height={height} rx={3} fill={alpha(colors.white, 0.06)} />
      <Rect x={0} y={0} width={fill} height={height} rx={3} fill={color} />
    </Svg>
  );
}

function PauseDots({ count, maxCount }: { count: number; maxCount: number }) {
  const width = 80;
  const height = 10;
  const dotR = 2.5;
  const spacing = Math.min(10, width / Math.max(count, 1));

  return (
    <Svg width={width} height={height}>
      {Array.from({ length: count }, (_, i) => (
        <Rect
          key={i}
          x={i * spacing + 1}
          y={height / 2 - dotR}
          width={dotR * 2}
          height={dotR * 2}
          rx={dotR}
          fill={alpha(colors.primary, 0.5)}
        />
      ))}
    </Svg>
  );
}

function PitchWave({ assessment }: { assessment: SpeechTimeline['pitchAssessment'] }) {
  const width = 80;
  const height = 14;
  const mid = height / 2;

  // Generate wave path based on assessment
  const amplitude = { monotone: 1, limited: 2.5, varied: 4, expressive: 6 }[assessment];
  const freq = { monotone: 0.05, limited: 0.1, varied: 0.15, expressive: 0.2 }[assessment];
  const color = {
    monotone: alpha(colors.white, 0.15),
    limited: alpha(colors.white, 0.3),
    varied: alpha(colors.secondary, 0.6),
    expressive: alpha(colors.severityPolish, 0.6),
  }[assessment];

  let d = `M 0 ${mid}`;
  for (let x = 1; x <= width; x++) {
    const y = mid + Math.sin(x * freq) * amplitude;
    d += ` L ${x} ${y.toFixed(1)}`;
  }

  return (
    <Svg width={width} height={height}>
      <Path d={d} stroke={color} strokeWidth={1.5} fill="none" />
    </Svg>
  );
}

function barColor(percent: number): string {
  if (percent >= 85) return colors.severityPolish;
  if (percent >= 60) return colors.secondary;
  return colors.error;
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
    gap: 2,
  },
  sectionLabel: {
    ...typography.labelSm,
    color: alpha(colors.white, 0.3),
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 8,
  },
  label: {
    width: 80,
    fontSize: 13,
    fontFamily: fonts.medium,
    color: alpha(colors.white, 0.45),
  },
  value: {
    width: 72,
    fontSize: 14,
    fontFamily: fonts.semibold,
    color: colors.white,
  },
  unit: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: alpha(colors.white, 0.35),
  },
  barContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  annotation: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: alpha(colors.white, 0.3),
  },
});
