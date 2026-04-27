# Post-fix diff — 2026-04-28 review

Status: HIGH block complete. MEDIUM (M-01..M-04) and LOW (L-01..L-03) **pending human approval before proceeding.**

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

## Commit granularity note

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
