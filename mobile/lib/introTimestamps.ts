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
        "word": "welcome",
        "startMs": 860,
        "endMs": 1120
      },
      {
        "word": "to",
        "startMs": 1120,
        "endMs": 1420
      },
      {
        "word": "Reflexa",
        "startMs": 1420,
        "endMs": 1900
      }
    ]
  },
  {
    "segmentIndex": 1,
    "words": [
      {
        "word": "I'm",
        "startMs": 2400,
        "endMs": 2540
      },
      {
        "word": "your",
        "startMs": 2540,
        "endMs": 2740
      },
      {
        "word": "AI",
        "startMs": 2740,
        "endMs": 3080
      },
      {
        "word": "speaking",
        "startMs": 3080,
        "endMs": 3480
      },
      {
        "word": "coach",
        "startMs": 3480,
        "endMs": 3880
      }
    ]
  },
  {
    "segmentIndex": 2,
    "words": [
      {
        "word": "built",
        "startMs": 3880,
        "endMs": 4260
      },
      {
        "word": "to",
        "startMs": 4260,
        "endMs": 4440
      },
      {
        "word": "help",
        "startMs": 4440,
        "endMs": 4600
      },
      {
        "word": "you",
        "startMs": 4600,
        "endMs": 4860
      },
      {
        "word": "speak",
        "startMs": 4860,
        "endMs": 5020
      },
      {
        "word": "English",
        "startMs": 5020,
        "endMs": 5440
      },
      {
        "word": "with",
        "startMs": 5440,
        "endMs": 5700
      },
      {
        "word": "more",
        "startMs": 5700,
        "endMs": 6000
      },
      {
        "word": "clarity",
        "startMs": 6000,
        "endMs": 6300
      },
      {
        "word": "and",
        "startMs": 6300,
        "endMs": 6660
      },
      {
        "word": "confidence",
        "startMs": 6660,
        "endMs": 7180
      }
    ]
  },
  {
    "segmentIndex": 3,
    "words": [
      {
        "word": "Here's",
        "startMs": 8280,
        "endMs": 8960
      },
      {
        "word": "how",
        "startMs": 8960,
        "endMs": 9080
      },
      {
        "word": "it",
        "startMs": 9080,
        "endMs": 9240
      },
      {
        "word": "works",
        "startMs": 9240,
        "endMs": 9600
      }
    ]
  },
  {
    "segmentIndex": 4,
    "words": [
      {
        "word": "You",
        "startMs": 10600,
        "endMs": 11280
      },
      {
        "word": "talk",
        "startMs": 11280,
        "endMs": 11500
      },
      {
        "word": "to",
        "startMs": 11500,
        "endMs": 11680
      },
      {
        "word": "me",
        "startMs": 11680,
        "endMs": 11840
      },
      {
        "word": "like",
        "startMs": 11840,
        "endMs": 12200
      },
      {
        "word": "a",
        "startMs": 12200,
        "endMs": 12360
      },
      {
        "word": "real",
        "startMs": 12360,
        "endMs": 12620
      },
      {
        "word": "conversation",
        "startMs": 12620,
        "endMs": 13220
      }
    ]
  },
  {
    "segmentIndex": 5,
    "words": [
      {
        "word": "I",
        "startMs": 14060,
        "endMs": 14080
      },
      {
        "word": "listen",
        "startMs": 14080,
        "endMs": 14400
      },
      {
        "word": "I",
        "startMs": 14800,
        "endMs": 15380
      },
      {
        "word": "respond",
        "startMs": 15380,
        "endMs": 15380
      },
      {
        "word": "and",
        "startMs": 15600,
        "endMs": 15740
      },
      {
        "word": "behind",
        "startMs": 15740,
        "endMs": 15960
      },
      {
        "word": "the",
        "startMs": 15960,
        "endMs": 16340
      },
      {
        "word": "scenes",
        "startMs": 16340,
        "endMs": 16500
      }
    ]
  },
  {
    "segmentIndex": 6,
    "words": [
      {
        "word": "I'm",
        "startMs": 16740,
        "endMs": 17320
      },
      {
        "word": "analyzing",
        "startMs": 17320,
        "endMs": 17320
      },
      {
        "word": "your",
        "startMs": 17320,
        "endMs": 17780
      },
      {
        "word": "speech",
        "startMs": 17780,
        "endMs": 17860
      },
      {
        "word": "patterns",
        "startMs": 17860,
        "endMs": 18320
      }
    ]
  },
  {
    "segmentIndex": 7,
    "words": [
      {
        "word": "grammar",
        "startMs": 18980,
        "endMs": 18980
      },
      {
        "word": "filler",
        "startMs": 19320,
        "endMs": 19580
      },
      {
        "word": "words",
        "startMs": 19580,
        "endMs": 19960
      },
      {
        "word": "clarity",
        "startMs": 20620,
        "endMs": 20620
      },
      {
        "word": "all",
        "startMs": 21020,
        "endMs": 21260
      },
      {
        "word": "of",
        "startMs": 21260,
        "endMs": 21440
      },
      {
        "word": "it",
        "startMs": 21440,
        "endMs": 21840
      }
    ]
  },
  {
    "segmentIndex": 8,
    "words": [
      {
        "word": "After",
        "startMs": 22640,
        "endMs": 22860
      },
      {
        "word": "each",
        "startMs": 22860,
        "endMs": 23200
      },
      {
        "word": "session",
        "startMs": 23200,
        "endMs": 23480
      },
      {
        "word": "you",
        "startMs": 23660,
        "endMs": 23760
      },
      {
        "word": "get",
        "startMs": 23760,
        "endMs": 23880
      },
      {
        "word": "a",
        "startMs": 23880,
        "endMs": 24460
      },
      {
        "word": "detailed",
        "startMs": 24460,
        "endMs": 24460
      },
      {
        "word": "breakdown",
        "startMs": 24460,
        "endMs": 24880
      }
    ]
  },
  {
    "segmentIndex": 9,
    "words": [
      {
        "word": "of",
        "startMs": 24880,
        "endMs": 25360
      },
      {
        "word": "exactly",
        "startMs": 25360,
        "endMs": 25720
      },
      {
        "word": "what",
        "startMs": 25720,
        "endMs": 25920
      },
      {
        "word": "to",
        "startMs": 25920,
        "endMs": 26280
      },
      {
        "word": "work",
        "startMs": 26280,
        "endMs": 26280
      },
      {
        "word": "on",
        "startMs": 26280,
        "endMs": 26620
      }
    ]
  },
  {
    "segmentIndex": 10,
    "words": [
      {
        "word": "No",
        "startMs": 27230,
        "endMs": 27500
      },
      {
        "word": "generic",
        "startMs": 27500,
        "endMs": 27860
      },
      {
        "word": "tips",
        "startMs": 27860,
        "endMs": 28280
      },
      {
        "word": "just",
        "startMs": 28680,
        "endMs": 28820
      },
      {
        "word": "precise",
        "startMs": 28820,
        "endMs": 29280
      },
      {
        "word": "personalized",
        "startMs": 29980,
        "endMs": 29980
      },
      {
        "word": "feedback",
        "startMs": 29980,
        "endMs": 30480
      }
    ]
  },
  {
    "segmentIndex": 11,
    "words": [
      {
        "word": "based",
        "startMs": 30480,
        "endMs": 30840
      },
      {
        "word": "on",
        "startMs": 30840,
        "endMs": 31160
      },
      {
        "word": "how",
        "startMs": 31160,
        "endMs": 31320
      },
      {
        "word": "you",
        "startMs": 31320,
        "endMs": 31480
      },
      {
        "word": "actually",
        "startMs": 31480,
        "endMs": 32020
      },
      {
        "word": "speak",
        "startMs": 32020,
        "endMs": 32340
      }
    ]
  },
  {
    "segmentIndex": 12,
    "words": [
      {
        "word": "Before",
        "startMs": 33580,
        "endMs": 33740
      },
      {
        "word": "we",
        "startMs": 33740,
        "endMs": 34000
      },
      {
        "word": "begin",
        "startMs": 34000,
        "endMs": 34240
      }
    ]
  },
  {
    "segmentIndex": 13,
    "words": [
      {
        "word": "I'll",
        "startMs": 34700,
        "endMs": 34820
      },
      {
        "word": "need",
        "startMs": 34820,
        "endMs": 35000
      },
      {
        "word": "access",
        "startMs": 35000,
        "endMs": 35240
      },
      {
        "word": "to",
        "startMs": 35240,
        "endMs": 35440
      },
      {
        "word": "your",
        "startMs": 35440,
        "endMs": 35620
      },
      {
        "word": "microphone",
        "startMs": 35620,
        "endMs": 36040
      },
      {
        "word": "so",
        "startMs": 36040,
        "endMs": 36260
      },
      {
        "word": "I",
        "startMs": 36260,
        "endMs": 36380
      },
      {
        "word": "can",
        "startMs": 36380,
        "endMs": 36560
      },
      {
        "word": "listen",
        "startMs": 36560,
        "endMs": 36720
      },
      {
        "word": "to",
        "startMs": 36720,
        "endMs": 36940
      },
      {
        "word": "you",
        "startMs": 36940,
        "endMs": 37180
      },
      {
        "word": "speak",
        "startMs": 37180,
        "endMs": 37380
      },
      {
        "word": "Tap",
        "startMs": 38240,
        "endMs": 38260
      },
      {
        "word": "the",
        "startMs": 38260,
        "endMs": 38660
      },
      {
        "word": "button",
        "startMs": 38660,
        "endMs": 38660
      },
      {
        "word": "below",
        "startMs": 38660,
        "endMs": 38980
      },
      {
        "word": "to",
        "startMs": 38980,
        "endMs": 39380
      },
      {
        "word": "get",
        "startMs": 39380,
        "endMs": 39580
      },
      {
        "word": "started",
        "startMs": 39580,
        "endMs": 39860
      }
    ]
  }
];

export const ALL_WORDS: WordTiming[] = INTRO_SEGMENTS.flatMap(s => s.words);
