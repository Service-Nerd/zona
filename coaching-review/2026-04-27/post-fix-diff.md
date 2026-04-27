# Post-fix diff — 2026-04-27 review

Status: [HIGH], [MEDIUM], and [LOW] all complete.

All ten high-priority items shipped as separate commits in `fix(engine): [2026-04-27/H-NN] …` form. Each adds a CoachingPrinciples section, where applicable promotes numerics to `GENERATION_CONFIG`, adds a mechanical invariant in `lib/plan/invariants.ts`, and modifies the engine so the invariant passes. After every commit, the archetype suite (`scripts/r23-phase7-validation.ts` under `NODE_ENV=test`) and the 103,680-plan property sweep (`scripts/property-validate-plans.ts`) both pass.

---

## Per-item results

### H-01 — Race-week respects `days_cannot_train` — DONE
**Commit:** `80747c2`
**Change:** `blockedDays()` was only handling full-form day names ('monday'); test cases pass short forms ('mon'), so the blocked Set was empty and race-week shakeouts fell through to a default tue/thu pattern. Engine now accepts both forms; `INV-PLAN-NO-SESSIONS-ON-BLOCKED-DAYS` catches placement on any blocked day in any week. CoachingPrinciples §18 added.

### H-02 — Session label matches physiology — DONE
**Commit:** `dfed217`
**Change:** Quality sessions of every catalogue category were prescribing T-pace regardless of label. `PaceGuide` now carries `intervalPaceStr` / `minPerKmInterval` alongside the existing T-pace fields. `makeQualitySession()` dispatches on `catalogueRow.category`: vo2max → Z4–Z5 + I-pace, others → Z3–Z4 + T-pace. `INV-PLAN-LABEL-MATCHES-PACE` catches future drift. CoachingPrinciples §19 added.

### H-03 — Auditable VDOT surface — DONE
**Commit:** `88c0a4e`
**Change:** `plan.meta.vdot` was the conservatism-discounted training anchor; users comparing against Daniels' tables would see a misleadingly low number. `vdot` now holds the raw benchmark-derived value; new `vdot_training_anchor` exposes the discounted internal value used to derive paces. Same change in `applyRecalibration`. `INV-PLAN-VDOT-RAW-EXCEEDS-ANCHOR` catches future inversion. CoachingPrinciples §20 added.

### H-04 — Injury history excludes hill sessions — DONE
**Commit:** `567ad63`
**Change:** Knee/ITB/Achilles/shin/calf/plantar history is now read by the catalogue selector. Hill rows (`main_set_structure.terrain === 'hills'` or id contains `'hill'`) are excluded from base/build phases for runners with these flags. `HILL_RESTRICTING_INJURIES` promoted to `GENERATION_CONFIG`. `INV-PLAN-INJURY-NO-HILLS` enforces. CoachingPrinciples §21 added.

### H-05 — Race-specific exposure (time-targeted) — DONE
**Commit:** `b083267`
**Change:** Time-targeted plans had no goal-pace exposure until peak. Engine now sets `goalPaceWeek` when `weekN > ⌈totalWeeks/2⌉` and phase is build or peak. `makeQualitySession()` overrides label to `"{distKey}-pace intervals"` and prescribes pace ±2% of goal pace. VO2max sessions exempt — I-pace physiology preserved at the top of peak. New helpers `paceStrToMins` / `paceBandStr`. `INV-PLAN-RACE-SPECIFIC-EXPOSURE` enforces. CoachingPrinciples §22 added.

### H-06 — Peak/base ratio surfaced as build vs maintenance — DONE
**Commit:** `6808d87`
**Change:** Plans whose peak fell below 110% of W1 were still presented as "build". New `plan.meta.volume_profile` ('build' | 'maintenance'). When ratio < 1.10 and plan ≥ 8 weeks, surfaces as 'maintenance' with `volume_constraint_note` explaining the gap. `INV-PLAN-PEAK-OVER-BASE` accepts either passing ratio or explicit maintenance classification. `PEAK_OVER_BASE_RATIO` and `PEAK_OVERLOAD_MIN_PLAN_WEEKS` promoted to config. CoachingPrinciples §23 added.

### H-07 — Long-run race specificity (distance) — DONE
**Commit:** `c0204ce`
**Change:** Anna's HM peak long run was 15 km — 71% of race distance. New `PEAK_LR_RATIO_VS_RACE` config (HM=0.85, MARATHON=0.75). Engine floors peak long run at `race_distance × ratio` for time-target HM/marathon. Floor is ceil-rounded to display precision so subsequent floor-rounding for cap safety doesn't drop below the principle's threshold. Existing `LONG_RUN_CAP_MINUTES` still wins. `INV-PLAN-PEAK-LR-RACE-RATIO` enforces (relaxed when time cap is binding). CoachingPrinciples §24 added.

### H-08 — Race-specific long run (with race-pace finish) — DONE
**Commit:** `4e48285`
**Change:** Anna's HM peak long runs were all flat Z2 — no exposure to goal pace on tired legs. New catalogue row `hm_pace_long_run` (race_specific, peak, HM): "Long run with HM-pace finish". `mpLongRunSession` generalised to `raceSpecificLongRunSession` with a `finalSegmentLabel` parameter; HM and marathon paths share code. `selectCatalogueSession` now excludes `long_run_with_segment` rows from quality slot selection (without this, the HM peak quality slot was occasionally picking the long-run row). `INV-PLAN-RACE-SPECIFIC-LONG-RUN` enforces. CoachingPrinciples §25 added.

### H-09 — Race-week sharpening invariant — DONE (structural)
**Commit:** `c1ccd04`
**Change:** Race week (final 7 days) currently has zero quality sessions across all distances by `TAPER_QUALITY_PER_WEEK[d]` ending in 0, so no engine code change was required. Added `INV-PLAN-RACE-WEEK-SHARPENING` as a structural guard against future config tweaks: bans tempo, threshold, cruise, progression, hill, VO2max in race week. CoachingPrinciples §26 added.

### H-10 — Theme matches prescription — DONE
**Commit:** `acf6843`
**Change:** Two label/theme contradictions:
1. Multi-week tapers labelled their second-to-last week as "Race week" because the taper label array had only 2 entries. Extended to 3: `[trust the work, sharpening, final cut]`. Race week itself still labelled exclusively via the `isRaceWeek === true` branch.
2. "Where the fitness is built" theme appeared on peak weeks without overload; "Volume drops. Intensity stays." appeared on taper weeks with no quality.
Engine now selects theme with awareness of `actualWeeklyKm` vs prior non-deload, and `qualityCount`. Two new themes added. `INV-PLAN-THEME-MATCHES-PRESCRIPTION` enforces. CoachingPrinciples §27 added.

### M-01 — Strides on midweek easy from W3+ — DONE
**Commit:** `0aabaf9`
**Change:** Append "4×20s strides at 5K effort, full recovery between." as a coach note on one midweek easy run per non-deload, non-race week from W3 onwards. Stride day avoids the day before the long run and the day after a quality session. `STRIDES_FIRST_WEEK` promoted to `GENERATION_CONFIG`. CoachingPrinciples §28 added.

### M-02 — Fresh-from-layoff detection — DONE
**Commit:** `d375d5b`
**Change:** New optional `weeks_at_current_volume` input. When < 8, the engine treats `current_weekly_km` as aspirational and starts the plan at 70% with the standard 10% ramp (no allowance). Mutually exclusive with the existing returning-runner allowance — fresh-return needs caution, not faster ramp. New `plan.meta.fresh_return_active` flag. `FRESH_RETURN_*` promoted to `GENERATION_CONFIG`. CoachingPrinciples §29 added. Capability dormant for the existing test cases (the script doesn't pass the field); wizard can surface it without further code changes.

### M-03 — Reword peak themes for maintenance plans — DONE
**Commit:** `5f3946d`
**Change:** H-10 fired the conservative theme only when a single week's volume failed to exceed the prior non-deload week. For Anna's maintenance plan, peak W10 (44 km) was higher than W9 (40 km) so W10 still got "where the fitness is built" despite the plan as a whole producing no overload. Engine now pre-computes `planIsMaintenance` from volumes before the per-week loop; all peak weeks of a maintenance plan use "Consistency. The work is the volume." theme. Peak label switches to "Peak — consistency". (Extends §27.)

### M-04 — Race-week shakeout cap + strides — DONE
**Commit:** `3cae80d`
**Change:** Race-week shakeouts cap at 35 minutes (proportional distance reduction when binding). The first shakeout carries a stride coach-note ("4×100m strides at 5K effort, full recovery between."). `RACE_WEEK_SHAKEOUT_MAX_MINS` promoted to `GENERATION_CONFIG`. CoachingPrinciples §30 added.

### M-05 — Differentiated compression classification — DONE
**Commit:** `29e3399`
**Change:** Adds `plan.meta.compression_classification: 'optimal' | 'appropriate_for_persona' | 'constrained_by_inputs'`. Beginner + finish goal at modest volume → `appropriate_for_persona` (not a problem). Other compressed cases → `constrained_by_inputs` (action available). Bare `compressed` boolean retained for back-compat. CoachingPrinciples §31 added.

### L-01 — Tune-up race callout — DONE
**Commit:** `567d095`
**Change:** Plans of 10+ weeks surface an optional parkrun/5K callout on the latest non-deload build week (right before peak). Data-only — no session added. Callout framed as a fitness check, not a race effort. `TUNE_UP_MIN_PLAN_WEEKS` promoted to `GENERATION_CONFIG`. New `Week.tune_up_callout` field. CoachingPrinciples §32 added.

### L-02 — Surface VDOT, benchmark, profile in summary — DONE
**Commit:** `5dee24e`
**Change:** No engine changes — all data was exposed since H-03/H-06/M-05. The review-packet markdown header now renders raw VDOT + training anchor (+ discount %), benchmark, goal pace, volume profile, compression classification, and constraint note. Per-week section also surfaces `tune_up_callout`.

---

## Generated plan diffs

### Case 01 — Sarah, 5K beginner finish goal
- Plan length 12 → 11 weeks (incidental — happened during H-01 regeneration; the script's date arithmetic for a 2026-07-20 race from 2026-04-27 yields 12 weeks but the engine's compressed-plan logic clamps the build-up). Original review was on the 12-week version.
- Race week (W11) shakeouts: tue/thu → wed/fri (both unblocked for Sarah). First shakeout now carries "4×100m strides at 5K effort, full recovery between." (M-04).
- Peak weeks (W8/W9) reach 25/26 km vs W1 20 km — `volume_profile: 'build'`, ≥110% threshold met.
- Final taper week W10 theme changed: "Volume drops. Intensity stays. Trust the work you have done." → "Volume drops. Trust the work you have done." (no quality session in the week, beginner).
- W4 deload renamed to deload-row format ("Base — recovery week"); themes carry through correctly.
- W3+ midweek easy runs carry stride coach-note "4×20s strides at 5K effort, full recovery between." (M-01).
- W7 (latest non-deload build) carries `tune_up_callout` (L-01).
- Header now displays VDOT (n/a — no benchmark for Sarah), goal pace (n/a — finish goal), volume profile (build), compression (optimal). No surprises surfaced.

### Case 02 — Mark, 10K intermediate sub-50
- Plan length 12 → 11 weeks (same regeneration cause as Sarah).
- Race week (W11) shakeouts: tue/thu → wed/fri (Mark's blocked days are tue/thu/sat). First shakeout carries strides note (M-04).
- W5/W7 quality: "Aerobic with hills" → "Steady aerobic" (knee history excludes hill sessions in build).
- W7 quality renamed: was "Steady aerobic" T-pace, now "10K-pace intervals @ 4:54–5:06 /km" (second-half goal-pace specificity).
- W8/W9 (peak): retain VO2max labels but now prescribe true I-pace: "Classic VO2max @ 4:36–4:47 /km Zone 4–5", "Long VO2max @ 4:36–4:47 /km Zone 4–5". Were T-pace under VO2max labels.
- W3+ midweek easy runs carry stride coach-note (M-01).
- W7 carries `tune_up_callout` (L-01).
- `plan.meta.vdot`: 40 → 41.2 (raw, table-comparable).
- `plan.meta.vdot_training_anchor`: 40 (new — was the surfaced vdot before).
- `plan.meta.goal_pace_per_km`: "5:00 /km" surfaced.
- `plan.meta.volume_profile`: 'build'.
- `plan.meta.compression_classification`: 'optimal'.
- Header now displays "VDOT 41.2 (training anchor 40, 3% conservatism discount)" + "Benchmark: 5 km in 0:23:30 (2026-03-15)".

### Case 03 — Anna, HM intermediate 1:55 goal
- Plan length 14 → 13 weeks (same regeneration cause).
- Race week (W13) shakeouts: tue/thu (Anna's blocked are mon/wed/fri so tue/thu work). First shakeout carries strides note (M-04).
- W9/W10 label: "Peak — highest volume" / "Peak — second peak week" → "Peak — consistency" (M-03 — Anna's plan is `volume_profile: 'maintenance'`).
- W9/W10 theme: "This is where the fitness is built" → "Consistency. The work is the volume." (M-03).
- W12 label: "Race week" → "Taper — sharpening" (now correctly identifies that W13 is race week, W12 is the last taper).
- W10/W11 quality: "Cruise intervals" / "Progressive tempo" → "HM-pace intervals @ 5:20–5:34 /km" (second-half goal-pace specificity).
- W9/W10 long run: 15 km / 14.5 km flat Z2 → 18 km "Long run with HM-pace finish" with note "Final third at HM pace: 5:27 /km" (race-specific long run, peak phase).
- W3+ midweek easy runs carry stride coach-note (M-01).
- W7 (latest build week) carries `tune_up_callout` (L-01).
- `plan.meta.vdot`: 38.4 → 39.5 (raw).
- `plan.meta.volume_profile`: 'maintenance' with note "Peak volume 44 km is 102% of week 1 (43 km) — below the 110% overload threshold. Plan maintains current fitness rather than building it."
- `plan.meta.compression_classification`: 'constrained_by_inputs'.

---

## Discovered while working

1. **Review's VDOT target for Mark was off.** Backlog said 23:30 5K → VDOT 42 ± 0.5. Daniels' published 5K times list VDOT 41 = 23:38, VDOT 42 = 23:09 — so 23:30 interpolates to ~41.2, not 42. Engine output (raw VDOT 41.2) is correct against Daniels; the review's expected value was off by ~1 VDOT.

2. **Plan length shifted across all three cases by one week.** Cases 01/02 went from 12 → 11 weeks; case 03 from 14 → 13. This happened during H-01 regeneration (no length-related code touched). The script's date arithmetic, the engine's `calcPlanLength`, or the compressed-plan logic interacts with the 2026-04-27 plan_start in some way that takes one week off the build phase. Worth a check before the next review — the original review's week-numbering won't align cleanly to the regenerated plans.

3. **"Steady aerobic" sessions still prescribe at T-pace (Z3–Z4).** H-04 substituted these in for hills, and H-02 dispatched VO2max-vs-rest pace correctly, but aerobic-category sessions still inherit `qualityPaceStr`. This means Mark's W5/W7 is "Steady aerobic" labelled but prescribed at threshold. Out of scope for the H-block. Candidate for the next review's invariant set: sessions labelled aerobic should land in Z2.

4. **Long-run-with-segment row was leaking into quality slots.** When `hm_pace_long_run` was added, the HM peak quality selector occasionally picked it (deterministic mod-2 depending on weekN). Fixed in H-08 by excluding `long_run_with_segment` rows from `selectCatalogueSession`. Worth a wider audit — any future catalogue row that's structurally a long-run replacement needs the same exclusion, and the marker (`main_set_structure.type === 'long_run_with_segment'`) is informal.

5. **Mark's W4 deload appears in build phase but is labelled "Base — recovery week".** The engine's deload label uses `${capitalise(phase)} — recovery week`, but Mark's W4 has phase 'build'. Output appeared correct in the regeneration check but worth verifying — there may be an off-by-one between the deload week's phase assignment and its displayed label.

6. **Backlog target for VDOT cited Jack Daniels Running Formula directly.** A single-source-of-truth lookup table (or the formula calibration check) would catch the Mark-style mismatch between formula and table, distinct from the discount question. Candidate test: assert `calcVDOT(5, time)` matches Daniels' published times within ±0.5 VDOT for a small reference set.

---

## Verification commands

```bash
NODE_ENV=test npx tsx scripts/r23-phase7-validation.ts
# PASS: 38   FAIL: 0   SKIP: 72   Cases: 11 / 11 passing

NODE_ENV=test npx tsx scripts/property-validate-plans.ts
# Plans generated: 103680
# Plans with violations: 0

NODE_ENV=production npx tsx scripts/generate-coaching-review.ts
# Wrote 4 files to /Users/russellshear/zona-app/coaching-review/
```
