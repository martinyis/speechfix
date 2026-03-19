# Requirements: Reframe

**Defined:** 2026-03-19
**Core Value:** Show me exactly what I said wrong and how to say it right -- no scores, no gamification, just honest corrections.

## v1 Requirements

### Recording

- [x] **REC-01**: User can tap a microphone button to start/stop recording
- [ ] **REC-02**: Audio is uploaded to the backend after recording stops
- [ ] **REC-03**: Audio is transcribed via OpenAI Whisper API with filler word preservation
- [ ] **REC-04**: Silence is stripped from audio before transcription to prevent hallucinations

### Analysis

- [ ] **ANLYS-01**: Transcription is sent to Claude for grammar and structure analysis
- [ ] **ANLYS-02**: Results display original sentences with errors highlighted and corrected versions side by side
- [ ] **ANLYS-03**: Filler words are flagged with per-word counts
- [ ] **ANLYS-04**: Errors are categorized by type (articles, verb tense, prepositions, word order, etc.)
- [ ] **ANLYS-05**: Analysis distinguishes spoken-English norms from actual errors (no overcorrection)

### Storage

- [ ] **STOR-01**: Each session stores transcription, structured corrections, and metadata
- [ ] **STOR-02**: Corrections are stored in structured form (error type, original, corrected, position)
- [ ] **STOR-03**: User can view a list of previous sessions
- [ ] **STOR-04**: User can tap a session to review its full results

### Patterns

- [ ] **PAT-01**: User can trigger cross-session pattern analysis via a button
- [ ] **PAT-02**: Mistakes are pre-aggregated with SQL before sending to Claude
- [ ] **PAT-03**: Claude identifies recurring error patterns across sessions
- [ ] **PAT-04**: Results show specific recurring patterns with examples from sessions

### Infrastructure

- [x] **INFRA-01**: Expo app with prebuild (development build) targeting iOS
- [x] **INFRA-02**: expo-audio for recording, compatible with dev client
- [x] **INFRA-03**: Fastify backend with API routes for upload, analysis, and history
- [x] **INFRA-04**: PostgreSQL database with Drizzle ORM schema
- [ ] **INFRA-05**: Progressive display (show transcription first, then corrections)
- [x] **INFRA-06**: App testable on physical iPhone via development build

## v2 Requirements

### Conversation Mode

- **CONV-01**: User can have voice-only conversations with AI on selected topics
- **CONV-02**: AI responses are spoken via text-to-speech (no visible text)
- **CONV-03**: AI responses are short and conversational
- **CONV-04**: User can select conversation topics (interview, date, etc.)

### Practice

- **PRAC-01**: User can repeat corrected sentences for active practice
- **PRAC-02**: User profile/context for personalized AI responses

### Localization

- **LOC-01**: Native language picker for targeted corrections
- **LOC-02**: Vocabulary variety scoring

## Out of Scope

| Feature | Reason |
|---------|--------|
| Scores/streaks/gamification | Deliberately excluded -- not the product philosophy |
| Pronunciation coaching | Different product category (ELSA territory) |
| Lesson-based learning | Not a teaching app -- it's a feedback mirror |
| Authentication/accounts | Personal tool, single user |
| App Store deployment | Testing locally first |
| Multi-language support | English corrections only for v1 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| REC-01 | Phase 1 | Complete |
| REC-02 | Phase 1 | Pending |
| REC-03 | Phase 1 | Pending |
| REC-04 | Phase 1 | Pending |
| ANLYS-01 | Phase 2 | Pending |
| ANLYS-02 | Phase 2 | Pending |
| ANLYS-03 | Phase 2 | Pending |
| ANLYS-04 | Phase 2 | Pending |
| ANLYS-05 | Phase 2 | Pending |
| STOR-01 | Phase 2 | Pending |
| STOR-02 | Phase 2 | Pending |
| STOR-03 | Phase 2 | Pending |
| STOR-04 | Phase 2 | Pending |
| PAT-01 | Phase 3 | Pending |
| PAT-02 | Phase 3 | Pending |
| PAT-03 | Phase 3 | Pending |
| PAT-04 | Phase 3 | Pending |
| INFRA-01 | Phase 1 | Complete |
| INFRA-02 | Phase 1 | Complete |
| INFRA-03 | Phase 1 | Complete |
| INFRA-04 | Phase 1 | Complete |
| INFRA-05 | Phase 2 | Pending |
| INFRA-06 | Phase 1 | Complete |

**Coverage:**
- v1 requirements: 23 total
- Mapped to phases: 23
- Unmapped: 0

---
*Requirements defined: 2026-03-19*
*Last updated: 2026-03-19 after roadmap creation*
