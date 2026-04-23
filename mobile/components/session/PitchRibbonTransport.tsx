/**
 * Minimal transport row beneath the Pitch Ribbon: play/pause, progress,
 * duration, transcript show/hide. Built around the shared AudioPlaybackAPI.
 */

import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { colors, alpha, fonts, layout } from '../../theme';
import type { AudioPlaybackAPI } from '../../hooks/useAudioPlayback';

interface Props {
  audio: AudioPlaybackAPI;
  /** Explicit duration fallback — `audio.durationSeconds` is 0 until metadata loads. */
  fallbackDurationSeconds: number;
  transcriptVisible: boolean;
  onToggleTranscript: () => void;
}

function fmt(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export function PitchRibbonTransport({
  audio,
  fallbackDurationSeconds,
  transcriptVisible,
  onToggleTranscript,
}: Props) {
  const duration = audio.durationSeconds > 0 ? audio.durationSeconds : fallbackDurationSeconds;

  const progressStyle = useAnimatedStyle(() => ({
    width: `${Math.min(100, Math.max(0, (audio.positionSeconds.value / Math.max(duration, 0.001)) * 100))}%`,
  }));

  const onPlayPause = () => {
    if (audio.isPlaying) audio.pause();
    else audio.play();
  };

  return (
    <View style={styles.container}>
      <Pressable style={styles.playBtn} onPress={onPlayPause} hitSlop={10}>
        <Ionicons
          name={audio.isPlaying ? 'pause' : 'play'}
          size={18}
          color={colors.white}
          style={!audio.isPlaying ? { marginLeft: 2 } : undefined}
        />
      </Pressable>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, progressStyle]} />
      </View>
      <Text style={styles.time}>{fmt(duration)}</Text>
      <Pressable
        style={[styles.toggle, transcriptVisible && styles.toggleActive]}
        onPress={onToggleTranscript}
        hitSlop={10}
      >
        <Ionicons
          name={transcriptVisible ? 'text' : 'text-outline'}
          size={16}
          color={transcriptVisible ? colors.primary : alpha(colors.white, 0.5)}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: layout.screenPadding,
    paddingVertical: 6,
  },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: alpha(colors.primary, 0.2),
    borderWidth: 1,
    borderColor: alpha(colors.primary, 0.4),
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: {
    flex: 1,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: alpha(colors.white, 0.08),
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 1.5,
  },
  time: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: alpha(colors.white, 0.5),
    minWidth: 32,
    textAlign: 'right',
  },
  toggle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: alpha(colors.white, 0.04),
    borderWidth: 1,
    borderColor: alpha(colors.white, 0.08),
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleActive: {
    backgroundColor: alpha(colors.primary, 0.12),
    borderColor: alpha(colors.primary, 0.4),
  },
});
