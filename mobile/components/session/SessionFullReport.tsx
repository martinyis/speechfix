import { Fragment, useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import {
  colors,
  alpha,
  fonts,
  spacing,
  layout,
  typography,
} from '../../theme';
import type {
  Correction,
  FillerWordPosition,
  SessionDetail,
  SessionInsight,
  UtteranceMetadata,
} from '../../types/session';

const RAIL_X = 24;
const RAIL_MARKER_SIZE = 14;
const CONTENT_LEFT_OFFSET = RAIL_X + 38;

interface Props {
  session: SessionDetail;
  initialExpanded?: boolean;
}

export function SessionFullReport({
  session,
  initialExpanded = false,
}: Props) {
  const [expanded, setExpanded] = useState(initialExpanded);
  const rotation = useSharedValue(initialExpanded ? 180 : 0);

  const caretStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const toggle = () => {
    Haptics.selectionAsync();
    const next = !expanded;
    setExpanded(next);
    rotation.value = withTiming(next ? 180 : 0, {
      duration: 300,
      easing: Easing.out(Easing.cubic),
    });
  };

  const timeline = session.speechTimeline;
  const patterns = session.sessionInsights.filter(i =>
    ['hedging_pattern', 'discourse_pattern', 'repetitive_word'].includes(i.type),
  );
  const strengths = session.sessionInsights.filter(i => i.type === 'strength');
  const focus = session.sessionInsights.filter(i => i.type === 'focus_area');

  const perSentence = useMemo(() => {
    const fillersBy = new Map<number, FillerWordPosition[]>();
    for (const f of session.fillerPositions) {
      const list = fillersBy.get(f.sentenceIndex) ?? [];
      list.push(f);
      fillersBy.set(f.sentenceIndex, list);
    }
    const correctionsBy = new Map<number, Correction[]>();
    for (const c of session.corrections) {
      const list = correctionsBy.get(c.sentenceIndex) ?? [];
      list.push(c);
      correctionsBy.set(c.sentenceIndex, list);
    }
    return session.sentences.map((sentence, i) =>
      buildChunks(
        sentence,
        fillersBy.get(i) ?? [],
        correctionsBy.get(i) ?? [],
      ),
    );
  }, [session.sentences, session.corrections, session.fillerPositions]);

  const utterances: UtteranceMetadata[] = timeline?.utterances ?? [];

  // Delivery metrics (only rendered if we have a speechTimeline).
  const deliveryRows = timeline
    ? ([
        { label: 'Pace', value: `${timeline.overallWpm} wpm`, dot: colors.primary },
        {
          label: 'Clarity',
          value: `${Math.round(timeline.avgConfidence * 100)}%`,
          dot: colors.severityPolish,
        },
        {
          label: 'Steadiness',
          value: `${Math.round(timeline.volumeConsistency * 100)}%`,
          dot: colors.secondary,
        },
        {
          label: 'Pauses',
          value: `${timeline.totalPauses} · avg ${Math.round(
            timeline.avgPauseDurationMs,
          )}ms · longest ${Math.round(timeline.longestPauseMs)}ms`,
          dot: colors.severityImprovement,
        },
        {
          label: 'Expression',
          value: `${timeline.pitchAssessment} · ${Math.round(
            timeline.pitchVariation * 100,
          )}%`,
          dot: colors.tertiary,
        },
      ] as const)
    : [];

  const sfItems: { accent: string; kicker: string; body: string }[] = [
    ...strengths.map(s => ({
      accent: colors.severityPolish,
      kicker: 'Strength',
      body: s.description,
    })),
    ...focus.map(f => ({
      accent: colors.severityImprovement,
      kicker: 'Focus',
      body: f.description,
    })),
  ];

  return (
    <Animated.View style={styles.container} layout={LinearTransition.duration(280)}>
      <Pressable onPress={toggle} style={styles.header} hitSlop={8}>
        <Text style={styles.headerText}>
          {expanded ? 'Hide full report' : 'See full report'}
        </Text>
        <Animated.View style={caretStyle}>
          <Ionicons
            name="chevron-down"
            size={18}
            color={alpha(colors.white, 0.5)}
          />
        </Animated.View>
      </Pressable>

      {expanded && (
        <Animated.View
          entering={FadeIn.duration(260)}
          exiting={FadeOut.duration(180)}
          style={styles.expandedRoot}
        >
          <View pointerEvents="none" style={styles.rail} />

          {/* Chapter 01: DELIVERY */}
          {timeline && (
            <Reveal>
              <View style={styles.chapter}>
                <RailMarker accent={colors.primary} />
                <View style={styles.chapterContent}>
                  <Text style={[styles.chapterKicker, { color: colors.primary }]}>
                    Delivery · Chapter 01
                  </Text>
                  <View style={styles.metricRows}>
                    {deliveryRows.map(r => (
                      <View key={r.label} style={styles.metricRow}>
                        <View
                          style={[styles.metricRowDot, { backgroundColor: r.dot }]}
                        />
                        <Text style={styles.metricRowLabel}>{r.label}</Text>
                        <Text style={styles.metricRowValue}>{r.value}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            </Reveal>
          )}

          {patterns.length > 0 && (
            <>
              <View style={styles.gap} />
              <Reveal>
                <View style={styles.chapter}>
                  <RailMarker accent={colors.primary} />
                  <View style={styles.chapterContent}>
                    <Text style={[styles.chapterKicker, { color: colors.primary }]}>
                      Patterns · Chapter 02
                    </Text>
                    <Text style={styles.chapterTitle}>What kept repeating</Text>
                  </View>
                </View>
              </Reveal>
              {patterns.map((p, idx) => (
                <Reveal key={`pat-${idx}`}>
                  <View style={styles.chapter}>
                    <RailMarker accent={colors.primary} />
                    <View style={styles.chapterContent}>
                      <Text
                        style={[
                          styles.itemKicker,
                          { color: alpha(colors.primary, 0.9) },
                        ]}
                      >
                        {patternCategory(p.type)}
                      </Text>
                      <Text style={styles.itemHeadline}>
                        {patternHeadline(p.type)}
                      </Text>
                      <Text style={styles.itemBody}>{p.description}</Text>
                    </View>
                  </View>
                </Reveal>
              ))}
            </>
          )}

          {sfItems.length > 0 && (
            <>
              <View style={styles.gap} />
              <Reveal>
                <View style={styles.chapter}>
                  <RailMarker accent={colors.severityPolish} />
                  <View style={styles.chapterContent}>
                    <Text
                      style={[
                        styles.chapterKicker,
                        { color: colors.severityPolish },
                      ]}
                    >
                      Strengths & Focus · Chapter 03
                    </Text>
                    <Text style={styles.chapterTitle}>
                      What worked, what to sharpen
                    </Text>
                  </View>
                </View>
              </Reveal>
              {sfItems.map((item, idx) => (
                <Reveal key={`sf-${idx}`}>
                  <View style={styles.chapter}>
                    <RailMarker accent={item.accent} />
                    <View style={styles.chapterContent}>
                      <Text
                        style={[
                          styles.itemKicker,
                          { color: alpha(item.accent, 0.95) },
                        ]}
                      >
                        {item.kicker}
                      </Text>
                      <Text style={styles.itemBody}>{item.body}</Text>
                    </View>
                  </View>
                </Reveal>
              ))}
            </>
          )}

          {session.sentences.length > 0 && (
            <>
              <View style={styles.gap} />
              <Reveal>
                <View style={styles.chapter}>
                  <RailMarker accent={colors.secondary} />
                  <View style={styles.chapterContent}>
                    <Text style={[styles.chapterKicker, { color: colors.secondary }]}>
                      Transcript · Chapter 04
                    </Text>
                    <Text style={styles.chapterTitle}>Every word in order</Text>
                  </View>
                </View>
              </Reveal>
              {perSentence.map((chunks, i) => {
                const utter = utterances[i];
                const kicker = utter
                  ? `Turn ${i + 1} · ${formatMmSs(utter.startTime)} – ${formatMmSs(
                      utter.endTime,
                    )} · ${Math.round(utter.wpm)} wpm`
                  : `Turn ${i + 1}`;

                return (
                  <Reveal key={`turn-${i}`}>
                    <View style={styles.chapter}>
                      <RailMarker accent={colors.secondary} number={i + 1} />
                      <View style={styles.chapterContent}>
                        <Text
                          style={[
                            styles.itemKicker,
                            { color: alpha(colors.secondary, 0.85) },
                          ]}
                        >
                          {kicker}
                        </Text>
                        <Text style={styles.transcriptSentence}>
                          {chunks.map((chunk, j) => {
                            if (chunk.kind === 'filler') {
                              return (
                                <Text key={j} style={styles.transcriptFiller}>
                                  {chunk.text}
                                </Text>
                              );
                            }
                            if (chunk.kind === 'correction') {
                              return (
                                <Text
                                  key={j}
                                  style={[
                                    styles.transcriptCorrection,
                                    {
                                      color: alpha(chunk.color, 0.95),
                                      textDecorationColor: alpha(chunk.color, 0.7),
                                    },
                                  ]}
                                >
                                  {chunk.text}
                                </Text>
                              );
                            }
                            return <Fragment key={j}>{chunk.text}</Fragment>;
                          })}
                        </Text>
                      </View>
                    </View>
                  </Reveal>
                );
              })}
            </>
          )}
        </Animated.View>
      )}
    </Animated.View>
  );
}

function Reveal({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

// ── Rail marker (circle / numbered circle) ──────────────────────────────

function RailMarker({
  accent,
  number,
  top = 0,
}: {
  accent: string;
  number?: number;
  top?: number;
}) {
  return (
    <View
      style={[
        styles.railMarker,
        {
          backgroundColor: number != null ? alpha(accent, 0.18) : accent,
          borderColor: accent,
          top,
        },
      ]}
    >
      {number != null && (
        <Text style={[styles.railNumber, { color: accent }]}>{number}</Text>
      )}
    </View>
  );
}

// ── Transcript chunking ─────────────────────────────────────────────────

type Chunk =
  | { kind: 'plain'; text: string }
  | { kind: 'filler'; text: string }
  | { kind: 'correction'; text: string; color: string };

function buildChunks(
  sentence: string,
  fillers: FillerWordPosition[],
  corrections: Correction[],
): Chunk[] {
  type Range = {
    start: number;
    end: number;
    kind: 'filler' | 'correction';
    color?: string;
  };

  const ranges: Range[] = [];
  for (const c of corrections) {
    if (!c.originalText) continue;
    const idx = sentence.indexOf(c.originalText);
    if (idx < 0) continue;
    ranges.push({
      start: idx,
      end: idx + c.originalText.length,
      kind: 'correction',
      color: severityColor(c.severity),
    });
  }
  for (const f of fillers) {
    const start = f.startIndex;
    const end = start + f.word.length;
    const overlaps = ranges.some(r => !(end <= r.start || start >= r.end));
    if (overlaps) continue;
    ranges.push({ start, end, kind: 'filler' });
  }
  ranges.sort((a, b) => a.start - b.start);
  const clean: Range[] = [];
  let lastEnd = 0;
  for (const r of ranges) {
    if (r.start < lastEnd) continue;
    clean.push(r);
    lastEnd = r.end;
  }
  const chunks: Chunk[] = [];
  let cursor = 0;
  for (const r of clean) {
    if (r.start > cursor) {
      chunks.push({ kind: 'plain', text: sentence.slice(cursor, r.start) });
    }
    const text = sentence.slice(r.start, r.end);
    if (r.kind === 'filler') {
      chunks.push({ kind: 'filler', text });
    } else {
      chunks.push({ kind: 'correction', text, color: r.color! });
    }
    cursor = r.end;
  }
  if (cursor < sentence.length) {
    chunks.push({ kind: 'plain', text: sentence.slice(cursor) });
  }
  return chunks;
}

function severityColor(sev: Correction['severity']): string {
  if (sev === 'error') return colors.severityError;
  if (sev === 'improvement') return colors.severityImprovement;
  return colors.severityPolish;
}

function patternCategory(type: SessionInsight['type']): string {
  if (type === 'hedging_pattern') return 'Hedging';
  if (type === 'discourse_pattern') return 'Discourse Marker';
  if (type === 'repetitive_word') return 'Repetition';
  return 'Pattern';
}
function patternHeadline(type: SessionInsight['type']): string {
  if (type === 'hedging_pattern') return 'Softened claims';
  if (type === 'discourse_pattern') return 'Repeated openings';
  if (type === 'repetitive_word') return 'Repeated word';
  return 'Pattern noticed';
}

function formatMmSs(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ── Styles ──────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.screenPadding,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: alpha(colors.white, 0.06),
  },
  headerText: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: alpha(colors.white, 0.55),
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  // Expanded container — full width, so the rail can sit 24px from the
  // screen edge and chapter rows can apply their own trailing padding.
  expandedRoot: {
    paddingTop: spacing.md,
  },

  gap: {
    height: spacing.xxxl,
  },

  rail: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: RAIL_X,
    width: StyleSheet.hairlineWidth,
    backgroundColor: alpha(colors.white, 0.08),
    zIndex: 1,
  },

  chapter: {
    flexDirection: 'row',
    paddingLeft: 0,
    paddingRight: layout.screenPadding,
    marginBottom: spacing.lg,
  },
  railMarker: {
    width: RAIL_MARKER_SIZE,
    height: RAIL_MARKER_SIZE,
    borderRadius: RAIL_MARKER_SIZE / 2,
    borderWidth: 1.5,
    position: 'absolute',
    left: RAIL_X - RAIL_MARKER_SIZE / 2,
    top: 6,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  railNumber: {
    fontSize: 8,
    fontFamily: fonts.bold,
    letterSpacing: 0.5,
  },
  chapterContent: {
    flex: 1,
    paddingLeft: CONTENT_LEFT_OFFSET - RAIL_X,
  },

  chapterKicker: {
    ...typography.labelSm,
    marginBottom: spacing.xs,
  },
  chapterTitle: {
    ...typography.headlineMd,
    color: colors.white,
  },

  itemKicker: {
    ...typography.labelSm,
    marginBottom: spacing.xs,
  },
  itemHeadline: {
    ...typography.headlineSm,
    color: colors.white,
    marginBottom: spacing.sm,
  },
  itemBody: {
    ...typography.bodyMd,
    color: alpha(colors.white, 0.75),
    lineHeight: 22,
  },

  metricRows: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  metricRowDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  metricRowLabel: {
    ...typography.labelMd,
    color: alpha(colors.white, 0.55),
    width: 110,
  },
  metricRowValue: {
    flex: 1,
    ...typography.bodyMdMedium,
    color: colors.white,
  },

  transcriptSentence: {
    ...typography.bodyMd,
    color: alpha(colors.white, 0.85),
    lineHeight: 24,
    marginTop: spacing.sm,
  },
  transcriptFiller: {
    color: alpha(colors.tertiary, 0.7),
    fontStyle: 'italic',
  },
  transcriptCorrection: {
    textDecorationLine: 'underline',
    textDecorationStyle: 'solid',
  },
});
