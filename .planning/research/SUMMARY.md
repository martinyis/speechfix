# Project Research Summary

**Project:** Reflexa (Speech Improvement App)
**Domain:** Speech recording + AI analysis mobile app for non-native English speakers
**Researched:** 2026-03-19
**Confidence:** HIGH

## Executive Summary

Reflexa is a mobile app that records free-form speech, transcribes it via OpenAI Whisper, analyzes grammar and filler words via Claude, and tracks recurring mistakes over time. The recommended stack is Expo SDK 55 (React Native 0.83) for the mobile client, Fastify v5 for a local Node.js backend, PostgreSQL 17 with Drizzle ORM for storage, and OpenAI + Anthropic APIs for transcription and analysis. This is a well-understood architecture -- a mobile client talking to a REST API that orchestrates external AI services -- and every component has high-confidence documentation. The competitive landscape reveals a genuine gap: no existing tool combines free-form speech recording with structured grammar correction AND cross-session pattern tracking. The closest competitor (Pronounce) records calls but lacks the pattern analysis that is Reflexa's core thesis.

The most significant technical risk is not in the stack but in the AI pipeline. Whisper silently normalizes grammar errors (correcting "He don't like it" to "He doesn't like it") and strips filler words by default -- both behaviors that directly undermine the app's two core features. This is not a bug to fix but a fundamental constraint to design around. The Whisper `prompt` parameter can partially steer behavior (especially for filler word preservation), but grammar normalization cannot be fully disabled. The Claude analysis prompt must be calibrated for spoken English norms, not written standards, or it will flood users with false-positive corrections that destroy trust. These two issues -- Whisper normalization and Claude overcorrection -- are the highest-priority problems and must be validated with real test recordings before any UI work begins.

The recommended approach is a phased build that front-loads pipeline validation. Phase 1 establishes the record-transcribe-analyze pipeline and validates Whisper behavior. Phase 2 builds the core feedback loop (Claude analysis + results display). Phase 3 adds session history and polish. Phase 4 implements cross-session pattern analysis -- the differentiating feature that requires accumulated data. The synchronous processing pipeline (no job queues, no Redis) is the right choice for a single-user tool where end-to-end processing takes under 15 seconds. Every scaling concern is deferred. For cost, gpt-4o-mini-transcribe ($0.003/min) and Claude Haiku 4.5 ($1/$5 per 1M tokens) keep the daily cost well under $1 for personal use.

## Key Findings

### Recommended Stack

The stack is modern, well-documented, and chosen for solo-developer productivity. Expo SDK 55 with expo-router provides file-based routing and the new expo-audio library for recording. Fastify v5 replaces Express as the strictly better choice for new projects (2x faster, native TypeScript, schema validation). Drizzle ORM eliminates the codegen step of Prisma while keeping full type safety. All choices are high-confidence with official documentation support.

**Core technologies:**
- **Expo SDK 55 + expo-audio + expo-router**: Mobile framework with modern audio recording hook (useAudioRecorder), file-based routing, typed routes. expo-av is deprecated -- do not use it.
- **Fastify v5 + @fastify/multipart**: HTTP server for audio upload and API routes. Stream-based file handling keeps memory low. Schema validation via Ajv catches bugs at the boundary.
- **PostgreSQL 17 + Drizzle ORM + postgres.js**: Type-safe database layer with code-first schema, zero codegen, SQL-like query API. postgres.js is the fastest Node.js PostgreSQL driver.
- **OpenAI SDK (gpt-4o-mini-transcribe)**: Transcription at $0.003/min -- half the cost of whisper-1 with same quality. 25MB file limit (sufficient for ~25 min of AAC audio).
- **Anthropic SDK (Claude Haiku 4.5)**: Grammar analysis at ~90% of Sonnet quality, 1/3 the cost. Upgrade path is changing one model string.
- **TanStack Query + Zustand**: Server state caching (all API calls) and minimal client state (recording UI state). Industry standard for React Native in 2026. Do NOT use Redux.
- **Zod**: Runtime validation of Claude's JSON responses. Pairs with Fastify schema validation.

### Expected Features

**Must have (table stakes):**
- One-tap recording with zero-friction start -- every speech app has a big mic button
- Accurate transcription via Whisper API
- Grammar corrections with original vs. corrected display (inline diff, red/green highlighting)
- Filler word detection and counts (um, uh, like, you know, basically, actually, right, I mean) with per-minute rate
- Error categorization by type (articles, prepositions, verb tense, word order, subject-verb agreement)
- Session history list with date, duration, mistake summary
- Fast feedback loop under 15 seconds for 3-minute recording, with progress states (not just a spinner)

**Should have (differentiators -- where Reflexa's thesis lives):**
- Cross-session pattern analysis ("you keep making the same article mistake") -- no competitor does this well
- Recurring mistake identification with specific examples across sessions ("you've used 'depend of' instead of 'depend on' in 4 of your last 7 sessions")
- Session-over-session progress visibility (issues per minute trending down over weeks)
- Structural/naturalness feedback ("grammatically correct but awkward -- a native speaker would say...")
- Mistake severity prioritization (critical: changes meaning, moderate: sounds unnatural, minor: technically wrong but understood)

**Defer (v2+):**
- Vocabulary variety tracking (useful for advanced speakers but not part of core hypothesis)
- AI conversation mode (different product entirely, requires real-time streaming and TTS)
- Multi-language support (English-only, do not even build the abstraction layer)

**Do not build (anti-features by design):**
- Scores, ratings, gamification, streaks, badges -- shifts focus from learning to performing
- Pronunciation coaching -- different problem, different technology (ELSA/Speechace own this)
- Lesson-based curriculum -- Reflexa is a mirror, not a teacher
- Social features or sharing -- speech mistakes are deeply personal
- Real-time correction during speech -- interrupts flow, creates self-consciousness

### Architecture Approach

The architecture is a synchronous three-step pipeline: mobile client records audio and uploads via multipart form data to a Fastify backend, which sequentially calls Whisper for transcription, Claude for analysis, stores results in PostgreSQL, and returns the full result in a single HTTP response. This single-request flow avoids job queue complexity and is appropriate for a single-user tool. The database schema stores both the full Claude JSON response as JSONB (for rendering) and denormalized correction rows in a separate table (for SQL-based pattern aggregation) -- deliberate duplication that trades minimal storage for massive query simplicity. Pattern analysis uses SQL aggregation first (GROUP BY type, COUNT, ORDER BY frequency), then sends a condensed summary to Claude for qualitative insights. Never dump raw transcripts into pattern analysis.

**Major components:**
1. **Audio Recorder (expo-audio)** -- Captures .m4a audio via useAudioRecorder hook with HIGH_QUALITY preset
2. **Upload + Processing Pipeline (Fastify POST /sessions)** -- Receives multipart audio, orchestrates Whisper -> Claude -> Postgres sequentially
3. **Transcription Service (OpenAI SDK)** -- Sends audio file to gpt-4o-mini-transcribe with prompt parameter for verbatim output
4. **Analysis Service (Anthropic SDK)** -- Sends transcript to Claude Haiku 4.5 with spoken-English-calibrated prompt, validates JSON response with Zod
5. **Pattern Service (Drizzle SQL + Anthropic SDK)** -- SQL aggregation of corrections table, condensed summary to Claude for cross-session insights
6. **Data Access Layer (Drizzle ORM + postgres.js)** -- Three tables: sessions (JSONB analysis), corrections (denormalized for queries), filler_words (per-session counts)
7. **Client State Layer (TanStack Query + Zustand)** -- TanStack Query mutations for upload, queries for session list/detail/patterns; Zustand only for recording UI state

### Critical Pitfalls

1. **Whisper silently corrects grammar errors** -- The app exists to catch grammar mistakes, but Whisper's normalizer may fix them before Claude sees them. Use the `prompt` parameter to steer toward verbatim output. Design Claude's prompt around structural patterns (word order, missing articles, prepositions) that Whisper preserves more reliably than conjugation errors. Validate with deliberate error recordings before building analysis features. This is an architectural constraint, not a fixable bug.

2. **Whisper strips filler words by default** -- Filler word detection returns zero results unless Whisper is prompted with filler-heavy example text. Use a long prompt: "Umm, let me think like, hmm... Okay, here's what I'm, like, thinking." Validate before building the filler analysis UI. Fallback plan: CrisperWhisper (open source fork for verbatim transcription).

3. **Claude overcorrects spoken English to written standards** -- Flagging sentence-ending prepositions or contractions as errors produces false positives that destroy all trust. The analysis prompt must explicitly instruct Claude to evaluate against spoken English norms, include negative examples ("Do NOT flag: 'Who did you talk to?'"), and be manually reviewed for the first ~10 sessions. This prompt is the single most important piece of code in the app.

4. **Whisper hallucinations on silence/noise** -- Silent audio chunks produce fabricated text that Claude analyzes seriously. Trim silence from recordings, set minimum duration threshold (2-3 seconds), detect suspicious patterns (repeated phrases, non-English text) in transcription output.

5. **Pipeline latency exceeding 15-second target** -- Three sequential network calls total 8-18 seconds for a 3-minute recording. Mitigate by showing transcription immediately when Whisper returns (before Claude finishes), using Claude prompt caching, and measuring each stage independently. Progressive display makes the wait feel shorter even if total time is unchanged.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Foundation and Pipeline Validation
**Rationale:** Everything depends on the record -> transcribe -> analyze pipeline. The two highest-risk unknowns (Whisper behavior with grammar/fillers, Claude prompt calibration) must be validated before any UI polish. If Whisper strips too many errors, the approach needs adjustment before building on it. This phase answers: "Does the pipeline produce useful output?"
**Delivers:** Working Expo project with audio recording, Fastify server with Whisper integration, validated transcription behavior, initial database schema.
**Addresses:** One-tap recording, transcription, basic server infrastructure, database schema designed for future pattern queries.
**Avoids:** Whisper grammar normalization (Pitfall 1), filler word stripping (Pitfall 2), Android/iOS format issues (Pitfall 6), Expo Go limitations (Pitfall 14), hallucinations on silence (Pitfall 4).

### Phase 2: Core Feedback Loop
**Rationale:** With a validated pipeline, build the Claude analysis integration and results display. This is where the Claude prompt gets extensive testing and where the core value proposition becomes real. A user can record and see corrections after this phase.
**Delivers:** End-to-end flow from recording to displayed corrections with grammar analysis, filler detection, and error categorization. Session persistence.
**Addresses:** Grammar corrections with original vs. corrected, filler word detection and counts, error categorization, fast feedback loop with progress states, session storage.
**Avoids:** Claude overcorrection (Pitfall 3) via careful prompt engineering with spoken-English norms. JSON parsing failures (Pitfall 12) via Zod validation.

### Phase 3: Session History and Polish
**Rationale:** The app becomes a daily-use tool with session management. Without history and polish, it is a demo. The database schema already supports structured queries (Phase 1 decision). This phase also addresses recording robustness (interruptions, edge cases).
**Delivers:** Session history list, session detail view, polished recording UX, progressive result display, error handling.
**Addresses:** Session history/list view, session detail navigation, recording interruption handling, pipeline latency mitigation via progressive display.
**Avoids:** Pipeline latency frustration (Pitfall 7) via showing transcription first, then corrections. Recording interruption data loss (Pitfall 10) via explicit audio session management.

### Phase 4: Pattern Analysis and Progress Tracking
**Rationale:** This is Reflexa's core differentiator but requires accumulated session data (~5+ sessions). Built last because it depends on structured data from all prior phases and because the SQL aggregation + Claude analysis pattern needs real data to validate. This phase validates the product hypothesis: does tracking patterns over time actually help?
**Delivers:** Cross-session pattern identification, recurring mistake tracking, progress metrics over time, recommendations.
**Addresses:** Cross-session pattern analysis, recurring mistake identification, session-over-session progress visibility, mistake severity prioritization.
**Avoids:** Context window limits (Pitfall 8) via SQL-first aggregation with condensed Claude summaries. Lost-in-the-middle degradation by never sending raw transcripts to pattern analysis.

### Phase Ordering Rationale

- **Pipeline validation before UI:** The two biggest risks (Whisper normalization, Claude overcorrection) are in the pipeline, not the UI. Building polished screens on an unvalidated pipeline wastes effort. Phase 1 must answer "does this work?" before Phase 2 asks "does this look good?"
- **Schema design in Phase 1, pattern queries in Phase 4:** The corrections table must exist from the first session insert so that Phase 4 has structured data to aggregate. Retrofitting structured storage onto text blobs is expensive and error-prone.
- **Session history before patterns:** Pattern analysis requires multiple sessions to exist. Phase 3 provides the management layer and natural accumulation period before pattern features are needed.
- **Progressive complexity:** Phase 1 is one route (POST /sessions, partial). Phase 2 completes it. Phase 3 adds GET /sessions and GET /sessions/:id. Phase 4 adds GET /patterns. Each phase is a contained increment with a clear deliverable.
- **Risk front-loading:** The riskiest technical decisions (Whisper behavior, Claude prompt quality) are validated in Phases 1-2. Phases 3-4 build on validated foundations with standard patterns.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1:** Whisper prompt parameter behavior with non-native accents needs hands-on validation. No documentation substitutes for testing with real recordings. The expo-audio setup on Android specifically needs testing for codec and file size behavior.
- **Phase 2:** The Claude analysis prompt requires iterative tuning -- plan for 10+ prompt revisions, not just code. Consider whether to use Claude's tool-use feature for structured output vs. JSON in prompt.
- **Phase 4:** Pattern analysis is the least-documented aspect. The SQL aggregation + Claude summary approach is sound in theory but the right level of aggregation (how much detail to send to Claude, sliding window size) needs experimentation with real accumulated data.

Phases with standard patterns (skip research-phase):
- **Phase 3:** Session CRUD, list/detail views, TanStack Query caching, and expo-router navigation are thoroughly documented patterns with no novel technical challenges.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All libraries are current, actively maintained, well-documented. Versions verified via npm and official docs. No experimental choices. |
| Features | HIGH | Competitive landscape well-mapped across 10+ competitors. Clear gap identified. Feature priorities aligned with project goals. Anti-features explicitly scoped. |
| Architecture | HIGH | Standard patterns for this type of app. Sequential pipeline is appropriate for single-user tool. Dual storage pattern is well-understood. |
| Pitfalls | HIGH | Critical pitfalls confirmed by academic research (arXiv papers), GitHub discussions with OpenAI maintainers, and community reports. These are documented constraints, not speculative risks. |

**Overall confidence:** HIGH

### Gaps to Address

- **Whisper verbatim accuracy with prompt parameter:** The prompt trick for preserving filler words and grammar errors is documented but effectiveness varies by accent and error type. Must be validated with real test recordings in Phase 1 before committing to the filler word feature. If insufficient, CrisperWhisper or a VAD-based fallback is needed.
- **Claude Haiku 4.5 quality for grammar analysis:** Recommended at MEDIUM confidence. If corrections are not accurate or nuanced enough for spoken English, the upgrade to Sonnet is trivial (change model string) but costs 3x more. Can only validate with real usage.
- **gpt-4o-mini-transcribe vs gpt-4o-transcribe:** The newer gpt-4o-transcribe model may handle grammar preservation differently. Worth testing both during Phase 1 validation, though gpt-4o-mini-transcribe is recommended for cost.
- **expo-audio in development builds:** The exact behavior of expo-audio recording interruptions and background handling needs physical device testing. Simulator testing is insufficient for audio features. expo-audio may not work in Expo Go at all.
- **Actual pipeline latency:** The 8-18 second estimate is based on typical API performance. Real latency depends on network conditions, API load, and audio file size. Must be measured per-stage in Phase 1 and optimized in Phase 2-3.
- **Android audio codec and file size:** expo-audio's HIGH_QUALITY preset should produce AAC/M4A on both platforms, but Android codec behavior and resulting file sizes need early testing to avoid the 25MB Whisper limit and ensure format compatibility.

## Sources

### Primary (HIGH confidence)
- [Expo SDK 55 changelog](https://expo.dev/changelog/sdk-55) -- SDK version, expo-audio availability, React Native 0.83
- [Expo Audio docs](https://docs.expo.dev/versions/latest/sdk/audio/) -- useAudioRecorder hook, recording presets
- [Expo Router docs](https://docs.expo.dev/router/introduction/) -- File-based routing, typed routes
- [Fastify docs](https://fastify.dev/) -- Route handling, plugin architecture, TypeScript support
- [@fastify/multipart](https://github.com/fastify/fastify-multipart) -- File upload handling
- [Drizzle ORM docs](https://orm.drizzle.team/) -- Schema definition, query builder, PostgreSQL setup
- [OpenAI API docs and pricing](https://platform.openai.com/docs/pricing) -- gpt-4o-mini-transcribe model, costs, file limits
- [Anthropic docs and pricing](https://platform.claude.com/docs/en/about-claude/pricing) -- Claude Haiku 4.5 model, costs
- [TanStack Query docs](https://tanstack.com/query) -- Mutations, cache invalidation
- [Zustand](https://github.com/pmndrs/zustand) -- Client state management

### Secondary (MEDIUM confidence)
- [Spoken Grammar Assessment Using LLM (arXiv:2410.01579)](https://arxiv.org/html/2410.01579) -- Whisper grammar normalization evidence, 20-point assessment error
- [CrisperWhisper (arXiv:2408.16589)](https://arxiv.org/html/2408.16589v1) -- Verbatim transcription alternative with filler detection
- [Evaluating Whisper across accents (AIP Publishing)](https://pubs.aip.org/asa/jel/article/4/2/025206/3267247/Evaluating-OpenAI-s-Whisper-ASR-Performance) -- Non-native accent accuracy disparities
- [Whisper prompting guide (OpenAI Cookbook)](https://cookbook.openai.com/examples/whisper_prompting_guide) -- Prompt parameter for filler preservation
- [LLM grammar correction overcorrection](https://palospublishing.com/using-llms-to-detect-and-correct-grammar-mistakes/) -- Less than 1% variance from prompt engineering
- Competitor analysis: [Orai](https://orai.com/), [ELSA](https://speechanalyzer.elsaspeak.com/), [Poised](https://www.poised.com/), [Yoodli](https://yoodli.ai/), [Pronounce](https://www.getpronounce.com/), [Cadence](https://cadence-ai.app/), [Speak](https://www.speak.com/)

### Tertiary (LOW confidence)
- [Whisper hallucination GitHub Discussion #1606](https://github.com/openai/whisper/discussions/1606) -- Hallucination patterns on silent audio
- [Whisper grammar normalization GitHub Discussion #1631](https://github.com/openai/whisper/discussions/1631) -- Built-in normalizer confirmation
- [expo-audio interruption handling GitHub Issue #30792](https://github.com/expo/expo/issues/30792) -- Recording interruption behavior varies by OS
- [expo-av LOW_QUALITY bug GitHub Issue #24257](https://github.com/expo/expo/issues/24257) -- 10MB/min recording on Android

---
*Research completed: 2026-03-19*
*Ready for roadmap: yes*
