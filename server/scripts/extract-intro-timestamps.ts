import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  const envPath = path.join(__dirname, '..', '.env');
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const match = envContent.match(/^OPENAI_API_KEY=(.+)$/m);
  if (!match) {
    console.error('OPENAI_API_KEY not found');
    process.exit(1);
  }
  process.env.OPENAI_API_KEY = match[1].trim();
}

const API_KEY = process.env.OPENAI_API_KEY!;

const SEGMENTS = [
  'Hey. Welcome to Reflexa.',
  "I'm your AI speaking coach,",
  'built to help you speak English with more clarity and confidence.',
  "Here's how it works.",
  'You talk to me, like a real conversation.',
  'I listen, I respond, and behind the scenes,',
  "I'm analyzing your speech patterns,",
  'grammar, filler words, clarity, all of it.',
  'After each session, you get a detailed breakdown',
  'of exactly what to work on.',
  'No generic tips. Just precise, personalized feedback',
  'based on how you actually speak.',
  'Before we begin,',
  "I'll need access to your microphone so I can listen to you speak. Tap the button below to get started.",
];

interface WhisperWord {
  word: string;
  start: number;
  end: number;
}

interface WhisperResponse {
  text: string;
  words: WhisperWord[];
}

function normalize(w: string): string {
  return w.toLowerCase().replace(/[^a-z0-9']/g, '');
}

function countWordsInSegment(segmentText: string): string[] {
  return segmentText
    .split(/\s+/)
    .filter(Boolean)
    .map(normalize)
    .filter(Boolean);
}

async function main() {
  const audioPath = path.join(__dirname, '..', '.cache', 'intro-audio.wav');
  if (!fs.existsSync(audioPath)) {
    console.error('Audio file not found:', audioPath);
    process.exit(1);
  }

  console.log('Sending audio to Whisper API...');

  const audioBuffer = fs.readFileSync(audioPath);
  const blob = new Blob([audioBuffer], { type: 'audio/wav' });

  const formData = new FormData();
  formData.append('file', blob, 'intro-audio.wav');
  formData.append('model', 'whisper-1');
  formData.append('response_format', 'verbose_json');
  formData.append('timestamp_granularities[]', 'word');

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Whisper API error:', response.status, errorText);
    process.exit(1);
  }

  const data = (await response.json()) as WhisperResponse;
  console.log('Transcript:', data.text);
  console.log('Word count:', data.words.length);

  // Map words to segments
  let whisperIdx = 0;
  const segmentTimings: Array<{
    segmentIndex: number;
    words: Array<{ word: string; startMs: number; endMs: number }>;
  }> = [];

  for (let segIdx = 0; segIdx < SEGMENTS.length; segIdx++) {
    const segmentNormWords = countWordsInSegment(SEGMENTS[segIdx]);
    const words: Array<{ word: string; startMs: number; endMs: number }> = [];

    for (let i = 0; i < segmentNormWords.length; i++) {
      if (whisperIdx >= data.words.length) {
        console.warn(`Ran out of Whisper words at segment ${segIdx}, expected word "${segmentNormWords[i]}"`);
        break;
      }

      const ww = data.words[whisperIdx];
      const normWhisper = normalize(ww.word);
      const expected = segmentNormWords[i];

      // Fuzzy match: if exact match fails, check if one contains the other
      if (normWhisper !== expected) {
        // Check if Whisper merged words or split them differently
        if (normWhisper.startsWith(expected) || expected.startsWith(normWhisper)) {
          // Close enough
        } else {
          console.warn(
            `Word mismatch at segment ${segIdx}: expected "${expected}", got "${normWhisper}" (whisper: "${ww.word}")`
          );
        }
      }

      words.push({
        word: ww.word,
        startMs: Math.round(ww.start * 1000),
        endMs: Math.round(ww.end * 1000),
      });
      whisperIdx++;
    }

    segmentTimings.push({ segmentIndex: segIdx, words });
  }

  if (whisperIdx < data.words.length) {
    console.warn(`${data.words.length - whisperIdx} Whisper words were not assigned to any segment`);
  }

  // Generate output file
  const outputPath = path.join(__dirname, '..', '..', 'mobile', 'lib', 'introTimestamps.ts');

  const segmentsJson = JSON.stringify(segmentTimings, null, 2);

  const output = `export interface WordTiming {
  word: string;
  startMs: number;
  endMs: number;
}

export interface SegmentTimings {
  segmentIndex: number;
  words: WordTiming[];
}

export const INTRO_SEGMENTS: SegmentTimings[] = ${segmentsJson};

export const ALL_WORDS: WordTiming[] = INTRO_SEGMENTS.flatMap(s => s.words);
`;

  fs.writeFileSync(outputPath, output, 'utf-8');
  console.log(`\nWrote ${outputPath}`);
  console.log(`Total segments: ${segmentTimings.length}`);
  console.log(`Total words: ${segmentTimings.reduce((acc, s) => acc + s.words.length, 0)}`);

  const lastWord = segmentTimings[segmentTimings.length - 1]?.words;
  if (lastWord?.length) {
    const lastMs = lastWord[lastWord.length - 1].endMs;
    console.log(`Audio spans ~${(lastMs / 1000).toFixed(1)}s`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
