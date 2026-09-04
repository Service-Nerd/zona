# Contract — POST /api/generate-plan

**Authority**: This document defines the request/response contract for the plan generator API route. The route lives at `app/api/generate-plan/route.ts`.

**Architecture**: Hybrid generation (ADR-006). Rule engine always runs; AI enricher runs for trial/paid and falls back silently on failure. Free users always receive a plan.

---

## Request

```
POST /api/generate-plan
Content-Type: application/json
Body: GeneratorInput
```

### GeneratorInput (required fields)

```typescript
{
  race_date: string               // ISO date "YYYY-MM-DD"
  race_distance_km: number        // 5K/10K/HM free; Marathon/50K/100K PAID
  goal: 'finish' | 'time_target'
  current_weekly_km: number       // 4-week average
  longest_recent_run_km: number   // within last 6 weeks
  days_available: number          // 2–6
  age: number                     // derived client-side from DOB at generation time; used for Tanaka MaxHR
}
```

### GeneratorInput (optional fields)

> **Removed 2026-08-06 (F10):** `longest_run_ever_km` was documented here as
> "informs week-1–2 long-run cap" but existed nowhere in `GeneratorInput` or the
> engine — a contract asserting a field the code had never had. The week-1–2 cap
> is driven by `longest_recent_run_km`, which *is* consumed. Implementing the
> field is tracked as R23-D1 in `backlog.md`; until then the contract must not
> claim it.

```typescript
{
  // Fitness — all derived server-side; supply to override derivation
  //
  // TWO fields, TWO authorities (CoachingPrinciples §79, 2026-09-02). Do not
  // conflate them — collapsing them into one enum is what produced the defect
  // where a wizard dropdown raised prescribed tonnage.
  //
  //   fitness_level        — the STRUCTURAL declaration. A caller asserting what
  //                          the runner is. Drives peak km + volume caps, exactly
  //                          as it always has. The archetype matrix and property
  //                          sweep depend on this behaviour.
  //   user_declared_level  — what the RUNNER picked in the wizard. Binds
  //                          ASYMMETRICALLY: upward of the engine's assessment it
  //                          raises the INTENSITY allowance only (structure stays
  //                          on the assessment); downward it binds both. A
  //                          self-declaration is not evidence of tissue tolerance.
  fitness_level?: 'beginner' | 'intermediate' | 'experienced'  // derived from data if absent
  user_declared_level?: 'beginner' | 'intermediate' | 'experienced'  // wizard selection; intensity-only upward
  resting_hr?: number             // improves Karvonen zone accuracy; falls back to HRmax%
  max_hr?: number                 // derived from age via Tanaka if absent
  training_age?: '<6mo' | '6-18mo' | '2-5yr' | '5yr+'  // R23 rebuild — drives returning-runner allowance

  // Benchmark — enables VDOT-based pace targets (Jack Daniels model)
  benchmark?: {
    type: 'race' | 'tt_30min'
    distance_km: number           // race distance OR km covered in 30 min
    time: string                  // finish time e.g. "25:30", "1:52:00". "30:00" for TT.
    benchmark_date?: string       // ISO date — used to apply stale-benchmark VDOT discount (>6 mo)
  }

  // Race
  race_name?: string
  target_time?: string            // only if goal = 'time_target'. Derives goal_pace_per_km AND drives peak-phase race-pace specificity.

  // Schedule
  days_cannot_train?: string[]    // full day names e.g. ['monday', 'friday']
  max_weekday_mins?: number
  preferred_long_run_day?: 'sat' | 'sun'  // R23 rebuild — soft constraint; default 'sun'
  treadmill_primarily?: boolean   // R23 rebuild — affects strides and hill-work plausibility

  // Profile (paid/trial only)
  hard_session_relationship?: 'avoid' | 'neutral' | 'love' | 'overdo'
  injury_history?: ('achilles' | 'knee' | 'back' | 'shin_splints' | 'hip_flexor' | 'plantar_fasciitis')[]
  terrain?: 'road' | 'trail' | 'mixed'
  athlete_name?: string

  // Removed in R23 rebuild — `motivation_type`, `training_style`. Server ignores these fields if sent.

  // ADR-020 Option A (2026-09-03) — the runner's choice on the Foundation
  // Block modal, shown only when meta.foundation_gap_class === 'choice' on a
  // PRIOR response (>28-day gap between today and plan_start). Absent on the
  // initial call — the decision doesn't exist yet. Send it on a follow-up
  // POST /api/generate-plan/foundation call once the runner has chosen; see
  // docs/contracts/api/generate-plan-foundation.md. A gap inside the 'auto'
  // band (7-28 days) never needs this — the server adds the block without
  // asking.
  foundation_decision?: 'add' | 'skip' | 'start_now'
}
```

---

## Responses

### 200 — Plan generated

```json
{ "plan": Plan }
```

The plan always contains at minimum rule-engine output. For trial/paid users, AI-enriched labels,
week themes, and session coach notes are included. For paid users only: `confidence_score`,
`confidence_risks`, and `coach_intro` are added. The `meta.tier` field indicates which tier
produced the plan.

**Free first-plan (CA-01):** for a **free** user generating their **first** plan (no row yet in
the `plans` table), `meta.plan_intro` is set — a single Haiku-generated "why this plan" line in
Kit's voice (the one AI surface free users get). Generated by `lib/plan/freeIntro.ts`, **not** the
enricher. Silent fallback (ADR-006): on any AI failure the field is simply absent. Never co-exists
with the paid `coach_intro`; subsequent free plans (a `plans` row exists) omit it.

**R23 rebuild additions to `meta`:**
- `vdot_discount_applied_pct: number` — total VDOT discount applied (3% default + 5% if benchmark stale > 6 months). Surfaced for transparency.
- `catalogue_session_ids: string[]` — IDs of `session_catalogue` rows referenced by this plan's quality sessions. Useful for recalibration and audit.

**ADR-020 Option A addition to `meta`:**
- `foundation_gap_class: 'none' | 'auto' | 'choice'` — always present. `'none'` (<7-day gap): no foundation weeks, none needed. `'auto'` (7-28 days): the block is already in `plan.weeks` (`phase: 'foundation'`, `n ≤ 0`) — nothing further to do. `'choice'` (>28 days): the block is **not** in `plan.weeks` yet — show the Foundation Block modal and, if the runner picks "Add", call `POST /api/generate-plan/foundation` (see `docs/contracts/api/generate-plan-foundation.md`).

### 401 — Unauthenticated

```json
{ "error": "Unauthorized" }
```

### 422 — Guard rail violation

```json
{ "error": "string" }
```

Triggered by:
- Race fewer than 3 weeks away
- Marathon+ race fewer than 8 weeks away
- Half marathon race fewer than 4 weeks away
- Fewer than 2 days available per week
- Marathon distance with current_weekly_km < 20
- HM+ distance with longest_recent_run_km < 5

### 500 — Unexpected error

```json
{ "error": "Unexpected error" }
```

---

## Behaviour

### Tier-based generation

| Tier | Rule engine | AI enricher | Confidence fields | coach_intro | plan_intro (CA-01) |
|------|-------------|-------------|-------------------|-------------|--------------------|
| free | ✅ always | ✗ | ✗ | ✗ | ✅ first plan only (silent fallback) |
| trial | ✅ always | ✅ (fallback) | ✗ | ✗ | ✗ |
| paid | ✅ always | ✅ (fallback) | ✅ | ✅ | ✗ |

Tier is determined server-side by `getUserTier(userId)`. The client never sends a tier claim.

### Max HR plausibility (GEN-FIX-05, 2026-08-06)

`GeneratorInput` gains an optional `max_hr_source?: 'observed'`, set by the wizard when it reads
max HR directly from HealthKit. Best-effort provenance: a value inherited from `user_settings` has
no recorded source and stays unmarked.

Per CoachingPrinciples §50 the engine no longer treats a supplied `max_hr` as ground truth:

| Condition | `meta.hr_zone_method` | Behaviour |
|---|---|---|
| Deviates from Tanaka by > `MAX_HR_PLAUSIBILITY_DEVIATION_PCT` (15%) | `age_estimate_implausible_input` | **Falls back to the Tanaka estimate.** Note names the supplied value, the estimate, and the Profile override. Source-independent |
| `max_hr_source: 'observed'`, within tolerance | `observed_max` | Value used; note always surfaced — a device's highest *recorded* rate is a floor, not a maximum |
| Otherwise | unchanged (`karvonen`, etc.) | unchanged |

`INV-PLAN-HR-ASSUMPTIONS-SURFACED` no longer exempts `karvonen` wholesale — only a `karvonen`
derived from an unmarked, plausible max is silent. §55's `[120, 220]` range check is unchanged;
this is a separate gate for values that are physiologically possible but wrong for this runner.

### Enricher fallback
If the AI enricher fails (timeout, invalid JSON, schema violation), the rule-engine plan is
returned unchanged. **No error surfaces to the user and generation always succeeds** — ADR-006's
silent fallback is unchanged.

**Changed by GEN-FIX-02 (2026-08-06):** the failure is no longer silent to *us*.

- `enrich()` now returns `{ plan, outcome }`. `outcome` is `{ status: 'applied' }` or
  `{ status: 'failed', reason, detail? }` with `reason` ∈ `no_api_key` | `api_error` |
  `fetch_failed` | `parse_error` | `schema_invalid`. It still never throws; the route keeps a
  backstop `catch` regardless.
- On failure the route writes a `plan_enrich_failed` row to `ops_events` (see
  `docs/contracts/api/ops-events.md`), awaited so it is durable before the stream closes.
- Every response now carries **`meta.enrichment`**, so a saved plan self-describes:

  | Value | Meaning |
  |---|---|
  | `applied` | Enricher ran and its output was merged |
  | `skipped` | Free tier; never enriched by design |
  | `pending` | Stamped on the streamed `rule_plan` before enrichment resolves. **Expected transiently** since ENRICH-SAVE-01: the runner saves deliberately before the ~30 s enricher finishes and the enriched copy is written over it after. A defect only if it **persists** — see *Save-then-enrich* below |
  | `failed_no_api_key` | `ANTHROPIC_API_KEY` absent from the environment — deploy config |
  | `failed_api_error` | Anthropic returned a non-2xx, or transport threw — upstream |
  | `failed_unparseable` | Response was not JSON, or failed `EnrichedPlanSchema` — the model |
  | `applied_partial` | **ENRICH-PARTIAL-01 (2026-09-04).** Enrichment applied, then specific WEEKS were reverted to rule copy because their copy introduced a violation. The athlete has AI voice on every other week. `ops_events.detail.reverted_weeks` names which |
  | `failed_invalid_copy` | Enrichment introduced **new** invariant violations that could NOT be repaired by reverting individual weeks — a plan-level or meta violation, or one that survived the per-week revert. The whole plan falls back to rule copy — our prompt |
  | `failed` | **LEGACY.** Written before 2026-09-03; never written by current code. Retained so historical rows parse |
  | *absent* | Plan generated before GEN-FIX-02 shipped |

  Every `failed_*` value means the same thing to the **user** (they hold rule-engine output, silently
  — ADR-006 unchanged); they differ only in who has to fix it. The bare `failed` was widened on
  2026-09-03 after it proved undiagnosable: two trial plans read `failed` and the string could not
  distinguish an unreachable API from unparseable model output from a plan we discarded ourselves.
  It was the third of those. See **Enrichment attribution** below.

  This does not breach ADR-006: the field is metadata, is never rendered, and carries no error
  state to the user. It exists so "did the paid layer actually run?" is a query rather than
  forensics — the question that took five days to answer for the first organic user
  (`docs/incidents/2026-08-06-plan-defects/analysis.md`, N1).

### Save-then-enrich (ENRICH-SAVE-01, 2026-09-03)

The rule plan is ready in ~10 ms. The enricher takes **28–35 s** (measured, Haiku,
12-week plan). The client therefore does **not** wait for it:

1. `rule_plan` arrives → preview is reachable immediately.
2. Runner taps **Use this plan** → the plan is saved as-is and they move on. No wait.
3. `final_plan` arrives ~30 s later → written over the saved plan as a follow-up.

Ordering is owned by `lib/plan/enrichSaveCoordinator.ts`. The case that matters is
enrichment landing **during** the first save: it must be held until that save
completes, or the save lands second and overwrites it.

**Step 3 is no longer the client's alone — ENRICH-SERVER-SAVE-01 (2026-09-04).**
The follow-up write used to be owned entirely by the client, which meant the design
told the runner *not to wait* and then silently cost them the voice layer when they
didn't: tap **Use this plan**, lock the phone, and `meta.enrichment` stays `pending`
for ever. Observed on a real trial plan — saved 5 s after generation, never written
again. Nothing on the server persisted anything; the route only ever READ the table.

The route now writes the enriched plan itself before closing the stream, guarded by
`shouldServerPersist` (`lib/plan/enrichServerSave.ts`) so it can only ever overwrite
the plan it just produced:

| Condition | Behaviour |
|---|---|
| No row for this user | **skip** — generation alone never creates one, so a runner who never tapped "Use this plan" is untouched |
| Row's `meta.generated_at` ≠ this generation's | **skip** — the runner kept an older plan, or generated twice and saved the first |
| Either timestamp missing or not a string | **skip** — an unstamped row is a legacy plan; guessing is the harm this guard exists to prevent |
| Row already has a resolved `enrichment` | **skip** — the client's follow-up write got there first |
| Otherwise | **write**, and record `plan_enrich_server_saved` |

The client keeps its own follow-up write as the fast path, so nothing about the UX
changes. The race degrades correctly in both directions: tap *before* enrichment
resolves and the server write lands; tap *after* and there is no row at write time,
so the server skips and the client — still open — writes it.

A failure here never breaks generation (ADR-006): the runner already holds a
complete plan and the enriched copy is a nicety. Recorded as
`plan_enrich_server_save_failed`, never thrown. The SUCCESS event is recorded too,
deliberately — it is the only evidence the backstop caught someone who closed the
app, and a backstop nobody can see firing is one nobody trusts.

**What this replaced.** `handleUsePlan` used to block up to **15 s** waiting for the
stream so the enriched plan was the one saved. Against a 28–35 s job that deadline
expired routinely, and the code then saved the bare rule plan — so a trial runner
who tapped promptly silently received an unenriched plan. Harmless while enrichment
always failed (the fallback was the same object); ENRICH-ATTRIB-01 made enrichment
work and turned it into real data loss. Never re-introduce a blocking wait here:
ADR-006 already guarantees the rule plan is complete on its own.

**Consequence for `meta.enrichment`.** A saved plan reads `pending` for ~30 s by
design. Persistent `pending` means the follow-up write never landed:

```sql
select id, created_at, plan_json->'meta'->>'enrichment' as enrichment
from plans
where plan_json->'meta'->>'enrichment' = 'pending'
  and created_at < now() - interval '10 minutes';
```

### Enrichment attribution (ENRICH-ATTRIB-01, 2026-09-03)

The post-enrichment re-validation (PV2-A) reverts the enricher's output when it introduces an
error-severity invariant violation. **"Introduces" is measured against a baseline, not against zero.**

```
baseline  = error-severity violations of the RULE plan, before enrich() runs
introduced = error-severity violations of the ENRICHED plan  minus  baseline
```

A violation is keyed by **code + week + day**, not code alone — the same invariant firing on a
different week is genuinely new and must still revert. Logic lives in `lib/plan/enrichAttribution.ts`
so it is unit-testable without a stream handler (`enrichAttribution.test.ts`).

**Why the baseline is required.** `generateRulePlan` validates its own output, but in production it
only `console.error`s and returns the plan (never break the user); it throws only in dev/test. So the
rule plan reaching the enricher **may already be invalid**, and comparing against zero charges the
engine's violations to the AI. That is not a theoretical risk — it was a 100% failure rate:

> **2026-09-02.** Two trial plans, both stamped `enrichment: "failed"`. Enrichment had in fact
> succeeded — the call returned, parsed, and passed `EnrichedPlanSchema`. The engine's race-week
> branch skipped the `max_weekday_mins` life-first cap, producing a 35-minute weekday shakeout
> against a stated 30-minute limit. The zero-baseline check read that as the enricher's doing and
> discarded the enriched plan. Every trial user who set a weekday time limit was silently downgraded
> to a free-tier plan. Fixed in the same change (`lib/plan/ruleEngine.ts` → `applyWeekdayMinsCap`).

**The structural asymmetry that makes this a bug rather than a judgement call:** `EnrichedWeekSchema`
exposes `label`, `theme` and `coach_notes` and nothing else. No numeric on any session is reachable
from AI output, so a duration or volume violation on an enriched plan is *never* the enricher's doing.
If a future schema change gives the enricher reach over numerics, revisit this.

A rule plan that arrives already invalid now writes its own `plan_rule_invalid` ops row — a separate
and more serious signal than a failed enrichment.

### Plan start
The route computes the **next Monday** from the current date (local-time arithmetic, avoiding UTC
midnight drift) and passes it to the engine. The client does not send a plan start date.

**Changed by GEN-FIX-03 (2026-08-06) — `meta.plan_start` is now a derived output, not the route's
input.** Per CoachingPrinciples §76 the plan is laid out **backwards from race week**: the route's
next-Monday value is the *earliest* the plan could begin, and `calcPlanLength()` anchors the final
week on `race_date` and returns the actual start.

- When more weeks are available than the distance's ideal length, the surplus **delays the start**.
  It is never dropped off the end. Previously `min(available, ideal)` weeks were laid forward from
  the start, so **every plan finished before race day** — 3 to 24 days early across all tested
  personas (analysis F2).
- `meta.plan_start` may therefore be later than the next Monday. The gap between today and
  `plan_start` is already consumed by the foundation block (`classifyGap` /
  `generateFoundationBlock` in `GeneratePlanScreen`), which existed for exactly this case.
- When available weeks are fewer than ideal, the plan starts as early as it can; race week is
  still last.

The race session is placed on the **actual weekday of `race_date`** (§77), and deliberately ignores
`days_cannot_train` — the race is an external fixed event, not a training session. All other
race-week sessions respect blocked days and must fall *before* the race.

Enforced by `INV-PLAN-COVERS-RACE-DATE` and `INV-PLAN-RACE-ON-RACE-DAY` (both error severity).

### Guard rails
Guard rails are checked **before** generation. Invalid inputs never reach the rule engine.

### Primary metric
Determined by rule engine:
- `beginner` → `duration`
- `race_distance_km >= 50` → `duration`
- otherwise → `distance`

---

## Generation modules

| Module | Responsibility |
|--------|---------------|
| `lib/plan/ruleEngine.ts` | Deterministic plan structure — distances, HR, zones, sessions |
| `lib/plan/enrich.ts` | AI coaching voice — labels, themes, coach notes, confidence (trial/paid) |
| `lib/plan/freeIntro.ts` | CA-01 — one-line free first-plan `meta.plan_intro` (Haiku, silent fallback) |
| `lib/plan/generate.ts` | Orchestrator — calls rule engine then enricher |
| `lib/trial.ts` | Auth boundary — `getUserTier()` |
| `lib/plan/foundationBlock.ts` | Foundation Block generator — pre-plan prep weeks. Pure; called by `foundationCompose.ts`, never directly by this route |
| `lib/plan/foundationCompose.ts` | ADR-020 Option A — the single owner of `plan.weeks` mutation post-generation. `composePlanWithFoundation()` classifies the gap, calls `foundationBlock.ts` when appropriate, and re-validates unfiltered. Called by this route AND `POST /api/generate-plan/foundation` |

---

## Plan schema — foundation weeks

**ADR-020 Option A (2026-09-03) — construction moved server-side.** The `Plan.weeks` array may include foundation-phase weeks with `phase: 'foundation'` and `n ≤ 0`. These are now **constructed and validated by this route** (via `composePlanWithFoundation`, `lib/plan/foundationCompose.ts`) before the plan ever reaches the client — not prepended client-side after the fact, as they were before this date. `validatePlan()` sees every week, including foundation ones, in the live path.

- **`'auto'` gap band (7-28 days):** the server adds the block itself; `plan.weeks` already contains it on the initial response.
- **`'choice'` gap band (>28 days):** the server does **not** add a block on the initial response — `meta.foundation_gap_class` is `'choice'` and `plan.weeks` has none. The decision belongs to the runner: the client shows the modal, and on "Add Foundation Block" calls `POST /api/generate-plan/foundation` (`docs/contracts/api/generate-plan-foundation.md`), which composes onto the *existing* plan without re-running the rule engine or AI enrichment.

When a plan with foundation weeks is saved via `savePlanForUser`, they persist in the DB as part of `plan_json`, exactly as before.

Foundation week invariants: `INV-PLAN-FOUNDATION-BLOCK` (see `docs/canonical/plan-invariants.md`). `INV-PLAN-SINGLE-CONSTRUCTION` (architectural, not a per-plan check) names `composePlanWithFoundation` as the sole permitted mutator of `plan.weeks` after generation.

`lib/plan/schema.ts`'s `WeekSchema.n` was relaxed from `.positive()` to a plain integer (CB-2 item 4) — the old constraint declared every foundation week schema-invalid, unenforced only because `PlanSchema` is parsed nowhere in the codebase (still true; only `EnrichedPlanSchema` is ever `.parse`d). `PlanMetaSchema` gained `foundation_gap_class` for the same reason: internal correctness, not new runtime enforcement.
