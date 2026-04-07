-- Add new columns to corrections
ALTER TABLE "corrections" ADD COLUMN IF NOT EXISTS "full_context" text;
ALTER TABLE "corrections" ADD COLUMN IF NOT EXISTS "dismissed" boolean DEFAULT false;

-- Weak spots table
CREATE TABLE IF NOT EXISTS "weak_spots" (
  "id" serial PRIMARY KEY,
  "user_id" integer NOT NULL REFERENCES "users"("id"),
  "correction_type" text NOT NULL,
  "status" text NOT NULL DEFAULT 'backlog',
  "severity" text NOT NULL,
  "srs_stage" integer NOT NULL DEFAULT 0,
  "next_review_at" timestamp,
  "last_drill_at" timestamp,
  "is_recurring" boolean NOT NULL DEFAULT false,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE UNIQUE INDEX "weak_spots_user_type_active_idx" ON "weak_spots" ("user_id", "correction_type") WHERE status != 'dismissed';

-- Junction table: weak spots <-> corrections
CREATE TABLE IF NOT EXISTS "weak_spot_corrections" (
  "id" serial PRIMARY KEY,
  "weak_spot_id" integer NOT NULL REFERENCES "weak_spots"("id") ON DELETE CASCADE,
  "correction_id" integer NOT NULL REFERENCES "corrections"("id") ON DELETE CASCADE,
  "created_at" timestamp DEFAULT now()
);

CREATE UNIQUE INDEX "weak_spot_corrections_spot_correction_idx" ON "weak_spot_corrections" ("weak_spot_id", "correction_id");

-- Exercises generated for weak spots
CREATE TABLE IF NOT EXISTS "weak_spot_exercises" (
  "id" serial PRIMARY KEY,
  "weak_spot_id" integer NOT NULL REFERENCES "weak_spots"("id") ON DELETE CASCADE,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "prompt" text NOT NULL,
  "target_rule" text NOT NULL,
  "order_index" integer NOT NULL,
  "created_at" timestamp DEFAULT now()
);

-- Drill attempts for weak spots
CREATE TABLE IF NOT EXISTS "weak_spot_drill_attempts" (
  "id" serial PRIMARY KEY,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "weak_spot_id" integer NOT NULL REFERENCES "weak_spots"("id") ON DELETE CASCADE,
  "correction_id" integer REFERENCES "corrections"("id"),
  "exercise_id" integer REFERENCES "weak_spot_exercises"("id"),
  "passed" boolean NOT NULL,
  "transcript" text,
  "feedback" text,
  "created_at" timestamp DEFAULT now()
);

CREATE INDEX "weak_spot_exercises_weak_spot_id_idx" ON "weak_spot_exercises" ("weak_spot_id");
CREATE INDEX "weak_spot_drill_attempts_weak_spot_id_idx" ON "weak_spot_drill_attempts" ("weak_spot_id");
CREATE INDEX "weak_spot_drill_attempts_user_id_idx" ON "weak_spot_drill_attempts" ("user_id");
