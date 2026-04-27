# Post-fix diff — 2026-04-28 review

Status: **All blocks complete.** HIGH (H-01..H-04), MEDIUM (M-01..M-04), and LOW (L-01..L-03) shipped.

The four HIGH items shipped as a single bundled commit (`f80b0b2`) — see the
"Commit granularity" note at the bottom for why they weren't split. The
regenerated review packets ride in a follow-up commit (`42cf626`) so the engine
diff is easy to bisect against the markdown diff.

Verification commands (all green):

```bash
NODE_ENV=test npx tsx scripts/r23-phase7-validation.ts   # PASS 37 / FAIL 0 / 11/11 cases
NODE_ENV=test npx tsx scripts/property-validate-plans.ts # 103,680 plans, 0 violations
NODE_ENV=test npx tsx scripts/r2-coverage-check.ts       # 26 invariants registered + passing
NODE_ENV=production npx tsx scripts/generate-coaching-review.ts
```

---

## Per-item results

### H-01 — Prep-time validation (two-step UX) — DONE
**Commit:** `f80b0b2`
**Change:** New `lib/plan/inputs.ts` exports `validatePrepTime` and a
`PrepTimeError` class. Called at the top of `generateRulePlan`. Block →
throws; warn without `acknowledged_prep_warning: true` → throws; ok or
warn-acked → returns and the meta block annotates `prep_time_status` /
`prep_time_warning` / `prep_time_alternatives` / `prep_time_weeks_*`.
Returning-runner detection composes existing M-02/M-03 signals
(`returning_runner_allowance_active`, `fresh_return_active`,
`weeks_at_current_volume < 8`) — any of them shifts thresholds up by 2 weeks.
For `goal: 'finish'` the warn zone is treated as ok (only block applies).
Thresholds promoted to `GENERATION_CONFIG.PREP_TIME_THRESHOLDS` /
`PREP_TIME_RETURNING_RUNNER_SHIFT_WEEKS`. CoachingPrinciples §44 added.
`INV-PLAN-PREP-TIME-STATUS-ANNOTATED` enforces meta annotation. The API
route (`app/api/generate-plan/route.ts`) catches `PrepTimeError` and returns
422 with `{ reason, prep, requires_acknowledgment }`. The legacy hardcoded
"marathon needs 8 weeks" rules in the API route's `validate()` were removed —
superseded by the constitution.

### H-02 — Long-run progression cap (universal) — DONE
**Commit:** `f80b0b2`
**Change:** `applyLongRunProgressionCap()` post-pass in
`lib/plan/ruleEngine.ts` walks weeks after the per-week loop and clamps any
LR whose distance exceeds `prev * 1.20` OR `prev + 5km`, whichever is greater.
All phases — no peak exemption. Step-back from a deload to the pre-deload
distance is permitted within `LONG_RUN_DELOAD_STEP_BACK_TOLERANCE_PCT` (5%).
When the cap reduces an LR, easy runs in the same week are clamped so the §9
long-vs-easy ratio (1.25×) survives. `LONG_RUN_PROGRESSION_CAP_PCT`,
`_ABS_KM`, `_DELOAD_STEP_BACK_TOLERANCE_PCT` promoted to `GENERATION_CONFIG`.
CoachingPrinciples §45 added. `INV-PLAN-LR-PROGRESSION-CAP` enforces.
**Interaction:** when the cap forces peak LR below the §24 floor, the meta
block downgrades the plan to `maintenance` and surfaces the diagnosis (which
input to change). The §24 invariant relaxes when `volume_profile === 'maintenance'`.

### H-03 — Peak weekly volume floor for marathon/ultra — DONE
**Commit:** `f80b0b2`
**Change:** `INV-PLAN-PEAK-VOLUME-FLOOR-LONG-RACES` enforces marathon ≥125%
of race distance, ultra 50K ≥100%, ultra >55km ≥80% (capped at 130 km/wk).
Time-targeted only. The maintenance-downgrade trigger in
`generateRulePlan`'s meta block now also fires on §46 failure — same path
as §23 (peak/base ratio) and §24 (peak LR floor). `MARATHON_PEAK_VOLUME_FLOOR_RATIO`,
`ULTRA_50K_PEAK_VOLUME_FLOOR_RATIO`, `ULTRA_LONG_PEAK_VOLUME_FLOOR_RATIO`,
`ULTRA_PEAK_VOLUME_FLOOR_CAP_KM` promoted to `GENERATION_CONFIG`.
CoachingPrinciples §46 added. The marathon-experienced 16-week archetype
already exceeded the floor at peakKm=80 vs floor=53; the invariant fired
nowhere in the 11 archetypes or 103,680-plan property sweep — it's a safety
net, not a behavior change for the existing test set.

### H-04 — Peak long-run alternation — DONE
**Commit:** `f80b0b2`
**Change:** `applyPeakLongRunAlternation()` post-pass walks peak-phase
non-deload weeks, marks the last as peak-level and earlier ones alternating
as step-back. Step-back: drops race-pace catalogue specificity, reduces LR
distance to ≤`PEAK_LR_STEPBACK_MAX_PCT` (80%) of the peak-level distance,
rewrites label/coach-notes as a generic Z2 long run. Easy runs in the
step-back week clamp to preserve §9 ratio. **Only fires when peak phase
contains race-pace specificity** (HM/marathon time-targeted with HM-pace /
MP-finish long runs) — flat-Z2 peaks (5K, 10K, finish-goal) skip alternation
entirely so cases 01 (Sarah) and 02 (Mark) remain structurally unchanged.
Exception preserved: `training_age='5yr+'` + no `injury_history` +
`hard_session_relationship='love'` may carry one consecutive peak per plan.
Themes recomputed after the post-pass so §27 doesn't fire on peak weeks
whose post-clamp volume no longer overloads the prior non-deload week.
`PEAK_LR_ALTERNATION_THRESHOLD_PCT`, `PEAK_LR_STEPBACK_MAX_PCT` promoted
to `GENERATION_CONFIG`. CoachingPrinciples §47 added.
`INV-PLAN-PEAK-LR-ALTERNATION` enforces.

---

## Generated plan diffs

### Case 01 — Sarah, 5K beginner finish goal
- **No structural changes.** Only meta-level additions:
  - `prep_time_status: 'ok'`
  - `prep_time_weeks_available: 11`
  - `prep_time_weeks_required_ok: 8`
- Sarah is `fresh_return_active: true` (heuristic-detected, M-03 from R2).
  Returning-runner threshold shift would lift the 5K ok floor to 10, but she
  has 11 weeks — still ok.
- §47 alternation does not apply (no race-pace LR in peak; finish goal).

### Case 02 — Mark, 10K intermediate sub-50
- **No structural changes.** Only meta-level additions:
  - `prep_time_status: 'ok'`
  - `prep_time_weeks_available: 11`
  - `prep_time_weeks_required_ok: 10`
- §47 alternation does not apply (10K peak quality is VO2max + flat-Z2 long
  run, no race-pace specificity in peak LR).
- §45 cap does not bite — Mark's natural LR progression is within +20%/+5km.

### Case 03 — Anna, HM intermediate 1:55 goal
- **W9 downgraded to step-back per §47.**
  - Prior: W9 "Long run with HM-pace finish", 20 km, 134 min, Zone 2–3,
    RPE 6, coach notes "Easy first…" + "Final third at HM pace: 5:27 /km."
  - Now: W9 "Long run — Zone 2", 15.5 km, 104 min, Zone 2, RPE 4,
    coach note "Step-back week. Easy aerobic — let the legs absorb last
    week's peak before the next push."
  - W9 weekly_km 40 → 36; long_run_hrs 2.2 → 1.7.
- W10 retains the peak-level "Long run with HM-pace finish" (still the §25
  race-specific long run; §47 keeps the LAST peak week peak-level so §25
  is preserved).
- W9 label "Peak — highest volume" → "Peak — consistency" (theme recompute
  after alternation; W9 weekly_km no longer overloads the prior non-deload).
- W9 theme "This is where the fitness is built…" → "Consistency. The work
  is the volume."
- Meta additions: `prep_time_status: 'ok'`, `prep_time_weeks_available: 13`,
  `prep_time_weeks_required_ok: 12`.
- §45 cap does not bite Anna — natural LR progression after alternation
  stays within +20%/+5km.

### Marathon-experienced 16-week archetype (r23-phase7 internal case)
Not in the canonical review packets but worth noting from the test rig:

- §47 alternation reduces W11 to step-back (~25.5 km, generic Z2). W12 stays
  peak-level (32 km MP-finish).
- §45 cap then walks W11 (25.5) → W12 (32): +6.5 km exceeds the +5 km cap;
  W12 reduces to 30.5 km.
- §24 floor is 31.7 km (75% of 42.2 km). 30.5 < 31.7 → meta-block trigger
  downgrades the plan to `volume_profile: 'maintenance'` with the diagnosis:
  > "Peak long run 30.5 km is below the 31.7 km floor (75% of race distance)
  > — week-on-week long-run cap (§45) prevented reaching the ratio. Plan
  > maintains current fitness rather than building it. To enable a build
  > profile: defer the race so the build has more weeks (current 16,
  > recommended ≥16)."
- §24 invariant relaxes when maintenance, so the plan validates cleanly.
- **This is the constitutional answer the 2026-04-28 review demanded** —
  the engine no longer pretends an under-resourced timeline can deliver
  race-specific peak LRs; it surfaces the constraint and still returns a
  coachable plan.

---

## Discovered while working

1. **Suggestion-list copy in the maintenance-downgrade includes a
   wording quirk** — "defer the race so the build has more weeks (current
   16, recommended ≥16)" reads oddly because 16 IS the §44 ok-threshold.
   The conflict is that the runner has *exactly* the warn/ok boundary and
   still hits the §45-driven §24 conflict because of the deload position
   in their plan. Worth tightening: bump the recommended-weeks suggestion
   to `warn + 2` so it's always strictly above the runner's current count.

2. **Theme recompute is a third post-pass** — the engine now does
   alternation, then LR-cap, then theme-recompute. The first two can shrink
   weekly_km, which can falsify "highest volume" themes set during the
   per-week loop. The recompute pass closes that gap, but it's a sign that
   theme selection should ideally run AFTER all distance/volume mutations
   are settled. Candidate refactor for a future round.

3. **Step-back week LR floor floors hard at MIN_SESSION_DISTANCE.long
   (5 km)** — for a very low-volume HM plan, the 80% step-back fraction
   could clamp below 5 km; the floor takes over. No regression in the
   property sweep, but worth surfacing as a coaching-vs-config edge case
   (a 5 km "step-back" after a 6 km peak is silly — at that volume the
   alternation principle stops being meaningful).

4. **Returning-runner detection is now read in three places** —
   `isReturningRunner` in ruleEngine, `isReturningForPrepTime` in inputs.ts,
   and the various existing checks for fresh-return / allowance. The three
   helpers don't share a single signal source. Candidate refactor: lift
   the detection into one helper in `inputs.ts` and have the engine import
   it. Out of scope for this round.

5. **The CLAUDE_CODE_PROMPT.md driver text is stale** — the prompt body
   still references "H-01 through H-10" and `2026-04-27` paths even though
   the REVIEW_DATE block is set to `2026-04-28`. Triggered no actual
   problem (the REVIEW_DATE is the source of truth) but is a sharp edge
   for future rounds.

6. **§24 (peak LR ratio) and §46 (peak weekly volume) both relax under
   `volume_profile === 'maintenance'`** — the constitution's "honest
   constraint" path now has three triggers (§23, §24, §46). Worth
   documenting that pattern explicitly in `docs/canonical/plan-invariants.md`
   so the next reviewer doesn't add a fourth trigger without realising
   the same downgrade exists.

---

## Commit granularity note (HIGH block)

The four HIGH items shipped as one bundled commit. Justification:

- §45's cap can force §24 to fail, which forces a maintenance downgrade.
  H-02 alone fails the test suite without the §24-driven downgrade
  trigger, so H-02 needs that meta-block extension.
- §46's floor uses the same maintenance-downgrade path. Splitting H-02
  and H-03 would mean introducing the trigger in H-02 and extending it in
  H-03, doubling the touch on the same meta block.
- §47's alternation runs as a post-pass before §45's cap; their order
  matters. Splitting them risks an intermediate commit where the order
  is unstable.

Per-item traceability is preserved in this document, in CoachingPrinciples
§44–§47, and in the named invariants `INV-PLAN-{PREP-TIME-STATUS-ANNOTATED,
LR-PROGRESSION-CAP, PEAK-VOLUME-FLOOR-LONG-RACES, PEAK-LR-ALTERNATION}`.
The bundled commit message enumerates each item explicitly.

---

## MEDIUM block

### M-01 — Marathon taper duration cap — DONE
**Commit:** `8edd58d`
**Change:** CoachingPrinciples §49 added — formalises the 1/1/2/3/3/3
cap on actual taper weeks (before race) for 5K/10K/HM/Marathon/50K/100K.
Existing config already matched for the first five distances; 100K
dropped from 4 actual taper weeks (5 entries) to 3 (4 entries).
`MAX_TAPER_PHASE_WEEKS` promoted to `GENERATION_CONFIG`.
`INV-PLAN-TAPER-DURATION-CAP` enforces. No regression on the original three
test cases (their tapers were already at the cap).

### M-02 — Returning-runner allowance communicated — DONE
**Commit:** `36352f9`
**Change:** `returning_runner_note` added to plan meta, format mirrors
`volume_constraint_note`. Two distinct messages:
  - returning-runner allowance: "weeks 1–3 grow at 15% (vs standard 10%)
    because training history allows a faster rebuild";
  - fresh-from-layoff: "week 1 starts at 70% of stated weekly volume
    because returning to running needs caution, not faster ramp".
CoachingPrinciples §51 added. `INV-PLAN-RETURNING-RUNNER-NOTE-PRESENT`
enforces — when either flag is set, the note must be present and non-empty.
No new config (note content computed from existing constants).

### M-03 — Quality session variety across full plan — DONE
**Commit:** `1eac245`
**Change:** Cap = `floor(N/3) + 1` per label across the whole plan;
goal-pace overrides (`X-pace progression / intervals / sharpener`) are
exempt as coordinated specificity (§22). Engine post-pass
`enforceQualityVariety` walks the plan, finds over-represented threshold
bucket labels, and swaps to less-used same-category alternatives
(Continuous tempo / Cruise intervals / Progressive tempo) — same physiology
(T-pace, Z3), only label and coach voice change.
Build override label varied by phase (build → "X-pace progression" so it
doesn't share a label with peak's "X-pace intervals", and so it doesn't trip
§19's "tempo" keyword). `QUALITY_VARIETY_DENOMINATOR` and
`QUALITY_VARIETY_ALLOWANCE` promoted to `GENERATION_CONFIG`.
CoachingPrinciples §53 added. `INV-PLAN-QUALITY-VARIETY-FULL-PLAN` enforces.

### M-04 — Long run not more than 60% of weekly volume — DONE
**Commit:** `1eac245` (bundled with M-03)
**Change:** No single run may exceed 60% of weekly volume. When the
prescription would force this, plan downgrades to maintenance; maintenance
plans relax the invariant (the constraint is already surfaced).
`LONG_RUN_MAX_PCT_OF_WEEKLY` promoted to `GENERATION_CONFIG`.
CoachingPrinciples §52 added. `INV-PLAN-LR-MAX-WEEKLY-PCT` enforces.

---

## LOW block

### L-01 — Reject empty/invalid critical inputs — DONE
**Commit:** `53603cd`
**Change:** `validateInputFields()` in `lib/plan/inputs.ts` runs at the top
of `generateRulePlan` (before §44 prep-time). Throws `InputFieldError` on:
`age` outside 13–90; `resting_hr` outside 30–100 OR === 0; `max_hr` outside
120–220 OR === 0. The form-default sentinel (resting_hr: 0, the value that
slipped past in Case 04) is rejected as INVALID — distinct from missing,
which §50 / L-03 handles. API route catches `InputFieldError` and returns
422 with field, value, and range so the client can highlight the input.
CoachingPrinciples §55 added. No plan-output invariant (the validator IS
the mechanical check). Verified manually that the four edge cases reject
and a valid input still accepts.

### L-02 — Add Case 04 to regression set — DONE
**Commit:** `4106979`
**Change:** Persona added to `scripts/generate-coaching-review.ts`:
returning runner (`weeks_at_current_volume: 4`), age 47, hip injury,
4:00 marathon goal, **13 weeks** out (the original review's 11 weeks now
hits BLOCK after the §44 returning-runner +2 shift; 13 puts the case back
in the warn zone the review was concerned about). `acknowledged_prep_warning:
true` so the script generates without throwing. `resting_hr` deliberately
omitted (the original `resting_hr: 0` is now rejected by §55) to exercise
the §50 fallback path 2 (`percent_of_max` with surfaced assumption note).
The generated plan exercises ALL six 2026-04-28 surfaces simultaneously:
`prep_time_status: 'warned'`, `prep_time_warning`, `prep_time_alternatives`,
`volume_profile: 'maintenance'`, `compression_classification:
'constrained_by_inputs'`, `fresh_return_active: true` +
`returning_runner_note`, `hr_zone_method: 'percent_of_max'` +
`hr_assumption_note`.

### L-03 — HR data fallbacks with surfaced assumptions — DONE
**Commit:** `9aec221`
**Change:** `buildHRZonesWithFallback()` implements four-level fallback
that NEVER refuses generation over missing HR data:
  1. max + resting → Karvonen (no note)
  2. max only → percent of max + assumption note
  3. resting only → estimate max from Tanaka, then Karvonen + note
  4. neither → estimate max + percent of max + prominent note
Plan meta surfaces `hr_zone_method`, `hr_assumption_note` (only when not
Karvonen), `hr_estimated_max` (only when max was estimated). Composes with
§55: nonsense values rejected upstream; missing values flow into the
fallback hierarchy here. CoachingPrinciples §50 added.
`INV-PLAN-HR-ASSUMPTIONS-SURFACED` enforces (method must be present;
non-Karvonen methods must surface the assumption note).
Cases 01–03 all have `max_hr` + `resting_hr` so they land on
`hr_zone_method: 'karvonen'` with no assumption note — no regression.

---

## Generated plan diffs (MEDIUM + LOW)

### Case 01 — Sarah, 5K beginner finish goal
- New meta: `hr_zone_method: 'karvonen'` (L-03), `returning_runner_note`
  describing the fresh-from-layoff 70% start (M-02). Sarah's
  `fresh_return_active` was already true; M-02 just surfaces the note.
- No structural plan changes.

### Case 02 — Mark, 10K intermediate sub-50
- New meta: `hr_zone_method: 'karvonen'` (L-03).
- W6/W7 quality label: "10K-pace intervals" → **"10K-pace progression"**
  (M-03 phase-aware override; build phase distinguishes from peak's
  "X-pace intervals" naming). Same pace, same physiology, same Z3–4, same
  RPE — only the label and coach voice change.

### Case 03 — Anna, HM intermediate 1:55 goal
- New meta: `hr_zone_method: 'karvonen'` (L-03).
- Build quality label "HM-pace intervals" → **"HM-pace progression"**
  (M-03). W10's peak quality retains "HM-pace intervals" via the catalogue.
- W9 step-back from H-04 alternation preserved; no changes from the HIGH
  block delta.

### Case 04 — Mike, marathon time goal, 13 weeks (NEW)
- Permanent test case added (L-02). Generated under
  `acknowledged_prep_warning: true`. Plan meta:
  - `prep_time_status: 'warned'`
  - `prep_time_warning: "12 weeks is below the recommended 18-week
    minimum for a time-targeted MARATHON. … Expect maintenance-grade
    volume rather than a true build."` (note: 12, not 13 — `weeksBetweenLocal`
    floors the date diff; race is on a Monday-aligned Sun 12 weeks out.)
  - `prep_time_alternatives: [...]` (race the HM, switch to finish, defer)
  - `volume_profile: 'maintenance'`
  - `compression_classification: 'constrained_by_inputs'`
  - `fresh_return_active: true`
  - `returning_runner_note: "Fresh-from-layoff start: week 1 begins at 70%
    of your stated current weekly volume (29 km vs 38 km stated). …"`
  - `hr_zone_method: 'percent_of_max'`
  - `hr_assumption_note: "Zones derived from max HR only (no resting HR
    provided). Karvonen … is more accurate. To refine: measure resting HR
    first thing in the morning, lying down, for 1 minute."`

---

## Discovered while working (MEDIUM + LOW)

7. **Section numbering of CoachingPrinciples.md has gaps.** Sections jump
   49 → 51 (no §50 originally — I added L-03 there to fill it) and 53 → 55
   (gap at §54). The "constitution" finale section bumps each round but
   doesn't repair gaps. Worth a one-time renumber pass; safe because no
   code or doc references §54 / earlier missing numbers.

8. **`weeksBetweenLocal` floor-rounds.** Case 04's race date 2026-07-27 is
   exactly 13 weeks from 2026-04-27 by date arithmetic, but the function's
   `Math.floor` produces 12 because of the local-time / midnight semantics.
   The §44 thresholds use the floor result. For Case 04 this is fine
   (12 ≥ 12 block, < 18 warn → warn), but the prep_time_warning text says
   "12 weeks" rather than the user-facing "13 weeks out". Worth a docs note
   on the user-visible round-off, or a refinement to ceil the diff.

9. **Quality-variety post-pass only handles threshold-bucket labels.** The
   `enforceQualityVariety` swap pool currently only knows three threshold
   alternatives (Continuous tempo / Cruise intervals / Progressive tempo).
   If a future review surfaces over-represented VO2max or aerobic-bucket
   labels, the swap pool needs widening. Property sweep didn't flag any so
   no current issue.

10. **Goal-pace override label naming convention is now phase-bound.** Build
   produces "X-pace progression"; peak produces "X-pace intervals"; taper
   produces "X-pace sharpener" (when it falls through to the override
   path). This is internally consistent but the `INV-PLAN-RACE-SPECIFIC-
   EXPOSURE` invariant only checks for "pace" substring — it accepts all
   three. Worth a docs note in CoachingPrinciples §22 explaining the
   phase-bound naming so future contributors don't normalise to one label.

11. **`fresh_return_active` and `returning_runner_allowance_active` are
   mutually exclusive (engine code) but both could in principle activate the
   `returning_runner_note`.** The note picks between two messages based on
   `isFreshReturn`. If a future change makes them coexist, the note would
   only describe one. Low risk — but worth a guard or a note merge if it
   ever changes.

12. **L-01 input validation has no plan-output invariant.** The validator
   `validateInputFields` IS the mechanical check (it throws before
   generation), but a future code path that bypasses it (e.g., a new
   internal generator that doesn't call generateRulePlan) wouldn't be
   caught by an output check. The 2026-04-27 round established that all
   generation paths funnel through `generateRulePlan`; L-01 is safe today
   but worth a meta-check in `r2-coverage-check.ts` confirming no
   alternate generators exist.

---

## Final commit list

```
61f1a22 chore(coaching-review): regenerate cases 01-03 after MEDIUM+LOW block
4106979 chore(coaching-review): [2026-04-28/L-02] add Case 04 to standard regression set
9aec221 fix(engine):  [2026-04-28/L-03] HR data fallback hierarchy with surfaced assumptions
53603cd fix(engine):  [2026-04-28/L-01] reject nonsense critical input fields
1eac245 fix(engine):  [2026-04-28/M-03,M-04] quality variety across plan + LR weekly-fraction cap
36352f9 fix(engine):  [2026-04-28/M-02] surface returning_runner_note in plan meta
8edd58d fix(engine):  [2026-04-28/M-01] cap ultra (100K) taper at 3 weeks before race
e32f990 docs(coaching-review): post-fix-diff for 2026-04-28 HIGH block
42cf626 chore(coaching-review): regenerate cases 01-03 after 2026-04-28 HIGH block
f80b0b2 fix(engine):  [2026-04-28/H-01..H-04] prep-time validation, LR cap, marathon volume floor, peak LR alternation
```

All commits verified against the full suite at HEAD:
```
NODE_ENV=test npx tsx scripts/r23-phase7-validation.ts   → PASS 37 / FAIL 0 / 11/11 cases
NODE_ENV=test npx tsx scripts/property-validate-plans.ts → 103,680 plans, 0 violations
NODE_ENV=test npx tsx scripts/r2-coverage-check.ts       → 31 invariants registered + passing
NODE_ENV=production npx tsx scripts/generate-coaching-review.ts → 5 files (cases 01-04 + INDEX)
```
