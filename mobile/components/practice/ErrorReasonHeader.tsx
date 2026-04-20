import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import { colors, alpha, fonts, spacing, borderRadius } from '../../theme';
import {
  getCorrectionNature,
  extractShortReason,
} from '../../lib/correctionNature';

export type ErrorSeverity = 'error' | 'improvement' | 'polish';

export interface ErrorAtom {
  /** The specific fragment of the original text this atom calls out. */
  fragment: string;
  /** A short (~3 word) tag describing what's wrong with this fragment. */
  tag: string;
}

export interface ErrorReasonHeaderProps {
  correctionType: string;
  severity: ErrorSeverity;
  explanation: string | null;
  /** The error span in the user's original sentence (used for single-atom fallback). */
  originalText?: string;
  /**
   * Authoritative 2-4 word diagnostic emitted by the grammar LLM ("missing 'to'",
   * "wrong tense"). Preferred over the legacy `extractShortReason(explanation)`
   * heuristic. May be null/empty for legacy corrections written before the field
   * existed — in that case we fall back to extraction, then to the nature label.
   */
  shortReason?: string | null;
  /**
   * Optional structured breakdown. When provided, rendered as separate atom
   * rows. When absent, a single atom is synthesized from originalText + the
   * short-reason extracted from `explanation`.
   */
  atoms?: ErrorAtom[];
}

const SEVERITY_COLOR: Record<ErrorSeverity, string> = {
  error: colors.severityError,
  improvement: colors.severityImprovement,
  polish: colors.severityPolish,
};

/**
 * Glanceable error header — icon + nature label + mini diff atoms + "read more".
 *
 * Promoted from lab Variant D. Single-atom fallback builds a row from the
 * error span ("don't know how speak") and a short reason extracted from the
 * explanation ("missing 'to' before verb"). If neither is extractable, falls
 * back to showing just the nature label as the atom content.
 */
export default function ErrorReasonHeader({
  correctionType,
  severity,
  explanation,
  originalText,
  shortReason,
  atoms,
}: ErrorReasonHeaderProps) {
  const nature = getCorrectionNature(correctionType);
  const sevColor = SEVERITY_COLOR[severity];

  const effectiveAtoms: ErrorAtom[] =
    atoms && atoms.length > 0
      ? atoms
      : [buildFallbackAtom(originalText, explanation, nature.label, shortReason)];

  // Collapse/expand for the full explanation.
  const [expanded, setExpanded] = useState(false);
  const anim = useSharedValue(0);

  const toggle = useCallback(() => {
    const next = !expanded;
    setExpanded(next);
    anim.value = withTiming(next ? 1 : 0, {
      duration: 250,
      easing: Easing.out(Easing.cubic),
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [expanded, anim]);

  // Reset on content change (parent remounts this component on item change).
  useEffect(() => {
    setExpanded(false);
    anim.value = 0;
  }, [correctionType, explanation]);

  const bodyStyle = useAnimatedStyle(() => ({
    height: interpolate(anim.value, [0, 1], [0, 80]),
    opacity: interpolate(anim.value, [0, 0.4, 1], [0, 0, 1]),
    overflow: 'hidden' as const,
  }));

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(anim.value, [0, 1], [0, 180])}deg` }],
  }));

  return (
    <View style={styles.wrap}>
      {/* Header: icon + nature label */}
      <View style={styles.headerRow}>
        <View style={[styles.iconDot, { backgroundColor: alpha(sevColor, 0.15) }]}>
          <Ionicons name={nature.icon} size={14} color={sevColor} />
        </View>
        <Text style={[styles.headerLabel, { color: alpha(colors.white, 0.55) }]}>
          {nature.label.toUpperCase()}
        </Text>
      </View>

      {/* Atom rows */}
      <View style={styles.atomList}>
        {effectiveAtoms.map((atom, idx) => (
          <View key={idx} style={styles.atomRow}>
            <Text style={styles.atomFragment} numberOfLines={1}>
              “{atom.fragment}”
            </Text>
            <View style={styles.atomArrow}>
              <Ionicons name="arrow-forward" size={12} color={alpha(colors.white, 0.3)} />
            </View>
            <Text style={[styles.atomTag, { color: sevColor }]} numberOfLines={1}>
              {atom.tag}
            </Text>
          </View>
        ))}
      </View>

      {/* Read more toggle + full explanation */}
      {explanation ? (
        <>
          <Pressable onPress={toggle} hitSlop={8} style={styles.readMoreRow}>
            <Text style={styles.readMoreText}>Read more</Text>
            <Animated.View style={chevronStyle}>
              <Ionicons name="chevron-down" size={12} color={alpha(colors.white, 0.35)} />
            </Animated.View>
          </Pressable>

          <Animated.View style={bodyStyle}>
            <Text style={styles.explanationText}>{explanation}</Text>
          </Animated.View>
        </>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a single fallback atom when the backend has not provided structured
 * atoms. Prefers the real error span as the fragment (quoted) and the
 * LLM-emitted shortReason as the tag, with extractShortReason and the nature
 * label as progressively weaker fallbacks for legacy data.
 */
function buildFallbackAtom(
  originalText: string | undefined,
  explanation: string | null,
  natureLabel: string,
  shortReason: string | null | undefined,
): ErrorAtom {
  const MAX_FRAGMENT_CHARS = 36;

  // Prefer the real error span when it's short enough to read on one line.
  const fragment =
    originalText && originalText.length <= MAX_FRAGMENT_CHARS
      ? originalText
      : natureLabel.toLowerCase();

  const trimmedShortReason = shortReason?.trim();
  const tag =
    (trimmedShortReason && trimmedShortReason.length > 0 ? trimmedShortReason : null) ??
    extractShortReason(explanation) ??
    natureLabel.toLowerCase();

  return { fragment, tag };
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLabel: {
    fontSize: 10,
    fontFamily: fonts.bold,
    letterSpacing: 1.2,
  },

  // Atom rows
  atomList: {
    gap: 6,
  },
  atomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: alpha(colors.white, 0.04),
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: borderRadius.sm,
  },
  atomFragment: {
    flexShrink: 1,
    fontSize: 14,
    fontFamily: fonts.semibold,
    color: alpha(colors.white, 0.9),
  },
  atomArrow: {
    opacity: 0.6,
  },
  atomTag: {
    flex: 1,
    textAlign: 'right',
    fontSize: 12,
    fontFamily: fonts.bold,
    letterSpacing: 0.4,
  },

  // Read-more + body
  readMoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  readMoreText: {
    fontSize: 12,
    fontFamily: fonts.semibold,
    color: alpha(colors.white, 0.35),
  },
  explanationText: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: alpha(colors.white, 0.5),
    lineHeight: 20,
    fontStyle: 'italic',
  },
});
