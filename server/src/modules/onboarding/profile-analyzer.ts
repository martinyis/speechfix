import Anthropic from '@anthropic-ai/sdk';
import { SPEECH_SIGNALS_VERSION, type SpeechSignals } from '../practice/modes/types.js';

const anthropic = new Anthropic();

const MIN_USER_WORDS = 30;

export type AnalyzeResult =
  | { ok: true; signals: SpeechSignals }
  | { ok: false; reason: 'too_short' | 'llm_error' | 'bad_json' | 'no_user_turns' };

const SYSTEM_PROMPT = `You classify a user's English speech from a short voice onboarding conversation. Your output drives which practice modes we enable for them — not corrections, not advice.

You must separate TWO things that look similar but are different:

1. **Native informal register** — NOT errors. Examples:
   - "me and my buddy went"
   - "ain't nobody got time"
   - "gonna", "wanna", "gotta", "y'all"
   - "I ain't seen him"
   - dropped copula ("she cool")
   - double negatives in casual speech
   - ending a sentence with a preposition
   - fragments ("Yeah totally.")
   These are how native speakers of American / British / Australian / Irish English actually speak. DO NOT count them as grammar errors.

2. **Non-native grammar errors** — count these. Examples:
   - article misuse ("I go to hospital every Monday", "I want buy the bread")
   - subject-verb disagreement not typical of native informal speech ("he don't has", "they was went")
   - tense misuse ("I work here since five years", "yesterday I am going")
   - preposition errors ("I am good in English", "depend of")
   - word-order errors ("I know not what to do")
   - missing plural-s where required by context
   - missing copula from a non-native pattern ("he engineer", "she very tired" in a non-native accent / register)
   - literal translations that break idiom

The decision rule you should internalise: if an American speaker could plausibly say the same thing in casual conversation without sounding wrong, it's NOT a grammar error.

Filler words to count: um, uh, er, like (as filler, not simile), you know, sort of, kind of, basically, actually (as filler), so (as opener), well (as opener), I mean, right (as tag), actually, literally (as filler).

Return a strict JSON object with these fields and NOTHING else:

{
  "nativeSpeakerConfidence": <number 0..1>,
  "grammarErrorCount": <integer>,
  "fillerWordCount": <integer>,
  "reasoning": "<one sentence explaining the call>"
}

Scoring guide for nativeSpeakerConfidence:
- 0.9–1.0: clearly native (accent + idiom + natural register)
- 0.7–0.9: likely native — few if any non-native patterns
- 0.4–0.7: ambiguous / advanced non-native speaker
- 0.2–0.4: clearly non-native with intact grammar
- 0.0–0.2: clearly non-native with grammar errors

Return ONLY the JSON. No markdown, no commentary, no code fences.`;

export async function analyzeOnboardingProfile(
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
): Promise<AnalyzeResult> {
  const userTurns = conversationHistory.filter((m) => m.role === 'user');
  if (userTurns.length === 0) return { ok: false, reason: 'no_user_turns' };

  const userText = userTurns.map((m) => m.content).join(' ');
  const userWordCount = userText.trim().split(/\s+/).filter(Boolean).length;
  if (userWordCount < MIN_USER_WORDS) return { ok: false, reason: 'too_short' };

  let prompt = 'ONBOARDING CONVERSATION (only user turns matter for classification; AI turns given for context):\n';
  for (const msg of conversationHistory) {
    const label = msg.role === 'assistant' ? 'AI' : 'USER';
    prompt += `[${label}]: ${msg.content}\n`;
  }

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') return { ok: false, reason: 'bad_json' };

    let jsonText = textBlock.text.trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }

    const parsed = JSON.parse(jsonText);

    const nativeSpeakerConfidence = clamp01(toNumber(parsed.nativeSpeakerConfidence));
    const grammarErrorCount = toNonNegInt(parsed.grammarErrorCount);
    const fillerWordCount = toNonNegInt(parsed.fillerWordCount);
    const reasoning = typeof parsed.reasoning === 'string' ? parsed.reasoning.slice(0, 500) : undefined;

    if (nativeSpeakerConfidence == null || grammarErrorCount == null || fillerWordCount == null) {
      return { ok: false, reason: 'bad_json' };
    }

    return {
      ok: true,
      signals: {
        nativeSpeakerConfidence,
        grammarErrorCount,
        fillerWordCount,
        userWordCount,
        reasoning,
        version: SPEECH_SIGNALS_VERSION,
      },
    };
  } catch (err) {
    console.error('[onboarding-profile-analyzer] LLM call failed:', err);
    return { ok: false, reason: 'llm_error' };
  }
}

function toNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function clamp01(n: number | null): number | null {
  if (n == null) return null;
  return Math.max(0, Math.min(1, n));
}

function toNonNegInt(v: unknown): number | null {
  const n = toNumber(v);
  if (n == null) return null;
  return Math.max(0, Math.round(n));
}
