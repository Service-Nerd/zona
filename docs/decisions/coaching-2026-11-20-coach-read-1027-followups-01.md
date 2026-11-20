# Coaching Board — 2026-11-20 — `COACH-READ-1027-FOLLOWUPS-01`: the seven claims from the 27 Oct read, re-measured

Seats: Hutchinson (chair), Seiler, McMillan, Willy, Sims. Blagrove silent.

**The item's own instruction:** *"Re-measure each on the grids before it reaches a sitting."* Done first; the board
then sat **only on what survived**.

---

## 📐 The measurement

`npx tsx scripts/board-evidence-coach-read-1027-followups-01.ts 41` (read-only, plans in memory). Populations:
**A** cohortGrid stride 41 (969 plans; masters 484, declared beginner 325) · **B** targetedGrid rows with an injury
history (462, age 40 in the grid) · **C** B re-aged to 58 (462 — the injury × masters cell **neither grid reaches**,
constructed as `measure-plan-fitness.ts` does) · **P** the 21 charity personas the read itself used (20 generate, M7
refused by design). All rates are **plans with at least one instance**, not weeks.

| # | claim (as read 2026-10-27) | how measured | A | A masters | A beginner | B injury | C inj×masters | named cases |
|---|---|---|---|---|---|---|---|---|
| 1 | deloads that do not reduce | ratified `INV-PLAN-DELOAD-IS-A-REDUCTION` | 4.1% | 2.9% | 10.5% | 10.4% | 10.0% | **m3 w10: deload +27%** · **t3 w6: −0% (equal — the check's strict `>` passes it)** |
| 2 | delivered ramps past §2 (injury/masters) | ratified `INJURY-CAP-DELIVERED` / `DELIVERED-RAMP` | 0 / 18.4% | 0 / 19.8% | 0 / 17.5% | 17.5% / 7.8% | 10.8% / 10.4% | read quoted 18.3% / 25.6% (sweep) |
| 3 | long run cut harder than its deload week | deload where LR cut > week cut + 5pp (§3 Am.'s own measure) | **58.0%** | 65.7% | 55.1% | 75.1% | **87.0%** | **e1 w11: week −3%, LR −22%** |
| 4a | "highest volume" on a week that is not | label `Peak — highest volume` on a week a later non-race week out-volumes | 9.1% | 11.2% | 7.4% | **39.0%** | 24.5% | 8 of 20 personas, mostly by 1–2 km |
| 4b | "step-back" on a week that is not | §47 note on a long run ≥ the largest prior non-deload long run | **1.3%** | 1.7% | 0% | 0% | 0% | 0 of 20 |
| 5 | "not to chase a time" on plans prescribing race-pace work | sentence in the plan notes AND a session stamped `race_pace` or labelled `*-pace` | **123 of 155** | 61 of 78 | 52 of 64 | 0 of 39 | 0 of 31 | **m4, e2 confirmed**; case 04 is a canonical case, not in P — not measured |
| 6 | easy runs growing inside the taper | a taper week's largest easy run > the previous week's by > 0.5 min | 10.2% | 10.1% | 9.8% | 15.2% | **23.2%** | M2 w9: 56 → 84 min |
| 7 | five loading weeks in a row through peak, masters and beginners | longest run of weeks not deload / taper / race | 27.5% ≥ 5 | **27.5%** | 26.2% | 33.5% | 33.5% | masters' typical longest run is **4** against §3's cadence of **2** |

⚠️ **One of my own definitions was wrong first time and is corrected in the script.** Claim 4b first compared a
step-back long run with the PREVIOUS week, which is often a deload; §47 sizes it against the peak long run. That read
22.9% and it is **1.3%**. Claim 3 first read beginners' duration-anchored long runs as `distance_km ?? 0` and scored
them as removed ("LR −100%"); now sized with `sessionKmSelfPaced`. **A before/after table covers only the column it
prints** — both corrections changed the answer.

**Age of the declared warn debt (claims 1–2), from `git log -S`:** `DELOAD-IS-A-REDUCTION` since **2026-08-20 (92 days)**,
`INJURY-CAP-DELIVERED` since **2026-09-06 (75)**, `DELIVERED-RAMP` since **2026-09-07 (74)**.

**Settled-ground scan:** §3 + §3 Am. (LR-DELOAD-CUT-01: *"never cut harder than the week is"*, bounded by §52/§9);
§2 Am. 2 + `DELIVERED-TAIL-LEVERS-01` (**frozen until outcome data; "do not bring another corpus measurement"**);
ADR-022 (delivered levers, injury-scoped); §47 (step-back sized against the peak); `ruleEngine.ts` `weekLabel`
(*"'highest volume' is a claim about the plan, not just the week"*); CB-PLAN-REVIEW-01 (the finish sentence split
once already, at-ceiling vs under-built); §6 / Am. 2 (taper cut is delivered); §87 / §95 / §119 (deload placement —
which **assume** peak never deloads); `lib/plan/deloadCadence.ts` (*"Peak and taper never deload"*, a code comment).

---

## 🔍 Conflict scan
Claim 7 is the only one that reaches a **gap in the constitution itself**: §3 says *"Masters athletes recover every
third week"* with no exception; the engine exempts peak and taper (`isDeloadWeek`), and §87 / §119 reason as if that
exemption were ratified (*"week 6 fell in peak"*, *"twelve eligible weeks"*). **No section states it.** Claims 1, 3, 4a
are engine-vs-text gaps against existing sections. Claim 5 touches §114's finish-goal language and CB-PLAN-REVIEW-01.
Claim 6 touches §6. Claim 2 is settled ground.

---

### 🏃 Alex Hutchinson (Chair)
*"Of seven, one dies on its own definition (step-back), one is ours and frozen (ramps), three are the engine
disagreeing with text we already wrote — those go to build, not to me — and two are real questions. Let me take the
two."*

### 🩹 Rich Willy
*"Claim 7 is mine. We told masters runners they recover every third week. Then a peak phase quietly gives them four
and five loading weeks in a row, which is the stretch where the load is highest, and the injury-masters cell is a
third of plans. §47's long-run step-back is not a recovery week; the week total does not drop. I want the exemption
either argued and written into §3 or removed — but I will not vote on removing it without seeing what a peak deload
does to the plan. On claim 6: an easy run growing half an hour inside a taper is odd, but the week still falls under
§6 Am. 2; I need the mechanism before I call it a load problem."*

### 🎯 Greg McMillan
*"A deload inside a three-week peak usually wrecks the peak — that is why coaches don't do it. But 'usually' was for
a forty-year-old. For a fifty-eight-year-old I would rather see the measurement than argue. Claim 5 is a copy defect
and nothing more: the runner asked for a time; rehearsing it is right; telling them we are not chasing it is what's
wrong. Keep the work, change the sentence."*

### ⚕️ Stacy Sims
*"On 7: peri- and post-menopausal women recover slower and the cell where this is worst — injury and masters — is the
one neither grid reaches; you had to build it by hand to see 33.5%. Write the exemption down or end it. On 5, same as
the 19 September ruling: to a runner who entered a time, 'get you round' reads as being reassigned to a lesser
category."*

### 📊 Stephen Seiler
*"No objection on any of these from intensity. On 5 I note the race-pace work is not the problem for distribution:
§1 counts it already."*

---

### ⚡ Recorded disagreements
**Claim 7, McMillan vs Willy/Sims:** McMillan's prior is that a peak deload costs the peak; Willy and Sims hold that
an unwritten exemption for the oldest runners in the highest-load weeks is not defensible as it stands. **What settles
it:** the prototype measurement below.

## ⚖️ Rulings, claim by claim

| # | verdict | what happens |
|---|---|---|
| 1 | ⚙️ **EXEMPT — defect against §3's text.** A recovery week that carries the same volume is not a reduction; the check's strict `>` lets **t3 w6** through. | Build: the check treats equal as a violation (warn), and the delivered residual is re-counted. ⚠️ A declared warn **92 days old** is not a fixed problem. |
| 2 | 🔻 **NOT RAISED — settled.** §2 Am. 2 freezes the predicate until outcome data; `DELIVERED-TAIL-LEVERS-01` says no more corpus measurements. | Figures recorded above for the record only. |
| 3 | ⚙️ **EXEMPT, conditionally — defect against §3 Am.** (*"never cut harder than the week is"*), **unless** §52's share or §9's minutes cap explains the cases, which **was not measured**. | `/zona-debug` attributes the 58% to a bound or to the producer first. If a bound causes it, the board re-sits on which yields; if not, it is a defect fix. |
| 4a | ⚙️ **EXEMPT — defect against documented intent.** The code's own comment says "highest volume" is a claim about the plan; the predicate computes "highest so far". | Build: the label reads the plan's maximum. Copy unchanged. |
| 4b | ✅ **DOES NOT SURVIVE** (1.3% / 0%). | Closed. |
| 5 | ⚖️ **CORRECT (meaning).** A plan that prescribes race-pace or goal-pace work may not tell the runner it is *"not to chase a time"*. The work stays (McMillan). Extends CB-PLAN-REVIEW-01's split to a third case. | Words → 👤 founder. Artifacts below. |
| 6 | ⏸️ **INSUFFICIENT EVIDENCE.** Real (10.2% / 23.2% inj×masters) but the mechanism is unknown and §6 Am. 2's delivered cut still holds. | **Evidence named:** attribute the growth (which session's minutes moved, and why) on the 99 cohort plans, and show whether capping the easy run at its pre-taper size changes `INV-PLAN-TAPER-DELIVERED-DEPTH` or `measure:fitness`. |
| 7 | ⏸️ **INSUFFICIENT EVIDENCE on the remedy — and a finding on the record:** §3's masters cadence has an **unwritten peak/taper exemption**, assumed by §87 and §119 and stated only in `deloadCadence.ts`. | **Evidence named:** a prototype (flagged, not shipped) that keeps §3's masters cadence through peak, run through `measure:fitness` and `cohort:shape` on masters and injury×masters, reporting peak delivered volume, the §47 alternation, and longest loading run. Then the board either writes the exemption into §3 with its reason or removes it. |

### 📦 Required artifacts — claim 5 only (the only CORRECT ruling)
1. **Principle** — §114 (finish-goal language) amendment: the "not to chase a time" sentence is withheld where the
   plan prescribes goal- or race-pace work; cites CB-PLAN-REVIEW-01.
2. **Numeric** — none.
3. **Invariant** — an arm on the existing note/prescription consistency check (or new
   `INV-PLAN-FINISH-NOTE-MATCHES-PRESCRIPTION`, error): the sentence and a `race_pace`-stamped session never coexist.
   Falsify on the 123 cohort plans above. ⚠️ Read the **stamp**, not the label — `classifyStimulus`'s label fallback
   read 493 fitness-paced long runs as race pace (`INV-PLAN-GOAL-PACE-REACHABLE`'s record); my own count above used a
   label regex as well and so may over-count.

### ↗️ Hand-offs
👤 Founder — claim 5's replacement sentence. None to the SLT or Design Board.

## ⚠️ What this does not prove
All rates are per plan (≥1 instance), not per week. Claim 3's attribution to a bound and claim 5's label-regex
over-count are **not measured**. Claim 6's and 7's remedies need engine prototypes; nothing here says what they cost.
The canonical case 04 was not re-run. Population C is constructed (age 58 on the targeted grid), not a production
cohort.
