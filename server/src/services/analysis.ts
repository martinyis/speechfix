import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

export interface Correction {
  sentenceIndex: number;
  originalText: string;
  correctedText: string;
  explanation: string;
  correctionType: string;
  severity: 'error' | 'improvement' | 'polish';
  contextSnippet: string;
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

export interface SessionInsight {
  type: 'repetitive_word' | 'hedging_pattern' | 'discourse_pattern';
  description: string;
}

export interface AnalysisResult {
  corrections: Correction[];
  fillerWords: FillerWordCount[];
  fillerPositions: FillerWordPosition[];
  sessionInsights: SessionInsight[];
}

const SYSTEM_PROMPT = `You are analyzing transcribed speech from a non-native English speaker. Your job is to find EVERY grammar mistake, structural issue, and unnatural phrasing. Be thorough and exhaustive — missing a real error is worse than occasionally flagging a borderline case.

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
2. Generate better contextSnippet values that capture the conversational moment
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
      "explanation": "max 25 words, blunt and practical",
      "correctionType": "article|verb_tense|preposition|word_order|subject_verb_agreement|plural_singular|word_choice|sentence_structure|missing_word|naturalness|hedging|collocation|redundancy|register|fluency|other",
      "severity": "error|improvement|polish",
      "contextSnippet": "8-12 words from the sentence surrounding the error"
    }
  ],
  "fillerWords": [
    { "word": "like", "count": 5 }
  ],
  "fillerPositions": [
    { "sentenceIndex": 0, "word": "like", "startIndex": 14 }
  ],
  "sessionInsights": [
    {
      "type": "repetitive_word|hedging_pattern|discourse_pattern",
      "description": "One sentence. Direct."
    }
  ]
}

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
3. startIndex in fillerPositions is the 0-based character offset where the filler starts in that sentence's text.
4. contextSnippet: ~8-12 words from the original sentence centered around the originalText. If the sentence is shorter than 12 words, use the whole sentence.
5. When the transcript looks garbled or doesn't make sense, it's likely a transcription error — skip it rather than flagging.
6. If a sentence is genuinely clean and natural, return no corrections for it. But err on the side of flagging rather than skipping.
7. Be exhaustive. It is better to flag a borderline issue than to miss a real one. The user wants to know EVERY way their speech deviates from natural American English.
8. Severity guide: "error" = a native speaker would think it's a mistake. "improvement" = a native speaker would think it sounds foreign. "polish" = correct but a native speaker would phrase it differently.
9. If there are zero corrections, return "corrections": []. Same for empty fillerWords, fillerPositions, sessionInsights.`;

export async function analyzeSpeech(
  sentences: string[],
  mode: 'recording' | 'conversation' = 'recording',
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>,
): Promise<AnalysisResult> {
  if (sentences.length === 0) {
    return { corrections: [], fillerWords: [], fillerPositions: [], sessionInsights: [] };
  }

  // Build conversation context block for dialogue mode
  let conversationContext = '';
  if (mode === 'conversation' && conversationHistory && conversationHistory.length > 0) {
    conversationContext = 'CONVERSATION CONTEXT (for reference only — only analyze the USER sentences below):\n\n';
    conversationHistory.forEach((msg, i) => {
      const label = msg.role === 'assistant' ? 'AI' : 'USER';
      conversationContext += `[${label}]: ${msg.content}\n`;
    });
    conversationContext += '\n---\n\n';
  }

  const numberedSentences = sentences
    .map((s, i) => `${i}. ${s}`)
    .join('\n');

  const userMessage = `${conversationContext}Analyze these speech sentences for grammar errors, naturalness issues, filler words, and patterns:\n\n${numberedSentences}`;

  console.log(`[DEBUG-ANALYSIS] === PROMPT SENT TO CLAUDE ===`);
  console.log(`[DEBUG-ANALYSIS] User message:\n${userMessage}`);

  try {
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      console.log(`[DEBUG-ANALYSIS] No text block in Claude response!`);
      return { corrections: [], fillerWords: [], fillerPositions: [], sessionInsights: [] };
    }

    let jsonText = textBlock.text.trim();
    console.log(`[DEBUG-ANALYSIS] === RAW CLAUDE RESPONSE ===`);
    console.log(`[DEBUG-ANALYSIS] ${jsonText}`);

    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }
    const parsed = JSON.parse(jsonText);
    console.log('[analysis] Claude response keys:', JSON.stringify(Object.keys(parsed)));
    console.log('[analysis] fillerWords type:', Array.isArray(parsed.fillerWords) ? 'array' : typeof parsed.fillerWords, JSON.stringify(parsed.fillerWords));

    // Normalize corrections — ensure all fields are present
    const normalizedCorrections = (parsed.corrections ?? []).map((c: any) => ({
      sentenceIndex: c.sentenceIndex ?? 0,
      originalText: c.originalText ?? '',
      correctedText: c.correctedText ?? '',
      explanation: c.explanation ?? '',
      correctionType: c.correctionType || c.type || 'other',
      severity: ['error', 'improvement', 'polish'].includes(c.severity) ? c.severity : 'error',
      contextSnippet: c.contextSnippet ?? '',
    }));

    // Normalize fillerWords — Claude returns array of objects, object map, or other shapes
    const rawFillers = parsed.fillerWords ?? [];
    let normalizedFillers: FillerWordCount[];
    if (Array.isArray(rawFillers)) {
      normalizedFillers = rawFillers.map((f: any) => ({
        word: f.word ?? f.name ?? f.filler ?? '',
        count: f.count ?? f.frequency ?? f.total ?? 1,
      })).filter((f: FillerWordCount) => f.word !== '');
    } else if (typeof rawFillers === 'object') {
      // Handle {"like": 3, "so": 2} shape
      normalizedFillers = Object.entries(rawFillers).map(([word, count]) => ({
        word,
        count: typeof count === 'number' ? count : 1,
      }));
    } else {
      normalizedFillers = [];
    }

    return {
      corrections: normalizedCorrections,
      fillerWords: normalizedFillers,
      fillerPositions: parsed.fillerPositions ?? [],
      sessionInsights: (parsed.sessionInsights ?? []).map((i: any) => ({
        type: i.type ?? 'discourse_pattern',
        description: i.description ?? '',
      })),
    };
  } catch (err) {
    console.error('[analysis] Failed to analyze speech:', err);
    return { corrections: [], fillerWords: [], fillerPositions: [], sessionInsights: [] };
  }
}

// ---------------------------------------------------------------------------
// Streaming analysis — progressive correction delivery
// ---------------------------------------------------------------------------

export interface StreamedAnalysisResult extends AnalysisResult {
  // Same shape as AnalysisResult; all corrections were already streamed via callback
}

/**
 * State-machine parser that extracts individual Correction objects from a
 * partial JSON stream.  It watches for the "corrections" array and yields
 * each complete object as soon as the closing brace is seen.
 */
export class CorrectionStreamParser {
  private buffer = '';
  private inCorrectionsArray = false;
  private braceDepth = 0;
  private currentObjectStart = -1;
  private inString = false;
  private escapeNext = false;
  private correctionsDone = false;
  private scanPos = 0;

  /** Feed a new chunk of text; returns any fully-parsed corrections. */
  feed(chunk: string): Correction[] {
    this.buffer += chunk;
    const results: Correction[] = [];

    if (this.correctionsDone) return results;

    // Strip leading markdown fences that Claude sometimes emits
    if (!this.inCorrectionsArray && this.buffer.length < 200) {
      const stripped = this.buffer.replace(/^\s*```(?:json)?\s*/, '');
      if (stripped !== this.buffer) {
        this.buffer = stripped;
        this.scanPos = 0;
      }
    }

    // PHASE 1: Find the corrections array using indexOf (no char scanning)
    if (!this.inCorrectionsArray) {
      const corrIdx = this.buffer.indexOf('"corrections"');
      if (corrIdx === -1) {
        // Haven't seen the key yet — keep only the tail in buffer
        if (this.buffer.length > 20) {
          this.buffer = this.buffer.slice(-20);
          this.scanPos = 0;
        }
        return results;
      }
      const bracketIdx = this.buffer.indexOf('[', corrIdx + '"corrections"'.length);
      if (bracketIdx === -1) return results;

      this.inCorrectionsArray = true;
      this.buffer = this.buffer.slice(bracketIdx + 1);
      this.inString = false;
      this.escapeNext = false;
      this.scanPos = 0;
    }

    // PHASE 2: Character-by-character scanning inside the corrections array
    // Resume from where we left off — state (braceDepth, inString, etc.)
    // matches this.scanPos, not position 0.
    let i = this.scanPos;
    while (i < this.buffer.length) {
      const ch = this.buffer[i];

      // Handle string context (ignore braces inside JSON strings)
      if (this.escapeNext) {
        this.escapeNext = false;
        i++;
        continue;
      }
      if (ch === '\\' && this.inString) {
        this.escapeNext = true;
        i++;
        continue;
      }
      if (ch === '"') {
        this.inString = !this.inString;
        i++;
        continue;
      }
      if (this.inString) {
        i++;
        continue;
      }

      // Inside the corrections array
      if (ch === '{' && this.braceDepth === 0) {
        this.currentObjectStart = i;
        this.braceDepth = 1;
        i++;
        continue;
      }

      if (this.braceDepth > 0) {
        if (ch === '{') this.braceDepth++;
        if (ch === '}') this.braceDepth--;

        if (this.braceDepth === 0) {
          // Complete object
          const objStr = this.buffer.slice(this.currentObjectStart, i + 1);
          try {
            const raw = JSON.parse(objStr);
            const normalized: Correction = {
              sentenceIndex: raw.sentenceIndex ?? 0,
              originalText: raw.originalText ?? '',
              correctedText: raw.correctedText ?? '',
              explanation: raw.explanation ?? '',
              correctionType: raw.correctionType || raw.type || 'other',
              severity: ['error', 'improvement', 'polish'].includes(raw.severity) ? raw.severity : 'error',
              contextSnippet: raw.contextSnippet ?? '',
            };
            results.push(normalized);
          } catch {
            console.warn('[stream-parser] Failed to parse correction object:', objStr.slice(0, 80));
          }
          // Advance buffer past this object
          this.buffer = this.buffer.slice(i + 1);
          i = 0;
          this.currentObjectStart = -1;
          continue;
        }
      }

      if (ch === ']' && this.braceDepth === 0 && this.inCorrectionsArray) {
        this.correctionsDone = true;
        // Keep remaining buffer for post-stream parsing of other fields
        this.buffer = this.buffer.slice(i + 1);
        this.scanPos = 0;
        break;
      }

      i++;
    }

    // Save scan position for next feed() call — state matches this position
    this.scanPos = i;

    return results;
  }

  isDone(): boolean {
    return this.correctionsDone;
  }
}

/**
 * Streaming variant of analyzeSpeech.  Calls `onCorrection` for each
 * correction as soon as it is parsed from the stream.  Returns the
 * full AnalysisResult once the stream completes.
 */
export async function analyzeSpeechStreaming(
  sentences: string[],
  mode: 'recording' | 'conversation' = 'recording',
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>,
  onCorrection?: (correction: Correction) => void,
): Promise<StreamedAnalysisResult> {
  if (sentences.length === 0) {
    return { corrections: [], fillerWords: [], fillerPositions: [], sessionInsights: [] };
  }

  // Build userMessage — identical to analyzeSpeech
  let conversationContext = '';
  if (mode === 'conversation' && conversationHistory && conversationHistory.length > 0) {
    conversationContext = 'CONVERSATION CONTEXT (for reference only — only analyze the USER sentences below):\n\n';
    conversationHistory.forEach((msg) => {
      const label = msg.role === 'assistant' ? 'AI' : 'USER';
      conversationContext += `[${label}]: ${msg.content}\n`;
    });
    conversationContext += '\n---\n\n';
  }

  const numberedSentences = sentences
    .map((s, i) => `${i}. ${s}`)
    .join('\n');

  const userMessage = `${conversationContext}Analyze these speech sentences for grammar errors, naturalness issues, filler words, and patterns:\n\n${numberedSentences}`;

  console.log(`[streaming-analysis] Starting streaming analysis for ${sentences.length} sentences`);
  console.log(`[streaming-analysis] === PROMPT SENT TO CLAUDE ===`);
  console.log(`[streaming-analysis] Model: claude-opus-4-6`);
  console.log(`[streaming-analysis] User message:\n${userMessage}`);

  const streamedCorrections: Correction[] = [];
  const parser = new CorrectionStreamParser();
  let fullText = '';

  try {
    const stream = anthropic.messages.stream({
      model: 'claude-opus-4-6',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    stream.on('text', (textDelta: string) => {
      fullText += textDelta;
      const newCorrections = parser.feed(textDelta);
      for (const correction of newCorrections) {
        streamedCorrections.push(correction);
        onCorrection?.(correction);
      }
    });

    // Wait for stream to finish
    await stream.finalMessage();

    console.log(`[streaming-analysis] Stream complete, ${streamedCorrections.length} corrections streamed`);
    console.log(`[streaming-analysis] === RAW CLAUDE RESPONSE ===`);
    console.log(`[streaming-analysis] ${fullText}`);

    // Parse remaining fields from full text
    let jsonText = fullText.trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }

    let fillerWords: FillerWordCount[] = [];
    let fillerPositions: FillerWordPosition[] = [];
    let sessionInsights: SessionInsight[] = [];

    try {
      const parsed = JSON.parse(jsonText);

      // Fallback: if streaming parser missed corrections but full JSON has them
      if (streamedCorrections.length === 0 && Array.isArray(parsed.corrections) && parsed.corrections.length > 0) {
        console.log(`[streaming-analysis] Fallback: extracting ${parsed.corrections.length} corrections from full response`);
        for (const raw of parsed.corrections) {
          const normalized: Correction = {
            sentenceIndex: raw.sentenceIndex ?? 0,
            originalText: raw.originalText ?? '',
            correctedText: raw.correctedText ?? '',
            explanation: raw.explanation ?? '',
            correctionType: raw.correctionType || raw.type || 'other',
            severity: ['error', 'improvement', 'polish'].includes(raw.severity) ? raw.severity : 'error',
            contextSnippet: raw.contextSnippet ?? '',
          };
          streamedCorrections.push(normalized);
          onCorrection?.(normalized);
        }
      }

      // Normalize fillerWords
      const rawFillers = parsed.fillerWords ?? [];
      if (Array.isArray(rawFillers)) {
        fillerWords = rawFillers.map((f: any) => ({
          word: f.word ?? f.name ?? f.filler ?? '',
          count: f.count ?? f.frequency ?? f.total ?? 1,
        })).filter((f: FillerWordCount) => f.word !== '');
      } else if (typeof rawFillers === 'object') {
        fillerWords = Object.entries(rawFillers).map(([word, count]) => ({
          word,
          count: typeof count === 'number' ? count : 1,
        }));
      }

      fillerPositions = parsed.fillerPositions ?? [];
      sessionInsights = (parsed.sessionInsights ?? []).map((si: any) => ({
        type: si.type ?? 'discourse_pattern',
        description: si.description ?? '',
      }));
    } catch (parseErr) {
      console.warn('[streaming-analysis] Failed to parse full response for non-correction fields:', parseErr);
    }

    return {
      corrections: streamedCorrections,
      fillerWords,
      fillerPositions,
      sessionInsights,
    };
  } catch (err) {
    console.error('[streaming-analysis] Stream error:', err);
    // If we got some corrections, return partial result
    if (streamedCorrections.length > 0) {
      console.warn(`[streaming-analysis] Returning partial result with ${streamedCorrections.length} corrections`);
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
