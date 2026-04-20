export interface PracticeTask {
  correctionId: number;
  sessionId: number;
  sessionDate: string;
  originalText: string;
  correctedText: string;
  explanation: string | null;
  shortReason: string | null;
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

export type PracticeMode = 'say_it_right';

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

// ---------------------------------------------------------------------------
// Weak Spots
// ---------------------------------------------------------------------------

export interface WeakSpot {
  id: number;
  correctionType: string;
  status: 'active' | 'backlog' | 'resolved' | 'dismissed';
  severity: 'error' | 'improvement' | 'polish';
  srsStage: number;
  nextReviewAt: string | null;
  lastDrillAt: string | null;
  isRecurring: boolean;
  isDue: boolean;
  corrections: WeakSpotCorrection[];
  exercises: WeakSpotExercise[];
  createdAt: string;
}

export interface WeakSpotCorrection {
  id: number;
  correctionId: number;
  originalText: string;
  correctedText: string;
  explanation: string;
  shortReason: string | null;
  correctionType: string;
  severity: 'error' | 'improvement' | 'polish';
  fullContext: string | null;
  practiced: boolean;
}

export interface WeakSpotExercise {
  id: number;
  originalText: string;
  correctedText: string;
  explanation: string | null;
  correctionType: string;
  severity: 'error' | 'improvement' | 'polish';
  orderIndex: number;
  practiced: boolean;
}

export interface QuickFix {
  id: number; // correction id
  originalText: string;
  correctedText: string;
  explanation: string;
  shortReason: string | null;
  correctionType: string;
  severity: 'error' | 'improvement' | 'polish';
  fullContext: string | null;
  practiced: boolean;
}

export interface WeakSpotsResponse {
  activeSpots: WeakSpot[];
  backlog: {
    id: number;
    correctionType: string;
    severity: 'error' | 'improvement' | 'polish';
    correctionCount: number;
    isRecurring: boolean;
  }[];
  quickFixes: QuickFix[];
}

export type DrillItem =
  | { type: 'correction'; data: WeakSpotCorrection }
  | { type: 'exercise'; data: WeakSpotExercise };

export interface DrillResult {
  passed: boolean;
  transcript: string;
  feedback: string;
  attemptId: number;
}

export interface DrillSummary {
  totalItems: number;
  retriesCount: number;
  resolved: boolean;
  nextReviewAt: string | null;
  srsStage: number;
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
