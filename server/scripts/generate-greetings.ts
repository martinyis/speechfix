/**
 * One-time script to generate greeting audio files using ElevenLabs REST API.
 * Run with: npx tsx scripts/generate-greetings.ts
 *
 * Saves raw PCM 16kHz 16-bit mono files to assets/greetings/.
 * These files are loaded by the server at startup — no API calls needed at runtime.
 */
import 'dotenv/config';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const GREETINGS = [
  "Hey, what's up? If you wanna practice on your own, just hit the mute button and do your thing.",
  "Hey there! Feel free to chat with me, or if you'd rather practice solo, just mute me and go for it.",
  "What's up! I'm here to chat whenever you're ready. You can also mute me if you just wanna practice speaking on your own.",
  "Hey! Good to have you here. If you'd rather just talk on your own, hit that mute button, no worries at all.",
  "Oh hey! Whenever you're ready, we can just chat about whatever. Or feel free to mute me if you wanna go solo.",
  "Hey! How's it going? We can talk about anything you want. And if you'd rather just practice by yourself, go ahead and mute me.",
  "What's going on! I'm down to chat about whatever. Or you can mute me and just practice speaking, totally up to you.",
  "Hey, welcome! Just start talking whenever you're ready. You can also switch to speech mode if you wanna practice on your own.",
  "Oh hi! Nice to have you. We can have a conversation or you can go solo, just hit mute if you want.",
  "Hey! Ready when you are. If you just want some solo practice time, feel free to mute me and do your thing.",
];

const ASSETS_DIR = join(import.meta.dirname, '..', 'assets', 'greetings');

async function generateGreeting(text: string, index: number, apiKey: string, voiceId: string) {
  // output_format MUST be a query parameter, not in the JSON body
  const params = new URLSearchParams({ output_format: 'pcm_16000' });
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?${params}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_turbo_v2_5',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        speed: 1.0,
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`ElevenLabs API error ${response.status}: ${body}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const pcmBuffer = Buffer.from(arrayBuffer);

  // Save raw PCM file
  const pcmPath = join(ASSETS_DIR, `greeting-${index}.pcm`);
  writeFileSync(pcmPath, pcmBuffer);

  console.log(`[${index + 1}/${GREETINGS.length}] Saved ${pcmPath} (${pcmBuffer.length} bytes)`);
  return pcmBuffer.length;
}

async function main() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;

  if (!apiKey || !voiceId) {
    console.error('Missing ELEVENLABS_API_KEY or ELEVENLABS_VOICE_ID in .env');
    process.exit(1);
  }

  mkdirSync(ASSETS_DIR, { recursive: true });

  // Save metadata (text for each greeting)
  const metadata = GREETINGS.map((text, i) => ({ index: i, text, file: `greeting-${i}.pcm` }));
  writeFileSync(join(ASSETS_DIR, 'metadata.json'), JSON.stringify(metadata, null, 2));
  console.log(`Saved metadata.json with ${GREETINGS.length} greetings`);

  // Generate audio for each greeting
  let totalBytes = 0;
  for (let i = 0; i < GREETINGS.length; i++) {
    try {
      const bytes = await generateGreeting(GREETINGS[i], i, apiKey, voiceId);
      totalBytes += bytes;
    } catch (err) {
      console.error(`Failed to generate greeting ${i}:`, err);
    }
    // Small delay to avoid rate limiting
    if (i < GREETINGS.length - 1) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  console.log(`\nDone! Total audio: ${(totalBytes / 1024).toFixed(1)} KB`);
}

main();
