# Zone Rules — Canonical Reference

**Authority**: This document defines all HR zone calculation methods, zone-to-session-type mappings, and the aerobic pace derivation logic. The runtime source of truth is `GENERATION_CONFIG.ZONES` in `lib/plan/generationConfig.ts`. No component or utility may implement its own zone calculation.

**Related**:
- `docs/canonical/CoachingPrinciples.md` §14 — the principle behind the five-zone model
- `docs/architecture/ADR-009-config-driven-generation.md` — why zones live in central config
- `lib/plan/generationConfig.ts` — runtime values

---

## Five zones, two formulas, one config

The system uses five named zones (Z1–Z5) and picks one of two formulas at runtime:

- **Karvonen (Heart Rate Reserve)** — used when the user's resting HR is known. More personalised.
- **% MaxHR** — fallback when only max HR is known.

Both formulas produce the same five zone names. Consumers read zone strings (e.g. `"Zone 2"`, `"< 145 bpm"`) — they do not care which formula produced the bpm number.

### Zone bands

| Zone | Karvonen % HRR | % MaxHR | Coaching meaning |
|---|---|---|---|
| Z1 | 50–60 | 65–70 | Recovery — active recovery only |
| Z2 | 60–70 | 70–80 | Easy aerobic — most of the work happens here |
| Z3 | 70–80 | 80–87 | Threshold — comfortably hard, sustainable for ~30–60 min |
| Z4 | 80–90 | 87–93 | VO2max ramp-up — short, hard intervals |
| Z5 | 90–100 | 93–100 | VO2max — short, very hard repeats |

These values live in `GENERATION_CONFIG.ZONES`. The values in this table are the canonical reference; the config is the runtime source.

### Karvonen formula

```
zone_low_bpm  = restingHR + (pct_low / 100)  × (maxHR − restingHR)
zone_high_bpm = restingHR + (pct_high / 100) × (maxHR − restingHR)
```

### % MaxHR formula

```
zone_low_bpm  = (pct_low / 100)  × maxHR
zone_high_bpm = (pct_high / 100) × maxHR
```

### When each formula is used

The runtime picks Karvonen if `user_settings.resting_hr` is present and > 0, otherwise % MaxHR. This auto-selection lives inside `computeZones()` in `lib/plan/ruleEngine.ts` and reads only from `GENERATION_CONFIG.ZONES`.

---

## Max HR derivation — Tanaka

Max HR is taken from `user_settings.max_hr` if the user has provided it. Otherwise it is derived from age using the Tanaka formula:

```
max_hr = round(208 − 0.7 × age)
```

Age is derived from `user_settings.date_of_birth` at plan generation time.

The Tanaka formula choice is documented in `docs/canonical/CoachingPrinciples.md` §3 (rationale tied to recovery cadence) and is set by the constant `GENERATION_CONFIG.MAX_HR_FORMULA = 'tanaka'`. A future paid feature ("zone method selector") may expose alternatives.

---

## Session type → zone mapping

| Session type (slot) | Catalogue category | Primary zone | Notes |
|---|---|---|---|
| `easy`, `long`, `recovery`, `run` | aerobic | Z2 | Capped at Z2 top — see CoachingPrinciples §12 |
| `quality`, `tempo` | threshold | Z3 | Z3 is the sustained threshold band |
| `intervals`, `hard` | vo2max | Z4–Z5 | Short repeats; the rep duration determines whether Z4 or Z5 dominates |
| `race` | — | Race pace | Derived from target time, not from HR — HR is the governor on hot/hilly days |
| `strength`, `cross-train`, `rest` | — | — | No HR target |

---

## HR target string format

`zone` and `hr_target` on a `Session` are always strings (INV-PLAN-007).

| Pattern | When | Example |
|---|---|---|
| `"< {bpm} bpm"` | Easy / long / recovery (single ceiling) | `"< 145 bpm"` |
| `"{lo}–{hi} bpm"` | Quality / intervals (range) | `"155–168 bpm"` |
| `"Zone {n}"` for the `zone` field | Always | `"Zone 2"`, `"Zone 3"`, `"Zone 4–5"` |

The rule engine computes numeric values internally and formats to strings before output. Numbers never appear in `Session.zone` or `Session.hr_target`.

---

## HR target fallback chain

Display only what can be derived. Never guess or show a wrong number.

1. `session.hr_target` — stored at plan creation time (generator writes this).
2. Karvonen / % MaxHR computed from the user's stored `resting_hr` / `max_hr` (or DOB-derived MaxHR) — used for live recalibration only.
3. `plan.meta.zone2_ceiling` — stored at plan creation time, re-read for surfaces that need just the easy ceiling.
4. **Show nothing** — never fall through to a hardcoded default.

---

## Aerobic pace — Strava-derived only

Displayed pace comes from the user's actual Strava runs filtered to their personal Z2 HR band. No formula-estimated fallback.

### Logic (`computeAerobicPace`)

1. Filter Strava runs where `average_heartrate` falls in the user's Z2 band — `GENERATION_CONFIG.ZONES.Z2.karvonen_pct` if RHR is known, else `.maxhr_pct`.
2. Average pace across the last 6 qualifying runs.
3. Return formatted string (e.g. `6:45/km`) or `null` if insufficient data.

**Rule**: if the user has no qualifying Strava runs, show nothing. A formula-estimated pace looks authoritative but is often wrong. Showing nothing is more honest than showing a wrong number.

---

## Z2 ceiling — `plan.meta.zone2_ceiling`

The Z2 ceiling is computed at plan creation time as the upper bound of the Z2 range (Karvonen 70% HRR, or % MaxHR 80%) and stored on the plan meta. It is referenced by:

- The session card's "stay under" line for easy runs.
- `lib/coaching/aerobicPace.ts` for the Strava run filter.
- `lib/coaching/coachingFlag.ts` for per-session zone discipline scoring.
- The Me screen's editable zone setting.

A user can override this value in the Me screen. The override is stored in `user_settings` and read in preference to the plan's stored ceiling.

---

## Forward compatibility — paid zone method selector

The five-zone, two-formula model is the v1 default. A future paid feature (`zone_method` in `user_settings`) will let users pick between Karvonen, % MaxHR, Daniels (5-zone pace-based), Coggan (7-zone power-based, less relevant for runners), and Friel (7-zone HR-based). The mechanism:

1. Add zone method tables under `GENERATION_CONFIG.ZONE_METHODS = { karvonen: {...}, daniels: {...}, friel: {...} }`.
2. Add `user_settings.zone_method TEXT` (nullable, default null = auto-pick).
3. Modify `computeZones()` to look up `ZONE_METHODS[user.zone_method ?? autoPick(rhr)]`.

Catalogue, plan generation, coaching signal, aerobic pace filter — none of them change. They all consume zone strings, not zone numbers.

This forward-compat is the primary reason zone constants live in `GENERATION_CONFIG` rather than inline in `computeZones()`.

---

## Invariants

- No hardcoded HR zone values anywhere in the codebase except `GENERATION_CONFIG.ZONES`.
- Z2 ceiling for one athlete may be Z3 for another — personalisation is non-negotiable.
- `computeAerobicPace` must only return values derived from real Strava data.
- Pace bracket displayed on session card must come from `computeAerobicPace` or be omitted.
- INV-PLAN-007 holds: `zone` and `hr_target` are always formatted strings, never numeric or object types.
