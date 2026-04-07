import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WeakSpotCard } from './WeakSpotCard';
import { QuickFixCard } from './QuickFixCard';
import { SwipeToDismiss } from '../ui/SwipeToDismiss';
import { authFetch } from '../../lib/api';
import { colors, alpha, fonts, spacing, layout } from '../../theme';
import type { WeakSpot, QuickFix } from '../../types/practice';

interface WeakSpotsModeProps {
  weakSpots: WeakSpot[];
  backlogCount: number;
  quickFixes: QuickFix[];
  onRefresh?: () => void;
}

export function WeakSpotsMode({ weakSpots, backlogCount, quickFixes, onRefresh }: WeakSpotsModeProps) {
  const hasWeakSpots = weakSpots.length > 0;
  const hasQuickFixes = quickFixes.length > 0;

  if (!hasWeakSpots && !hasQuickFixes) {
    return (
      <View style={styles.emptyWrap}>
        <Ionicons name="checkmark-circle-outline" size={48} color={alpha(colors.severityPolish, 0.5)} />
        <Text style={styles.emptyTitle}>All caught up</Text>
        <Text style={styles.emptySubtitle}>
          Keep talking to surface weak spots for targeted practice.
        </Text>
      </View>
    );
  }

  const handleDismiss = async (id: number) => {
    try {
      await authFetch(`/practice/weak-spots/${id}/dismiss`, { method: 'POST' });
      onRefresh?.();
    } catch {}
  };

  const handleQuickFixDismiss = async (correctionId: number) => {
    try {
      await authFetch(`/practice/weak-spots/quick-fix/${correctionId}/dismiss`, { method: 'POST' });
      onRefresh?.();
    } catch {}
  };

  return (
    <View style={styles.container}>
      {/* Weak Spots section */}
      {hasWeakSpots && (
        <>
          <Text style={styles.sectionLabel}>WEAK SPOTS</Text>
          <View style={styles.cardList}>
            {weakSpots.slice(0, 3).map((ws) => (
              <WeakSpotCard key={ws.id} weakSpot={ws} onDismiss={handleDismiss} />
            ))}
          </View>
          {backlogCount > 0 && (
            <Text style={styles.backlogText}>+{backlogCount} more in queue</Text>
          )}
        </>
      )}

      {/* Divider between sections */}
      {hasWeakSpots && hasQuickFixes && (
        <View style={styles.divider} />
      )}

      {/* Quick Fixes section */}
      {hasQuickFixes && (
        <>
          <Text style={styles.sectionLabel}>QUICK FIXES</Text>
          <View style={styles.cardList}>
            {quickFixes.map((qf) => (
              <SwipeToDismiss key={qf.id} onDismiss={() => handleQuickFixDismiss(qf.id)}>
                <QuickFixCard quickFix={qf} />
              </SwipeToDismiss>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  sectionLabel: {
    fontSize: 10,
    fontFamily: fonts.bold,
    color: alpha(colors.white, 0.2),
    letterSpacing: 1.5,
    paddingHorizontal: layout.screenPadding,
    marginBottom: 12,
  },
  cardList: {
    paddingHorizontal: layout.screenPadding,
    gap: 10,
  },
  backlogText: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: alpha(colors.white, 0.2),
    paddingHorizontal: layout.screenPadding,
    marginTop: 8,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: alpha(colors.white, 0.06),
    marginHorizontal: layout.screenPadding,
    marginVertical: spacing.xl,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 100,
    gap: spacing.sm,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: fonts.semibold,
    color: colors.onSurface,
    marginTop: spacing.sm,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: alpha(colors.white, 0.35),
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 20,
  },
});
