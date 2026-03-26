import { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors, alpha } from '../theme';

interface CorrectionCardProps {
  id?: number;
  sentence: string;
  originalText: string;
  correctedText: string;
  explanation: string | null;
  correctionType: string;
  severity: 'error' | 'improvement' | 'polish';
}

const SEVERITY_COLOR: Record<string, string> = {
  error: colors.severityError,
  improvement: colors.severityImprovement,
  polish: colors.severityPolish,
};

const SEVERITY_LABEL: Record<string, string> = {
  error: 'Error',
  improvement: 'Improvement',
  polish: 'Polish',
};

const CARD_BG_OPACITY: Record<string, number> = {
  error: 0.05,
  improvement: 0.03,
  polish: 0.02,
};

function trimContext(sentence: string, originalText: string, maxContext = 20) {
  const idx = sentence.toLowerCase().indexOf(originalText.toLowerCase());
  if (idx < 0) return { before: '', error: originalText, after: '' };

  let before = sentence.slice(Math.max(0, idx - maxContext), idx);
  let after = sentence.slice(
    idx + originalText.length,
    idx + originalText.length + maxContext,
  );

  if (idx > maxContext) before = '\u2026' + before;
  if (idx + originalText.length + maxContext < sentence.length)
    after = after + '\u2026';

  return { before, error: sentence.slice(idx, idx + originalText.length), after };
}

export function CorrectionCard({
  id,
  sentence,
  originalText,
  correctedText,
  explanation,
  correctionType,
  severity,
}: CorrectionCardProps) {
  const [showExplanation, setShowExplanation] = useState(false);
  const severityColor = SEVERITY_COLOR[severity] ?? colors.severityError;
  const bgOpacity = CARD_BG_OPACITY[severity] ?? 0.03;

  const { before, error, after } = trimContext(sentence, originalText);

  return (
    <View style={[styles.card, { backgroundColor: alpha(colors.white, bgOpacity) }]}>
      {/* Severity-colored left border gradient */}
      <LinearGradient
        colors={[alpha(severityColor, 0.6), 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.leftBorder}
      />

      <View style={styles.cardContent}>
        {/* Severity badge + correction type */}
        <View style={styles.topRow}>
          <View style={[styles.severityBadge, { borderColor: alpha(severityColor, 0.25) }]}>
            <View style={[styles.severityDot, { backgroundColor: severityColor }]} />
            <Text style={[styles.severityText, { color: severityColor }]}>
              {SEVERITY_LABEL[severity]}
            </Text>
          </View>
          {correctionType && (
            <Text style={styles.correctionType}>{correctionType}</Text>
          )}
        </View>

        {/* Context line with error highlighted */}
        <Text style={styles.contextLine}>
          {before ? <Text style={styles.contextDim}>{before}</Text> : null}
          <Text
            style={[
              styles.errorPill,
              { backgroundColor: alpha(severityColor, 0.15) },
            ]}
          >
            {error}
          </Text>
          {after ? <Text style={styles.contextDim}>{after}</Text> : null}
        </Text>

        {/* Arrow */}
        <Text style={[styles.arrow, { color: alpha(severityColor, 0.5) }]}>
          {'\u2193'}
        </Text>

        {/* Correction */}
        <View style={styles.correctionRow}>
          <Text style={styles.correctionPill}>{correctedText}</Text>
        </View>

        {/* Why? button / explanation */}
        <View style={styles.bottomRow}>
          {explanation ? (
            showExplanation ? (
              <Pressable
                onPress={() => setShowExplanation(false)}
                style={styles.explanationContainer}
              >
                <View style={styles.explanationRow}>
                  <Ionicons
                    name="information-circle-outline"
                    size={14}
                    color={alpha(colors.white, 0.3)}
                  />
                  <Text style={styles.explanationText}>{explanation}</Text>
                </View>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => setShowExplanation(true)}
                style={styles.whyButton}
              >
                <Text style={styles.whyButtonText}>Why?</Text>
              </Pressable>
            )
          ) : null}
        </View>

        {/* Practice CTA bar */}
        {id != null && (
          <>
            <View style={styles.practiceDivider} />
            <Pressable
              style={styles.practiceBar}
              onPress={() => {
                router.push({
                  pathname: '/practice-session',
                  params: {
                    correctionId: String(id),
                    mode: 'say_it_right',
                  },
                });
              }}
            >
              <Ionicons name="mic" size={16} color={colors.primary} />
              <Text style={styles.practiceBarText}>Practice this phrase</Text>
              <Ionicons name="chevron-forward" size={14} color={alpha(colors.primary, 0.6)} />
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: alpha(colors.white, 0.05),
    overflow: 'hidden',
  },
  leftBorder: {
    width: 3,
  },
  cardContent: {
    flex: 1,
    padding: 18,
  },

  // Top row
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  severityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  severityDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  severityText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  correctionType: {
    fontSize: 11,
    color: alpha(colors.white, 0.25),
    fontWeight: '500',
  },

  // Context line with error
  contextLine: {
    fontSize: 15,
    lineHeight: 22,
    color: alpha(colors.white, 0.4),
  },
  contextDim: {
    color: alpha(colors.white, 0.35),
  },
  errorPill: {
    color: alpha(colors.white, 0.75),
    fontWeight: '600',
    textDecorationLine: 'line-through',
    borderRadius: 4,
    paddingHorizontal: 2,
  },

  // Arrow
  arrow: {
    fontSize: 14,
    textAlign: 'center',
    marginVertical: 6,
  },

  // Correction
  correctionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 14,
  },
  correctionPill: {
    fontSize: 16,
    fontWeight: '700',
    color: alpha(colors.white, 0.92),
    backgroundColor: 'rgba(74, 222, 128, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.3)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    overflow: 'hidden',
    letterSpacing: -0.2,
    shadowColor: '#4ade80',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
  },

  // Bottom row
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  explanationContainer: {
    flex: 1,
    marginRight: 12,
  },
  explanationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: alpha(colors.white, 0.05),
  },
  explanationText: {
    flex: 1,
    fontSize: 13,
    color: alpha(colors.white, 0.4),
    lineHeight: 19,
    fontWeight: '400',
  },
  whyButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 100,
    backgroundColor: alpha(colors.white, 0.04),
    borderWidth: 1,
    borderColor: alpha(colors.white, 0.08),
  },
  whyButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: alpha(colors.white, 0.4),
  },
  practiceDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: alpha(colors.white, 0.06),
    marginTop: 14,
  },
  practiceBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: alpha(colors.primary, 0.25),
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  practiceBarText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 0.3,
  },
});
