export interface PracticeTask {
  correctionId: number;
  sessionId: number;
  sessionDate: string;
  originalText: string;
  correctedText: string;
  explanation: string | null;
  correctionType: string;
  severity: 'error' | 'improvement' | 'polish';
  contextSnippet: string | null;
  scenario: string | null;
  practiced: boolean;
  lastPracticedAt: string | null;
  practiceCount: number;
}

export interface PracticeResult {
  passed: boolean;
  transcript: string;
  feedback: string;
  attemptId: number;
}

export type PracticeMode = 'say_it_right' | 'use_it_naturally';

export interface PatternExercise {
  id: number;
  originalSentence: string;
  targetWord: string | null;
  patternType: string;
  alternatives: string[];
  highlightPhrases: string[] | null;
  suggestedReframe: string | null;
  practiced: boolean;
  practiceCount: number;
  level: number;
  orderIndex: number;
}

export interface ActivePattern {
  patternId: number;
  type: string;
  identifier: string | null;
  severity: string;
  description: string;
  currentLevel: 1 | 2;
  levelProgress: { completed: number; total: number };
  exercises: PatternExercise[];
  isReturning: boolean;
}

export interface QueuedPattern {
  patternId: number;
  type: string;
  identifier: string | null;
  severity: string;
  description: string;
  frequency: number;
  exampleSentences: string[];
  queuePosition: number;
  isReturning: boolean;
}

export interface PatternTasksResponse {
  active: ActivePattern | null;
  queued: QueuedPattern[];
}

// Keep for backwards compat with PatternTaskCard
export interface PatternGroup {
  patternId: number;
  type: string;
  identifier: string | null;
  severity: string;
  description: string;
  exercises: PatternExercise[];
}
