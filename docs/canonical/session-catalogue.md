# Session Catalogue — Domain Reference

**Authority**: This document defines the catalogue of concrete training sessions the rule engine may schedule. **The runtime source of truth is `lib/plan/sessionCatalogueData.ts` (`V1_SESSION_CATALOGUE`)** — this document describes the schema, the contents, and the selection rules.

> **⚠️ Corrected 2026-08-20 (SC-00).** This line previously named the Supabase `session_catalogue` table as the runtime source of truth. **That was never true.** No code path has ever read the table; every plan ever generated came from the in-repo constant. The table was seeded once (14 rows) and diverged — the constant now holds 18. The table is now **retired**. Do not re-point the engine at it: as it stands that would empty the 5K and 10K taper. Ruling: `docs/decisions/coaching-board-2026-08-19-session-catalogue.md`; evidence: `docs/coaching-review/2026-08-19/session-catalogue-audit.md` § A.0.

**Related**:
- `docs/architecture/ADR-010-session-catalogue.md` — why the catalogue exists (amended 2026-08-20)
- `docs/canonical/CoachingPrinciples.md` §17 — plan signatures and distance shape
- `docs/canonical/coaching-rules.md` — operational rules consuming the catalogue

---

## Two taxonomies, kept separate

The system uses two orthogonal session classifications. Both must remain distinct.

| | Owns | Drives | Lives in |
|---|---|---|---|
| **`SessionType`** | The slot kind on the calendar | Card colour, label, the user's at-a-glance read | `types/plan.ts` (TypeScript union) |
| **Catalogue `category`** | The coaching content of a quality session | Which session goes where, by phase and distance | `CatalogueCategory` in `lib/plan/sessionCatalogueData.ts` |

A scheduled session in the plan JSON carries a `SessionType` (e.g. `quality`, `intervals`, `long`).

> **⚠️ Corrected 2026-08-20 (SC-00).** This paragraph previously continued: *"**and** — if it is a quality session — a reference to the catalogue row that produced its main-set content."* **The plan JSON carries no such reference.** A generated session stores name, distance, duration, pace band, HR band, RPE and coach's notes — nothing else. The rep structure is reattached at *display* time by matching the session's **name** against the catalogue (`DashboardClient.tsx:4445`, `:4517`), a join that already fails on four of the eight quality sessions in the traced 10K plan — every session the engine renames, and every label the AI enricher rewrites. Closing this is **SC-08**, and it is the blocking prerequisite for any v2 structure work.

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

> **Historical (SC-00).** The `CREATE TABLE` below is the retired 2026-04-25 seed, kept as the row-shape reference. The live shape is the `SessionCatalogueRow` TypeScript interface in `lib/plan/sessionCatalogueData.ts`, which mirrors it field for field.

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
  coach_voice_notes     TEXT,                        -- ZONNA voice, nullable
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

## V1 catalogue (27 sessions)

**These are the rows the engine actually ships**, generated from `lib/plan/sessionCatalogueData.ts` — the runtime source of truth (SC-00; the Supabase table is retired).

> **⚠️ Regenerated 2026-08-20 (SC-00 completion).** This table previously listed the **14-row 2026-04-25 DB seed** and had drifted from what the engine ships in three ways: `goal_pace_sharpener` and `hm_pace_long_run` were never added (generator-only from the start); `tempo_continuous`'s taper eligibility (CD-2) never reached it; and the threshold rows' 5K/10K widening (CD-15/SC-04) plus the two new rows (SC-04, SC-05) landed in code first. **SC-00 corrected this document's authority line but not its contents — which is the same defect one layer down.** Regenerate this table from the constant whenever a row changes; do not hand-edit it.

| # | id | Name | Category | Phases | Distances | Fitness ≥ | Tier | Duration |
|---|---|---|---|---|---|---|---|---|
| 1 | `aerobic_steady` | Steady aerobic | aerobic | base, build | all | beginner | T1 | Z2 block |
| 2 | `aerobic_hills` | Aerobic with hills | aerobic | base, build | all | intermediate | T2 | Z2 (hills) block |
| 3 | `fartlek_unstructured` | Unstructured fartlek | aerobic | base | all | intermediate | T2 | fartlek |
| 4 | `tempo_continuous` | Continuous tempo | threshold | build, peak, taper | all | intermediate | T3 | **v2** · continuous, single T-pace effort · `scaling: 'fixed'`, sized by fitness×phase (`THRESHOLD_WORK_TARGET_MINS`) — not a fixed 30 min block. Migrated 2026-09-03. |
| 5 | `tempo_cruise` | Cruise intervals | threshold | build | all | intermediate | T3 | **v2** · reps × (10 min at T / 2 min jog) · `scaling: 'reps'` — rep length is the fixed stimulus identity, rep COUNT scales by fitness×phase (`THRESHOLD_WORK_TARGET_MINS`). Migrated 2026-09-03. |
| 6 | `tempo_cruise_short` | Cruise intervals — short | threshold | build, peak | 5K, 10K | intermediate | T3 | **v2** · reps × (5 min at T / 90s jog) · `scaling: 'reps'` — rep count scales by fitness×phase. Migrated 2026-09-03. |
| 7 | `progressive_tempo` | Progressive tempo | threshold | build, peak, taper | all | intermediate | T3 | **v2** · continuous, 3 equal thirds (E ceiling → Z2-Z3 transition → T target) · `scaling: 'fixed'`, sized by fitness×phase (`PROGRESSIVE_TEMPO_MAIN_MINS`). Migrated 2026-09-03. |
| 8 | `threshold_ladder` | Threshold ladder | threshold | build, peak | 10K, HM, MARATHON, 50K, 100K | intermediate | T3 | **v2** · 3-5-8-5-3 min at T, 90s jogged recovery between · `scaling: fixed` — the ladder's shape IS the session. **Structure-driven sizing added CB-CAT-02 (§86), 2026-09-04:** it previously took the flat quality-session formula and stated **61 min** for a session whose own structure needs **50**. Now summed from its own steps by `fixedShapePlan`, and checked by `INV-PLAN-STRUCTURED-SESSION-DURATION-COHERENT`, whose scope was extended to reach it. Audit §E.5, unblocked by v2 case 1. Eligible at `weeklyKm >= 45` OR a sustained recent threshold pattern (§53, Coaching Board 2026-09-03) — see `THRESHOLD_LADDER_MIN_WEEKLY_KM`/`THRESHOLD_LADDER_ALT_*`. "Fitness ≥" column corrected from `experienced` (stale — CAT-ULTRA-THIN-01, 2026-08-21, replaced the fitness-label gate with the volume floor itself; this table wasn't regenerated). |
| 9 | `intervals_classic` | Classic VO2max | vo2max | build, peak | 5K, 10K | intermediate | T4 | **v2** · reps × (3 min at I / 2 min jog) · `scaling: 'reps'` — rep count scales by fitness×phase (`VO2MAX_WORK_TARGET_MINS`). Migrated 2026-08-21 (SC-08 vo2max). |
| 10 | `intervals_short` | Short VO2max | vo2max | build, peak | 5K | intermediate | T4 | **v2** · reps × (400m at I / 90s jog) · `scaling: 'reps'` — rep count scales by fitness×phase. Migrated 2026-08-21. |
| 11 | `intervals_long` | Long VO2max | vo2max | build, peak | 5K, 10K | intermediate | T4 | **v2** · reps × (1000m at I / 2 min jog) · `scaling: 'reps'` — rep count scales by fitness×phase. Migrated 2026-08-21. |
| 12 | `hill_reps` | Hill reps — {45s\|90s} | vo2max | build, peak | 5K, 10K | intermediate | T3 | **v2** · parameterised · run to hill base, then reps × (uphill @ RPE 8, *no pace* / standing rest / jogged descent capped at E) |
| 13 | `goal_pace_sharpener` | Goal-pace sharpener | race_specific | taper | all | intermediate | T3 | **v2** · reps × (1000m at goal pace / 90s jog) · `scaling: 'reps'` — rep count scales by fitness×phase (`THRESHOLD_WORK_TARGET_MINS`). Migrated 2026-09-03. |
| 14 | `hm_pace_long_run` | Long run with HM-pace finish | race_specific | peak | HM | intermediate | T4 | long_run_with_segment (v1 — not sized by `pacedRepPlan`, a different structural family) |
| 15 | `mp_long_run` | Marathon-pace long run | race_specific | peak | MARATHON | intermediate | T4 | long_run_with_segment (v1 — not sized by `pacedRepPlan`, a different structural family) |
| 16 | `hm_pace_intervals` | HM-pace intervals | race_specific | peak | HM | intermediate | T4 | 4×2000m @ HM pace / 3 min jog (v1 — `pace_target: 'HM'` has no v2 anchor equivalent; not migrated) |
| 17 | `tenk_pace_intervals` | 10K-pace intervals | race_specific | peak, taper | 10K | intermediate | T4 | **v2** · reps × (1200m at goal pace / 2 min jog) · `scaling: 'reps'` — rep count scales by fitness×phase. Migrated 2026-09-03. |
| 18 | `vert_hike_repeats` | Climb repeats — {5 min\|10 min} | ultra_specific | build, peak | 50K, 100K | intermediate | T3 | **v2** · parameterised · run to climb base, then reps × (uphill **hike** @ RPE 6, *no pace* / walk back down) · PAID. The ultra-specific skill nothing in the catalogue taught. |
| 19 | `ultra_race_sim` | Ultra race simulation | ultra_specific | peak | 50K, 100K | intermediate | T4 | long_run_with_fuelling |
| 20 | `back_to_back_long` | Back-to-back long | ultra_specific | build, peak | 50K, 100K | intermediate | T4 | back_to_back |
| 21 | `time_on_feet` | Time on feet | ultra_specific | peak | 100K | intermediate | T5 | time_on_feet |
| 22 | `tempo_over_under` | Over-unders | threshold | build, peak | all | intermediate | **T4** | **v2** · reps × (3 min at **CV** / 3 min at T / 2 min jog) · `scaling: 'reps'`. CB-CAT-01, 2026-09-04. The first row to use the **CV anchor** (0.88–0.92 vVO2max) and the first with TWO work steps in one rep — `pacedRepPlan` sums them, so the rep is 6 min of continuous work, not 3. Prices itself via `SESSION_WORK_OVERRIDE_MINS` (~80% of the steady-threshold band) because half its work sits above T (§85, Sims). Volume-gated at `min_weekly_km: 35` (Willy). Checked by `INV-PLAN-OVER-UNDER-MEAN-NEAR-THRESHOLD`, keyed on `catalogue_id` because §19's numeric arm fires on the label and "Over-unders" contains none of the words it watches. |
| 23 | `threshold_mile_repeats` | Mile repeats | threshold | build, peak | 10K, HM, MARATHON, 50K, 100K | intermediate | **T4** | **v2** · reps × (1600 m at T / 90s jog) · `scaling: 'reps'` — rep count scales by fitness×phase (`THRESHOLD_WORK_TARGET_MINS`). CB-CAT-01, 2026-09-04. 1600 m not 1609 — a 9 m rounding, under three seconds at threshold, and every runner in the product's markets calls it a mile; ADR-015 owns how it displays. Not 5K-eligible: a 1600 m rep is most of a 5K runner's race, and `tempo_cruise_short` gives them the same stimulus at a length that fits. Volume-gated at `min_weekly_km: 40`. |
| 24 | `threshold_pyramid` | Pyramid — {1-2-3-4-3-2-1\|2-3-4-5-4-3-2} | threshold | build, peak | 10K, HM, MARATHON, 50K, 100K | intermediate | T3 | **v2** · parameterised · rungs up and back down at T, recovery half the rung it follows · `scaling: 'fixed'` (16 min / 23 min of threshold work), with **`select_by: 'dose'`** (CB-CAT-02, §86) so the variant is chosen by the runner's fitness x phase band rather than by week number — for a fixed-shape row the variant IS the dose. CB-CAT-01, 2026-09-04. **T3, not T4, deliberately** — its work minutes and pace are the ladder's, so it is variety not difficulty; inflating the tier to populate the tier-4 pool is the dishonesty §85 exists to forbid. Rungs are PARAMETERS, not literals: a first pass gave both variants one hardcoded structure, so the second promised 2-3-4-5-4-3-2 and delivered the first. Whole minutes only (McMillan) — `scaling: 'rep_length'` is declared in the v2 schema and read by nothing. |
| 25 | `intervals_30_30` | Thirty-thirty | vo2max | build, peak | 10K | **experienced** | T4 | **v2** · reps × (30s at I / 30s jog) · `scaling: 'reps'`. §88, 2026-09-06. A 30-second rep **divides the VO2 band finely** (§338) — 24–36 reps span 12–18 min of work in half-minute steps, so the fitness×phase target is reachable, not merely approached (the quantisation §338 records for 3-min / 400 m / 1000 m reps). **10K only** — at 5K it dilutes §22's race-specific ratio (sweep, §88). Highest rep count in the catalogue → gated `experienced` + `min_weekly_km: 40` (Willy). §22-rename-exempt via `isVo2max`. |
| 26 | `intervals_rolling` | Rolling reps | vo2max | build, peak | 10K | **experienced** | T4 | **v2** · reps × (300m at I / 300m float at E) · `scaling: 'reps'`. §88, 2026-09-06. The catalogue's **first continuous VO2max shape** — the float is **run, not jogged** (E ceiling), so HR never fully drops and time-at-vVO2max accumulates across the set. First reps row with a **distance recovery at a non-headline pace** — surfaced a two-writer pricing bug in `pacedRepMainMinutes` (fixed: prices each distance step at its own resolved pace). Seiler's condition: the float is easy and it is meant. **10K only** (§22 ratio, sweep). Gated `experienced` + `min_weekly_km: 35`. |
| 27 | `cv_intervals` | CV intervals | threshold | build, peak | 5K, 10K, HM, MARATHON | intermediate | T4 | **v2** · reps × (4 min at CV / 90s jog) · `scaling: 'reps'`. §88 Tier A, 2026-09-06. Cruise intervals at **critical velocity** (~90% vVO2max), a shade above threshold — the catalogue's first pure-CV row. Classified `threshold` on purpose so it does **not** consume the ≤1 build VO2 slot (SC-07); sized on the threshold work band. Named "CV intervals", never "cruise/threshold" — CV pace sits ~5% above bare T, so a threshold *label* would (correctly) trip `INV-PLAN-LABEL-MATCHES-PACE`; §85 shields the CV anchor from §22's goal-pace override. Rep length 4 min meets SC-04's 4–12 min threshold-rep band (McMillan). Gated `intermediate` + `min_weekly_km: 30`. **The other five Tier A rows are deferred — see backlog CAT-VO2-TIERA** (broken/pyramid/cutdown hit the §8 single-band VO2 model or pool-rotation limits; B0 anchor + B1/B2 with them). |

**Free vs paid:** the three `ultra_specific` rows (`ultra_race_sim`, `back_to_back_long`, `time_on_feet`) are `is_free_tier = false`. Referenced by id rather than row number — renumbering the table used to silently invalidate this line. Free users requesting an ultra plan are blocked at the API layer (Phase 6 feature gate); the engine never reaches a state where it would offer them an ultra session.

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

## ZONNA voice notes

Every catalogue row carries `coach_voice_notes`, a short string in ZONNA voice that becomes the session's `coach_notes` in the plan JSON when the AI enricher is unavailable. The enricher may overwrite with longer-form copy for paid/trial users.

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
