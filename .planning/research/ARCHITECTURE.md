# Architecture Patterns

**Domain:** Speech recording + AI analysis mobile app
**Researched:** 2026-03-19
**Confidence:** HIGH

## System Overview

```
+----------------------------------------------------------------------+
|                       Mobile Client (Expo SDK 55)                     |
|  +---------------+  +---------------+  +-------------------------+   |
|  | Audio Record  |  |  Session UI   |  |  Pattern Analysis UI    |   |
|  | (expo-audio)  |  |  (Results)    |  |  (Recurring mistakes)   |   |
|  +-------+-------+  +-------^-------+  +------------^------------+   |
|          |                  |                        |               |
|  +-------v------------------+------------------------+------------+  |
|  |                  TanStack Query + Zustand                      |  |
|  |        (server state cache + minimal client state)             |  |
|  +----------------------------+-----------------------------------+  |
+-------------------------------|-+------------------------------------+
                                | HTTP (REST + multipart)
+-------------------------------|-+------------------------------------+
|                      Node.js API Server (Fastify v5)                  |
|  +----------------+  +--------v------+  +-------------------------+  |
|  | Upload Route   |  | Session       |  |  Pattern Analysis       |  |
|  | (@fastify/     |  | Routes        |  |  Route                  |  |
|  |  multipart)    |  |               |  |                         |  |
|  +-------+--------+  +-------+-------+  +------------+------------+  |
|          |                   |                        |              |
|  +-------v-------------------+------------------------+-----------+  |
|  |                      Service Layer                             |  |
|  |  +-----------------+ +-----------------+ +------------------+  |  |
|  |  | Transcription   | | Analysis        | | Pattern          |  |  |
|  |  | Service         | | Service         | | Service          |  |  |
|  |  | (OpenAI SDK)    | | (Anthropic SDK) | | (Anthropic SDK)  |  |  |
|  |  +-----------------+ +-----------------+ +------------------+  |  |
|  +----------------------------+-----------------------------------+  |
|                               |                                      |
|  +----------------------------v-----------------------------------+  |
|  |                    Data Access Layer                            |  |
|  |              (Drizzle ORM + postgres.js)                       |  |
|  +----------------------------------------------------------------+  |
+----------------------------------------------------------------------+
                                |
+-------------------------------|-+------------------------------------+
|                        External APIs                                  |
|  +-------------------+  +-----+---------------+                      |
|  | OpenAI            |  | Anthropic Claude    |                      |
|  | gpt-4o-mini-      |  | Haiku 4.5           |                      |
|  | transcribe        |  | (analysis)          |                      |
|  +-------------------+  +---------------------+                      |
+----------------------------------------------------------------------+
```

## Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| Audio Recorder | Capture audio, manage recording lifecycle, provide file URI | expo-audio useAudioRecorder hook, HIGH_QUALITY preset (.m4a output) |
| TanStack Query | Server state: fetch sessions, cache results, handle loading/error states | @tanstack/react-query mutations for upload, queries for session list/detail |
| Zustand | Client state: recording UI state, app-level preferences | Minimal store. Do NOT put server data here. |
| Upload Route | Receive audio file, trigger processing pipeline, return results | Fastify route with @fastify/multipart, stream-based file handling |
| Transcription Service | Send audio to OpenAI, return text | openai SDK, audio.transcriptions.create() with gpt-4o-mini-transcribe |
| Analysis Service | Send transcript to Claude, return structured corrections | @anthropic-ai/sdk, messages.create() with JSON output |
| Pattern Service | Query accumulated corrections, build summary, call Claude for patterns | SQL aggregation via Drizzle, then Claude for high-level insights |
| Data Access Layer | All database operations | Drizzle ORM schema + queries, postgres.js driver |

## Project Structure

```
speechfix/
  app/                          # Expo Router pages (file-based routing)
    (tabs)/                     # Tab navigator group
      _layout.tsx               # Tab bar layout
      index.tsx                 # Record screen (home tab)
      history.tsx               # Session history list
      patterns.tsx              # Pattern analysis screen
    session/
      [id].tsx                  # Individual session detail
    _layout.tsx                 # Root layout (providers: QueryClient, etc.)
  components/                   # Shared UI components
    AudioRecorder.tsx           # Record button + visual feedback + timer
    CorrectionCard.tsx          # Original vs corrected side-by-side
    FillerWordSummary.tsx       # Filler word counts display
    SessionListItem.tsx         # Session card for history list
    ProcessingStatus.tsx        # Upload -> Transcribe -> Analyze progress
  lib/                          # Client utilities
    api.ts                      # Base API client (fetch wrapper with base URL)
    queryClient.ts              # TanStack Query client config
  hooks/                        # Custom React hooks
    useRecording.ts             # Wraps expo-audio recording lifecycle
    useSessions.ts              # TanStack Query hooks for session CRUD
    usePatterns.ts              # TanStack Query hook for pattern analysis
  types/                        # Shared TypeScript types
    session.ts                  # Session, Correction, FillerWord types
    analysis.ts                 # API response shapes
  server/                       # Backend (separate package.json)
    src/
      index.ts                  # Fastify server entry point
      routes/
        sessions.ts             # POST /sessions (upload+process), GET /sessions, GET /sessions/:id
        patterns.ts             # GET /patterns
      services/
        transcription.ts        # Whisper API integration
        analysis.ts             # Claude grammar analysis
        patterns.ts             # Cross-session pattern analysis
      db/
        schema.ts               # Drizzle schema definition
        index.ts                # Database connection (postgres.js + drizzle)
        queries.ts              # Reusable query functions
    drizzle.config.ts           # Drizzle Kit configuration
    package.json                # Backend dependencies
    tsconfig.json               # Backend TypeScript config
  app.json                      # Expo configuration
  package.json                  # Mobile app dependencies
  tsconfig.json                 # Mobile app TypeScript config
```

### Structure Rationale

- **app/**: Expo Router file-based routing. Tabs for three main views. Simple because the app has few screens (4 total).
- **components/**: Presentational components shared across screens. CorrectionCard used in both session detail and pattern views.
- **lib/**: Non-hook utilities. API client is a thin fetch wrapper, not a class.
- **hooks/**: All data fetching wrapped in TanStack Query hooks. Components never call fetch directly.
- **server/**: Separate package.json in same repo. Not a monorepo tool (no Turborepo/Nx) -- just a sibling directory. Run separately with `npx tsx src/index.ts`.
- **server/services/**: One service per external API or domain concern. Plain async functions, no classes.
- **server/db/**: Drizzle schema is the source of truth for database structure. drizzle-kit generates migrations.

## Architectural Patterns

### Pattern 1: Sequential Processing Pipeline

**What:** Audio upload triggers a sequential pipeline: receive file -> transcribe (Whisper) -> analyze (Claude) -> store (Postgres) -> return results. All in a single HTTP request.

**When:** When total processing time is under the user's patience threshold (~15 seconds). For a 3-minute recording: upload ~1-2s, Whisper ~3-5s, Claude ~3-5s = ~10s total.

**Why not async:** A job queue (Bull/Redis) adds infrastructure, polling/webhooks, and a separate worker process. For a single-user tool where processing takes <15 seconds, synchronous is simpler and debuggable. Switch to async only if processing time becomes unacceptable.

```typescript
// server/src/routes/sessions.ts
import { FastifyInstance } from 'fastify';
import { transcribe } from '../services/transcription';
import { analyze } from '../services/analysis';
import { db } from '../db';
import { sessions, corrections, fillerWords } from '../db/schema';
import { writeFile, unlink } from 'fs/promises';
import { randomUUID } from 'crypto';
import path from 'path';

export async function sessionRoutes(fastify: FastifyInstance) {
  fastify.post('/sessions', async (request, reply) => {
    const data = await request.file();
    if (!data) return reply.code(400).send({ error: 'No audio file' });

    // Save uploaded file to temp location
    const tempPath = path.join('/tmp', `${randomUUID()}.m4a`);
    const buffer = await data.toBuffer();
    await writeFile(tempPath, buffer);

    try {
      // Step 1: Transcribe with Whisper
      const transcription = await transcribe(tempPath);

      // Step 2: Analyze with Claude
      const analysis = await analyze(transcription);

      // Step 3: Store everything in one transaction
      const [session] = await db.insert(sessions).values({
        transcription,
        durationSeconds: Number(data.fields.duration?.value ?? 0),
        analysis: analysis,
      }).returning();

      // Step 4: Denormalize corrections for pattern queries
      if (analysis.corrections.length > 0) {
        await db.insert(corrections).values(
          analysis.corrections.map(c => ({
            sessionId: session.id,
            originalText: c.original,
            correctedText: c.corrected,
            explanation: c.explanation,
            correctionType: c.type,
          }))
        );
      }

      return { session, analysis };
    } finally {
      await unlink(tempPath).catch(() => {});
    }
  });
}
```

### Pattern 2: Structured JSON Output from Claude

**What:** Request Claude to return a specific JSON structure for analysis results. Use a strong system prompt with the expected JSON format.

**When:** Always, for the analysis service. The UI needs predictable data shapes to render correction cards.

**Implementation:** Use a detailed system prompt specifying the exact JSON structure. Parse the response and validate with zod before storing.

```typescript
// server/src/services/analysis.ts
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

const anthropic = new Anthropic();

const CorrectionSchema = z.object({
  original: z.string(),
  corrected: z.string(),
  explanation: z.string(),
  type: z.enum(['grammar', 'structure', 'word_choice', 'filler']),
});

const AnalysisSchema = z.object({
  corrections: z.array(CorrectionSchema),
  fillerWords: z.array(z.object({
    word: z.string(),
    count: z.number(),
  })),
  summary: z.string(),
});

export type Analysis = z.infer<typeof AnalysisSchema>;

export async function analyze(transcription: string): Promise<Analysis> {
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20250315',
    max_tokens: 4096,
    system: `You are a speech analysis expert helping non-native English speakers.
Analyze the transcribed speech and return ONLY valid JSON matching this structure:
{
  "corrections": [{ "original": "...", "corrected": "...", "explanation": "...", "type": "grammar|structure|word_choice" }],
  "fillerWords": [{ "word": "...", "count": N }],
  "summary": "Brief overall assessment"
}
Rules:
- Only flag real mistakes. Do not flag correct informal speech as errors.
- Type "grammar" for article/tense/agreement errors, "structure" for awkward phrasing, "word_choice" for wrong word usage.
- Count filler words: um, uh, like (as filler), so (as filler), you know, basically, actually, right, I mean.
- If the speech is perfect, return empty corrections array.`,
    messages: [{ role: 'user', content: transcription }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const parsed = JSON.parse(text);
  return AnalysisSchema.parse(parsed);
}
```

### Pattern 3: Smart Context Windowing for Pattern Analysis

**What:** For cross-session pattern analysis, pre-aggregate corrections with SQL, then send a condensed summary to Claude. Do not dump raw transcripts.

**Why:** SQL is better at counting and grouping. Claude is better at identifying patterns and providing insights. Use each tool for what it is good at.

```typescript
// server/src/services/patterns.ts
import { db } from '../db';
import { corrections, sessions } from '../db/schema';
import { sql, desc, count, eq } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

export async function analyzePatterns() {
  // Step 1: SQL aggregation (not Claude)
  const recentCorrections = await db
    .select({
      correctionType: corrections.correctionType,
      originalText: corrections.originalText,
      correctedText: corrections.correctedText,
      total: count(),
    })
    .from(corrections)
    .groupBy(corrections.correctionType, corrections.originalText, corrections.correctedText)
    .orderBy(desc(count()))
    .limit(50);

  const sessionCount = await db.select({ count: count() }).from(sessions);

  // Step 2: Build condensed summary
  const summary = {
    totalSessions: sessionCount[0].count,
    topMistakes: recentCorrections,
  };

  // Step 3: Claude analyzes the summary
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20250315',
    max_tokens: 2048,
    system: `Analyze these aggregated speech correction patterns. Identify:
1. The most recurring mistakes and their likely root cause
2. Which mistakes are improving (decreasing frequency) vs persistent
3. Specific practice recommendations
Return JSON: { "patterns": [...], "recommendations": [...] }`,
    messages: [{ role: 'user', content: JSON.stringify(summary) }],
  });

  return JSON.parse(response.content[0].type === 'text' ? response.content[0].text : '{}');
}
```

### Pattern 4: TanStack Query Mutations for Upload Pipeline

**What:** On the mobile side, use TanStack Query mutations to handle the upload-and-process flow. Provides loading state, error handling, and automatic cache invalidation.

```typescript
// hooks/useSessions.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export function useCreateSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ audioUri, duration }: { audioUri: string; duration: number }) => {
      const formData = new FormData();
      formData.append('audio', {
        uri: audioUri,
        type: 'audio/m4a',
        name: 'recording.m4a',
      } as any);
      formData.append('duration', String(duration));

      const response = await fetch(`${api.baseUrl}/sessions`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Processing failed');
      return response.json();
    },
    onSuccess: () => {
      // Invalidate session list cache so history refreshes
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
  });
}

export function useSessions() {
  return useQuery({
    queryKey: ['sessions'],
    queryFn: () => fetch(`${api.baseUrl}/sessions`).then(r => r.json()),
  });
}

export function useSession(id: number) {
  return useQuery({
    queryKey: ['sessions', id],
    queryFn: () => fetch(`${api.baseUrl}/sessions/${id}`).then(r => r.json()),
  });
}
```

## Database Schema (Drizzle)

```typescript
// server/src/db/schema.ts
import { pgTable, serial, text, integer, jsonb, timestamp } from 'drizzle-orm/pg-core';

export const sessions = pgTable('sessions', {
  id: serial('id').primaryKey(),
  transcription: text('transcription').notNull(),
  durationSeconds: integer('duration_seconds').notNull(),
  analysis: jsonb('analysis').notNull(),         // Full Claude response for rendering
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const corrections = pgTable('corrections', {
  id: serial('id').primaryKey(),
  sessionId: integer('session_id').references(() => sessions.id, { onDelete: 'cascade' }).notNull(),
  originalText: text('original_text').notNull(),
  correctedText: text('corrected_text').notNull(),
  explanation: text('explanation'),
  correctionType: text('correction_type').notNull(), // 'grammar', 'structure', 'word_choice'
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const fillerWords = pgTable('filler_words', {
  id: serial('id').primaryKey(),
  sessionId: integer('session_id').references(() => sessions.id, { onDelete: 'cascade' }).notNull(),
  word: text('word').notNull(),
  count: integer('count').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

**Schema rationale:** Full Claude analysis stored as JSONB on sessions for easy rendering. Corrections and filler words also denormalized into separate tables for fast SQL aggregation in pattern queries. This duplication is deliberate: query simplicity over storage efficiency. For a personal tool with low data volume, this is the right trade-off.

## Data Flow

### Primary Flow: Record -> Analyze

```
[User taps Record]
    |
    v
[expo-audio records .m4a to device temp directory]
    |
[User taps Stop]
    |
    v
[TanStack Query mutation: FormData with audio file + duration]
    |
    v POST /sessions (multipart/form-data)
    |
[@fastify/multipart receives file, saves to /tmp]
    |
    v
[TranscriptionService: file -> OpenAI gpt-4o-mini-transcribe]
    | Returns: plain text transcription
    v
[AnalysisService: transcription -> Claude Haiku 4.5 -> JSON]
    | Returns: { corrections[], fillerWords[], summary }
    v
[Drizzle: INSERT session + corrections + filler_words]
    |
    v JSON response with full session + analysis
    |
[TanStack Query invalidates session list cache]
[App navigates to session detail, renders corrections]
```

### Secondary Flow: Pattern Analysis

```
[User taps "Analyze Patterns" on patterns tab]
    |
    v GET /patterns
    |
[SQL: GROUP BY correction_type, COUNT(*), ORDER BY frequency]
    |
    v
[Condensed summary -> Claude Haiku 4.5 -> pattern insights]
    |
    v JSON response with patterns + recommendations
    |
[App renders pattern report]
```

## API Endpoints

| Method | Path | Purpose | Request | Response |
|--------|------|---------|---------|----------|
| POST | /sessions | Upload audio, transcribe, analyze, store | multipart/form-data (audio file + duration) | Session object with full analysis |
| GET | /sessions | List all sessions | - | Array of session summaries (id, date, duration, correction count) |
| GET | /sessions/:id | Get session detail | - | Full session with analysis, corrections, filler words |
| GET | /patterns | Cross-session pattern analysis | Optional: ?limit=N for session window | Pattern analysis with recommendations |
| GET | /health | Server health check | - | { status: "ok" } |

## Anti-Patterns to Avoid

### Anti-Pattern 1: Streaming Audio During Recording
**What:** Stream audio chunks to server while user speaks.
**Why bad:** Adds WebSocket complexity, network dependency during recording (drops = lost audio), zero benefit for post-speech analysis.
**Instead:** Record complete file locally, upload after stop. Simple, reliable.

### Anti-Pattern 2: JSONB-Only Storage
**What:** Store Claude analysis only as JSONB, query it for patterns.
**Why bad:** JSONB aggregation across 50+ sessions requires complex JSON path queries. PostgreSQL handles it but it is painful to write and slow.
**Instead:** Store JSONB for rendering AND denormalized rows for SQL aggregation. Small duplication, huge query simplicity.

### Anti-Pattern 3: Dumping All Sessions into Claude
**What:** Concatenate all transcripts for pattern analysis.
**Why bad:** Hits context limits. Cost scales linearly. Claude is not a database.
**Instead:** SQL aggregation first, then condensed summary to Claude for insights.

### Anti-Pattern 4: Using expo-av
**What:** Follow old tutorials using expo-av for audio.
**Why bad:** expo-av audio is deprecated. expo-audio is the active replacement with useAudioRecorder hook.
**Instead:** Use expo-audio from the start.

### Anti-Pattern 5: Redux for State Management
**What:** Install Redux for an app with 4 screens.
**Why bad:** Massive boilerplate for minimal shared state. Server data belongs in TanStack Query, not Redux.
**Instead:** TanStack Query for server state, Zustand for minimal client state (if needed at all).

### Anti-Pattern 6: Premature Optimization
**What:** Job queues, Redis, S3, microservices for a single-user tool.
**Why bad:** Adds infrastructure complexity with zero user benefit.
**Instead:** Local filesystem for temp files, synchronous pipeline, single Fastify process. Optimize only when something is actually slow.

## Scaling Considerations

| Scale | Architecture |
|-------|-------------|
| 1 user (this app) | Synchronous pipeline. Local PostgreSQL via Postgres.app. No auth. Single Fastify process. This is the target. |
| 10-50 users | Add basic auth. Move temp files to cloud storage. Connection pooling for PostgreSQL. Still synchronous pipeline. |
| 100+ users | Async pipeline with job queue. Webhook/polling for results. Rate limit external API calls. Separate API and worker processes. |

**Important:** This is a personal tool. Do not build for scale. Every scaling concern is explicitly deferred.

## Sources

- [Expo Audio docs](https://docs.expo.dev/versions/latest/sdk/audio/) - useAudioRecorder hook, recording presets
- [Fastify docs](https://fastify.dev/) - Route handling, plugin architecture
- [@fastify/multipart](https://github.com/fastify/fastify-multipart) - File upload handling
- [Drizzle ORM docs](https://orm.drizzle.team/) - Schema definition, query builder
- [OpenAI Audio API](https://platform.openai.com/docs/api-reference/audio) - Whisper/transcribe models
- [Anthropic Claude API](https://platform.claude.com/docs/en/api/client-sdks) - Messages API, structured output
- [TanStack Query docs](https://tanstack.com/query) - Mutations, cache invalidation
- [Expo Router docs](https://docs.expo.dev/router/introduction/) - File-based routing
