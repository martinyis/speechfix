import type { Correction, FillerWordCount, SessionInsight } from './types.js';

/** Strip markdown fences and parse JSON from an LLM response. */
export function parseJsonResponse(text: string): any {
  let jsonText = text.trim();
  if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  }
  return JSON.parse(jsonText);
}

/** Normalize a raw correction object from LLM output. */
export function normalizeCorrection(raw: any): Correction {
  return {
    sentenceIndex: raw.sentenceIndex ?? 0,
    originalText: raw.originalText ?? '',
    correctedText: raw.correctedText ?? '',
    explanation: raw.explanation ?? '',
    correctionType: raw.correctionType || raw.type || 'other',
    severity: ['error', 'improvement', 'polish'].includes(raw.severity) ? raw.severity : 'error',
    contextSnippet: raw.contextSnippet ?? '',
  };
}

/** Normalize fillerWords from various LLM output shapes. */
export function normalizeFillerWords(rawFillers: any): FillerWordCount[] {
  if (!rawFillers) return [];

  if (Array.isArray(rawFillers)) {
    return rawFillers
      .map((f: any) => ({
        word: f.word ?? f.name ?? f.filler ?? '',
        count: f.count ?? f.frequency ?? f.total ?? 1,
      }))
      .filter((f: FillerWordCount) => f.word !== '');
  }

  if (typeof rawFillers === 'object') {
    // Handle {"like": 3, "so": 2} shape
    return Object.entries(rawFillers).map(([word, count]) => ({
      word,
      count: typeof count === 'number' ? count : 1,
    }));
  }

  return [];
}

/** Normalize sessionInsights from LLM output. */
export function normalizeSessionInsights(raw: any[]): SessionInsight[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((i: any) => ({
    type: i.type ?? 'discourse_pattern',
    description: i.description ?? '',
  }));
}

/** Build the user message with optional conversation context. */
export function buildUserMessage(
  sentences: string[],
  mode: 'recording' | 'conversation',
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>,
  analysisInstruction?: string,
): string {
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

  const instruction = analysisInstruction ?? 'Analyze these speech sentences for grammar errors, naturalness issues, and patterns:';

  return `${conversationContext}${instruction}\n\n${numberedSentences}`;
}
