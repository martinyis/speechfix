/**
 * SessionKaraoke — per-word karaoke transcript synced to the audio playhead.
 * Uses `UtteranceMetadata.words[]` already persisted by the backend.
 */

import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { colors, alpha, fonts, layout, spacing } from '../../theme';
import type { UtteranceMetadata } from '../../types/session';

interface Props {
  utterances: UtteranceMetadata[];
  positionSeconds: SharedValue<number>;
}

export function SessionKaraoke({ utterances, positionSeconds }: Props) {
  const hasAnyWords = useMemo(
    () => utterances.some(u => (u.words ?? []).length > 0),
    [utterances],
  );

  if (utterances.length === 0) return null;

  return (
    <View style={styles.container}>
      {utterances.map((u, uIdx) => (
        <UtteranceLine
          key={uIdx}
          utterance={u}
          uIdx={uIdx}
          positionSeconds={positionSeconds}
          fallbackPerUtterance={!hasAnyWords}
        />
      ))}
    </View>
  );
}

interface LineProps {
  utterance: UtteranceMetadata;
  uIdx: number;
  positionSeconds: SharedValue<number>;
  fallbackPerUtterance: boolean;
}

function UtteranceLine({ utterance, uIdx, positionSeconds, fallbackPerUtterance }: LineProps) {
  const isActive = useDerivedValue(() => {
    const t = positionSeconds.value;
    return t >= utterance.startTime && t <= utterance.endTime + 0.15 ? 1 : 0;
  });

  const containerStyle = useAnimatedStyle(() => ({
    opacity: withTiming(isActive.value === 1 ? 1 : 0.28, { duration: 160 }),
  }));

  const words = utterance.words ?? [];

  return (
    <Animated.View style={[styles.line, containerStyle]}>
      <Text style={styles.label}>Turn {uIdx + 1}</Text>
      <Text style={styles.sentence}>
        {fallbackPerUtterance || words.length === 0
          ? utterance.text
          : words.map((w, i) => (
              <Word
                key={i}
                word={w.word}
                start={w.start}
                end={w.end}
                positionSeconds={positionSeconds}
              />
            ))}
      </Text>
    </Animated.View>
  );
}

interface WordProps {
  word: string;
  start: number;
  end: number;
  positionSeconds: SharedValue<number>;
}

function Word({ word, start, end, positionSeconds }: WordProps) {
  const state = useDerivedValue(() => {
    const t = positionSeconds.value;
    if (t >= start && t <= end) return 2;
    if (t > end) return 1;
    return 0;
  });

  const textStyle = useAnimatedStyle(() => {
    const s = state.value;
    const color = s === 2 ? '#ffffff' : s === 1 ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.35)';
    return { color };
  });

  return <Animated.Text style={[styles.word, textStyle]}>{word} </Animated.Text>;
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  line: {
    gap: 4,
  },
  label: {
    fontSize: 10,
    fontFamily: fonts.bold,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: alpha(colors.white, 0.35),
  },
  sentence: {
    fontSize: 17,
    lineHeight: 26,
    fontFamily: fonts.medium,
  },
  word: {
    fontSize: 17,
    lineHeight: 26,
    fontFamily: fonts.medium,
  },
});
