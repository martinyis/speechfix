import { useEffect } from 'react';
import { Stack, router, useSegments, useRootNavigationState } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { colors } from '../theme';
import { useAuthStore } from '../stores/authStore';

const queryClient = new QueryClient();

export default function RootLayout() {
  const { token, user, isReady, isSigningUp, loadToken } = useAuthStore();
  const segments = useSegments();
  const navigationState = useRootNavigationState();

  useEffect(() => {
    loadToken();
  }, []);

  useEffect(() => {
    if (!isReady || !navigationState?.key) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboarding = segments[0] === '(onboarding)';

    if (!token && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (token && inAuthGroup && isSigningUp) {
      router.replace('/(onboarding)');
    } else if (token && inAuthGroup && !isSigningUp) {
      router.replace('/(tabs)');
    } else if (token && inOnboarding && !isSigningUp) {
      console.log('[onboarding] Root layout redirecting to tabs — isSigningUp:', isSigningUp);
      router.replace('/(tabs)');
    }
  }, [token, user, isReady, isSigningUp, segments, navigationState]);

  if (!isReady) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <BottomSheetModalProvider>
          <StatusBar style="light" />
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
          </Stack>
        </BottomSheetModalProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
