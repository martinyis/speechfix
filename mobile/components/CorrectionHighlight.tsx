import { useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  LayoutChangeEvent,
} from 'react-native';

interface CorrectionItem {
  originalText: string;
  correctedText: string;
  correctionType: string;
}

interface FillerPosition {
  word: string;
  startIndex: number;
}

interface Props {
  sentence: string;
  corrections: CorrectionItem[];
  fillerPositions: FillerPosition[];
}

const ERROR_COLORS: Record<string, string> = {
  article: '#FFE0B2',
  verb_tense: '#E1BEE7',
  preposition: '#B3E5FC',
  word_order: '#C8E6C9',
  subject_verb_agreement: '#FFCDD2',
  plural_singular: '#F0F4C3',
  word_choice: '#D1C4E9',
  sentence_structure: '#B2DFDB',
  other: '#E0E0E0',
};

const FILLER_COLOR = '#BBDEFB';

interface Segment {
  text: string;
  type: 'plain' | 'error' | 'filler';
  correction?: { correctedText: string; correctionType: string };
}

function buildSegments(
  sentence: string,
  corrections: CorrectionItem[],
  fillerPositions: FillerPosition[],
): Segment[] {
  // Build a character-level map: each position maps to a highlight type
  const charMap: (
    | { type: 'error'; correction: CorrectionItem }
    | { type: 'filler' }
    | null
  )[] = new Array(sentence.length).fill(null);

  // Mark filler positions first (errors will override if overlapping)
  for (const filler of fillerPositions) {
    const start = filler.startIndex;
    const end = start + filler.word.length;
    for (let i = start; i < end && i < sentence.length; i++) {
      charMap[i] = { type: 'filler' };
    }
  }

  // Mark error positions (take priority over fillers)
  for (const correction of corrections) {
    const idx = sentence.indexOf(correction.originalText);
    if (idx === -1) continue;
    const end = idx + correction.originalText.length;
    for (let i = idx; i < end && i < sentence.length; i++) {
      charMap[i] = { type: 'error', correction };
    }
  }

  // Build segments from charMap
  const segments: Segment[] = [];
  let i = 0;

  while (i < sentence.length) {
    const entry = charMap[i];

    if (entry === null) {
      // Plain text segment
      let end = i;
      while (end < sentence.length && charMap[end] === null) {
        end++;
      }
      segments.push({ text: sentence.slice(i, end), type: 'plain' });
      i = end;
    } else if (entry.type === 'filler') {
      // Filler segment -- collect contiguous filler chars
      let end = i;
      while (end < sentence.length && charMap[end]?.type === 'filler') {
        end++;
      }
      segments.push({ text: sentence.slice(i, end), type: 'filler' });
      i = end;
    } else {
      // Error segment -- collect contiguous chars for same correction
      const correction = entry.correction;
      let end = i;
      while (
        end < sentence.length &&
        charMap[end]?.type === 'error' &&
        (charMap[end] as { type: 'error'; correction: CorrectionItem }).correction === correction
      ) {
        end++;
      }
      segments.push({
        text: sentence.slice(i, end),
        type: 'error',
        correction: {
          correctedText: correction.correctedText,
          correctionType: correction.correctionType,
        },
      });
      i = end;
    }
  }

  return segments;
}

export function CorrectionHighlight({ sentence, corrections, fillerPositions }: Props) {
  const [activeTooltipIndex, setActiveTooltipIndex] = useState<number | null>(null);
  const [tooltipLayout, setTooltipLayout] = useState<{ x: number; width: number } | null>(null);

  const segments = buildSegments(sentence, corrections, fillerPositions);

  const handleErrorPress = useCallback((index: number) => {
    setActiveTooltipIndex((prev) => (prev === index ? null : index));
    setTooltipLayout(null);
  }, []);

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { x, width } = event.nativeEvent.layout;
      setTooltipLayout({ x, width });
    },
    [],
  );

  const dismissTooltip = useCallback(() => {
    setActiveTooltipIndex(null);
    setTooltipLayout(null);
  }, []);

  return (
    <Pressable onPress={dismissTooltip} style={styles.container}>
      <Text style={styles.sentenceText}>
        {segments.map((segment, index) => {
          if (segment.type === 'plain') {
            return (
              <Text key={index}>{segment.text}</Text>
            );
          }

          if (segment.type === 'filler') {
            return (
              <Text
                key={index}
                style={{ backgroundColor: FILLER_COLOR }}
              >
                {segment.text}
              </Text>
            );
          }

          // Error segment
          const bgColor =
            ERROR_COLORS[segment.correction?.correctionType || 'other'] ||
            ERROR_COLORS.other;

          return (
            <Text
              key={index}
              onLayout={activeTooltipIndex === index ? handleLayout : undefined}
              onPress={() => handleErrorPress(index)}
              style={{ backgroundColor: bgColor }}
            >
              {segment.text}
            </Text>
          );
        })}
      </Text>

      {activeTooltipIndex !== null && segments[activeTooltipIndex]?.correction && (
        <View style={styles.tooltipContainer}>
          <View style={styles.tooltipArrow} />
          <View style={styles.tooltip}>
            <Text style={styles.tooltipText}>
              {segments[activeTooltipIndex].correction!.correctedText}
            </Text>
          </View>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  sentenceText: {
    color: '#000',
    fontSize: 16,
    lineHeight: 24,
  },
  tooltipContainer: {
    alignItems: 'center',
    marginTop: 4,
  },
  tooltipArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#fff',
  },
  tooltip: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  tooltipText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '700',
  },
});
