import Anthropic from '@anthropic-ai/sdk';
import type { Analyzer, AnalyzerInput, AnalysisResult } from '../types.js';
import { parseJsonResponse, normalizeFillerWords, buildUserMessage } from '../utils.js';

const anthropic = new Anthropic();

const FILLER_SYSTEM_PROMPT = `You are analyzing transcribed speech to detect filler words and verbal pauses. Be conservative — only flag words when they are clearly used as fillers, NOT when they carry real meaning.

══════════════════════════════════════
FILLER WORDS
══════════════════════════════════════

Track only when used as verbal pauses/crutches, NOT with real meaning:

- um, uh, hmm, mm
- "like" — ONLY as filler. NOT as verb, comparison, approximation, or quotative
- "you know" — ONLY as filler. NOT literal ("you know the answer")
- "so" — ONLY sentence-initial filler. NOT causal, degree, or resumptive after interruption
- "basically" — ONLY as empty filler. NOT when genuinely simplifying
- "actually" — ONLY as empty filler. NOT when genuinely contrasting
- "right" — ONLY as filler tag. NOT as adjective, direction, or genuine confirmation
- "I mean" — ONLY as filler restart. NOT when genuinely clarifying
- "kind of", "sort of" — ONLY as empty hedging fillers. NOT as genuine approximation
- "literally" — ONLY when not literal
- "or something", "or whatever", "and stuff" — vague trail-off fillers

Be conservative. When in doubt, do NOT count it as a filler.

══════════════════════════════════════
CONVERSATION CONTEXT
══════════════════════════════════════

When the input includes conversation context, use it to understand whether a word is a filler or carries meaning. ONLY analyze the USER's sentences.

══════════════════════════════════════
OUTPUT FORMAT
══════════════════════════════════════

Return ONLY valid JSON. No markdown. No commentary. No text outside the JSON.

{
  "fillerWords": [
    { "word": "like", "count": 5 }
  ],
  "fillerPositions": [
    { "sentenceIndex": 0, "word": "like", "startIndex": 14 }
  ]
}

══════════════════════════════════════
STRICT RULES
══════════════════════════════════════

1. sentenceIndex is 0-based.
2. startIndex is the 0-based character offset where the filler starts in that sentence's text.
3. fillerWords is a summary — each unique filler word with its total count across all sentences.
4. fillerPositions lists every individual occurrence with its location.
5. If there are zero fillers, return empty arrays for both fields.`;

export class FillerAnalyzer implements Analyzer {
  async analyze(input: AnalyzerInput): Promise<AnalysisResult> {
    if (input.sentences.length === 0) {
      return { corrections: [], fillerWords: [], fillerPositions: [], sessionInsights: [] };
    }

    const userMessage = buildUserMessage(
      input.sentences,
      input.mode,
      input.conversationHistory,
      'Analyze these speech sentences for filler words and verbal pauses:',
    );

    console.log(`[filler-analyzer] Analyzing ${input.sentences.length} sentences`);

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: FILLER_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      });

      const textBlock = response.content.find((block) => block.type === 'text');
      if (!textBlock || textBlock.type !== 'text') {
        return { corrections: [], fillerWords: [], fillerPositions: [], sessionInsights: [] };
      }

      const parsed = parseJsonResponse(textBlock.text);

      return {
        corrections: [],
        fillerWords: normalizeFillerWords(parsed.fillerWords),
        fillerPositions: parsed.fillerPositions ?? [],
        sessionInsights: [],
      };
    } catch (err) {
      console.error('[filler-analyzer] Failed:', err);
      return { corrections: [], fillerWords: [], fillerPositions: [], sessionInsights: [] };
    }
  }
}
