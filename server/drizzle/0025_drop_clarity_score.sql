-- Migration 0025: Drop clarity_score column from sessions.
-- Scores (delivery/language/clarity) have been removed from the product.
-- Deep Insights replaces per-session scoring. Historical clarity_score values
-- are discarded with the column.
ALTER TABLE "sessions" DROP COLUMN IF EXISTS "clarity_score";
