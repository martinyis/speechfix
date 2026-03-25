// Mock data for Patterns screen

export interface PatternCategory {
  id: string;
  name: string;
  score: number;
  trend: number; // positive = improvement, negative = regression
  description: string;
  color: string;
  occurrences: number;
}

export interface PatternInsight {
  id: string;
  value: string;
  description: string;
  trend: 'up' | 'down' | 'neutral';
}

export interface FeaturedPattern {
  id: string;
  label: string;
  title: string;
  subtitle: string;
  original: string;
  corrected: string;
  occurrences: number;
  trend: number;
}

export interface HeatMapDay {
  date: string;
  intensity: number; // 0-1
}

// ── Categories ──────────────────────────────────────────────

export const categories: PatternCategory[] = [
  {
    id: 'grammar',
    name: 'Grammar',
    score: 78,
    trend: 12,
    description: 'Subject-verb agreement, tense consistency',
    color: '#cc97ff',
    occurrences: 34,
  },
  {
    id: 'fillers',
    name: 'Fillers',
    score: 64,
    trend: -8,
    description: 'Um, uh, like, you know',
    color: '#ff6daf',
    occurrences: 21,
  },
  {
    id: 'pronunciation',
    name: 'Pronunciation',
    score: 82,
    trend: 5,
    description: 'Vowel clarity, consonant clusters',
    color: '#699cff',
    occurrences: 18,
  },
  {
    id: 'vocabulary',
    name: 'Vocabulary',
    score: 91,
    trend: 3,
    description: 'Word variety, precision',
    color: '#34d399',
    occurrences: 12,
  },
  {
    id: 'fluency',
    name: 'Fluency',
    score: 71,
    trend: 18,
    description: 'Speech rate, pause patterns',
    color: '#f59e0b',
    occurrences: 27,
  },
  {
    id: 'hedging',
    name: 'Hedging',
    score: 55,
    trend: -2,
    description: 'Tentative language, qualifiers',
    color: '#ff6e84',
    occurrences: 15,
  },
];

// ── Insights ────────────────────────────────────────────────

export const insights: PatternInsight[] = [
  {
    id: 'fillers-down',
    value: '34%',
    description: 'fewer filler words this week',
    trend: 'up',
  },
  {
    id: 'fluency-up',
    value: '2.1x',
    description: 'more fluent than last month',
    trend: 'up',
  },
  {
    id: 'streak',
    value: '12',
    description: 'day practice streak',
    trend: 'neutral',
  },
  {
    id: 'grammar-accuracy',
    value: '89%',
    description: 'grammar accuracy rate',
    trend: 'up',
  },
];

// ── Featured Pattern ────────────────────────────────────────

export const featuredPattern: FeaturedPattern = {
  id: 'featured-1',
  label: 'TRENDING PATTERN',
  title: 'Subject-Verb Agreement',
  subtitle: 'Most frequent correction this week',
  original: 'The team are working on it',
  corrected: 'The team is working on it',
  occurrences: 14,
  trend: 23,
};

// ── Heat Map (28 days) ──────────────────────────────────────

function generateHeatMap(): HeatMapDay[] {
  const days: HeatMapDay[] = [];
  const now = new Date();

  for (let i = 27; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dayOfWeek = date.getDay();

    // Realistic pattern: higher on weekdays, lower/zero on weekends
    let intensity: number;
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      intensity = Math.random() < 0.4 ? 0 : Math.random() * 0.4;
    } else {
      intensity = Math.random() < 0.1 ? 0 : 0.3 + Math.random() * 0.7;
    }

    days.push({
      date: date.toISOString().split('T')[0],
      intensity: Math.round(intensity * 100) / 100,
    });
  }

  return days;
}

export const heatMapData: HeatMapDay[] = generateHeatMap();
