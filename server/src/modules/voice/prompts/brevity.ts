/**
 * Brevity prompt fragments + runtime constants + direct-question detector.
 *
 * These sit at the END of each handler's system-prompt layer list so they are
 * the most-recent instruction the model sees, which LLMs weight most heavily.
 * Token caps and server-side word-count truncation in `response-generator.ts`
 * provide a belt-and-suspenders guarantee if the model still misbehaves.
 */

// ---------------------------------------------------------------------------
// Word budgets (target: what the prompt asks the model to aim at).
// ---------------------------------------------------------------------------
export const DEFAULT_MAX_WORDS = 15;
export const QUESTION_MAX_WORDS = 25;
export const ROLEPLAY_MAX_WORDS = 25;
export const ROLEPLAY_QUESTION_MAX_WORDS = 40;
export const GREETING_MAX_WORDS = 15;
export const FAREWELL_MAX_WORDS = 10;

// ---------------------------------------------------------------------------
// Server-side truncation caps (slightly above the target so the model has a
// little slack before the guillotine; these are the hard backstops).
// ---------------------------------------------------------------------------
export const DEFAULT_TRUNCATE_WORDS = 20;
export const QUESTION_TRUNCATE_WORDS = 30;
export const ROLEPLAY_TRUNCATE_WORDS = 28;
export const ROLEPLAY_QUESTION_TRUNCATE_WORDS = 44;

// ---------------------------------------------------------------------------
// "Never start with" ban list — exported so tests / future prompts can use it.
// ---------------------------------------------------------------------------
export const NEVER_START_WITH_LIST = [
  'It sounds like…',
  'I hear you saying…',
  'So what you\'re saying is…',
  'That\'s really interesting',
  'That\'s a great point',
  'That makes a lot of sense',
  'I can see why…',
  'Oh wow, that\'s…',
];

// ---------------------------------------------------------------------------
// Prompt fragments.
// ---------------------------------------------------------------------------

export const BREVITY_PROMPT_DEFAULT = `BREVITY WITH PURPOSE — THIS OVERRIDES EARLIER LENGTH GUIDANCE:

Your job: keep the USER talking. You speak little, but conversationally — you're a coach, not an interrogator.

YOUR TURN FORMAT:
- One idea per turn. Default is one short sentence (≤ 15 words).
- Adapt to the user: if they've been short, probe one concrete detail they mentioned; if they've been long, react briefly ("yeah, that's wild", "huh") and hand the turn back — don't pile on another question.
- NOT a pure filler like "Mhm." or "Go on." alone — always give them something to latch onto.
- NOT a monologue, anecdote, speech, or two-part answer.

Only expand when the user asked you a direct question ("what do you think?", "do you know X?", "have you ever…?"). Even then: ONE sentence, 25 words max, then hand the turn back.

You do NOT need to acknowledge what the user said before probing. A probe can be the acknowledgment.

NEVER START A RESPONSE WITH:
- "It sounds like…"
- "I hear you saying…"
- "So what you're saying is…"
- "That's really interesting"
- "That's a great point"
- "That makes a lot of sense"
- "I can see why…"
- "Oh wow, that's…"
- Any sentence that paraphrases the user back at them.

Never paraphrase the user. Never list. Never give two ideas in one turn.`;

export const BREVITY_PROMPT_ROLEPLAY = `BREVITY — THIS OVERRIDES EARLIER LENGTH GUIDANCE:

Default turn: 1 sentence, 25 words max. One thought per turn. No matter how tempted your character would be to monologue, don't.

Only when the user asks you a direct question (e.g. "what's the salary range?", "do you have any experience with…?", "what are your hours?"), you may answer in up to 2 sentences, 40 words max, still in character. Then hand the turn back.

Never paraphrase what the user just said before responding. React as your character would, then hand the turn back.

OUTPUT IS SPOKEN ALOUD VERBATIM BY A VOICE SYNTHESIZER — CRITICAL:
- NEVER write stage directions, parentheticals, or asterisked actions. No "*laughs*", "*sighs*", "*smiles*", "(takes a sip)", "(leans forward)", "(pauses)", italics, asterisks, or any markdown emphasis.
- Non-verbal cues cannot be heard — they'll be read aloud as the literal words "asterisk laughs asterisk". If your character would laugh, type it as speech ("ha.", "haha.") — not as a stage direction.
- Output ONLY the words your character speaks. Nothing else.

NEVER START A RESPONSE WITH:
- "It sounds like…"
- "I hear you saying…"
- "So what you're saying is…"
- Any sentence that paraphrases the user back at them.

Sub-sentence reactions ("Hm.", "Go on.", "Interesting.") are fine if your character would use them.`;

// ---------------------------------------------------------------------------
// Direct-question detector.
// ---------------------------------------------------------------------------

/**
 * Returns true if the given user message looks like a direct question that
 * the assistant should answer (rather than just react to with a ≤ 8-word
 * beat). A dumb regex — false positives bump the cap from ~25 → 60 tokens,
 * false negatives leave the server-side word-count truncator as the backstop.
 */
export function isDirectQuestionTurn(lastUserMessage: string | undefined): boolean {
  if (!lastUserMessage) return false;
  const msg = lastUserMessage.trim().toLowerCase();
  if (!msg) return false;

  // 1. Contains a question mark.
  if (msg.includes('?')) return true;

  // 2. Wh-word opener.
  if (/^(what|why|how|when|where|who|which|whose|whom)\b/.test(msg)) return true;

  // 3. Yes/no inversion openers.
  if (/^(do|does|did|is|are|was|were|can|could|would|will|should|have|has|had|may|might)\b/.test(msg)) return true;

  // 4. Explicit opinion / input asks.
  const opinionAsks = [
    'what do you think',
    'your opinion',
    'your take',
    'what would you',
    'how would you',
    'do you think',
    'any thoughts',
    'your thoughts',
    'what about you',
    'how about you',
    'you ever',
    'have you ever',
  ];
  for (const phrase of opinionAsks) {
    if (msg.includes(phrase)) return true;
  }

  return false;
}
