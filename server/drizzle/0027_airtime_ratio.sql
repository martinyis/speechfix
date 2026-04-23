-- Add per-session AI/user airtime metric.
-- Shape: { aiWords, userWords, ratio } where
--   ratio = aiWords / (aiWords + userWords), or null when both are 0.
-- Nullable for legacy rows (no measurement was captured at session end).
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "airtime_ratio" jsonb;
ALTER TABLE "filler_coach_sessions" ADD COLUMN IF NOT EXISTS "airtime_ratio" jsonb;
