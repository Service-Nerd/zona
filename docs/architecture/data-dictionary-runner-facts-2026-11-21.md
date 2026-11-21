# Runner facts: where they are stored, and what L1 must read (2026-11-21)

**Why this exists:** the founder asked, before B2 continued, whether the data schema had been reviewed. The honest
answer was no. The `RunnerProfile` contract (B1) was derived from the **code** (the wizard's `GeneratorInput` plus the
functions that interpret it), not from the **data** the product holds. B2a was paused until this was done.

**Method:**
- Live schema: PostgREST's OpenAPI description of project `wkppmpsvqkaxbekdgzdm` (41 tables and views).
- Every row of every table, read with the service role; only aggregates were kept. Read-only.
- `plans.plan_json.meta.generator_input`: 36 of 43 rows carry one.
- Declared volume compared with the run log for the 28 days before each plan was generated.
- Scripts are in the session scratchpad. Row dumps were deleted after use.

## 1. The runner-fact tables (live)

| Table | Rows / runners | Facts it holds | Fill (non-null) |
|---|---|---|---|
| `plans.plan_json.meta.generator_input` | 36 inputs | everything the wizard posted | age 36/36 · weekly km 36/36 · longest run 36/36 · max HR 28/36 · resting HR 25/36 · benchmark 21/36 · injury 15/36 · weekday cap 20/36 · day budgets 5/36 |
| `user_settings` | 56 | `birth_year` (int), `date_of_birth` (date), `resting_hr`, `max_hr` + `max_hr_source` ('observed' 26, 'user_confirmed' 4), `timezone`, `preferred_units`, `zone_boundaries` (text) | birth_year 71% · date_of_birth 9% · resting_hr 57% (**min 0**) · max_hr 71% · zone_boundaries 1 row |
| `strava_activities` (**the run log**, all sources) | 570 / 27 | `start_date` tstz, `distance_m` numeric (m), `moving_time_s` int, `avg_speed` m/s, `avg_hr`/`max_hr` int, HR zone % ×4, `hr_bpm_histogram` jsonb, `source` | HR 79% · histogram 68% · elevation 4% · temp 1% · `suffer_score` 0% |
| `health_daily_samples` | 1,000 / 28 | `rhr_bpm` int, `hrv_ms` numeric, `sleep_hours` numeric, `sleep_stages` jsonb | rhr 69% · hrv 46% · sleep 54% · **`vo2_max` 0%** |
| `session_completions` | 346 / 14 | `rpe` int 1–10, `fatigue_tag` (Fresh/Fine/Heavy/Wrecked), `avg_hr`, `status`, `week_n` (min **−3**: foundation weeks) | rpe 69% · fatigue 31% · avg_hr 41% · 51% superseded |
| `run_analysis` | 195 / 11 | `ef_value`, `ef_baseline`, `ef_trend_pct`, `verdict`, planned/actual load | ef_value 33% · ef_trend 64% |

**Units:** stored distances are metres in the run log, km in `session_completions.strava_activity_km` and km in the
plan input. Speed is m/s. Every duration is in seconds, except the plan input, which uses minutes.

## 2. What the measurement found

1. **🔴 The engine reads no stored runner data.** `lib/plan` and `/api/generate-plan` never read `strava_activities`,
   `health_daily_samples`, `session_completions` or `run_analysis`. The only observed fact that reaches a plan is
   max/resting HR, which the **client** reads from the device at submit time and posts as an input.
2. **🔴 Declared volume is above logged volume for most runners who have a log.** 11 runners' logs cover the full
   28 days before generation:
   - **8 of 11** declared more than 25% above what they logged: ×1.31, ×1.41, ×1.51, ×1.61, ×2.43, ×3.24, ×4.54 and
     ×13.42.
   - 3 were within ±25%. None was under.
   - Longest run: declared more than 25% above the logged longest on 5 of 14.

   ⚠️ **The log is a FLOOR, not the truth.** It holds only runs that reach Apple Health; a run tracked nowhere is
   missing. This is evidence for **reading** the log, not for overriding the runner. That ruling belongs to the
   Coaching Board: it is §2/§106's starting-volume question, and the largest lever on injury load in the product.
3. **Two age stores, consistent today.**
   - The input's `age` agrees with `user_settings.birth_year` within one year on 34 of 34 runners.
   - `date_of_birth` is a third store, filled for 9%, and nothing in the engine reads it.
4. **Invalid values are stored as values.** These are the "absence written as a value" class:
   - `user_settings.resting_hr` has a 0.
   - The run log has rows with `distance_m` 0, `moving_time_s` 6 and `avg_speed` 0.
   - `health_daily_samples.sleep_hours` ranges 0–18.1.
   - L1 needs a validity bound on every numeric, and out of range must become `null`.
5. **Resting HR has three sources that disagree.** The input, `user_settings` and `health_daily_samples.rhr_bpm`
   (a daily series). The input differs from `user_settings` on 3 of 25 runners. Nothing defines which wins.
6. **`timezone` is `UTC` for 22 of 56 runners.** That is almost certainly a default, not where they live. `as_of`
   ("today" for this runner) and the week boundaries depend on it.
7. **Dead or near-dead columns:**
   - `health_daily_samples.vo2_max`: 0%. The HealthKit plugin cannot read VO2max, per CLAUDE.md.
   - `strava_activities.suffer_score`: 0%.
   - `reported_distance_m` and `reported_at`: 0%.
   - `user_settings.smoke_tracker_enabled` and `quit_date`: known.
   - `gist_url`: 2 rows.
8. **🔴 Security, outside B2:** `user_settings.strava_client_secret` holds a plaintext app secret on one row. It
   should not be in a user table. To handle separately; not part of the engine.
9. **Not checked:**
   - Whether the wizard can submit without the runner touching the weekly-km ruler. Its submit line is
     `weeklyKm ?? WIZARD_VOLUME_RULER.WEEKLY_KM_ANCHOR`, the same shape as the `: 30` age fabrication.
   - The benchmark object's inner shape (21 rows).

## 3. What this changes in the architecture

| # | Change | Where | Prescription change? |
|---|---|---|---|
| A | L1 takes a **`RunnerFacts` snapshot**, not just `GeneratorInput`: the input, the settings row, and aggregates of the run log, the health series and completions **as of `as_of`**. The route fetches the snapshot, so L1 stays pure (ADR-003, purity gate). | `docs/contracts/engine.md`, `lib/engine/contracts/` | No |
| B | **Every profile fact carries its source and precedence**: `{ value, source: 'observed' \| 'confirmed' \| 'stated' \| 'derived', as_of }`. A fact with no valid source is `null`. | `RunnerProfile` v2 | No |
| C | **An `observed` block**: 4-week logged volume, logged longest run, run count, log coverage days, RHR (7-day median), latest max HR, RPE and fatigue trend. The profile **carries** it. Whether the planner **reads** it is a Coaching Board ruling. | `RunnerProfile.observed` | Only when read |
| D | **One validity bound per numeric**, in config, applied in L1 only: RHR, max HR, distance, duration, pace, sleep. | `GENERATION_CONFIG` (new keys, principle owed) | No for B2a |
| E | **`as_of` resolves in the runner's timezone**, and a `UTC` timezone is flagged as unknown rather than trusted. | L1 + route | Possibly at week edges: measure |
| F | **One age owner**: `birth_year` → age at `as_of`; `date_of_birth` only if `birth_year` is absent. | L1 | No |

**B2a stays zero-behaviour-change.** It builds the profile with A–F, and the engine still reads only the facts it
reads today. C, and D wherever it would change an input, go to the Coaching Board with the measurement above.
