import { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { useRecording } from '../hooks/useRecording';
import { useUpload } from '../hooks/useUpload';
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

  const upload = useUpload();
  const [statusText, setStatusText] = useState('Uploading...');
  const wasRecordingRef = useRef(false);

  const handlePress = async () => {
    if (isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  };

  // Track recording state transitions
  useEffect(() => {
    wasRecordingRef.current = isRecording;
  }, [isRecording]);

  // Auto-upload when audioUri becomes available after recording stops
  useEffect(() => {
    if (audioUri && !isRecording) {
      setStatusText('Uploading...');
      upload.mutate({ audioUri, duration });
    }
  }, [audioUri]);

  // Switch status text after a delay to simulate stage progression
  useEffect(() => {
    if (upload.isPending) {
      setStatusText('Uploading...');
      const timer = setTimeout(() => {
        setStatusText('Transcribing...');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [upload.isPending]);

  // Handle upload success -- navigate to results
  useEffect(() => {
    if (upload.isSuccess && upload.data) {
      const session = upload.data.session;
      if (session) {
        router.push({
          pathname: '/results',
          params: {
            transcription: JSON.stringify(session.sentences || []),
            sessionId: String(session.id),
          },
        });
      } else {
        // No speech detected case
        router.push({
          pathname: '/results',
          params: {
            transcription: JSON.stringify([]),
          },
        });
      }
      upload.reset();
    }
  }, [upload.isSuccess, upload.data]);

  // Handle upload error
  useEffect(() => {
    if (upload.isError) {
      Alert.alert('Upload Error', upload.error?.message || 'Something went wrong');
      upload.reset();
    }
  }, [upload.isError]);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.waveformArea}>
        <Waveform meteringValues={meteringValues} isActive={isRecording} />
      </View>
      <RecordButton isRecording={isRecording} onPress={handlePress} />
      <View style={styles.bottomSpace} />

      {upload.isPending && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>{statusText}</Text>
        </View>
      )}
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
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 16,
  },
});
