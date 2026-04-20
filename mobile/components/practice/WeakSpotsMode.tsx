import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { GlassIconPillButton } from '../ui';
import { SwipeToDismiss } from '../ui/SwipeToDismiss';
import { authFetch } from '../../lib/api';
import { formatCorrectionTypeLabel } from '../../lib/wordDiff';
import { colors, alpha, fonts, typography, spacing, layout } from '../../theme';
import type { WeakSpot, QuickFix } from '../../types/practice';

interface WeakSpotsModeProps {
  weakSpots: WeakSpot[];
  backlogCount: number;
  quickFixes: QuickFix[];
  onRefresh?: () => void;
}

const SEVERITY_COLORS: Record<string, string> = {
  error: colors.severityError,
  improvement: colors.severityImprovement,
  polish: colors.severityPolish,
};

function severityColor(severity: string): string {
  return SEVERITY_COLORS[severity] ?? colors.severityError;
}

// ── SRS dots (4 total, filled up to current stage) ────────────────────
function SRSDots({ stage, size = 6 }: { stage: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {[0, 1, 2, 3].map((i) => (
        <View
          key={i}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: i <= stage ? colors.primary : alpha(colors.white, 0.1),
          }}
        />
      ))}
    </View>
  );
}

function nextReviewLabel(ws: WeakSpot): string {
  if (!ws.nextReviewAt) return 'soon';
  const target = new Date(ws.nextReviewAt);
  return target.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ── Dismiss helpers ───────────────────────────────────────────────────
export async function dismissWeakSpot(id: number) {
  try { await authFetch(`/practice/weak-spots/${id}/dismiss`, { method: 'POST' }); } catch {}
}

export async function dismissQuickFix(correctionId: number) {
  try { await authFetch(`/practice/weak-spots/quick-fix/${correctionId}/dismiss`, { method: 'POST' }); } catch {}
}

// ── Main ──────────────────────────────────────────────────────────────

export function WeakSpotsMode({ weakSpots, backlogCount, quickFixes, onRefresh }: WeakSpotsModeProps) {
  const due = weakSpots.filter((ws) => ws.isDue);
  const reviewing = weakSpots.filter((ws) => !ws.isDue);
  const hero = due[0];
  const others = due.slice(1);

  const hasAnything = weakSpots.length > 0 || quickFixes.length > 0;

  if (!hasAnything) {
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

  const statsParts: { value: number; label: string }[] = [
    { value: due.length, label: 'due' },
  ];
  if (backlogCount > 0) statsParts.push({ value: backlogCount, label: 'in backlog' });
  if (reviewing.length > 0) statsParts.push({ value: reviewing.length, label: 'reviewing' });

  const goToDrill = (id: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: '/weak-spot-drill', params: { weakSpotId: String(id) } });
  };

  const goToQuickFix = (id: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: '/practice-session',
      params: { correctionId: String(id), mode: 'say_it_right', fromList: 'true' },
    });
  };

  const confirmDismiss = (id: number) => {
    Alert.alert(
      'Dismiss Weak Spot',
      'This will remove it from your practice queue. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Dismiss',
          style: 'destructive',
          onPress: async () => {
            await dismissWeakSpot(id);
            onRefresh?.();
          },
        },
      ],
    );
  };

  const handleQuickFixSwipe = async (id: number) => {
    await dismissQuickFix(id);
    onRefresh?.();
  };

  return (
    <View style={styles.container}>
      <InlineStats parts={statsParts} />

      {/* Hero — first due weak spot */}
      {hero && (
        <Pressable style={styles.wsHero} onLongPress={() => confirmDismiss(hero.id)}>
          <View style={styles.wsHeroHeader}>
            <Text style={[styles.wsHeroType, { color: severityColor(hero.severity) }]} numberOfLines={1}>
              {formatCorrectionTypeLabel(hero.correctionType)}
            </Text>
            <SRSDots stage={hero.srsStage} size={8} />
          </View>
          <Text style={styles.wsHeroCount}>{hero.corrections.length} corrections</Text>
          {hero.corrections[0]?.originalText && (
            <Text style={styles.wsHeroExample} numberOfLines={2}>
              "{hero.corrections[0].originalText}"
            </Text>
          )}
          <GlassIconPillButton
            icon="play"
            label="Practice"
            variant="primary"
            fullWidth
            onPress={() => goToDrill(hero.id)}
          />
        </Pressable>
      )}

      {/* Other due spots — tappable compact rows */}
      {others.map((ws) => (
        <Pressable
          key={ws.id}
          style={styles.wsCompactRow}
          onPress={() => goToDrill(ws.id)}
          onLongPress={() => confirmDismiss(ws.id)}
        >
          <View style={[styles.severityDot, { backgroundColor: severityColor(ws.severity) }]} />
          <Text style={styles.wsCompactType} numberOfLines={1}>
            {formatCorrectionTypeLabel(ws.correctionType)}
          </Text>
          <View style={{ flex: 1 }} />
          <SRSDots stage={ws.srsStage} />
          <Ionicons name="chevron-forward" size={16} color={alpha(colors.white, 0.2)} />
        </Pressable>
      ))}

      {/* Quick fixes */}
      {quickFixes.length > 0 && (
        <>
          <View style={styles.divider} />
          <Text style={styles.sectionLabel}>QUICK FIXES</Text>
          {quickFixes.map((qf) => (
            <SwipeToDismiss key={qf.id} onDismiss={() => handleQuickFixSwipe(qf.id)}>
              <Pressable
                style={styles.qfRow}
                onPress={() => goToQuickFix(qf.id)}
              >
                <View style={styles.qfText}>
                  <Text style={styles.qfOriginal} numberOfLines={1}>
                    {qf.originalText}
                  </Text>
                  <Text style={styles.qfCorrected} numberOfLines={1}>
                    {qf.correctedText}
                  </Text>
                </View>
                <Text style={styles.qfType} numberOfLines={1}>
                  {formatCorrectionTypeLabel(qf.correctionType)}
                </Text>
                <Ionicons name="play-circle-outline" size={20} color={alpha(colors.white, 0.3)} />
              </Pressable>
            </SwipeToDismiss>
          ))}
        </>
      )}

      {/* Reviewing */}
      {reviewing.length > 0 && (
        <>
          <View style={styles.divider} />
          <Text style={styles.sectionLabel}>REVIEWING</Text>
          {reviewing.map((ws) => (
            <View key={ws.id} style={styles.wsReviewRow}>
              <Text style={styles.wsReviewType} numberOfLines={1}>
                {formatCorrectionTypeLabel(ws.correctionType)}
              </Text>
              <Text style={styles.wsReviewDate}>back {nextReviewLabel(ws)}</Text>
            </View>
          ))}
        </>
      )}
    </View>
  );
}

// ── InlineStats ───────────────────────────────────────────────────────

function InlineStats({ parts }: { parts: { value: number; label: string }[] }) {
  return (
    <Text style={styles.inlineStats}>
      {parts.map((p, i) => (
        <Text key={p.label}>
          {i > 0 && <Text style={styles.inlineStatsSep}> · </Text>}
          <Text style={styles.inlineStatsValue}>{p.value}</Text> {p.label}
        </Text>
      ))}
    </Text>
  );
}

// ── Styles ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: layout.screenPadding,
    gap: spacing.lg,
  },

  // Inline stats
  inlineStats: {
    ...typography.bodySm,
    color: alpha(colors.white, 0.35),
  },
  inlineStatsValue: {
    ...typography.bodySmMedium,
    color: alpha(colors.white, 0.5),
  },
  inlineStatsSep: {
    color: alpha(colors.white, 0.2),
  },

  // Section label
  sectionLabel: {
    fontSize: 10,
    fontFamily: fonts.bold,
    color: alpha(colors.white, 0.2),
    letterSpacing: 1.5,
  },

  // Divider
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: alpha(colors.white, 0.06),
  },

  // Severity dot
  severityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // Hero
  wsHero: {
    gap: spacing.sm,
  },
  wsHeroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  wsHeroType: {
    ...typography.headlineLg,
    flex: 1,
  },
  wsHeroCount: {
    ...typography.bodyMdMedium,
    color: alpha(colors.white, 0.5),
  },
  wsHeroExample: {
    ...typography.bodyMd,
    color: alpha(colors.white, 0.3),
    fontStyle: 'italic',
  },

  // Compact due rows
  wsCompactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  wsCompactType: {
    ...typography.bodyMdMedium,
    color: colors.onSurface,
  },

  // Quick fix rows
  qfRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: alpha(colors.white, 0.04),
  },
  qfText: {
    flex: 1,
    minWidth: 0,
  },
  qfOriginal: {
    ...typography.bodySm,
    color: alpha(colors.white, 0.35),
    textDecorationLine: 'line-through',
  },
  qfCorrected: {
    ...typography.bodySm,
    color: colors.severityPolish,
    marginTop: 2,
  },
  qfType: {
    ...typography.labelSm,
    color: alpha(colors.white, 0.25),
    maxWidth: 100,
  },

  // Reviewing rows
  wsReviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  wsReviewType: {
    ...typography.bodyMdMedium,
    color: alpha(colors.white, 0.4),
    flex: 1,
  },
  wsReviewDate: {
    ...typography.bodySm,
    color: alpha(colors.white, 0.25),
  },

  // Empty state
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
