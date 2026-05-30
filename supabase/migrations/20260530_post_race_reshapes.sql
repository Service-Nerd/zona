-- Migration: post_race_reshapes table (AI-DEPTH-08)
-- Stores the proposed and confirmed post-race plan reshapes.
-- One row per reshape event. Status transitions: pending → confirmed | reverted.
--
-- Architecture: the rule engine generates a structural reshaped plan (deterministic);
-- the AI enricher (Sonnet) adds per-session coach notes and a summary paragraph.
-- Enricher failure is silent — the rule-engine shape is still proposed and can
-- be confirmed without AI voice. (ADR-006 hybrid generation pattern.)
--
-- The original plan is archived here (not just in plan_archive) so the revert
-- path is always available without a table join. plan_archive still captures
-- every savePlanForUser call for belt-and-suspenders.

CREATE TABLE IF NOT EXISTS post_race_reshapes (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Race context
  race_week_n           INTEGER NOT NULL,          -- 1-indexed week number of the race
  race_distance_km      NUMERIC(6,2),              -- actual distance (may differ from plan target)
  race_result           JSONB NOT NULL,            -- RaceResult envelope (finish_time, rpe, outcome, etc.)

  -- Plans
  original_plan_json    JSONB NOT NULL,            -- plan snapshot BEFORE reshape
  reshaped_plan_json    JSONB NOT NULL,            -- proposed reshaped plan

  -- AI enrichment output
  summary_text          TEXT,                      -- Sonnet-generated 2-3 sentence overview
  ai_model              TEXT,                      -- e.g. 'claude-sonnet-4-5-20250929'
  ai_prompt_version     TEXT,                      -- builder version for regression tracking
  ai_enriched_at        TIMESTAMPTZ,

  -- Reshape scope (rule-engine computed)
  weeks_affected        INTEGER[] NOT NULL DEFAULT '{}',  -- 1-indexed week numbers reshaped
  sessions_modified     INTEGER NOT NULL DEFAULT 0,
  recovery_config_key   TEXT,                      -- distance bucket used, e.g. 'MARATHON'

  -- Lifecycle
  status                TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'reverted', 'dismissed')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at          TIMESTAMPTZ,
  reverted_at           TIMESTAMPTZ,
  dismissed_at          TIMESTAMPTZ
);

ALTER TABLE post_race_reshapes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own post_race_reshapes"
  ON post_race_reshapes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own post_race_reshapes"
  ON post_race_reshapes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own post_race_reshapes"
  ON post_race_reshapes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS post_race_reshapes_user_created
  ON post_race_reshapes(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS post_race_reshapes_user_status
  ON post_race_reshapes(user_id, status)
  WHERE status IN ('pending', 'confirmed');
