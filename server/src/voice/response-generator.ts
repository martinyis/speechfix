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

export interface ResponseMeta {
  toolCalls: string[];
}

const anthropic = new Anthropic();

export async function* generateResponse(
  conversationHistory: ConversationMessage[],
  abortSignal: AbortSignal | undefined,
  systemPrompt: string,
  tools?: Anthropic.Messages.Tool[],
  meta?: ResponseMeta,
): AsyncGenerator<string> {
  // Keep last 10 exchanges to limit context
  const recentHistory = conversationHistory.slice(-20);

  const brevityInstructions = [
    'Keep responses short and conversational (1-2 sentences typically).',
    'Only give longer responses when the user explicitly asks for explanation or clarification.',
    'Prioritize being a responsive conversation partner over being thorough.',
  ].join(' ');

  const fullSystemPrompt = `${systemPrompt}\n\n${brevityInstructions}`;

  const stream = anthropic.messages.stream({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 150,
    system: [
      {
        type: 'text' as const,
        text: fullSystemPrompt,
        cache_control: { type: 'ephemeral' as const },
      },
    ],
    messages: recentHistory.map(m => ({
      role: m.role,
      content: m.content,
    })),
    ...(tools && tools.length > 0
      ? { tools, tool_choice: { type: 'auto' as const } }
      : {}),
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

  // Extract tool calls from the completed stream
  if (meta) {
    try {
      const finalMessage = await stream.finalMessage();
      meta.toolCalls = finalMessage.content
        .filter((block): block is Anthropic.Messages.ToolUseBlock => block.type === 'tool_use')
        .map(block => block.name);
    } catch {
      // Stream may have been aborted
    }
  }
}
