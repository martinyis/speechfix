import { useMemo } from 'react';
import { View, Text, StyleSheet, Alert, Pressable } from 'react-native';
import { router } from 'expo-router';
import { colors, alpha, fonts, spacing, glass } from '../../theme';
import { GlassIconPillButton } from '../ui';
import { formatCorrectionTypeLabel } from '../../lib/wordDiff';
import type { WeakSpot } from '../../types/practice';

const SEVERITY_COLORS: Record<string, string> = {
  error: colors.severityError,
  improvement: colors.severityImprovement,
  polish: colors.severityPolish,
};

interface WeakSpotCardProps {
  weakSpot: WeakSpot;
  onDismiss?: (id: number) => void;
}

function getSrsLabel(ws: WeakSpot): { text: string; color: string } {
  if (ws.isDue) {
    return { text: 'DUE NOW', color: colors.tertiary };
  }
  if (ws.srsStage === 0) {
    return { text: 'NEW', color: colors.primary };
  }
  if (ws.nextReviewAt) {
    const diff = new Date(ws.nextReviewAt).getTime() - Date.now();
    const days = Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    return { text: `IN ${days} DAY${days === 1 ? '' : 'S'}`, color: alpha(colors.white, 0.35) };
  }
  return { text: 'REVIEW', color: colors.secondary };
}

export function WeakSpotCard({ weakSpot, onDismiss }: WeakSpotCardProps) {
  const srs = useMemo(() => getSrsLabel(weakSpot), [weakSpot]);
  const sevColor = SEVERITY_COLORS[weakSpot.severity] ?? colors.severityError;

  const handlePractice = () => {
    router.push({ pathname: '/weak-spot-drill', params: { weakSpotId: String(weakSpot.id) } });
  };

  const handleLongPress = () => {
    Alert.alert(
      'Dismiss Weak Spot',
      'This will remove it from your practice queue. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Dismiss', style: 'destructive', onPress: () => onDismiss?.(weakSpot.id) },
      ],
    );
  };

  const isDue = weakSpot.isDue;

  return (
    <Pressable
      onLongPress={handleLongPress}
      style={[styles.card, !isDue && styles.cardNotDue]}
    >
      <View style={styles.topRow}>
        <View style={styles.labelRow}>
          <Text style={[styles.typeLabel, { color: sevColor }]}>
            {formatCorrectionTypeLabel(weakSpot.correctionType)}
          </Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{weakSpot.corrections.length}</Text>
          </View>
        </View>
        <View style={[styles.srsPill, { borderColor: alpha(srs.color, 0.3) }]}>
          <Text style={[styles.srsText, { color: srs.color }]}>{srs.text}</Text>
        </View>
      </View>

      {isDue && (
        <GlassIconPillButton
          label="Practice"
          icon="play"
          variant="primary"
          fullWidth
          onPress={handlePractice}
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    ...glass.card,
    padding: 16,
    gap: 14,
  },
  cardNotDue: {
    opacity: 0.55,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  typeLabel: {
    fontSize: 15,
    fontFamily: fonts.semibold,
    letterSpacing: -0.2,
  },
  countBadge: {
    backgroundColor: alpha(colors.white, 0.08),
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  countText: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: alpha(colors.white, 0.45),
  },
  srsPill: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  srsText: {
    fontSize: 9,
    fontFamily: fonts.bold,
    letterSpacing: 0.8,
  },
});
