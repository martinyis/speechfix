import { View, Text, StyleSheet } from 'react-native';
import { colors, alpha, fonts, spacing, layout } from '../theme';
import type { SessionInsight } from '../types/session';

interface Props {
  insights: SessionInsight[];
}

/**
 * Renders `strength` + `focus_area` insights as bulleted-dot lines.
 * Hidden entirely when neither exists.
 */
export function SessionStrengthsFocus({ insights }: Props) {
  const strengths = insights.filter(i => i.type === 'strength');
  const focusAreas = insights.filter(i => i.type === 'focus_area');

  if (strengths.length === 0 && focusAreas.length === 0) return null;

  return (
    <View style={styles.container}>
      {strengths.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Strengths</Text>
          {strengths.map((s, i) => (
            <View key={`s-${i}`} style={styles.line}>
              <View style={[styles.dot, { backgroundColor: colors.severityPolish }]} />
              <Text style={styles.text}>{s.description}</Text>
            </View>
          ))}
        </View>
      )}

      {focusAreas.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Focus areas</Text>
          {focusAreas.map((f, i) => (
            <View key={`f-${i}`} style={styles.line}>
              <View style={[styles.dot, { backgroundColor: colors.secondary }]} />
              <Text style={styles.text}>{f.description}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
  },
  section: {
    gap: spacing.sm,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: fonts.bold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: alpha(colors.white, 0.35),
    marginBottom: 2,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  text: {
    flex: 1,
    fontSize: 14,
    fontFamily: fonts.regular,
    color: alpha(colors.white, 0.6),
    lineHeight: 20,
  },
});
