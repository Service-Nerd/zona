# Session Catalogue — Domain Reference

**Authority**: This document defines the catalogue of concrete training sessions the rule engine may schedule. The runtime source of truth is the Supabase `session_catalogue` table — this document describes the schema, the v1 contents, and the selection rules.

**Related**:
- `docs/architecture/ADR-010-session-catalogue.md` — why the catalogue exists
- `docs/canonical/CoachingPrinciples.md` §17 — plan signatures and distance shape
- `docs/canonical/coaching-rules.md` — operational rules consuming the catalogue

---

## Two taxonomies, kept separate

The system uses two orthogonal session classifications. Both must remain distinct.

| | Owns | Drives | Lives in |
|---|---|---|---|
| **`SessionType`** | The slot kind on the calendar | Card colour, label, the user's at-a-glance read | `types/plan.ts` (TypeScript union) |
| **Catalogue `category`** | The coaching content of a quality session | Which session goes where, by phase and distance | `session_catalogue.category` (database enum) |

A scheduled session in the plan JSON carries a `SessionType` (e.g. `quality`, `intervals`, `long`) **and** — if it is a quality session — a reference to the catalogue row that produced its main-set content.

### `SessionType` (slot type, drives card colour)

```
easy | long | quality | tempo | intervals | hard
| race | recovery | strength | cross-train | rest | run
```

This union is **not** changing. It is the display contract.

### Catalogue `category` (coaching content, drives selection)

```
aerobic         — base/build aerobic work, including unstructured fartlek
threshold       — sustained sub-threshold and threshold work (Z3)
vo2max          — short hard intervals targeting Z4–Z5
race_specific   — sessions that resemble race demands (MP segments, HM-pace intervals)
ultra_specific  — long-duration aerobic work for 50K and 100K
```

---

## Schema

```sql
CREATE TABLE session_catalogue (
  id                    TEXT PRIMARY KEY,            -- snake_case identifier, stable
  name                  TEXT NOT NULL,               -- short display name
  category              TEXT NOT NULL,               -- one of the five values above
  purpose               TEXT NOT NULL,               -- one-line coaching purpose
  phase_eligibility     TEXT[] NOT NULL,             -- subset of {base, build, peak, taper}
  distance_eligibility  TEXT[] NOT NULL,             -- subset of {5K, 10K, HM, MARATHON, 50K, 100K}
  fitness_level_min     TEXT NOT NULL,               -- one of {beginner, intermediate, experienced}
  difficulty_tier       INT NOT NULL,                -- 1 (easiest) to 5 (hardest)
  main_set_structure    JSONB NOT NULL,              -- structured work/recovery pattern
  intensity_zones       TEXT[] NOT NULL,             -- which Z1–Z5 zones the session touches
  typical_duration_min  INT NOT NULL,                -- minutes, lower bound
  typical_duration_max  INT NOT NULL,                -- minutes, upper bound
  is_free_tier          BOOLEAN DEFAULT TRUE,        -- false → paid-only
  coach_voice_notes     TEXT,                        -- ZONA voice, nullable
  created_at            TIMESTAMPTZ DEFAULT NOW()
);
```

### `main_set_structure` shape

JSON describing the session's main set. Two common forms:

**Continuous block** —
```json
{ "type": "continuous", "duration_mins": 30, "zone": "Z3" }
```

**Repeats** —
```json
{
  "type": "repeats",
  "reps": 8,
  "work": { "distance_m": 400, "pace_target": "3K" },
  "recovery": { "duration_secs": 90, "type": "jog" }
}
```

Phase 1 specifies the full schema for `main_set_structure` and freezes it before seeding.

---

## V1 catalogue (14 sessions)

Phase 1 seeds these 14 rows. `coach_voice_notes` for each is drafted in Phase 1 and shown for explicit user approval before the seed migration is written.

| # | id | Name | Category | Phases | Distances | Fitness ≥ | Tier | Duration |
|---|---|---|---|---|---|---|---|---|
| 1 | `aerobic_steady` | Steady aerobic | aerobic | base, build | all | beginner | T1 | 30–50 min |
| 2 | `aerobic_hills` | Aerobic with hills | aerobic | base, build | all | intermediate | T2 | 40–60 min |
| 3 | `fartlek_unstructured` | Unstructured fartlek | aerobic | base | all | intermediate | T2 | 40 min |
| 4 | `tempo_continuous` | Continuous tempo | threshold | build, peak | HM, MARATHON, 50K, 100K | intermediate | T3 | 20–40 min Z3 block |
| 5 | `tempo_cruise` | Cruise intervals | threshold | build | HM, MARATHON, 50K, 100K | intermediate | T3 | 3×10 min Z3 / 2 min jog |
| 6 | `progressive_tempo` | Progressive tempo | threshold | build, peak, taper | HM, MARATHON, 50K, 100K | intermediate | T3 | 30 min Z2→Z3 |
| 7 | `intervals_classic` | Classic VO2max | vo2max | peak | 5K, 10K | intermediate | T4 | 5×3 min Z4–Z5 / 2 min jog |
| 8 | `intervals_short` | Short VO2max | vo2max | peak | 5K | intermediate | T4 | 8–12×400m @ 3K pace |
| 9 | `intervals_long` | Long VO2max | vo2max | peak | 5K, 10K | intermediate | T4 | 4×1000m @ 5K pace / 2 min jog |
| 10 | `mp_long_run` | Marathon-pace long run | race_specific | peak | MARATHON | intermediate | T4 | long run with final 30–50% at MP |
| 11 | `hm_pace_intervals` | HM-pace intervals | race_specific | peak | HM | intermediate | T4 | 4×2km @ HM pace / 3 min jog |
| 12 | `ultra_race_sim` | Ultra race simulation | ultra_specific | peak | 50K, 100K | intermediate | T4 | 2–3hr at slightly above goal ultra pace, fuelling every 25 min |
| 13 | `back_to_back_long` | Back-to-back long | ultra_specific | build, peak | 50K, 100K | intermediate | T4 | Sat 90 min Z2 + Sun 2–3hr Z2 |
| 14 | `time_on_feet` | Time on feet | ultra_specific | peak | 100K | intermediate | T5 | 4–6hr easy hike/run mix on race-like terrain |

**Free vs paid:** rows 12, 13, 14 (ultra-specific) are `is_free_tier = false`. Free users requesting an ultra plan are blocked at the API layer (Phase 6 feature gate); the engine never reaches a state where it would offer them an ultra session.

---

## Selection rules

The rule engine selects from the catalogue when it has decided a quality session is due in a given week. The selector takes:

| Input | Source |
|---|---|
| Race distance | `plan.meta.race_distance_km` → mapped to `5K | 10K | HM | MARATHON | 50K | 100K` |
| Phase | computed by `computePhases()` from week number |
| Fitness level | `plan.meta.fitness_level` |
| Tier | from `getUserTier()` at the API boundary |
| Specificity target | `GENERATION_CONFIG.SPECIFICITY_BY_PHASE[phase]` |

A row is **eligible** when:

1. The race distance appears in `distance_eligibility`.
2. The current phase appears in `phase_eligibility`.
3. The user's fitness level satisfies `fitness_level_min` (with the standard ordering `beginner < intermediate < experienced`).
4. The user's tier satisfies `is_free_tier` (paid users see all rows; free users see `is_free_tier = true` only).
5. The catalogue `category` aligns with the phase's specificity target — peak-phase race-specific sessions are preferred for HM/MARATHON; peak-phase vo2max sessions are preferred for 5K/10K; peak-phase ultra-specific sessions are preferred for 50K/100K.

Among eligible rows the selector is **deterministic for a given week**: the index is `hash(planId, weekN) mod eligibleRows.length`. This guarantees that two regenerations of the same plan produce the same output (relevant for `applyRecalibration`).

---

## ZONA voice notes

Every catalogue row carries `coach_voice_notes`, a short string in ZONA voice that becomes the session's `coach_notes` in the plan JSON when the AI enricher is unavailable. The enricher may overwrite with longer-form copy for paid/trial users.

Voice rules (from `docs/canonical/brand.md`):

- One sentence is better than two.
- Specific beats abstract.
- Honest, slightly sarcastic, encouraging without cringe.
- Never motivational (no "crush it", "beast mode", "you've got this").
- No emojis in functional copy.

The 14 voice notes are drafted in Phase 1 and shown for explicit user approval before the seed migration is written.

---

## Versioning

The catalogue is versioned through Supabase migrations. To add a session:

1. Add a migration that inserts a new row.
2. Update this document with the new row in the table above.
3. If the new session changes the selection logic (a new category, a new eligibility rule), update `lib/plan/ruleEngine.ts` and `docs/canonical/CoachingPrinciples.md` together.

To retire a session, add a `deprecated_at` migration column rather than deleting — historical plans may carry references.
