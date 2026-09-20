# Coaching review round — 2026-09-20 — RULING

27 plans: 7 canonical + 20 personas (14 charity, 6 engine).
**0 error-severity violations. 1 refused by design (M4).**

Engine state: `verify` exit 0 · 283 files / 2,485 tests · 124 invariants ·
sweep 14,189 plans, no new violations · **fit for purpose 95.3%, every distance
at or above 90%** (5K 100% · 10K 100% · HM 96.2% · marathon 90.1% · 50K 100% ·
100K 100%).

> ⚠️ **THIS SITTING WAS CONVENED FROM `docs/canonical/coaching-rulings.md`
> FIRST, NOT FROM THE PLANS.** That is the change. The two previous sittings
> re-litigated items the board had already closed — E5 (CLOSED 09-19) came back
> as "would not hand over", and M3 (WITHDRAWN 09-19) came back as "the one real
> finding" — because the round's `review.md` was never filled in, so the next
> sitting had nothing to read.

## Mechanical verdict first

"Proud to hand over" = zero error-severity violations **and** zero unreconciled
coach objections **and** every constraint declared. Applied to all 27:

| | |
|---|---|
| clean on every measure | **23** |
| refused by design, §44-compliant | **1** (M4) |
| carrying a reconciled objection (declared maintenance, §23) | **1** (E4) |
| carrying a live objection | **2** (M3, E5) + M1d exactly on the bar |

## Every live objection was checked against the register — none is new

| plan | objection | register status |
|---|---|---|
| **E5** | `BINGE-WEEK` | **CLOSED 2026-09-19** — CORRECT AS IS, McMillan's dissent recorded. **Not re-raised.** Capping is a measured fixed point; six week-1 caps built and rejected |
| **M3** | `LONG-RUN-SHORT`, 20 km = 47% | **OPEN as `MARA-LR-LOWBASE-01`**, already filed with its measurement. Not a new finding |
| **M1d** | 23 km = 55%, exactly at §24's bar | same family as `MARA-LR-LOWBASE-01`; passes, note doing its work |
| **E4** | `NEVER-BUILDS` | reconciled — `volume_profile: maintenance` with a `volume_constraint_note`, which §23 licenses |

**NO NEW ISSUES AROSE.** Every flagged plan resolves to something already ruled
or already filed. That is the first sitting today of which that is true, and it
is the point of the register rather than a coincidence.

## ⚠️ CORRECTION TO THIS SITTING — M4 WAS NEVER A REFUSAL

Re-checked after the founder asked why M4 is an exception, expecting that
profile to be common. **It is not an exception and it is not refused.**

`DaysAvailableError` carries two reasons; M4's is **`warn_unacknowledged`** — a
**confirmation prompt**. The runner is told *"3 days is under the 4 a time goal
needs; expect to finish rather than hit the time"*, ticks the box, and receives
a plan: **16 weeks, 30 → 44 km, maintenance**, with the weekday cap's cost
spelled out. The persona carried `expectRefusal: true` and a note reading
*"by-design refusal"* for months, so **every round reported "⛔ refused by
design" and this board reasoned about a runner we turn away.**

**Corrected:** M4 acknowledges, as a real runner does. **`M6` added** (marathon
off an 8 km/week base) so the genuine §111 *block* path is still covered —
correcting M4 had left the corpus with no refusal at all.

**And the mislabel was hiding a real finding:** M4's plan carries `BINGE-WEEK`
(worst session 69% of its week), the same 3-days-plus-weekday-cap shape as E5,
and therefore covered by E5's existing ruling rather than being new.

**Measured product-wide:** 3.3% of runners see a confirmation prompt (8.4% at
marathon and longer); **3.0% are genuinely blocked.**

## Ruling

**25 of 28 proud to hand over** (the round is now 28 with M6). M4 generates a
plan and it is an honest one. M6's refusal is correct and §44-compliant.
**E5 stands as previously ruled** — CORRECT AS IS with McMillan's dissent, not
a fresh refusal. **M3 is `MARA-LR-LOWBASE-01`**, open, and the board's question
there is unchanged: should the very-low-volume marathoner be refused rather
than given a short-long-run plan, given they are admitted *because* the injury
cap lowers their peak and so §111's ratio passes?

**No new artifacts. No code change ruled.**

## Standing reservations, recorded not re-litigated

Willy on M5 (masters 58, +94% build — top of range, third recording). Sims on
M5 and M1 (bone health, low energy availability — third recording). Seiler on
beginner monotony (correct distribution, not a defect).

## What this sitting cannot answer

**No adherence or dropout data exists.** One analytics event in the product; no
charity code ever redeemed. Every verdict above is a coaching judgement with a
number attached, never an outcome. **Nothing has run on a device.**
