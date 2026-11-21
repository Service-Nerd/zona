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
| 2 | Base-build ramp ignores knee/shin injury rules | ✅ `ONRAMP-INJURY-CLIMB-01`, §116 Am. 16 (Coaching Board 2026-11-21). The brief cited §2's capped bounceback, which §2 Am. 3 withdrew; the ramp now uses the race engine's rule (return to pre-deload, no higher) through one shared owner. `verify:parity` IDENTICAL on the race engine |
| 3 | Per-side plyo dose | ✅ `STRENGTH-PLYO-PER-SIDE-01`, S8 defect fix, commit `7a6ccd06` |
| 4 | A plan write bypasses `savePlanForUser` | ❌ **Dropped on analysis.** The direct write is the enrich backstop. `shouldServerPersist` limits it to the same generation, and the plan is re-validated by `repairEnrichedCopy` first. Routing it through `savePlanForUser` would archive a duplicate unenriched copy. B7's single engine adapter consolidates saves anyway |
| 5 | Adjustments written to the wrong week on plans with foundation weeks | ✅ `ADJUST-WEEK-COORD-01`, ⚙️ no board (defect restoring the engine's own documented `week.n`), founder approved 2026-11-21 despite the freeze. ARCH-ENG-015 landed early: `weekResolution.ts` owns the key (`getCurrentWeekN`, `weekNAt`, `findWeekByN`, `weekIndexOfN`, `lastWeekN`), `weekCoordinate.test.ts` forbids a position as a key. Fixed in adjust-plan, the engine's read and `totalWeeks`, taper recalibration (route, client gate, anchor, step), the missed-session prompt, the orphan heal, confirm/revert (no matching week is a 409, never a confirm), pre-session readiness `totalWeeks`, the daily coach note, post-run reframe and the widget. Byte-identical on unshifted plans (1,040 cases against `4e3aa0fc`). The 4 live rows are on one plan and replaced race weeks 1–2 with foundation weeks; no exact restore source exists; repair is a founder call (`docs/runbooks/adjust-week-coord-repair.md`) |

## v1.2 data and entry-point review (2026-11-21)

**Why:** before B2 continued, the founder asked whether the data schema had been reviewed, and whether the design
accounted for how plans are **created**, what **reshapes** them, and what data each uses. It had not. Three read-only
maps were made:
- `docs/architecture/data-dictionary-runner-facts-2026-11-21.md`: every runner-fact table, measured live.
- The creation path, end to end.
- Every reshape path.

v1.1 designed **one** entry (plan generation). Production has **eight** ways to create a plan and **fifteen** ways
to change one.

### What the maps found (each verified at the cited line or against production)
1. **The engine reads no stored runner data at creation.**
   - The run log, health samples, completions and analyses never reach a new plan.
   - The server trusts the posted body, which has no schema check (`guardAiRequest.ts:47-59`).
   - Age, max HR and the recommended level are worked out **on the device**.
   - Paid-only fields are stripped **on the client**.
   - Declared weekly km was more than 25% above the logged volume for **8 of 11** runners whose log covers the
     28 days before their plan. Re-measured by the Coaching Board with run de-duplication and validity bounds:
     **11 of 15** (`STARTVOL-OBSERVED-01`).
2. **Reshapes do not go through the engine.**
   - Of fifteen paths, three run `runEngine`: modify, the base-build checkpoint and the foundation decision.
   - The rest edit plan JSON directly: adjustments, confirm/revert, readiness, benchmark and HR recalibration,
     taper recalibration, post-race reshape, and the maintenance handoff.
   - **Only `/api/adjust-plan` can refuse an invalid result in production.** Every other save is log-only, and is
     skipped entirely when `meta.generator_input` is absent.
3. **Four derivations of "current volume", three of VDOT, two of HR zones, two of readiness.** Each reshape derives
   its own.
4. **🔴 Two week coordinates, and a live defect.**
   - `adjust-plan` computes `weekN` as array position + 1 (`route.ts:146`). It reads that position
     (`adjustmentEngine.ts:319`) but writes the week whose `n` equals it (`adjustmentEngine.ts:501`).
   - On a plan with foundation weeks (`n ≤ 0`) those are different weeks.
   - **Measured:** 7 of 43 live plans are shifted (6 not internal). All **4** adjustments recorded on them
     (2026-11-11 to 11-18, `zone_drift`, auto-applied) were written **3 weeks later** than the week the runner was in.
   - They were notes, but a volume trim or session swap takes the same path.
   - Taper recalibration and the missed-session prompt mix the same two coordinates.
5. **Several writers, whole-row last-write-wins.**
   - Plans are saved from the **browser** (`savePlanForUser` in `DashboardClient`).
   - There is also a server backstop `.update` and server-side route saves.
   - Fire-and-forget auto-applies can be overwritten by a later client save from stale state.
   - `session_overrides` is a second, unvalidated plan layer.
6. **The automatic triggers almost never run.** Load ratio, drift, efficiency decline, shortfall and fitness are
   evaluated only when a runner logs a fatigue tag or RPE ≥ 8, or taps "Check now". Nothing evaluates them when a run
   arrives.
7. **"Today" is the server clock in its own timezone.** `user_settings.timezone` is never read, and is `UTC` for 22
   of 56 runners.

### Decisions (binding, amend v1.1)
| ID | Decision |
|---|---|
| **ARCH-ENG-012** | **Two entries, one engine.** `create(request)` covers every way a plan is born: wizard, modify, staged, base-build, checkpoint, foundation decision, maintenance handoff and ops regeneration. `adapt(plan, event)` covers every way one changes. An adapt **event** is typed (`run_logged`, `run_analysed`, `session_skipped`, `session_moved`, `fatigue_reported`, `readiness_low`, `benchmark_recorded`, `hr_changed`, `race_result`, `taper_due`, `race_changed`, `foundation_decided`) and returns a **diff + ADR-012 magnitude + decisions**. A caller never edits plan JSON. |
| **ARCH-ENG-013** | **Facts are assembled on the server, from the systems of record.** One owner, `assembleRunnerFacts(userId, as_of)`, at the route boundary. It reads `user_settings`, the run log, health samples, completions, analyses and the stored input, and hands L1 a pure snapshot. The engine stays I/O-free. A value computed on the client (age, recommended level, device HR) is a **stated** input that L1 re-derives. It is never trusted as derived. |
| **ARCH-ENG-014** | **Every fact carries source + precedence** (`observed` > `confirmed` > `stated` > `derived`). Invalid becomes `null` through one validity bound per field. **Carrying** an observed fact is architecture. **Prescribing from it** (e.g. starting volume from the log) is a Coaching Board ruling. |
| **ARCH-ENG-015** | **One week coordinate: `week.n`.** An array position is never used as a key to any table, event or write. Owner: the read model's `currentWeek(plan, as_of)`. A gate forbids `getCurrentWeekIndex(...) + 1` as a key. |
| **ARCH-ENG-016** | **One writer, on the server.** Every plan write goes through one engine adapter: verify (L5), archive, persist, with an optimistic-concurrency check on the plan version. The browser never writes `plan_json`. `session_overrides` becomes an `adapt` event and stops being a parallel layer. **Supersedes hotfix 4's "dropped"**: the backstop write is retired by this, not by a patch. |
| **ARCH-ENG-017** | **Every write is verified and can be refused in production**, on the `adjust-plan` model (refuse a *new* error-severity finding). Log-only saves end. |
| **ARCH-ENG-018** | **Triggers are a catalogue**: event → condition → threshold (a config key, never inline) → the adapt event it raises. Triggers are evaluated **when data arrives** (ingest, analysis), not only when the runner taps something. ⚠️ Running them on data arrival changes how often runners are prompted, so the Coaching Board rules on the thresholds and the Design Board/SLT on the frequency. |
| **ARCH-ENG-019** | **`as_of` is resolved in the runner's timezone, on the server.** An unset or `UTC`-default timezone is flagged `unknown`, never trusted. |
| **ARCH-ENG-020** | **The request is schema-checked at the boundary** (the strict v2 input schema from B1), and **tier gates are applied on the server**. The client hides fields; it does not enforce. |

### Hotfix 5 (approved by the founder 2026-11-21, shipped the same day; see the hotfix table)
`ADJUST-WEEK-COORD-01`:
- `adjust-plan`, confirm/revert, taper recalibration and the missed-session prompt key on `week.n`.
- Live harm: adjustments land on the wrong week for every plan with foundation weeks.
- ⚙️ No board (defect restoring documented intent: the engine's own type says "`week.n`, not an array index").
- The 4 misplaced rows are notes. Their repair is a measured hand-over, not a silent rewrite.

### What changes in the build order
| Phase | v1.1 | v1.2 |
|---|---|---|
| B2 | L1 profile from `GeneratorInput`, adopted at `runEngine` | **`assembleRunnerFacts` + L1 profile (sources, validity, timezone, one age owner, observed block)**. Adopted at `runEngine` for creation with **parity identical**. The prescription stays on stated facts until the board rules |
| B3 | catalogue + verifier | unchanged, plus the **trigger catalogue** (ARCH-ENG-018) as L2 data, with thresholds moved out of inline literals |
| B4 | planner, one plan kind at a time | unchanged; `create` only |
| **B4b (new)** | — | **`adapt`**: each reshape path moves onto an event, one at a time, highest harm first: adjustments → confirm/revert → taper → recalibration → post-race → readiness → overrides → maintenance |
| B7 | single engine adapter consolidates saves | **brought forward to B4b's first step**: one server writer with a concurrency check, because every adapt path needs it |
| Others | — | unchanged |

### Earlier decisions this revises
- **Hotfix 4 (dropped)** → superseded by ARCH-ENG-016.
- **v1.1 "`/adapt` returns a diff plus its magnitude"** → now a typed event set with one owner (ARCH-ENG-012).
- **`RunnerProfile` v1 (B1)** → revised in B2: sources, the observed block and validity, per the data dictionary § 3.
- **"`runEngine` remains the entry"** → it remains the `create` entry. `adapt` is the second entry, not a sideline.
- **The 2026-11-20 build plan's W8 (retro-fix live plans)** → unchanged in intent. It runs through `adapt` / `create`
  and the one writer, never a script `.update`. The operator scripts' direct writes are listed for retirement.

### Not proven by this review
- No reshape was run against a live plan; these are read paths.
- The double-apply of a move plus a confirmed reorder, and the stale-state overwrite, are read from the code and not
  reproduced.
- The volume comparison treats the log as a floor. It is not a measure of what runners actually ran.
