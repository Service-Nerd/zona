# Coaching Board — NO-RUNNER-TURNED-AWAY-01 (2026-10-24)

**Trigger:** soft, qualifies (it changes what the engine prescribes to a refused runner). Founder, today: *"We should
absolutely not be turning anyone away!"*, after a charity runner in Leicester redeemed a code, built two marathon plans,
was refused twice on lowering her weekly volume to 10 then 5 km, accepted a base-building plan with no marathon in it,
and deleted her account 47 seconds later.

**Proposed change.** Every runner who asks for a race gets a plan **for that race**. For the runner §111 refuses on base
volume, that plan starts with §116's ramp and carries the marathon from day one, with §111 re-asked at the end of the
ramp on the volume they actually ran.

## Re-measured first (production, read-only)

| | |
|---|---|
| Refusal events since 2026-09-23 | **26**, from **13 runners** (one is the founder) |
| Race too soon (§44) or too few days (§52) | 8 runners, **all now hold a race plan**: they changed a date or an answer |
| **Base volume too low (§111)** | **6 runners, every one a comped charity marathoner**, 0–10 km/week, 26–29 weeks out |
| Where those 6 are now | 1 marathon plan (changed answers), 1 switched to a half, **2 base building with no marathon**, **1 no plan at all** (0 km/week: §118 needs more than zero), **1 deleted** |
| The §116 on-ramp | **Built and dark** (`ENABLE_BASE_BUILD_ONRAMP` unset). ⚠️ **Switching it on today would make things WORSE:** nothing renders its offer, nothing composes a ramp-then-race plan, and the base-building offer is only attached when the on-ramp offer is absent. The founder was told otherwise this afternoon and corrected before anything changed |

## Conflict scan (sections AND amendments)

| § | Bearing |
|---|---|
| **§111** | Refuses a marathon built more than 4.0× off the base the runner has. **Not reopened**: the ratio is the safety rule |
| **§116 Am. 7** | *"§111 is evaluated at the END of the ramp, on re-declared volume, never credited in advance."* The proposal keeps this exactly: the marathon weeks are conditional on the checkpoint, not granted |
| **`S111-FOUNDATION-CREDIT-01`** (VETOED, INCORRECT) | Credit meant §111 divides by volume the runner has not run, and the whole plan is granted now. **The proposal must not be that.** The difference has to be mechanical, not a framing |
| **§116 Am. 5** | A missed-weeks degradation path, specified and **not built**. The proposal needs it |
| **§116 Am. 8** | The ramp must stand on its own if they never return. Kept |
| **§117** | The finish-goal run-walk marathon has a lower door (9 km/week). The natural outcome when the checkpoint is not met |
| **§118** + SLT copy | Base building; the non-clearing variant may say nothing about a race. A ramp inside a race plan **does** name the race, so the honesty has to move into the checkpoint |
| **§118 `getRunningApplies`** | `effective start > 0`. **A runner at 0 km/week gets nothing.** One of the six |
| **ADR-012** | A structural change surfaces for confirmation. The checkpoint's outcome is structural |
| **ADR-011** | Observed volume comes from HealthKit; an iPhone-only runner without a watch still logs runs, and a manual run counts |
| Prior rulings | The board twice ruled **zero rejection unreachable by coaching alone** (2026-09-20). That remains true of *a safe marathon peak at 0 km/week in 26 weeks*; it is not true of *a plan for the race*, which is what is proposed |

## The board

**🏃 Hutchinson (chair).** We need to separate two things the word "refuse" has been covering. We refuse to *prescribe a
marathon peak the runner cannot reach safely*: that refusal is correct, the veto stands, and nothing today reopens it.
We have also been refusing to *give the runner a plan with their race on it*, and nothing in the evidence ever required
that. Six charity marathoners were told "come back later" and we heard from none of them again. Credit-in-advance was
vetoed because the plan pretended the base existed. A plan that says "these six weeks build you to 12; the marathon
block starts when you've run it" pretends nothing.

**📊 Seiler.** The ramp is all easy (§116 Am. 6), and that does not change. No distribution question. My one condition:
nothing in the marathon block may be pulled forward into the ramp to make the plan look fuller.

**🎯 McMillan.** This is what I do with every beginner who walks in for a charity place: they get a plan to race day,
and the first block is getting them to where the training can start. "Come back in two weeks" is the most reliable
dropout instruction in coaching. My amendment: the checkpoint is a moment the runner sees coming from day one, named
in the plan, not a surprise gate.

**🩹 Willy.** I will hold the line the veto drew. If the checkpoint is decorative, this is the vetoed proposal with
nicer words. So it must be mechanical: at the end of the ramp the engine reads the observed weekly volume, and **the
marathon weeks do not begin unless §111 passes on it.** If it fails, the plan does not quietly carry on. And the
runner at zero is a different body: a walk-run start, not a run ramp, because zero is not "a little".

**⚕️ Sims.** For women starting from near zero the first danger is under-fuelling, and a plan with a marathon on the
front of it pushes harder than a base block does. §116 Am. 4's fuelling note carries into this plan type. And the
checkpoint failing must read as information, never as failure: re-routing to a run-walk finish is a plan for the same
race, not a demotion.

**💪 Blagrove.** Silent; no strength question.

## Recorded disagreements

**Willy and McMillan on the zero-volume runner.** Willy: a walk-run start, built separately, and no marathon block may
be shown until running exists at all. McMillan: show the race and the walk-run start together, because the race is
the reason they opened the app. **Settled by:** the walk-run start ships with the race date and name on the plan, and
the marathon block's sessions are not generated until the first checkpoint passes. Both accepted.

## Ruling

**CORRECT WITH AMENDMENT.** A runner §111 refuses on base volume is given **a plan for the race they asked for**:

1. **Phase 1 is §116's ramp**, unchanged (all easy, §2's rate, §3's cadence, fuelling note), labelled with the race.
2. **A checkpoint at the end of the ramp, named in the plan from day one** (McMillan).
3. **At the checkpoint §111 is evaluated on OBSERVED volume** (HealthKit or logged runs, over the ramp's last
   weeks), never on the declared or projected figure. **The marathon block's sessions do not exist until it passes**
   (Willy). This is the mechanical line between this and `S111-FOUNDATION-CREDIT-01`.
4. **If it does not pass**, the runner is shown the outcome and chooses (ADR-012): §117's run-walk finish if its door
   is met; a short ramp extension if the runway allows; otherwise the honest outcome for the date, a shorter race or a
   later one. **Never a silent continuation and never a dead end** (Sims, Willy).
5. **0 km/week** gets a walk-run start with the race on the plan; no running block is generated until running exists
   (recorded disagreement, settled).
6. **§44 and §52 refusals** are not changed by this ruling. Measured: all eight of those runners reached a race plan.
   They are filed to be re-measured, not ruled today.

**What is NOT changed:** §111's 4.0 ratio, §116's curve, §117's door, the veto on credit in advance.

## Artifacts (at build)

1. **Principle** — §116 Amendment 9: the ramp inside a race plan, the observed checkpoint, the outcome path; §118
   Amendment 4: the zero-volume walk-run start.
2. **Numeric** — `BASE_BUILD_CHECKPOINT_OBSERVED_WEEKS` (how many final ramp weeks are averaged); the walk-run start's
   parameters. No change to existing values.
3. **Invariant** — `INV-PLAN-ONRAMP-NO-RACE-BLOCK-BEFORE-CHECKPOINT`: a plan with an on-ramp carries no race-block
   session before its checkpoint has passed; plus the existing `INV-PLAN-ONRAMP-CURVE-CLIMBS`. `measure:fitness` and
   `measure:envelope` run before and after.

## Routing after this ruling

- **Design Board** — the checkpoint is a new moment on the Plan and Today screens, and the outcome choice is a new
  screen state (design owns the encoding, coaching owns the meaning).
- **SLT** — its 2026-09-20 *"build, not for October"* is this item's sequencing constraint; October ends in a week.
  The founder has instructed the build. Recorded, not escalated.
- **Founder** — the words of the checkpoint and its outcomes.

## What this does not settle

Whether the six runners above are offered the new plan. Their stored plans are unchanged by any engine work; that is a
remediation decision for the founder.
