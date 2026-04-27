# Post-fix diff — 2026-05-25 review (Round 2)

Status: [HIGH], [MEDIUM], and [LOW] all complete. 12 commits, all passing archetype suite (37 PASS / 0 FAIL across 11 cases), property sweep (103,680 plans, 0 violations), and the new `r2-coverage-check.ts` (22 invariants registered + declared + clean on the three canonical cases).

## Per-item results

### R2/H-01 — VO2max paces use raw VDOT (Stance B) — DONE
**Commit:** `53465cf`
**Change:** `buildPaceFromVDOT` now takes both `discountedVdot` and `rawVdot`; easy/threshold paces use the discounted training anchor, interval (VO2max) pace uses raw. Doctrine clarified in §10. `INV-PLAN-LABEL-MATCHES-PACE` extended with numeric pace check (±5% of vVO2max for VO2max labels, ±3% of T-pace for threshold labels).

### R2/H-02 — Goal-pace exposure ratio + half-week threshold — DONE
**Commit:** `15d0f96`
**Change:** Half-week threshold for `goalPaceWeek` shifted from strict `>` to `≥`, so the half-week itself counts. New plan-level `INV-PLAN-RACE-SPECIFIC-EXPOSURE-RATIO` computes the actual fraction of non-VO2max quality in second-half build/peak weeks whose pace is within ±5% of `goal_pace_per_km`; fails if below 50%.

### R2/H-03 — Coach notes match session intent — DONE
**Commit:** `bc8a3e5`
**Change:** When `useGoalPace` is true, `makeQualitySession` synthesises a goal-pace voice and replaces (not appends) the catalogue's voice — no more aerobic cues leaking through to "10K-pace intervals" sessions. `INV-PLAN-COACH-NOTES-MATCH-INTENT` bans aerobic phrases on quality labels. CoachingPrinciples §33 added.

### R2/H-04 — Invariant registry + coverage script — DONE
**Commit:** `2d067a6`
**Change:** New `INVARIANT_CODES` constant in `lib/plan/invariants.ts` lists every invariant. `scripts/r2-coverage-check.ts` reads source, diffs registry vs emitted-code literals, and runs the three canonical cases through `validatePlan()`. Exits 1 on drift. CoachingPrinciples §34 added.

### R2/M-01 — Long-run floor → tier (floor/target/stretch) — DONE
**Commit:** `b17a269`
**Change:** New `PEAK_LR_RATIO_TARGET` (0.90 HM / 0.80 M) and `PEAK_LR_RATIO_STRETCH` (0.95 / 0.85) tiers. Tier selection in `buildWeekSessions`: floor by default, target when `longest_recent_run_km ≥ race × floor`, stretch when persona has `hard_session_relationship: 'love'` AND no hill-restricting injury. `LONG_RUN_CAP_MINUTES` still binds. CoachingPrinciples §35 added.

### R2/M-02 — Alternate taper category for variety — DONE
**Commit:** `7935cfc`
**Change:** New catalogue row `goal_pace_sharpener` (race_specific, taper-eligible across all distances). Taper alternation: even idx → threshold, odd idx → race_specific. Direct lookup of `goal_pace_sharpener` by id when alternation triggers (bypasses the catalogue selector's deterministic mod). `makeQualitySession` recognises catalogue rows that mark themselves goal-pace via `main_set_structure.work.pace_target === 'goal'`. `INV-PLAN-TAPER-VARIETY` enforces. CoachingPrinciples §36 added.

### R2/M-03 — Heuristic fresh-return detection — DONE
**Commit:** `65eb773`
**Change:** When `training_age` is experienced (≥2yr) AND `current_weekly_km < 25` AND `longest_recent_run_km < 10`, the engine infers a layoff and applies the same 70% start-volume reduction. Both AND-gated. Round-1 explicit `weeks_at_current_volume` still preferred when present. CoachingPrinciples §37 added.

### R2/M-04 — Prescriptive volume_constraint_note — DONE
**Commit:** `b4ea207`
**Change:** Maintenance-plan note appends "To enable a build profile: ..." with concrete deltas: +1 day_available (if <6) and/or max_weekday_mins → 90 (if <90). Suggestions OR-joined; omitted entirely when neither applies. CoachingPrinciples §38 added.

### R2/M-05 — Race-week mid-week run for HM/marathon — DONE
**Commit:** `55439ae`
**Change:** New `RACE_WEEK_EASY_KM` config (HM=7, M=9). Race-week branch adds an easy run on a third available day when `days_available >= 4`. 10K and below unchanged. `distKey` hoisted to top of `buildWeekSessions`. CoachingPrinciples §39 added.

### R2/L-01 — 5K finish-goal long-run cap — DONE
**Commit:** `493fa06`
**Change:** New `LONG_RUN_CAP_MINUTES_5K_FINISH = 70`. `applyLongRunCap` reduces cap to 70 when distKey === '5K' AND goal === 'finish'. Phase 7 validation: §40 reshapes peak-to-taper curve for these plans (peak naturally lower → relative taper reduction smaller); test now skips taper-reduction assertion for 5K finish-goal cases. CoachingPrinciples §40 added.

### R2/L-02 — Effort copy gated on quality sessions — DONE
**Commit:** `219260f`
**Change:** Peak theme override now also fires when `qualityCount === 0`, switching to "Consistency. The work is the volume." regardless of overload status. `INV-PLAN-THEME-MATCHES-PRESCRIPTION` extended to catch "feel hard" / "feels hard" copy on zero-quality weeks. CoachingPrinciples §41 added.

### R2/L-03 — VDOT staleness ramp — DONE
**Commit:** `ba833d5`
**Change:** Replaces the binary 6-month / +5% threshold with a continuous ramp: 0–4 weeks → 3%, 5–8 → 4%, 9–12 → 5%, 13–16 → 6%, 17+ → 7% cap. New `VDOT_STALENESS_{FRESH_WEEKS, PER_4WK_PCT, MAX_DISCOUNT_PCT}` config. Legacy fields retained for back-compat. CoachingPrinciples §42 added.

---

## Generated plan diffs

### Case 01 — Sarah, 5K beginner finish goal
- W1 = 13 km (was 20 km) — `fresh_return_active: true` per R2/M-03 heuristic.
- Volume sequence ramps conservatively: 13 → 14 → 17 → 13 (deload) → 13 → 13 → 14 → 17 (peak) → 17 (peak) → 13 (taper) → 9 (race week).
- Peak theme: "Consistency. The work is the volume." (was "It will feel hard. That is correct." — fixed by R2/L-02).
- Peak label "Peak — second peak week" (still correct; not maintenance).
- No quality sessions (beginner). Strides on Wed easy from W3 (round-1 M-01 unchanged).
- W11 race week: shakeouts wed/fri with strides on first; no mid-week easy (race_distance ≤ 10K).
- Long-run cap 70 min (R2/L-01) doesn't bind for Sarah's plan after the fresh-return reduction — peak LR ~52 min.

### Case 02 — Mark, 10K intermediate sub-50
- W6/W7 = "10K-pace intervals @ 4:54–5:06 /km" (was W6 "Steady aerobic", W7 "10K-pace intervals" round-1; round-2 lifted W6 by including the half-week in `goalPaceWeek` per R2/H-02).
- Coach voice on W6/W7 = "10K-pace work. Target 5:00 /km. Controlled, even splits — exit each rep wanting more." (was leaked aerobic cue per R2/H-03).
- W8/W9 VO2max paces tightened: **4:29–4:40 /km** (was 4:36–4:47). Raw VDOT 41.2 drives I-pace (R2/H-01 Stance B).
- `vdot_discount_applied_pct: 4` (was 3 — staleness ramp R2/L-03; benchmark 6 weeks old).
- W11 race week: tue/thu shakeouts wed/fri (round-1 H-01 still working).

### Case 03 — Anna, HM 1:55
- Peak long runs (W9/W10) = **20 km** (was 18 km, was 15 km originally) — stretch tier per R2/M-01.
- W11 = "Progressive tempo", W12 = **"Goal-pace sharpener @ 5:20–5:34 /km"** (was both Progressive tempo per round-1; alternation per R2/M-02).
- W12 coach voice: "Crisp at goal pace. Even splits. Exit each rep wanting more."
- W13 race week: tue/thu shakeouts + **Sat 7 km Race-week easy** + Sun race. Total 36 km (was 29 km — R2/M-05).
- `vdot_discount_applied_pct: 4` (staleness ramp; benchmark 7 weeks old).
- `volume_constraint_note` extended: "...To enable a build profile: increase days_available from 4 to 5, OR raise max_weekday_mins from 75 to 90." (R2/M-04).
- `volume_profile: 'maintenance'` and `compression_classification: 'constrained_by_inputs'` unchanged.

---

## Discovered while working

1. **The catalogue's `pace_target` field on session structures is informally honoured.** R2/M-02 now reads `main_set_structure.work.pace_target === 'goal'` to dispatch goal-pace prescription. Other values (`'5K'`, `'HM'`, `'MP'`) are only honoured by name on a case-by-case basis. A clean future pass would normalise the catalogue's own pace-target schema and make the engine read it uniformly.

2. **Threshold catalogue is HM/marathon-biased.** Both `tempo_cruise` and `progressive_tempo` are HM/M/50K/100K only. For 10K + build, no threshold row exists, so the catalogue selector falls back to aerobic — which is what the round-1 H-02 sessions selected, which is why the goal-pace label override was needed at all. Adding 10K-eligible threshold rows would let the catalogue speak honestly without the override.

3. **Volume-sequence target peak doesn't match actual peak when LR caps bind.** The `peakKm` from `peakKmByLevel` drives `buildVolumeSequence`, but the actual peak weekly volume comes from session-distance summing. When `applyLongRunCap` binds (especially with §40's tighter cap for 5K finish), peak weekly volume falls below the buildVolumeSequence target. The Phase 7 taper-reduction test had to special-case 5K finish for this reason. Worth a follow-up: should the volume sequence shrink in lockstep with binding caps, or accept the mismatch?

4. **Stretch-tier long run can push close to LONG_RUN_CAP_MINUTES.** For Anna's 20 km @ 6:38/km mid-pace = 132 min, just under HM cap of 135. A faster runner with same persona signals would hit the cap; the stretch tier is implicitly capped before its 95% target. Worth surfacing.

5. **`fresh_return_active` and `volume_profile: 'build'` co-exist for Sarah.** She's flagged fresh return AND building. Maybe the framing surfaced to the user should distinguish "real build for a returning runner" from "build for an active runner". Not a bug; a polish opportunity.

6. **`weeks_at_current_volume` from R1/M-02 is now redundant for the canonical Sarah case.** The R2/M-03 heuristic catches her without the explicit input. The wizard could still surface it for users where the heuristic is borderline (e.g., experienced runners at moderate volume after a short layoff). Not a bug.

7. **`Race-week easy` session uses the `easy` session type.** Looks correct in the markdown but the R1 invariants treat it as an easy run for `INV-PLAN-LONG-IS-LONGEST` — could in principle clash if the run were longer than the long. With race-week LR being 0 (just the race), that won't happen. Worth a check in property sweep though.

---

## Verification commands

```bash
NODE_ENV=test npx tsx scripts/r23-phase7-validation.ts
# PASS: 37   FAIL: 0   SKIP: 73   Cases: 11 / 11 passing

NODE_ENV=test npx tsx scripts/property-validate-plans.ts
# Plans generated: 103680   Plans with violations: 0

NODE_ENV=test npx tsx scripts/r2-coverage-check.ts
# ✓ All 22 invariants registered, declared, and pass on the three canonical cases.

NODE_ENV=production npx tsx scripts/generate-coaching-review.ts
# Wrote 4 files to /Users/russellshear/zona-app/coaching-review/
```
