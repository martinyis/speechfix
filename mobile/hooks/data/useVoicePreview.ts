import { useState, useCallback, useEffect, useRef } from 'react';
import { createAudioPlayer } from 'expo-audio';
import type { AudioPlayer } from 'expo-audio/build/AudioModule.types';
import { API_BASE_URL } from '../../lib/api';

export function useVoicePreview() {
  const [activeVoiceId, setActiveVoiceId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const playerRef = useRef<AudioPlayer | null>(null);
  const listenerRef = useRef<{ remove: () => void } | null>(null);
  const autoPlayedRef = useRef(false);

  const destroyPlayer = useCallback(() => {
    listenerRef.current?.remove();
    listenerRef.current = null;
    try {
      playerRef.current?.pause();
      playerRef.current?.remove();
    } catch { /* native player may already be released */ }
    playerRef.current = null;
    autoPlayedRef.current = false;
    setIsPlaying(false);
  }, []);

  useEffect(() => {
    return () => destroyPlayer();
  }, [destroyPlayer]);

  const toggle = useCallback(
    (voiceId: string) => {
      // Same voice — toggle pause/play
      if (activeVoiceId === voiceId && playerRef.current) {
        if (playerRef.current.playing) {
          playerRef.current.pause();
          setIsPlaying(false);
          setActiveVoiceId(null);
        } else {
          playerRef.current.play();
          setIsPlaying(true);
        }
        return;
      }

      // Different voice — destroy old player, create new one with downloadFirst
      destroyPlayer();
      setActiveVoiceId(voiceId);
      setIsLoading(true);
      autoPlayedRef.current = false;

      const url = `${API_BASE_URL}/voices/${voiceId}/sample`;
      const newPlayer = createAudioPlayer(url, { downloadFirst: true });
      playerRef.current = newPlayer;

      const subscription = newPlayer.addListener('playbackStatusUpdate', (status) => {
        // Auto-play once after loading completes
        if (status.isLoaded && !autoPlayedRef.current) {
          autoPlayedRef.current = true;
          setIsLoading(false);
          setIsPlaying(true);
          newPlayer.play();
          return;
        }

        if (status.didJustFinish) {
          setActiveVoiceId(null);
          setIsPlaying(false);
        } else {
          setIsPlaying(status.playing);
        }
      });
      listenerRef.current = subscription;
    },
    [activeVoiceId, destroyPlayer],
  );

  const stop = useCallback(() => {
    destroyPlayer();
    setActiveVoiceId(null);
    setIsLoading(false);
  }, [destroyPlayer]);

  return {
    activeVoiceId,
    isLoading,
    isPlaying,
    toggle,
    stop,
  };
}
