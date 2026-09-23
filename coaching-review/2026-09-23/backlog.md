# Backlog — 2026-09-23 round

Two items. **Neither changes what the engine prescribes** — both fix instruments that
told this board something truer than the truth.

---

### [HIGH-01] — `RUBRIC-STALE-BAR-01` — the rubric teaches a bar the founder overturned

**Source:** Finding 2. Ruled CORRECT WITH AMENDMENT.

**Files:** `docs/canonical/fit-for-purpose-rubric.md`

**Problem.** The doc states *"A correct refusal counts as fit for purpose"* and quotes
**whole product 95.3%**, **marathon 90.1%**, *"every distance is at or above the 90%
target"*. `ZERO-REJECTION-01` (`1bfc664`) overturned exactly that accounting on
2026-09-20 at **16:34**, on the founder's stated standard — *"if someone comes to our
platform and asks for a run, we can't just say no, go away"*. **The doc was last
written at 07:47 the same day and never updated.**

Live numbers under the current bar: **92.5% whole product**, 5K/10K/50K/100K 100%,
HM 96.2%, **marathon 78.7% fit + 12.4% refused**. Every one of those is the committed
`envelopeBaseline.json`, not a fresh measurement.

⚠️ **The harm is not the stale number, it is the stale STANDARD.** The doc's own
opening says it exists so *"a sitting is comparable to the one before it"*. A board
reading it today would score refusals as passes and conclude the marathon is at 90%.
The 09-20 sitting did exactly that.

**Acceptance criteria:**
- Live bar stated: a designed refusal is a **failure**, not a pass, and why.
- Live numbers, sourced to `lib/plan/__fixtures__/envelopeBaseline.json`.
- The superseded bar and its numbers **retained and marked superseded** with the
  ruling and date — not deleted. Comparability across rounds is the doc's job.
- A line naming where the number actually lives, so the next drift is a one-command
  check rather than a reading.

**Principle to add:** none. `CoachingPrinciples` §44 is unchanged and correct.

**Invariant snippet:** none — this is a doc. ⚠️ **Which is the weakness**: nothing
mechanical watches it, and that is how it drifted for three days. Consider extending
`audit-docs.sh` to compare the rubric's quoted figures against the baseline JSON.
Filed here rather than done, because it is a tooling change and this round ships no code.

---

### [HIGH-02] — `HARNESS-COMPOSE-GAP-01` — four of five harnesses cannot see a foundation week

**Source:** Finding 1. Ruled CORRECT (engine) / measurement defective.

**Files:** `scripts/coaching-review-round.ts`, `lib/plan/envelopeMeasure.ts`,
`scripts/audit-plan-quality.ts`, `lib/plan/cohortGrid.ts`, `package.json`

**Problem.** All four call `generateRulePlan` and stop. Only
`property-validate-plans.ts` calls `composePlanWithFoundation` — the single owner of
`plan.weeks` mutation post-generation (ADR-020) and the function `/api/generate-plan`
actually calls. A runner with a runway over 28 days gets a block; the board round,
the fit-for-purpose measure, the coach-objection audit and the cohort grid have never
seen one.

🔴 **It is worse than "unchecked".** `INV-PLAN-UNCOVERED-RUNWAY-DECLARED` reads
`meta.uncovered_runway_weeks`, a stamp only the composer writes, and is **deliberately
silent when the stamp is absent** (correctly — *"firing there would report the harness
rather than the plan"*). So the rule reported **CLEAN** in every harness that never
composed. **A green round was not evidence.**

**Measured, this round:** `scripts/foundation-review-round.ts` — 504 plans, 486
composed, 231 with blocks, **0 error-severity violations, 0 §76 breaches**. The engine
is exonerated. The instrument was not.

**Acceptance criteria:**
- `foundation-review-round.ts` wired into `npm run verify` (or the CI coaching-review
  trigger) so it cannot silently stop running. ⚠️ **Today it runs when someone types
  it — the exact failure mode that made the coaching-review loop go dormant.**
- `audit-plan-quality.ts` composes, so `planQuality`'s 7 predicates see foundation
  weeks. **This is the half Finding 1 does NOT close** — the new harness counts
  violations, not coach objections.
- `envelopeMeasure.ts` and `cohortGrid.ts` either compose, or carry a written,
  falsifiable reason why a foundation-free population is the right denominator.
  A reason is acceptable; silence is not.
- Whichever harnesses do compose declare their block coverage in output, so a band
  that stops producing blocks reads as a **reach failure**, not a pass.
- Seiler's note: label the `add`/`skip`/`start_now` split in the coverage table.
  27 of 81 at gaps ≥40d is the §57 'choice' band working, and reads as a collapse
  to anyone who does not know that.

**Principle to add:** none.

**Invariant snippet:** none — no new rule. The existing rule needed a harness that
could reach it.

---

## Routed elsewhere

**→ Design Board.** McMillan: how the foundation `add` / `skip` / `start_now` choice is
**framed** to a runner with a six-month runway, at the moment they make it — once, in
a wizard, before they know what six uncoached months feel like. The coaching is
settled (§76 honesty-not-coverage, §57 a longer block is measurably useless). The
presentation is not ours.

## Explicitly NOT filed

- **26 uncovered weeks at 180 days' runway.** Withdrawn at the conflict scan —
  settled by `FOUNDATION-LONG-RUNWAY-01` (2026-09-15), which measured the alternative
  and rejected it. Re-raising needs new evidence, and this round supplied the
  opposite: 81 of 81 carry the note.
- **`BINGE-WEEK` / E5, `WEEK1-LEAP`, `MARA-LR-LOWBASE-01`, `RACE-ANCHOR-CV-OVERRIDE-01`** —
  checked against the register, all already ruled or already filed. None re-raised.
- **The ops digest's `foundation_week_violations`.** Not a defect. Two legacy April
  plans (128–129 days before ADR-020); three plans from 09-12 and 09-18 failing
  invariants added *after* they were generated. Verified against git, not the ops
  table. Live-plan policy: doctrine fixes are not backfilled.
