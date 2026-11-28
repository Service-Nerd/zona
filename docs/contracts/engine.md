# The coaching engine — interface contract

**Component:** `lib/plan/ruleEngine.ts` → `generateRulePlan`

> 🎯 **WHY THIS EXISTS.** The founder intends to lift the coaching engine out of the app and
> host it centrally, so the app calls it as a service, and possibly to monetise it so other
> apps can too. **`docs/contracts/` governs API routes and component props; the engine's own
> interface was governed by nothing** — and it is the one interface that must be written down
> before anything external can call it. `ENGINE-CONTRACT-01`, 2026-10-14.
>
> 🔑 **Writing it found a defect before any code moved** — `PARITY-NO-BENCHMARK-01`, below.
> That is the second time in this repo that writing a contract surfaced one.
>
> 🧭 **TWO VERSIONS, ONE CONTRACT (ADR-027, 2026-11-21).** Every section from *The call* to *What
> this contract does NOT cover* is **v1: the engine as it runs today**. **§ v2** at the end is the
> service contract ADR-027 builds towards; its types are in `lib/engine/contracts/`. Nothing calls
> v2 yet, and v1 stays true until a plan kind is cut over (B4).

---

## The call

```ts
generateRulePlan(
  rawInput: GeneratorInput,
  tier: Tier,                                        // 'free' | 'trial' | 'paid'
  planStart?: string,                                // ISO date; defaults to next Monday
  catalogue: SessionCatalogueRow[] = V1_SESSION_CATALOGUE,
  todayOverride?: string,                            // ISO date; defaults to the wall clock
): Plan
```

**Deterministic given its arguments? No.** See § The clock.

---

## Input — `GeneratorInput`, 33 fields

**6 required**, and the engine cannot run without them:

| Field | Type |
|---|---|
| `race_date` | ISO date |
| `race_distance_km` | number |
| `goal` | `'finish' \| 'time_target'` |
| `current_weekly_km` | number |
| `longest_recent_run_km` | number |
| `days_available` | number |

🔴 **`age` LEFT THIS TABLE ON 2026-11-17 (`MAXHR-AGE-ABSENT-01`, Coaching Board), and it was never
really in it.** The only producer of `input.age` was `GeneratePlanScreen`, which satisfied the
`number` with a hardcoded `: 30` whenever the runner skipped the optional birth-year step — so
**a required field whose only caller always filled it by fabrication, which is an optional field
with a lie in front of it.** 16 of 56 live runners carry no age.

⚠️ **The absence now propagates rather than being priced:** §50's every *"estimate max from age"*
arm declines, and §3's masters cadence resolves to the cautious side. §55 still rejects a PRESENT
age outside 13–90 — absent became valid, nonsense did not.

**27 optional.** Full list and semantics in `types/plan.ts`; it is the source and this contract
does not restate it, because a second copy is how `deloadCadence` started.

⚠️ **Two traps in the optional set, both already paid for:**

- **`fitness_level` is NOT the wizard's answer.** It is an API-level structural override;
  the wizard's selection is `user_declared_level`. `types/plan.ts` says so in as many words,
  and reading the wrong one shipped a telemetry field that was inert from the day it landed
  (`REFUSAL-TELEMETRY-LEVEL-01`): 20 refusal events, **zero** carrying any level.
- **`resting_hr` must be absent, never `0`.** `PlanSchema` has required `.positive()` since
  the day it was written, and `resting_hr: rhr ?? 0` put a zero into ten live plans — a zero
  baseline makes the Karvonen reserve the entire max HR (`PLAN-RESTING-HR-ZERO-01`).

---

## Output — `Plan`, or a thrown refusal

**On success:** a `Plan`, validated against `PlanSchema` (`lib/plan/schema.ts`).

**On a designed refusal: the engine THROWS.** It does not return a refusal object.

🔴 **This is the single most important fact for a hosted engine**, because the naive
HTTP mapping of "threw" is **500**, and a designed refusal is the engine **working**. Four
names, and identification is by `error.name` — which is deliberate, and survives
serialisation across a process boundary where `instanceof` would not:

| `error.name` | Means | Principle |
|---|---|---|
| `PrepTimeError` | not enough weeks before the race | §44 |
| `DaysAvailableError` | not enough days per week | §52 |
| `BaseVolumeError` | base volume too low for the distance | §111 |
| `LongRunReadinessError` | longest recent run too short | §113 |

`isDesignedRefusal(e)` in `lib/plan/designedRefusal.ts` is **the single owner** of
*"was that throw the engine working?"*. **Never match a refusal by its message** — that is a
recorded rule here, and the messages are runner-facing copy that changes.

**The app returns `422` for all four**, never 500. Any future HTTP surface must do the same.

---

## The clock — the engine is NOT a pure function of its arguments

`vdotFor` → `applyVdotDiscount(raw, benchmark, new Date())` reads the **real wall clock**,
not `todayOverride`. `todayOverride` controls plan anchoring; it does **not** control this.

⚠️ **This is deliberate and must not be "fixed".** `ruleEngine.ts:179` argues it: the
staleness ramp measures how long ago the runner *actually ran*, which is a fact about the wall
clock rather than about the plan's anchoring, and changing it *"would reprice every
stale-benchmark plan"*.

**The consequences a hosted service inherits, stated plainly:**

- **Responses cannot be cached by input hash.** The same input returns different paces as the
  benchmark ages.
- **Reproducing a plan for support requires the generation date**, not just the inputs.
- The drift is bounded: +1% per 4 weeks beyond 4, from a 3% base, **capped at 7%** — so a
  benchmark ≥ 16 weeks old is pinned and stable forever.
- An input with **no `benchmark`**, or a benchmark with **no `benchmark_date`**, reads no
  clock at all. `invariants.ts` already asserts the latter.

🔴 **`PARITY-NO-BENCHMARK-01`, found by writing this section.** `verify-parity.ts` had
**never set a benchmark** — zero occurrences across 6,066 cases — so the harness this repo
uses to prove *"my refactor changed nothing"* was **structurally blind to the entire VDOT and
pace path**. Fixed: two clock-stable variants, 6,102 cases, `benchmarkStability.test.ts`
machine-checking the arithmetic.

---

## `tier` — the engine reads it, the caller decides it

`'free' | 'trial' | 'paid'`. `tier` appears 16 times in `ruleEngine.ts` code (comments stripped, re-counted
2026-11-21; this line said "28 places" with no method), and the catalogue gate
(`tier !== 'free' || row.is_free_tier`) decides which rows are selectable: 4 of 31 catalogue rows are
paid-only.

⚠️ **Resolving the tier is NOT the engine's job and must not move inside it.** ADR-003 makes
the API route the auth boundary, and `lib/trial.ts → resolveTier` is the single owner of the
order `admin → subscription → charity grant → trial → free`. A hosted engine takes `tier` as
an argument from an authenticated caller; it never looks a user up.

---

## `catalogue` — a default argument, and that is a constraint

`catalogue: SessionCatalogueRow[] = V1_SESSION_CATALOGUE`.

⚠️ **A default argument hides an unwired parameter** — a recorded failure class here. Today
the default means the catalogue version is baked in at import time and a caller cannot ask for
a different one. **That is fine for one consumer and is a versioning problem for a service**:
two callers on different catalogue versions is the first thing an external API will need and
the first thing this signature cannot express.

---

## 📌 Where the extraction stands — 2026-10-14

| Part | State |
|---|---|
| **1 · `ENGINE-PURITY-GATE-01`** — the engine may not import the app | ✅ `05fa327e`. Parity IDENTICAL, 6,066 cases |
| **2 · `ENGINE-ENTRY-01`** — one entry point instead of 18 route imports | ✅ `2026-10-15`. **18 → 7**, route 806 → 605 lines. Parity IDENTICAL |
| **2b · `ADJUST-ENGINE-ENTRY-01`** — the same, for the adaptive engine | ✅ `2026-10-15`. **14 → 5** (`adjust-plan` 601 → 438 lines) |
| **3 · `ENGINE-CONTRACT-01`** — this document | ✅ `cc1d11b9`, 7 arms, 5 falsified |
| *(found en route)* **`PARITY-NO-BENCHMARK-01`** | ✅ `58135cf9`. Grid 6,066 → 6,102 |
| **ADR-027 B1 · `ADR027-B1-CONTRACTS`** — the v2 contract, types, v1↔v2 adapter, read model | ✅ 2026-11-21. See § v2 |

**Nothing a runner sees has changed.** Proven twice by `verify:parity`.

🔑 **The architect's position, recorded so it is not relitigated: do NOT extract yet.** A
service today buys a network hop on a path where enrichment takes 28–35 s, a second deploy
target, API versioning and a new failure mode — for **zero functional gain until a second
consumer exists**. These parts make the day-it-is-real a weekend rather than a rebuild.

⚠️ **Monetisation is an SLT question, not an architectural one** (uptime commitments,
versioning you cannot break, third-party auth, support), and the seat that would price it —
Traynor's — **is stood down**, so nobody at that table asks *"what is the traffic?"* at 48 users.

---

## What a service boundary would still need

Named so the work is visible rather than discovered later:

1. **Refusals over the wire** — `error.name` → status + body, never 500.
2. **Catalogue versioning** — see above.
3. **The clock** — either accept a `now` argument or publish the generation date with the plan.
4. **An outbound dependency**: `freeIntro` and `enrich` call Anthropic. A hosted engine carries
   a model dependency and a per-call cost, which is a commercial fact, not an architectural one.
5. ~~**`ENGINE-ENTRY-01`**~~ — ✅ **DONE 2026-10-15.** `app/api/generate-plan` imported
   **eighteen** engine modules and sequenced them itself, so the **route** was the
   orchestrator and extracting would have made all eighteen public API. It now imports
   **eight** engine modules — `lib/plan/engine.ts` plus the seven the caller legitimately
   owns — and `adjust-plan` **five**, behind `lib/coaching/adjustmentEngine.ts`. The eighth
   (2026-10-24, `NO-RUNNER-TURNED-AWAY-01`) is `fetchWeeklyLoad`, the activity-log **read** the
   base-build checkpoint needs: IO, so the caller's; the decision it feeds,
   `evaluateCheckpoint(input, stored, loads, units, planStart?, choice?)`, is behind the engine's door. It returns the
   race-block input, an `extend` plan, or a 422 consent body with engine-verified `options`; `choice`
   (`extend` | `run_walk` | `half`) is honoured only when it was on offer. Which refusals are staged is one decision,
   `stagingDoorKm(err, input, planStart)` in `stagedRacePlan.ts`, shared with `measure:envelope`.

   ⚠️ **IT IS 18 → 7, NOT THE 18 → 1 THE ITEM ASKED FOR, because 1 contradicts this
   document.** Five of the eighteen (`enrich`, `enrichAttribution`, `enrichPartialRevert` (since 2026-10-28 reached through
   `enrichRepair`, the one owner of the copy-repair ladder, ENRICH-RESTORE-REPAIR-01),
   `enrichServerSave`, `freeIntro`) are assigned to the caller by § *What this contract does
   NOT cover*, and `freeIntro` calls Anthropic; `canGenerateDistance` is a commercial gate at
   the auth boundary (403, not 422). Collapsing those would drag the AI layer and persistence
   inside the engine, which `ENGINE-PURITY-GATE-01` exists to forbid.

   🔴 **AND THIS LINE SAID "`adjust-plan` TEN" WHILE THE REAL FIGURE WAS FOURTEEN**, for as
   long as this contract has existed. `engineContract.test.ts` had an arm for the eighteen and
   **none for the ten** — and its reader was `from '@/lib/plan/([a-zA-Z]+)'`, which matches
   `@/lib/plan/` only. **Nine of adjust-plan's fourteen are `@/lib/coaching/*`**, so they were
   invisible to the gate written to protect the claim beside them. Both routes are counted now,
   by one shared reader that sees both directories and nested paths.

6. ~~**`ADJUST-ENGINE-ENTRY-01`**~~ — ✅ **DONE 2026-10-15.** `app/api/adjust-plan` was the
   last route in the same shape: **fourteen** engine modules, sequenced by the handler.
   `lib/coaching/adjustmentEngine.ts → runAdjustmentEngine()` now owns the synchronous
   path — row→signal assembly, the trigger stack, §69 magnitude, the prospective plan and
   the constitutional re-validation — and returns
   `{ kind: 'none' } | { kind: 'adjustment', … }`. `acceptAiSummary` is the second export,
   and the asymmetry it encodes is the one decision in this item that could **not** be
   copied from generate-plan:

   | | assigned to | why |
   |---|---|---|
   | `buildAdjustmentExplanationPrompt`, `buildAthleteContext` | **caller** | they take `units` and assemble runner-facing voice for a model the engine may not call. ADR-006 makes the pass silent, so its failure must not be an engine outcome |
   | `validateSummaryAgainstDiff` (via `acceptAiSummary`) | **engine** | it asks *"does this prose contradict what I changed?"*, and the engine is the only thing holding the diff. A hosted engine that withheld it would make every consumer re-derive it |

   So: **`adjust-plan` six**, and **seven counting the `@/lib/plan` barrel**.

   ⚠️ **IT WAS FIVE UNTIL 2026-11-10, AND THE SIXTH IS DECLARED RATHER THAN ABSORBED**
   (`ADJUST-LEDGER-DUPLICATE-01`). `lib/coaching/adjustmentLedger.ts` → `duplicateOf` +
   `CAPPED_STATUSES` is assigned to the **caller** by the same rule as the two prompt builders:
   it decides whether the route WRITES a ledger row, which is persistence, and the engine holds
   no opinion about the ledger at all. ⚠️ The honest alternative was to hide it in a module the
   counter does not read (`lib/ops/*`, `lib/supabase/*`), which would have kept the headline at
   five and is exactly the behaviour this count exists to prevent. **The gate made the growth
   state itself, which is what it is for.**

   🔴 **THE COUNT'S READER HAD A FOURTH HOLE AND THIS FOUND IT.** `from '@/lib/plan'` — the
   barrel, `lib/plan.ts` — needs no trailing slash, so `getCurrentWeekIndex` and
   `savePlanForUser` had been reaching the route unseen for as long as the gate existed.
   It is counted **separately**, not folded in, because `lib/plan.ts` imports
   `@supabase/supabase-js` and sits **outside** `enginePurity`'s glob (`lib/plan/**`, not
   `lib/plan.ts`): it re-exports engine leaves *and* owns persistence, so calling it an
   engine module would be as wrong as ignoring it. Both figures are asserted, and the
   barrel arm pins the symbol set so a third cannot join it silently.

   ⚠️ **`verify:parity` IS BLIND TO THIS PART ENTIRELY — more so than to part 2.** It calls
   `generateRulePlan` and never `checkAdjustmentTriggers`, `computeReshapeMagnitude` or
   `runAdjustmentEngine`: **zero occurrences**. IDENTICAL over 6,102 cases says the plan
   generator was not disturbed and says **nothing** about the adaptive engine. The evidence
   here is carried by the gates that stopped grepping the route and started calling the
   function.

## What this contract does NOT cover

`enrich` (the AI layer, ADR-006 — silent fallback by design), persistence, and the
`waitUntil` background chain. Those are the **caller's**, and `ENGINE-PURITY-GATE-01` exists
to keep them there.

---

## v2: the engine as a service (ADR-027, B1)

**Status (2026-11-21, `ADR027-B1-CONTRACTS`):** contract written; types and schemas in
`lib/engine/contracts/`; the v1↔v2 plan adapter and the plan read model exist. **No producer and no
consumer uses them yet**, except `RunnerProfile`, which `runEngine` builds and reads since B2
(`ADR027-B2-PROFILE`, § L1 below). `runEngine` stays the entry (ADR-027 v1.1 § Reuse) and every v1 section above
is still what runs. The engine's prescription code is frozen; nothing here changes what a plan contains.

| File | Owns |
|---|---|
| `lib/engine/contracts/result.ts` | operations, the `plans.create` request, `EngineResult`, refusal codes, HTTP mapping |
| `lib/engine/contracts/profile.ts` | `RunnerProfile` v2, `Fact`, `WeekCapacity` (built by L1 since B2; § L1 below) |
| `lib/engine/contracts/facts.ts` | `RunnerFacts`, `ObservedAggregates`, `ResolvedAsOf`, the `AssembleRunnerFacts` type (B2) |
| `lib/engine/profile/` | L1: `buildRunnerProfile`, `factsFromInput`, `aggregateObserved`, `resolveAsOf`, validity bounds (B2) |
| `lib/engine/contracts/rule.ts` | `Rule` (Zod, strict), `resolveRuleConfigKey` |
| `lib/engine/catalogue/rules.ts` | `RULES`: L2, one entry per check (171 `INV-` + 50 `S-`, B3 step 1). `principle_ref` may also be `ADR-0nn` or `structural` (2 named rules); `related_refs` gathers every registry row's §; `explain` is null until B5; `config_key` is null on every INV rule until step 2 reads it from the check's code; `severity_note` keeps a conditional severity. `catalogue.test.ts` fails on a check with no rule, a rule with no check, a §, amendment or ADR that does not resolve (6 amendments named as debt), a kind that disagrees with `plan-invariants.md`, or an INV rule claiming a config key. Read by nothing yet |
| `lib/engine/contracts/decision.ts` | `Decision`, `Lever`, `Finding` (Zod), `findingFromViolation` |
| `lib/engine/contracts/planV2.ts` | Plan v2 (strict Zod), built by extending `lib/plan/schema.ts` |
| `lib/engine/contracts/planV1V2.ts` | `toV2`, `toV1`, `parsePlanV2` |
| `lib/engine/planner/composeBlocks.ts` | **L3: the block planner** — `composeBlocks`, the single owner of a race plan's phase table and of §97's `shortOnRamp` predicate (B4a; § L3 below) and `getPhaseForWeek`, the phase table's reader, moved in B4b |
| `lib/engine/planner/composeWeekVolumes.ts` | **L3: the week planner** — `composeWeekVolumes`, the single owner of each week's km: ramp, deloads, §2's cap and its injury tightening, the bounceback, the peak clamp, the taper step-down and §31's `compressed` verdict (B4b; § L3 below) |
| `lib/engine/readModel.ts` | typed plan accessors (ARCH-ENG-010) |

`lib/engine` is inside `ENGINE-PURITY-GATE-01`'s population: it may not import `next/`, `react`,
`@/app/`, `@/components/` or `@supabase/`.

### Operations

| Operation | Today's function | v2 response |
|---|---|---|
| `plans.create` | `runEngine` | `EngineResult` (below) |
| `plans.adapt` | `runAdjustmentEngine` | a proposed plan, its diff and its ADR-012 magnitude; the app decides whether to auto-apply or confirm |
| `checkpoint.evaluate` | `evaluateCheckpoint` | `EngineResult`; the two checkpoint refusals are codes |
| `strength.create` | `generateStrengthPlan` (`packages/strength`) | `EngineResult` over a strength plan (B6) |

Only `plans.create` has a request schema in B1 (`PlansCreateRequestSchema`). The other three get theirs in
the B-phase that serves them (B4 adapt, B6 strength); their shape is fixed here so it is not invented then.

### Request (`plans.create`)

```ts
{
  operation: 'plans.create',
  as_of: 'YYYY-MM-DD',          // REQUIRED. The date the request is evaluated at (ARCH-ENG-005)
  engine_version?: string,      // pin; an unserved version is invalid_input on `engine_version`
  input: GeneratorInput,        // strict: the 33 fields, nothing else
  options: {
    plan_start?: 'YYYY-MM-DD',  // default: the Monday after as_of
    accept_base_build?: boolean,
    acknowledged_days_warning?: boolean,
    display_units: 'km' | 'mi', // ADR-015: the caller reads the runner's units
  },
}
```

- **No `tier`.** The engine is tier-blind in v2 (ADR-027 v1.1, ADR-003). ⚠️ Today it is not: it takes
  `tier`, and 4 of 31 catalogue rows are paid-only. The HLD measured 0 output differences in 300 plans; that
  is a sample, not a proof, and removing the argument is a B4 cut-over decision measured on the scorecard.
- `input` becomes a `RunnerProfile` in L1 (B2, § L1 below). Since `ADR027-B2-PROFILE` `runEngine` builds
  one from the request alone and reads its levels, effective start km and both weeks-to-race counters from
  it. The remaining derivations (`effectiveBaseline`, `recommendFitnessLevel`, `validatePrepTime` and the
  call sites inside the producers) are `ADR027-B2B-PROFILE-ADOPTION`.
- `plan_start` and `acknowledged_days_warning` are **options, not input fields**. Today
  `acknowledged_days_warning` lives on `inputs.ts`'s internal type, and `plan_start` appears inside
  `meta.generator_input` on 29 of 123 stored rows and inside some `cohortGrid` rows.

### Response: a typed result, never a throw (ARCH-ENG-006)

| Variant | Fields |
|---|---|
| ok | `{ ok: true, plan: PlanV2, decisions: Decision[], findings: Finding[], stamps }`. `findings` holds `warn` only: a plan with an `error` finding never leaves the service |
| refused | `{ ok: false, refused: true, code, reason, levers: Lever[], offer?, requires_acknowledgment? }`. `reason` is runner-facing display copy and is never matched; `offer` is §118's get-running or staged plan, so no refusal is a dead end |
| invalid input | `{ ok: false, invalid_input: true, field, why }` |

An **engine fault** is not a result. It is a 500, and it emits a finding `engine_fault` carrying the
input hash.

### Refusal codes

| Today | v2 `code` | § | Levers |
|---|---|---|---|
| `PrepTimeError` | `prep_time` | §44 | `race_date` later; `acknowledged_prep_warning` on the warn tier |
| `DaysAvailableError` | `days_available` | §52 | `days_available` increase; `acknowledged_days_warning` on the warn tier |
| `BaseVolumeError` | `base_volume` | §111 | `accept_base_build`; `race_date` later; `current_weekly_km` |
| `LongRunReadinessError` | `long_run_readiness` | §113 | `accept_base_build`; `longest_recent_run_km` |
| `evaluateCheckpoint` → `reason: 'checkpoint_no_base_build'` (409) | `checkpoint_no_base_build` | §116 Am. 9 | none: the stored plan is not a base build |
| `evaluateCheckpoint` → `reason: 'checkpoint_no_runs'` | `checkpoint_no_runs` | §116 Am. 9 | connect a health source; a later race |
| `InputFieldError` | not a refusal: `invalid_input`, `field` = `InputFieldError.field` | §55 | |

`REFUSAL_CODE_BY_ERROR_NAME` in `result.ts` is the map; `contracts.test.ts` fails if it stops covering
exactly `DESIGNED_REFUSAL_ERROR_NAMES`, or if a code there is missing from this table.

### HTTP mapping

| Result | Status |
|---|---|
| ok | 200 |
| refused | 422 (`checkpoint_no_base_build`: 409, a state conflict, as today) |
| invalid input | 400 |
| engine fault | 500 + an `engine_fault` finding |

⚠️ **400 for invalid input is a change, and it applies to the v2 endpoint only.** Today's
`/api/generate-plan` answers 422 for `InputFieldError` and keeps doing so; the client renders that 422.
Nothing moves until B7 puts the route behind the v2 contract.

### Versioning: four stamps on every plan the v2 engine builds

| Stamp | Meaning |
|---|---|
| `engine_version` | the planner build that made the plan |
| `rules_version` | a hash of the L2 rule catalogue (B3). The nightly verifier uses it to tell *"defect at creation"* from *"a rule changed since"*, so a doctrine change never reads as a regression |
| `as_of` | the request's evaluation date |
| `input_hash` | a hash of the validated request: `input`, `options` and `as_of` |

In Plan v2 they are the top-level `stamps`. Inside a v1 `plan_json` they travel as `meta.engine_stamps`, so
a v2-built plan stored through `savePlanForUser` keeps them. **A plan the current engine built has no
stamps**: `toV2` writes no `stamps` key and `planStamps(plan).engine` is `null`. Today's provenance fields
(`generated_at`, `generator_version`, `tier`, `enrichment`) are unchanged and read through the same accessor.

### Determinism (ARCH-ENG-005)

**Rule:** the same request, `as_of` included, returns the same plan apart from stamps. The engine reads no
wall clock.

**Today it does, in 16 places.** Measured 2026-11-21 over non-test `lib/plan`, `lib/engine`,
`packages/strength` and `lib/coaching/adjustmentEngine.ts`, comments stripped, pattern
`new Date()` / `Date.now()`. They are the known violations, held by a ratchet
(`lib/engine/contracts/determinism.test.ts`): a new one fails the build, a removed one must lower the baseline.

| Site | Kind | Note |
|---|---|---|
| `ruleEngine.ts` `vdotFor(input, now = new Date())` | **hard** in generation | the § The clock leak above. Since B2 the instant is a parameter; generation still omits it, L1 always passes `as_of` |
| `ruleEngine.ts` `applyRecalibration` → `applyVdotDiscount(…, new Date())` | **hard** | the same leak on the recalibration path |
| `weekResolution.ts` `getCurrentWeek` | **hard** | read side, not generation |
| `ruleEngine.ts` `buildRulePlanOnce` `todayOverride ?? new Date()` | default | pinned when the caller passes `today` |
| `engine.ts` `runEngine` `req.today ?? new Date()` | default | |
| `length.ts` `nextMonday(from = new Date())` | default | `planStart` defaults through it |
| `inputs.ts` `assertPlausibleBenchmark(today = new Date())`, `benchmarkCheck.ts`, `hrSaveResolution.ts`, `supersede.ts`, `slowGoalGrid.ts` | default | one each |
| `adjustmentEngine.ts` `req.now ?? new Date()` | default | twice |
| `ruleEngine.ts` `generated_at`, `baseBuildOnRamp.ts` `last_updated`, `taperRecalibration.ts` `taper_recalibrated_at` | stamp | a timestamp written into the plan |

A *default* is a hard read wherever a caller omits the argument; the only production caller of `runEngine`
omits `today`.

⚠️ **This does not contradict § The clock's "must not be fixed".** That section forbids changing what the
staleness ramp measures (how long ago the runner actually ran). ARCH-ENG-005 keeps the measure and moves
the read: in production `as_of` is today's date, so the price is the same, and it becomes an argument a
support reproduction can pin. Not built in B1 (the engine is frozen); it belongs to L1 in B2.

### L1: `RunnerFacts` and `RunnerProfile` v2 (B2, `ADR027-B2-PROFILE`)

ADR-027 v1.2 (ARCH-ENG-013/014/019) and the data dictionary (`docs/architecture/data-dictionary-runner-facts-2026-11-21.md` § 3 A–F).

**Two pure pieces and one fetcher:**

| Piece | Where | Pure? |
|---|---|---|
| `RunnerFacts` (input + `user_settings` row + observed aggregates) | `lib/engine/contracts/facts.ts` | type |
| `buildRunnerProfile(facts, { asOf, timezone, planStart? })` → `RunnerProfile` | `lib/engine/profile/buildRunnerProfile.ts` | yes: no clock, no I/O, never throws |
| `runEngine({ ..., facts? })`: `facts` is the route's `fetchRunnerFacts` result (B2b part 1). Absent means the request alone. Re-pinned to the request's `input`; its timezone resolves `as_of`. Carried only: no planner reads it before B4 | `lib/plan/engine.ts` | yes: the facts are data, read before the call |
| `aggregateObserved(rows, frame)` (windows, dedupe, validity) | `lib/engine/profile/observed.ts` | yes |
| `resolveAsOf(instant, timezone)` | `lib/engine/profile/asOf.ts` | yes |
| `fetchRunnerFacts(db, userId, input, now)` (implements `AssembleRunnerFacts`) | `lib/supabase/fetchRunnerFacts.ts` | **no**: reads `user_settings`, `strava_activities`, `health_daily_samples`, `session_completions`, `run_analysis`; outside the purity gate |

**Profile v2 rules:**
- Every runner fact is `{ value, source }` or `null`. Precedence `observed` > `confirmed` (a value saved in
  Profile) > `stated` (posted with the request) > `derived` (computed by an owner). A client-computed value
  in the request is `stated`.
- **Derived fields delegate**: levels → `derivedLevelsFor`; VDOT → `vdotFor`; effective start →
  `effectiveStartKm`; weeks → `weeksBetweenLocal` (`weeks_to_race.plan`) and `weeksUntilRaceSigned`
  (`weeks_to_race.display`, the telemetry counter, kept separate); blocked days → `normaliseDays`; easy pace
  for `capacity` → `buildPaceFromVDOT` / `buildFallbackPace`. They are computed from the request exactly as
  the engine sees it.
- **Age has one owner**: `user_settings.birth_year` (age at `as_of`'s year), else `date_of_birth`, else the
  posted `age`. Resting HR: observed 7-day median > settings > request. Max HR: settings (its
  `max_hr_source` decides observed or confirmed) > request.
- **Validity bounds** (`lib/engine/profile/validity.ts`) turn an out-of-range carried value into `null` and
  list it in `data_quality.nulled`. They are data-quality bounds, not coaching numerics; physiology reuses
  §55's `INPUT_FIELD_RANGES`. A benchmark whose `time` is not a string is treated as absent, because
  `vdotFor` throws on it.
- **`as_of`** is resolved in the runner's IANA zone; unset, invalid or `UTC` gives `timezone_known: false`
  and the server's local date (what the engine used before L1).
- **`observed`** is CARRIED and read by no planner. 28-day window: logged km, longest run, run count, log
  coverage days, RHR 7-day median, latest max HR, RPE halves, fatigue counts, latest EF trend.
  **Prescribing from it is a pending Coaching Board ruling.**
- **`schedule.capacity`** (minutes per day from `day_budgets` / `max_weekday_mins`; km at the easy pace) is
  new and read by nothing yet.

**Readers today:** `runEngine` (levels, `volume.effective_start_km`, `weeks_to_race.plan`,
`weeks_to_race.display`), built with the route's facts when `/api/generate-plan` read them (B2b part 1) or
`factsFromInput(input)`, `asOf: <its one clock read>`; and **the L5 verifier** (`lib/engine/verifier`, watch-only),
which reads `levels.intensity` and `race.goal`. **`race.goal` is `coherentGoal`'s normalised goal** (a time
target with no time is a finish goal) and `race.goal_stated` is the request's (B3, 2026-11-21); a goal-dependent
check reads `race.goal`, never the raw input. ⚠️ `asOf` is the wall clock even when a caller pins `today`, because the refusal
telemetry it replaced measured the staleness ramp and `weeksUntilRaceSigned` to the wall clock.
`fetchRunnerFacts` is called by `/api/generate-plan` (B2b part 1). Gate: `lib/engine/profile/buildRunnerProfile.test.ts`
(equivalence over the golden corpus and a strided `cohortGrid` sample, as_of determinism, absence, purity),
`observed.test.ts`, `lib/supabase/fetchRunnerFacts.test.ts`.

### Plan v2

`PlanV2Schema` is **strict at every level**: top, meta, `generator_input`, week, session, phase, pre-plan
(the one opening is `v1_carry`, below).
It extends the v1 Zod objects rather than being a third schema, and `planV2.test.ts` fails if any field of
`PlanMeta`, `Session`, `Week`, `RaceResult` or `GeneratorInput` in `types/plan.ts` is not declared.

| | v1 Zod | TS type | v2 |
|---|---|---|---|
| meta keys | 61 | 118 | **144** |
| session keys | 24 | 28 | 28 |
| week keys | 18 | 18 | 18 (`badge` widened; see below) |
| `GeneratorInput` | none | 33 | 33 (+ `plan_start`, `acknowledged_days_warning` on the stored copy) |

The 83 meta keys v2 adds: **57** on `PlanMeta` but missing from `PlanMetaSchema`; **9** written only through
casts (the inventory counted 8 and missed `onramp_profile`, added 2026-11-21); **16** `GeneratorInput` keys
that `generateBaseBuildPlan`'s `...input` spread puts into a base-build plan's meta (one is
`accept_base_build`, a request-body field); and `engine_stamps`.

**Stored values v1's schema rejects, declared because they are stored** (production, 2026-11-21): `athlete`
absent on 2 live base-build plans; `handle`/`charity` `null` on 3 rows; `resting_hr: 0` on 7 archive rows
(the read model's `restingHr` returns null for it); `badge: 'key_session'` on 2 weeks of 1 archive row. 13 of 123
stored rows fail v1 `PlanSchema` today (2 + 1 live, 7 + 2 + 1 archive), each for exactly one of these;
123 of 123 parse as v2.

**One stored field is carried, not declared.** `week.race_notes` is on one week of 118 of 123 stored rows,
and RACE-NOTES-INERT-01 (Design Board, 2026-11-16) is held by `raceNotesRetired.test.ts`, which fails if any
file declares or reads it. So v2 does not declare it: `toV2` moves any week key v2 does not declare into the
opaque top-level `v1_carry`, and `toV1` puts it back. `carriedWeekKeys(plan)` names what was carried
(production: `race_notes` and nothing else), and `planV1V2.test.ts` asserts the engine's own plans carry
nothing, so a producer cannot hide a new field there.

**The adapter** (`planV1V2.ts`) is lossless and pure: v2 adds `schema_version: 2`, lifts
`meta.engine_stamps` to `stamps`, and carries undeclared week keys in `v1_carry`. Neither function parses; `parsePlanV2` validates separately, so *"the
adapter lost a field"* and *"the plan is not valid v2"* are different failures.

**The read model** (`readModel.ts`): `metaNotes` (the 16 `*_note` fields), `loadResidual` (the gate
`planRationaleNotes` applies), `planStamps`, `generatorInput`, `planKind`, `baseBuildFacts` (the keys read
through casts today), `restingHr`, `asPlanV2`. Each takes a v1 or a v2 plan. No consumer is migrated yet
(B4/B5); the gate that bans raw `plan.meta.<key>` reads lands with that migration.

### L2: the rule catalogue, its check parameters, the event vocabulary and the trigger catalogue (B3 steps 1, 2b D2/D3 and 4)

**What L2 is:** everything the engine BELIEVES, as data. No predicate, no clock, no I/O. ARCH-ENG-001 —
layers depend downward only — so **no module here may import `lib/coaching/` or `lib/plan/`**, and that
constraint is why two vocabularies moved rather than being imported from where they grew.

| Piece | Where | Pure? |
|---|---|---|
| `RULES` — the rule catalogue, **221 entries** | `lib/engine/catalogue/rules.ts` | data |
| `RuleSchema` / `Rule` / `RuleId` — the row shape, `z.strictObject` | `lib/engine/contracts/rule.ts` | type |
| `rulesSkippedBy(policy)` — the rules a caller's strictness exempts | `lib/engine/catalogue/rules.ts` | yes |
| `RUN_EVENTS` + `TRIGGER_EVALUATION_EVENTS` — the three run events | `lib/engine/contracts/events.ts` | data |
| `RUN_UNMATCHED_REASONS` — why a run produced no read | `lib/engine/contracts/runOutcome.ts` | data |
| `TRIGGER_TYPES` / `DETECTED_TRIGGER_TYPES` — the adjustment trigger vocabulary | `lib/engine/contracts/triggers.ts` | data |
| `TRIGGER_RULES` + `triggersFor(event)` — the ARCH-ENG-018 trigger catalogue | `lib/engine/catalogue/triggers.ts` | yes |
| `CHECK_PARAMS` + `checkParam(rule, name)` — a rule's own check parameters | `lib/engine/catalogue/checkParams.ts` | yes: throws on a missing parameter |

**The rule catalogue.** A row carries `id`, `principle_ref`, optional `related_refs`, `scope`, `kind`
(`hard` / `soft` / `prefer`), `config_key`, `explain`, optional `severity_note` and optional `skipped_by`.

- **A rule references its numeric and never copies it** (ARCH-ENG-003). `config_key` is a
  `{ object, path }` reference and `resolveRuleConfigKey` proves the key exists in the object it names.
  `explain` and `severity_note` are both refused by the schema if they contain a value: numbers reach copy
  through an L4 `{placeholder}` filled from a Decision.
- **`explain` is `null` on every row today, deliberately.** Explanations are B5's job on the founder's copy
  delegation; 221 placeholder sentences written at B3 would be invented copy.
- **`kind` sets severity, `severity_note` keeps a condition the registry states conditionally.** `soft` →
  `warn`, everything else → `error`; a rule whose registry row says *"error, OR warn on maintenance plans"*
  carries the stricter reading in `kind` and the condition in `severity_note` until its predicate is ported.
- 🔑 **`skipped_by` IS THE ONE LIST, and `lib/plan/invariants.ts` DERIVES `RESHAPE_SKIP_INVARIANTS` from it.**
  Strictness is a CALLER's policy, not a rule's — already settled in `validateStoredPlan.ts`, which runs one
  dispatch under three callers. Two lists with a human between them is the shape this repo keeps paying for:
  the verifier's first live shadow run read **6 of its 8 flagged plans off exactly that gap**.

📐 **221 = 171 `INV-` + 50 `S-`, AND THE DECOMPOSITION MATTERS BECAUSE TWO MODULES VERIFY THEM.**
Measured 2026-11-27. **`PORTED_RULES` is 162, all `INV-`** — the 50 strength rules are named in
`verifyStrength.ts`, a separate entry point that does not feed `PORTED_RULES`. ⚠️ **So ADR-027's
*"212 of 221 ported"* is a SUM OVER BOTH MODULES** (162 + 50), and the 9 held rules are
`171 − 162`, not `221 − 212` applied to `PORTED_RULES`. Reasoning from `PORTED_RULES` against the 221
denominator gives **59 held**, which is wrong, and `heldRules.test.ts` derives the real list as
`RULES` INV ids minus `PORTED_RULES`. **Cite the family with the number.**
⏱️ **157 → 159 → 162 on 2026-11-27.** Batch 39: `DELIVERED-RAMP` and `TAPER-DELIVERED-DEPTH` left
the held list once their stated reason was re-derived — both "planner" helpers are `invariants.ts`'s
own locals. Batch 40: §28's `STRIDES-PRESENT`, `STRIDES-NO-CARRIER` and `BEGINNER-NEUROMUSCULAR`,
unblocked by a founder decision allowing two CLASSIFIERS from `neuromuscular.ts` by name — the same
class as `hasInjuryKeyword`, already allowed. **Keep this ledger current with the paragraph above:
code review found it stopped at 159 while the text published 162.** ⚠️ **This section published 157 and 14 while ADR-027 said 159 and 12 for part of that
commit**, which is the two-registers-with-a-human-between shape; `engineContractV2.test.ts` pins
these figures so the two cannot drift again.

**The event vocabulary.** Three events in the order a run passes through them — `run_arrived`,
`run_logged`, `run_analysed` — each carrying `evaluates_triggers` and the ruling that set it.

- **Only two evaluate triggers, and that is a RULING, not a preference** (Coaching Board 2026-11-21,
  sitting `docs/decisions/boards-2026-11-21-triggers-on-run-arrival.md`, register row in
  `coaching-rulings.md`). `run_arrived` does not: *"the evaluation event is `run_analysed`, never raw
  ingest."* The flag is DATA rather than a convention each call site remembers.
- ⚠️ **ADR-027 cites this as "§124 Amendment 1" and no such amendment exists** (verified 2026-11-26).
  The ruling is real and enforceable from the register; the principle artifact is owed as
  `S124-TRIGGER-ARRIVAL-AMENDMENT-01`. **Cite the sitting, never the amendment.**
- `run_arrived` carries `{ outcome: 'linked' | 'unmatched', reason? }`, with `reason` **required when
  unmatched and absent when linked, expressed in the type** — "unmatched with no reason" is absence written
  as a value. The reason vocabulary is read from `runOutcome.ts`; `lib/coaching/autoAnalyse.ts` re-exports
  the same object, so there is one definition and `engineTruths.test.ts` asserts **object identity**.
- 🔴 **NOTHING EMITS AN EVENT.** The names had **zero occurrences** in code before `events.ts` existed, so
  this is a first definition and not a migration. Raising `run_arrived` from the ingest route changes a
  production path and belongs to 4c / B4b.

**The trigger catalogue.** One `TRIGGER_RULES` row per trigger type: `evaluates_on`, `threshold_keys`
(symbol names), `raises`, `detected`.

- **Ten types, eight of which we DETECT.** The other two — `skip_with_reason`, `session_reorder` — are the
  runner telling us. ⚠️ **The honest count of things the product watches for is 8, not 10**
  (`ADJUST-TRIGGER-MANUAL-DEAD-01`: a dead union member became a marketing claim).
- **`threshold_keys` names SYMBOLS, never values**, resolved against `lib/coaching/constants.ts` by the gate.
  🔻 **The check is named→exists, NOT exists→named**, so an INCOMPLETE row passes; the reverse needs parsing
  the detector. Every DETECTED row must name at least one symbol, per row and not in aggregate.
- **`evaluates_on` is `never_on_arrival`, `week_close`, or a non-empty list of events** — the first two are
  ruled values and the array form is typed non-empty so an empty list cannot express them.
- 🔑 **IT HOLDS NO CONDITIONS AND NO PRIORITY ORDER, DELIBERATELY.** `lib/coaching/planAdjustment.ts` owns
  the predicates and `lib/coaching/triggerInputs.ts` is already a declared reflection of what feeds each
  one, so a third representation was the risk. The ORDER is real and load-bearing (an if-chain with early
  returns) and `triggerInputs.test.ts` **observes** it by peeling — fire, neutralise the winner, fire again.
  **The one thing most likely to drift is the one thing this layer does not copy.**
- 🔻 **Nothing evaluates it.** Wiring evaluation onto data arrival is `TRIGGERS-ON-DATA-ARRIVAL-01`, parked
  by founder decision because ARCH-ENG-018 routes its thresholds to the Coaching Board and its FREQUENCY to
  Design and the SLT.

**The check parameters** (D2/D3, Coaching Board 2026-11-22: *"tolerances become the rule's parameters in
the catalogue; row lists become a row attribute, not a list in the checker"*). One `CHECK_PARAMS` entry per
rule, holding the numbers that rule reads, plus a `note` opening `slack` or `prescription`.

- 🔑 **THEY ARE HERE AND NOT IN `GENERATION_CONFIG`, AND THE REASON IS A WRITTEN DISAGREEMENT.**
  `invariants.ts` carried the opposite argument in two places, citing CLAUDE.md's own tunability test:
  *"Enforcement tolerance (inline, not a coaching numeric — it tunes what the CHECKER flags, not what the
  engine prescribes)."* The sitting's conflict scan named only the no-benchmark paces, so it never saw that.
  Both halves hold: a tolerance is not a prescription, **and** a number written out three times with nothing
  holding the copies equal is a defect wherever it lives. The fix is ownership in the layer that reads it.
  A `GENERATION_CONFIG` key would also owe a `CoachingPrinciples` § per number (`configPrincipleSync` fails
  a new key without one), which is doctrine authoring rather than the naming the sitting ruled, against its
  own *"No value changes"* condition.
- **`slack` tunes what the checker flags; `prescription` is doctrine with no § yet.** Two entries are
  prescription — §85's over-under band and §30's shakeout RPE — and they are the set the board may adopt
  into config with a §. The gate asserts every note declares one or the other, so the two never blur.
- **A missing parameter THROWS.** A silent `0` turns every rounding artefact into a finding and a silent
  `Infinity` turns the rule off; both read as the rule working. Absence is never a value.
- 🔻 **Not a general home for every literal in a checker.** One entry per number the sitting named, and the
  gate refuses a parameter neither checker reads — the decorative-config class, three times paid for.

**The row attributes** (the other half of D3). `sized_from_steps`, `continuous_vo2` and `float_is_run` on
`SessionCatalogueRow` replace three `new Set([...])` written out in two or three modules at once.

- 🔴 **The fixed-shape list had TWO memberships: the producer's four rows against both checkers' two.** Two
  board rulings put `hm_pace_intervals` and `mp_blocks` on the producer's list deliberately, so the
  producer's was the true statement and the checkers held the stale copy. The attribute carries the four.
- ⚠️ **The move is measured inert** (`verify:parity` IDENTICAL over 6,210): both checkers price a fixed-shape
  main set from CLOSED step lengths and return `null` on a distance step, so the two rows added to their
  reach still fall out — at the step rather than at the membership test. 🔻 That is
  `CHECK-FIXED-SHAPE-DISTANCE-STEP-01`: a 999-minute duration on an `hm_pace_intervals` session raises
  **0 findings in either checker**, where the same mutation on a `threshold_pyramid` raises 22, and 15 of 20
  corpus sessions of the two blind rows understate their own structure by 10.6–26.4 min (**0 of 44 live
  plans**). Filed to the board, not closed here: the fix changes a stated duration a runner reads, and the
  gate's last arm **fails when it is closed**, so it cannot resolve quietly.

**Readers today:** the L5 verifier reads `RULES` (severity, conditional severity, `skipped_by`);
`lib/plan/invariants.ts` derives `RESHAPE_SKIP_INVARIANTS` from `rulesSkippedBy('stored')`;
`lib/coaching/planAdjustment.ts` re-exports the trigger vocabulary. **The event and trigger catalogues have
no runtime reader at all.** Gates: `lib/engine/catalogue/catalogue.test.ts`,
`lib/engine/catalogue/triggers.test.ts`, `lib/engine/catalogue/checkParams.test.ts`,
`lib/engine/contracts/engineTruths.test.ts`, `lib/coaching/triggerProducers.test.ts`.
⚠️ **`CHECK_PARAMS` and the row attributes are the first L2 data BOTH checkers read at runtime**, so unlike
the rule and trigger catalogues this part of L2 is live rather than inert.

### L3: the block planner (B4a, `ADR027-B4A-BLOCKS`)

**What L3 is:** the delivered plan. The HLD builds it in three steps — block → week → session — and B4a is
the first: **how many weeks of base, build, peak and taper a race plan gets, and which rule bound each
number.** `lib/engine/planner/composeBlocks.ts` is the single owner.

🔑 **It is a MOVE, not a second derivation, and that is the design.** L5 is *required* to derive
everything itself, because a checker sharing the producer's code cannot catch the producer being wrong. **L3
IS the producer**, so a `composeBlocks` written beside `ruleEngine.ts`'s `computePhases` would be
`DELOAD-OWNER-01` with a layer diagram on top. `computePhases` had exactly one caller and is **deleted**;
that call site now calls L3. §97's `shortOnRamp` predicate moved with it — it was derived seven lines above
the call, had that one consumer, and selects which §91 cap binds the base, which is a phase length.

| Owns | Does **not** own, and why |
|---|---|
| The phase table: §4's order and floors, §49's authored taper, §89's shortened base, §91's week cap and foundation credit, §98's yield applied, §97's `shortOnRamp` | The §89 **gate** (it reads `peakKm` → `returningRunner` → the whole volume model: B4b) · `total_weeks` (§17, `lib/plan/length.ts`) · §98's ladder and §95 Am. 1's deload yield, which decide by REGENERATING the whole plan and measuring it, so they are the orchestrator's · `getPhaseForWeek`, which reads a phase table rather than composing one |

**Decisions (ARCH-ENG-009).** One `Decision` per phase length, plus §97's verdict and any phase dropped for
being empty. Each names the rule that bound it — tracked as the number is set, not reconstructed afterwards,
because by the end of the composition four rules could have set the same base and only the planner knows
which. `Decision.unit` gained **`'weeks'`** here: B4a is its first consumer, and a phase length written in
`null` units is absence written as a value. ⚠️ **Nothing reads the decisions yet** — L4 is B5.

**Evidence.** `verify:parity` IDENTICAL over 6,210 cases — ⚠️ **and that grid cannot see most of this
change.** It pins `today` to `planStart` and never sets `recent_quality_training`, so `early_onset` is false
and `foundation_weeks` 0 in **all** 6,210 rows: the entire `if (earlyOnset)` block is outside it
(`FOUNDATION-LONG-RUNWAY-01`'s class). 📐 So equivalence was measured directly instead, against the
pre-move function taken from `b41e3396`, over an exhaustive grid of 6 distances × 40 runways × onset × 7
foundation-week values × 4 relax rungs × 7 days-available: **94,080 cases, 0 differences**, with every branch
reached — early onset 47,040, foundation credit changing the base 34,778, the §98 yield moving it 34,398,
`shortOnRamp` 12,320, base reaching zero 8,840, taper squeezed 16,151. Falsified: widening §91's cap by one
week produced 12,748 differences. The probe is a scratch file and is deliberately **not committed** — a copy
of the old derivation living in `lib/engine/` is the duplicate this slice removed.

🔴 **One false claim was found by writing the tests, and it was in the old code's own comment.**
`computePhases` carried *"Preserves taper duration as authored"* beside its overage take-back. The take-back
never reduces the taper directly, but `taperEnd` is pinned to `totalWeeks` while `peakEnd` grows, so any
overage build and base cannot absorb comes out of the **taper**: it is the residual, not a protected block.
📐 Bounded by the §44 prep gate to exactly two producible cases, both 5K — a 5-week plan gets **no
taper phase** and a 6-week plan gets 1 against an authored 2 (shortest producible plan measured against
`generateRulePlan`: 5 weeks at 5K, 7 at 10K, 9 at HM, 11 at MARATHON, over 11 for both ultras). Filed as
`BLOCK-TAPER-SQUEEZE-01` (🏃 Coaching Board, non-blocking): whether a 5-week 5K *should* spend 2 of its 5
weeks tapering is a coaching question, not a defect to patch inside a move.

**Gates:** `lib/engine/planner/composeBlocks.test.ts` — §4's order/contiguity/coverage, §49's authored length
with the squeeze stated, §91/§98's bounds, §97's two scopes, **every phase-length decision equalling the
phase it describes** (the L4 contradiction class at its source), every `bound_by` resolving in the catalogue,
and the strangler boundary (no `function computePhases` in `ruleEngine.ts`; §97's config key named there
0 times, comments stripped first; L3 importing nothing from `lib/plan` but `generationConfig`). Each arm was
falsified. 🔻 **What the file cannot prove: that the move is faithful** — it shares the derivation. That
is what the 94,080-case probe and the suite are for.

#### B4b: the week planner (`ADR027-B4B-WEEKS`)

`composeWeekVolumes` owns **how many kilometres each week carries**. `buildVolumeSequence` had one
caller and is **deleted**; `getPhaseForWeek` moved to `composeBlocks.ts`, beside the phase table it
reads (which makes that file's B4a header line about it false, and it is corrected there).

🔴 **THE HLD SAYS *"sets volume within capacity"* AND THE SECOND HALF IS NOT BUILT.** The HLD's
own canonical-models table says why: `WeekCapacity | L1 → L3 | **Nothing; the curve never knew the
time budget**`. L1 has built `schedule.capacity` since B2 and **no planner reads it.** Reading it
would change what runners are prescribed, so it is a Coaching Board ruling, not a slice of a
byte-identical move — filed as `WEEK-VOLUME-CAPACITY-01` (🏃). **Step 2 is the curve, moved. It
does not read capacity.**

| Owns | Does **not** own |
|---|---|
| The ramp and its allowances (§2, returning-runner grace), deload drops and the §3 re-anchor, §2's week-on-week cap and its injury tightening, §2 Am. 3's bounceback bound, the §106 peak clamp, §6's taper step-down and race week, §31's `compressed` verdict | `start_km` / `peak_km` (the volume model) · `deload_weeks` (§87, `computeDeloadWeeks` — passed IN, never re-derived here, and a gate asserts this module never calls it) · `injury_cap_pct` · **capacity** |

**Decisions.** One `week.volume_km` per week naming the rule that **last wrote** it — three passes
write the same slot, so the binding rule is the last writer and only the planner knows which. Plus
`plan.volume_start_km` and `plan.volume_compressed`. ⚠️ **The init band has no invariant**: §2
documents both keys (`BUILD_VOL_INIT_FLOOR_VS_PEAK` / `_CEILING_VS_PEAK`) and nothing checks the
band, so the opening decision cites the ramp rule §94 cites §2 through, and says so rather than
naming a rule that does not check it.

🔻 **Two findings from reading the function, neither caused by the move.**
**(1) `recoveryFreq` was a dead parameter** — in the signature, referenced nowhere in 227 lines,
left behind when `DELOAD-OWNER-01` moved cadence out and `deload_weeks` came in. TypeScript does not
flag an unused parameter by default, so it survived every read. Dropped; the only signature change.
**(2) `phases.find(p => p.name === 'taper')!` is safe by luck, not design.** B4a proved a race plan
can have **no** taper phase (the 5-week 5K, `BLOCK-TAPER-SQUEEZE-01`), so it is `undefined` there. It
never throws only because pass 3 `continue`s on every non-taper week. Asserted in the test rather
than left to the next reader.

**Evidence.** 📐 **Exhaustive equivalence against the pre-move function from `98d227ad`: 76,032
cases, 0 differences**, every branch reached — deload drops 68,976 · injury cap 29,290 · bounceback
22,786 · peak clamp 45,086 · taper 71,712 · `compressed` 29,231 · **no taper phase 4,320** · start
below floor 25,344 · above ceiling 31,680. **Falsified three ways:** a deeper deload → 59,567
differences, a loosened peak clamp → 43,827, a loosened ramp cap → 52,177. ⚠️ The first falsification
attempt used `perl -pi -e` and the regexes did not match, so two mutations reported **0 differences
having never applied** — re-run with literal replacement and an assertion that the edit landed.
The probe is not committed, for the reason B4a's gives. `verify:parity` IDENTICAL over 6,210.
⚠️ **AND THE PARITY CLAIM WAS HALF FALSE AS FIRST WRITTEN:** I said its grid could not reach the
injury branches; it sweeps `['Knee']` and `['Shin splints']`, exactly `hasVolumeCappedInjury`'s
cohort. What it genuinely cannot reach is the **returning-runner** allowance — it never sets
`training_age`, which `isReturningRunner` requires.

⚠️ **`DELOAD-OWNER-01`'s pin had to widen, and it took two goes.**
`deloadCadence.test.ts` counted `deloadWeeks.has(` in `ruleEngine.ts` and pinned it at 6; three reads
moved, the count read 3, the arm went red. **A count scoped to one file cannot tell "three reads were
relocated" from "three cadence decisions were lost."** 🔴 My first repair was a **hand-typed
two-file list**, which code review called: a read landing in any third file would have kept it green,
so the pin no longer made a seventh site a deliberate act — the one thing it exists to do. Globbed
over `lib/` now; the total stays pinned at 6.

🔴 **CODE REVIEW FOUND SIX, ALL MINE, AND TWO WERE ATTRIBUTION DEFECTS OF THE KIND B4a HAD
ALREADY PAID FOR — ONE DAY EARLIER, FROM THE OTHER SIDE.**
**(1) The peak clamp was attributed to `INV-PLAN-PEAK-NOT-BELOW-START`, which is a FLOOR check**
("a plan never peaks BELOW where the runner already is"). Every loading week after the curve reaches
peak would have carried it, making a floor rule the most-cited binding in a long plan. 📐 **No
catalogue rule asserts a week may not EXCEED the peak target** — on the figure CLAUDE.md calls the
single most consequential in a plan. Attribution dropped to the ramp rule, the gap filed as
`PEAK-CEILING-NO-INVARIANT-01` (⚙️), and `composeWeekVolumes.test.ts`'s §106 arm is the first check of
the property anywhere. **(2) `plan.volume_start_km`'s lever was null on every FLOOR clamp**, where
the runner declaring more volume genuinely moves the number (peak 130 + declared 20 opens at 46);
only the ceiling clamp is immune. ⚠️ **And the fix was ungated — a mutation restoring the old
expression stayed GREEN**, so an arm was added and falsified. Plus: the gate cited a measurement the
record did not contain, the parity claim above, and an import left unused by the move.

### L5: the independent verifier (B3 step 2)

**What L5 is:** a second, independent answer to *"is this plan right?"*, derived from L1's view of the runner
rather than from the plan's own claims about itself. It is what the B3 cut-over asks the founder to approve in
place of `validatePlan`.

| Piece | Where | Pure? |
|---|---|---|
| `verifyPlan(plan, ctx, policy)` → `VerifierFinding[]` | `lib/engine/verifier/verifyPlan.ts` | yes: no clock, no I/O, never throws |
| `rulesFor(plan, policy)` → `RuleId[]` — which rules judge THIS plan | `lib/engine/verifier/verifyPlan.ts` | yes |
| `PREDICATES` (the ported rules) and `PORTED_RULES` (their ids) | `lib/engine/verifier/verifyPlan.ts` | yes |
| `UNVERIFIED_PREFIX` / `isUnverified(f)` — the unverified contract | `lib/engine/verifier/verifyPlan.ts` | yes |
| `verifyStrengthPlan` / `verifyRecoveryEase` / `verifyProgression` → `StrengthFinding[]` | `lib/engine/verifier/verifyStrength.ts` | yes |
| Pace, zone and band maths the predicates need | `lib/engine/verifier/formulas.ts` | yes |
| `verifierShadow` — the nightly live-plan run, observe-only | `lib/ops/verifierShadow.ts` | **no**: reads stored plans |

**`VerifyContext` is the whole point, and it has two rules.**

- **`input` is the request RAW.** `validatePlan` first normalises it with the planner's `coherentGoal`; the
  verifier may not import that (ARCH-ENG-001). **A goal-dependent rule reads `profile.race.goal` — the
  normalised goal — and NEVER `input.goal`.**
- **`profile` must be built AS OF THE PLAN'S GENERATION DATE.** §10's staleness ramp makes a runner's level
  depend on the instant the profile is built, so the nightly run against an old plan must not use "now".
- 🔑 **A rule that needs the runner's LEVEL reads the profile, never the plan's own `meta`.** Checking a plan
  against the label the plan gave itself is circular. `ADR027-B3-STRICT-01` row C1 took this from 2 rules to
  9, and on the stored path two of the register's directions INVERT.

**Findings.**

- `VerifierFinding` is `{ rule_id, severity, week, day, detail }`. **`week` is the week's `n`, never its
  position** (ARCH-ENG-015); foundation weeks are `n <= 0`.
- **Severity comes from the catalogue, not the predicate.** A predicate sets `severity` only for a rule whose
  severity is CONDITIONAL (its row has a `severity_note`); every other finding takes `kind`'s mapping.
- 🔴 **A PREDICATE THAT CANNOT EVALUATE RETURNS AN UNVERIFIED FINDING FOR ITS OWN RULE — NEVER A SILENT
  PASS, AND NEVER THE END OF THE RUN.** Each predicate is isolated, so one that throws does not lose every
  other rule's findings. **`UNVERIFIED_PREFIX` is the contract**: a consumer classifies on `isUnverified`,
  never on a string of its own. ⚠️ Those two WERE two independent literals with no gate until
  `ENGINE-CONTRACT-V2-COVERAGE-01` (2026-11-26) — rewording the message would have made the nightly run
  report 0 unverified for ever, reading as *"every rule evaluated cleanly"*.
- **An unverified finding is counted and lands in `strict_only`**, so a crashing rule reads as a plan GAINING
  a code. That is deliberate: loud, not silent.

**`rulesFor` owns BOTH halves of "which rules apply".**

- **The plan's KIND**: a base-build plan gets only the base-build validators, a maintenance plan that
  recorded its base volume only the maintenance validator, every other plan the race rules. Without this the
  race rules ran on base-build and maintenance plans and raised thousands of errors production never raises.
- **The caller's STRICTNESS**: `VerifierPolicy` is `'saved' | 'stored' | 'repaired'`, **required and with no
  default**, mirroring `validateStoredPlan.ts`'s three callers by name. Only `stored` skips anything today;
  `saved` and `repaired` are both strict and are named rather than collapsed, because they are different
  callers and the next exemption may split them.
- 🔑 **The two halves belong to one owner because the old checker learned it the expensive way:** when the
  kind dispatch and the strictness lived apart, eight repair scripts took the dispatch and skipped the policy.

**Coverage, and what the cut-over gate actually is.**

📐 **162 of 171 `INV-` rules have a predicate; 9 are HELD** and the old checker keeps judging them, so **the
cut-over gate is the verifier PLUS those 9** until B4 gives each an independent derivation. The 9 are named
in ADR-027 § Build status and that paragraph is held to the derived list by `heldRules.test.ts` — it is the
one document a founder decision is read from, and it was hand-written beside a derivable set.
⚠️ **The held list is a JUDGEMENT and re-deriving it has shrunk it every time anyone has** — four rules have
left it (`5K10K-LR-PACE-CAP`, `RACE-WEEK-SHAKEOUT-CAP`, `VO2MAX-FLOAT-IS-A-CEILING`, then `DELIVERED-RAMP`
and `TAPER-DELIVERED-DEPTH` together), each because the helper it was said to need turned out to be the old
checker's own. **Re-read a held reason before quoting the count.**
⚠️ **One ported rule, `ZONE-LABEL-HAS-PRESCRIPTION`, can never fire in production** and is named dead in the
harness. ⚠️ **Strength is a SEPARATE ENTRY POINT with a DIFFERENT finding shape** — `StrengthFinding` carries
`at: string | null` where `VerifierFinding` carries `day` — and its 50 rules are outside `PORTED_RULES` by
construction, which is why `heldRules.test.ts` pins its population to `INV-` only.

**Readers today:** `lib/ops/verifierShadow.ts` only, inside `/api/ops/plan-audit`, **observe-only** — it runs
the verifier beside `validateStoredPlan` on every stored plan and writes nothing back to a plan. Nothing in a
runner-facing path calls L5. Gates: `lib/engine/verifier/verifierStrict.test.ts`,
`verifierAgreement.test.ts`, `verifierIndependence.test.ts`, `verifierBaseBuild.test.ts`,
`verifierMaintenance.test.ts`, `verifierStatic.test.ts`, `verifierStrength.test.ts`, `heldRules.test.ts`,
`formulas.test.ts`, `lib/ops/verifierShadow.test.ts`. ⚠️ **There is no `verifyPlan.test.ts`** — this line
named one, and `backlog:verify § 1b` is what said so, on CI, after a code review had caught its twin.

🔻 **What L5 does not prove.** It has never refused a save, because nothing calls it on the save path. Its
agreement with the old checker is measured on the golden corpus and on the live fleet as of 2026-11-25 — **not on
plans stored since.** 📐 **44 stored plans: 1 would GAIN a code, 0 would LOSE one, 0 escalations, 0 unable to
evaluate.** ⚠️ **That `1` is not a rounding of zero and must be quoted with the rest**: it is the one plan whose level
is not comparable, so **0 COMPARABLE plans gain a code** — the figure the cut-over actually rests on, and the reason
`VERIFIER-STORED-LEVEL-01` was a blocker. A first draft of this paragraph quoted the three zeroes and dropped the
non-zero row, which reads as full agreement; code review caught it. And
`PREDICATES` is a map, so a rule can be ported, agree with the old checker on every corpus plan, and still be
unreachable for the population that matters: `invariant:liveness` is the harness for that question and it
covers `validatePlan`, not this module.

### What stays outside the service

- **Tier resolution and auth** (ADR-003): `resolveTier` at the route. The distance paywall is a commercial
  403 at the route.
- **Persistence**: `savePlanForUser`, `plan_archive`, `supersedeWeekKeyedRows`.
- **Enrichment** (ADR-006, L6): an async job the route calls after the synchronous rule plan is returned.
  `generateFreeIntro` and `enrich` call Anthropic and stay the caller's; their output is re-verified.
- **IO the engine needs**: the route reads the stored plan and `fetchWeeklyLoad` for `checkpoint.evaluate`
  and hands them in.
- **Recording telemetry**: the engine returns events and findings; the caller writes `ops_events`.

### What § v2 does not prove

- Nothing serves it. The request schema, result union and HTTP mapping are unexercised by any route.
- **`Decision` has no producer.** Its shape will be tested by the B-phase that produces it (B4) and may need
  to change then. ⚠️ **This line said `Rule` had none either, and that stopped being true at B3 step 1** —
  `RULES` has 221 rows and L5 reads them, measured 2026-11-26 while writing § L2. A contract asserting an
  absence that has since been filled is the shape `audit-docs.sh` cannot see: it proves a record EXISTS, not
  that it is TRUE. `RunnerProfile` has a producer (B2); its `observed` block and `capacity` have no reader,
  and nothing has run `fetchRunnerFacts` against the live database.
- Plan v2's `derived_set.blocks` is checked as an array only; ADR-019's step shape is not schema-checked.
- `v1_carry` admits any undeclared week key on the adapter path. Only the corpus assertion stops a producer
  using it, and a cast-only week field written by a path the corpus does not reach would be carried silently.
- The stored-plan round trip ran once, read-only, on 2026-11-21 (43 live + 80 archive). It cannot run in CI;
  a plan stored after that date is covered only by the key-set gate and the corpus test.
