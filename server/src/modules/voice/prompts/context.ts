import type { FullUserContext } from '../handlers/types.js';

export function buildUserContextPrompt(userContext?: FullUserContext, agentId?: number | null): string {
  if (!userContext) return '';

  const { displayName, context, goals, contextNotes } = userContext;
  const isCustomAgent = agentId !== undefined && agentId !== null;

  const hasProfile = displayName || (!isCustomAgent && (context || (goals && goals.length > 0)));
  const hasNotes = contextNotes && contextNotes.length > 0;

  if (!hasProfile && !hasNotes) return '';

  const lines: string[] = ['USER CONTEXT (use naturally, do not recite):'];

  if (displayName) {
    lines.push(`- Their name is ${displayName}. Use it occasionally, not every response.`);
  }

  // Only Reflexa sees background and goals
  if (!isCustomAgent) {
    if (context) {
      lines.push(`- Background: ${context}`);
    }
    if (goals && goals.length > 0) {
      lines.push(`- Goals: ${goals.join(', ')}`);
    }
  }

  if (hasNotes) {
    // Filter notes by agent scope
    const filtered = isCustomAgent
      ? contextNotes!.filter(entry => entry.agentId === agentId)
      : contextNotes!; // Reflexa sees all notes

    const recent = filtered.slice(-10);
    if (recent.length > 0) {
      lines.push('');
      lines.push('THINGS YOU KNOW FROM PAST CONVERSATIONS:');
      for (const entry of recent) {
        for (const note of entry.notes) {
          lines.push(`- ${note}`);
        }
      }
    }
  }

  lines.push('');
  lines.push('Use this context naturally. Reference past topics when relevant to what the user brings up. Never recite facts back unprompted.');
  lines.push('When greeting (first message), you can use their name and briefly reference something you know. Keep it natural, 1-2 sentences.');

  return lines.join('\n');
}