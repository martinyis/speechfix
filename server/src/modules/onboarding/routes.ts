import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../../db/index.js';
import { users } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { decideInitialFlags } from '../practice/modes/decide-flags.js';
import {
  SPEECH_SIGNALS_VERSION,
  type SpeechSignals,
} from '../practice/modes/types.js';
import { ensureGreetingsExist } from '../agents/greeting-generator.js';

const englishLevelSchema = z.enum(['native', 'advanced', 'intermediate', 'beginner']);

const manualOnboardingSchema = z.object({
  name: z.string().min(1).max(255),
  context: z.string().min(1).max(2000),
  goals: z.array(z.string().min(1).max(200)).min(1).max(20),
  englishLevel: englishLevelSchema,
});

type EnglishLevel = z.infer<typeof englishLevelSchema>;

/**
 * Map a self-reported English level to synthetic SpeechSignals so the
 * manual onboarding path can run the same `decideInitialFlags()` logic
 * the voice path uses (no behavioural divergence between flows).
 */
function signalsForLevel(level: EnglishLevel): SpeechSignals {
  switch (level) {
    case 'native':
      return {
        nativeSpeakerConfidence: 0.95,
        grammarErrorCount: 0,
        fillerWordCount: 2,
        userWordCount: 100,
        version: SPEECH_SIGNALS_VERSION,
      };
    case 'advanced':
      return {
        nativeSpeakerConfidence: 0.5,
        grammarErrorCount: 1,
        fillerWordCount: 2,
        userWordCount: 100,
        version: SPEECH_SIGNALS_VERSION,
      };
    case 'intermediate':
      return {
        nativeSpeakerConfidence: 0.3,
        grammarErrorCount: 2,
        fillerWordCount: 3,
        userWordCount: 100,
        version: SPEECH_SIGNALS_VERSION,
      };
    case 'beginner':
      return {
        nativeSpeakerConfidence: 0.1,
        grammarErrorCount: 4,
        fillerWordCount: 3,
        userWordCount: 100,
        version: SPEECH_SIGNALS_VERSION,
      };
  }
}

export async function onboardingRoutes(fastify: FastifyInstance) {
  fastify.get('/onboarding/status', async (request) => {
    const [user] = await db
      .select({
        onboardingComplete: users.onboardingComplete,
        displayName: users.displayName,
        analysisFlags: users.analysisFlags,
      })
      .from(users)
      .where(eq(users.id, request.user.userId));

    return {
      onboardingComplete: user?.onboardingComplete ?? false,
      displayName: user?.displayName ?? null,
      analysisFlags: user?.analysisFlags ?? { grammar: true, fillers: true, patterns: true },
    };
  });

  fastify.post('/onboarding/skip', async (request) => {
    await db.update(users).set({
      onboardingComplete: true,
    }).where(eq(users.id, request.user.userId));

    return { success: true };
  });

  fastify.post('/onboarding/manual', async (request, reply) => {
    const parsed = manualOnboardingSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0].message });
    }
    const { name, context, goals, englishLevel } = parsed.data;
    const userId = request.user.userId;

    const baseSignals = signalsForLevel(englishLevel);
    const onboardingAnalysis = {
      ...baseSignals,
      onboardingMethod: 'manual' as const,
    };
    const analysisFlags = decideInitialFlags(baseSignals);

    await db.update(users).set({
      displayName: name,
      context,
      goals,
      analysisFlags,
      onboardingAnalysis,
      onboardingComplete: true,
    }).where(eq(users.id, userId));

    console.log(
      `[onboarding-manual] Profile saved for user ${userId}: ${name} | level=${englishLevel} | flags=${JSON.stringify(analysisFlags)}`,
    );

    // Match the voice path: pre-generate agent greetings so the home tab
    // doesn't have to wait on first session. Errors are non-fatal —
    // ensureGreetingsExist swallows per-agent failures internally.
    try {
      await ensureGreetingsExist(userId);
    } catch (err) {
      console.error(`[onboarding-manual] greeting generation failed for user ${userId}:`, err);
    }

    return { success: true, analysisFlags };
  });

  const analysisFlagsSchema = z.object({
    grammar: z.boolean().optional(),
    fillers: z.boolean().optional(),
    patterns: z.boolean().optional(),
  });

  fastify.patch('/settings/analysis-flags', async (request, reply) => {
    const parsed = analysisFlagsSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0].message });
    }

    const [user] = await db
      .select({ analysisFlags: users.analysisFlags })
      .from(users)
      .where(eq(users.id, request.user.userId));

    const current = (user?.analysisFlags as Record<string, boolean>) ?? { grammar: true, fillers: true, patterns: true };
    const updated = { ...current, ...parsed.data };

    await db.update(users).set({ analysisFlags: updated }).where(eq(users.id, request.user.userId));

    return { analysisFlags: updated };
  });
}
