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

**Readers today:** `runEngine` only (levels, `volume.effective_start_km`, `weeks_to_race.plan`,
`weeks_to_race.display`), built with `factsFromInput(input)`, `asOf: <its one clock read>`,
`timezone: null`. ⚠️ `asOf` is the wall clock even when a caller pins `today`, because the refusal
telemetry it replaced measured the staleness ramp and `weeksUntilRaceSigned` to the wall clock.
`fetchRunnerFacts` is called by **no route** yet (B2b). Gate: `lib/engine/profile/buildRunnerProfile.test.ts`
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
- `Rule` and `Decision` have no producer. Their shapes will be tested by the B-phase that produces them,
  and may need to change then. `RunnerProfile` has one (B2); its `observed` block and `capacity` have no
  reader, and nothing has run `fetchRunnerFacts` against the live database.
- Plan v2's `derived_set.blocks` is checked as an array only; ADR-019's step shape is not schema-checked.
- `v1_carry` admits any undeclared week key on the adapter path. Only the corpus assertion stops a producer
  using it, and a cast-only week field written by a path the corpus does not reach would be carried silently.
- The stored-plan round trip ran once, read-only, on 2026-11-21 (43 live + 80 archive). It cannot run in CI;
  a plan stored after that date is covered only by the key-set gate and the corpus test.
