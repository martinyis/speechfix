import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

export interface ExtractedAgentConfig {
  name: string;
  systemPrompt: string;
  behaviorPrompt: string | null;
  agentMode: 'roleplay' | 'conversation';
}

const SYSTEM_PROMPT = `You extract an AI agent configuration from a conversation where a user described the agent they want to create. The agent will be used as a conversation partner in a chat app.

Extract:
1. "name": The agent's name as stated by the user. Use natural casing. If no name was given, invent a fitting one based on the described personality.

2. "systemPrompt": Write a complete identity prompt for this agent in second person ("You are..."). Include:
   - Who the agent is (name, role, personality)
   - How they speak (tone, style, energy level)
   - What they're like in conversation (topics they gravitate toward, how they respond)
   - Any specific character traits the user described
   Keep it 3-8 sentences. Make it vivid and specific enough to produce a consistent character.
   IMPORTANT: Do NOT mention anything about helping with English, speech improvement, language learning, or practice. The agent is purely a conversational character.

3. "behaviorPrompt": Optional additional conversation rules specific to this agent. Only include if the user described specific behavioral patterns like "always challenges my opinions" or "steers conversation toward professional topics." Set to null if no special behavioral rules were described. Do NOT repeat rules that apply to all agents (like keeping responses short).

4. "agentMode": Either "roleplay" or "conversation".
   - "roleplay": The user wants the agent to BE a character with a specific role that drives the interaction (interviewer, barista, debate opponent, teacher, customer service rep, doctor, coach running a session).
   - "conversation": The user wants a conversation partner with a personality or style (a chill friend, someone who likes talking about tech, an encouraging buddy).
   When in doubt, choose "roleplay" if the agent has a functional role that requires driving the conversation, "conversation" if it's purely a personality.

Return ONLY valid JSON. No markdown, no commentary.
{
  "name": "...",
  "systemPrompt": "...",
  "behaviorPrompt": "..." or null,
  "agentMode": "roleplay" or "conversation"
}`;

export async function extractAgentConfig(
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
): Promise<ExtractedAgentConfig> {
  let userMessage = 'AGENT CREATION CONVERSATION:\n';
  for (const msg of conversationHistory) {
    const label = msg.role === 'assistant' ? 'AI' : 'USER';
    userMessage += `[${label}]: ${msg.content}\n`;
  }

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text response from Claude');
    }

    let jsonText = textBlock.text.trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }

    const parsed = JSON.parse(jsonText);

    const agentMode = parsed.agentMode === 'roleplay' ? 'roleplay' as const : 'conversation' as const;

    return {
      name: typeof parsed.name === 'string' ? parsed.name.slice(0, 255) : 'Custom Agent',
      systemPrompt: typeof parsed.systemPrompt === 'string' ? parsed.systemPrompt : '',
      behaviorPrompt: typeof parsed.behaviorPrompt === 'string' ? parsed.behaviorPrompt : null,
      agentMode,
    };
  } catch (err) {
    console.error('[agent-config-extractor] Failed to extract config:', err);
    return {
      name: 'Custom Agent',
      systemPrompt: 'You are a friendly conversation partner who enjoys discussing a wide range of topics.',
      behaviorPrompt: null,
      agentMode: 'conversation',
    };
  }
}
