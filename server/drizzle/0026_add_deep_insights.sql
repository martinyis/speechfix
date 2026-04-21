-- Migration 0026: Add deep_insights JSONB column on sessions.
-- Stores the DeepInsight[] array produced by generateDeepInsights() after a
-- voice session ends. Null for sessions recorded before this migration, for
-- sessions where the generator failed, or before the fire-and-forget job
-- completes. An empty array ([]) means generation ran and the model chose
-- silence — distinct from "not yet generated".
ALTER TABLE "sessions" ADD COLUMN "deep_insights" jsonb;
