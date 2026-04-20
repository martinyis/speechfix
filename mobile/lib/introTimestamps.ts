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
        "word": "Hey",
        "startMs": 0,
        "endMs": 360
      },
      {
        "word": "Welcome",
        "startMs": 1160,
        "endMs": 1280
      },
      {
        "word": "to",
        "startMs": 1280,
        "endMs": 1540
      },
      {
        "word": "Reflexa",
        "startMs": 1540,
        "endMs": 2000
      }
    ]
  },
  {
    "segmentIndex": 1,
    "words": [
      {
        "word": "I'm",
        "startMs": 2500,
        "endMs": 2680
      },
      {
        "word": "your",
        "startMs": 2680,
        "endMs": 2840
      },
      {
        "word": "AI",
        "startMs": 2840,
        "endMs": 3120
      },
      {
        "word": "speaking",
        "startMs": 3120,
        "endMs": 3500
      },
      {
        "word": "coach",
        "startMs": 3500,
        "endMs": 3820
      }
    ]
  },
  {
    "segmentIndex": 2,
    "words": [
      {
        "word": "built",
        "startMs": 4200,
        "endMs": 4240
      },
      {
        "word": "to",
        "startMs": 4240,
        "endMs": 4420
      },
      {
        "word": "help",
        "startMs": 4420,
        "endMs": 4580
      },
      {
        "word": "you",
        "startMs": 4580,
        "endMs": 4800
      },
      {
        "word": "speak",
        "startMs": 4800,
        "endMs": 4920
      },
      {
        "word": "English",
        "startMs": 4920,
        "endMs": 5220
      },
      {
        "word": "with",
        "startMs": 5220,
        "endMs": 5420
      },
      {
        "word": "more",
        "startMs": 5420,
        "endMs": 5740
      },
      {
        "word": "clarity",
        "startMs": 5740,
        "endMs": 5900
      },
      {
        "word": "and",
        "startMs": 5900,
        "endMs": 6180
      },
      {
        "word": "confidence",
        "startMs": 6180,
        "endMs": 6600
      }
    ]
  },
  {
    "segmentIndex": 3,
    "words": [
      {
        "word": "Here's",
        "startMs": 7260,
        "endMs": 7420
      },
      {
        "word": "how",
        "startMs": 7420,
        "endMs": 7520
      },
      {
        "word": "it",
        "startMs": 7520,
        "endMs": 7720
      },
      {
        "word": "works",
        "startMs": 7720,
        "endMs": 7940
      }
    ]
  },
  {
    "segmentIndex": 4,
    "words": [
      {
        "word": "You",
        "startMs": 8400,
        "endMs": 8540
      },
      {
        "word": "talk",
        "startMs": 8540,
        "endMs": 8720
      },
      {
        "word": "to",
        "startMs": 8720,
        "endMs": 8880
      },
      {
        "word": "me",
        "startMs": 8880,
        "endMs": 9040
      },
      {
        "word": "like",
        "startMs": 9320,
        "endMs": 9420
      },
      {
        "word": "a",
        "startMs": 9420,
        "endMs": 9560
      },
      {
        "word": "real",
        "startMs": 9560,
        "endMs": 9760
      },
      {
        "word": "conversation",
        "startMs": 9760,
        "endMs": 10280
      }
    ]
  },
  {
    "segmentIndex": 5,
    "words": [
      {
        "word": "I",
        "startMs": 11040,
        "endMs": 11160
      },
      {
        "word": "listen",
        "startMs": 11160,
        "endMs": 11460
      },
      {
        "word": "I",
        "startMs": 11820,
        "endMs": 12060
      },
      {
        "word": "respond",
        "startMs": 12060,
        "endMs": 12400
      },
      {
        "word": "And",
        "startMs": 12840,
        "endMs": 13000
      },
      {
        "word": "behind",
        "startMs": 13000,
        "endMs": 13160
      },
      {
        "word": "the",
        "startMs": 13160,
        "endMs": 13660
      },
      {
        "word": "scenes",
        "startMs": 13660,
        "endMs": 13660
      }
    ]
  },
  {
    "segmentIndex": 6,
    "words": [
      {
        "word": "I'm",
        "startMs": 13760,
        "endMs": 14360
      },
      {
        "word": "analyzing",
        "startMs": 14360,
        "endMs": 14360
      },
      {
        "word": "your",
        "startMs": 14360,
        "endMs": 14660
      },
      {
        "word": "speech",
        "startMs": 14660,
        "endMs": 14800
      },
      {
        "word": "patterns",
        "startMs": 14800,
        "endMs": 15180
      }
    ]
  },
  {
    "segmentIndex": 7,
    "words": [
      {
        "word": "grammar",
        "startMs": 15800,
        "endMs": 15800
      },
      {
        "word": "filler",
        "startMs": 16280,
        "endMs": 16400
      },
      {
        "word": "words",
        "startMs": 16400,
        "endMs": 16700
      },
      {
        "word": "clarity",
        "startMs": 17340,
        "endMs": 17340
      },
      {
        "word": "all",
        "startMs": 17600,
        "endMs": 17820
      },
      {
        "word": "of",
        "startMs": 17820,
        "endMs": 17960
      },
      {
        "word": "it",
        "startMs": 17960,
        "endMs": 18060
      }
    ]
  },
  {
    "segmentIndex": 8,
    "words": [
      {
        "word": "After",
        "startMs": 18660,
        "endMs": 18900
      },
      {
        "word": "each",
        "startMs": 18900,
        "endMs": 19180
      },
      {
        "word": "session",
        "startMs": 19180,
        "endMs": 19380
      },
      {
        "word": "you",
        "startMs": 19640,
        "endMs": 19960
      },
      {
        "word": "get",
        "startMs": 19960,
        "endMs": 20060
      },
      {
        "word": "a",
        "startMs": 20060,
        "endMs": 20300
      },
      {
        "word": "detailed",
        "startMs": 20300,
        "endMs": 20500
      },
      {
        "word": "breakdown",
        "startMs": 20500,
        "endMs": 20800
      }
    ]
  },
  {
    "segmentIndex": 9,
    "words": [
      {
        "word": "of",
        "startMs": 20800,
        "endMs": 21060
      },
      {
        "word": "exactly",
        "startMs": 21060,
        "endMs": 21340
      },
      {
        "word": "what",
        "startMs": 21340,
        "endMs": 21440
      },
      {
        "word": "to",
        "startMs": 21440,
        "endMs": 21760
      },
      {
        "word": "work",
        "startMs": 21760,
        "endMs": 21760
      },
      {
        "word": "on",
        "startMs": 21760,
        "endMs": 22080
      }
    ]
  },
  {
    "segmentIndex": 10,
    "words": [
      {
        "word": "No",
        "startMs": 22640,
        "endMs": 22820
      },
      {
        "word": "generic",
        "startMs": 22820,
        "endMs": 23140
      },
      {
        "word": "tips",
        "startMs": 23140,
        "endMs": 23480
      },
      {
        "word": "Just",
        "startMs": 24400,
        "endMs": 24620
      },
      {
        "word": "precise",
        "startMs": 24620,
        "endMs": 25140
      },
      {
        "word": "personalized",
        "startMs": 25940,
        "endMs": 25940
      },
      {
        "word": "feedback",
        "startMs": 25940,
        "endMs": 26400
      }
    ]
  },
  {
    "segmentIndex": 11,
    "words": [
      {
        "word": "based",
        "startMs": 26400,
        "endMs": 26740
      },
      {
        "word": "on",
        "startMs": 26740,
        "endMs": 26920
      },
      {
        "word": "how",
        "startMs": 26920,
        "endMs": 27020
      },
      {
        "word": "you",
        "startMs": 27020,
        "endMs": 27160
      },
      {
        "word": "actually",
        "startMs": 27160,
        "endMs": 27640
      },
      {
        "word": "speak",
        "startMs": 27640,
        "endMs": 27920
      }
    ]
  },
  {
    "segmentIndex": 12,
    "words": [
      {
        "word": "Before",
        "startMs": 28980,
        "endMs": 29140
      },
      {
        "word": "we",
        "startMs": 29140,
        "endMs": 29380
      },
      {
        "word": "begin",
        "startMs": 29380,
        "endMs": 29620
      }
    ]
  },
  {
    "segmentIndex": 13,
    "words": [
      {
        "word": "I'll",
        "startMs": 30100,
        "endMs": 30180
      },
      {
        "word": "need",
        "startMs": 30180,
        "endMs": 30380
      },
      {
        "word": "access",
        "startMs": 30380,
        "endMs": 30640
      },
      {
        "word": "to",
        "startMs": 30640,
        "endMs": 30840
      },
      {
        "word": "your",
        "startMs": 30840,
        "endMs": 30960
      },
      {
        "word": "microphone",
        "startMs": 30960,
        "endMs": 31360
      },
      {
        "word": "so",
        "startMs": 31360,
        "endMs": 31720
      },
      {
        "word": "I",
        "startMs": 31720,
        "endMs": 31820
      },
      {
        "word": "can",
        "startMs": 31820,
        "endMs": 31980
      },
      {
        "word": "listen",
        "startMs": 31980,
        "endMs": 32120
      },
      {
        "word": "to",
        "startMs": 32120,
        "endMs": 32280
      },
      {
        "word": "you",
        "startMs": 32280,
        "endMs": 32460
      },
      {
        "word": "speak",
        "startMs": 32460,
        "endMs": 32680
      },
      {
        "word": "Tap",
        "startMs": 33740,
        "endMs": 33760
      },
      {
        "word": "the",
        "startMs": 33760,
        "endMs": 34120
      },
      {
        "word": "button",
        "startMs": 34120,
        "endMs": 34120
      },
      {
        "word": "below",
        "startMs": 34120,
        "endMs": 34340
      },
      {
        "word": "to",
        "startMs": 34340,
        "endMs": 34480
      },
      {
        "word": "get",
        "startMs": 34480,
        "endMs": 34660
      },
      {
        "word": "started",
        "startMs": 34660,
        "endMs": 34880
      }
    ]
  }
];

export const ALL_WORDS: WordTiming[] = INTRO_SEGMENTS.flatMap(s => s.words);
