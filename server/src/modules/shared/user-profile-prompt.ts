export interface UserProfileInput {
  context?: string | null;
  goals?: string[] | null;
}

/**
 * Builds a compact "USER PROFILE" block to prepend to analyzer / generator
 * system prompts. Collected during onboarding (`users.context` + `users.goals`)
 * so downstream AI calls know what the user is trying to fix and can weight
 * detection / generation toward those goals. Returns an empty string when
 * neither field is populated so callers can append unconditionally.
 */
export function buildUserProfileBlock(profile: UserProfileInput | null | undefined): string {
  if (!profile) return '';
  const context = typeof profile.context === 'string' ? profile.context.trim() : '';
  const goals = Array.isArray(profile.goals)
    ? profile.goals.map((g) => (typeof g === 'string' ? g.trim() : '')).filter(Boolean)
    : [];

  if (!context && goals.length === 0) return '';

  const lines: string[] = ['USER PROFILE'];
  if (context) lines.push(`Why they're using Reflexa: ${context}`);
  if (goals.length > 0) {
    lines.push('Their specific goals:');
    for (const g of goals) lines.push(`- ${g}`);
  }
  lines.push(
    'When analyzing or generating, weight your attention toward evidence related to these goals. Do not invent issues that are not present; just prioritize and frame what you find so it maps to what the user is trying to fix.',
  );
  return lines.join('\n');
}
