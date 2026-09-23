# Coaching review round — 2026-09-23 — RULING

**531 plans**: 27 standard (7 canonical + 20 personas) + 504 foundation-composed.
**0 error-severity violations. 19 refused by design.**

Engine state: code byte-identical to production `5e5b38b` — the only commit since
it touching `lib/plan/` changed one test file's comment. Sweep 14,253 plans, no new
violations above `SWEEP-BASELINE-01`. `measure:envelope` **92.5% whole product,
unchanged vs the committed baseline on every distance**.

> ⚠️ **CONVENED FROM `docs/canonical/coaching-rulings.md` FIRST, NOT FROM THE PLANS**,
> per the 2026-09-20 protocol. **The scan closed one of the three findings brought to
> it** — see Finding 3. That is the protocol working, and it is the second consecutive
> sitting where the register prevented a re-litigation.

---

## Mechanical verdict first

"Proud to hand over" = zero error-severity violations **and** zero unreconciled coach
objections **and** every constraint declared.

| | standard round | foundation round |
|---|---|---|
| plans | 27 | 504 (486 composed) |
| clean on every measure | **26** | **486** |
| refused by design | **1** (M7) | **18** |
| error-severity violations | **0** | **0** |
| §76 uncovered-runway breaches | n/a — cannot occur | **0** |

Every live objection in the standard round was checked against the register. As on
09-20, **none is new**: `BINGE-WEEK` on E5 (CLOSED 09-19), `LONG-RUN-SHORT` on the
marathon personas (`MARA-LR-LOWBASE-01`, OPEN and filed), `NEVER-BUILDS` on E4
(reconciled — declared maintenance, §23).

---

## 🔍 Conflict scan

Scanned against **amendments, not section headings** — the 2026-09-22 failure mode.

| finding | § touched | result |
|---|---|---|
| 1 — harness blindness | §57, §76, §34 | **No doctrine conflict.** This is a measurement defect, not a prescription defect. §34 (invariant registry — *declared and exercised*) is the section it offends: the rule was declared and, in four of five harnesses, never exercised |
| 2 — stale rubric | §44 + §44 Am. 2026-08-18 | **No doctrine conflict.** `CoachingPrinciples` §44 is unchanged and correct. The defect is in `fit-for-purpose-rubric.md`, which is a *measurement* doc, not doctrine |
| 3 — 26 uncovered weeks | §76 CORRECTED 2026-09-15, §57 Am. | 🔴 **CONFLICT — WITHDRAWN AT THE SCAN.** See below |

### 🔴 Finding 3 was settled eight days ago and should not have reached the seats

`FOUNDATION-LONG-RUNWAY-01` (Coaching Board, 2026-09-15) measured this exact case —
*"a first-time marathoner with a 25-week runway gets 3 foundation weeks and 4
uncovered; at a 52-week runway, 31"* — and ruled:

> **"The gap is still structural (see §57's amendment for why a longer block is
> measurably useless), so the obligation is HONESTY, NOT COVERAGE."**

My submission asked whether a note is sufficient coaching for half a year. **The board
has already answered that**, and answered it with a measurement showing the
alternative does not work. Raising it again as an open question is precisely the
re-litigation the 09-20 protocol exists to prevent.

**Withdrawn.** What the round *does* contribute is the first evidence that the ruling
holds under composition: 81 of 81 plans at 180 days' runway carry the note, 0 breaches.
**§76's obligation is met in practice, not just in principle.** That is new; the
question was not.

---

## 🏃 Alex Hutchinson (Chair)

Finding 1 is the one that matters, and it is not a coaching finding — it is an
evidence finding, which is worse for this board specifically.

On 2026-09-20 I put my name to "proud to hand over" across 27 plans. That verdict was
true of the plans I was shown. **It was not a verdict on the product**, because the
harness that produced those plans calls `generateRulePlan` and stops, and a real
runner with a runway over 28 days gets a block composed onto the front of theirs by a
function the harness never calls. I ruled on a corpus that structurally could not
contain the thing the ops digest calls the least-guarded part of the engine.

What makes it a governance failure rather than an oversight is the second half:
`INV-PLAN-UNCOVERED-RUNWAY-DECLARED` reads a stamp only the composer writes and is
**deliberately silent without it**. That silence is correct — firing there would report
the harness, not the plan — and it means the rule returned CLEAN in every harness that
never composed. **A green board round was not evidence of anything.** This board has
recorded that shape before under other names; this is the version where it reached my
own ruling.

The engine is exonerated: 504 composed plans, 0 violations, and the sweep's 8,472
blocks agree. **I am not withdrawing the 09-20 verdict — I am narrowing what it was
ever entitled to claim.**

Finding 2 I read as serious for a different reason. `fit-for-purpose-rubric.md` still
teaches *"a correct refusal counts as fit for purpose"* and quotes 95.3%. That bar was
overturned by the founder nine hours later the same day. Anyone reading the canonical
doc today gets both the wrong standard and the wrong numbers — and the doc's own
opening paragraph says it exists so *"a sitting is comparable to the one before it"*.

**Not proud to hand over: the marathon.** Under the live bar, 78.7% fit and **12.4%
refused**. `ZERO-REJECTION-01` is explicit that a refusal is a failure, not a pass.
One marathoner in eight is told no.

## 📊 Stephen Seiler

No objection from this seat on distribution. §1 is measured in **session counts**,
plan-wide, and a foundation block is easy running that does not move the ratio. I
checked rather than assumed — the composed rounds show no `INTENSITY_DISTRIBUTION`
violations at any gap.

One observation I will record without making it a finding. At gaps of 40 days and
beyond, **only the `add` decision produces a block — 27 of 81 plans at each gap**.
The other 54 are runners who chose `skip` or `start_now`. That is the §57 'choice'
band behaving exactly as designed, and I raise it only because the number looks like a
coverage collapse until you know why. **A reader of this table who does not know the
band exists will read 27/81 as a defect.** Worth a line in the harness output.

## 🎯 Greg McMillan

The foundation plans read correctly to me. Mean 3.0 weeks at every gap from 24 days
up, 1.2 at 10 days, and the block does not balloon — which is what §57's amendment
said it should do.

My interest is in the runner who picks "start now" with six months on the clock. They
get a correct plan and a note. I accept the scan's ruling that coverage was measured
and rejected, and I am not reopening it. But I want it recorded that **the note is
doing a great deal of work for a decision the runner makes once, in a wizard, before
they have any idea what six uncoached months feel like.** That is a *presentation*
question — how the choice is framed at the moment it is made — and presentation is
the Design Board's, not ours. I would like it routed there rather than dropped.

On the standard round: no new objection. E5's 15 warns are the closed `BINGE-WEEK`
family and I have already dissented once; I am not spending the sitting on it again.

## 🩹 Rich Willy

No objection from this seat.

The load question I would have asked — does a foundation block plus a main plan
produce a compound ramp the caps never see? — is answered by the composed corpus.
`INV-PLAN-DELIVERED-RAMP` and `INV-PLAN-INJURY-CAP-DELIVERED` both fire in the sweep
at ordinary rates (4.3% and 4.1%) across 8,472 plans carrying blocks, and error
severity is zero across all 486 composed plans. The caps are seeing the composed
plan, not just the engine's output.

I will note the asymmetry that matters clinically: the runners most likely to have a
long runway are **first-timers and returners** — exactly the cohort where
cardiovascular and musculoskeletal readiness diverge most. They are also the cohort
the old harness could least afford to be blind about. **It was blind about them for
as long as the harness has existed.** No defect found. That is luck plus a sweep,
not design.

## ⚕️ Stacy Sims

No objection on the plans.

One thing I will not let pass unrecorded. Finding 2 is being framed as a documentation
defect, and mechanically it is. But the *content* of the stale bar is
"a refusal counts as success", and refusal falls hardest on low-base, low-volume
runners — a population that skews female in the charity marathon cohort this product
is being taken to market on. A metric that scored those refusals as wins was not a
neutral bookkeeping error; **it made the product look kindest to the people it was
turning away.** The founder caught that, not this board. I want that in the register.

---

## ⚡ Recorded disagreements

None between seats this sitting.

The one disagreement on record is **between this board's 09-20 verdict and its
evidentiary basis**, and the chair has resolved it by narrowing the claim rather than
withdrawing it (Hutchinson, above). McMillan's `BINGE-WEEK` dissent of 09-19 stands
unchanged and was not re-argued.

---

## ⚖️ Ruling

### On the plans: **CORRECT — fit for purpose, with one distance named**

531 plans, 0 error-severity violations, every constraint declared, every §76 note
present. 5K, 10K, HM, 50K and 100K are at or above target and **this board is proud to
hand them over**.

🔴 **The marathon is not, and the board declines to call it fit.** 78.7% fit plus
**12.4% refused** under the live `ZERO-REJECTION-01` bar. This is not a new finding —
`MARA-LR-LOWBASE-01` is open and filed — but the previous sitting recorded the
marathon at 90.1% using the superseded accounting, and **the board should not inherit
that number.**

### On Finding 1 (harness blindness): **CORRECT — the engine. The MEASUREMENT was not.**

No prescription defect exists. The instrument was wrong, and it was wrong in the
direction that produces false confidence. Closed by `foundation-review-round.ts`.

### On Finding 2 (stale rubric): **CORRECT WITH AMENDMENT — the doc must be corrected before the next sitting**

`fit-for-purpose-rubric.md` is a measurement doc, not doctrine, so this board rules on
it only insofar as it feeds our sittings — which it does, directly. It must state the
live bar and the live numbers, and mark the old ones superseded rather than deleting
them.

### On Finding 3: **WITHDRAWN AT THE CONFLICT SCAN** — settled by `FOUNDATION-LONG-RUNWAY-01`, 2026-09-15

---

## 📦 Required artifacts

This round changes **no prescription**, so the three-artifact rule does not bind:
no principle is authored, no numeric moves, no invariant is added. Recorded explicitly
rather than left as an absence.

What it does produce:

| # | artifact | status |
|---|---|---|
| 1 | `scripts/foundation-review-round.ts` — the instrument that closes Finding 1 | ✅ built, run, committed this round |
| 2 | `fit-for-purpose-rubric.md` corrected to the live bar | 🔻 **OPEN — backlog `RUBRIC-STALE-BAR-01`** |
| 3 | The four blind harnesses either compose, or declare why not | 🔻 **OPEN — backlog `HARNESS-COMPOSE-GAP-01`** |
| 4 | Register rows for this sitting | ✅ `coaching-rulings.md` |

⚠️ **Artifact 1 is an instrument, not a gate.** It is not yet in `npm run verify` and
nothing fails if it stops being run. **This repo's own record is that a check which
depends on someone remembering is a check that does not run** — the coaching review
loop itself went dormant for exactly that reason and had to be rebuilt around a CI
trigger. Filed as part of `HARNESS-COMPOSE-GAP-01`; stated here so it is not mistaken
for closed.

---

## ↗️ SLT escalation

**None on correctness.**

One routing, to the **Design Board**, on McMillan's point: how the foundation
`add` / `skip` / `start_now` choice is *framed* at the moment a runner with a six-month
runway makes it. The coaching is settled (§76, §57); what the runner is shown when they
decide is not this board's.

---

## What this sitting does NOT prove

- **Nothing ran on a device.** 531 plans generated in a harness. The standing gap.
- **The marathon refusal rate was not re-measured this round** — 12.4% is read from
  `measure:envelope` against the committed baseline, not independently derived.
- **`foundation-review-round.ts` composes, but does not score coach objections.**
  `planQuality`'s 7 predicates still never see a foundation week. Finding 1 is
  narrowed, not fully closed — `audit-plan-quality.ts` remains blind.
- **The 0 violations at 180 days are 81 plans, not a population.** The envelope and
  cohort harnesses still weight a foundation-free corpus.
