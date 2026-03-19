import { useState, useCallback, useRef, useEffect } from 'react';
import {
  useAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';
import type { RecordingStatus } from 'expo-audio';

const METERING_INTERVAL_MS = 100;
const MAX_METERING_VALUES = 50;

export function useRecording() {
  const [isRecording, setIsRecording] = useState(false);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [meteringValues, setMeteringValues] = useState<number[]>([]);

  const meteringIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const permissionGrantedRef = useRef(false);

  const recorder = useAudioRecorder(
    {
      ...RecordingPresets.HIGH_QUALITY,
      isMeteringEnabled: true,
    },
    (status: RecordingStatus) => {
      // Status listener for recording updates
      if (status.isRecording === false && isRecording) {
        // Recording stopped externally (interruption, etc.)
      }
    }
  );

  // Request permissions on mount
  useEffect(() => {
    async function requestPermissions() {
      const { granted } = await requestRecordingPermissionsAsync();
      permissionGrantedRef.current = granted;
    }
    requestPermissions();
  }, []);

  const startRecording = useCallback(async () => {
    if (!permissionGrantedRef.current) {
      const { granted } = await requestRecordingPermissionsAsync();
      permissionGrantedRef.current = granted;
      if (!granted) return;
    }

    setAudioUri(null);
    setMeteringValues([]);

    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });

    await recorder.prepareToRecordAsync({
      ...RecordingPresets.HIGH_QUALITY,
      isMeteringEnabled: true,
    });
    recorder.record();
    setIsRecording(true);

    // Start metering interval
    meteringIntervalRef.current = setInterval(() => {
      const state = recorder.getStatus();
      if (state.metering !== undefined) {
        setMeteringValues((prev) => {
          const next = [...prev, state.metering!];
          return next.length > MAX_METERING_VALUES
            ? next.slice(next.length - MAX_METERING_VALUES)
            : next;
        });
      }
    }, METERING_INTERVAL_MS);
  }, [recorder]);

  const stopRecording = useCallback(async () => {
    // Clear metering interval
    if (meteringIntervalRef.current) {
      clearInterval(meteringIntervalRef.current);
      meteringIntervalRef.current = null;
    }

    await recorder.stop();
    setIsRecording(false);
    setAudioUri(recorder.uri);
    setDuration(recorder.currentTime);
  }, [recorder]);

  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (meteringIntervalRef.current) {
        clearInterval(meteringIntervalRef.current);
      }
    };
  }, []);

  return {
    isRecording,
    startRecording,
    stopRecording,
    audioUri,
    duration,
    meteringValues,
  };
}
