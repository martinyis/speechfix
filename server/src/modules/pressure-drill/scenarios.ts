import type { Scenario } from './types.js';

export const SCENARIOS: readonly Scenario[] = [
  {
    slug: 'pitch_idea',
    label: 'Pitch your idea',
    subtitle: 'Startup, side project, or thesis',
    systemHint:
      'The user is pitching an idea — a startup, side project, or thesis. Prompts should probe traction, differentiation, target user, pricing, objection-handling, and unit economics. Never repeat the same angle twice.',
  },
  {
    slug: 'explain_job',
    label: 'Explain your job',
    subtitle: 'To someone not in your field',
    systemHint:
      'The user is explaining their job to an outsider. Prompts should probe concrete artifacts (what they actually produce), the shape of their day, the hardest part, the metric they are judged on, and who consumes their output.',
  },
  {
    slug: 'teach_concept',
    label: 'Teach a concept',
    subtitle: 'Something you know well',
    systemHint:
      'The user is teaching a concept they know well. Prompts should push for analogy, for the most common misconception, for a worked example, for the boundary where the concept breaks down, and for why it matters outside the textbook.',
  },
  {
    slug: 'tell_about_yourself',
    label: 'Tell me about yourself',
    subtitle: 'Interview-style',
    systemHint:
      'The user is delivering an interview-style self-introduction. Prompts should push past the resume — motivation, a turning point, what they want next, what a peer would say they are best at, and a failure they learned from.',
  },
  {
    slug: 'defend_opinion',
    label: 'Defend an unpopular opinion',
    subtitle: 'Something you actually believe',
    systemHint:
      'The user is defending an opinion most people disagree with. Prompts should probe the strongest counter-argument, the evidence they rest on, the cost of being wrong, the minimal claim they would retreat to, and what would change their mind.',
  },
  {
    slug: 'formative_story',
    label: 'Tell a formative story',
    subtitle: 'A moment that changed something',
    systemHint:
      'The user is telling a story about a moment that changed them. Prompts should ask for sensory detail, the inner monologue at the key beat, who else was there, what they believed before vs after, and what they would tell their past self.',
  },
] as const;

export function getScenario(slug: string): Scenario | null {
  return SCENARIOS.find((s) => s.slug === slug) ?? null;
}
