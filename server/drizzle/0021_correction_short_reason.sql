-- Migration 0021: Add short_reason column to corrections.
-- 2-4 word sentence-specific tag emitted by the grammar LLM (e.g. "missing 'to'",
-- "wrong tense"). Nullable — older corrections never had it, and the field is a
-- progressive enhancement (frontend falls back to extractShortReason on the
-- explanation when null).
ALTER TABLE "corrections" ADD COLUMN "short_reason" text;
