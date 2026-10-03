# TAPER-OVER-PEAK-SLOW-01 — the validator rejects a shape the constitution already ratified

**Date:** 2026-10-03 · **Tier:** Systemic · **Status:** RCA complete, remedy routed to the Coaching Board
**Reported by:** the morning ops digest, as a constitutional violation of §121
**Severity to the runner:** none observed. No prescription is wrong. The defect is in what the
validator REJECTS, and it is the SECOND instance of that class today.

---

## 1. Symptom

The digest reported `INV-PLAN-RACE-NOT-VOLUME` (§121) firing on the sweep:

> Taper week 13 carries 16km against a peak-phase maximum of 13km — the taper must not read as
> the plan's hardest block

§121's message attributes the inversion to the race session being counted as training volume.

## 2. Is it still real? Yes — and the count I first reported was wrong

**18 firings across 14,265 plans (0.13%)**, overshoots +2 to +4 km.

⚠️ **I first reported "five failing inputs" to the founder. That was the explain CAP, not the
count** — `property-validate-plans.ts` holds `explained.length < 5`. A display limit read as a
population. Same class as every other denominator error in this repo's record: the number came
from the tool's output, not from the tool's definition.

⚠️ **The cohort grid cannot reach this at all: 0 firings in 39,632 plans.** Only the property
sweep varies the axes that produce it (`days_cannot_train`, `max_weekday_mins`, `benchmark`).
Any gate written against `cohortGrid` would be vacuous by construction.

## 3. Which behaviour is correct? NEITHER side is wrong — and doctrine already said so

Reproduced the 10K case in full (`days_available: 2`, five blocked days, `current_weekly_km: 5`):

```
week  phase   type     weekly_km
   5  base    normal       13
  10  build   normal       18      <- the plan's real high-water mark
  11  peak    normal       12      <- PEAK PHASE COLLAPSES
  12  peak    normal       13
  13  taper   normal       16      <- the firing
  14  taper   race          0      <- race correctly excluded
```

**The taper is not too big. The peak is under-delivered.** And the race contributes 0 km, so
§121's actual mechanism (`sumWeeklyKm` excluding `type === 'race'`, `ruleEngine.ts:4036`) is
intact and working.

🔴 **The Coaching Board ruled this exact shape on 2026-09-15 (TAPER-DEPTH-01, §6 Amendment 1),
in almost these words:**

> *"What the original measurement actually found is a **peak-phase under-delivery**: on 3-day
> plans the peak phase delivers as little as 0.67 of its own curve while every other phase
> clears 0.87, so the correctly-tapered week lands above it. That is §23's
> `structuralPeakInversion`, already ruled and already treated. **Of the 8 plans in 504 whose
> first taper week exceeds the peak phase, 8 of 8 are classified `volume_profile: 'maintenance'`
> and carry a `volume_constraint_note`. Zero are silent.** The runner is told."*

And §23's CD-10 note (SLT-signed 2026-08-06) licenses the cause:

> *"the plan's highest week may sit in the base phase … We do **not** force peak volume above
> base — doing so would raise injury risk for exactly the day-job runner this product protects."*

**Re-measured today on a wider population and a later engine: 18 of 18 are
`volume_profile: 'maintenance'` with a `volume_constraint_note` PRESENT. Zero are silent.**
§23's disclosure obligation is fully discharged on every single firing case.

## 4. RCA — why it survived

**The invariant's own comment states a premise that has since become false.** Verbatim:

> *"Before §121 that was violated by 15.3% of plans and 50% of marathons, and **excluding the
> race session no taper anywhere exceeded its peak phase — the race was the entire cause**."*

That was TRUE on §121's grid at its sitting. The wider sweep now finds 18 cases where a taper
exceeds peak with the race correctly excluded, caused by §23's already-ruled peak
under-delivery. So `INV-PLAN-RACE-NOT-VOLUME` tests a PROXY ("taper ≤ peak") for its real claim
("the race is not training volume") — two conditions that were exactly equivalent when it was
written and are not equivalent now.

### Class: THE REMEDY WAS APPLIED TO ONE TWIN — and the twins are named in doctrine

Three board-authored invariants guard the same inversion. **Two carry §23's disclosure
exemption. One does not.**

| Invariant | Treatment of a declared maintenance plan |
|---|---|
| `INV-PLAN-PEAK-IN-PEAK-PHASE` | §23 CD-10: *"stays **warn** for maintenance plans precisely for this reason"* ✅ |
| `INV-PLAN-TAPER-LR-NOT-ABOVE-PEAK` | §6 Am.1: *"stays `warn`"* (NOISE-GATE-01) ✅ |
| **`INV-PLAN-RACE-NOT-VOLUME`** | **`severity: 'error'`, no exemption** ❌ |

### Second instance of this class TODAY

This morning's `INV-PLAN-MAX-WEEKDAY-MINS` report was the same shape: the validator lacked §82's
ratified exemption, so it raised errors for the engine doing exactly what the board ordered.
**Two fake constitutional violations in one digest, both from a validator that had not been
told about an exemption the board had already granted.** The digest is reporting honestly; its
source of truth is incomplete.

## 5. Remedy — SHIPPED, and it is not the one I first proposed

I opened with "assert §121's claim directly by recomputing the exclusion set". **I measured that
candidate before writing it and it failed.** A validator-side recomputation using
`easyPaceFromPlan` diverges from the producer's `PaceGuide.minPerKmEasy` by **up to 3 km on 2.0%
of weeks** (39,632 plans, 568,224 weeks) — against a **5 km signal** for a 5K race. A check whose
noise floor is 60% of its signal is not a check. The producer/checker-split hazard, caught by
measurement rather than by review.

**What shipped, in two layers:**

**1. The mechanism — `lib/plan/raceNotVolume.test.ts`.** `sumWeeklyKm` contributes **0** for a
race session, asserted at 5K / 10K / HM / marathon / 50K, distance- **and** duration-anchored
(beginners carry no `distance_km` on 95.8% of sessions, and an exclusion keyed off
`distance_km != null` would leak the race back in for exactly §121's worst cohort). Plus the
inverse arm: strength and rest still excluded, every real run still counted.

**2. The invariant, scoped to the RACE WEEK**, found by session `type` — never phase or position.

### Why scoping was right, measured

| | race-week scope |
|---|---|
| False fires on the 18 ratified cases | **0 of 18** |
| Catches §121's own worst case (peak 25 / race week 59) | yes |
| Catches a re-inclusion on a **marathon** | 5,764 of 8,528 |
| Catches a re-inclusion on a **5K or 10K** | 🔴 **0 of 20,736** |

The last row is why layer 1 exists. **The old proxy had the same blindness and nobody had said
so** — §121's table reads *5K 0% · 10K 0.3%*, which looks like "the defect does not occur there"
and is partly "this shape of check cannot see it there".

### A second defect found by falsifying the gate

§121's Config names **two** mechanisms. `planScale`'s half has had a direct test since the ruling.
**`sumWeeklyKm`'s half — which produces every `weekly_km` the runner reads — had none.** The
one-sided-join shape, eleven days live.

### A duplication deliberately NOT removed

The mutation that refused to apply revealed `strength || rest || race` three times in
`ruleEngine.ts`. **They are not copies.** They answer "may this be shrunk to the weekday cap?",
"does this count as training volume?" (§121) and "should this carry an estimated-HR note?". A
shared owner would couple three independent decisions, so a later change to what §121 counts
would silently move the weekday cap and a coach note. **DRY would be the defect here**, and it is
recorded in place to stop the next pass making it.

### Falsification — run, not predicted

| Mutation | Result |
|---|---|
| Delete the race exclusion in `sumWeeklyKm` | **6 arms red** |
| Delete it in `planScale` | **1 red** |
| Revert the scope to every taper week | **2 red** |
| Find the race week by phase instead of session type | **2 red** |

⚠️ **The first attempt at mutation 1 did not apply** (the expression is not unique in the file) and
printed the *unmutated* suite's 12 passes. Only the `assert` in the patch script caught it. That is
the second time in two days a falsification of mine would have been reported green without
running — and the reason the asserts are there.

## 6. Blast radius

| Dimension | Effect |
|---|---|
| Prescription | **None.** No plan's sessions, volumes or phases change |
| Live plans | **None.** No remediation needed — nothing was ever mis-prescribed |
| Validator | 18 error-severity firings in 14,265 removed from the sweep baseline |
| Other invariants | §23's `structuralPeakInversion` + `INV-PLAN-PEAK-IN-PEAK-PHASE` already cover the residual |
| Docs | `plan-invariants.md` row for `INV-PLAN-RACE-NOT-VOLUME`; §121's enforcement sentence |
| Website / app | None — no runner-facing surface reads an invariant |
| Baselines | Sweep baseline entry for this code |
| Liveness | The invariant must stay WAKEABLE — a mutation re-including the race must still fire |

## 7. Governance

**Routed to the Coaching Board.** It is close to exempt (zero prescription change, restoring
documented intent) but it NARROWS an invariant the board authored and moves a residual between
two board-authored principles. ⚠️ **This morning I told the founder the §9 foundation fix
"needed no board" and was wrong — it collided with §81's veto.** Routing it.

## 8. Exit criteria

1. §121's enforcement asserts the race exclusion directly, and that check is FALSIFIED by
   re-including the race.
2. The 18 firings are gone because the shape is no longer rejected, NOT because the population
   shrank — sweep plan count unchanged at 14,265.
3. `verify:parity` IDENTICAL. A validator change must not move a single plan.
4. A gate holds the premise that rotted: the invariant must not silently regain error-severity
   reach over a declared maintenance plan.
5. `invariant:liveness` still wakes the rule — it must not become unprovable.
