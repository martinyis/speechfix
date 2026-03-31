import { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { corrections, sessions, practiceAttempts } from '../db/schema.js';
import { eq, sql, and } from 'drizzle-orm';
import { transcribeRawPCM } from '../services/transcription.js';
import {
  evaluateSayItRight,
  evaluateUseItNaturally,
  generateScenario,
  type CorrectionContext,
} from '../services/practice-evaluator.js';
import { writeFile, unlink } from 'fs/promises';
import { randomUUID } from 'crypto';
import path from 'path';

export async function practiceRoutes(fastify: FastifyInstance) {
  // GET /tasks — List all practice tasks for user
  fastify.get('/tasks', async (request, reply) => {
    const userId = request.user.userId;

    const rows = await db.execute(sql`
      SELECT
        c.id AS correction_id,
        c.session_id,
        c.original_text,
        c.corrected_text,
        c.explanation,
        c.correction_type,
        c.severity,
        c.context_snippet,
        c.scenario,
        c.created_at,
        s.created_at AS session_date,
        BOOL_OR(pa.passed) AS practiced,
        MAX(pa.created_at) AS last_practiced_at,
        COUNT(pa.id)::int AS practice_count
      FROM corrections c
      JOIN sessions s ON s.id = c.session_id
      LEFT JOIN practice_attempts pa ON pa.correction_id = c.id
      WHERE s.user_id = ${userId}
      GROUP BY c.id, s.created_at
      ORDER BY c.created_at DESC
    `);

    const tasks = Array.from(rows).map((row: any) => ({
      correctionId: row.correction_id,
      sessionId: row.session_id,
      sessionDate: row.session_date,
      originalText: row.original_text,
      correctedText: row.corrected_text,
      explanation: row.explanation,
      correctionType: row.correction_type,
      severity: row.severity,
      contextSnippet: row.context_snippet,
      scenario: row.scenario ?? null,
      practiced: row.practiced ?? false,
      lastPracticedAt: row.last_practiced_at ?? null,
      practiceCount: row.practice_count ?? 0,
    }));

    return { tasks };
  });

  // POST /evaluate — Evaluate a practice attempt
  fastify.post('/evaluate', async (request, reply) => {
    const userId = request.user.userId;
    console.log('[Practice/evaluate] Request received from user:', userId);
    const data = await request.file();

    if (!data) {
      console.warn('[Practice/evaluate] No audio file in request');
      return reply.code(400).send({ error: 'No audio file provided' });
    }
    console.log('[Practice/evaluate] File received — fieldname:', data.fieldname, 'mimetype:', data.mimetype, 'fields:', Object.keys(data.fields || {}));

    // Extract form fields
    const correctionIdField = data.fields?.correctionId;
    const modeField = data.fields?.mode;
    const scenarioField = data.fields?.scenario;

    const correctionId = Number(
      correctionIdField && 'value' in correctionIdField ? correctionIdField.value : null
    );
    const mode = String(
      modeField && 'value' in modeField ? modeField.value : ''
    );
    const scenario = scenarioField && 'value' in scenarioField
      ? String(scenarioField.value)
      : undefined;

    console.log('[Practice/evaluate] Parsed fields — correctionId:', correctionId, 'mode:', mode, 'scenario:', scenario ? 'yes' : 'no');

    if (!correctionId || !mode || !['say_it_right', 'use_it_naturally'].includes(mode)) {
      console.warn('[Practice/evaluate] Invalid fields — aborting');
      return reply.code(400).send({ error: 'correctionId and mode (say_it_right|use_it_naturally) are required' });
    }

    if (mode === 'use_it_naturally' && !scenario) {
      return reply.code(400).send({ error: 'scenario is required for use_it_naturally mode' });
    }

    const tempPath = path.join('/tmp', `${randomUUID()}.pcm`);
    const buffer = await data.toBuffer();
    console.log(`[Practice/evaluate] Audio buffer size: ${buffer.length} bytes, writing to ${tempPath}`);
    await writeFile(tempPath, buffer);

    try {
      // Run correction lookup and transcription in parallel
      const [correctionRow, transcription] = await Promise.all([
        db
          .select({
            id: corrections.id,
            originalText: corrections.originalText,
            correctedText: corrections.correctedText,
            explanation: corrections.explanation,
            correctionType: corrections.correctionType,
          })
          .from(corrections)
          .innerJoin(sessions, eq(corrections.sessionId, sessions.id))
          .where(and(eq(corrections.id, correctionId), eq(sessions.userId, userId)))
          .then(rows => rows[0] ?? null),
        transcribeRawPCM(tempPath).then(result => {
          console.log('[Practice/evaluate] Transcription result:', JSON.stringify(result));
          return result;
        }),
      ]);

      const correction = correctionRow;
      if (!correction) {
        return reply.code(404).send({ error: 'Correction not found' });
      }

      if (!transcription.text) {
        console.warn('[Practice/evaluate] No speech detected');
        return reply.code(200).send({
          passed: false,
          transcript: '',
          feedback: 'No speech detected. Try again.',
          attemptId: null,
        });
      }

      const correctionCtx: CorrectionContext = {
        originalText: correction.originalText,
        correctedText: correction.correctedText,
        explanation: correction.explanation,
        correctionType: correction.correctionType,
      };

      // Evaluate based on mode
      const result = mode === 'say_it_right'
        ? await evaluateSayItRight(correctionCtx, transcription.text)
        : await evaluateUseItNaturally(correctionCtx, transcription.text, scenario!);

      // Save practice attempt
      const [attempt] = await db
        .insert(practiceAttempts)
        .values({
          userId,
          correctionId,
          mode,
          passed: result.passed,
          transcript: transcription.text,
          feedback: result.feedback,
        })
        .returning({ id: practiceAttempts.id });

      return {
        passed: result.passed,
        transcript: transcription.text,
        feedback: result.feedback,
        attemptId: attempt.id,
      };
    } finally {
      await unlink(tempPath).catch(() => {});
    }
  });

  // GET /scenario — Generate a scenario for "Use It Naturally" mode
  fastify.get<{ Querystring: { correctionId: string } }>('/scenario', async (request, reply) => {
    const userId = request.user.userId;
    const correctionId = Number(request.query.correctionId);

    if (!correctionId) {
      return reply.code(400).send({ error: 'correctionId query parameter is required' });
    }

    // Verify correction belongs to user and check for pre-generated scenario
    const [correction] = await db
      .select({
        originalText: corrections.originalText,
        correctedText: corrections.correctedText,
        explanation: corrections.explanation,
        correctionType: corrections.correctionType,
        scenario: corrections.scenario,
      })
      .from(corrections)
      .innerJoin(sessions, eq(corrections.sessionId, sessions.id))
      .where(and(eq(corrections.id, correctionId), eq(sessions.userId, userId)));

    if (!correction) {
      return reply.code(404).send({ error: 'Correction not found' });
    }

    // Return pre-generated scenario if available, otherwise generate on-demand
    if (correction.scenario) {
      return { scenario: correction.scenario };
    }

    const scenario = await generateScenario({
      originalText: correction.originalText,
      correctedText: correction.correctedText,
      explanation: correction.explanation,
      correctionType: correction.correctionType,
    });

    return { scenario };
  });
}
