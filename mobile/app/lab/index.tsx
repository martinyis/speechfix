import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '../../components/ui';
import { colors, alpha, spacing, fonts, layout, borderRadius } from '../../theme';

interface LabEntry {
  key: string;
  title: string;
  subtitle: string;
  route: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
}

// Register dev prototypes here. Kept empty after each prototype ships to
// production so the lab stays quiet by default.
const ENTRIES: LabEntry[] = [];

export default function LabIndexScreen() {
  return (
    <View style={styles.container}>
      <ScreenHeader variant="back" title="Lab" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.disclaimer}>
          Dev-only prototypes. Nothing here ships without being promoted out.
        </Text>

        {ENTRIES.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="flask-outline" size={32} color={alpha(colors.white, 0.25)} />
            <Text style={styles.emptyTitle}>No active prototypes</Text>
            <Text style={styles.emptySubtitle}>
              Add a row to ENTRIES in{' '}
              <Text style={styles.mono}>app/lab/index.tsx</Text>
              {' '}when spinning up the next experiment.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: layout.screenPadding,
    gap: spacing.lg,
  },
  disclaimer: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: alpha(colors.white, 0.4),
    lineHeight: 18,
  },
  emptyWrap: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xxl,
    paddingHorizontal: layout.screenPadding,
    backgroundColor: alpha(colors.white, 0.03),
    borderRadius: borderRadius.default,
    borderWidth: 1,
    borderColor: alpha(colors.white, 0.06),
  },
  emptyTitle: {
    fontSize: 15,
    fontFamily: fonts.semibold,
    color: alpha(colors.white, 0.6),
  },
  emptySubtitle: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: alpha(colors.white, 0.35),
    textAlign: 'center',
    lineHeight: 18,
  },
  mono: {
    fontFamily: fonts.semibold,
    color: alpha(colors.white, 0.55),
  },
});
