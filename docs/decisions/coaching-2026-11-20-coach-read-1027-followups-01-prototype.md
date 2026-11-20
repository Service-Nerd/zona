# Coaching Board — 2026-11-20 — `COACH-READ-1027-FOLLOWUPS-01` claims 6 and 7, on a prototype

Seats: Hutchinson (chair), Seiler, McMillan, Willy, Sims. Blagrove silent (no strength rule touched).

**Input:** the morning sitting (`docs/decisions/coaching-2026-11-20-coach-read-1027-followups-01.md`) ruled five of
seven claims and left two **INSUFFICIENT EVIDENCE**, naming the evidence each needed. This sitting rules on that
evidence and nothing else. Claims 1–5 are not reopened.

**Trigger:** soft (prescription changes in `ruleEngine.ts` / `deloadCadence.ts`) plus a hard one for the build
(§3, §6 amendments; one new `GENERATION_CONFIG` constant). Prototype edits are branch-only; the coaching guard's
exemption is "branch-only prototype for a board measurement, not merged".

## The two questions

- **Claim 6.** Easy runs grow inside the taper on 10.2% of cohort plans and 23.2% of injury × masters. *Which
  session's distance moves, and why; and does capping the easy run at its pre-taper size cost
  `INV-PLAN-TAPER-DELIVERED-DEPTH` or `measure:fitness`?*
- **Claim 7.** §3 says masters recover every third week with no exception, but `isDeloadWeek` /
  `computeDeloadWeeks` exempt peak and taper, and §87 / §119 reason as if that were ratified. 27.5% of masters plans
  carry ≥5 loading weeks in a row. *What does keeping §3's masters cadence through peak cost, so the board can either
  write the exemption into §3 with its reason or remove it?*

## Prototype

Branch `proto/coach-read-1027-followups-01` @ `e67eca51` (worktree
`/Users/russe/rts-training-hub/.claude/worktrees/agent-a58c894ef18b287dc`), **not merged**. Seam
`lib/plan/protoCoachRead1027.ts → PROTO_1027`, every option default `'off'`. With both off the engine is the same
code path as `main` by construction (the peak hook returns a copy of the same set, the taper hook returns at once);
this was **not** checked with `verify:parity`, which the brief excludes.

| claim | option | what it does |
|---|---|---|
| 6 | `drop` | each taper week's easy runs capped at the previous week's largest easy run; the trimmed km leave the week |
| 6 | `to_long_run` | same cap; trimmed km handed to the taper long run, bounded by §6 Am. 1 (≤ peak LR), §52 (≤ 60% of week), §9 (`applyLongRunCap`) |
| 7 | `literal` | masters: a peak deload whenever the loading run reaches cadence − 1, any peak week |
| 7 | `legal` | same, but only on peak position ≥ 3 (§87 forbids position 1; position 2 avoided by analogy with §95, which is written for build) |
| 7 | `bounded` | masters: a peak deload only where a sixth consecutive loading week would otherwise follow, on a peak position ≥ 3 |

## Evidence

`npx tsx scripts/board-evidence-coach-read-1027-followups-01-prototype.ts 41 11` (read-only, plans in memory).
Populations: **A** cohortGrid stride 41 (969 served of 1,012; 484 masters), **B** targetedGrid rows with an injury
history, stride 11 (420), **C** B re-aged to 58 (420, the injury × masters cell neither grid reaches), **P** the 21
charity personas (20 served). Strides 41 and 11 are coprime to the grid sizes (41,472 = 2⁹·3⁴; 4,614 = 2·3·769).
Production input shape (no `fitness_level` set). Rates are plans with ≥1 instance.

### Claim 6 — attribution (baseline)

Each growth instance is put in one class, in this order: an easy run **left the week** (fewer easy runs); else the
**long run fell by more km than the week** did (the excess re-spread to the easy runs); else other.

| population | plans with growth | instances | a run left the week | LR fell more than the week | other | pre-taper LR above its phase share (+2pp) |
|---|---|---|---|---|---|---|
| A | 99/969 (10.2%) | 112 | 38 (33.9%), total easy km **−4.2** | 42 (37.5%), easy km **+2.6** | 32 (28.6%), +2.0 | 74 (66.1%) |
| C inj × masters | 100/420 (23.8%) | 107 | 48 (44.9%), −3.0 | 46 (43.0%), +3.6 | 13 (12.1%), +0.5 | 59 (55.1%) |
| B injury | 65/420 (15.5%) | 72 | 7 (9.7%), −2.9 | 42 (58.3%), +3.7 | 23 (31.9%), +1.0 | 65 (90.3%) |
| P personas | 5/20 | 5 | 0 | 5 (100%), +2.6 | 0 | 5 (100%) |

**Two mechanisms, and they are different loads.** (1) The pre-taper long run is held above its phase share by the
build/peak specificity floors (§24/§35/§80), which do not apply in taper; the taper long run collapses to its 40%
share and the remainder goes to the easy runs. Named case **M2 w9**: week 40 → 33, long run 24.0 → 15.0 km, easy run
56 → 84 min. (2) A training day leaves the week in taper and the remaining easy run absorbs part of it; total easy
volume *falls*, one run gets longer. Quality count fell in 8 of 112 A instances only.

### Claim 6 — the cap

| | A base → drop / to_long_run | C base → drop / to_long_run | P base → drop / to_long_run |
|---|---|---|---|
| plans with taper easy growth | 10.2% → 0.6% / 0.6% | 23.8% → 0% / 0% | 5 → 0 / 0 |
| plans changed | — 96 (9.9%) / 96 | — 100 (23.8%) / 100 | — 5 / 5 |
| `INV-PLAN-TAPER-DELIVERED-DEPTH` plans | 0 → 0 / 0 | 0 → 0 / 0 | 0 → 0 / 0 |
| first taper week / pre-taper week (mean) | 79.5% → 78.9% / 79.4% | 77.7% → 76.8% / 77.7% | 78.7% → 76.9% / 78.7% |
| taper km, total (mean) | 47.7 → 47.4 / 47.7 | 48.6 → 48.0 / 48.6 | 68.3 → 67.5 / 68.3 |
| taper LR / peak LR (mean) | 84.7% → 84.7% / 85.7% | 74.0% → 74.0% / 75.6% | 72.9% → 72.9% / 75.8% |
| new invariant codes / codes gone | none / none | none / none | none / none |
| `volume_profile` flips | 0 / 0 | 0 / 0 | 0 / 0 |

Residual after the cap (6 A plans): the same 4 km easy run re-priced 28 → 30 min — the minutes grew at a fixed
distance, so the cap (in km) does not see it. Not volume growth.

`ZONNA_PROTO_1027_TAPER=drop npm run measure:fitness`: **identical output to the baseline run** (every bucket, every
persona).

### Claim 7 — masters cadence through peak

| A masters (484) | base | literal | legal | bounded |
|---|---|---|---|---|
| plans changed | — | 383 (79.1%) | 140 (28.9%) | **6 (1.2%)** |
| longest loading run ≥ 5 | 133 (27.5%) | 0 | 0 | 133 (27.5%) |
| longest loading run ≥ 6 | 6 (1.2%) | 0 | 0 | **0** |
| distribution | {2:101, 4:250, 5:127, 6:4, 7:2} | {2:484} | {2:107, 3:4, 4:373} | {2:101, 4:250, 5:133} |
| peak deloads placed | 0 | 389 | 140 (125 on the **final** peak week) | 6 |
| peak deload, delivered cut vs prior week, mean | — | 15.7% | 23.4% | 29.3% |
| peak deload that does **not** reduce (≤ 0%) | — | **77/389 (19.8%)** | 7/140 (5.0%) | 0/6 |
| peak deload cutting < 10% | — | 127/389 (32.6%) | 21/140 (15.0%) | 0/6 |
| peak-phase mean weekly km | 35.2 | 32.8 (−6.8%) | 34.3 | 35.1 |
| plan peak weekly km | 37.1 | 36.3 | 36.9 | 37.1 |
| longest long run | 16.0 | 15.7 | 15.9 | 16.0 |
| §47 step-backs per plan | 0.4 | 0.2 | 0.4 | 0.4 |
| `maintenance` profile | 273 (56.4%) | 291 (60.1%) | 274 (56.6%) | 273 (56.4%) |
| new codes (plans) | — | DELOAD-IS-A-REDUCTION 35, PEAK-SPECIFICITY 21, PEAK-NOT-BELOW-START 10, PEAK-IN-PEAK-PHASE 5, NOT-DETRAINING 1 | DELOAD-IS-A-REDUCTION 6, PEAK-NOT-BELOW-START 4, DELIVERED-RAMP 2, NOT-DETRAINING 1 | none |
| codes gone (plans) | — | DELIVERED-RAMP 25, DELOAD-PHASE-POSITION 1, LR-MAX-WEEKLY-PCT 1 | DELIVERED-RAMP 2, LARGEST-SESSIONS-SPACED 2, DELOAD-PHASE-POSITION 1 | none |

| C injury × masters (420) | base | literal | legal | bounded |
|---|---|---|---|---|
| plans changed | — | 281 (66.9%) | 140 (33.3%) | 0 |
| longest loading run ≥ 5 | 140 (33.3%) | 0 | 0 | 140 (33.3%) |
| peak deload that does not reduce | — | 48/281 (17.1%) | 23/140 (16.4%) | — |
| peak-phase mean km | 34.1 | 31.3 (−8.2%) | 33.2 | 34.1 |
| new codes (plans) | — | **BOUNCEBACK-BOUNDED 46**, PEAK-NOT-BELOW-START 14, DELOAD-IS-A-REDUCTION 13 | PEAK-NOT-BELOW-START 5 | none |
| codes gone | — | DELIVERED-RAMP 5 | INJURY-CAP-DELIVERED 9 | none |

The six ≥6 runs are long-peak plans: an HM masters plan with a **five-week** peak (weeks 9–13, run 7) and a marathon
with a four-week peak (run 6). Sanity: the claim-7 flag moved **0 of 60** non-masters plans.

`ZONNA_PROTO_1027_PEAK=literal npm run measure:fitness`: CAPPED-INJURY masters median build **41.2% → 31.3%**,
marathon peak LR 66.4 → 64.0% of race; other masters median build 17.9 → 17.6%, never-builds **14.2 → 14.8%**;
**M5 (masters charity marathon, 58)** peak LR 29.5 → 26.0 km, net build **94% → 62%**. Standard buckets unchanged.

`ZONNA_PROTO_1027_PEAK=literal npm run cohort:shape` (no `--write`), against the committed `cohortShapeBaseline.json`: maintenance **55.9 → 57.6%**, constrained-by-inputs 14.1 → 15.0%, volume-constrained 20.7 → 22.3%, mean delivered peak 37.24 → 36.84 km, maintenance by distance 5K 55.3 → 58.0, 10K 51.0 → 52.7, HM 47.1 → 49.0, marathon 72.9 → 73.1. Quality per build week and plan length unchanged.

`ZONNA_PROTO_1027_PEAK=bounded npm run measure:fitness`: **identical output to the baseline run.**

---

## 🔍 Conflict scan

- **§3** (cadence, no exception) vs `deloadCadence.ts` (peak/taper exempt) — the gap this sitting closes.
- **§3 Am.** (LR-DELOAD-CUT-01) — a peak deload would have to cut its long run in proportion; untouched by the
  ruled options.
- **§47** — the peak's own recovery device. `literal` halves step-backs per plan (0.4 → 0.2) by turning peak weeks
  into deloads; `bounded` leaves them at 0.4.
- **§87 / §95 / §119** — reason about placement inside base/build and assume peak never deloads. `bounded` places
  only at peak position ≥ 3, so none is engaged; §95 is written for build and was applied to peak by analogy only.
- **§6, §6 Am. 1, §6 Am. 2** — the cap trims easy runs only; §6 Am. 2's delivered target is a ceiling and is not
  breached (0 → 0). §6 Am. 1 bounds `to_long_run`.
- **§9 / §52** — `drop` only lowers easy runs, so the long run's margin and share move the right way for §9; §52's
  60% share can rise. Measured: no new `LR-MAX-WEEKLY-PCT` on any population.
- **§24 / §35 / §80** — the specificity floors that hold the pre-taper long run above its share are the cause of
  mechanism (1). Not changed: they are correct where they apply; the defect is the easy run inheriting their release.
- **§34** — nothing is left undeclared by `drop` or `bounded`.
- **Five-zone translation:** not engaged.

---

### 🏃 Alex Hutchinson (Chair)
*"Claim 6 came back with a mechanism, which is what we asked for. Two of them. In a third to a half of cases the long
run is let go from a floor the taper does not carry, and the easy run catches the difference — M2 runs 84 minutes
easy in the week after a 24 km long run is cut to 15. That is not a taper, it is a reshuffle. The cap fixes it with
no invariant moved and `measure:fitness` byte-identical. On claim 7 the literal cadence is the clearest case we've
had of a rule that reads protective and measures harmful: one in five peak 'recovery weeks' it produces do not
recover anything, and it takes a third off a fifty-eight-year-old's marathon build. Write the exemption down. But I
will not write an exemption with no upper bound, and the bounded placement is the bound."*

### 📊 Stephen Seiler
*"§6 is 'cut volume, keep intensity'. `drop` cuts 0.3 km of taper on average and touches no quality session; that
is the principle working. `to_long_run` moves the cut volume into the session that carries the most fatigue, in the
taper. I prefer `drop`. On 7, no intensity-distribution objection to any option; I note the literal option's 21
`PEAK-SPECIFICITY` warnings, which is the peak losing its race-specific work."*

### 🎯 Greg McMillan
*"I said a peak deload usually wrecks the peak, and I said I'd rather see it than argue. Here it is: M5's net build
goes 94% to 62%, peak long run 29.5 to 26. And the `legal` version is worse than it looks — 125 of its 140 deloads
land on the last peak week, so it is not a recovery week, it is a four-week taper wearing a badge. The bounded
version is what a coach does: three or four hard weeks, then you back off, and you never ask anyone for seven. On the
taper, the runner sees a taper that gets *longer* on Friday; that breaks trust. Cap it and drop the excess. A runner
does not notice 0.3 km gone from a taper; they notice an 84-minute easy run."*

### 🩹 Rich Willy
*"I asked for the exemption argued or removed. It is argued now, with numbers: a peak deload the engine cannot deliver
(19.8% do not reduce at all; 32.6% cut less than 10%) protects no tissue, and in the injury × masters cell the
literal version adds **46** bounceback warnings — a deload in peak followed by a jump back to peak load is the exact
pattern §2 Am. 3 bounded. So I'll vote to write it. My condition is the ceiling: nobody over 45 gets six or seven
consecutive loading weeks, and the 1.2% who do today get a real deload — 29% cut, none flat — not a note. On claim 6,
mechanism (2) is a load spike at session level even when the week falls: one run growing half an hour is what a
tendon notices. The cap covers both mechanisms; good."*

### ⚕️ Stacy Sims
*"My worry was the injury × masters cell, and it is the cell where the literal remedy does the most damage — peak km
−8.2%, 46 bounceback warnings. Ending the exemption would have hurt the women I was speaking for. I'll accept the
exemption written into §3 on two conditions: the five-week ceiling, and §3's text says the peak's recovery is §47's
step-back long run plus the taper, so a reader of §3 is not told 'every third week' and handed five. On 6, no
objection; I prefer the volume leaves rather than going into the long run."*

---

### ⚡ Recorded disagreements

- **Claim 6, drop vs to_long_run.** McMillan briefly argued for `to_long_run` (it keeps the week the taper curve
  asked for), then withdrew it: the taper long run already sits at §6 Am. 1's bound in some plans and the measured
  depth cost of `drop` is 0.6pp on the first taper week. Seiler, Willy and Sims prefer `drop`. No dissent at the vote.
- **Claim 7, the ceiling.** Willy would set it at 4 (masters cadence + 2); Hutchinson and McMillan at 5. **Settled on
  measurement:** a ceiling of 4 is the `legal` option in effect (it moves 140/484 plans and 140/420 injury × masters,
  89–100% of them by deloading the final peak week, with 16.4% of those deloads delivering no reduction in C).
  Willy accepts 5; his position is recorded and would reopen on outcome data showing injury in five-week runs.

## ⚖️ Ruling

### Claim 6 — **CORRECT (option `drop`)**

An easy run may not grow inside the taper. Each taper week's easy runs are capped at the previous week's largest easy
run, measured in km by `sessionKmSelfPaced`; trimmed distance leaves the week. `to_long_run` is not adopted.

### Claim 7 — **CORRECT WITH AMENDMENT — write the exemption into §3, bounded (option `bounded`)**

Removing the exemption (`literal`) is **INCORRECT** on the measurement: it delivers no reduction on 19.8% of the peak
deloads it places, lowers masters peak-phase volume 6.8% (8.2% injury × masters), cuts CAPPED-INJURY masters median
build 41.2 → 31.3% and M5's 94 → 62%, and adds 46 bounceback warnings in the injury × masters cell. `legal` is not a
recovery week but an early taper (125/140 on the final peak week). The exemption is written into §3 with its reason
and an upper bound: a masters plan's run of consecutive loading weeks may not exceed five; where a sixth would
follow, a deload is placed on a peak week at position ≥ 3.

## 📦 Build spec (one commit per claim)

**Claim 6**
1. **Principle** — §6 Amendment 3, *"An easy run does not grow inside the taper"*: each taper week's largest easy run
   ≤ the previous week's largest easy run (km); trimmed distance leaves the week; quality and the long run untouched.
   Why: the §24/§35/§80 long-run floors release at taper and the excess was re-spread to easy runs, or a day left
   the week and one run absorbed it (attribution table above).
2. **Numeric** — none new. Tolerance reuses `DISTANCE_ROUNDING_PRECISION_KM`.
3. **Invariant** — `INV-PLAN-TAPER-EASY-NON-INCREASING` (**warn**): for each non-race taper week, max easy-run km
   (`sessionKmSelfPaced`) ≤ previous week's max + `DISTANCE_ROUNDING_PRECISION_KM`. Falsify on the 99 cohort plans /
   100 injury × masters plans above (base fires, `drop` silent). Read **km**, not minutes: the 6 residuals are a
   minutes-only re-price at fixed distance.
4. **Producer** — a pass after `applyTaperDeliveredDepth` (the prototype's `protoCapTaperEasy`, `drop` branch),
   writing back to the session's own anchor.

**Claim 7**
1. **Principle** — §3 Amendment 2, *"The cadence governs base and build; peak and taper are exempt, and bounded"*:
   peak's recovery is §47's step-back long run and the taper that follows; a peak deload is not delivered as a
   reduction (measured above). A masters plan's longest run of consecutive loading weeks (not deload, taper or race)
   may not exceed `MASTERS_MAX_LOADING_RUN_WEEKS`; where a further loading week would exceed it, a deload falls on
   the first peak week at position ≥ 3. Cite §87/§119, which already assume this.
2. **Numeric** — `GENERATION_CONFIG.MASTERS_MAX_LOADING_RUN_WEEKS = 5`, with its principle row (configPrincipleSync).
3. **Invariant** — `INV-PLAN-MASTERS-LOADING-RUN-BOUNDED` (**warn**): masters plans (`mastersCadenceApplies`) whose
   longest loading run exceeds the constant. Falsify: base fires on 6/484 A masters, `bounded` on 0.
4. **Producer** — in `deloadCadence.ts`, the single owner (`protoPeakDeloads` `bounded` branch, made permanent,
   reading the constant). `isDeloadWeek`'s comment cites §3 Am. 2.

### Conditions
- Claim 7 is masters-scoped. The standard cadence's longest loading run through peak was **not measured**; it is not
  ruled.
- Run `npm run cohort:shape` at build for both claims (not run here on `drop` or `bounded`) and `measure:fitness`;
  declare any moved baseline.
- `invariant:liveness` must wake both new invariants (falsification populations named above).

### ↗️ SLT escalation
None.

## ⚠️ What this does not prove

- `cohort:shape` was run on `literal` only; not on `bounded` (6/484 A plans move) or `drop`. `measure:fitness` was
  run on `drop`, `literal` and `bounded`; `drop` and `bounded` are byte-identical to baseline.
- Seam-off equals `main` by construction, not by `verify:parity`.
- Population C is constructed (age 58 on targetedGrid), not a production cohort; the 1.2% ≥6-run tail is from A only.
- The prototype's `legal` mode avoided peak position 2 by analogy with §95, which is written for build.
- No outcome data: whether five loading weeks injure masters runners more than four is not answerable from plans.

Observed, not filed: taper easy runs re-priced 28 → 30 min at a fixed 4 km distance (6 A plans) — a pace change
between consecutive taper weeks, not measured further.
