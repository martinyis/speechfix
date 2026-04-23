-- Pattern exercises: surrounding speech context.
--
-- Adds `full_context` — the sentences around the example pulled from the
-- user's real session transcript. The practice screen renders this faded
-- with `original_sentence` highlighted inside it, matching the weak-spot
-- drill's zoom-out → zoom-in treatment. Nullable so legacy rows keep
-- rendering via the old single-sentence fallback.

ALTER TABLE "pattern_exercises"
  ADD COLUMN IF NOT EXISTS "full_context" text;
