import { Fragment, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { colors, alpha, fonts, spacing } from '../theme';
import type { Correction, FillerWordPosition } from '../types/session';

interface Props {
  sentences: string[];
  corrections: Correction[];
  fillerPositions: FillerWordPosition[];
}

type Chunk =
  | { kind: 'plain'; text: string }
  | { kind: 'filler'; text: string }
  | { kind: 'correction'; text: string; correctionId: number };

interface Range {
  start: number;
  end: number;
  kind: 'filler' | 'correction';
  correctionId?: number;
}

/**
 * Build non-overlapping styled chunks for a single sentence.
 * Corrections win over fillers on overlap.
 */
function buildChunks(
  sentence: string,
  fillers: FillerWordPosition[],
  corrections: Correction[],
): Chunk[] {
  const ranges: Range[] = [];

  for (const c of corrections) {
    if (!c.originalText) continue;
    const idx = sentence.indexOf(c.originalText);
    if (idx < 0) continue;
    ranges.push({
      start: idx,
      end: idx + c.originalText.length,
      kind: 'correction',
      correctionId: c.id,
    });
  }

  for (const f of fillers) {
    const start = f.startIndex;
    const end = start + f.word.length;
    // skip if the filler overlaps any existing (correction) range
    const overlaps = ranges.some(r => !(end <= r.start || start >= r.end));
    if (overlaps) continue;
    ranges.push({ start, end, kind: 'filler' });
  }

  ranges.sort((a, b) => a.start - b.start);

  // Remove any residual overlaps (keep earlier range)
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
      chunks.push({ kind: 'correction', text, correctionId: r.correctionId ?? -1 });
    }
    cursor = r.end;
  }
  if (cursor < sentence.length) {
    chunks.push({ kind: 'plain', text: sentence.slice(cursor) });
  }
  return chunks;
}

export function SessionTranscript({ sentences, corrections, fillerPositions }: Props) {
  const perSentence = useMemo(() => {
    const fillersBy = new Map<number, FillerWordPosition[]>();
    for (const f of fillerPositions) {
      const list = fillersBy.get(f.sentenceIndex) ?? [];
      list.push(f);
      fillersBy.set(f.sentenceIndex, list);
    }

    const correctionsBy = new Map<number, Correction[]>();
    for (const c of corrections) {
      const list = correctionsBy.get(c.sentenceIndex) ?? [];
      list.push(c);
      correctionsBy.set(c.sentenceIndex, list);
    }

    return sentences.map((sentence, i) =>
      buildChunks(sentence, fillersBy.get(i) ?? [], correctionsBy.get(i) ?? []),
    );
  }, [sentences, fillerPositions, corrections]);

  if (sentences.length === 0) return null;

  const handleCorrectionPress = () => {
    Haptics.selectionAsync();
    router.push('/corrections-list');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>Transcript</Text>
      {perSentence.map((chunks, i) => (
        <Text key={i} style={styles.sentence}>
          {chunks.map((chunk, j) => {
            if (chunk.kind === 'filler') {
              return (
                <Text key={j} style={styles.filler}>
                  {chunk.text}
                </Text>
              );
            }
            if (chunk.kind === 'correction') {
              return (
                <Text key={j} style={styles.correction} onPress={handleCorrectionPress}>
                  {chunk.text}
                </Text>
              );
            }
            return <Fragment key={j}>{chunk.text}</Fragment>;
          })}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: fonts.bold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: alpha(colors.white, 0.35),
    marginBottom: spacing.xs,
  },
  sentence: {
    fontSize: 15,
    fontFamily: fonts.regular,
    color: alpha(colors.white, 0.75),
    lineHeight: 22,
    marginBottom: 8,
  },
  filler: {
    color: colors.tertiary,
    textDecorationLine: 'underline',
    textDecorationStyle: 'solid',
    textDecorationColor: alpha(colors.tertiary, 0.6),
  },
  correction: {
    color: colors.secondary,
    textDecorationLine: 'underline',
    textDecorationStyle: 'solid',
    textDecorationColor: alpha(colors.secondary, 0.6),
  },
});
