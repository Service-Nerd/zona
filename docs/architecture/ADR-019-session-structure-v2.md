# ADR-019 — Session structure v2: sessions described as data, not shapes

**Status**: Accepted (Phase 1 — structure layer)
**Date**: 2026-08-20
**Related**: ADR-010 (session catalogue), **ADR-018** (session carries `catalogue_id` — the blocking prerequisite), ADR-006 (hybrid generation), D-03 (versioned behaviour only), D-08 (no duplicate ownership).
**Contract**: `docs/contracts/data/session-structure-v2.md`
**Tier**: FREE (infrastructure).

---

## Context

A catalogue row describes its main set as one of eight ad-hoc shapes — `repeats`, `continuous`, `progression`, `fartlek`, `long_run_with_segment`, `long_run_with_fuelling`, `back_to_back`, `time_on_feet` — typed as `Record<string, unknown>`. There is no schema; the display renderer type-tests its way through a chain of `if (m.type === …)`.

The 2026-08-19 catalogue audit scored those shapes against six things a coach would want to prescribe:

| # | Case | v1 |
|---|---|---|
| 1 | Pyramid / ladder | **NO** |
| 2 | Nested set | **NO** |
| 3 | Per-step pace on work *and* recovery | PARTIAL |
| 4 | Typed recovery that does something | PARTIAL |
| 5 | Hill reps | **NO** |
| 6 | Warm-up as a pace ceiling | **NO** |

**4 NO, 2 PARTIAL, 0 YES.** No session in the audit's Task E is expressible. Two structural limits cause all six:

- **A repeat set is one repeated thing** — a count, one work step, one recovery step. "These reps differ from each other" and "this block contains more than one kind of step" cannot be said.
- **The recovery step's type word is free text nothing consumes.** Walking recovery and jogged recovery produce identical plan output.

CD-17a (hill repeats, unanimous) cannot be implemented against v1: it needs a run-to-a-landmark step, an effort target with no pace, a third step in a rep, a prescribed descent, and per-step terrain — five gaps at once.

## Decision

**A main set is an ordered list of blocks. A block has a repeat count and an ordered list of steps.** A step has a role, a modality, a length and a target. Everything else is composition.

Full shape in the contract. Two rules carry the design:

1. **A target names a pace ANCHOR, never a number.** `E | T | I | R | M | goal | race_5K | race_3K`. A row is shared by every runner, so a pace written into it is wrong for all but one of them. `lib/plan/resolveMainSet.ts` is the single place anchors become paces.
2. **`mode` distinguishes `target` / `ceiling` / `floor`.** A pace is not always a band to hit — "jog the recovery no slower than 6:30" and "warm up no faster than X" are the cases v1 could not state.

**The derived set reaches the plan.** The row holds the shape; the session holds the resolved numbers, stamped as `Session.derived_set` at generation. With `catalogue_id` (ADR-018) supplying identity, this closes the seventh gap the audit called blocking — *the structure never reaches the plan.*

## Migration — additive, and deliberately unexercised

**No catalogue row is migrated in this ADR.** A row with no `version` is read exactly as before, forever; a row with `version: 2` goes through the v2 resolver. Both coexist; there is no cutover. This is D-03 applied literally.

**Phase 1 therefore ships a path with nothing on it, and that is the intended scope.** A v2 row *is* prescription — what a runner is told to do — so the first one belongs to a Coaching Board ruling, not to an infrastructure commit (INV-COACH-001). **SC-09 (hill repeats, CD-17a, already ruled CORRECT) is that first row**, and it is now pure data plus its three artifacts.

Asserted, not assumed: a test walks the catalogue and fails if any row has become v2, so the behaviour-neutrality claim cannot rot.

## Deliberate omission — the sizing budget

The audit's spec puts `budget_basis` + `budget_pct_of_weekly` on the row. **This ADR omits it.**

SC-10 built exactly that model — category-specific shares of weekly volume — swept it across 18,056 plans and **rejected it**: share-of-weekly-volume cannot express what it was meant to, because every session scales with the week it sits in, and a percentage low enough to correct the ordering drives sessions under `MIN_SESSION_DISTANCE_KM`. Encoding that basis into the row schema would spread a rejected model across the whole catalogue and make it far more expensive to remove later.

`sizing.scaling` is retained — *which dimension stretches* is a real property of a session shape, independent of how a budget is computed. **SIZING-REALLOC-01 closed 2026-09-03** — not via a schema-level budget field (still correctly omitted; that approach stays rejected), but via named `GENERATION_CONFIG` bands (`THRESHOLD_WORK_MIN/MAX/TARGET_MINS`, `PROGRESSIVE_TEMPO_MAIN_MINS`) read by `pacedRepPlan`/`progressiveTempoPlan`/`continuousThresholdPlan` (`ruleEngine.ts`) — the absolute, structure-driven pattern this ADR already recommended over a volume-share budget, now applied to every threshold/race-pace row in the catalogue. `INV-PLAN-MAIN-SET-ORDERING` is `error`. See `CoachingPrinciples.md` §8.

## Consequences

- **All six cases are expressible**, demonstrated as data in `sessionStructureV2.test.ts` rather than asserted in prose.
- **SC-09 is unblocked** and reduces to a catalogue row plus its board artifacts.
- **Zero prescription change.** No row is v2, so no runner's plan differs. Golden plans are untouched.
- **A typed structure replaces `Record<string, unknown>`** for v2 rows. v1 rows keep the untyped shape — retyping them would be a rewrite, which the additive posture exists to avoid.
- **New invariants**: `INV-PLAN-DERIVED-SET` (a v2 row's session carries its resolved set), plus catalogue-level `INV-CAT-V2-NO-LITERAL-PACE` and `INV-CAT-V2-WELL-FORMED`.

## Alternatives considered

- **Extend the v1 `repeats` shape** with an optional list of work steps. Rejected: it makes the shape a union in disguise, keeps it untyped, and still cannot express landmarks, effort-only targets, mirrored descents or ceilings — cases 5 and 6 stay NO.
- **Free-text session descriptions with a parser.** Rejected outright: the design goal is that no session content is ever a string the engine has to parse.
- **Migrate all rows to v2 now.** Rejected: every migration is a prescription change requiring a board ruling, and batching eighteen of them into one commit is the opposite of how INV-COACH-002 expects doctrine to move.
