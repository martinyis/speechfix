-- Migration 0020: Add audio_path column to sessions for Pitch Ribbon playback (Phase 2).
-- Nullable — older sessions never had audio persisted, and new sessions have null
-- until the post-session encoder finishes.
ALTER TABLE "sessions" ADD COLUMN "audio_path" text;
