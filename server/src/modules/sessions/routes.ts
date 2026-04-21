import { FastifyInstance } from 'fastify';
import { getFillerSummary } from '../../voice/prompts/filler-context.js';
import { db } from '../../db/index.js';
import { sessions, corrections, fillerWords, agents } from '../../db/schema.js';
import { eq, desc, sql, and } from 'drizzle-orm';

export async function sessionRoutes(fastify: FastifyInstance) {
  // List all sessions with error count, newest first
  fastify.get('/sessions', async (request, reply) => {
    const rows = await db
      .select({
        id: sessions.id,
        durationSeconds: sessions.durationSeconds,
        createdAt: sessions.createdAt,
        title: sessions.title,
        description: sessions.description,
        topicCategory: sessions.topicCategory,
        clarityScore: sessions.clarityScore,
        agentId: sessions.agentId,
        agentName: agents.name,
        agentSettings: agents.settings,
        errorCount: sql<number>`(SELECT count(*)::int FROM corrections WHERE corrections.session_id = "sessions"."id" AND corrections.severity = 'error')`.as('error_count'),
        improvementCount: sql<number>`(SELECT count(*)::int FROM corrections WHERE corrections.session_id = "sessions"."id" AND corrections.severity = 'improvement')`.as('improvement_count'),
        polishCount: sql<number>`(SELECT count(*)::int FROM corrections WHERE corrections.session_id = "sessions"."id" AND corrections.severity = 'polish')`.as('polish_count'),
        totalFillerCount: sql<number>`(SELECT COALESCE(sum(count), 0)::int FROM filler_words WHERE filler_words.session_id = "sessions"."id")`.as('total_filler_count'),
      })
      .from(sessions)
      .leftJoin(agents, eq(sessions.agentId, agents.id))
      .where(eq(sessions.userId, request.user.userId))
      .orderBy(desc(sessions.createdAt));

    return {
      sessions: rows.map(({ agentSettings, ...rest }) => ({
        ...rest,
        agentAvatarSeed: (agentSettings as Record<string, unknown> | null)?.avatarSeed as string | null ?? null,
      })),
    };
  });

  // Get full session detail with corrections, filler words, and filler positions
  fastify.get<{ Params: { id: string } }>('/sessions/:id', async (request, reply) => {
    const sessionId = Number(request.params.id);

    const [session] = await db.select().from(sessions).where(and(eq(sessions.id, sessionId), eq(sessions.userId, request.user.userId)));
    if (!session) {
      return reply.code(404).send({ error: 'Session not found' });
    }

    const sessionCorrections = await db.select().from(corrections).where(eq(corrections.sessionId, sessionId));
    const sessionFillerWords = await db.select().from(fillerWords).where(eq(fillerWords.sessionId, sessionId));

    // Extract sentences, fillerPositions, sessionInsights, and speechTimeline from the analysis JSON column
    const analysisData = session.analysis as {
      sentences?: string[];
      fillerPositions?: Array<{ sentenceIndex: number; word: string; startIndex: number }>;
      sessionInsights?: Array<{ type: string; description: string }>;
      speechTimeline?: Record<string, unknown>;
    } | null;
    const sentences = analysisData?.sentences ?? [];
    const fillerPositions = analysisData?.fillerPositions ?? [];
    const sessionInsights = analysisData?.sessionInsights ?? [];
    const speechTimeline = analysisData?.speechTimeline ?? null;

    return {
      session: {
        ...session,
        sentences,
        corrections: sessionCorrections,
        fillerWords: sessionFillerWords,
        fillerPositions,
        sessionInsights,
        speechTimeline,
      },
    };
  });

  // Get aggregated filler word summary for the user
  fastify.get('/filler-summary', async (request) => {
    const summary = await getFillerSummary(request.user.userId);
    return summary;
  });
}
