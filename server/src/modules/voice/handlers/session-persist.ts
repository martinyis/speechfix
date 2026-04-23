import type { AgentConfig } from './types.js';
import type { Correction, FillerWordCount } from '../../../analysis/types.js';
import { db } from '../../../db/index.js';
import { corrections as correctionsTable, fillerWords as fillerWordsTable } from '../../../db/schema.js';
import { regenerateAllGreetings } from '../../agents/greeting-generator.js';
import { runPatternAnalysisForUser, runPostSessionPatternUpdates } from '../../patterns/job.js';
import { absorbCorrections } from '../../weak-spots/manager.js';
import { appendContextNotes } from './conversation-handler.js';

export function handleEmptyTranscript(userId: number): void {
  regenerateAllGreetings(userId).catch(err =>
    console.error('[greeting] Regeneration failed (empty transcript):', err)
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
  /**
   * The id of the session just persisted. When present, graduation +
   * regression checks run against that session's stored analysis. Optional
   * for legacy callers that haven't been threaded through yet.
   */
  sessionId?: number;
}): Promise<void> {
  const { userId, agentConfig, correctionIds, userUtterances, contextNotes, sessionId } = params;

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

  // Graduation + regression tracking. Runs against the session we just
  // stored — decoupled from the expensive cross-session re-analysis above.
  if (sessionId != null) {
    runPostSessionPatternUpdates(userId, sessionId).catch(err =>
      console.error('[conversation-handler] Pattern graduation/regression failed:', err)
    );
  }
}
