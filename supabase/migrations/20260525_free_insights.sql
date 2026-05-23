-- KIT-TASTE-01: free_insights table
--
-- One Haiku-generated weekly insight per free user, sourced from manual RPE +
-- fatigue tags on session_completions (Strava-independent). Cached one row
-- per (user_id, week_start_date). Re-renders on the Coach tab read from cache
-- — generation fires at most once per user per ISO-Monday week.

CREATE TABLE IF NOT EXISTS free_insights (
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start_date  DATE NOT NULL,                       -- Monday of the user's local week (ISO week start)
  headline         TEXT NOT NULL,                       -- short title, Zonna voice (≤ ~50 chars)
  body             TEXT NOT NULL,                       -- one or two sentences, Zonna voice
  ai_model         TEXT,                                -- e.g. 'claude-haiku-4-5-20251001'
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (user_id, week_start_date)
);

ALTER TABLE free_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own free_insights"
  ON free_insights FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own free_insights"
  ON free_insights FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own free_insights"
  ON free_insights FOR UPDATE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS free_insights_user_week
  ON free_insights(user_id, week_start_date DESC);
