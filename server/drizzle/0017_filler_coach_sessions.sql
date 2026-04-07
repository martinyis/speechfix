CREATE TABLE IF NOT EXISTS "filler_coach_sessions" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "duration_seconds" integer NOT NULL,
  "total_filler_count" integer NOT NULL DEFAULT 0,
  "filler_data" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL
);
