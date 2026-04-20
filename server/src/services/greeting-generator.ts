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
  agentMode?: string;
}

async function fetchGreetingContext(userId: number, agentId: number | null, mode: string): Promise<GreetingContext> {
  const [user] = await db.select({
    displayName: users.displayName,
    goals: users.goals,
    contextNotes: users.contextNotes,
  }).from(users).where(eq(users.id, userId));

  // Filler coach doesn't need session history or agent details
  if (mode === 'filler-coach') {
    return {
      displayName: user?.displayName ?? null,
      goals: null,
      contextNotes: null,
      lastSession: null,
      agentId: null,
    };
  }

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
  let agentMode: string | undefined;
  if (agentId) {
    const [agent] = await db.select({
      name: agents.name,
      systemPrompt: agents.systemPrompt,
      agentMode: agents.agentMode,
    }).from(agents).where(eq(agents.id, agentId));
    if (agent) {
      agentName = agent.name;
      agentSystemPrompt = agent.systemPrompt;
      agentMode = agent.agentMode;
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
    agentMode,
  };
}

function buildGreetingPrompt(ctx: GreetingContext, mode: string): string {
  if (mode === 'filler-coach') {
    return buildFillerCoachGreetingPrompt(ctx);
  }

  const lines: string[] = [];
  const isCustomAgent = ctx.agentId !== undefined && ctx.agentId !== null;

  const isRoleplay = isCustomAgent && ctx.agentMode === 'roleplay';

  if (isCustomAgent && ctx.agentSystemPrompt) {
    if (isRoleplay) {
      lines.push(`You are "${ctx.agentName}". ${ctx.agentSystemPrompt}`);
      lines.push('Generate your opening line as this character would naturally start the interaction.');
      lines.push('Rules:');
      lines.push('- Speak ONLY as your character. Do NOT introduce yourself or explain what you do.');
      lines.push('- Do NOT describe the scenario or your role. Just begin the interaction.');
      lines.push('- Be immersive. One sentence, maybe two.');
      lines.push('- Output ONLY the greeting text.');
    } else {
      lines.push(`You are "${ctx.agentName}". ${ctx.agentSystemPrompt}`);
      lines.push('Stay in character for this greeting.');
    }
  } else {
    lines.push('You are Reflexa, a conversational AI. You are precise, warm but not bubbly.');
  }

  if (!isRoleplay) {
    lines.push('');
    lines.push('Generate a 1-2 sentence greeting for the start of a voice conversation session.');
    lines.push('Rules:');
    lines.push('- Be direct and precise, not bubbly or scripted.');
    lines.push('- Never introduce yourself to returning users. They know who you are.');
    lines.push('- End with an implicit or explicit invitation to speak.');
    lines.push('- If you know their name, use it naturally (not every time).');
    lines.push('- Output ONLY the greeting text. No quotes, no labels, no explanation.');
  }

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

function buildFillerCoachGreetingPrompt(ctx: GreetingContext): string {
  const lines: string[] = [];
  lines.push('You are a speech coach in the Reflexa app. You help users cut filler words and overused phrases so their speech is clearer and more confident.');
  lines.push('You are direct, encouraging, and never judgmental.');
  lines.push('');
  lines.push('Generate a 1-2 sentence greeting for a filler word coaching session.');
  lines.push('Rules:');
  lines.push('- Frame the session around filler words and words they overuse — making their speech clearer.');
  lines.push('- Be warm but direct. No bubbly language.');
  lines.push('- Invite them to start talking naturally.');
  lines.push('- Do NOT mention specific target words (those are session-specific and you don\'t know them yet).');
  lines.push('- Output ONLY the greeting text. No quotes, no labels, no explanation.');

  if (ctx.displayName) {
    lines.push('');
    lines.push(`User's name: ${ctx.displayName}`);
  }

  return lines.join('\n');
}

async function generateGreeting(userId: number, agentId: number | null, mode: string): Promise<string> {
  const ctx = await fetchGreetingContext(userId, agentId, mode);
  const prompt = buildGreetingPrompt(ctx, mode);

  const response = await groq.chat.completions.create({
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    max_completion_tokens: 80,
    temperature: 0.8,
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

async function upsertGreeting(userId: number, agentId: number | null, mode: string, text: string): Promise<void> {
  // Delete-then-insert to avoid ON CONFLICT expression index limitation
  await db.transaction(async (tx) => {
    const condition = agentId !== null
      ? and(eq(agentGreetings.userId, userId), eq(agentGreetings.agentId, agentId), eq(agentGreetings.mode, mode))
      : and(eq(agentGreetings.userId, userId), isNull(agentGreetings.agentId), eq(agentGreetings.mode, mode));
    await tx.delete(agentGreetings).where(condition);
    await tx.insert(agentGreetings).values({ userId, agentId, mode, greetingText: text });
  });
}

/**
 * Fetch a pre-generated greeting for the given agent/mode.
 * Regeneration is handled by session-manager cleanup after each session.
 */
export async function fetchGreeting(userId: number, agentId: number | null, mode = 'conversation'): Promise<string | null> {
  const condition = agentId
    ? and(eq(agentGreetings.userId, userId), eq(agentGreetings.agentId, agentId), eq(agentGreetings.mode, mode))
    : and(eq(agentGreetings.userId, userId), isNull(agentGreetings.agentId), eq(agentGreetings.mode, mode));

  const [greeting] = await db.select({ greetingText: agentGreetings.greetingText })
    .from(agentGreetings)
    .where(condition)
    .limit(1);

  if (!greeting) return null;

  return greeting.greetingText;
}

/**
 * Idempotent: ensures all required greetings exist for a user.
 * Call anywhere, anytime — only generates what's missing.
 */
export async function ensureGreetingsExist(userId: number): Promise<void> {
  // 1. Fetch all user's agents
  const userAgents = await db.select({ id: agents.id }).from(agents).where(eq(agents.userId, userId));

  // 2. Fetch all existing greetings for this user
  const existing = await db.select({ agentId: agentGreetings.agentId, mode: agentGreetings.mode })
    .from(agentGreetings).where(eq(agentGreetings.userId, userId));

  // 3. Build set of what SHOULD exist
  const needed: { agentId: number | null; mode: string }[] = [
    { agentId: null, mode: 'conversation' },      // Reflexa
    { agentId: null, mode: 'filler-coach' },       // Filler coach
    ...userAgents.map(a => ({ agentId: a.id, mode: 'conversation' as string })),
  ];

  // 4. Find what's MISSING
  const existingSet = new Set(existing.map(e => `${e.agentId ?? 'null'}:${e.mode}`));
  const missing = needed.filter(n => !existingSet.has(`${n.agentId ?? 'null'}:${n.mode}`));

  // 5. Generate missing greetings in parallel
  if (missing.length > 0) {
    console.log(`[greeting] ensureGreetingsExist: generating ${missing.length} missing greetings for user ${userId}`);
    await Promise.all(missing.map(async ({ agentId, mode }) => {
      try {
        const text = await generateGreeting(userId, agentId, mode);
        await upsertGreeting(userId, agentId, mode, text);
      } catch (err) {
        console.error(`[greeting] ensureGreetingsExist failed for agent=${agentId} mode=${mode}:`, err);
      }
    }));
  }
}

/**
 * Regenerate ALL greetings for a user (all agents + all modes).
 */
export async function regenerateAllGreetings(userId: number): Promise<void> {
  const userAgents = await db.select({ id: agents.id })
    .from(agents)
    .where(eq(agents.userId, userId));

  const jobs: { agentId: number | null; mode: string }[] = [
    { agentId: null, mode: 'conversation' },
    { agentId: null, mode: 'filler-coach' },
    ...userAgents.map(a => ({ agentId: a.id, mode: 'conversation' as string })),
  ];

  await Promise.all(jobs.map(async ({ agentId, mode }) => {
    try {
      const text = await generateGreeting(userId, agentId, mode);
      await upsertGreeting(userId, agentId, mode, text);
    } catch (err) {
      console.error(`[greeting] regen failed agent=${agentId} mode=${mode}:`, err);
    }
  }));

  console.log(`[greeting] Regenerated ${jobs.length} greetings for user ${userId}`);
}

/**
 * Generate and store a greeting for a specific agent.
 */
export async function generateGreetingForAgent(userId: number, agentId: number | null): Promise<void> {
  const text = await generateGreeting(userId, agentId, 'conversation');
  await upsertGreeting(userId, agentId, 'conversation', text);
  console.log(`[greeting] Generated greeting for agent ${agentId}`);
}
