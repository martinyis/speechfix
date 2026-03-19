import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';

const queryClient = new QueryClient();

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#000' },
          headerTintColor: '#fff',
          contentStyle: { backgroundColor: '#000' },
        }}
      >
        <Stack.Screen
          name="index"
          options={{ title: '', headerShown: false }}
        />
        <Stack.Screen
          name="results"
          options={{ title: 'Results', presentation: 'card' }}
        />
      </Stack>
    </QueryClientProvider>
  );
}
