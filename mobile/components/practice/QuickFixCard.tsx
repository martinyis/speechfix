import { View, Text, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import { colors, alpha, fonts } from '../../theme';
import { formatCorrectionTypeLabel } from '../../lib/wordDiff';
import type { QuickFix } from '../../types/practice';

const SEVERITY_COLORS: Record<string, string> = {
  error: colors.severityError,
  improvement: colors.severityImprovement,
  polish: colors.severityPolish,
};

interface QuickFixCardProps {
  quickFix: QuickFix;
}

export function QuickFixCard({ quickFix }: QuickFixCardProps) {
  const sevColor = SEVERITY_COLORS[quickFix.severity] ?? colors.severityError;

  const handlePractice = () => {
    router.push({
      pathname: '/practice-session',
      params: { correctionId: String(quickFix.id), mode: 'say_it_right', fromList: 'true' },
    });
  };

  return (
    <Pressable onPress={handlePractice} style={styles.card}>
      <View style={[styles.severityBar, { backgroundColor: sevColor }]} />
      <View style={styles.content}>
        <Text style={styles.correctedText} numberOfLines={2}>
          {quickFix.correctedText}
        </Text>
        <Text style={[styles.typeLabel, { color: alpha(sevColor, 0.8) }]}>
          {formatCorrectionTypeLabel(quickFix.correctionType)}
        </Text>
      </View>
      <View style={styles.practiceButton}>
        <Text style={styles.practiceText}>Practice</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: alpha(colors.white, 0.03),
    borderRadius: 12,
    overflow: 'hidden',
  },
  severityBar: {
    width: 3,
    alignSelf: 'stretch',
  },
  content: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 4,
  },
  correctedText: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: alpha(colors.white, 0.8),
    lineHeight: 20,
  },
  typeLabel: {
    fontSize: 10,
    fontFamily: fonts.bold,
    letterSpacing: 0.8,
  },
  practiceButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  practiceText: {
    fontSize: 12,
    fontFamily: fonts.semibold,
    color: colors.primary,
  },
});
