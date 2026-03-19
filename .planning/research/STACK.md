# Technology Stack

**Project:** Reframe (Speech Improvement App)
**Researched:** 2026-03-19

## Recommended Stack

### Mobile Framework
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Expo (SDK 55) | ~55.0.8 | App framework | Latest stable (Feb 2026). React Native 0.83, React 19.2. New Architecture is now the only option (Legacy dropped). Three releases/year means good momentum. | HIGH |
| expo-audio | ~55.0.8 | Audio recording | Replaces expo-av for audio. Uses `useAudioRecorder` hook with recording presets (HIGH_QUALITY). Outputs m4a/AAC natively on both iOS and Android. expo-av audio is being phased out. | HIGH |
| expo-router | ~55.0.7 | Navigation | File-based routing, now standard for Expo apps. Typed routes, deep linking out of the box. Ships with `create-expo-app` default template. No reason to use React Navigation directly. | HIGH |

### Backend
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Fastify | ^5.8.2 | HTTP server | 2x faster than Express. Native TypeScript support. Schema-based validation (Ajv) catches bugs at the boundary. Plugin architecture keeps code organized. Express is fine but Fastify is strictly better for a new project. | HIGH |
| @fastify/multipart | ^9.3.0 | Audio file upload | Handles multipart/form-data for audio file uploads from the mobile app. Built on @fastify/busboy. Stream-based processing keeps memory usage low for large audio files. | HIGH |
| @fastify/cors | latest | CORS | Required for mobile app to reach local dev server. Fastify plugin ecosystem makes this trivial. | HIGH |
| TypeScript | ^5.7 | Type safety | Fastify is written in TypeScript. Drizzle is TypeScript-first. The entire backend should be TypeScript for end-to-end type safety. | HIGH |
| tsx | latest | Dev runner | Run TypeScript directly without a build step during development. Faster iteration than ts-node. | MEDIUM |

### Database
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| PostgreSQL | 17.x (via Postgres.app) | Primary database | Already installed. Robust for structured speech session data. JSON columns available if needed for flexible AI response storage. | HIGH |
| Drizzle ORM | ^0.45.1 | ORM / query builder | Code-first schema in TypeScript -- no schema file, no codegen step. ~7kb bundle. Instant type updates as you edit (no `prisma generate`). SQL-like API means you think in SQL, not in ORM abstractions. Zero dependencies. | HIGH |
| drizzle-kit | latest | Migrations CLI | Generates and runs SQL migrations from schema changes. `drizzle-kit push` for rapid dev, `drizzle-kit generate` + `drizzle-kit migrate` for production. | HIGH |
| postgres (postgres.js) | ^3.4.8 | PostgreSQL driver | Fastest Node.js PostgreSQL driver. Drizzle's recommended driver for postgres.js integration. Simpler API than `pg` (node-postgres). No native bindings needed. | HIGH |

### AI / ML Services
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| openai (SDK) | ^6.32.0 | Whisper transcription | Official OpenAI Node.js SDK. Use `gpt-4o-mini-transcribe` model for transcription -- same accuracy as whisper-1 at half the cost ($0.003/min vs $0.006/min). Supports m4a, mp3, wav, webm. 25MB file limit. | HIGH |
| @anthropic-ai/sdk | ^0.79.0 | Speech analysis | Official Anthropic SDK. Use Claude Haiku 4.5 (`claude-haiku-4-5-20250315`) for grammar/filler word analysis -- 90% of Sonnet quality at 1/3 the cost ($1/$5 per 1M tokens). For a personal tool processing text, Haiku is more than sufficient. Upgrade to Sonnet only if analysis quality disappoints. | MEDIUM |

### Supporting Libraries
| Library | Version | Purpose | When to Use | Confidence |
|---------|---------|---------|-------------|------------|
| zustand | ^5.x | Client state | UI state on mobile: recording state, active screen state, settings. Do NOT use for server data (that's TanStack Query's job). | HIGH |
| @tanstack/react-query | ^5.x | Server state | All API calls from mobile to backend. Automatic caching, loading states, error handling, background refetching. Every fetch goes through this. | HIGH |
| date-fns | ^4.x | Date formatting | Display session timestamps. Lightweight, tree-shakeable. Don't use moment.js (deprecated, massive bundle). | HIGH |
| dotenv | ^16.x | Environment config | API keys (OPENAI_API_KEY, ANTHROPIC_API_KEY), database URL. Backend only. | HIGH |
| zod | ^3.x | Runtime validation | Validate API request/response shapes. Pairs with Fastify schema validation. Share types between frontend and backend if using a monorepo. | HIGH |

## Model Selection Rationale

### Transcription: gpt-4o-mini-transcribe (not whisper-1)
- Same quality, half the price ($0.003/min vs $0.006/min)
- For a 3-minute recording: ~$0.009 per session
- Supports all common audio formats including m4a (what expo-audio produces)
- 25MB file limit is sufficient for voice recordings (3 min m4a ~ 1-3MB)

### Speech Analysis: Claude Haiku 4.5 (not Sonnet)
- Grammar correction and filler word detection is classification/extraction work
- Haiku handles this category of tasks at ~90% of Sonnet quality
- Cost: ~$0.001-0.005 per analysis (depending on transcript length)
- Personal tool means volume is low (5-20 sessions/day max)
- Total daily API cost estimate: $0.10-0.50/day for heavy use
- Upgrade path: switch model string to Sonnet if Haiku quality isn't sufficient

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Backend framework | Fastify | Express | Express works but slower, no native TS, no schema validation. For a new project in 2026, Fastify is the better default. |
| ORM | Drizzle | Prisma | Prisma adds a schema file + codegen step. Prisma 7 removed the Rust engine (good), but Drizzle's code-first approach is simpler for a solo dev. No schema drift between .prisma and .ts files. |
| ORM | Drizzle | Raw SQL | Raw SQL is fine for 4-5 tables but migrations become manual. Drizzle adds type safety and migration management with minimal overhead. |
| PG driver | postgres.js | pg (node-postgres) | postgres.js is faster, has a simpler API, and is Drizzle's preferred driver. pg requires `@types/pg` separately. |
| Audio recording | expo-audio | expo-av | expo-av audio is being deprecated in favor of expo-audio. expo-audio has the modern `useAudioRecorder` hook API. |
| Audio recording | expo-audio | @siteed/expo-audio-studio | More features (waveform visualization, streaming) but more complexity. expo-audio covers our needs (record, get file URI). Reach for expo-audio-studio only if we need real-time audio visualization later. |
| State management | Zustand + TanStack Query | Redux Toolkit | Redux is overkill for a personal app with simple UI state. Zustand + TanStack Query is the 2026 standard for React/RN apps. |
| State management | Zustand + TanStack Query | React Context | Context causes unnecessary re-renders and doesn't handle server state well. Use it only for truly global, rarely-changing values (theme, auth). |
| Transcription | gpt-4o-mini-transcribe | whisper-1 | Same thing but costs 2x more. No reason to use the older model. |
| Transcription | OpenAI API | Local Whisper | Local Whisper requires native modules, large model files (~1.5GB), and phone CPU. API is fast, cheap, and zero setup. |
| Claude model | Haiku 4.5 | Sonnet 4.6 | 3x more expensive for a task (grammar checking) where Haiku performs well. Start cheap, upgrade if needed. |
| Navigation | expo-router | React Navigation (direct) | expo-router IS React Navigation under the hood, but with file-based routing. Less boilerplate, typed routes, deep linking free. |
| Date library | date-fns | dayjs / moment | moment is deprecated. dayjs is fine but date-fns is tree-shakeable and more widely used in the RN ecosystem. |

## What NOT to Use

| Technology | Why Not |
|------------|---------|
| expo-av (for audio) | Being deprecated. expo-audio is the replacement. |
| moment.js | Deprecated, 300kb+ bundle. Use date-fns. |
| Redux / Redux Toolkit | Overkill for a personal app. Zustand is simpler. |
| Sequelize / TypeORM | Legacy ORMs with poor TypeScript support compared to Drizzle. |
| Express | Not bad, but Fastify is strictly better for a new 2026 project. |
| Docker (for dev) | Project constraint: local Node.js server, no Docker. Postgres.app already running. |
| Firebase / Supabase | Adds vendor lock-in for a simple CRUD backend. We want a local Postgres + custom API. |
| tRPC | Nice for monorepos but adds complexity. Simple REST endpoints are fine for 5-6 routes. |

## Project Structure

```
speechfix/
  app/                    # Expo Router pages (file-based routing)
    (tabs)/               # Tab navigator group
      index.tsx           # Record screen (home)
      history.tsx         # Session history list
      patterns.tsx        # Pattern analysis screen
    session/
      [id].tsx            # Individual session detail
    _layout.tsx           # Root layout
  components/             # Shared UI components
  lib/                    # API client, utilities
  hooks/                  # Custom hooks (useRecording, etc.)
  server/                 # Backend (separate npm project or monorepo)
    src/
      routes/             # Fastify route handlers
      db/
        schema.ts         # Drizzle schema
        index.ts          # DB connection
      services/           # Business logic (transcription, analysis)
      index.ts            # Server entry point
    drizzle.config.ts
    package.json
  app.json                # Expo config
  package.json            # Mobile app dependencies
```

## Installation

```bash
# Mobile app (Expo)
npx create-expo-app@latest reframe --template default@sdk-55
cd reframe
npm install zustand @tanstack/react-query date-fns

# Backend (in server/ directory)
mkdir server && cd server
npm init -y
npm install fastify @fastify/multipart @fastify/cors drizzle-orm postgres openai @anthropic-ai/sdk zod dotenv
npm install -D typescript @types/node drizzle-kit tsx
```

## Environment Variables (.env - backend)

```bash
DATABASE_URL=postgresql://localhost:5432/reframe
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
PORT=3000
```

## Sources

- Expo SDK 55 changelog: https://expo.dev/changelog/sdk-55
- Expo Audio docs: https://docs.expo.dev/versions/latest/sdk/audio/
- Fastify docs: https://fastify.dev/
- Drizzle ORM docs: https://orm.drizzle.team/
- OpenAI API pricing: https://platform.openai.com/docs/pricing
- Anthropic pricing: https://platform.claude.com/docs/en/about-claude/pricing
- OpenAI Node SDK: https://www.npmjs.com/package/openai
- Anthropic Node SDK: https://www.npmjs.com/package/@anthropic-ai/sdk
- Fastify multipart: https://github.com/fastify/fastify-multipart
- Drizzle PostgreSQL setup: https://orm.drizzle.team/docs/guides/postgresql-local-setup
- TanStack Query: https://tanstack.com/query
- Zustand: https://github.com/pmndrs/zustand
