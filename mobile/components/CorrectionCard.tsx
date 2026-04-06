import { useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Easing,
} from 'react-native-reanimated';

import * as Haptics from 'expo-haptics';
import { colors, alpha, fonts, layout } from '../theme';

interface CorrectionCardProps {
  sentence: string;
  originalText: string;
  correctedText: string;
  explanation: string | null;
  correctionType: string;
  severity: 'error' | 'improvement' | 'polish';
  practiced?: boolean;
  onPractice?: () => void;
  compact?: boolean;
  flat?: boolean;
}

const SEVERITY_COLOR: Record<string, string> = {
  error: colors.severityError,
  improvement: colors.severityImprovement,
  polish: colors.severityPolish,
};

const SEVERITY_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  error: 'close-circle',
  improvement: 'arrow-up-circle',
  polish: 'sparkles',
};

const EXPAND_DURATION = 250;
const EXPAND_HEIGHT = 62;

const TIMING_CONFIG = {
  duration: EXPAND_DURATION,
  easing: Easing.out(Easing.cubic),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function trimContext(sentence: string, originalText: string, maxContext = 24) {
  const idx = sentence.toLowerCase().indexOf(originalText.toLowerCase());
  if (idx < 0) return null;

  let before = sentence.slice(Math.max(0, idx - maxContext), idx);
  let after = sentence.slice(
    idx + originalText.length,
    idx + originalText.length + maxContext,
  );

  if (idx > maxContext) before = '\u2026' + before;
  if (idx + originalText.length + maxContext < sentence.length)
    after = after + '\u2026';

  return {
    before,
    original: sentence.slice(idx, idx + originalText.length),
    after,
  };
}

type Segment =
  | { type: 'context'; text: string }
  | { type: 'original'; text: string }
  | { type: 'arrow' }
  | { type: 'replacement'; text: string };

function buildInlineSegments(
  sentence: string,
  originalText: string,
  correctedText: string,
): Segment[] {
  const ctx = trimContext(sentence, originalText);

  if (!ctx) {
    // Graceful degradation — original not found in sentence
    return [
      { type: 'original', text: originalText },
      { type: 'arrow' },
      { type: 'replacement', text: correctedText },
    ];
  }

  const segments: Segment[] = [];
  if (ctx.before) segments.push({ type: 'context', text: ctx.before });
  segments.push({ type: 'original', text: ctx.original });
  segments.push({ type: 'arrow' });
  segments.push({ type: 'replacement', text: correctedText });
  if (ctx.after) segments.push({ type: 'context', text: ctx.after });
  return segments;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CorrectionCard({
  sentence,
  originalText,
  correctedText,
  explanation,
  correctionType,
  severity,
  practiced,
  onPractice,
  compact,
  flat,
}: CorrectionCardProps) {
  const severityColor = SEVERITY_COLOR[severity] ?? colors.severityError;
  const icon = SEVERITY_ICON[severity] ?? 'close-circle';
  const hasExplanation = !!explanation;

  // Animation shared values
  const expanded = useSharedValue(0);
  const isExpanded = useRef(false);

  const segments = buildInlineSegments(sentence, originalText, correctedText);

  // --- Animated styles ---

  const expandStyle = useAnimatedStyle(() => ({
    height: interpolate(expanded.value, [0, 1], [0, EXPAND_HEIGHT]),
    opacity: interpolate(expanded.value, [0, 0.4, 1], [0, 0, 1]),
    overflow: 'hidden' as const,
  }));

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${interpolate(expanded.value, [0, 1], [0, 180])}deg` },
    ],
  }));

  // --- Handlers ---

  const toggleExpand = useCallback(() => {
    const next = !isExpanded.current;
    isExpanded.current = next;
    expanded.value = withTiming(next ? 1 : 0, TIMING_CONFIG);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [expanded]);

  // --- Render ---

  return (
    <View style={[styles.card, compact && styles.cardCompact, flat && styles.cardFlat]}>
      <View style={[styles.cardBody, compact && styles.cardBodyCompact, flat && styles.cardBodyFlat]}>
        {/* Row 1: icon + inline text + chevron */}
        <View style={styles.row1}>
          <Ionicons
            name={icon}
            size={16}
            color={severityColor}
            style={styles.severityIcon}
          />

          <Text
            style={styles.inlineText}
          >
            {segments.map((seg, i) => {
              switch (seg.type) {
                case 'context':
                  return (
                    <Text key={i} style={styles.contextText}>
                      {seg.text}
                    </Text>
                  );
                case 'original':
                  return (
                    <Text
                      key={i}
                      style={[
                        styles.originalText,
                        { backgroundColor: alpha(severityColor, 0.1) },
                      ]}
                    >
                      {seg.text}
                    </Text>
                  );
                case 'arrow':
                  return (
                    <Text key={i} style={styles.arrowText}>
                      {' -> '}
                    </Text>
                  );
                case 'replacement':
                  return (
                    <Text key={i} style={styles.replacementText}>
                      {seg.text}
                    </Text>
                  );
              }
            })}
          </Text>

          {hasExplanation && !compact ? (
            <Pressable
              onPress={toggleExpand}
              hitSlop={8}
              style={styles.chevronHit}
            >
              <Animated.View style={chevronStyle}>
                <Ionicons
                  name="chevron-down"
                  size={16}
                  color={alpha(colors.white, 0.3)}
                />
              </Animated.View>
            </Pressable>
          ) : !compact ? (
            <View style={styles.chevronSpacer} />
          ) : null}
        </View>

        {/* Row 2: correction type + practiced badge + practice button */}
        {(correctionType || practiced || onPractice) ? (
          <View style={styles.row2}>
            {correctionType ? (
              <Text style={styles.correctionType}>{correctionType}</Text>
            ) : (
              <View style={{ flex: 1 }} />
            )}
            {practiced && (
              <View style={styles.practicedBadge}>
                <Ionicons name="checkmark" size={10} color={colors.severityPolish} />
                <Text style={styles.practicedText}>Practiced</Text>
              </View>
            )}
            {onPractice && !practiced && (
              <Pressable style={styles.practiceBtn} onPress={onPractice}>
                <Ionicons name="mic" size={14} color={colors.primary} />
                <Text style={styles.practiceBtnText}>Practice</Text>
              </Pressable>
            )}
          </View>
        ) : null}

        {/* Expandable explanation (hidden in compact mode) */}
        {hasExplanation && !compact && (
          <Animated.View style={expandStyle}>
            <View style={styles.explanationRow}>
              <Ionicons
                name="information-circle-outline"
                size={14}
                color={alpha(colors.white, 0.25)}
                style={styles.explanationIcon}
              />
              <Text style={styles.explanationText} numberOfLines={3}>
                {explanation}
              </Text>
            </View>
          </Animated.View>
        )}
      </View>

    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 8,
    borderRadius: 16,
    backgroundColor: alpha(colors.white, 0.04),
    borderWidth: 1,
    borderColor: alpha(colors.white, 0.08),
    overflow: 'hidden',
  },
  cardBody: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },

  // Row 1: severity icon + inline text + chevron
  row1: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  severityIcon: {
    marginTop: 2,
    marginRight: 8,
  },
  inlineText: {
    flex: 1,
    fontSize: 15,
    fontFamily: fonts.regular,
    lineHeight: 21,
    color: alpha(colors.white, 0.4),
  },
  contextText: {
    fontFamily: fonts.regular,
    color: alpha(colors.white, 0.4),
  },
  originalText: {
    fontFamily: fonts.regular,
    color: alpha(colors.white, 0.65),
    textDecorationLine: 'line-through',
  },
  arrowText: {
    color: alpha(colors.white, 0.25),
    fontFamily: fonts.regular,
  },
  replacementText: {
    color: alpha(colors.white, 0.9),
    fontFamily: fonts.semibold,
  },
  chevronHit: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  chevronSpacer: {
    width: 32,
  },

  // Row 2: correction type + mic button
  row2: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    marginLeft: 24, // aligns with text (16px icon + 8px gap)
  },
  correctionType: {
    flex: 1,
    fontSize: 13,
    fontFamily: fonts.medium,
    color: alpha(colors.white, 0.2),
  },
  practicedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: alpha(colors.severityPolish, 0.1),
  },
  practicedText: {
    fontSize: 10,
    fontFamily: fonts.semibold,
    color: alpha(colors.severityPolish, 0.7),
    letterSpacing: 0.3,
  },
  // Compact mode
  cardCompact: {
    marginBottom: 6,
  },
  cardBodyCompact: {
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  // Flat mode — no card chrome, hairline divider
  cardFlat: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    borderWidth: 0,
    borderBottomWidth: 1,
    borderBottomColor: alpha(colors.white, 0.06),
    marginHorizontal: layout.screenPadding,
    marginBottom: 0,
  },
  cardBodyFlat: {
    paddingVertical: 14,
    paddingHorizontal: 0,
  },
  // Practice button
  practiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: alpha(colors.primary, 0.1),
    borderWidth: 1,
    borderColor: alpha(colors.primary, 0.2),
  },
  practiceBtnText: {
    fontSize: 11,
    fontFamily: fonts.semibold,
    color: colors.primary,
  },
  // Expandable explanation
  explanationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 8,
    marginLeft: 24,
    paddingRight: 4,
  },
  explanationIcon: {
    marginTop: 1,
    marginRight: 6,
  },
  explanationText: {
    flex: 1,
    fontSize: 13,
    fontFamily: fonts.regular,
    color: alpha(colors.white, 0.4),
    lineHeight: 18,
  },

});
