import { ScrollView, View, StyleSheet, Text } from 'react-native';
import { ScreenHeader } from '../../components/ui';
import { AgentAvatar } from '../../components/AgentAvatar';
import { ALL_AVATAR_IDS } from '../../lib/avatars';
import { colors, spacing, typography } from '../../theme';

const PREVIEW_SIZES = [88, 56, 40, 28];

export default function PatternsScreen() {
  return (
    <View style={styles.container}>
      <ScreenHeader variant="large" title="Patterns" />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>Agent Avatars</Text>

        <View style={styles.grid}>
          {ALL_AVATAR_IDS.map((id) => (
            <View key={id} style={styles.avatarColumn}>
              {PREVIEW_SIZES.map((size) => (
                <AgentAvatar key={size} seed={id} size={size} />
              ))}
              <Text style={styles.idLabel}>{id}</Text>
            </View>
          ))}
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
  },
  sectionTitle: {
    ...typography.headlineSm,
    color: colors.onSurface,
    marginBottom: spacing.xl,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xl,
    justifyContent: 'center',
  },
  avatarColumn: {
    alignItems: 'center',
    gap: spacing.md,
  },
  idLabel: {
    ...typography.labelSm,
    color: colors.onSurfaceVariant,
    marginTop: spacing.xs,
  },
  bottomSpacer: {
    height: 120,
  },
});
