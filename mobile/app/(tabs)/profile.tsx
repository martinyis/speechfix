import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { colors, alpha, spacing, borderRadius, glass } from '../../theme';
import { useAuthStore } from '../../stores/authStore';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const queryClient = useQueryClient();

  const handleLogout = async () => {
    queryClient.clear();
    await clearAuth();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 24 }]}>
      <Text style={styles.title}>Profile</Text>

      <View style={[styles.card, glass.card]}>
        <Text style={styles.label}>Email</Text>
        <Text style={styles.value}>{user?.email ?? '—'}</Text>

        {user?.name ? (
          <>
            <Text style={[styles.label, { marginTop: spacing.lg }]}>Name</Text>
            <Text style={styles.value}>{user.name}</Text>
          </>
        ) : null}
      </View>

      <Pressable style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Log Out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.onSurface,
    letterSpacing: -0.5,
    marginBottom: spacing.xl,
  },
  card: {
    padding: spacing.xl,
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
  logoutButton: {
    marginTop: spacing.xl,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.error,
    paddingVertical: 14,
    alignItems: 'center',
  },
  logoutText: {
    color: colors.error,
    fontSize: 16,
    fontWeight: '600',
  },
});
