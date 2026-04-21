export interface WordTimingData {
  word: string;
  start: number;  // seconds from stream start
  end: number;
  confidence: number;
}

export interface UtteranceMetadata {
  text: string;
  words: WordTimingData[];
  startTime: number;                 // first word start (seconds)
  endTime: number;                   // last word end (seconds)
  durationMs: number;                // (endTime - startTime) * 1000
  wpm: number;                       // word count / duration * 60
  avgConfidence: number;             // mean word confidence
  lowConfidenceWords: string[];      // words with confidence < 0.80
  responseLatencyMs: number;         // gap since AI finished speaking
}

/**
 * Per-moment prosody sample for visualizing the conversation timeline.
 * Gaps in the sample array represent silences (no user speech at that time).
 */
export interface ProsodySample {
  t: number;                 // seconds from session start
  pitchHz: number | null;    // F0 in Hz from PitchAccumulator, null if unvoiced
  volume: number;            // 0-1 normalized from dBFS (-60dB → 0, 0dB → 1)
}

export interface SpeechTimeline {
  utterances: UtteranceMetadata[];

  // Aggregate pace metrics
  overallWpm: number;
  paceVariability: number;           // coefficient of variation of per-utterance WPM
  avgResponseLatencyMs: number;
  avgConfidence: number;

  // Pause metrics
  totalPauses: number;
  avgPauseDurationMs: number;
  longestPauseMs: number;
  speechToSilenceRatio: number;      // speaking time / total time

  // Volume metrics
  volumeConsistency: number;         // 1 - (stddev / mean) of RMS values during speech
  volumeTrend: 'steady' | 'declining' | 'rising' | 'erratic';

  // Pitch metrics
  pitchVariation: number;            // stddev of F0 values
  pitchAssessment: 'monotone' | 'limited' | 'varied' | 'expressive';
  avgPitchHz: number;

  // Per-moment samples for Pitch Ribbon visualization (~200ms resolution).
  // Gaps represent silences. May be empty for legacy sessions.
  prosodySamples: ProsodySample[];
}
