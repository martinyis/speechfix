import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();
const MODEL = 'claude-sonnet-4-20250514';

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
  const prompt = `You are evaluating a non-native English speaker's practice attempt.

They were asked to say this sentence:
TARGET: "${correction.correctedText}"

They actually said:
SPOKEN: "${transcript}"

Their original mistake was: "${correction.originalText}" -> "${correction.correctedText}"
The correction type was: ${correction.correctionType}

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
}`;

  return callClaude(prompt);
}

export async function evaluateUseItNaturally(
  correction: CorrectionContext,
  transcript: string,
  scenario: string,
): Promise<EvaluationResult> {
  const prompt = `You are evaluating a non-native English speaker's practice attempt.

They made this mistake in a previous session:
ORIGINAL: "${correction.originalText}"
CORRECTED: "${correction.correctedText}"
RULE: "${correction.explanation ?? ''}"
CORRECTION TYPE: ${correction.correctionType}

They were given this scenario:
SCENARIO: "${scenario}"

They said:
SPOKEN: "${transcript}"

Evaluate whether they correctly applied the grammar rule from the correction in their new sentence. The sentence does NOT need to match the original correction -- it's a new sentence in a new context. Evaluate whether:
1. They produced a grammatically correct sentence
2. The sentence is relevant to the scenario
3. The specific grammar pattern from the correction type is used correctly (e.g., if correctionType is "verb_tense", check that verb tenses are correct)

Return JSON only:
{
  "passed": true/false,
  "feedback": "1-2 sentences. If passed: note what they did well with the specific grammar point. If failed: explain what went wrong with the specific grammar pattern they were practicing. Be direct, precise, Dr. Aris tone."
}`;

  return callClaude(prompt);
}

export async function generateScenario(
  correction: CorrectionContext,
): Promise<string> {
  const prompt = `Generate a simple conversational scenario that would naturally require a non-native English speaker to use this grammar pattern:

CORRECTION TYPE: ${correction.correctionType}
EXAMPLE: "${correction.originalText}" -> "${correction.correctedText}"
RULE: "${correction.explanation ?? ''}"

The scenario should be:
- One sentence, casual, like a conversation starter
- Naturally elicit a response that MUST use the grammar pattern
- Grounded in everyday situations (work, daily life, social)
- NOT a grammar exercise instruction ("use the past tense to...") -- it should feel like a natural question

Examples of good scenarios:
- For verb_tense (past): "Tell me about something you did last weekend."
- For article usage: "Describe your workspace right now."
- For prepositions: "How do you usually get to work?"

Return ONLY the scenario text, no JSON, no quotes, no explanation.`;

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      console.error('[practice] No text block in scenario generation response');
      return 'Describe something that happened to you recently.';
    }

    const scenario = textBlock.text.trim();
    console.log('[practice] Generated scenario:', scenario);
    return scenario;
  } catch (err) {
    console.error('[practice] Failed to generate scenario:', err);
    return 'Describe something that happened to you recently.';
  }
}

async function callClaude(prompt: string): Promise<EvaluationResult> {
  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      console.error('[practice] No text block in Claude response');
      return { passed: false, feedback: 'Evaluation unavailable. Try again.' };
    }

    let jsonText = textBlock.text.trim();
    console.log('[practice] Raw Claude response:', jsonText);

    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }

    const parsed = JSON.parse(jsonText);
    return {
      passed: Boolean(parsed.passed),
      feedback: parsed.feedback ?? '',
    };
  } catch (err) {
    console.error('[practice] Failed to evaluate:', err);
    return { passed: false, feedback: 'Evaluation unavailable. Try again.' };
  }
}
