import { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import {
  corrections,
  sessions,
  weakSpots,
  weakSpotCorrections,
  weakSpotExercises,
  weakSpotDrillAttempts,
  practiceAttempts,
} from '../db/schema.js';
import { eq, and, sql, isNull } from 'drizzle-orm';
import { transcribeRawPCM } from '../services/transcription.js';
import {
  evaluateSayItRight,
  evaluateWeakSpotExercise,
  type CorrectionContext,
  type WeakSpotExerciseContext,
} from '../services/practice-evaluator.js';
import {
  advanceSRS,
  dismissWeakSpot,
  dismissQuickFix,
  backfillWeakSpots,
} from '../services/weak-spot-manager.js';
import { writeFile, unlink } from 'fs/promises';
import { randomUUID } from 'crypto';
import path from 'path';

export async function weakSpotRoutes(fastify: FastifyInstance) {
  // GET /practice/weak-spots — Returns active spots, backlog, and quick fixes
  fastify.get('/weak-spots', async (request, reply) => {
    const userId = request.user.userId;

    // Backfill: if user has zero weak spots (any status), run one-time backfill
    const [existingCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(weakSpots)
      .where(eq(weakSpots.userId, userId));

    if (Number(existingCount.count) === 0) {
      await backfillWeakSpots(userId);
    }

    // 1. Active weak spots with corrections and exercises
    const activeRows = await db
      .select()
      .from(weakSpots)
      .where(and(eq(weakSpots.userId, userId), eq(weakSpots.status, 'active')));

    const activeSpots = await Promise.all(
      activeRows.map(async (spot) => {
        const [spotCorrections, exercises] = await Promise.all([
          db
            .select({
              id: corrections.id,
              originalText: corrections.originalText,
              correctedText: corrections.correctedText,
              explanation: corrections.explanation,
              correctionType: corrections.correctionType,
              severity: corrections.severity,
              fullContext: corrections.fullContext,
              sentenceIndex: corrections.sentenceIndex,
              sessionId: corrections.sessionId,
              createdAt: corrections.createdAt,
            })
            .from(weakSpotCorrections)
            .innerJoin(corrections, eq(weakSpotCorrections.correctionId, corrections.id))
            .where(eq(weakSpotCorrections.weakSpotId, spot.id)),
          db
            .select()
            .from(weakSpotExercises)
            .where(eq(weakSpotExercises.weakSpotId, spot.id))
            .orderBy(weakSpotExercises.orderIndex),
        ]);

        const now = new Date();
        const isDue = spot.nextReviewAt === null || spot.nextReviewAt <= now;

        return {
          ...spot,
          corrections: spotCorrections,
          exercises,
          isDue,
        };
      }),
    );

    // 2. Backlog summary
    const backlogRows = await db
      .select({
        id: weakSpots.id,
        correctionType: weakSpots.correctionType,
        severity: weakSpots.severity,
        isRecurring: weakSpots.isRecurring,
        createdAt: weakSpots.createdAt,
      })
      .from(weakSpots)
      .where(and(eq(weakSpots.userId, userId), eq(weakSpots.status, 'backlog')));

    const backlog = await Promise.all(
      backlogRows.map(async (spot) => {
        const [countResult] = await db
          .select({ count: sql<number>`count(*)` })
          .from(weakSpotCorrections)
          .where(eq(weakSpotCorrections.weakSpotId, spot.id));

        return {
          ...spot,
          correctionCount: Number(countResult?.count ?? 0),
        };
      }),
    );

    // 3. Quick fixes: corrections NOT in any weak spot, not dismissed
    const quickFixRows = await db.execute(sql`
      SELECT
        c.id,
        c.original_text,
        c.corrected_text,
        c.explanation,
        c.correction_type,
        c.severity,
        c.full_context,
        c.sentence_index,
        c.session_id,
        c.created_at,
        BOOL_OR(pa.passed) AS practiced
      FROM corrections c
      JOIN sessions s ON s.id = c.session_id
      LEFT JOIN weak_spot_corrections wsc ON c.id = wsc.correction_id
      LEFT JOIN practice_attempts pa ON pa.correction_id = c.id AND pa.passed = true
      WHERE s.user_id = ${userId}
        AND wsc.id IS NULL
        AND (c.dismissed IS NOT TRUE)
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `);

    const quickFixes = Array.from(quickFixRows).map((row: any) => ({
      id: row.id,
      originalText: row.original_text,
      correctedText: row.corrected_text,
      explanation: row.explanation,
      correctionType: row.correction_type,
      severity: row.severity,
      fullContext: row.full_context,
      sentenceIndex: row.sentence_index,
      sessionId: row.session_id,
      createdAt: row.created_at,
      practiced: row.practiced ?? false,
    }));

    return { activeSpots, backlog, quickFixes };
  });

  // POST /practice/weak-spot-evaluate — Evaluate a weak spot drill item
  fastify.post('/weak-spot-evaluate', async (request, reply) => {
    const userId = request.user.userId;
    const data = await request.file();

    if (!data) {
      return reply.code(400).send({ error: 'No audio file provided' });
    }

    const weakSpotIdField = data.fields?.weakSpotId;
    const itemTypeField = data.fields?.itemType;
    const itemIdField = data.fields?.itemId;

    const weakSpotId = Number(
      weakSpotIdField && 'value' in weakSpotIdField ? weakSpotIdField.value : null,
    );
    const itemType = String(
      itemTypeField && 'value' in itemTypeField ? itemTypeField.value : '',
    );
    const itemId = Number(
      itemIdField && 'value' in itemIdField ? itemIdField.value : null,
    );

    if (!weakSpotId || !itemType || !itemId || !['correction', 'exercise'].includes(itemType)) {
      return reply.code(400).send({ error: 'weakSpotId, itemType (correction|exercise), and itemId are required' });
    }

    const tempPath = path.join('/tmp', `${randomUUID()}.pcm`);
    const buffer = await data.toBuffer();
    await writeFile(tempPath, buffer);

    try {
      // Transcribe
      const transcription = await transcribeRawPCM(tempPath);

      if (!transcription.text) {
        return reply.code(200).send({
          passed: false,
          transcript: '',
          feedback: 'No speech detected. Try again.',
          attemptId: null,
        });
      }

      let result: { passed: boolean; feedback: string };

      if (itemType === 'correction') {
        // Look up the correction
        const [correction] = await db
          .select({
            originalText: corrections.originalText,
            correctedText: corrections.correctedText,
            explanation: corrections.explanation,
            correctionType: corrections.correctionType,
          })
          .from(corrections)
          .innerJoin(sessions, eq(corrections.sessionId, sessions.id))
          .where(and(eq(corrections.id, itemId), eq(sessions.userId, userId)));

        if (!correction) {
          return reply.code(404).send({ error: 'Correction not found' });
        }

        const ctx: CorrectionContext = {
          originalText: correction.originalText,
          correctedText: correction.correctedText,
          explanation: correction.explanation,
          correctionType: correction.correctionType,
        };
        result = await evaluateSayItRight(ctx, transcription.text);
      } else {
        // Look up the exercise
        const [exercise] = await db
          .select({
            prompt: weakSpotExercises.prompt,
            targetRule: weakSpotExercises.targetRule,
          })
          .from(weakSpotExercises)
          .where(and(eq(weakSpotExercises.id, itemId), eq(weakSpotExercises.userId, userId)));

        if (!exercise) {
          return reply.code(404).send({ error: 'Exercise not found' });
        }

        // Get correction type from the weak spot
        const [spot] = await db
          .select({ correctionType: weakSpots.correctionType })
          .from(weakSpots)
          .where(eq(weakSpots.id, weakSpotId));

        const ctx: WeakSpotExerciseContext = {
          prompt: exercise.prompt,
          targetRule: exercise.targetRule,
          correctionType: spot?.correctionType ?? 'grammar',
        };
        result = await evaluateWeakSpotExercise(ctx, transcription.text);
      }

      // Save attempt
      const [attempt] = await db
        .insert(weakSpotDrillAttempts)
        .values({
          userId,
          weakSpotId,
          correctionId: itemType === 'correction' ? itemId : null,
          exerciseId: itemType === 'exercise' ? itemId : null,
          passed: result.passed,
          transcript: transcription.text,
          feedback: result.feedback,
        })
        .returning({ id: weakSpotDrillAttempts.id });

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

  // POST /practice/weak-spot-drill-complete — Complete a drill session
  fastify.post('/weak-spot-drill-complete', async (request, reply) => {
    const { weakSpotId, allPassed } = request.body as { weakSpotId: number; allPassed: boolean };

    if (!weakSpotId || typeof allPassed !== 'boolean') {
      return reply.code(400).send({ error: 'weakSpotId and allPassed are required' });
    }

    const result = await advanceSRS(weakSpotId, allPassed);
    return result;
  });

  // POST /practice/weak-spot-dismiss — Dismiss a weak spot or quick fix
  fastify.post('/weak-spot-dismiss', async (request, reply) => {
    const userId = request.user.userId;
    const { type, id } = request.body as { type: 'weak_spot' | 'quick_fix'; id: number };

    if (!type || !id || !['weak_spot', 'quick_fix'].includes(type)) {
      return reply.code(400).send({ error: 'type (weak_spot|quick_fix) and id are required' });
    }

    if (type === 'weak_spot') {
      await dismissWeakSpot(id, userId);
    } else {
      await dismissQuickFix(id, userId);
    }

    return { success: true };
  });
}
