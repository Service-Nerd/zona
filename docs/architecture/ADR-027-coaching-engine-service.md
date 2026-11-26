# ADR-027: the coaching engine as a layered service (ACCEPTED, 2026-11-20)

**Status:** ✅ **ACCEPTED 2026-11-20** by the founder. ⏸️ **Build PAUSED 2026-11-22**: see § Build status for where to pick up.

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

## ⏸️ Build status: PAUSED 2026-11-22 (founder: *"pause the new coaching engine work here"*)

**Paused at `5d15f267`** (docs `ed9e4703`), on a green `main`: 848 test files / 8,927 tests, `tsc` 0,
`audit-docs.sh` ALL CLEAN, `verify:parity` IDENTICAL over 6,210 cases. Nothing is half-built. There is no uncommitted
engine code and no feature flag. Everything below is either shipped or not started.

**The engine runners get is still the current, frozen engine.** The new layers (`lib/engine/`) are built beside it
and nothing in production calls them, so pausing changes nothing a runner sees. The freeze stays in force while
paused: only defects that harm runners are fixed, each one added to the hotfix table below with the founder's approval.

### Where each phase stands
| Phase | State | Record |
|---|---|---|
| B0 golden corpus + Scorecard v2 | ✅ done | `ADR027-B0-GOLDEN-CORPUS`, `ADR027-B0-PROD-FINDINGS`, `ADR027-B0-SCORECARD` (`npm run scorecard`) |
| B1 contracts + canonical types | ✅ done | `ADR027-B1-CONTRACTS` (v1↔v2 adapter, 123 of 123 stored plans round-trip) |
| B2 L1 runner facts + profile | ✅ done; part 1 of the route adoption done | `ADR027-B2-PROFILE`, `ADR027-B2B-PROFILE`. Parts 2–4 of `ADR027-B2B-PROFILE-ADOPTION` land in B4 (founder) |
| B3 step 1: rule catalogue (L2) | ✅ done | `ADR027-B3-CATALOGUE`, `lib/engine/catalogue/rules.ts`, 221 rules |
| B3 step 2: independent verifier (L5) | 🟡 **207 of 221 rules ported**, each agreeing finding for finding with the old checker | `ADR027-B3-VERIFIER`, `lib/engine/verifier/` |
| B3 step 2b: the board's strict readings | 🟡 **14 of 14 B rows + C1 shipped**; D2–D3 open, B10 blocked on the producer, B14 on a §117 reading, two of C1's seven named fields reclassified (below) | `ADR027-B3-STRICT-01`, `lib/engine/verifier/verifierStrict.test.ts` |
| B3 step 3: nightly check of every live plan, observe-only | ✅ done 2026-11-25 | `ADR027-B3-SHADOW-01`, `lib/ops/verifierShadow.ts`, inside `/api/ops/plan-audit` |
| B3 step 4: trigger catalogue (ARCH-ENG-018) + the event vocabulary (ARCH-ENG-022) | 🔲 not started | `ADR027-B3-REMAINING`; vocabulary folded in 2026-11-25 |
| B3 exit: founder signs off the verifier replacing `validatePlan` as the gate | 🔲 | must name the 14 held rules (below) |
| B4–B8 (planner, adapt, explanation, single writer, enrichment) | 🔲 not started | HLD |
| Hotfixes 1–7 | ✅ six shipped, #4 dropped | table below |

**The 14 rules the verifier does not yet check itself.** The old checker keeps judging them, and the cut-over gate
is the verifier plus these 14 until B4 gives each an independent derivation (Coaching Board `ADR027-B3-RAISED-LIST-01`,
E3–E4): `DELIVERED-RAMP`, `INJURY-NO-HILLS`, `RACE-WEEK-SHARPENING`, `COPY-MATCHES-SESSIONS`, `BEGINNER-NEUROMUSCULAR`,
`RACE-SPECIFIC-LONG-RUN`, `BASE-BUILD-RATIO`, `TAPER-DELIVERED-DEPTH`, `STRIDES-PRESENT`, `STRIDES-NO-CARRIER`,
`SURPLUS-IN-PLAN`, `RUNWALK-PRESCRIBED-WHEN-UNREADY`, `RUNWALK-SHORTDIST-SCOPE` and `STAGED-DOOR-RATIO` (all
`INV-PLAN-*`). Most need a derivation only the planner has today. `STAGED-DOOR-RATIO` builds a race block to judge the
door, so it is the producer checking itself. `INJURY-NO-HILLS`, `RACE-WEEK-SHARPENING` and `RACE-SPECIFIC-LONG-RUN` are
ruled to be ported on structural signals (B15, B18). One ported rule, `ZONE-LABEL-HAS-PRESCRIPTION`, can never run in
production and is named dead in the harness.

### B3 step 3 — the live-plan shadow run, and the number the cut-over rests on

`/api/ops/plan-audit` now runs the verifier beside `validateStoredPlan` on every stored plan, observe-only, with the
profile built **as of each plan's generation date** (`lib/ops/verifierShadow.ts`). Measured on the live fleet,
2026-11-25 — **44 stored plans, 39 race and 5 base-build, 44 assessed, 0 unassessable:**

| | |
|---|---|
| Plans that would GAIN a code | **1** — and it is the same plan whose level is not comparable (below), so **0 comparable plans gain a code from a held reading**. (C1 added two more level-dependent rules on that one plan; `VERIFIER-RESHAPE-POLICY-01` then took the reshape bucket from 7 plans to 0.) |
| Plans that would LOSE a code | **0** |
| Severity escalations (warn → error) | **0** |
| Rules that could not evaluate | **0**, across all 44 |
| Rules fired by either side | **51**, of which **46 have identical instance counts** |

🔴 **TWO PORT GAPS, AND THE FIRST RUN READ BOTH AS STRICT READINGS.** It reported 8 plans flagged; 7 of those 8 were
artefacts of the comparison asking a harsher question than its baseline, and the eighth of a level the profile
re-derives. Both are now named in the measurement rather than counted by it, and both are filed:

- ✅ **`VERIFIER-RESHAPE-POLICY-01` — SHIPPED 2026-11-25.** The audit's baseline is `validateReshapedPlan`, which
  drops `COVERS-RACE-DATE` and `RACE-ON-RACE-DAY` because they fire on every legacy plan that ends short of race day
  and a reshape neither caused that nor can fix it; the verifier had no such policy, so **7 live plans would have
  gained those two codes every morning.** `rulesFor(plan, policy)` now owns both halves of "which rules apply" — the
  plan's KIND and the caller's STRICTNESS — with `VerifierPolicy` (`'saved' | 'stored' | 'repaired'`) **required and
  without a default**, mirroring `validateStoredPlan.ts`'s three by name. The exempt list is **one list**: the two
  rules carry `skipped_by: ['stored']` in the catalogue (rule data, which the verifier's import gate admits where it
  forbids `invariants.ts`) and `RESHAPE_SKIP_INVARIANTS` is derived from it. 📐 **Live: `plans_reshape_exempt` 7 → 0,
  `new_findings` 494 → 482 — exactly the 12 findings measured.** The empty bucket is kept as the arm that would
  notice the policy lapsing, and its gate asserts both halves (not judged under `stored`, still reported under
  `saved`) because an empty bucket and a lost rule look identical.
- **`VERIFIER-STORED-LEVEL-01`** — `storedPlanInput` takes the levels from `meta` so the old validator judges a plan at
  the level it was BUILT at, but `fitnessAssessment.ts:201` lets `input.fitness_level` win the INTENSITY band
  (`assessedIntensity = input.fitness_level ?? assessed.intensity`) and nothing reads `input.fitness_intensity_level`
  at all. One §79-elevated live plan (`beginner` structural, `intermediate` intensity) therefore re-derives as a
  beginner and is judged against a quality ceiling of **0 for 7 weeks**. Verified identical as of today, so §10's
  staleness ramp is not the cause.

📐 **AND THE TOTALS NEARLY CANCELLED, WHICH IS WHY THE SUMMARY REPORTS PER-RULE INSTANCE COUNTS.** 489 new findings
against 487 old looked like agreement; the `+2` was **+8 on one plan's `INV-PLAN-LARGEST-SESSIONS-SPACED`** (B3's
ranking fix genuinely reaching the fleet, 103 against 96 over the same 18 plans) and **−24 on one plan's
`INV-PLAN-NO-INVENTED-AGE`** (reported plan-wide by the verifier, per-week by the old checker) almost netting out.
Neither changes a code set, so the rule-id join is silent on both. `instance_delta_by_rule` lists only the rules that
differ — 5 of 51 — so a doubling cannot hide inside a sum again.

### C1 — the verifier reads the runner and the delivered sessions (shipped 2026-11-25)

The sitting's C1 row: *"the verifier reads the RUNNER (L1 profile, request) and the DELIVERED sessions, never the
plan's label for itself. Construction records (stored request, staged door, source base volume, start km) stay
readable."* **Population counted from the code, not from the item** — 157 parsed predicates, and the seven fields the
row names resolve to: level 9 rules · race distance 4 · injuries 2 · goal-from-meta 1 · peak `weekly_km` 3 ·
`volume_profile` 7 · `peak_km_target` 1.

**Built: five readings, one owner each** (`levelIntensity`, `levelStructural`, `raceKm`, `injuriesOf`, `deliveredKm`),
because the meta chain was written out by hand in nine places — the `DELOAD-OWNER-01` shape. `checkerFitness`, the
four-step fallback that both began and could end at the plan's own label, is deleted. **17 register entries** in
`STRICT_DIVERGENCES`, 13 `reached` and 4 `latent`, each falsified.

🔑 **ONE MEASUREMENT GOVERNS ALL OF IT: on the 37 VALID golden plans every C1 divergence is 0 gained and 0 lost.** A
plan the engine produced agrees with itself, which is exactly why the old readings looked harmless. Every divergence
number in the register comes from the mutation battery, which breaks a label away from its runner on purpose.

📐 **Live fleet, re-measured through the step-3 shadow after the change (44 plans, 44 assessed):**

| | before C1 | after C1 |
|---|---|---|
| Plans that would GAIN a code | 1 (all of it the level-mismatched plan) | **1 — the same plan**, so **still 0 comparable plans** |
| Rules it gains on that plan | `QUALITY-PER-WEEK` | **+ `CATALOGUE-ELIGIBLE`, `STRUCTURED-SESSION-DURATION-COHERENT`** — all three level-dependent |
| Plans that would LOSE a code | 0 | **0** |
| Escalations · unverified | 0 · 0 | **0 · 0** |
| Findings | 489 new / 487 old | **494 / 487** — the +5 is entirely that one plan |

So C1 moves nothing on 43 of 44 live plans, and on the 44th it moves what `VERIFIER-STORED-LEVEL-01` already names.
Read the other C1 readings on the fleet directly: race distance 0 divergences, injuries 0, goal 0, declared level 0,
structural level 0; **5 of 80 peak weeks state a volume more than a kilometre from their placed sessions.**

🔴 **THE DELIVERED SUM IS ROUNDED TO THE WHOLE KILOMETRE, AND THE FIRST CUT WAS NOT — IT COST A FINDING.** Unrounded,
one live plan LOST `INV-PLAN-PEAK-IN-PEAK-PHASE`: its biggest week read 37.5 km instead of its stated 38, which moved
the peak's share from 89.5% to 90.7% across §23's 10% inversion line. **No session changed.** That is
`GOALPACE-5K-CLOCK-01`'s arithmetic (4.66% → 5.44% across a 5% line, no commit between) and it is not what C1 ruled. A
week states its volume as an integer and `INV-PLAN-WEEKLY-KM-MATCHES-SESSIONS` already decides honesty at that grain
(`Math.round`, ±1 km); at that grain the two readings coincide wherever the label agrees with the sessions and diverge
exactly where it does not. `plans_lost` went 1 → **0**.

⚠️ **TWO OF C1'S SEVEN NAMED FIELDS ARE NOT SELF-LABELS AND WERE NOT BUILT AS ONES.** Both are construction records in
the same class as the stored request and the staged door the ruling itself keeps readable. Recorded here, in the
predicates, and in the sitting's register row, and **routed back to the chair as a scope correction** rather than
quietly dropped:

- **`meta.volume_profile` (7 rules).** It is composed from SIX triggers, of which §23's delivered ratio is one, and
  re-deriving it was already **measured and refused inside the engine on 2026-11-03: 3,544 of 17,200 sampled plans
  pass §23 on their delivered weeks while being maintenance for one of the other five**, and would lose their
  runner-facing `volume_constraint_note`. Worse, deriving the exemption from the delivered ratio makes
  `INV-PLAN-PEAK-OVER-BASE` **unwakeable** — the rule fires on precisely the condition the derivation would read as
  maintenance. 19 of 44 live plans are maintenance and **0 carry the label without its note**, so the one cheap
  strengthening available (require the note) is latent. Filed for the board as a possible new rule: *a maintenance
  claim must be justified by the runner's own facts*, which the profile can answer.
- **`meta.peak_km_target` (1 rule).** §79's subject IS the target — *"an upward declaration never raises the peak
  TARGET above the assessed band"* — so substituting the delivered peak asks a different question, one ADR-022
  already governs with its curve-vs-delivered divergence declared. Measured: the delivered reading fires on **1 of 44
  live plans, at 38.5 km against a 38 km beginner band**, a rounding-grade divergence and not a declaration defect.
  The two LEVELS in that rule are C1's and did convert.

⚠️ **Also named rather than converted: the ADR-022 curve family.** `DELOAD-IS-A-REDUCTION`, `BOUNCEBACK-BOUNDED`,
`INJURY-CAP-DELIVERED`, `NOT-DETRAINING`, `PEAK-STEPBACK-VOLUME`, `PEAK-NOT-BELOW-START`, `RACE-NOT-VOLUME`,
`FOUNDATION-BLOCK` and `GET-RUNNING-BUILD-RATIO` still read `w.weekly_km`, because **ADR-022 ratified `weekly_km` as
the curve §2/§3/§12 enforce**, with the delivered divergence declared and bounded and fixed for injury runners only.
Converting them would reverse a ruling rather than implement one. C1 named "peak `weekly_km` labels" and M7 measured
peak weeks; the three §23/§46 peak-volume rules are what moved.

🔴 **CODE REVIEW FOUND THREE, AND THE FIRST IS THE ONE THAT MATTERS: C1 WIDENS `VERIFIER-STORED-LEVEL-01` FROM 2
RULES TO 9, AND INVERTS THE DIRECTION OF TWO OF THEM.** `storedPlanInput` always sets `input.fitness_level` from
`meta.fitness_level`, `resolveLevels` lets that override win BOTH axes, and nothing reads
`input.fitness_intensity_level` — so a runner at `{12 km/week, 6 km longest, 5yr+}` resolves **`beginner /
intermediate` live and `beginner / beginner` through a stored plan** (probed). `INV-PLAN-QUALITY-NOT-ZERO` and
`INV-PLAN-QUALITY-EXPECTED` both **EXEMPT** a beginner, so on the stored path they check LESS than the deleted
`checkerFitness` did — the opposite of the `stricter` their register entries declare, **because those directions are
measured in a harness that builds the profile from the row's own request.** 📐 Latent on the fleet: `plans_lost: 0`
and `lost_by_rule: {}` across all 44 plans. ⚠️ **But the cut-over cannot run on a reading that is stricter in the
harness and more lenient in production**, so `VERIFIER-STORED-LEVEL-01` is now marked a cut-over blocker and the
register head scopes every level direction to its population.

⚠️ **The second was a direction I had not worked out.** `INV-PLAN-PEAK-IN-PEAK-PHASE` is the one converted rule whose
comparison spans the whole plan (`max` over every non-deload main week), so an unpriceable BASE week leaves it
incomplete, and the first cut refused outright — turning a real, specific finding into a vague one. **Excluding the
week is worse** (a lower `max` makes `peak >= max × 0.9` easier and HIDES an inversion), so neither reflex is right:
an unknown week can only RAISE `max`, which can only make an inversion worse, so **a finding already demonstrated at
the known maximum is reported, and only the absence of one is uncertain.** Four cases, both directions. The third was
a comment stating §46's marathon floor as 52.6 km where 42.2 × 1.25 = 52.75.

🔴 **AND B4'S REGISTER ENTRY NAMED THE WRONG FIELD, WHICH C1 FOUND BY NEEDING TO DISAGREE WITH IT.** It said the
early-onset veto *"reads `profile.levels.intensity`, the assessed level"*. The code reads
`profile.levels.assessed_intensity`, and the difference is the whole ruling: `levels.intensity` is
`declared ?? assessedIntensity`, so it CARRIES the runner's own claim — the hole B4 closes. Every other level rule
reads `levels.intensity` deliberately, because that is the level the planner builds at (§79: a declaration binds
upward on intensity); §89 is the one veto a self-declaration must not unlock. Corrected.

### Where to pick up, in order
1. 🔺 **`VERIFIER-STORED-LEVEL-01` — THE ONLY CUT-OVER BLOCKER, AND IT IS A BUILD, NOT A QUESTION.** The Coaching
   Board ruled it **EXEMPT** on 2026-11-25 (`STORED-LEVEL-AND-C1-SCOPE-01`): §79 already decided it — *"Two inputs,
   two axes — do not merge them … collapsing them is what produced the defect"* — and `fitnessAssessment.ts:201` lets
   the API STRUCTURAL declaration set the INTENSITY axis. A defect fix restoring documented intent. **10 of 44 live
   plans exposed, 9 masked by an upward declaration that coincidentally resolves to the same level.** Spiked: the
   collapse goes 1 → 0 and `verify:parity` is IDENTICAL over 6,210. **Three binding conditions**, of which the one
   parity does NOT cover is that `property-validate-plans.ts` and `r23-phase7-validation.ts` must both run clean.
2. **`ADR027-B3-STRICT-01`**: D2/D3 (named parameters and rule data). ✅ C1 shipped 2026-11-25, and the chair accepted
   its scope correction on §23/§46 grounds. B10 needs a `quality_pool_sizes` week key from the producer; B14 needs the
   §117 reading. ✅ `VERIFIER-RESHAPE-POLICY-01` shipped 2026-11-25 — both port gaps are now closed or ruled.
3. **B3 step 4**: the trigger catalogue, with values unchanged (§124 Am. 1), **plus ARCH-ENG-022** — add `run_analysed` (§124 Am. 1 asked for it) and `run_arrived` with its match outcome; `run_logged` keeps its ratified meaning. Amended 2026-11-25 while the list was still only prose; the mechanical check is this step's.
4. **The founder's cut-over sign-off**, naming the 14 held rules. ✅ **That list is now held to the derived one by
   `lib/engine/verifier/heldRules.test.ts`** (`HELD-RULE-LIST-DERIVED-01`, 2026-11-26): the paragraph above is compared,
   **by name and in both directions**, against `RULES` INV ids minus `PORTED_RULES`, and its own stated count is checked
   too. ⚠️ So **editing that list is now a build-breaking act unless the code agrees** — which is the point, because the
   sign-off is the one document a founder decision is read from and every ported rule shrinks the real set while leaving
   prose untouched.
5. Then B4, starting with 5K/10K, in shadow.

Filed alongside, not blocking B3: `STRENGTH-S13-S14-LIVE-01` (no board; production never runs S13/S14),
`PACE-GUIDE-PROVENANCE-01` (Coaching Board; the no-benchmark paces set 18 of 39 live race plans and have no principle,
needed before B4 adopts them), `HR-MAX-SOURCE-01` (Coaching Board, once plans store the source),
`MONDAY-RACE-TAPER-WEEK-01` (Coaching Board), `STARTVOL-OBSERVED-01` and `TRIGGERS-ON-RUN-ARRIVAL-01` (ruled; land in
B2/B4 and B3/B4b, mockups owed).

### Before resuming
- Re-measure before planning: re-run `npx vitest run lib/engine` and `./scripts/audit-docs.sh`, and re-count the
  verifier's rules. At the pause: `PORTED_RULES` ∪ `BASE_BUILD_RULES` ∪ `MAINTENANCE_RULES` = 157 of the catalogue's
  171 `INV-*` rules, plus all 50 strength rules (`verifyStrength.ts`) = 207 of 221. Do not trust these figures, recount.
- Re-read the sitting `docs/decisions/coaching-2026-11-22-b3-raised-list.md`; it holds the rulings step 2b builds.
- ✅ **Housekeeping DONE 2026-11-25, and the advice it used to give here was dangerous.** The **11 agent worktrees**
  under `.claude/worktrees/` are removed: **743 MB**, gitignored, and the only dirty path in any of them was
  `node_modules`. `git worktree remove` does not touch a branch, so nothing was lost; `tsc` 0 and
  `npx vitest run lib/engine` 307/307 after.
  🔴 **THE `proto/*` BRANCHES ARE KEPT, AND "CLEAR THEM WHEN NO LONGER NEEDED" WOULD HAVE DESTROYED CITED EVIDENCE.**
  All nine 2026-11-20 prototypes are **named 3 to 5 times each** by OPEN backlog items and board sittings — they are
  the measurement behind rulings that have not been built yet (`BASEBUILD-NO-LONG-RUN-01`, `S9-QUALITY-FLOOR-REACH-01`,
  `STEPBACK-SPECIFICITY-SCOPE-01`, `STRENGTH-PAIR-STRIDE-01` and five more). ⚠️ **`npm run backlog:verify` CANNOT CATCH
  THIS: its dead-reference arms check file PATHS and symbols, never a git ref**, so deleting a cited branch is a silent
  loss of the only copy. Delete a `proto/*` branch only when the item that cites it is closed.
  ⚠️ The nine `worktree-agent-*` branches are also kept — a few KB each, and `git cherry` shows 5 of 9 carry a patch
  main does not match (the same work, landed with a different patch), so each would need checking by hand for no gain.
  📐 **Why they accumulated:** `isolation: "worktree"` auto-cleans a worktree only if it is UNCHANGED, and every one of
  these committed, so nothing ever pruned them and nothing in the repo notices 743 MB of gitignored checkouts.
  ⚠️ **And the count here was wrong in both directions** — it said 9 branches and ~19 worktrees; the truth was 10 and 11.

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
| 6 | The long run on the eve of a Monday race | ✅ `MONDAY-RACE-EVE-LONG-RUN-01`, Coaching Board `ADR027-B3-RAISED-LIST-01` ruled it INCORRECT against §39 Am. 1 (race eve protected on any weekday); founder approved the hotfix 2026-11-22 (*"Fix it now"*). The week before a Monday race now gives race eve to §30's shakeout with the week's strides, and `INV-PLAN-NO-RACE-EVE-SESSION` (and the verifier) look across the week boundary. 5 of 5 golden Monday-race plans changed as intended; `verify:parity` IDENTICAL over 6,210 cases, none of which has a Monday race, which proves no other plan moved |

| 7 | The writes that follow a plan save are discarded, so a change can apply with no record of it | ✅ `CONFIRM-REVERT-WRITE-ERRORS-01`, ⚙️ no board (defect restoring what the route contracts already promise), founder approved 2026-11-25. `lib/supabase/applyAnsweredProposal.ts` is the single owner of "the runner answered a proposal, so apply it and record the answer" across all FOUR routes that do that job — `confirm-adjustment`, `revert-adjustment` and, for the first time, `post-race-reshape/confirm` and `/revert`, **the twins `ADJUST-STATUS-WITHOUT-SAVE-01` left behind in October with no `try/catch` and so no `plan_save_failed` event at all.** Both write results are read, the row write is retried once, the status transition is **conditional on the status the route read**, and `proposal_transition_incomplete` records `row_write_failed` / `flag_write_failed` / `conflict` / `retry_landed_first_attempt`. ⚠️ **A lost transition is a 200, not a 500** — the plan has already saved, so a non-200 would show `PLAN_CHANGE_SAVE_FAILED` for a change that applied. 📐 **Latent, never observed:** 27 `plan_adjustments` rows ever, 7 lifetime resolutions, 0 `plan_save_failed` from either route. 🔑 **Deliberately shaped as ARCH-ENG-016's first slice** rather than four inline error reads, so B4b's single writer fills in L5 verify + plan-version concurrency instead of unpicking four routes. 🔻 **Residual: the PLAN write is still last-writer-wins across two devices** — ARCH-ENG-016's job, not closed here |

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
| **ARCH-ENG-022** | **Three run events, not one, and only two of them evaluate triggers.** ⚠️ **`run_logged` is UNCHANGED** — §124 Amendment 1 (Coaching Board, 2026-11-21) ruled it the evaluation event for a runner with no analysis (free, or a manual log), for the activity-log triggers only. **`run_analysed` is ADDED to the list**, which that sitting asked for in as many words: *"ADR-027's event list has `run_logged` but no `run_analysed`; the catalogue needs it (architecture amendment, ⚙️)."* **`run_arrived` is ADDED and is NOT an evaluation event** — the same sitting ruled *"the evaluation event is `run_analysed`, never raw ingest"*, and that stands. It is raised for every run that lands, carrying `{ outcome: 'linked' \| 'unmatched', reason? }` from the existing `RUN_UNMATCHED_REASONS` vocabulary (`no_plan`, `plan_read_failed`, `outside_plan_weeks`, `week_has_no_sessions`, `below_threshold`, `tier_gated`). 🔴 **WHY IT HAS TO EXIST, measured 2026-11-25:** over the 14 days of telemetry, **39 distinct runs reached the matcher and were not linked** (`below_threshold` 18 · `no_plan` 10 · `outside_plan_weeks` 9 · `tier_gated` 2), and **27 of 176 live completion rows carry a run link — 15.3%.** A run that never links produces NEITHER `run_logged` NOR `run_analysed`, so without a third event the whole population is outside the catalogue's reach — and it is the population the SLT identified as the journey's break (`STEP4-RUNS-NO-COMPLETIONS-01`). ⚠️ **ARCH-ENG-013 inherits it:** L1's observed block is assembled from completions, so at that link rate it reads a fraction of what the runner ran, compounding `STARTVOL-OBSERVED-01` (declared above logged for 11 of 15). ⚠️ **AND THE RUN→SESSION MATCHER IS IN NO LAYER.** The HLD puts *"Activity ingest (HealthKit SOR)"* outside the service, which is right — it is I/O — but the judgement inside it is not: *"is this run that session?"* is a pure classifier over facts, scored by rule (`sameWeekday` 40 · distance band 30 · duration band 30; high ≥ 70) with its threshold set by a RULING (POST-RUN-01). It is an L2 rule with an L1-fact input, called by the ingest route, and it earns a row in `engine-truths.md` naming one owner — with the two live gates (`autoMatchAndAnalyse` high, `resolveAutoMatch` medium) recorded as the ruled divergence they are, not as drift. ⚠️ **The mechanical check lands in B3 step 4**, per this section's standing rule. ⚠️ **What `run_arrived` is FOR, and what it is not:** it makes an unmatched run visible — to the catalogue's coverage, to L1's validity, and to the runner (`RUN-UNMATCHED-PROMPT-01`). It does not evaluate a trigger, and giving it one would reverse §124 Am. 1. |
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
| B3 | catalogue + verifier | unchanged, plus the **trigger catalogue** (ARCH-ENG-018) as L2 data, with thresholds moved out of inline literals. **Step 4 also lands the event vocabulary §124 Am. 1 needs (ARCH-ENG-022): `run_analysed` added as that sitting asked, `run_arrived` added carrying its match outcome, `run_logged` unchanged** — plus the matcher's truths-registry row. Folded in 2026-11-25, before the catalogue is built, because the vocabulary is the catalogue's INPUT |
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
