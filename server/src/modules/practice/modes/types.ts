export const SPEECH_SIGNALS_VERSION = 1;

export interface SpeechSignals {
  nativeSpeakerConfidence: number;
  grammarErrorCount: number;
  fillerWordCount: number;
  userWordCount: number;
  reasoning?: string;
  version: number;
}

export type AnalysisFlagKey = 'grammar' | 'fillers' | 'patterns';

export type AnalysisFlags = Record<AnalysisFlagKey, boolean>;

export interface PracticeModeConfig {
  key: AnalysisFlagKey;
  alwaysOn?: boolean;
  skipIfNative?: boolean;
  shouldEnable: (signals: SpeechSignals) => boolean;
  fallbackPriority: number;
  partOfMinimumOneGroup?: boolean;
}
