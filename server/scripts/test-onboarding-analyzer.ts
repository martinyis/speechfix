import 'dotenv/config';
import { analyzeOnboardingProfile } from '../src/modules/onboarding/profile-analyzer.js';
import { decideInitialFlags } from '../src/modules/practice/modes/decide-flags.js';
import type { AnalysisFlagKey, AnalysisFlags, SpeechSignals } from '../src/modules/practice/modes/types.js';

type Msg = { role: 'user' | 'assistant'; content: string };

interface Expect {
  isNative?: boolean;
  grammar?: boolean;
  fillers?: boolean;
  patterns?: boolean;
  minErrors?: number;
  maxErrors?: number;
  minFillers?: number;
  maxFillers?: number;
  minNativeConfidence?: number;
  maxNativeConfidence?: number;
}

interface Case {
  name: string;
  description: string;
  history: Msg[];
  expect: Expect;
}

const ai = (content: string): Msg => ({ role: 'assistant', content });
const user = (content: string): Msg => ({ role: 'user', content });

const CASES: Case[] = [
  {
    name: 'Native + heavy fillers',
    description: 'American native speaker with tons of um/like/you-know',
    history: [
      ai("Hey, nice to meet you. What's your name and what brings you here?"),
      user("Uh, yeah, so I'm Mike, and like, I basically um, I do a lot of presentations for like, my job, you know, and I just feel like I'm saying 'um' and 'like' way too much, it's kinda embarrassing honestly."),
      ai('Got it. What would you like to get better at specifically?'),
      user("Um, just like, sounding more polished I guess? Like when I'm in meetings, I want to, you know, stop rambling and just get to the point. I feel like I'm always hedging and stuff."),
    ],
    expect: { isNative: true, grammar: false, fillers: true, patterns: true, minNativeConfidence: 0.7, minFillers: 5 },
  },
  {
    name: 'Native + clean speech',
    description: 'Articulate native speaker, minimal fillers',
    history: [
      ai("Hey, nice to meet you. What's your name and what brings you here?"),
      user("I'm Sarah. I'm a trial lawyer, and I want to tighten up my delivery in front of juries. I sometimes feel my sentences wander when I'm thinking on my feet."),
      ai('Got it. What would you like to get better at specifically?'),
      user("Two things. First, keeping my arguments punchier — I tend to over-explain. Second, cutting hedging language like 'I think' and 'maybe' when I should sound certain."),
    ],
    expect: { isNative: true, grammar: false, patterns: true, minNativeConfidence: 0.8, maxErrors: 1 },
  },
  {
    name: 'Native + informal register (trap case)',
    description: 'Native speaker using "me and him", "ain\'t", dropped copulas — NOT errors',
    history: [
      ai("Hey, nice to meet you. What's your name and what brings you here?"),
      user("Yo, I'm Jamal. Me and my buddy Rick, we been tryna start a podcast, and I ain't gonna lie, every time I listen back I sound kinda all over the place."),
      ai('Got it. What would you like to get better at specifically?'),
      user("Man, I just wanna sound sharper. Like, I know I got the ideas, I just gotta stop ramblin'. My cousin, she roasted me last week said I sound like I'm thinkin' out loud the whole time."),
    ],
    expect: { isNative: true, grammar: false, patterns: true, minNativeConfidence: 0.75, maxErrors: 1 },
  },
  {
    name: 'Advanced non-native',
    description: 'Fluent non-native with occasional tells (on tomorrow, since 5 years)',
    history: [
      ai("Hey, nice to meet you. What's your name and what brings you here?"),
      user("Hi, I am Petra. I am working as a product manager since four years, and I have important presentation on tomorrow. I want to sound more confident and natural when I speak in English."),
      ai('Got it. What would you like to get better at specifically?'),
      user("I think my grammar is mostly okay, but sometimes I make small mistakes with the articles and tenses. Also I want to reduce the hesitation, because when I am nervous I speak slower and use more fillers."),
    ],
    expect: { isNative: false, grammar: true, patterns: true, maxNativeConfidence: 0.6, minErrors: 2 },
  },
  {
    name: 'Middle-level non-native',
    description: 'Clear but error-prone intermediate speaker',
    history: [
      ai("Hey, nice to meet you. What's your name and what brings you here?"),
      user("Hello, my name Andrei. I work on technology company since five years. I want improve my speaking for meeting because sometimes my colleague not understand me good."),
      ai('Got it. What would you like to get better at specifically?'),
      user("I want to speak more natural. I make many mistake with the grammar, and also I forget the article a lot of times. Also I want to learn how I can explain the technical things without using the broken sentence."),
    ],
    expect: { isNative: false, grammar: true, patterns: true, maxNativeConfidence: 0.4, minErrors: 4 },
  },
  {
    name: 'Beginner non-native',
    description: 'Many grammar errors, limited fluency',
    history: [
      ai("Hey, nice to meet you. What's your name and what brings you here?"),
      user("Hello. My name is Yuki. I want learn English for my work. I am not speak very good and I want improve."),
      ai('Got it. What would you like to get better at specifically?'),
      user("I want speak the English better. In my job I must to talk with client in English but I am afraid because I make many mistake. I want no afraid to speak."),
    ],
    expect: { isNative: false, grammar: true, patterns: true, maxNativeConfidence: 0.3, minErrors: 5 },
  },
];

// Colors for terminal output
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

function checkFlag(actual: boolean, expected: boolean | undefined, name: string): string[] {
  if (expected === undefined) return [];
  if (actual === expected) return [`${C.green}✓${C.reset} ${name}=${actual}`];
  return [`${C.red}✗${C.reset} ${name}=${actual} (expected ${expected})`];
}

function checkRange(
  actual: number,
  min: number | undefined,
  max: number | undefined,
  name: string,
): string[] {
  const fails: string[] = [];
  if (min !== undefined && actual < min) {
    fails.push(`${C.red}✗${C.reset} ${name}=${actual} < min ${min}`);
  } else if (min !== undefined) {
    fails.push(`${C.green}✓${C.reset} ${name}≥${min} (got ${actual})`);
  }
  if (max !== undefined && actual > max) {
    fails.push(`${C.red}✗${C.reset} ${name}=${actual} > max ${max}`);
  } else if (max !== undefined) {
    fails.push(`${C.green}✓${C.reset} ${name}≤${max} (got ${actual})`);
  }
  return fails;
}

function checkInvariants(flags: AnalysisFlags, nativeConfidence: number): string[] {
  const out: string[] = [];
  if (flags.patterns !== true) out.push(`${C.red}✗ invariant: patterns must always be ON${C.reset}`);
  else out.push(`${C.green}✓${C.reset} invariant: patterns=true`);

  if (!flags.grammar && !flags.fillers) out.push(`${C.red}✗ invariant: at least one of grammar/fillers must be ON${C.reset}`);
  else out.push(`${C.green}✓${C.reset} invariant: ≥1 of grammar/fillers ON`);

  if (nativeConfidence >= 0.7 && flags.grammar) {
    out.push(`${C.red}✗ invariant: grammar must NOT be auto-enabled for native (confidence=${nativeConfidence})${C.reset}`);
  } else if (nativeConfidence >= 0.7) {
    out.push(`${C.green}✓${C.reset} invariant: native (${nativeConfidence.toFixed(2)}) → grammar=false`);
  }
  return out;
}

async function runAnalyzerCases() {
  console.log(`${C.bold}${C.cyan}━━━ Analyzer + decision engine: 6 scenarios ━━━${C.reset}\n`);
  let pass = 0;
  let total = 0;

  for (const c of CASES) {
    console.log(`${C.bold}${C.blue}▸ ${c.name}${C.reset}  ${C.dim}${c.description}${C.reset}`);
    const res = await analyzeOnboardingProfile(c.history);
    if (!res.ok) {
      console.log(`  ${C.red}analyzer returned ok:false — reason=${res.reason}${C.reset}\n`);
      continue;
    }
    const s = res.signals;
    const flags = decideInitialFlags(s);

    console.log(
      `  signals: nativeConf=${s.nativeSpeakerConfidence.toFixed(2)}  errors=${s.grammarErrorCount}  fillers=${s.fillerWordCount}  words=${s.userWordCount}`,
    );
    console.log(`  flags:   grammar=${flags.grammar}  fillers=${flags.fillers}  patterns=${flags.patterns}`);
    if (s.reasoning) console.log(`  ${C.dim}reasoning: ${s.reasoning}${C.reset}`);

    const caseChecks: string[] = [];
    const expectedIsNative = c.expect.isNative === true;
    const actualIsNative = s.nativeSpeakerConfidence >= 0.7;
    if (c.expect.isNative !== undefined) {
      if (expectedIsNative === actualIsNative) caseChecks.push(`${C.green}✓${C.reset} isNative=${actualIsNative}`);
      else caseChecks.push(`${C.red}✗${C.reset} isNative=${actualIsNative} (expected ${expectedIsNative})`);
    }
    caseChecks.push(
      ...checkFlag(flags.grammar, c.expect.grammar, 'grammar'),
      ...checkFlag(flags.fillers, c.expect.fillers, 'fillers'),
      ...checkFlag(flags.patterns, c.expect.patterns, 'patterns'),
      ...checkRange(s.grammarErrorCount, c.expect.minErrors, c.expect.maxErrors, 'errors'),
      ...checkRange(s.fillerWordCount, c.expect.minFillers, c.expect.maxFillers, 'fillers-count'),
      ...checkRange(s.nativeSpeakerConfidence, c.expect.minNativeConfidence, c.expect.maxNativeConfidence, 'native-conf'),
    );

    const invariantChecks = checkInvariants(flags, s.nativeSpeakerConfidence);
    const allChecks = [...caseChecks, ...invariantChecks];
    for (const line of allChecks) console.log(`    ${line}`);

    const caseFailed = allChecks.some((l) => l.includes('✗'));
    if (!caseFailed) pass++;
    total++;
    console.log();
  }

  console.log(
    `${C.bold}Analyzer scenarios: ${pass === total ? C.green : C.yellow}${pass}/${total} passed${C.reset}\n`,
  );
  return { pass, total };
}

// Pure-logic unit tests for decideInitialFlags — no LLM, instant.
function runDecideUnitTests() {
  console.log(`${C.bold}${C.cyan}━━━ decideInitialFlags: 7 synthetic unit cases ━━━${C.reset}\n`);

  const mk = (partial: Partial<SpeechSignals>): SpeechSignals => ({
    nativeSpeakerConfidence: 0.5,
    grammarErrorCount: 0,
    fillerWordCount: 0,
    userWordCount: 100,
    version: 1,
    ...partial,
  });

  type Unit = {
    name: string;
    signals: SpeechSignals;
    expect: AnalysisFlags;
  };

  const units: Unit[] = [
    {
      name: 'non-native, high errors, high fillers → all three',
      signals: mk({ nativeSpeakerConfidence: 0.1, grammarErrorCount: 5, fillerWordCount: 5 }),
      expect: { grammar: true, fillers: true, patterns: true },
    },
    {
      name: 'non-native, high errors, low fillers → grammar+patterns',
      signals: mk({ nativeSpeakerConfidence: 0.1, grammarErrorCount: 5, fillerWordCount: 1 }),
      expect: { grammar: true, fillers: false, patterns: true },
    },
    {
      name: 'non-native, low errors, high fillers → fillers+patterns',
      signals: mk({ nativeSpeakerConfidence: 0.2, grammarErrorCount: 1, fillerWordCount: 5 }),
      expect: { grammar: false, fillers: true, patterns: true },
    },
    {
      name: 'native, low errors, high fillers → fillers+patterns',
      signals: mk({ nativeSpeakerConfidence: 0.9, grammarErrorCount: 1, fillerWordCount: 5 }),
      expect: { grammar: false, fillers: true, patterns: true },
    },
    {
      name: 'native, many informalities, low fillers → tiebreak picks fillers (never grammar for native)',
      signals: mk({ nativeSpeakerConfidence: 0.9, grammarErrorCount: 5, fillerWordCount: 1 }),
      expect: { grammar: false, fillers: true, patterns: true },
    },
    {
      name: 'native, zero of both → tiebreak picks fillers',
      signals: mk({ nativeSpeakerConfidence: 0.95, grammarErrorCount: 0, fillerWordCount: 0 }),
      expect: { grammar: false, fillers: true, patterns: true },
    },
    {
      name: 'non-native, zero of both → tiebreak picks fillers (higher priority than grammar)',
      signals: mk({ nativeSpeakerConfidence: 0.2, grammarErrorCount: 0, fillerWordCount: 0 }),
      expect: { grammar: false, fillers: true, patterns: true },
    },
  ];

  let pass = 0;
  for (const u of units) {
    const flags = decideInitialFlags(u.signals);
    const match =
      flags.grammar === u.expect.grammar &&
      flags.fillers === u.expect.fillers &&
      flags.patterns === u.expect.patterns;
    const invariantsOk =
      flags.patterns === true &&
      (flags.grammar || flags.fillers) &&
      !(u.signals.nativeSpeakerConfidence >= 0.7 && flags.grammar);
    const ok = match && invariantsOk;
    if (ok) pass++;
    const color = ok ? C.green : C.red;
    const mark = ok ? '✓' : '✗';
    console.log(
      `  ${color}${mark}${C.reset} ${u.name}\n     got:      ${JSON.stringify(flags)}\n     expected: ${JSON.stringify(u.expect)}`,
    );
  }
  console.log(
    `\n${C.bold}Unit tests: ${pass === units.length ? C.green : C.red}${pass}/${units.length} passed${C.reset}\n`,
  );
  return { pass, total: units.length };
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(`${C.red}ANTHROPIC_API_KEY not set in env — analyzer cases will fail${C.reset}`);
  }

  const unit = runDecideUnitTests();
  const live = await runAnalyzerCases();

  const totalPass = unit.pass + live.pass;
  const totalCount = unit.total + live.total;
  const ok = totalPass === totalCount;
  console.log(
    `${C.bold}${ok ? C.green : C.yellow}══ OVERALL: ${totalPass}/${totalCount} passed ══${C.reset}`,
  );
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
