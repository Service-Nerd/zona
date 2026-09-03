# ADR-020 — The plan construction boundary: every week is built and validated in one place

**Status**: SHIPPED (2026-09-03). CB-1 and MWM-02 ruled; CB-2 shipped `be5e538`; CB-1 + MWM-02 shipped in one wave; Option A (server-side construction) shipped — see § Option A shipped.
**Date**: 2026-09-03
**Supersedes**: nothing. **Amends**: ADR-009 (config-driven generation), the three-layer model in CLAUDE.md.
**Related**: ADR-006 (hybrid generation), ADR-016 (date-aware resolution), ADR-017 (Coaching Board), §57 (foundation block)

---

## Context

Zonna's correctness rests on a three-layer constitutional model: a principle in
`CoachingPrinciples.md`, a numeric in `GENERATION_CONFIG`, and a mechanical check in
`validatePlan()`. The claim the model makes is *"when all three agree, the engine is provably
honouring its constitution."*

**That claim is false for part of every plan that has a foundation block.**

Foundation weeks (`phase: 'foundation'`, `n <= 0`) are a **second plan-construction path**. They
are built in the browser by `generateFoundationBlock()` and prepended to the plan *after* it
leaves the server, at `GeneratePlanScreen.tsx:902` (automatic, gap-driven) and `:995` (the
user-chosen "Add Foundation Block" modal). The server's `validatePlan()` runs inside
`generateRulePlan()` and returns before those weeks exist.

This is a **D-08 violation** (no duplicate ownership): plan construction has two owners, and only
one of them is governed.

### How it surfaced

Two live defects in two days, both in weeks the validator cannot see:

- **FOUNDATION-DAYS-01** (`33392ca`, 2026-09-03) — foundation weeks ignored `days_cannot_train`
  for every plan ever generated. `buildFoundationSessions` compared short-form day keys (`'mon'`)
  against raw wizard input (`'monday'`), so nothing ever matched. Found by the founder on a real
  plan, not by any test.
- **ENRICH-ATTRIB-01** (`2030f98`, 2026-09-02) — a sibling shape: the race-week branch of
  `buildWeekSessions` returned early and bypassed the shared `max_weekday_mins` pass.

Both are the same class: **a piece of the plan sitting outside the thing that checks plans.**

---

## The evidence

### 1. `INV-PLAN-FOUNDATION-BLOCK` exists, is Coaching-Board-ratified, and cannot fire in production

`invariants.ts:2616` implements a full three-arm invariant for foundation weeks (forbidden session
types, volume ceiling, long-run fraction), backed by `FOUNDATION_LONG_RUN_MAX_PCT` and a Coaching
Board ruling (Coaching-1). It is real, correct, and **dead in the live path** — `validatePlan()`
only ever receives plans that have no foundation weeks in them.

It passes its tests because `foundationLongRunCap.test.ts` **hand-assembles** the composite the
server never builds:

```ts
const main = generateRulePlan(INPUT, 'paid', PLAN_START)
const fb   = generateFoundationBlock({ ... })
return { plan: { ...main, weeks: [...fb.weeks, ...main.weeks] } }
```

The test constructs a plan shape that only the browser constructs. Green tests, guarded nothing.

### 2. The one live mitigation discards the violations it computes

A prior session recognised the gap and added `validateFoundationBlock()`
(`GeneratePlanScreen.tsx:392`), whose own comment states: *"This is the only validation foundation
weeks get live."* It re-runs `validatePlan()` on the assembled plan — and then:

```ts
.filter(v => v.code === 'INV-PLAN-FOUNDATION-BLOCK')
```

Measured on the founder's real input (blocked Mon/Wed/Thu) with the FOUNDATION-DAYS-01 bug
reinstated:

```
Violations validatePlan FINDS on the assembled plan: 4
   INV-PLAN-NO-SESSIONS-ON-BLOCKED-DAYS  w-2 mon / w-2 wed / w-1 mon / w-1 wed
What the live filter KEEPS:      0
What it SILENTLY DISCARDS:       4
```

**The live code detected today's bug and threw the result away.** Two further weaknesses in the
same function: it reports via `console.error` in a *browser* (D-04 "failure is data" — no durable
record, no ops event, unobservable to us), and it is best-effort inside a `try/catch`.

### 3. Neither commit gate can see foundation weeks

| Gate | Plans checked | With a foundation block |
|---|---|---|
| Property sweep (`property-validate-plans.ts`) | 18,060 | **0** |
| Archetype matrix (`r23-phase7-validation.ts`) | 14 | **0** |

The sweep passes `PLAN_START` explicitly and never calls `generateFoundationBlock` — deliberately,
to keep generation deterministic (`scripts/property-validate-plans.ts:23`). The consequence is that
the two gates standing between every commit and production are structurally blind to this code.

This is the mechanism behind *"we keep making changes and then it breaks something else."*

### 4. `PlanSchema` declares foundation weeks impossible — and is never enforced

`WeekSchema.n` is `z.number().int().positive()`. Every foundation week (`n = -2, -1, 0`) violates
it. No crash results, because **`PlanSchema` is parsed nowhere in the codebase** — only
`EnrichedPlanSchema` is. The canonical runtime schema is decorative for plans, and the one thing it
says about foundation weeks is wrong.

### 5. Downstream: a paid runner in a foundation block gets a failed weekly note, every week

`app/api/plan-weekly-note/route.ts:57` rejects `week_n < 1` with a 422. The same route at `:146`
contains an explicit `phase === 'foundation'` branch — **unreachable for real foundation weeks**.
`DashboardClient.tsx:8109` calls it for the current week with no guard, so `!res.ok` sets the note
to `'failed'` for the entire block (up to 3 weeks).

### 6. `validateReshapedPlan` rebuilds a lossy input while the real one sits on the plan

```ts
current_weekly_km:     0,   // not on meta — dependent invariants self-skip on 0
longest_recent_run_km: 0,   // not on meta
days_cannot_train:     [],  // not on meta — blocked-days invariant skipped
```

All three comments are **out of date**. PV2-A (`fff1ab3`) persists the complete input at
`meta.generator_input`, and `ruleEngine.ts:4405` names these very fields as the reason it exists:
*"current_weekly_km, longest_recent_run_km, days_cannot_train ... were otherwise discarded."*

Three invariant families are therefore inert on **every reshape**, using data already stored. This
is the same failure class as SWEEP-VACUOUS-01 (*an input the engine never reads tests nothing*).

---

## Blast radius

**Upstream (what builds weeks)**

| Path | Owner | Validated? |
|---|---|---|
| Weeks `1..N` | `generateRulePlan()` (server) | ✅ `validatePlan()` |
| Foundation weeks, automatic | `GeneratePlanScreen:902` (client) | ⚠️ filtered console-only |
| Foundation weeks, user-chosen | `GeneratePlanScreen:995` (client) | ⚠️ filtered console-only |
| Enrichment copy | `/api/generate-plan` | ✅ since ENRICH-ATTRIB-01 |
| Reshape | `/api/adjust-plan` | ⚠️ `validateReshapedPlan`, lossy input |
| Maintenance block | `/api/maintenance-block` | — to confirm |

**Downstream (what reads weeks).** ~29 API routes key on `week_n`. Assessed:

| Surface | Foundation-safe? |
|---|---|
| `getSessionForDate` / `isDateWithinWeek` (ADR-016) | ✅ date-window based; negative `n` fine |
| `session_overrides` (`o.week_n === weekN`) | ✅ keys on `week.n` (ADR-013) |
| `plan-weekly-note` | ❌ 422 on `week_n < 1`; dead foundation branch |
| `validateReshapedPlan` | ⚠️ inert invariants (finding 6) |
| `PlanSchema` | ❌ declares `n` positive |
| Property sweep / matrix | ❌ zero coverage |
| Enricher | ⚠️ never sees `n <= 0` — **by design**, and correct: foundation copy is hand-authored. Documented here so it is a decision, not an accident. |

---

## Options

**Option A — Move construction server-side.** `/api/generate-plan` builds the foundation block and
returns one complete plan. The client supplies the *decision* (gap already known; the modal's
choice becomes a request field such as `foundation_weeks`), the server owns *construction*.
One owner; `validatePlan()` sees every week; the sweep and matrix reach it.
*Cost*: route contract change, wizard change, sweep/matrix extension.

**Option B — Keep client construction, validate properly.** Drop the `.filter`, surface violations
durably (ops event via a small endpoint). *Cost*: low. *Leaves*: D-08 violation intact, sweep and
matrix still blind, `PlanSchema` still wrong. Treats the symptom.

**Option C — Do nothing structural; fix the six findings individually.** Rejected: this is the
third time this class has been patched locally, and the gates would remain blind.

## Recommendation — Option A

It is the only option that makes the three-layer claim true again, and the only one that puts
foundation weeks inside the gates that run on every commit. B is a strictly weaker A and would need
redoing.

---

## Decisions required

### CB-1 — Coaching Board (blocking) — *which principles bind a pre-plan foundation week?*

Under Option A, foundation weeks enter `validatePlan()` and **~40 invariants that have never
applied to them begin to apply**. That is not a refactor; it changes what the engine will accept
and therefore what it prescribes. Per **INV-COACH-001** and **D-22**, the Board rules.

Each needs an explicit *binds* / *carved out* ruling. Non-exhaustive, the contentious ones:

| Invariant | Question for the Board |
|---|---|
| `INV-PLAN-QUALITY-EXPECTED` | Foundation is easy-only by §57. Must be carved out or it fires on every block. |
| `INV-PLAN-WEEK-HAS-REST-DAY` | Does §64's six-day cap bind a pre-plan block? |
| `INV-PLAN-MIN-SESSION-SIZE` | §9's floor on a deliberately-tiny return-to-running week? |
| `INV-PLAN-LONG-IS-LONGEST` | Foundation has a "Long easy"; does the §9 ratio bind? |
| `INV-PLAN-NO-SESSIONS-ON-BLOCKED-DAYS` | Expected: **binds** (life-first §18 has no phase exemption). Confirms `33392ca`. |
| `INV-PLAN-MAX-WEEKDAY-MINS` | Expected: **binds**, same reasoning. |
| `INV-PLAN-INTENSITY-DISTRIBUTION` | Undefined at 3–4 easy sessions — carve out, as CD-21 did for maintenance? |

**Whichever way each goes, the ruling produces the artifacts required by INV-COACH-002** — a §57
amendment recording the carve-out list, and the guards in `validatePlan()`.

### CB-2 — Engineering (no board) — defect fixes restoring documented intent

Exempt under INV-COACH-001 (*defect fixes restoring documented intent*); stated here for the record.

1. Drop the `.filter` in `validateFoundationBlock` — it discards real violations (evidence §2).
2. `plan-weekly-note`: accept `week_n <= 0`; the route's own foundation branch is the documented
   intent (evidence §5).
3. `validateReshapedPlan`: read `meta.generator_input` when present, fall back to the current
   reconstruction for legacy plans (evidence §6).
4. `WeekSchema.n`: allow `<= 0` with a comment naming foundation weeks — *or* enforce `PlanSchema`
   somewhere real. **Flag**: a schema parsed nowhere is its own finding; separate item.

### SLT-1 — not required

No tier or scope change. Foundation block is FREE infrastructure (feature-registry). The
weekly-note fix restores intent the route already encodes rather than extending a paid surface. If
the Board's carve-outs change what a foundation block *contains*, that returns here.

---

## Proposed pattern — `INV-PLAN-SINGLE-CONSTRUCTION`

The gap exists because no rule forbade it. Proposed addition to the plan invariants:

> **Every week that reaches a runner is constructed by the plan generator and validated before it
> is shown or saved. No surface may append, prepend, or mutate `plan.weeks` after generation
> without re-entering `validatePlan()`.** Where a client genuinely must assemble (offline, or a
> user-chosen block), it re-runs the full validator **unfiltered** and reports violations durably —
> never `console`-only.

Companion to INV-CLASS-001 ("one owner for classification") and the singularity doctrine.

**Also add to the `zona-debug` silent-failure catalogue:** *"construction outside the validator" —
a plan surface built on a path the checker never runs on. Ask: which code builds part of this
object, and does the validator see that part?*

---

## Test strategy

The user-stated problem is *"we keep making changes and then it breaks something else."* Every
change above must land inside the gates that run on each commit, or it will decay.

1. **Property sweep gains a foundation dimension.** Add a `gapDays` axis (`0` = none, and values
   crossing each `classifyGap` boundary) and assemble the block when non-zero. Currently 0 of
   18,060 plans; target: a material share. This is the single highest-value item — it is what the
   two gates being blind actually cost.
2. **Archetype matrix gains foundation cases** — at minimum: auto-added block, user-forced block,
   and a blocked-days runner (the `33392ca` case) asserting derived days.
3. **Falsification required** (per `feedback-verification-must-reach-the-change`): every new
   assertion must be shown to go RED against the pre-fix code before it is trusted green. The three
   existing foundation tests pass today against a plan shape production never builds — that is
   exactly the failure this rule exists to catch.
4. **Regression per finding** — one test each for the six findings, replaying real inputs where
   they exist (`e876c470` for blocked days).
5. **Journey test** (M-010): generate with a >28-day gap → foundation block renders, weekly note
   does not read "failed".

---

## Consequences

**Positive**: the three-layer claim becomes true for the whole plan; both commit gates see
foundation weeks; two owners collapse to one; three inert invariant families come alive on reshape.

**Costs / risks**: the route contract changes (needs `docs/contracts/api/generate-plan.md`);
turning ~40 invariants on for previously-ungoverned weeks **will surface existing violations in
live plans** — expected, and the reason CB-1 is blocking rather than advisory; per
[live-plan policy] existing plans are **not** backfilled (new plans only).

**Sequencing**: CB-1 → CB-2 defect fixes → Option A move → sweep/matrix extension → docs. Ship as
separate commits; the Board ruling lands its three artifacts in one commit per INV-COACH-002.


---

## Outcome (2026-09-03)

**Shipped.** CB-2's three defect fixes (`be5e538`), then CB-1 + MWM-02 together.

### What the rulings changed

| | Ruling |
|---|---|
| **CB-1** | Foundation weeks BIND §18, §9, §64 and their own invariant; CARVED OUT of §1 and the four §57 already named. Amendment: §52b day-fitting, coordinated sizing, and the inline `3` promoted to config. |
| **MWM-02** | Naive "cap the long run too" **vetoed**. Long run exempt from the weekday cap; where it cannot fit the stated availability the plan says so and classifies `maintenance` (§81). |

### Measured result — same widened grid, two engines

| Violation class | Pre-wave | After |
|---|---|---|
| `INV-PLAN-LONG-IS-LONGEST` | 49,336 | **0** |
| `INV-PLAN-MIN-SESSION-SIZE` | 66,075 | 2,061 |
| `INV-PLAN-FOUNDATION-BLOCK` | 9,230 | **0** |
| `INV-PLAN-WEEK-HAS-REST-DAY` | 3,962 | **0** |
| `INV-PLAN-RACE-SPECIFIC-EXPOSURE-RATIO` | 155 | 155 *(untouched)* |
| `INV-PLAN-MAX-WEEKDAY-MINS` | 238 | 238 *(untouched)* |

Plans with violations **11,237 → 669**. The two unchanged classes plus the
2,061 remainder are pre-existing defects the widened grid can now see, baselined
with attribution and filed as **SWEEP-VISIBLE-01**.

### Test strategy — delivered

The sweep now assembles foundation blocks (**13,528 plans / 31,610 foundation
weeks**, from zero) and varies `max_weekday_mins: 30`, the value both real users
chose and the grid had never tested. That change alone surfaced four classes the
old grid could not reach, and caught a §64 rest-day breach in this wave's own new
code before it shipped.

### Two things deliberately NOT done

1. **A final weekday-cap pass.** The ordering diagnosis was right, but every
   re-expanded session proved to be the long run, which §81 exempts. With the
   exemption: 0 of 153,728 non-long weekday sessions exceed the cap, and an A/B
   was byte-identical. Written, measured, removed — a pass that provably changes
   nothing reads as a safeguard while guarding nothing, which is the same false
   confidence as an invariant that never fires. `validatePlan` on the finished
   plan remains the exit-boundary check.
2. **Extending the cap exemption to quality sessions.** Same family (the cap
   deforming a session whose prescription is its structure) and the likely cause
   of the 2,061 remainder — but the board ruled only on the long run, and this is
   a new coaching decision, not an implementation detail.

## Option A shipped (2026-09-03)

Foundation-block construction moved server-side. **`lib/plan/foundationCompose.ts`
→ `composePlanWithFoundation()`** is the single owner of `plan.weeks` mutation
post-generation — the literal answer to this ADR's proposed
`INV-PLAN-SINGLE-CONSTRUCTION` pattern (§ below).

**What changed:**

- **`/api/generate-plan/route.ts`** composes foundation weeks onto `rulePlan`
  immediately after `generateRulePlan` returns, before either tier's response
  path. `validatePlan()` — via `composePlanWithFoundation`'s internal call —
  now sees foundation weeks in the live path for the first time. The route's
  existing enrichment-attribution baseline/diff (ENRICH-ATTRIB-01) is
  computed on the composed (with-foundation) plan on both sides, so it stays
  apples-to-apples.
- **The AI enricher still never sees foundation weeks** — deliberately
  unchanged. `enrich()` is called with the foundation-free `rulePlan`; the
  route re-attaches the already-composed foundation weeks onto the
  enricher's output before the post-enrich validation and before sending
  `final_plan`. Two enrich-adjacent code paths needed the same fix (found
  during design validation, not shipped-then-caught): the `finalPlan`
  initializer AND the enrichment-revert branch both previously read
  `rulePlan` (foundation-free) — either would have silently dropped a
  runner's foundation block. Both now read the composed plan.
- **New endpoint, `POST /api/generate-plan/foundation`** (contract:
  `docs/contracts/api/generate-plan-foundation.md`) completes the deferred
  `'choice'` band (>28-day gap) decision — composes onto the client's
  existing plan without re-running the rule engine or re-paying for AI
  enrichment.
- **`GeneratePlanScreen.tsx`**: all client-side construction
  (`generateFoundationBlock`) and the best-effort console-only check
  (`validateFoundationBlock`) are removed. One piece of client-side logic
  intentionally *stays*: the `final_plan` NDJSON merge still splices
  foundation weeks from local `planRef` state, because the "Add Foundation
  Block" decision can arrive via the separate endpoint *while the
  enrichment stream is still open* (28–35s) — a timing race the server
  generating that stream has no way to observe. Found during design
  validation before it shipped, not in production.
- **`lib/plan/foundationValidation.ts`** (the client-side
  `foundationWeekViolations`/`isFoundationWeek` helpers) is deleted — dead
  code once construction and validation are both server-side; its only
  caller was the removed client logic (D-18 hard cut).
- **`WeekSchema.n`** relaxed from `.positive()` to a plain integer (CB-2 item
  4). `PlanSchema` is still parsed nowhere in the codebase — this fixes the
  schema's own internal correctness, not new runtime enforcement (a
  separate item, as the original CB-2 note flagged).
- **Sweep and matrix** now call `composePlanWithFoundation` directly instead
  of hand-splicing `generateFoundationBlock`'s output — the exact "green
  tests, guarded nothing" gap this ADR names by file (§1 of the evidence
  above) no longer exists: the gates exercise the same composition function
  production calls, not a parallel construction the gates alone build.

**`INV-PLAN-SINGLE-CONSTRUCTION`** — see `docs/canonical/plan-invariants.md`.
Enforced structurally (one module, one function, both live call sites route
through it) rather than as a mechanical JSON-shape check — there is no way to
prove from a finished plan alone *how* it was assembled.

**D-08 duplicate-ownership violation: closed.** One owner
(`composePlanWithFoundation`), governed by the same validator as the main
plan, reachable from every construction path (initial generation, deferred
user decision, sweep, matrix, tests).