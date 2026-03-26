# Implementation Plan: Practice Feature

## Summary

Build the Practice feature for Reflexa -- two targeted drill types ("Say It Right" and "Use It Naturally") that let users practice corrections from their voice sessions. Lightweight REST-based recording flow (no WebSocket), new `practice_attempts` DB table to track completion, and a task list UI on the Practice tab.

## Context & Problem

Users complete voice sessions, see their corrections on the Session Detail screen, and then... nothing. There's no way to actively practice the mistakes they made. The corrections are informational but passive. The Practice feature closes this loop: every correction becomes a practice-able task, and the user can drill specific errors until they stick.

Two task types serve different learning goals:
- **"Say It Right"** -- repetition/pronunciation. User sees the corrected sentence and records themselves saying it. Low cognitive load, builds muscle memory.
- **"Use It Naturally"** -- production/understanding. User sees the error pattern and a new scenario prompt, then constructs their own sentence applying the rule. Higher cognitive load, tests real comprehension.

## Chosen Approach

**No WebSocket, no TTS.** Practice uses a simple record-stop-upload-evaluate REST flow. The existing voice session infrastructure is designed for multi-turn conversation with turn detection, interrupts, and streaming TTS -- none of which applies to a single-sentence drill. A REST endpoint keeps the client and server simple.

**No separate tasks table for the task list.** Practice tasks are computed on-the-fly from the `corrections` table. A correction IS a task. We add a `practice_attempts` table to track completions, but we do not duplicate correction data into a separate tasks table. This avoids sync issues and means every new session automatically generates new practice tasks with zero extra work.

**Single practice endpoint with mode parameter.** Both drill types need: transcribe audio, then evaluate against a target. The evaluation prompt differs by mode, but the pipeline is identical.

---

## 1. Practice Tab (List Screen)

### What the user sees

The Practice tab shows a scrollable list of practice task cards, grouped into two sections:

**Section 1: "To Practice" (uncompleted)**
- All corrections the user has never successfully completed a practice attempt for
- Sorted by recency (newest session's corrections first)
- Capped at 20 visible tasks, with a "Show more" strip if there are more (same pattern as session detail's "Show remaining" strip)

**Section 2: "Practiced" (completed)**
- Corrections the user has passed at least once
- Collapsed by default, expandable via a "Show practiced (N)" toggle
- Sorted by most recently practiced
- User can re-practice these (they're not locked)

### What each task card shows

Each card is a compact row (not the full CorrectionCard -- that's too heavy for a list):

```
[severity dot + color]  [correctionType label]     [session date]
"original text excerpt" -> "corrected text"
[Practice button]
```

Specifically:
- **Left edge:** severity color indicator (3px bar, same as CorrectionCard)
- **Top row:** severity badge (Error/Improvement/Polish) + correction type (article, verb_tense, etc.) + relative date ("2h ago", "Yesterday")
- **Body:** `originalText` with strikethrough, arrow, `correctedText` -- single line each, truncated with ellipsis if long
- **Bottom right:** "Practice" button (small, pill-shaped, primary color)

### Filtering

A horizontal chip strip at the top (same `CorrectionFilterChips` component used in Session Detail) lets the user filter by severity: All / Errors / Improvements / Polish. This filters both sections.

### Empty states

**No sessions yet (zero corrections ever):**
```
[fitness-outline icon]
"Nothing to practice yet"
"Complete a voice session and your corrections will appear here as practice drills."
[Start a session] button -> navigates to Home tab
```

**All tasks completed:**
The "To Practice" section shows:
```
[checkmark-circle-outline icon]
"All caught up"
"You've practiced every correction. Keep talking to generate new ones."
```
The "Practiced" section still shows below with re-playable items.

### Data source

**API endpoint:** `GET /practice/tasks`

Returns all corrections for the user, joined with practice attempt data:

```json
{
  "tasks": [
    {
      "correctionId": 42,
      "sessionId": 7,
      "sessionDate": "2026-03-25T10:00:00Z",
      "originalText": "I go to store yesterday",
      "correctedText": "I went to the store yesterday",
      "explanation": "Past tense required for completed actions.",
      "correctionType": "verb_tense",
      "severity": "error",
      "contextSnippet": "So I go to store yesterday and...",
      "practiced": false,
      "lastPracticedAt": null,
      "practiceCount": 0
    }
  ]
}
```

This is a single query: `corrections LEFT JOIN practice_attempts` (grouped), ordered by `corrections.createdAt DESC`. The mobile side splits into "To Practice" vs "Practiced" sections based on the `practiced` boolean.

---

## 2. Session Detail -> Practice Entry Point

### Where the button goes

Add a "Practice" button to the bottom row of each `CorrectionCard` component, next to the existing "Tap to hear" play button. It sits on the right side of the bottom row:

```
[Why? button]                    [Play button] [Practice button]
```

The Practice button is a small pill: purple background (primary at 15% opacity), purple text, "Practice" label with a small chevron-right icon.

### Navigation

Tapping "Practice" on a CorrectionCard navigates to:
```
router.push({
  pathname: '/practice-session',
  params: {
    correctionId: String(correction.id),
    mode: 'say_it_right',  // default mode
  },
});
```

This is the same Practice Screen used from the Practice tab. The only difference: when entering from Session Detail, there is no "next task" flow -- after completing (or skipping), the user goes back to Session Detail. When entering from the Practice tab, after completing, the user gets a "next task" option.

The `mode` param defaults to `say_it_right`. The user can switch modes on the Practice Screen itself.

### CorrectionCard needs the correction ID

Currently, `CorrectionCard` doesn't receive the correction `id` as a prop -- it only gets display data. The `id` needs to be passed through so the Practice button can navigate with it. The `session-detail.tsx` screen already has `c.id` available in the map.

---

## 3. The Practice Screen

### Screen identity

New file: `mobile/app/practice-session.tsx` (stack screen, not tab -- same pattern as `session-detail.tsx`).

Registered in `_layout.tsx`:
```tsx
<Stack.Screen
  name="practice-session"
  options={{ headerShown: false, presentation: 'card' }}
/>
```

### Route params

```typescript
{
  correctionId: string;   // required
  mode?: string;          // 'say_it_right' | 'use_it_naturally', defaults to 'say_it_right'
  fromList?: string;      // 'true' if navigated from Practice tab (enables "next task" flow)
}
```

### Screen layout (both modes)

The screen has three phases: **Prompt**, **Recording**, **Result**.

#### Phase 1: Prompt (what the user sees before recording)

**Header:** `ScreenHeader variant="back"` with back button. Right side shows the mode toggle.

**Mode toggle:** Two small pills side by side: "Say It Right" (active/inactive) and "Use It Naturally" (active/inactive). Tapping switches mode. Active pill has primary color bg at 15%, primary text. Inactive pill has white at 4% bg, dim text.

**Card area (center of screen):**

**"Say It Right" mode:**
```
CORRECTION TYPE label (e.g., "VERB TENSE")         [severity badge]

"You said:"
  "I go to store yesterday"     [strikethrough, error color]

"Say this instead:"
  "I went to the store yesterday"   [bold, white, prominent]

[explanation text, dim, small]
"Past tense required for completed actions."
```

The user can see both what they said wrong AND the target sentence. Their job is to say the corrected version out loud.

**"Use It Naturally" mode:**
```
CORRECTION TYPE label (e.g., "VERB TENSE")         [severity badge]

"Your mistake:"
  "I go to store yesterday" -> "I went to the store yesterday"
  [shown smaller, as context -- both visible]

"The rule:"
  "Past tense required for completed actions."

"Now try it:"
  [AI-generated scenario prompt, e.g.:]
  "Tell me about something you did last weekend."
```

The user sees the correction as context, understands the rule, then must apply it in a new sentence they construct themselves. The scenario prompt is generated by the AI evaluation endpoint (fetched when the screen loads in this mode, or when the user switches to this mode).

**Bottom of screen:** Large "Record" button (circular, centered, mic icon, primary color glow). Same visual language as the mic orb but simpler -- no bloom animation, just a solid circle with mic icon.

#### Phase 2: Recording (while user is speaking)

**NOT a full-screen takeover.** Practice recording is lightweight -- it stays on the same screen. The card area remains visible (so the user can reference the target sentence). Changes:

- The "Record" button transforms into a "Stop" button: red background, square-rounded icon, pulsing ring animation
- A small timer appears below the button showing elapsed seconds ("0:03")
- The card area dims slightly (opacity 0.6) to draw focus to the recording state
- Max recording duration: 15 seconds, then auto-stops (these are single sentences, not speeches)

Recording uses `ExpoPlayAudioStream.startRecording` with the same config as voice sessions (16kHz, mono, PCM 16-bit), but instead of streaming over WebSocket, the audio is buffered locally.

When the user taps "Stop" (or auto-stop triggers):
- Recording stops
- Screen transitions to a brief "Evaluating..." state (the button area shows a small loading spinner + "Evaluating..." text)
- Audio is POSTed to `POST /practice/evaluate`

#### Phase 3: Result (after AI evaluation)

The result replaces the card area content. Two outcomes:

**Pass:**
```
[checkmark circle, green, animated scale-in]
"Nailed it"

[AI feedback text, 1-2 sentences]
"Your sentence matched the target closely. Clear past tense usage."

[primary button] "Done"           (if from Session Detail)
[primary button] "Next"           (if from Practice tab, and more tasks exist)
[ghost button]   "Try Again"      (always available)
```

**Needs Retry:**
```
[refresh circle, amber/orange, animated]
"Not quite"

[AI feedback text, 1-2 sentences explaining what was off]
"You said 'I goed to the store.' The past tense of 'go' is 'went', not 'goed'."

[What you said:]
  "I goed to the store"         [dim text]

[primary button] "Try Again"
[ghost button]   "Skip"          (only from Practice tab list flow)
```

The AI returns a simple JSON:
```json
{
  "passed": true,
  "transcript": "I went to the store yesterday.",
  "feedback": "Your sentence matched the target closely. Clear past tense usage."
}
```

### Navigation after result

**From Session Detail ("Practice" button on CorrectionCard):**
- Pass -> "Done" returns to Session Detail (`router.back()`)
- Retry -> stays on Practice Screen, resets to Phase 1
- No "Next" or "Skip" -- it's a single-task flow

**From Practice tab:**
- Pass -> "Next" loads the next uncompleted task (advance `correctionId`, stay on Practice Screen). If no more tasks, button says "Done" and goes back to Practice tab.
- Retry -> stays on Practice Screen, resets to Phase 1
- Skip -> loads the next uncompleted task (does not record an attempt)
- "Done" at any point -> back to Practice tab

### Skip behavior

Skip does not record anything. The task stays in "To Practice." It just advances to the next task. Available only in the Practice tab list flow (not from Session Detail, where there's only one task).

---

## 4. Architecture

### Which corrections become tasks

**All of them.** Every correction from every session becomes a practice task. No filtering by severity, no "only errors," no "only recurring." Reasons:

1. The severity filter on the Practice tab already lets users focus on errors if they want
2. Improvements and polish corrections are just as valuable to practice
3. Computing "recurring" patterns adds complexity for MVP with no clear benefit
4. More tasks = more practice content = better for the user

### Database changes

**New table: `practice_attempts`**

```sql
CREATE TABLE practice_attempts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  correction_id INTEGER NOT NULL REFERENCES corrections(id) ON DELETE CASCADE,
  mode TEXT NOT NULL,                    -- 'say_it_right' | 'use_it_naturally'
  passed BOOLEAN NOT NULL,
  transcript TEXT NOT NULL,              -- what the user actually said
  feedback TEXT,                         -- AI feedback text
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

Drizzle schema addition in `server/src/db/schema.ts`:

```typescript
export const practiceAttempts = pgTable('practice_attempts', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  correctionId: integer('correction_id').references(() => corrections.id, { onDelete: 'cascade' }).notNull(),
  mode: text('mode').notNull(),
  passed: boolean('passed').notNull(),
  transcript: text('transcript').notNull(),
  feedback: text('feedback'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

No indexes beyond the primary key for MVP. If the practice_attempts table grows large, add an index on `(user_id, correction_id)` later.

**No changes to the corrections table.** Completion state is derived: a correction is "practiced" if it has at least one `practice_attempts` row where `passed = true`.

### Task state model

Tasks do not have explicit states (no pending/completed/skipped enum). State is derived:

- **Unpracticed:** zero `practice_attempts` rows with `passed = true` for this correction
- **Practiced:** at least one `practice_attempts` row with `passed = true`

Every attempt is recorded (pass and fail). This gives us a history for each correction: how many tries it took, what mode was used, what the user said each time. Useful for future analytics/patterns features.

### Can users re-practice completed tasks?

Yes. The "Practiced" section on the Practice tab shows completed tasks. Tapping "Practice" on one starts a new attempt. The new attempt is recorded in `practice_attempts` like any other. This is intentional -- spaced repetition means revisiting old corrections.

### API endpoints

**1. `GET /practice/tasks`** -- List all practice tasks for the user

Query: all corrections for the user's sessions, left-joined with practice_attempts to compute `practiced` status and `practiceCount`.

```sql
SELECT
  c.id AS correction_id,
  c.session_id,
  c.original_text,
  c.corrected_text,
  c.explanation,
  c.correction_type,
  c.severity,
  c.context_snippet,
  c.created_at,
  s.created_at AS session_date,
  BOOL_OR(pa.passed) AS practiced,
  MAX(pa.created_at) AS last_practiced_at,
  COUNT(pa.id)::int AS practice_count
FROM corrections c
JOIN sessions s ON s.id = c.session_id
LEFT JOIN practice_attempts pa ON pa.correction_id = c.id
WHERE s.user_id = $userId
GROUP BY c.id, s.created_at
ORDER BY c.created_at DESC
```

**2. `POST /practice/evaluate`** -- Evaluate a practice attempt

Request: multipart form with audio file + fields:
```
audio: File (m4a/wav)
correctionId: number
mode: 'say_it_right' | 'use_it_naturally'
```

Server pipeline:
1. Look up the correction by ID (verify it belongs to the user's session)
2. Transcribe the audio using the existing `transcribe()` function (Whisper)
3. Call Claude to evaluate the attempt (see AI evaluation section below)
4. Save a `practice_attempts` row
5. Return the result

Response:
```json
{
  "passed": true,
  "transcript": "I went to the store yesterday.",
  "feedback": "Your sentence matched the target closely. Clear past tense usage.",
  "attemptId": 15
}
```

**3. `GET /practice/scenario`** -- Generate a scenario prompt for "Use It Naturally" mode

Request: `?correctionId=42`

This is a separate endpoint because the scenario needs to be generated before the user records. It calls Claude with the correction context and asks for a scenario prompt.

Response:
```json
{
  "scenario": "Tell me about something you did last weekend."
}
```

This could be folded into the tasks list endpoint (pre-generate scenarios), but that would mean calling Claude for every correction on every list load. Better to generate on-demand when the user actually opens a task in "Use It Naturally" mode.

### AI evaluation prompts

**New file: `server/src/services/practice-evaluator.ts`**

**"Say It Right" evaluation prompt:**

```
You are evaluating a non-native English speaker's practice attempt.

They were asked to say this sentence:
TARGET: "{correctedText}"

They actually said:
SPOKEN: "{transcript}"

Their original mistake was: "{originalText}" -> "{correctedText}"
The correction type was: {correctionType}

Evaluate whether they successfully said the target sentence. Be lenient with:
- Minor word order variations that don't change meaning
- Synonyms that are equally natural
- Added/removed filler words (um, uh)
- Slight differences in articles or pronouns if the core correction was about something else

Be strict about:
- The specific correction they were practicing (if the correction was about verb tense, the verb tense must be correct)
- Meaning-changing differences

Return JSON only:
{
  "passed": true/false,
  "feedback": "1-2 sentences. If passed: acknowledge what they got right. If failed: explain specifically what was wrong and what the correct version is. Be direct, not congratulatory. Match the Dr. Aris persona -- precise and expert."
}
```

**"Use It Naturally" evaluation prompt:**

```
You are evaluating a non-native English speaker's practice attempt.

They made this mistake in a previous session:
ORIGINAL: "{originalText}"
CORRECTED: "{correctedText}"
RULE: "{explanation}"
CORRECTION TYPE: {correctionType}

They were given this scenario:
SCENARIO: "{scenario}"

They said:
SPOKEN: "{transcript}"

Evaluate whether they correctly applied the grammar rule from the correction in their new sentence. The sentence does NOT need to match the original correction -- it's a new sentence in a new context. Evaluate whether:
1. They produced a grammatically correct sentence
2. The sentence is relevant to the scenario
3. The specific grammar pattern from the correction type is used correctly (e.g., if correctionType is "verb_tense", check that verb tenses are correct)

Return JSON only:
{
  "passed": true/false,
  "feedback": "1-2 sentences. If passed: note what they did well with the specific grammar point. If failed: explain what went wrong with the specific grammar pattern they were practicing. Be direct, precise, Dr. Aris tone."
}
```

**Scenario generation prompt (for `GET /practice/scenario`):**

```
Generate a simple conversational scenario that would naturally require a non-native English speaker to use this grammar pattern:

CORRECTION TYPE: {correctionType}
EXAMPLE: "{originalText}" -> "{correctedText}"
RULE: "{explanation}"

The scenario should be:
- One sentence, casual, like a conversation starter
- Naturally elicit a response that MUST use the grammar pattern
- Grounded in everyday situations (work, daily life, social)
- NOT a grammar exercise instruction ("use the past tense to...") -- it should feel like a natural question

Examples of good scenarios:
- For verb_tense (past): "Tell me about something you did last weekend."
- For article usage: "Describe your workspace right now."
- For prepositions: "How do you usually get to work?"

Return ONLY the scenario text, no JSON, no quotes, no explanation.
```

### Model choice

Use `claude-sonnet-4-20250514` for practice evaluation and scenario generation. These are simple, fast tasks -- no need for Opus. Keeps latency low and cost down.

### Recording implementation on mobile

**New hook: `mobile/hooks/usePracticeRecording.ts`**

Simplified version of `useVoiceSession` -- no WebSocket, no TTS, no turn detection:

```
States: idle -> recording -> evaluating -> result

start(): request permissions, start ExpoPlayAudioStream recording (buffered, not streamed)
stop(): stop recording, get audio data, POST to /practice/evaluate
```

The hook buffers audio chunks locally (unlike voice sessions which stream them). When recording stops, it concatenates the chunks into a single audio buffer and POSTs it as a multipart form.

Returns: `{ state, elapsedSeconds, result, start, stop, reset }`

### Files affected

**New files:**
- `server/src/routes/practice.ts` -- practice API routes (tasks list, evaluate, scenario)
- `server/src/services/practice-evaluator.ts` -- AI evaluation + scenario generation
- `mobile/app/practice-session.tsx` -- Practice Screen (drill UI)
- `mobile/hooks/usePracticeRecording.ts` -- recording + evaluation hook
- `mobile/hooks/usePracticeTasks.ts` -- React Query hook for `GET /practice/tasks`
- `mobile/components/PracticeTaskCard.tsx` -- compact task card for the list
- `mobile/types/practice.ts` -- TypeScript types for practice data

**Modified files:**
- `server/src/db/schema.ts` -- add `practiceAttempts` table
- `server/src/index.ts` -- register practice routes
- `mobile/app/(tabs)/practice.tsx` -- replace placeholder with task list UI
- `mobile/app/(tabs)/_layout.tsx` -- no changes needed (practice tab already exists)
- `mobile/app/_layout.tsx` -- register `practice-session` stack screen
- `mobile/components/CorrectionCard.tsx` -- add Practice button + accept `id` prop

**Migration:** One new table (`practice_attempts`), no changes to existing tables.

---

## Detailed Implementation Steps

### Step 1: Database schema + migration

1. Add `practiceAttempts` table to `server/src/db/schema.ts`
2. Run `npx drizzle-kit generate` to create migration
3. Run `npx drizzle-kit migrate` to apply

### Step 2: Practice evaluator service

1. Create `server/src/services/practice-evaluator.ts`
2. Implement `evaluateSayItRight(correction, transcript)` -- calls Claude Sonnet with the "Say It Right" prompt, returns `{ passed, feedback }`
3. Implement `evaluateUseItNaturally(correction, transcript, scenario)` -- calls Claude Sonnet with the "Use It Naturally" prompt, returns `{ passed, feedback }`
4. Implement `generateScenario(correction)` -- calls Claude Sonnet with the scenario generation prompt, returns scenario string
5. All three functions handle Claude response parsing with fallbacks (if JSON parse fails, default to `passed: false` with generic feedback)

### Step 3: Practice API routes

1. Create `server/src/routes/practice.ts`
2. Implement `GET /practice/tasks`:
   - Query corrections joined with sessions (for user_id filter) and left-joined with practice_attempts
   - Group by correction, compute `practiced` (BOOL_OR of passed), `practiceCount`, `lastPracticedAt`
   - Return sorted by `corrections.created_at DESC`
3. Implement `POST /practice/evaluate`:
   - Accept multipart: audio file + correctionId + mode (+ scenario for use_it_naturally)
   - Validate correction belongs to user
   - Transcribe audio using existing `transcribe()` from `services/transcription.ts`
   - Call appropriate evaluator function based on mode
   - Insert `practice_attempts` row
   - Return result
4. Implement `GET /practice/scenario?correctionId=N`:
   - Validate correction belongs to user
   - Call `generateScenario()`
   - Return `{ scenario }`
5. Register routes in `server/src/index.ts`

### Step 4: Mobile types + API hooks

1. Create `mobile/types/practice.ts` with `PracticeTask` and `PracticeResult` types
2. Create `mobile/hooks/usePracticeTasks.ts` -- React Query hook wrapping `GET /practice/tasks`
3. Create `mobile/hooks/usePracticeRecording.ts`:
   - State machine: idle -> recording -> evaluating -> result
   - `start()`: request mic permission, start buffered recording
   - `stop()`: stop recording, collect audio buffer, POST to `/practice/evaluate`, set result
   - `reset()`: return to idle state
   - Track elapsed seconds with setInterval
   - 15-second max duration auto-stop
   - Returns `{ state, elapsedSeconds, result, start, stop, reset }`

### Step 5: Practice tab list screen

1. Rewrite `mobile/app/(tabs)/practice.tsx`:
   - Use `usePracticeTasks` hook to fetch tasks
   - `ScreenHeader variant="large" title="Practice"`
   - `CorrectionFilterChips` at top (reuse existing component)
   - "To Practice" section with `PracticeTaskCard` components
   - "Practiced" section, collapsed by default
   - Empty states as described above
   - Tapping a task card navigates to `/practice-session?correctionId=X&fromList=true`
2. Create `mobile/components/PracticeTaskCard.tsx`:
   - Compact card showing severity indicator, correction type, original/corrected text, relative date
   - "Practice" pill button on the right
   - Dimmed styling for "Practiced" section cards (to visually distinguish)

### Step 6: Practice Screen

1. Create `mobile/app/practice-session.tsx`:
   - Route params: correctionId, mode, fromList
   - Fetch correction data (from the tasks list cache or a direct fetch)
   - Mode toggle at top (Say It Right / Use It Naturally)
   - Phase 1 (Prompt): show correction context + record button
   - Phase 2 (Recording): record button becomes stop button, timer, dimmed card
   - Phase 3 (Result): pass/fail UI with feedback, navigation buttons
   - For "Use It Naturally": fetch scenario from `GET /practice/scenario` when entering this mode
   - Cache the scenario so switching back and forth between modes doesn't regenerate it
2. Register screen in `mobile/app/_layout.tsx`

### Step 7: CorrectionCard "Practice" button

1. Add `id` prop to `CorrectionCardProps` interface
2. Pass `c.id` from `session-detail.tsx` when rendering CorrectionCards
3. Add "Practice" pill button to the bottom row of CorrectionCard, next to "Tap to hear"
4. Button navigates to `/practice-session?correctionId=X`

---

## Edge Cases & Error Handling

### Recording edge cases
- **User says nothing (silence):** Whisper returns empty text. Treat as `passed: false` with feedback "No speech detected. Try again."
- **Recording too short (<1 second):** Auto-discard, show a brief toast "Hold to record", don't submit to server
- **User speaks multiple sentences:** The AI evaluation handles this gracefully -- it evaluates whatever was said. No client-side enforcement of "one sentence only."
- **Microphone permission denied:** Same handling as voice sessions -- show error, return to prompt phase
- **15-second auto-stop:** Recording stops, submits what was captured. Brief toast: "Recording limit reached."

### Network/AI edge cases
- **Transcription fails:** Return `passed: false`, feedback "Could not process audio. Try recording again." Do not save a practice_attempts row.
- **AI evaluation fails (Claude error or unparseable response):** Default to `passed: false`, feedback "Evaluation unavailable. Try again." Do not save a practice_attempts row. This prevents false completions from counting.
- **Scenario generation fails:** Return a hardcoded fallback: "Describe something that happened to you recently." Log the error server-side.
- **Slow network:** The "Evaluating..." state has no timeout on the client. The server endpoint should have a 30-second timeout. If the request fails, show an error state with a "Try Again" button that resets to Phase 1.

### Data edge cases
- **Correction deleted (session deleted):** The `ON DELETE CASCADE` on `practice_attempts.correction_id` handles cleanup. If a correction is deleted while the user is on the Practice Screen, the evaluation endpoint returns 404, and the client shows "This correction is no longer available" and navigates back.
- **User has hundreds of corrections:** The tasks endpoint returns all of them, but the UI caps visible items at 20 with "Show more." React Query handles caching. No pagination needed for MVP -- even 500 corrections is a small payload.
- **Same correction practiced in both modes:** Both attempts are recorded with their respective mode. A correction is "practiced" if ANY attempt passed, regardless of mode.

---

## Testing Considerations

### Server
- Practice evaluator unit tests: mock Claude responses, verify pass/fail logic, verify fallbacks on parse errors
- Practice routes integration tests: create a session with corrections, fetch tasks, submit an attempt, verify practice_attempts row created, verify tasks endpoint reflects new state
- Scenario generation: verify fallback when Claude returns non-text

### Mobile
- Practice tab: renders empty state when no corrections, renders task list when corrections exist, filter chips work
- Practice Screen: mode toggle switches UI, recording starts/stops, result phase shows correct UI for pass/fail
- Navigation: Session Detail -> Practice -> back returns to Session Detail. Practice tab -> Practice -> Next advances to next task. Practice tab -> Practice -> Done returns to list.
- usePracticeRecording: state transitions (idle -> recording -> evaluating -> result -> idle on reset), auto-stop at 15 seconds, handles errors

### Manual QA scenarios
1. Complete a voice session with 3+ corrections, verify they appear in Practice tab
2. Practice one correction ("Say It Right"), pass it, verify it moves to "Practiced" section
3. Practice one correction, fail it, retry, pass it on second attempt
4. Open "Use It Naturally" mode, verify scenario loads, record and submit
5. Practice from Session Detail "Practice" button, verify "Done" returns to session detail
6. Re-practice a completed task from the "Practiced" section

---

## Open Questions

1. **Audio format for upload:** The existing session upload uses m4a. `ExpoPlayAudioStream` in buffered mode may produce raw PCM. Need to verify what format the buffered recording outputs and whether Whisper accepts it directly or if we need to wrap it (the transcription service already handles m4a via ffmpeg). If raw PCM, may need to encode to m4a on the client before uploading, or use ffmpeg on the server to convert.

2. **Scenario caching:** Should generated scenarios be persisted in the DB (e.g., a `scenarios` column on corrections, or a separate table) so the same correction always gets the same scenario? For MVP, no -- generate fresh each time, cache only in-memory on the client during the session. Reconsider if users report inconsistency or if Claude costs become a concern.

3. **"Use It Naturally" with multiple valid sentence structures:** The AI evaluation prompt is intentionally lenient -- it checks for the grammar pattern, not an exact sentence. But edge cases will exist where the user produces a valid sentence that doesn't actually exercise the target pattern (e.g., they avoid the grammar construct entirely). The prompt addresses this ("the specific grammar pattern from the correction type is used correctly"), but real-world testing will reveal if the prompt needs refinement.
