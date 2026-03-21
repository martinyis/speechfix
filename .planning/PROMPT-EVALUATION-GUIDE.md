# Speech Analysis Prompt — Evaluation Guide

How to evaluate the quality of the speech analysis prompt in `server/src/services/analysis.ts`. Use this guide after running test sessions and collecting server logs.

## What You Need

Server logs containing:
- The transcribed sentences (what the user said)
- The corrections the AI returned (JSON output)
- Filler words detected
- Session insights

Look for `[DEBUG-ANALYSIS]` lines in server output. The "User message" block shows the input sentences. The "RAW CLAUDE RESPONSE" block shows the full JSON output.

## Evaluation Process

### Step 1: Independent Error Analysis

Before looking at the AI's output, read each sentence yourself and list every issue you can find:
- Grammar errors (missing articles, wrong tense, broken agreement, missing words)
- Unnatural phrasing (literal translations, wrong collocations, awkward structure)
- Fluency issues (correct but a native speaker would phrase it differently)
- Filler words used as verbal pauses
- Patterns across multiple sentences

### Step 2: Compare Against AI Output

Check what the AI caught, what it missed, and what it flagged incorrectly.

## Scoring Dimensions

### 1. Completeness (weight: highest)

**What:** Did the AI catch every real error?

- Read each sentence and identify every grammar mistake, unnatural phrasing, and structural issue
- Compare your list against the AI's corrections
- Report every MISSED error with the sentence, what's wrong, and what the fix should be

**Scoring:**
- 10/10: Zero missed errors
- 9/10: Missed only borderline/polish-level issues
- 8/10: Missed 1-2 clear improvement-level issues
- 7/10: Missed 1+ error-level issues
- 6/10 or below: Multiple real errors missed

**This is the most important metric.** The prompt was specifically rewritten to be more exhaustive. If it's still missing errors, the prompt needs work.

### 2. Accuracy

**What:** Are the flagged corrections actually correct?

- Is the suggested fix natural American English?
- Is the explanation helpful and linguistically accurate?
- Are there FALSE POSITIVES (things flagged that are actually fine)?

**Scoring:**
- 10/10: All corrections correct, zero false positives
- 9/10: All corrections correct, 1 borderline false positive
- 8/10: 1 incorrect correction or 2+ borderline false positives
- 7/10 or below: Multiple incorrect corrections

**Watch for:**
- Self-corrections flagged as errors (speaker caught it themselves — should be skipped)
- Casual American English flagged as errors ("gonna", "wanna", fragments)
- Transcription artifacts flagged as grammar errors (garbled text that isn't what the speaker actually said)

### 3. Severity Calibration

**What:** Is each correction assigned to the right tier?

The three tiers:
- **error** = grammatically wrong, a native speaker would notice it's incorrect
- **improvement** = grammatically acceptable but sounds non-native ("that's a weird way to say it")
- **polish** = correct and understandable, but a native speaker would phrase it differently

**Scoring:**
- 10/10: All severities correctly assigned
- 9/10: 1 borderline misclassification (e.g., improvement vs polish)
- 8/10: 1 clear misclassification (e.g., error classified as polish)
- 7/10 or below: Multiple misclassifications

**Common miscalibrations to watch for:**
- Missing articles/words classified as "improvement" when they should be "error"
- Wrong collocations classified as "error" when they should be "improvement" (meaning is clear)
- Word order tweaks classified as "improvement" when they should be "polish"

### 4. Filler Word Accuracy

**What:** Are filler words detected correctly?

**Check for false positives:**
- "like" used as a verb, comparison, or approximation (not filler)
- "so" used causally ("so that") or for degree ("so much") — not filler
- "actually" used contrastively ("I actually prefer X") — not filler
- "you know" used literally — not filler
- "right" used as adjective or genuine confirmation — not filler

**Check for missed fillers:**
- "um", "uh" not counted
- Obvious filler "like" or "you know" missed

**Scoring:**
- 10/10: All filler detections correct, no misses
- 9/10: 1 borderline false positive
- 8/10: 2+ borderline false positives or 1 clear false positive
- 7/10: Multiple clear false positives or missed obvious fillers

**Tip:** The prompt says "be conservative — when in doubt, do NOT count it as a filler." If the model is over-counting, the prompt's filler section may need stronger examples of what NOT to count.

### 5. Session Insights

**What:** Are pattern insights accurate and useful?

- Do the reported patterns actually appear 3+ times in the speech?
- Are the descriptions actionable?
- Is the insight type correct (repetitive_word vs hedging_pattern vs discourse_pattern)?
- Is the array correctly empty when there are too few sentences or no clear patterns?

**Scoring:**
- 10/10: All insights accurate, actionable, correctly typed
- 9/10: Insights present and accurate but could be more specific
- 8/10: 1 insight is a stretch (pattern appears fewer than 3 times)
- 7/10: Fabricated pattern or missing an obvious one

## Report Format

Structure your evaluation report like this:

```
# Session [N] Evaluation

## Independent Error Analysis
[Your own analysis of each sentence — list every issue you found]

## Corrections Assessment
- Correct detections: [list with brief note on each]
- Missed errors: [list with sentence, what's wrong, suggested fix, expected severity]
- False positives: [list with why it's not actually an error]
- Severity misclassifications: [list with current vs correct severity]

## Filler Word Assessment
[Note any false positives or misses with reasoning]

## Session Insights Assessment
[Verify patterns are real and appear 3+ times]

## Scores
- Completeness: X/10
- Accuracy: X/10
- Severity Calibration: X/10
- Filler Word Accuracy: X/10
- Session Insights: X/10
```

## Tips for Evaluators

1. **Do your own analysis first.** Don't read the AI output before forming your own opinion. This prevents anchoring bias.

2. **Transcription errors are tricky.** When a word looks wrong but could be a transcription artifact (e.g., "pausing" when the user said "posting"), the AI should either skip it (garbled) or flag it with a note about possible transcription error. It should NOT confidently correct a grammar "mistake" that the speaker didn't actually make.

3. **Context matters.** In conversation mode, the AI has context from the conversation partner. Check whether it uses that context appropriately to understand intent.

4. **Casual speech is not an error.** "gonna", "wanna", fragments, run-ons, starting with "So" or "But" — these are all normal American spoken English. If the AI flags them, that's a false positive.

5. **Self-corrections should be skipped.** If the speaker says "he's — I mean it's", they caught it. The AI should not flag this.

6. **More test sessions = better signal.** A single session can be fluky. Evaluate across 3+ sessions before drawing conclusions about prompt quality.

7. **Watch the explanation quality.** Explanations should be blunt, practical, max 25 words. They should tell the user WHY something sounds wrong, not just what to say instead. Good explanations mention what a native speaker would think or say.

8. **The strictness target is 85/100.** The prompt is calibrated to be strict — it should flag anything that sounds noticeably non-native. If it's letting too many things through, the strictness instruction isn't working. If it's flagging perfectly natural casual speech, it's too strict.
