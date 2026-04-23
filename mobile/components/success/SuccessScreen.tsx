import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { ScreenHeader, GlassIconPillButton } from '../ui';
import {
  colors,
  alpha,
  spacing,
  fonts,
  layout,
  typography,
  borderRadius,
} from '../../theme';
import PulseRings from './PulseRings';

type IoniconName = keyof typeof Ionicons.glyphMap;

export type SuccessTone = 'neutral' | 'victorious' | 'calm' | 'polish';

export interface SuccessStat {
  label: string;
  value: string | number;
}

export interface SuccessHeroMetric {
  value: string | number;
  unit?: string;
  /** Override the accent color for the mega numeral (e.g. filler-rate colors) */
  color?: string;
  delta?: {
    value: string | number;
    direction: 'up' | 'down';
    good: boolean;
    /** Caption after the delta, e.g. "/min vs last" */
    caption?: string;
  };
}

export interface SuccessBreakdownItem {
  label: string;
  value: string | number;
}

export interface SuccessAction {
  label: string;
  icon?: IoniconName;
  variant?: 'primary' | 'secondary' | 'success';
  onPress: () => void;
}

export interface SuccessScreenProps {
  // Content
  eyebrow?: string;
  title: string;
  subtitle?: string;
  heroMetric?: SuccessHeroMetric;
  stats?: SuccessStat[];
  breakdown?: SuccessBreakdownItem[];
  milestone?: { label: string; value: string };
  /** Tone picks the accent color for the pulse + eyebrow */
  tone?: SuccessTone;
  /** Max 2 buttons */
  actions: SuccessAction[];

  // Screen chrome
  headerTitle?: string;
  onBack?: () => void;

  // Effects
  /** Run the pulse-rings entry effect (default: true) */
  pulseIntro?: boolean;
  /** Emit triple haptic synced to pulse (default: true, ignored if pulseIntro=false) */
  withHaptic?: boolean;

  /**
   * Optional extra content rendered below the stats/breakdown/milestone block
   * and above the actions. Used by screens that need a custom metric (e.g.
   * Pressure Drill's trend strip + prompts list) without forking the screen.
   */
  children?: React.ReactNode;
}

function toneAccent(tone: SuccessTone | undefined): string {
  switch (tone) {
    case 'polish':
      return colors.severityPolish;
    case 'calm':
      return colors.secondary;
    case 'victorious':
      return colors.primary;
    case 'neutral':
    default:
      return colors.primary;
  }
}

const PULSE_SIZE = 380;

/**
 * Universal success screen for all completion moments in the app.
 *
 * Typography-forward (Arc-inspired monolith) with a signature pulse-rings
 * entry effect + triple haptic. Left-aligned layout anchored to the bottom
 * half of the screen, with actions sticky at the foot.
 *
 * Used by: weak-spot-drill, pattern-practice (L1/L2), practice-session
 * (session-complete / all-caught-up), pressure-drill-results.
 */
export default function SuccessScreen({
  eyebrow,
  title,
  subtitle,
  heroMetric,
  stats,
  breakdown,
  milestone,
  tone,
  actions,
  headerTitle,
  onBack,
  pulseIntro = true,
  withHaptic = true,
  children,
}: SuccessScreenProps) {
  const accent = toneAccent(tone);
  const metricColor = heroMetric?.color ?? colors.onSurface;

  const inlineStats = stats
    ? stats.map((s) => `${s.value} ${s.label.toLowerCase()}`).join('  ·  ')
    : null;

  return (
    <View style={styles.container}>
      <ScreenHeader
        variant="back"
        title={headerTitle ?? ''}
        onBack={onBack}
      />
      <View style={styles.body}>
        <View style={styles.hero}>
          {pulseIntro && (
            <View style={styles.pulseOverlay} pointerEvents="none">
              <PulseRings
                accent={accent}
                size={PULSE_SIZE}
                withHaptic={withHaptic}
              />
            </View>
          )}
          <View style={styles.content}>
            {eyebrow && (
              <Animated.Text
                entering={FadeIn.duration(400).delay(520)}
                style={[styles.eyebrow, { color: accent }]}
              >
                {eyebrow.toUpperCase()}
              </Animated.Text>
            )}
            {heroMetric && (
              <Animated.Text
                entering={FadeInUp.duration(600).delay(600)}
                style={[styles.megaNumber, { color: metricColor }]}
              >
                {heroMetric.value}
                {heroMetric.unit && (
                  <Text style={styles.megaUnit}>
                    {' '}
                    {heroMetric.unit.split('/')[0].trim()}
                  </Text>
                )}
              </Animated.Text>
            )}
            <Animated.Text
              entering={FadeInUp.duration(600).delay(660)}
              style={styles.title}
            >
              {title}.
            </Animated.Text>
            {subtitle && (
              <Animated.Text
                entering={FadeInUp.duration(600).delay(740)}
                style={styles.subtitle}
              >
                {subtitle}
              </Animated.Text>
            )}

            {heroMetric?.delta && (
              <Animated.View
                entering={FadeIn.duration(500).delay(820)}
                style={[
                  styles.deltaBadge,
                  {
                    backgroundColor: alpha(
                      heroMetric.delta.good ? colors.severityPolish : colors.error,
                      0.14,
                    ),
                  },
                ]}
              >
                <Ionicons
                  name={heroMetric.delta.direction === 'down' ? 'arrow-down' : 'arrow-up'}
                  size={12}
                  color={heroMetric.delta.good ? colors.severityPolish : colors.error}
                />
                <Text
                  style={[
                    styles.deltaText,
                    {
                      color: heroMetric.delta.good
                        ? colors.severityPolish
                        : colors.error,
                    },
                  ]}
                >
                  {heroMetric.delta.value}
                  {heroMetric.delta.caption ? ` ${heroMetric.delta.caption}` : ''}
                </Text>
              </Animated.View>
            )}

            {inlineStats && !heroMetric && (
              <Animated.Text
                entering={FadeIn.duration(500).delay(880)}
                style={styles.inlineStats}
              >
                {inlineStats}
              </Animated.Text>
            )}

            {/* When a hero metric is present, stats render as full rows (more
                scannable — e.g. "total fillers: 17, duration: 5:02"). */}
            {stats && heroMetric && (
              <Animated.View
                entering={FadeIn.duration(500).delay(900)}
                style={styles.statsColumn}
              >
                {stats.map((s) => (
                  <View key={s.label} style={styles.statRow}>
                    <Text style={styles.statRowLabel}>{s.label}</Text>
                    <Text style={styles.statRowValue}>{s.value}</Text>
                  </View>
                ))}
              </Animated.View>
            )}

            {breakdown && breakdown.length > 0 && (
              <Animated.View
                entering={FadeIn.duration(500).delay(940)}
                style={styles.breakdown}
              >
                <Text style={styles.breakdownLabel}>Breakdown</Text>
                <View style={styles.chipRow}>
                  {breakdown.map((b) => (
                    <View key={b.label} style={styles.chip}>
                      <Text style={styles.chipWord}>{b.label}</Text>
                      <Text style={styles.chipCount}>{b.value}</Text>
                    </View>
                  ))}
                </View>
              </Animated.View>
            )}

            {milestone && (
              <Animated.Text
                entering={FadeIn.duration(500).delay(980)}
                style={styles.milestoneInline}
              >
                {milestone.label.toLowerCase()} ·{' '}
                <Text style={{ color: accent, fontFamily: fonts.bold }}>
                  {milestone.value}
                </Text>
              </Animated.Text>
            )}

            {children}
          </View>
        </View>

        <Animated.View entering={FadeIn.duration(500).delay(1000)} style={styles.footer}>
          {actions.map((a, i) => (
            <GlassIconPillButton
              key={`${a.label}-${i}`}
              label={a.label}
              icon={a.icon}
              variant={a.variant ?? 'primary'}
              fullWidth
              onPress={a.onPress}
            />
          ))}
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  body: {
    flex: 1,
    paddingHorizontal: layout.screenPadding,
    paddingBottom: spacing.xxl,
    justifyContent: 'space-between',
  },
  hero: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: spacing.xxl,
    position: 'relative',
  },
  pulseOverlay: {
    position: 'absolute',
    left: -60,
    bottom: 100,
    width: PULSE_SIZE,
    height: PULSE_SIZE,
  },
  content: {
    gap: spacing.md,
  },
  eyebrow: {
    ...typography.labelMd,
  },
  megaNumber: {
    fontSize: 120,
    lineHeight: 132,
    fontFamily: fonts.extrabold,
    letterSpacing: -6,
    marginBottom: spacing.sm,
  },
  megaUnit: {
    fontSize: 28,
    fontFamily: fonts.medium,
    color: alpha(colors.white, 0.35),
    letterSpacing: -0.5,
  },
  title: {
    fontSize: 56,
    lineHeight: 64,
    fontFamily: fonts.extrabold,
    color: colors.onSurface,
    letterSpacing: -2.5,
  },
  subtitle: {
    fontSize: 17,
    lineHeight: 24,
    fontFamily: fonts.regular,
    color: alpha(colors.white, 0.55),
    maxWidth: 320,
    marginTop: spacing.xs,
  },
  inlineStats: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: alpha(colors.white, 0.35),
    letterSpacing: 0.2,
    marginTop: spacing.sm,
  },
  deltaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    marginTop: spacing.xs,
  },
  deltaText: {
    fontSize: 12,
    fontFamily: fonts.semibold,
  },
  statsColumn: {
    gap: 2,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: alpha(colors.white, 0.1),
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  statRowLabel: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: alpha(colors.white, 0.55),
  },
  statRowValue: {
    fontSize: 15,
    fontFamily: fonts.semibold,
    color: colors.onSurface,
  },
  breakdown: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  breakdownLabel: {
    ...typography.labelSm,
    color: alpha(colors.white, 0.4),
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: alpha(colors.white, 0.06),
    borderWidth: 1,
    borderColor: alpha(colors.white, 0.08),
  },
  chipWord: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: alpha(colors.white, 0.7),
  },
  chipCount: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  milestoneInline: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: alpha(colors.white, 0.4),
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: spacing.xs,
  },
  footer: {
    alignSelf: 'stretch',
    gap: spacing.sm,
    maxWidth: 400,
    width: '100%',
    marginHorizontal: 'auto',
    paddingBottom: spacing.md,
  },
});
