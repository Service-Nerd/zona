# Coaching Board — `GETRUNNING-WALKRUN-LRHALF-01` (2026-11-20)

**Trigger:** backlog item (🏃 COACHING BOARD), deferred to the board by `GETRUNNING-WALKRUN-FLOOR-01` (2026-11-12).
**Question:** §117 Am. 7 prescribes a walk-run start to a runner at or above §116's volume floor whose declared longest
run is under `WALK_RUN_START_MIN_LONGEST_RUN_KM` (2 km). That is ratified for a STAGED block; §118's producer
(`generateGetRunningPlan`) does not do it, and doing it the staged way (reseed the ramp at the floor) cuts what the
plan builds. Which half yields?
**Evidence:** `scripts/board-evidence-getrunning-four.ts` (READ-ONLY), sections 2 and `--prod-inputs`.

## Analysis (written before any seat spoke)

**The item's figures, re-derived.**

| item says | re-measured 2026-11-20 | note |
|---|---|---|
| **524 of 748** accepted base-build plans (70%) are this shape, all raise the `warn` | **206 of 286** (72%) on my production-sequence grid; **206 / 206** carry the `warn` | different grid (ruler values only, 4 distances, 8 runways, 2 training ages); the share agrees, the counts are not comparable |
| reseeding costs **−11.1 km at 6 km/week, −18.7 at 8, −33.9 at 12** | **identical** at runway ≥ 15 | **but 6, 8 and 12 are not ruler values** (`WEEKLY_KM_STEP: 5`). At reachable volumes: **cw 10 −26.3, cw 15 −45.3, cw 20 −64.3 km** (runway ≥ 15); at runway 10, −16.3 / −28.1 / −39.9 |
| *"a runner who cannot run 2 km continuously being prescribed continuous running"* | **confirmed**: `cw 10 / lr 1` week 1 is three continuous 3.3 km easy runs, `run_walk` absent | |
| production | **0 live plans of this shape** (4 base-build plans, longest runs 5–8 km); **0 of 63** real declarations with a longest run (plan stamps + 29 refusal/staged events) are this shape | |

**What the re-measurement found that the item does not say.** The reachable shape is **every one** of `cw ≥ 10`
with `lr ∈ {0, 1}` (by cw: 10 → 30, 15/20/25/30 → 44 each; by lr: 0 → 148, 1 → 58). A runner cannot cover 10 km in a
week in runs of at most 1 km on seven days or fewer (10 ÷ 7 = 1.43 > 1). **So all 206 are declarations where the
longest run is shorter than the mean run their own weekly volume implies — one of the two numbers is wrong.** §117
Am. 7's sitting already named this cohort: *"450 were at 10–30 … off one mis-set longest-run slider (the ruler starts
at 0, step 1, and only `longest ≤ weekly` is enforced)"*, and narrowed Am. 7 so that it would NOT reseed them on the
staged path. §113 refuses these runners deliberately and attaches §118's offer, which is how they reach this producer.

**So the item's two options are not the only two.** (A) Reseed at the floor: costs 26–64 km of destination on a
runner whose volume figure is probably the true one, which is the hazard Am. 7's narrowing and §116 Am. 11 (*"a volume
ramp is not a long-run ramp"*) exist to refuse. (B) Do nothing: prescribes continuous 3.3 km runs to someone who may
have told us 1 km is their longest. (C) Keep the ramp where the runner is and carry §117's 6/1 run-walk instruction on
every ramp session, as L5 (2026-10-25) already does after a walk-run start: §117 Am. 4 separates the PRESCRIPTION from
the PEAK, so the instruction changes nothing the plan builds.

**What the evidence can and cannot show.** It shows the reachable shape, its cost under (A), and that (C) touches no
volume by construction (L5's `applyRunWalk` keeps total minutes). It cannot say which of the two declarations is true
for any runner, and it has no production runner to look at.

**Settled-ground scan.** §117 Am. 5 (the longest run answers readiness to run), §117 Am. 7 and its narrowing,
§116 Am. 11 part narrowed by code review (*"the floor seed now requires §117's walk-run start"*), §117 Am. 4
(prescription ≠ peak), L5 (the ramp after a walk-run start carries 6/1), §117 Am. 8 (the instruction and the peak
reduction are two predicates). Nothing settled is re-opened.

## 🔍 Conflict scan

§113, §116 (floor note, Am. 2, 11, 12), §117 Am. 4, 5, 7, 8, §118 Am. 4, §2 Am. 2. **(A) conflicts with §116 Am. 11's
narrowing and Am. 7's own narrowing** (both refuse a volume cut driven by the longest-run signal). **(B) leaves
§117 Am. 5 unmet** for whatever share of these runners told the truth about their longest run. **(C) conflicts with
nothing**: it is Am. 4's separation and L5's mechanism applied to a second producer.

## Seats

**🏃 Hutchinson (chair).** The submission framed it as destination against safety. Measured, it is a population that
has told us two things that cannot both be true. The board cannot rule on which one is. It can rule on a prescription
that is right whichever one is, and there is one.

**📊 Seiler.** All easy either way. No objection.

**🎯 McMillan.** I will not take 26 to 64 km off a 10–30 km/week runner because a slider sat at zero. Walk breaks on a
runner who does not need them cost them nothing they will notice: they will take them or they will not. I would rather
the wizard asked "is that right?" when the longest run is shorter than the average run, but that is not mine to rule.

**🩹 Willy.** If the longest run is true, the per-run load is the problem, and the 6/1 pattern caps the continuous bout
at six minutes, which is what L5 is for. If the volume is true, the plan is already correct and the walk breaks are
harmless. **My reservation, recorded:** if the longest run is true then the volume is false, and a ramp built from a
false base is wrong in a way no session pattern fixes. That is an input question, not a prescription one, and I will
not have it solved by cutting everyone's ramp. Reseeding is the Am. 7 hazard again: no.

**⚕️ Sims.** Concur with (C). The cohort this protects (never or rarely ran a continuous kilometre) skews female and
older; walk breaks from the first rep are the evidence-backed entry for them.

**💪 Blagrove.** Silent.

## ⚡ Recorded disagreements

**Willy vs the ruling's scope, not its content:** he holds that the incoherent declaration itself should be caught
before generation, and that (C) is a hedge, not a fix, for the share where the volume is the false number. McMillan
agrees on the input question. **Settled by:** an input-coherence ruling on `longest < weekly ÷ runs a week`, which this
item did not ask and this sitting does not make.

## ⚖️ Ruling — CORRECT WITH AMENDMENT

1. **§118's producer does NOT reseed its ramp at the floor on the longest-run signal.** §117 Am. 7's narrowing and
   §116 Am. 11 apply to §118 exactly as to the staged path: the longest-run half never cuts volume.
2. **When `walkRunStartPrescribed` is true and `walkRunStartApplies` is false on a §118 plan, every ramp session carries
   §117's 6/1 run-walk instruction for the whole block** — L5's mechanism (`applyRunWalk`, total minutes unchanged),
   not the walk-run ladder. Destination change: **0 km by construction**, to be confirmed at build by an endpoint
   parity check over the 206-row shape.
3. **The `warn` becomes ratified:** a §118 plan of this shape whose ramp is continuous is an `error`; a ramp carrying
   the instruction satisfies the arm.

## 📦 Required artifacts (at build)

1. **Principle** — §117 Amendment 9 (or a §118 amendment): the longest-run half on §118's producer is honoured as a
   prescription, never as a reseed; L5's carry applies.
2. **Numeric** — none new (`FINISH_GOAL_RUNWALK_RUN_MINS` / `_WALK_MINS`, `WALK_RUN_START_MIN_LONGEST_RUN_KM` reused).
3. **Mechanical check** — `INV-PLAN-WALKRUN-START-PROGRESSION`'s longest-run arm on a non-staged plan moves from
   `warn` to `error`, satisfied by a carried ramp; falsified by building the shape with the carry removed. Plus a
   build-time measurement: endpoint km unchanged on all 206 grid rows.

## ↗️ Hand-offs

- **Input coherence (`longest_recent_run_km < current_weekly_km ÷ 7`)** — not ruled here; recorded as Willy's and
  McMillan's shared view. Not filed (the founder's instruction).
- SLT escalation: none.

## What this does not prove

- Which declaration is true for any runner in this shape; there are none in production to ask.
- That (C) is safe if the longest run is true AND the volume is true at once — that combination is impossible, so it
  was not modelled.
- The grid's 206 / 286 is not the item's 524 / 748 and is not an impact figure; the production count is 0.
