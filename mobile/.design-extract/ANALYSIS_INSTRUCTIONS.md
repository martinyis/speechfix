# Bug Analysis Instructions

Read every frame image in this directory. The frames are in temporal order — frame-001 is the earliest, the last frame is the final state. Analyze the recording as a sequence of events showing a bug or broken behavior.

## What is happening
- Describe the sequence of events shown across the frames, step by step.
- What is the user trying to do? What flow or feature is being exercised?
- What screen/page/component is involved?

## What looks wrong
- Identify the specific frame(s) where the problem is visible.
- Describe exactly what appears broken, glitched, or unexpected.
- Is it a visual bug (layout broken, element misplaced, wrong color/text), a functional bug (wrong state, missing data, incorrect behavior), or both?

## Expected vs actual behavior
- What should the UI look like or do at the point of failure?
- What is it actually showing or doing instead?
- Is the bug intermittent (visible in some frames but not others) or persistent?

## Likely cause
- Based on what you see, what is the most probable root cause?
- Is this a CSS/layout issue, a state management problem, a data issue, a race condition, a missing error handler, etc.?
- Which component(s) or code area(s) are likely involved?

## Suggested fixes
- Propose specific code changes to fix the bug.
- If multiple possible causes exist, list them in order of likelihood.
- Include any edge cases that should be tested after the fix.

---

Focus on being diagnostic and actionable. The goal is to identify the bug and fix it, not to analyze the design.
