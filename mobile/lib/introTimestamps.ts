export interface WordTiming {
  word: string;
  startMs: number;
  endMs: number;
}

export interface SegmentTimings {
  segmentIndex: number;
  words: WordTiming[];
}

export const INTRO_SEGMENTS: SegmentTimings[] = [
  {
    "segmentIndex": 0,
    "words": [
      {
        "word": "What",
        "startMs": 232,
        "endMs": 480
      },
      {
        "word": "if",
        "startMs": 480,
        "endMs": 573
      },
      {
        "word": "your",
        "startMs": 573,
        "endMs": 712
      },
      {
        "word": "biggest",
        "startMs": 712,
        "endMs": 1022
      },
      {
        "word": "speech",
        "startMs": 1022,
        "endMs": 1285
      },
      {
        "word": "habits",
        "startMs": 1285,
        "endMs": 1594
      }
    ]
  },
  {
    "segmentIndex": 1,
    "words": [
      {
        "word": "are",
        "startMs": 1594,
        "endMs": 1672
      },
      {
        "word": "the",
        "startMs": 1672,
        "endMs": 1765
      },
      {
        "word": "ones",
        "startMs": 1765,
        "endMs": 1981
      },
      {
        "word": "no",
        "startMs": 1981,
        "endMs": 2136
      },
      {
        "word": "one's",
        "startMs": 2136,
        "endMs": 2307
      },
      {
        "word": "ever",
        "startMs": 2307,
        "endMs": 2446
      },
      {
        "word": "mentioned?",
        "startMs": 2446,
        "endMs": 2926
      }
    ]
  },
  {
    "segmentIndex": 2,
    "words": [
      {
        "word": "I",
        "startMs": 3297,
        "endMs": 3406
      },
      {
        "word": "find",
        "startMs": 3406,
        "endMs": 3715
      },
      {
        "word": "them,",
        "startMs": 3715,
        "endMs": 3901
      },
      {
        "word": "and",
        "startMs": 3901,
        "endMs": 4087
      },
      {
        "word": "turn",
        "startMs": 4087,
        "endMs": 4288
      },
      {
        "word": "them",
        "startMs": 4288,
        "endMs": 4381
      },
      {
        "word": "into",
        "startMs": 4381,
        "endMs": 4536
      },
      {
        "word": "practice.",
        "startMs": 4536,
        "endMs": 5108
      }
    ]
  },
  {
    "segmentIndex": 3,
    "words": [
      {
        "word": "Welcome",
        "startMs": 5511,
        "endMs": 5836
      },
      {
        "word": "to",
        "startMs": 5836,
        "endMs": 5929
      },
      {
        "word": "Reflexa",
        "startMs": 5929,
        "endMs": 6177
      },
      {
        "word": "—",
        "startMs": 6177,
        "endMs": 6424
      },
      {
        "word": "tap",
        "startMs": 6749,
        "endMs": 6997
      },
      {
        "word": "below.",
        "startMs": 6997,
        "endMs": 7399
      }
    ]
  }
];

export const ALL_WORDS: WordTiming[] = INTRO_SEGMENTS.flatMap(s => s.words);
