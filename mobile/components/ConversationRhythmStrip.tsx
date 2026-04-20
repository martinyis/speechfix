import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Dimensions } from 'react-native';
import Animated, { FadeIn, FadeOut, FadeInDown } from 'react-native-reanimated';
import Svg, { Rect } from 'react-native-svg';
import { colors, alpha, fonts, typography } from '../theme';
import type { SpeechTimeline, UtteranceMetadata } from '../types/session';

interface ConversationTurn {
  role: 'user' | 'assistant';
  startTime: number;
  endTime: number;
  durationMs: number;
}

interface Props {
  timeline: SpeechTimeline;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  animate?: boolean;
}

export function ConversationRhythmStrip({ timeline, animate }: Props) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const utterances = timeline.utterances;

  if (utterances.length === 0) return null;

  // Compute total time span for proportional widths
  const firstStart = utterances[0].startTime;
  const lastEnd = utterances[utterances.length - 1].endTime;
  const totalSpan = Math.max(lastEnd - firstStart, 1);

  const screenWidth = Dimensions.get('window').width - 40; // padding
  const minBlockWidth = 16;
  const maxBlockWidth = 120;
  const blockHeight = 50;
  const gapMinWidth = 4;

  const handleTap = useCallback((idx: number) => {
    setSelectedIdx(prev => prev === idx ? null : idx);
  }, []);

  const selectedUtterance = selectedIdx !== null ? utterances[selectedIdx] : null;

  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>SESSION RHYTHM</Text>

      <Animated.View entering={animate ? FadeInDown.delay(250).duration(300) : undefined}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {utterances.map((utt, idx) => {
            // Gap before this utterance (pause from previous)
            const gapSec = idx > 0 ? utt.startTime - utterances[idx - 1].endTime : 0;
            const gapWidth = gapSec > 0
              ? Math.max(gapMinWidth, Math.min(40, (gapSec / totalSpan) * screenWidth * 3))
              : 0;

            // Block width proportional to duration
            const durationSec = utt.durationMs / 1000;
            const rawWidth = (durationSec / totalSpan) * screenWidth * 3;
            const blockWidth = Math.max(minBlockWidth, Math.min(maxBlockWidth, rawWidth));

            // Height proportional to WPM (taller = faster)
            const wpmNorm = Math.min(1, Math.max(0.3, (utt.wpm - 60) / 180));
            const height = Math.round(20 + wpmNorm * (blockHeight - 20));

            // Color based on clarity
            const clarityPct = utt.avgConfidence;
            const blockColor = clarityPct >= 0.90
              ? colors.severityPolish
              : clarityPct >= 0.75
                ? colors.secondary
                : colors.error;
            const opacity = 0.4 + clarityPct * 0.5;

            const isSelected = selectedIdx === idx;

            return (
              <View key={idx} style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
                {gapWidth > 0 && (
                  <View style={[styles.gap, { width: gapWidth }]}>
                    <View style={styles.gapLine} />
                  </View>
                )}
                <Pressable onPress={() => handleTap(idx)}>
                  <View style={[
                    styles.block,
                    {
                      width: blockWidth,
                      height,
                      backgroundColor: alpha(blockColor, opacity),
                      borderColor: isSelected ? colors.white : 'transparent',
                      borderWidth: isSelected ? 1 : 0,
                    },
                  ]} />
                </Pressable>
              </View>
            );
          })}
        </ScrollView>

        {/* Popover for selected utterance */}
        {selectedUtterance && selectedIdx !== null && (
          <Animated.View
            style={styles.popover}
            entering={FadeIn.duration(150)}
            exiting={FadeOut.duration(100)}
          >
            <View style={styles.popoverRow}>
              <Text style={styles.popoverTime}>
                {formatTimestamp(selectedUtterance.startTime)}
              </Text>
              <Text style={styles.popoverStat}>{selectedUtterance.wpm} wpm</Text>
              <Text style={styles.popoverStat}>
                {Math.round(selectedUtterance.avgConfidence * 100)}% clarity
              </Text>
            </View>

            {selectedUtterance.responseLatencyMs > 0 && (
              <Text style={styles.popoverDetail}>
                {(selectedUtterance.responseLatencyMs / 1000).toFixed(1)}s response delay
              </Text>
            )}

            {selectedUtterance.lowConfidenceWords.length > 0 && (
              <Text style={styles.popoverDetail}>
                Unclear: {selectedUtterance.lowConfidenceWords.slice(0, 3).join(', ')}
              </Text>
            )}

            <Text style={styles.popoverText} numberOfLines={2}>
              {selectedUtterance.text.slice(0, 80)}{selectedUtterance.text.length > 80 ? '...' : ''}
            </Text>
          </Animated.View>
        )}
      </Animated.View>
    </View>
  );
}

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sectionLabel: {
    ...typography.labelSm,
    color: alpha(colors.white, 0.3),
    marginBottom: 12,
  },
  scrollContent: {
    alignItems: 'flex-end',
    paddingVertical: 4,
    minHeight: 60,
  },
  gap: {
    justifyContent: 'flex-end',
    alignItems: 'center',
    height: 50,
  },
  gapLine: {
    width: 1,
    height: 8,
    backgroundColor: alpha(colors.white, 0.08),
    marginBottom: 4,
  },
  block: {
    borderRadius: 4,
    minWidth: 12,
  },
  popover: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: alpha(colors.white, 0.06),
    borderRadius: 8,
    gap: 4,
  },
  popoverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  popoverTime: {
    fontSize: 12,
    fontFamily: fonts.semibold,
    color: colors.primary,
  },
  popoverStat: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: alpha(colors.white, 0.6),
  },
  popoverDetail: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: alpha(colors.white, 0.4),
  },
  popoverText: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: alpha(colors.white, 0.5),
    marginTop: 2,
  },
});
