# Speech Analysis Prompt Changes

Summary of changes made to the SYSTEM_PROMPT in `server/src/services/analysis.ts` and all associated backend/frontend updates.

---

## 1. Language-Agnostic

**Before:** Prompt explicitly referenced Ukrainian as the speaker's native language and mentioned Ukrainian/Russian L1 interference patterns throughout.

**After:** All language-specific references removed. The prompt now says "non-native English speaker" without assuming any particular L1. This makes the app usable for speakers of any native language.

---

## 2. Strictness Parameter

**Before:** No explicit strictness level. The prompt said "precise, honest feedback" but had no calibrated scale.

**After:** Hardcoded strictness of 85/100 with a clear definition: "Flag all grammar errors AND anything that sounds noticeably non-native. Only skip things that are pure stylistic preference with no nativeness signal." This will become a dynamic user-configurable parameter in a future update.

---

## 3. Three-Tier Severity System

**Before:** Two tiers:
- `"error"` -- grammatically wrong
- `"suggestion"` -- grammatically acceptable but unnatural

**After:** Three tiers:
- `"error"` -- grammatically wrong. A native speaker would notice this is incorrect.
- `"improvement"` -- grammatically acceptable but sounds non-native. A native speaker would think "that's a weird way to say it."
- `"polish"` -- functional and understandable but could sound more fluent/natural. The difference between "good enough" and "sounds native."

**Why:** The old two-tier system lumped together "sounds foreign" and "could be slightly more natural" under one label. The new system gives users clearer signal about what to prioritize.

---

## 4. Exhaustive Error Detection

**Before:** The prompt said "Do NOT invent errors in clean speech" and was generally conservative.

**After:** The prompt now says "Be exhaustive. It is better to flag a borderline issue than to miss a real one." and "err on the side of flagging rather than skipping." The philosophy shifted from conservative to thorough -- missing a real error is considered worse than occasionally flagging a borderline case.

---

## 5. Smart Sentence vs Substring Corrections

**Before:** All corrections were substring-level with no guidance on full-sentence rewrites.

**After:** Explicit guidance:
- Most corrections target a specific substring within the sentence.
- If the ENTIRE sentence structure is broken, flag the whole sentence as one correction.
- Never double-flag: if a full-sentence rewrite is used, don't also flag individual parts of that sentence.
- When a sentence has multiple separate issues, flag each part separately.

---

## 6. Expanded Correction Categories

**Before:** correctionType values: `article|verb_tense|preposition|word_order|subject_verb_agreement|plural_singular|word_choice|sentence_structure|missing_word|naturalness|hedging|other`

**After:** Added new types: `collocation|redundancy|register|fluency` (in addition to all existing types).

New severity tier "polish" covers:
- Sentences that are correct but could sound more natural with minor restructuring
- Word choices that work but have a more common American alternative
- Phrasing that sounds like translated speech even if grammatically correct
- Unnecessarily complex structure when a simpler one exists

---

## 7. Explanation Style

**Before:** Max 15 words. Examples referenced Ukrainian specifically.

**After:** Max 25 words. Examples are language-agnostic. The prompt asks for a brief "why" -- what makes it sound foreign or what a native would say instead. The tone remains blunt and practical, not academic.

---

## 8. Reduced Redundancy

**Before:** Several rules appeared in multiple sections (e.g., self-corrections mentioned in both "what to flag" and "what not to flag", hedging guidance repeated).

**After:** Each instruction appears once. Sections are tighter with no duplicated examples or repeated rules.

---

## Associated Code Changes

### Backend
- **server/src/services/analysis.ts**: Correction interface severity updated to `'error' | 'improvement' | 'polish'`. Severity normalization accepts three values.
- **server/src/routes/sessions.ts**: GET /sessions endpoint counts `errorCount`, `improvementCount`, `polishCount` (replaced `suggestionCount`).
- **server/src/db/schema.ts**: No change needed -- severity is a `text` column.
- **server/src/voice/session-manager.ts**: No change needed -- passes severity as-is.

### Mobile
- **mobile/types/session.ts**: Updated `Correction.severity` type. Replaced `suggestionCount` with `improvementCount` and `polishCount` in `SessionListItem`.
- **mobile/components/CorrectionCard.tsx**: Three visual styles -- error (red #E53935), improvement (blue #1E88E5), polish (teal #26A69A).
- **mobile/components/SummaryBar.tsx**: Three-tier dots with dynamic rendering.
- **mobile/app/results.tsx**: Computes and passes three severity counts.
- **mobile/app/history-detail.tsx**: Same three-tier count updates.
- **mobile/app/(tabs)/history.tsx**: List items show all three tiers dynamically.
