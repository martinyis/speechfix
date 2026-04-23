export const POSITIVES: readonly string[] = [
  'um', 'Um', 'UM',
  'uh', 'Uh',
  'uhh', 'Uhhh',
  'umm', 'UMM',
  'hmm', 'HMMM',
  'er', 'ER', 'Errr',
];

export const NEGATIVES: readonly string[] = [
  'uh-huh', 'mm-hmm', 'uh-uh',  // backchannels
  'mhm',                        // backchannel / agreement marker — NOT a filler
                                // (universally used as acknowledgment; flagging
                                //  produces false positives that destroy trust)
  'under', 'ugly', 'utter',     // starts with 'u' but not a filler
  'erm',                        // distinct word, user actually said "erm" — not in scope
  'uh huh',                     // space-separated backchannel
  'human', 'hurricane',         // starts with 'h' but not filler
  'so', 'like', 'you',          // ambiguous fillers — NOT detected real-time
  'actually', 'basically',
  '', '   ', '.',
];
