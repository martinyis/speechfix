import { View, Text, StyleSheet } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { colors, alpha, spacing } from '../../theme';
import { useAuthStore } from '../../stores/authStore';
import { ScreenHeader, GlassCard, Button } from '../../components/ui';

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
          <Button
            variant="danger"
            label="Log Out"
            onPress={handleLogout}
            fullWidth
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
    fontWeight: '600',
    color: alpha(colors.white, 0.4),
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  value: {
    fontSize: 16,
    color: colors.onSurface,
    fontWeight: '500',
  },
  logoutWrap: {
    marginTop: spacing.xl,
  },
});
