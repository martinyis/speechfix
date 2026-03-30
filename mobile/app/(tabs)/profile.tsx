import { View, Text, StyleSheet } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { colors, alpha, spacing, fonts } from '../../theme';
import { useAuthStore } from '../../stores/authStore';
import { ScreenHeader, GlassCard, GlassIconPillButton } from '../../components/ui';

export default function ProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const queryClient = useQueryClient();

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

          {user?.name ? (
            <>
              <Text style={[styles.label, { marginTop: spacing.lg }]}>Name</Text>
              <Text style={styles.value}>{user.name}</Text>
            </>
          ) : null}
        </GlassCard>

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
  logoutWrap: {
    marginTop: spacing.xl,
  },
});
