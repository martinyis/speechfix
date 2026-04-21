import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

export interface SessionMetadata {
  title: string;
  description: string;
  topicCategory: string;
}

const VALID_CATEGORIES = [
  'work', 'daily_life', 'travel', 'social',
  'education', 'technology', 'health', 'general',
] as const;

const SYSTEM_PROMPT = `You generate metadata for a speech practice session recording. Given the user's transcribed speech (and optionally conversation context), produce:

1. "title": 3-6 words describing the topic. Be specific and descriptive. Examples: "Weekend Trip to Boston", "Project Deadline Discussion", "Morning Routine Breakdown".
2. "description": One sentence summarizing what was discussed and the key linguistic finding (if any). Keep it under 120 characters. Match the tone of a precise, clinical speech analysis tool — never cheerful or encouraging. Example: "Discussed travel logistics for upcoming trip. Notable article usage patterns detected."
3. "topicCategory": Exactly one of: work, daily_life, travel, social, education, technology, health, general.

Return ONLY valid JSON. No markdown, no commentary.

{
  "title": "...",
  "description": "...",
  "topicCategory": "..."
}`;

export async function generateSessionMetadata(
  transcription: string,
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>,
): Promise<SessionMetadata> {
  const truncated = transcription.length > 2000
    ? transcription.slice(0, 2000) + '...'
    : transcription;

  let userMessage = '';
  if (conversationHistory && conversationHistory.length > 0) {
    userMessage += 'CONVERSATION CONTEXT:\n';
    for (const msg of conversationHistory.slice(0, 10)) {
      const label = msg.role === 'assistant' ? 'AI' : 'USER';
      userMessage += `[${label}]: ${msg.content.slice(0, 300)}\n`;
    }
    userMessage += '\n---\n\n';
  }
  userMessage += `USER TRANSCRIPTION:\n${truncated}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      return fallback(transcription);
    }

    let jsonText = textBlock.text.trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }

    const parsed = JSON.parse(jsonText);

    return {
      title: typeof parsed.title === 'string' ? parsed.title.slice(0, 255) : fallbackTitle(transcription),
      description: typeof parsed.description === 'string' ? parsed.description.slice(0, 500) : '',
      topicCategory: VALID_CATEGORIES.includes(parsed.topicCategory) ? parsed.topicCategory : 'general',
    };
  } catch (err) {
    console.error('[title-generator] Failed to generate session metadata:', err);
    return fallback(transcription);
  }
}

function fallback(transcription: string): SessionMetadata {
  return {
    title: fallbackTitle(transcription),
    description: '',
    topicCategory: 'general',
  };
}

function fallbackTitle(transcription: string): string {
  const words = transcription.trim().split(/\s+/).slice(0, 5);
  const title = words.join(' ');
  return title.length > 40 ? title.slice(0, 37) + '...' : title;
}
