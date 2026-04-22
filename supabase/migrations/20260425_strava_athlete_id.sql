-- Migration: strava_athlete_id on user_settings
-- Required for webhook routing: maps Strava athlete_id → Zona user_id.
-- Populated when user connects Strava (Strava OAuth token response includes athlete.id).

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS strava_athlete_id BIGINT;

CREATE UNIQUE INDEX IF NOT EXISTS user_settings_strava_athlete_id
  ON user_settings(strava_athlete_id)
  WHERE strava_athlete_id IS NOT NULL;
