export interface TranscriptionResult {
  sessionId: number;
  transcription: string;
  sentences: string[];
  durationSeconds: number;
  createdAt: string;
}

export interface SessionAnalysis {
  sentences: string[];
  corrections: Correction[];
  fillerWords: FillerWord[];
  fillerPositions: FillerWordPosition[];
  sessionInsights: SessionInsight[];
}

export interface Session {
  id: number;
  transcription: string;
  durationSeconds: number;
  analysis: SessionAnalysis | null;
  createdAt: string;
}

export interface Correction {
  id: number;
  sessionId: number;
  sentenceIndex: number;
  originalText: string;
  correctedText: string;
  explanation: string | null;
  correctionType: string;
  severity: 'error' | 'improvement' | 'polish';
  contextSnippet: string | null;
}

export interface FillerWord {
  id: number;
  sessionId: number;
  word: string;
  count: number;
}

export interface FillerWordPosition {
  sentenceIndex: number;
  word: string;
  startIndex: number;
  /** Absolute time in seconds from session start. Populated when word timings are available. */
  timeSeconds?: number;
}

export interface SessionInsight {
  type:
    | 'repetitive_word'
    | 'hedging_pattern'
    | 'discourse_pattern'
    | 'quality_assessment'
    | 'strength'
    | 'focus_area'
    | 'metric'
    | 'score'
    | 'delivery_score'
    | 'language_score';
  description: string;
  value?: string | number;
}

export interface WordTimingData {
  word: string;
  start: number;
  end: number;
  confidence: number;
}

export interface UtteranceMetadata {
  text: string;
  words: WordTimingData[];
  startTime: number;
  endTime: number;
  durationMs: number;
  wpm: number;
  avgConfidence: number;
  lowConfidenceWords: string[];
  responseLatencyMs: number;
}

/**
 * Per-moment prosody sample for visualizing the conversation timeline.
 * Gaps in the sample array represent silences.
 */
export interface ProsodySample {
  t: number;                 // seconds from session start
  pitchHz: number | null;    // F0 in Hz, null if unvoiced
  volume: number;            // 0-1 normalized volume
}

export interface SpeechTimeline {
  utterances: UtteranceMetadata[];
  overallWpm: number;
  paceVariability: number;
  avgResponseLatencyMs: number;
  avgConfidence: number;
  totalPauses: number;
  avgPauseDurationMs: number;
  longestPauseMs: number;
  speechToSilenceRatio: number;
  volumeConsistency: number;
  volumeTrend: 'steady' | 'declining' | 'rising' | 'erratic';
  pitchVariation: number;
  pitchAssessment: 'monotone' | 'limited' | 'varied' | 'expressive';
  avgPitchHz: number;
  prosodySamples?: ProsodySample[];  // may be empty/absent for legacy sessions
}

export interface SessionDetail {
  id: number;
  transcription: string;
  durationSeconds: number;
  createdAt: string;
  sentences: string[];
  corrections: Correction[];
  fillerWords: FillerWord[];
  fillerPositions: FillerWordPosition[];
  sessionInsights: SessionInsight[];
  speechTimeline?: SpeechTimeline | null;
  /** Relative path to persisted audio file; null while encoding or for legacy sessions. */
  audioPath?: string | null;
}

export type TopicCategory =
  | 'work'
  | 'daily_life'
  | 'travel'
  | 'social'
  | 'education'
  | 'technology'
  | 'health'
  | 'general';

export interface SessionListItem {
  id: number;
  durationSeconds: number;
  createdAt: string;
  errorCount: number;
  improvementCount: number;
  polishCount: number;
  title?: string | null;
  description?: string | null;
  topicCategory?: TopicCategory | null;
  clarityScore?: number | null;
  totalFillerCount?: number;
  agentId?: number | null;
  agentName?: string | null;
  agentAvatarSeed?: string | null;
}

export interface Agent {
  id: number;
  name: string;
  type: string;
  voiceId: string | null;
  avatarSeed?: string | null;
  createdAt: string;
}

export interface AgentDetail extends Agent {
  systemPrompt: string;
  behaviorPrompt: string | null;
  settings: Record<string, unknown>;
}

export interface Voice {
  id: string;
  name: string;
  gender: 'male' | 'female';
  description: string;
  sampleUrl?: string;
}

export interface FillerCoachSession {
  id: number;
  userId: number;
  durationSeconds: number;
  totalFillerCount: number;
  fillerData: {
    fillerWords: Array<{ word: string; count: number }>;
    fillerPositions: FillerWordPosition[];
    sentences: string[];
  } | null;
  createdAt: string;
}

export interface FillerCoachStats {
  totalSessions: number;
  avgFillersPerMin: number;
  bestFillersPerMin: number;
  totalPracticeSeconds: number;
  topFillers: Array<{ word: string; count: number }>;
}

export interface FillerSummary {
  words: Array<{
    word: string;
    totalCount: number;
    sessionCount: number;
    avgPerSession: number;
  }>;
  totalSessions: number;
}

export type CorrectionFilter = 'all' | 'error' | 'improvement' | 'polish';
