import { useRecordAndSubmit } from './useRecordAndSubmit';
import type { PracticeResult, PracticeMode } from '../../types/practice';

export type PracticeRecordingState = 'idle' | 'recording' | 'evaluating' | 'result';

type StopParams = { correctionId: number; mode: PracticeMode; scenario?: string };

export function usePracticeRecording() {
  const core = useRecordAndSubmit<StopParams, PracticeResult>({
    endpoint: '/practice/evaluate',
    formFields: ({ correctionId, mode, scenario }) => ({
      correctionId,
      mode,
      ...(scenario ? { scenario } : {}),
    }),
    parseResponse: (json) => json as PracticeResult,
  });

  const stop = async (correctionId: number, mode: PracticeMode, scenario?: string) => {
    await core.stop({ correctionId, mode, scenario });
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
