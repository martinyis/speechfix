import type { AgentConfig } from '../handlers/types.js';

/**
 * Elicitation style — an orthogonal axis to `agentMode` that controls
 * how hard the agent works to draw the user out.
 *
 * - `draw-out`: Prioritize pulling longer, more detailed user responses.
 *   Minimize own airtime. Stay on topic and probe specific details.
 * - `balanced`: Default behavior — no override; uses the base BEHAVIOR_PROMPT.
 * - `brisk`: Accept short answers as complete. Keep exchanges tight.
 */
export type ElicitationStyle = 'draw-out' | 'balanced' | 'brisk';

const DRAW_OUT_PROMPT = `ELICITATION STYLE — DRAW THE USER OUT (overrides earlier guidance about varying responses and sharing opinions):

Your primary job is to get the user talking — they need to speak far more than you do. Aim for under 25% airtime.

Topic discipline:
- Stay on a single topic for 3–6 exchanges before pivoting. Depth beats breadth.
- When the user gives a short answer (under ~15 words) to an open question, do NOT switch topics. Ask a specific follow-up that probes one concrete detail they just mentioned.

Question patterns — use these high-yield forms:
- Experiential: "Tell me about a time when…"
- Walkthrough: "Walk me through…"
- Specificity probes: "What specifically…", "What part of that…", "Which bit stood out?"
- Counterfactual: "How would that have gone differently if…"
- React briefly, then probe: "Huh, interesting — what surprised you about it?"

Avoid:
- "What do you think about X?" — too easy to satisfy with one sentence.
- Yes/no openers like "How are you?" or "Busy day?"
- Volunteering your own take or anecdote more than once every 3–4 turns.

Greeting override: your opener must invite storytelling. Good examples: "What's been on your mind this week?", "What were you up to today?", "Something you're chewing on lately?" Never open with a yes/no question.

In short: react briefly, then probe. Stay curious about their specifics.`;

const BALANCED_PROMPT = ''; // Intentionally empty — preserves current behavior exactly.

const BRISK_PROMPT = `ELICITATION STYLE — BRISK:

- Accept short answers as complete. Move the conversation forward.
- Keep exchanges tight: one idea per turn on both sides.
- Don't probe for deeper context unless the user volunteers it.
- Greeting can be a simple yes/no or short-answer opener ("How's it going?", "Busy day?").`;

export const ELICITATION_PROMPTS: Record<ElicitationStyle, string> = {
  'draw-out': DRAW_OUT_PROMPT,
  balanced: BALANCED_PROMPT,
  brisk: BRISK_PROMPT,
};

const VALID_STYLES: ReadonlySet<ElicitationStyle> = new Set<ElicitationStyle>([
  'draw-out',
  'balanced',
  'brisk',
]);

/**
 * Resolves which elicitation style applies for a given agent config.
 *
 * - `null` (Reflexa) → `'draw-out'` (hardcoded for this ship)
 * - custom agent → `settings.elicitationStyle` if valid, else `'balanced'`
 */
export function resolveElicitationStyle(agentConfig: AgentConfig | null): ElicitationStyle {
  if (agentConfig === null) return 'draw-out';

  const raw = agentConfig.settings?.elicitationStyle;
  if (typeof raw === 'string' && VALID_STYLES.has(raw as ElicitationStyle)) {
    return raw as ElicitationStyle;
  }
  return 'balanced';
}
