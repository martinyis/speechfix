import Groq from 'groq-sdk';
import { db } from '../db/index.js';
import { agentGreetings, agents, users, sessions } from '../db/schema.js';
import { eq, and, desc, isNull } from 'drizzle-orm';

const groq = new Groq();

function getTimeOfDay(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

interface GreetingContext {
  displayName: string | null;
  goals: string[] | null;
  contextNotes: Array<{ date: string; notes: string[]; agentId?: number | null }> | null;
  lastSession: {
    date: string;
    clarityScore: number | null;
    topicCategory: string | null;
  } | null;
  agentId?: number | null;
  agentName?: string;
  agentSystemPrompt?: string;
}

async function fetchGreetingContext(userId: number, agentId?: number | null): Promise<GreetingContext> {
  const [user] = await db.select({
    displayName: users.displayName,
    goals: users.goals,
    contextNotes: users.contextNotes,
  }).from(users).where(eq(users.id, userId));

  // Fetch most recent session (optionally scoped to agent)
  const sessionQuery = agentId
    ? and(eq(sessions.userId, userId), eq(sessions.agentId, agentId))
    : eq(sessions.userId, userId);

  const [lastSession] = await db.select({
    createdAt: sessions.createdAt,
    clarityScore: sessions.clarityScore,
    topicCategory: sessions.topicCategory,
  }).from(sessions)
    .where(sessionQuery)
    .orderBy(desc(sessions.createdAt))
    .limit(1);

  // Fetch agent details if scoped
  let agentName: string | undefined;
  let agentSystemPrompt: string | undefined;
  if (agentId) {
    const [agent] = await db.select({
      name: agents.name,
      systemPrompt: agents.systemPrompt,
    }).from(agents).where(eq(agents.id, agentId));
    if (agent) {
      agentName = agent.name;
      agentSystemPrompt = agent.systemPrompt;
    }
  }

  return {
    displayName: user?.displayName ?? null,
    goals: (user?.goals as string[] | null) ?? null,
    contextNotes: (user?.contextNotes as GreetingContext['contextNotes']) ?? null,
    lastSession: lastSession ? {
      date: lastSession.createdAt.toISOString().slice(0, 10),
      clarityScore: lastSession.clarityScore,
      topicCategory: lastSession.topicCategory,
    } : null,
    agentId: agentId ?? null,
    agentName,
    agentSystemPrompt,
  };
}

function buildGreetingPrompt(ctx: GreetingContext): string {
  const lines: string[] = [];
  const isCustomAgent = ctx.agentId !== undefined && ctx.agentId !== null;

  if (isCustomAgent && ctx.agentSystemPrompt) {
    lines.push(`You are "${ctx.agentName}", a custom conversational AI. Your identity: ${ctx.agentSystemPrompt.slice(0, 300)}`);
    lines.push('Stay in character for this greeting.');
  } else {
    lines.push('You are Reflexa, a conversational AI. You are precise, warm but not bubbly.');
  }

  lines.push('');
  lines.push('Generate a 1-2 sentence greeting for the start of a voice conversation session.');
  lines.push('Rules:');
  lines.push('- Be direct and precise, not bubbly or scripted.');
  lines.push('- Never introduce yourself to returning users. They know who you are.');
  lines.push('- End with an implicit or explicit invitation to speak.');
  lines.push('- If you know their name, use it naturally (not every time).');
  lines.push('- Output ONLY the greeting text. No quotes, no labels, no explanation.');

  lines.push('');
  lines.push(`Time of day: ${getTimeOfDay()}`);

  if (ctx.displayName) {
    lines.push(`User's name: ${ctx.displayName}`);
  }

  // Only Reflexa sees goals and clarity score
  if (!isCustomAgent) {
    if (ctx.goals && ctx.goals.length > 0) {
      lines.push(`User's goals: ${ctx.goals.join(', ')}`);
    }
    if (ctx.lastSession) {
      lines.push(`Last session: ${ctx.lastSession.date}, topic: ${ctx.lastSession.topicCategory ?? 'general'}, clarity: ${ctx.lastSession.clarityScore ?? 'unknown'}%`);
    } else {
      lines.push('This is the user\'s first session.');
    }
  } else {
    if (ctx.lastSession) {
      lines.push(`Last session with this character: ${ctx.lastSession.date}, topic: ${ctx.lastSession.topicCategory ?? 'general'}`);
    } else {
      lines.push('This is the user\'s first session with this character.');
    }
  }

  // Context notes — scoped by agent
  if (ctx.contextNotes && ctx.contextNotes.length > 0) {
    const filtered = isCustomAgent
      ? ctx.contextNotes.filter(e => e.agentId === ctx.agentId)
      : ctx.contextNotes;

    const recentNotes = filtered.slice(-3).flatMap(e => e.notes);
    if (recentNotes.length > 0) {
      lines.push(`Recent context: ${recentNotes.slice(-5).join('; ')}`);
    }
  }

  return lines.join('\n');
}

export async function generateGreeting(userId: number, agentId?: number | null): Promise<string> {
  const ctx = await fetchGreetingContext(userId, agentId);
  const prompt = buildGreetingPrompt(ctx);

  const response = await groq.chat.completions.create({
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    max_tokens: 80,
    messages: [
      { role: 'system', content: prompt },
      { role: 'user', content: 'Generate the greeting now.' },
    ],
  });

  const text = response.choices[0]?.message?.content;
  if (!text) {
    throw new Error('No text in greeting response');
  }

  return text.trim();
}

export async function regenerateAllGreetings(userId: number): Promise<void> {
  // Fetch all agents for this user
  const userAgents = await db.select({ id: agents.id })
    .from(agents)
    .where(eq(agents.userId, userId));

  // Generate greeting for Reflexa (agentId=null) + each custom agent
  const agentIds: (number | null)[] = [null, ...userAgents.map(a => a.id)];

  await Promise.all(agentIds.map(async (agentId) => {
    try {
      const text = await generateGreeting(userId, agentId);
      await upsertGreeting(userId, agentId, text);
    } catch (err) {
      console.error(`[greeting] Failed to generate for agent ${agentId}:`, err);
    }
  }));

  console.log(`[greeting] Regenerated ${agentIds.length} greetings for user ${userId}`);
}

export async function generateGreetingForAgent(userId: number, agentId: number): Promise<void> {
  const text = await generateGreeting(userId, agentId);
  await upsertGreeting(userId, agentId, text);
  console.log(`[greeting] Generated initial greeting for agent ${agentId}`);
}

async function upsertGreeting(userId: number, agentId: number | null, text: string): Promise<void> {
  // Delete existing greeting for this user+agent combo, then insert new one
  const deleteCondition = agentId
    ? and(eq(agentGreetings.userId, userId), eq(agentGreetings.agentId, agentId))
    : and(eq(agentGreetings.userId, userId), isNull(agentGreetings.agentId));

  await db.delete(agentGreetings).where(deleteCondition);
  await db.insert(agentGreetings).values({ userId, agentId, greetingText: text });
}

export async function fetchAndConsumeGreeting(userId: number, agentId: number | null): Promise<string | null> {
  const condition = agentId
    ? and(eq(agentGreetings.userId, userId), eq(agentGreetings.agentId, agentId))
    : and(eq(agentGreetings.userId, userId), isNull(agentGreetings.agentId));

  const [greeting] = await db.select({ id: agentGreetings.id, greetingText: agentGreetings.greetingText })
    .from(agentGreetings)
    .where(condition)
    .limit(1);

  if (!greeting) return null;

  // Delete the consumed greeting
  await db.delete(agentGreetings).where(eq(agentGreetings.id, greeting.id));

  return greeting.greetingText;
}