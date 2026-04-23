import { db } from '../../db/index.js';
import { fillerWords, sessions } from '../../db/schema.js';
import { eq, sql } from 'drizzle-orm';

interface FillerAggregate {
  word: string;
  totalCount: number;
  sessionCount: number;
  avgPerSession: number;
}

/**
 * Returns aggregated filler word stats for a user across all conversation
 * sessions (used by the `/filler-summary` endpoint).
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
