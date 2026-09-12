# SESSION-KM-02 — the measurement the board asked for, and what it overturned

**Date:** 2026-09-12 · **Status:** measurement complete, NOT yet briefed to the Coaching Board
**Detector:** `npx tsx scripts/session-km-02-impact.ts` (executable, self-checking, re-runnable)

The backlog required a working detector before a board sitting, because a first
attempt reported no movement *and* reported 0% long-run step-backs for
non-beginners, which cannot be true — the detector was wrong, not the finding.

**This detector carries its own tripwire, printed first, every run:** on the
sessions §52's invariant *can* already see (`distance_km != null`), it must find
**zero** breaches, because the sweep reports `INV-PLAN-LR-MAX-WEEKLY-PCT` clean
over 16,038 plans. It finds 0 / 12,618. If that line ever flips, the arithmetic
below is void and the script says so. Its control arm — plans that reach §47's
alternation today — reports **31.9%**, not 0%, which is the specific failure the
previous detector had.

---

## Headline: the filed fix is a provable no-op

SESSION-KM-02 was filed as two `?? 0` sites to be swapped for the
`sessionKmOrZero` owner already imported in that file. Applied on a scratch
basis, that change produced **zero** differences:

| Grid | Cases | Differences |
|---|---|---|
| `verify:parity` | 2,916 | **0** — byte-for-byte identical |
| Cohort grid (peak long runs + weekly volumes) | 648 plans | **0** |

Two independent grids agree. The one-line fix changes nothing a runner sees.

### Why: there is a THIRD gate, and it was never filed

§47 is gated on `distance_km` in at least three places on one path:

| # | Site | Effect |
|---|---|---|
| 1 | `ruleEngine.ts:3571` — `peakMaxLrKm <= 0 → return` | the filed one |
| 2 | `ruleEngine.ts:~3609` — `if (!lr \|\| lr.session.distance_km == null) continue` | **inside the mutation** |
| 3 | `ruleEngine.ts:~3637` — `if (s.distance_km == null) continue` | the §9 easy clamp |

Fixing (1) lets a plan *reach* the alternation. (2) then declines to alternate
it. **Reaching the logic is not the same as the logic doing anything.**

### And the real question is not mechanical

The mutation **writes `distance_km`** and derives `duration_mins` from it. So a
genuine fix must decide how a beginner's step-back week is expressed:

- **In kilometres** — one week of an otherwise duration-anchored plan suddenly
  reads "14 km" where every other week reads "90 minutes". Internally
  consistent with the engine, visibly inconsistent to the runner.
- **In minutes** — keeps the plan's voice, and needs the step-back fraction
  (`PEAK_LR_STEPBACK_MAX_PCT`) applied to duration instead.

That is a coaching and product decision. **It is the question for the board**,
and it is a different, larger question than the one the backlog filed.

---

## §52's floor is inert — and currently harmless

`lrKm = lr?.session.distance_km ?? 0` makes `weeklyFloorFromLR = 0`, so the
floor protecting §52's 60% lopsidedness cap never binds on a duration-anchored
week. Measured consequence:

**0 breaches across 2,337 duration-anchored sessions in scope** (all beginner).

The hole is real; nothing is currently going through it. Something else — §9's
easy ceiling and the long-run cap — is holding the ratio. **This does not need
the board, and does not need rushing.**

---

## What this found that was not filed at all: a FIFTH silent pass

`INV-PLAN-LR-MAX-WEEKLY-PCT` — §52's own checker — opened its per-session loop
with `if (s.distance_km == null) continue`. **It skipped every duration-anchored
session**, which is 95.8% of a beginner's plan.

So the producer's floor and the check that guards it were blind to the same
cohort for the same reason. §52 has never surfaced a violation on a beginner
plan — not because those weeks are balanced, but because nothing was looking.
This belongs in the silent-failure catalogue beside the four SESSION-KM-02
already recorded.

**Fixed 2026-09-12** (checker only, no prescription change, ADR-017-exempt as a
defect fix restoring documented intent). It uses the `sessionKmForCheck` helper
that already existed in the same file. 0 new violations across the 16,038-plan
sweep — it opens nothing today; it stops the check being unable to see anything
tomorrow. Guarded by `lrMaxWeeklyPctReach.test.ts`, **falsification-proved both
ways**: the test fails against the old blind code and passes against the fixed
one, checked by reverting.

### A scope trap worth recording

§52's whole block is wrapped in `volume_profile !== 'maintenance'`, and **51% of
the cohort classifies maintenance** (71.1% marathon, 40.7% HM). The first test
fixture built for this was a beginner HM plan — exempt from §52 for a reason
having nothing to do with the defect. It would have gone green while proving
nothing. Only **58 of 621** cohort plans are non-maintenance *and* hold a
convertible duration-anchored week; the fixture is taken verbatim from one.

---

## What the board is actually being asked (when it sits)

1. On a duration-anchored plan, is a peak long-run step-back expressed in
   **minutes** or in **kilometres**? (§47, `PEAK_LR_STEPBACK_MAX_PCT`)
2. Is a beginner's missing step-back week a **harm worth prescribing for**, given
   §47 also declines to act on any plan whose peak long runs are not race-paced
   — 43.5% of the cohort, by design?
3. §52's floor: leave inert while the measured breach count is 0, or fix the
   producer to match the now-sighted checker?

**Not asked, because it is already answered:** whether to swap the two `?? 0`
sites. On their own they do nothing, and shipping them would bank a change that
reads like a fix and is not one.
