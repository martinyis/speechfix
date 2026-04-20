import type { AnalysisResult, AnalysisFlags, AnalyzerInput, Correction, PhasedInsightsPayload } from './types.js';
import { generatePhasedInsights } from '../services/session-insights-generator.js';
import { enrichFillerTimestamps } from '../services/filler-timestamp-enricher.js';
import { GrammarAnalyzer } from './analyzers/grammar.js';
import { FillerAnalyzer } from './analyzers/fillers.js';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';

const grammarAnalyzer = new GrammarAnalyzer();
const fillerAnalyzer = new FillerAnalyzer();

const EMPTY_RESULT: AnalysisResult = {
  corrections: [],
  fillerWords: [],
  fillerPositions: [],
  sessionInsights: [],
};

async function getAnalysisFlags(userId: number): Promise<AnalysisFlags> {
  const [user] = await db
    .select({ analysisFlags: users.analysisFlags })
    .from(users)
    .where(eq(users.id, userId));

  return (user?.analysisFlags as AnalysisFlags) ?? { grammar: true, fillers: true, patterns: true };
}

function mergeResults(results: AnalysisResult[]): AnalysisResult {
  return {
    corrections: results.flatMap((r) => r.corrections),
    fillerWords: results.flatMap((r) => r.fillerWords),
    fillerPositions: results.flatMap((r) => r.fillerPositions),
    sessionInsights: results.flatMap((r) => r.sessionInsights),
  };
}

/** Run all enabled analyzers in parallel (non-streaming). */
export async function runAnalysis(userId: number, input: AnalyzerInput): Promise<AnalysisResult> {
  if (input.sentences.length === 0) return EMPTY_RESULT;

  const flags = await getAnalysisFlags(userId);
  const tasks: Promise<AnalysisResult>[] = [];

  if (flags.grammar) tasks.push(grammarAnalyzer.analyze(input));
  if (flags.fillers) tasks.push(fillerAnalyzer.analyze(input));

  if (tasks.length === 0) return EMPTY_RESULT;

  const results = await Promise.all(tasks);
  const merged = mergeResults(results);
  // Enrich filler positions with absolute timestamps from word timings (if available)
  if (input.speechTimeline) {
    merged.fillerPositions = enrichFillerTimestamps(merged.fillerPositions, input.speechTimeline.utterances);
  }
  return merged;
}

/**
 * Phased analysis: fillers → insights+score → grammar streaming.
 * Fires onPhasedInsights once fillers+insights are ready (before grammar).
 */
export async function runAnalysisPhased(
  userId: number,
  input: AnalyzerInput,
  durationSeconds: number,
  onPhasedInsights: (payload: PhasedInsightsPayload) => Promise<void>,
  onCorrection: (correction: Correction) => void,
): Promise<AnalysisResult> {
  if (input.sentences.length === 0) {
    // Empty sessions: no scores, no insights.
    const emptyPayload: PhasedInsightsPayload = {
      score: null,
      deliveryScore: null,
      languageScore: null,
      insights: [],
      fillerWords: [],
      fillerPositions: [],
      metrics: { wpm: 0, sentenceCount: 0, fillersPerMinute: 0, totalFillers: 0 },
    };
    await onPhasedInsights(emptyPayload);
    return EMPTY_RESULT;
  }

  const flags = await getAnalysisFlags(userId);

  // Phase 1: Fillers (fast, ~1-2s)
  let fillerResult: AnalysisResult = EMPTY_RESULT;
  if (flags.fillers) {
    fillerResult = await fillerAnalyzer.analyze(input);
    // Enrich filler positions with absolute timestamps (for Pitch Ribbon viz)
    if (input.speechTimeline) {
      fillerResult = {
        ...fillerResult,
        fillerPositions: enrichFillerTimestamps(fillerResult.fillerPositions, input.speechTimeline.utterances),
      };
    }
  }

  // Phase 2: Insights + Score using fillers (no corrections needed)
  const phasedPayload = await generatePhasedInsights({
    sentences: input.sentences,
    fillerWords: fillerResult.fillerWords,
    fillerPositions: fillerResult.fillerPositions,
    durationSeconds,
    existingInsights: fillerResult.sessionInsights,
    speechTimeline: input.speechTimeline,
  });

  // Emit insights_ready — caller creates DB session and sends to client
  await onPhasedInsights(phasedPayload);

  // Phase 3: Grammar streaming (slow, ~5-15s)
  let grammarResult: AnalysisResult = EMPTY_RESULT;
  if (flags.grammar) {
    grammarResult = await grammarAnalyzer.analyzeStreaming(input, onCorrection);
  }

  // Merge everything
  return mergeResults([fillerResult, grammarResult]);
}

/** Run analyzers with streaming corrections from the grammar analyzer. */
export async function runAnalysisStreaming(
  userId: number,
  input: AnalyzerInput,
  onCorrection: (correction: Correction) => void,
): Promise<AnalysisResult> {
  if (input.sentences.length === 0) return EMPTY_RESULT;

  const flags = await getAnalysisFlags(userId);
  const tasks: Promise<AnalysisResult>[] = [];

  if (flags.grammar) {
    tasks.push(grammarAnalyzer.analyzeStreaming(input, onCorrection));
  }
  if (flags.fillers) {
    tasks.push(fillerAnalyzer.analyze(input));
  }

  if (tasks.length === 0) return EMPTY_RESULT;

  const results = await Promise.all(tasks);
  return mergeResults(results);
}
