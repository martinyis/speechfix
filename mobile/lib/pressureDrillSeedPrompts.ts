import type { ScenarioSlug } from '../types/pressureDrill';

export const SEED_PROMPTS: Record<ScenarioSlug, readonly string[]> = {
  pitch_idea: [
    'Name the hardest trade-off.',
    'Who is the first paying user?',
    'What kills this in 6 months?',
    'Why now — why not 2 years ago?',
    'What does a skeptic get wrong?',
    'What would you do with $10M?',
  ],
  explain_job: [
    'Walk through yesterday, hour by hour.',
    'What do you actually produce?',
    'Who judges your work?',
    'Name the hardest part nobody sees.',
    'What metric defines success?',
    'Who uses what you make?',
  ],
  teach_concept: [
    'Give me a one-sentence analogy.',
    'Where does the concept break?',
    'What do beginners get wrong first?',
    'Explain it to a 12-year-old.',
    'Why does this matter in practice?',
    'Name a real-world example.',
  ],
  tell_about_yourself: [
    'What would a peer say about you?',
    'Name your biggest failure so far.',
    'Why this path and not another?',
    'What do you want next?',
    'Describe a turning point.',
    'What bores you?',
  ],
  defend_opinion: [
    'State the strongest counter-argument.',
    'What evidence do you rest on?',
    'What would change your mind?',
    'Cost of being wrong here?',
    'Name the minimum you would retreat to.',
    'Who agrees with you — and why?',
  ],
  formative_story: [
    'What did you believe before?',
    'Who else was there?',
    'What did you see — literally?',
    'What would you tell your past self?',
    'What did you stop doing afterward?',
    'Was there a single moment?',
  ],
};
