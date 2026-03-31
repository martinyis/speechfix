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
