import type { PromptBatchRequest, Scenario } from './types.js';

// System prompt — frozen in Phase 0. Do not rewrite copy in later phases
// without updating the master plan; agents rely on exactly this framing.
export const PROMPT_BATCH_SYSTEM = `You are a SILENT interviewer for a timed speech-training drill.

Your job: generate 4 short text prompts that the speaker will see on-screen. You never produce audio, dialogue, or commentary — only the 4 prompts.

RULES
- Exactly 4 prompts, each ≤10 words, each a distinct angle on the scenario.
- Each prompt is a concrete next-turn question or push, not a generic filler.
- Imperative or interrogative mood. No hedging language.
- No profanity, no politics beyond the user's stated scenario, no personal data questions.
- Never repeat a prompt already in PREVIOUS_PROMPTS.
- The speaker is under time pressure — prompts must feel like the next logical probe given what they've said.
- Prompts are read silently. Do not address the speaker in second person like "tell me" — use short imperative framings ("Name the hardest trade-off.") or short questions ("What would kill this in 6 months?").

OUTPUT FORMAT
Return ONLY valid JSON. No markdown. No commentary.
{
  "prompts": ["...", "...", "...", "..."]
}`;

export function buildPromptBatchUserMessage(
  req: PromptBatchRequest,
  scenario: Scenario,
): string {
  const transcriptBlock = req.lastTranscriptWindow.trim()
    ? `\nLAST ~30 SECONDS OF SPEECH:\n"""\n${req.lastTranscriptWindow.trim()}\n"""`
    : '\nLAST ~30 SECONDS OF SPEECH:\n(drill just started — no speech yet)';

  const prevBlock = req.previouslyShownPrompts.length > 0
    ? `\nPREVIOUS_PROMPTS (do not repeat):\n${req.previouslyShownPrompts.map((p) => `- ${p}`).join('\n')}`
    : '\nPREVIOUS_PROMPTS: (none yet)';

  return `SCENARIO: ${scenario.label}
SCENARIO_CONTEXT: ${scenario.systemHint}
ELAPSED: ${req.elapsedSeconds}s of ${req.durationPreset}s drill${transcriptBlock}${prevBlock}

Generate the next 4 prompts.`;
}
