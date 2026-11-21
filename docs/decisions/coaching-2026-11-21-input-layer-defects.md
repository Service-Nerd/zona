# Coaching Board — ADR027-B2B-PROFILE-ADOPTION part 3: three input-layer defects (2026-11-21)

**Trigger:** soft, qualifies. No doctrine file is edited by this sitting. Each defect changes what the engine is
told about a runner, and so what it prescribes (§29, §44, §79), which makes it the board's under ADR-027
ARCH-ENG-014. Source: `docs/decisions/coaching-2026-11-20-final-plan-read.md` cause 5 ("the input layer is
inconsistent with the engine"); backlog `ADR027-B2B-PROFILE-ADOPTION` part 3.

**Proposed changes (one sitting, three rulings):**
- **(a)** the wizard's level recommendation should read the benchmark the engine reads;
- **(b)** §44 should count prep weeks the way the plan counts its weeks;
- **(c)** §29's explicit fresh-return input should be asked for, since nothing sends it.

**Status:** RULED, not built. The current engine is frozen (ADR-027). All three land in **B4**. The board finds
**no active harm that justifies a hotfix** on any of the three (see § Ruling, H).

---

## Evidence

Re-measured 2026-11-21 with a throwaway script (`scripts/_tmp-inputlayer*.ts`, deleted after use), run as
`npx tsx --env-file=.env.local`. Production read-only, service role, aggregates only.

**Populations.** Golden corpus = `goldenCorpus()` (1,152 wizard rows + 4 production rows = **1,156**), each at its own
`asOf` and `planStart`. Live = `plans` rows with `meta.generator_input` and `meta.generated_at`: **32**. Archive = the
same on `plan_archive`: **63**. For production rows the earliest plan start is `nextMonday(generated_at)`, which is
what the route passes to `validatePrepTime`. The item's live/archive denominators (21/36 and 49/62) used a different
filter; both are stated where they differ.

### (a) The VDOT-blind recommendation

Predicate as the item: a benchmarked row (VDOT defined after `vdotFor`'s discount, at the row's `asOf`) where
`recommendFitnessLevel(w, l, exp)` differs from `recommendFitnessLevel(w, l, exp, vdot)`.

| | item | re-measured |
|---|---|---|
| Golden | 51 of 1,060 | **51 of 1,060** (blind lower on 51, higher on 0) |
| Live | 2 of 21 | **2 of 19** benchmarked |
| Archive | 5 of 49 | **5 of 50** benchmarked |

**The predicate is wider than the harm.** A blind recommendation only reaches the engine when the runner accepts it.
Narrowed to rows whose `user_declared_level` equals the blind recommendation:

| | accepted the blind level | structural level moves | intensity level moves |
|---|---|---|---|
| Golden | **28** | **0** | **28** (all `beginner → intermediate`) |
| Live | **0** (both declared the VDOT-aware level) | — | — |
| Archive | **0** (all declared the VDOT-aware level) | — | — |

🔴 **The item says the downward declaration "binds structure (§79)". It does not, on any row, and cannot.** The blind
recommendation is the volume read (or the §79 training-age lift above it); the structural assessment is
`min(byVdot, byVolume)`, never above the volume read. So the blind level is never below `assessedStructural`,
`declaredIsDownward` is never true, and structure is untouched. **What it does bind is intensity:**
`resolveLevels` sets `intensity = declared`, so the benchmark's upward intensity read (§79's "fast but low volume"
case, *"prescribing beginner-level intensity wastes a working engine"*) is erased.

**Effect on the plan (golden, 28 accepted rows, `runEngine` at HEAD, blind vs aware declaration):** 12 refused
both ways; of 16 generated, **13 differ in their sessions** (3 identical). Quality sessions **74 → 82**, time trials
(`type: 'hard'`) **9 → 2**. Per plan, quality rises on 3 of 16 (+1, +3, +4) and is unchanged on 13.
`meta.fitness_intensity_level` is absent on the blind plans and `intermediate` on 12 aware ones.

### (b) Prep weeks counted one short

`validatePrepTime` counts `weeksBetweenLocal(planStart, race_date)` (floor of days ÷ 7). `calcPlanLength` counts
`weeksBetweenLocal(start, raceWeekMonday) + 1`, the plan's weeks including race week.

| | item | re-measured |
|---|---|---|
| Floor drops a partial week (non-Monday race), golden | 974 of 1,156 | **974 of 1,156** |
| live | 36 of 36 | **32 of 32** |
| archive | 57 of 62 | **58 of 63** |
| §44 status changes if a week holding any training day counts (`ceil(days ÷ 7)`), golden | 67 of 1,156 | **67 of 1,156** (block→warn 22, block→ok 6, warn→ok 39) |
| live | 0 of 36 | **0 of 32** |
| archive | 1 of 62 | **0 of 63** |
| §44 status changes if §44 reads the plan's own week count, golden | — | **78 of 1,156** |

🔴 **The finding the item does not state: §44's count is exactly one below the plan's week count on EVERY row** —
1,156 of 1,156 golden, 32 of 32 live, 63 of 63 archive, Monday races included (182 golden). It is not a partial-week
artefact; it is two conventions for one runway. `PLAN_SIGNATURES.min_weeks` and `calcPlanLength` count race week;
§44 does not. A runner warned that *"15 weeks is under the 16 weeks"* is handed a 16-week plan.

### (c) `weeks_at_current_volume` has no writer

`git grep` over `app/` and `components/`: no writer. Sent on **0 of 1,156** golden, **0 of 32** live, **0 of 63**
archive (item: 0/1,156, 0/36, 0/62). §29's own text says *"The wizard surfaces `weeks_at_current_volume` as a
follow-up to the volume question"*. **That sentence is false today.**

**What §29 runs on instead.** The heuristic (`isFreshReturn`: `2-5yr`/`5yr+`, < 25 km/wk, longest < 10 km) flags
**24 of 1,156** golden rows (2.1%). It cannot see a shallow-training-age runner, or an experienced runner who came back
to 25 km/wk or more.

**The stakes of wiring it (upper bound, not a forecast):** answering < 8 weeks on every one of the 1,132 unflagged
rows lowers the effective start on **889** (the rest are held by the `<6mo` cap) and moves §44 on **132**, all
stricter (warn→block 69, ok→warn 41, ok→block 22), through §44's +2-week returning shift. How many real runners would
answer < 8 is **not measured**; nothing collects it.

`npm run measure:fitness` was **not run**: none of its corpora vary any of the three inputs as the fix would, so it
cannot express these changes. It is a build condition (F), not a pass.

---

## 🔍 Conflict scan (sections and amendments)

- **§79 + Am. 2026-08-31/09-02 (user-selectable level, asymmetric binding).** *"Accepting is passed through too"* is
  ratified: an accepted recommendation **is** a declaration. So the recommendation must be a fair read of the
  evidence the runner has given; (a) is §79's own premise failing at the input. The asymmetry (downward binds both)
  is untouched; it is simply not what fires here.
- **§79 Am. 3 (novice re-entry).** Not touched: it fires on an upward declaration, and the blind level is never
  above the assessment.
- **§89 / ADR-021 (early quality onset).** Gated partly on intensity, so a blind `beginner` intensity also closes
  early onset. Not separately measured.
- **§10 and §10 Am. (absence keeps its meaning).** A declared figure is a claim. Governs (c): an unanswered
  `weeks_at_current_volume` is unknown, never "consolidated" and never "fresh".
- **§44 + Am. 2026-08-18 (difficulty band) + DIFFICULTY-SHORTFALL-01.** The band's comfortable margin
  (`DIFFICULTY_COMFORTABLE_MARGIN_WEEKS`) reads the same `weeks_available`, so (b) moves bands as well as status.
  Band movement **not measured**. §44's returning shift reads `weeks_at_current_volume`, so (c) moves §44 too.
- **§76 (plan laid backwards from race week)** and **§17 / `PLAN_SIGNATURES.min_weeks`.** Both count race week; §44
  does not. This is (b)'s whole defect.
- **§29 + NO-RUNNER-TURNED-AWAY-01 C1.** §29 governs declared volume only; observed volume is consolidated.
- **STARTVOL-OBSERVED-01 C3.** A runner who accepts the log is `volume_observed` and §29 is off, so (c)'s question
  has no job for them.
- **§111 Am. 1 / `effectiveStartKm`.** §29's 0.7 start fraction changes §111's denominator, so (c) can stage or
  refuse plans as well as soften them.
- **§2, §3, §52.** Unchanged by any of the three; Willy's §44 check (*"as safe per week and simply arrives lower"*)
  still holds.
- No zone-model translation issue. §1 is not touched.

---

## The board

### 🏃 Alex Hutchinson (Chair)
All three are the same failure. A rule is correct, then reads an input that is wrong about the runner before the
engine sees it. I want the record to carry two corrections to the brief. On (a), structure is never bound: by
construction the blind level cannot sit below the structural read, and on the 28 accepted rows it does not. The harm
is lost intensity, not added caution. And on (a) the live exposure is zero: every live or archived runner on the
differing rows had already declared the higher level. On (b), the honest description is "two conventions", not "a
partial week dropped". One runway, two week counts, shown on one screen.

### 📊 Stephen Seiler
On (a): this is the exact case §79 was written for. A runner who races well on low volume is the one whose
intensity read should be generous, and the wizard asks them to accept a level computed before we have their race.
The measured cost is small, eight quality sessions across sixteen plans, but it lands on the one cohort where it is
the whole point. On (b) and (c), no view on intensity.

### 🎯 Greg McMillan
(b) is the one a runner notices. "Sixteen-week plan" is how every coach and every runner counts: race week is week
sixteen. If we warn someone about fifteen weeks and then hand them sixteen, we look like we cannot count. Count the
way the plan counts. On (c): I ask this at every first meeting, "how long have you been at that?", and the answer
changes the first month more than anything else they tell me. The heuristic only catches the experienced runner at
low volume. It misses the one I worry about most: the runner who went from 10 to 35 kilometres in a month and calls
35 "what I do".

### 🩹 Rich Willy
(c) is a load question and I support asking it. The 24 heuristic rows are the runners who are obviously coming
back. The ones who are not obvious are where tissue lags: recently ramped volume is not consolidated volume. Two
conditions. An unanswered question is unknown, so the heuristic still governs; it is never read as consolidated, and
never as fresh. And it is asked about declared volume only; an accepted log is observed and §29 is off.
On (b) I would rather keep the floor at the block threshold, since that is the refusal edge (block→warn 22,
block→ok 6 on golden). I accept the chair's argument that the table was written in plan weeks, on one condition: the
newly admitted rows are measured by `measure:fitness` before B4 ships. Recorded below.

### ⚕️ Stacy Sims
(c) matters for women returning after pregnancy, illness or a long injury, who often come back to a moderate volume
quickly and sit outside the heuristic's under-25-km window. The question protects them without assuming why they
stopped, and it must not ask why. No objection on (a) or (b).

### 💪 Richard Blagrove
No objection from this seat; no strength rule is touched.

---

## ⚡ Recorded disagreements

1. **(b) at the refusal edge (Willy vs McMillan, chair).** Willy would count conservatively (floor) for `block`
   only, and in plan weeks for `warn`/`ok`. McMillan and the chair: two counts for one runway is the defect being
   fixed, and a split count reintroduces it at the threshold that matters most. **Chair: one count.** Willy would
   change his mind, and the board would revisit the block thresholds rather than the count, if `measure:fitness` on
   the newly admitted rows (block→warn/ok, 28 golden) shows a delivered-plan failure the admitted-before cohort does
   not.
2. **(a) whether an untouched recommendation is a declaration at all.** McMillan floated sending no declaration when
   the runner did not touch the step. The chair declined it: §79 ratified *"accepting is passed through"* to close the
   seam where the runner accepted a level the engine never received, and reopening that seam fixes nothing the
   correct recommendation does not.

---

## ⚖️ Ruling

| Defect | Ruling | Lands |
|---|---|---|
| **(a)** VDOT-blind recommendation | **CORRECT WITH AMENDMENT** | B4 (no hotfix) |
| **(b)** §44 counts one week short | **CORRECT WITH AMENDMENT** | B4 (no hotfix) |
| **(c)** §29's explicit input has no writer | **CORRECT WITH AMENDMENT** (engine should use it); Design Board rules on the question first | B4 (no hotfix) |

### (a) Amendments
- **A1. A recommendation the runner can accept must be computed from all the evidence the runner has given**,
  including the benchmark, discounted by the engine's own owner (`vdotFor` then `recommendFitnessLevel`, which is
  `resolveLevels(...).assessedIntensity` before any declaration). No second copy of the assessment in the wizard.
- **A2. The level the runner accepts is the level the plan is built at** (§79's seam stays closed). If the benchmark
  arrives after the level is shown and changes the recommendation, the runner sees the changed level before the plan
  is built. Where and how is the **Design Board's** (the brief named only (c) for design; (a) needs it too).
- **A3. An active choice is never overridden.** A runner who tapped a level keeps it, up or down; the §79 asymmetry
  applies to it unchanged.
- **A4.** The amendment changes intensity only; structure is unaffected by construction (measured 0 of 28).

### (b) Amendments
- **B1. §44 counts the weeks the plan contains: a week counts if it holds at least one day before race day.** That
  is `ceil(days from plan start to race day ÷ 7)`: equal to `calcPlanLength.weeksAvailable` for every race day except
  Monday, where race week holds no training day and is not counted. One owner of the count, read by §44, the
  difficulty band and the runway note.
- **B2. The thresholds do not move.** The table was written in plan weeks ("marathon builds need 16–20 weeks";
  `PLAN_SIGNATURES` counts the same way). Only the count is corrected.
- **B3.** The runner-facing number in any §44 message is that same count, so the message and the plan agree.

### (c) Amendments
- **C1. Meaning.** The input is the runner's own answer to "how long have you been running about this much?",
  in weeks, about their **declared** weekly volume. It matters only whether it is under
  `FRESH_RETURN_WEEKS_THRESHOLD` (8), so the encoding need distinguish no finer than that; the Design Board owns the
  encoding.
- **C2. Absence is unknown.** Unanswered or skipped, the heuristic alone governs, as today. Never read as
  consolidated, never as fresh (§10 Am.). The §29 sentence *"a value of `null` means consolidated"* is amended to
  this.
- **C3. Not asked when the volume is observed** (STARTVOL-OBSERVED-01 C3, NO-RUNNER-TURNED-AWAY-01 C1).
- **C4. Every existing consequence is kept and is the point:** the 0.7 start (§29), §44's +2-week shift, the
  foundation block's fresh path, and §111's denominator. They are disclosed through the existing notes; the runner is
  not asked why they stopped (Sims).
- **C5. The §29 text is corrected now in substance:** "the wizard surfaces it" is false until the question ships,
  and the principle must say so at the B4 commit at the latest.

### F. Measurement before B4 ships
(i) `verify:parity` on today's corpora: IDENTICAL for every row where none of the three changes applies (benchmark
absent or level actively chosen; Monday race; `weeks_at_current_volume` absent and log not observed);
(ii) a corpus arm that varies each of the three as the wizard will send them, added to `cohort:shape` and
`measure:fitness`, with the (b) newly admitted rows reported separately (Willy);
(iii) re-run this sitting's script on the B4 engine and report both sets of figures.

### H. No hotfix, on any of the three
- **(a):** live and archive exposure is **0**: all 7 differing runners declared the higher level. Golden harm is lost
  intensity on 28 synthetic rows, not load. A wizard-only change would also open §79's seam (A2) without a design.
- **(b):** **0 of 32** live and **0 of 63** archive status changes. The harm is honesty about a count, with no
  measured prescription harm.
- **(c):** needs a new wizard question (Design Board), and its consequences are large and stricter (132 §44 moves on
  the upper bound), which is a planned change, not a patch. The engine already reads the field, so the freeze does
  not block it technically; it is held to B4 so it is measured with (F) rather than shipped into a frozen engine.

### 📦 Required artifacts (for the B4 commit, not this sitting)
1. **Principle.**
   - §79 Amendment: *"A recommendation the runner may accept is computed from all the evidence they have given,
     benchmark included, by the engine's own assessment; the level accepted is the level built."*
   - §44 Amendment: *"Prep weeks are the weeks the plan contains: a week counts when it holds at least one day
     before race day. The thresholds are in those weeks."* Cross-reference §17, §76.
   - §29 Amendment: C1–C5, replacing *"a value of `null` means consolidated"* and the false *"the wizard surfaces"*
     sentence.
2. **Numeric.** No new constant. (a) and (b) correct a count and a call; (c) uses
   `FRESH_RETURN_WEEKS_THRESHOLD`. Inventing one would be decorative config (`configConsumer.test.ts`).
3. **Invariant / check.**
   - (a): an L1 test that the wizard's accepted level equals `recommendFitnessLevel` with `vdotFor(input).vdot`
     for a benchmarked input with no active choice, falsified by removing the VDOT argument (today's code).
   - (b): `INV-PLAN-PREP-WEEKS-MATCH-PLAN` (error): `meta.prep_weeks_available` equals the count of plan weeks
     holding a training day before race day; falsified by restoring the floor.
   - (c): a wizard-shape check that `weeks_at_current_volume` is sent when answered and absent when skipped (not 0),
     and that it is absent whenever `volume_observed` is true.

### ↗️ Hand-offs
- **🧭 Design Board** rules **before build** on (c)'s question (placement, encoding, skip) and on (a)'s A2 (how a
  recommendation that changes after the benchmark is shown before the plan is built).
- **💼 SLT:** none. All three are FREE input honesty.

---

## What this does not prove
- **(a)** is measured on synthetic golden rows; production shows **zero** exposure, so the harm is a prediction for
  future benchmarked runners who accept, not an observed one. The 12 rows refused both ways are not analysed.
- **(b)** does not show the plan-week convention is the better coaching measure, only that it is the convention the
  thresholds and the plan already use. The 28 newly admitted golden rows are not yet measured for plan fitness.
  Difficulty-band movement is not measured.
- **(c)**'s 889 and 132 are an upper bound assuming every runner answers under 8 weeks. The real answer distribution
  is unknown, and so is whether runners answer the question accurately.
- The live and archive denominators differ from the item's (filter on `generated_at`); both are stated.
- No injury or pain outcome is measured; the product has no such signal.
