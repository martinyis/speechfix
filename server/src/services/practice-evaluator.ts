import Groq from 'groq-sdk';
import { db } from '../db/index.js';
import { corrections } from '../db/schema.js';
import { eq, inArray } from 'drizzle-orm';

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
  const systemPrompt = `You are an expert English language evaluator for non-native speakers. You evaluate practice attempts and return JSON results.

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

export async function evaluateUseItNaturally(
  correction: CorrectionContext,
  transcript: string,
  scenario: string,
): Promise<EvaluationResult> {
  const systemPrompt = `You are an expert English language evaluator for non-native speakers. You evaluate practice attempts where users apply grammar rules in new contexts. Return JSON results.

RULES:
- Return ONLY valid JSON: {"passed": true/false, "feedback": "1-2 sentences"}
- If passed: set feedback to an empty string
- If failed: explain what went wrong with the specific grammar pattern they were practicing
- Be direct and precise`;

  const userPrompt = `They made this mistake in a previous session:
ORIGINAL: "${correction.originalText}"
CORRECTED: "${correction.correctedText}"
RULE: "${correction.explanation ?? ''}"
CORRECTION TYPE: ${correction.correctionType}

They were given this scenario:
SCENARIO: "${scenario}"

They said:
SPOKEN: "${transcript}"

Evaluate whether they correctly applied the grammar rule from the correction in their new sentence. The sentence does NOT need to match the original correction — it's a new sentence in a new context. Evaluate whether:
1. They produced a grammatically correct sentence
2. The sentence is relevant to the scenario
3. The specific grammar pattern from the correction type is used correctly (e.g., if correctionType is "verb_tense", check that verb tenses are correct)`;

  return callGroq(systemPrompt, userPrompt);
}

export async function generateScenario(
  correction: CorrectionContext,
): Promise<string> {
  const systemPrompt = `You generate simple conversational scenarios for English language practice. Return ONLY the scenario text — no JSON, no quotes, no explanation. One sentence only.`;

  const userPrompt = `Generate a simple conversational scenario that would naturally require a non-native English speaker to use this grammar pattern:

CORRECTION TYPE: ${correction.correctionType}
EXAMPLE: "${correction.originalText}" -> "${correction.correctedText}"
RULE: "${correction.explanation ?? ''}"

The scenario should be:
- One sentence, casual, like a conversation starter
- Naturally elicit a response that MUST use the grammar pattern
- Grounded in everyday situations (work, daily life, social)
- NOT a grammar exercise instruction ("use the past tense to...") — it should feel like a natural question

Examples of good scenarios:
- For verb_tense (past): "Tell me about something you did last weekend."
- For article usage: "Describe your workspace right now."
- For prepositions: "How do you usually get to work?"`;

  try {
    const response = await groq.chat.completions.create({
      model: MODEL,
      max_tokens: 256,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    const text = response.choices[0]?.message?.content?.trim();
    if (!text) {
      console.error('[practice] No text in scenario generation response');
      return 'Describe something that happened to you recently.';
    }

    console.log('[practice] Generated scenario:', text);
    return text;
  } catch (err) {
    console.error('[practice] Failed to generate scenario:', err);
    return 'Describe something that happened to you recently.';
  }
}

/**
 * Fire-and-forget: generate scenarios for newly inserted corrections and store them.
 */
export async function generateAndStoreScenarios(correctionIds: number[]): Promise<void> {
  if (correctionIds.length === 0) return;

  try {
    const rows = await db
      .select({
        id: corrections.id,
        originalText: corrections.originalText,
        correctedText: corrections.correctedText,
        explanation: corrections.explanation,
        correctionType: corrections.correctionType,
      })
      .from(corrections)
      .where(inArray(corrections.id, correctionIds));

    // Generate all scenarios in parallel
    const results = await Promise.all(
      rows.map(async (row) => {
        const scenario = await generateScenario({
          originalText: row.originalText,
          correctedText: row.correctedText,
          explanation: row.explanation,
          correctionType: row.correctionType,
        });
        return { id: row.id, scenario };
      }),
    );

    // Update each correction with its scenario
    await Promise.all(
      results.map(({ id, scenario }) =>
        db.update(corrections).set({ scenario }).where(eq(corrections.id, id)),
      ),
    );

    console.log(`[practice] Pre-generated ${results.length} scenarios for corrections: [${correctionIds.join(', ')}]`);
  } catch (err) {
    console.error('[practice] Failed to pre-generate scenarios:', err);
  }
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
  const systemPrompt = `You are an expert English language evaluator for non-native speakers. You evaluate whether a speaker successfully avoided using a specific overused word or phrase. Return JSON results.

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

  const systemPrompt = `You are an expert English language evaluator for non-native speakers. You evaluate whether a speaker successfully reframed a sentence to remove ${typeLabel}. Return JSON results.

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
