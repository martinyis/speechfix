import 'dotenv/config';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { db } from '../src/db/index.js';
import { users, sessions, corrections, fillerWords } from '../src/db/schema.js';
import { eq, desc } from 'drizzle-orm';
import { generateDeepInsights, type DeepInsightsInput } from '../src/modules/sessions/deep-insights.js';
import type { SpeechTimeline } from '../src/modules/voice/speech-types.js';

const EMAIL = process.argv[2] ?? 'test@gmail.com';
const LIMIT = Number(process.argv[3] ?? 10);
const MODEL = process.argv[4] ?? 'claude-opus-4-6';

const OUT_ROOT = path.resolve(process.cwd(), '..', '.planning', 'deep-insights-tests');
const RUN_DIR = path.join(
  OUT_ROOT,
  `${new Date().toISOString().replace(/[:.]/g, '-')}-${EMAIL.replace(/@.*/, '')}-${MODEL}`,
);

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
};

interface TurnLike {
  role?: string;
  text?: string;
  content?: string;
}

function normalizeTranscript(raw: unknown): Array<{ role: 'ai' | 'user'; text: string }> {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((turn: TurnLike) => {
      const role = (turn.role === 'user' ? 'user' : 'ai') as 'ai' | 'user';
      const text = (turn.text ?? turn.content ?? '').toString().trim();
      return { role, text };
    })
    .filter((t) => t.text.length > 0);
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(`${C.red}ANTHROPIC_API_KEY not set in env${C.reset}`);
    process.exit(1);
  }

  console.log(`${C.bold}${C.cyan}━━━ Deep Insights test runner ━━━${C.reset}`);
  console.log(`user:   ${EMAIL}`);
  console.log(`limit:  ${LIMIT}`);
  console.log(`model:  ${MODEL}`);
  console.log(`output: ${RUN_DIR}\n`);

  const [u] = await db.select().from(users).where(eq(users.email, EMAIL));
  if (!u) {
    console.error(`${C.red}User ${EMAIL} not found${C.reset}`);
    process.exit(1);
  }

  const recentSessions = await db
    .select()
    .from(sessions)
    .where(eq(sessions.userId, u.id))
    .orderBy(desc(sessions.createdAt))
    .limit(LIMIT);

  console.log(`${C.dim}Pulled ${recentSessions.length} sessions${C.reset}\n`);

  await fs.mkdir(RUN_DIR, { recursive: true });

  const summary: Array<{
    sessionId: number;
    title: string | null;
    topic: string | null;
    duration: number;
    insightCount: number;
    headlines: string[];
    durationMs: number;
    tokensIn?: number;
    tokensOut?: number;
  }> = [];

  for (const s of recentSessions) {
    const speechTimeline = (s.analysis as { speechTimeline?: SpeechTimeline } | null)?.speechTimeline;
    if (!speechTimeline) {
      console.log(`${C.yellow}▸ #${s.id} — no speechTimeline, skipping${C.reset}`);
      continue;
    }

    const transcript = normalizeTranscript(s.conversationTranscript);
    if (transcript.length === 0) {
      console.log(`${C.yellow}▸ #${s.id} — empty transcript, skipping${C.reset}`);
      continue;
    }

    const sessionCorrections = await db.select().from(corrections).where(eq(corrections.sessionId, s.id));
    const sessionFillers = await db.select().from(fillerWords).where(eq(fillerWords.sessionId, s.id));
    const fillerPositions = (s.analysis as { fillerPositions?: Array<{ word: string; sentenceIndex: number; time?: number | null }> } | null)?.fillerPositions ?? [];

    const input: DeepInsightsInput = {
      speechTimeline,
      conversationTranscript: transcript,
      corrections: sessionCorrections.map((c) => ({
        originalText: c.originalText,
        correctedText: c.correctedText,
        correctionType: c.correctionType,
        severity: c.severity,
      })),
      fillerWords: sessionFillers.map((f) => ({ word: f.word, count: f.count })),
      fillerPositions,
      topicCategory: s.topicCategory,
      sessionTitle: s.title,
      durationSeconds: s.durationSeconds,
    };

    console.log(`${C.bold}${C.blue}▸ #${s.id}${C.reset}  ${C.dim}${s.title ?? ''}${C.reset}`);
    console.log(`  ${C.dim}duration=${s.durationSeconds}s  topic=${s.topicCategory ?? '-'}  utterances=${speechTimeline.utterances.length}  prosody=${speechTimeline.prosodySamples.length}${C.reset}`);

    let result;
    try {
      result = await generateDeepInsights(input, { model: MODEL });
    } catch (err) {
      console.log(`  ${C.red}generation failed: ${(err as Error).message}${C.reset}\n`);
      continue;
    }

    console.log(`  ${C.dim}${result.durationMs}ms  tokens: ${result.promptTokens ?? '?'} → ${result.completionTokens ?? '?'}${C.reset}`);
    if (result.insights.length === 0) {
      console.log(`  ${C.yellow}(no insights produced)${C.reset}`);
    } else {
      for (const ins of result.insights) {
        const typeLabel = ins.type === 'specific' ? `${C.yellow}[specific]${C.reset}` : `${C.cyan}[overall]${C.reset} `;
        console.log(`  ${C.green}•${C.reset} ${typeLabel} ${C.bold}${ins.headline}${C.reset}`);
        console.log(`      ${C.dim}${ins.unpack}${C.reset}`);
        if (ins.anchor) {
          const a = ins.anchor;
          const anchorLine = `anchor: ${a.kind} [${a.start_seconds.toFixed(2)}s → ${a.end_seconds.toFixed(2)}s]${a.utterance_index !== undefined ? ` utt#${a.utterance_index}` : ''}${a.quoted_text ? ` "${a.quoted_text}"` : ''}`;
          console.log(`      ${C.dim}${anchorLine}${C.reset}`);
        }
        console.log(`      ${C.dim}signals: ${ins.signals_used.join(', ')}${C.reset}`);
      }
    }

    const filePayload = {
      sessionId: s.id,
      meta: {
        createdAt: s.createdAt,
        durationSeconds: s.durationSeconds,
        topicCategory: s.topicCategory,
        title: s.title,
      },
      input: {
        conversationTranscript: transcript,
        speechTimeline,
        corrections: input.corrections,
        fillerWords: input.fillerWords,
        fillerPositions,
      },
      prompt: {
        system: result.systemPrompt,
        user: result.userPrompt,
      },
      output: {
        model: result.model,
        insights: result.insights,
        raw: result.raw,
      },
      timings: {
        durationMs: result.durationMs,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
      },
    };

    const filePath = path.join(RUN_DIR, `session-${s.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(filePayload, null, 2), 'utf8');
    console.log(`  ${C.dim}→ ${path.relative(process.cwd(), filePath)}${C.reset}\n`);

    summary.push({
      sessionId: s.id,
      title: s.title,
      topic: s.topicCategory,
      duration: s.durationSeconds,
      insightCount: result.insights.length,
      headlines: result.insights.map((i) => `${i.type === 'specific' ? '[specific]' : '[overall] '} ${i.headline}`),
      durationMs: result.durationMs,
      tokensIn: result.promptTokens,
      tokensOut: result.completionTokens,
    });
  }

  const summaryPath = path.join(RUN_DIR, '_summary.json');
  await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2), 'utf8');

  const mdLines = [
    `# Deep Insights Test Run`,
    ``,
    `- **Email:** ${EMAIL}`,
    `- **Model:** ${MODEL}`,
    `- **Sessions processed:** ${summary.length}`,
    `- **Timestamp:** ${new Date().toISOString()}`,
    ``,
    `## Insights by session`,
    ``,
  ];
  for (const s of summary) {
    mdLines.push(`### Session #${s.sessionId} — ${s.title ?? '(no title)'}`);
    mdLines.push(`*${s.duration}s • ${s.topic ?? 'no topic'} • ${s.durationMs}ms gen • ${s.tokensIn}→${s.tokensOut} tokens*`);
    mdLines.push('');
    if (s.headlines.length === 0) {
      mdLines.push('_(no insights)_');
    } else {
      for (const h of s.headlines) mdLines.push(`- **${h}**`);
    }
    mdLines.push('');
  }
  await fs.writeFile(path.join(RUN_DIR, '_summary.md'), mdLines.join('\n'), 'utf8');

  console.log(`${C.bold}${C.green}━━━ Done ━━━${C.reset}`);
  console.log(`  ${summary.length} sessions processed`);
  console.log(`  ${summary.reduce((acc, s) => acc + s.insightCount, 0)} total insights generated`);
  console.log(`  output: ${RUN_DIR}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
