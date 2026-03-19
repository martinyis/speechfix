import { View, Text, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';

export default function RecordScreen() {
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Text style={styles.placeholder}>Record Screen</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholder: {
    color: '#fff',
    fontSize: 18,
  },
});
