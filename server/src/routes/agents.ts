import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db/index.js';
import { agents } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';

const updateAgentSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  systemPrompt: z.string().min(1).optional(),
  behaviorPrompt: z.string().nullable().optional(),
  voiceId: z.string().max(255).nullable().optional(),
});

const AVAILABLE_VOICES = [
  { id: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lily', gender: 'female', description: 'Warm, conversational' },
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', gender: 'female', description: 'Professional, calm' },
  { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni', gender: 'male', description: 'Well-rounded, casual' },
  { id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold', gender: 'male', description: 'Deep, confident' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', gender: 'female', description: 'Soft, articulate' },
  { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel', gender: 'male', description: 'Authoritative, clear' },
  { id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli', gender: 'female', description: 'Young, bubbly' },
  { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh', gender: 'male', description: 'Natural, friendly' },
];

export async function agentRoutes(fastify: FastifyInstance) {
  // List user's agents
  fastify.get('/agents', async (request) => {
    const rows = await db.select({
      id: agents.id,
      name: agents.name,
      type: agents.type,
      voiceId: agents.voiceId,
      createdAt: agents.createdAt,
    }).from(agents).where(eq(agents.userId, request.user.userId));

    return { agents: rows };
  });

  // Get full agent detail
  fastify.get<{ Params: { id: string } }>('/agents/:id', async (request, reply) => {
    const agentId = Number(request.params.id);

    const [agent] = await db.select().from(agents).where(
      and(eq(agents.id, agentId), eq(agents.userId, request.user.userId))
    );

    if (!agent) {
      return reply.code(404).send({ error: 'Agent not found' });
    }

    return { agent };
  });

  // Update agent
  fastify.patch<{ Params: { id: string } }>('/agents/:id', async (request, reply) => {
    const agentId = Number(request.params.id);

    const parsed = updateAgentSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0].message });
    }

    // Ownership check
    const [existing] = await db.select({ id: agents.id }).from(agents).where(
      and(eq(agents.id, agentId), eq(agents.userId, request.user.userId))
    );

    if (!existing) {
      return reply.code(404).send({ error: 'Agent not found' });
    }

    const [updated] = await db.update(agents)
      .set(parsed.data)
      .where(eq(agents.id, agentId))
      .returning();

    return { agent: updated };
  });

  // Delete agent
  fastify.delete<{ Params: { id: string } }>('/agents/:id', async (request, reply) => {
    const agentId = Number(request.params.id);

    // Ownership check
    const [existing] = await db.select({ id: agents.id }).from(agents).where(
      and(eq(agents.id, agentId), eq(agents.userId, request.user.userId))
    );

    if (!existing) {
      return reply.code(404).send({ error: 'Agent not found' });
    }

    await db.delete(agents).where(eq(agents.id, agentId));

    return { success: true };
  });

  // List available voices
  fastify.get('/voices', async () => {
    return { voices: AVAILABLE_VOICES };
  });
}
