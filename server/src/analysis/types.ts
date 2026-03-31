export interface Correction {
  sentenceIndex: number;
  originalText: string;
  correctedText: string;
  explanation: string;
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
}

export interface SessionInsight {
  type: 'repetitive_word' | 'hedging_pattern' | 'discourse_pattern';
  description: string;
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
  | 'intensifier_overuse'
  | 'repetitive_starter'
  | 'crutch_phrase'
  | 'hedging_trend'
  | 'noncommittal_language'
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
}

export interface Analyzer {
  analyze(input: AnalyzerInput): Promise<AnalysisResult>;
  analyzeStreaming?(
    input: AnalyzerInput,
    onCorrection: (correction: Correction) => void,
  ): Promise<AnalysisResult>;
}
