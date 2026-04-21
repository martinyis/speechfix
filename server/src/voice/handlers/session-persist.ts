import type { AgentConfig } from './types.js';
import type { Correction, FillerWordCount } from '../../analysis/types.js';
import { db } from '../../db/index.js';
import { corrections as correctionsTable, fillerWords as fillerWordsTable } from '../../db/schema.js';
import { regenerateAllGreetings } from '../../services/greeting-generator.js';
import { runPatternAnalysisForUser } from '../../jobs/patterns.js';
import { absorbCorrections } from '../../services/weak-spot-manager.js';
import { appendContextNotes } from './conversation-handler.js';

export function handleEmptyTranscript(userId: number): void {
  regenerateAllGreetings(userId).catch(err =>
    console.error('[greeting] Regeneration failed (empty transcript):', err)
  );
}

export function computeCorrectionClarityScore(
  correctionSentenceIndexes: number[],
  totalSentences: number,
): number {
  if (totalSentences === 0) return 100;
  const sentencesWithCorrections = new Set(correctionSentenceIndexes).size;
  return Math.round(
    (Math.max(0, totalSentences - sentencesWithCorrections) / totalSentences) * 100,
  );
}

export async function insertCorrectionsBatch(
  sessionId: number,
  correctionsList: Correction[],
): Promise<number[]> {
  if (correctionsList.length === 0) return [];
  const inserted = await db.insert(correctionsTable).values(
    correctionsList.map(c => ({
      sessionId,
      originalText: c.originalText,
      correctedText: c.correctedText,
      explanation: c.explanation || null,
      shortReason: c.shortReason || null,
      correctionType: c.correctionType || 'other',
      sentenceIndex: c.sentenceIndex,
      severity: c.severity,
      contextSnippet: c.contextSnippet || null,
    }))
  ).returning();
  return inserted.map(r => r.id);
}

export async function insertFillerWordsBatch(
  sessionId: number,
  fillerWordsList: FillerWordCount[],
): Promise<void> {
  if (fillerWordsList.length === 0) return;
  await db.insert(fillerWordsTable).values(
    fillerWordsList.map(f => ({
      sessionId,
      word: f.word,
      count: f.count,
    }))
  );
}

export async function runPostAnalysisSideEffects(params: {
  userId: number;
  agentConfig: AgentConfig | null;
  correctionIds: number[];
  userUtterances: string[];
  contextNotes: string[];
}): Promise<void> {
  const { userId, agentConfig, correctionIds, userUtterances, contextNotes } = params;

  if (contextNotes.length > 0) {
    await appendContextNotes(userId, contextNotes, agentConfig?.id ?? null);
  }

  if (correctionIds.length > 0) {
    absorbCorrections(userId, correctionIds, userUtterances).catch(err =>
      console.error('[conversation-handler] Failed to absorb corrections:', err)
    );
  }

  regenerateAllGreetings(userId).catch(err =>
    console.error('[greeting] Regeneration failed:', err)
  );
  runPatternAnalysisForUser(userId).catch(err =>
    console.error('[conversation-handler] Auto pattern analysis failed:', err)
  );
}
