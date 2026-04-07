import Anthropic from '@anthropic-ai/sdk';
import type { ConversationMessage } from './response-generator.js';

export type TurnDecision = 'respond' | 'wait' | 'uncertain';

const TRIGGER_PHRASES = [
  'what do you think',
  'what about you',
  'you know what i mean',
  'right?',
  'don\'t you think',
  'what would you',
  'how about you',
  'do you agree',
  'tell me',
  'can you',
  'could you',
];

const TRAILING_CONJUNCTIONS = ['and', 'but', 'so', 'or', 'because', 'like', 'then'];

export function detectTurnHeuristic(
  utterance: string,
  history: ConversationMessage[],
): TurnDecision {
  const trimmed = utterance.trim();
  const lower = trimmed.toLowerCase();
  const words = trimmed.split(/\s+/);
  const wordCount = words.length;

  // Very short, no question — likely a filler or false positive
  if (wordCount < 2 && !trimmed.endsWith('?')) {
    return 'wait';
  }

  // Direct question
  if (trimmed.endsWith('?')) {
    return 'respond';
  }

  // Trigger phrases
  for (const phrase of TRIGGER_PHRASES) {
    if (lower.includes(phrase)) {
      return 'respond';
    }
  }

  // Trailing conjunction — sentence is incomplete
  const lastWord = words[words.length - 1].toLowerCase().replace(/[.,!]$/, '');
  if (TRAILING_CONJUNCTIONS.includes(lastWord)) {
    return 'wait';
  }

  // Short response right after AI spoke — likely a reply
  const lastMessage = history[history.length - 1];
  if (lastMessage?.role === 'assistant' && wordCount < 5) {
    return 'respond';
  }

  // Medium-length utterance with a complete thought — respond rather than waiting
  if (wordCount >= 3 && wordCount <= 30) {
    return 'respond';
  }

  // Long monologue — let them keep going, use LLM only for this edge case
  if (wordCount > 30) {
    return 'uncertain';
  }

  return 'respond';
}

const anthropic = new Anthropic();

const TURN_DETECTION_PROMPT = `You are a turn-detection model for a voice conversation between a user and an AI partner. Given the user's latest utterance and brief conversation context, decide: should the AI respond, or should it stay quiet and let the user continue?

Respond with exactly one word: RESPOND or WAIT.

RESPOND when:
- The user asked a question or is clearly expecting a reply
- The user finished a complete thought and there's a natural opening
- The user said something that invites a reaction

WAIT when:
- The user is in the middle of explaining something and paused to think
- The user seems to be collecting their thoughts
- The utterance feels incomplete or like the start of a longer point

When in doubt, WAIT. It's better to let the user keep talking than to interrupt.`;

export async function detectTurnLLM(
  utterance: string,
  context: string,
  abortSignal?: AbortSignal,
): Promise<'respond' | 'wait'> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 10,
      system: TURN_DETECTION_PROMPT,
      messages: [{
        role: 'user',
        content: `Context: ${context}\nLatest: "${utterance}"\nDecide:`,
      }],
    }, {
      signal: abortSignal,
    });

    const text = response.content[0]?.type === 'text'
      ? response.content[0].text.trim().toUpperCase()
      : 'WAIT';

    return text.includes('RESPOND') ? 'respond' : 'wait';
  } catch (err: any) {
    if (err.name === 'AbortError' || abortSignal?.aborted) {
      return 'wait';
    }
    console.error('[turn-detector] LLM error:', err);
    return 'wait'; // Default to wait on error
  }
}
