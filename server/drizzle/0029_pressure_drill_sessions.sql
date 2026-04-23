-- Pressure Drill migration: renames filler_coach_sessions → pressure_drill_sessions,
-- drops filler-coach-only columns, adds pressure-drill columns.
-- Existing rows preserved. Historical rows get sensible defaults for new NOT NULL cols.

BEGIN;

-- 1. Rename the table.
ALTER TABLE "filler_coach_sessions" RENAME TO "pressure_drill_sessions";

-- 2. Drop filler-coach-only columns (order: any that have constraints first; these don't).
ALTER TABLE "pressure_drill_sessions" DROP COLUMN IF EXISTS "cognitive_level";
ALTER TABLE "pressure_drill_sessions" DROP COLUMN IF EXISTS "topic_slug";
ALTER TABLE "pressure_drill_sessions" DROP COLUMN IF EXISTS "airtime_ratio";

-- 3. Add new columns.
--    scenario_slug: nullable during backfill, then backfilled and set NOT NULL.
ALTER TABLE "pressure_drill_sessions" ADD COLUMN "scenario_slug" varchar(50);

--    duration_selected_seconds: nullable during backfill; historic rows get
--    the closest duration preset to their actual duration.
ALTER TABLE "pressure_drill_sessions" ADD COLUMN "duration_selected_seconds" integer;

--    prompts_shown: defaults to empty array for historic rows.
ALTER TABLE "pressure_drill_sessions"
  ADD COLUMN "prompts_shown" jsonb NOT NULL DEFAULT '[]'::jsonb;

--    longest_clean_streak_seconds: defaults to 0 for historic rows (unknown).
ALTER TABLE "pressure_drill_sessions"
  ADD COLUMN "longest_clean_streak_seconds" integer NOT NULL DEFAULT 0;

--    within_session_trend: zero-filled for historic rows.
ALTER TABLE "pressure_drill_sessions"
  ADD COLUMN "within_session_trend" jsonb NOT NULL
    DEFAULT '{"firstThirdRate":0,"middleThirdRate":0,"lastThirdRate":0}'::jsonb;

-- 4. Backfill scenario_slug + duration_selected_seconds for historic rows.
--    Historic filler-coach rows had no concept of scenario; set to a neutral slug.
--    'explain_job' is the closest analog to the previous default filler-coach flow.
UPDATE "pressure_drill_sessions"
   SET "scenario_slug" = 'explain_job'
 WHERE "scenario_slug" IS NULL;

--    Map existing duration_seconds to the closest preset (90/180/300/420).
UPDATE "pressure_drill_sessions"
   SET "duration_selected_seconds" =
     CASE
       WHEN duration_seconds <= 135 THEN 90
       WHEN duration_seconds <= 240 THEN 180
       WHEN duration_seconds <= 360 THEN 300
       ELSE 420
     END
 WHERE "duration_selected_seconds" IS NULL;

-- 5. Set NOT NULL on backfilled columns now that every row has a value.
ALTER TABLE "pressure_drill_sessions" ALTER COLUMN "scenario_slug" SET NOT NULL;
ALTER TABLE "pressure_drill_sessions" ALTER COLUMN "duration_selected_seconds" SET NOT NULL;

COMMIT;
