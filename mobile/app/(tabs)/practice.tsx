import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme';

export default function PracticeScreen() {
  return (
    <View style={styles.container}>
      <Ionicons name="barbell-outline" size={48} color={colors.onSurfaceVariant} />
      <Text style={styles.title}>Practice</Text>
      <Text style={styles.subtitle}>Exercises coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.onSurface,
  },
  subtitle: {
    fontSize: 14,
    color: colors.onSurfaceVariant,
  },
});
