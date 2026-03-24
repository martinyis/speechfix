# Roadmap: Reflexa

## Overview

Reflexa delivers a personal speech feedback tool in three phases. Phase 1 stands up the full infrastructure and validates the riskiest unknown: whether Whisper preserves enough grammar errors and filler words to make AI analysis useful. Phase 2 builds the complete daily-use experience -- record speech, see corrections, review past sessions. Phase 3 adds cross-session pattern analysis, the differentiating feature that requires accumulated data to validate.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation + Pipeline Validation** (2026-03-19) - Expo app, Fastify server, database, audio recording, and Whisper transcription with validated filler/grammar preservation
- [x] **Phase 2: Complete Feedback Loop** (2026-03-19) - Claude analysis, results display, session storage, and session history -- the full daily-use experience
- [ ] **Phase 3: Pattern Analysis** - Cross-session recurring mistake identification via SQL aggregation and Claude insights

## Phase Details

### Phase 1: Foundation + Pipeline Validation
**Goal**: User can record speech on their iPhone and see a transcription that preserves filler words and grammar errors -- validating the pipeline before building on it
**Depends on**: Nothing (first phase)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-06, REC-01, REC-02, REC-03, REC-04
**Success Criteria** (what must be TRUE):
  1. User can open the app on a physical iPhone, tap a microphone button to start recording, and tap again to stop
  2. After recording stops, audio is uploaded to the backend and a transcription appears on screen
  3. Filler words (um, uh, like, you know) are present in the transcription when spoken -- verified with a deliberate test recording
  4. Silence-only recordings do not produce hallucinated text
**Plans**: 3 plans

Plans:
- [x] 01-01-PLAN.md -- Backend foundation: Fastify server, PostgreSQL database, Drizzle ORM schema
- [x] 01-02-PLAN.md -- Expo app: project setup, recording UI with mic button and waveform, stack navigation
- [x] 01-03-PLAN.md -- Pipeline wiring: audio upload, silence stripping, Whisper transcription, results display

### Phase 2: Complete Feedback Loop
**Goal**: User can record speech, see grammar corrections with errors highlighted alongside corrected versions, review filler word counts, and browse past sessions -- the complete daily-use tool
**Depends on**: Phase 1
**Requirements**: ANLYS-01, ANLYS-02, ANLYS-03, ANLYS-04, ANLYS-05, INFRA-05, STOR-01, STOR-02, STOR-03, STOR-04
**Success Criteria** (what must be TRUE):
  1. After recording, user sees original sentences with errors highlighted and corrected versions side by side
  2. Filler words are flagged separately with per-word counts (e.g., "like: 7, um: 3")
  3. Errors are categorized by type (articles, verb tense, prepositions, word order, etc.)
  4. Transcription appears first while Claude analysis is still processing (progressive display)
  5. User can view a list of previous sessions and tap any session to review its full results
**Plans**: 3 plans

Plans:
- [x] 02-01-PLAN.md -- Claude analysis service, session API routes (POST with analysis, GET list, GET detail), types
- [x] 02-02-PLAN.md -- Results screen with progressive display, color-coded error highlights, tooltips, filler chips
- [x] 02-03-PLAN.md -- Tab navigation (Record + History), history list screen, history detail screen

### Phase 3: Pattern Analysis
**Goal**: User can trigger cross-session analysis that surfaces recurring mistakes with specific examples, validating whether tracking patterns over time adds value
**Depends on**: Phase 2
**Requirements**: PAT-01, PAT-02, PAT-03, PAT-04
**Success Criteria** (what must be TRUE):
  1. User can tap a button to trigger pattern analysis across accumulated sessions
  2. Results show specific recurring error patterns with examples pulled from actual sessions (e.g., "You used 'depend of' instead of 'depend on' in 3 sessions")
  3. Analysis works efficiently -- mistakes are pre-aggregated with SQL before sending to Claude, not dumping raw transcripts
**Plans**: TBD

Plans:
- [ ] 03-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation + Pipeline Validation | 3/3 | Complete | 2026-03-19 |
| 2. Complete Feedback Loop | 3/3 | Complete | 2026-03-19 |
| 3. Pattern Analysis | 0/1 | Not started | - |
