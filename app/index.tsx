import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRecording } from '../hooks/useRecording';
import { RecordButton } from '../components/RecordButton';
import { Waveform } from '../components/Waveform';

export default function RecordScreen() {
  const {
    isRecording,
    startRecording,
    stopRecording,
    audioUri,
    duration,
    meteringValues,
  } = useRecording();

  const handlePress = async () => {
    if (isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  };

  // Log recording result when a new audioUri is available
  useEffect(() => {
    if (audioUri) {
      console.log('[Reframe] Recording complete:', { audioUri, duration });
    }
  }, [audioUri, duration]);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.waveformArea}>
        <Waveform meteringValues={meteringValues} isActive={isRecording} />
      </View>
      <RecordButton isRecording={isRecording} onPress={handlePress} />
      <View style={styles.bottomSpace} />
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
  waveformArea: {
    height: 120,
    justifyContent: 'flex-end',
    marginBottom: 40,
  },
  bottomSpace: {
    height: 160,
  },
});
