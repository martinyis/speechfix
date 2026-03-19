import { View, StyleSheet } from 'react-native';

const MAX_BAR_HEIGHT = 80;
const BAR_WIDTH = 4;
const BAR_GAP = 2;

interface WaveformProps {
  meteringValues: number[];
  isActive: boolean;
}

function normalizeMetering(value: number): number {
  // Metering values from expo-audio are in dBFS (typically -160 to 0)
  // Normalize to a bar height between 4px and MAX_BAR_HEIGHT
  return Math.max(((value + 160) / 160) * MAX_BAR_HEIGHT, 4);
}

export function Waveform({ meteringValues, isActive }: WaveformProps) {
  if (!isActive) {
    return null;
  }

  return (
    <View style={styles.container}>
      {meteringValues.map((value, index) => (
        <View
          key={index}
          style={[
            styles.bar,
            { height: normalizeMetering(value) },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  bar: {
    width: BAR_WIDTH,
    marginHorizontal: BAR_GAP / 2,
    backgroundColor: '#fff',
    opacity: 0.8,
    borderRadius: 2,
  },
});
