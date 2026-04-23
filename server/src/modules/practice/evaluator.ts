import Groq from 'groq-sdk';

const groq = new Groq();
const MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';

export interface CorrectionContext {
  originalText: string;
  correctedText: string;
  explanation: string | null;
  correctionType: string;
}

export interface EvaluationResult {
  passed: boolean;
  feedback: string;
}

export async function evaluateSayItRight(
  correction: CorrectionContext,
  transcript: string,
): Promise<EvaluationResult> {
  const systemPrompt = `You are an expert English language evaluator. You evaluate practice attempts from speakers of any level and return JSON results.

RULES:
- Return ONLY valid JSON: {"passed": true/false, "feedback": "1-2 sentences"}
- NEVER reveal the correct answer or reference text in feedback
- On pass: set feedback to an empty string
- On fail: hint at what's still wrong WITHOUT giving the answer (e.g., "The verb tense still isn't right — think about when this happened.")
- Be direct, precise, expert tone`;

  const userPrompt = `MODE: Generation — the user saw their original error but NOT the corrected version. They must figure out the correction themselves.

ORIGINAL (what they said wrong): "${correction.originalText}"
CORRECTION TYPE: ${correction.correctionType}
RULE: "${correction.explanation ?? ''}"

They said:
SPOKEN: "${transcript}"

REFERENCE (do NOT reveal this to the user): "${correction.correctedText}"

Evaluate whether they successfully corrected the specific ${correction.correctionType} error. Accept ANY valid correction that fixes the error type — the user does not need to match the reference exactly.

Pass if:
- The specific error type (${correction.correctionType}) is correctly fixed
- The sentence is grammatically correct and natural
- Minor variations, synonyms, or rephrasing are fine as long as the core error is resolved

Fail if:
- The original error still persists (same mistake repeated)
- A new error of the same type is introduced
- The sentence is unintelligible or completely off-topic`;

  return callGroq(systemPrompt, userPrompt);
}

export interface WeakSpotExerciseContext {
  originalText: string;
  correctedText: string;
  explanation: string | null;
  correctionType: string;
}

export async function evaluateWeakSpotExercise(
  exercise: WeakSpotExerciseContext,
  transcript: string,
): Promise<EvaluationResult> {
  const systemPrompt = `You are an expert English language evaluator. You evaluate practice attempts from speakers of any level and return JSON results.

RULES:
- Return ONLY valid JSON: {"passed": true/false, "feedback": "1-2 sentences"}
- NEVER reveal the corrected reference text in feedback
- On pass: set feedback to an empty string
- On fail: name the specific word or phrase the speaker got wrong (e.g., "You're still missing 'to' before 'understand'.", "'goed' isn't right — think about the past-tense form.") — be concrete, never generic
- Be direct, precise, expert tone`;

  const userPrompt = `The speaker was shown a sentence that intentionally contained a "${exercise.correctionType}" error and asked to say it the correct way.

ORIGINAL (the wrong version they saw): "${exercise.originalText}"
RULE: "${exercise.explanation ?? ''}"

They said:
SPOKEN: "${transcript}"

REFERENCE (do NOT reveal this to the user): "${exercise.correctedText}"

Evaluate whether they successfully fixed the specific ${exercise.correctionType} error. Accept ANY valid fix that resolves the error — the user does not need to match the reference exactly.

Pass if:
- The specific error described by RULE is correctly fixed
- The sentence is grammatically correct and natural
- The core meaning of the original is preserved
- Minor synonyms or rephrasings are fine as long as the target error is resolved

Fail if:
- The original error still persists (same mistake repeated)
- A new error of the same type is introduced
- The sentence is unintelligible or completely off-topic

On failure, your feedback MUST name the exact word or phrase that's still wrong (drawing from ORIGINAL and RULE) — do not say "restructure differently" or other vague hints.`;

  return callGroq(systemPrompt, userPrompt);
}

export interface PatternExerciseContext {
  originalSentence: string;
  targetWord: string;
  patternType: string;
  alternatives: string[];
}

export interface ReframeExerciseContext {
  originalSentence: string;
  patternType: string;
  highlightPhrases: string[];
}

export async function evaluatePatternExercise(
  exercise: PatternExerciseContext,
  transcript: string,
): Promise<EvaluationResult> {
  const systemPrompt = `You are an expert English language evaluator. You evaluate whether a speaker successfully avoided using a specific overused word or phrase. Return JSON results.

RULES:
- Return ONLY valid JSON: {"passed": true/false, "feedback": "1-2 sentences"}
- Be direct, precise, expert tone`;

  const userPrompt = `The speaker tends to overuse the word/phrase "${exercise.targetWord}" (pattern type: ${exercise.patternType}).

ORIGINAL SENTENCE (which contained the overused word): "${exercise.originalSentence}"

EXAMPLE ALTERNATIVES (for reference, the speaker does NOT need to match these exactly):
${exercise.alternatives.map((a, i) => `${i + 1}. "${a}"`).join('\n')}

They said:
SPOKEN: "${transcript}"

Evaluate whether:
1. The target word/phrase "${exercise.targetWord}" is ABSENT from their response (case-insensitive) — this is the primary criterion
2. Their sentence sounds natural and coherent
3. The original meaning is roughly preserved

Pass if ALL three criteria are met. The speaker can use any phrasing they want — they don't need to match the alternatives.

If passed: set feedback to an empty string.
If failed: explain what went wrong — did they still use "${exercise.targetWord}"? Was the sentence unnatural? Did it lose the original meaning?`;

  return callGroq(systemPrompt, userPrompt);
}

export async function evaluateReframeExercise(
  exercise: ReframeExerciseContext,
  transcript: string,
): Promise<EvaluationResult> {
  const typeLabel =
    exercise.patternType === 'hedging' ? 'hedging language'
    : 'negative framing';

  const systemPrompt = `You are an expert English language evaluator. You evaluate whether a speaker successfully reframed a sentence to remove ${typeLabel}. Return JSON results.

RULES:
- Return ONLY valid JSON: {"passed": true/false, "feedback": "1-2 sentences"}
- Be direct, precise, expert tone`;

  const userPrompt = `The speaker's original sentence contained ${typeLabel}:

ORIGINAL: "${exercise.originalSentence}"
PROBLEMATIC PHRASES: ${exercise.highlightPhrases.map((p) => `"${p}"`).join(', ')}

They were asked to reframe this sentence without the ${typeLabel}.

They said:
SPOKEN: "${transcript}"

Evaluate whether:
1. The problematic phrases (or close equivalents) are ABSENT — they shouldn't hedge, be noncommittal, or frame things negatively
2. The core meaning of the original sentence is preserved
3. The reframed sentence sounds natural and confident

Pass if ALL three criteria are met. The speaker can use any phrasing — they just need to convey the same idea without the ${typeLabel}.

If passed: set feedback to an empty string.
If failed: explain what's still wrong — did they keep hedging? Still noncommittal? Still framing negatively? Be specific.`;

  return callGroq(systemPrompt, userPrompt);
}

async function callGroq(systemPrompt: string, userPrompt: string): Promise<EvaluationResult> {
  try {
    const response = await groq.chat.completions.create({
      model: MODEL,
      max_tokens: 512,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    const text = response.choices[0]?.message?.content?.trim();
    console.log('[practice] Raw Groq response:', text);

    if (!text) {
      console.error('[practice] No text in Groq response');
      return { passed: false, feedback: 'Evaluation unavailable. Try again.' };
    }

    const parsed = JSON.parse(text);
    const passed = Boolean(parsed.passed);
    return {
      passed,
      feedback: passed ? '' : (parsed.feedback ?? ''),
    };
  } catch (err) {
    console.error('[practice] Failed to evaluate:', err);
    return { passed: false, feedback: 'Evaluation unavailable. Try again.' };
  }
}
