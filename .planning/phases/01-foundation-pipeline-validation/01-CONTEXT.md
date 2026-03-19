# Phase 1: Foundation + Pipeline Validation - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Stand up the full infrastructure (Expo app, Fastify server, PostgreSQL database) and build the recording-to-transcription pipeline. User can record speech on their iPhone, audio is uploaded and transcribed via Whisper, and the transcription is displayed — validating that filler words and grammar errors are preserved before Phase 2 builds corrections on top.

</domain>

<decisions>
## Implementation Decisions

### Recording interaction
- Tap-to-toggle: tap once to start recording, tap again to stop
- Large centered mic button — the dominant element on the record screen
- Live waveform visualization while recording (no elapsed timer)
- Waveform disappears when recording stops

### Post-recording flow
- Auto-upload immediately after recording stops — no preview/confirm step
- Loading spinner with status text during processing ("Uploading...", "Transcribing...")
- Transcription displayed sentence-by-sentence (each sentence on its own row) — sets up the layout for Phase 2's per-sentence corrections

### App layout
- Two screens with stack navigation: Record screen → Results screen
- Record screen: mic button only, clean and focused — no text, no last session info
- Results screen: sentence-by-sentence transcription with standard iOS back navigation
- Dark theme throughout
- No tab bar in Phase 1

### Whisper configuration
- Strip leading/trailing silence only (keep natural pauses between speech)
- Silence stripping happens on the backend (ffmpeg server-side, not on device)
- Use Whisper prompt to preserve filler words (e.g., "Include filler words: um, uh, like, you know, so, basically")
- Audio format: Claude's discretion (pick best for Whisper compatibility + expo-audio support + file size)

### Claude's Discretion
- Audio recording format (WAV vs M4A/AAC vs other)
- Exact waveform visualization implementation
- Loading spinner design
- Database schema details
- API route structure
- Error handling patterns

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs — requirements fully captured in decisions above and in `.planning/REQUIREMENTS.md`.

### Project-level
- `.planning/PROJECT.md` — Project vision, constraints (tech stack, speed requirements, simplicity philosophy)
- `.planning/REQUIREMENTS.md` — Phase 1 requirements: INFRA-01 through INFRA-04, INFRA-06, REC-01 through REC-04

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project, no existing code

### Established Patterns
- None — patterns will be established in this phase

### Integration Points
- Expo prebuild (development build) required for audio recording — expo-audio doesn't work in Expo Go
- PostgreSQL via Postgres.app (already installed locally)
- OpenAI Whisper API for transcription
- Fastify backend running locally (no Docker)

</code_context>

<specifics>
## Specific Ideas

- Phase 2 vision (noted for later): sentences with highlighted error phrases alongside corrected versions with highlighted corrections — side-by-side comparison per sentence
- The sentence-by-sentence layout in Phase 1 is deliberately chosen to prepare for this Phase 2 corrections display
- Key validation: Whisper must preserve filler words (um, uh, like, you know) when spoken deliberately — this is the pipeline gate before building analysis

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation-pipeline-validation*
*Context gathered: 2026-03-19*
