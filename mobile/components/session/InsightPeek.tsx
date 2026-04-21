import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, alpha, fonts, spacing, layout } from '../../theme';
import type { DeepInsight } from '../../types/session';

interface InsightPeekProps {
  insight: DeepInsight | null;
  onDismiss: () => void;
}

export function InsightPeek({ insight, onDismiss }: InsightPeekProps) {
  const insets = useSafeAreaInsets();
  const visible = insight !== null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onDismiss}
    >
      {visible && insight && (
        <Animated.View
          entering={FadeIn.duration(160)}
          exiting={FadeOut.duration(140)}
          style={styles.backdrop}
        >
          <Pressable style={styles.backdropHit} onPress={onDismiss} />
          <Animated.View
            entering={SlideInDown.duration(220)}
            exiting={SlideOutDown.duration(180)}
            style={[styles.sheet, { paddingBottom: insets.bottom + spacing.xl }]}
          >
            <View style={styles.handle} />
            <Text style={styles.tag}>A SPECIFIC MOMENT</Text>
            <Text style={styles.headline}>{insight.headline}</Text>
            <Text style={styles.unpack}>{insight.unpack}</Text>
            {insight.anchor?.quoted_text ? (
              <Text style={styles.quoted}>"{insight.anchor.quoted_text}"</Text>
            ) : null}
          </Animated.View>
        </Animated.View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: alpha(colors.black, 0.55),
    justifyContent: 'flex-end',
  },
  backdropHit: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.md,
    backgroundColor: colors.surfaceContainer,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: alpha(colors.white, 0.18),
    marginBottom: spacing.lg,
  },
  tag: {
    fontSize: 10,
    fontFamily: fonts.semibold,
    color: alpha(colors.white, 0.3),
    letterSpacing: 1.8,
    marginBottom: 10,
  },
  headline: {
    fontSize: 22,
    lineHeight: 28,
    fontFamily: fonts.extrabold,
    letterSpacing: -0.5,
    color: alpha(colors.white, 0.96),
    marginBottom: 8,
  },
  unpack: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: fonts.regular,
    color: alpha(colors.white, 0.65),
    marginBottom: spacing.md,
  },
  quoted: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.regular,
    fontStyle: 'italic',
    color: alpha(colors.primary, 0.85),
    paddingLeft: spacing.md,
    borderLeftWidth: 2,
    borderLeftColor: alpha(colors.primary, 0.4),
  },
});
