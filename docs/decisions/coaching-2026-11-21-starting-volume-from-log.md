# Coaching Board — STARTVOL-OBSERVED-01: should a new plan start from the logged run volume? (2026-11-21)

**Trigger:** soft, qualifies. No doctrine file is edited by this sitting. The question changes what the engine
prescribes at creation (§2, §10, §29, §106, §111, §113, §116), so it is the board's under ADR-027 ARCH-ENG-014:
*"carrying an observed fact is architecture; prescribing from it is a Coaching Board ruling."* Founder approved the
sitting on 2026-11-21 ("Yes").

**Proposed change:** at plan creation, use the runner's logged run volume (Apple Health is the SOR, ADR-011) instead
of, or alongside, the weekly km and longest run they declare in the wizard.

**Status:** RULED, not built. The current engine is frozen (ADR-027). The ruling lands in **B2** (the observed block,
already planned) and **B4** (`create` reads it). The board finds **no active harm that justifies a hotfix** (see
§ Ruling, H).

---

## Evidence

Production, read-only, service role, aggregates only. Scripts (scratchpad, not committed):
`boards/startvol.mts`, `boards/after.mts`, `boards/regen1.mts`, `boards/regen2.mts`, `boards/zero.mts`, each run as
`npx tsx <script>` from the repo root. The per-row regeneration dump was deleted after use.

### Method (and where it differs from the 8-of-11 figure in the brief)
- **Generations:** every `plans` and `plan_archive` row carrying `meta.generator_input`, de-duplicated on
  (runner, `generated_at`): **62 generations, 36 runners** (36 current, 26 archived; 8 internal, 0 demo). No stored
  input carries `fitness_level` or `volume_observed`.
- **Runs:** `isRun` and `dedupeRuns` from `lib/coaching/weeklyActualLoad.ts` (the checkpoint's own readers), plus a
  validity bound of ≥ 0.5 km, ≥ 120 s, pace 2:30–15:00 /km. 570 rows → **456 valid, de-duplicated runs**
  (522 apple_health, 21 strava, 27 manual before filtering).
- **What a creation-time rule could have seen:** only runs **ingested before** generation (`created_at < T`). 3
  generations had runs dated in the prior 28 days that arrived only after the plan was built.
- **Coverage:** the first HealthKit sync backfills 30 days (`clientSync.ts`, `isoDaysAgo(30)`), so the log at time T
  covers from (first connection or first HealthKit ingest) − 30 days.
- The brief's script did not de-duplicate, did not filter to runs, used "first run ≥ 28 days before" as coverage and
  counted generations. The figures below re-derive it and differ; both are reported.

### 1. The population
| | n |
|---|---|
| Generations / runners with a stored input | 62 / 36 |
| HealthKit connected before generation | 55 generations (0 connected after, 7 never) |
| Covered ≥ 28 days at creation | 55 · ≥ 42 days: 19 |
| …with **0** visible runs in the 28 days | **21 generations, 11 runners. 7 of those 11 have no valid run in the log, ever** |
| …with 1–3 runs | 6 generations, 6 runners |
| …with ≥ 4 runs | 28 generations, **15 runners** (latest generation each; 2 internal) |
| Watch proxy (HR on ≥ 80% of device runs) | 17 of 21 runners with a device log; 2 at 20–80%; **2 under 20% (phone-only likely)** |

🔴 **A connected log with no runs is not a runner who ran nothing.** 7 runners are connected and have never had a run
reach us. "Coverage" by connection date is therefore not coverage, and any rule must require runs, not a window.

### 2. Declared vs logged (15 runners, latest generation, ≥ 4 runs)
- Ratios declared ÷ logged: **0.91, 0.96, 0.98, 1.09, 1.31, 1.41, 1.51, 1.61, 1.78, 2.11, 2.43, 3.07, 5.12, 5.80,
  15.09**.
- **11 of 15 declared > 25% above the log; 4 within ±25%; 0 under.** (Per generation, ≥ 28-day coverage: 27 over,
  6 within, 1 under, 21 logged zero.) The brief's 8 of 11 reproduces in direction, not in count.
- Longest run: declared > 25% above the logged longest on **6 of 15**, and declared **below** it on **5 of 15**.
- 14 of 15 have HR on ≥ 85% of runs. The 15.09× runner has HR on 0%, 5+ years' training, declared 45 km/wk and a
  21 km longest run, logged 3.0 km/wk and 3.7 km: an incomplete log, not an inflated claim.

### 3. What they then ran (outcome signal; n is tiny)
Plans with at least one full plan week elapsed before supersession: **7 generations, 6 runners**.

| declared ÷ pre-plan log | declared | pre-plan log | prescribed wk 1–4 | **ran** wk 1–4 |
|---|---|---|---|---|
| 0.98 | 30 | 30.5 | 31.8 | 0.0 (stopped logging) |
| 1.31 | 30 | 22.9 | 29.3 | **31.7** |
| 1.42 | 30 | 21.1 | 32.0 | 15.0 (1 wk) |
| 1.51 | 30 | 19.8 | 33.0 | 19.7 |
| 1.78 | 10 | 5.6 | 10.6 | 0.8 |
| 3.07 | 15 | 4.9 | 16.3 | **20.3** |
| 5.80 | 30 | 5.2 | 31.5 | 9.2 |

Over-declarers (6 generations, 5 runners): median ran ÷ declared **0.66**, ran ÷ pre-plan log **1.38**, ran ÷
prescribed **0.60**. **2 of 6 then ran at or above what they declared** (one at 4× their pre-plan log). The log was
the better predictor for some and the worse one for others. **Neither number is the truth.**

Completions weeks 1–4 (`session_completions`, current plans): only 2 over-declarers recorded anything: 9 of 11
complete, 2 skipped, RPE 5.0, fatigue Fine 7 / Heavy 2; and 9 of 9 complete, RPE 4.1. No harm signal, and n = 2
cannot show safety either.

### 4. Regenerated through `runEngine` (15 runners; engine at HEAD; `today` = generation date; `plan_start` = stored; no writes)
"Leap off the log" = week 1 above §2's week-1 step measured against the **logged** base, `max(1.30×, +2 km)`.

| Rule | Acts on | Outcomes | Δ start km (median, worst) | Δ peak km (median, worst) | Leap off the log |
|---|---|---|---|---|---|
| **D** no change | 0 | 14 plan, 1 staged | — | — | **12 / 15** |
| **A28** logged when lower (volume + longest), marked observed | 12 | 10 plan, **5 staged (4 flipped from a race plan)** | −10.2, −42 | −5, **−58** | 3 / 15 |
| A28, volume only | 12 | identical to A28 | | | 3 / 15 |
| A42 (42-day coverage) | 7 | 12 plan, 3 staged (2 flipped) | −12.8, −43 | −2, −58 | 7 / 15 |
| **B** min(declared, 1.25 × logged) | 11 | 13 plan, 2 staged (1 flipped) | −8.1, −42 | −2, −58 | **10 / 15** |
| B, k = 1.5 | 9 | 13 plan, 2 staged (1 flipped) | −7.7, −42 | −3, −58 | 11 / 15 |

- Marking B's input `volume_observed` changed nothing here (no §29 heuristic case in the 15).
- **What A does to the two runners whose later running we can see:** the 15.09× phone-only 5+-year runner goes from a
  65 km-peak marathon plan to a staged base build peaking at **6.6 km/wk**; the 3.07× runner (5K, then ran 20.3 km/wk)
  is cut to week 1 = 13 km. A 30-declared/5.2-logged half-marathoner is put on a **walk-run start**; they then ran
  9.2 km/wk, so A was nearer the truth for them.
- **B buys little:** it removes the leap off the log on 2 of 12 while still overriding the same runners.
- **C (ask)** is bounded by D (runner keeps the declaration) and A28 (runner accepts the log), case by case.
- `npm run measure:fitness` was **not run**: none of its corpora carry an observed fact, so it cannot express any of
  these rules. That is a build condition (F below), not a pass.

---

## 🔍 Conflict scan (sections and amendments)

- **§10 CD-6 (SLT-signed 2026-08-06)** — *"Where a HealthKit connection exists, the declared figure should additionally
  be tempered toward the observed 4-week average (braces, ADR-011)"*, tracked as PV2-E. **This sitting is that brace.**
  As written, "tempered toward" reads as a silent blend, which is option B. **Amended below.**
- **§10 Amendment (WIZARD-ZERO-VOLUME-REFUSAL-01)** — *absence keeps its own meaning*: an unanswered value is not the
  lowest state. Directly governs the 7 connected runners with no runs ever: an empty log is absence, never 0 km.
- **§10 granularity ruling** — the declared figure "is a claim, tempered by the same belts" (§10 cap, §2, §29). None
  are removed here.
- **§2 and Amendments 2, 3 and the week-1 amendment** — week 1 is assessed against the **declared** volume
  (`week1StepBaseKm`). An observed base would change what §2 measures. Leap off the log: 12 of 15 today.
- **§29 + NO-RUNNER-TURNED-AWAY-01 C1** — §29 does not apply to observed volume. Reused: a runner who accepts the log
  is `volume_observed`.
- **§50** — device max HR is *"a floor rather than a maximum"*. The same epistemics: the run log is a floor.
- **§79** — a declaration binds structure downward only. Consistent: nothing here raises load from the log.
- **§106** — Willy's condition: *"scaling the ceiling off [self-report] turns an unverified self-report into
  permission to add load"*, and raising the ceiling above the level band is "a new sitting". This ruling adds no
  load. The upward direction (5 of 15 declared a longest run below the log) is **out of scope**.
- **§111 Am. 2** — the ratio's denominator is `effectiveStartKm`. A runner who accepts the log changes it, which is
  what flips 4 of 15 into a staged plan. That is §111 working, and it is a structural change the runner must see.
- **§113 + Am. 1** — refuses on the longest run below 5 km. Accepting a logged longest run under the floor would
  refuse or stage. Same treatment as §111.
- **§116 Am. 7 + `S111-FOUNDATION-CREDIT-01` (veto)** — gate on observed data, never credit unrun volume. Consistent:
  the log is only ever used **downward**, and only with the runner's choice.
- **ADR-012** — >15% week-volume changes and structural changes are **confirmed**, never silent. A28's median start
  change is −10.2 km (34–100% of the declared figure) and it flips the plan kind on 4 of 15.
- **ADR-011** — HealthKit is SOR for run data, *"no single external data dependency for paid value"*. This is a free
  safety brace; it has no paid gate.
- No zone-model translation issue. No conflict with §1 (no intensity change).

---

## The board

### 🏃 Alex Hutchinson (Chair)
Two facts settle most of this. Eleven of fifteen runners told us a number more than 25% above anything we saw them
run, and 12 of 15 get a week one that is a leap off what we saw. And of the six over-declarers we can follow, two then
ran what they declared, one of them four times their log. The log is a censored measurement: it can only be too low.
**A rule that substitutes a censored number for a claim is not more evidence-based than the claim; it is a different
error.** What we can defend to an experienced runner is: we saw X, you said Y, which is right? That is not timidity;
it is the only statement the data supports. And ignoring X, which is today's behaviour and against §10's own brace,
is not defensible either.

### 📊 Stephen Seiler
No objection on intensity: nothing here touches distribution. On the measurement: a ratio against a floor is biased
upward by construction, so "declared ÷ logged" overstates over-declaration by an unknown amount. Fifteen runners
with point estimates and no interval is a reason to ask, not a basis for a multiplier. Any k in option B is a number
with no distribution behind it, which is §10's staleness curve again.

### 🎯 Greg McMillan
This is what a coach does at the first meeting: "your watch says 12, you told me 30; tell me about the other 18." Some
run with a phone in a drawer, some run a treadmill at the gym, some round up. You find out by asking, once. Two
things matter for the Tuesday. The question must not read as an accusation. And the runner must know that choosing
the lower figure can change the plan they get, because on 4 of 15 it changes a race plan into base building. No
default that proceeds without a choice.

### 🩹 Rich Willy
Twelve of fifteen with a week one above §2's step off what we observed is the bone-stress setup I keep naming, **if
the log is right**, and the after-data says it is right for some of them (the 5.2-logged runner who declared 30 ran
9.2). I cannot tell which from the log alone, and neither can the engine, so I accept asking over substituting. Two
conditions. The longest run is asked as well as the week, because the per-run step is the load event (§116 Am. 2):
the log is 6 of 15 over on it. And an empty log is never read as a low one; 7 connected runners with no run ever is
a permission or a tracking gap, not a beginner. Separately, recorded below: for a runner who confirms a declaration
more than twice the log, I would hold week 1 at the declared figure with no step above it.

### ⚕️ Stacy Sims
The silent version fails a specific runner: the experienced 5+-year woman whose log is incomplete because she runs
with a buggy, on a treadmill, or without the watch. Option A would take her from a 65 km peak to 6.6 km a week for
months, believing she is building, which is §106's unopposed loss of mechanical stimulus at exactly the age it costs
most. Asking protects her and still catches the over-declarer. I also want the confirmation to be revisable: a runner
who said "I run more" and then logs half the plan should meet the existing reshape triggers, not a fixed figure.

### 💪 Richard Blagrove
No objection from this seat; no strength rule is touched.

---

## ⚡ Recorded disagreements

1. **The default on the confirmation (Willy vs McMillan, Sims).** Willy would pre-select the logged figure, on the
   protective side. McMillan and Sims want no pre-selection: a pre-selected lower figure is a silent change with an
   extra tap. **Chair: no option is pre-selected and the plan is not built until the runner chooses.** Where the
   choice is shown is the Design Board's. Willy would change his mind with evidence that runners accept a pre-selected
   default without reading it at a lower rate than they over-declare.
2. **Holding week 1 at the declared figure when a runner confirms a declaration > 2× the log (Willy).**
   INSUFFICIENT EVIDENCE: a new prescription on n = 6 followed runners, two of whom ran above the declaration. Re-open
   trigger: **≥ 20 confirmed-declared runners with ≥ 4 logged weeks after plan start**, measuring week 1–4 ran ÷
   prescribed against the accurate-declarer group.
3. **Using the log upward** (5 of 15 declared a longest run below the log; 1 of 15 declared weekly below it).
   Not ruled: §106 makes adding load from any figure a new sitting.

---

## ⚖️ Ruling

| Option | Ruling |
|---|---|
| **D** — never read the log at creation (today) | **INCORRECT.** It contradicts §10 CD-6's ratified brace and ignores the SOR's evidence on 11 of 15 runners. It stays the behaviour **until B4**, because the freeze holds (H) |
| **A** — substitute the log when lower, silently | **INCORRECT (veto).** The log is a floor; 7 connected runners have never had a run reach us; 2 of 6 followed over-declarers ran at or above their declaration; it flips the plan kind on 4 of 15 and cuts peak by up to 58 km without consent (ADR-012) |
| **B** — min(declared, k × logged), silently | **INCORRECT.** Option A with an unevidenced k (Seiler); it removes the leap off the log on only 2 of 12 while overriding the same runners |
| **C** — show the gap and ask; the runner's answer is the input | **CORRECT WITH AMENDMENT** (below) |

### Amendments (binding on the build)

- **C1 — When the question is asked.** Only when the observed block is **valid**: at least
  `OBSERVED_VOLUME_MIN_RUNS` (4) valid, device-sourced runs (manual entries are stated, not observed) dated in the
  `OBSERVED_VOLUME_WINDOW_DAYS` (28) before the request, read **at request time**. Fewer runs means the observed
  volume is **absent**, never a value (§10 Am.); nothing is shown and the declaration stands with source `stated`.
  On today's data the question appears for **11 of 15** valid-log runners on weekly volume.
- **C2 — The trigger.** Declared weekly km > `OBSERVED_VOLUME_GAP_RATIO` (1.25) × the logged 28-day mean, **or**
  declared longest run > `OBSERVED_LONGEST_RUN_GAP_RATIO` (1.25) × the logged longest (6 of 15). One question carries
  both figures (Willy).
- **C3 — The answer.** Two choices, neither pre-selected, and no plan until one is chosen:
  - **accept the log** → `current_weekly_km` (and, where it triggered, `longest_recent_run_km`) become the logged
    figures, source `observed`, `volume_observed: true` (§29 off, per NO-RUNNER-TURNED-AWAY-01 C1). §2, §10's cap,
    §111, §113 and §116 then run unchanged on the observed input;
  - **keep the declaration** → it stands, source `confirmed`. Every existing belt still applies.
- **C4 — Downward only.** The log never raises an input at creation (§106). A logged figure above the declaration is
  carried in the profile and not read.
- **C5 — The consequence is visible before the choice.** Where accepting the log changes the plan kind (a race plan
  becomes base building or a walk-run start; 4 of 15 today), the runner is told before choosing (McMillan; ADR-012).
- **C6 — Recorded on the plan.** `meta.start_volume = { declared, observed, observed_runs, window_days, source,
  as_of }` (and the same for the longest run), so `adapt` and the checkpoint can read what was asked and answered
  (Sims: revisable through the existing reshape triggers, not a new rule).
- **F — Measurement before B4 ships.** (i) `verify:parity` IDENTICAL for every request with no valid observed block
  or with "keep the declaration"; (ii) an observed-gap corpus added to `measure:fitness` / `cohort:shape` so the
  accept-the-log branch is measured, not assumed; (iii) re-run this sitting's regeneration on the B4 engine and report
  both figures beside these.
- **H — No hotfix.** No harm outcome was measured (2 over-declarers with completions, both fine; 2 of 6 ran at or
  above their declaration), and option C needs a new wizard state the frozen engine cannot express. **Lands in B2
  (carry) and B4 (read).** If the founder wants it sooner, it is a B4 first slice, not a patch.

### 📦 Required artifacts (for the B4 commit, not this sitting)

1. **Principle** — **§10 Amendment, "the brace is a question, not a blend"**: replace CD-6's *"the declared figure
   should additionally be tempered toward the observed 4-week average"* with: *"Where the runner's own log holds at
   least `OBSERVED_VOLUME_MIN_RUNS` device runs in the last `OBSERVED_VOLUME_WINDOW_DAYS` days and their declared
   weekly volume or longest run is more than the gap ratio above it, the runner is shown both figures and chooses
   which the plan is built from. The engine never substitutes the log silently, never reads an empty or thin log as a
   low one, and never raises an input from it. An accepted log is observed volume (§29 off); a kept declaration is
   confirmed and every belt still applies."* Cross-reference §2, §29 C1, §106, §111 Am. 2, §113, ADR-012.
2. **Numeric** — `GENERATION_CONFIG.OBSERVED_VOLUME_WINDOW_DAYS = 28`, `OBSERVED_VOLUME_MIN_RUNS = 4`,
   `OBSERVED_VOLUME_GAP_RATIO = 1.25`, `OBSERVED_LONGEST_RUN_GAP_RATIO = 1.25`. The run validity bounds belong to
   B2's single validity owner (data dictionary § 3 D); the values this sitting measured with were ≥ 0.5 km, ≥ 120 s,
   2:30–15:00 /km.
3. **Invariant** — `INV-PLAN-OBSERVED-GAP-RESOLVED` (error): if `meta.start_volume.observed` is present and the
   declared figure exceeds the gap ratio × observed, then `source` must be `observed` or `confirmed`, never `stated`;
   and if `source === 'observed'`, `generator_input.current_weekly_km` equals the observed figure and
   `volume_observed` is true. Plus a named L1 test that no path changes `current_weekly_km` from the log without a
   recorded runner choice, falsified by a mutation that substitutes silently.

### ↗️ Hand-offs
- **🧭 Design Board (rules first on placement):** a new state in the wizard's volume step (the gap question) is a new
  screen state, a hard trigger. It owns where it sits, the two-choice encoding, how the consequence (C5) is shown,
  and the iOS-only path (web has no HealthKit and is unchanged). The wizard must sync HealthKit before computing the
  gap (3 generations had runs that arrived after their plan was built).
- **👤 Founder (copy, delegated to the assistant):** candidate words, no em dashes: *"Apple Health shows about 12 km a
  week. You said 30."* · *"Use 12 km"* · *"I run more than it sees"* · consequence line *"Using 12 km starts you with
  base building first."* Voice per `brand.md`; the Design Board places it.
- **💼 SLT:** none. FREE, as PV2-E is already tagged (a load-safety brace is never gated).

---

## What this does not prove
- **n is small:** 15 runners with a valid log, 6 with any later running, 2 with completions. The direction is clear;
  the size of over-declaration is not.
- **The log is censored** and HR presence does not make it complete; the ratios overstate over-declaration by an
  unknown amount.
- **No injury or pain outcome is measured**; the product has no such signal.
- **Regeneration used today's engine** on stored inputs; the plans those runners actually received were built by
  earlier engines.
- **The coverage model is inferred** from connection time and the 30-day backfill; it cannot see a revoked Workouts
  permission.
- The 1.25 ratios and the 4-run minimum are chosen thresholds, measured for reach here and not validated against
  outcomes.
