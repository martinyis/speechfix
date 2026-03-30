import { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';

import { SessionRowVariantC as SessionRow } from '../components/session-variants/VariantC';
import { ScreenHeader, EmptyState } from '../components/ui';
import { useSessions } from '../hooks/useSessions';
import { colors, alpha, fonts } from '../theme';
import type { SessionListItem } from '../types/session';

// ---------------------------------------------------------------------------
// Date grouping
// ---------------------------------------------------------------------------

type DateGroup = {
  label: string;
  sessions: SessionListItem[];
};

function groupSessionsByDate(sessions: SessionListItem[]): DateGroup[] {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 86_400_000);
  const weekStart = new Date(
    todayStart.getTime() - todayStart.getDay() * 86_400_000,
  );

  const groups: Record<string, SessionListItem[]> = {};
  const order: string[] = [];

  for (const s of sessions) {
    const d = new Date(s.createdAt);
    let label: string;

    if (d >= todayStart) {
      label = 'Today';
    } else if (d >= yesterdayStart) {
      label = 'Yesterday';
    } else if (d >= weekStart) {
      label = 'This Week';
    } else {
      label = d.toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric',
      });
    }

    if (!groups[label]) {
      groups[label] = [];
      order.push(label);
    }
    groups[label].push(s);
  }

  return order.map((label) => ({ label, sessions: groups[label] }));
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function AllSessionsScreen() {
  const insets = useSafeAreaInsets();
  const { data: sessions, isLoading, refetch } = useSessions();

  useFocusEffect(useCallback(() => { refetch(); }, []));

  // Date-grouped sessions
  const dateGroups = useMemo(
    () => groupSessionsByDate(sessions ?? []),
    [sessions],
  );

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const hasSessions = (sessions?.length ?? 0) > 0;

  return (
    <View style={styles.container}>
      <ScreenHeader variant="back" title="Sessions" />

      {!hasSessions ? (
        <EmptyState
          fullScreen
          icon="chatbubbles-outline"
          iconColor={alpha(colors.primary, 0.3)}
          title="No sessions yet"
          subtitle="Start a practice session to see your history here"
        />
      ) : (
        <Animated.ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        >
          {/* ── Grouped session list ──────────────────────────── */}
          <View style={styles.listSection}>
            {dateGroups.map((group, gi) => (
              <Animated.View
                key={group.label}
                entering={FadeInDown.duration(300).delay(gi * 80)}
              >
                {/* Date divider */}
                <View style={styles.dateLabelRow}>
                  <View style={styles.dateLine} />
                  <Text style={styles.dateLabel}>{group.label}</Text>
                  <View style={styles.dateLine} />
                </View>

                {/* Session rows — identical to home screen */}
                {group.sessions.map((item) => (
                  <SessionRow key={item.id} item={item} />
                ))}
              </Animated.View>
            ))}
          </View>
        </Animated.ScrollView>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── List ────────────────────────────────────────────────────────────────
  listSection: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  dateLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 20,
    marginBottom: 14,
  },
  dateLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: alpha(colors.white, 0.08),
  },
  dateLabel: {
    fontSize: 11,
    fontFamily: fonts.semibold,
    color: alpha(colors.white, 0.3),
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
});
