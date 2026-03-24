import { View, Text, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, alpha } from '../theme';

interface SessionInsightCardProps {
  type: 'repetitive_word' | 'hedging_pattern' | 'discourse_pattern';
  description: string;
}

const TYPE_CONFIG: Record<
  string,
  { label: string; title: string; icon: keyof typeof Ionicons.glyphMap; impact: string }
> = {
  repetitive_word: {
    label: 'Repetitive Word',
    title: 'Word Repetition Detected',
    icon: 'refresh-outline',
    impact: 'Medium',
  },
  hedging_pattern: {
    label: 'Hedging Pattern',
    title: 'Hedging Language Detected',
    icon: 'help-circle-outline',
    impact: 'High',
  },
  discourse_pattern: {
    label: 'Discourse Pattern',
    title: 'Discourse Pattern Identified',
    icon: 'chatbubbles-outline',
    impact: 'Medium',
  },
};

export function SessionInsightCard({ type, description }: SessionInsightCardProps) {
  const config = TYPE_CONFIG[type] ?? {
    label: type,
    title: 'Insight',
    icon: 'bulb-outline' as keyof typeof Ionicons.glyphMap,
    impact: 'Medium',
  };

  return (
    <View style={styles.cardOuter}>
      {/* Background gradient glow */}
      <LinearGradient
        colors={[
          alpha(colors.primary, 0.06),
          alpha(colors.secondary, 0.06),
          alpha(colors.white, 0.02),
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientBg}
      />

      <View style={styles.cardContent}>
        {/* Top row: icon + labels */}
        <View style={styles.topRow}>
          {/* Icon in glass square */}
          <View style={styles.iconContainer}>
            <Ionicons name={config.icon} size={22} color={colors.primary} />
          </View>

          <View style={styles.labelColumn}>
            <View style={styles.labelRow}>
              <Text style={styles.sectionLabel}>DEEP INSIGHTS</Text>
              <View style={styles.impactBadge}>
                <Text style={styles.impactText}>
                  Confidence impact: {config.impact}
                </Text>
              </View>
            </View>
            <Text style={styles.insightTitle}>{config.title}</Text>
          </View>
        </View>

        {/* Description */}
        <Text style={styles.description}>{description}</Text>

        {/* Generate Drill button */}
        <Pressable style={styles.drillButton}>
          <Text style={styles.drillButtonText}>Generate Drill</Text>
          <Ionicons name="arrow-forward" size={14} color={colors.black} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardOuter: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: alpha(colors.white, 0.06),
  },
  gradientBg: {
    ...StyleSheet.absoluteFillObject,
  },
  cardContent: {
    padding: 20,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    marginBottom: 16,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: alpha(colors.white, 0.04),
    borderWidth: 1,
    borderColor: alpha(colors.white, 0.08),
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelColumn: {
    flex: 1,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
    flexWrap: 'wrap',
  },
  sectionLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: alpha(colors.white, 0.25),
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  impactBadge: {
    backgroundColor: alpha(colors.white, 0.05),
    borderRadius: 100,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  impactText: {
    fontSize: 9,
    fontWeight: '600',
    color: alpha(colors.white, 0.35),
  },
  insightTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: alpha(colors.white, 0.88),
    letterSpacing: -0.3,
  },
  description: {
    fontSize: 15,
    fontWeight: '300',
    color: colors.onSurfaceVariant,
    lineHeight: 24,
    marginBottom: 20,
  },
  drillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.onSurface,
    borderRadius: 100,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignSelf: 'flex-start',
  },
  drillButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.black,
    letterSpacing: -0.2,
  },
});
