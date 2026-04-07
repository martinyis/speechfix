import { db } from '../db/index.js';
import { fillerCoachSessions } from '../db/schema.js';
import { eq, desc } from 'drizzle-orm';

// ── Topic Bank ────────────────────────────────────────────────────────

interface Topic {
  slug: string;
  topic: string;
  directive: string;
}

interface TopicLevel {
  level: number;
  label: string;
  topics: Topic[];
}

const TOPIC_BANK: TopicLevel[] = [
  {
    level: 1,
    label: 'Recall',
    topics: [
      { slug: 'weekend', topic: 'What you did this weekend', directive: 'Ask the user what they did this weekend. Be curious about details.' },
      { slug: 'morning-routine', topic: 'Morning routine', directive: 'Ask the user to walk you through their morning routine step by step.' },
      { slug: 'last-meal', topic: 'Last great meal', directive: 'Ask the user about the last really good meal they had — where, what, who with.' },
      { slug: 'recent-trip', topic: 'A recent trip', directive: 'Ask the user about a trip they took recently, even if it was just a day trip.' },
      { slug: 'childhood-memory', topic: 'A childhood memory', directive: 'Ask the user to describe a vivid memory from childhood.' },
      { slug: 'daily-commute', topic: 'Daily commute', directive: 'Ask the user to describe their daily commute or work-from-home setup.' },
      { slug: 'last-purchase', topic: 'Last big purchase', directive: 'Ask about something they bought recently that they thought about for a while.' },
      { slug: 'favorite-show', topic: 'A show or movie', directive: 'Ask the user about a show or movie they watched recently and what happened in it.' },
    ],
  },
  {
    level: 2,
    label: 'Opinion',
    topics: [
      { slug: 'remote-work', topic: 'Remote vs office work', directive: 'Ask the user what they think about remote work vs. working in an office.' },
      { slug: 'social-media', topic: 'Social media impact', directive: 'Ask whether the user thinks social media is more helpful or harmful overall.' },
      { slug: 'ai-future', topic: 'AI in daily life', directive: 'Ask the user how they feel about AI becoming part of everyday life.' },
      { slug: 'education-system', topic: 'Education system', directive: 'Ask what the user would change about the education system if they could.' },
      { slug: 'city-vs-rural', topic: 'City vs. countryside', directive: 'Ask whether the user prefers living in a city or somewhere quieter, and why.' },
      { slug: 'work-life-balance', topic: 'Work-life balance', directive: 'Ask the user what work-life balance means to them and if they have it.' },
      { slug: 'travel-value', topic: 'Value of travel', directive: 'Ask whether the user thinks travel is overrated or essential for personal growth.' },
      { slug: 'news-consumption', topic: 'How we consume news', directive: 'Ask how the user stays informed and whether they trust the news they read.' },
    ],
  },
  {
    level: 3,
    label: 'Explanation',
    topics: [
      { slug: 'explain-job', topic: 'Explain your job', directive: 'Ask the user to explain their job as if you know nothing about their field.' },
      { slug: 'teach-skill', topic: 'Teach me something', directive: 'Ask the user to teach you something they are good at — a skill, hobby, or concept.' },
      { slug: 'how-it-works', topic: 'How something works', directive: 'Ask the user to pick something they understand well and explain how it works.' },
      { slug: 'process-walkthrough', topic: 'A process you follow', directive: 'Ask the user to walk you through a process they follow at work or in a hobby.' },
      { slug: 'concept-breakdown', topic: 'Break down a concept', directive: 'Ask the user to explain a concept from their field that most people misunderstand.' },
      { slug: 'hobby-intro', topic: 'Introduce your hobby', directive: 'Ask the user to explain their favorite hobby as if recruiting you to try it.' },
      { slug: 'culture-explain', topic: 'Explain a cultural thing', directive: 'Ask the user to explain a cultural tradition or custom from their background.' },
      { slug: 'tech-explain', topic: 'Explain a technology', directive: 'Ask the user to explain a piece of technology they use daily to someone from the 1800s.' },
    ],
  },
  {
    level: 4,
    label: 'Persuasion',
    topics: [
      { slug: 'pitch-city', topic: 'Convince me to move', directive: 'Ask the user to convince you to move to their city or country.' },
      { slug: 'pitch-idea', topic: 'Pitch an idea', directive: 'Ask the user to pitch you an idea they believe in — a product, a change, anything.' },
      { slug: 'defend-opinion', topic: 'Defend an unpopular opinion', directive: 'Ask the user to share and defend an opinion they hold that most people disagree with.' },
      { slug: 'sell-book', topic: 'Sell me a book', directive: 'Ask the user to convince you to read their favorite book without spoiling it.' },
      { slug: 'career-change', topic: 'Convince me to switch careers', directive: 'Ask the user to convince you to switch to their career or field of work.' },
      { slug: 'lifestyle-pitch', topic: 'Pitch a lifestyle change', directive: 'Ask the user to convince you to adopt a habit or lifestyle change they believe in.' },
      { slug: 'debate-take', topic: 'Take a side', directive: 'Present a debate topic and ask the user to pick a side and argue for it convincingly.' },
      { slug: 'negotiate', topic: 'Negotiate with me', directive: 'Set up a simple negotiation scenario and ask the user to make their case persuasively.' },
    ],
  },
];

// ── Level Determination ───────────────────────────────────────────────

interface SessionRow {
  cognitiveLevel: number | null;
  totalFillerCount: number;
  durationSeconds: number;
}

function fillersPerMin(totalFillers: number, durationSeconds: number): number {
  const mins = Math.max(durationSeconds / 60, 0.5);
  return totalFillers / mins;
}

function determineCognitiveLevel(sessions: SessionRow[]): number {
  if (sessions.length < 3) return 1;

  // Current level = most recent non-null cognitive level, or 1
  const currentLevel = sessions.find(s => s.cognitiveLevel !== null)?.cognitiveLevel ?? 1;

  // Last 3 sessions
  const recent = sessions.slice(0, 3);
  const avgRate = recent.reduce((sum, s) => sum + fillersPerMin(s.totalFillerCount, s.durationSeconds), 0) / recent.length;

  // Count sessions at current level
  const sessionsAtLevel = sessions.filter(s => s.cognitiveLevel === currentLevel).length;

  // Check trend: are recent rates improving? (lower is better)
  const rates = recent.map(s => fillersPerMin(s.totalFillerCount, s.durationSeconds));
  const improving = rates.length >= 2 && rates[0] <= rates[rates.length - 1];

  // Advance conditions
  if (improving && sessionsAtLevel >= 2 && avgRate < 4 && currentLevel < 4) {
    return currentLevel + 1;
  }

  // Regress conditions
  if (avgRate > 6 && currentLevel > 1) {
    return currentLevel - 1;
  }

  return currentLevel;
}

// ── Main Export ────────────────────────────────────────────────────────

export interface TopicSelection {
  level: number;
  levelLabel: string;
  topic: string;
  topicSlug: string;
  directive: string;
}

export async function selectTopic(userId: number): Promise<TopicSelection> {
  // Fetch last 10 coach sessions
  const recentSessions = await db
    .select({
      cognitiveLevel: fillerCoachSessions.cognitiveLevel,
      topicSlug: fillerCoachSessions.topicSlug,
      totalFillerCount: fillerCoachSessions.totalFillerCount,
      durationSeconds: fillerCoachSessions.durationSeconds,
    })
    .from(fillerCoachSessions)
    .where(eq(fillerCoachSessions.userId, userId))
    .orderBy(desc(fillerCoachSessions.createdAt))
    .limit(10);

  const level = determineCognitiveLevel(recentSessions);
  const levelData = TOPIC_BANK.find(l => l.level === level) ?? TOPIC_BANK[0];

  // Exclude recently used slugs (last 3)
  const recentSlugs = recentSessions
    .slice(0, 3)
    .map(s => s.topicSlug)
    .filter(Boolean);

  const availableTopics = levelData.topics.filter(t => !recentSlugs.includes(t.slug));
  const pool = availableTopics.length > 0 ? availableTopics : levelData.topics;

  // Random pick from available
  const picked = pool[Math.floor(Math.random() * pool.length)];

  return {
    level,
    levelLabel: levelData.label,
    topic: picked.topic,
    topicSlug: picked.slug,
    directive: picked.directive,
  };
}
