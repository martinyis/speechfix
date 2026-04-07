import Groq from 'groq-sdk';
import { db } from '../db/index.js';
import { patternExercises, speechPatterns } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';

const groq = new Groq();
const MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';

const CATEGORY_A_TYPES = ['overused_word', 'repetitive_starter', 'crutch_phrase'];
const CATEGORY_B_TYPES = ['hedging', 'negative_framing'];

export async function generateAlternatives(
  originalSentence: string,
  targetWord: string,
  patternType: string,
): Promise<string[]> {
  try {
    const response = await groq.chat.completions.create({
      model: MODEL,
      max_tokens: 1024,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are an expert English language coach helping non-native speakers improve their speech. Return ONLY valid JSON.`,
        },
        {
          role: 'user',
          content: `Generate 1-8 replacement words or short phrases that could replace "${targetWord}" in the following sentence.

ORIGINAL: "${originalSentence}"
PATTERN TYPE: ${patternType}

Rules:
- Return ONLY the replacement word or short phrase, NOT the full sentence
- Each replacement must preserve the original meaning when substituted in
- Each replacement must sound natural and fluent in context
- NONE of the replacements may contain "${targetWord}" (case-insensitive)
- Use varied vocabulary

Example: if the sentence is "I'm a very responsible individual" and the target word is "very", return replacements like ["extremely", "incredibly", "highly"] — NOT full sentences.

Return JSON: {"alternatives": ["replacement1", "replacement2", ...]}`,
        },
      ],
    });

    const text = response.choices[0]?.message?.content?.trim();
    if (!text) return [];

    const parsed = JSON.parse(text);
    const alternatives = Array.isArray(parsed.alternatives) ? parsed.alternatives : [];

    // Filter out any alternatives that still contain the target word
    const targetLower = targetWord.toLowerCase();
    return alternatives.filter(
      (alt: unknown): alt is string =>
        typeof alt === 'string' && !alt.toLowerCase().includes(targetLower),
    );
  } catch (err) {
    console.error('[pattern-exercises] Failed to generate alternatives:', err);
    return [];
  }
}

export async function generateReframeExercise(
  originalSentence: string,
  patternType: string,
): Promise<{ highlightPhrases: string[]; suggestedReframe: string } | null> {
  try {
    const typeLabel =
      patternType === 'hedging' ? 'hedging language (e.g. "kind of", "maybe", "I think", "sort of", "probably", "try to", "I guess", "not sure but")'
      : 'negative framing (e.g. "I can\'t", "It\'s impossible", "There\'s no way", "The problem is")';

    const response = await groq.chat.completions.create({
      model: MODEL,
      max_tokens: 1024,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are an expert English language coach helping non-native speakers speak with more confidence and clarity. Return ONLY valid JSON.`,
        },
        {
          role: 'user',
          content: `Analyze this sentence for ${typeLabel} and provide a confident reframe.

SENTENCE: "${originalSentence}"
PATTERN TYPE: ${patternType}

1. Identify ALL phrases in the sentence that represent ${typeLabel}. Return them exactly as they appear.
2. Provide a single reframed version that removes/replaces the problematic phrases while preserving the core meaning.

Rules:
- highlightPhrases must be exact substrings of the original sentence (case-insensitive match is fine)
- The reframe should sound natural, confident, and direct
- Preserve the speaker's intent — just make it more assertive/positive

Return JSON: {"highlightPhrases": ["phrase1", "phrase2"], "suggestedReframe": "the reframed sentence"}`,
        },
      ],
    });

    const text = response.choices[0]?.message?.content?.trim();
    if (!text) return null;

    const parsed = JSON.parse(text);
    const highlightPhrases = Array.isArray(parsed.highlightPhrases) ? parsed.highlightPhrases.filter((p: unknown) => typeof p === 'string') : [];
    const suggestedReframe = typeof parsed.suggestedReframe === 'string' ? parsed.suggestedReframe : '';

    if (highlightPhrases.length === 0 || !suggestedReframe) return null;
    return { highlightPhrases, suggestedReframe };
  } catch (err) {
    console.error('[pattern-exercises] Failed to generate reframe exercise:', err);
    return null;
  }
}

const MAX_EXERCISES_PER_LEVEL = 5;

export async function generatePatternExercises(
  patternId: number,
  userId: number,
  level: 1 | 2 = 1,
): Promise<number> {
  // Fetch pattern from DB
  const [pattern] = await db
    .select({ id: speechPatterns.id, data: speechPatterns.data })
    .from(speechPatterns)
    .where(eq(speechPatterns.id, patternId));

  if (!pattern) {
    console.warn(`[pattern-exercises] Pattern ${patternId} not found`);
    return 0;
  }

  const data = pattern.data as { examples?: string[]; identifier?: string | null; type?: string };
  const examples = data.examples;
  const identifier = data.identifier ?? null;
  const patternType = data.type;

  if (!Array.isArray(examples) || !patternType) {
    console.warn(`[pattern-exercises] Pattern ${patternId} missing examples/type`);
    return 0;
  }

  // Category A requires an identifier; Category B does not
  const isCategoryA = CATEGORY_A_TYPES.includes(patternType);
  const isCategoryB = CATEGORY_B_TYPES.includes(patternType);

  if (!isCategoryA && !isCategoryB) {
    console.warn(`[pattern-exercises] Unknown pattern type: ${patternType}`);
    return 0;
  }

  if (isCategoryA && !identifier) {
    console.warn(`[pattern-exercises] Category A pattern ${patternId} missing identifier`);
    return 0;
  }

  // Get existing exercises to dedup (within the same level)
  const existingExercises = await db
    .select({ originalSentence: patternExercises.originalSentence })
    .from(patternExercises)
    .where(and(eq(patternExercises.patternId, patternId), eq(patternExercises.userId, userId), eq(patternExercises.level, level)));

  const existingSentences = new Set(existingExercises.map((e) => e.originalSentence));

  // Filter to new examples only, cap at MAX_EXERCISES_PER_LEVEL
  const newExamples = examples
    .filter((ex) => !existingSentences.has(ex))
    .slice(0, MAX_EXERCISES_PER_LEVEL);

  if (newExamples.length === 0) return 0;

  if (isCategoryA) {
    // Category A: generate word/phrase alternatives
    const results = await Promise.all(
      newExamples.map(async (sentence) => {
        // Level 2: no hints (empty alternatives)
        if (level === 2) return { sentence, alternatives: [] as string[] };
        const alternatives = await generateAlternatives(sentence, identifier!, patternType);
        return { sentence, alternatives };
      }),
    );

    const toInsert = results
      // Level 1 needs alternatives; Level 2 always passes (empty array = no hints)
      .filter((r) => level === 2 || r.alternatives.length > 0)
      .map((r, idx) => ({
        patternId,
        userId,
        originalSentence: r.sentence,
        targetWord: identifier!,
        patternType,
        alternatives: r.alternatives,
        level,
        orderIndex: idx,
      }));

    if (toInsert.length === 0) return 0;

    await db.insert(patternExercises).values(toInsert);
    console.log(`[pattern-exercises] Created ${toInsert.length} L${level} Category A exercises for pattern ${patternId}`);
    return toInsert.length;
  } else {
    // Category B: generate reframe exercises
    const results = await Promise.all(
      newExamples.map(async (sentence) => {
        // Level 2: only generate highlights (no suggestedReframe hint)
        if (level === 2) {
          const reframe = await generateReframeExercise(sentence, patternType);
          if (!reframe) return { sentence, reframe: null };
          return { sentence, reframe: { highlightPhrases: reframe.highlightPhrases, suggestedReframe: null } };
        }
        const reframe = await generateReframeExercise(sentence, patternType);
        return { sentence, reframe };
      }),
    );

    const toInsert = results
      .filter((r) => r.reframe !== null)
      .map((r, idx) => ({
        patternId,
        userId,
        originalSentence: r.sentence,
        targetWord: null,
        patternType,
        alternatives: [] as string[],
        highlightPhrases: r.reframe!.highlightPhrases,
        suggestedReframe: r.reframe!.suggestedReframe ?? null,
        level,
        orderIndex: idx,
      }));

    if (toInsert.length === 0) return 0;

    await db.insert(patternExercises).values(toInsert);
    console.log(`[pattern-exercises] Created ${toInsert.length} L${level} Category B exercises for pattern ${patternId}`);
    return toInsert.length;
  }
}

export async function generateAndStorePatternExercises(
  patternIds: number[],
  userId: number,
  level: 1 | 2 = 1,
): Promise<void> {
  if (patternIds.length === 0) return;

  try {
    let total = 0;
    for (const patternId of patternIds) {
      const count = await generatePatternExercises(patternId, userId, level);
      total += count;
    }
    console.log(`[pattern-exercises] Generated ${total} L${level} exercises for ${patternIds.length} patterns`);
  } catch (err) {
    console.error(`[pattern-exercises] Exercise generation failed:`, err);
  }
}
