CREATE TABLE IF NOT EXISTS "pattern_exercises" (
  "id" serial PRIMARY KEY,
  "pattern_id" integer NOT NULL REFERENCES "speech_patterns"("id") ON DELETE CASCADE,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "original_sentence" text NOT NULL,
  "target_word" text NOT NULL,
  "pattern_type" text NOT NULL,
  "alternatives" jsonb NOT NULL,
  "practiced" boolean NOT NULL DEFAULT false,
  "practice_count" integer NOT NULL DEFAULT 0,
  "last_practiced_at" timestamp,
  "next_practice_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX "pattern_exercises_user_id_idx" ON "pattern_exercises" ("user_id");
CREATE INDEX "pattern_exercises_pattern_id_idx" ON "pattern_exercises" ("pattern_id");

CREATE TABLE IF NOT EXISTS "pattern_practice_attempts" (
  "id" serial PRIMARY KEY,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "exercise_id" integer NOT NULL REFERENCES "pattern_exercises"("id") ON DELETE CASCADE,
  "passed" boolean NOT NULL,
  "transcript" text NOT NULL,
  "feedback" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX "pattern_practice_attempts_exercise_id_idx" ON "pattern_practice_attempts" ("exercise_id");
