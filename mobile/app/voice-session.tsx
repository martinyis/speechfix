import { useEffect, useRef, useCallback, useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Text,
  Animated,
  AppState,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { ExpoPlayAudioStream, PlaybackModes } from '@mykin-ai/expo-audio-stream';

const SERVER_URL = __DEV__
  ? 'ws://10.183.25.195:3005'
  : 'ws://localhost:3005';

type SessionState = 'connecting' | 'listening' | 'thinking' | 'speaking' | 'analyzing' | 'done';

export default function VoiceSessionScreen() {
  const wsRef = useRef<WebSocket | null>(null);
  const subscriptionRef = useRef<{ remove: () => void } | null>(null);
  const [sessionState, setSessionState] = useState<SessionState>('connecting');
  const [isMuted, setIsMuted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startTimeRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const turnIdRef = useRef(0);
  const firstAudioTimeRef = useRef(0);
  const turnAudioBytesRef = useRef(0);
  const playbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doneRef = useRef(false);

  // Pulse animation for the indicator
  useEffect(() => {
    if (sessionState === 'speaking') {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
      return () => animation.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [sessionState]);

  // Elapsed time counter
  useEffect(() => {
    if (sessionState === 'listening' || sessionState === 'thinking' || sessionState === 'speaking') {
      if (!startTimeRef.current) {
        startTimeRef.current = Date.now();
      }
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
  }, [sessionState]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const startSession = useCallback(async () => {
    try {
      // Request mic permissions
      const { granted } = await ExpoPlayAudioStream.requestPermissionsAsync();
      if (!granted) {
        console.error('[voice-session] Mic permission denied');
        router.back();
        return;
      }

      // Connect WebSocket
      const ws = new WebSocket(SERVER_URL + '/voice-session');
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[voice-session] WebSocket connected');
        ws.send(JSON.stringify({ type: 'start' }));
      };

      ws.onmessage = async (event) => {
        try {
          const message = JSON.parse(event.data);

          switch (message.type) {
            case 'ready':
              console.log('[DEBUG] Received ready, starting mic');
              setSessionState('listening');
              startMicrophone();
              break;
            case 'audio': {
              if (doneRef.current) break;
              // Track first audio time and bytes for playback estimation
              if (firstAudioTimeRef.current === 0) {
                firstAudioTimeRef.current = Date.now();
              }
              const rawBytes = Math.ceil((message.data?.length ?? 0) * 3 / 4);
              turnAudioBytesRef.current += rawBytes;
              // Use server-provided turnId for stream identification
              const streamId = String(message.turnId ?? turnIdRef.current);
              try {
                await ExpoPlayAudioStream.playSound(message.data, streamId, 'pcm_s16le');
              } catch (e) {
                console.warn('[DEBUG] playSound error:', e);
              }
              break;
            }
            case 'audio_end': {
              if (doneRef.current) break;
              // All audio has been sent for this turn.
              // Estimate remaining playback time before transitioning to 'listening'.
              // PCM 16kHz 16-bit mono = 32000 bytes/sec.
              const totalBytes = message.totalAudioBytes ?? 0;
              const totalDurationMs = (totalBytes / 32000) * 1000;
              const elapsedSinceFirst = firstAudioTimeRef.current > 0
                ? Date.now() - firstAudioTimeRef.current
                : 0;
              const remainingMs = Math.max(0, totalDurationMs - elapsedSinceFirst + 500);
              console.log(`[DEBUG] audio_end: ${totalBytes}b, total=${Math.round(totalDurationMs)}ms, elapsed=${Math.round(elapsedSinceFirst)}ms, wait=${Math.round(remainingMs)}ms`);

              // Clear any previous playback timer
              if (playbackTimerRef.current) clearTimeout(playbackTimerRef.current);
              playbackTimerRef.current = setTimeout(() => {
                setSessionState('listening');
                playbackTimerRef.current = null;
              }, remainingMs);
              break;
            }
            case 'turn_state':
              console.log(`[DEBUG] turn_state: ${message.state}, turnId=${message.turnId}`);
              if (message.state === 'speaking') {
                setSessionState('speaking');
                turnIdRef.current = message.turnId ?? turnIdRef.current + 1;
                firstAudioTimeRef.current = 0;
                turnAudioBytesRef.current = 0;
                // Cancel any pending playback timer from previous turn
                if (playbackTimerRef.current) {
                  clearTimeout(playbackTimerRef.current);
                  playbackTimerRef.current = null;
                }
              }
              // For 'listening' — don't immediately transition UI; wait for audio_end + playback timer.
              // Only apply if server sends 'listening' without an audio_end (e.g., empty response).
              if (message.state === 'listening' && turnAudioBytesRef.current === 0 && !playbackTimerRef.current) {
                setSessionState('listening');
              }
              break;
            case 'agent_speaking':
              // Legacy compat — prefer turn_state. Still handle for backward compat.
              if (message.speaking) {
                setSessionState('speaking');
                turnIdRef.current++;
              }
              break;
            case 'session_end':
              console.log('[DEBUG] Received session_end');
              if (playbackTimerRef.current) clearTimeout(playbackTimerRef.current);
              setSessionState('done');
              if (message.results) {
                router.replace({
                  pathname: '/results',
                  params: {
                    sessionId: String(message.dbSessionId ?? ''),
                    sentences: JSON.stringify(message.results.sentences ?? []),
                    corrections: JSON.stringify(message.results.corrections ?? []),
                    fillerWords: JSON.stringify(message.results.fillerWords ?? []),
                    fillerPositions: JSON.stringify(message.results.fillerPositions ?? []),
                    sessionInsights: JSON.stringify(message.results.sessionInsights ?? []),
                  },
                });
              } else {
                router.back();
              }
              break;
            case 'mute_state':
              setIsMuted(message.muted);
              break;
            case 'error':
              console.error('[voice-session] Server error:', message.message);
              break;
          }
        } catch (err) {
          console.error('[voice-session] Error parsing message:', err);
        }
      };

      ws.onerror = (err) => {
        console.error('[voice-session] WebSocket error:', err);
      };

      ws.onclose = () => {
        console.log('[voice-session] WebSocket closed');
      };
    } catch (err) {
      console.error('[voice-session] Failed to start session:', err);
      router.back();
    }
  }, []);

  const startMicrophone = async () => {
    try {
      // Configure sound for conversation mode AFTER mic permission is granted
      // This sets up iOS audio session for simultaneous record + playback with echo cancellation
      await ExpoPlayAudioStream.setSoundConfig({
        sampleRate: 16000,
        playbackMode: PlaybackModes.CONVERSATION,
      });

      const { recordingResult, subscription } = await ExpoPlayAudioStream.startRecording({
        sampleRate: 16000,
        channels: 1,
        encoding: 'pcm_16bit',
        interval: 100,
        onAudioStream: async (event) => {
          const ws = wsRef.current;
          if (ws?.readyState === WebSocket.OPEN && event.data) {
            ws.send(JSON.stringify({
              type: 'audio',
              data: event.data,
            }));
          }
        },
      });

      subscriptionRef.current = subscription ?? null;
      console.log('[voice-session] Mic started:', recordingResult.fileUri);
    } catch (err) {
      console.error('[voice-session] Failed to start mic:', err);
    }
  };

  const handleDone = async () => {
    console.log(`[DEBUG] handleDone() called on client, sessionState=${sessionState}`);
    doneRef.current = true;
    setSessionState('analyzing');

    // Cancel playback timer
    if (playbackTimerRef.current) {
      clearTimeout(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }

    // Stop mic
    try {
      await ExpoPlayAudioStream.stopRecording();
    } catch {}
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;

    // Stop any playing audio
    try {
      await ExpoPlayAudioStream.stopAudio();
    } catch {}

    // Tell server we're done
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'done' }));
    }

    // Timer cleanup
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const handleMuteToggle = async () => {
    const ws = wsRef.current;
    if (ws?.readyState !== WebSocket.OPEN) return;

    const newMuted = !isMuted;
    setIsMuted(newMuted);
    ws.send(JSON.stringify({ type: newMuted ? 'mute' : 'unmute' }));

    // If muting while AI is speaking, stop audio playback locally
    if (newMuted && sessionState === 'speaking') {
      try {
        await ExpoPlayAudioStream.stopAudio();
      } catch {}
    }
  };

  // Start session on mount
  useEffect(() => {
    startSession();

    return () => {
      // Cleanup on unmount
      ExpoPlayAudioStream.stopRecording().catch(() => {});
      ExpoPlayAudioStream.stopAudio().catch(() => {});
      subscriptionRef.current?.remove();
      const ws = wsRef.current;
      if (ws?.readyState === WebSocket.OPEN) {
        ws.close();
      }
      if (timerRef.current) clearInterval(timerRef.current);
      if (playbackTimerRef.current) clearTimeout(playbackTimerRef.current);
    };
  }, []);

  // Handle app backgrounding
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      console.log(`[DEBUG] AppState changed to: ${state}, sessionState=${sessionState}`);
      if (state === 'background' && sessionState !== 'done') {
        console.log(`[DEBUG] App went to background, calling handleDone`);
        handleDone();
      }
    });
    return () => sub.remove();
  }, [sessionState]);

  const indicatorColor =
    isMuted ? '#9C27B0' :
    sessionState === 'speaking' ? '#4CAF50' :
    sessionState === 'thinking' ? '#FFC107' :
    sessionState === 'listening' ? '#2196F3' :
    sessionState === 'analyzing' ? '#FF9800' :
    '#666';

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Elapsed time */}
      <Text style={styles.timer}>{formatTime(elapsed)}</Text>

      {/* Mode toggle */}
      {sessionState !== 'done' && sessionState !== 'connecting' && sessionState !== 'analyzing' && (
        <View style={styles.modeToggle}>
          <Pressable
            style={[
              styles.modeSegment,
              styles.modeSegmentLeft,
              !isMuted && styles.modeSegmentActiveDialog,
            ]}
            onPress={() => isMuted && handleMuteToggle()}
          >
            <Text style={[styles.modeSegmentText, !isMuted && styles.modeSegmentTextActive]}>
              Dialog
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.modeSegment,
              styles.modeSegmentRight,
              isMuted && styles.modeSegmentActiveSpeech,
            ]}
            onPress={() => !isMuted && handleMuteToggle()}
          >
            <Text style={[styles.modeSegmentText, isMuted && styles.modeSegmentTextActive]}>
              Speech
            </Text>
          </Pressable>
        </View>
      )}

      {/* Center indicator */}
      <View style={styles.center}>
        <Animated.View
          style={[
            styles.indicator,
            {
              backgroundColor: indicatorColor,
              transform: [{ scale: pulseAnim }],
            },
          ]}
        />
        <Text style={styles.stateLabel}>
          {sessionState === 'connecting' ? 'Connecting...' :
           isMuted ? 'Free Speaking' :
           sessionState === 'listening' ? 'Listening' :
           sessionState === 'thinking' ? 'Thinking' :
           sessionState === 'speaking' ? 'Speaking' :
           sessionState === 'analyzing' ? 'Analyzing...' :
           'Done'}
        </Text>
      </View>

      {/* Done button */}
      {sessionState !== 'done' && sessionState !== 'connecting' && sessionState !== 'analyzing' && (
        <Pressable style={styles.doneButton} onPress={handleDone}>
          <Text style={styles.doneText}>Done</Text>
        </Pressable>
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
  timer: {
    position: 'absolute',
    top: 80,
    color: '#666',
    fontSize: 18,
    fontVariant: ['tabular-nums'],
  },
  center: {
    alignItems: 'center',
    gap: 24,
  },
  indicator: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  stateLabel: {
    color: '#888',
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  modeToggle: {
    position: 'absolute',
    top: 120,
    flexDirection: 'row',
    backgroundColor: '#222',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#333',
    overflow: 'hidden',
  },
  modeSegment: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  modeSegmentLeft: {
    borderTopLeftRadius: 19,
    borderBottomLeftRadius: 19,
  },
  modeSegmentRight: {
    borderTopRightRadius: 19,
    borderBottomRightRadius: 19,
  },
  modeSegmentActiveDialog: {
    backgroundColor: '#2196F3',
  },
  modeSegmentActiveSpeech: {
    backgroundColor: '#9C27B0',
  },
  modeSegmentText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
  modeSegmentTextActive: {
    color: '#fff',
  },
  doneButton: {
    position: 'absolute',
    bottom: 80,
    backgroundColor: '#333',
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 30,
  },
  doneText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
