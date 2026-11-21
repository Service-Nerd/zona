# ADR-027: the coaching engine as a layered service (ACCEPTED, 2026-11-20)

**Status:** ✅ **ACCEPTED 2026-11-20** by the founder.

Founder decisions, 2026-11-20:
1. Architecture approved.
2. The current engine is frozen, apart from four hotfixes:
   - run-walk on a maximal TT
   - the base-build ramp ignoring injury caps
   - the per-side plyo dose
   - every plan write must go through `savePlanForUser`
3. Hosting: a package in this repo first. A separate deployment comes only when a second consumer exists.
4. Start with B0.
5. Each cut-over is signed off by both: the Coaching Board on the coaching, and the founder on go-live.
6. The `build` skill is used throughout.
**HLD:** `docs/architecture/hld-coaching-engine-service-2026-11-20.html` (published as a private artifact,
https://claude.ai/artifact/HSgFxUU2qhWBbSdMbptN5F).
**Inventory:** `docs/architecture/engine-inventory-2026-11-20.md`.
**Trigger:** `docs/decisions/coaching-2026-11-20-final-plan-read.md`. About 46 new defect classes were found in one
pass. All of them trace to five structural causes, and they meet the founder's stated condition for a new
architecture.

## Decision (proposed)
The engine is rebuilt as a versioned service, structured as six layers. Each layer owns one canonical truth:

| Layer | Owns | Canonical truth |
|---|---|---|
| L1 Profile | Turning raw input into a `RunnerProfile`, including each day's capacity | who the runner is |
| L2 Rule catalogue | Every principle as data, traced to its § | what we believe |
| L3 Planner | Block, then week, then session. One owner of delivered volume. No post-passes. Strength placement lives here too | the delivered plan |
| L4 Explanation | Every note, generated only from decision records | why |
| L5 Verifier | An independent evaluator of the L2 rules over the output | is it right |
| L6 Enrichment | Optional AI copy, re-verified | (none) |

The coaching doctrine is unchanged. Rulings become L2 entries.

## Consequences
- Success is measured by Scorecard v2 on a production-shaped golden corpus.
- The current engine is the baseline. Each plan kind is cut over only in shadow mode, and only when it is at least
  as good on every line.
- Defects are captured automatically:
  - verifier findings on every generation and nightly;
  - a defect register;
  - auto-created backlog items;
  - each new defect becomes a regression fixture;
  - a CI ratchet;
  - automatic regeneration of eligible live plans.
- The current engine is frozen except for a list of hotfixes for defects that harm runners.
- The build order is B0–B8, as set out in the HLD.

## v1.1 senior review (2026-11-20)

### Reuse: extend these owners, do not duplicate them
- `docs/contracts/engine.md` becomes the v2 contract. `runEngine` remains the entry.
- Rule entries reference `CoachingPrinciples.md` § numbers and `GENERATION_CONFIG` keys. They never copy a value.
- The current invariants are refactored into rule predicates and keep their code ids.
- Scorecard v2 composes the existing harnesses: `review:coaching`, `audit:plans`, `measure:fitness`, `cohort:shape` and `verify:parity`.
- Findings are recorded as `ops_events`.
- The defect register is a generated file. It is gated by `backlog:verify`; nothing auto-writes `backlog.md`.
- The single owners stay: `sessionKm`, `sessionRole`, `deloadCadence`, `lib/format.ts` and the accessors.
- The engine is extracted as a package first. It gets its own deployment only once a second consumer exists (the 2026-10-14 position).

### Design changes
- **Shared code between planner and verifier:** the two may share only the rule data and the fixture-tested metrics owner.
- **Version stamps:** every plan carries `engine_version`, `rules_version`, `as_of` and `input_hash`.
- **Latency:** the rule plan is returned synchronously. Enrichment and shadow runs are async, after the response.
- **Typed results:** `ok`, `refused` (code, reason, levers) or `invalid_input`.
- **Plan read model:** consumers read plans only through accessors.
- **Placement:** deterministic and priority-ordered. No solver library.
- **`/adapt`:** returns a diff plus its ADR-012 magnitude.
- **Cut-overs:** a flag per plan kind and a kill switch. Every cut-over has a recorded sign-off.
- **Doctrine file:** the rule catalogue joins the coaching-guard doctrine list. INV-COACH-002 becomes § + config key + rule entry.
- **Doc-drift fixes in B1:**
  - `architecture.md`
  - the principles skill
  - the engine and strength contract counts
  - 4 claims in `CLAUDE.md`
- **Tier:** the engine stays tier-blind (ADR-003).
- **Hotfix:** every plan write goes through `savePlanForUser`.

### New principles (binding since 2026-11-20)
| ID | Principle |
|---|---|
| ARCH-ENG-001 | Layers depend downward only. Nothing mutates the plan after L3, except L6 copy, which is re-verified |
| ARCH-ENG-002 | A canonical truth registry (`docs/canonical/engine-truths.md`): one owner per truth |
| ARCH-ENG-003 | A rule references its § and its config key, and never copies a value |
| ARCH-ENG-004 | One metrics owner for derived quantities, tested against hand fixtures |
| ARCH-ENG-005 | Determinism: no wall-clock read inside the engine; `as_of` is required; outputs are stamped |
| ARCH-ENG-006 | A refusal is a typed result, never a throw |
| ARCH-ENG-007 | Every corpus row must be producible by a product path |
| ARCH-ENG-008 | Never worse: a Scorecard v2 ratchet, shadow parity, and a recorded sign-off for every cut-over |
| ARCH-ENG-009 | Notes are generated only from Decision records |
| ARCH-ENG-010 | Consumers read plans only through the read model |
| ARCH-ENG-011 | Every finding is an event with a rule id. An open, unruled rule id blocks `backlog:verify` |

Each principle ships with its mechanical check (listed in the HLD, section 9c) during the B-phase that introduces it.


## Hotfix status (2026-11-21)

| # | Hotfix | Status |
|---|---|---|
| 1 | Run-walk on quality sessions and the maximal TT | ✅ `RUNWALK-QUALITY-HOTFIX-01`, §117 Am. 9 (Coaching Board), commit `75670759` |
| 2 | Base-build ramp ignores knee/shin injury rules | ⏸️ **Coaching Board.** The literal rule combination (5% cap, 85% deload, capped bounceback, 4-week cadence) makes the ramp **decline** (×0.984 per cycle). D-21: the rule needs amending. Attempt saved; sitting running |
| 3 | Per-side plyo dose | ✅ `STRENGTH-PLYO-PER-SIDE-01`, S8 defect fix, commit `7a6ccd06` |
| 4 | A plan write bypasses `savePlanForUser` | ❌ **Dropped on analysis.** The direct write is the enrich backstop. `shouldServerPersist` limits it to the same generation, and the plan is re-validated by `repairEnrichedCopy` first. Routing it through `savePlanForUser` would archive a duplicate unenriched copy. B7's single engine adapter consolidates saves anyway |
