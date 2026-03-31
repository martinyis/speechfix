import Anthropic from '@anthropic-ai/sdk';
import type { ConversationMessage } from '../voice/response-generator.js';

const anthropic = new Anthropic();
const CORRECTION_TIMEOUT_MS = 3000;
const CONFIDENCE_THRESHOLD = 0.80;

export interface WordWithConfidence {
  word: string;
  confidence: number;
}

export function hasLowConfidenceWords(words: WordWithConfidence[]): boolean {
  return words.some(w => w.confidence < CONFIDENCE_THRESHOLD);
}

export async function correctTranscript(
  transcript: string,
  words: WordWithConfidence[],
  conversationHistory: ConversationMessage[],
): Promise<string> {
  const markedTranscript = words
    .map(w => w.confidence < CONFIDENCE_THRESHOLD ? `[?${w.word}]` : w.word)
    .join(' ');

  const context = conversationHistory
    .slice(-6)
    .map(m => `${m.role}: ${m.content}`)
    .join('\n');

  const prompt = `You fix speech-to-text transcription errors. The transcript below has uncertain words (marked with [?]). Use the conversation context to determine what was actually said.

Rules:
- Only fix words marked with [?] — do not change anything else
- If a [?] word seems correct, keep it as-is
- Return ONLY the corrected transcript text, nothing else

Conversation context:
${context}

Transcript with uncertain words:
"${markedTranscript}"`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CORRECTION_TIMEOUT_MS);

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 150,
      messages: [{ role: 'user', content: prompt }],
    }, {
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const text = response.content[0]?.type === 'text'
      ? response.content[0].text.trim()
      : transcript;

    // Strip quotes the model might wrap around the response
    return text.replace(/^["']|["']$/g, '');
  } catch (err: any) {
    if (err.name === 'AbortError' || err.name === 'APIUserAbortError') {
      console.log(`[transcript-correction] Timeout (${CORRECTION_TIMEOUT_MS}ms), using original`);
    } else {
      console.error(`[transcript-correction] Error:`, err);
    }
    return transcript;
  }
}
