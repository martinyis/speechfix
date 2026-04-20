import { useRecordAndSubmit } from './recording/useRecordAndSubmit';
import type { DrillItem, DrillResult } from '../types/practice';

export type DrillRecordingState = 'idle' | 'recording' | 'evaluating' | 'result';

type StopParams = { drillItem: DrillItem; weakSpotId: number };

export function useDrillRecording() {
  const core = useRecordAndSubmit<StopParams, DrillResult>({
    endpoint: '/practice/weak-spot-evaluate',
    formFields: ({ drillItem, weakSpotId }) => ({
      weakSpotId,
      itemType: drillItem.type,
      itemId: drillItem.data.id,
    }),
    parseResponse: (json) => json as DrillResult,
  });

  const stop = async (drillItem: DrillItem, weakSpotId: number) => {
    await core.stop({ drillItem, weakSpotId });
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
