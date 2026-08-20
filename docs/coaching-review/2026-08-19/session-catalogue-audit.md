# Session Catalogue Audit — August 2026

**Date:** 2026-08-19. (The request named `2026-09-XX`; today's date is used as instructed. If a September dating is wanted for the board pack, rename the folder — nothing in the document depends on it.)

**For:** the Coaching Board, ahead of any decision on session content.
**Written for:** a coach. No code in the findings. File and line citations are in Appendix A.
**Status:** audit only. Nothing here has been built, seeded, or changed. No principle amended, no numeric touched, no migration written.

**What this covers**
- What sessions the catalogue actually contains, and which of them a runner can actually be given (Task A).
- A full 12-week 10K plan generated for a named profile, traced session by session (Task B).
- Whether the way we describe a session's structure can express the sessions we'd want to add (Task C).
- How session size, rep count, rep length and recovery are decided today, and what changes if we size sessions by category (Task D).
- Draft specifications for the sessions that would close the gaps (Task E).
- Five decisions for the board (Task F).

---

## Executive summary — the five things that matter

1. **There are two catalogues, and the one the plans come from is not the one in the database.** The live table holds 14 sessions. The plan generator reads its own separate 16-session copy and never queries the database at all. Two of those 16 sessions — the taper sharpener and the HM-pace long run — exist *only* in the generator's copy and have never been added to the database. Every plan we have shipped used the 16. Anyone auditing the database has been auditing the wrong list.

2. **A 5K or 10K runner cannot be given a threshold session. There isn't one.** Every threshold session in the catalogue is restricted to half-marathon and longer. So for the entire build phase of a 10K plan — the phase whose whole purpose is threshold development — the only session available is *"Steady aerobic"*, an easy run. The plan's own signature says a 10K should be built on *"vo2max and threshold"*. Half of that is unreachable. This is the single largest content gap.

3. **In the database as it stands, a 5K or 10K taper has zero eligible sessions.** Nothing at all matches. The generator's private copy papers over this with the sharpener row; the database version would fall through to an unnamed inline "Tempo run — short". This is the clearest evidence that the two lists have diverged in a way that changes what a runner is prescribed.

4. **CD-1 has partly moved, but not in the direction expected.** The register's charge was that every hard session is prescribed at one pace. In the traced 10K plan there are now **three** distinct quality intensities, not one — race pace, threshold pace, and interval pace are genuinely different numbers. But the residue is worse in a specific way: the build phase's quality session is a *catalogue aerobic row prescribed at threshold pace under an aerobic name*, and the plan's pace ladder and heart-rate ladder disagree with each other — the goal-pace sessions are prescribed **faster** than the VO2max sessions while being given a **lower** heart-rate band. Detail in Task B.

5. **Session size is a flat 18% of weekly volume for every kind of quality work, and rep count, rep length and recovery are never derived from anything.** They are fixed text on the catalogue row — and that text never reaches the runner's plan. The plan stores a distance, a duration, a pace and a heart rate. The reps are reattached later, at display time, by matching the session's *name* against the catalogue — which silently fails whenever the engine has renamed the session, which it does for every race-pace session. Detail in Task D.

---

# TASK A — Catalogue inventory

## A.0 — Which catalogue is real

The audit was run against the live `session_catalogue` table. It returned **14 rows**, all created 2026-04-25, all matching the original seed exactly. No drift between the database and its seed.

The drift is elsewhere, and it is more serious: **the plan generator does not read the database.** It reads an in-repository copy of the catalogue that has since gained two rows and one eligibility change. Every plan generated in production has come from the 16-row copy.

| | Live database | Generator's copy |
|---|---|---|
| Row count | 14 | 16 |
| `goal_pace_sharpener` (taper sharpener, all distances) | **absent** | present |
| `hm_pace_long_run` (HM long run with race-pace finish) | **absent** | present |
| `tempo_continuous` eligible in taper | **no** | **yes** |

Consequences, in plain terms:

- The taper sharpener the plans actually use has never been written to the database. If anyone ever wires the generator to the live table — which is what the architecture document says is supposed to happen — **every 5K and 10K taper immediately loses its only session**, and every half-marathon and marathon taper loses its variety alternate.
- The HM peak long run with a race-pace finish is likewise generator-only.
- Any coach reviewing "the catalogue" via the database has been reviewing a list that has not produced a plan.

This is not a coaching finding, but it invalidates the premise of every coaching finding below unless it is fixed. **The rest of Task A reports both lists side by side.** Where they differ, the generator's copy is what runners actually got.

## A.1 — Eligibility matrix: every row × every distance × every phase

`X` = selectable as a quality session. `L` = present in the catalogue but only reachable through the long-run slot, never as a quality session. `·` = not eligible.
Phase columns per distance, in order: **B**ase · B**u**ild · **P**eak · **T**aper.

| Session | Category | 5K | 10K | HM | MAR | 50K | 100K |
|---|---|---|---|---|---|---|---|
| Steady aerobic | aerobic | X X · · | X X · · | X X · · | X X · · | X X · · | X X · · |
| Aerobic with hills | aerobic | X X · · | X X · · | X X · · | X X · · | X X · · | X X · · |
| Unstructured fartlek | aerobic | X · · · | X · · · | X · · · | X · · · | X · · · | X · · · |
| Continuous tempo | threshold | · · · · | · · · · | · X X **T†** | · X X **T†** | · X X **T†** | · X X **T†** |
| Cruise intervals | threshold | · · · · | · · · · | · X · · | · X · · | · X · · | · X · · |
| Progressive tempo | threshold | · · · · | · · · · | · X X X | · X X X | · X X X | · X X X |
| Classic VO2max | vo2max | · · X · | · · X · | · · · · | · · · · | · · · · | · · · · |
| Short VO2max | vo2max | · · X · | · · · · | · · · · | · · · · | · · · · | · · · · |
| Long VO2max | vo2max | · · X · | · · X · | · · · · | · · · · | · · · · | · · · · |
| **Goal-pace sharpener** ‡ | race_specific | · · · X | · · · X | · · · X | · · · X | · · · X | · · · X |
| **HM-pace long run** ‡ | race_specific | · · · · | · · · · | · · L · | · · · · | · · · · | · · · · |
| Marathon-pace long run | race_specific | · · · · | · · · · | · · · · | · · L · | · · · · | · · · · |
| HM-pace intervals | race_specific | · · · · | · · · · | · · X · | · · · · | · · · · | · · · · |
| Ultra race simulation | ultra_specific | · · · · | · · · · | · · · · | · · · · | · · X · | · · X · |
| Back-to-back long | ultra_specific | · · · · | · · · · | · · · · | · · · · | · X X · | · X X · |
| Time on feet | ultra_specific | · · · · | · · · · | · · · · | · · · · | · · · · | · · X · |

**†** Taper eligibility for *Continuous tempo* exists in the generator's copy only; in the live database this cell is `·`.
**‡** Rows in **bold** exist in the generator's copy only; they are absent from the live database entirely.

Three structural observations from the matrix alone:

- **The threshold block is a solid rectangle from HM rightwards, and completely empty to the left of it.** No 5K or 10K runner can ever receive a threshold session.
- **The VO2max block is the mirror image** — 5K and 10K only, peak only. There is no VO2max work available in build for any distance, and none at all for HM and longer.
- **Base phase is identical for all six distances.** The same three aerobic rows. Distance does not shape base-phase content in any way.

## A.2 — What is actually reachable, per distance and phase

Quality sessions only (the two long-run rows are excluded — they are selected by a different route). Assumes a paid, experienced runner with no injury filter, so this is the *most generous* view.

### 5K — signature says quality should focus on **vo2max, threshold**

| Phase | Reachable rows | Verdict |
|---|---|---|
| Base | Steady aerobic · Aerobic with hills · Unstructured fartlek | All aerobic. Neither declared focus category is present. |
| Build | Steady aerobic · Aerobic with hills | All aerobic. **Zero threshold rows.** |
| Peak | Classic VO2max · Short VO2max · Long VO2max | Matches focus. |
| Taper | **Live DB: zero rows.** Generator: Goal-pace sharpener only. | **Dead end in the database.** |

### 10K — signature says **vo2max, threshold**

| Phase | Reachable rows | Verdict |
|---|---|---|
| Base | Steady aerobic · Aerobic with hills · Unstructured fartlek | All aerobic. |
| Build | Steady aerobic · Aerobic with hills | **Zero threshold rows.** With a knee/shin/Achilles history the hills row is also filtered out, leaving **exactly one** session — an easy run — for the whole build phase. |
| Peak | Classic VO2max · Long VO2max | Matches focus. Only two rows, so a three-week peak repeats one. |
| Taper | **Live DB: zero rows.** Generator: Goal-pace sharpener only. | **Dead end in the database.** |

### HM — signature says **threshold, race_specific**

| Phase | Reachable rows | Verdict |
|---|---|---|
| Base | three aerobic rows | Off-focus by design (base is general). |
| Build | three threshold rows + two aerobic | Healthy. |
| Peak | Continuous tempo · Progressive tempo · HM-pace intervals | Healthy. |
| Taper | Continuous tempo* · Progressive tempo · Goal-pace sharpener* | Healthy in the generator; two rows in the database. |

### Marathon — signature says **threshold, race_specific**

| Phase | Reachable rows | Verdict |
|---|---|---|
| Base | three aerobic rows | — |
| Build | three threshold + two aerobic | Healthy. |
| Peak | Continuous tempo · Progressive tempo | **No race-specific quality session.** The only marathon-pace work is the long run. A marathoner never receives a standalone race-pace session. |
| Taper | Continuous tempo* · Progressive tempo · Goal-pace sharpener* | — |

### 50K — signature says **threshold, ultra_specific**

Build and peak both reachable and on-focus. Taper offers threshold and (generator only) the sharpener — the sharpener is off-focus for an ultra but harmless.

### 100K — signature says **ultra_specific** only

| Phase | Reachable rows | Verdict |
|---|---|---|
| Build | six rows, of which **five are off-focus** (three threshold, two aerobic) | The declared focus is a single category; the selector will hand out threshold work most weeks. |
| Peak | five rows, two off-focus | — |
| Taper | Continuous tempo* · Progressive tempo · Goal-pace sharpener* | **Every taper row is off-focus.** A 100K taper has no ultra-specific session available at all. |

## A.3 — Dead ends and contradictions, collected

**(distance, phase) pairs with zero eligible rows**

| Pair | Live database | Generator's copy |
|---|---|---|
| 5K taper | **ZERO** | 1 row |
| 10K taper | **ZERO** | 1 row |

When zero rows match, the engine does not fail — it falls through to an unnamed inline label, *"Tempo run — short"*, with no purpose, no structure and no coach's voice. It is invisible in the plan: it looks like a session.

**Near-dead ends** (one row, so the same session every week):

| Pair | Rows | Effect |
|---|---|---|
| 10K build, runner with knee/shin/Achilles history | 1 (Steady aerobic) | Four consecutive identical "quality" sessions, all easy runs |
| 5K build, same history | 1 | as above |
| HM peak | 1 on-focus (HM-pace intervals) | Same session every peak week |
| 5K/10K taper (generator) | 1 | Same session every taper week |

**Category contradicts the phase's declared focus**

The phase focus is set in two places that do not agree with each other: the per-phase catalogue focus in the coaching rules (base → aerobic; build → aerobic + threshold; peak → distance-specific; taper → distance-specific only) and the per-distance signature focus. Against those:

| Contradiction | Where | Severity |
|---|---|---|
| 5K and 10K build phase resolves to **aerobic** where both sources say threshold | 5K, 10K | **High** — this is the build phase running on easy runs |
| 5K and 10K taper falls through to an unnamed inline session (DB) or a race-specific one (generator) where the rules say "distance-specific only" | 5K, 10K | High |
| Marathon peak resolves to **threshold** where both sources say race-specific | MARATHON | Medium — mitigated by the marathon-pace long run, but no standalone race-pace session exists |
| 100K build and taper resolve to **threshold**, the signature says ultra-specific only | 100K | Medium |
| Base phase is category-identical across all six distances | all | Low — defensible (base is general by design) but it makes the per-distance signature decorative in base |

**One further contradiction, structural rather than content:** the specificity ladder says peak should be 60% specific and taper 70% specific. For 5K and 10K, "specific" resolves to VO2max — which is *not* race-specific work for a 10K; 10K race pace sits between threshold and VO2max. There is no 10K race-pace session anywhere in the catalogue. A 10K runner's most race-specific prescribed session is a set of 1000s at 5K pace.

---

# TASK B — 10K trace

## The profile

Age 43 · experienced · training age 2–5 years · 40 km/week · longest recent run 18 km · 4 sessions/week · goal: time · 10K PB 48:30 · target 44:59 · max HR 188 · resting HR 48 · left knee, posterior, recurring.

Generated as a paid plan, 12 weeks, plan start Monday 2026-09-07, race Sunday 2026-11-29. The full plan JSON was dumped and is summarised below; nothing is paraphrased from documentation.

Two things the engine recorded about the plan itself, worth noting before the sessions:

- **Difficulty band: "demanding".** 11 weeks available against a 10-week recommended minimum.
- **Derived fitness: VDOT 41.5** (raw), 40.2 as the training anchor after the 3% conservatism discount. The stated target of 44:59 implies **4:30/km**. The runner's current fitness implies a 10K around 48:30, i.e. **4:51/km**. The plan is therefore built around a goal pace 21 seconds per kilometre faster than measured fitness. The engine does not flag this anywhere. Hold that thought — it is what produces the pace inversion below.

## B.1 — Phase week counts, as actually generated

| Phase | Weeks | Which |
|---|---|---|
| Base | 4 | W1–W4 |
| Build | 4 | W5–W8 |
| Peak | 2 | W9–W10 |
| Taper | 2 | W11–W12 (W12 is race week) |

Weekly volume, in order: 41 · 45 · 49 · **32 (deload)** · **32** · 55 · 56 · **35 (deload)** · **41** · 57 · 37 · 18.

Two volume observations the board should see:

- **W5, the first build week, drops to 32 km — the same as the deload before it, and 17 km below W3.** The engine held it there deliberately, because W5 introduces the first quality session and it declines to stack a volume rise on top of a new stimulus. Defensible in isolation. The result is a build phase that opens 35% below the base peak.
- **W9, the first peak week, is 41 km — below every build week and below two base weeks.** Peak volume is only reached in W10 (57 km). The peak phase is one genuine week long by volume.

This is CD-10 recurring in a time-goal, experienced-runner plan — the register framed it as a beginner-plan question. It is not.

## B.2 — Every quality session

| Wk | Phase | Session name | Catalogue row it came from | Category | Prescribed pace | Prescribed HR | Zone | Structure the runner sees | Session distance | RPE |
|---|---|---|---|---|---|---|---|---|---|---|
| 4 | base (deload) | 5K time trial | *none — inline* | — | **none prescribed** | **none prescribed** | Zone 4–5 | none | 5.0 km | 9 |
| 5 | build | **Steady aerobic** | `aerobic_steady` | **aerobic** | 5:04–5:19 | 146–160 | Zone 3–4 | none | 6.0 km | 7 |
| 6 | build | 10K-pace progression | *none — renamed by the engine* | — | 4:25–4:35 | 146–160 | Zone 3–4 | none | 9.0 km | 7 |
| 7 | build | 10K-pace progression | *none — renamed by the engine* | — | 4:25–4:35 | 146–160 | Zone 3–4 | none | 10.0 km | 7 |
| 8 | build (deload) | 5K time trial | *none — inline* | — | **none prescribed** | **none prescribed** | Zone 4–5 | none | 5.0 km | 9 |
| 9 | peak | Long VO2max | `intervals_long` | vo2max | 4:28–4:39 | 160–188 | Zone 4–5 | none | 8.0 km | 7 |
| 10 | peak | Classic VO2max | `intervals_classic` | vo2max | 4:28–4:39 | 160–188 | Zone 4–5 | none | 11.5 km | 7 |
| 11 | taper | Goal-pace sharpener | `goal_pace_sharpener` *(generator-only row)* | race_specific | 4:25–4:35 | 146–160 | Zone 3–4 | none | 6.5 km | 7 |

**"Structure the runner sees" is "none" in every row.** The plan JSON for a quality session contains a name, a distance, a duration, a pace band, a heart-rate band, an RPE and up to three coach's notes. It does **not** contain the reps. `intervals_long` is "4 × 1000 m at 5K pace with 2 min jog" in the catalogue; what lands in the plan is *"Long VO2max, 8.0 km, 36 min, 4:28–4:39/km"*. The rep structure is reattached later, when the session card is drawn, by looking up the catalogue row whose **name** matches the session's label. That lookup succeeds for weeks 5, 9, 10 and 11. It **fails** for weeks 4, 6, 7 and 8 — four of the eight — because those sessions were either renamed by the engine or generated inline. Those four sessions have no structure available to display at all. (See Task C.)

**Two further label findings:**

- **W5 is named "Steady aerobic" and prescribed at threshold pace.** The catalogue row is an aerobic, Zone 2 easy run. Because no threshold row exists for 10K, the selector fell back to it — and then the engine prescribed it at threshold pace in Zone 3–4. So the session's name says easy, its prescription says threshold, and the mechanical label-integrity check does not fire, because that check only inspects labels containing the words "VO2max", "tempo", "cruise" or "threshold". "Steady aerobic" contains none of them. This is the CD-1 pathology inverted: not five names on one pace, but one honest name on the wrong pace.
- **The 5K time trials in W4 and W8 carry no pace target and no heart-rate target at all** — the only two sessions in the plan without either. That is a deliberate design (a time trial is led by effort), and it is the CD-8 recommendation implemented. Worth recording as *closed*, not as a defect.

## B.3 — Count of distinct prescribed quality intensities

**The answer is 3, not 1.** Counting the pace / heart-rate / zone triple across the six sessions that carry a prescription:

| # | Pace | HR | Zone | Weeks | What it is |
|---|---|---|---|---|---|
| 1 | 5:04–5:19 | 146–160 | Zone 3–4 | W5 | threshold pace |
| 2 | 4:25–4:35 | 146–160 | Zone 3–4 | W6, W7, W11 | goal 10K race pace |
| 3 | 4:28–4:39 | 160–188 | Zone 4–5 | W9, W10 | interval pace |

Plus a fourth state — the two time trials, which carry neither.

**CD-1 has moved since the register was written.** The register's finding — one intensity behind five names — reflected a *finish-goal half-marathon* plan, where none of the differentiating machinery fires: there is no goal pace to override with, and there are no VO2max rows for HM. For a *time-goal 10K by an experienced runner*, three of the levers do fire. The board should not read CD-1 as unchanged; it should read it as **conditional on goal type and distance**, which is a different and more awkward problem — the same defect is present or absent depending on who the runner is.

**What replaces it is arguably worse, and is the finding of this section:**

> The plan's pace ladder and its heart-rate ladder point in opposite directions.
>
> The goal-pace sessions (W6, W7, W11) are prescribed at **4:30/km** with a heart-rate ceiling of **160**.
> The VO2max sessions (W9, W10) are prescribed at **4:33/km** with a heart-rate band of **160–188**.
>
> The sessions labelled VO2max are prescribed **three seconds per kilometre slower** than the sessions labelled 10K race pace — while being given a heart-rate band 28 beats wider at the top. A runner following pace will find the "VO2max" sessions easier than the race-pace ones. A runner following heart rate will find the opposite. The plan cannot be executed as written by both metrics.

The cause is honest and structural, not a slip: VO2max pace is derived from the runner's *measured* fitness (VDOT 41.5), while goal pace is taken from the runner's *stated target* (44:59). Because the target is 21 sec/km beyond current fitness, goal pace has overtaken interval pace. **Any runner whose target is ambitious enough will get this inversion.** It is not rare. It needs a rule.

## B.4 — VO2max sessions in the plan

**Two.** W9 (`intervals_long`) and W10 (`intervals_classic`) — both in peak, consecutive, both the only quality session in their week.

The engine recorded its own objection to this and then overruled it:

> *"First VO2max session is in week 9; spec target was week ≤5 (at least 5 adaptation weeks before taper). No swap — catalogue places VO2max only in peak phase for this race distance. Late placement accepted to preserve race-specific exposure."*

Read plainly: **the engine knows two VO2max sessions in the last three weeks before a taper cannot produce a VO2max adaptation, and it proceeds anyway, because the catalogue gives it nowhere else to put them.** Our own principle says the first VO2max session must land at least five weeks before the taper. In this plan it lands in week 9 of 12. This is not a scheduling accident — it is a direct consequence of every VO2max row being peak-only. It will happen on every 10K and 5K plan we generate.

The knock-on: these two sessions are the *only* sessions in the entire plan above Zone 3–4. Twelve weeks of training for a 10K contains 72 minutes of prescribed work above threshold, all of it in the final three weeks, none of it long enough before the race to adapt to.

**A second quality session was planned for both peak weeks and silently never placed.** The engine intends two quality sessions per peak week for an experienced runner. It looks for a second day among Tuesday, Thursday and Monday, each of which must sit at least two days from both the Sunday long run and the Wednesday quality. None can. Tuesday and Thursday are adjacent to Wednesday; Monday is adjacent to Sunday. So the second session is dropped without comment. The volume it was allocated flows into the easy runs. **A four-day-a-week runner with a Sunday long run and a Wednesday quality can never receive a second quality session.** That is a whole-plan consequence of the day-spacing rules interacting with a four-day week, and it is currently invisible.

## B.5 — Main-set volume as a percentage of each week's volume

Two columns, because the two readings differ enormously and only one of them is coaching-meaningful.

| Wk | Session | Whole session | as % of week | **Main set (work only)** | **as % of week** |
|---|---|---|---|---|---|
| 4 | 5K time trial | 5.0 km / 26 min | 15.6% | 6 min | — (no pace) |
| 5 | Steady aerobic | 6.0 km / 31 min | 18.8% | 11 min ≈ **2.1 km** | **6.6%** |
| 6 | 10K-pace progression | 9.0 km / 41 min | 16.4% | 21 min ≈ **4.7 km** | **8.5%** |
| 7 | 10K-pace progression | 10.0 km / 45 min | 17.9% | 25 min ≈ **5.6 km** | **9.9%** |
| 8 | 5K time trial | 5.0 km / 26 min | 14.3% | 6 min | — |
| 9 | Long VO2max | 8.0 km / 36 min | 19.5% | 16 min ≈ **3.5 km** | **8.6%** |
| 10 | Classic VO2max | 11.5 km / 52 min | 20.2% | 32 min ≈ **7.0 km** | **12.3%** |
| 11 | Goal-pace sharpener | 6.5 km / 29 min | 17.6% | 9 min ≈ **2.0 km** | **5.4%** |

The whole-session column is stable at 14–20% — that is the flat 18% rule doing its job. The main-set column ranges from **5.4% to 12.3%**, a factor of more than two, with no coaching logic behind the spread. It is a by-product: quality sessions carry a fixed 15-minute warm-up and 5-minute cool-down floor, so in a short session the warm-up eats the work. In W11 the runner warms up for 15 minutes and cools down for 5 to do **9 minutes** of work. In W5 it is 15 + 5 to do **11 minutes**.

**The 7 km of "Classic VO2max" in W10 is worth a separate look.** A 32-minute main set at 4:33/km is 7 km of work at interval pace. Presented as a single Zone 4–5 block, that is not a session an experienced 43-year-old should be given — it is roughly a 10K race. The catalogue row says 5 × 3 min. But the reps never reach the plan, so what is stored, and what a heart-rate-driven or duration-driven surface will act on, is *32 continuous minutes in Zone 4–5*. The reps exist only if the display lookup happens to succeed.

**Whole-plan intensity check.** Total prescribed quality time across the 12 weeks is **286 minutes out of 2,988 minutes of running — 9.6%.** Our polarised-training principle sets the 10K target at **25% quality / 75% easy**, measured in minutes. The plan delivers less than half of it. The figure is not enforced anywhere: the intensity distribution table is read by an offline validation script and by nothing else. There is no mechanical check that a plan honours the intensity distribution it declares.

That is worth stating carefully, because it cuts against the brand: a product whose core promise is protection from the grey zone is currently shipping plans well *under* its own intensity target, which is a different failure from the one it was built to prevent — it is under-stimulus, not over-stimulus. Whether 25% is the right number is a coaching question (Task F, item 1). That the number is decorative is not.

---

# TASK C — Schema gap analysis

## How a session's structure is described today

A catalogue row carries a small structured description of its main set. In practice six shapes are in use: a continuous block, a set of identical repeats, a progression from one zone to another, free-play fartlek, a long run with a race-pace portion, and two ultra-specific shapes (long run with fuelling, back-to-back days).

Two properties of the current description matter for everything below:

- **A repeat set is one repeated thing.** A count, one work step, one recovery step. There is no way to say "these reps differ from each other" or "this block contains more than one kind of step".
- **The recovery step has a duration and a free-text type word ("jog"). Nothing consumes the type word.** It is rendered into a sentence and no further.

## The six cases

| # | Can it be expressed without hardcoding strings? | Why |
|---|---|---|
| 1 | **Pyramid / ladder** (rep length varies within one set) | **NO** | A repeat set has a single work step and a count. Two rep lengths require two sets, which reads as two workouts and loses the ladder's shape; three or more is unrepresentable without inventing a string. |
| 2 | **Nested set** (a repeating block of several differently-paced steps) | **NO** | There is one work step per set. A block such as "3 × (3 min at threshold + 1 min at interval pace)" has no representation. |
| 3 | **Per-step pace on both work and recovery** | **PARTIAL** | The work step can carry a pace target (it does, on four rows). The recovery step carries only a duration and a type word — it cannot carry a pace. So "jog the recovery no slower than 6:30" is unsayable. |
| 4 | **Typed recovery: paced jog vs walking rest vs standing rest** | **PARTIAL** | The type word exists and can hold any of the three. Nothing acts on it: it is not validated against a set of values, it does not change the session's distance, and it does not change how the session is timed. Walking recovery and jogging recovery produce identical plan output. Effectively decorative. |
| 5 | **Hill reps** (run to base, effort-based uphill with no pace, rest at top, prescribed descent, manual rep advance) | **NO** | Five separate gaps: no run-to-a-landmark step; no way to say *this step has no pace target and is governed by effort*; no third step in a rep (work + rest + descent); no way to prescribe the descent as its own step with its own instruction; no concept of the runner advancing the rep manually. Terrain exists only as a free tag on the whole session, used to filter hills *out* for injured runners — it cannot describe a step. |
| 6 | **Warm-up as a pace ceiling** ("no faster than X") | **NO** | Two reasons. A catalogue row cannot describe its own warm-up at all — the warm-up is universal, imposed by the format rules, identical for every quality session. And a pace value is always a target band; there is no way to mark one as an upper limit rather than a centre. (This is the same missing concept CD-11 asks for on easy runs.) |

**Score: 4 NO, 2 PARTIAL, 0 YES.** No proposed session in Task E can be expressed today.

## A seventh gap, not asked for but blocking

**The structure never reaches the plan.** Whatever a catalogue row says, the generated plan stores a name, a distance, a duration, a pace band, a heart-rate band, an RPE and coach's notes. There is no reference back to the catalogue row. The reps are recovered at display time by matching the session's **name** against the catalogue.

That join is fragile by construction, and it is already failing: in the traced 10K plan it fails on four of eight quality sessions, including both goal-pace sessions and both time trials. It will fail on every session the engine renames — which is every race-pace session in every time-goal plan — and on every session the AI enricher rewrites the label of.

**Any v2 schema is pointless until the session carries the identity of the row that produced it, plus the specific numbers that were derived for it.** A shared catalogue row cannot hold "4 × 1000 m" *and* be sized per runner; the derived set belongs on the session.

## Proposed v2 structure (specification only — not implemented)

The design goal is that every one of the six cases is expressible *by data*, and that no session content is ever a string the engine has to parse.

**Shape.** A main set is an ordered list of **blocks**. A block has a repeat count and an ordered list of **steps**. A step has a role, a length, a target and a modality. Everything else is composition.

```
main_set_structure (v2)
├── version: 2
├── sizing                      how big this session should be, per runner
│   ├── budget_basis            "main_set_duration" | "main_set_distance"
│   ├── budget_pct_of_weekly    e.g. 10  (see Task D)
│   └── scaling                 "reps" | "rep_length" | "fixed"
│                               which dimension absorbs the budget
├── warmup / cooldown           optional overrides of the universal format
│   └── (a step, so it can carry a ceiling target — case 6)
└── blocks[]
    ├── repeat                  integer, or "derived" (from sizing)
    ├── label                   optional, e.g. "ladder up"
    └── steps[]
        ├── role                "work" | "recovery" | "transition"
        ├── modality            "run" | "jog" | "walk" | "stand" | "hike"
        ├── terrain             "flat" | "uphill" | "downhill" | "rolling"
        ├── grade_pct           optional [min, max]
        ├── length              one of:
        │     { kind: "duration", secs }
        │     { kind: "distance", m }
        │     { kind: "to_landmark", landmark: "hill_base" | "hill_top" }
        │     { kind: "mirror", of: "previous_work" }   e.g. jog back down
        │     { kind: "open" }                          until the runner advances
        ├── target              one of:
        │     { kind: "pace",   anchor, mode, tolerance_pct }
        │     { kind: "zone",   zone }
        │     { kind: "effort", rpe }
        │     { kind: "none" }
        │       anchor: "E" | "T" | "I" | "R" | "M" | "goal" | "race_5K" | "race_3K"
        │       mode:   "target" | "ceiling" | "floor"
        └── advance             "auto" | "manual"
```

**Two rules that make it safe:**
- A step's target references a *named pace anchor*, never a number. The runner's own paces resolve it. A row can never contain a pace.
- `sizing` is on the row, so the row declares which dimension stretches when a runner's volume grows. A threshold row scales rep count; a hill row scales rep count; a ladder row is `fixed`.

**How each case is covered:**

| Case | Covered by |
|---|---|
| 1 — Pyramid / ladder | One block, `repeat: 1`, an explicit list of work steps of different lengths with recovery steps interleaved. `scaling: "fixed"`. |
| 2 — Nested set | One block with `repeat: n` and several work steps with different targets inside it. |
| 3 — Per-step pace on work **and** recovery | Every step carries its own `target`, including recovery steps. |
| 4 — Typed recovery | `modality` is a closed set — `jog` / `walk` / `stand` are distinct and each carries its own target and length, so walking rest genuinely differs from jogged recovery in the session's distance and duration. |
| 5 — Hill reps | A `transition` step with `to_landmark: hill_base`; a work step with `terrain: uphill`, `grade_pct`, `target: { kind: "effort", rpe }` — no pace; a recovery step `modality: stand`, `length: { kind: "open" }`, `advance: "manual"`; a second recovery step `terrain: downhill`, `length: { kind: "mirror", of: "previous_work" }` with its own pace ceiling. |
| 6 — Warm-up as a ceiling | The row's optional `warmup` is a step, and `mode: "ceiling"` exists on any pace target. |

**Migration posture.** v2 is additive. Existing rows carry no `version` field and continue to be read the old way; new rows carry `version: 2`. Nothing needs rewriting at once. The blocking prerequisite is the seventh gap above — the plan session must carry the catalogue row's identity and the *derived* set, or none of this is visible to a runner.

---

# TASK D — Derivation audit

## D.1 — How session size is decided today (traced, not inferred)

**Session distance.** A single line governs it, for every category of quality work at every distance:

> session distance = week's volume × 18% × a progression multiplier

The 18% is flat — threshold, VO2max, race-pace and aerobic sessions are all sized identically. The progression multiplier runs from 0.85 at the start of the build to 1.15 at the end of the peak, centred on 1.0 so the total intensity budget is unchanged; base and taper are exempt (multiplier = 1). Two floors then apply: a session is never below 5 km, and when a week carries two quality sessions the second is 80% of the first.

**Session duration** is that distance divided by the prescribed pace. Note what this assumes: *the entire session, warm-up and cool-down included, is run at quality pace.* The 41-minute W6 session in Task B is 9 km at 4:30/km — but 15 of those minutes are a warm-up that will be run two minutes per kilometre slower. **The stated duration of every quality session in every plan is understated**, by roughly 5–8 minutes for a typical session. That is a formatting-adjacent defect, not a coaching one, but it feeds the weekly-hours figure the runner sees.

**Warm-up and cool-down** come from the universal format: 10% / 80% / 10%, with a 15-minute minimum warm-up for quality and a 5-minute minimum cool-down. Because the minimum dominates at these session sizes, the real split is nothing like 10/80/10 — Task B's sessions ran between 23% and 62% main set.

**Rep count, rep length and recovery duration are not derived at all.** They are fixed values written on the catalogue row: `intervals_classic` is always 5 × 3 min with 2 min jog; `tempo_cruise` is always 3 × 10 min with 2 min jog; `intervals_short` is always 10 × 400 m. They do not vary with the runner, the week, the phase, or the session's own derived size. A runner on 30 km/week and one on 60 km/week receive the same 5 × 3 min.

**And those fixed values never reach the plan.** They are looked up at display time by name-matching, as described in Task C. So the true state is: *the number of reps is a constant, and it is not reliably visible.*

**Typical duration range on the catalogue row is never read by anything.** Every row carries a typical minimum and maximum duration. No code path consults either. They are documentation.

**In summary — what actually determines a quality session today:**

| Dimension | Determined by | Varies with |
|---|---|---|
| Session distance | 18% of weekly volume × progression | weekly volume, position in build/peak |
| Session duration | distance ÷ quality pace | as above |
| Warm-up / cool-down | universal format + minimums | session length only |
| **Rep count** | **constant on the row** | **nothing** |
| **Rep length** | **constant on the row** | **nothing** |
| **Recovery duration** | **constant on the row** | **nothing** |
| Recovery type | constant word on the row, unread | nothing |
| Typical duration range | **unread** | nothing |

## D.2 — What changes under category-specific budgets

Modelled: threshold 10% / VO2max 8% / repetition 5% **of weekly volume as main-set work**, rep length constrained by category (T 5–12 min, I 3–5 min, R ≤ 2 min), rep count = budget ÷ rep length.

Note the change of basis: today's 18% is the **whole session**; the proposed percentages are the **work only**. They are therefore not directly comparable — the proposal must be read alongside a warm-up and cool-down on top.

Using the Task B runner's paces (threshold 5:11/km, interval 4:33/km, repetition ~4:12/km illustrative):

### At 30 km/week

| Category | Work budget | Short rep | Long rep |
|---|---|---|---|
| Threshold | 3.0 km ≈ 15.6 min | 3 × 5 min | 1 × 12 min |
| VO2max | 2.4 km ≈ 10.9 min | 4 × 3 min | 2 × 5 min |
| Repetition | 1.5 km ≈ 6.3 min | 13 × 30 s (~120 m) | 3 × 2 min (~475 m) |

*Today, by contrast: one session of 4.5–6 km total, of which perhaps 2 km is work, whatever category it is.*

### At 40 km/week (the Task B runner)

| Category | Work budget | Short rep | Long rep |
|---|---|---|---|
| Threshold | 4.0 km ≈ 20.8 min | 4 × 5 min | 2 × 12 min |
| VO2max | 3.2 km ≈ 14.6 min | 5 × 3 min | 3 × 5 min |
| Repetition | 2.0 km ≈ 8.4 min | 17 × 30 s | 4 × 2 min (~475 m) |

*Today: 6–8.5 km sessions with 2.0–7.0 km of work depending on where in the block they fall.*

Two things fall out immediately:

- **5 × 3 min is exactly what the model produces for VO2max at 40 km/week.** The hardcoded `intervals_classic` is correct — for a 40 km/week runner. It is 40% too much for a 30 km/week runner and 25% too little for a 50 km/week one. The constant was set for a median athlete and never parameterised.
- **The VO2max prescription becomes stable and defensible across the range**, moving 4 → 5 → 6 reps of 3 minutes as volume rises, rather than being fixed at 5.

### At 50 km/week

| Category | Work budget | Short rep | Long rep |
|---|---|---|---|
| Threshold | 5.0 km ≈ 26.0 min | 5 × 5 min | 2 × 12 min |
| VO2max | 4.0 km ≈ 18.2 min | 6 × 3 min | 4 × 5 min |
| Repetition | 2.5 km ≈ 10.5 min | 21 × 30 s | 5 × 2 min |

**A caution the board should weigh.** At 30 km/week the repetition budget yields *13 × 30-second reps*, and at 50 km/week *21 × 30 seconds*. Rep count derived purely from a budget produces sessions no coach would write. **The model needs a rep-count ceiling per category as well as a rep-length band** — something like T ≤ 6, I ≤ 6, R ≤ 12 — with the budget overflowing into rep *length* once the count ceiling is hit. That is a design note, not an objection.

**Second caution.** A main-set budget of 10% / 8% / 5% is *lower* than today's effective work volume in the late peak (W10 delivered 12.3%). Adopting it would reduce peak quality volume for this runner. Given that the plan already delivers 9.6% quality against a declared 25% target, the board should decide the intensity target (Task F item 1) *before* fixing the budget percentages, not after.

## D.3 — Where this contradicts an existing principle or invariant

| Contradiction | With what | Nature |
|---|---|---|
| Category-specific sizing | The quality-sizing numeric (flat 18%) and its principle | **Direct replacement.** The principle currently states one figure for all quality; it would need to state four. Requires a principle amendment, a config change and an invariant — the three artefacts, in one commit. |
| Deriving rep count from volume | Nothing — this is virgin ground | No principle governs rep count today. **A new principle is required**, not an amendment. Any change to prescription without a principle behind it is, by our own rule, a defect. |
| Main-set basis instead of whole-session basis | The minimum-session-size floor (5 km for quality) and the universal 10/80/10 format | **Interaction.** A 5 km floor on the *whole* session and a 10% *work* budget can disagree: at 30 km/week the threshold budget is 3.0 km of work, which with a 15-minute warm-up produces a ~6.5 km session — fine. At 20 km/week it produces a session that is mostly warm-up. The floor needs restating in terms of work, or the warm-up minimum needs to scale. |
| Any change to prescribed volume in the build | Quality progression across the block (the 0.85→1.15 multiplier) | **Compounding.** Category budget × progression multiplier compounds. Applied naively, a late-peak VO2max session at 50 km/week would be 6 × 3 min × 1.15 ≈ 7 reps. Probably desirable, but it must be an explicit decision, not a multiplication. |
| Sizing the session by work rather than by distance | Polarised training (the intensity distribution table) | **Exposes an existing hole.** The distribution is declared per distance in minutes and enforced by nothing. Changing the sizing basis changes the realised distribution. If the board wants the distribution honoured, it needs a mechanical check regardless of this proposal — the invariant registry principle requires every declared invariant to be exercised, and this one is declared nowhere and exercised nowhere. |
| Rep length bands per category | Session label integrity | **Supportive, not conflicting.** Constraining T to 5–12 min and I to 3–5 min makes the name/physiology match structurally rather than by convention. |
| Prescribed rep counts appearing in the plan | The plan schema rule that quality main-set content originates from the catalogue | **Supportive but currently violated.** That rule says the engine selects rows rather than synthesising session strings. Today the engine does select rows — and then discards their content. Carrying the derived set onto the session is what would make the rule true. |

---

# TASK E — Proposed catalogue rows (specification only)

**Not seeded. Not migrated. No code written.** `coach_voice_notes` is left as TODO throughout — voice copy is approved separately.

Each row below states which v2 schema features it needs. Rows marked **v1-expressible** could ship without the schema work; the rest cannot.

## E.0 — Recommendation before any new row: widen three existing ones

The cheapest fix for the largest gap is not a new row. **Add 5K and 10K to the distance eligibility of `tempo_continuous`, `tempo_cruise` and `progressive_tempo`.** That alone closes the 5K/10K build-phase threshold gap, the 5K/10K taper dead end, and the near-dead-end for injured short-distance runners, and it needs no schema change and no new voice copy.

The coaching question the board must answer first: **is threshold work appropriate in a 5K/10K build phase at all?** (Task F, item 2.) It is standard practice — a 10K is run near threshold — and its absence is far more likely an oversight from a catalogue written marathon-first than a deliberate stance. But it is a prescription change and it is the board's call.

The rows below assume the answer is yes and add what widening alone cannot provide.

## E.1 — `tempo_cruise_short` — Cruise intervals (short-distance)

| Field | Value |
|---|---|
| Name | Cruise intervals |
| Category | threshold |
| Purpose | Threshold work in repeats, sized for a runner racing 5K or 10K. The test is rep four, not rep one. |
| Phases | build, peak |
| Distances | 5K, 10K |
| Fitness ≥ | intermediate |
| Difficulty | 3 |
| Zones | Z3 |
| Free tier | yes |
| Main set | blocks: one, repeat derived; steps: work (duration, target pace anchor **T**, mode target) + recovery (jog, 60–90 s, target pace anchor **E**, mode ceiling) |
| Sizing | basis main-set duration; budget 10% of weekly; scaling by rep count; rep length 5 min; rep count ceiling 6 |
| v2 features needed | per-step pace on recovery (case 3); budget-derived rep count |
| Notes | Distinct from the existing `tempo_cruise` (10-minute reps, HM+). Five-minute reps suit the shorter-race runner and the 4-day week. |

## E.2 — `tenk_pace_intervals` — 10K-pace intervals

| Field | Value |
|---|---|
| Name | 10K-pace intervals |
| Category | race_specific |
| Purpose | Race-specific intervals at 10K pace. The bridge between threshold and race day. |
| Phases | peak, taper |
| Distances | 10K |
| Fitness ≥ | intermediate |
| Difficulty | 4 |
| Zones | Z3, Z4 |
| Free tier | yes |
| Main set | one block, repeat derived; work (distance 1200 m, target pace anchor **goal**, tolerance 2%) + recovery (jog, 2 min, pace anchor **E**, ceiling) |
| Sizing | basis main-set distance; budget 12% of weekly; scaling by rep count; rep count ceiling 6 |
| v2 features needed | per-step recovery pace; budget-derived rep count |
| Notes | Mirrors `hm_pace_intervals`, which exists and has no 10K counterpart. Closes the specificity gap named in Task A.3: today a 10K runner's most race-specific session is 1000s at 5K pace. **This row is also the natural home for the pace-inversion rule** — if goal pace is faster than the runner's derived interval pace, the plan needs a position (Task F, item 3). |

## E.3 — `hill_reps` — Hill reps (one parameterised row, recommended)

**Recommendation: one parameterised row, not three.** Reasoning, since the request asked for a view:

- Three rows (short / medium / long) means three sets of voice copy, three eligibility arrays and three difficulty tiers describing one session whose only real variable is rep length. Every future change is made three times.
- The usual argument *for* three rows is our variety rule, which counts **labels** — one row would mean one label repeated, tripping the repetition cap.
- That argument is answerable within one row: **give the row a label template that renders its parameter** — "Hill reps — 45s", "Hill reps — 90s", "Hill reps — 3 min". One row, three labels, variety accounting works, voice copy written once.

| Field | Value |
|---|---|
| Name | Hill reps — {rep_length} *(template)* |
| Category | vo2max for reps ≤ 90 s; threshold for reps ≥ 2 min — see Task F item 4 |
| Purpose | Strength and running economy under load. Effort governs the climb; the watch does not. |
| Phases | build, peak |
| Distances | 5K, 10K, HM, MARATHON |
| Fitness ≥ | intermediate |
| Difficulty | 3 (short) / 4 (long) |
| Zones | Z4, Z5 |
| Free tier | yes |
| Main set | **block 1**, repeat 1: transition step — run to landmark `hill_base`, pace anchor **E**, mode ceiling. **block 2**, repeat derived: (a) work — duration `{rep_length}`, terrain uphill, grade 5–8%, target **effort RPE 8, no pace**; (b) recovery — modality stand, length open, advance manual; (c) recovery — terrain downhill, length mirror-of-previous-work, modality jog, pace anchor **E** mode ceiling. |
| Sizing | basis main-set duration; budget 8%; scaling by rep count; rep count ceiling 10 |
| v2 features needed | **all of case 5** — landmark step, effort-only target, three steps per rep, prescribed descent, manual advance |
| Parameters | rep_length ∈ {45 s, 90 s, 3 min} |
| Injury interaction | Must be excluded for knee / ITB / Achilles / shin / calf / plantar history in base and build, exactly as the existing hills row is. The descent step makes this **more** important, not less — see E.4. |

## E.4 — `descent_control` — Downhill repeats

| Field | Value |
|---|---|
| Name | Downhill repeats |
| Category | race_specific *(provisional — see Task F item 4)* |
| Purpose | Teach the legs to absorb downhill running before the race does it for them. |
| Phases | build, peak |
| Distances | 10K, HM, MARATHON, 50K |
| Fitness ≥ | experienced |
| Difficulty | 4 |
| Zones | Z2, Z3 |
| Free tier | no *(provisional — an eccentric-load session is a judgement call, not a default)* |
| Main set | one block, repeat derived: (a) work — terrain downhill, grade 3–5%, distance 400 m, pace anchor **M**, mode **ceiling** *(the instruction is "no faster than", not "hit")*; (b) recovery — terrain uphill, mirror-of-previous-work, modality jog, pace anchor **E** ceiling |
| Sizing | basis main-set distance; budget 5%; scaling by rep count; rep count ceiling 8 |
| v2 features needed | terrain per step; pace **ceiling** mode (case 6); mirror length |
| Safety | **Eccentric downhill load is the highest-risk session in this document.** It must be excluded for the same injury list as hills, must not appear in the two weeks before a race, and should be capped at one appearance per plan. The board should treat this as the item most likely to be sent back. |

## E.5 — `threshold_ladder` — Threshold ladder

| Field | Value |
|---|---|
| Name | Threshold ladder |
| Category | threshold |
| Purpose | Threshold work that changes shape as it goes. Rewards discipline early and honesty late. |
| Phases | build, peak |
| Distances | 5K, 10K, HM, MARATHON |
| Fitness ≥ | intermediate |
| Difficulty | 3 |
| Zones | Z3 |
| Free tier | yes |
| Main set | one block, repeat 1, explicit steps: work 3 min **T** · recovery jog 90 s **E** ceiling · work 5 min **T** · recovery jog 90 s · work 8 min **T** · recovery jog 90 s · work 5 min **T** · recovery jog 90 s · work 3 min **T** |
| Sizing | basis main-set duration; **scaling fixed** — the ladder's shape is the session; it does not stretch |
| v2 features needed | **case 1** (varying rep length within one set); per-step recovery pace |
| Notes | Because it is fixed, it needs a volume guard: only eligible when weekly volume supports ~24 minutes of threshold work — roughly 45 km/week and above at the 10% budget. That guard has no home today. |

## E.6 — Summary of what Task E needs

| Row | v1-expressible? | Blocked on |
|---|---|---|
| E.0 (widen three existing rows) | **Yes** | Board approval only |
| E.1 `tempo_cruise_short` | Partly — as a fixed 4 × 5 min | Budget-derived reps for the full version |
| E.2 `tenk_pace_intervals` | **Yes**, as a fixed 4 × 1200 m | — |
| E.3 `hill_reps` | **No** | Entire v2 schema, case 5 |
| E.4 `descent_control` | **No** | v2 terrain-per-step, ceiling mode |
| E.5 `threshold_ladder` | **No** | v2 case 1 |

**A staged path exists:** E.0 and E.2 could ship on today's schema and would close the two most serious content gaps in Task A. E.1, E.3, E.4 and E.5 wait on v2.

---

# TASK F — Board packet

Five decision items, in the format of the August decision register. Each ends with an ADR-017 conflict scan naming every existing principle it touches or contradicts.

---

## CD-14 — Should a quality session's size depend on what kind of session it is?

**Today.** Every quality session is sized identically: 18% of the week's volume, whatever it is. A threshold run, a set of VO2max intervals and a race-pace session at the same weekly volume are the same length. Rep count, rep length and recovery duration are fixed constants written on the catalogue entry — they do not change with the runner, the week or the phase. A runner on 30 km/week and one on 60 km/week both get 5 × 3 minutes. And because a large fixed warm-up is added on top, the actual *work* in a session ranged from 5.4% to 12.3% of the week's volume across the traced plan, with no coaching logic behind the spread.

**Why it's in question.** The three kinds of hard running have genuinely different sustainable volumes. Twenty-five minutes of threshold work is a normal session; twenty-five minutes of VO2max work is not a session, it is a race. Sizing them the same is the same category of error as CD-1 — a real distinction erased by a single number. And a constant rep count means the prescription is right for exactly one runner: the median one it was written for.

**Options.**
- **(a)** Keep the flat 18%, accept that rep counts are constants, and stop implying the sessions differ in size.
- **(b)** Category-specific work budgets — threshold ~10%, VO2max ~8%, repetition ~5% of weekly volume as *work* — with rep length constrained per category and rep count derived from the budget.
- **(c)** (b), plus a rep-count ceiling per category so the budget overflows into rep length rather than producing 21 × 30 seconds.

**Recommendation: (c).** The modelling in Task D shows (b) alone produces sessions no coach would write at the extremes; the ceiling costs one extra number per category and removes the failure. (c) also reproduces the existing 5 × 3 min at 40 km/week — i.e. it *validates* the current constant as a median and makes it move correctly either side of it, which is the strongest evidence that the model is calibrated rather than invented.

**What would change our mind.** If the view is that a non-elite runner is better served by a session size that stays put while their volume changes — one fewer moving part, more comparable week to week — then (a), and we stop describing the catalogue as sized. That is defensible for our audience and should be chosen rather than defaulted into.

**Who this affects.** Every plan that contains any quality work, at every distance and level. Systemic. It also has a sequencing dependency: the budget percentages cannot be fixed until CD-15 settles the intensity target, because the traced plan currently delivers 9.6% quality against a declared 25%.

**Conflict scan (ADR-017).**

| Principle | Relationship |
|---|---|
| §8 Quality session frequency (carries the 18% and the 80% secondary figure) | **Direct amendment** — one numeric becomes four |
| §1 Polarised training | **Contradiction exposed, not created** — changing the sizing basis changes the realised ratio, and the declared ratio is enforced nowhere |
| §16 Universal run format | **Interaction** — a work-based budget and a fixed 15-minute warm-up floor disagree at low volumes |
| §34 Invariant registry — declared and exercised | **Touched** — a new numeric with no mechanical check would violate this on arrival |
| §9 Long-run rules | **Touched** — session distances are drawn from one weekly pool; shrinking quality moves volume to easy runs and the long run |
| §19 Session label integrity | **Supportive** — rep-length bands per category make the name match the physiology structurally |
| §53 Quality variety across the plan | **Touched** — derived rep counts make otherwise-identical sessions genuinely differ, which may weaken the case for label-level variety |
| `INV-PLAN-MIN-SESSION-SIZE`, `INV-PLAN-QUALITY-PER-WEEK` | Both would need restating in work terms |

---

## CD-15 — Should 5K and 10K runners be able to receive threshold work?

**Today.** They cannot. Every threshold session in the catalogue is restricted to half-marathon and longer. The consequence, traced in full in Task B: the entire build phase of a 10K plan is populated by an aerobic easy run, which the engine then prescribes at threshold pace under the name *"Steady aerobic"*. For a runner with a knee, shin or Achilles history it is the *only* session available for the whole build phase. And in the live database, the 5K and 10K **taper has no eligible session at all**.

**Why it's in question.** A 10K is raced at or just above threshold. The idea that a 10K plan should contain no threshold work is not a coaching position anyone holds — it is far more likely an artefact of a catalogue written marathon-first and never revisited. But it is a prescription change and it is the board's to make, not engineering's.

Note the second-order effect: because there is no threshold row, the build phase gets an aerobic row prescribed at threshold pace, and our label-integrity check does not catch it — the check only inspects names containing "tempo", "cruise", "threshold" or "VO2max", and "Steady aerobic" contains none of them. So the current state is *worse than an honest gap*: it is a gap being silently filled by a mislabelled session.

**Options.**
- **(a)** Extend the three existing threshold sessions to 5K and 10K. Cheapest; no schema change, no new voice copy.
- **(b)** (a), plus a short-distance-specific threshold session with shorter reps (Task E.1), because a 10K runner's threshold reps should not be the marathoner's ten-minute blocks.
- **(c)** Hold the position that short-distance runners train on aerobic + VO2max only — and then fix the labelling so the build phase honestly reads as easy running rather than being dressed as quality.

**Recommendation: (b).** (a) closes the dead ends immediately and could ship on the current schema; the short-rep variant is the coaching-correct version and can follow. Whatever else is decided, **(c)'s labelling fix must happen either way** — leaving an easy run named "Steady aerobic" prescribed at threshold pace is indefensible under our own label rule.

**What would change our mind.** If the view is that a 4-day-a-week 10K runner has room for exactly one hard session and it should always be VO2max, then (c) — and we say so plainly in the plan rather than filling the slot with a mislabelled easy run.

**Who this affects.** Every 5K and 10K plan, both tiers. These are our two free-tier flagship distances, so this is also the shape of what a free user sees.

**Conflict scan (ADR-017).**

| Principle | Relationship |
|---|---|
| §17 Plan signatures — distance shapes the plan | **Direct contradiction today** — the 5K/10K signature declares a threshold focus that is unreachable. Resolving it either way removes a standing lie. |
| §5 Specificity — sessions resemble race demands | **Touched** — "specific" for a 10K currently resolves to VO2max, which is not 10K-specific |
| §19 Session label integrity | **Violated today.** The mislabelled build session is a live breach; the mechanical check does not detect it |
| §53 Quality variety across the plan | **Touched** — a one-row phase cannot satisfy variety at all |
| §21 Injury-aware session selection | **Touched** — the hills filter reduces 5K/10K build from two rows to one; adding threshold rows removes the sharp edge |
| §1 Polarised training | **Supportive** — threshold work is where the 25% quality budget should mostly live |
| §12 Easy-run zone cap (Z2 ceiling) | **Touched** — an aerobic Z2 row prescribed in Z3–4 sits awkwardly against the easy-run ceiling |
| `INV-PLAN-LABEL-MATCHES-PACE` | Has a **coverage gap** this exposes; would need widening whichever option wins |

---

## CD-16 — Does VO2max work belong in the build phase for short-distance time goals?

**Today.** No VO2max session is eligible anywhere except the peak phase. In the traced 12-week 10K plan that put both VO2max sessions in weeks 9 and 10 — the last two weeks before the taper. The engine recorded its own objection and overruled it: our principle requires at least five weeks between the first VO2max session and the taper, and the engine noted that the catalogue gave it nowhere else to put them. The result is 72 minutes of prescribed work above threshold in twelve weeks, all of it too late to adapt to.

**Why it's in question.** This is not a scheduling accident that better placement logic would fix — the placement logic already tried and failed. It is a content constraint: VO2max is peak-only, so a short plan cannot honour the adaptation window. Every 5K and 10K plan we generate has this shape.

There is a second, sharper problem in the same area. **For an ambitious target, goal pace overtakes interval pace.** The traced runner's goal pace (4:30/km, from a target 3½ minutes faster than their current 10K) is *faster* than their derived VO2max pace (4:33/km, from measured fitness) — while carrying a heart-rate ceiling 28 beats lower. The sessions named VO2max are prescribed slower and easier than the sessions named race pace. A runner following pace and a runner following heart rate would run two different plans. This has no rule governing it today.

**Options.**
- **(a)** Make VO2max eligible in build for 5K and 10K, so the adaptation window can be honoured.
- **(b)** Leave VO2max peak-only, and stop asserting an adaptation-window requirement we structurally cannot meet — remove or restate the principle.
- **(c)** (a), plus an explicit rule for the pace inversion: when derived goal pace is faster than derived interval pace, the engine either flags the target as beyond current fitness, or reconciles the two ladders rather than shipping both.

**Recommendation: (c).** (a) alone fixes the timing and leaves the inversion. The inversion is the more damaging of the two because it is *visible to an experienced runner on the session card* — it is exactly the credibility problem CD-1 named. And it is not rare: any runner whose target is meaningfully ahead of their measured fitness gets it, which for a goal-setting product is a large fraction of users.

**What would change our mind.** If the view is that a non-elite runner racing 10K needs no true VO2max work at all — threshold and race pace being sufficient, and the injury cost of Zone 5 work at 43 not being worth it — then **(b)**, and we remove VO2max from short-distance plans entirely rather than placing it where it cannot work. That is a legitimate and quite defensible position for this audience. What we should not do is keep prescribing it in a window where our own principle says it cannot adapt.

**Who this affects.** Every 5K and 10K plan (VO2max timing) and every time-goal plan at any distance where the target is ambitious (the pace inversion). Systemic on both counts.

**Conflict scan (ADR-017).**

| Principle | Relationship |
|---|---|
| §5 Specificity — sessions resemble race demands as the race approaches | **Direct tension.** Moving VO2max earlier moves a hard stimulus away from the specificity peak |
| §19 Session label integrity | **Violated today by the inversion** — a session named VO2max prescribed slower than a session named race pace fails the "name matches physiology" test in both directions |
| §22 Race-specific exposure (time-targeted goals) | **Contradiction.** The goal-pace override and the VO2max exemption produce two intensity ladders that disagree; §22 does not anticipate goal pace exceeding interval pace |
| §10 VDOT conservatism | **Root cause.** Interval pace is discounted from measured fitness; goal pace is taken from the runner's stated target undiscounted. The inversion is the gap between the two |
| §20 VDOT surface — auditable | **Touched** — the plan already surfaces raw VDOT, anchor and discount; it does not surface that the target is beyond the raw figure |
| §7 Hard / easy — never two hard days in a row | **Touched** — VO2max in build adds a hard day to a phase that currently has one |
| §1 Polarised training | **Supportive** — more VO2max exposure moves the plan toward its declared 25% |
| §44 Prep-time validation / difficulty band | **Candidate home** for a "target beyond current fitness" signal — the band already exists and is ordinal, which is the right shape for this |
| VO2max onset timing numeric | **Currently unsatisfiable** for 5K/10K; must be amended or made reachable |

---

## CD-17 — Should structured hill work and prescribed-downhill work enter the catalogue, and as what?

**Today.** There is one hill session — *"Aerobic with hills"* — which is an easy run over hilly ground with a terrain tag. There are no hill *repeats*: no set, no rep length, no rest, no descent instruction. There is no downhill session of any kind. The stimulus ladder the engine uses to check that a build phase progresses already includes a rung called "hills", between steady aerobic and tempo — but nothing in the catalogue can occupy it.

**Why it's in question.** Hill repeats are one of the highest-value sessions available to a time-limited amateur: strength, economy and a VO2max-adjacent stimulus with lower impact loading than flat intervals, and no need to find a track. Their absence is a real gap. Prescribed downhill work is a different proposition — genuinely valuable for a hilly race, and the highest-risk session in this document.

The categorisation question is not cosmetic. Category drives *when* a session is selectable and how it interacts with the specificity ladder. A 45-second hill rep is VO2max-like; a 3-minute hill rep is threshold-like; a downhill session is neither and is closest to race-specific for a hilly course.

**Options.**
- **(a)** Add hill repeats only. Categorise by rep length: ≤ 90 s as VO2max, ≥ 2 min as threshold.
- **(b)** Add hill repeats and downhill repeats, both race-specific, gated on terrain and course.
- **(c)** Add hill repeats now, defer downhill entirely pending an injury review.
- **(d)** Neither — hills stay an ambient terrain property, not a session.

**Recommendation: (c), with hill repeats as one parameterised session rather than three.** Hill repeats are low-risk, high-value and would fill the empty rung in our own progression ladder. Downhill is different in kind: eccentric loading is the most reliable way to produce a knee or quadriceps injury in a masters runner, and our audience is exactly the population that would attempt it enthusiastically and once. It deserves its own review, not a line in a larger decision.

On the structure of the row: one parameterised session with a name that renders its parameter — "Hill reps — 45s", "Hill reps — 90s" — gives distinct names for the variety rule from a single entry, so we get the coaching variety without maintaining three near-identical entries and three sets of voice copy. Reasoning in full at Task E.3.

**What would change our mind.** On hills: if the view is that a session whose intensity is governed by effort rather than pace is too loose for an app whose whole promise is telling people what pace to run, then hills stay ambient and we say why. On downhill: if a coach with eccentric-loading expertise is comfortable specifying the guard rails, it can move forward with (b) instead of (c).

**Who this affects.** Hill repeats: 5K through marathon, every level — a broad addition. Downhill: a narrow group (hilly-course runners) at disproportionate injury risk. Also every runner with a knee, ITB, Achilles, shin, calf or plantar history, who must be excluded from both — a filter that already exists and would need to cover the new entries.

**Conflict scan (ADR-017).**

| Principle | Relationship |
|---|---|
| §21 Injury-aware session selection | **Direct.** The hills exclusion list must cover both new sessions. Downhill arguably needs a *wider* exclusion — the descent loads the knee hardest, and the current list was written for uphill work |
| §19 Session label integrity | **Direct.** A session with no pace target cannot be checked by a pace-matching rule; effort-governed sessions need their own integrity check |
| §5 Specificity | **Touched.** Categorising hills as VO2max or threshold places them in the specificity ladder and changes which phase they land in |
| §11 Pace ranges, not points | **Tension.** A hill rep has no pace at all — a case the principle does not contemplate |
| §41 Effort copy matches the work prescribed | **Direct.** These are the first sessions where effort is the primary prescription rather than a supporting note |
| §53 Quality variety | **Touched.** The parameterised-name approach is what keeps one entry from tripping the repetition cap |
| §13 Environment adjustments (treadmill/terrain) | **Touched.** Hills already become "optional / outdoor only" for treadmill runners; a structured hill session cannot degrade so gracefully |
| Stimulus progression ladder | **Currently references a rung nothing can fill.** Adding hills makes an existing rule true |
| `INV-PLAN-INJURY-NO-HILLS` | Must extend to cover both new entries and the descent step |

---

## CD-18 — Should a 10K race-specific session exist?

**Today.** No. There is a half-marathon-pace interval session, a half-marathon-pace long run, a marathon-pace long run and an all-distance taper sharpener — but nothing at 10K pace. The nearest thing a 10K runner receives is a set of 1000s at 5K pace, and a build-phase session the engine renames *"10K-pace progression"* on the fly and prescribes at goal pace, without any catalogue entry behind it. That renamed session has no purpose text, no structure, and no coach's voice of its own — the engine writes a substitute note because the underlying entry's voice belongs to a different session entirely.

**Why it's in question.** 10K is one of our two free-tier flagship distances and the traced example throughout this audit. That it has no race-specific session while the half-marathon has two is not a coaching decision anyone made — it is where the catalogue stopped. And because the engine papers over it by renaming an unrelated entry, the gap is invisible in the product: the plan *looks* like it contains 10K-pace work.

There is a knock-on worth naming. Because the renamed session has no catalogue entry, the display lookup that reattaches rep structure fails on it — so every 10K-pace session in every 10K plan shows the runner a distance and a pace with **no set structure at all**. Four of the eight quality sessions in the traced plan are in this state.

**Options.**
- **(a)** Add a 10K-pace interval session (Task E.2), mirroring the half-marathon one.
- **(b)** Keep the rename-on-the-fly approach, and give the renamed session its own purpose, structure and voice so it stops borrowing an unrelated entry's.
- **(c)** Take the position that 10K pace is close enough to threshold that a separate session is unnecessary, and prescribe honest threshold work instead (which requires CD-15 to pass first).

**Recommendation: (a).** It is a single entry, it is expressible on today's schema without waiting for v2, it mirrors an entry that already exists and is understood, and it closes the specificity gap for a flagship free-tier distance. It also gives the engine a genuine place to put race-pace work instead of renaming an aerobic entry — which fixes a label-integrity breach as a side effect.

**What would change our mind.** If the coaching view is that a 10K runner is best served by threshold plus VO2max, with race pace appearing only as a taper sharpener, then (c) — but that only works if CD-15 passes, because there is currently no threshold session for a 10K runner to be given.

**Who this affects.** Every 10K plan, both tiers — and by the same argument every 5K plan, which has the identical gap and is not separately itemised here because the case is the same. Moderate reach, high visibility: this is the distance in front of us.

**Conflict scan (ADR-017).**

| Principle | Relationship |
|---|---|
| §22 Race-specific exposure (time-targeted goals) | **Direct.** The principle requires goal-pace exposure in the second half of the plan; the mechanism satisfying it today is a rename with no entry behind it |
| §5 Specificity | **Direct.** Peak is declared 60% specific; for 10K, "specific" resolves to VO2max, which is not race-specific for that distance |
| §19 Session label integrity | **Supportive.** A real 10K-pace entry means the label is backed by content rather than produced by a rename |
| §33 Coach notes by session intent | **Touched.** The engine currently discards the borrowed entry's voice and synthesises a replacement — correct behaviour, but a symptom of the missing entry |
| §17 Plan signatures | **Touched.** The 10K signature declares vo2max + threshold and no race-specific category; adding this entry changes the signature |
| §36 Taper quality variety | **Touched.** A 10K-pace entry eligible in taper gives the 10K taper a second option, alongside the sharpener that exists only in the generator's copy |
| §53 Quality variety | **Supportive.** One more reachable entry for a distance that currently has two in peak |
| `INV-PLAN-RACE-SPECIFIC-EXPOSURE` | Currently satisfied by a renamed session with no catalogue backing — this would give it real content |

---

## Cross-cutting item — not a coaching decision, but blocking

**The two catalogues must be reconciled before any of CD-14 to CD-18 is implemented.** The generator does not read the live database; it reads its own 16-entry copy, two entries of which have never been written to the database at all. Whatever the board decides, deciding it against the wrong list wastes the decision — and connecting the generator to the live table today would immediately empty the 5K and 10K taper.

This is an engineering defect, not a board matter. It is recorded here because the board's rulings cannot be implemented safely until it is fixed, and because anyone who has reviewed "the catalogue" via the database has reviewed a list that never produced a plan.

---

## Recommended sign-off order

1. **CD-15** (5K/10K threshold) — largest content gap, cheapest fix, and unblocks CD-18's fallback option.
2. **CD-18** (10K race-specific) — shippable on today's schema, flagship distance.
3. **CD-16** (VO2max placement + pace inversion) — the inversion is the most visible credibility problem to an experienced runner.
4. **CD-14** (category sizing) — largest blast radius; depends on settling the intensity target first.
5. **CD-17** (hills and downhill) — genuine addition, but nothing is currently broken by its absence, and the downhill half needs its own review.

---

*Nothing in this document has been built. No principle has been amended, no numeric changed, no migration written. This is the gate.*

---

# APPENDIX A — Citations

Every claim in the findings above, traced to source. Line numbers as at commit `5ea39b8`, 2026-08-19.

## A.1 Catalogue sources and the drift

| Claim | Source |
|---|---|
| Live table contents (14 rows) | `session_catalogue` table, project `wkppmpsvqkaxbekdgzdm`, queried 2026-08-19 |
| Seed migration matches the live table exactly (14 inserts, same ids) | `supabase/migrations/20260425_session_catalogue.sql` |
| Generator's copy has 16 rows | `lib/plan/sessionCatalogueData.ts:34–215` |
| `goal_pace_sharpener` exists only in the generator's copy | `lib/plan/sessionCatalogueData.ts:138–148`; absent from the migration and the live table |
| `hm_pace_long_run` exists only in the generator's copy | `lib/plan/sessionCatalogueData.ts:149–159`; absent from the migration and the live table |
| `tempo_continuous` taper eligibility is generator-only | `lib/plan/sessionCatalogueData.ts:75` vs `supabase/migrations/20260425_session_catalogue.sql:91` |
| The generator defaults to its own copy and is never passed a database-fetched catalogue | `lib/plan/ruleEngine.ts:2796–2800` (default parameter); sole production call site `app/api/generate-plan/route.ts:55` passes three arguments |
| No code path reads the `session_catalogue` table | Repo-wide search for `session_catalogue` returns only docs, a feature-gate string, and the mirror file's own comment |
| Documentation asserts the table is the runtime source of truth | `docs/canonical/session-catalogue.md:3`; `docs/architecture/ADR-010-session-catalogue.md:40` |

## A.2 Selection and eligibility

| Claim | Source |
|---|---|
| Filter chain (phase, distance, fitness, tier, long-run exclusion, hills exclusion) | `lib/plan/sessionCatalogueData.ts:267–274` |
| Preferred category with silent fallback to all eligible rows | `lib/plan/sessionCatalogueData.ts:279–284` |
| Deterministic pick by week and slot | `lib/plan/sessionCatalogueData.ts:287` |
| Returns null when nothing matches | `lib/plan/sessionCatalogueData.ts:276` |
| Preferred category per phase and distance | `lib/plan/ruleEngine.ts:1150–1163` |
| Inline fallback label when no row matches | `lib/plan/ruleEngine.ts:752–755` |
| Hills exclusion for the six injury keywords, base and build only | `lib/plan/ruleEngine.ts:1567–1571`; `lib/plan/generationConfig.ts:359` |
| Per-distance declared quality focus | `lib/plan/planSignatures.ts:14, 22, 32, 44, 55, 68` |
| Per-phase declared catalogue focus | `docs/canonical/coaching-rules.md:125–130` |

## A.3 Task B trace

Generated via `generateRulePlan(input, 'paid', '2026-09-07')` with the profile stated in Task B, race date 2026-11-29, run under `NODE_ENV=test`. `validatePlan()` raised no error-severity violations.

| Claim | Source |
|---|---|
| Phase boundaries, weekly volumes, session contents | generated plan JSON (`plan.phases`, `plan.weeks`) |
| VDOT 41.5 raw / 40.2 anchor / 3% discount / goal pace 4:30 | `plan.meta.vdot`, `.vdot_training_anchor`, `.vdot_discount_applied_pct`, `.goal_pace_per_km` |
| Difficulty band "demanding" | `plan.meta.difficulty_band` |
| Engine's own VO2max-timing objection, verbatim | `plan.meta.rule_adjustments[0]` (rule `V2-vo2max-onset-timing`) |
| Week 5 volume held flat | `plan.meta.rule_adjustments[1]` (rule `V1-volume-quality-split`) |
| Quality sessions carry no main-set fields | `lib/plan/ruleEngine.ts:853–865` — the returned session object; line 864 carries the comment "future: surface catalogue_id when schema permits" |
| Pace/HR dispatch by category (goal pace / interval / threshold) | `lib/plan/ruleEngine.ts:775–812` |
| Goal-pace override renames the session and replaces the coach's note | `lib/plan/ruleEngine.ts:786–795, 819–823` |
| Second peak-week quality dropped when no day satisfies both spacing rules | `lib/plan/ruleEngine.ts:1605–1631`; spacing constants `generationConfig.ts:389, 394` |
| Peak intends two quality sessions for an experienced runner | `lib/plan/ruleEngine.ts:1309–1310` |
| VO2max onset requirement of five adaptation weeks | `lib/plan/generationConfig.ts:588`; check at `lib/plan/ruleEngine.ts:2372–2400` |
| Label-integrity check only inspects "vo2max", "tempo", "cruise", "threshold" | `lib/plan/invariants.ts:483–484` — "Steady aerobic" matches neither predicate, so no violation is raised |
| Quality minutes 286 of 2,988 total running minutes (9.6%) | summed from the generated plan |
| Declared intensity distribution for 10K is 75/25 | `lib/plan/generationConfig.ts:18` |
| That table is read by no engine code | repo-wide search: `lib/plan/generationConfig.ts:761` (type key), `scripts/r23-phase7-validation.ts:230` (offline script), `docs/canonical/CoachingPrinciples.md:56`. No `validatePlan()` invariant references it |

## A.4 Task C — schema

| Claim | Source |
|---|---|
| The six structure shapes in use | `lib/plan/sessionCatalogueData.ts:41, 52, 63, 78, 89, 100, 111, 122, 133, 144, 155, 166, 177, 188, 199, 210` |
| A repeat set has one work step, one recovery step, one count | `lib/plan/sessionCatalogueData.ts:89` and the reader at `lib/plan/sessionComposer.ts:190–197` |
| Recovery type is rendered into a sentence and otherwise unused | `lib/plan/sessionComposer.ts:196` |
| Only two structure fields are read by the engine: `type` (for the hills filter) and `work.pace_target === 'goal'` | `lib/plan/sessionCatalogueData.ts:238, 246`; `lib/plan/ruleEngine.ts:767` |
| The plan session carries no catalogue reference | `lib/plan/ruleEngine.ts:853–865` |
| Structure is reattached at display time by matching the session's name | `app/dashboard/DashboardClient.tsx:4445` and `:4517` |
| Warm-up is universal and cannot be overridden per row | `lib/plan/sessionFormat.ts:13–31`; consumed at `lib/plan/sessionComposer.ts:135–145` |
| Pace targets are always bands, never ceilings | `lib/plan/generationConfig.ts:509` (`USE_PACE_RANGES_NOT_POINTS`) |

## A.5 Task D — derivation

| Claim | Source |
|---|---|
| Session distance = weekly × 18% × progression multiplier | `lib/plan/ruleEngine.ts:1352–1364` |
| The 18% figure and the 80% secondary figure | `lib/plan/generationConfig.ts:150–151` |
| Progression multiplier centred on 1.0 across build and peak, ±15% | `lib/plan/generationConfig.ts:159`; applied `lib/plan/ruleEngine.ts:1356–1363` |
| Minimum quality session distance 5 km | `lib/plan/generationConfig.ts:183–188` |
| Duration = distance ÷ quality pace, warm-up included | `lib/plan/ruleEngine.ts:860` |
| Warm-up 15 min minimum for quality, cool-down 5 min minimum | `lib/plan/sessionFormat.ts:18`, `:36`; applied `lib/plan/sessionComposer.ts:135–137` |
| Rep count, rep length and recovery are literals on the row | `lib/plan/sessionCatalogueData.ts:89, 111, 122, 133, 144, 177` |
| Typical duration min/max are read by nothing | repo-wide search for `typical_duration` returns only the type definition and the row literals |
| Main-set percentages in the Task B table | computed from the generated plan via the composer's own warm-up/main/cool-down split, main-set minutes divided by the session's prescribed pace |

## A.6 Principles and invariants named in Task F

| Reference | Location |
|---|---|
| §1 Polarised training | `docs/canonical/CoachingPrinciples.md:50` |
| §5 Specificity | `:131` |
| §7 Hard / easy | `:172` |
| §8 Quality session frequency and sizing | `:186` |
| §9 Long-run rules | `:209` |
| §10 VDOT conservatism | `:223` |
| §11 Pace ranges, not points | `:240` |
| §12 Easy-run zone cap | `:253` |
| §13 Fitness classification | `:263` |
| §16 Universal run format | `:329` |
| §17 Plan signatures | `:343` |
| §19 Session label integrity | `:363` |
| §20 VDOT surface | `:373` |
| §21 Injury-aware session selection | `:383` |
| §22 Race-specific exposure | `:393` |
| §33 Coach notes by session intent | `:572` |
| §34 Invariant registry — declared and exercised | `:582` |
| §36 Taper quality variety | `:613` |
| §41 Effort copy matches the work prescribed | `:671` |
| §44 Prep-time validation / difficulty band | `:703` |
| §53 Quality variety across the full plan | `:951` |
| `INV-PLAN-LABEL-MATCHES-PACE` | `lib/plan/invariants.ts:475–548` |
| `INV-PLAN-INJURY-NO-HILLS` | `lib/plan/invariants.ts` (registry entry line 28) |
| `INV-PLAN-MIN-SESSION-SIZE`, `INV-PLAN-QUALITY-PER-WEEK`, `INV-PLAN-QUALITY-VARIETY-FULL-PLAN`, `INV-PLAN-RACE-SPECIFIC-EXPOSURE` | `lib/plan/invariants.ts` — `INVARIANT_CODES` registry, lines 24–120 |
| Plan schema rule that quality content originates from the catalogue | `docs/canonical/plan-schema.md:246` (INV-PLAN-010) |
| ADR-017 conflict-scan requirement | `docs/architecture/ADR-017-coaching-board-authority.md` |
