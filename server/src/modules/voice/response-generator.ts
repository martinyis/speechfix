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

/**
 * Per-call brevity overrides. Both fields are optional — the caller (usually
 * `session-manager.ts` via a handler's `getBrevityBudget`) decides whether to
 * cap this turn based on whether the user asked a direct question.
 *
 *  - `maxCompletionTokens` → hard cap on the model's output tokens.
 *  - `truncateToWords`    → server-side word-count guillotine. Omit for tool
 *                           calls (truncating tool-call JSON corrupts the
 *                           protocol) or when you trust the model to obey.
 */
export interface BrevityOptions {
  /** Word cap for server-side truncation. If omitted, no truncation. */
  truncateToWords?: number;
  /** Per-call max_completion_tokens override. */
  maxCompletionTokens?: number;
}

const groq = new Groq();

function countWords(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

export async function* generateResponse(
  conversationHistory: ConversationMessage[],
  abortSignal: AbortSignal | undefined,
  systemPrompt: string,
  tools?: ChatTool[],
  meta?: ResponseMeta,
  brevityOptions?: BrevityOptions,
): AsyncGenerator<string> {
  const recentHistory = conversationHistory.slice(-20);

  // Per-agent brevity fragments already sit at the end of `systemPrompt`
  // (see each handler's `buildSystemPrompt`). This is just a final one-line
  // nudge at the very end so the model has "default is 1-8 words" as the
  // last thing it reads before generating.
  const brevityReminder = 'Remember: one short probe per turn (≤15 words, ends in a question). Never paraphrase the user. Never monologue.';
  const fullSystemPrompt = `${systemPrompt}\n\n${brevityReminder}`;

  const messages = [
    { role: 'system' as const, content: fullSystemPrompt },
    ...recentHistory.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  ];

  const effectiveMaxTokens = brevityOptions?.maxCompletionTokens
    ?? (tools && tools.length > 0 ? 250 : 150);

  const stream = await groq.chat.completions.create({
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    max_completion_tokens: effectiveMaxTokens,
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

  // Running word budget for server-side truncation.
  const wordLimit = brevityOptions?.truncateToWords ?? Infinity;
  let wordsEmitted = 0;
  let truncated = false;

  /**
   * Yields `chunk` honoring the running word budget. If emitting the full
   * chunk would exceed `wordLimit`, yield a sliced version cut at the last
   * sentence boundary within the allowed slice (or hard-cut at the word
   * boundary with a warning if no sentence boundary exists). Returns
   * `{ stop: true }` after a truncated emission so the caller can abort.
   */
  function* emitRespectingLimit(chunk: string): Generator<string, { stop: boolean }, undefined> {
    if (wordLimit === Infinity) {
      yield chunk;
      return { stop: false };
    }

    const chunkWords = countWords(chunk);
    if (wordsEmitted + chunkWords <= wordLimit) {
      yield chunk;
      wordsEmitted += chunkWords;
      return { stop: false };
    }

    const allowedWords = wordLimit - wordsEmitted;
    if (allowedWords <= 0) {
      truncated = true;
      return { stop: true };
    }

    const sliced = chunk.split(/\s+/).slice(0, allowedWords).join(' ');
    const lastEnd = Math.max(
      sliced.lastIndexOf('.'),
      sliced.lastIndexOf('!'),
      sliced.lastIndexOf('?'),
    );
    let final: string;
    if (lastEnd > 0) {
      final = sliced.slice(0, lastEnd + 1);
    } else {
      console.warn(`[brevity] Hard-cut, no sentence boundary (limit=${wordLimit}w)`);
      final = sliced;
    }
    if (final.trim()) {
      yield final;
      wordsEmitted += countWords(final);
    }
    truncated = true;
    return { stop: true };
  }

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
        const outChunk = buffer.slice(0, endPos).trim();
        buffer = buffer.slice(endPos).trimStart();
        if (outChunk) {
          const emitter = emitRespectingLimit(outChunk);
          let result = emitter.next();
          while (!result.done) {
            yield result.value;
            result = emitter.next();
          }
          if (result.value.stop) {
            // Abort upstream — we've hit the word budget.
            if (meta) meta.toolCalls = toolCallChunks.map(tc => tc.name);
            console.log(`[brevity] tokens=${effectiveMaxTokens} wordsEmitted=${wordsEmitted} truncated=true`);
            return;
          }
        }
      } else if (buffer.length > 60) {
        const commaPos = buffer.lastIndexOf(', ');
        if (commaPos > 20) {
          const outChunk = buffer.slice(0, commaPos + 1).trim();
          buffer = buffer.slice(commaPos + 2).trimStart();
          if (outChunk) {
            const emitter = emitRespectingLimit(outChunk);
            let result = emitter.next();
            while (!result.done) {
              yield result.value;
              result = emitter.next();
            }
            if (result.value.stop) {
              if (meta) meta.toolCalls = toolCallChunks.map(tc => tc.name);
              console.log(`[brevity] tokens=${effectiveMaxTokens} wordsEmitted=${wordsEmitted} truncated=true`);
              return;
            }
          }
        }
      }
    }
  }

  // Yield remaining buffer
  if (buffer.trim()) {
    const tail = buffer.trim();
    const emitter = emitRespectingLimit(tail);
    let result = emitter.next();
    while (!result.done) {
      yield result.value;
      result = emitter.next();
    }
    // Nothing to abort after this — stream is already done.
  }

  // Populate tool calls from collected stream chunks
  if (meta) {
    meta.toolCalls = toolCallChunks.map(tc => tc.name);
  }

  console.log(`[brevity] tokens=${effectiveMaxTokens} wordsEmitted=${wordsEmitted} truncated=${truncated}`);
}
