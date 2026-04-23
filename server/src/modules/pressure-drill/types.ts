// Stable slug for each scenario. Persisted in pressure_drill_sessions.scenario_slug.
export type ScenarioSlug =
  | 'pitch_idea'
  | 'explain_job'
  | 'teach_concept'
  | 'tell_about_yourself'
  | 'defend_opinion'
  | 'formative_story';

// Duration preset in seconds. Persisted in pressure_drill_sessions.duration_selected_seconds.
// These are the ONLY allowed values (validated server-side on `start`).
export type DurationPreset = 90 | 180 | 300 | 420;

export const DURATION_PRESETS: readonly DurationPreset[] = [90, 180, 300, 420] as const;

export interface Scenario {
  slug: ScenarioSlug;
  label: string;
  subtitle: string;
  systemHint: string;
}

export interface PromptBatchRequest {
  scenarioSlug: ScenarioSlug;
  durationPreset: DurationPreset;
  elapsedSeconds: number;
  lastTranscriptWindow: string;     // last ~30s of user speech, empty on first batch
  previouslyShownPrompts: string[]; // avoid repeats
}

export interface PromptBatchResponse {
  prompts: string[];   // length 4, each ≤10 words
  model: string;       // e.g. 'claude-haiku-4-5-20251001'
  latencyMs: number;
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

// Shape persisted under pressure_drill_sessions.filler_data JSONB.
export interface PressureDrillFillerData {
  fillerWords: Array<{ word: string; count: number }>;
  fillerPositions: Array<{ sentenceIndex: number; word: string; startIndex: number }>;
  sentences: string[];
  source?: 'realtime' | 'posthoc' | 'merged';
}

export interface PressureDrillSessionRow {
  id: number;
  userId: number;
  durationSeconds: number;                  // actual speaking duration
  totalFillerCount: number;                 // realtime + posthoc merged
  fillerData: PressureDrillFillerData | null;
  scenarioSlug: ScenarioSlug;
  durationSelectedSeconds: DurationPreset;
  promptsShown: ShownPrompt[];
  longestCleanStreakSeconds: number;
  withinSessionTrend: WithinSessionTrend;
  createdAt: string;
}
