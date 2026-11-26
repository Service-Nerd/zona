# Engine truths — one owner per truth

**ARCH-ENG-002** (ADR-027): *"A canonical truth registry (`docs/canonical/engine-truths.md`): one
owner per truth."* The HLD names it too, with the check *"a test fails if a second writer appears."*

🔴 **This file did not exist until 2026-11-26, and neither did that test.** ADR-027 has named it
since the HLD was written; B3 step 4a is the first item to need a row in it, which is what surfaced
the absence — `backlog:verify`'s dead-file arm fired the moment an item cited the path. **A
registry named by an architecture decision and never created is the same shape as a gate nobody
reads: it is cited as though it constrains something.**

⚠️ **It is incomplete on purpose and says so.** L3 and L4 do not exist yet, so their truths have no
owner to name and are listed as `— not built —` rather than left out. **An incomplete registry must
say it is incomplete**; a row quietly missing reads identically to a truth nobody has thought about.

---

## The registry

| Truth | One owner | Layer | Notes |
|---|---|---|---|
| **Who the runner is** | `buildRunnerProfile` (`lib/engine/profile/buildRunnerProfile.ts`) | L1 | Produced from a `RunnerFacts` snapshot. Every derived field delegates to the function that owned it before L1, named on the field. |
| **What we believe** (the rules) | `RULES` (`lib/engine/catalogue/rules.ts`) | L2 | 221 entries. A rule references its § and its config key and never copies a value (ARCH-ENG-003). |
| **Why a run produced no read** | `RUN_UNMATCHED_REASONS` (`lib/engine/contracts/runOutcome.ts`) | L2 | Moved here from `lib/coaching/autoAnalyse.ts` in step 4a; that module re-exports it, so there is one definition and no consumer churn. |
| **The run event vocabulary** | `RUN_EVENTS` (`lib/engine/contracts/events.ts`) | L2 | Three events, two of which evaluate triggers (Coaching Board 2026-11-21 — ADR-027 cites a §124 amendment that does not exist). ⚠️ **Nothing emits them yet, and step 4b did NOT change that** — this cell said *"step 4b wires the catalogue"*, which 4b explicitly does not do. Raising them on data arrival is `TRIGGERS-ON-DATA-ARRIVAL-01`. |
| **The adjustment trigger vocabulary** | `TRIGGER_TYPES` (`lib/engine/contracts/triggers.ts`) | L2 | Ten types, **eight** of which we DETECT; the other two are the runner telling us. Moved out of `lib/coaching/planAdjustment.ts` in step 4b so L2 need not import the plan engine (ARCH-ENG-001); that module re-exports it, so one definition and no consumer churn. The honest count of things we watch for is 8, not 10 — `ADJUST-TRIGGER-MANUAL-DEAD-01`. |
| **When a trigger may be evaluated** | `TRIGGER_RULES` (`lib/engine/catalogue/triggers.ts`) | L2 | The ARCH-ENG-018 catalogue, as data: event → threshold symbols → what it raises. ⚠️ **It holds no conditions and no priority order, deliberately** — `planAdjustment.ts` owns the predicates and `triggerInputs.test.ts` observes the order by peeling, so the catalogue cannot drift from either. Nothing evaluates it yet. |
| **Is this run that session?** | `findMatchCandidates` + `scoreMatch` (`lib/coaching/sessionMatch.ts`) | **L2 rule, L1 fact input** — see below | Called by the ingest route. **Two ruled gates, not drift.** |
| **Is the plan right?** | `verifyPlan` (`lib/engine/verifier/verifyPlan.ts`) | L5 | 207 of 221 rules; 14 held, named in ADR-027 and gated by `heldRules.test.ts`. |
| **The delivered plan** | — not built — | L3 | B4. Today `generateRulePlan` (`lib/plan/ruleEngine.ts`) owns it, outside the service. |
| **Decisions** | — not built — | L3 | B4. ARCH-ENG-009: notes are generated only from Decision records. |
| **Explanations / notes** | — not built — | L4 | B5. |

---

## The run→session matcher, and why it earns a row

🔴 **IT IS IN NO LAYER, AND THAT IS THE FINDING.** The HLD places *"Activity ingest (HealthKit
SOR)"* outside the service, which is right — that part is I/O. **The judgement inside it is not.**
*"Is this run that session?"* is a pure classifier over facts, scored by rule, with its threshold
set by a ruling. It is an **L2 rule with an L1-fact input**, called by the ingest route — and
because it sat in neither layer, it has never been subject to either layer's discipline.

### The scorer, as the code actually has it

⚠️ **ARCH-ENG-022 describes this scorer and its description is incomplete.** It says
*"`sameWeekday` 40 · distance band 30 · duration band 30; high ≥ 70"*. Re-derived from
`scoreMatch` on 2026-11-26:

| Component | Points | Condition |
|---|---|---|
| Same weekday | **40** | Calendar-weekday equality, not day distance. Sunday equals Sunday across a week boundary; the ±2-day candidate window already bounds real time apart |
| Distance band | **30** | `actual / planned` within **0.75–1.40**. Deliberately asymmetric: the band is wider above, because this product's runners routinely add 2–3 km to an easy session |
| Duration band | **30** | Duration-primary sessions only, `actual / planned` within **0.85–1.15** |
| **Effort alignment** | **10** | **Absent from ARCH-ENG-022.** Easy or recovery session with average HR under 155 |

**Bands:** `high ≥ 70` · **`medium ≥ 40`** (also absent from ARCH-ENG-022) · `low` below that.

### Two gates, and they are a RULED divergence

| Gate | Value | Ruling |
|---|---|---|
| `MIN_AUTO_LINK_CONFIDENCE` (`sessionMatch.ts`) — server, silent auto-link | **high** | `POST-RUN-01`: *"a wrong link is worse than a picker tap."* No user action, so the bar is the high one |
| `resolveAutoMatch` (`sessionAutoMatch.ts`) — client, what to SHOW | **medium allowed** | `AUTO-MATCH-02`: the run's name, distance and time are all on screen and **tapping is consent** |

⚠️ **Same source data, different consequence — that is the whole reason they differ, and until this
row existed the reasoning lived only in a source comment.** `LOG-ONE-INTENTION-01` made
`resolveAutoMatch` the single client-side owner for the same reason this registry exists: the
calculation had been inline in one screen, so a second screen could not ask the question and offered
the runner a choice instead.

### What it costs today

📐 **Measured 2026-11-25:** **27 of 176 live completion rows carry a run link — 15.3%** — and **39
distinct runs reached the matcher unlinked over 14 days** (`below_threshold` 18 · `no_plan` 10 ·
`outside_plan_weeks` 9 · `tier_gated` 2). A run that never links raises neither `run_logged` nor
`run_analysed`, which is why `run_arrived` exists. ⚠️ **ARCH-ENG-013 inherits it:** L1's `observed`
block is assembled from completions, so at that link rate it reads a fraction of what the runner ran.

🔻 **Not ruled here.** Whether the thresholds or the bands are right is a Coaching Board question and
nothing in step 4a changes a number. This row records what the owner IS, what it scores, and which
divergence was ruled — so the next person asking does not have to reconstruct it from comments.
