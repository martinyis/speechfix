import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';

const queryClient = new QueryClient();

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#fff' },
          headerTintColor: '#000',
          contentStyle: { backgroundColor: '#fff' },
        }}
      >
        <Stack.Screen
          name="(tabs)"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="results"
          options={{ title: 'Results', presentation: 'card' }}
        />
        <Stack.Screen
          name="history-detail"
          options={{ title: 'Session', presentation: 'card' }}
        />
      </Stack>
    </QueryClientProvider>
  );
}
