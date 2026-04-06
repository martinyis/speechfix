import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { CorrectionCard } from './CorrectionCard';
import { colors, alpha, fonts, spacing, layout } from '../theme';
import type { Correction } from '../types/session';

interface CorrectionsPreviewProps {
  corrections: Correction[];
  sentences: string[];
  practicedIds: Set<number>;
  totalCount: number;
  onPractice: (correctionId: number) => void;
  onSeeAll: () => void;
  isStreaming?: boolean;
  isFresh?: boolean;
}

export function CorrectionsPreview({
  corrections,
  sentences,
  practicedIds,
  totalCount,
  onPractice,
  onSeeAll,
  isStreaming,
  isFresh,
}: CorrectionsPreviewProps) {
  if (corrections.length === 0 && !isStreaming) return null;

  const preview = corrections.slice(0, 3);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerLabel}>
          CORRECTIONS{totalCount > 0 ? ` (${totalCount})` : ''}
        </Text>
        {!isStreaming && totalCount > 3 && (
          <Pressable onPress={onSeeAll} hitSlop={8}>
            <Text style={styles.seeAllText}>See all &gt;</Text>
          </Pressable>
        )}
      </View>

      {/* Preview cards */}
      {preview.map((c, i) => {
        const sentence = sentences[c.sentenceIndex] ?? '';
        const key = c.id ?? i;
        const card = (
          <CorrectionCard
            key={key}
            sentence={sentence}
            originalText={c.originalText}
            correctedText={c.correctedText}
            explanation={c.explanation}
            correctionType={c.correctionType}
            severity={c.severity}
            practiced={c.id != null && practicedIds.has(c.id)}
            flat
            onPractice={
              c.id != null && !practicedIds.has(c.id)
                ? () => onPractice(c.id!)
                : undefined
            }
          />
        );

        if (isFresh) {
          return (
            <Animated.View
              key={key}
              entering={FadeInDown.duration(250).delay(i * 80)}
            >
              {card}
            </Animated.View>
          );
        }

        return card;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: layout.screenPadding,
    marginBottom: 12,
  },
  headerLabel: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: alpha(colors.white, 0.25),
    letterSpacing: 1.2,
  },
  seeAllText: {
    fontSize: 13,
    fontFamily: fonts.semibold,
    color: colors.primary,
  },
});
