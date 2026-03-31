CREATE TABLE IF NOT EXISTS "speech_patterns" (
  "id" serial PRIMARY KEY,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "type" text NOT NULL,
  "identifier" text,
  "data" jsonb NOT NULL,
  "sessions_analyzed" jsonb NOT NULL DEFAULT '[]',
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX "speech_patterns_user_id_idx" ON "speech_patterns" ("user_id");
CREATE UNIQUE INDEX "speech_patterns_user_type_identifier_idx"
  ON "speech_patterns" ("user_id", "type", COALESCE("identifier", ''));

-- Add patterns flag to existing users
UPDATE "users" SET "analysis_flags" = "analysis_flags" || '{"patterns": true}'::jsonb
  WHERE NOT ("analysis_flags" ? 'patterns');
