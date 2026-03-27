import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  colors,
  alpha,
  spacing,
  borderRadius,
  typography,
} from '../../theme';
import { API_BASE_URL } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { GlassIconPillButton } from '../../components/ui';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

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
      {/* Purple bloom: diagonal from top-right */}
      <LinearGradient
        colors={[alpha(colors.primary, 0.30), alpha(colors.primaryDim, 0.12), 'transparent']}
        style={styles.bloomDiagonal}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
      />
      {/* Purple bloom: top fade */}
      <LinearGradient
        colors={[alpha(colors.primary, 0.15), 'transparent']}
        style={styles.bloomTop}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 24 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* App icon + name */}
          <Animated.View
            entering={FadeInDown.delay(50).duration(500)}
            style={styles.iconWrap}
          >
            <Image
              source={require('../../assets/images/app-icon.png')}
              style={styles.appIcon}
            />
            <Text style={styles.appName}>Reflexa</Text>
          </Animated.View>

          {/* Title + subtitle */}
          <Animated.View
            entering={FadeInDown.delay(150).duration(500)}
            style={styles.header}
          >
            <Text style={styles.title}>Sign In To Your Account.</Text>
            <Text style={styles.subtitle}>
              Precision speech coaching powered by AI.
            </Text>
          </Animated.View>

          {/* Form */}
          <Animated.View
            entering={FadeInDown.delay(250).duration(500)}
            style={styles.form}
          >
            {/* Email */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email</Text>
              <View style={styles.inputWrap}>
                <TextInput
                  style={styles.input}
                  placeholder="alma.lawson@example.com"
                  placeholderTextColor={alpha(colors.white, 0.2)}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoCorrect={false}
                />
              </View>
            </View>

            {/* Password */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputWrap}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  placeholder="••••••••"
                  placeholderTextColor={alpha(colors.white, 0.2)}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <Pressable
                  onPress={() => setShowPassword((v) => !v)}
                  style={styles.eyeButton}
                  hitSlop={12}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={alpha(colors.white, 0.4)}
                  />
                </Pressable>
              </View>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            {/* Get Started button */}
            <GlassIconPillButton
              variant="primary"
              fullWidth
              label="Get Started"
              icon="arrow-forward"
              onPress={handleLogin}
              loading={loading}
            />

            {/* Remember me + Forgot password */}
            <View style={styles.optionsRow}>
              <Pressable
                onPress={() => setRememberMe((v) => !v)}
                style={styles.rememberRow}
                hitSlop={8}
              >
                <View
                  style={[
                    styles.checkbox,
                    rememberMe && styles.checkboxActive,
                  ]}
                >
                  {rememberMe && (
                    <Ionicons name="checkmark" size={12} color={colors.black} />
                  )}
                </View>
                <Text style={styles.rememberText}>Remember me</Text>
              </Pressable>
              <Pressable hitSlop={8}>
                <Text style={styles.forgotText}>Forgot password?</Text>
              </Pressable>
            </View>
          </Animated.View>

          {/* Or divider — glowing gradient lines */}
          <Animated.View
            entering={FadeInDown.delay(350).duration(500)}
            style={styles.dividerRow}
          >
            <LinearGradient
              colors={['transparent', alpha(colors.primary, 0.35)]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.dividerLine}
            />
            <Text style={styles.dividerText}>Or</Text>
            <LinearGradient
              colors={[alpha(colors.primary, 0.35), 'transparent']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.dividerLine}
            />
          </Animated.View>

          {/* Social buttons */}
          <Animated.View
            entering={FadeInDown.delay(450).duration(500)}
            style={styles.socialSection}
          >
            <GlassIconPillButton
              variant="secondary"
              fullWidth
              label="Sign in with Google"
              icon="logo-google"
            />
            <GlassIconPillButton
              variant="secondary"
              fullWidth
              label="Continue with Apple"
              icon="logo-apple"
            />
          </Animated.View>

          {/* Bottom switch */}
          <Animated.View entering={FadeInDown.delay(550).duration(500)}>
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
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  bloomDiagonal: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: '100%',
    height: '60%',
  },
  bloomTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 300,
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
  },

  // Icon
  iconWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
    gap: spacing.md,
  },
  appIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
  },
  appName: {
    ...typography.headlineSm,
    color: colors.onSurface,
  },

  // Header
  header: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  title: {
    ...typography.headlineMd,
    color: colors.onSurface,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.bodySm,
    color: alpha(colors.white, 0.5),
    marginTop: spacing.sm,
    textAlign: 'center',
  },

  // Form
  form: {
    gap: spacing.lg,
  },
  fieldGroup: {
    gap: spacing.sm,
  },
  label: {
    ...typography.bodySm,
    color: alpha(colors.white, 0.6),
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: alpha(colors.white, 0.05),
    borderRadius: borderRadius.default,
    borderWidth: 1,
    borderColor: alpha(colors.white, 0.08),
    paddingHorizontal: spacing.lg,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    ...typography.bodyMd,
    color: colors.onSurface,
  },
  passwordInput: {
    paddingRight: spacing.xl,
  },
  eyeButton: {
    padding: spacing.xs,
  },
  error: {
    ...typography.bodySm,
    color: colors.error,
    textAlign: 'center',
  },

  // Options row
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: alpha(colors.white, 0.2),
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  rememberText: {
    ...typography.bodySm,
    color: alpha(colors.white, 0.5),
  },
  forgotText: {
    ...typography.bodySm,
    color: colors.primary,
  },

  // Divider
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.xl,
    gap: spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    ...typography.bodySm,
    color: alpha(colors.white, 0.3),
  },

  // Social buttons
  socialSection: {
    gap: spacing.md,
  },

  // Bottom switch
  switchRow: {
    paddingTop: spacing.xxl,
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
