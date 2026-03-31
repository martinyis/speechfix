import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';

const manualOnboardingSchema = z.object({
  name: z.string().min(1).max(255),
  context: z.string().min(1).max(2000),
});

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
    const { name, context } = parsed.data;

    await db.update(users).set({
      displayName: name,
      context,
      goals: [],
      onboardingComplete: true,
    }).where(eq(users.id, request.user.userId));

    return { success: true };
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
