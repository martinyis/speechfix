---
phase: 02-complete-feedback-loop
plan: 01
subsystem: api
tags: [claude, anthropic-sdk, speech-analysis, drizzle, fastify, nlp]

# Dependency graph
requires:
  - phase: 01-foundation-pipeline-validation
    provides: Whisper transcription service, DB schema, Fastify server, sessions route
provides:
  - analyzeSpeech() service for Claude-powered grammar and filler word analysis
  - POST /sessions with integrated analysis pipeline
  - GET /sessions list endpoint with error counts
  - GET /sessions/:id detail endpoint with corrections, filler words, and positions
  - Mobile TypeScript types for session detail, corrections, filler words
affects: [02-02, 02-03, mobile-ui, session-history]

# Tech tracking
tech-stack:
  added: ["@anthropic-ai/sdk (Claude API for analysis)"]
  patterns: ["Claude structured JSON responses with system prompt", "analysis JSON column for derived metadata"]

key-files:
  created:
    - server/src/services/analysis.ts
  modified:
    - server/src/routes/sessions.ts
    - server/src/db/schema.ts
    - mobile/types/session.ts

key-decisions:
  - "Filler positions stored in session analysis JSON column, not a separate table -- display-only metadata derived from the same analysis pass"
  - "sentenceIndex column added to corrections table with default(0) for backward compatibility"
  - "Claude system prompt tuned for non-native speakers: ignores gonna/wanna/gotta, sentence fragments"

patterns-established:
  - "Claude analysis pattern: structured JSON response with try/catch fallback to empty results"
  - "Session analysis column stores derived metadata (sentences, fillerPositions) as JSONB"

requirements-completed: [ANLYS-01, ANLYS-03, ANLYS-04, ANLYS-05, STOR-01, STOR-02]

# Metrics
duration: 3min
completed: 2026-03-19
---

# Phase 02 Plan 01: Claude Analysis Backend Summary

**Claude-powered speech analysis service with grammar correction, filler word counting, and per-sentence filler positioning via 3 API routes**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-19T22:55:05Z
- **Completed:** 2026-03-19T22:57:43Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Claude analysis service that identifies grammar errors and filler words with per-sentence positioning
- POST /sessions now runs full transcription + analysis pipeline, storing results in DB
- GET /sessions and GET /sessions/:id routes serve session list and detail views
- Mobile TypeScript types ready for UI consumption (SessionDetail, SessionListItem, Correction, FillerWord, FillerWordPosition)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Claude analysis service and update types** - `b09f22d` (feat)
2. **Task 2: Update POST /sessions with analysis + add GET routes** - `6c368f3` (feat)

## Files Created/Modified
- `server/src/services/analysis.ts` - Claude analysis service with analyzeSpeech() function
- `server/src/routes/sessions.ts` - Updated POST with analysis, added GET list and GET detail routes
- `server/src/db/schema.ts` - Added sentenceIndex column to corrections table
- `mobile/types/session.ts` - Added Correction, FillerWord, FillerWordPosition, SessionDetail, SessionListItem types

## Decisions Made
- Filler positions stored in session analysis JSON column rather than a separate table -- they are display-only metadata derived from the same analysis pass
- sentenceIndex column added to corrections table with default(0) for backward compatibility with any existing data
- Claude system prompt specifically tuned for non-native English speakers: does not flag gonna/wanna/gotta, sentence fragments, or other natural spoken English patterns

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

None - no external service configuration required. ANTHROPIC_API_KEY should already be in the server .env from project setup.

## Next Phase Readiness
- Analysis backend fully operational, ready for mobile UI to consume via API
- GET /sessions and GET /sessions/:id provide all data needed for session list and detail views
- FillerWordPosition type enables inline filler highlighting in the UI

## Self-Check: PASSED

All files verified present. All commits verified in git log.

---
*Phase: 02-complete-feedback-loop*
*Completed: 2026-03-19*
