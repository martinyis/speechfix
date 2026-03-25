import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, alpha, spacing, layout } from '../../theme';
import { ScreenHeader } from '../../components/ui';

export default function PracticeScreen() {
  return (
    <View style={styles.container}>
      <ScreenHeader variant="large" title="Practice" />

      <View style={styles.content}>
        <View style={styles.emptyState}>
          <View style={styles.iconWrap}>
            <Ionicons name="fitness-outline" size={32} color={alpha(colors.white, 0.3)} />
          </View>
          <Text style={styles.emptyTitle}>Coming soon</Text>
          <Text style={styles.emptySubtitle}>
            Targeted practice drills to sharpen your speech patterns
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    padding: layout.screenPadding,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: 100,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: alpha(colors.white, 0.05),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.onSurface,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 20,
  },
});
