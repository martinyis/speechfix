import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { colors, alpha } from '../theme';
import { formatTimeOfDay, formatDurationLong, truncateSnippet } from '../lib/formatters';
import type { SessionListItem } from '../types/session';

// -- Card icon variants --

const CARD_ICON_VARIANTS = [
  {
    colors: ['rgba(168,85,247,0.2)', 'rgba(59,130,246,0.2)'] as const,
    iconName: 'pulse' as const,
    iconColor: colors.primary,
  },
  {
    colors: ['rgba(236,72,153,0.2)', 'rgba(168,85,247,0.2)'] as const,
    iconName: 'document-text' as const,
    iconColor: colors.tertiary,
  },
  {
    colors: ['rgba(6,182,212,0.2)', 'rgba(59,130,246,0.2)'] as const,
    iconName: 'musical-notes' as const,
    iconColor: colors.secondary,
  },
];

function SessionCardIcon({ index }: { index: number }) {
  const variant = CARD_ICON_VARIANTS[index % CARD_ICON_VARIANTS.length];
  return (
    <LinearGradient
      colors={[...variant.colors] as [string, string]}
      start={{ x: 0, y: 1 }}
      end={{ x: 1, y: 0 }}
      style={styles.sessionCardIcon}
    >
      <Ionicons name={variant.iconName} size={20} color={variant.iconColor} />
    </LinearGradient>
  );
}

// -- Session row --

export function SessionRow({ item, index }: { item: SessionListItem; index: number }) {
  const totalCorrections = item.errorCount + item.improvementCount + item.polishCount;
  const fillerCount = item.totalFillerCount ?? 0;
  const snippet = item.transcriptSnippet
    ? truncateSnippet(item.transcriptSnippet, 60)
    : null;

  return (
    <Pressable
      style={styles.sessionRow}
      onPress={() =>
        router.push({
          pathname: '/session-detail',
          params: { sessionId: String(item.id) },
        })
      }
    >
      <SessionCardIcon index={index} />

      <View style={styles.content}>
        {/* Row 1: time + stats */}
        <View style={styles.firstLine}>
          <Text style={styles.sessionTime}>{formatTimeOfDay(item.createdAt)}</Text>
          <View style={styles.statsRight}>
            {totalCorrections > 0 ? (
              <Text style={styles.correctionCount}>
                {totalCorrections} correction{totalCorrections !== 1 ? 's' : ''}
              </Text>
            ) : (
              <View style={styles.cleanRow}>
                <Ionicons name="checkmark-circle" size={13} color={colors.severityPolish} />
                <Text style={styles.cleanText}>Clean</Text>
              </View>
            )}
            {fillerCount > 0 && (
              <>
                <Text style={styles.dotSeparator}>{'\u00B7'}</Text>
                <Text style={styles.fillerCount}>
                  {fillerCount} filler{fillerCount !== 1 ? 's' : ''}
                </Text>
              </>
            )}
          </View>
        </View>

        {/* Row 2: duration + chevron */}
        <View style={styles.secondLine}>
          <Text style={styles.sessionDuration}>{formatDurationLong(item.durationSeconds)}</Text>
          <Ionicons name="chevron-forward" size={18} color={alpha(colors.white, 0.15)} />
        </View>

        {/* Row 3: transcript snippet */}
        {snippet && (
          <Text style={styles.snippetText} numberOfLines={1}>
            {snippet}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: alpha(colors.white, 0.06),
    padding: 14,
    marginBottom: 8,
  },
  sessionCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    marginTop: 2,
    borderWidth: 1,
    borderColor: alpha(colors.white, 0.1),
  },
  content: {
    flex: 1,
  },

  // Row 1
  firstLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sessionTime: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.onSurface,
  },
  statsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  correctionCount: {
    fontSize: 12,
    fontWeight: '500',
    color: alpha(colors.white, 0.4),
  },
  cleanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  cleanText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.severityPolish,
  },
  dotSeparator: {
    fontSize: 12,
    color: alpha(colors.white, 0.2),
  },
  fillerCount: {
    fontSize: 12,
    fontWeight: '500',
    color: alpha(colors.white, 0.35),
  },

  // Row 2
  secondLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 3,
  },
  sessionDuration: {
    fontSize: 12,
    color: alpha(colors.white, 0.35),
  },

  // Row 3
  snippetText: {
    fontSize: 13,
    color: alpha(colors.white, 0.25),
    fontStyle: 'italic',
    marginTop: 6,
    lineHeight: 18,
  },
});
