import { View, Text, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { colors, alpha, spacing, fonts } from '../../theme';
import { useAuthStore } from '../../stores/authStore';
import { ScreenHeader, GlassCard, GlassIconPillButton, SectionHeader } from '../../components/ui';

function GlassToggle({
  value,
  onToggle,
  label,
  description,
}: {
  value: boolean;
  onToggle: () => void;
  label: string;
  description: string;
}) {
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: withSpring(value ? 20 : 0, {
          damping: 15,
          stiffness: 200,
        }),
      },
    ],
  }));

  return (
    <Pressable style={styles.toggleRow} onPress={onToggle}>
      <View style={styles.toggleTextWrap}>
        <Text style={styles.toggleLabel}>{label}</Text>
        <Text style={styles.toggleDesc}>{description}</Text>
      </View>
      <Pressable onPress={onToggle} hitSlop={8}>
        <View style={[styles.track, value ? styles.trackOn : styles.trackOff]}>
          <Animated.View style={[styles.thumb, value ? styles.thumbOn : styles.thumbOff, thumbStyle]} />
        </View>
      </Pressable>
    </Pressable>
  );
}

export default function ProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const updateAnalysisFlags = useAuthStore((s) => s.updateAnalysisFlags);
  const queryClient = useQueryClient();

  const flags = user?.analysisFlags ?? { grammar: true, fillers: true, patterns: true };

  const handleLogout = async () => {
    queryClient.clear();
    await clearAuth();
  };

  return (
    <View style={styles.container}>
      <ScreenHeader variant="large" title="Profile" />

      <View style={styles.content}>
        <GlassCard style={{ padding: spacing.xl }}>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{user?.email ?? '—'}</Text>

          {user?.displayName ? (
            <>
              <Text style={[styles.label, { marginTop: spacing.lg }]}>Name</Text>
              <Text style={styles.value}>{user.displayName}</Text>
            </>
          ) : null}
        </GlassCard>

        <View style={styles.section}>
          <SectionHeader
            label="Analysis"
            subtitle="Choose what gets analyzed after each session"
            size="sm"
          />
          <GlassCard style={{ padding: spacing.lg, gap: spacing.md }}>
            <GlassToggle
              value={flags.grammar}
              onToggle={() => updateAnalysisFlags({ grammar: !flags.grammar })}
              label="Grammar & Naturalness"
              description="Corrections, severity, session insights"
            />
            <View style={styles.divider} />
            <GlassToggle
              value={flags.fillers}
              onToggle={() => updateAnalysisFlags({ fillers: !flags.fillers })}
              label="Filler Words"
              description="Tracks um, like, you know, etc."
            />
            <View style={styles.divider} />
            <GlassToggle
              value={flags.patterns ?? true}
              onToggle={() => updateAnalysisFlags({ patterns: !(flags.patterns ?? true) })}
              label="Speech Patterns"
              description="Cross-session habits like crutch phrases, overused words"
            />
          </GlassCard>
        </View>

        {__DEV__ && (
          <Pressable
            style={styles.labRow}
            onPress={() => router.push('/lab')}
          >
            <View style={styles.labIcon}>
              <Ionicons name="flask-outline" size={18} color={colors.primary} />
            </View>
            <View style={styles.labTextWrap}>
              <Text style={styles.labLabel}>Lab (dev)</Text>
              <Text style={styles.labDesc}>Prototypes, variants, design experiments</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={alpha(colors.white, 0.3)} />
          </Pressable>
        )}

        <View style={styles.logoutWrap}>
          <GlassIconPillButton
            variant="danger"
            fullWidth
            label="Log Out"
            icon="log-out-outline"
            onPress={handleLogout}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: 24,
    flex: 1,
  },
  label: {
    fontSize: 12,
    fontFamily: fonts.semibold,
    color: alpha(colors.white, 0.4),
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  value: {
    fontSize: 16,
    color: colors.onSurface,
    fontFamily: fonts.medium,
  },
  section: {
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  divider: {
    height: 1,
    backgroundColor: alpha(colors.white, 0.06),
  },
  logoutWrap: {
    marginTop: spacing.xl,
  },

  // Lab (dev-only)
  labRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: alpha(colors.primary, 0.05),
    borderWidth: 1,
    borderColor: alpha(colors.primary, 0.18),
    borderRadius: 16,
    marginTop: spacing.xl,
  },
  labIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: alpha(colors.primary, 0.12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  labTextWrap: {
    flex: 1,
    gap: 2,
  },
  labLabel: {
    fontSize: 15,
    fontFamily: fonts.semibold,
    color: colors.onSurface,
  },
  labDesc: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: alpha(colors.white, 0.4),
  },

  // Toggle
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
  toggleTextWrap: {
    flex: 1,
    gap: spacing.xxs,
  },
  toggleLabel: {
    fontSize: 15,
    fontFamily: fonts.semibold,
    color: colors.onSurface,
  },
  toggleDesc: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: alpha(colors.white, 0.35),
  },
  track: {
    width: 48,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  trackOff: {
    backgroundColor: alpha(colors.white, 0.1),
    borderColor: alpha(colors.white, 0.15),
  },
  trackOn: {
    backgroundColor: alpha(colors.primary, 0.35),
    borderColor: alpha(colors.primary, 0.5),
  },
  thumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  thumbOff: {
    backgroundColor: alpha(colors.white, 0.5),
  },
  thumbOn: {
    backgroundColor: colors.primary,
  },
});
