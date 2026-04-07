import { useEffect } from 'react';
import { Stack, router, useSegments, useRootNavigationState } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { colors } from '../theme';
import { useAuthStore } from '../stores/authStore';
import { useAppWarmup } from '../hooks/useAppWarmup';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function AppWarmup() {
  useAppWarmup();
  return null;
}

export default function RootLayout() {
  const { token, user, isReady, isSigningUp, loadToken } = useAuthStore();
  const segments = useSegments();
  const navigationState = useRootNavigationState();

  const [fontsLoaded] = useFonts({
    'MonaSans-Regular': require('../assets/fonts/MonaSans-Regular.ttf'),
    'MonaSans-Medium': require('../assets/fonts/MonaSans-Medium.ttf'),
    'MonaSans-SemiBold': require('../assets/fonts/MonaSans-SemiBold.ttf'),
    'MonaSans-Bold': require('../assets/fonts/MonaSans-Bold.ttf'),
    'MonaSans-ExtraBold': require('../assets/fonts/MonaSans-ExtraBold.ttf'),
  });

  useEffect(() => {
    loadToken();
  }, []);

  useEffect(() => {
    const inAuthGroup = segments[0] === '(auth)';
    const inOnboarding = segments[0] === '(onboarding)';

    console.log('[nav-guard] fired:', {
      token: !!token,
      inAuth: inAuthGroup,
      inOnboarding,
      isSigningUp,
      isReady,
      onboardingComplete: user?.onboardingComplete,
      segments: segments.join('/'),
      navReady: !!navigationState?.key,
    });

    if (!isReady || !navigationState?.key) return;

    if (!token && !inAuthGroup) {
      console.log('[nav-guard] ACTION: redirecting to /(auth)/login — no token');
      router.replace('/(auth)/login');
    } else if (token && inAuthGroup && isSigningUp) {
      console.log('[nav-guard] ACTION: redirecting to /(onboarding) — signing up');
      router.replace('/(onboarding)');
    } else if (token && inAuthGroup && !isSigningUp) {
      console.log('[nav-guard] ACTION: redirecting to /(tabs) from auth');
      router.replace('/(tabs)');
    } else if (token && inOnboarding && !isSigningUp) {
      console.log('[nav-guard] ACTION: redirecting to /(tabs) from onboarding — isSigningUp is false');
      router.replace('/(tabs)');
    }
  }, [token, user, isReady, isSigningUp, segments, navigationState]);

  useEffect(() => {
    if (isReady && fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [isReady, fontsLoaded]);

  if (!isReady || !fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <BottomSheetModalProvider>
          <StatusBar style="light" />
          {token && <AppWarmup />}
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: colors.background },
              headerTintColor: colors.onSurface,
              contentStyle: { backgroundColor: colors.background },
            }}
          >
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(onboarding)" options={{ headerShown: false, gestureEnabled: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="session-detail"
              options={{
                headerShown: false,
                presentation: 'card',
              }}
            />
            <Stack.Screen
              name="all-sessions"
              options={{
                headerShown: false,
                presentation: 'card',
              }}
            />
            <Stack.Screen
              name="agent-detail"
              options={{
                headerShown: false,
                presentation: 'card',
              }}
            />
            <Stack.Screen
              name="agent-create"
              options={{
                headerShown: false,
                presentation: 'card',
              }}
            />
            <Stack.Screen
              name="practice-session"
              options={{
                headerShown: false,
                presentation: 'card',
              }}
            />
            <Stack.Screen
              name="pattern-practice-session"
              options={{
                headerShown: false,
                presentation: 'card',
              }}
            />
            <Stack.Screen
              name="weak-spot-drill"
              options={{
                headerShown: false,
                presentation: 'card',
              }}
            />
            <Stack.Screen
              name="filler-coach"
              options={{
                headerShown: false,
                presentation: 'card',
              }}
            />
            <Stack.Screen
              name="filler-coach-results"
              options={{
                headerShown: false,
                presentation: 'card',
              }}
            />
          </Stack>
        </BottomSheetModalProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
