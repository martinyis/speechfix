import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
  interpolate,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { colors, alpha, fonts } from '../../theme';

const DISMISS_THRESHOLD = -120;

interface SwipeToDismissProps {
  onDismiss: () => void;
  children: React.ReactNode;
}

export function SwipeToDismiss({ onDismiss, children }: SwipeToDismissProps) {
  const translateX = useSharedValue(0);

  const pan = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .onUpdate((e) => {
      // Only allow swiping left
      if (e.translationX < 0) {
        translateX.value = e.translationX;
      }
    })
    .onEnd((e) => {
      if (e.translationX < DISMISS_THRESHOLD) {
        translateX.value = withTiming(-400, { duration: 200 }, () => {
          runOnJS(onDismiss)();
        });
      } else {
        translateX.value = withSpring(0, { damping: 15, stiffness: 200 });
      }
    });

  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const revealStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, DISMISS_THRESHOLD], [0, 1]),
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.reveal, revealStyle]}>
        <Ionicons name="close-circle" size={18} color={colors.severityError} />
        <Text style={styles.revealText}>Dismiss</Text>
      </Animated.View>
      <GestureDetector gesture={pan}>
        <Animated.View style={contentStyle}>
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
  },
  reveal: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingRight: 20,
    gap: 6,
  },
  revealText: {
    fontSize: 13,
    fontFamily: fonts.semibold,
    color: colors.severityError,
  },
});
