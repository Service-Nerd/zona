# Coaching Board — GOALPACE-5K-01, goal-pace work a 5K beginner cannot run (2026-10-23)

**Input:** founder brief (2026-10-22) and the RCA in this session. **Trigger:** soft, qualifies: it changes what the
engine prescribes (§22, §83/CD-16, §24b). **Reproduced** on HEAD `0f68bdd0` from the stored `generator_input` of plan
c8aef8f9 (5K, beginner, free, VDOT 27.8, target 28:00 vs benchmark 32:42, `goal_beyond_measured_fitness`).

## Conflict scan (sections AND amendments)

- **§22** MUST price second-half build/peak quality at goal pace; VO2max exempt. **SC-05 closure (2026-09-03):** at 5K
  "race pace and I-pace largely coincide, so the VO2max rows already deliver race-specific physiology".
- **§83 / CD-16 (2026-08-20)** and **§44 Am.2:** "the plan is built toward the target as stated"; where the target
  inverts the ladder the engine MUST reconcile OR declare (`goal_beyond_measured_fitness` + a non-comfortable band).
  This plan declares. **§83 also rules HR follows the zone label "by construction".**
- **CB-BEGINNER-CATALOGUE-01 (2026-09-19):** kept `beginner_goal_pace_blocks` OFF 5K/10K because "at 5K/10K a
  beginner's goal pace sits at or above threshold, so blocks at it are not a first structured session", and because
  the relabelled tempo rows ("5K-pace sustained") already satisfy §22. 🔴 **The tension the board must face: the same
  ruling judged short blocks at goal pace too much, and accepted a 20-minute CONTINUOUS block at it.**
- **RACE-ANCHOR-CV-OVERRIDE-01 (sitting 3):** zero `race_specific` rows eligible in BUILD at 5K/10K at any fitness;
  widening the beginner blocks row was VETOED.
- **PROGRESSION-GOAL-INVERTED-01:** making §22's override yield was probed and REFUSED (exposure ratio 44% vs ≥50%).
- **§79:** VO2max rows are `fitness_level_min: intermediate`, so a declared beginner never gets them; the control
  plan d933dc40 was correct only because that runner declared intermediate.
- **§24b + ZONES-BEGINNER-BANDS-01 (2026-09-28):** that ruling states beginners' MP/HM fields are null and that
  un-nulling them "starts prescribing §24b segments to beginners". **This beginner's week 7 carries an MP + HM-pace
  long run with bands**, so either the null is on a different axis than the ruling assumed or it has regressed.
- **§47** (5K/10K skip, decided by label), **§36/§6** (taper), **§1** (counts sessions: shape changes cannot move it).

## Evidence (measured, free tier, `generateRulePlan`, 2026-10-23)

Grid: 5K/10K × beginner/intermediate × goal gap 0/5/10/20% × 15/25/35 km × 3/4 days × 9/12 weeks.
**The shape is identical at every gap; only the pace moves.**

| Cohort | Plans | Goal-paced sessions | of which a single continuous goal-pace step ≥ 8 min | Plans with one | Longest |
|---|---|---|---|---|---|
| 5K beginner | 12 | 52 | 18 | **12** | 20 min |
| 5K intermediate | 12 | 32 | 8 | 6 | 22 min |
| 10K beginner | 6 | 30 | 18 | **6** | 20 min |
| 10K intermediate | 6 | 24 | 2 | 2 | 18 min |

The traced plan: W6 "5K-pace sustained", 21 min at 5:29–5:43 (goal 5:36) for a runner who raced 6:32/km at 163 bpm;
HR band 148–162 (Z3, from the row's category).

## The seats

🏃 **Hutchinson (chair):** §22's own 5K premise (SC-05) is that 5K race pace IS VO2 physiology, and VO2 work is reps with
recovery. Twenty continuous minutes at 5K race pace is about 70% of the race, every week: that is a time trial, not a
session, and it is that at gap 0 as much as at gap 20. The engine reaches it only because a beginner has no VO2 rows
and the override is shape-blind. **The specificity §22 wants can be delivered in reps.**

📊 **Seiler:** no §1 effect (session counts). At 5K the continuous-vs-reps distinction is the whole physiology; at 10K
race pace sits between T and I, and 18 minutes at it is a hard but real tempo for a trained runner. Scope the shape
rule to **5K at every level and 10K beginners**; leave 10K intermediate continuous work as it is.

🎯 **McMillan:** coaches train the fitness you have and race the goal you chose. Pricing the work at a pace the runner
cannot hold teaches them to fail every Thursday. **Supports S2 in full:** when the goal is beyond measured fitness,
race-specific work is priced at a projected pace and the goal is shown as the stretch.

🩹 **Willy:** the injury vector is sustained near-VO2 running for a 6–18-month runner who is also adding volume
(W4 stacks first quality, strides, a +42% long run). Reps with recovery cut the tissue load per session. **Strongly
supports S1.** On §24b: a beginner was not meant to get MP/HM segments (ZONES-BEGINNER-BANDS-01); gate it (S3).

⚕️ **Sims:** nothing sex-specific here; supports the honesty of S4 (the runner should be told what is realistic).

💪 **Blagrove:** no objection from this seat.

## Recorded disagreement

**Hutchinson vs McMillan on S2.** Hutchinson keeps goal pace in SHORT reps (the runner must feel race pace before race
day, which is §22's reason to exist) and prices anything sustained at fitness. McMillan would price all second-half
race-specific work at the projected pace and keep exact goal pace for the taper sharpener only. **What settles it:** the
projection itself (how much VDOT a beginner gains in 8–12 weeks) has no measured basis in this repo yet.

## Ruling

| Item | Ruling |
|---|---|
| **S1 — goal pace only in rep shapes** | **CORRECT WITH AMENDMENT.** Scope: 5K at every level, 10K beginners. On a §22 goal-paced week, a continuous or progression row is not used; the slot takes a rep-structured row (recovery between reps), with no goal-pace work step longer than `GOAL_PACE_CONTINUOUS_MAX_MINS` (8, the brief's figure; the number is checked at build against the rep rows actually eligible). Where no rep row is eligible for that runner, the slot is priced at fitness (T) and keeps its threshold label, which §22's ratio must then be measured to tolerate. 10K intermediate and HM/marathon unchanged. |
| **S2 — price at an attainable pace when the goal is beyond fitness** | **CORRECT in direction; the projection is INSUFFICIENT EVIDENCE.** Amends CD-16 by name: "declare" alone is not enough where the declared gap is priced into sustained work. Built later, once a projection constant is measured. S1 removes the worst case meanwhile. |
| **S3 — §24b MP + HM-finish long run** | **CORRECT.** Not for beginners (restores ZONES-BEGINNER-BANDS-01's stated intent); beginners get §24d's negative-split finish. Verify at build why this beginner reached it. |
| **S4 — tell the runner the honest projection** | **CORRECT in principle** (§83: "may not pretend not to be"). Depends on S2's projection; copy to the founder, placement to the Design Board. Not built now. |
| **D2 — pace and HR on goal-paced work** | **CORRECT WITH AMENDMENT to §83.** A goal-paced step's zone and HR come from where its PACE sits in the runner's ladder, not from the row's category. |
| **D4 — VO2 for beginners** | **No change.** §79 stands; S1 delivers rep-shaped goal-pace work without opening VO2 rows to beginners. |
| **New invariants** | `INV-PLAN-GOAL-PACE-SHAPE` (S1 scope: no continuous goal-pace work step over the cap), `INV-PLAN-PACE-ZONE-COHERENT` (D2), `INV-PLAN-CATALOGUE-ELIGIBLE` (every placed row inside its distance and fitness bounds, including the taper path). The brief's step-label invariant is not needed: D3 does not reproduce. Each falsified at build. |

**Measurement required at build (Willy binding):** `measure:fitness` and `cohort:shape` before/after, the per-session
count above re-run, and §22's exposure ratio on the changed cohort.

## Not settled
S2's projection constant; S4's copy and placement; e49ea589 (live, race 28 Nov) is the founder's decision under the
live-plan policy.

## Founder sign-off (2026-10-23)
S1–S4 agreed as ruled. Regenerate c8aef8f9 and e49ea589 after the fix, each shown as a dry-run diff before it is applied.

**Regeneration (2026-10-23).** c8aef8f9 rebuilt with `scripts/goalpace-5k-01-regen.ts` after the founder read its dry run: same start, race and calendar (9 weeks, same dates), 8 session days changed in weeks 5–8 (four goal-pace sessions now `beginner_goal_pace_reps`, both peak long runs the negative-split finish, week 6 24→27 km instead of the old 22-then-26 dip and jump), the load note and race-week copy corrected. Before: GOAL-PACE-SHAPE, PACE-ZONE-COHERENT, CATALOGUE-ELIGIBLE; after: clean. The prior plan is in `plan_archive` (2026-10-23 09:13), and a read-back of `plans` confirmed 0 errors. The script differs from `fleet-invalid-debt-01-regen.ts` in one guard: a synced run refuses only if it falls on or after the plan start (her 15 were all before it). e49ea589 is still to do; it has started and carries AI copy, so it needs a session swap rather than a rebuild.

**e49ea589 patched (2026-10-23 12:56).** `goalpace-5k-01-regen.ts --plan e49ea589`, dry run read by the founder, applied by him. Only weeks 5–9 open (weeks 1–4 byte-identical to the archived plan on read-back); 5 session days changed, all four goal-pace Wednesdays now Zone 4–5 at 175–203 bpm with the §33 Am. step note; race-week and load notes corrected. Heart rate taken from the profile (203 bpm, `user_confirmed`): the stored answers said 198, which a rebuild would have restored (`REBUILD-HR-FROM-PROFILE-01`). 7 completions and 4 moved sessions untouched, AI week labels and themes kept, 0 errors. Prior plan in `plan_archive`.

---

# Amendment sitting — S1's fallback, measured before build (2026-10-23)

**Why the board re-sat.** Measured from `V1_SESSION_CATALOGUE`: a 5K or 10K **beginner** is eligible for exactly two
non-aerobic rows, `tempo_continuous` and `progressive_tempo`, both continuous, and **no rep-structured row in any phase**
(every rep row, including `goal_pace_sharpener`, is `fitness_level_min: intermediate`; the sharpener is also taper-only).
So S1's fallback ("no eligible rep row → price at T") would remove ALL build/peak goal-pace work from S1's own core
cohort, and `INV-PLAN-CATALOGUE-ELIGIBLE` would then remove the taper sharpener they reach only through the unchecked
taper path. **Zero goal-pace exposure before race day, against §22's MUST.** The ruling's fallback was unsatisfiable for
the population it was written for; founder chose option A.

**Proposal (A):** a new row, `beginner_goal_pace_reps` ("Goal-pace reps"), `race_specific`, **5K and 10K, beginner only**
(`fitness_level_min` = `fitness_level_max` = beginner, the CB-BEGINNER-CATALOGUE-01 scoping that kept a new row out of
2,324 non-beginner parity cases), build/peak/taper, free tier: short reps at goal pace with an **easy jog** between.

**Conflict scan.** CB-BEGINNER-CATALOGUE-01 excluded `beginner_goal_pace_blocks` from 5K/10K ("not a first structured
session"): **not contradicted** — the first quality session is W4 at T, before §22's half-way line; goal-pace weeks come
after it. RACE-ANCHOR-CV-OVERRIDE-01 sitting 3 deferred "a new build-eligible goal-paced row" as INSUFFICIENT EVIDENCE
**with its own gate** (`measure:fitness` before/after, refusal count, selection MEASURED not inferred): that gate binds
this build. Widening `beginner_goal_pace_blocks` was VETOED there: this is a separate row, not a widening. §53: the
pigeonhole arm covers a one-row pool; measured at build. §79: no VO2 rows opened to beginners.

🏃 **Hutchinson:** two-minute reps at 5K goal pace is the standard first race-pace session; the runner feels the pace in
doses they can hold, which is §22's reason to exist. 📊 **Seiler:** no §1 effect. 🎯 **McMillan:** right shape for 5K;
**dissent recorded** that at 10K, where goal pace sits near threshold, two minutes is short and three to four would be
the coaching norm; not settled without a measured second row. 🩹 **Willy, binding:** the recovery is an easy JOG of at
least the rep's length, never a standing rest, and total goal-pace time in one session stays **at or under 12 min**
(under half the 5K race), scaling from 4 reps in build to 6 at peak, 4 in taper. ⚕️ **Sims:** no objection. 💪
**Blagrove:** no objection.

**Ruling: CORRECT WITH AMENDMENT (amends S1).** S1's fallback for 5K/10K beginners becomes `beginner_goal_pace_reps`:
reps of `BEGINNER_GOAL_PACE_REP_MINS` (2) at goal pace, easy jog of the same length, `BEGINNER_GOAL_PACE_REPS_BY_PHASE`
{build 4, peak 6, taper 4}, goal-pace minutes ≤ `BEGINNER_GOAL_PACE_MAX_SESSION_MINS` (12). It serves the taper too, so
beginners no longer need the ineligible sharpener and `INV-PLAN-CATALOGUE-ELIGIBLE` can hold everywhere. "Price at T"
remains the fallback only where no row (including this one) is eligible. **Gate at build (from sitting 3, binding):**
`measure:fitness` and `cohort:shape` before/after, refusal count, and the per-session goal-pace measurement re-run.
McMillan's 10K dissent recorded. Founder sign-off required (it changes the signed-off S1).

**Founder signed off the amendment, 2026-10-23.**
