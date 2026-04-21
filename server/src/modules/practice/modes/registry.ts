import type { PracticeModeConfig } from './types.js';

export const NATIVE_CONFIDENCE_THRESHOLD = 0.7;
export const GRAMMAR_ERROR_MIN = 2;
export const FILLER_WORD_MIN = 3;

export const PRACTICE_MODES: PracticeModeConfig[] = [
  {
    key: 'patterns',
    alwaysOn: true,
    shouldEnable: () => true,
    fallbackPriority: 0,
  },
  {
    key: 'grammar',
    skipIfNative: true,
    shouldEnable: (s) => s.grammarErrorCount >= GRAMMAR_ERROR_MIN,
    fallbackPriority: 1,
    partOfMinimumOneGroup: true,
  },
  {
    key: 'fillers',
    shouldEnable: (s) => s.fillerWordCount >= FILLER_WORD_MIN,
    fallbackPriority: 2,
    partOfMinimumOneGroup: true,
  },
];
