# API Contract — `GET|POST /api/ops/plan-audit` + the cause classifier (OPS-DIGEST-STORED-PLAN-DEBT-01)

**Tier:** Ops/internal — not user-facing, no FREE/PAID gate.
**Owner:** `app/api/ops/plan-audit/route.ts` (the pass) · `lib/ops/storedPlanProbes.ts` (schema + HR-band codes) · `lib/ops/regressionVsNewRule.ts` (**why** a code set changed) · `lib/ops/planWeekCollision.ts` (the collision probe).
**Auth:** `CRON_SECRET` via `Authorization: Bearer <secret>` or `x-cron-secret`. 403 otherwise.
**Closes:** `PLAN-AUDIT-01` (the daily constitutional audit) and `OPS-DIGEST-STORED-PLAN-DEBT-01` (what the change MEANS).

---

## What it does

Runs `validatePlan` plus the schema and HR-band probes over **every stored plan** and records
breaches as `ops_events` of kind `plan_rule_invalid`.

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
`verdict_note`, so triage does not have to re-derive them.

## Consumers

- The **daily ops digest** — a cloud routine, not repo code (editable via RemoteTrigger). ⚠️ **It
  does not read `cause` yet.** Until it is pointed at it, the field is computed and unread, which is
  the decorative-config shape. That is the open half of `OPS-DIGEST-STORED-PLAN-DEBT-01`.
- No app or website surface reads this route. It is ops-only.

## Limits, stated

- `MAX_PLANS = 5000`. If hit, the audit needs pagination rather than a silently truncated pass, so
  it is reported, never hidden.
- A plan with **no `generator_input`** cannot be classified at all — `verdict_note` says so rather
  than defaulting to a verdict.
- `cause` counts **codes**, not plans: one plan contributing three new codes contributes three.
