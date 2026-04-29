-- Add feedback_text column to run_analysis.
-- Previously omitted from the initial migration; the analyse-run route
-- generates AI copy that must be persisted alongside the scoring row.

ALTER TABLE run_analysis ADD COLUMN IF NOT EXISTS feedback_text TEXT;
