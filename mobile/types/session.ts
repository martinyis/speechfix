export interface TranscriptionResult {
  sessionId: number;
  transcription: string;
  sentences: string[];
  durationSeconds: number;
  createdAt: string;
}

export interface Session {
  id: number;
  transcription: string;
  durationSeconds: number;
  analysis: unknown | null;
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
}

export interface SessionInsight {
  type: 'repetitive_word' | 'hedging_pattern' | 'discourse_pattern';
  description: string;
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
}

export interface SessionListItem {
  id: number;
  durationSeconds: number;
  createdAt: string;
  errorCount: number;
  improvementCount: number;
  polishCount: number;
}
