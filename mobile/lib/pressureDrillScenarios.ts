import type { Scenario } from '../types/pressureDrill';

export const SCENARIOS: readonly Scenario[] = [
  { slug: 'pitch_idea',          label: 'Pitch your idea',          subtitle: 'Startup, side project, or thesis' },
  { slug: 'explain_job',         label: 'Explain your job',         subtitle: 'To someone not in your field' },
  { slug: 'teach_concept',       label: 'Teach a concept',          subtitle: 'Something you know well' },
  { slug: 'tell_about_yourself', label: 'Tell me about yourself',   subtitle: 'Interview-style' },
  { slug: 'defend_opinion',      label: 'Defend an unpopular opinion', subtitle: 'Something you actually believe' },
  { slug: 'formative_story',     label: 'Tell a formative story',   subtitle: 'A moment that changed something' },
] as const;

export const DURATION_LABELS: Record<number, string> = {
  90: '90 s',
  180: '3 min',
  300: '5 min',
  420: '7 min',
};
