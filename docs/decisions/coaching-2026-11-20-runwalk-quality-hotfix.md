# Coaching Board, 2026-11-20: run-walk stamped on quality sessions and the 5K time trial (ADR-027 hotfix 1)

**Input:** ADR-027 founder decision 2 (hotfix: "run-walk on a maximal TT"), and the final plan read
(`coaching-2026-11-20-final-plan-read.md`, marathon slice: *"Run-walk stamped on tempo, intervals and the maximal TT"*).
No backlog item exists. This note names the ruling `RUNWALK-QUALITY-HOTFIX-01` so the build has a scope.
**Trigger:** soft trigger that qualifies. The fix changes what a run-walk runner is told on two session kinds.
The doctrine files it lands in (`CoachingPrinciples.md` §117, and `invariants.ts`) are the build's job, not this note's.
**Board:** all six seats. Blagrove has no strength question here and is silent.

⚠️ **Numbering.** The brief asked for "§117 Am. 7". **Am. 7 (2026-11-07) and Am. 8 (2026-11-12) already exist**, so this is
**§117 Amendment 9**.

⚠️ **Callers.** The brief named three callers of `applyRunWalk`. There are **four**: `ruleEngine.ts:10758` (the §117 Am. 4
pass), `foundationCompose.ts:93`, `stagedRacePlan.ts:444`, and **`walkRunStart.ts:228`** (`composeWalkRunStart`, the §116
ramp). The last three only stamp easy-only weeks: ramps are held all-easy by `INV-PLAN-ONRAMP-ALL-EASY`. For foundation
weeks the all-easy claim is **not measured** here. So the quality and time-trial cases this note measures come from the
first caller only.

---

## 1. Analysis (before any seat spoke)

### Population, re-derived on the production input shape

The scratch scripts are read-only and live in the session scratchpad (`rwq/measure.ts`, `probe.ts`, `shape.ts`,
`tt.ts`, `ttgate.ts`, `ttdiff.ts`, `prod.ts`). Run with
`npx tsx <script>`. No corpus row sets `fitness_level`; each script counts this (`setLevelRows: 0` in all four).

| corpus | inputs | finish-goal | `run_walk_prescribed` | plans with a stamped **quality** session | plans with a stamped **TT** |
|---|---|---|---|---|---|
| `cohortGrid` (full) | 41,472 | 20,736 | 864 | **432** (4,104 sessions) | 0 |
| `targetedGrid` (core + extra, full) | 6,170 | 6,162 | 5 | 0 | 0 |
| `audit:plans` beginner-marathon grid (built as `audit-plan-quality.ts` builds it) | 6,480 | 6,480 | 2,134 | 0 | **250** (551 sessions) |
| independent-lr probe (5K/10K/marathon, `user_declared_level`, lr 0–2 km [marathon 0–8]) | 20,088 | 20,088 | 14,526 | **9,612** (63,828 sessions) | **768** (1,392 sessions) |
| **production** `plans` table (service-role read) | 43 | — | **0** | 0 | 0 |

- **Why the probe exists.** `cohortGrid` derives the longest run as `max(3, 0.4·cw)`, so it can never place a 5K or 10K
  runner below Am. 5/Am. 8's 25% bar. Its prescribed plans are therefore all marathon. The probe varies the longest run
  independently, and it is where most of the population sits: probe plans with a stamped hard session are 5K 3,240 ·
  10K 4,752 · marathon 1,908. ⚠️ The probe includes contradictory declarations (for example "experienced" and
  "regular quality" at 0 km/week). That is what makes its counts an upper bound, not a production rate.
- **Quality rows that carry "Run 6 minutes, walk 1"** (probe): progressive tempo, continuous tempo, cruise intervals
  (both lengths), over-unders, CV intervals, 1600 m repeats, the threshold pyramid and ladder, classic/short/long
  intervals, 30/30s, and hill reps. That is 14 rows. `cohortGrid` has 7 of them.
- **How the runner reaches quality (§79).** Every quality-stamped plan is **structural beginner** with an intensity level
  of **intermediate or experienced**. `cohortGrid` splits 216/216; the probe splits 4,806/4,806. Structure triggers the
  prescription (Am. 5/Am. 8 read the structural level), and the §79 intensity lift adds the quality.
  **Structural = intensity = beginner gives no quality at all** (beginner-marathon grid: 0 quality, 250 TT).
  The TT reaches beginners on purpose: §78 types it `hard` so it is placed on zero-quality plans.
- **Production: latent.** Of the 43 live plans, 0 carry `run_walk_prescribed`, so no live plan is affected. Live-plan
  policy is new plans only, so there is nothing to remediate.

### What the runner actually sees, measured

- **The stamp is a text line and nothing else.** On 400 sampled stamped quality sessions per corpus, `composeSession`
  produced a walk warm-up **0 of 400** times, `displayDerivedSet` returned a run-walk set **0 of 400** times, and **400 of
  400** carry their own `derived_set`. The 400 sampled time trials show the same: 0 walk warm-ups and 0 run-walk sets.
  `asRunWalk` is called only from the easy/long and shakeout branches, and `RUN_WALK_SHAPES` (Am. 6's own build) excludes
  quality and race shapes in so many words.
  🔴 **The final plan read's claim that "asRunWalk turns the warm-up into a walk" on these sessions did not reproduce.**
  The only visible defect is `SessionPopupInner`'s **HOW TO RUN IT** block, which renders `run_walk_strategy` for any
  session. It appears directly beside steps that say something else:
  - *"5km cw0 lr0 W10 Continuous tempo: 15 min warm-up, then 22 min sustained at 6:30–7:30 /km"* sits under *"Run 6
    minutes, walk 1. Repeat. Take the walk break before you need it, from the first rep."*
  - The time trial's own note reads *"Warm up easy for 10 minutes, then 5 km as hard as you can hold"*. It is drawn as a
    10 min jog, strides, and a continuous 5 km.
- **Load does not depend on the stamp.** No reader of `run_walk_strategy` exists in `planFitness`, `measure-plan-fitness`
  or `planQuality`. `planQuality` reads only the meta flag. The stamp is the last pass before `validatePlan`, so removing
  it from a session changes **zero minutes and zero km** by construction. `measure:fitness` was **not run**, because
  nothing it reads can move.
- **The continuous demand underneath.** In the beginner-marathon grid the TT is **35 min**, plus the 10 min warm-up and
  strides. The first TT falls in weeks **3–11**. Every other running session in the same plan is drawn as 6-minute run
  bouts. In the probe, 5K and 10K TT plans have a declared longest run of 0–2 km, so for a 5K runner a continuous maximal
  5K is the race itself, early in the block.

### The options, measured (in-memory, read-only)

| option | plans changed | `validatePlan` delta |
|---|---|---|
| **(a)** no run-walk stamp on quality **and** TT | 432 / 250 / 9,900 (cohort / beginner-mara / probe) | **only** `INV-PLAN-RUNWALK-PRESCRIBED` error, on exactly those plans. That arm is what the amendment changes. Nothing else. |
| **(b)** run-walk-prescribed runners get no quality / TT (approximation: hard sessions converted to easy) | 432 / 250 / 9,900 | errors from `INV-PLAN-QUALITY-EXPECTED`, `-QUALITY-NOT-ZERO`, `-COPY-MATCHES-SESSIONS`, `-DISPLAY-ZONE-MATCHES-WORK`, `-LONG-IS-LONGEST` (7,920 probe), `-REENTRY-OMISSION-DECLARED` (2,652), `-EASY-PACE-PRESENT`, `-MAX-WEEKDAY-MINS` (144 cohort), `-RECALIBRATION-HAS-SESSION`. This is a §9/§79/§78 prescription change, not a hotfix. |
| **(b′)** no TT only, through the producer's own "no slot" path (`min_slot_km` forced high for these inputs) | 250 / 768 | the week is dropped from `recalibration_weeks` on 250/250 and 768/768; no refusals change; **but** the deload week's long run grows **104 → 120 min** in every plan inspected; `INV-PLAN-DELOAD-IS-A-REDUCTION` warns 2 / 48; `INV-PLAN-DELIVERED-RAMP` warns 9 / 15 cleared. Not load-neutral. |
| **(c)** TT exempt, quality stamped | 250 / 768 | `INV-PLAN-RUNWALK-PRESCRIBED` error on those plans only |

### Settled-ground and conflict scan (sections and amendments)

- **§117 Am. 3** (Willy, McMillan): the walk break is PRESCRIBED, a named interval on every running session. This is the
  text the stamp implements. Its argument is about **time on feet** (*"'run 40 minutes, walk if you need to' is a dare"*).
  It says nothing about quality or a benchmark, because at ratification (2026-09-20) §117 runners were beginner
  marathoners with no quality.
- **§117 Am. 5 / Am. 8** widened the prescription to the structural axis and to 5K/10K. These are the amendments that
  first allowed a §79-lifted runner to be both stamped and given quality. **Neither scanned the quality interaction**;
  that is the omission, not a contradiction.
- **§117 Am. 6** (steps): it drew run-walk only for `easy_run`, `long_run` and `shakeout`, and stated *"the race and
  quality shapes are not drawn as run-walk"*. It **included the race** on purpose: *"race day is where the walk break
  protects the last 10 km (Willy, Sims)"*. The race is not drawn as steps; *"its 'How to run it' line carries the
  prescription"*. **This is the precedent for the TT.** Am. 6's addendum also ruled that on a run-walk session the
  warm-up is a brisk walk (`RUNWALK_WARMUP_WALK_MINS`, 5).
- **§78**: the benchmark is a maximal-effort measurement; beginners get it too, and withholding measurement is
  "backwards". **§78 Am. 2**: *"A missed benchmark costs a stale pace; a long run on legs a maximal 5K has just emptied
  costs tissue"*. Tissue outranks measurement when they conflict. **§78 Am. 1**: TT notes are instruction, and the
  measurement and log sentence is protected by `INV-PLAN-COACH-NOTES-MATCH-INTENT`.
- **§79**: intensity governs hardness and structure governs volume. The lift that admits quality here is ratified and is
  **not** reopened by this sitting.
- **§16 / `SESSION_FORMAT`**: every run has a warm-up. Am. 6's addendum already settled that a run-walk warm-up may be a
  walk.
- **ADR-014**: recalibration is prompted and confirmed, and a logged TT time feeds it.
- **Five-zone model**: no zone language is in dispute.

---

## 2. The sitting

### 🏃 Alex Hutchinson (Chair)
Read the measurement before the framing. The stamp on a quality session is **not a protection that is being removed**.
It is a sentence that contradicts the steps printed beside it: 0 of 400 sessions draw it, and it moves no minute. A
runner handed *"22 minutes sustained"* and *"run 6, walk 1, take the walk before you need it"* has been given two
instructions, and McMillan's own test says that is a dare, not a session. The time trial is a different question. It is
a measurement, and a measurement is only worth what its conditions are. A run-walk 5K is a valid measure of what *this*
runner will race. It under-reads continuous VDOT, so recalibrated paces err slow. For a finish-goal run-walk runner that
is the safe side, and I will accept it if it is recorded. §78's second purpose, breaking a depressed max-HR loop, is
served less well by bouts than by a continuous effort. I record that as a real cost, not a free win.

### 📊 Stephen Seiler
No distribution question. The TT is typed `hard` and counts against nothing. Quality counts are unchanged under every
option except (b), and (b) is a §1/§79 ruling dressed as a hotfix. I would not take it on a corpus simulation.
On quality: a threshold session's recoveries *are* its structure. Overlaying 6/1 on 1600 m repeats is not a
recreational adaptation, it is noise. No objection.

### 🎯 Greg McMillan
Am. 3 was my objection, so I will say what it was about: a runner told *"walk if you need to"* runs until they can't. It
was about **the runs where time on feet is the job**. On a tempo the rep and the recovery *are* the instruction you
follow. Put "run 6, walk 1" on CV intervals and you have taken a session and made it a dare again, which is the exact
thing I objected to. Strip it from quality.
On the trial: a first-timer's benchmark in the real world is a parkrun with walk breaks. That is what I give them and it
tells me what I need to know. But it has to read as **one** instruction: walk the warm-up, run-walk the 5 km as fast as
you can, log the time. Right now it says jog ten minutes, do strides, run five kilometres flat out, and also walk every
six minutes. Pick one.

### 🩹 Rich Willy
Mine is the load half of Am. 3, and it binds the same way: the walk break is what makes the lower dose honest. Two
findings.
**Quality.** I agree the stamp protects nothing today, because nothing draws it. But be clear what stripping it leaves:
a 5K runner with a declared longest run of 0 doing a 15-minute jog and then 22 minutes continuous at threshold in week
10, when every other run in their plan is six minutes long. **That continuous demand is not made safe by this hotfix and
I do not rule it safe.** It is unchanged by option (a). It is the §79 lift meeting Am. 5's readiness trigger, and it
needs its own sitting with `measure:fitness` in front of it. I accept the hotfix because it removes a contradiction
without adding load, on the condition that this is recorded as open.
**Time trial.** I refuse option (c) as written. Stripping the walk break from the TT turns a contradiction into an
unambiguous instruction to run 35 minutes continuously at maximal effort, plus a 10-minute jog. It comes as early as week
3, for runners whose plan has never asked for more than six minutes at a time, and for 5K runners whose longest run is
0–1 km. That is the most acute continuous load in the block, delivered to the cohort prescribed run-walk *because* they
cannot yet run continuously. §78 Am. 2 already ruled that tissue outranks the measurement. Option (b′) is not the answer
either: it measurably grows the deload long run by 16 minutes, so it is not a no-op. The race is run-walked by ruling
(Am. 6). A 5K benchmark is a 5K race. Run-walk it, and make the whole session say so.

### ⚕️ Stacy Sims
I agree with Willy on the trial. The 5K/10K finish-goal beginner cohort the probe reaches is heavily the first-race
female runner in her thirties and forties, with a low base, which §117's recorded trade already names. A maximal
continuous effort from a run-walk base is a poor bone-loading step for her, and a run-walked best effort is not. I have
no female-specific objection to stripping the line from quality. I second Willy's point that the continuous quality
demand underneath is open.

### 💪 Richard Blagrove
No objection from this seat. Nothing here touches strength.

### ⚡ Recorded disagreements
- **Hutchinson and Willy, on the time trial's second purpose.** Hutchinson: a run-walked effort serves §78's max-HR loop
  less well than a continuous one. Willy: that is the price §78 Am. 2 already priced, and tissue wins. **Settled for
  this hotfix in Willy's favour, with Hutchinson's cost recorded.** It would change if outcome data showed run-walk TTs
  systematically failed to lift a depressed max HR; no such data exists.
- **Willy's standing objection (not a disagreement, a condition):** continuous quality for runners whose readiness to
  run is in question (Am. 5's trigger) is unruled, and this ruling does not rule it safe.

---

## 3. Ruling: **CORRECT WITH AMENDMENT**

Option (a) for quality. **Option (c) refused for the time trial (Willy).** Instead, the TT stays run-walked and is
made one coherent instruction, by Am. 6's race precedent and §78 Am. 2.

### Principle: §117 Amendment 9 (text for the build)

> ### §117 Amendment 9 — the walk interval belongs to time on feet; a quality session carries its own structure, and the benchmark is run-walked like the race *(Coaching Board 2026-11-20, `RUNWALK-QUALITY-HOTFIX-01`, ADR-027 hotfix 1)*
>
> **Principle.** On a `run_walk_prescribed` plan, Amendment 3's named interval is stamped on every running session
> **except a quality session** (`quality`, `intervals`, `tempo`). A quality session's reps and recoveries are its
> instruction. Laying "run 6, walk 1" over them gives the runner two instructions, which is the dare Amendment 3 exists
> to remove. **The 5K time trial (§78) keeps the interval**, as the race does under Amendment 6. It is a benchmark run
> the way this runner will race: the warm-up is the brisk walk of `RUNWALK_WARMUP_WALK_MINS`, with no strides; then
> 5 km at the runner's best run-walk effort; then the measurement-and-log instruction (§78 Am. 1), unchanged.
>
> **Why.** Amendments 5 and 8 widened the prescription to §79-lifted runners. A structural beginner whose intensity
> reads intermediate or experienced gets quality, so the stamp reached quality sessions no ruling had contemplated.
> On 2026-11-20 the cohort grid had 432 plans with a stamped quality session and an independent-longest-run probe had
> 9,612. The stamp was drawn on none of them: 0 of 400 sampled sessions drew a walk warm-up or run-walk steps. It was a
> line of text contradicting the steps beside it, and it carried no load. The time trial (250 beginner-marathon plans,
> 768 probe plans) is 35 minutes at maximal effort, as early as week 3, in plans that otherwise never ask for more than
> six minutes of continuous running. Removing the interval there would make that load unambiguous for the cohort
> prescribed run-walk because it cannot yet run continuously. §78 Am. 2 already ruled that tissue outranks the
> measurement.
>
> **Recorded cost (Hutchinson).** A run-walk 5K under-reads continuous VDOT, so a recalibration (ADR-014) built on it
> errs slow, the safe side for a finish-goal runner. It serves §78's max-HR purpose less well than a continuous effort.
>
> **Not ruled (Willy, binding as a record).** Continuous quality work for a runner who meets Amendment 5's readiness
> trigger is unchanged by this amendment and is **not** ruled safe. It needs its own sitting with `measure:fitness`.
>
> **Config.** None new. `RUNWALK_WARMUP_WALK_MINS` (Am. 6) and the 6/1 minutes (Am. 3/6) are reused.
> **Owner.** `lib/plan/runWalkPlan.ts → applyRunWalk` decides which sessions carry the interval; all four callers
> inherit it. `composeSession`'s time-trial branch draws the run-walk warm-up.
> **Enforced by** `INV-PLAN-RUNWALK-PRESCRIBED` (amended) and a behavioural test (below).

### Numeric
**None.** No new constant. The build reuses `RUNWALK_WARMUP_WALK_MINS`, `FINISH_GOAL_RUNWALK_RUN_MINS` and
`FINISH_GOAL_RUNWALK_WALK_MINS`. `configConsumer` cannot move.

### Invariant: `INV-PLAN-RUNWALK-PRESCRIBED`, amended (two arms, one code)
1. **Required arm (narrowed):** on a `run_walk_prescribed` plan, every session that is not rest, cross-train, strength
   **or a quality session (`isQualitySession`)** carries `run_walk_strategy`. The `hard` TT is still required.
2. **New forbidden arm:** a quality session (`isQualitySession`) on any plan that carries `run_walk_strategy` is an
   `error`.
   **Liveness:** the existing mutation (delete the stamp) still wakes arm 1. Arm 2 needs a new mutation, *"stamp a
   quality session"*, so `invariantLiveness.test.ts` does not baseline it as unproven.
   **Row:** amend the `plan-invariants.md` entry.
   The time trial's walk warm-up and its note are read-time and text. They are held by a **behavioural test**, not an
   invariant, as Am. 6 was (`runWalkSteps.test.ts` precedent).

### Conditions on the build
1. **Fails before, passes after.** A test over the cohort grid plus an independent-longest-run probe:
   - 0 stamped quality sessions;
   - every TT on a prescribed plan is stamped, with a walk warm-up of `RUNWALK_WARMUP_WALK_MINS`, no strides, and the
     5 km main unchanged;
   - the TT's note says nothing that contradicts run-walk;
   - plan km and minutes are **byte-identical** to before on every generated plan.
   Falsify it by reverting `applyRunWalk`.
2. **TT copy.** The board owns the meaning of the TT's first note. Its wording is brand: *walk briskly 5 min; 5 km at
   your best effort keeping the run 6, walk 1 pattern from the first rep; cool down easy*. The founder may reword it.
   The measurement-and-log note is untouched, and `INV-PLAN-COACH-NOTES-MATCH-INTENT` must stay green. The new text has
   **not been measured against that invariant**.
3. **Report** `review:coaching --fast` before and after. Per Am. 5's standing condition on any run-walk change, also
   report **served → refused and refused → served as counts of named cohorts**. Both are expected 0, because nothing in
   generation reads the stamp, but that is expected, not measured.
4. **Live plans.** 0 of 43 are prescribed, so there is nothing to remediate.

### Hand-offs
- **Design Board: none required.** The TT's main set is not redrawn; the race precedent carries the interval in the HOW
  TO RUN IT line. Only the warm-up part, which the composer already draws, changes. If the build chooses to draw TT
  run-walk *steps*, that is an encoding change and goes to the Design Board (§21b Am. 4c precedent).
- **Founder:** TT first-note wording (condition 2).
- **SLT:** none.

---

## 4. What this does not prove
- **No production runner has been affected and none was measured.** Of 43 live plans, 0 are prescribed. Every
  population figure is from corpora. The probe's 9,612 is an upper bound that includes contradictory declarations.
- **Option (b) was approximated**, by converting sessions after generation, not through the producer. Its invariant list
  says that (b) is a prescription change. It does not measure what (b) would deliver.
- **`measure:fitness` was not run.** Option (a) cannot move it by construction, because no reader of the stamp exists in
  any fitness or quality harness. Option (b′) can move it and was not taken.
- **The TT note rewrite and the composer warm-up are not built**, so their effect on `INV-PLAN-COACH-NOTES-MATCH-INTENT`
  and on drawn totals is not measured.
- **Foundation weeks** were not measured for quality or TT. The claim that they are easy-only is inferred, not run.
- **The continuous quality demand Willy names is not measured** beyond the sampled sessions quoted above, for example a
  22-min continuous tempo at lr 0.
- **Falsified:** option (a)'s `validatePlan` delta is exactly the `INV-PLAN-RUNWALK-PRESCRIBED` arm it amends, on exactly
  432 / 250 / 9,900 plans. Removing the stamp from quality sessions makes that check fire on 100% of affected plans, so
  the required arm is shown capable of firing on this population.
