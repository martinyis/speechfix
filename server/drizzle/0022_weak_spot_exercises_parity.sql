-- Migration 0022: Restructure weak_spot_exercises so each row matches the
-- correction shape (originalText / correctedText / explanation). Enables the
-- drill UI to render generated exercises identically to real corrections.
-- Dev DB is being wiped between phases, so no back-compat — we drop the old
-- prompt/target_rule columns outright.

ALTER TABLE "weak_spot_exercises" DROP COLUMN IF EXISTS "prompt";
ALTER TABLE "weak_spot_exercises" DROP COLUMN IF EXISTS "target_rule";

ALTER TABLE "weak_spot_exercises" ADD COLUMN "original_text" text NOT NULL;
ALTER TABLE "weak_spot_exercises" ADD COLUMN "corrected_text" text NOT NULL;
ALTER TABLE "weak_spot_exercises" ADD COLUMN "explanation" text;
