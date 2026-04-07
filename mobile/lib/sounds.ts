import { useAudioPlayer } from 'expo-audio';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const successAsset = require('../assets/sounds/success.wav');

let _player: ReturnType<typeof useAudioPlayer> | null = null;

/**
 * Must be called from a component (hook). Stores the player ref for later use.
 */
export function usePreloadSuccessSound() {
  const player = useAudioPlayer(successAsset);
  _player = player;
  return player;
}

export function playSuccessSound() {
  if (!_player) return;
  try {
    _player.volume = 0.5;
    _player.seekTo(0);
    _player.play();
  } catch {
    // Silently ignore if player not ready
  }
}
