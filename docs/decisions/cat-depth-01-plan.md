# CAT-DEPTH-01 — resolution plan and impact analysis

*Scoped 2026-09-19. Every number below is measured on this repo at `2a79829`, not
estimated. Probes were applied, measured, and reverted; the working tree is clean.*

**Status: a plan to take to the Coaching Board. Nothing here is built.**

---

## 1. The problem is THREE independent gates, not a thin catalogue

CAT-DEPTH-01 has been recorded for weeks as "the catalogue is thin". That is one
of three gates, and **it is not the binding one.** Measured:

| # | Gate | State | Evidence |
|---|---|---|---|
| 1 | **The quality SLOT** | `QUALITY_SESSIONS_PER_WEEK_MAX.beginner = 0`, so `includeQualityCount = min(plannedQuality, 0) = 0`. A beginner never gets a quality slot for a row to fill. | Probe 1 below |
| 2 | **The catalogue ROWS** | 1 of 29 rows is `fitness_level_min: 'beginner'` — `aerobic_steady`, category `aerobic`, `intensity_zones: ['Z2']`, phases `base,build`. **Zero** beginner-eligible rows in **peak** or **taper**, at any category. | Inventory below |
| 3 | **The DOSE tables** | **4 of 6** fitness-keyed config tables have no `beginner` key: `VO2MAX_WORK_TARGET_MINS`, `THRESHOLD_WORK_TARGET_MINS`, `SESSION_WORK_OVERRIDE_MINS`, `PROGRESSIVE_TEMPO_MAIN_MINS`. They are typed `Record<string, …>`, so a missing key is a **runtime `undefined`, not a compile error**. | Probe 3 below |

**They must be fixed together and in order.** Fixing any one alone is either a
no-op or a crash, both proven below.

### Catalogue inventory, by phase (the gap, exactly)

| phase | categories available to intermediate+ | **available to a beginner** |
|---|---|---|
| base | aerobic | aerobic |
| build | aerobic, threshold, vo2max, ultra_specific | aerobic only |
| **peak** | race_specific, threshold, vo2max, ultra_specific | **nothing** |
| **taper** | race_specific, threshold | **nothing** |

29 rows total: threshold 9, race_specific 7, vo2max 6, ultra_specific 4, aerobic 3.

---

## 2. The constraint that shapes everything: `fitness_level_min` means "and everyone above"

`selectCatalogueSession` filters on
`FITNESS_RANK[row.fitness_level_min] <= userRank`. **A row marked `beginner` is
eligible for every level.** The rotation is least-used-first, so a new row starts
at usage 0 and is picked *first*.

### Probe 1 — add one beginner-eligible row (reverted)

Added a single throwaway `threshold` row, `fitness_level_min: 'beginner'`,
phases build+peak, 5K/10K/HM/MARATHON. `npm run verify:parity`:

```
2324 of 5940 cases CHANGED  (39.1%)
level   beginner 0/1980      intermediate 1166/1980 (58.9%)   experienced 1158/1980 (58.5%)
```

**Zero beginner plans changed. 59% of everyone else's did.** The exact inverse of
the intent, and a direct breach of the founder's constraint that nothing we add
may negatively affect existing plans. Beginners gained nothing because gate 1
(the slot) still held.

### Probe 2 — LOWER an existing row instead (reverted)

Changed `progressive_tempo` from `intermediate` to `beginner`:

```
✓ IDENTICAL — 5940 cases, byte-for-byte unchanged.
```

**Lowering an existing row is free.** It cannot change a non-beginner's pool —
the row was already eligible for them — and it is inert for beginners until
gate 1 opens. This is the route with no collateral damage.

### Probe 3 — open gate 1 as well (reverted)

With `progressive_tempo` lowered AND the ceiling set to 1 for beginner
time-target runners, every beginner time-target plan **threw**:

```
resolveMainSet: parameter "third_secs" has no value in this variant
```

`third_secs` is sized from `PROGRESSIVE_TEMPO_MAIN_MINS`, which has
`intermediate` and `experienced` rows and no `beginner` row. Gate 3.

> ⚠️ **My own measurement was wrong first and it is worth recording.** My initial
> fixture set `goal_time_mins`, which is not the field — the product uses
> `target_time` — so the goal was silently coerced to `finish` and the probe
> reported a clean "quality=0, no throw". The recorded lesson
> (*fixtures must use the product's values*) caught it. The crash only appears
> with a correctly-formed time target.

---

## 3. Coaching research — what a beginner should actually be prescribed

Researched as a coach working with beginner-to-intermediate runners; sources at
the foot. The literature and mainstream coaching practice converge on a
**ladder**, and Zonna already implements the bottom two rungs.

| Rung | Stimulus | Zonna today |
|---|---|---|
| 1 | **Strides** — short, fast, relaxed; neuromuscular, not metabolic | ✅ §28, in 100% of beginner plans |
| 2 | **Hill strides / short hill sprints** — same, with force | ✅ §28 Am.1, alternating with strides |
| 3 | **Unstructured fartlek** — effort-based speed play, no track, no pace targets | ⚠️ row exists (`fartlek_unstructured`) but is `intermediate` and **base-phase only** |
| 4 | **Progression run** — easy → steady finish; "the benefits of harder workouts without the same recovery cost" | ⚠️ row exists (`progressive_tempo`) but is `intermediate`, and its dose table has no beginner entry |
| 5 | **Short controlled tempo / cruise** — continuous, comfortably hard | ⚠️ `tempo_cruise_short` exists, `intermediate`, 5K/10K only |
| 6 | **Goal-pace blocks** — short blocks at target race pace inside a normal run | ❌ nothing beginner-eligible |

**The strongest findings for the board:**

- The standard progression is **strides/hill sprints for 3–4 weeks, then fartlek,
  then structured work** — which is precisely the order Zonna already starts and
  then stops. Rungs 1–2 are shipped; 3–6 are gated off.
- **Fartlek is explicitly described as appropriate for beginners** and was
  designed to avoid rigid track structure. Typical beginner dose: 30s hard /
  90s easy × 5–8, or 1 min / 2 min × 6. This is the lowest-risk rung 3.
- **Progression runs are the classic first structured session** — intensity
  builds gradually so the body warms into it, giving workout benefit at lower
  recovery cost. This maps exactly onto the `progressive_tempo` row we already
  have.
- For a **first-time marathoner with a time goal**, the recommended specific work
  is **short goal-pace blocks (3–5 miles) embedded in a mid-week run** — not
  intervals. This is rung 6 and we have no row for it.
- Frequency for a new runner: **one session every two weeks** to start, **once a
  week** if already running consistently. §110 Am.2's cap of 1/week is at the
  top of that range, which Willy's seat should weigh.

---

## 4. Proposal — three options, with impact

### Option A — lower existing rows, add beginner dose entries (recommended)

Lower `fartlek_unstructured`, `progressive_tempo` and `tempo_cruise_short` to
`fitness_level_min: 'beginner'`; add `beginner` rows to the 4 dose tables;
extend `fartlek_unstructured`'s phases beyond `base`.

- **Impact on existing plans: zero by construction, and measured zero** (probe 2).
  A lowered row cannot enter a pool it was not already in.
- **Impact on beginners: none until §110 Am.2 opens the slot.** The two ship
  together or the work is invisible.
- Cheapest, uses rows already written, board-reviewed and voice-checked.
- ⚠️ Does **not** solve rung 6 (goal-pace blocks), which is the specific thing a
  time-target beginner needs. Option A alone gives them a progression run, not
  race-pace exposure.

### Option B — Option A plus new beginner-scoped rows

Adds a `fitness_level_max?: CatalogueFitness` field so a row can be scoped to
beginners only, then authors new rows (a beginner goal-pace block; a beginner
fartlek with phase coverage into build/peak).

- The field itself is **provably zero-impact**: the filter conjunct is
  `row.fitness_level_max == null || userRank <= FITNESS_RANK[row.fitness_level_max]`,
  and no existing row sets it, so it is vacuous. One line, one test.
- **Without it, any new row hits ~59% of intermediate and experienced plans**
  (probe 1). This field is what makes "different tiers of catalogue items for
  different use cases" expressible at all.
- Solves rung 6. Higher authoring cost; each new row needs a board ruling on its
  prescription, per ADR-010.

### Option C — a separate beginner catalogue array

Rejected on architecture. It duplicates the selection machinery (D-08,
single-owner) for something a one-field predicate expresses, and every future
change to `selectCatalogueSession` would need doing twice. `fitness_level_max`
gets the same isolation with none of the duplication.

---

## 5. Sequenced plan

Each step lands with its own gate, and **no step is committed while a later step
is known-broken** — the first attempt at §110 Am.2 produced 31 failures across 13
files and was reverted rather than shipped.

| # | Step | Gate | Expected impact |
|---|---|---|---|
| 1 | **Coaching Board sitting on `session-catalogue.md`** — what may a beginner be prescribed, which rungs, what dose, which phases. Take §3's ladder and §4's options. | ADR-017 three artifacts | none (doctrine) |
| 2 | Add `fitness_level_max` to the row type + filter. | unit test proving a scoped row is invisible above its max; `verify:parity` must be **IDENTICAL** | **zero, by construction** |
| 3 | Add `beginner` entries to the 4 dose tables. | `configPrincipleSync` (each new numeric needs a principle §); `configConsumer` | **zero** — unreachable until step 5 |
| 4 | Lower / author the rows the board ratified. | `verify:parity` **IDENTICAL**; catalogue tests | **zero** — unreachable until step 5 |
| 5 | **Un-revert §110 Am.2** (`BEGINNER_TIME_TARGET_QUALITY_PER_WEEK_MAX = 1`, the `qualityCeilingFor()` shared owner, `INV-PLAN-TIME-TARGET-QUALITY-FLOOR`). | full `verify` | **this is where all impact lands** — beginner time-target only |
| 6 | Measure and declare: `verify` · `verify:parity` · `cohort:shape` · `measure:fitness` · `audit:plans`. | all five | declare the number that moved and why |

**Step 5 is the only step with a blast radius.** Steps 2–4 are provably inert
until it lands, which is what lets them be committed safely one at a time.

### The acceptance test for "cannot negatively impact any plans"

- Steps 2–4: `verify:parity` returns **IDENTICAL**. Anything else is a defect.
- Step 5: parity **will** change, and only on `level=beginner` × `goal=time_target`.
  Any changed case outside that cell is a defect, not a trade-off. The axis
  breakdown parity already prints makes this directly checkable.
- `measure:fitness` never-builds must not rise, and no marathon persona may lose
  peak long-run distance.

---

## 6. What must NOT happen

- ❌ **Do not add a beginner-eligible row without `fitness_level_max`.** Measured:
  39.1% of all parity cases, 59% of intermediate and experienced plans, 0% of
  beginner plans.
- ❌ **Do not treat §53 as the variety gate.** Its cap is
  `max(fraction, pigeonhole)`, so **one row picked ten times passes**. Adding a
  single row turns the checkers green while the runner does the same session all
  block. The reason to author more than one is coaching, not the checker.
- ❌ **Do not touch the beginner FINISH-goal plan.** The board ruled it
  **CORRECT AS IS**, unanimously, on 2026-09-19. Its thinness (61 identical
  "Easy run — Zone 2" labels over 20 weeks) is an *experience* problem owned by
  the SLT, and Willy blocked fixing it with intensity for runners who did not ask.
- ❌ **Do not lower a row without checking its dose table.** `progressive_tempo`
  looked free and threw at runtime, because the sizing table is fitness-keyed and
  typed `Record<string, …>`.

## 7. What this plan does not prove

- It does not show that a beginner *should* get a quality session — the board
  ruled that for the **time-target** case only, and the finish-goal case is
  settled the other way.
- It does not size the dose. §110 Am.2 caps frequency at 1/week; the research
  suggests a new runner may want one every *two* weeks to start. **Nothing here
  measures which is right**, and no data in the app can settle it — the app has
  one analytics event.
- It does not cover 5K/10K/HM beginners with a time target beyond giving them the
  same rungs; whether a beginner 5K time goal needs different work from a
  beginner marathon time goal is unexamined.
- Probes 1–3 measured the *mechanism*. None of them measured whether the
  resulting plans are **good** — that needs `measure:fitness` and `audit:plans`
  at step 6, on real candidate rows.

---

## Sources

- [Coach Jason's Advice Column: Fartleks, Workout Jargon, and Strides — Strength Running](https://strengthrunning.com/2016/06/coach-jasons-advice-column-fartleks-workout-jargon-and-strides/)
- [Fartlek Run 101: Your Guide to Fartlek Workouts — TrainingPeaks](https://www.trainingpeaks.com/blog/fartlek-workout-101/)
- [Fartlek Runs: What They Are and How to Do Them — Laura Norris Running](https://lauranorrisrunning.com/your-guide-to-fartlek-workouts/)
- [Progression Run: Benefits, Examples + How To Do It — Marathon Handbook](https://marathonhandbook.com/progression-runs/)
- [Progression Run: How to Do It & Benefits — The Output by Peloton](https://www.onepeloton.com/blog/progression-run)
- [First Marathon Training Plan: A Beginner's Blueprint — Microcosm Coaching](https://www.microcosm-coaching.com/microblog/your-first-marathon-training-blueprint/)
- [Novice 1 Marathon Training Program — Hal Higdon](https://www.halhigdon.com/training-programs/marathon-training/novice-1-marathon/)
