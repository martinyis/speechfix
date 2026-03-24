# Implementation Plan: Auth Screen Redesign + Onboarding Bug Fix

## Overview

Two tasks:
1. **Fix onboarding redirect loop** — onboarding shows every app open instead of only after first signup
2. **Redesign auth screens** — login/signup look generic, need premium Vibrant Glass treatment

---

## Task 1: Fix Onboarding Redirect Loop

### Root Cause

`mobile/app/_layout.tsx` lines 28-36 aggressively redirects ANY authenticated user with `onboardingComplete: false` to onboarding on every app open:

```tsx
// Branch A (line 29): user in auth group with incomplete onboarding → forced to onboarding
} else if (token && inAuthGroup) {
  if (user && !user.onboardingComplete) {
    router.replace('/(onboarding)');
  } else {
    router.replace('/(tabs)');
  }
// Branch B (line 34): user anywhere else with incomplete onboarding → forced to onboarding
} else if (token && !inOnboardingGroup && user && !user.onboardingComplete) {
  router.replace('/(onboarding)');
}
```

If a user signs up but doesn't finish onboarding (closes app, error, voice session fails), they're trapped forever.

### Fix 1.1: Simplify routing in `mobile/app/_layout.tsx`

Replace the useEffect routing logic (lines 20-37) with:

```tsx
useEffect(() => {
  if (!isReady || !navigationState?.key) return;

  const inAuthGroup = segments[0] === '(auth)';

  if (!token && !inAuthGroup) {
    // Not logged in → go to login
    router.replace('/(auth)/login');
  } else if (token && inAuthGroup) {
    // Logged in but in auth screens → go to main app
    router.replace('/(tabs)');
  }
}, [token, isReady, segments, navigationState]);
```

**Key changes:**
- Remove Branch A's onboarding check — token + inAuthGroup always goes to `/(tabs)`
- Remove Branch B entirely — no more forced onboarding redirect from anywhere
- Remove `user` from dependency array — routing only depends on auth state
- The signup flow (`signup.tsx` line 56) already navigates to onboarding explicitly via `router.replace('/(onboarding)')`, so new users still get onboarded

### Fix 1.2: Add "Skip for now" to onboarding screen

**File:** `mobile/app/(onboarding)/index.tsx`

Add a skip handler:

```tsx
const handleSkip = useCallback(() => {
  useAuthStore.getState().setOnboardingComplete();
  router.replace('/(tabs)');
}, []);
```

Add skip button in the intro mode section, just above the "I'd rather type" link (around line 192):

```tsx
<Pressable onPress={handleSkip} style={styles.skipLink}>
  <Text style={styles.skipLinkText}>Skip for now</Text>
</Pressable>
```

Add styles:
```tsx
skipLink: {
  paddingVertical: 8,
  marginBottom: 8,
},
skipLinkText: {
  fontSize: 14,
  color: alpha(colors.white, 0.25),
  textDecorationLine: 'underline',
},
```

### Fix 1.3: (Optional) Enhance server status endpoint

**File:** `server/src/routes/onboarding.ts`

Add `displayName` to the status response for future use:

```tsx
const [user] = await db
  .select({
    onboardingComplete: users.onboardingComplete,
    displayName: users.displayName,
  })
  .from(users)
  .where(eq(users.id, request.user.userId));

return {
  onboardingComplete: user?.onboardingComplete ?? false,
  displayName: user?.displayName ?? null,
};
```

And in `mobile/stores/authStore.ts` loadToken (line 72-75), also store displayName:

```tsx
set((state) => ({
  user: state.user
    ? {
        ...state.user,
        onboardingComplete: data.onboardingComplete,
        displayName: data.displayName ?? state.user.displayName,
      }
    : null,
  isReady: true,
}));
```

---

## Task 2: Redesign Auth Screens

### Current Problems
- Login screen says "Reframe" (should be "Reflexa")
- Square buttons/inputs (`borderRadius: 8px`) instead of pill shape (`32px`)
- No typography tokens — hardcoded fontSize/fontWeight
- No animations, no hero element, no visual flair
- Generic copy ("Speak with clarity")
- No icons in inputs
- No glow/gradient effects

### Design System Reference

All tokens are in `mobile/theme/index.ts`. Key imports:
```tsx
import { colors, alpha, spacing, borderRadius, glass, shadows, typography } from '../../theme';
```

**Key tokens to use:**
- `typography.displayMd` — app title (36px, Manrope 800, letterSpacing -1.25)
- `typography.bodyMd` — subtitle (15px, Inter 400)
- `borderRadius.lg` — 32px, pill shape for buttons and inputs
- `shadows.glow` — purple glow shadow for primary button
- `glass.card` — glassmorphic card for form container
- `colors.primary` (#cc97ff), `colors.secondary` (#699cff) — gradient colors

**Available dependencies (verified in package.json):**
- `@react-native-masked-view/masked-view`: 0.3.2
- `expo-linear-gradient`: ^55.0.9
- `@shopify/react-native-skia`: 2.4.18 (for MicBloomOrb)
- `Ionicons` from `@expo/vector-icons`

### Step 2.1: Create `GradientText` component

**New file:** `mobile/components/GradientText.tsx`

```tsx
import React from 'react';
import { Text, TextStyle } from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';

interface GradientTextProps {
  text: string;
  style: TextStyle;
  colors: string[];
  start?: { x: number; y: number };
  end?: { x: number; y: number };
}

export function GradientText({ text, style, colors, start, end }: GradientTextProps) {
  return (
    <MaskedView maskElement={<Text style={[style, { backgroundColor: 'transparent' }]}>{text}</Text>}>
      <LinearGradient
        colors={colors}
        start={start ?? { x: 0, y: 0 }}
        end={end ?? { x: 1, y: 0 }}
      >
        <Text style={[style, { opacity: 0 }]}>{text}</Text>
      </LinearGradient>
    </MaskedView>
  );
}
```

### Step 2.2: Redesign `mobile/app/(auth)/login.tsx`

**Target layout:**
```
[Safe area top + 40px]
[MicBloomOrb — absolute, behind everything, 35% opacity, pointerEvents: none]
[GradientText "Reflexa" — purple→blue gradient, displayMd typography]
["Precision speech coaching" — bodyMd, 50% white]
[Spacer]
[Glass card]
  [Email input — pill shape, mail-outline icon]
  [Password input — pill shape, lock-closed-outline icon]
  [Error text if any]
  [Primary pill button "Log In" — purple bg, glow shadow, spring press animation]
[/Glass card]
["Don't have an account? Sign Up" — bottom link]
```

**Full replacement for login.tsx:**

```tsx
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
import { Ionicons } from '@expo/vector-icons';
import MicBloomOrb from '../../components/MicBloomOrb';
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

      await useAuthStore.getState().setAuth(data.token, data.user);
      router.replace('/(tabs)');
    } catch {
      setError('Network error. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top + 40 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Ambient orb background */}
      <View style={styles.orbBackground} pointerEvents="none">
        <MicBloomOrb />
      </View>

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
        style={[styles.card, glass.card]}
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
            placeholderTextColor={alpha(colors.white, 0.3)}
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
            placeholderTextColor={alpha(colors.white, 0.3)}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <AnimatedPressable
          style={[styles.button, buttonAnimStyle, loading && styles.buttonDisabled]}
          onPress={handleLogin}
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

      <Animated.View entering={FadeInDown.delay(400).duration(500)}>
        <Pressable onPress={() => router.push('/(auth)/signup')} style={styles.switchRow}>
          <Text style={styles.switchText}>
            Don't have an account?{' '}
            <Text style={styles.switchLink}>Sign Up</Text>
          </Text>
        </Pressable>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 24,
  },
  orbBackground: {
    position: 'absolute',
    top: -80,
    left: 0,
    right: 0,
    alignItems: 'center',
    opacity: 0.35,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    ...typography.displayMd,
    color: colors.onSurface,
  },
  subtitle: {
    ...typography.bodyMd,
    color: alpha(colors.white, 0.5),
    marginTop: 6,
  },
  card: {
    padding: spacing.xl,
    gap: spacing.lg,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerHigh,
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
    fontSize: 15,
    color: colors.onSurface,
  },
  error: {
    color: colors.error,
    fontSize: 13,
    textAlign: 'center',
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: spacing.sm,
    ...shadows.glow,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: colors.black,
    fontSize: 16,
    fontWeight: '700',
  },
  switchRow: {
    marginTop: spacing.xl,
    alignItems: 'center',
  },
  switchText: {
    color: alpha(colors.white, 0.5),
    fontSize: 14,
  },
  switchLink: {
    color: colors.primary,
    fontWeight: '600',
  },
});
```

### Step 2.3: Redesign `mobile/app/(auth)/signup.tsx`

Same pattern as login, with these differences:
- Three inputs: person-outline (Name), mail-outline (Email), lock-closed-outline (Password)
- Button text: "Create Account"
- Subtitle: "Create your account"
- Keep navigation to `/(onboarding)` on success (line 56)
- Keep validation (password min 8 chars)

Follow the exact same structure as login.tsx above — gradient title, orb background, pill inputs with icons, animated button, staggered FadeInDown.

---

## Verification Checklist

1. **New signup flow**: Sign up → onboarding shows → complete → tabs (unchanged)
2. **Signup then close app mid-onboarding**: Sign up → onboarding → close app → reopen → lands on `/(tabs)`, NOT onboarding (bug fixed)
3. **Login with incomplete onboarding**: Log in → lands on `/(tabs)` (bug fixed)
4. **Login with complete onboarding**: Log in → lands on `/(tabs)` (unchanged)
5. **Skip onboarding**: Sign up → onboarding intro → "Skip for now" → tabs (new feature)
6. **Visual**: Auth screens show gradient title, ambient orb, pill inputs/buttons, entry animations
7. **Name**: Login screen says "Reflexa" not "Reframe"

## Files to Modify

| File | Task | Action |
|------|------|--------|
| `mobile/app/_layout.tsx` | Bug fix | Simplify routing, remove onboarding guards |
| `mobile/app/(onboarding)/index.tsx` | Bug fix | Add "Skip for now" button |
| `server/src/routes/onboarding.ts` | Bug fix | Add displayName to status response |
| `mobile/stores/authStore.ts` | Bug fix | Store displayName from status |
| `mobile/components/GradientText.tsx` | Redesign | New component |
| `mobile/app/(auth)/login.tsx` | Redesign | Full redesign |
| `mobile/app/(auth)/signup.tsx` | Redesign | Full redesign |

## Implementation Order

1. Task 1 (bug fix) first — smaller, higher user impact
2. Task 2 (redesign) second — larger scope, benefits from having bug fix in place
