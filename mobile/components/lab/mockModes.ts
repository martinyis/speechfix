// Mock practice modes for Lab switcher prototypes
// 6 modes to stress-test scalability

export interface MockMode {
  key: string;
  label: string;
  icon: string;
  color: string;
  stat: string;
}

export const MOCK_MODES: MockMode[] = [
  { key: 'weak_spots', label: 'Weak Spots', icon: 'fitness-outline', color: '#ff6daf', stat: '12 due' },
  { key: 'filler_words', label: 'Filler Words', icon: 'chatbubbles-outline', color: '#699cff', stat: '3 tracked' },
  { key: 'patterns', label: 'Patterns', icon: 'repeat-outline', color: '#34d399', stat: '5 active' },
  { key: 'pronunciation', label: 'Pronunciation', icon: 'mic-outline', color: '#cc97ff', stat: '8 drills' },
  { key: 'vocabulary', label: 'Vocabulary', icon: 'book-outline', color: '#f59e0b', stat: '24 words' },
  { key: 'fluency', label: 'Fluency', icon: 'speedometer-outline', color: '#22d3ee', stat: '91 wpm' },
];
