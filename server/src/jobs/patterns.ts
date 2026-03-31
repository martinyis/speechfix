import { db } from '../db/index.js';
import { users, sessions, speechPatterns } from '../db/schema.js';
import { eq, sql, and, notInArray } from 'drizzle-orm';
import { analyzePatterns } from '../analysis/analyzers/patterns.js';
import type { AnalysisFlags, SpeechPattern } from '../analysis/types.js';

const MAX_SESSIONS = 20;
const MAX_CHARS = 50_000;
const MIN_SESSIONS_REQUIRED = 5;

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
 * Run pattern analysis for a single user.
 * Fetches unanalyzed sessions, calls the patterns analyzer, and upserts results.
 */
export async function runPatternAnalysisForUser(userId: number): Promise<number> {
  const transcripts = await getUnanalyzedSessions(userId);

  if (transcripts.length < 2) {
    console.log(`[patterns-job] User ${userId}: only ${transcripts.length} unanalyzed sessions, skipping`);
    return 0;
  }

  console.log(`[patterns-job] User ${userId}: analyzing ${transcripts.length} sessions`);

  const result = await analyzePatterns({ transcripts });
  const newSessionIds = transcripts.map((t) => t.sessionId);

  // Upsert each pattern
  for (const pattern of result.patterns) {
    await upsertPattern(userId, pattern, newSessionIds);
  }

  console.log(`[patterns-job] User ${userId}: upserted ${result.patterns.length} patterns`);
  return result.patterns.length;
}

async function upsertPattern(
  userId: number,
  pattern: SpeechPattern,
  newSessionIds: number[],
): Promise<void> {
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
  } else {
    await db.insert(speechPatterns).values({
      userId,
      type: pattern.type,
      identifier: pattern.identifier,
      data: pattern,
      sessionsAnalyzed: mergedSessionIds,
    });
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
      const count = await runPatternAnalysisForUser(user.id);
      usersProcessed++;
      totalPatterns += count;
    } catch (err) {
      console.error(`[patterns-job] Failed for user ${user.id}:`, err);
    }
  }

  console.log(`[patterns-job] Complete: ${usersProcessed} users, ${totalPatterns} patterns`);
  return { usersProcessed, totalPatterns };
}
