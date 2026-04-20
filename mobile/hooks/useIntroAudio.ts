import { useState, useRef, useCallback, useEffect } from 'react';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Asset } from 'expo-asset';
import { ALL_WORDS, INTRO_SEGMENTS } from '../lib/introTimestamps';

const INTRO_AUDIO_MODULE = require('../assets/sounds/intro.wav');

export function useIntroAudio() {
  const [isComplete, setIsComplete] = useState(false);
  const [revealedWordCount, setRevealedWordCount] = useState(0);
  const [currentWordIndex, setCurrentWordIndex] = useState(-1);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(-1);
  const [audioSource, setAudioSource] = useState<{ uri: string } | null>(null);

  const mountedRef = useRef(true);
  const playStartedRef = useRef(false);
  const prevWordIndexRef = useRef(-1);
  const prevSegmentIndexRef = useRef(-1);
  const prevRevealedRef = useRef(0);

  // Dev builds don't bundle assets natively — expo-asset must download + cache first so we get a playable localUri
  useEffect(() => {
    (async () => {
      try {
        const asset = Asset.fromModule(INTRO_AUDIO_MODULE);
        if (!asset.localUri) {
          await asset.downloadAsync();
        }
        const uri = asset.localUri ?? asset.uri;
        if (mountedRef.current) setAudioSource({ uri });
      } catch (err) {
        console.error('[intro-audio] Asset load failed:', err);
      }
    })();
  }, []);

  const player = useAudioPlayer(audioSource);
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    if (player) {
      if (player.volume < 1) {
        player.volume = 1;
      }
      if (player.muted) {
        player.muted = false;
      }
    }
  }, [player]);

  const isLoading = !status.isLoaded;
  const error = null as string | null;

  // Detect playback completion via didJustFinish
  useEffect(() => {
    if (playStartedRef.current && status.didJustFinish) {
      console.log('[intro-audio] Complete');
      setIsComplete(true);
    }
  }, [status.didJustFinish]);

  // 50ms polling interval to track word reveal based on playback position
  useEffect(() => {
    if (!status.playing) return;

    const interval = setInterval(() => {
      if (!mountedRef.current) return;

      const currentTimeMs = (player.currentTime ?? 0) * 1000;
      if (currentTimeMs <= 0) return;

      // Find highest word index where startMs <= currentTimeMs
      let wordIdx = -1;
      for (let i = 0; i < ALL_WORDS.length; i++) {
        if (ALL_WORDS[i].startMs <= currentTimeMs) {
          wordIdx = i;
        } else {
          break;
        }
      }

      const newRevealed = wordIdx + 1;
      if (newRevealed !== prevRevealedRef.current) {
        prevRevealedRef.current = newRevealed;
        setRevealedWordCount(newRevealed);
      }

      if (wordIdx !== prevWordIndexRef.current) {
        prevWordIndexRef.current = wordIdx;
        setCurrentWordIndex(wordIdx);
      }

      // Derive segment index from word index
      if (wordIdx >= 0) {
        let cumulative = 0;
        let segIdx = -1;
        for (let s = 0; s < INTRO_SEGMENTS.length; s++) {
          cumulative += INTRO_SEGMENTS[s].words.length;
          if (wordIdx < cumulative) {
            segIdx = s;
            break;
          }
        }
        if (segIdx !== prevSegmentIndexRef.current) {
          prevSegmentIndexRef.current = segIdx;
          setCurrentSegmentIndex(segIdx);
        }
      }
    }, 50);

    return () => clearInterval(interval);
  }, [status.playing, player]);

  const play = useCallback(() => {
    if (!status.isLoaded) return;

    playStartedRef.current = true;
    setIsComplete(false);
    setRevealedWordCount(0);
    setCurrentWordIndex(-1);
    setCurrentSegmentIndex(-1);
    prevWordIndexRef.current = -1;
    prevSegmentIndexRef.current = -1;
    prevRevealedRef.current = 0;

    player.volume = 1;
    player.muted = false;

    console.log('[intro-audio] Playing');
    player.play();
  }, [player, status.isLoaded]);

  const skip = useCallback(() => {
    try { player.pause(); } catch { /* native player may already be released */ }
    setIsComplete(true);
  }, [player]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      try { player.pause(); } catch {}
    };
  }, [player]);

  return {
    isLoading,
    isPlaying: status.playing,
    isComplete,
    error,
    revealedWordCount,
    currentWordIndex,
    currentSegmentIndex,
    play,
    skip,
  };
}
