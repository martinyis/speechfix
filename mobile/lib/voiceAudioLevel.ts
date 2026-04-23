import { makeMutable, type SharedValue } from 'react-native-reanimated';

/**
 * Global live-session mic amplitude (0–1).
 * Written by useVoiceSessionCore on every audio chunk; consumed by the
 * live-session overlay to drive waveform visuals. Module-level so we don't
 * thread a SharedValue through three wrapper hooks + four call sites.
 */
export const voiceAudioLevel: SharedValue<number> = makeMutable(0);
