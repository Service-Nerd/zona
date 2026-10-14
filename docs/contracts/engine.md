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

## What a service boundary would still need

Named so the work is visible rather than discovered later:

1. **Refusals over the wire** — `error.name` → status + body, never 500.
2. **Catalogue versioning** — see above.
3. **The clock** — either accept a `now` argument or publish the generation date with the plan.
4. **An outbound dependency**: `freeIntro` and `enrich` call Anthropic. A hosted engine carries
   a model dependency and a per-call cost, which is a commercial fact, not an architectural one.
5. **`ENGINE-ENTRY-01`** — `app/api/generate-plan` imports **eighteen** engine modules and
   `adjust-plan` ten, so the **route** is the orchestrator. Extract today and all eighteen
   become public API.

## What this contract does NOT cover

`enrich` (the AI layer, ADR-006 — silent fallback by design), persistence, and the
`waitUntil` background chain. Those are the **caller's**, and `ENGINE-PURITY-GATE-01` exists
to keep them there.
