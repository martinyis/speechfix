import { db } from '../../db/index.js';
import { users, sessions, speechPatterns } from '../../db/schema.js';
import { eq, sql, and, notInArray } from 'drizzle-orm';
import { analyzePatterns } from '../../analysis/analyzers/patterns.js';
import { generateAndStorePatternExercises } from './exercise-generator.js';
import type { AnalysisFlags, SpeechPattern, PatternType } from '../../analysis/types.js';

const MAX_SESSIONS = 20;
const MAX_CHARS = 50_000;
const MIN_SESSIONS_REQUIRED = 5;
const MIN_TOTAL_SESSIONS = 3;
const MIN_TOTAL_SENTENCES = 30;
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

  const [userRow] = await db
    .select({ context: users.context, goals: users.goals })
    .from(users)
    .where(eq(users.id, userId));
  const userProfile = {
    context: userRow?.context ?? null,
    goals: (userRow?.goals as string[] | null) ?? null,
  };

  const result = await analyzePatterns({ transcripts, userProfile });
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
      data: speechPatterns.data,
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
    // Preserve behavioral-tracking fields we stored in `data` separately
    // from what the LLM returns (baselineFrequency, priorMasterings, any
    // dismissReason). The LLM overwrites the rest.
    const existingData = (existing.data ?? {}) as Record<string, unknown>;
    const preserved: Record<string, unknown> = {};
    if (existingData.baselineFrequency !== undefined) preserved.baselineFrequency = existingData.baselineFrequency;
    if (existingData.priorMasterings !== undefined) preserved.priorMasterings = existingData.priorMasterings;
    if (existingData.dismissReason !== undefined) preserved.dismissReason = existingData.dismissReason;
    const mergedData = { ...pattern, ...preserved };

    await db
      .update(speechPatterns)
      .set({
        data: mergedData,
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

// ─── Behavior-driven graduation / regression ─────────────────────────────
//
// After each session analysis we walk every `watching` pattern for the user
// and compare its frequency in the new session vs the baseline captured when
// the pattern entered watching. A session is "clean" if the pattern dropped
// ≥50% OR didn't appear at all. Three clean sessions → mastered.
//
// In parallel, mastered patterns that resurface at non-trivial frequency
// regress back to queued with `isReturning=true`.
//
// These run cheaply via local substring matching against the session's
// sentences (the analysis JSONB already stores them). No LLM call needed.

const CLEAN_DROP_RATIO = 0.5;           // frequency must drop ≥50% to count clean
const CLEAN_SESSIONS_TO_GRADUATE = 3;
/**
 * Regression threshold. A mastered pattern is considered to have "come back"
 * if it appears at least this many times in a single new session. Three is
 * a conservative floor — a single slip doesn't regress a pattern, but a real
 * return to habit will cross it quickly.
 */
const REGRESSION_FREQUENCY_THRESHOLD = 3;

/** Fetch a session's sentences (from the analysis JSONB written at persist time). */
async function getSessionSentences(sessionId: number): Promise<string[] | null> {
  const [row] = await db
    .select({ analysis: sessions.analysis })
    .from(sessions)
    .where(eq(sessions.id, sessionId));
  const analysis = row?.analysis as { sentences?: string[] } | null;
  if (!Array.isArray(analysis?.sentences)) return null;
  return analysis.sentences;
}

/**
 * Count how many times a pattern of the given `type` + `identifier` appears
 * in the session's sentences. This is a *cheap* local match; it intentionally
 * doesn't try to reach LLM quality. Good enough for behavior tracking.
 *
 * For typed-identifier patterns (overused_word, repetitive_starter,
 * crutch_phrase) we do substring counting. For `hedging` + `negative_framing`
 * we scan for a small built-in lexicon — they come from the same lexicon the
 * exercise generator uses, so this stays consistent with the LLM's notion of
 * what counts as "hedging".
 */
const HEDGING_LEXICON = [
  'kind of', 'sort of', 'i think', 'maybe', 'probably',
  'try to', "we'll see", "i'll look into it", 'not sure',
  'i guess', 'perhaps', 'somewhat',
];
const NEGATIVE_FRAMING_LEXICON = [
  "can't", "cannot", "don't", "won't", "shouldn't",
  "the problem is", "there's no way", "it's impossible",
  "there's no", "issue is", "that's hard",
];

function countOccurrences(text: string, needle: string): number {
  if (!needle) return 0;
  const haystack = text.toLowerCase();
  const n = needle.toLowerCase();
  let count = 0;
  let i = 0;
  while ((i = haystack.indexOf(n, i)) !== -1) {
    count++;
    i += n.length;
  }
  return count;
}

export function countPatternInSentences(
  type: PatternType,
  identifier: string | null,
  sentences: string[],
): number {
  const joined = sentences.join(' ');

  if (type === 'overused_word' || type === 'crutch_phrase') {
    return identifier ? countOccurrences(joined, identifier) : 0;
  }

  if (type === 'repetitive_starter') {
    if (!identifier) return 0;
    const starter = identifier.toLowerCase();
    return sentences.reduce(
      (acc, s) => (s.trim().toLowerCase().startsWith(starter) ? acc + 1 : acc),
      0,
    );
  }

  if (type === 'hedging') {
    return HEDGING_LEXICON.reduce((acc, w) => acc + countOccurrences(joined, w), 0);
  }

  if (type === 'negative_framing') {
    return NEGATIVE_FRAMING_LEXICON.reduce((acc, w) => acc + countOccurrences(joined, w), 0);
  }

  return 0;
}

/**
 * Extract the baseline frequency used to decide whether a new session is
 * "clean". Stored under `data.baselineFrequency` when the pattern enters
 * watching; falls back to the LLM-reported `frequency` at detection time.
 */
function extractBaseline(data: unknown): number {
  if (typeof data !== 'object' || data === null) return 0;
  const d = data as { baselineFrequency?: number; frequency?: number };
  if (typeof d.baselineFrequency === 'number' && d.baselineFrequency > 0) return d.baselineFrequency;
  if (typeof d.frequency === 'number' && d.frequency > 0) return d.frequency;
  return 0;
}

/**
 * Walk all `watching` patterns for this user, increment `cleanSessionCount`
 * on any that were clean in this session, and graduate to `mastered` at 3.
 *
 * Safe to call on every completed session.
 */
export async function processWatchingGraduation(
  userId: number,
  sessionId: number,
): Promise<{ graduated: number; incremented: number }> {
  const sentences = await getSessionSentences(sessionId);
  if (!sentences || sentences.length === 0) return { graduated: 0, incremented: 0 };

  const watchingRows = await db
    .select({
      id: speechPatterns.id,
      type: speechPatterns.type,
      identifier: speechPatterns.identifier,
      data: speechPatterns.data,
      cleanSessionCount: speechPatterns.cleanSessionCount,
    })
    .from(speechPatterns)
    .where(and(eq(speechPatterns.userId, userId), eq(speechPatterns.status, 'watching')));

  let graduated = 0;
  let incremented = 0;
  const now = new Date();

  for (const row of watchingRows) {
    const baseline = extractBaseline(row.data);
    const freq = countPatternInSentences(row.type as PatternType, row.identifier, sentences);
    const cleanThreshold = Math.max(1, Math.floor(baseline * CLEAN_DROP_RATIO));
    const isClean = baseline === 0 ? freq === 0 : freq < cleanThreshold;

    if (!isClean) continue;

    const nextCount = row.cleanSessionCount + 1;
    if (nextCount >= CLEAN_SESSIONS_TO_GRADUATE) {
      await db
        .update(speechPatterns)
        .set({
          status: 'mastered',
          masteredAt: now,
          enteredWatchingAt: null,
          cleanSessionCount: nextCount,
          updatedAt: now,
        })
        .where(eq(speechPatterns.id, row.id));
      graduated++;
    } else {
      await db
        .update(speechPatterns)
        .set({ cleanSessionCount: nextCount, updatedAt: now })
        .where(eq(speechPatterns.id, row.id));
      incremented++;
    }
  }

  if (graduated > 0 || incremented > 0) {
    console.log(
      `[patterns-job] graduation: user=${userId} session=${sessionId} ` +
        `graduated=${graduated} incremented=${incremented}`,
    );
  }
  return { graduated, incremented };
}

/**
 * Walk all `mastered` patterns for this user; any that resurface at or above
 * REGRESSION_FREQUENCY_THRESHOLD in this session flip back to `queued` with
 * `isReturning=true`. They sort to the top of the queue (queue_position=-1).
 *
 * Safe to call on every completed session.
 */
export async function processMasteredRegression(
  userId: number,
  sessionId: number,
): Promise<{ regressed: number }> {
  const sentences = await getSessionSentences(sessionId);
  if (!sentences || sentences.length === 0) return { regressed: 0 };

  const masteredRows = await db
    .select({
      id: speechPatterns.id,
      type: speechPatterns.type,
      identifier: speechPatterns.identifier,
      data: speechPatterns.data,
      masteredAt: speechPatterns.masteredAt,
    })
    .from(speechPatterns)
    .where(and(eq(speechPatterns.userId, userId), eq(speechPatterns.status, 'mastered')));

  let regressed = 0;
  const now = new Date();

  for (const row of masteredRows) {
    const freq = countPatternInSentences(row.type as PatternType, row.identifier, sentences);
    if (freq < REGRESSION_FREQUENCY_THRESHOLD) continue;

    // Preserve mastery history in the data blob so the Mastered screen can
    // still surface "was returning" badges after a re-mastery.
    const currentData = (row.data ?? {}) as Record<string, unknown>;
    const priorMasterings = Array.isArray(currentData.priorMasterings)
      ? (currentData.priorMasterings as string[])
      : [];
    const nextData = {
      ...currentData,
      priorMasterings: row.masteredAt
        ? [...priorMasterings, row.masteredAt.toISOString()]
        : priorMasterings,
    };

    await db
      .update(speechPatterns)
      .set({
        status: 'queued',
        isReturning: true,
        lastRegressedAt: now,
        cleanSessionCount: 0,
        queuePosition: -1, // sort to top of queue
        data: nextData as any,
        updatedAt: now,
      })
      .where(eq(speechPatterns.id, row.id));

    regressed++;
  }

  if (regressed > 0) {
    console.log(
      `[patterns-job] regression: user=${userId} session=${sessionId} regressed=${regressed}`,
    );
  }
  return { regressed };
}

/**
 * Convenience — run both post-session pattern checks. Called from the
 * session persist pipeline after analysis is written to the sessions row.
 */
export async function runPostSessionPatternUpdates(
  userId: number,
  sessionId: number,
): Promise<void> {
  try {
    await processWatchingGraduation(userId, sessionId);
    await processMasteredRegression(userId, sessionId);
  } catch (err) {
    console.error('[patterns-job] post-session updates failed:', err);
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
