import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { GlassIconPillButton } from './ui';
import { colors, alpha, fonts, spacing, layout, glass } from '../theme';
import type { FillerWord } from '../types/session';

interface FillerWordsSummaryProps {
  fillerWords: FillerWord[];
  durationSeconds: number;
}

export function FillerWordsSummary({
  fillerWords,
  durationSeconds,
}: FillerWordsSummaryProps) {
  if (fillerWords.length === 0) return null;

  const totalCount = fillerWords.reduce((sum, f) => sum + f.count, 0);
  const minutes = durationSeconds / 60;
  const ratePerMin = minutes > 0 ? +(totalCount / minutes).toFixed(1) : 0;
  const isHigh = totalCount >= 5;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerLabel}>FILLER WORDS</Text>
        {isHigh && (
          <View style={styles.highBadge}>
            <Text style={styles.highBadgeText}>High</Text>
          </View>
        )}
      </View>

      <View style={styles.card}>
        {/* Word chips */}
        <View style={styles.chipsRow}>
          {fillerWords.map((f) => (
            <View key={f.word} style={styles.chip}>
              <Text style={styles.chipText}>
                "{f.word}" <Text style={styles.chipCount}>×{f.count}</Text>
              </Text>
            </View>
          ))}
        </View>

        {/* Rate */}
        <Text style={styles.rateText}>
          {ratePerMin} fillers per minute
        </Text>

        {/* Practice button */}
        <View style={styles.buttonWrap}>
          <GlassIconPillButton
            label="Practice"
            icon="chatbubbles-outline"
            variant="secondary"
            small
            onPress={() => router.push('/filler-coach')}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: layout.screenPadding,
    marginBottom: 12,
  },
  headerLabel: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: alpha(colors.white, 0.25),
    letterSpacing: 1.2,
  },
  highBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: alpha(colors.severityError, 0.12),
  },
  highBadgeText: {
    fontSize: 10,
    fontFamily: fonts.bold,
    color: colors.severityError,
    letterSpacing: 0.3,
  },
  card: {
    marginHorizontal: layout.screenPadding,
    padding: spacing.lg,
    ...glass.card,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: spacing.md,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: alpha(colors.white, 0.05),
    borderWidth: 1,
    borderColor: alpha(colors.white, 0.08),
  },
  chipText: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: alpha(colors.white, 0.6),
  },
  chipCount: {
    fontFamily: fonts.bold,
    color: alpha(colors.white, 0.4),
  },
  rateText: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: alpha(colors.white, 0.35),
    marginBottom: spacing.md,
  },
  buttonWrap: {
    alignItems: 'flex-start',
  },
});
