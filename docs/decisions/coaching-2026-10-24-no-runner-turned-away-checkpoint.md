# Coaching Board — NO-RUNNER-TURNED-AWAY-01, the checkpoint's inputs (2026-10-24, third sitting)

**Trigger:** soft, qualifies. Phase B was built and scored before the flag could turn on (the founder's before/after
rule), and the after-measurement found the ruled design serves almost nobody. Three interactions neither earlier
sitting saw.

## Evidence (full marathon population, staging scored, `lib/plan/stagedScore.ts`)

| | Staged cases clean | What fails |
|---|---|---|
| **As ruled and built** | **5.7%** of 880 | **76.5% refused again by §111**: §29's fresh-return HEURISTIC (experienced training age + under 25 km/wk + longest run under 10 km → ×0.7) discounts the volume they ran, so a runner exactly at the door is treated as 70% of it. 8.8% refused by §113 on the long run typed at signup |
| §29 not applied to observed volume | 7.1% | **WEEK1-LEAP on ~76%**: e.g. a finish-goal door of 9 km, the ramp ending at 8.8, the marathon block's week 1 at **14 km (+59%)**. The race block's own minimum structure is above the door |
| **+ the checkpoint long run = the block's longest session, + a target that is the lowest volume ≥ the door from which the race block is clean** | **68.7%** (37.6% at the door, 31.1% with a higher target; median target 1.03× the door, max 2.08×, up to 8 extra base weeks) | **31.4%: no target fits** the runway while leaving §44's block |

Prototyped behind temporary switches and reverted; the engine is unchanged by this sitting.

## Conflict scan

**§29** (its WHY: *"a runner who says 18 km/week after a 6-month gap is naming the volume they aspire to, not the volume
their tendons and bones have absorbed"*) · **§113** (refuses below `MIN_SESSION_DISTANCE_KM.long` = 5 km, because week
one's long run would be a leap) · **§2** and its week-1 step rules (WEEK1-LEAP: weekly ratio, absolute step, per-run
step) · **§111** (unchanged) · **§116 Am. 7, 9** · `FOUNDATION_LONG_RUN_MAX_PCT` 35 (the ramp's long run) ·
`S111-FOUNDATION-CREDIT-01` (veto, upheld: nothing below credits unrun volume).

## The board

**🏃 Hutchinson (chair).** All three findings are the same mistake in different clothes: the checkpoint asked the
engine a question using inputs that describe the runner on the day they signed up. Volume, long run and "are they a
returner" were all signup facts. At the checkpoint we have run data and a plan they followed. The fix is not a new
rule; it is asking the existing rules with current facts.

**📊 Seiler.** No objection. All three keep the base building easy.

**🎯 McMillan.** The leap is the one a runner would feel. Twelve kilometres a week, then fourteen in week one of the
marathon block, is exactly the cliff the ramp was meant to remove. So the ramp ends where the race block can begin as a
step. On the 31% with no fitting target: they still get the staged plan, and at the checkpoint the consent screen
offers the run-walk finish or a later race. That is honest, and it is not a refusal at signup.

**🩹 Willy.** On §29 I was the one who wrote "tendons and bones". At the checkpoint they have spent the ramp absorbing
exactly that volume, and the ramp itself began at §29's 70% when §29 applied. Applying it again is double counting,
not caution; it does not apply to OBSERVED volume. On the long run: the observed longest single run in the base-build
weeks, never the stated one and never the prescribed one. If they did not run it, §113 is right to stop them, and the
consent screen says why.

**⚕️ Sims.** Agree with Willy on both. On the higher target: it lengthens base building for some runners by up to eight
weeks. That is fine provided the plan says so from day one; a moving checkpoint is the surprise gate McMillan ruled
out in the first sitting.

**💪 Blagrove.** Silent.

## Ruling — CORRECT WITH AMENDMENT

| # | Ruling |
|---|---|
| **C1** | **§29 does not apply to observed volume.** At the checkpoint the input is marked observed and `effectiveStartKm` takes it as consolidated (§29's WHY is about a declaration; this is a measurement on a plan we prescribed). §29 is unchanged for every declared input |
| **C2** | **The checkpoint's long run is the observed longest single run in the base-build weeks** (Q2's principle extended: observed, never stated, never prescribed). §113 is then asked as written |
| **C3** | **The checkpoint target is the lowest weekly volume at or above §111's door from which the race block's first week is a step, not a leap** (§2's week-1 rules), computed at generation and **fixed on the plan from day one** (Sims). Q1's placement then uses that target |
| **C4** | Where no target fits the runway while leaving §44's block, the runner is **still staged**, with `reaches_door: false`, and the checkpoint's consent screen offers §117's run-walk finish or a later race. Never a refusal at signup |
| **C5** | Re-measure before the flag: the staged-clean figure must reproduce the prototype's 68.7% within noise, and the founder's bar is reported beside it |

**Not changed:** §29 for declared volume, §111's ratio, §113's floor, §2, §44, the veto.

## Artifacts (at build)

1. **Principle** — §116 Am. 9, the checkpoint-inputs paragraph (C1–C4); a note on §29 that it governs declared volume.
2. **Numeric** — none new: C3 reuses §2's week-1 thresholds and C2 reuses `MIN_SESSION_DISTANCE_KM.long`.
3. **Checks** — a test that the same runner at the door passes when observed and fails when declared-fresh (C1); a
   checkpoint long-run test (observed vs stated, C2); the staged plan's `door_km` is its C3 target and the race block
   generated from it carries no WEEK1-LEAP (an invariant on the composed plan, `stagedScore`); falsified each.

## SLT escalation

None.

## Built (2026-10-25), with one correction stated

**C3 was built to its text first and measured 64.5% clean**, short of C5's 68.7%. The cause was the gap between the
words and the measurement: the text said the race block's first week must be a step; the prototype the board ruled on
searched for the lowest target from which the race block is CLEAN (validator plus every coach objection). C5 binds the
build to the measurement, so the code implements the measured rule, which contains the written one (the leap is one of
the objections). **Re-measured: 71.0% clean.** C4 is now explicit: a staged plan records `target_found`, and where it is
false the checkpoint answers `checkpoint_choose` instead of building an unclean block. Every arm falsified.

## What this does not settle

The 31.4% no-fit cohort's experience at the checkpoint (design, then founder words); the walk-run start (Phase D).
