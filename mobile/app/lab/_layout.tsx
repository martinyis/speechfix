import { Stack } from 'expo-router';
import { colors } from '../../theme';

export default function LabLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.onSurface,
        contentStyle: { backgroundColor: colors.background },
        headerShown: false,
      }}
    />
  );
}
