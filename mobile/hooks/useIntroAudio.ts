import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { authFetch, API_BASE_URL } from '../lib/api';

const TAG = '[useIntroAudio]';

interface Segment {
  text: string;
  startMs: number;
  endMs: number;
}

export function useIntroAudio() {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [totalDurationMs, setTotalDurationMs] = useState(0);
  const [metaLoaded, setMetaLoaded] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visibleText, setVisibleText] = useState<string[]>([]);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(-1);
  const [currentBatchIndices, setCurrentBatchIndices] = useState<number[]>([]);

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const mountedRef = useRef(true);
  const playStartedRef = useRef(false);

  // Create audio player — downloadFirst downloads via fetch (which handles HTTP fine)
  // then loads from local file, bypassing AVPlayer HTTP/ATS issues
  const audioUrl = `${API_BASE_URL}/intro-audio/stream`;
  console.log(TAG, 'Audio URL:', audioUrl);
  const player = useAudioPlayer(audioUrl, { downloadFirst: true });
  const status = useAudioPlayerStatus(player);

  // Log status changes for debugging
  useEffect(() => {
    console.log(TAG, 'Player status:', JSON.stringify({
      isLoaded: status.isLoaded,
      playing: status.playing,
      didJustFinish: status.didJustFinish,
      duration: status.duration,
      playbackState: status.playbackState,
    }));
  }, [status.isLoaded, status.playing, status.didJustFinish, status.duration, status.playbackState]);

  // Ensure volume is set
  useEffect(() => {
    if (player) {
      console.log(TAG, 'Player volume:', player.volume, '| muted:', player.muted);
      if (player.volume < 1) {
        player.volume = 1;
      }
      if (player.muted) {
        player.muted = false;
      }
    }
  }, [player]);

  // Fetch segment metadata on mount
  useEffect(() => {
    let cancelled = false;

    async function fetchMeta() {
      console.log(TAG, 'Fetching metadata from /intro-audio...');
      try {
        const res = await authFetch('/intro-audio');
        console.log(TAG, 'Metadata response:', res.status);
        if (!res.ok) {
          const body = await res.text();
          console.error(TAG, 'Metadata fetch failed:', res.status, body);
          throw new Error(`Failed to fetch intro metadata: ${res.status}`);
        }
        const data = await res.json();
        console.log(TAG, 'Metadata loaded:', data.segments?.length, 'segments,', data.totalDurationMs, 'ms');
        if (cancelled) return;
        setSegments(data.segments);
        setTotalDurationMs(data.totalDurationMs);
        setMetaLoaded(true);
      } catch (err) {
        console.error(TAG, 'Metadata fetch error:', err);
        if (cancelled) return;
        setError('Failed to load intro');
      }
    }

    fetchMeta();
    return () => { cancelled = true; };
  }, []);

  // Audio is ready when metadata is fetched and WAV is loaded
  const isLoading = !metaLoaded || !status.isLoaded;

  useEffect(() => {
    console.log(TAG, 'Ready check:', { metaLoaded, audioLoaded: status.isLoaded, isLoading });
  }, [metaLoaded, status.isLoaded, isLoading]);

  // Timeout: if audio never loads after 15s, show error
  useEffect(() => {
    if (status.isLoaded) return;
    const timeout = setTimeout(() => {
      if (!status.isLoaded && mountedRef.current) {
        console.error(TAG, 'Audio load timeout (15s) — player never loaded');
        setError('Audio failed to load. Check your connection.');
      }
    }, 15000);
    return () => clearTimeout(timeout);
  }, [status.isLoaded]);

  // Detect playback completion via didJustFinish
  useEffect(() => {
    if (playStartedRef.current && status.didJustFinish) {
      console.log(TAG, 'Playback finished');
      setIsComplete(true);
    }
  }, [status.didJustFinish]);

  // Each segment is its own batch — finest possible granularity
  const batches = useMemo(() => {
    return segments.map((_, i) => [i]);
  }, [segments]);

  // Map: segment index → position within its batch (for stagger delay)
  const segmentBatchPosition = useMemo(() => {
    const map: Record<number, number> = {};
    batches.forEach(b => {
      b.forEach((segIdx, pos) => { map[segIdx] = pos; });
    });
    return map;
  }, [batches]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  const play = useCallback(() => {
    console.log(TAG, 'play() called', { segments: segments.length, batches: batches.length, isLoaded: status.isLoaded });
    if (segments.length === 0 || !status.isLoaded) {
      console.warn(TAG, 'play() aborted — not ready');
      return;
    }

    playStartedRef.current = true;
    setIsComplete(false);
    setVisibleText([]);
    setCurrentSegmentIndex(-1);
    setCurrentBatchIndices([]);

    player.volume = 1;
    player.muted = false;

    console.log(TAG, 'Calling player.play()');
    player.play();

    // Schedule batch reveals (2-3 segments at a time)
    const newTimers: ReturnType<typeof setTimeout>[] = [];
    batches.forEach((batch) => {
      const triggerMs = segments[batch[0]].startMs;
      const timer = setTimeout(() => {
        if (!mountedRef.current) return;
        const newTexts = batch.map(i => segments[i].text);
        setVisibleText(prev => [...prev, ...newTexts]);
        setCurrentSegmentIndex(batch[batch.length - 1]);
        setCurrentBatchIndices(batch);
      }, triggerMs);
      newTimers.push(timer);
    });
    timersRef.current = newTimers;
  }, [segments, batches, player, status.isLoaded]);

  const skip = useCallback(() => {
    clearTimers();
    try { player.pause(); } catch { /* native player may already be released */ }
    setIsComplete(true);
  }, [clearTimers, player]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimers();
      try { player.pause(); } catch {}
    };
  }, [clearTimers, player]);

  return {
    isLoading,
    isPlaying: status.playing,
    isComplete,
    error,
    visibleText,
    currentSegmentIndex,
    currentBatchIndices,
    segmentBatchPosition,
    segments,
    play,
    skip,
  };
}
