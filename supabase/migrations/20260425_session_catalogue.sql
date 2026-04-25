-- R23 rebuild — session catalogue (ADR-010)
--
-- Stores the concrete training sessions the rule engine may schedule. The
-- engine becomes a *selector* over this table, not a generator of session
-- strings. See docs/canonical/session-catalogue.md for the domain doc and
-- selection rules.
--
-- Two taxonomies kept separate:
--   - SessionType (in TypeScript union, owned by types/plan.ts) — drives card colour
--   - category (this column) — drives session selection by phase + distance

CREATE TABLE IF NOT EXISTS session_catalogue (
  id                    TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,
  category              TEXT NOT NULL CHECK (category IN (
                          'aerobic', 'threshold', 'vo2max', 'race_specific', 'ultra_specific'
                        )),
  purpose               TEXT NOT NULL,
  phase_eligibility     TEXT[] NOT NULL,
  distance_eligibility  TEXT[] NOT NULL,
  fitness_level_min     TEXT NOT NULL CHECK (fitness_level_min IN (
                          'beginner', 'intermediate', 'experienced'
                        )),
  difficulty_tier       INT NOT NULL CHECK (difficulty_tier BETWEEN 1 AND 5),
  main_set_structure    JSONB NOT NULL,
  intensity_zones       TEXT[] NOT NULL,
  typical_duration_min  INT NOT NULL,
  typical_duration_max  INT NOT NULL,
  is_free_tier          BOOLEAN NOT NULL DEFAULT TRUE,
  coach_voice_notes     TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: catalogue is read-only public reference data. Free-tier rows are visible
-- to anyone authenticated; paid-tier rows are visible only to authenticated
-- users (the API layer enforces tier filtering against the user's actual tier).
ALTER TABLE session_catalogue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "session_catalogue_read"
  ON session_catalogue
  FOR SELECT
  TO authenticated
  USING (TRUE);

-- ─── Seed: 14 v1 sessions ─────────────────────────────────────────────────────
-- Voice notes approved 2026-04-25. ZONA voice — clipped, observational, never
-- motivational. See docs/canonical/brand.md for tone reference.

INSERT INTO session_catalogue (
  id, name, category, purpose, phase_eligibility, distance_eligibility,
  fitness_level_min, difficulty_tier, main_set_structure, intensity_zones,
  typical_duration_min, typical_duration_max, is_free_tier, coach_voice_notes
) VALUES

-- 1. aerobic_steady — base aerobic Z2 run
('aerobic_steady', 'Steady aerobic', 'aerobic',
 'Build the aerobic engine. Most of the work happens here.',
 ARRAY['base', 'build'],
 ARRAY['5K', '10K', 'HM', 'MARATHON', '50K', '100K'],
 'beginner', 1,
 '{"type": "continuous", "zone": "Z2"}'::jsonb,
 ARRAY['Z2'],
 30, 50, TRUE,
 'Boring is the point. If it feels productive, slow down.'),

-- 2. aerobic_hills — Z2 with rolling hills
('aerobic_hills', 'Aerobic with hills', 'aerobic',
 'Aerobic work with elevation. Effort, not pace, is the metric.',
 ARRAY['base', 'build'],
 ARRAY['5K', '10K', 'HM', 'MARATHON', '50K', '100K'],
 'intermediate', 2,
 '{"type": "continuous", "zone": "Z2", "terrain": "hills"}'::jsonb,
 ARRAY['Z2'],
 40, 60, TRUE,
 'Hills lie. Watch the effort, not the pace.'),

-- 3. fartlek_unstructured — base, intermediate, free play
('fartlek_unstructured', 'Unstructured fartlek', 'aerobic',
 'Free-play surges within an aerobic run. Wakes the legs without a structured stress.',
 ARRAY['base'],
 ARRAY['5K', '10K', 'HM', 'MARATHON', '50K', '100K'],
 'intermediate', 2,
 '{"type": "fartlek", "zone_base": "Z2", "zone_surge": "Z3"}'::jsonb,
 ARRAY['Z2', 'Z3'],
 40, 40, TRUE,
 'Pick a tree. Run to it. Recover. No watch.'),

-- 4. tempo_continuous — sustained Z3 block
('tempo_continuous', 'Continuous tempo', 'threshold',
 'Sustained sub-threshold work. Builds the ceiling.',
 ARRAY['build', 'peak'],
 ARRAY['HM', 'MARATHON', '50K', '100K'],
 'intermediate', 3,
 '{"type": "continuous", "duration_mins": 30, "zone": "Z3"}'::jsonb,
 ARRAY['Z3'],
 20, 40, TRUE,
 'Sustainable. Same pace at the end as at the start.'),

-- 5. tempo_cruise — 3×10 min Z3 / 2 min jog
('tempo_cruise', 'Cruise intervals', 'threshold',
 'Threshold work in repeats. Same effort on rep 3 as rep 1 — that is the test.',
 ARRAY['build'],
 ARRAY['HM', 'MARATHON', '50K', '100K'],
 'intermediate', 3,
 '{"type": "repeats", "reps": 3, "work": {"duration_mins": 10, "zone": "Z3"}, "recovery": {"duration_mins": 2, "type": "jog"}}'::jsonb,
 ARRAY['Z3'],
 30, 45, TRUE,
 'Rep three is the test. Not rep one.'),

-- 6. progressive_tempo — Z2 → Z3 ramp
('progressive_tempo', 'Progressive tempo', 'threshold',
 'Gradual ramp from aerobic to threshold. Trains discipline at the start, honesty at the end.',
 ARRAY['build', 'peak', 'taper'],
 ARRAY['HM', 'MARATHON', '50K', '100K'],
 'intermediate', 3,
 '{"type": "progression", "duration_mins": 30, "zone_start": "Z2", "zone_end": "Z3"}'::jsonb,
 ARRAY['Z2', 'Z3'],
 25, 40, TRUE,
 'Hold back early. Finish honest.'),

-- 7. intervals_classic — 5×3 min Z4–Z5 / 2 min jog
('intervals_classic', 'Classic VO2max', 'vo2max',
 'Hard interval work targeting Z4–Z5. Builds peak capacity.',
 ARRAY['peak'],
 ARRAY['5K', '10K'],
 'intermediate', 4,
 '{"type": "repeats", "reps": 5, "work": {"duration_mins": 3, "zone": "Z4_Z5"}, "recovery": {"duration_mins": 2, "type": "jog"}}'::jsonb,
 ARRAY['Z4', 'Z5'],
 35, 50, TRUE,
 'Three minutes is long. Don''t blow rep one.'),

-- 8. intervals_short — 8–12×400m @ 3K pace / 90s jog
('intervals_short', 'Short VO2max', 'vo2max',
 'Sharp speed work. Quick feet, controlled effort, even splits.',
 ARRAY['peak'],
 ARRAY['5K'],
 'intermediate', 4,
 '{"type": "repeats", "reps": 10, "work": {"distance_m": 400, "pace_target": "3K"}, "recovery": {"duration_secs": 90, "type": "jog"}}'::jsonb,
 ARRAY['Z4', 'Z5'],
 35, 50, TRUE,
 'Don''t race your splits. Even, not desperate.'),

-- 9. intervals_long — 4×1000m @ 5K pace / 2 min jog
('intervals_long', 'Long VO2max', 'vo2max',
 'Race-pace 1Ks. The point is even splits, not heroic openers.',
 ARRAY['peak'],
 ARRAY['5K', '10K'],
 'intermediate', 4,
 '{"type": "repeats", "reps": 4, "work": {"distance_m": 1000, "pace_target": "5K"}, "recovery": {"duration_mins": 2, "type": "jog"}}'::jsonb,
 ARRAY['Z4', 'Z5'],
 40, 55, TRUE,
 'Heroic openers ruin it. Even splits.'),

-- 10. mp_long_run — long run with final 30–50% at MP (Marathon only)
('mp_long_run', 'Marathon-pace long run', 'race_specific',
 'Race-specific long run. Goal pace gets practised on legs that are already tired.',
 ARRAY['peak'],
 ARRAY['MARATHON'],
 'intermediate', 4,
 '{"type": "long_run_with_segment", "easy_pct": 60, "race_pace_pct": 40, "race_pace_zone": "MP"}'::jsonb,
 ARRAY['Z2', 'Z3'],
 90, 180, TRUE,
 'Easy first. Hit goal pace on tired legs.'),

-- 11. hm_pace_intervals — 4×2km @ HM pace / 3 min jog
('hm_pace_intervals', 'HM-pace intervals', 'race_specific',
 'Race-specific intervals at HM pace. Bridges the gap between threshold and race day.',
 ARRAY['peak'],
 ARRAY['HM'],
 'intermediate', 4,
 '{"type": "repeats", "reps": 4, "work": {"distance_m": 2000, "pace_target": "HM"}, "recovery": {"duration_mins": 3, "type": "jog"}}'::jsonb,
 ARRAY['Z3', 'Z4'],
 50, 70, TRUE,
 'HM pace, not faster. Exit each rep wanting more.'),

-- 12. ultra_race_sim — 2–3hr at slightly above goal ultra pace, fuelling every 25 min — PAID
('ultra_race_sim', 'Ultra race simulation', 'ultra_specific',
 'Practice the race. Fuelling, pacing, kit — all rehearsed in the conditions you will run.',
 ARRAY['peak'],
 ARRAY['50K', '100K'],
 'intermediate', 4,
 '{"type": "long_run_with_fuelling", "duration_mins_min": 120, "duration_mins_max": 180, "zone": "Z2_plus", "fuel_every_mins": 25}'::jsonb,
 ARRAY['Z2', 'Z3'],
 120, 180, FALSE,
 'Eat on the clock. Hunger is too late.'),

-- 13. back_to_back_long — Sat 90 min Z2 + Sun 2–3hr Z2 — PAID
('back_to_back_long', 'Back-to-back long', 'ultra_specific',
 'Train cumulative fatigue. Sunday is meant to feel heavy — that is the adaptation.',
 ARRAY['build', 'peak'],
 ARRAY['50K', '100K'],
 'intermediate', 4,
 '{"type": "back_to_back", "day_1": {"duration_mins": 90, "zone": "Z2"}, "day_2": {"duration_mins_min": 120, "duration_mins_max": 180, "zone": "Z2"}}'::jsonb,
 ARRAY['Z2'],
 210, 270, FALSE,
 'Sunday is meant to feel heavy. That''s the adaptation.'),

-- 14. time_on_feet — 4–6hr easy hike/run mix, race-like terrain — PAID
('time_on_feet', 'Time on feet', 'ultra_specific',
 'Pure endurance. Walk the climbs, eat on schedule, accumulate hours. Pace is irrelevant.',
 ARRAY['peak'],
 ARRAY['100K'],
 'intermediate', 5,
 '{"type": "time_on_feet", "duration_mins_min": 240, "duration_mins_max": 360, "zone": "Z2", "fuel_every_mins": 30, "include_walk_breaks": true}'::jsonb,
 ARRAY['Z1', 'Z2'],
 240, 360, FALSE,
 'Walk the climbs. Eat. Hours, not pace.');
