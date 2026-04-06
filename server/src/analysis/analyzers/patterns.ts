import Anthropic from '@anthropic-ai/sdk';
import type { PatternAnalysisInput, PatternAnalysisResult, SpeechPattern, PatternType } from '../types.js';

const anthropic = new Anthropic();

const VALID_TYPES: PatternType[] = [
  'overused_word',
  'repetitive_starter',
  'crutch_phrase',
  'hedging',
  'negative_framing',
];

const PATTERNS_SYSTEM_PROMPT = `You are a cross-session speech pattern analyzer. You receive transcripts from MULTIPLE speech sessions by the same user. Your job is to find recurring habits and patterns that appear across sessions — not one-off mistakes.

══════════════════════════════════════
PATTERN TYPES TO DETECT
══════════════════════════════════════

1. "overused_word" — A non-filler word used at abnormally high frequency across sessions. This includes intensifiers like "very", "really", "so", "extremely", "totally" when overused. Examples: "super", "thing", "literally", "basically", "very", "really". Set identifier to the word.

2. "repetitive_starter" — More than 30% of sentences starting with the same word/phrase across sessions. Examples: "So,", "I think", "And then". Set identifier to the starter phrase.

3. "crutch_phrase" — Multi-word expressions used repeatedly across sessions as a verbal crutch. Examples: "the thing is", "at the end of the day", "to be honest". Set identifier to the phrase.

4. "hedging" — Frequent qualifier stacking that weakens statements OR patterns of avoidance/noncommittal language. Examples: "I kind of maybe think", "sort of like", "try to", "maybe", "we'll see", "I'll look into it", "not sure but". Set identifier to null.

5. "negative_framing" — Consistently framing things negatively when positive framing would be more effective. High ratio of "can't", "don't", "won't", "problem", "issue" vs solution-oriented language. Set identifier to null.

══════════════════════════════════════
DETECTION CRITERIA
══════════════════════════════════════

- A pattern must appear in at least 3 sessions to be reported
- frequency: count of occurrences across all sessions (integer)
- sessionsAffected: number of sessions where the pattern appears (integer)
- severity: "low" (minor habit), "medium" (noticeable pattern), "high" (strongly affects communication)
- description: 1-2 sentences explaining the pattern and its impact
- examples: 2-4 exact quotes from the transcripts showing the pattern
- trend: always "new" (trend tracking is handled externally)

══════════════════════════════════════
OUTPUT FORMAT
══════════════════════════════════════

Return ONLY valid JSON. No markdown. No commentary.

{
  "patterns": [
    {
      "type": "overused_word",
      "identifier": "basically",
      "frequency": 14,
      "sessionsAffected": 3,
      "severity": "medium",
      "description": "\"Basically\" appears 14 times across 3 sessions, often used as a filler to introduce explanations.",
      "examples": ["So basically what happened was...", "It's basically the same thing"],
      "trend": "new"
    }
  ]
}

══════════════════════════════════════
RULES
══════════════════════════════════════

1. Only report patterns with evidence from 3+ sessions
2. Do NOT report filler words (um, uh, like-as-filler) — those are tracked separately
3. Be conservative — only flag patterns that genuinely affect communication quality
4. Maximum 10 patterns per analysis
5. If no patterns are found, return {"patterns": []}
6. examples must be EXACT substrings from the input transcripts`;

export async function analyzePatterns(input: PatternAnalysisInput): Promise<PatternAnalysisResult> {
  if (input.transcripts.length < 3) {
    return { patterns: [] };
  }

  const formattedTranscripts = input.transcripts
    .map((t) => `--- Session ${t.sessionId} ---\n${t.sentences.join('\n')}`)
    .join('\n\n');

  console.log(
    `[patterns-analyzer] Analyzing ${input.transcripts.length} sessions, ` +
      `${input.transcripts.reduce((sum, t) => sum + t.sentences.length, 0)} total sentences`,
  );

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: PATTERNS_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Analyze these speech transcripts from multiple sessions by the same speaker. Find recurring patterns:\n\n${formattedTranscripts}`,
        },
      ],
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      return { patterns: [] };
    }

    let parsed: { patterns?: unknown[] };
    try {
      parsed = JSON.parse(textBlock.text);
    } catch {
      console.error('[patterns-analyzer] Failed to parse JSON response');
      return { patterns: [] };
    }

    if (!Array.isArray(parsed.patterns)) {
      return { patterns: [] };
    }

    const patterns: SpeechPattern[] = parsed.patterns
      .filter((p: any) => VALID_TYPES.includes(p.type))
      .map((p: any) => ({
        type: p.type as PatternType,
        identifier: typeof p.identifier === 'string' ? p.identifier : null,
        frequency: typeof p.frequency === 'number' ? p.frequency : 0,
        sessionsAffected: typeof p.sessionsAffected === 'number' ? p.sessionsAffected : 0,
        severity: ['low', 'medium', 'high'].includes(p.severity) ? p.severity : 'low',
        description: typeof p.description === 'string' ? p.description : '',
        examples: Array.isArray(p.examples) ? p.examples.filter((e: unknown) => typeof e === 'string') : [],
        trend: 'new' as const,
      }));

    console.log(`[patterns-analyzer] Found ${patterns.length} patterns`);
    return { patterns };
  } catch (err) {
    console.error('[patterns-analyzer] Failed:', err);
    return { patterns: [] };
  }
}
