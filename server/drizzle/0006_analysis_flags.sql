ALTER TABLE "users" ADD COLUMN "analysis_flags" jsonb DEFAULT '{"grammar": true, "fillers": true}' NOT NULL;
