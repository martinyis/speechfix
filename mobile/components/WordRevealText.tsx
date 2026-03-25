import React from 'react';
import { View, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

interface WordRevealTextProps {
  words: string[];
  revealedCount: number;
  activeStyle?: TextStyle;
  dimmedStyle?: TextStyle;
  containerStyle?: ViewStyle;
}

export function WordRevealText({
  words,
  revealedCount,
  activeStyle,
  dimmedStyle,
  containerStyle,
}: WordRevealTextProps) {
  return (
    <View style={[styles.container, containerStyle]}>
      {words.map((word, idx) => {
        if (idx >= revealedCount) return null;
        return (
          <Animated.Text
            key={`${word}-${idx}`}
            entering={FadeIn.duration(200)}
            style={[styles.word, activeStyle]}
          >
            {word}{' '}
          </Animated.Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  word: {},
});
