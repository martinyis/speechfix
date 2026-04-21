import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

export interface UserProfile {
  displayName: string | null;
  context: string | null;
  goals: string[];
}

const SYSTEM_PROMPT = `You extract a user profile from a voice onboarding conversation transcript. The user was asked about their name, what brings them to Reflexa (a speech improvement app), and their specific goals or pain points.

Extract:
1. "displayName": The user's first name as they stated it. If they didn't say a name, return null. Use natural casing (e.g., "Martin", not "martin").
2. "context": A 1-2 sentence summary of why they're using Reflexa, in third person. Example: "Product manager who gives frequent presentations and wants to sound more polished." If unclear, return null.
3. "goals": An array of 1-3 specific speech improvement goals extracted from what they said. Be specific and actionable. Examples: ["Reduce filler words in presentations", "Sound more concise in meetings", "Stop hedging with 'I think' and 'maybe'"]. If no clear goals, return an empty array.

Return ONLY valid JSON. No markdown, no commentary.

{
  "displayName": "...",
  "context": "...",
  "goals": ["..."]
}`;

export async function extractUserProfile(
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
): Promise<UserProfile> {
  let userMessage = 'ONBOARDING CONVERSATION:\n';
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
    if (!textBlock || textBlock.type !== 'text') {
      return { displayName: null, context: null, goals: [] };
    }

    let jsonText = textBlock.text.trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }

    const parsed = JSON.parse(jsonText);

    return {
      displayName: typeof parsed.displayName === 'string' ? parsed.displayName.slice(0, 255) : null,
      context: typeof parsed.context === 'string' ? parsed.context.slice(0, 1000) : null,
      goals: Array.isArray(parsed.goals) ? parsed.goals.filter((g: unknown) => typeof g === 'string').slice(0, 5) : [],
    };
  } catch (err) {
    console.error('[profile-extractor] Failed to extract profile:', err);
    return { displayName: null, context: null, goals: [] };
  }
}
