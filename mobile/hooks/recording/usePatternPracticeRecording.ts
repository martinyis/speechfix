import { useRecordAndSubmit } from './useRecordAndSubmit';
import type { PracticeResult } from '../../types/practice';

export type PatternRecordingState = 'idle' | 'recording' | 'evaluating' | 'result';

export function usePatternPracticeRecording() {
  const core = useRecordAndSubmit<{ exerciseId: number }, PracticeResult>({
    endpoint: '/practice/pattern-evaluate',
    formFields: ({ exerciseId }) => ({ exerciseId }),
    parseResponse: (json) => json as PracticeResult,
  });

  const stop = async (exerciseId: number) => {
    await core.stop({ exerciseId });
  };

  return {
    state: core.state,
    elapsedSeconds: core.elapsedSeconds,
    result: core.result,
    error: core.error,
    audioLevel: core.audioLevel,
    start: core.start,
    stop,
    reset: core.reset,
  };
}
