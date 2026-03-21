import { FastifyInstance } from 'fastify';
import { transcribe } from '../services/transcription.js';
import { analyzeSpeech } from '../services/analysis.js';
import { db } from '../db/index.js';
import { sessions, corrections, fillerWords } from '../db/schema.js';
import { eq, desc, sql } from 'drizzle-orm';
import { writeFile, unlink } from 'fs/promises';
import { randomUUID } from 'crypto';
import path from 'path';

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

      const [session] = await db
        .insert(sessions)
        .values({
          transcription: result.text,
          durationSeconds: durationSeconds,
          analysis: null,
        })
        .returning();

      // Run Claude analysis
      const analysisResult = await analyzeSpeech(result.sentences);

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
        await db.insert(corrections).values(
          analysisResult.corrections.map(c => ({
            sessionId: session.id,
            originalText: c.originalText,
            correctedText: c.correctedText,
            explanation: c.explanation || null,
            correctionType: c.correctionType || 'other',
            sentenceIndex: c.sentenceIndex,
            severity: c.severity,
            contextSnippet: c.contextSnippet || null,
          }))
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
        errorCount: sql<number>`(SELECT count(*) FROM corrections WHERE corrections.session_id = ${sessions.id} AND corrections.severity = 'error')`.as('error_count'),
        improvementCount: sql<number>`(SELECT count(*) FROM corrections WHERE corrections.session_id = ${sessions.id} AND corrections.severity = 'improvement')`.as('improvement_count'),
        polishCount: sql<number>`(SELECT count(*) FROM corrections WHERE corrections.session_id = ${sessions.id} AND corrections.severity = 'polish')`.as('polish_count'),
      })
      .from(sessions)
      .orderBy(desc(sessions.createdAt));

    return { sessions: rows };
  });

  // Get full session detail with corrections, filler words, and filler positions
  fastify.get<{ Params: { id: string } }>('/sessions/:id', async (request, reply) => {
    const sessionId = Number(request.params.id);

    const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId));
    if (!session) {
      return reply.code(404).send({ error: 'Session not found' });
    }

    const sessionCorrections = await db.select().from(corrections).where(eq(corrections.sessionId, sessionId));
    const sessionFillerWords = await db.select().from(fillerWords).where(eq(fillerWords.sessionId, sessionId));

    // Extract sentences, fillerPositions, and sessionInsights from the analysis JSON column
    const analysisData = session.analysis as {
      sentences?: string[];
      fillerPositions?: Array<{ sentenceIndex: number; word: string; startIndex: number }>;
      sessionInsights?: Array<{ type: string; description: string }>;
    } | null;
    const sentences = analysisData?.sentences ?? [];
    const fillerPositions = analysisData?.fillerPositions ?? [];
    const sessionInsights = analysisData?.sessionInsights ?? [];

    return {
      session: {
        ...session,
        sentences,
        corrections: sessionCorrections,
        fillerWords: sessionFillerWords,
        fillerPositions,
        sessionInsights,
      },
    };
  });
}
