-- Patterns Redesign (Phase 1): state machine expansion.
--
-- Adds the `watching` + `mastered` states plus the metadata needed to
-- drive behavior-driven graduation. Keeps `practiced` value tolerated in
-- the text-based enum for backward compat (nothing writes it after this
-- migration, but old rows that somehow survive will still parse).

ALTER TABLE "speech_patterns"
  ADD COLUMN IF NOT EXISTS "mastered_at"          timestamp,
  ADD COLUMN IF NOT EXISTS "entered_watching_at"  timestamp,
  ADD COLUMN IF NOT EXISTS "clean_session_count"  integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "last_regressed_at"    timestamp,
  ADD COLUMN IF NOT EXISTS "dismissed_at"         timestamp;

-- Migrate any existing `practiced` rows into `watching` so they keep
-- participating in graduation tracking. Use completed_at as the synthetic
-- entered_watching_at so the counter has a reasonable anchor.
UPDATE "speech_patterns"
SET
  status = 'watching',
  entered_watching_at = COALESCE(entered_watching_at, completed_at, updated_at)
WHERE status = 'practiced';
