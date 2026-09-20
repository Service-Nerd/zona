# Coaching ruling register — what has been decided, and what may not be re-raised

**Why this file exists.** The founder asked, repeatedly and with cause, why the
board gives different answers to the same question. The answer is not that the
board is inconsistent. It is that **each sitting was convened from the plans
rather than from the prior rulings**, so items the board had already closed came
back as new findings.

Measured on 2026-09-20, across one day of sittings:

| item | ruled | what happened next |
|---|---|---|
| **M3** (knee marathon, "the plan doesn't warn them") | **WITHDRAWN 2026-09-19** — the premise was false, the note says it | **re-presented 2026-09-20 as "the one real finding"** |
| **E5** (3 days + 30-min cap) | **CLOSED 2026-09-19** — CORRECT AS IS, McMillan's dissent recorded | **re-presented 2026-09-20 as "would not hand over"** |
| the 2026-09-20 round's `review.md` | — | **still read "REVIEW PENDING"**: the sitting's ruling was never written back, so the next sitting had nothing to read |

**The third row is the cause of the first two.** `coaching-review-round.ts`
writes a stub and says *"fill this file with the ruling"*. Nobody filled it. A
process whose memory depends on someone remembering to write it down has no
memory.

---

## The protocol, from 2026-09-20

1. **Read this register before the sitting.** Not the plans first — the register.
2. **Any finding is checked against it before presentation.** A finding matching
   a CLOSED or WITHDRAWN row is either not raised, or raised *explicitly as a
   re-open with new evidence*, naming what is new.
3. **The sitting's ruling is written back** into the round's `review.md` and
   into this register, in the same session. Enforced by `audit-docs.sh`.
4. **A plan's verdict is mechanical first.** "Proud to hand over" =
   zero error-severity invariant violations **and** zero unreconciled coach
   objections (`planQuality`) **and** every constraint declared. The board rules
   on what that test cannot see, not on re-scoring what it can.

---

## How to re-run the review and compare like with like

Four commands. Run them in this order; each answers a different question.

```bash
npx tsx scripts/coaching-review-round.ts   # 1. generate today's 28 plans
npm run measure:envelope                   # 2. fit-for-purpose, DIFFED vs baseline
npm run audit:plans                        # 3. coach objections, diffed vs baseline
npm run verify                             # 4. everything else, incl. both gates
```

**What makes it apples-to-apples**, and every one of these is versioned in git:

| held fixed | where |
|---|---|
| the runners | `lib/plan/charityCohort.ts` — 20 personas, + 7 canonical cases |
| the weighted population | `lib/plan/useCaseEnvelope.ts` — bands and weights, each with a written reason |
| what "a coach would object to" | `lib/plan/planQuality.ts` — 7 predicates, one owner |
| what "fit for purpose" means | `lib/plan/envelopeMeasure.ts` — one owner, shared by the script and the gate |
| **last round's numbers** | `lib/plan/__fixtures__/envelopeBaseline.json` |
| what the board already decided | this file |

**Step 2 is the one that was missing until 2026-09-20.** The rates existed only
as FLOORS in test code, which is a **one-sided** gate: a drop failed the build
and **a rise was silent**. So "is this better or worse than last time, and
where?" had to be re-derived by hand every round — the same shape as the defect
that made the board appear to change its mind. `measure:envelope` now prints
the per-distance delta and the test fails on a move **in either direction**.

**Re-baselining is a declared act.** `npm run measure:envelope -- --write`,
and say in the commit which number moved and why. **Never to turn a test
green.**

### What is still NOT comparable between rounds

- **`generated-plans.md` is gitignored** (size), so the plan TEXT of an old
  round cannot be diffed. Plan-level change detection is `verify:parity`
  instead, which hashes 5,940 cases — use that, not the round files.
- **The envelope weights are assumptions.** If they change, every historical
  number becomes incomparable. That is why they are one reviewable object with
  a written reason per band, and why the charity's answer to the volume
  question will force a deliberate re-baseline.

## CLOSED — do not re-raise without new evidence, and say what is new

| ref | ruling | date | the number behind it |
|---|---|---|---|
| **M3 honesty** | **WITHDRAWN** — premise false | 09-19 | `long_run_shortfall_note` already says *"take the walk breaks early rather than late"* |
| **E5 and M4** (3 days + weekday cap) | **CORRECT AS IS**, McMillan dissent recorded | 09-19 | 5% of plans exceed a 70% long-run week, worst 74.1%; §114 took >90% to 0.00%; capping is a measured fixed point |
| **§111 cap-instead-of-refuse** | **NEGATIVE RESULT** | 09-19 | 100% of refused cases would peak below the credible floor (median 22.4 km vs 52.8). Door at 13.2 km/wk is arithmetically exact |
| **beginner finish-goal quality** | **CORRECT AS IS**, unanimous | 09-19 | §110 Am. 2. Hutchinson's evidence is explicitly about *time-goal* races |
| **load-aware difficulty band** | **INCORRECT — VETOED** | 09-19 | §44 point 3; Willy authored the constraint |
| **`S53` quality repetition** | **DISSOLVED** | 09-19 | the unit was rows; the coaching unit is the category, median 4.5 exposures |
| **week-1 engine caps** | **SIX built and rejected** | 09-19/20 | four made `BINGE-WEEK` 8–12× worse; two took the marathon out of target. Willy: *"stop proposing caps"* |
| **`WEEK1-LEAP` thresholds** | **FROZEN** | 09-20 | relaxed three times in one day; any further change needs adherence or injury data, not another corpus measurement |

### Added 2026-09-20 — **M4 was never a refusal**

`M4 sub-4:00 marathon, busy 3-day, weekday cap 45` carried
`expectRefusal: true` and a note reading *"by-design refusal (§44
days-minimum)"* **for months**. It is not a refusal. `DaysAvailableError`
carries two reasons and this one is **`warn_unacknowledged`** — a confirmation
prompt. The runner is told *"3 days is under the 4 a time goal needs; expect to
finish rather than hit the time"*, ticks the box, and receives a plan:
**16 weeks, 30 → 44 km, classified maintenance**, with the weekday cap's cost
spelled out (*"peak week reaches 44 km where it would otherwise have gone to
65 km"*).

⚠️ **Every review round reported "⛔ refused by design" and the board reasoned
about a runner we turn away.** Same defect as the use-case envelope had — 2,304
prompts counted as refusals — which I fixed there and **not here**, so it
survived in the corpus the board actually reads.

⚠️ **Correcting it removed the only refusal in the corpus**, so `M6` was added:
a marathon off an 8 km/week base, a genuine §111 **block** that no
acknowledgement clears.

⚠️ **And it revealed a real finding the mislabel had hidden:** M4's plan carries
`BINGE-WEEK` (worst session 69% of its week) — the same 3-days-plus-cap shape
as E5, and covered by E5's ruling above. **Measured product-wide: 3.3% of
runners see a confirmation prompt (8.4% at marathon+), 3.0% are genuinely
blocked.**

## OPEN — with the measurement, ready for a sitting

| ref | question | the number |
|---|---|---|
| `MARA-LR-LOWBASE-01` | should the very-low-volume marathoner be refused rather than given a short-long-run plan? | `LONG-RUN-SHORT` 8 km/wk **100%**, 15 km/wk 70%, 0% above 35. An 8 km/wk knee-history runner gets a 16.5 km peak long run for 42.2 km. ⚠️ They are admitted *because* the injury cap lowers their peak, which makes §111's ratio pass |
| `ULTRA-LR-ADEQUACY-01` | what is the right long-run bar for 50K/100K? | none exists since `ULTRA-LR-BAR-01`; §24e's back-to-backs make a single longest run the wrong unit |
| `S111-SUBFLOOR-VOLUME-01` | build a base-building plan type? | blocked on the charity's answer; runbook drafted, unsent |
| `RACE-KEY-TWO-OWNERS-01` | collapse two `raceDistanceKey` ladders? | 88 diverging values, currently unreachable (the wizard's six distances all agree) |

## Standing reservations — recorded, not findings

- **Willy on M5** (masters 58, +94% build): compliant, top of his range, first cell he would look at if injury reports arrive. Recorded three times.
- **Sims on M5 and M1**: bone health and low energy availability for peri-menopausal and young female runners on long slow blocks. Recorded three times.
- **Seiler on beginner monotony**: correct distribution, no objection, but the stimulus varies little. Not a defect.

## What no sitting can answer

**There is no adherence or dropout data.** One analytics event exists in the
product; no charity code has ever been redeemed. Every "proud to hand over" is a
coaching judgement with a number attached, never an outcome. **And nothing has
run on a device.**
