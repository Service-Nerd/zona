-- Plans table — Supabase-first plan storage replacing GitHub Gist per-user URLs.
-- One row per user. plan_json is the full Plan object matching docs/canonical/plan-schema.md.
-- Auto-migration from gist_url / user_settings.plan_json happens client-side on first load.

CREATE TABLE IF NOT EXISTS plans (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_json   JSONB       NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- One plan per user
CREATE UNIQUE INDEX IF NOT EXISTS plans_user_id_idx ON plans(user_id);

ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own plan"
  ON plans FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own plan"
  ON plans FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own plan"
  ON plans FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own plan"
  ON plans FOR DELETE
  USING (auth.uid() = user_id);
