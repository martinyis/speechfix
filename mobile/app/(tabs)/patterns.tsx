import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader, SectionHeader } from '../../components/ui';
import {
  SessionRowVariantA,
  SessionRowVariantB,
  SessionRowVariantC,
  SessionRowVariantD,
  SessionRowVariantE,
  MOCK_SESSIONS,
} from '../../components/session-variants';
import { colors, alpha, spacing } from '../../theme';

export default function PatternsScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <ScreenHeader variant="large" title="Variants" />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Variant A — Compact Metric Strip */}
        <SectionHeader label="A — Compact Metric Strip" size="sm" />
        <View style={styles.variantGroup}>
          {MOCK_SESSIONS.map((s) => (
            <SessionRowVariantA key={`a-${s.id}`} item={s} />
          ))}
        </View>

        <View style={styles.divider} />

        {/* Variant B — Bold Score Hero */}
        <SectionHeader label="B — Bold Score Hero" size="sm" />
        <View style={styles.variantGroup}>
          {MOCK_SESSIONS.map((s) => (
            <SessionRowVariantB key={`b-${s.id}`} item={s} />
          ))}
        </View>

        <View style={styles.divider} />

        {/* Variant C — Conversation Thread */}
        <SectionHeader label="C — Conversation Thread" size="sm" />
        <View style={styles.variantGroup}>
          {MOCK_SESSIONS.map((s) => (
            <SessionRowVariantC key={`c-${s.id}`} item={s} />
          ))}
        </View>

        <View style={styles.divider} />

        {/* Variant D — Minimal Timeline */}
        <SectionHeader label="D — Minimal Timeline" size="sm" />
        <View style={styles.variantGroup}>
          {MOCK_SESSIONS.map((s) => (
            <SessionRowVariantD key={`d-${s.id}`} item={s} />
          ))}
        </View>

        <View style={styles.divider} />

        {/* Variant E — Data Dashboard Card */}
        <SectionHeader label="E — Data Dashboard Card" size="sm" />
        <View style={styles.variantGroup}>
          {MOCK_SESSIONS.map((s) => (
            <SessionRowVariantE key={`e-${s.id}`} item={s} />
          ))}
        </View>
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
    paddingHorizontal: 20,
    gap: spacing.md,
  },
  variantGroup: {
    gap: spacing.sm,
  },
  divider: {
    height: 1,
    backgroundColor: alpha(colors.white, 0.06),
    marginVertical: spacing.lg,
  },
});
