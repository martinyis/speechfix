import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeInDown,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { GradientText } from '../../components/GradientText';
import {
  colors,
  alpha,
  spacing,
  borderRadius,
  glass,
  shadows,
  typography,
} from '../../theme';
import { API_BASE_URL } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const buttonScale = useSharedValue(1);

  const buttonAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const handlePressIn = useCallback(() => {
    buttonScale.value = withSpring(0.97, { damping: 15, stiffness: 300 });
  }, []);

  const handlePressOut = useCallback(() => {
    buttonScale.value = withSpring(1, { damping: 15, stiffness: 300 });
  }, []);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError('Please fill in all fields');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Login failed');
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await useAuthStore.getState().setAuth(data.token, data.user);
      router.replace('/(tabs)');
    } catch {
      setError('Network error. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      {/* Ambient gradient glow */}
      <LinearGradient
        colors={[alpha(colors.primary, 0.20), alpha(colors.secondary, 0.08), 'transparent']}
        style={styles.ambientGlow}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      <KeyboardAvoidingView
        style={[styles.container, { paddingTop: insets.top + 60 }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.content}>
          <Animated.View
            entering={FadeInDown.delay(100).duration(500)}
            style={styles.header}
          >
            <GradientText
              text="Reflexa"
              style={styles.title}
              colors={[colors.primary, colors.secondary]}
            />
            <Text style={styles.subtitle}>Precision speech coaching</Text>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(250).duration(500)}
            style={[styles.card, glass.cardElevated]}
          >
            <View style={styles.inputRow}>
              <Ionicons
                name="mail-outline"
                size={20}
                color={alpha(colors.white, 0.35)}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor={alpha(colors.white, 0.15)}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputRow}>
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color={alpha(colors.white, 0.35)}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor={alpha(colors.white, 0.15)}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <AnimatedPressable
              style={[styles.button, buttonAnimStyle, loading && styles.buttonDisabled]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                handleLogin();
              }}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.black} />
              ) : (
                <Text style={styles.buttonText}>Log In</Text>
              )}
            </AnimatedPressable>
          </Animated.View>
        </View>

        <Animated.View entering={FadeInDown.delay(400).duration(500)}>
          <Pressable
            onPress={() => router.push('/(auth)/signup')}
            style={styles.switchRow}
          >
            <Text style={styles.switchText}>
              Don't have an account?{' '}
              <Text style={styles.switchLink}>Sign Up</Text>
            </Text>
          </Pressable>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  ambientGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 360,
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing.xl,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  title: {
    ...typography.displayMd,
    color: colors.onSurface,
  },
  subtitle: {
    ...typography.bodyMd,
    color: alpha(colors.white, 0.5),
    marginTop: spacing.sm,
  },
  card: {
    padding: spacing.xl,
    gap: spacing.lg,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: alpha(colors.white, 0.05),
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: alpha(colors.white, 0.08),
    paddingHorizontal: spacing.lg,
  },
  inputIcon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    ...typography.bodyMd,
    color: colors.onSurface,
  },
  error: {
    ...typography.bodySm,
    color: colors.error,
    textAlign: 'center',
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    marginTop: spacing.sm,
    ...shadows.glow,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    ...typography.bodyMdMedium,
    color: colors.black,
  },
  switchRow: {
    paddingBottom: spacing.xxl,
    alignItems: 'center',
  },
  switchText: {
    ...typography.bodyMd,
    color: alpha(colors.white, 0.5),
  },
  switchLink: {
    color: colors.primary,
    fontWeight: '600',
  },
});
