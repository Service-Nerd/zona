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

## Input — `GeneratorInput`, 31 fields

**7 required**, and the engine cannot run without them:

| Field | Type |
|---|---|
| `race_date` | ISO date |
| `race_distance_km` | number |
| `goal` | `'finish' \| 'time_target'` |
| `current_weekly_km` | number |
| `longest_recent_run_km` | number |
| `days_available` | number |
| `age` | number — Tanaka max-HR derivation |

**24 optional.** Full list and semantics in `types/plan.ts`; it is the source and this contract
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

`'free' | 'trial' | 'paid'`, read in 28 places, gating which catalogue rows are selectable
(`tier !== 'free' || row.is_free_tier`).

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
   document.** Five of the eighteen (`enrich`, `enrichAttribution`, `enrichPartialRevert`,
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

   So: **`adjust-plan` five**, and **six counting the `@/lib/plan` barrel**.

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
