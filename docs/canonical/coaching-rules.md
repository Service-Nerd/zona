# Coaching Framework — Plan Generation Rules

**Authority**: This is the canonical source for operational plan generation rules — when sessions are scheduled, how a week is laid out, what the engine refuses to do. Every numeric in this document points to a named constant in `GENERATION_CONFIG` (see `docs/canonical/CoachingPrinciples.md` for the principle behind each value).

**Related**:
- `docs/canonical/CoachingPrinciples.md` — the *why* behind every numeric (the constitution)
- `docs/canonical/session-catalogue.md` — the concrete sessions the engine may schedule
- `docs/canonical/zone-rules.md` — HR zone calculation
- `docs/canonical/adaptation-rules.md` — R20 dynamic reshaping (separate concern)
- `lib/plan/generationConfig.ts` — runtime values

---

## 1. User Inputs

### Core Inputs (required)

| Input | Type | Notes |
|---|---|---|
| Race date | Date | Anchor for entire plan |
| Race distance | Select | 5K / 10K / Half Marathon / Marathon / 50K / 100K |
| Goal | Select | Finish / Time target |
| Target time | DurationPicker (hours + minutes) | Only if goal = time target. Drives peak-phase race-pace specificity. |
| Current weekly volume | Chip select | Average of last 2–4 weeks |
| Longest recent run | Chip select | Last 4–6 weeks |
| Days available per week | Number (2–6) | Hard constraint |
| Date of birth | Date | Required. Drives Tanaka MaxHR, masters cadence, age-eligibility (14–90). |

### HR Inputs (optional but improve accuracy)

| Input | Type | Notes |
|---|---|---|
| Resting HR | Number | Optional. Switches zone formula from %MaxHR to Karvonen. |
| Max HR | Number | Optional. Otherwise derived via Tanaka from DOB. |

### Lifestyle Constraints

**Hard Constraints**

| Input | Type | Notes |
|---|---|---|
| Days cannot train | Multi-select | Must never be scheduled |
| Max weekday training time | Chip select | Caps session duration |
| Max weekend training time | Number (mins) | Caps long run duration |
| Travel / holiday dates | Date range | Blocks or reduces training |

**Soft Constraints**

| Input | Type | Notes |
|---|---|---|
| Preferred training days | Multi-select | Try to prioritise |
| Preferred long run day | Select | Default = Sunday |

### Behaviour & Environment (paid only)

| Input | Type | Notes |
|---|---|---|
| Hard session relationship | Select | Avoid / Neutral / Love / Overdo |
| Terrain access | Select | Road / Trail / Mixed — drives session selection, not just labels |
| Treadmill or outdoor primarily | Select | Affects strides and hill-work plausibility |

### Health & Injury

| Input | Type | Notes |
|---|---|---|
| Injury history | Multi-select | Achilles / Knee / Back / Shin splints / Hip flexor / Plantar fasciitis. All six have rules — see §12. |
| Current niggles | Text | Adjusts training load |
| Strength experience | Select | None / Some / Regular |

### Removed inputs

The following were inputs in pre-rebuild plans and are no longer collected:

- **`motivation_type`** — never observed to change the plan in any meaningful way.
- **`training_style`** — same.
- **`goal: 'podium'`** — never present in the codebase.

`PlanMeta` no longer carries these fields. Existing plans containing them remain valid; the fields are simply ignored.

---

## 2. Plan Philosophy

- Life-first, plan-second
- Plans must adapt to constraints, not the user
- Consistency > optimisation
- Adaptation > perfection
- Minimum effective dose
- Time-on-feet > distance (for beginners and ultra runners)

The tone of every coaching surface is set by `BRAND.tagline` ("Slow down. You've got a day job.") and `BRAND.brandStatement` ("You can't outrun your easy days."). Sessions are described in restraint, not exhortation.

---

## 3. Plan Structure by Distance

Each distance has a *signature* defined in `lib/plan/planSignatures.ts` — minimum/ideal/maximum weeks, default sessions per week, taper final session, eligible catalogue categories.

| Distance | Min weeks | Ideal weeks | Max weeks | Default sessions/wk | Free tier? |
|---|---|---|---|---|---|
| 5K | 8 | 10 | 12 | 4 | Yes |
| 10K | 10 | 12 | 14 | 4 | Yes |
| HM | 12 | 14 | 16 | 4 | Yes |
| Marathon | 14 | 16 | 20 | 5 | **No (paid)** |
| 50K | 16 | 18 | 22 | 5 | No (paid) |
| 100K | 20 | 22 | 26 | 5 | No (paid) |

The signature also dictates which catalogue categories can populate quality slots. See `docs/canonical/session-catalogue.md`.

---

## 4. Phase Structure

Plans progress through four phases. The split is config-driven.

```
GENERATION_CONFIG.PHASE_DISTRIBUTION = {
  base_pct:  35,
  build_pct: 35,
  peak_pct:  15,
  // taper = remainder, set by TAPER_BY_DISTANCE
}
```

| Phase | General : Specific | Quality count default | Long-run % of weekly | Catalogue focus |
|---|---|---|---|---|
| Base | 100 : 0 | 0 | 28% | aerobic |
| Build | 70 : 30 | 1 | 30% | aerobic + threshold |
| Peak | 40 : 60 | 1–2 | 32% | distance-specific (vo2max for 5K/10K, race-specific for HM/MARATHON, ultra-specific for 50K/100K) |
| Taper | 30 : 70 | per `TAPER_QUALITY_PER_WEEK` | 40% | distance-specific only |

The `general : specific` ratio is `GENERATION_CONFIG.SPECIFICITY_BY_PHASE`.

---

## 5. Volume Progression

### Weekly increase cap

```
GENERATION_CONFIG.MAX_WEEKLY_VOLUME_INCREASE_PCT = 10
```

A returning runner (training_age > 2 years AND current_weekly_km below typical for fitness level) is granted:

```
GENERATION_CONFIG.RETURNING_RUNNER_ALLOWANCE_PCT = 15
GENERATION_CONFIG.RETURNING_RUNNER_GRACE_WEEKS    = 3
```

After the grace window the standard 10% applies.

### Recovery weeks

Standard cadence is every fourth week. Masters athletes (age ≥ `MASTERS_AGE_THRESHOLD = 45`) recover every third week.

```
GENERATION_CONFIG.RECOVERY_WEEK_FREQUENCY_STANDARD = 4
GENERATION_CONFIG.RECOVERY_WEEK_FREQUENCY_MASTERS  = 3
GENERATION_CONFIG.RECOVERY_WEEK_VOLUME_PCT         = 70
```

### Week 1–2 long-run cap

In the first two weeks of any plan, long run is capped at:

```
longest_recent_run_km × GENERATION_CONFIG.WEEK_1_2_LONG_RUN_CAP_MULTIPLIER
                                                              (= 1.10)
```

This prevents a "first long run" being a 50% jump for a returning runner.

---

## 6. Long-Run Rules

### Phase-aware fraction of weekly volume

```
GENERATION_CONFIG.LONG_RUN_PCT_OF_WEEKLY_VOLUME = {
  base:  28,
  build: 30,
  peak:  32,
  taper: 40,
}
```

### Absolute time cap by distance

```
GENERATION_CONFIG.LONG_RUN_CAP_MINUTES = {
  '5K':       90,
  '10K':      120,
  'HM':       135,
  'MARATHON': 210,
  '50K':      300,
  '100K':     420,
}
```

### Peak-phase race-pace segment (HM and Marathon)

In peak phase, long runs for HM and MARATHON include a race-pace segment:

```
SESSION_FORMAT.LONG_RUN_PEAK = {
  warmup_mins:           15,
  race_pace_segment_pct:  20,
  race_pace_distances:   ['HM', 'MARATHON'],
}
```

This is the bridge between aerobic long runs and the `mp_long_run` / `hm_pace_intervals` catalogue sessions.

---

## 7. Quality Session Rules

### Frequency cap by fitness level

```
GENERATION_CONFIG.QUALITY_SESSIONS_PER_WEEK_MAX = {
  beginner:     0,
  intermediate: 2,
  experienced:  2,
}
```

(The rebuild spec proposed 3 for experienced. Overridden to 2 — see `CoachingPrinciples.md` §8.)

### Spacing

```
GENERATION_CONFIG.MIN_HOURS_BETWEEN_QUALITY          = 48
GENERATION_CONFIG.MIN_HOURS_BETWEEN_QUALITY_AND_LONG = 48
```

(The rebuild spec proposed 24 h for the second value. Overridden to 48 h — see `CoachingPrinciples.md` §7.)

### Selection

When a quality session is due, the engine selects a row from `session_catalogue` per the rules in `docs/canonical/session-catalogue.md`.

### Suppression

Quality is suppressed when any of:

- The week is a recovery week.
- The user's `hard_session_relationship` is `'avoid'`.
- The user has an active Achilles injury.
- The user's fitness level is `beginner` and the phase is base.

---

## 8. Taper Rules

### Per-distance taper depth

```
GENERATION_CONFIG.TAPER_BY_DISTANCE = {
  '5K':       { days: 10, volume_reduction_pct: 35, keep_quality: true },
  '10K':      { days: 10, volume_reduction_pct: 35, keep_quality: true },
  'HM':       { days: 14, volume_reduction_pct: 45, keep_quality: true },
  'MARATHON': { days: 21, volume_reduction_pct: 55, keep_quality: true },
  '50K':      { days: 21, volume_reduction_pct: 55, keep_quality: true },
  '100K':     { days: 28, volume_reduction_pct: 60, keep_quality: true },
}
```

### Quality session count per taper week

```
GENERATION_CONFIG.TAPER_QUALITY_PER_WEEK = {
  '5K':       [1, 0],
  '10K':      [1, 0],
  'HM':       [1, 1, 0],
  'MARATHON': [1, 1, 1, 0],
  '50K':      [1, 1, 1, 0],
  '100K':     [1, 1, 1, 1, 0],
}
```

The race week always has quality count `0` and contains shakeouts only. The pre-race-week quality session is selected from the catalogue per `taper_final_session` in the distance signature (e.g. `intervals_short` for 5K, `mp_long_run` for marathon).

### Race week

- 1–2 short shakeout runs (4 km each, easy).
- One race day.
- No new variables (shoes, food, routine).

---

## 9. Weekly Layout

### Default placement order

The engine places sessions in this priority:

1. **Long run** — preferred day (default Sunday; user-configurable).
2. **Quality session(s)** — midweek (Wed preferred), spaced ≥ `MIN_HOURS_BETWEEN_QUALITY_AND_LONG` from the long run.
3. **Strength** — adjacent to easy days, never the day before quality.
4. **Easy runs** — fill remaining available days.
5. **Rest / cross-train** — what's left.

### Hard constraints

- Never schedule on `days_cannot_train`.
- Respect `max_weekday_mins` and `max_weekend_mins`.
- Respect travel/holiday blocks (R22, paid only).

### Spacing

- ≥ 48 h between any two quality sessions (`MIN_HOURS_BETWEEN_QUALITY`).
- ≥ 48 h between a quality session and a long run (`MIN_HOURS_BETWEEN_QUALITY_AND_LONG`).
- No stacking of high-fatigue days.

---

## 10. Universal Run Format

Every run prescribed by the engine has structure: warm-up, main set, cool-down. Quality sessions add strides. See `lib/plan/sessionFormat.ts` for the full structure.

```
SESSION_FORMAT.UNIVERSAL = {
  warmup_pct:                10,
  main_pct:                  80,
  cooldown_pct:              10,
  warmup_min_duration_mins:  10,
  quality_warmup_min_mins:   15,
}
```

### Warm-up zone progression

```
SESSION_FORMAT.WARMUP = {
  first_third:                  'Z1',
  middle_third:                 'Z1_to_Z2',
  final_third:                  'Z2',
  strides_required_for_quality: true,
  strides_count:                4,
  strides_duration_seconds:     20,
}
```

### Cool-down

```
SESSION_FORMAT.COOLDOWN = {
  intensity:                  'Z1',
  min_duration_mins:           5,
  include_walk_for_long_runs:  true,
}
```

---

## 11. VDOT Conservatism

When a benchmark is provided, the engine derives VDOT and computes E/T/I paces. Two conservative discounts apply:

```
GENERATION_CONFIG.VDOT_CONSERVATIVE_DISCOUNT_PCT             = 3
GENERATION_CONFIG.VDOT_STALE_BENCHMARK_ADDITIONAL_DISCOUNT_PCT = 5
GENERATION_CONFIG.VDOT_STALE_BENCHMARK_MONTHS                  = 6
```

Default discount: 3%.
If the benchmark date is older than 6 months: additional 5%.
The applied total is surfaced in `plan.meta.vdot_discount_applied_pct` so the user can see what the engine did.

---

## 12. Injury-Aware Adjustments

All six injury options collected by the wizard have rules:

| Injury | Rule |
|---|---|
| Achilles | Reduce speed work and hills. Quality sessions suppressed. |
| Knee | Reduce volume spikes. Weekly cap drops from 10% to 5%. |
| Back | Long-run duration capped at 120 min regardless of distance. |
| Shin splints | Weekly cap drops from 10% to 5% (same as knee). |
| Hip flexor | Quality sessions suppressed in base phase. |
| Plantar fasciitis | Long-run duration capped at 120 min. |

General rule: persistent pain (> 3 runs) → reduce load or rest. This is downstream — implemented by R20 (`docs/canonical/adaptation-rules.md`), not the static generator.

---

## 13. Environment Adjustments

- **Heat**: reduce intensity, increase recovery.
- **Cold**: extend warm-up.
- **Trail**: reduce pace expectations, increase effort focus. Trail terrain selection in the wizard changes catalogue selection (favours `aerobic_hills`, `time_on_feet`), not just labels.
- **Treadmill**: strides and hills become "optional / outdoor only" in coaching notes.

---

## 14. Race Preparation Rules

- Practice fuelling during long runs.
- Test race kit.
- Include race simulation sessions (`ultra_race_sim` for 50K/100K; `mp_long_run` for marathon).
- Rehearse pacing and timing.

---

## 15. Guard Rails (route-level)

Enforced before the engine runs. See `app/api/generate-plan/route.ts → validate()`.

| Scenario | Action |
|---|---|
| Race < 3 weeks | Refuse |
| Marathon (≥ 42 km) and race < 8 weeks | Refuse |
| HM (≥ 21 km, < 42 km) and race < 4 weeks | Refuse |
| Days available < 2 | Refuse |
| Marathon and current_weekly_km < 20 | Refuse |
| Half marathon or longer and longest_recent_run_km < 5 | Refuse |
| Long run exceeds safe % | Adjust automatically — never refuse |
| Over-constrained schedule | Simplify plan |
| Weekday time < 45 min | Simplify sessions |

Refusals return a 422 with a Zona-voice explanation. Adjustments are silent.

---

## 16. Output Requirements

Each plan must:

- Start on a Monday.
- Have continuous weekly structure.
- Include all 7 days (a day with no session is `rest`).
- Respect all hard constraints.

Each session must include:

- Type (`SessionType`).
- Description (warm-up + main + cool-down per universal format).
- Duration or distance.
- Effort (HR target / pace target / RPE target).

INV-PLAN-007 holds: `zone` and `hr_target` are strings.

---

## 17. Plan Integrity Rules

- Never violate hard constraints.
- Never exceed progression limits in `GENERATION_CONFIG`.
- Always prioritise sustainability over optimisation.
- If conflict occurs → simplify, don't force complexity.
- Never silently change a coaching numeric — every change touches `GENERATION_CONFIG` and `CoachingPrinciples.md` together.

---

## 18. R20 Dynamic Reshaping is downstream

Live adaptation logic belongs to R20 (Dynamic Plan Reshaping). It reads from this document but does not redefine the rules. See `docs/canonical/adaptation-rules.md`.

R23 produces a static plan. R20 reshapes it as the user's behaviour deviates. The two never share state at the engine level — they share state through the plan JSON.

---

## 19. Confidence Scoring (R18, deferred)

Confidence scoring is R18. The generator may output an initial score at creation time — decision deferred. See `docs/releases/backlog.md` for R18 scope.

Inputs:
- Time to race
- Fitness vs goal gap
- Lifestyle constraints
- Consistency likelihood
- Injury risk

Output: score (1–10), risks, suggested adjustments. PAID-only (INV-PLAN-008).
