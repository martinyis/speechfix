export interface Correction {
  sentenceIndex: number;
  originalText: string;
  correctedText: string;
  explanation: string;
  /**
   * 2-4 word sentence-specific tag describing what is wrong. Drives the
   * "atom" diff row in the mobile UI ("don't know how speak" → "missing 'to'").
   * Distinct from `explanation`, which is the longer pedagogical "Read more"
   * body. May be empty for legacy corrections.
   */
  shortReason: string;
  correctionType: string;
  severity: 'error' | 'improvement' | 'polish';
  contextSnippet: string;
}

export interface FillerWordCount {
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

export interface PhasedInsightsPayload {
  deliveryScore: number | null;
  languageScore: number | null;
  insights: SessionInsight[];
  fillerWords: FillerWordCount[];
  fillerPositions: FillerWordPosition[];
  metrics: {
    wpm: number;
    sentenceCount: number;
    fillersPerMinute: number;
    totalFillers: number;
  };
  speechTimeline?: import('../voice/speech-types.js').SpeechTimeline;
}

export interface AnalysisResult {
  corrections: Correction[];
  fillerWords: FillerWordCount[];
  fillerPositions: FillerWordPosition[];
  sessionInsights: SessionInsight[];
}

export interface AnalysisFlags {
  grammar: boolean;
  fillers: boolean;
  patterns: boolean;
}

export type PatternType =
  | 'overused_word'
  | 'repetitive_starter'
  | 'crutch_phrase'
  | 'hedging'
  | 'negative_framing';

export interface SpeechPattern {
  type: PatternType;
  identifier: string | null;
  frequency: number;
  sessionsAffected: number;
  severity: 'low' | 'medium' | 'high';
  description: string;
  examples: string[];
  trend: 'increasing' | 'stable' | 'decreasing' | 'new';
}

export interface PatternAnalysisInput {
  transcripts: Array<{ sessionId: number; sentences: string[] }>;
}

export interface PatternAnalysisResult {
  patterns: SpeechPattern[];
}

export interface AnalyzerInput {
  sentences: string[];
  mode: 'recording' | 'conversation';
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  speechTimeline?: import('../voice/speech-types.js').SpeechTimeline;
}

export interface Analyzer {
  analyze(input: AnalyzerInput): Promise<AnalysisResult>;
  analyzeStreaming?(
    input: AnalyzerInput,
    onCorrection: (correction: Correction) => void,
  ): Promise<AnalysisResult>;
}
