import { db } from '../db/index.js';
import { users, sessions, speechPatterns } from '../db/schema.js';
import { eq, sql, and, notInArray } from 'drizzle-orm';
import { analyzePatterns } from '../analysis/analyzers/patterns.js';
import { generateAndStorePatternExercises } from '../services/pattern-exercise-generator.js';
import type { AnalysisFlags, SpeechPattern } from '../analysis/types.js';

const MAX_SESSIONS = 20;
const MAX_CHARS = 50_000;
const MIN_SESSIONS_REQUIRED = 5;
const MIN_TOTAL_SESSIONS = 3;
const MIN_TOTAL_SENTENCES = 150;
const DEBOUNCE_MS = 6 * 60 * 60 * 1000; // 6 hours

interface SessionTranscript {
  sessionId: number;
  sentences: string[];
}

/**
 * Fetch sessions that haven't been analyzed for patterns yet.
 * Returns transcripts from the `analysis` JSONB column.
 */
async function getUnanalyzedSessions(userId: number): Promise<SessionTranscript[]> {
  // Get session IDs already analyzed (from all pattern rows for this user)
  const existingPatterns = await db
    .select({ sessionsAnalyzed: speechPatterns.sessionsAnalyzed })
    .from(speechPatterns)
    .where(eq(speechPatterns.userId, userId));

  const analyzedSessionIds = new Set<number>();
  for (const row of existingPatterns) {
    const ids = row.sessionsAnalyzed as number[];
    if (Array.isArray(ids)) {
      for (const id of ids) analyzedSessionIds.add(id);
    }
  }

  // Fetch sessions with analysis data, excluding already-analyzed ones
  const query = db
    .select({
      id: sessions.id,
      analysis: sessions.analysis,
    })
    .from(sessions)
    .where(
      analyzedSessionIds.size > 0
        ? and(
            eq(sessions.userId, userId),
            notInArray(sessions.id, [...analyzedSessionIds]),
          )
        : eq(sessions.userId, userId),
    )
    .orderBy(sessions.createdAt)
    .limit(MAX_SESSIONS);

  const rows = await query;

  const transcripts: SessionTranscript[] = [];
  let totalChars = 0;

  for (const row of rows) {
    const analysis = row.analysis as { sentences?: string[] } | null;
    const sentences = analysis?.sentences;
    if (!Array.isArray(sentences) || sentences.length === 0) continue;

    const sessionChars = sentences.reduce((sum, s) => sum + s.length, 0);
    if (totalChars + sessionChars > MAX_CHARS) break;

    transcripts.push({ sessionId: row.id, sentences });
    totalChars += sessionChars;
  }

  return transcripts;
}

/**
 * Check if user meets minimum threshold for pattern analysis:
 * At least 3 sessions with sentences AND at least 150 total sentences.
 */
async function meetsAnalysisThreshold(userId: number): Promise<boolean> {
  const allSessions = await db
    .select({ analysis: sessions.analysis })
    .from(sessions)
    .where(eq(sessions.userId, userId));

  let sessionCount = 0;
  let sentenceCount = 0;

  for (const row of allSessions) {
    const analysis = row.analysis as { sentences?: string[] } | null;
    const sentences = analysis?.sentences;
    if (!Array.isArray(sentences) || sentences.length === 0) continue;
    sessionCount++;
    sentenceCount += sentences.length;
  }

  return sessionCount >= MIN_TOTAL_SESSIONS && sentenceCount >= MIN_TOTAL_SENTENCES;
}

/**
 * Check debounce: skip if last analysis was within 6 hours.
 */
async function isDebounced(userId: number): Promise<boolean> {
  const [user] = await db
    .select({ lastPatternAnalysisAt: users.lastPatternAnalysisAt })
    .from(users)
    .where(eq(users.id, userId));

  if (!user?.lastPatternAnalysisAt) return false;
  return Date.now() - user.lastPatternAnalysisAt.getTime() < DEBOUNCE_MS;
}

/**
 * Update the last analysis timestamp after successful analysis.
 */
async function updateAnalysisTimestamp(userId: number): Promise<void> {
  await db
    .update(users)
    .set({ lastPatternAnalysisAt: new Date() })
    .where(eq(users.id, userId));
}

/**
 * Check if re-analysis is needed (>= 3 sessions since last analysis).
 */
export async function checkReanalysisNeeded(userId: number): Promise<boolean> {
  const [user] = await db
    .select({ lastPatternAnalysisAt: users.lastPatternAnalysisAt })
    .from(users)
    .where(eq(users.id, userId));

  if (!user?.lastPatternAnalysisAt) return true;

  const [result] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(sessions)
    .where(
      and(
        eq(sessions.userId, userId),
        sql`${sessions.createdAt} > ${user.lastPatternAnalysisAt}`,
      ),
    );

  return (result?.count ?? 0) >= 3;
}

/**
 * Assign queue positions and active status for newly upserted patterns.
 * Only one pattern per user can be active at a time.
 */
async function assignQueuePositions(
  userId: number,
  patternIds: number[],
): Promise<number | null> {
  if (patternIds.length === 0) return null;

  // Check if user already has an active pattern
  const [activePattern] = await db
    .select({ id: speechPatterns.id })
    .from(speechPatterns)
    .where(and(eq(speechPatterns.userId, userId), eq(speechPatterns.status, 'active')));

  if (activePattern) {
    // All new patterns go to queue after existing queued ones
    const [maxPos] = await db
      .select({ maxPos: sql<number>`COALESCE(MAX(${speechPatterns.queuePosition}), 0)` })
      .from(speechPatterns)
      .where(and(eq(speechPatterns.userId, userId), eq(speechPatterns.status, 'queued')));

    let nextPos = (maxPos?.maxPos ?? 0) + 1;
    for (const pid of patternIds) {
      // Only set queue position for patterns that are still 'queued' (not already active)
      await db
        .update(speechPatterns)
        .set({ queuePosition: nextPos })
        .where(and(eq(speechPatterns.id, pid), eq(speechPatterns.status, 'queued')));
      nextPos++;
    }

    return activePattern.id; // exercises already exist for active
  }

  // No active pattern — promote first new pattern, queue the rest
  // The first pattern in the array is highest priority (LLM returns in order of importance)
  const [activeId, ...queuedIds] = patternIds;

  await db
    .update(speechPatterns)
    .set({ status: 'active' })
    .where(eq(speechPatterns.id, activeId));

  let pos = 1;
  for (const pid of queuedIds) {
    await db
      .update(speechPatterns)
      .set({ queuePosition: pos })
      .where(eq(speechPatterns.id, pid));
    pos++;
  }

  return activeId;
}

/**
 * Run pattern analysis for a single user.
 * Checks thresholds, debounce, runs analysis, manages queue.
 */
export async function runPatternAnalysisForUser(
  userId: number,
  options?: { awaitExercises?: boolean; skipThreshold?: boolean },
): Promise<{ patternsFound: number; patternIds: number[] }> {
  // Debounce check
  if (await isDebounced(userId)) {
    console.log(`[patterns-job] User ${userId}: debounced (analyzed within 6 hours), skipping`);
    return { patternsFound: 0, patternIds: [] };
  }

  // Threshold check (skip for manual triggers)
  if (!options?.skipThreshold) {
    const thresholdMet = await meetsAnalysisThreshold(userId);
    if (!thresholdMet) {
      console.log(`[patterns-job] User ${userId}: below threshold (3 sessions / 150 sentences), skipping`);
      return { patternsFound: 0, patternIds: [] };
    }
  }

  const transcripts = await getUnanalyzedSessions(userId);

  if (transcripts.length < 2) {
    console.log(`[patterns-job] User ${userId}: only ${transcripts.length} unanalyzed sessions, skipping`);
    return { patternsFound: 0, patternIds: [] };
  }

  console.log(`[patterns-job] User ${userId}: analyzing ${transcripts.length} sessions`);

  const result = await analyzePatterns({ transcripts });
  const newSessionIds = transcripts.map((t) => t.sessionId);

  // Update analysis timestamp
  await updateAnalysisTimestamp(userId);

  // Upsert each pattern and collect IDs
  const patternIds: number[] = [];
  for (const pattern of result.patterns) {
    const id = await upsertPattern(userId, pattern, newSessionIds);
    patternIds.push(id);
  }

  console.log(`[patterns-job] User ${userId}: upserted ${result.patterns.length} patterns`);

  // Assign queue positions and determine which pattern is active
  const activePatternId = await assignQueuePositions(userId, patternIds);

  // Only generate exercises for the active pattern
  if (activePatternId) {
    if (options?.awaitExercises) {
      await generateAndStorePatternExercises([activePatternId], userId);
    } else {
      generateAndStorePatternExercises([activePatternId], userId).catch(err =>
        console.error(`[patterns-job] Exercise generation failed:`, err)
      );
    }
  }

  return { patternsFound: result.patterns.length, patternIds };
}

async function upsertPattern(
  userId: number,
  pattern: SpeechPattern,
  newSessionIds: number[],
): Promise<number> {
  const identifier = pattern.identifier ?? '';

  // Check if pattern already exists
  const [existing] = await db
    .select({
      id: speechPatterns.id,
      sessionsAnalyzed: speechPatterns.sessionsAnalyzed,
    })
    .from(speechPatterns)
    .where(
      sql`${speechPatterns.userId} = ${userId}
        AND ${speechPatterns.type} = ${pattern.type}
        AND COALESCE(${speechPatterns.identifier}, '') = ${identifier}`,
    );

  const mergedSessionIds = existing
    ? [...new Set([...(existing.sessionsAnalyzed as number[]), ...newSessionIds])]
    : newSessionIds;

  if (existing) {
    await db
      .update(speechPatterns)
      .set({
        data: pattern,
        sessionsAnalyzed: mergedSessionIds,
        updatedAt: new Date(),
      })
      .where(eq(speechPatterns.id, existing.id));
    return existing.id;
  } else {
    const [inserted] = await db
      .insert(speechPatterns)
      .values({
        userId,
        type: pattern.type,
        identifier: pattern.identifier,
        data: pattern,
        sessionsAnalyzed: mergedSessionIds,
      })
      .returning({ id: speechPatterns.id });
    return inserted.id;
  }
}

/**
 * Run pattern analysis for all eligible users.
 * Eligible = patterns flag enabled + at least MIN_SESSIONS_REQUIRED unanalyzed sessions.
 */
export async function runPatternAnalysisAll(): Promise<{ usersProcessed: number; totalPatterns: number }> {
  // Find users with patterns flag enabled
  const eligibleUsers = await db
    .select({ id: users.id, analysisFlags: users.analysisFlags })
    .from(users);

  let usersProcessed = 0;
  let totalPatterns = 0;

  for (const user of eligibleUsers) {
    const flags = user.analysisFlags as AnalysisFlags | null;
    if (!flags?.patterns) continue;

    // Check unanalyzed session count
    const transcripts = await getUnanalyzedSessions(user.id);
    if (transcripts.length < MIN_SESSIONS_REQUIRED) continue;

    try {
      const result = await runPatternAnalysisForUser(user.id);
      usersProcessed++;
      totalPatterns += result.patternsFound;
    } catch (err) {
      console.error(`[patterns-job] Failed for user ${user.id}:`, err);
    }
  }

  console.log(`[patterns-job] Complete: ${usersProcessed} users, ${totalPatterns} patterns`);
  return { usersProcessed, totalPatterns };
}
