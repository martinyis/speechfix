import { FastifyInstance } from 'fastify';
import { getFillerSummary } from '../filler-coach/filler-history.js';
import { db } from '../../db/index.js';
import { sessions, corrections, fillerWords, agents } from '../../db/schema.js';
import { eq, desc, sql, and } from 'drizzle-orm';
import { generateAndPersistDeepInsights, type DeepInsight } from './deep-insights.js';
import type { SpeechTimeline } from '../voice/speech-types.js';
import type { FillerWordPosition } from '../../analysis/types.js';

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

  // Return the stored deep insights for a session. Optionally backfill on demand
  // when `?generate=1` is passed and the column is null.
  fastify.get<{ Params: { id: string }; Querystring: { generate?: string } }>(
    '/sessions/:id/deep-insights',
    async (request, reply) => {
      const sessionId = Number(request.params.id);
      if (!Number.isFinite(sessionId)) {
        return reply.code(400).send({ error: 'Invalid session id' });
      }

      const [session] = await db
        .select()
        .from(sessions)
        .where(and(eq(sessions.id, sessionId), eq(sessions.userId, request.user.userId)));
      if (!session) {
        return reply.code(404).send({ error: 'Session not found' });
      }

      const stored = session.deepInsights as DeepInsight[] | null;
      if (stored !== null) {
        return { insights: stored };
      }

      if (request.query.generate !== '1') {
        return { insights: null };
      }

      // Lazy backfill — reconstruct the generator input from stored session data.
      const analysis = session.analysis as {
        sentences?: string[];
        fillerPositions?: FillerWordPosition[];
        speechTimeline?: SpeechTimeline;
      } | null;
      const conversationTranscriptRaw = session.conversationTranscript as Array<{ role: string; content: string }> | null;
      if (!analysis?.speechTimeline || !conversationTranscriptRaw) {
        return reply.code(422).send({ error: 'Session lacks signals required for deep insights' });
      }

      const sessionCorrections = await db.select().from(corrections).where(eq(corrections.sessionId, sessionId));
      const sessionFillerWords = await db.select().from(fillerWords).where(eq(fillerWords.sessionId, sessionId));

      const conversationTranscript = conversationTranscriptRaw
        .filter(m => m.content && m.content !== '[Session started]' && !m.content.startsWith('[User has been silent'))
        .map(m => ({
          role: (m.role === 'assistant' ? 'ai' : 'user') as 'ai' | 'user',
          text: m.content,
        }));

      const insights = await generateAndPersistDeepInsights(sessionId, {
        speechTimeline: analysis.speechTimeline,
        conversationTranscript,
        corrections: sessionCorrections.map(c => ({
          originalText: c.originalText,
          correctedText: c.correctedText,
          correctionType: c.correctionType,
          severity: c.severity,
        })),
        fillerWords: sessionFillerWords.map(f => ({ word: f.word, count: f.count })),
        fillerPositions: (analysis.fillerPositions ?? []).map(p => ({
          word: p.word,
          sentenceIndex: p.sentenceIndex,
          time: p.timeSeconds ?? null,
        })),
        topicCategory: session.topicCategory ?? null,
        sessionTitle: session.title ?? null,
        durationSeconds: session.durationSeconds,
      });

      return { insights };
    },
  );
}
