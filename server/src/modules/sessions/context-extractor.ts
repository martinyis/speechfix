import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

const SYSTEM_PROMPT = `Extract 1-3 key personal facts or context points from this conversation. These are things the AI should remember for future conversations to make them more personal and relevant.

Focus on:
- Life events: "preparing for a conference in April", "just moved to a new city"
- Personal details: "has a dog named Max", "works at a fintech startup"
- Interests: "interested in AI and machine learning", "loves cooking Italian food"
- Ongoing situations: "stressed about upcoming presentation", "excited about new job"
- Preferences: "prefers casual conversation topics", "wants to practice technical vocabulary"

Do NOT include:
- Speech quality observations (tracked separately by the analysis system)
- Generic statements that aren't personal ("talked about the weather")
- Things that are trivially obvious from the conversation topic
- Anything the user said as a hypothetical or while roleplaying

Return ONLY valid JSON. No markdown, no commentary.
{ "notes": ["note 1", "note 2"] }

If nothing noteworthy was said, return: { "notes": [] }`;

export async function extractConversationNotes(
  conversationHistory: ConversationMessage[],
): Promise<string[]> {
  const userMessages = conversationHistory.filter((m) => m.role === 'user');
  if (userMessages.length < 2) return [];

  let userMessage = 'CONVERSATION:\n';
  for (const msg of conversationHistory) {
    const label = msg.role === 'assistant' ? 'AI' : 'USER';
    userMessage += `[${label}]: ${msg.content}\n`;
  }

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') return [];

    let jsonText = textBlock.text.trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }

    const parsed = JSON.parse(jsonText);
    if (!Array.isArray(parsed.notes)) return [];

    return parsed.notes
      .filter((n: unknown) => typeof n === 'string' && n.length > 0)
      .slice(0, 3);
  } catch (err) {
    console.error('[context-extractor] Failed to extract context:', err);
    return [];
  }
}
