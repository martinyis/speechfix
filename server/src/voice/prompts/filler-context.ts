import { db } from '../../db/index.js';
import { fillerWords, sessions } from '../../db/schema.js';
import { eq, desc, sql } from 'drizzle-orm';

interface FillerAggregate {
  word: string;
  totalCount: number;
  sessionCount: number;
  avgPerSession: number;
}

/**
 * Builds a filler word history prompt for injecting into the coaching session.
 * Returns empty string if user has no filler history.
 */
export async function buildFillerHistoryPrompt(userId: number): Promise<string> {
  // Aggregate filler words across all user sessions
  const aggregates = await db
    .select({
      word: fillerWords.word,
      totalCount: sql<number>`sum(${fillerWords.count})::int`,
      sessionCount: sql<number>`count(distinct ${fillerWords.sessionId})::int`,
    })
    .from(fillerWords)
    .innerJoin(sessions, eq(fillerWords.sessionId, sessions.id))
    .where(eq(sessions.userId, userId))
    .groupBy(fillerWords.word)
    .orderBy(sql`sum(${fillerWords.count}) desc`);

  if (aggregates.length === 0) return '';

  // Get most recent session's filler data
  const recentSession = await db
    .select({
      sessionId: sessions.id,
      createdAt: sessions.createdAt,
    })
    .from(sessions)
    .where(eq(sessions.userId, userId))
    .orderBy(desc(sessions.createdAt))
    .limit(1);

  let recentFillers: Array<{ word: string; count: number }> = [];
  let recentDate = '';
  if (recentSession.length > 0) {
    recentFillers = await db
      .select({ word: fillerWords.word, count: fillerWords.count })
      .from(fillerWords)
      .where(eq(fillerWords.sessionId, recentSession[0].sessionId));

    const daysDiff = Math.round(
      (Date.now() - new Date(recentSession[0].createdAt).getTime()) / (1000 * 60 * 60 * 24),
    );
    recentDate = daysDiff === 0 ? 'today' : daysDiff === 1 ? 'yesterday' : `${daysDiff} days ago`;
  }

  const lines: string[] = ['FILLER WORD HISTORY:'];

  for (const agg of aggregates) {
    const avg = (agg.totalCount / agg.sessionCount).toFixed(1);
    lines.push(`- "${agg.word}": ${agg.totalCount} total across ${agg.sessionCount} session${agg.sessionCount > 1 ? 's' : ''} (avg ${avg}/session)`);
  }

  if (recentFillers.length > 0 && recentDate) {
    const recentParts = recentFillers.map((f) => `${f.word} x${f.count}`);
    lines.push(`Most recent session (${recentDate}): ${recentParts.join(', ')}`);
  }

  return lines.join('\n');
}

/**
 * Returns aggregated filler word stats for a user (used by API endpoint).
 */
export async function getFillerSummary(userId: number): Promise<{
  words: FillerAggregate[];
  totalSessions: number;
}> {
  const aggregates = await db
    .select({
      word: fillerWords.word,
      totalCount: sql<number>`sum(${fillerWords.count})::int`,
      sessionCount: sql<number>`count(distinct ${fillerWords.sessionId})::int`,
    })
    .from(fillerWords)
    .innerJoin(sessions, eq(fillerWords.sessionId, sessions.id))
    .where(eq(sessions.userId, userId))
    .groupBy(fillerWords.word)
    .orderBy(sql`sum(${fillerWords.count}) desc`);

  const totalSessionsResult = await db
    .select({ count: sql<number>`count(distinct ${sessions.id})::int` })
    .from(sessions)
    .innerJoin(fillerWords, eq(fillerWords.sessionId, sessions.id))
    .where(eq(sessions.userId, userId));

  const totalSessions = totalSessionsResult[0]?.count ?? 0;

  return {
    words: aggregates.map((a) => ({
      word: a.word,
      totalCount: a.totalCount,
      sessionCount: a.sessionCount,
      avgPerSession: Number((a.totalCount / a.sessionCount).toFixed(1)),
    })),
    totalSessions,
  };
}
