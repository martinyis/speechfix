import React from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  withSpring,
  interpolate,
  runOnJS,
  type SharedValue,
} from 'react-native-reanimated';

const SNAP_SPRING = { damping: 20, stiffness: 200, mass: 0.8 };
const PARALLAX = 0.8; // adjacent pages move at 80% speed
const SWIPE_VELOCITY_THRESHOLD = 500;

interface PracticePagerProps {
  pages: React.ReactNode[];
  activeIndex: SharedValue<number>;
  translateX: SharedValue<number>;
  onPageChange: (index: number) => void;
}

export function PracticePager({ pages, activeIndex, translateX, onPageChange }: PracticePagerProps) {
  const { width: screenWidth } = useWindowDimensions();
  const pageCount = pages.length;

  const pan = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-10, 10])
    .onUpdate((e) => {
      'worklet';
      const base = -Math.round(activeIndex.value) * screenWidth;
      let rawX = base + e.translationX;

      // Rubber-band at edges
      const minX = -(pageCount - 1) * screenWidth;
      if (rawX > 0) {
        rawX = rawX * 0.3;
      } else if (rawX < minX) {
        rawX = minX + (rawX - minX) * 0.3;
      }

      translateX.value = rawX;
      activeIndex.value = -rawX / screenWidth;
    })
    .onEnd((e) => {
      'worklet';
      const currentPage = Math.round(activeIndex.value);
      let target = currentPage;

      if (Math.abs(e.velocityX) > SWIPE_VELOCITY_THRESHOLD) {
        target = e.velocityX < 0 ? currentPage + 1 : currentPage - 1;
      } else {
        target = Math.round(-translateX.value / screenWidth);
      }

      const clamped = Math.max(0, Math.min(pageCount - 1, target));
      translateX.value = withSpring(-clamped * screenWidth, SNAP_SPRING);
      activeIndex.value = withSpring(clamped, SNAP_SPRING);
      runOnJS(onPageChange)(clamped);
    });

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={styles.container}>
        {pages.map((page, i) => (
          <PagerPage
            key={i}
            index={i}
            translateX={translateX}
            screenWidth={screenWidth}
          >
            {page}
          </PagerPage>
        ))}
      </Animated.View>
    </GestureDetector>
  );
}

/** Programmatically jump to a page (called from bubble bar taps on the JS thread) */
export function jumpToPage(
  index: number,
  translateX: SharedValue<number>,
  activeIndex: SharedValue<number>,
  screenWidth: number,
  onPageChange: (index: number) => void,
) {
  translateX.value = withSpring(-index * screenWidth, SNAP_SPRING);
  activeIndex.value = withSpring(index, SNAP_SPRING);
  onPageChange(index);
}

/** Internal: single page with parallax offset */
function PagerPage({
  index,
  translateX,
  screenWidth,
  children,
}: {
  index: number;
  translateX: SharedValue<number>;
  screenWidth: number;
  children: React.ReactNode;
}) {
  const animStyle = useAnimatedStyle(() => {
    const inputRange = [
      -(index + 1) * screenWidth,
      -index * screenWidth,
      -(index - 1) * screenWidth,
    ];

    const tx = interpolate(
      translateX.value,
      inputRange,
      [-screenWidth * PARALLAX, 0, screenWidth * PARALLAX],
    );

    return { transform: [{ translateX: tx }] };
  });

  return (
    <Animated.View style={[styles.page, { width: screenWidth, left: index * screenWidth }, animStyle]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  page: {
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
});
