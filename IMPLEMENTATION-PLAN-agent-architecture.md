# Implementation Plan: Agent Architecture

## Summary

Refactor Reflexa from a single monolithic `VoiceSession` class with mode-based branching into a composable agent architecture. The system has two layers: **agent types** (coded lifecycle/post-processing logic) and **agent instances** (DB-stored configurations with custom prompts, voice, and settings). This enables the default Reflexa conversation agent, a voice onboarding agent, an agent-creator agent (for users to build custom agents), and user-created conversation agents with distinct personalities and voices.

## Context & Problem

The current `VoiceSession` class (632 lines in `server/src/voice/session-manager.ts`) handles everything: WebSocket lifecycle, Deepgram STT, ElevenLabs TTS, conversation orchestration, and two completely different end-of-session flows. The "mode" is a string (`'conversation' | 'onboarding'`) that manifests as `if (this.mode === 'onboarding')` branches throughout the class.

This doesn't scale. Adding an agent-creator mode or user-created agents with different prompts/voices would mean more conditionals, more special-casing, and an increasingly unmaintainable class. The prompt system is already layered nicely (`identity -> behavior -> session-type -> context`) but the session manager and post-processing need the same treatment.

Additionally, user context is frozen after onboarding. The `users.context` and `users.goals` fields are set once during onboarding and never updated, even though every conversation reveals new information about the user that should make future sessions more personal.

## Chosen Approach

**Agent Type + Agent Instance pattern.** A small number of developer-coded agent types define lifecycle rules and post-processing logic. Agent instances are parameterized configurations (stored in DB for user-created agents, or hardcoded for system agents) that slot into a type. The `VoiceSession` class becomes a thin orchestrator that delegates to a type-specific handler.

This was chosen over alternatives:
- **Pure mode-based branching** (current approach): doesn't scale, mixes concerns
- **Fully generic agent framework**: over-engineered for 3 agent types; the types have genuinely different post-processing logic that doesn't benefit from generalization
- **Everything-in-DB** (including system agent prompts): loses version control, makes prompt iteration slower during development, creates deployment risk

---

## Core Concepts

### Agent Types (coded, fixed set)

| Type | Lifecycle | Post-Processing | User Context in Prompt? |
|---|---|---|---|
| `onboarding` | Fixed 3-turn, auto-ends after 2 user turns | Extract user profile, save to `users` table | NO (collecting it) |
| `conversation` | Open-ended, user ends when ready | Speech analysis + metadata + context extraction | YES |
| `agent-creator` | Guided conversation, ends when config collected | Extract agent config, save new agent row to DB | NO (utility agent) |

### Agent Instances (configured, stored in DB or code)

System agents (onboarding, default Reflexa, agent-creator): prompts live in code files, version-controlled. No DB rows.

User-created agents: rows in the `agents` table. Always type `conversation`. Custom identity prompt, optional behavior additions, optional voice ID.

### Prompt Assembly Per Type

Each agent type handler declares which prompt layers it needs. The conversation handler is the only one that uses user context or loads config from DB.

**Onboarding handler:**
```
[IDENTITY_PROMPT]  +  [BEHAVIOR_PROMPT]  +  [ONBOARDING_SESSION_PROMPT]
   (from code)           (from code)              (from code)
```

**Agent-creator handler:**
```
[IDENTITY_PROMPT]  +  [BEHAVIOR_PROMPT]  +  [AGENT_CREATOR_SESSION_PROMPT]
   (from code)           (from code)              (from code)
```

**Conversation handler (default Reflexa):**
```
[IDENTITY_PROMPT]  +  [BEHAVIOR_PROMPT]  +  [CONVERSATION_SESSION_PROMPT]  +  [USER_CONTEXT_PROMPT]
   (from code)           (from code)              (from code)                  (from DB at runtime)
```

**Conversation handler (user-created agent, e.g., "Karen"):**
```
[agent.systemPrompt]  +  [BEHAVIOR_PROMPT]  +  [agent.behaviorPrompt]  +  [CONVERSATION_SESSION_PROMPT]  +  [USER_CONTEXT_PROMPT]
    (from DB)               (from code)            (from DB, optional)          (from code)                  (from DB at runtime)
```

Key design rule: `BEHAVIOR_PROMPT` (from code) is ALWAYS included and NEVER replaceable. It contains operational constraints (short responses, no grammar correction during conversation) that make the voice pipeline work correctly. User-created agents can ADD behavioral rules via `agent.behaviorPrompt` but cannot remove the base rules.

---

## Database Schema Changes

### New table: `agents`

Add to `server/src/db/schema.ts`:

```typescript
export const agents = pgTable('agents', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  type: text('type').notNull().default('conversation'),
  name: varchar('name', { length: 255 }).notNull(),
  systemPrompt: text('system_prompt').notNull(),
  behaviorPrompt: text('behavior_prompt'),
  voiceId: varchar('voice_id', { length: 255 }),
  settings: jsonb('settings').default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

Column details:
- `userId`: NOT NULL. Only user-created agents live in this table. System agents are in code.
- `type`: Always `'conversation'` for v1. Exists for forward-compatibility with future agent types (e.g., `practice`).
- `name`: Display name for the agent. Examples: "Karen", "Interview Coach", "My Debate Partner".
- `systemPrompt`: The identity layer. Replaces `IDENTITY_PROMPT` from code. This is who the agent IS. Example: "You are Karen, a senior tech lead at a fast-paced startup. You're direct, no-nonsense, and you push people to communicate clearly and concisely."
- `behaviorPrompt`: OPTIONAL additional behavioral rules layered ON TOP of the universal `BEHAVIOR_PROMPT`. Example: "Always challenge vague statements. If the user hedges, push them to be more direct."
- `voiceId`: ElevenLabs voice ID. NULL = use the default voice from `ELEVENLABS_VOICE_ID` env var.
- `settings`: JSONB for future extensibility. Empty object for v1.

### Modify table: `sessions`

Add one column:

```typescript
// Add to existing sessions table definition:
agentId: integer('agent_id').references(() => agents.id, { onDelete: 'set null' }),
```

NULL = system agent session (default Reflexa or onboarding). A value = user-created agent session. `ON DELETE SET NULL` preserves session history when an agent is deleted.

### Modify table: `users`

Add one column:

```typescript
// Add to existing users table definition:
contextNotes: jsonb('context_notes').default([]),
```

This stores accumulated conversation context as a JSON array. See "Context Accumulation System" section for details.

### Migration file: `server/drizzle/0003_agent_architecture.sql`

```sql
-- New agents table
CREATE TABLE agents (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'conversation',
  name VARCHAR(255) NOT NULL,
  system_prompt TEXT NOT NULL,
  behavior_prompt TEXT,
  voice_id VARCHAR(255),
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Add agent reference to sessions
ALTER TABLE sessions ADD COLUMN agent_id INTEGER REFERENCES agents(id) ON DELETE SET NULL;

-- Add context accumulation field to users
ALTER TABLE users ADD COLUMN context_notes JSONB DEFAULT '[]';
```

---

## Backend Code Changes

### File Structure (new and modified files)

```
server/src/
  voice/
    session-manager.ts              -- MAJOR REFACTOR: strip out mode branching, delegate to handler
    response-generator.ts           -- MODIFY: accept pre-built system prompt instead of building it
    tts.ts                          -- MODIFY: accept voice ID as constructor param (already does, no change needed)
    handlers/                       -- NEW directory
      types.ts                      -- AgentTypeHandler interface + AgentConfig type
      conversation-handler.ts       -- ConversationHandler (analysis + context extraction)
      onboarding-handler.ts         -- OnboardingHandler (profile extraction)
      agent-creator-handler.ts      -- AgentCreatorHandler (agent config extraction)
      index.ts                      -- resolveHandler() factory function
    prompts/
      identity.ts                   -- UNCHANGED
      behavior.ts                   -- UNCHANGED
      context.ts                    -- MODIFY: expand to include contextNotes
      index.ts                      -- MODIFY: support AgentConfig-based prompt assembly
      session-types/
        conversation.ts             -- UNCHANGED
        onboarding.ts               -- UNCHANGED
        agent-creator.ts            -- NEW: prompt for agent creation sessions
  routes/
    voice-session-ws.ts             -- MODIFY: resolve agent config before creating session
    agents.ts                       -- NEW: CRUD endpoints for user agents
  services/
    profile-extractor.ts            -- UNCHANGED
    analysis.ts                     -- UNCHANGED
    title-generator.ts              -- UNCHANGED
    context-extractor.ts            -- NEW: extract conversation context notes
    agent-config-extractor.ts       -- NEW: extract agent config from creator conversation
  db/
    schema.ts                       -- MODIFY: add agents table, sessions.agentId, users.contextNotes
```

### 1. Agent Type Handler Interface

**New file: `server/src/voice/handlers/types.ts`**

```typescript
import type { ConversationMessage, UserContext } from '../response-generator.js';

// Loaded from DB for user-created agents, null for system agents
export interface AgentConfig {
  id: number;
  type: string;
  name: string;
  systemPrompt: string;
  behaviorPrompt: string | null;
  voiceId: string | null;
  settings: Record<string, unknown>;
}

// Extended user context including accumulated notes
export interface FullUserContext extends UserContext {
  contextNotes?: Array<{ date: string; notes: string[] }> | null;
}

// Result returned by handler when session ends
export interface SessionEndResult {
  type: 'analysis' | 'onboarding' | 'agent-created';
  // For 'analysis' type:
  dbSessionId?: number;
  analysisResults?: {
    sentences: string[];
    corrections: any[];
    fillerWords: any[];
    fillerPositions: any[];
    sessionInsights: any[];
  };
  // For 'onboarding' type:
  success?: boolean;
  displayName?: string | null;
  // For 'agent-created' type:
  agentId?: number;
  agentName?: string;
}

export interface AgentTypeHandler {
  // Does this handler need user context loaded from DB?
  readonly needsUserContext: boolean;

  // Build the system prompt for this session
  buildSystemPrompt(agentConfig: AgentConfig | null, userContext?: FullUserContext): string;

  // Should the session auto-end? Called after each user turn.
  // Return true to trigger session end.
  shouldAutoEnd(turnCount: number, conversationHistory: ConversationMessage[]): boolean;

  // Run post-processing when session ends.
  // Returns result to send to the client.
  onSessionEnd(
    userId: number,
    agentConfig: AgentConfig | null,
    transcriptBuffer: string[],
    conversationHistory: ConversationMessage[],
    durationSeconds: number,
  ): Promise<SessionEndResult>;
}
```

### 2. Conversation Handler

**New file: `server/src/voice/handlers/conversation-handler.ts`**

Implements `AgentTypeHandler`. This handler is used for:
- The default Reflexa agent (agentConfig = null)
- All user-created agents (agentConfig loaded from DB)

Key behaviors:
- `needsUserContext`: true
- `buildSystemPrompt`: If agentConfig is null, uses code-based IDENTITY_PROMPT. If agentConfig exists, uses agentConfig.systemPrompt as identity, and optionally inserts agentConfig.behaviorPrompt after BEHAVIOR_PROMPT. Always includes BEHAVIOR_PROMPT (from code) and CONVERSATION_SESSION_PROMPT (from code). Always includes user context as the final layer.
- `shouldAutoEnd`: Always returns false (user-controlled).
- `onSessionEnd`: Runs three tasks in parallel:
  1. `analyzeSpeech()` (existing)
  2. `generateSessionMetadata()` (existing)
  3. `extractConversationNotes()` (NEW)

  Then saves session to DB (with `agentId` if applicable), saves corrections/fillers, and writes context notes back to the user's `contextNotes` field.

Prompt assembly pseudo-code:
```
buildSystemPrompt(agentConfig, userContext):
  layers = []

  if agentConfig:
    layers.push(agentConfig.systemPrompt)        // Custom identity
  else:
    layers.push(IDENTITY_PROMPT)                  // Default Reflexa identity

  layers.push(BEHAVIOR_PROMPT)                    // Always from code, non-negotiable

  if agentConfig?.behaviorPrompt:
    layers.push(agentConfig.behaviorPrompt)       // Custom behavioral additions

  layers.push(CONVERSATION_SESSION_PROMPT)        // Always from code

  contextPrompt = buildUserContextPrompt(userContext)  // Includes contextNotes
  if contextPrompt:
    layers.push(contextPrompt)

  return layers.join('\n\n')
```

Post-processing pseudo-code:
```
async onSessionEnd(userId, agentConfig, transcriptBuffer, conversationHistory, durationSeconds):
  fullTranscription = transcriptBuffer.join(' ')
  if !fullTranscription.trim():
    return { type: 'analysis', dbSessionId: null }

  // Run all three in parallel
  [analysisResult, metadata, contextNotes] = await Promise.all([
    analyzeSpeech(transcriptBuffer, 'conversation', conversationHistory),
    generateSessionMetadata(fullTranscription, conversationHistory),
    extractConversationNotes(conversationHistory),
  ])

  // Compute clarity score (same logic as current handleDone)
  clarityScore = computeClarityScore(transcriptBuffer, analysisResult.corrections)

  // Save session to DB
  session = await db.insert(sessions).values({
    userId,
    type: 'voice',
    status: 'completed',
    transcription: fullTranscription,
    durationSeconds,
    conversationTranscript: conversationHistory,
    title: metadata.title,
    description: metadata.description,
    topicCategory: metadata.topicCategory,
    clarityScore,
    agentId: agentConfig?.id ?? null,      // NEW: link to agent
  }).returning()

  // Save analysis JSON, corrections, filler words (same as current code)
  await saveAnalysisData(session.id, transcriptBuffer, analysisResult)

  // NEW: Write context notes back to user
  if contextNotes.length > 0:
    await appendContextNotes(userId, contextNotes)

  return {
    type: 'analysis',
    dbSessionId: session.id,
    analysisResults: { sentences: transcriptBuffer, ...analysisResult },
  }
```

### 3. Onboarding Handler

**New file: `server/src/voice/handlers/onboarding-handler.ts`**

Implements `AgentTypeHandler`. Extracts the existing onboarding logic from `VoiceSession`.

- `needsUserContext`: false
- `buildSystemPrompt`: Returns `[IDENTITY_PROMPT, BEHAVIOR_PROMPT, ONBOARDING_SESSION_PROMPT].join('\n\n')`. No user context, no DB config.
- `shouldAutoEnd(turnCount)`: Returns `turnCount >= 2`.
- `onSessionEnd`: Calls `extractUserProfile()` (existing service), updates `users` table with displayName/context/goals/onboardingComplete. Returns `{ type: 'onboarding', success: true, displayName }`.

This handler is a direct extraction of the current `handleOnboardingDone()` logic. No new behavior, just moved to the handler pattern.

### 4. Agent-Creator Handler

**New file: `server/src/voice/handlers/agent-creator-handler.ts`**

Implements `AgentTypeHandler`. Guides the user through defining a new custom agent.

- `needsUserContext`: false
- `buildSystemPrompt`: Returns `[IDENTITY_PROMPT, BEHAVIOR_PROMPT, AGENT_CREATOR_SESSION_PROMPT].join('\n\n')`. No user context.
- `shouldAutoEnd`: Returns false (user ends the session, or the handler detects enough information was collected -- v1 can be user-controlled).
- `onSessionEnd`: Calls `extractAgentConfig()` (new service). Saves a new row to the `agents` table. Returns `{ type: 'agent-created', agentId, agentName }`.

### 5. Handler Resolution

**New file: `server/src/voice/handlers/index.ts`**

```typescript
import type { AgentTypeHandler, AgentConfig } from './types.js';
import { ConversationHandler } from './conversation-handler.js';
import { OnboardingHandler } from './onboarding-handler.js';
import { AgentCreatorHandler } from './agent-creator-handler.js';

export type SystemAgentMode = 'conversation' | 'onboarding' | 'agent-creator';

// Singleton instances (handlers are stateless)
const conversationHandler = new ConversationHandler();
const onboardingHandler = new OnboardingHandler();
const agentCreatorHandler = new AgentCreatorHandler();

export function resolveHandler(
  mode: SystemAgentMode | null,
  agentConfig: AgentConfig | null,
): AgentTypeHandler {
  // User-created agent: always conversation type
  if (agentConfig) {
    return conversationHandler;
  }

  // System agent: resolved by mode
  switch (mode) {
    case 'onboarding':
      return onboardingHandler;
    case 'agent-creator':
      return agentCreatorHandler;
    case 'conversation':
    default:
      return conversationHandler;
  }
}
```

### 6. VoiceSession Refactor

**Modify: `server/src/voice/session-manager.ts`**

The class shrinks significantly. All mode-specific logic moves to handlers.

**What stays in VoiceSession:**
- WebSocket management
- Deepgram STT connection and audio routing
- ElevenLabs TTS connection (with parameterized voice ID)
- Conversation history and transcript buffer management
- Echo prevention, mute/unmute, interrupt logic
- `generateAndSendResponse()` (the conversation loop)
- Turn counting (generic counter, checked by handler)

**What moves out:**
- `handleDone()` / `handleOnboardingDone()` -- replaced by `this.handler.onSessionEnd()`
- Onboarding turn counting logic (`onboardingTurnCount >= 2`) -- replaced by `this.handler.shouldAutoEnd()`
- System prompt building -- delegated to `this.handler.buildSystemPrompt()`
- User context fetching -- conditional on `this.handler.needsUserContext`

**Constructor change:**
```typescript
// Old:
constructor(ws: WebSocket, userId: number, mode: SessionMode = 'conversation')

// New:
constructor(
  ws: WebSocket,
  userId: number,
  handler: AgentTypeHandler,
  agentConfig: AgentConfig | null,
)
```

**Key method changes:**

`start()`:
```
async start():
  this.startTime = Date.now()
  this.state = 'listening'

  // Only fetch user context if handler needs it
  if this.handler.needsUserContext:
    this.userContext = await this.loadUserContext()

  // Connect Deepgram (unchanged)
  // Connect TTS -- use agentConfig.voiceId if available
  voiceId = this.agentConfig?.voiceId || process.env.ELEVENLABS_VOICE_ID
  this.tts = new ElevenLabsTTS(elevenLabsKey, voiceId, callbacks)

  // Build system prompt via handler
  this.systemPrompt = this.handler.buildSystemPrompt(this.agentConfig, this.userContext)

  // Generate greeting
  sentinel = '[Session started]'
  this.conversationHistory.push({ role: 'user', content: sentinel })
  await this.generateAndSendResponse()
  this.greetingDone = true
```

`onSpeechFinal()` -- add auto-end check:
```
async onSpeechFinal():
  // ... (existing utterance handling, history push, mute check) ...

  this.turnCount++

  // Check if handler wants to auto-end
  if this.handler.shouldAutoEnd(this.turnCount, this.conversationHistory):
    await this.generateAndSendResponse()  // Let agent deliver final message
    await this.handleDone()
    return

  await this.generateAndSendResponse()
```

`generateAndSendResponse()` -- use pre-built system prompt:
```
// Instead of calling buildSystemPrompt(mode, userContext) each time,
// use this.systemPrompt which was built once at session start.
// This avoids repeated DB queries and keeps the prompt consistent.
```

Note: `generateResponse()` in `response-generator.ts` needs a signature change. Instead of accepting `mode` and `userContext` and calling `buildSystemPrompt` internally, it should accept the pre-built system prompt string directly:

```typescript
// Old:
export async function* generateResponse(
  conversationHistory: ConversationMessage[],
  abortSignal: AbortSignal | undefined,
  mode: SessionMode,
  userContext?: UserContext,
): AsyncGenerator<string>

// New:
export async function* generateResponse(
  conversationHistory: ConversationMessage[],
  abortSignal: AbortSignal | undefined,
  systemPrompt: string,
): AsyncGenerator<string>
```

`handleDone()` -- unified for all types:
```
async handleDone():
  // Stop audio, abort generation (same as current code)
  this.isSpeaking = false
  this.tts?.abort()
  this.activeAbortController?.abort()
  this.state = 'idle'

  // Flush remaining utterance buffer
  if this.currentUtteranceBuffer.trim():
    this.transcriptBuffer.push(this.currentUtteranceBuffer.trim())
    this.currentUtteranceBuffer = ''

  durationSeconds = Math.round((Date.now() - this.startTime) / 1000)

  // Delegate to handler
  result = await this.handler.onSessionEnd(
    this.userId,
    this.agentConfig,
    this.transcriptBuffer,
    this.conversationHistory,
    durationSeconds,
  )

  // Send result to client based on result type
  switch result.type:
    case 'analysis':
      this.sendToClient({
        type: 'session_end',
        sessionId: this.sessionId,
        dbSessionId: result.dbSessionId,
        results: result.analysisResults,
      })

    case 'onboarding':
      this.sendToClient({
        type: 'onboarding_complete',
        success: result.success,
        displayName: result.displayName,
      })

    case 'agent-created':
      this.sendToClient({
        type: 'agent_created',
        agentId: result.agentId,
        agentName: result.agentName,
      })

  this.cleanup()
```

### 7. WebSocket Route Changes

**Modify: `server/src/routes/voice-session-ws.ts`**

The route handler now resolves the agent config and handler before creating the VoiceSession.

```typescript
import { FastifyInstance } from 'fastify';
import { VoiceSession } from '../voice/session-manager.js';
import { resolveHandler, type SystemAgentMode } from '../voice/handlers/index.js';
import type { AgentConfig } from '../voice/handlers/types.js';
import { db } from '../db/index.js';
import { agents } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';

export async function voiceSessionRoute(fastify: FastifyInstance) {
  fastify.get('/voice-session', { websocket: true }, async (socket, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const agentIdParam = url.searchParams.get('agent');
    const modeParam = url.searchParams.get('mode') as SystemAgentMode | null;

    let agentConfig: AgentConfig | null = null;
    let mode: SystemAgentMode | null = modeParam;

    // If agent ID provided, load from DB
    if (agentIdParam) {
      const agentId = Number(agentIdParam);
      const [row] = await db.select().from(agents)
        .where(and(
          eq(agents.id, agentId),
          eq(agents.userId, req.user.userId),  // Ownership check
        ));

      if (!row) {
        socket.close(4004, 'Agent not found');
        return;
      }

      agentConfig = {
        id: row.id,
        type: row.type,
        name: row.name,
        systemPrompt: row.systemPrompt,
        behaviorPrompt: row.behaviorPrompt,
        voiceId: row.voiceId,
        settings: (row.settings as Record<string, unknown>) ?? {},
      };
      mode = null;  // Agent config takes precedence over mode param
    }

    const handler = resolveHandler(mode, agentConfig);
    const session = new VoiceSession(socket, req.user.userId, handler, agentConfig);

    fastify.log.info(`[voice-ws] New connection, session ${session.sessionId}, ` +
      `agent=${agentConfig?.name ?? 'system'}, mode=${mode ?? 'default'}`);

    // ... rest of message handling unchanged ...
  });
}
```

### 8. New Service: Context Extractor

**New file: `server/src/services/context-extractor.ts`**

Extracts noteworthy personal facts from a conversation to accumulate as user context.

```typescript
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

const SYSTEM_PROMPT = `Extract 1-3 key personal facts or context points from this conversation. These are things the AI should remember for future conversations to make them more personal and relevant.

Focus on:
- Life events: "preparing for a conference in April", "just moved to a new city"
- Personal details: "has a dog named Max", "works at a fintech startup"
- Interests: "interested in AI and machine learning", "loves cooking Italian food"
- Ongoing situations: "stressed about upcoming presentation", "excited about new job"
- Preferences: "prefers casual conversation topics", "wants to practice technical vocabulary"

Do NOT include:
- Speech quality observations (tracked separately by the analysis system)
- Generic statements that aren't personal ("talked about the weather")
- Things that are trivially obvious from the conversation topic
- Anything the user said as a hypothetical or while roleplaying

Return ONLY valid JSON. No markdown, no commentary.
{ "notes": ["note 1", "note 2"] }

If nothing noteworthy was said, return: { "notes": [] }`;

export async function extractConversationNotes(
  conversationHistory: ConversationMessage[],
): Promise<string[]> {
  // Skip very short conversations (greeting only)
  const userMessages = conversationHistory.filter(m => m.role === 'user');
  if (userMessages.length < 2) return [];

  let userMessage = 'CONVERSATION:\n';
  for (const msg of conversationHistory) {
    const label = msg.role === 'assistant' ? 'AI' : 'USER';
    userMessage += `[${label}]: ${msg.content}\n`;
  }

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    const textBlock = response.content.find(b => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') return [];

    let jsonText = textBlock.text.trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }

    const parsed = JSON.parse(jsonText);
    if (!Array.isArray(parsed.notes)) return [];

    return parsed.notes
      .filter((n: unknown) => typeof n === 'string' && n.length > 0)
      .slice(0, 3);
  } catch (err) {
    console.error('[context-extractor] Failed to extract context:', err);
    return [];  // Non-fatal: missing context notes is fine
  }
}
```

### 9. Context Notes Write-Back

This logic lives in the conversation handler's `onSessionEnd`. After `extractConversationNotes` returns:

```typescript
async function appendContextNotes(userId: number, newNotes: string[]): Promise<void> {
  const MAX_ENTRIES = 20;

  const [user] = await db.select({ contextNotes: users.contextNotes })
    .from(users).where(eq(users.id, userId));

  const existing = (user?.contextNotes as Array<{ date: string; notes: string[] }>) ?? [];
  const today = new Date().toISOString().split('T')[0];  // "2026-03-24"

  existing.push({ date: today, notes: newNotes });

  // Keep only the most recent MAX_ENTRIES
  const trimmed = existing.slice(-MAX_ENTRIES);

  await db.update(users).set({ contextNotes: trimmed }).where(eq(users.id, userId));
}
```

### 10. User Context Prompt (expanded)

**Modify: `server/src/voice/prompts/context.ts`**

```typescript
import type { FullUserContext } from '../handlers/types.js';

export function buildUserContextPrompt(userContext?: FullUserContext): string {
  if (!userContext) return '';

  const { displayName, context, goals, contextNotes } = userContext;
  const hasProfile = displayName || context || (goals && goals.length > 0);
  const hasNotes = contextNotes && contextNotes.length > 0;

  if (!hasProfile && !hasNotes) return '';

  const lines: string[] = ['USER CONTEXT (use naturally, do not recite):'];

  if (displayName) {
    lines.push(`- Their name is ${displayName}. Use it occasionally, not every response.`);
  }
  if (context) {
    lines.push(`- Background: ${context}`);
  }
  if (goals && goals.length > 0) {
    lines.push(`- Goals: ${goals.join(', ')}`);
  }

  // Accumulated context from past conversations
  if (hasNotes) {
    lines.push('');
    lines.push('THINGS YOU KNOW FROM PAST CONVERSATIONS:');
    // Take last 10 entries to keep prompt reasonable
    const recent = contextNotes!.slice(-10);
    for (const entry of recent) {
      for (const note of entry.notes) {
        lines.push(`- ${note}`);
      }
    }
  }

  lines.push('');
  lines.push('Use this context naturally. Reference past topics when relevant to what the user brings up. Never recite facts back unprompted.');
  lines.push('When greeting (first message), you can use their name and briefly reference something you know. Keep it natural, 1-2 sentences.');

  return lines.join('\n');
}
```

### 11. New Service: Agent Config Extractor

**New file: `server/src/services/agent-config-extractor.ts`**

Extracts a new agent's configuration from the agent-creator conversation.

```typescript
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

export interface ExtractedAgentConfig {
  name: string;
  systemPrompt: string;
  behaviorPrompt: string | null;
}

const SYSTEM_PROMPT = `You extract an AI agent configuration from a conversation where a user described the agent they want to create. The agent will be used as a conversation partner in a speech practice app for non-native English speakers.

Extract:
1. "name": The agent's name as stated by the user. Use natural casing. If no name was given, invent a fitting one based on the described personality.

2. "systemPrompt": Write a complete identity prompt for this agent in second person ("You are..."). Include:
   - Who the agent is (name, role, personality)
   - How they speak (tone, style, energy level)
   - What they're like in conversation (topics they gravitate toward, how they respond)
   - Any specific character traits the user described
   Keep it 3-8 sentences. Make it vivid and specific enough to produce a consistent character.

3. "behaviorPrompt": Optional additional conversation rules specific to this agent. Only include if the user described specific behavioral patterns like "always challenges my opinions" or "steers conversation toward professional topics." Set to null if no special behavioral rules were described. Do NOT repeat rules that apply to all agents (like keeping responses short).

Return ONLY valid JSON. No markdown, no commentary.
{
  "name": "...",
  "systemPrompt": "...",
  "behaviorPrompt": "..." or null
}`;

export async function extractAgentConfig(
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
): Promise<ExtractedAgentConfig> {
  let userMessage = 'AGENT CREATION CONVERSATION:\n';
  for (const msg of conversationHistory) {
    const label = msg.role === 'assistant' ? 'AI' : 'USER';
    userMessage += `[${label}]: ${msg.content}\n`;
  }

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    const textBlock = response.content.find(b => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text response from Claude');
    }

    let jsonText = textBlock.text.trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }

    const parsed = JSON.parse(jsonText);

    return {
      name: typeof parsed.name === 'string' ? parsed.name.slice(0, 255) : 'Custom Agent',
      systemPrompt: typeof parsed.systemPrompt === 'string' ? parsed.systemPrompt : '',
      behaviorPrompt: typeof parsed.behaviorPrompt === 'string' ? parsed.behaviorPrompt : null,
    };
  } catch (err) {
    console.error('[agent-config-extractor] Failed to extract config:', err);
    return {
      name: 'Custom Agent',
      systemPrompt: 'You are a friendly conversation partner who enjoys discussing a wide range of topics.',
      behaviorPrompt: null,
    };
  }
}
```

Note: Uses Sonnet (not Haiku) because generating a good system prompt requires more capability. This is a one-time cost per agent creation, not per-turn.

### 12. Agent Creator Session Prompt

**New file: `server/src/voice/prompts/session-types/agent-creator.ts`**

```typescript
export const AGENT_CREATOR_SESSION_PROMPT = `SESSION TYPE: Agent Creation
You are helping the user create a new custom conversation agent for the Reflexa app. This agent will be someone they can practice speaking English with — a character with a unique personality, style, and voice.

YOUR GOAL: Collect enough information to define the agent's personality, conversation style, and behavior. You need at minimum a personality description and some sense of how the agent should act in conversation.

THE CONVERSATION STRUCTURE:
Turn 1 (your opener — when you see "[Session started]"):
  Welcome them. Explain briefly: "You can create a custom conversation partner. Tell me about the kind of person you'd like to practice with." Keep it to 1-2 sentences.

Subsequent turns:
  - Ask follow-up questions to flesh out the character. Good questions:
    "What's their personality like? Direct? Supportive? Challenging?"
    "Do they have a name?"
    "What topics do they like to talk about?"
    "How do they react when you're unsure or hesitant?"
  - Don't ask all questions at once. React to what the user says, then ask the next relevant question.
  - When you feel you have enough (typically after 2-4 exchanges), summarize what you've heard and confirm: "So basically, [summary]. Does that sound right, or do you want to change anything?"

WHAT YOU NEED TO COLLECT:
Required:
  - Personality description (who this agent is, what they're like)
  - Conversation style (casual, professional, challenging, supportive, etc.)
Optional:
  - Name (can be generated if not provided)
  - Specific behavioral rules ("always pushes back on my ideas", "steers conversation toward business topics")
  - Topics they're interested in
  - Communication style (direct, verbose, gentle, blunt)

RULES:
- Keep responses SHORT. 1-2 sentences, max 3.
- Be enthusiastic about the user's ideas but don't over-sell.
- If the user's description is vague, ask for specifics. "Funny and cool" isn't enough — what KIND of funny?
- Don't suggest the user pick a voice — that happens in the app UI separately.
- When the user confirms the description, end with something like: "Got it, I'll set them up for you."`;
```

### 13. Agent CRUD Routes

**New file: `server/src/routes/agents.ts`**

```typescript
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

export async function agentRoutes(fastify: FastifyInstance) {
  // List user's agents
  fastify.get('/agents', async (request) => {
    const rows = await db.select({
      id: agents.id,
      name: agents.name,
      type: agents.type,
      voiceId: agents.voiceId,
      createdAt: agents.createdAt,
    })
    .from(agents)
    .where(eq(agents.userId, request.user.userId));

    return { agents: rows };
  });

  // Get single agent detail
  fastify.get<{ Params: { id: string } }>('/agents/:id', async (request, reply) => {
    const agentId = Number(request.params.id);
    const [agent] = await db.select().from(agents)
      .where(and(eq(agents.id, agentId), eq(agents.userId, request.user.userId)));

    if (!agent) {
      return reply.code(404).send({ error: 'Agent not found' });
    }

    return { agent };
  });

  // Update agent (for setting voice ID after creation, or editing prompt)
  fastify.patch<{ Params: { id: string } }>('/agents/:id', async (request, reply) => {
    const agentId = Number(request.params.id);
    const parsed = updateAgentSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0].message });
    }

    const [existing] = await db.select({ id: agents.id }).from(agents)
      .where(and(eq(agents.id, agentId), eq(agents.userId, request.user.userId)));

    if (!existing) {
      return reply.code(404).send({ error: 'Agent not found' });
    }

    const updates: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) updates.name = parsed.data.name;
    if (parsed.data.systemPrompt !== undefined) updates.systemPrompt = parsed.data.systemPrompt;
    if (parsed.data.behaviorPrompt !== undefined) updates.behaviorPrompt = parsed.data.behaviorPrompt;
    if (parsed.data.voiceId !== undefined) updates.voiceId = parsed.data.voiceId;

    if (Object.keys(updates).length === 0) {
      return reply.code(400).send({ error: 'No fields to update' });
    }

    const [updated] = await db.update(agents).set(updates)
      .where(eq(agents.id, agentId)).returning();

    return { agent: updated };
  });

  // Delete agent
  fastify.delete<{ Params: { id: string } }>('/agents/:id', async (request, reply) => {
    const agentId = Number(request.params.id);
    const [deleted] = await db.delete(agents)
      .where(and(eq(agents.id, agentId), eq(agents.userId, request.user.userId)))
      .returning({ id: agents.id });

    if (!deleted) {
      return reply.code(404).send({ error: 'Agent not found' });
    }

    return { success: true };
  });
}
```

Register in `server/src/index.ts`:
```typescript
import { agentRoutes } from './routes/agents.js';
// ... existing registrations ...
await app.register(agentRoutes);
```

### 14. Available Voices Endpoint

**Add to `server/src/routes/agents.ts`** (or a separate voices route file):

The server provides a list of pre-selected ElevenLabs voices with metadata. This is a static list curated by the developer, not fetched from the ElevenLabs API at runtime.

```typescript
// Static voice palette — curated by developer
const AVAILABLE_VOICES = [
  { id: 'pFZP5JQG7iQjIQuC4Bku', name: 'Sara', gender: 'female', description: 'Warm, conversational' },
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'James', gender: 'male', description: 'Professional, calm' },
  // ... 10-15 pre-selected voices with sample audio URLs ...
  // Sample audio files served from a static assets endpoint or CDN
];

fastify.get('/voices', async () => {
  return { voices: AVAILABLE_VOICES };
});
```

Each voice entry should include a `sampleUrl` field pointing to a pre-generated audio sample. These samples are generated once (not at runtime) and stored as static assets. The mobile app plays them so the user can audition voices before picking one.

---

## API Endpoint Summary

| Method | Path | Description | Auth |
|---|---|---|---|
| GET | `/agents` | List user's agents | Yes |
| GET | `/agents/:id` | Get agent detail | Yes |
| PATCH | `/agents/:id` | Update agent (name, prompts, voiceId) | Yes |
| DELETE | `/agents/:id` | Delete agent | Yes |
| GET | `/voices` | List available voice palette | Yes |
| GET (WS) | `/voice-session` | Default Reflexa session | Yes |
| GET (WS) | `/voice-session?mode=onboarding` | Onboarding session | Yes |
| GET (WS) | `/voice-session?mode=agent-creator` | Agent creation session | Yes |
| GET (WS) | `/voice-session?agent=<id>` | User-created agent session | Yes |

---

## WebSocket Protocol Changes

### New message from server: `agent_created`

Sent when an agent-creator session ends successfully:

```json
{
  "type": "agent_created",
  "agentId": 7,
  "agentName": "Karen"
}
```

### Modified message: `session_end`

Add optional `agentId` and `agentName` fields:

```json
{
  "type": "session_end",
  "sessionId": "uuid",
  "dbSessionId": 42,
  "agentId": 7,
  "agentName": "Karen",
  "results": { ... }
}
```

### No changes to existing client-to-server messages

`start`, `audio`, `interrupt`, `done`, `mute`, `unmute` all remain unchanged.

---

## Frontend / Mobile Changes

### New Types

**Modify: `mobile/types/session.ts`**

Add agent type:

```typescript
export interface Agent {
  id: number;
  name: string;
  type: string;
  voiceId: string | null;
  createdAt: string;
}

export interface AgentDetail extends Agent {
  systemPrompt: string;
  behaviorPrompt: string | null;
  settings: Record<string, unknown>;
}

export interface Voice {
  id: string;
  name: string;
  gender: 'male' | 'female';
  description: string;
  sampleUrl: string;
}
```

Add `agentId` and `agentName` to `SessionListItem`:

```typescript
export interface SessionListItem {
  // ... existing fields ...
  agentId?: number | null;
  agentName?: string | null;
}
```

### New Store: Agent Store

**New file: `mobile/stores/agentStore.ts`**

Manages the list of user-created agents and the currently selected agent for a voice session.

```typescript
import { create } from 'zustand';
import type { Agent } from '../types/session';

interface AgentStore {
  agents: Agent[];
  selectedAgentId: number | null;  // null = default Reflexa

  setAgents: (agents: Agent[]) => void;
  addAgent: (agent: Agent) => void;
  removeAgent: (id: number) => void;
  selectAgent: (id: number | null) => void;
}

export const useAgentStore = create<AgentStore>((set) => ({
  agents: [],
  selectedAgentId: null,

  setAgents: (agents) => set({ agents }),
  addAgent: (agent) => set((s) => ({ agents: [...s.agents, agent] })),
  removeAgent: (id) => set((s) => ({ agents: s.agents.filter(a => a.id !== id) })),
  selectAgent: (id) => set({ selectedAgentId: id }),
}));
```

### Modified Hook: `useVoiceSession`

**Modify: `mobile/hooks/useVoiceSession.ts`**

Add `agentId` parameter to the `start` function. When connecting the WebSocket:

```typescript
// Old:
const ws = new WebSocket(wsUrl('/voice-session'));

// New:
const agentId = useAgentStore.getState().selectedAgentId;
const wsPath = agentId
  ? `/voice-session?agent=${agentId}`
  : '/voice-session';
const ws = new WebSocket(wsUrl(wsPath));
```

Also handle the new `agent_created` message type in the message handler:

```typescript
case 'agent_created': {
  // New agent was created via agent-creator session
  // Add to agent store, navigate to agent detail or agent list
  if (msg.agentId) {
    // Fetch full agent details, add to store
    // Navigate to voice picker or agent detail screen
  }
  s.endVoiceSession();
  cleanup();
  onAgentCreated?.(msg.agentId, msg.agentName);
  break;
}
```

Add new callback to the hook interface:

```typescript
interface UseVoiceSessionCallbacks {
  onSessionEnd: (results: SessionDetail, dbSessionId: number) => void;
  onError: (message: string) => void;
  onAgentCreated?: (agentId: number, agentName: string) => void;  // NEW
}
```

### New Hook: `useAgents`

**New file: `mobile/hooks/useAgents.ts`**

React Query hook to fetch the user's agents list:

```typescript
import { useQuery } from '@tanstack/react-query';
import { authFetch } from '../lib/api';
import type { Agent } from '../types/session';

export function useAgents() {
  return useQuery({
    queryKey: ['agents'],
    queryFn: async (): Promise<Agent[]> => {
      const res = await authFetch('/agents');
      if (!res.ok) throw new Error('Failed to fetch agents');
      const data = await res.json();
      return data.agents;
    },
  });
}
```

### New Hook: `useVoices`

**New file: `mobile/hooks/useVoices.ts`**

React Query hook to fetch available voices:

```typescript
import { useQuery } from '@tanstack/react-query';
import { authFetch } from '../lib/api';
import type { Voice } from '../types/session';

export function useVoices() {
  return useQuery({
    queryKey: ['voices'],
    queryFn: async (): Promise<Voice[]> => {
      const res = await authFetch('/voices');
      if (!res.ok) throw new Error('Failed to fetch voices');
      const data = await res.json();
      return data.voices;
    },
    staleTime: Infinity,  // Voices don't change often
  });
}
```

### Practice Tab Becomes Agent Selection Screen

**Modify: `mobile/app/(tabs)/practice.tsx`**

Currently a placeholder ("Exercises coming soon"). This becomes the agent selection and management screen.

Content:
1. **Agent grid/list**: Shows the default Reflexa agent plus all user-created agents. Each card shows:
   - Agent name
   - Brief description (first line of systemPrompt, truncated)
   - Voice name (if set)
   - Tap to select and start a session

2. **"Create Agent" card**: A special card at the end of the list with a + icon. Tapping it starts the agent-creator voice session.

3. **Selected agent indicator**: When the user taps an agent, it becomes "selected." Going back to the Home tab and tapping the mic orb starts a session with the selected agent.

   Alternative UX (simpler): Each agent card has a "Start Session" button that directly starts a voice session with that agent. No separate selection step.

Design note: Follow the existing "Vibrant Glass" design system (dark glassmorphic cards, purple/blue accents from `mobile/theme/`).

### VoiceSessionOverlay Agent Name

**Modify: `mobile/components/VoiceSessionOverlay.tsx`**

The overlay currently hardcodes "Reflexa" as the agent name (line 187: `<Text style={styles.liveModeName}>Reflexa</Text>`).

Change to accept an `agentName` prop:

```typescript
interface VoiceSessionOverlayProps {
  // ... existing props ...
  agentName?: string;  // NEW: defaults to "Reflexa"
}

// In the render:
<Text style={styles.liveModeName}>{agentName ?? 'Reflexa'}</Text>
```

Also update the mode label logic: instead of just 'ONBOARDING' vs 'LIVE MODE', add 'CREATING AGENT' for agent-creator mode.

### Agent Detail / Edit Screen

**New file: `mobile/app/agent-detail.tsx`**

A screen showing the full agent configuration. Reached by long-pressing an agent card, or navigating after agent creation.

Content:
- Agent name (editable)
- Personality description (read-only display of systemPrompt, or editable for power users)
- Voice picker (list of available voices with play buttons to audition samples)
- "Delete Agent" button
- Session history filtered to this agent

### Voice Picker Component

**New file: `mobile/components/VoicePicker.tsx`**

Renders the list of available voices. Each item shows:
- Voice name and description
- Play button that plays the audio sample
- Checkmark if currently selected

Used in the agent-detail screen and during the post-agent-creation flow.

### Post Agent-Creation Flow

When the agent-creator session ends and the client receives `agent_created`:

1. Navigate to the agent-detail screen for the newly created agent
2. The voice picker is prominently shown ("Pick a voice for [agent name]")
3. User auditions voices and selects one
4. Client calls `PATCH /agents/:id` with `{ voiceId: selectedId }`
5. User is done -- can now use the agent from the Practice tab

### Navigation Changes

**Modify: `mobile/app/_layout.tsx`**

Add route for agent-detail:

```typescript
<Stack.Screen
  name="agent-detail"
  options={{
    title: 'Agent',
    presentation: 'card',
  }}
/>
```

**Modify: `mobile/app/(tabs)/_layout.tsx`**

Rename the "Practice" tab to "Agents" (or keep "Practice" but change the icon to better reflect agent selection):

```typescript
TAB_ICONS: {
  // ...
  practice: { active: 'people', inactive: 'people-outline' },  // Changed from chatbubble
}
```

### Home Screen Agent Awareness

**Modify: `mobile/app/(tabs)/index.tsx`**

The home screen's mic orb currently always starts a default Reflexa conversation. Two options:

**Option A (simpler, recommended for v1):** Keep the home screen as-is. The mic orb always starts with default Reflexa. Users go to the Agents (Practice) tab to use custom agents. This avoids cluttering the clean home screen.

**Option B:** Show the currently selected agent name near the orb. Let users swipe or tap to switch agents. More complex, can be added later.

Recommend Option A for v1.

---

## Context Accumulation: Complete Data Flow

```
SESSION N (conversation with any agent):
  1. User connects WebSocket with ?agent=7 (or no param for default Reflexa)
  2. Server loads agent config from DB (if agent ID provided)
  3. Server loads user context: SELECT displayName, context, goals, context_notes FROM users
  4. Handler builds system prompt with all layers including context_notes
  5. Conversation happens (unchanged pipeline: Deepgram -> Claude -> TTS)
  6. User ends session

POST-PROCESSING (conversation handler):
  7. analyzeSpeech() -> corrections, fillers, insights       [parallel]
  8. generateSessionMetadata() -> title, description          [parallel]
  9. extractConversationNotes() -> ["preparing for conference", "stressed about presenting"]  [parallel]
  10. Save session to DB (with agentId)
  11. Save corrections, filler words
  12. Append context notes to users.context_notes:
      READ current: [{ date: "2026-03-22", notes: ["has a dog named Max"] }]
      APPEND: { date: "2026-03-24", notes: ["preparing for conference", "stressed about presenting"] }
      TRIM to last 20 entries
      WRITE back to users.context_notes

SESSION N+1:
  13. Server loads user context including updated context_notes
  14. buildUserContextPrompt() includes:
      "THINGS YOU KNOW FROM PAST CONVERSATIONS:
       - has a dog named Max
       - preparing for conference
       - stressed about presenting"
  15. Claude receives this in the system prompt
  16. Greeting: "Hey Martin, how's the conference prep going?"
```

---

## Edge Cases & Error Handling

### Agent not found
If `?agent=<id>` references a non-existent or unauthorized agent, close the WebSocket with code 4004 and message "Agent not found". The client should show an error and fall back to the agents list.

### Agent deleted while in session
Unlikely but possible. The session continues normally since the agent config was loaded at session start. The session record's `agentId` will have `ON DELETE SET NULL`, so it becomes null after deletion. No session data is lost.

### Agent-creator produces bad config
If `extractAgentConfig` fails or returns garbage, fall back to a safe default agent with a generic prompt. The user can edit it in the agent-detail screen. Never leave the user with no agent after a creation attempt.

### Context notes grow too large
Capped at 20 entries. Each entry has 1-3 notes. Worst case: ~60 notes, maybe 4000-5000 characters in the prompt. Well within reasonable system prompt size.

### Empty conversation (user ends immediately)
If `transcriptBuffer` is empty, the conversation handler skips analysis AND context extraction. Returns `{ dbSessionId: null }`. No DB writes. Same behavior as current code.

### Multiple concurrent sessions
Each VoiceSession is independent with its own handler instance reference. No shared state between sessions. The handler classes are stateless (no instance variables storing session data). Safe for concurrent use.

### TTS voice ID not found / invalid
If `agentConfig.voiceId` points to an invalid ElevenLabs voice ID, the TTS connection will fail. The session should fall back to the default voice ID from env vars. Log the error. The ElevenLabsTTS constructor already has error handling for connection failures; extend it to retry with the default voice ID if the custom one fails.

### Agent-creator and voice selection
The voice is NOT selected during the voice conversation. The agent is created with `voiceId: null` initially. The client navigates to the agent-detail screen after creation, where the user picks a voice via the UI. A `PATCH /agents/:id` call sets the voice ID. Until a voice is set, the agent uses the default voice.

---

## Implementation Order

### Phase 1: Backend Foundation (no frontend changes)

1. **Schema changes**: Add `agents` table, `sessions.agentId` column, `users.contextNotes` column to `schema.ts`. Create migration `0003_agent_architecture.sql`. Run migration.

2. **Handler interface and types**: Create `server/src/voice/handlers/types.ts` with `AgentTypeHandler`, `AgentConfig`, `FullUserContext`, `SessionEndResult`.

3. **Conversation handler**: Create `server/src/voice/handlers/conversation-handler.ts`. Extract existing `handleDone()` logic from `VoiceSession`. Wire up `appendContextNotes`.

4. **Onboarding handler**: Create `server/src/voice/handlers/onboarding-handler.ts`. Extract existing `handleOnboardingDone()` logic.

5. **Handler index**: Create `server/src/voice/handlers/index.ts` with `resolveHandler()`.

6. **Refactor VoiceSession**: Modify `session-manager.ts` to use handler pattern. Remove mode-specific branching. Change constructor signature. This is the biggest change -- test thoroughly.

7. **Modify response-generator.ts**: Accept pre-built system prompt string instead of mode + userContext.

8. **Modify prompts/index.ts**: The centralized `buildSystemPrompt` function is no longer needed as the entry point; each handler builds its own. Keep the function but refactor it to be a utility used by handlers, or remove it entirely and let each handler compose its layers directly.

9. **Modify prompts/context.ts**: Expand `buildUserContextPrompt` to accept `FullUserContext` with `contextNotes`.

10. **Modify voice-session-ws.ts**: Add agent loading and handler resolution before creating VoiceSession.

**Verification**: At this point, existing onboarding and conversation flows should work exactly as before. Test both. The new handler pattern should produce identical behavior.

### Phase 2: Context Accumulation

11. **Create context-extractor.ts**: New service for extracting conversation notes.

12. **Wire into conversation handler**: Add `extractConversationNotes` call in parallel with analysis and metadata. Add `appendContextNotes` write-back.

13. **Test the loop**: Have a conversation, check that `context_notes` gets populated in the DB. Start a new conversation, verify the context appears in the greeting.

### Phase 3: Agent CRUD

14. **Create agents.ts route**: CRUD endpoints for user agents.

15. **Create voices endpoint**: Static voice palette.

16. **Register routes in index.ts**.

17. **Test**: Create an agent via API, verify it's stored. Update voice ID. Delete.

### Phase 4: Agent-Creator

18. **Create agent-creator session prompt**: `server/src/voice/prompts/session-types/agent-creator.ts`.

19. **Create agent-config-extractor.ts**: Service to parse agent-creator conversations.

20. **Create agent-creator-handler.ts**: Handler that uses the new prompt and extractor.

21. **Add 'agent-creator' to mode resolution**: Update route and handler index.

22. **Test end-to-end**: Start an agent-creator session via WebSocket, describe an agent, end session, verify agent row created in DB.

### Phase 5: User-Created Agent Sessions

23. **Test conversation handler with agentConfig**: Connect WebSocket with `?agent=<id>`, verify custom prompt is used, verify custom voice ID is passed to TTS.

24. **Test session history**: Verify `sessions.agentId` is set correctly. Verify session list can be filtered by agent.

### Phase 6: Mobile Frontend

25. **Types and stores**: Add `Agent`, `Voice` types. Create `agentStore.ts`.

26. **Hooks**: Create `useAgents.ts`, `useVoices.ts`. Modify `useVoiceSession.ts` to support agent selection and `agent_created` message.

27. **Practice tab**: Replace placeholder with agent selection grid.

28. **VoiceSessionOverlay**: Accept `agentName` prop, display correct name.

29. **Agent-detail screen**: Create screen with voice picker.

30. **Voice picker component**: Create `VoicePicker.tsx` with audio sample playback.

31. **Navigation and routing**: Add agent-detail route. Update tab icons/labels.

32. **Agent-creator flow**: Wire up the "Create Agent" button to start agent-creator mode. Handle `agent_created` response. Navigate to agent-detail for voice selection.

### Phase 7: Polish

33. **Session history per agent**: Filter session list by agent on the agent-detail screen.

34. **Agent deletion confirmation**: Show a confirmation dialog before deleting.

35. **Error states**: Handle agent-not-found, creation failures, voice playback errors gracefully.

---

## Testing Considerations

- **Conversation handler produces identical results to current code**: Before adding new features, verify the refactored conversation handler (with no agentConfig) produces the exact same analysis results, session records, and client messages as the current monolithic `handleDone()`.

- **Onboarding handler produces identical results to current code**: Verify profile extraction, user updates, and `onboarding_complete` flow are unchanged.

- **Context accumulation doesn't break existing prompts**: After adding contextNotes to the prompt, verify conversation quality hasn't degraded (agent doesn't over-reference past context, responses stay short).

- **Agent ownership checks**: Verify user A cannot access or start sessions with user B's agents. Test the `WHERE user_id = ?` clauses.

- **Concurrent sessions with different agents**: Start two sessions with different agents, verify each gets the correct prompt and voice.

- **Agent deletion during session**: Delete an agent while a session is active. Session should complete normally. Session record's agentId should become null.

- **Empty agent-creator conversation**: User starts agent-creator and immediately ends. Should produce a safe fallback agent, not crash.

---

## Open Questions

1. **Should the Practice tab show sessions filtered by agent, or just be an agent picker?** The implementation above makes it an agent picker. Session filtering by agent can happen on the agent-detail screen. Confirm this UX.

2. **Voice sample audio format and hosting**: How are the voice samples for the voice picker hosted? Options: bundled in the app as assets, served from the backend as static files, or hosted on a CDN. Bundling is simplest for v1 but increases app size.

3. **Agent-creator session end**: The plan says the user ends the session manually (like a regular conversation). An alternative is the agent-creator handler detects when enough info is collected and auto-ends. Which is preferred for v1?

4. **Max agents per user**: Should there be a limit? If so, what number? Relevant for both the DB (no index needed for small counts) and the UI (grid vs scrollable list).

5. **Agent editing via voice**: Can the user talk to the agent-creator again to modify an existing agent, or is editing only through the UI? v1 is UI-only editing. Voice-based editing is a future feature.
