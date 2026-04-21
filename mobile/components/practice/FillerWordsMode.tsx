import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue } from 'react-native-reanimated';
import Svg, { Path, Line, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { EmptyState, GlassIconPillButton } from '../ui';
import { useFillerSummary } from '../../hooks/data/useFillerSummary';
import { useFillerCoachSessions } from '../../hooks/data/useFillerCoachSessions';
import { useSessions } from '../../hooks/data/useSessions';
import { colors, alpha, fonts, spacing, layout, typography, borderRadius } from '../../theme';
import type { FillerCoachSession, SessionListItem } from '../../types/session';

// ── Helpers ────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function fillersPerMin(totalFillers: number, durationSeconds: number): number {
  const mins = Math.max(durationSeconds / 60, 0.5);
  return Number((totalFillers / mins).toFixed(1));
}

function rateColor(rate: number): string {
  if (rate <= 1.5) return colors.severityPolish;
  if (rate <= 3.0) return colors.secondary;
  return colors.error;
}

function relativeDate(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Data helpers ──────────────────────────────────────────────────────

/** Filter sessions that have filler data, sorted oldest-first for charting */
function getSessionsWithFillers(sessions: SessionListItem[]): SessionListItem[] {
  return sessions
    .filter((s) => s.totalFillerCount != null && s.totalFillerCount > 0)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

// ── Word Hero Section ─────────────────────────────────────────────────

function WordHero({
  words,
}: {
  words: Array<{ word: string; totalCount: number }>;
}) {
  const top4 = words.slice(0, 4);
  const maxCount = top4[0]?.totalCount ?? 1;

  return (
    <View>
      <Text style={styles.sectionLabel}>TOP FILLER WORDS</Text>
      <View style={styles.wordGrid}>
        {top4.map((w, i) => {
          const scale = 0.6 + (w.totalCount / maxCount) * 0.4;
          const isTop = i === 0;
          return (
            <View key={w.word} style={[styles.wordItem, isTop && styles.wordItemTop]}>
              <Text
                style={[
                  styles.wordName,
                  {
                    fontSize: isTop ? 32 : 22 * scale + 4,
                    fontFamily: isTop ? fonts.extrabold : fonts.bold,
                    letterSpacing: isTop ? -1 : -0.5,
                  },
                ]}
              >
                {w.word}
              </Text>
              <Text style={styles.wordMetaCount}>{w.totalCount}x</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ── Rate Strip ────────────────────────────────────────────────────────

function RateStrip({
  currentRate,
  improvementPct,
}: {
  currentRate: number;
  improvementPct: number | null;
}) {
  return (
    <View style={styles.rateStrip}>
      <View style={styles.rateStripLeft}>
        <Text style={styles.rateStripLabel}>CURRENT RATE</Text>
        <View style={styles.rateRow}>
          <Text style={styles.rateValue}>{currentRate.toFixed(1)}</Text>
          <Text style={styles.rateUnit}>/min</Text>
        </View>
      </View>
      <View style={styles.rateStripDivider} />
      <View style={styles.rateStripRight}>
        <Text style={styles.rateStripLabel}>IMPROVEMENT</Text>
        <View style={styles.rateRow}>
          {improvementPct !== null && improvementPct > 0 ? (
            <>
              <Ionicons name="trending-down" size={16} color={colors.severityPolish} />
              <Text style={styles.improvementValue}>{improvementPct}%</Text>
            </>
          ) : (
            <Text style={styles.improvementNA}>—</Text>
          )}
        </View>
      </View>
    </View>
  );
}

// ── Session History Trend Chart ───────────────────────────────────────

/** Catmull-Rom → cubic-bezier smooth path through points. */
function buildSmoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}

const CHART_HEIGHT = 110;
const CHART_PAD_X = 12; // keeps endpoint glow + dot inside chart bounds
const CHART_PAD_Y = 16;

function triggerSelectionHaptic() {
  Haptics.selectionAsync();
}

const TOOLTIP_W = 60;

function TrendChart({ sessions }: { sessions: SessionListItem[] }) {
  const { width } = useWindowDimensions();
  const points = sessions.slice(-12);
  const chartW = width;
  const innerW = chartW - CHART_PAD_X * 2;
  const innerH = CHART_HEIGHT - CHART_PAD_Y * 2;

  const rates = points.map((s) => fillersPerMin(s.totalFillerCount ?? 0, s.durationSeconds));
  const maxRate = Math.max(...rates, 0.5);
  const minRate = Math.min(...rates, 0);
  const range = Math.max(maxRate - minRate, 0.5);

  const stepX = points.length > 1 ? innerW / (points.length - 1) : 0;

  const xy = rates.map((r, i) => ({
    x: CHART_PAD_X + (points.length === 1 ? innerW / 2 : i * stepX),
    y: CHART_PAD_Y + innerH - ((r - minRate) / range) * innerH,
  }));

  const linePath = buildSmoothPath(xy);
  const baseY = CHART_HEIGHT - CHART_PAD_Y / 2;
  const areaPath =
    xy.length > 1
      ? `${linePath} L ${xy[xy.length - 1].x.toFixed(2)} ${baseY} L ${xy[0].x.toFixed(2)} ${baseY} Z`
      : '';

  // Interactive focus — defaults to latest point
  const lastIdx = points.length - 1;
  const [focusedIdx, setFocusedIdx] = useState(lastIdx);
  const focusedSV = useSharedValue(lastIdx);

  // Keep focus pinned to latest when sessions change (e.g. after a new session)
  if (focusedIdx > lastIdx) {
    setFocusedIdx(lastIdx);
    focusedSV.value = lastIdx;
  }

  const focusedPoint = xy[focusedIdx] ?? xy[lastIdx];
  const focusedRate = rates[focusedIdx] ?? 0;
  const focusedDate = points[focusedIdx]?.createdAt;
  const isFocusedLatest = focusedIdx === lastIdx;

  const pan = Gesture.Pan()
    .activeOffsetX([-5, 5])
    .failOffsetY([-12, 12])
    .onBegin((e) => {
      'worklet';
      if (points.length < 2) return;
      const rel = e.x - CHART_PAD_X;
      const idx = Math.max(0, Math.min(lastIdx, Math.round(rel / stepX)));
      if (focusedSV.value !== idx) {
        focusedSV.value = idx;
        runOnJS(setFocusedIdx)(idx);
        runOnJS(triggerSelectionHaptic)();
      }
    })
    .onChange((e) => {
      'worklet';
      if (points.length < 2) return;
      const rel = e.x - CHART_PAD_X;
      const idx = Math.max(0, Math.min(lastIdx, Math.round(rel / stepX)));
      if (focusedSV.value !== idx) {
        focusedSV.value = idx;
        runOnJS(setFocusedIdx)(idx);
        runOnJS(triggerSelectionHaptic)();
      }
    });

  const tap = Gesture.Tap().onStart((e) => {
    'worklet';
    if (points.length < 2) return;
    const rel = e.x - CHART_PAD_X;
    const idx = Math.max(0, Math.min(lastIdx, Math.round(rel / stepX)));
    if (focusedSV.value !== idx) {
      focusedSV.value = idx;
      runOnJS(setFocusedIdx)(idx);
      runOnJS(triggerSelectionHaptic)();
    }
  });

  const gesture = Gesture.Simultaneous(pan, tap);

  // Tooltip horizontal placement — clamped to chart bounds
  const tooltipLeft = Math.min(
    Math.max(focusedPoint.x - TOOLTIP_W / 2, 0),
    chartW - TOOLTIP_W,
  );

  return (
    <View>
      <View style={[styles.chartHeader, { paddingHorizontal: layout.screenPadding }]}>
        <Text style={styles.miniChartLabel}>TREND · last {points.length} sessions</Text>
        {!isFocusedLatest && (
          <Pressable
            onPress={() => {
              setFocusedIdx(lastIdx);
              focusedSV.value = lastIdx;
              Haptics.selectionAsync();
            }}
            hitSlop={8}
          >
            <Text style={styles.chartReset}>Latest</Text>
          </Pressable>
        )}
      </View>

      <GestureDetector gesture={gesture}>
        <View
          style={{
            width: chartW,
            height: CHART_HEIGHT,
          }}
          collapsable={false}
        >
          <Svg width={chartW} height={CHART_HEIGHT}>
            <Defs>
              <LinearGradient id="trendArea" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={colors.primary} stopOpacity="0.45" />
                <Stop offset="1" stopColor={colors.primary} stopOpacity="0" />
              </LinearGradient>
            </Defs>

            {/* Subtle baseline */}
            <Path
              d={`M ${CHART_PAD_X} ${baseY} L ${chartW - CHART_PAD_X} ${baseY}`}
              stroke={alpha(colors.white, 0.05)}
              strokeWidth={1}
            />

            {/* Area fill */}
            {areaPath ? <Path d={areaPath} fill="url(#trendArea)" /> : null}

            {/* Line */}
            {xy.length > 1 && (
              <Path
                d={linePath}
                stroke={colors.primary}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            )}

            {/* Faint dots on every session */}
            {xy.map((p, i) =>
              i === focusedIdx ? null : (
                <Circle key={i} cx={p.x} cy={p.y} r={2.5} fill={alpha(colors.primary, 0.35)} />
              ),
            )}

            {/* Latest point marker — always shown (even when not focused) */}
            {!isFocusedLatest && xy[lastIdx] && (
              <Circle
                cx={xy[lastIdx].x}
                cy={xy[lastIdx].y}
                r={3.5}
                fill={colors.primary}
                opacity={0.7}
              />
            )}

            {/* Vertical scrub line through focused point */}
            {focusedPoint && (
              <Line
                x1={focusedPoint.x}
                x2={focusedPoint.x}
                y1={CHART_PAD_Y / 2}
                y2={baseY}
                stroke={alpha(colors.primary, 0.35)}
                strokeWidth={1}
                strokeDasharray="3,3"
              />
            )}

            {/* Glowing focused point */}
            {focusedPoint && (
              <>
                <Circle cx={focusedPoint.x} cy={focusedPoint.y} r={12} fill={colors.primary} opacity={0.18} />
                <Circle cx={focusedPoint.x} cy={focusedPoint.y} r={5.5} fill={colors.primary} />
                <Circle cx={focusedPoint.x} cy={focusedPoint.y} r={2} fill={colors.background} />
              </>
            )}
          </Svg>

          {/* Floating tooltip above focused point */}
          {focusedPoint && focusedDate && (
            <View
              pointerEvents="none"
              style={[
                styles.chartTooltip,
                {
                  left: tooltipLeft,
                  top: Math.max(focusedPoint.y - 36, 0),
                  width: TOOLTIP_W,
                },
              ]}
            >
              <Text style={styles.chartTooltipValue}>
                {focusedRate.toFixed(1)}
                <Text style={styles.chartTooltipUnit}> /min</Text>
              </Text>
              <Text style={styles.chartTooltipDate}>{formatDate(focusedDate)}</Text>
            </View>
          )}
        </View>
      </GestureDetector>

      {/* Date axis — start / end */}
      <View style={styles.chartFooter}>
        <Text style={styles.chartFooterDate}>{formatDate(points[0].createdAt)}</Text>
        {points.length > 1 && (
          <Text style={styles.chartFooterDate}>
            {formatDate(points[points.length - 1].createdAt)}
          </Text>
        )}
      </View>

      {points.length < 3 && (
        <Text style={[styles.fewSessionsNote, { paddingHorizontal: layout.screenPadding }]}>
          More sessions needed for trends
        </Text>
      )}
    </View>
  );
}

// ── Remaining Words Pills ─────────────────────────────────────────────

function RemainingWords({
  words,
}: {
  words: Array<{ word: string; totalCount: number }>;
}) {
  const remaining = words.slice(4);
  if (remaining.length === 0) return null;

  return (
    <View style={styles.remainingWords}>
      {remaining.map((w) => (
        <View key={w.word} style={styles.remainingPill}>
          <Text style={styles.remainingText}>
            "{w.word}" {w.totalCount}x
          </Text>
        </View>
      ))}
    </View>
  );
}

// ── Practice Sessions Section ─────────────────────────────────────────

function PracticeSessionsSection({
  sessions,
}: {
  sessions: FillerCoachSession[];
}) {
  const recent = sessions.slice(0, 3);

  if (sessions.length === 0) {
    return (
      <View style={styles.practiceContainer}>
        <View style={styles.practiceDivider} />
        <View style={styles.practiceHeader}>
          <View style={styles.practiceHeaderLeft}>
            <Ionicons name="mic-outline" size={14} color={colors.onSurfaceVariant} />
            <Text style={styles.practiceHeaderLabel}>PRACTICE SESSIONS</Text>
          </View>
        </View>
        <Text style={styles.practiceEmpty}>No practice sessions yet</Text>
        <Pressable
          style={styles.practiceStartBtn}
          onPress={() => router.push('/filler-coach')}
        >
          <Text style={styles.practiceStartText}>Start Practice</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.practiceContainer}>
      <View style={styles.practiceDivider} />
      <View style={styles.practiceHeader}>
        <View style={styles.practiceHeaderLeft}>
          <Ionicons name="mic-outline" size={14} color={colors.onSurfaceVariant} />
          <Text style={styles.practiceHeaderLabel}>PRACTICE SESSIONS</Text>
        </View>
        <Text style={styles.practiceCount}>{sessions.length} total</Text>
      </View>

      {recent.map((session, i) => {
        const rate = fillersPerMin(session.totalFillerCount, session.durationSeconds);
        return (
          <Pressable
            key={session.id}
            style={[styles.practiceRow, i === 0 && styles.practiceRowFirst]}
            onPress={() =>
              router.push({
                pathname: '/filler-coach-results',
                params: { fillerCoachSessionId: String(session.id) },
              })
            }
          >
            <View style={styles.practiceRowLeft}>
              <Text style={styles.practiceRowDate}>{relativeDate(session.createdAt)}</Text>
              <Text style={styles.practiceRowDuration}>{formatDuration(session.durationSeconds)}</Text>
            </View>
            <View style={styles.practiceRowRight}>
              <Text style={[styles.practiceRowRate, { color: rateColor(rate) }]}>{rate.toFixed(1)}</Text>
              <Text style={styles.practiceRowRateUnit}>/min</Text>
            </View>
          </Pressable>
        );
      })}

      <Pressable
        style={styles.viewAll}
        onPress={() => router.push('/filler-coach-sessions')}
      >
        <Text style={styles.viewAllText}>View All Sessions</Text>
        <Ionicons name="chevron-forward" size={14} color={colors.primary} />
      </Pressable>
    </View>
  );
}

// ── Main Component ─────────────────────────────────────────────────────

export function FillerWordsMode() {
  const { data: summary } = useFillerSummary();
  const { data: allSessions } = useSessions();
  const { data: coachSessions } = useFillerCoachSessions();

  const hasOrganicData = summary && summary.words.length > 0;
  const hasCoachSessions = coachSessions && coachSessions.length > 0;
  const isEmpty = !hasOrganicData && !hasCoachSessions;

  // Compute session data for bar chart + rate strip
  const sessionsWithFillers = allSessions ? getSessionsWithFillers(allSessions) : [];
  const hasBarData = sessionsWithFillers.length > 0;

  let currentRate: number | null = null;
  let improvementPct: number | null = null;

  if (hasBarData) {
    const latest = sessionsWithFillers[sessionsWithFillers.length - 1];
    currentRate = fillersPerMin(latest.totalFillerCount ?? 0, latest.durationSeconds);

    if (sessionsWithFillers.length >= 2) {
      const first = sessionsWithFillers[0];
      const firstRate = fillersPerMin(first.totalFillerCount ?? 0, first.durationSeconds);
      if (firstRate > 0) {
        improvementPct = Math.round(((firstRate - currentRate) / firstRate) * 100);
      }
    }
  }

  // ── Empty state: no data at all ──
  if (isEmpty) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContent}>
          <EmptyState
            icon="mic-outline"
            title="Filler Word Tracker"
            subtitle="Start having conversations to track your filler words and practice reducing them"
            action={{
              label: 'Start Practice',
              onPress: () => router.push('/filler-coach'),
            }}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.scrollWrapper}>
        {/* Top CTA — start a coaching session */}
        <View style={styles.padded}>
          <View style={styles.ctaWrap}>
            <GlassIconPillButton
              icon="play"
              label={hasCoachSessions ? 'Continue Coaching' : 'Start Coaching'}
              variant="primary"
              fullWidth
              onPress={() => router.push('/filler-coach')}
            />
          </View>
        </View>

        {/* Main section: organic filler data */}
        {hasOrganicData ? (
          <>
            <View style={styles.padded}>
              <WordHero words={summary!.words} />

              {currentRate !== null && (
                <RateStrip currentRate={currentRate} improvementPct={improvementPct} />
              )}
            </View>

            {/* Chart — full width, no horizontal padding */}
            {hasBarData && <TrendChart sessions={sessionsWithFillers} />}

            <View style={styles.padded}>
              <RemainingWords words={summary!.words} />
            </View>
          </>
        ) : (
          <View style={styles.padded}>
            <View style={styles.placeholderSection}>
              <Ionicons name="chatbubble-outline" size={28} color={alpha(colors.white, 0.2)} />
              <Text style={styles.placeholderText}>
                Have conversations to track your filler words here
              </Text>
            </View>
          </View>
        )}

        {/* Practice sessions section */}
        <View style={styles.padded}>
          <PracticeSessionsSection sessions={coachSessions ?? []} />
        </View>
      </View>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyContent: {
    flex: 1,
    justifyContent: 'center',
  },
  scrollWrapper: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  padded: {
    paddingHorizontal: layout.screenPadding,
  },

  // Top CTA
  ctaWrap: {
    marginBottom: spacing.xxl,
  },

  // Word Hero
  sectionLabel: {
    ...typography.labelMd,
    color: colors.onSurfaceVariant,
    marginBottom: spacing.lg,
  },
  wordGrid: {
    gap: spacing.lg,
    marginBottom: spacing.xxl,
  },
  wordItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  wordItemTop: {
    marginBottom: spacing.xs,
  },
  wordName: {
    color: colors.onSurface,
  },
  wordMetaCount: {
    ...typography.bodyMdMedium,
    color: alpha(colors.white, 0.4),
  },

  // Rate strip
  rateStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: alpha(colors.white, 0.06),
    borderBottomWidth: 1,
    borderBottomColor: alpha(colors.white, 0.06),
    paddingVertical: spacing.lg,
    marginBottom: spacing.xl,
  },
  rateStripLeft: {
    flex: 1,
  },
  rateStripDivider: {
    width: 1,
    height: 36,
    backgroundColor: alpha(colors.white, 0.08),
    marginHorizontal: spacing.xl,
  },
  rateStripRight: {
    flex: 1,
  },
  rateStripLabel: {
    ...typography.labelSm,
    color: alpha(colors.white, 0.35),
    marginBottom: spacing.xs,
  },
  rateRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
  },
  rateValue: {
    ...typography.headlineMd,
    color: colors.onSurface,
  },
  rateUnit: {
    ...typography.bodySm,
    color: alpha(colors.white, 0.35),
  },
  improvementValue: {
    ...typography.headlineMd,
    color: colors.severityPolish,
  },
  improvementNA: {
    ...typography.headlineMd,
    color: alpha(colors.white, 0.2),
  },

  // Trend chart
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  miniChartLabel: {
    ...typography.labelSm,
    color: alpha(colors.white, 0.35),
  },
  chartFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    marginTop: -spacing.xs,
    marginBottom: spacing.lg,
  },
  chartFooterDate: {
    ...typography.bodySm,
    fontSize: 10,
    color: alpha(colors.white, 0.3),
    letterSpacing: 0.3,
  },
  chartReset: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    color: colors.primary,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  chartTooltip: {
    position: 'absolute',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
    backgroundColor: alpha(colors.primary, 0.18),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: alpha(colors.primary, 0.3),
    alignItems: 'center',
  },
  chartTooltipValue: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.primary,
    letterSpacing: 0.1,
    lineHeight: 12,
  },
  chartTooltipUnit: {
    fontFamily: fonts.medium,
    fontSize: 8,
    color: alpha(colors.primary, 0.7),
  },
  chartTooltipDate: {
    fontFamily: fonts.medium,
    fontSize: 8,
    color: alpha(colors.white, 0.5),
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  fewSessionsNote: {
    ...typography.bodySm,
    color: alpha(colors.white, 0.25),
    textAlign: 'center',
    marginBottom: spacing.md,
  },

  // Remaining words
  remainingWords: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  remainingPill: {
    backgroundColor: alpha(colors.white, 0.05),
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  remainingText: {
    ...typography.bodySm,
    color: alpha(colors.white, 0.4),
    fontSize: 11,
  },

  // Placeholder (no organic data)
  placeholderSection: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
    gap: spacing.md,
  },
  placeholderText: {
    ...typography.bodyMd,
    color: alpha(colors.white, 0.3),
    textAlign: 'center',
  },

  // Practice sessions
  practiceContainer: {
    marginTop: spacing.xxl,
    paddingTop: spacing.xl,
  },
  practiceDivider: {
    height: 1,
    backgroundColor: alpha(colors.white, 0.06),
    marginBottom: spacing.xl,
  },
  practiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  practiceHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  practiceHeaderLabel: {
    ...typography.labelMd,
    color: colors.onSurfaceVariant,
  },
  practiceCount: {
    ...typography.bodySm,
    color: alpha(colors.white, 0.35),
  },
  practiceEmpty: {
    ...typography.bodyMd,
    color: alpha(colors.white, 0.3),
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  practiceStartBtn: {
    alignSelf: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  practiceStartText: {
    ...typography.bodyMdMedium,
    color: colors.primary,
  },
  practiceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: alpha(colors.white, 0.04),
  },
  practiceRowFirst: {
    borderTopWidth: 0,
  },
  practiceRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  practiceRowDate: {
    ...typography.bodyMdMedium,
    color: colors.onSurface,
    width: 80,
  },
  practiceRowDuration: {
    ...typography.bodySm,
    color: alpha(colors.white, 0.4),
  },
  practiceRowRight: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  practiceRowRate: {
    ...typography.bodyMdMedium,
  },
  practiceRowRateUnit: {
    ...typography.bodySm,
    color: alpha(colors.white, 0.35),
    marginLeft: 2,
  },
  viewAll: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
  },
  viewAllText: {
    ...typography.bodyMdMedium,
    color: colors.primary,
  },
});
