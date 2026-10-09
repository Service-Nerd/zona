# API Contract — `GET|POST /api/ops/plan-audit` + the cause classifier (OPS-DIGEST-STORED-PLAN-DEBT-01)

**Tier:** Ops/internal — not user-facing, no FREE/PAID gate.
**Owner:** `app/api/ops/plan-audit/route.ts` (the pass) · `lib/ops/storedPlanProbes.ts` (schema + HR-band codes) · `lib/ops/regressionVsNewRule.ts` (**why** a code set changed) · `lib/ops/planWeekCollision.ts` (the collision probe).
**Auth:** `CRON_SECRET` via `Authorization: Bearer <secret>` or `x-cron-secret`. 403 otherwise.
**Closes:** `PLAN-AUDIT-01` (the daily constitutional audit) and `OPS-DIGEST-STORED-PLAN-DEBT-01` (what the change MEANS).

---

## What it does

Runs `validateStoredPlan` plus the schema and HR-band probes over **every stored plan** and
records breaches as `ops_events` of kind `plan_rule_invalid`.

🔴 **IT IS `validateStoredPlan`, AND THE DISPATCH IS THE POINT (AUDIT-PLAN-KIND-01 +
AUDIT-MAINTENANCE-KIND-01, 2026-10-09).** This line read *"Runs `validatePlan`"* and the route
in fact called `validateReshapedPlan` on **every plan kind**, which is the race-plan
constitution. `validateStoredPlan` now picks the constitution that applies to the plan's
`plan_kind`:

| `plan_kind` | validator |
|---|---|
| `base_build` | §116's `validateBaseBuildBlock` |
| `maintenance` | §75's `validateMaintenanceBlock`, from the three `source_*` fields the plan stamped |
| `race` / absent | `validateReshapedPlan` |

**Measured the day it changed: the fleet's reported errors went 363 → 262**, because the two
base-build plans were contributing **101 phantoms** — mean 50.5 against 8.2 for every other
plan — by being asked whether a plan with no start line had annotated its prep time. A reader
of this contract would have mis-read those counts.

⚠️ A maintenance plan **without** the `source_*` stamp falls through to
`validateReshapedPlan` rather than reporting clean. An empty result would read as *"this plan
is fine"*; the fall-through is loud and imperfect, which is the safer wrong answer.

It exists because `generateRulePlan` validates at generation time but in production only
`console.error`s and returns the plan — and a console line on a Vercel function is not a record.
A plan can also become invalid *after* generation, via a reshape or a maintenance-block append.

## It alerts on a TRANSITION, not on state — and that is deliberate

A first run over production found 15 of 15 stored plans invalid, almost all legitimate historical
debt: plans generated before a principle existed, which per the live-plan policy are **not**
backfilled. A probe that alerted on *"is this plan invalid?"* would fire on every row every day
forever and train everyone to ignore it.

So it alerts when a user's **set of violation codes differs from the last set recorded for them**:

| situation | behaviour |
|---|---|
| first sighting of a plan's debt | one row, then silence |
| a NEW violation class appears | alerts immediately — the regression case |
| a violation is FIXED | alerts once, so improvement is visible too |

Self-baselining: no snapshot to maintain and no cutoff date to go stale.

## 🔴 But a transition is AMBIGUOUS, which is what `cause` answers

A code set changes for two opposite reasons and they present identically:

| cause | right response |
|---|---|
| the engine started producing bad plans | **urgent** |
| we shipped an invariant that judges OLD plans | information, queue a remediation |

**Measured cost: on 2026-10-03 the morning digest reported two code-set changes as defects and a
full day went to proving neither was one** — §82's exemption was missing from a checker, and §121's
invariant was enforcing a proxy. Nothing in the report could distinguish them.

`lib/ops/regressionVsNewRule.ts` decides it by **regenerating the plan from its own stored
`generator_input` with today's engine** and re-validating. No date bookkeeping, no table of "when
did each invariant ship" to go stale.

```ts
type CodeVerdict =
  | 'engine_regression'      // today's engine reproduces it from the same inputs. Act.
  | 'rule_newer_than_plan'   // it does not. Remediation queue.
  | 'undecidable'            // no comparable plan could be regenerated. NOT an all-clear.
```

Only codes that are **new since the last sighting** are classified — regeneration is not cheap and
a code already present was already triaged.

### ⚠️ Two properties that are load-bearing, both earned by falsification

1. **It runs the FULL pipeline.** `generateRulePlan` does **not** compose the foundation block —
   `composePlanWithFoundation` does (ADR-020). The first version stopped at generation, so all four
   affected live plans regenerated with **0 foundation weeks**;
   `INV-PLAN-FOUNDATION-WEEKDAY-HAS-DURATION` structurally could not fire and every one came back
   `rule_newer_than_plan`. **A real engine regression in a foundation week would have read as
   "nothing to see".** Composition is dated by the plan's `generated_at`, because the runway gap is
   a function of when the plan was MADE.
2. **It refuses to answer unless the regenerated plan is SHAPE-COMPARABLE** — same week count, same
   foundation weeks, same foundation weekday sessions, session count within 25%. Otherwise
   `undecidable`. A violation that vanished because the construct vanished is not a violation that
   was fixed.

## Response

```ts
{
  ...summary,                      // the existing audit summary
  // DIGEST-REPAIRABLE-01 — present ONLY when at least one plan carries a
  // violation that has a remedy. ABSENT, never zeroed, when there is nothing
  // to do. See § Repairable damage below.
  repairable?: {
    plans:    number,              // distinct plans, counted once each
    by_code:  Record<string, number>,   // commonest first
    command:  string,              // a DRY RUN; `--apply` is never advertised
  },
  unchanged: number,               // breaching, same code set as last time — not re-reported
  changed:   number,
  flagged:   Array<{ user_id: string; codes: string[]; state: 'new' | 'changed' | 'resolved' }>,
  collisions: number,              // PLAN-WEEK-COLLISION probe hits

  cause: {
    engine_regression:  number,
    rule_newer_than_plan: number,
    undecidable:        number,
    regressionCodes:    string[],  // sorted; the codes to act on
    actionable:         boolean,   // ⚠️ TRUE for `undecidable` as well as for a regression
  },
  verdict_notes: string[],         // up to 20, why each classification reached its verdict
}
```

**`actionable` is the only field that should page anyone**, and it is deliberately true for
`undecidable`: *"we could not tell"* must never read as *"fine"*, which is precisely what the first
version of the classifier produced.

Per-plan verdicts are also written into the `plan_rule_invalid` event detail as `verdicts` and
`verdict_note`, so triage does not have to re-derive them — **and as a sentence in `reason`**, via
`verdictReason()`.

⚠️ **`reason` is not a duplicate of `verdicts`; it is the field the CONSUMER already reads.** The
daily digest's Q4 selects `detail->>'reason'` and prints it, so writing there means the existing
consumer reports the verdict without depending on a second edit somewhere untestable. The three
sentences are mutually exclusive and a regression outranks an undecidable, asserted in
`regressionVsNewRule.test.ts` — a digest that reads "NOT A DEFECT" over a regression would be worse
than silence.

## Consumers

- The **daily ops digest** — a cloud routine, not repo code (editable via RemoteTrigger).
  ✅ **Wired 2026-10-04**: its Q4 now selects `verdicts` and `verdict_note`, carries the three-way
  interpretation, and gained a pre-escalation check 0 — *the violation may be a defect in the
  CHECKER, not in the plan*. Verified byte-identical after the write; next run 2026-10-04 06:09.
  ⚠️ **`reason` is the belt to that braces**: even with the prompt unchanged, the digest would have
  printed the verdict, because `reason` is a field it already read.
- No app or website surface reads this route. It is ops-only.

## Limits, stated

- `MAX_PLANS = 5000`. If hit, the audit needs pagination rather than a silently truncated pass, so
  it is reported, never hidden.
- A plan with **no `generator_input`** cannot be classified at all — `verdict_note` says so rather
  than defaulting to a verdict. 🔴 **And it cannot be VALIDATED either**, so it is absent from
  `invalid`, from `flagged`, and from `cause`. **Measured 2026-10-04: 8 of 30 stored plans.** Seven
  pre-date the field; the eighth is a `plan_kind: base_build` on-ramp plan from 2026-10-02 whose
  producer never writes it, so that blindness is **permanent for that plan type and grows with every
  on-ramp runner** — `BASEBUILD-AUDIT-BLIND-01`. ⚠️ **`checked` is therefore NOT the plan count**, and
  a reader who treats it as one will believe the fleet is fully audited when 27% of it is not.
- The known baseline, so a RISE is visible. ⚠️ **TWO DIFFERENT MEASURES, AND CONFUSING THEM CAUSED A
  FALSE ALARM** (`PLAN-AUDIT-BASELINE-UNITS-01`, 2026-10-05):
  - **`invalid` counts PLANS with ANY code** from the three probes — invariants at **any severity**,
    plus `SCHEMA:` and `HR-`. Historically **10–16 every day, roughly half of `checked`**: 10/21,
    11/23, 16/29, 15/30. **15 of 30 is normal.**
  - **30 violations across 7 plans** counts only **error-severity invariant** violations on plans that
    have a stored `generator_input` — the remediation queue (`STORED-PLAN-DEBT-QUEUE-01`), expected to
    persist because the live-plan policy forbids the regeneration that would clear them.
  🔴 The digest prompt was given the second figure as a floor for the first. **They were never
  comparable**, and on 2026-10-05 the digest correctly spotted the mismatch and wrongly blamed the
  audit. Corrected in the prompt the same day.

## The age fields — `newest_invalid_plan_age_days` means CREATION (PLAN-AUDIT-AGE-SOURCE-01)

🔴 **It was computed from `updated_at` while being named for the plan's age**, and the route did not
even `select` `created_at`. Measured on the 2026-10-04 run: **23 plans fell in the `0-1d` bucket and
nine had been generated 63–166 days earlier** — rewritten by `RACE-WEEK-VOLUME-REMEDIATE-01` and
`FOUNDATION-BUDGET-01` the day before, not regenerated. One created **2026-04-21** was reported as
under a day old. The digest's escalation rule reads that bucket as *"the current engine has recently
produced a bad plan"*, so the inference was false for nine of them.

```ts
newest_invalid_plan_age_days      // by created_at — "did we just GENERATE this badly?"
invalid_by_plan_age               // same question, bucketed 0-1d / 2-7d / 8-30d / 31d+
newest_invalid_modified_age_days  // by updated_at — "did something just TOUCH a plan into breach?"
modified_recently_but_older       // the divergence, counted: written <1d but generated earlier
```

⚠️ **The modification signal is kept, not replaced.** A reshape or a maintenance-block append pushing
a previously-valid plan into violation is a real hazard and is the case the route's own header was
reaching for. Collapsing the two into one number is what made both unreadable.

Owner: `lib/ops/planAuditAges.ts → summarisePlanAges()`, extracted so it can be gated — the route had
no test, and an inline reduce in a Vercel handler cannot have one. `ageDays` returns **null** for a
missing, unparseable or future timestamp, never 0: a 0 would read as "brand new".
- `cause` counts **codes**, not plans: one plan contributing three new codes contributes three.

## `foundation_week_violations` counts REAL foundation weeks (AUDIT-FOUNDATION-MISCOUNT-01, 2026-10-09)

The field counts violations whose `week` is a week **the plan actually carries at `n <= 0`**
(ADR-020), derived by `lib/ops/regressionVsNewRule.ts → foundationWeekViolations(plan, errors)`.
**The route must not compute this itself.**

🔴 **It was `errors.filter(v => (v.week ?? 1) <= 0).length`, and that was wrong on every plan
that had any violation.** Two conventions collide on one sentinel:

| | |
|---|---|
| ADR-020 | a foundation week has `n <= 0` |
| `invariants.ts:1013` | `week: 0` means *"input-level, plan-wide, NO specific week"* |

**64 invariants use `week: 0`.** Measured across all 32 stored plans: **49 phantom
"foundation" violations on 19 plans, true value 0 on every one**, across 15 distinct codes.
On 2026-10-08 it made the daily digest escalate a non-existent engine regression and
recommend a generator fix for a data-entry problem.

## Verdicts, and the one that is new

| Verdict | Means | Pages? |
|---|---|---|
| `engine_regression` | today's engine reproduces it from the same inputs | **yes** |
| `rule_newer_than_plan` | the rule post-dates the plan; remediation queue | no |
| `undecidable` | no comparable plan could be regenerated. **Not clean** | **yes** |
| `input_breach` ⭐ | an `INV-INPUT-*` code: the runner's STATED input is wrong. **Not clean** | no |

⚠️ **`input_breach` exists because replay cannot speak to the engine here.** The input is
stored, so regenerating from it reproduces an input breach **by construction** — the code
could only ever receive `engine_regression`. It does not page (waking someone for a
data-entry problem is the noise that made this field unread in the first place) and it is
**not** clean: `summariseVerdicts().inputBreaches` carries it, and `verdictReason` names it
in prose.

⚠️ **The discriminator is the `INV-INPUT-` PREFIX, never `week === 0`** — the shared sentinel
is the collision above, so reusing it would rebuild the defect inside its own fix.

⚠️ **This path is ENVIRONMENT-DEPENDENT.** `generateRulePlan` and `validatePlan` throw on
error severity under `NODE_ENV=test`/`development` and log in production (ADR-006). A
breaching input therefore yields `undecidable` under test and reached `engine_regression` in
production. Any test of this path must stub `NODE_ENV=production` or it asserts a verdict the
live system never emits.



## Repairable damage — `repairable` (DIGEST-REPAIRABLE-01, 2026-10-09)

**The audit described; this field instructs.** `lib/ops/repairableDamage.ts →
summariseRepairable` owns it.

🔴 **IT IS A STANDING REPORT, AND THAT IS THE OPPOSITE RULE FROM THE CODE-SET
ALERT ABOVE.** `PLAN-AUDIT-01` alerts on a **transition** because *"an alert that
always fires is an alert nobody reads"* — correct for debt with no known remedy.
It is wrong for damage that has one, and the six-day gap is the proof: the
recalibration defect (`RECAL-PACE-TWO-WRITER-01`) broke three live plans on
**2026-10-03**, the transition alert fired once and then went quiet — correctly,
by its own rule, because nothing changed after that — and **the damage sat for six
days** while the digest said nothing. It surfaced only because the founder read an
unrelated line in the same report and asked about it.

A standing count does not decay into noise here because it is **self-clearing**:
one command fixes it and the field disappears. *"Something happened"* is worth
saying once; *"this is still true, and here is the fix"* is worth saying until it
is not.

⚠️ **ABSENT, NEVER ZEROED.** A digest line reading `repairable: 0 plans` every
morning is exactly the noise this exists to avoid being. Absence is the clean
signal.

⚠️ **ONE LIST, SHARED.** The codes it counts come from `REPAIRABLE_CODES` in
`lib/plan/planRepairs.ts` — the same list the repair script's own population
filter reads. So the digest can never advertise a command that does not cover the
damage it is reporting. That drift already happened once inside the script itself:
it selected plans by one code, and a plan carrying eight repairable violations
dropped out of its target set the moment the first was fixed.

⚠️ **THE COMMAND IS A DRY RUN AND IS ASSERTED TO BE.** `--apply` is never
advertised: a digest should not hand over a live write. The dry run prints a
per-plan before/after diff, and every write archives the prior plan first.

**Verified against production both ways (2026-10-09):** 21 invalid plans and the
field **absent**, because the repairs had already run; with one synthetic damaged
plan added it returns `{ plans: 1, by_code: { INV-PLAN-HEADER-PACE-MATCHES-WORK:
1 }, command: … }`.

🔻 **THE DIGEST PROMPT ITSELF IS NOT REPO CODE.** The daily ops digest is a cloud
routine. This field makes the information available; **surfacing it is a one-line
change to that routine's prompt**, which is the founder's to make.
