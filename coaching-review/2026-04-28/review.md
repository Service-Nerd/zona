# Zona Plan Coaching Review — 2026-04-28 (Case 04 — Marathon)

Single-case emergency review triggered by a generated marathon plan that should not have been produced. Persona: 47, returning runner, hip injury history, 4:00 marathon goal at NYC, 11 weeks out.

This review is shorter than rounds one and two because the dominant finding is structural: **the engine should have refused or warned, not generated**. Most other concerns are downstream of that one decision.

Status: 🆕 = new finding · ❌ = unfixed despite prior rounds · ⚠️ = quality concern.

---

## Headline finding

🆕 **The engine generated a time-targeted marathon plan with 11 weeks of preparation for a returning runner with hip injury history, and labelled it `volume_profile: "build"`.** This is the most serious coaching error surfaced across all three review rounds. Marathon builds for intermediates are 16–20 weeks. 11 weeks is half that. The runner cannot reach race-specific fitness in that window. The engine had the opportunity to refuse, recommend distance change, or recommend race deferral. It did none of those things.

The brand positioning is *"Training plans that stop you overtraining."* This plan is the kind of plan that positioning exists to prevent.

---

## Specific concerns

### Structural (caused by inadequate plan length)
- ❌ **Plan is 11 weeks: 2-week base, 1-week deload, 2-week build, 2-week peak, 4-week taper.** Two-week base is not a base. Quality work begins in W4 with only 2 weeks of aerobic foundation behind it.
- ❌ **W5 long run 10.5km → W6 long run 30km is a +185% week-on-week jump.** Round-one principle stated long-run progression must not exceed +20%/week. This violates it by a factor of 9. Either the invariant doesn't fire in peak phase or doesn't fire at all.
- ❌ **W6 and W7 are consecutive 30km MP long runs with no recovery week between.** For a 47-year-old returning runner with hip history, two back-to-back 30km MP-finish efforts is high injury risk.
- ❌ **Peak weekly volume only 45–46km for a 42.2km race.** Peak should be ≥125% of race distance for marathon. Runner runs further on race day than in any single training week.
- ❌ **Taper is 4 weeks long.** Marathon taper is typically 2–3 weeks. 4 weeks detrains the runner and compresses build phase further.

### Distribution / quality
- ⚠️ **W6 weekday runs cut to 4km each to fit the 30km long run within volume cap.** 67% of W6 mileage in one run. Lopsided week.
- ⚠️ **Three "Progressive tempo" sessions in 11 weeks (W5, W8, W10) with identical pace targets.** Round-two M-02 (taper variety) didn't catch this — these aren't all in taper.
- ⚠️ **W4 quality straight out of W3 deload with only 2 weeks of base.** Too soon for a returning runner.

### Communication
- ⚠️ **`returning_runner_allowance_active: true` in meta but no explanatory note.** Compare to the maintenance downgrade pattern in round two — that was explicit. This is silent.
- ⚠️ **`resting_hr: 0` in meta.** Default-empty value got past validation.

---

## What worked (for completeness)

- Hip injury → no hill repeats anywhere. H-04 from round one working for non-knee flag.
- Returning-runner allowance fired (started W1 lower than stated current). Round-two M-03 working mechanically.
- Marathon-pace long runs structured correctly ("Easy first. Hit goal pace on tired legs."). H-08 pattern adapted to marathon.
- Goal pace 5:41/km surfaced, MP intervals at 5:34–5:48/km within ±2%.
- Race week has Sat easy 9km in addition to shakeouts. Round-two M-05 working.
- Tune-up callout in W5.

These are real wins, but they're polish on a plan that shouldn't exist.

---

## Constitutional gaps

These are new principles the engine is missing entirely.

1. **Minimum prep time per race distance.** Engine has no concept of "you don't have enough time for this race". Needs one.

2. **Long-run progression cap is not phase-exempt.** The existing principle exists but appears phase-exempt or silently disabled in peak. Should apply universally.

3. **Peak weekly volume floor for marathon/ultra.** Engine has a peak-vs-base ratio (round-one H-06) but no absolute floor scaled to race distance.

4. **Consecutive peak long runs must alternate.** Engine doesn't enforce stimulus alternation in peak phase.

5. **Returning-runner allowance must be communicated.** Mechanism works but is silent.

6. **Input validation must reject empty critical fields.** `resting_hr: 0` should not be accepted.

See `backlog.md` for full priority-ordered fix list with paste-ready snippets.

---

## Why this case matters beyond itself

The other three cases passed without prep-time warnings because their distances and timelines were reasonable: 12 weeks for 5K (plenty), 12 weeks for 10K (plenty), 14 weeks for HM (adequate). The engine appeared to handle race specificity correctly. Adding a marathon case revealed that the engine's race-specificity logic was a function of `race_distance_km × phase_durations` without checking whether the timeline actually supported the race.

This is the kind of finding that justifies running review rounds with new personas regularly, not just iterating on the original three. Recommend adding marathon and ultra cases to the standard review set going forward.
