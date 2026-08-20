# Contract — Session structure v2

**Status**: Active (Phase 1 — structure layer)
**Owner**: `lib/plan/sessionStructureV2.ts`
**Authority**: ADR-019. Prerequisite ADR-018 (session carries `catalogue_id`).
**Tier**: FREE (infrastructure).

---

## What this contract governs

How a catalogue row describes the *work inside a session*, and how that description reaches the runner.

It does **not** govern how big a session is. Sizing is a separate, unresolved concern — see *Deliberate omission* below.

## Why v2 exists

A v1 row describes its main set as one of eight ad-hoc shapes typed only as `Record<string, unknown>`. The 2026-08-19 catalogue audit scored those shapes against six things a coach would want to prescribe: **4 NO, 2 PARTIAL, 0 YES.** No session in the audit's Task E can be expressed today.

Two structural limits cause all six failures:

- **A repeat set is one repeated thing** — a count, one work step, one recovery step. "These reps differ from each other" and "this block contains more than one kind of step" are unsayable.
- **The recovery step carries a free-text type word that nothing consumes.** Walking recovery and jogged recovery produce identical plan output.

## Shape

A main set is an ordered list of **blocks**. A block has a repeat count and an ordered list of **steps**. Everything else is composition.

```
main_set_structure (v2)
├── version: 2
├── sizing
│   └── scaling   "reps" | "rep_length" | "fixed"
└── blocks[]
    ├── repeat    integer >= 1
    ├── label     optional, e.g. "ladder up"
    └── steps[]
        ├── role       "work" | "recovery" | "transition"
        ├── modality   "run" | "jog" | "walk" | "stand" | "hike"
        ├── terrain    "flat" | "uphill" | "downhill" | "rolling"   (optional)
        ├── grade_pct  [min, max]                                    (optional)
        ├── length     { kind: "duration", secs }
        │            | { kind: "distance", m }
        │            | { kind: "to_landmark", landmark }
        │            | { kind: "mirror", of: "previous_work" }
        │            | { kind: "open" }
        ├── target     { kind: "pace",   anchor, mode, tolerance_pct }
        │            | { kind: "zone",   zone }
        │            | { kind: "effort", rpe }
        │            | { kind: "none" }
        └── advance    "auto" | "manual"                             (default "auto")
```

## Two rules that make it safe

1. **A target references a named pace ANCHOR, never a number.** Anchors are `E | T | I | R | M | goal | race_5K | race_3K`; the runner's own paces resolve them at generation. **A row can never contain a pace.** Mechanically enforced by `INV-CAT-V2-NO-LITERAL-PACE`.
2. **`mode` distinguishes `target` / `ceiling` / `floor`.** A pace is not always a band to hit — "jog the recovery no slower than 6:30" and "warm up no faster than X" are ceilings and floors. This is the same missing concept CD-11 asks for on easy runs.

## The six cases

| # | Case | Covered by |
|---|---|---|
| 1 | Pyramid / ladder | One block, `repeat: 1`, explicit work steps of differing lengths with recovery interleaved. `scaling: "fixed"`. |
| 2 | Nested set | One block, `repeat: n`, several work steps with different targets inside it. |
| 3 | Per-step pace on work **and** recovery | Every step carries its own `target`, recovery included. |
| 4 | Typed recovery | `modality` is a closed set. `jog` / `walk` / `stand` differ in the session's distance and duration, not just in wording. |
| 5 | Hill reps | `transition` step with `to_landmark`; work step `terrain: uphill` + `grade_pct` + `target: { kind: "effort" }` (no pace); recovery `modality: stand`; descent step `length: { kind: "mirror", of: "previous_work" }` with its own pace ceiling. |
| 6 | Warm-up as a ceiling | `mode: "ceiling"` on any pace target. |

## Migration posture — additive, per D-03

**Existing rows are not rewritten.** A row with no `version` is read exactly as before. A row with `version: 2` is read through the v2 resolver. Both may coexist indefinitely; there is no cutover.

This is D-03 ("versioned behaviour only — never silently reinterpret old shapes") applied literally: v1 rows keep v1 semantics forever.

## The derived set reaches the plan

A catalogue row is shared across runners, so it cannot hold both *"4 × 1000 m"* and *this runner's* numbers. The row holds the shape; the **session** holds the resolved set.

- `resolveMainSet(row, ctx)` is the **single owner** of shape + runner context → concrete steps (D-08).
- The generator stamps the result on `Session.derived_set`.
- The display renders `derived_set` when present and falls back to the v1 composer otherwise.

Without this the schema is invisible to a runner — the seventh gap the audit called blocking. `catalogue_id` (ADR-018) supplies the identity half; `derived_set` supplies the numbers half.

## Deliberate omission — `budget_pct_of_weekly`

The audit's v2 spec puts a sizing **budget** on the row: `budget_basis` + `budget_pct_of_weekly`. **This contract omits it.**

SC-10 built exactly that (category-specific shares of weekly volume), swept it across 18,056 plans and **rejected it**: share-of-weekly-volume cannot express what it was meant to, because every session scales with the week it sits in. Encoding that basis into the row schema would spread a rejected model across the catalogue.

`sizing.scaling` is retained — *which dimension stretches* is a genuine property of a session shape and is independent of how the budget is computed. The budget itself waits for **SIZING-REALLOC-01**.

## Invariants

| ID | Guarantee |
|---|---|
| `INV-CAT-V2-NO-LITERAL-PACE` | No v2 step target contains a numeric pace. Targets name an anchor; the runner's paces resolve it. |
| `INV-CAT-V2-WELL-FORMED` | Every v2 row parses against the schema: ≥1 block, each block ≥1 step, `repeat >= 1`, and every `mirror` step has a preceding work step to mirror. |
| `INV-PLAN-DERIVED-SET` | A session produced from a v2 row carries a non-empty `derived_set`. |

## Out of scope for Phase 1

- Migrating the remaining v1 rows (each is a Coaching Board matter where behaviour would change).
- `warmup` / `cooldown` overrides on the row — the universal format still owns those (`SESSION_FORMAT`).
- Sizing budgets (above).
