-- Plan archive table — stores previous plans before they are overwritten.
-- Data protection only: no restore UI at v1 launch. UI (browse + restore) deferred to post-launch.
--
-- Populated by handlePlanSaved in DashboardClient before each savePlanForUser call.
-- Race name + date are denormalised for future list display without deserialising plan_json.

CREATE TABLE IF NOT EXISTS plan_archive (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_json   jsonb NOT NULL,
  race_name   text,
  race_date   text,
  archived_at timestamptz DEFAULT now()
);

ALTER TABLE plan_archive ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own archived plans"
  ON plan_archive FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own archived plans"
  ON plan_archive FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Index for user plan history list (future UI)
CREATE INDEX IF NOT EXISTS plan_archive_user_id_idx ON plan_archive (user_id, archived_at DESC);
