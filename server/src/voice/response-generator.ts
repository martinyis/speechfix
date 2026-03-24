import Anthropic from '@anthropic-ai/sdk';

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface UserContext {
  displayName?: string | null;
  context?: string | null;
  goals?: string[] | null;
}

const anthropic = new Anthropic();

export async function* generateResponse(
  conversationHistory: ConversationMessage[],
  abortSignal: AbortSignal | undefined,
  systemPrompt: string,
): AsyncGenerator<string> {
  // Keep last 10 exchanges to limit context
  const recentHistory = conversationHistory.slice(-20);

  const stream = anthropic.messages.stream({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 300,
    system: systemPrompt,
    messages: recentHistory.map(m => ({
      role: m.role,
      content: m.content,
    })),
  }, {
    signal: abortSignal,
  });

  let buffer = '';

  for await (const event of stream) {
    if (abortSignal?.aborted) return;

    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      buffer += event.delta.text;

      // Yield at sentence boundaries for TTS chunking
      const sentenceEnd = buffer.search(/[.!?]\s|[.!?]$/);
      if (sentenceEnd !== -1) {
        const endPos = sentenceEnd + 1;
        const chunk = buffer.slice(0, endPos).trim();
        buffer = buffer.slice(endPos).trimStart();
        if (chunk) yield chunk;
      }
      // Also yield on comma + enough chars for first chunk (lower latency)
      else if (buffer.length > 60) {
        const commaPos = buffer.lastIndexOf(', ');
        if (commaPos > 20) {
          const chunk = buffer.slice(0, commaPos + 1).trim();
          buffer = buffer.slice(commaPos + 2).trimStart();
          if (chunk) yield chunk;
        }
      }
    }
  }

  // Yield remaining buffer
  if (buffer.trim()) {
    yield buffer.trim();
  }
}
