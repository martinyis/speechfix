/**
 * InsightOverhead — chromeless editorial display of the active insight above
 * the Pitch Ribbon. Default: horizontal paging carousel over "overall"
 * insights with page dots. When a numbered chip on the ribbon is tapped,
 * swaps to that specific insight with a "Back to overall" affordance.
 */

import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { colors, alpha, fonts, spacing, layout } from '../../theme';
import type { DeepInsight } from '../../types/session';

interface Props {
  insights: DeepInsight[];
  selectedSpecific: DeepInsight | null;
  selectedNumber: number | null;
  onClear: () => void;
  animate?: boolean;
}

export function InsightOverhead({
  insights,
  selectedSpecific,
  selectedNumber,
  onClear,
  animate,
}: Props) {
  const overall = insights.filter(i => i.type === 'overall');
  const { width: screenWidth } = useWindowDimensions();
  const [page, setPage] = useState(0);

  if (selectedSpecific) {
    return (
      <Animated.View
        key={`s-${selectedNumber}`}
        entering={FadeIn.duration(220)}
        exiting={FadeOut.duration(120)}
        style={styles.wrap}
      >
        <View style={styles.row}>
          <Text style={styles.kicker}>Moment {selectedNumber}</Text>
          <Pressable onPress={onClear} hitSlop={10}>
            <Text style={styles.back}>Back to overall</Text>
          </Pressable>
        </View>
        <Text style={styles.headline}>{selectedSpecific.headline}</Text>
        <Text style={styles.unpack}>{selectedSpecific.unpack}</Text>
        {selectedSpecific.anchor?.quoted_text ? (
          <Text style={styles.quoted}>
            &ldquo;{selectedSpecific.anchor.quoted_text}&rdquo;
          </Text>
        ) : null}
      </Animated.View>
    );
  }

  if (overall.length === 0) return null;

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
    if (next !== page) setPage(next);
  };

  const showPager = overall.length > 1;

  return (
    <Animated.View
      style={styles.carouselWrap}
      entering={animate ? FadeIn.duration(400) : undefined}
    >
      <View style={styles.kickerRow}>
        <Text style={styles.kicker}>Overall</Text>
        {showPager && (
          <Text style={styles.pageCount}>
            {page + 1} / {overall.length}
          </Text>
        )}
      </View>

      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {overall.map((ins, i) => (
          <View key={i} style={[styles.page, { width: screenWidth }]}>
            <Text style={styles.headline}>{ins.headline}</Text>
            <Text style={styles.unpack}>{ins.unpack}</Text>
          </View>
        ))}
      </ScrollView>

      {showPager && (
        <View style={styles.dots}>
          {overall.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === page ? styles.dotActive : styles.dotInactive,
              ]}
            />
          ))}
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: 6,
  },
  carouselWrap: {
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.screenPadding,
    marginBottom: 6,
  },
  page: {
    paddingHorizontal: layout.screenPadding,
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  kicker: {
    fontSize: 10,
    fontFamily: fonts.bold,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: alpha(colors.primary, 0.9),
  },
  pageCount: {
    fontSize: 11,
    fontFamily: fonts.semibold,
    color: alpha(colors.white, 0.4),
    letterSpacing: 0.4,
  },
  back: {
    fontSize: 11,
    fontFamily: fonts.semibold,
    color: alpha(colors.white, 0.5),
    textDecorationLine: 'underline',
  },
  headline: {
    fontSize: 26,
    lineHeight: 30,
    fontFamily: fonts.extrabold,
    color: colors.white,
    letterSpacing: -0.7,
  },
  unpack: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.regular,
    color: alpha(colors.white, 0.65),
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.md,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    backgroundColor: alpha(colors.primary, 0.9),
  },
  dotInactive: {
    backgroundColor: alpha(colors.white, 0.15),
  },
  quoted: {
    marginTop: 4,
    paddingLeft: spacing.md,
    borderLeftWidth: 2,
    borderLeftColor: alpha(colors.primary, 0.5),
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.medium,
    fontStyle: 'italic',
    color: alpha(colors.primary, 0.85),
  },
});
