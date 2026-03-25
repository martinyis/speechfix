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
  avatarSeed: z.string().max(255).nullable().optional(),
});

const createAgentSchema = z.object({
  name: z.string().max(255).optional(),
  voiceId: z.string().optional(),
  description: z.string().optional(),
  focusArea: z.string().optional(),
  conversationStyle: z.string().optional(),
  customRules: z.string().optional(),
  avatarSeed: z.string().max(255).optional(),
});

function buildAgentSystemPrompt({ description, focusArea, conversationStyle }: { description?: string; focusArea?: string; conversationStyle?: string }): string {
  const lines = ['You are a conversation partner for English speaking practice.'];
  if (description) lines.push(`About you: ${description}`);
  if (focusArea) lines.push(`You specialize in conversations about: ${focusArea}`);
  if (conversationStyle) lines.push(`Your conversation style is: ${conversationStyle}`);
  return lines.join('\n');
}

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
      settings: agents.settings,
      createdAt: agents.createdAt,
    }).from(agents).where(eq(agents.userId, request.user.userId));

    return {
      agents: rows.map(({ settings, ...rest }) => ({
        ...rest,
        avatarSeed: (settings as Record<string, unknown>)?.avatarSeed as string | null ?? null,
      })),
    };
  });

  // Create agent from form
  fastify.post('/agents', async (request, reply) => {
    const parsed = createAgentSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0].message });
    }

    const { name, voiceId, description, focusArea, conversationStyle, customRules, avatarSeed } = parsed.data;

    const systemPrompt = buildAgentSystemPrompt({ description, focusArea, conversationStyle });
    const settings: Record<string, unknown> = {};
    if (description) settings.description = description;
    if (focusArea) settings.focusArea = focusArea;
    if (conversationStyle) settings.conversationStyle = conversationStyle;
    if (avatarSeed) settings.avatarSeed = avatarSeed;

    const [agent] = await db.insert(agents).values({
      userId: request.user.userId,
      type: 'conversation',
      name: name || 'Custom Agent',
      systemPrompt,
      behaviorPrompt: customRules || null,
      voiceId: voiceId || null,
      settings: Object.keys(settings).length > 0 ? settings : {},
    }).returning();

    return {
      agent: {
        id: agent.id,
        name: agent.name,
        type: agent.type,
        voiceId: agent.voiceId,
        avatarSeed: avatarSeed ?? null,
        createdAt: agent.createdAt,
      },
    };
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

    const agentSettings = (agent.settings ?? {}) as Record<string, unknown>;
    return {
      agent: {
        ...agent,
        avatarSeed: (agentSettings.avatarSeed as string) ?? null,
      },
    };
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

    const { avatarSeed, ...directFields } = parsed.data;
    const updatePayload: Record<string, unknown> = { ...directFields };

    // Merge avatarSeed into settings JSONB if provided
    if (avatarSeed !== undefined) {
      const [current] = await db.select({ settings: agents.settings })
        .from(agents).where(eq(agents.id, agentId));
      const currentSettings = (current?.settings ?? {}) as Record<string, unknown>;
      updatePayload.settings = { ...currentSettings, avatarSeed };
    }

    const [updated] = await db.update(agents)
      .set(updatePayload)
      .where(eq(agents.id, agentId))
      .returning();

    const updatedSettings = (updated.settings ?? {}) as Record<string, unknown>;
    return {
      agent: {
        ...updated,
        avatarSeed: (updatedSettings.avatarSeed as string) ?? null,
      },
    };
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
