export type ScenarioSlug =
  | 'pitch_idea'
  | 'explain_job'
  | 'teach_concept'
  | 'tell_about_yourself'
  | 'defend_opinion'
  | 'formative_story';

export type DurationPreset = 90 | 180 | 300 | 420;

export const DURATION_PRESETS: readonly DurationPreset[] = [90, 180, 300, 420] as const;

export interface Scenario {
  slug: ScenarioSlug;
  label: string;
  subtitle: string;
}

export interface ShownPrompt {
  prompt: string;
  shownAtSeconds: number;
  wasSwap: boolean;
}

export interface WithinSessionTrend {
  firstThirdRate: number;
  middleThirdRate: number;
  lastThirdRate: number;
}

export interface PressureDrillSession {
  id: number;
  userId: number;
  durationSeconds: number;
  totalFillerCount: number;
  fillerData: {
    fillerWords: Array<{ word: string; count: number }>;
    fillerPositions: Array<{ sentenceIndex: number; word: string; startIndex: number }>;
    sentences: string[];
  } | null;
  scenarioSlug: ScenarioSlug;
  durationSelectedSeconds: DurationPreset;
  promptsShown: ShownPrompt[];
  longestCleanStreakSeconds: number;
  withinSessionTrend: WithinSessionTrend;
  createdAt: string;
}
