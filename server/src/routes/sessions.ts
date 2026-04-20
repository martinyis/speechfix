import { FastifyInstance } from 'fastify';
import { transcribe } from '../services/transcription.js';
import { runAnalysis } from '../analysis/index.js';
import { generateSessionMetadata } from '../services/title-generator.js';
import { getFillerSummary } from '../voice/prompts/filler-context.js';
import { db } from '../db/index.js';
import { sessions, corrections, fillerWords, agents } from '../db/schema.js';
import { eq, desc, sql, and } from 'drizzle-orm';
import { absorbCorrections } from '../services/weak-spot-manager.js';
import { writeFile, unlink } from 'fs/promises';
import { randomUUID } from 'crypto';
import path from 'path';

function computeClarityScore(
  sentences: string[],
  correctionsList: Array<{ sentenceIndex: number }>,
): number {
  const total = sentences.length;
  if (total === 0) return 100;
  const sentencesWithCorrections = new Set(correctionsList.map((c) => c.sentenceIndex)).size;
  const clean = Math.max(0, total - sentencesWithCorrections);
  return Math.round((clean / total) * 100);
}

export async function sessionRoutes(fastify: FastifyInstance) {
  fastify.post('/sessions', async (request, reply) => {
    const data = await request.file();

    if (!data) {
      return reply.code(400).send({ error: 'No audio file provided' });
    }

    const tempPath = path.join('/tmp', `${randomUUID()}.m4a`);
    const buffer = await data.toBuffer();
    await writeFile(tempPath, buffer);

    // Duration is sent as a form field; @fastify/multipart fields are MultipartValue objects
    const durationField = data.fields?.duration;
    const durationSeconds = Number(
      (durationField && 'value' in durationField ? durationField.value : null) ?? 0
    );

    try {
      const result = await transcribe(tempPath);

      if (!result.text) {
        return reply.code(200).send({ session: null, message: 'No speech detected' });
      }

      // Run analysis and title generation in parallel
      const [analysisResult, metadata] = await Promise.all([
        runAnalysis(request.user.userId, { sentences: result.sentences, mode: 'recording' }),
        generateSessionMetadata(result.text),
      ]);

      const clarityScore = computeClarityScore(result.sentences, analysisResult.corrections);

      const [session] = await db
        .insert(sessions)
        .values({
          userId: request.user.userId,
          transcription: result.text,
          durationSeconds: durationSeconds,
          analysis: null,
          title: metadata.title,
          description: metadata.description,
          topicCategory: metadata.topicCategory,
          clarityScore,
        })
        .returning();

      // Store sentences, filler positions, and session insights in the analysis JSON column
      await db.update(sessions).set({
        analysis: {
          sentences: result.sentences,
          fillerPositions: analysisResult.fillerPositions,
          sessionInsights: analysisResult.sessionInsights,
        }
      }).where(eq(sessions.id, session.id));

      // Store corrections in database (with sentenceIndex for frontend matching)
      if (analysisResult.corrections.length > 0) {
        const inserted = await db.insert(corrections).values(
          analysisResult.corrections.map(c => ({
            sessionId: session.id,
            originalText: c.originalText,
            correctedText: c.correctedText,
            explanation: c.explanation || null,
            shortReason: c.shortReason || null,
            correctionType: c.correctionType || 'other',
            sentenceIndex: c.sentenceIndex,
            severity: c.severity,
            contextSnippet: c.contextSnippet || null,
            fullContext: c.contextSnippet || null,
          }))
        ).returning();

        // Fire-and-forget: absorb corrections into weak spots system
        absorbCorrections(request.user.userId, inserted.map(r => r.id), result.sentences).catch(err =>
          console.error('[sessions] Failed to absorb corrections:', err)
        );
      }

      // Store filler words in database
      if (analysisResult.fillerWords.length > 0) {
        await db.insert(fillerWords).values(
          analysisResult.fillerWords.map(f => ({
            sessionId: session.id,
            word: f.word,
            count: f.count,
          }))
        );
      }

      return {
        session: {
          ...session,
          sentences: result.sentences,
          corrections: analysisResult.corrections,
          fillerWords: analysisResult.fillerWords,
          fillerPositions: analysisResult.fillerPositions,
        },
      };
    } finally {
      await unlink(tempPath).catch(() => {});
    }
  });

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
