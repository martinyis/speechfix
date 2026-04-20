import Groq from 'groq-sdk';
import type { ChatTool } from './tools.js';

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

const groq = new Groq();

export async function* generateResponse(
  conversationHistory: ConversationMessage[],
  abortSignal: AbortSignal | undefined,
  systemPrompt: string,
  tools?: ChatTool[],
  meta?: ResponseMeta,
  maxCompletionTokens?: number,
): AsyncGenerator<string> {
  const recentHistory = conversationHistory.slice(-20);

  const brevityInstructions = [
    'Keep responses to 1-2 sentences. Maximum 3 only if coaching or clarifying.',
    'Never list, enumerate, or give multi-part answers. One thought per turn.',
    'This is spoken conversation — be concise.',
  ].join(' ');

  const fullSystemPrompt = `${systemPrompt}\n\n${brevityInstructions}`;

  const messages = [
    { role: 'system' as const, content: fullSystemPrompt },
    ...recentHistory.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  ];

  const stream = await groq.chat.completions.create({
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    max_completion_tokens: maxCompletionTokens ?? (tools && tools.length > 0 ? 250 : 150),
    temperature: 0.8,
    stop: ['\n\n', '**', '\n- ', '\n1.'],
    messages,
    stream: true,
    ...(tools && tools.length > 0
      ? { tools, tool_choice: 'auto' as const }
      : {}),
  });

  let buffer = '';
  const toolCallChunks: Array<{ name: string }> = [];

  for await (const chunk of stream) {
    if (abortSignal?.aborted) return;

    const delta = chunk.choices[0]?.delta;
    if (!delta) continue;

    // Collect tool calls
    if (delta.tool_calls) {
      for (const tc of delta.tool_calls) {
        if (tc.function?.name) {
          toolCallChunks.push({ name: tc.function.name });
        }
      }
    }

    // Stream text content
    if (delta.content) {
      buffer += delta.content;

      // Yield at sentence boundaries for TTS chunking
      const sentenceEnd = buffer.search(/[.!?]\s|[.!?]$/);
      if (sentenceEnd !== -1) {
        const endPos = sentenceEnd + 1;
        const chunk = buffer.slice(0, endPos).trim();
        buffer = buffer.slice(endPos).trimStart();
        if (chunk) yield chunk;
      } else if (buffer.length > 60) {
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

  // Populate tool calls from collected stream chunks
  if (meta) {
    meta.toolCalls = toolCallChunks.map(tc => tc.name);
  }
}
