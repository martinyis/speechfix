# Phase 2: Complete Feedback Loop - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Record speech, send transcription to Claude for grammar and filler word analysis, display corrections with highlighted errors and filler word counts, store sessions, and let the user browse past sessions. This is the complete daily-use feedback loop — the core product experience.

</domain>

<decisions>
## Implementation Decisions

### Corrections display
- Inline highlights on error words/phrases within each sentence, color-coded by error type (e.g., orange for verb tense, blue for articles, purple for prepositions)
- Each highlighted error is individually tappable — shows a small tooltip with the corrected word/phrase only (no explanation, no error type label in tooltip)
- Sentences with no errors are hidden — only sentences containing errors are shown in results
- No summary count header — the visible sentences implicitly communicate what had errors
- Error type distinction is purely visual via highlight color — the tooltip stays minimal (correction text only)

### Filler word summary
- Horizontal chips/pills displayed in a section above the corrections (e.g., [like: 7] [um: 3] [so: 5])
- Filler words are also highlighted within the sentence text in a distinct color (separate from grammar error colors)
- If no filler words detected, the filler section is hidden entirely

### Session history
- Bottom tab bar with 2 tabs: Record and History
- History list shows rows with: date, error count, and duration per session (e.g., "Mar 19, 2026 • 4 errors • 2:30")
- Tapping a session navigates to a dedicated history detail screen (separate from the live results screen)
- History detail screen shows the same corrections + fillers content as live results, but with a date/duration header instead of "Results"

### Progressive loading (INFRA-05)
- After recording, navigate to results screen immediately
- Show transcription sentences as plain text with a shimmer/skeleton overlay indicating analysis is pending
- Small animated banner below the screen header: "Analyzing speech..." while Claude processes
- When analysis completes, banner disappears and all highlights + filler chips fade in with a brief animation
- User can read their transcription while waiting for AI analysis

### Claude's Discretion
- Exact highlight colors per error type
- Tooltip positioning and dismiss behavior
- Shimmer/skeleton animation implementation
- Fade-in animation timing and easing
- Tab bar icon choices
- History list sort order (presumably newest first)
- Error type taxonomy (what categories to use beyond articles, verb tense, prepositions, word order)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs — requirements fully captured in decisions above and in `.planning/REQUIREMENTS.md`.

### Project-level
- `.planning/PROJECT.md` — Project vision, constraints (tech stack, speed requirements, simplicity philosophy)
- `.planning/REQUIREMENTS.md` — Phase 2 requirements: ANLYS-01 through ANLYS-05, INFRA-05, STOR-01 through STOR-04

### Phase 1 context (patterns to follow)
- `.planning/phases/01-foundation-pipeline-validation/01-CONTEXT.md` — Phase 1 decisions (sentence-by-sentence layout, auto-upload, light theme)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `mobile/components/RecordButton.tsx` — Existing mic button component with recording state
- `mobile/components/Waveform.tsx` — Live waveform visualization component
- `mobile/hooks/useRecording.ts` — Recording hook (start/stop, audioUri, duration, metering)
- `mobile/hooks/useUpload.ts` — Upload mutation hook (posts audio to backend)
- `mobile/app/results.tsx` — Current results screen (sentence-by-sentence transcription display — will be extended)
- TanStack React Query already set up in `_layout.tsx`

### Established Patterns
- Stack navigation via expo-router (Record → Results)
- Light theme (`#fff` background, `#000` text)
- Sentence-by-sentence rows with hairline dividers
- Auto-upload on recording stop with loading overlay
- Fastify multipart upload + Whisper transcription pipeline

### Integration Points
- `server/src/routes/sessions.ts` — POST /sessions route (needs Claude analysis step added after transcription)
- `server/src/db/schema.ts` — `corrections` and `fillerWords` tables already defined in schema (ready to use)
- `sessions.analysis` column (nullable jsonb) — exists but unused, can store structured analysis
- Navigation: stack nav needs to become tab nav (Record tab, History tab) with stack inside each tab
- New API routes needed: GET /sessions (list), GET /sessions/:id (detail with corrections)

</code_context>

<specifics>
## Specific Ideas

- Phase 1 context noted: "sentences with highlighted error phrases alongside corrected versions with highlighted corrections — side-by-side comparison per sentence" — user chose inline highlights with tooltips instead (simpler)
- Color-coded error types for visual scanning of mistake patterns
- Filler words highlighted both in summary chips AND inline in sentence text — dual visibility
- Keep it simple for v1 — no deep explanations, just show what's wrong and the correction

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-complete-feedback-loop*
*Context gathered: 2026-03-19*
