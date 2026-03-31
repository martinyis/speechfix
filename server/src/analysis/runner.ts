import type { AnalysisResult, AnalysisFlags, AnalyzerInput, Correction } from './types.js';
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
  return mergeResults(results);
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
