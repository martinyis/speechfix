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
        "endMs": 300
      },
      {
        "word": "welcome",
        "startMs": 500,
        "endMs": 780
      },
      {
        "word": "to",
        "startMs": 780,
        "endMs": 1040
      },
      {
        "word": "Reflexa",
        "startMs": 1040,
        "endMs": 1420
      }
    ]
  },
  {
    "segmentIndex": 1,
    "words": [
      {
        "word": "I'm",
        "startMs": 1560,
        "endMs": 1760
      },
      {
        "word": "your",
        "startMs": 1760,
        "endMs": 1900
      },
      {
        "word": "AI",
        "startMs": 1900,
        "endMs": 2200
      },
      {
        "word": "speaking",
        "startMs": 2200,
        "endMs": 2500
      },
      {
        "word": "coach",
        "startMs": 2500,
        "endMs": 2800
      }
    ]
  },
  {
    "segmentIndex": 2,
    "words": [
      {
        "word": "built",
        "startMs": 2880,
        "endMs": 3040
      },
      {
        "word": "to",
        "startMs": 3040,
        "endMs": 3180
      },
      {
        "word": "help",
        "startMs": 3180,
        "endMs": 3280
      },
      {
        "word": "you",
        "startMs": 3280,
        "endMs": 3460
      },
      {
        "word": "speak",
        "startMs": 3460,
        "endMs": 3560
      },
      {
        "word": "English",
        "startMs": 3560,
        "endMs": 3780
      },
      {
        "word": "with",
        "startMs": 3780,
        "endMs": 3980
      },
      {
        "word": "more",
        "startMs": 3980,
        "endMs": 4320
      },
      {
        "word": "clarity",
        "startMs": 4320,
        "endMs": 4380
      },
      {
        "word": "and",
        "startMs": 4380,
        "endMs": 4700
      },
      {
        "word": "confidence",
        "startMs": 4700,
        "endMs": 4960
      }
    ]
  },
  {
    "segmentIndex": 3,
    "words": [
      {
        "word": "Here's",
        "startMs": 5300,
        "endMs": 5460
      },
      {
        "word": "how",
        "startMs": 5460,
        "endMs": 5560
      },
      {
        "word": "it",
        "startMs": 5560,
        "endMs": 5940
      },
      {
        "word": "works",
        "startMs": 5940,
        "endMs": 5940
      }
    ]
  },
  {
    "segmentIndex": 4,
    "words": [
      {
        "word": "You",
        "startMs": 6020,
        "endMs": 6240
      },
      {
        "word": "talk",
        "startMs": 6240,
        "endMs": 6340
      },
      {
        "word": "to",
        "startMs": 6340,
        "endMs": 6460
      },
      {
        "word": "me",
        "startMs": 6460,
        "endMs": 6540
      },
      {
        "word": "like",
        "startMs": 6540,
        "endMs": 6660
      },
      {
        "word": "a",
        "startMs": 6660,
        "endMs": 6760
      },
      {
        "word": "real",
        "startMs": 6760,
        "endMs": 6940
      },
      {
        "word": "conversation",
        "startMs": 6940,
        "endMs": 7340
      }
    ]
  },
  {
    "segmentIndex": 5,
    "words": [
      {
        "word": "I",
        "startMs": 7720,
        "endMs": 7900
      },
      {
        "word": "listen",
        "startMs": 7900,
        "endMs": 8100
      },
      {
        "word": "I",
        "startMs": 8420,
        "endMs": 8900
      },
      {
        "word": "respond",
        "startMs": 8900,
        "endMs": 8900
      },
      {
        "word": "and",
        "startMs": 9020,
        "endMs": 9260
      },
      {
        "word": "behind",
        "startMs": 9260,
        "endMs": 9360
      },
      {
        "word": "the",
        "startMs": 9360,
        "endMs": 9840
      },
      {
        "word": "scenes",
        "startMs": 9840,
        "endMs": 9840
      }
    ]
  },
  {
    "segmentIndex": 6,
    "words": [
      {
        "word": "I'm",
        "startMs": 10080,
        "endMs": 10560
      },
      {
        "word": "analyzing",
        "startMs": 10560,
        "endMs": 10560
      },
      {
        "word": "your",
        "startMs": 10560,
        "endMs": 10920
      },
      {
        "word": "speech",
        "startMs": 10920,
        "endMs": 10920
      },
      {
        "word": "patterns",
        "startMs": 10920,
        "endMs": 11220
      }
    ]
  },
  {
    "segmentIndex": 7,
    "words": [
      {
        "word": "grammar",
        "startMs": 11620,
        "endMs": 11620
      },
      {
        "word": "filler",
        "startMs": 11800,
        "endMs": 11980
      },
      {
        "word": "words",
        "startMs": 11980,
        "endMs": 12220
      },
      {
        "word": "clarity",
        "startMs": 12620,
        "endMs": 12620
      },
      {
        "word": "all",
        "startMs": 12720,
        "endMs": 12840
      },
      {
        "word": "of",
        "startMs": 12840,
        "endMs": 12940
      },
      {
        "word": "it",
        "startMs": 12940,
        "endMs": 13160
      }
    ]
  },
  {
    "segmentIndex": 8,
    "words": [
      {
        "word": "After",
        "startMs": 13620,
        "endMs": 13800
      },
      {
        "word": "each",
        "startMs": 13800,
        "endMs": 14080
      },
      {
        "word": "session",
        "startMs": 14080,
        "endMs": 14260
      },
      {
        "word": "you",
        "startMs": 14340,
        "endMs": 14440
      },
      {
        "word": "get",
        "startMs": 14440,
        "endMs": 14540
      },
      {
        "word": "a",
        "startMs": 14540,
        "endMs": 14920
      },
      {
        "word": "detailed",
        "startMs": 14920,
        "endMs": 14920
      },
      {
        "word": "breakdown",
        "startMs": 14920,
        "endMs": 15180
      }
    ]
  },
  {
    "segmentIndex": 9,
    "words": [
      {
        "word": "of",
        "startMs": 15180,
        "endMs": 15400
      },
      {
        "word": "exactly",
        "startMs": 15400,
        "endMs": 15600
      },
      {
        "word": "what",
        "startMs": 15600,
        "endMs": 15740
      },
      {
        "word": "to",
        "startMs": 15740,
        "endMs": 15960
      },
      {
        "word": "work",
        "startMs": 15960,
        "endMs": 16000
      },
      {
        "word": "on",
        "startMs": 16000,
        "endMs": 16240
      }
    ]
  },
  {
    "segmentIndex": 10,
    "words": [
      {
        "word": "No",
        "startMs": 16420,
        "endMs": 16600
      },
      {
        "word": "generic",
        "startMs": 16600,
        "endMs": 16820
      },
      {
        "word": "tips",
        "startMs": 16820,
        "endMs": 17100
      },
      {
        "word": "just",
        "startMs": 17540,
        "endMs": 17800
      },
      {
        "word": "precise",
        "startMs": 17800,
        "endMs": 18200
      },
      {
        "word": "personalized",
        "startMs": 18800,
        "endMs": 18800
      },
      {
        "word": "feedback",
        "startMs": 18800,
        "endMs": 19120
      }
    ]
  },
  {
    "segmentIndex": 11,
    "words": [
      {
        "word": "based",
        "startMs": 19120,
        "endMs": 19340
      },
      {
        "word": "on",
        "startMs": 19340,
        "endMs": 19480
      },
      {
        "word": "how",
        "startMs": 19480,
        "endMs": 19580
      },
      {
        "word": "you",
        "startMs": 19580,
        "endMs": 19720
      },
      {
        "word": "actually",
        "startMs": 19720,
        "endMs": 20020
      },
      {
        "word": "speak",
        "startMs": 20020,
        "endMs": 20260
      }
    ]
  },
  {
    "segmentIndex": 12,
    "words": [
      {
        "word": "Before",
        "startMs": 21080,
        "endMs": 21220
      },
      {
        "word": "we",
        "startMs": 21220,
        "endMs": 21460
      },
      {
        "word": "begin",
        "startMs": 21460,
        "endMs": 21640
      }
    ]
  },
  {
    "segmentIndex": 13,
    "words": [
      {
        "word": "I'll",
        "startMs": 21760,
        "endMs": 22040
      },
      {
        "word": "need",
        "startMs": 22040,
        "endMs": 22180
      },
      {
        "word": "access",
        "startMs": 22180,
        "endMs": 22400
      },
      {
        "word": "to",
        "startMs": 22400,
        "endMs": 22560
      },
      {
        "word": "your",
        "startMs": 22560,
        "endMs": 22760
      },
      {
        "word": "microphone",
        "startMs": 22760,
        "endMs": 22940
      },
      {
        "word": "so",
        "startMs": 22940,
        "endMs": 23080
      },
      {
        "word": "I",
        "startMs": 23080,
        "endMs": 23180
      },
      {
        "word": "can",
        "startMs": 23180,
        "endMs": 23360
      },
      {
        "word": "listen",
        "startMs": 23360,
        "endMs": 23420
      },
      {
        "word": "to",
        "startMs": 23420,
        "endMs": 23600
      },
      {
        "word": "you",
        "startMs": 23600,
        "endMs": 23780
      },
      {
        "word": "speak",
        "startMs": 23780,
        "endMs": 23900
      },
      {
        "word": "Tap",
        "startMs": 24540,
        "endMs": 24620
      },
      {
        "word": "the",
        "startMs": 24620,
        "endMs": 24980
      },
      {
        "word": "button",
        "startMs": 24980,
        "endMs": 24980
      },
      {
        "word": "below",
        "startMs": 24980,
        "endMs": 25120
      },
      {
        "word": "to",
        "startMs": 25120,
        "endMs": 25260
      },
      {
        "word": "get",
        "startMs": 25260,
        "endMs": 25500
      },
      {
        "word": "started",
        "startMs": 25500,
        "endMs": 25640
      }
    ]
  }
];

export const ALL_WORDS: WordTiming[] = INTRO_SEGMENTS.flatMap(s => s.words);
