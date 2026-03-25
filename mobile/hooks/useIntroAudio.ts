import { useState, useRef, useCallback, useEffect } from 'react';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { authFetch, API_BASE_URL } from '../lib/api';

interface Segment {
  text: string;
  startMs: number;
  endMs: number;
}

export function useIntroAudio() {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [totalDurationMs, setTotalDurationMs] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visibleText, setVisibleText] = useState<string[]>([]);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(-1);

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const mountedRef = useRef(true);
  const playStartedRef = useRef(false);

  // Create audio player with the WAV stream URL
  const player = useAudioPlayer(`${API_BASE_URL}/intro-audio/stream`);
  const status = useAudioPlayerStatus(player);

  // Fetch segment metadata on mount
  useEffect(() => {
    let cancelled = false;

    async function fetchMeta() {
      try {
        const res = await authFetch('/intro-audio');
        if (!res.ok) throw new Error('Failed to fetch intro metadata');
        const data = await res.json();
        if (cancelled) return;
        setSegments(data.segments);
        setTotalDurationMs(data.totalDurationMs);
        setIsLoading(false);
      } catch {
        if (cancelled) return;
        setIsLoading(false);
        setError('Failed to load intro');
      }
    }

    fetchMeta();
    return () => { cancelled = true; };
  }, []);

  // Detect playback completion
  useEffect(() => {
    if (playStartedRef.current && !status.playing && status.currentTime > 0) {
      setIsComplete(true);
    }
  }, [status.playing, status.currentTime]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  const play = useCallback(() => {
    if (segments.length === 0) return;

    playStartedRef.current = true;
    setIsComplete(false);
    setVisibleText([]);
    setCurrentSegmentIndex(-1);

    player.play();

    // Schedule segment reveals
    const newTimers: ReturnType<typeof setTimeout>[] = [];
    segments.forEach((seg, index) => {
      const timer = setTimeout(() => {
        if (!mountedRef.current) return;
        setVisibleText((prev) => [...prev, seg.text]);
        setCurrentSegmentIndex(index);
      }, seg.startMs);
      newTimers.push(timer);
    });
    timersRef.current = newTimers;
  }, [segments, player]);

  const skip = useCallback(() => {
    clearTimers();
    player.pause();
    setIsComplete(true);
  }, [clearTimers, player]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimers();
    };
  }, [clearTimers]);

  return {
    isLoading,
    isPlaying: status.playing,
    isComplete,
    error,
    visibleText,
    currentSegmentIndex,
    segments,
    play,
    skip,
  };
}
