import type { AnalysisFlags, AnalysisFlagKey, PracticeModeConfig, SpeechSignals } from './types.js';
import { NATIVE_CONFIDENCE_THRESHOLD, PRACTICE_MODES } from './registry.js';

export function decideInitialFlags(
  signals: SpeechSignals,
  modes: PracticeModeConfig[] = PRACTICE_MODES,
): AnalysisFlags {
  const isNative = signals.nativeSpeakerConfidence >= NATIVE_CONFIDENCE_THRESHOLD;

  const flags = {} as AnalysisFlags;
  for (const mode of modes) {
    if (mode.alwaysOn) {
      flags[mode.key] = true;
      continue;
    }
    if (mode.skipIfNative && isNative) {
      flags[mode.key] = false;
      continue;
    }
    flags[mode.key] = mode.shouldEnable(signals);
  }

  const group = modes.filter((m) => m.partOfMinimumOneGroup);
  const anyOn = group.some((m) => flags[m.key]);
  if (group.length > 0 && !anyOn) {
    const eligible = group.filter((m) => !(m.skipIfNative && isNative));
    const pool = eligible.length > 0 ? eligible : group;
    const winner = pool.reduce((best, m) =>
      m.fallbackPriority > best.fallbackPriority ? m : best,
    );
    flags[winner.key] = true;
  }

  return flags;
}

export function defaultFlags(): AnalysisFlags {
  const out = {} as AnalysisFlags;
  const allKeys: AnalysisFlagKey[] = ['grammar', 'fillers', 'patterns'];
  for (const k of allKeys) out[k] = true;
  return out;
}
