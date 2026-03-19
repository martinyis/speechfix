import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

export interface Correction {
  sentenceIndex: number;
  originalText: string;
  correctedText: string;
  correctionType: string;
}

export interface FillerWordCount {
  word: string;
  count: number;
}

export interface FillerWordPosition {
  sentenceIndex: number;
  word: string;
  startIndex: number;
}

export interface AnalysisResult {
  corrections: Correction[];
  fillerWords: FillerWordCount[];
  fillerPositions: FillerWordPosition[];
}

const SYSTEM_PROMPT = `You are a speech analysis tool for non-native English speakers. You receive sentences from a speech transcription and identify grammar errors and filler words.

RULES:
- Only flag ACTUAL errors. Do NOT correct natural spoken English patterns that are grammatically acceptable in conversation.
- "gonna", "wanna", "gotta" are acceptable spoken English -- do NOT flag them.
- Sentence fragments are normal in speech -- do NOT flag them unless they are truly broken grammar.
- Focus on: wrong articles (a/an/the), verb tense errors, wrong prepositions, subject-verb agreement, plural/singular mistakes, word order problems, wrong word choice.
- Each correction must reference the EXACT text from the original sentence (originalText must be a substring of the sentence).
- For filler words:
  - Count total occurrences across ALL sentences in the "fillerWords" array.
  - ALSO return the exact position of each filler occurrence in "fillerPositions" with: sentenceIndex (0-based), word, and startIndex (character offset in the sentence where the filler starts).
  - Common fillers: um, uh, like (when used as filler, not comparison), you know, so (when sentence-initial filler), basically, actually, right, I mean, kind of, sort of.
  - Do NOT count "like" when used as a verb ("I like pizza") or comparison ("like a dog"). Only count it as filler ("I was like, going there").
  - The startIndex must be the exact character position where the filler word begins in the original sentence text (0-based).

Return valid JSON only, no markdown, no explanation. The JSON must have three top-level keys: "corrections", "fillerWords", "fillerPositions".`;

export async function analyzeSpeech(
  sentences: string[]
): Promise<AnalysisResult> {
  if (sentences.length === 0) {
    return { corrections: [], fillerWords: [], fillerPositions: [] };
  }

  const numberedSentences = sentences
    .map((s, i) => `${i + 1}. ${s}`)
    .join('\n');

  const userMessage = `Analyze these speech sentences for grammar errors and filler words:\n\n${numberedSentences}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      return { corrections: [], fillerWords: [], fillerPositions: [] };
    }

    const parsed = JSON.parse(textBlock.text) as AnalysisResult;

    return {
      corrections: parsed.corrections ?? [],
      fillerWords: parsed.fillerWords ?? [],
      fillerPositions: parsed.fillerPositions ?? [],
    };
  } catch (err) {
    console.error('[analysis] Failed to analyze speech:', err);
    return { corrections: [], fillerWords: [], fillerPositions: [] };
  }
}
