# Zona Plan Coaching Review — 2026-05-25 (Round 2)

Round-two review of regenerated plans following round-one fixes (see `../2026-04-27/` for round-one context). This review focuses on what the round-one fixes left undone, regressions, and new findings.

Status legend: ✅ fixed · ⚠️ partial · ❌ unfixed · 🆕 new issue.

---

## Cross-cutting summary

The high-leverage round-one fixes landed. Race-week scheduling now respects blocked days in all three plans. VDOT derivation surfaced in meta with a 3% conservatism discount mechanism. Hill sessions removed for runners with injury history. Tune-up callouts, strides, and meta surfacing all shipped.

The harder structural fixes are partial. Race-specific exposure improved but is still below spec for the 10K case. Long-run race specificity landed cleanly for the HM case — strongest single fix in the round.

One genuinely impressive emergent behaviour: **Case 03 self-downgraded to "maintenance" with a clear explanation**. The engine recognised it couldn't hit overload on Anna's constraints and said so. That's H-06 working as intended.

What looks like the bigger pattern under the round-two findings: **invariants are passing where they shouldn't be**. The two failed checks (H-02 VO2max labelling, H-05 goal-pace exposure ratio) are not generator bugs — the generator produced sessions that *should* have failed an invariant and didn't. Investigation should start with the invariant tests, not the generator.

---

## Case 01 — 5K beginner, Sarah

### Strengths
- Real progression curve now in place (W1 20km → W9 26km, +30%).
- Strides correctly added Wed runs from W3 onwards.
- Race week respects blocked days (Wed/Fri shakeouts).
- Tune-up callout in W7 gives Sarah a fitness benchmark mid-build.

### Concerns
- ⚠️ **W1 starts at 20km despite `current_weekly_km: 18`.** M-02 (returning-runner detection) deferred from round one — still relevant. Sarah is returning from a 6-month gap; her stated 18km is itself probably overstated. W1 at 20km is a 10%+ jump on day one.
- ⚠️ **Theme on W8/W9 says "It will feel hard. That is correct."** for an all-easy plan with zero quality work. The H-10 invariant only fires on "intensity stays" themes, not on this copy paired with all-Zone-2 weeks. A peak week of pure easy running shouldn't *feel hard* in the way that copy implies.
- ⚠️ **Long-run progression is HM-shaped, not 5K-shaped.** W9 long run 84min for a 5K finish goal — does Sarah need to run for 84 minutes to finish a 5K? Aerobic development is fine, but progression curve is more half-marathon-shaped.

### Specific recommendations (priority-ordered)
1. **[Medium]** Ship M-02 (returning-runner detection). Sarah's volume could still be too aggressive for an actual returning runner.
2. **[Low]** Re-examine 5K long-run progression. Cap peak long run at ~70min for finish-goal 5K.
3. **[Low]** Tighten theme copy so "It will feel hard" doesn't appear on all-easy weeks.

---

## Case 02 — 10K intermediate, Mark

This case retains the most issues. The round-one fixes addressed the labels but the underlying pace mismatches remain.

### Strengths
- Hill sessions removed cleanly for `injury_history: [knee]`.
- W7 introduced as "10K-pace intervals" at correct goal-pace tolerance (4:54–5:06/km, ±2% of 5:00).
- VDOT mechanism surfaced clearly: anchor 40, applied 41.2 with 3% discount.
- Race week shakeouts on Wed/Fri.
- Goal pace 5:00/km surfaced in meta.

### Concerns
- ❌ **W8 "Classic VO2max" and W9 "Long VO2max" prescribe 4:36–4:47/km.** Mark's true vVO2max from VDOT 41.2 is approximately 4:25/km. The prescribed pace is 11–22 seconds/km slower than VO2max — that's threshold/cruise interval pace, not VO2max. Same coaching error as round one with new labels. The H-02 invariant either has too-loose tolerance or excluded VO2max from the check.
- ❌ **Goal-pace exposure ratio in second half is below spec.** Counted across W6–W11: W6 steady aerobic (not goal pace), W7 10K-pace ✅, W8 "VO2max" 4:36–4:47/km (faster than goal, doesn't count), W9 "VO2max" same, W10 tempo 5:06–5:20/km (slightly slower). At best 2/5 = 40% goal-pace exposure. Spec is ≥50%. H-05 invariant audit needed.
- ❌ **W10 taper Wed still "Tempo run — short" 5km continuous tempo.** Round-one [Medium] recommendation to replace with sharpening reps wasn't actioned.
- 🆕 **Coach notes leak across session types.** W8 VO2max session has the coach note "Boring is the point. If it feels productive, slow down." That's an aerobic/easy coaching cue. Notes appear to be selected by zone or RPE rather than by session intent.

### Specific recommendations (priority-ordered)
1. **[High]** Fix H-02 properly. Either tighten the VO2max pace tolerance to ±5% of true vVO2max, or rename W8/W9 to "Threshold intervals" / "Cruise intervals" to match the prescribed pace. Current state is the same coaching error round one flagged, just with renamed sessions.
2. **[High]** Audit H-05 invariant. Walk through it for Mark's plan and demonstrate which sessions count as "goal pace within ±5%". The pass rate looks below spec.
3. **[Medium]** Coach notes pipeline — select by session label/intent, not by zone or RPE.
4. **[Low]** W10 tempo replacement to 3×1km @ goal pace.

### Constitutional gaps
- **Coach notes must match session intent.** *Coach notes attached to a session MUST be selected by session label/type, not by zone or RPE. A VO2max session never gets an aerobic-coaching note ("boring is the point"); a tempo session never gets a sprint-coaching note ("explosive starts").*
- **Invariant test wiring.** *Every invariant defined in `lib/plan/invariants.ts` MUST be present in the regression test suite that runs against generated plan output. Add a meta-test that fails if any defined invariant isn't being asserted against the test cases.*

---

## Case 03 — Half marathon intermediate, Anna

The case that improved most. Multiple structural fixes landed cleanly. Remaining issues are quality and polish, not coaching errors.

### Strengths
- ✅ **Maintenance downgrade with explanation.** `volume_constraint_note: "Peak volume 44 km is 102% of week 1 (43 km) — below the 110% overload threshold. Plan maintains current fitness rather than building it."` This is exactly the H-06 spec working as intended.
- ✅ **Long run with HM-pace finish.** W9 and W10 long runs include explicit "Final third at HM pace: 5:27 /km" coach note. Cleanest single fix in the round.
- ✅ Peak long run 18km, hits ≥85% of 21.1km race distance.
- ✅ Race-week scheduling correctly avoids blocked Mon/Wed/Fri.
- ✅ Engine added W8 deload to break up the W4-to-peak stretch.

### Concerns
- ⚠️ **W11 and W12 both prescribe "Progressive tempo"** with identical pace targets and identical coach notes. Two consecutive taper weeks running the same session feels like the engine ran out of taper-appropriate quality session ideas. For an experienced runner with `hard_session_relationship: love`, repetition reads as the engine being lazy.
- ⚠️ **Peak long run at the floor.** 18km is 85.3% of 21.1km — just hitting the H-07 minimum. For an experienced runner with `longest_recent_run_km: 18` and no injury history, the engine could push W10 to 19–20km cleanly. Current behaviour is floor-stopping.
- ⚠️ **HM-pace stimulus repeated in same week.** W9 and W10 both have HM-pace intervals AND a long run with HM-pace finish. Two HM-pace stimuli per peak week. For a 42-year-old this might be on the edge.
- 🆕 **`volume_constraint_note` is descriptive, not prescriptive.** Explains the math but doesn't tell Anna which input to change to unlock build mode. H-06 spec asked for both: "Suggest the input change that would unlock more volume."
- 🆕 **Race week is very lightly loaded.** W13 has 8km of training + the 21.1km race. Last run >5km is W12 Sun (9.5km), seven days before race day. Standard HM taper has a slightly longer mid-week run in race week (6–8km easy on Wed). Current taper may be too deep.

### Specific recommendations (priority-ordered)
1. **[Medium]** Replace at least one of the W11/W12 "Progressive tempo" sessions with structured HM-pace work (e.g. W12 becomes "3×1km @ HM pace, 90s recovery"). Two-week tempo repetition is poor coaching.
2. **[Medium]** Push peak long run higher when persona allows. For runners with `hard_session_relationship: love`, no injury history, and `longest_recent_run_km` ≥ floor, target 90–95% of race distance instead of stopping at the 85% floor.
3. **[Medium]** Add a 6–8km easy run to race week on the third available training day. Current race-week non-race volume of 8km is too light for an HM taper.
4. **[Low]** `volume_constraint_note` should suggest the actionable input change to unlock build mode (e.g. "increase `days_available` from 4 to 5 or `max_weekday_mins` from 75 to 90").

### Constitutional gaps
- **Floor-stopping behaviour.** *When persona signals support more aggressive prescriptions (`hard_session_relationship: love`, no injury history, recent volume/distance history at or above floor), the engine SHOULD push prescriptions higher than the spec floor where doing so doesn't violate other principles. Floors are minimums, not targets.*
- **Quality session variety in taper.** *Within taper phase (final 2–3 weeks), no two consecutive quality sessions may use the same session type with identical pace targets. Variety prevents both monotony and the appearance of generator laziness.*
- **`volume_constraint_note` actionability.** *When the engine downgrades to maintenance, the constraint note MUST include both the diagnosis and the actionable input change required to unlock build mode.*

---

## Summary for the engine team

**Net assessment: good round, real progress, two things didn't quite land.**

What worked: race-week scheduling (universal), VDOT mechanism, hill-session removal for injury history, long-run race specificity for HM, maintenance downgrade with explanation. Anna's plan is meaningfully better than round one.

What needs a second pass: Mark's VO2max sessions are still mislabelled (just at a different pace zone now), and the goal-pace exposure ratio is below the ≥50% spec. Both look like invariant tightness issues, not generator bugs — invariants are passing where they shouldn't be.

What's worth celebrating: when the engine couldn't make the constitution work for Anna's constraints, it told us instead of pretending. That behaviour is hard to design for and it's working.
