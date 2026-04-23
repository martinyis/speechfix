import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, alpha, layout, spacing, typography } from '../../theme';
import { StateIndicator } from './StateIndicator';

interface ReturningBannerProps {
  identifier: string | null;
  onPress?: () => void;
  onDismiss?: () => void;
}

export function ReturningBanner({
  identifier,
  onPress,
  onDismiss,
}: ReturningBannerProps) {
  const label = identifier ? `"${identifier}"` : 'A pattern';

  return (
    <Pressable
      onPress={onPress}
      style={styles.container}
      accessibilityRole="button"
      accessibilityLabel={`${label} came back. Tap to view.`}
    >
      <View style={styles.dotSlot}>
        <StateIndicator state="returning" />
      </View>

      <View style={styles.textCol}>
        <Text style={styles.title} numberOfLines={1}>
          <Text style={styles.titleName}>{label}</Text>
          <Text style={styles.titleRest}> came back.</Text>
        </Text>
        <Text style={styles.subtitle} numberOfLines={2}>
          This is normal — let's watch it again.
        </Text>
      </View>

      {onDismiss != null && (
        <Pressable
          hitSlop={10}
          onPress={onDismiss}
          style={styles.closeBtn}
          accessibilityRole="button"
          accessibilityLabel="Dismiss returning banner"
        >
          <Ionicons
            name="close"
            size={16}
            color={alpha(colors.white, 0.5)}
          />
        </Pressable>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: alpha(colors.tertiary, 0.08),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: alpha(colors.tertiary, 0.15),
    paddingHorizontal: layout.screenPadding,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  dotSlot: {
    paddingTop: 4,
  },
  textCol: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...typography.bodyMdMedium,
  },
  titleName: {
    color: colors.tertiary,
  },
  titleRest: {
    color: colors.white,
  },
  subtitle: {
    ...typography.bodySm,
    color: alpha(colors.white, 0.55),
  },
  closeBtn: {
    padding: 4,
    marginLeft: spacing.xs,
  },
});
