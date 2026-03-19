# Reframe

## What This Is

A personal speech improvement tool for non-native English speakers. Records free-form speech, transcribes it, and uses AI to identify grammar mistakes, structural issues, and bad speech patterns (filler words, repetitive phrases). Built as a mobile app for daily personal use — not a polished product, but a functional tool to test whether AI-powered speech feedback actually improves how you speak over time.

## Core Value

Show me exactly what I said wrong and how to say it right — no scores, no gamification, just honest corrections that help me fix unconscious speech patterns nobody else will point out.

## Requirements

### Validated

- [x] User can tap a microphone button and record free-form speech of any duration — Validated in Phase 1
- [x] Recording is transcribed via Whisper API — Validated in Phase 1
- [x] Transcription is sent to Claude for grammar, structure, and filler word analysis — Validated in Phase 2
- [x] Results show original sentences with mistakes highlighted and corrected versions side by side — Validated in Phase 2
- [x] Filler words (like, so, you know, etc.) are flagged separately with counts — Validated in Phase 2
- [x] Each speech session is stored in the database (transcription + corrections + metadata) — Validated in Phase 2
- [x] User can view history of previous speech sessions — Validated in Phase 2

### Active

- [ ] User can trigger pattern analysis across accumulated sessions to surface recurring mistakes
- [ ] Pattern analysis is smart about context size (doesn't dump all sessions into one API call)

### Out of Scope

- AI Conversation Mode (voice chat with AI on selected topics) — v2, needs real-time streaming and TTS, different product
- Sentence repetition/practice tasks — v2, good idea but testing core feedback loop first
- User profile/context for personalized AI responses — v2, not needed for personal use
- Native language picker — v2, English-only for now
- Scores, streaks, gamification — deliberately excluded, not the product philosophy
- Multi-language support — English corrections only
- Authentication/user accounts — personal tool, single user
- App Store deployment — testing locally first

## Context

- Builder is the target user — non-native English speaker who knows English well but makes unconscious grammar mistakes, overuses filler words, and has limited vocabulary variety
- The core hypothesis: seeing your specific mistakes corrected immediately after speaking will help fix unconscious patterns over time
- Speed is critical — transcription and AI analysis should feel fast, not make the user wait
- The AI prompt for speech analysis is the most important piece — it needs to catch real mistakes without false positives (flagging correct speech kills trust)
- Pattern analysis across sessions is important for V1 to test whether tracking recurring mistakes adds value
- Previous codebase was deleted — fresh start with clear scope

## Constraints

- **Tech stack**: React Native (Expo) + Node.js backend + PostgreSQL + OpenAI Whisper API + Claude API
- **Package manager**: npm
- **Database**: PostgreSQL via Postgres.app (already installed locally)
- **Dev setup**: Local Node.js server, no Docker
- **Speed**: Transcription and AI response must be fast — under 15 seconds for a 3-minute recording
- **Simplicity**: Not a polished app — just needs to work for personal testing today

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| React Native (Expo) for mobile | Mobile-first for convenient daily recording | — Pending |
| Claude for speech analysis | Strong language understanding for nuanced grammar corrections | — Pending |
| OpenAI Whisper API for transcription | Fast, accurate, no local setup needed | — Pending |
| PostgreSQL for storage | Robust for structured speech data, already installed | — Pending |
| No auth/accounts | Personal tool, single user, don't overcomplicate | — Pending |
| Pattern analysis in V1 | Want to test this hypothesis early with ~5 sessions | — Pending |
| No scores/gamification | Philosophy: respect user intelligence, just show corrections | — Pending |

---
*Last updated: 2026-03-19 after Phase 2 completion — complete feedback loop built*
