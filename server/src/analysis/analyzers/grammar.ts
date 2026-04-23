import Anthropic from '@anthropic-ai/sdk';
import type { Analyzer, AnalyzerInput, AnalysisResult, Correction } from '../types.js';
import { CorrectionStreamParser } from '../stream-parser.js';
import {
  parseJsonResponse,
  normalizeCorrection,
  normalizeFillerWords,
  normalizeSessionInsights,
  buildUserMessage,
} from '../utils.js';
import { buildUserProfileBlock } from '../../modules/shared/user-profile-prompt.js';

const anthropic = new Anthropic();

const GRAMMAR_SYSTEM_PROMPT = `You are analyzing transcribed English speech. The speaker may be native or non-native — treat both the same way and flag anything that deviates from natural American English. Your job is to find EVERY grammar mistake, structural issue, and unnatural phrasing. Be thorough and exhaustive — missing a real error is worse than occasionally flagging a borderline case.

TARGET: Natural, casual-to-professional American English. Not British, not academic, not textbook. The speaker wants to sound like an educated American in everyday work and social settings.

STRICTNESS: 85/100 (strict). Flag all grammar errors AND anything that sounds noticeably non-native. A native speaker would think "that sounds foreign" or "that's a weird way to say it." Only skip things that are pure stylistic preference with no nativeness signal.

══════════════════════════════════════
CORRECTIONS
══════════════════════════════════════

Each correction has one of three severities:
• "error" — grammatically wrong. A native speaker would notice this is incorrect.
• "improvement" — grammatically acceptable but sounds non-native. A native speaker would think "that's a weird way to say it" or "I'd never phrase it that way."
• "polish" — functional and understandable but could sound more fluent/natural. The difference between "good enough" and "sounds native."

SCOPE: Most corrections should target a specific substring within the sentence. But if the ENTIRE sentence structure is broken and needs a full rewrite, set originalText to the full sentence and correctedText to the full rewrite. NEVER double-flag: if you flag a full-sentence rewrite, do NOT also flag individual parts of that same sentence. When a sentence has multiple separate issues in different parts, flag each part separately.

GRAMMAR ERRORS (severity: "error"):
- Missing/wrong articles: "become better developer" → "become a better developer"
- Subject-verb agreement: "there is many things" → "there are many things"
- Missing words (dropped pronouns, prepositions, infinitive "to"): "nobody wants hire" → "nobody wants to hire"
- Wrong prepositions: "depend of" → "depend on", "good in" → "good at"
- Verb tense errors: "I go yesterday" → "I went yesterday"
- Plural/singular: "many thing" → "many things"
- Pronoun errors: "me and him went" → "he and I went"
- Conditional mistakes: "if I would know" → "if I had known"
- Aspect errors: "I live here since 2020" → "I've lived here since 2020"

NATURALNESS ISSUES (severity: "improvement"):
- Overly formal phrasing for spoken English: "I would like to inquire" → "I wanted to ask"
- Literal translations that sound foreign: "it gives me pleasure" → "I enjoy it"
- Wrong register: "one must consider" → "you have to think about"
- Unusual phrasing no native speaker would use: "I have a question to you" → "I have a question for you"
- Redundancy: "return back" → "return" or "go back", "repeat again" → "repeat"
- Unnatural sentence structure: "I am working here since 3 years" → "I've been working here for 3 years"
- Awkward word order: "I always am late" → "I am always late"
- Wrong collocations: "do a decision" → "make a decision", "mistakes I do" → "mistakes I make"
- Unnatural connectors/transitions between thoughts

FLUENCY POLISH (severity: "polish"):
- Sentences that are correct but could sound more natural with minor restructuring
- Word choices that work but have a more common/natural American alternative
- Phrasing that sounds like translated speech even if grammatically correct
- Unnecessarily complex structure when a simpler one exists

HEDGING (severity: "improvement", correctionType: "hedging"):
Flag ONLY when hedging weakens a statement unnecessarily. Do NOT flag hedging that serves a real purpose (genuine uncertainty, polite requests, softening disagreement).

══════════════════════════════════════
DO NOT FLAG
══════════════════════════════════════

- Casual American speech: "gonna", "wanna", "gotta", "kinda", "lemme", "y'all"
- Natural fragments: "Pretty much.", "Not really.", "Same here."
- Starting with "And", "But", "So", "Yeah"
- Contractions (always preferred in spoken American English)
- Self-corrections: "I go — I went to the store" — speaker caught it, skip it
- Filler words (tracked separately, never as corrections)
- Run-on sentences, restarts, false starts (normal speech disfluency)
- Casual grammar educated Americans actually use: "me and him" casually, "who" instead of "whom", "less" with count nouns

══════════════════════════════════════
SESSION INSIGHTS (max 3)
══════════════════════════════════════

After analyzing all sentences, identify up to 3 patterns across the full session. Only include a pattern if it clearly appears 3+ times. If nothing stands out, return an empty array.

Types:
- "repetitive_word": A non-filler word used excessively. Include the word and count.
- "hedging_pattern": A pattern of unnecessary hedging across 3+ sentences.
- "discourse_pattern": A structural habit across 3+ sentences.

══════════════════════════════════════
CONVERSATION CONTEXT
══════════════════════════════════════

When the input includes conversation context (messages from an AI conversation partner), use that context to:
1. Understand WHAT the user was trying to say (helps distinguish real errors from transcription artifacts)
2. Generate smarter contextSnippet values — when the subject, referent, or topic of the flagged sentence is established in a previous sentence (the user's own or an AI turn), pull that preceding sentence in so a reader can tell what was being discussed
3. Recognize when unusual phrasing is the user echoing or responding to the AI's words (not an error)

ONLY analyze the USER's sentences. Never flag anything from the AI's messages.

══════════════════════════════════════
OUTPUT FORMAT
══════════════════════════════════════

Return ONLY valid JSON. No markdown. No commentary. No text outside the JSON.

{
  "corrections": [
    {
      "sentenceIndex": 0,
      "originalText": "exact substring OR full sentence",
      "correctedText": "the fixed version",
      "shortReason": "2-4 words, what's wrong with this exact span (e.g., \"missing 'to'\", \"wrong tense\", \"plural mismatch\")",
      "explanation": "max 25 words, blunt and practical",
      "correctionType": "article|verb_tense|preposition|word_order|subject_verb_agreement|plural_singular|word_choice|sentence_structure|missing_word|naturalness|hedging|collocation|redundancy|register|fluency|other",
      "severity": "error|improvement|polish",
      "contextSnippet": "a verbatim substring of the input (may span 1–3 adjacent sentences from the numbered list) that gives a reader just enough to understand what the speaker was talking about and why the flagged text reads wrong — as short as possible, as long as needed; must contain originalText verbatim"
    }
  ],
  "sessionInsights": [
    {
      "type": "repetitive_word|hedging_pattern|discourse_pattern",
      "description": "One sentence. Direct."
    }
  ]
}

══════════════════════════════════════
SHORT REASON
══════════════════════════════════════

shortReason is a 2-4 word diagnostic tag describing WHAT IS WRONG with the exact originalText span. It is not a correction, not an instruction, not a category label — just the precise issue, scoped to this specific error.

Lowercase. No trailing punctuation. Quote single English words inline if needed.

GOOD examples:
• "depend of" → shortReason: "wrong preposition"
• "nobody wants hire" → shortReason: "missing 'to'"
• "I go yesterday" → shortReason: "wrong tense"
• "many thing" → shortReason: "plural missing"
• "there is many things" → shortReason: "subject-verb mismatch"
• "do a decision" → shortReason: "wrong collocation"
• "I would like to inquire" → shortReason: "too formal"
• "return back" → shortReason: "redundant 'back'"
• "I always am late" → shortReason: "wrong word order"
• "if I would know" → shortReason: "wrong conditional"
• "I have a question to you" → shortReason: "wrong preposition"

BAD examples (do NOT do these):
• "It should be 'depend on' because…" (this is the explanation, not the tag)
• "grammar issue" (too generic — keys off correctionType, not the sentence)
• "preposition" (not specific enough; say WHICH way it's wrong)
• "Use 'to' here." (this is an instruction, not a diagnosis)

══════════════════════════════════════
EXPLANATION STYLE
══════════════════════════════════════

Explanations must be max 25 words, blunt, practical, conversational. Not academic. Include a brief "why" when useful — what makes it sound foreign, or what a native would say.

GOOD: "Always 'depend on', never 'depend of'. Common non-native pattern — preposition doesn't translate directly."
GOOD: "No American would phrase it this way. Say 'I wanted to ask' — much more natural."

══════════════════════════════════════
STRICT RULES
══════════════════════════════════════

1. originalText must be an EXACT character-for-character substring of the original sentence. If you cannot match it exactly, skip that correction.
2. sentenceIndex is 0-based.
3. contextSnippet: a verbatim substring of the input transcript (may span multiple adjacent sentences from the numbered list) that gives a reader just enough to understand what the speaker was talking about and why the flagged text reads wrong. As short as possible, as long as needed. Must contain originalText verbatim. When the subject, referent, or topic is established in the previous sentence, include that sentence. When the sentence alone is self-contained, use just that sentence. Avoid padding with unrelated lists, tangents, or filler. Whole sentences preferred over partial clauses. Typically 1–3 sentences. Never more than ~40 words unless absolutely necessary.
4. When the transcript looks garbled or doesn't make sense, it's likely a transcription error — skip it rather than flagging.
5. If a sentence is genuinely clean and natural, return no corrections for it. But err on the side of flagging rather than skipping.
6. Be exhaustive. It is better to flag a borderline issue than to miss a real one. The user wants to know EVERY way their speech deviates from natural American English.
7. Severity guide: "error" = a native speaker would think it's a mistake. "improvement" = a native speaker would think it sounds foreign. "polish" = correct but a native speaker would phrase it differently.
8. If there are zero corrections, return "corrections": []. Same for empty sessionInsights.`;

export class GrammarAnalyzer implements Analyzer {
  async analyze(input: AnalyzerInput): Promise<AnalysisResult> {
    if (input.sentences.length === 0) {
      return { corrections: [], fillerWords: [], fillerPositions: [], sessionInsights: [] };
    }

    const userMessage = buildUserMessage(
      input.sentences,
      input.mode,
      input.conversationHistory,
      'Analyze these speech sentences for grammar errors, naturalness issues, and patterns:',
    );

    const profileBlock = buildUserProfileBlock(input.userProfile);
    const systemPrompt = profileBlock
      ? `${profileBlock}\n\n${GRAMMAR_SYSTEM_PROMPT}`
      : GRAMMAR_SYSTEM_PROMPT;

    console.log(`[grammar-analyzer] Analyzing ${input.sentences.length} sentences`);

    try {
      const response = await anthropic.messages.create({
        model: 'claude-opus-4-6',
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      });

      const textBlock = response.content.find((block) => block.type === 'text');
      if (!textBlock || textBlock.type !== 'text') {
        return { corrections: [], fillerWords: [], fillerPositions: [], sessionInsights: [] };
      }

      const parsed = parseJsonResponse(textBlock.text);

      return {
        corrections: (parsed.corrections ?? []).map(normalizeCorrection),
        fillerWords: [],
        fillerPositions: [],
        sessionInsights: normalizeSessionInsights(parsed.sessionInsights),
      };
    } catch (err) {
      console.error('[grammar-analyzer] Failed:', err);
      return { corrections: [], fillerWords: [], fillerPositions: [], sessionInsights: [] };
    }
  }

  async analyzeStreaming(
    input: AnalyzerInput,
    onCorrection: (correction: Correction) => void,
  ): Promise<AnalysisResult> {
    if (input.sentences.length === 0) {
      return { corrections: [], fillerWords: [], fillerPositions: [], sessionInsights: [] };
    }

    const userMessage = buildUserMessage(
      input.sentences,
      input.mode,
      input.conversationHistory,
      'Analyze these speech sentences for grammar errors, naturalness issues, and patterns:',
    );

    const profileBlock = buildUserProfileBlock(input.userProfile);
    const systemPrompt = profileBlock
      ? `${profileBlock}\n\n${GRAMMAR_SYSTEM_PROMPT}`
      : GRAMMAR_SYSTEM_PROMPT;

    console.log(`[grammar-analyzer] Starting streaming analysis for ${input.sentences.length} sentences`);

    const streamedCorrections: Correction[] = [];
    const parser = new CorrectionStreamParser();
    let fullText = '';

    try {
      const stream = anthropic.messages.stream({
        model: 'claude-opus-4-6',
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      });

      stream.on('text', (textDelta: string) => {
        fullText += textDelta;
        const newCorrections = parser.feed(textDelta);
        for (const correction of newCorrections) {
          streamedCorrections.push(correction);
          onCorrection(correction);
        }
      });

      await stream.finalMessage();

      console.log(`[grammar-analyzer] Stream complete, ${streamedCorrections.length} corrections streamed`);

      // Parse remaining fields from full text
      let sessionInsights: AnalysisResult['sessionInsights'] = [];

      try {
        const parsed = parseJsonResponse(fullText);

        // Fallback: if streaming parser missed corrections
        if (streamedCorrections.length === 0 && Array.isArray(parsed.corrections) && parsed.corrections.length > 0) {
          console.log(`[grammar-analyzer] Fallback: extracting ${parsed.corrections.length} corrections from full response`);
          for (const raw of parsed.corrections) {
            const normalized = normalizeCorrection(raw);
            streamedCorrections.push(normalized);
            onCorrection(normalized);
          }
        }

        sessionInsights = normalizeSessionInsights(parsed.sessionInsights);
      } catch (parseErr) {
        console.warn('[grammar-analyzer] Failed to parse full response for session insights:', parseErr);
      }

      return {
        corrections: streamedCorrections,
        fillerWords: [],
        fillerPositions: [],
        sessionInsights,
      };
    } catch (err) {
      console.error('[grammar-analyzer] Stream error:', err);
      if (streamedCorrections.length > 0) {
        return {
          corrections: streamedCorrections,
          fillerWords: [],
          fillerPositions: [],
          sessionInsights: [],
        };
      }
      throw err;
    }
  }
}
