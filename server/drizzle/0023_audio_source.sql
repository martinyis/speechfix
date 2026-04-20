-- Migration 0023: Add audio_source + audio_raw_path columns for hi-fi capture pipeline.
-- `audio_source` tracks which encoder produced the audio ('pcm' = legacy server-side
-- PCM capture via WebSocket, 'hifi' = client-side M4A upload). 'hifi' wins any race.
-- `audio_raw_path` holds the uploaded M4A (relative to AUDIO_ROOT) so the encoder
-- is idempotent and restartable after a server crash.
ALTER TABLE "sessions" ADD COLUMN "audio_source" text;
ALTER TABLE "sessions" ADD COLUMN "audio_raw_path" text;
