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
    | 'score';
  description: string;
  value?: string | number;
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
