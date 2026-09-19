# Backlog — Zonna

**State at end of 2026-09-19 (last ship `4ba1783`):** `npm run verify` exit 0 — **2,397 tests / 269 files** · 122 invariants · sweep clean · `audit-docs.sh` ALL CLEAN. **ENGINE WORK IS DONE; the backlog is NOT empty.** ⚠️ Earlier state blocks said "ENGINE BACKLOG CLOSED" and that was WRONG — `S111-SUBFLOOR-VOLUME-01` remains open. It needs no engineering: it asks whether to build a base-building plan type for runners under §111's 12 km/week door, and the SLT ruled not to build it blind. **What changed today is that it is no longer blocked on a person** — `REFUSAL-TELEMETRY-01` records every designed refusal, so the distribution arrives from real redemptions instead of from an answer nobody has. Final ship: `S111-DENOMINATOR-01` (§111 Am.2 + 2a), both boards unanimous, **+456 beginner-marathon refusals accepted** because those plans carried a **+114% week-one leap with ZERO invariant violations**.

**The engine day, in one line each.** Three items CLOSED as **withdrawn or negative results** (§23 already legislated `PEAK-VS-DELIVERED-BUILD-01` and the engine complies 15,464/15,464; §114 took §111's 93% hazard to **0.00%**; §52's share is a **fixed point** and cannot be driven down by shortening the long run). Two defect fixes SHIPPED (`V4-ANCHOR-01`, `QUALITY-ZERO-SCOPE-01`). One board ruling **CORRECT and DELIBERATELY NOT SHIPPED** (§110 Am.2 — blocked by the catalogue, **1 of 29 rows is beginner-eligible**).

⚠️ **FOUR OF THE SIX THINGS I BROUGHT TO THE BOARD DISSOLVED UNDER MEASUREMENT**, two of them during the conflict scan before any seat spoke, and one was a *success* metric that was reading the defect it claimed to fix (beginner goal-pace exposure showed 0% → 100%; those labels came from the null-catalogue-row fallback). **A label is not a prescription.** The invariant caught it; my measurement did not.

⚠️ **`distance_km` as a proxy for a coaching classification appeared FOUR TIMES in one day** — LR-CAP-BLIND-01, SESSION-KM-01/02, `V4-ANCHOR-01`, `QUALITY-ZERO-SCOPE-01`. It is a grep, not a discovery.

🔴 **Still open:** `CAT-DEPTH-01` (root cause now a number: **1 of 29**; ESCALATED TO SLT; blocks §110 Am.2). *(Device verification is the founder's own task and is no longer tracked here, at his instruction 2026-09-19.)*


**Job:** The detailed item store — full specs, scope notes, SLC framing for everything left to ship (product *and* go-to-market).
**View:** For the at-a-glance Now/Next/Later plan across product + market, see **`docs/releases/roadmap.md`** — it surfaces these items as one-liners on a horizon × workstream grid. This doc holds the detail behind each.
**Pair:** When an item ships, the `/ship` skill moves it to `docs/canonical/feature-registry.md` "Shipped Features" table. An item lives in exactly one of the two.

Status: 🔲 not started · 🔄 in progress · ❓ needs verification

---

**State at END of 2026-09-19 (last ship `031ecfa`):** ✅ tree clean. **2,341 tests / 261 files** · tsc clean · 121 invariants · matrix 65/0 · sweep **14,484 plans, no new violations** · coaching scan **HIGH 0** · liveness **118/121** · `audit:plans` GATED and clean · `audit-docs.sh` ALL CLEAN. **18 commits.**

🥇 **THE ENGINE'S PRIORITY-ONE DEFECT IS FIXED. `S114-GET-YOU-ROUND-01` — founder decision.** Where the week cannot hold the long run the race asks for, **the long run yields and the plan says so.** Measured on 6,480 beginner-marathon inputs: a week with one session ≥75% of it **45.2% → 0%** · loading weeks with ≤2 runs **40.5% → 0%** · any week over §52's 60% **37.9% → 0.2%** · fewer days than asked **49.4% → 33.7%** · **refused 2,358 → 2,321, FEWER**.

⚠️ **The intended cost, declared not hidden:** peak long run short of 55% of race distance on **59.2%** of plans. For this cohort that is the honest answer, and §80's note tells the runner — *"go out slower than feels right and take the walk breaks early rather than late."* **A shorter long run nobody mentions is not a get-you-round plan.**

⚠️ **FOURTEEN ATTEMPTS TO RAISE THE WEEK INSTEAD ALL FAILED** (tables in §9's *Recorded structural finding* — **do not retry**). The week cannot be raised: an 8 km/wk runner cannot reach the 43 km a 26 km long run needs in 19 weeks under §2 once §3's deloads take 30% four times.

🟢 **Also shipped today:** `CB-HILL-INJURY-01` (**a live safety defect — knee-history beginners were prescribed hill strides; §21's invariant matches the LABEL and the label lied. Found by making a label honest, not by measuring**) · `MAINT-LIVENESS-01` (**the harness was calling the wrong validator**, 107→118/121) · `GRID-MARATHON-CAPABLE-01` (**the grid could not contain a §24-capable marathoner**) · `STRIDE-VISIBILITY-01` · `TAPER-FLOOR-FLAT-01` · `STEPBACK-STALE-PEAK-01` · `PLAN-QUALITY-AUDIT-01` · `PLAN-NOTE-LENGTH-01` · `INV-MSG-ROUNDING-01` · `XREF-DANGLE-01`.

🟢 **ENGINE OPEN LIST, end of 2026-09-19:** ~~`PEAK-VS-DELIVERED-BUILD-01`~~ CLOSED (withdrawn — §23 legislates it, 100% compliance) · ~~`S111` metric anti-correlation~~ CLOSED (§114 took the hazard to 0.00%) · ~~`S52-LOPSIDED-BOUND-01`~~ CLOSED (negative result) · ~~`CAT-DEPTH-01`~~ **CLOSED — shipped 2026-09-19**. *(Device verification is founder-owned, untracked.)*

## 🥇 2026-09-19 — THE ENGINE AUDIT. Batched board + SLT, every open coaching item ruled.

**The founder's standing instruction, and the standard everything below is judged against:**
> *Every plan we generate — every distance, every input — must be fit for purpose and something the coaching board and the product group are **proud to hand over**. They must let people grow and achieve their goals. **Priority one is the marathon runner just starting out**, who may never have run before. **Minimise dropouts.*** A **refusal is a dropout**; a **degenerate plan is worse than a refusal**.

🔴 **THE ANSWER TODAY IS NO, AND IT IS MEASURED.** `npm run audit:plans` (new, baselined) over **6,480 beginner-marathon inputs**:

| | |
|---|---|
| **Refused outright — no plan at all** | **2,358 · 36.4%** |
| Delivers fewer days than the runner asked for | 2,038 · 49.4% |
| One session ≥75% of its week | 1,863 · 45.2% |
| Loading weeks with ≤2 runs | 1,671 · 40.5% |
| Week 1 jumps >30% above their real base | 1,351 · 32.8% |

**Two flagship cases — 10 km/wk with a 5 km longest run, and 5 km/wk never really run — are both REFUSED.** Yesterday's *"14 of 14 charity personas fit for use"* was measured against a different bar; on this one they score BINGE 30.8%, WEEK1-LEAP 23.1%, DAYS-SHORT 15.4%.

🔴 **WHAT PRINTING A PLAN FOUND THAT NO METRIC DID.** The Sunday long run goes **5.3 → 26.0 km** while Monday, Wednesday and Friday sit at **3.9 km in week 1 and 3.9 km in week 13**. **83% of beginner-marathon plans regress the midweek runs below their base-phase best when the build begins; 29% stall one for 5+ consecutive weeks.** And the plan barely varies with the runner: **14 volumes produce 6 distinct plans** — 14/15/16/17/18 km/wk are **byte-identical** *(30+ is §10's `<6mo` cap working as designed; the 14–18 band is not)*.

🔴 **SIX INSTRUMENTS BUILT AND MEASURED, ALL SIX TRADED ONE DEFECT FOR ANOTHER. Full table in §9's Recorded structural finding — do not retry blind.** The reason is one sentence: **§45's cap is multiplicative on the previous week's long run, so reducing any week ratchets the trajectory down and it never recovers.** A post-hoc bound on the long run cannot fix composition without destroying specificity. **The remedy is architectural — size the long run and the week TOGETHER at construction (`buildWeekSessions`) — and it is the single highest-value open item on the engine.**

### ✅ Shipped today
- 🔴 **`CB-HILL-INJURY-01` (§28 Am.2) — A LIVE SAFETY DEFECT.** §28 Am.1 shipped 2026-09-18 without consulting `injury_history`, so a **knee-history beginner was prescribed hill strides**. ⚠️ **Invisible because `INV-PLAN-INJURY-NO-HILLS` classifies by LABEL and the label said `Easy run — Zone 2`.** Found by making the label honest, not by measuring. Predicate now has one owner (it had three).
- **`STRIDE-VISIBILITY-01`** (SLT) — strides are 100% of eligible weeks (22,558/22,558) and were invisible. Also removed a dead `hasStrideNote()` label arm that had just become a hole in the enricher net.
- **`TAPER-FLOOR-FLAT-01`** — binds on **38.8%** of taper weeks, not the 5K edge case filed.
- **`PLAN-QUALITY-AUDIT-01`** — the fifth question, with a committed baseline.

### ✅ Closed by measurement, no action
`S80-MATERIALITY-EVIDENCE-01` **discharged by its own test** — the shortfall distribution is bimodal with an **exactly empty 2–5% band** (14 at 0–2%, **0**, then 17 / 22 / 2), so 5% sits in the gap · `BEGINNER-5K-QUALITY-01` — 77% carry zero quality but **0% lack neuromuscular stimulus** · `S28-CAP-ORDER-01` — **the filed mechanism does not exist**: `applyWeekdayMinsCap` never changes `s.type`, and 100% of eligible weeks already get strides · `QUALITY-FLOOR-SUBFLOOR-01` · `BRAND-MAINT-LABEL-01` (SLT) · `S45-ABS-STEP-01` — correct in principle, **measured harm exceeds benefit** (M2 net build 68% → 44%).

### ⏸️ Ruled, not built
`S111-FOUNDATION-CREDIT-01` **VETOED** (crediting unperformed training) · `S111-SUBFLOOR-VOLUME-01` + `S111-DENOMINATOR-01` + ~~`S52-LOPSIDED-BOUND-01`~~ (**CLOSED 2026-09-19, negative result**) + `LR-CONSEC-01` + `S24-FLOOR-REACHABILITY-01` — **all now subordinate to the one architectural fix above** · `BRAND-EMDASH-01` **KILLED** (SLT) · `PLAN-NOTE-PLACEMENT-01` **PARKED** (SLT) · `SUBFLOOR-COHERENCE-01`, `TT-PRICING-CLAIM-01`, `TT-FREE-BENCHMARK-01` **BUILD** (SLT, not engine work).

**Records:** `coaching-board-2026-09-19-s111-subfloor.md`, `-s52-composition.md`, `slt-2026-09-19-base-building.md`, §9 Recorded structural finding, §28 Am.2, §90 Recorded finding, §111 Recorded limitation.

---

## 📍 PICK UP HERE — END OF 2026-09-18

**Tree clean, pushed** (last ship `64cbcf7`, 2026-09-18). `npm run verify` exit 0 — **2,339 tests / 260 files** · 121 invariants registered · sweep **14,470 plans, 0 hard failures**, no new violations · HIGH 0 · `./scripts/audit-docs.sh` ALL CLEAN. **33 ships across 109 commits today.**

🔴 **THE CHARITY BAR, MEASURED AFTER THE DAY'S ENGINE CHANGES** — `coaching-review/2026-09-18/charity-fitness-verification.md`. **14 of 14 personas can get a plan, 0 error violations on every one**, every plan builds (22–161% net), every plan carries neuromuscular stimulus. M4 refuses on first pass and is a **warn-and-acknowledge gate, not a block** — all three of its alternatives were FOLLOWED and tested, and the acknowledgement path gives a 16-week plan with 0 errors. **The measured door for a beginner marathon is 12 km/week** (was 16 this morning).

⚠️ **WHAT IS NOT PROVEN: nothing shipped today has run on a device** (`DEVICE-VERIFY-01`). Every figure above is from the engine.

**Today's engine changes, in order:** §113 Am.1 (`CB-SUBFLOOR-ADMIT-01` — the floor may not manufacture the leap it then refuses over) · §28 Am.1 (`CB-BEGINNER-HILLS-01` — beginners get short hill strides, alternating) · `S106-RACE-PEAK-01` (§111 was counting the marathon itself as training volume; door 16 → 12 km/wk, sweep +240 plans) · plus `PREF-SWEEP-01`, `REFUSAL-COPY-02`, `REFUSAL-ALT-REACHABLE-01`, `COMPONENT-CONTRACT-GATE-01`, `CI-SLOW-DRIFT-01`, `OPS-DBCHECK-NOISE-01`, `FATIGUE-ARRAY-DRY-01`, `FIRSTRUN-GATE-CALL-01`.

⚠️ **FIVE OF MY PREMISES FAILED MEASUREMENT TODAY** — beginners-get-no-strides (they get them in 100% of plans; I read session `type`) · §80 distance-vs-duration · the foundation-block route to §113 · §111 "too restrictive at long runways" (compounded §2 over the runway, not the 13 build weeks) · the "16 km/week surplus peak" (**it was the race week**). Every one was an aggregate or a proxy instead of the thing. **Print the curve, not the max.**

> 📌 **EVERYTHING OPEN FROM 2026-09-18, one line each — the index exists because two findings hid in prose today.**
>
> | Item | P | What it is |
> |---|---|---|
> | ~~`GRID-SUBFLOOR-01`~~ | ✅ **CLOSED 2026-09-19 — the cohort has a corpus now** | `PLAN-QUALITY-AUDIT-01`'s beginner-marathon grid varies `longest_recent_run_km` over 0/2/3/5/8/12 — **25 of its 45 volume × longest combinations are sub-floor** — so the cohort is measured on every build. The original question was whether to add the row to `cohortGrid`, and the answer stands: `cohort:shape` answers *"who gets what KIND of plan"* and these rows largely produce no plan, so they would dilute every published rate. **The blindness it was filed about is gone; the grid decision it argued about is unchanged.** |
> | 🆕 `S111-FOUNDATION-CREDIT-01` | **P1 — Coaching Board, filed 2026-09-19** | **§111 refuses inside `generateRulePlan`; `composePlanWithFoundation` runs AFTER, at the route — so a foundation block can never rescue a refused runner.** A 3-week block at `FOUNDATION_WEEKLY_INCREASE_PCT` 10% takes 10 → 13.3 km/wk, which **clears the 12 km door**, and the sub-floor runner has **~9 weeks of pre-plan runway** (20-week plan, 29-week race) of which the engine will use at most 3. **The question: may §111 measure against the volume a PLANNED foundation block would reach?** ⚠️ **Hutchinson and Willy both flagged it and it is NOT a foregone conclusion — crediting a runner for training they have not done is weaker than self-report, not stronger, and this cohort's defining risk is that they drop out.** ⚠️ Would move §111 across the **ADR-020 single-construction boundary**, the highest-risk part. Cheap to build, genuine coaching question — sitting before build |
| ~~`S45-ABS-STEP-01`~~ | ✅ **CLOSED 2026-09-19 — CORRECT IN PRINCIPLE, NOT SHIPPED** | `LONG_RUN_PROGRESSION_CAP_ABS_KM = 5` is disproportionate at low absolute distances: a +5 km step on a 10.5 km long run is **+48%** against §45's 20% pct cap, and the invariant permits it because the rule is the GREATER of the two. ⚠️ **PRE-EXISTING, not introduced by CB-SUBFLOOR-ADMIT-01** — measured worse for runners already admitted (longest 12 → **62%**) than for the newly admitted (longest 2 → 50%). Coaching Board question |
> | ~~`STRIDE-VISIBILITY-01`~~ | ✅ **SHIPPED 2026-09-19** | **SLT ruled BUILD 2026-09-18** (escalated by the Coaching Board, which ruled it explicitly not theirs). §28 places strides on one midweek easy run from week 3 — **100% of plans, mean 10.1 stride runs; the reviewed beginner marathon carries 14** — and all of them are labelled `Easy run — Zone 2`, byte-identical to a plain easy run. **Option 1 ONLY: a distinct label (`Easy run + strides — Zone 2`), all levels, no chip, no description change, no level gating.** Wood's binding condition: descriptive, never congratulatory. Traynor's second half: once labelled, stride runs become distinguishable in completion data, which is the exact evidence Hutchinson named for reopening the compliance question. ⚠️ Label must be DERIVED from the structural fact that strides were placed — nothing may branch on the string (D-17). ⚠️ Parity moves on 100% of plans |
> | ~~`S28-CAP-ORDER-01`~~ | ✅ **CLOSED 2026-09-19 — MEASURED NO-OP** | **§28 places the stride note in step 4 of `buildWeekSessions`; `applyWeekdayMinsCap` runs in step 5 and can CONVERT a quality session to easy.** A run that becomes eligible after the cap never gets offered strides. ⚠️ **PRE-EXISTING and affects every level** — not a beginner issue and not caused by §28 Am.1. Surfaced only because `INV-PLAN-BEGINNER-NEUROMUSCULAR`'s per-week arm is exact enough to see it; that arm is a **`warn`** with the residual declared (§34) rather than an error. Fixing it means re-running placement after the cap, which has its own blast radius and no board sitting |
> | ~~`S106-FLAT-PEAK-01`~~ | ✅ **CLOSED 2026-09-19 — residual subsumed** | The "flat 59 km peak" was the RACE WEEK and was fixed as `S106-RACE-PEAK-01`. The residual Seiler named — the level peak is a FLOOR, so a beginner starting at 16 and one at 30 both peak at 52 — is now part of **§9's Recorded structural finding**: ten instruments measured, and peak/volume levers are exactly the class that trades one defect for another. ⚠️ `GRID-MARATHON-CAPABLE-01` also showed the opposite end is worse — at 70 km/week the level peak sits BELOW the runner, which is `PEAK-VS-DELIVERED-BUILD-01`. **Not a separate item any more.** |
> | ~~`BEGINNER-5K-QUALITY-01`~~ | ✅ **CLOSED 2026-09-19 — CORRECT AS IS** | A runner with `fitness_level: beginner` racing a **5K** gets 12 weeks of FLAT volume and **zero quality** — strides/hill strides only (measured: 401 such plans, 0% with a quality session, 100% with neuromuscular). For the most intensity-dependent distance that is worth a ruling. ⚠️ **NOT claimed as a defect, and the frequency is overstated by the grid:** `fitness_level` is an API-level STRUCTURAL override that `cohortGrid` varies freely, so it manufactures "beginner running 50 km/week", which `assessFitness` would never derive from volume + VDOT. A real runner reaches it only by self-declaring DOWN in the wizard. `QUALITY_SESSIONS_PER_WEEK_MAX.beginner = 0` is ratified (§110). **Question for the board: should a self-declared beginner racing a 5K get zero quality?** |
> | ~~`S111-DENOMINATOR-01`~~ | ✅ **SHIPPED 2026-09-19 — BOTH BOARDS RULED.** Coaching Board CORRECT (unanimous), SLT SHIP NOW (unanimous). §111 now divides by `effectiveStartKm`, not the raw wizard figure. **Cost accepted: +456 beginner-marathon refusals** (+19.6% for the priority-one cohort). The boards ruled on what those runners got instead — **median 5.57× true build, +114% week-one leap, ZERO invariant violations**, typical profile 12 km/wk with a **longest run ever of 0 km**. ⚠️ **The cap must NOT be raised to absorb it** (cap 5.0 holds the count flat and admits the 10 km/wk runner §111 forbids — a flat total hid a changed composition). ⚠️ **Runway does not rescue them** (≤16 wks is worse). **§111 Am.2a:** the refusal now names WHEN to come back (Wood), derived from §2's ramp. Baselines re-cut with the ruling as the reason. |
> | 🔴 `S111-SUBFLOOR-VOLUME-01` | **P0 — BOARD SAT 2026-09-19, INSUFFICIENT EVIDENCE. §111 UNCHANGED. SLT ESCALATED AND RULED.** | **The door is exactly 12 km/wk** (not ~16). Record: `docs/decisions/coaching-board-2026-09-19-s111-subfloor.md`; §111 carries a *Recorded limitation* section. 🔴 **RULED CORRECT — §111's threshold sits where the acute step is WORST.** Measured delivered week 1: cwk 8 **+13%**, 10 **+30%**, 11 **+18%** — all REFUSED — against cwk 12 **+50%**, ADMITTED. Sawtooth, not monotonic, because week 1 is `max(startKm, peak × 35%)` and the floor is flat across a band. **This is the second of the four defects §111 was convened to remove, reproduced one layer up.** Also **runway-blind**: identical 4.70 refusal at 20 / 29 / 52 weeks. ⚠️ **NOT mechanically checkable** — the step compares a plan to an input outside it, and §2 has no predecessor for week 1. ⚠️ **TWO CANDIDATES BUILT AND MEASURED, BOTH FAILED — do not retry blind.** (A) floor yields to §2's ramp: opens the door 12→8 km/wk and makes the peak scale, but **+884 sweep violations** (§52 +516, §53 +207, §1 +161) — weeks too small to hold a coherent structure. (B) same bounded by `days × MIN_KM_PER_TRAINING_DAY`: **measured no-op** (20 km floor sits above the 16.45 init floor). ⚠️ **Willy BLOCKS any form that scales the PEAK off `current_weekly_km`** (§106's "never a scaled target", binding in both directions). ⚠️ **A hand-rolled 264-case grid showed ZERO violations where the sweep showed 884** — the recorded measure-on-the-sweep trap, caught only by running both. **BLOCKING CHAIN: `S52-LOPSIDED-BOUND-01` → this → `S111-DENOMINATOR-01`.** 🟢 **SLT RULED 2026-09-19 (see `slt-2026-09-19-base-building.md`): DO NOT build the base-building plan type before October** — Wood's kill mandate on it as a separate surface, unsizable population, `week_n` schema risk. **Do instead, in order: (1) ASK THE CHARITY what their runners run — free, founder-owned, folds into `GTM-CHARITY-08`, converts the central unknown into a number; (2) route `S111-FOUNDATION-CREDIT-01` to the Coaching Board; (3) fix the refusal screen's BEHAVIOUR (Wood: a goal with no structure and no return trigger is a pure motivation intervention).** ✅ **MY HALF IS DONE 2026-09-19:** the exact message to send is written and ready at `docs/runbooks/charity-volume-question.md`, with what each possible answer triggers. **Blocked only on the founder sending it and a number coming back.** |
> | ~~`TAPER-FLOOR-FLAT-01`~~ | ✅ **SHIPPED 2026-09-19** | `taperRecalibration.ts` still reads the FLAT `MIN_SESSION_DISTANCE_KM` (3 sites). ⚠️ **I first claimed it "cannot bind" and then measured: it CAN.** Race week excluded, the minimum taper long run is marathon 8.7 km / HM 9.2 / 10K 7.3 (all clear) but **5K lands at 4.8 km**, where the flat floor nudges it to 5.0. +0.2 km on a runner whose taper capacity far exceeds the floor, so harmless — which is a different statement from "cannot happen" |
> | ~~`QUALITY-FLOOR-SUBFLOOR-01`~~ | ✅ **CLOSED 2026-09-19 — no action** | `sessionFloorsFor` deliberately does NOT vary the `quality` / `secondary_quality` floors, on the reasoning that `QUALITY_SESSIONS_PER_WEEK_MAX.beginner = 0` so no quality floor can bind. ⚠️ **Ruling A gives beginners strides/hills.** If those are ever modelled as quality-typed sessions rather than neuromuscular additions, this assumption breaks silently. Re-check when A lands |
> | `SUBFLOOR-COHERENCE-01` | **P2 — SLT ruled BUILD 2026-09-19 (wizard validation, not coaching)** | The admitted sub-floor marathon cohort is narrow and partly self-contradictory by construction: §111 needs ~16 km/wk, and a runner at 16 km/wk over 4 days averages 4 km/run, so a *coherent* longest run is already at or above the 5 km floor. The genuinely sub-floor + admitted runner is someone whose longest run is well below their weekly average. **Worth asking the wizard to reconcile the two answers** rather than generating from an inconsistent pair |
> | ~~`BRAND-MAINT-LABEL-01`~~ | ✅ **CLOSED 2026-09-19 — SLT: no action, the string is already right** | **SLT**, escalated by the Coaching Board 2026-09-18. 4 of 5 marathon charity personas are classified `maintenance`; should a first-time charity marathoner ever see language derived from that label? |
> | ~~`S80-MATERIALITY-EVIDENCE-01`~~ | ✅ **DISCHARGED 2026-09-19 — 5% is CORRECT** | Board ruled **INSUFFICIENT EVIDENCE** on tightening §80 Am.1's 5% shortfall materiality. Needs the shortfall-magnitude DISTRIBUTION, not an opinion |
> | ~~`PREF-SWEEP-01`~~ | ✅ | **SHIPPED 2026-09-18.** Real runner-facing scope was **~24 sites, not 90** (58 of the original count were developer-facing `invariants.ts` messages). 5 live sites fixed — the wizard's phase strip and plan header, `PlanCalendar`'s Strava distance, `SessionSteps`' race-pace segment, and the **weekly-report prompt**, which built its session labels in km *before* fetching the reader's units and handed them to a model it had just told to speak miles. Gate: `lib/hardcodedUnits.test.ts`, 6 baselined with reasons |
> | ~~`LONGEST-RUN-GATE-01`~~ | ✅ | **SHIPPED as §113, 2026-09-18.** Board ruled the threshold **RIGHT** (monotonic, unlike §111) and everything around it wrong. The route now holds **no coaching number at all**. Spawned `GRID-SUBFLOOR-01` |
> | ~~`DEVICE-VERIFY-01`~~ | ✅ **REMOVED 2026-09-19** | **Founder-owned, at his instruction.** Device verification is his task and is no longer tracked as a backlog item. Historical references below are left as written. |
> | ~~`REFUSAL-COPY-02`~~ | ✅ | **SHIPPED 2026-09-18.** Messages voiced, `'MARATHON'` no longer shouted at a refused runner (`lib/plan/raceLabel.ts` owns the noun), and the days refusal now says the runway. ⚠️ **It exposed that the refusal COPY WAS A WIRE FORMAT** — eight prose matchers across five files broke; all now match the error TYPE via `isDesignedRefusal` |
> | ~~`OPS-DBCHECK-NOISE-01`~~ | ✅ | **SHIPPED 2026-09-18.** One read-only `schema_columns_named()` RPC replaces 21 deliberately-failing selects. ⚠️ **The noise was the smaller half** — probing "each known table" built the candidate set from the three arrays the check audits, so a new `week_n` table in none of them was invisible to the check written to find it. Now schema-sourced and bidirectional |
> | ~~`CI-SLOW-DRIFT-01`~~ | ✅ | **SHIPPED 2026-09-18** as `npm run check:slow`, inside `npm run verify`. Measured under contention: `targetedGrid` is **15,017 ms — 50.1% of budget and 39% of the whole suite's test time**. ⚠️ **Report-only in CI on purpose** — a CI duration against a dev-machine baseline is two different measurements |
> | ~~`FATIGUE-ARRAY-DRY-01`~~ | ✅ | **SHIPPED 2026-09-18.** It was **seven** copies, not five, and the sharpest was a TYPE: `reframeRiskGate.ts` still declared its own `FatigueTag` union although `completionVocab`'s own comment says it exists because "a type without its values is the split that lets two lists drift". One declaration now; gate in `completionVocab.test.ts` |
> | `S112-HAZARD-01` | ⏸️ P3 | ⏸️ **PARKED — unmeasurable today** (§112 has never fired; 83 tagged rows total). Unparks when the cohort gives volume |
> | ~~`FIRSTRUN-GATE-CALL-01`~~ | ✅ | **RULED + SHIPPED 2026-09-18 (SLT).** Not the filed binary: the **card is ungated** (it is a cue specification, valuable to everyone), the **sentence is gated**, and Hutchinson blocked the old wording as a capability claim §111/§113 contradict. Now *"It is meant to feel too easy."* |
> | `SIGNOUT-TOKEN-RESIDUAL-01` | ⏸️ P3 | ⏸️ **ACCEPTED, no action.** A failed revoke leaves the token alive until expiry; unreachable without a network |
> | `GTM-CHARITY-09` · iOS 16.6 | ⏸️ | **Parked by the founder.** Both writing, no build |

> ▶️ **NEXT UP when we restart — the FIRSTRUN-MARATHON-01 queue, Tier 1 + Tier 2 (#5–8) are DONE.** Resume at the **SLT-ORDERED WORK QUEUE** (§ below):
> - ~~#9 `FIRSTRUN-MOMENTS-01c/d/e`~~ ✅ **SHIPPED.** Next is #10. Original:
> - ~~#9~~ — the generating ceremony derived from the runner's own `GeneratorInput`, the distance reframe, the worst-day naming. ⚠️ **(e) only if derived live** (Hutchinson's binding condition). Full specs in § "🎬 FIRSTRUN-MOMENTS-01 — full specs". *Actionable without founder input (SLT already approved the specs); UI → trigger `frontend-design`.*
> - ~~#10 `FIRSTRUN-MISSED-01` part 1~~ ✅ **SHIPPED.** Next is #11 (Coaching Board) or Tier 4. Original:
> - ~~#10~~ — a runner reports an injury and nothing reads it (a defect, unblocked). Part 2 (#11) → Coaching Board once part 1 lands.
> - **Tier 4:** #12 `GTM-CHARITY-09` partner FAQ (founder/partner comms), #13 `01f` (blocked — needs redemption moved to sign-up first), #14 `WIZARD-TIME-CHIPS-01`, #15 iOS 16.6 (tell Jack, no build).
>
> ✅ **Carried residuals are now FILED ITEMS, not prose.** The paragraph that used to sit here named four things in a sentence and gave none of them an ID, so nothing could pick them up — which is exactly how the `longest_recent_run_km < 5` gate stayed invisible until the founder asked why it was not on the list. They are now `DEVICE-VERIFY-01`, `REFUSAL-COPY-02`, `FIRSTRUN-GATE-CALL-01` and `LONGEST-RUN-GATE-01`.

> 🟢 **LR-SHORTFALL-CAUSE-01 + NOTE-DURATION-FMT-01 (§80 Am.1).** Founder read the long-run tile on his own London Marathon plan: raw minutes everywhere (**48.2% of 42,444 values were ≥60**, largest 338) and one number with **no unit at all** on 5,264 of 5,264 firings. Underneath it: the note named the time cap **0 times in 5,264** while **71.0% sat 2–3 min beneath that cap** — because the cap is applied on the kilometre axis and the distance is then rounded. Now `LONG_RUN_AT_CAP_TOLERANCE_MINS` (3, chosen from an empty 4–5 band) and `LONG_RUN_SHORTFALL_MATERIAL_PCT` (5). ⚠️ **My "the branch is structurally dead" framing was TOO STRONG and an existing test disproved it** — zero in the corpus is not "cannot fire".

> 🟢 **ONBOARD-EXIT-01 — sign-out now exists on every onboarding screen, and the optional name field says it is optional.** A new user was **trapped in the wizard**: the gate sequence hides the bottom nav, step 0 suppresses the back button, and the only escape was Today → Me → the **"Careful Now"** section next to Delete Account. ⚠️ **ConnectRunsScreen already had this button and it had DRIFTED** — no `clearWidgetState()`, so signing out there left the previous account's race countdown on the home-screen widget; fixed by deleting the copy and making `components/shared/SignOutLink.tsx` the single owner. The founder asked to **delete** the first-name field; the SLT declined (six prompt builders, trial emails, avatar initials, and it would part-revert PROFILE-NAME-01) and labelled it optional instead. ✅ **The fixture page now exists** (`/onboarding-preview`, dev-only, same pattern as `/me-preview`) and **seeing them changed the design twice**: on Connect Runs the link sat directly under that screen's own **"Not now →"** skip and the two read as a near-identical pair — one skips a step, the other ends the session, on the one onboarding screen where the user already HAS a plan to lose; and the **`disabled` state was invisible** (it changed only the cursor). **No test could see either.** Also unified: `lib/auth/signOut.ts` owns the SEQUENCE, so the Me-screen button and the onboarding link cannot drift again — guarded by `signOutOwner.test.ts`, which walks `app/` and `components/` and fails the build on any hand-rolled `auth.signOut()`. ⚠️ **Challenged twice, and the challenge was right both times: the first two passes proved the code COMPILED and RENDERED, never that pressing it DID anything.** Now proven by execution — 11 behavioural tests (`signOut.test.ts` ×5, `signOutLink.markup.test.ts` ×6) **falsified against three mutations** (swap the order, drop the `finally`, drop the `await` — each goes red), plus a **live click in a real browser** that landed on `/auth/login` with no console errors. The `finally` matters: without it a failed `signOut` leaves the runner stranded on the screen that has no other way out. The sign-up DOM now reports `required: false` on first name against `required: true` on email and password, so the browser itself enforces the difference. 🔴 **The `/ship` silent-failure gate then found a LIVE defect this had already shipped with:** `signOutAndReturnToLogin` threw away the `{ error }` that `auth.signOut()` RESOLVES with, and `GoTrueClient._signOut` returns **before** `_removeSession()` on any error that is not 401/403/404 — so a network failure left the auth cookie alive while the user landed on the login screen **believing they had signed out**. Fixed: the error is read and the local session is cleared regardless (5 tests, falsified against 3 mutations). **Residual:** the token stays valid server-side until expiry. 🔴 **THEN THE DEVICE FOUND WHAT NOTHING ELSE COULD: sign-out threw the founder OUT INTO SAFARI.** Capacitor iOS allows a full-document load only if the URL `starts(with: serverURL)` — and `server.url` carries a path (`/dashboard`), so every other route was treated as external. Fixed with a client-side `router.replace` (**ships over the air**) plus `www.zonna.run` in `allowNavigation` (**needs a native build**). ⚠️ **The rule was already written at `DashboardClient.tsx:255` and I overrode it.**

> 🔴 **PLAN-WEEK-COLLISION-01 shipped today, in TWO passes, and the second pass is the lesson.** A new 12-week plan arrived **94% pre-completed** because `week_n` is a within-plan coordinate that seven tables used as a cross-plan key. ⚠️ **The recommended fix (continue the week sequence, ADR-013's own mechanism) was WITHDRAWN before shipping** — foundation weeks are numbered NEGATIVE and the engine guards on `w.n > 0`, so it would have corrupted the taper curve. ⚠️ **Then the fix itself shipped incomplete**: the table list was written from memory and missed `weekly_reports` (which ADR-013 names explicitly) and `plan_adjustments` — and the guard could not tell, because it ITERATES that same list. Authority moved to the live schema in `scripts/check-db-drift.ts`. Record: `docs/incidents/2026-09-18-plan-week-collision.md`.

> ✅ **Doc audit run mechanically (`./scripts/audit-docs.sh`), not asserted.** Every `feat(`/`fix(` scope this session (AUTH-BEARER-MISSING-01, MARATHON-VOLUME-GATE-01/§111, REFUSAL-SCREEN-01, FOUNDATION-ADD-FAIL-01, ONBOARD-SKIP-LABEL-01, FOUNDATION-DECIDE-LATER-01, FIRSTRUN-MOMENTS-01a, 01b) carries a feature-registry row (ID in the first cell) and a build-log `##` entry. §111 is the one new principle, with its Coaching Board sitting (CORRECT WITH AMENDMENT + the reconvened collision ruling). **120 invariants in `invariants.ts` = 120 rows in `plan-invariants.md`**, reconciled both directions, zero orphans (was 118; §111 added `INV-PLAN-BASE-BUILD-RATIO`). Changed API routes ↔ `docs/contracts/` in sync (`generate-plan.md`, `generate-plan-foundation.md`). *(An earlier same-day audit before this session recorded 10 scopes / 5 amendments / 118 invariants.)*

### 🏁 What today was — three parts

**Morning: a coverage-claim audit.** Three registers each claimed "this rule is checked" and none could see the others. `LIVENESS-DEBT-01` (unclassified **20 → 0**) · `COVERAGE-BITE-01` (a principle can no longer be "enforced" by an invariant nothing can wake — **11 of 107 were**, three of them injury guards) · `TEST-BITE-01`. All three registers now cross-check mechanically.

**Afternoon: plans were not fit for purpose and no check could see it.**

🔴 **An injury-history runner got eighteen weeks that never made them fitter.** Isolated by toggling ONE flag — same runner, everything else identical: net build **+91% healthy vs +6% injured** (standard cadence), **+79% vs +3%** (masters). **28.9%** of injury plans never exceeded week 1; **66.7%** at masters cadence. A knee-history runner reached a marathon start line never having run beyond **14 km**. Every check was green throughout.

Shipped **PLAN-FITNESS-01** (§2 Am.3 + §24/§80 specificity ramp) and **LR-DELOAD-CUT-01** (§3 Am.). **Never-builds now 0% at every distance.**

**Evening, part three: the founder read the Plan screen and three defects fell out of one observation.** `AI-PROVENANCE-01` — **Kit's byline sat on 41.2% of free-plan sessions** (12,972 of 31,517), on copy no model has ever seen, because provenance was inferred from whether `coach_notes` was non-empty and the rule engine writes those too. `COPY-GLYPH-01` — **`§45` was reaching 10.8% of runners**; one source string, now 0%, with a guard on the engine's EMITTED copy that also closes BRAND-EMDASH-01's mechanism half. `PLAN-NOTE-VOICE-01` — SLT sitting: the "Why this plan" tiles averaged **130 words** and two of them **blamed the same cause on 78.5%** of the plans where they co-occurred; now **67 words, one tile on 510 of 513 plans**. ⚠️ **The original tile ship's own registry entry reads "Not visually smoke-tested behind auth"** — every part verified, the thing itself never seen.

**Evening, part two: the founder read a real session on device and two more defects fell out.** `TT-STRUCTURE-01` — a **5K time trial rendered as "warm-up ~3km · main set ~2km · cool-down ~0km"**, so the measurement §78's whole recalibration path depends on was shown as 2 km, beside a Kit note correctly saying 5 km. Producer and consumer disagreed about what `distance_km` and `duration_mins` MEAN on that session. `TT-NOTE-HONESTY-01` — the same note promised **every** runner that their paces would update, and recalibration is PAID while free plans carry the trial (both tiers: `recalibration_weeks: [8]`). ⚠️ **Parity moved 42.2% and the cause was PROVEN by reverting only the sentence** (byte-for-byte identical), not assumed.

**Evening: the first UI work in days.** `PROFILE-NAME-01` — five defects on the Me screen, all one family: **the app collected a name on one of its three sign-up routes and then used it almost nowhere.** The profile placeholders were the founder's own first and last name and read as stored data on a test account; `athlete_name` was set by NOTHING and read by three things, so **every plan the engine has ever built addressed the runner as "Athlete"**. Email/password signup now captures a name (via the same `user_metadata.full_name` field Google and Apple use), `/api/generate-plan` resolves it server-side from `user_settings` at the auth boundary, the identity card prompts instead of labelling, and the avatar can no longer draw blank. **No prescription change, no doctrine file touched — Coaching Board exempt.**

### ✅ Fit for purpose — the verdict

| | |
|---|---|
| 5K, 10K, half marathon | ✅ every cohort, both goal types |
| Marathon, finish goal | ✅ including knee + over-45 (**26.0 → 29.5 km**) |
| Marathon, time goal | ⚠️ **short 1.2 km** — §9's 210-min cap vs §24's 31.65 km (`S24-FLOOR-REACHABILITY-01`) |

Review personas: M2 / M3 / M5 at **29.5 km (70%)**, M1 / M1d at 26.0 km. M3's net build **54% → 79%**.

### ⚠️ Read these before touching the engine

- **`npm run measure:fitness` is the FOURTH question** — *does this plan BUILD the runner?* Gated on every build by `planFitness.test.ts` (`PLAN-FITNESS-GATE-01`). `neverBuildsPct` above zero fails with **no tolerance**. Re-baseline only with a declared reason.
- **The root cause of every marathon shortfall was the deload cutting the LONG RUN a median 30% while cutting the WEEK 22%** — on 50.4% of deloads. Mechanism: the long run hits §9's share of the **planned** week while the rest is trimmed in **placement** (median −6 km). Same numerator, smaller denominator.
- 🔴 **FIVE diagnoses were presented before being tested and THREE were wrong** (long run as cause; back-loaded curve; post-pass caps subtracting; allocation shortfall; systemic under-delivery — that last was ~85% the runner's own weekday time budget, correctly handled and declared). **Measure the premise before the board sits.**
- 🔴 **A board amendment passed its stated condition and missed its stated purpose TWICE** — Willy's §52 per-week bound. `S52-LOPSIDED-BOUND-01`. **Do not add a third per-week bound.**
- 🟢 **Willy reversed his own RAMP-BOUNCEBACK-01 veto on measurement** — the +43% he vetoed became +17.6% once Am.2 made the cut shallower.
- 🔴 **A board-approved fix was built and REVERTED as unsafe** (`LR-DELOAD-RESUME-01`) — it sent a low-base beginner **7.3 → 18.5 km in one week**. The shipped version made that same runner's worst jump go **DOWN** (+50% → +47%).
- 🟢 **`DOC-STATE-GATE-01` — this paragraph is now hook-checked.** It names the commit it describes; `state-block-check.py` flags it on any `feat(`/`fix(` commit that postdates that SHA. It exists because this exact paragraph went stale **three times on 2026-09-17** while every hook-checked record stayed correct. **Write it LAST, after the final push, and never type a count from memory.**
- 🔴 **`??` DOES NOT CATCH AN EMPTY STRING, and that class has now cost FOUR measured defects.** `ruleEngine` stamps `athlete_name ?? ''`, so `plan.meta.athlete` is an empty *string* and every downstream `?? 'fallback'` is already dead — the Me-screen avatar drew a blank circle for months and `postRaceReshape.ts` addressed nobody. Same shape as `distance_km ?? 0` (SESSION-KM-01). **When you guard a read with `??`, go and look at what WRITES it.**

### 🔜 OPEN — P0 is now the first-time marathoner experience

---

## 📋 SLT-ORDERED WORK QUEUE — Make-A-Wish London 2027

**RE-ORDERED 2026-09-18 (v2).** *Five things changed after v1 was set and three items left the queue entirely. Ordered against one measure: **did they still be running in week 8?***

> **What changed since v1, and why the order moved:**
> - 🔴 **`MARATHON-VOLUME-GATE-01` did not exist when v1 was written.** It refuses a marathon plan below 20 km/week — *"build your base first"* — which is a plain description of much of this cohort. **A runner refused at the door never sees anything else on this list**, so it goes above all the experience work.
> - ✅ **`§44 block tier` LEAVES THE QUEUE** — Coaching Board ruled **CORRECT AS IS**. No work.
> - ✅ **`GTM-DECK-CORRECT-01` LEAVES THE QUEUE** — withdrawn, the deck was right.
> - 🔽 **`FOUNDATION-DECIDE-LATER-01` got cheaper** — SLT chose "delete the button", so it is now minutes, not a build.
> - 🔽 **`GTM-CHARITY-09` got cheaper** — SLT chose a partner FAQ, so it is writing, not a support surface.
> - 🆕 **`FIRSTRUN-MOMENTS-01a–f`** and **`FIRSTRUN-MISSED-01`** are new, specced, and five of the six moments are S-sized.

> ~~**DEVICE-VERIFY-01**~~ — **REMOVED from the backlog 2026-09-19 at the founder's instruction; he owns device verification.** *(Original filing: nothing shipped on 2026-09-18 had run on iOS.)*
>
> Fourteen items shipped today. **Every one was verified by `npm run verify`, by a markup test, or at 375px in `/onboarding-preview` — a dev-only harness in a desktop browser.** That is honest verification of code and pixels and it is not the same claim as "it works on a phone", which is the only claim that matters before 500 runners install it.
>
> **What is specifically unverified, and why each one can only fail on device:**
> - **The sign-out escape** (`ONBOARD-EXIT-01`). The Safari-escape fix ships over the air, but `clearWidgetState()` is a **no-op on web by construction** — the App-Group write actually being removed is the one behaviour that exists only on iOS. The `allowNavigation` half needs a native build regardless.
> - **The four reveal cards** (`FIRSTRUN-MOMENTS-01a/b/d/e/f`). Seen as components with fixture props. **Never seen inside the real wizard**, which is auth-gated AND gated on having no plan.
> - **The refusal screen** (`REFUSAL-SCREEN-01`) and the **§111 refusal** — the "not yet" path, on a real refused input.
> - **The foundation-add fix** (`FOUNDATION-ADD-FAIL-01`) — the failure the founder hit was device-only, and the fix is an inference from the auth asymmetry, not a reproduction.
> - **The wizard chips** (`WIZARD-TIME-CHIPS-01`) — and specifically the **legacy-draft shim**, which can only be exercised by a draft saved under the old labels.
>
> **Do:** one TestFlight build, then a single pass — generate a plan as a fresh account, read the reveal, sign out from the wizard, and refuse a plan deliberately. ⚠️ **Not a code item.** It is the difference between "the tests pass" and "it works", and this repo has a recorded incident where a comment described an arc that was never built and the founder found it on device.

> 🟡 **S112-HAZARD-01 — does softening the plan teach skipping?** *(P3, deferred by the Coaching Board 2026-09-18. NOT a build — a measurement with a trigger.)*
>
> §112 lets a `'Too tired'` skip count toward fatigue accumulation. **McMillan dissented and the board recorded it rather than synthesising it away:** a plan that softens when you skip may teach skipping. Willy's answer: *"a 20% long-run cut is not a reward, and a runner on three consecutive skips is already not training."*
>
> **What would settle it, in the board's own words: whether skip rate rises in the window AFTER a softening fires.** **Not measurable today** — §112's trigger has never fired in production, and there are 83 tagged completions in total.
>
> **Unpark trigger:** once the charity cohort produces volume. Until then this is a known, argued, accepted risk with a named test — not an oversight.

> 🟢 **SIGNOUT-TOKEN-RESIDUAL-01 — a failed sign-out leaves the access token alive server-side.** *(P3, stated at ship rather than hidden.)*
>
> `signOutAndReturnToLogin` now clears the local session even when the revoke call fails, so **the device is genuinely signed out**. What it cannot do is revoke the token at Supabase when there is no network. **The token stays valid until it expires** — unreachable from a dead connection, and the same exposure as force-quitting the app.
>
> **Accepted, not fixed.** Revisit only if a retry-on-reconnect becomes cheap; do not bolt one on for its own sake.

> 🔴 **LONGEST-RUN-GATE-01 — the third ungoverned refusal in the same function §111 was convened to fix.** *(P1, filed 2026-09-18. ⚠️ Flagged in a code comment on the day and NOT filed until the founder asked why it was not on the list — the same "flagged but unfiled" failure as `WIZARD-TIME-CHIPS-01` earlier the same day.)*
>
> `app/api/generate-plan/route.ts → validate()` held **three** hardcoded refusals. §111 replaced the second. This is the third, still live:
>
> ```ts
> if (input.race_distance_km >= 21 && input.longest_recent_run_km < 5) {
>   return 'Longest recent run is very short for this distance. Log at least a 5 km run in the last 6 weeks before generating this plan.'
> }
> ```
>
> **Who it refuses.** Anyone attempting a **half or a marathon** whose longest recent run is under 5 km — which is a plain description of a charity first-timer in October. They get **no plan**, and are told to go and log a run first.
>
> **It carries every defect §111 was convened to fix**, and they are the board's own words from that sitting:
> - **Ungoverned** — no `CoachingPrinciples` section, never ratified, invisible to `configPrincipleSync` and to `coaching-guard.py` (which does not watch `app/api/`).
> - **A bare string with no alternatives**, which **§44's own text forbids**: *"Return error explaining why and listing alternatives."* §44 and §52 both compute them; this returns a full stop.
> - **Expressed on the wrong quantity, probably.** §111's finding was that a floor on *stated volume* was non-monotonic in the ramp it existed to bound. This is a floor on a *stated longest run* — the same shape of claim, and nobody has checked whether it tracks long-run readiness any better.
>
> ⚠️ **DO NOT SIMPLY DELETE IT.** Exactly the trap the board named on §111: the concern may be real even when the implementation is wrong. A first-timer whose longest run is 3 km being handed a marathon block is a genuine question — it is just one nobody has ever ruled on.
>
> **Do:** Coaching Board sitting. Measure first, as §111 required — what the engine actually builds below the threshold, and whether the refusal tracks anything. **Given the cohort, I would put this above the parked Tier 4 items.**

> 🟢 **GRID-SUBFLOOR-01 — RESOLVED: the sub-floor cohort stays out of both grids, and the §113 proposal it raised is falsified.** *(Decided 2026-09-18, architectural call + measurement. No board sitting: see below.)*
>
> **1. The grid decision (architectural, mine).** `targetedGrid` is wrong: `longest_recent_run_km` is a FIXED 12 there, not an axis, so adding one would double a test already at **15,017 ms / 50.1% of the timeout budget**. `cohortGrid` could reach it, because `longest_recent_run_km` is DERIVED (`max(3, round(cwk * 0.4))`), so adding `10` to `VOLUMES` yields a longest run of 4, below §113's floor of 5. **I built that and measured it before deciding:**
>
> | Metric | 20/35/50 | with 10 | Move |
> |---|---|---|---|
> | refused | 1,296 | 6,480 | **+5,184** |
> | maintenancePct | 49.4 | 43.0 | **−6.4pp** |
> | constrainedByInputsPct | 27.3 | 35.6 | **+8.3pp** |
> | constraintNotePct | 64.9 | 59.4 | **−5.5pp** |
>
> Refusals by distance at 10 km/wk, 2,592 rows each: **5K 0% · 10K 0% · HM 100% · marathon 100%** (83% §113, 17% §52). No ultras in that grid.
>
> 🔴 **DECISION: do not add it.** `cohort:shape` answers *"who gets what KIND of plan"*, and these rows produce **no plan at all** — they would dilute every published rate by 5–8pp while informing none of them, at +33% runtime on every build. §113's liveness is already proven by the property sweep, which refuses **2,634**. The filed premise ("§113 refuses 0 of 35,952 grid rows") is true and is not a gap in what `cohortGrid` is FOR.
>
> **2. The §113 question it raised, and why no board sat.** The finding looked serious: a runner 1 km below the floor is refused with 29 weeks of runway, while a runner AT the floor is built to a marathon (week 1 long run 5.3 km, +7%, §45's cap honoured). §57/§92 foundation weeks exist precisely for pre-plan runway, so *should §113 yield to a foundation block?*
>
> ⚠️ **I falsified my own premise before convening.** Measured with **coherent** inputs (longest = 0.4 × cwk, as the grid derives), the foundation block's biggest week-1 session runs **−13%** against the runner's longest at cwk 20/30/40/50. The single coherent case that exceeds §45's 1.10× is **cwk 10 → +25%**, and it is forced by `MIN_SESSION_DISTANCE_KM.easy` binding at 5 km (`foundationBlock.ts:406`). **That is the identical mechanism §113 documents** for `.long`: below the floor, the floor wins and the cap is discarded. A foundation block therefore cannot rescue a sub-floor runner; it hits the same floor. The proposal fails on mechanism, so convening five seats to ratify a measurement would be theatre.
>
> ⚠️ **TWO ERRORS OF MY OWN, RECORDED because both produced confident wrong findings.** (a) I first measured with `distance_km ?? 0` on a **duration-anchored beginner plan** and read `0.0 km` long runs — the exact antipattern SESSION-KM-01 exists for. (b) I then measured `cwk 40 / longest 4`, an **input that cannot occur** (the grid derives longest 16 at that volume), and was drafting a §45 defect report claiming +100% and +400% jumps. Coherent inputs showed −13%. **A grid of invented inputs prints a clean table and a false finding.**
>
> **Still true and NOT closed by this:** foundation weeks contain no `long` session at low volume (four equal easy runs), so `INV-PLAN-WEEK-1-2-LONG-CAP` — guarded on `long?.session.distance_km` — does not evaluate them. That is correct as written (there is no long run to cap) but means the foundation block's session sizing is bounded by its own floors rather than by §45. Not a defect on any coherent input measured; recorded so the next person does not re-derive it.


> 🟡 **BRAND-MAINT-LABEL-01 — four of five marathon charity personas are labelled `maintenance`, and the word may be read as a verdict.** *(P2 — **SLT**, escalated by the Coaching Board 2026-09-18. Not a coaching question: the classification is CORRECT and drives real safety behaviour.)*
>
> **Measured at the sitting.** M1, M2, M3 and M1d all come out `volume_profile: 'maintenance'`; only M5 is `build`. Those plans carry peak weeks of **50–59 km**, which Seiler noted is not maintenance in any ordinary sense of the word — it is the label the engine applies when §52's 60%-of-week bound binds.
>
> ⚠️ **The recorded disagreement is the item.** Seiler: it is a mechanical classification, and reading it as a verdict is a category error. McMillan: *"put yourself on the sofa in October — for a first-timer, 'get you round' IS the goal"*, and language derived from a label that sounds like a downgrade lands badly on exactly the cohort whose charity's stated pain is that people who take a place never run.
>
> 🟢 **Partly already right, which is why this is P2 and not P1.** The runner-facing string is *"This plan is built to get you round, not to build you up"* and **never uses the word "maintenance"**. The ask is to confirm that holds on every surface that derives from `volume_profile`, and to rule on whether the honest-but-deflating framing is the one we want for a first-timer.
>
> **Do NOT change the classification** — Willy and Seiler both rely on it, and it gates `INV-PLAN-LR-MAX-WEEKLY-PCT` severity.

> 🟢 **S80-MATERIALITY-EVIDENCE-01 — is 5% the right shortfall materiality, or just the first number that stopped the noise?** *(P3, Coaching Board 2026-09-18 ruled **INSUFFICIENT EVIDENCE**.)*
>
> §80 Am.1 added `LONG_RUN_SHORTFALL_MATERIAL_PCT = 5` so the long-run shortfall note stops firing on rounding. It works: the measured case it silenced was a **2-minute, 1.7%** shortfall (*"tops out at 116 minutes… we'd normally want it nearer 118"*), and 32 plans stopped carrying the note on 2026-09-18 as a result.
>
> **What would settle the threshold, and nothing else will:** the DISTRIBUTION of shortfall magnitudes across the finish-goal corpus. Bimodal (a rounding cluster near 0 and a real cluster further out) → 5% sits in the gap and is fine. Continuous → 5% is arbitrary and the cut point needs an argument.
>
> ⚠️ **Do not change it on intuition.** This board has twice accepted a premise that did not survive measurement. Sims' dissent is also recorded: the axis that matters at the bottom of the volume range is **energy availability**, not marathon experience, and that is unbuildable today (ADR-011, no cycle or intake data) — so 5% remains a male-derived default for "meaningful shortfall" with no data either way.

### 🚪 Tier 1 — THE DOOR. Nothing else matters if they cannot get in.

| # | Item | Size | Why here |
|---|---|---|---|
| ~~1~~ | ~~**`AUTH-BEARER-MISSING-01`**~~ ✅ **SHIPPED 2026-09-18** | S | Both bearer-less calls routed through `authedFetch`; guard `authedFetchGuard.test.ts` walks the source so it cannot recur. Found a 6th site the table missed (already correct). → feature-registry. **Re-test #4 on device.** |
| ~~2~~ | ~~**`MARATHON-VOLUME-GATE-01`**~~ ✅ **FULLY SHIPPED 2026-09-18** (the label read "engine half" until the UI half was confirmed landed — it is: `REFUSAL-SCREEN-01`, #3) | **L** | 🔴 **P0.** Governed §111 base-build ceiling (peak/current, not stated volume); admits M1, refuses the reckless 5km tail. 3 artifacts + reconvened board on the MAINT-LABEL collision. Parity 208/5940, all OK→REFUSED. → feature-registry. **The humane "not yet" screen is `REFUSAL-SCREEN-01` (#3).** |
| ~~3~~ | ~~**`REFUSAL-SCREEN-01`**~~ ✅ **SHIPPED 2026-09-18** | S | A 422 refusal reframes as a calm "Not yet" + the levers + "Adjust my answers"; a real fault keeps "Something went wrong". Ships with #2. **Follow-up:** voice the §44/§52 message internals + add the weeks-remaining runway line. → feature-registry |
| ~~4~~ | ~~**`FOUNDATION-ADD-FAIL-01`**~~ ✅ **SHIPPED 2026-09-18** | S | Cause (missing bearer) fixed by #1; observability half added — route records `plan_foundation_add_failed` on 500, client catch no longer swallows. → feature-registry. **On-device re-test is the residual.** |

### 🙂 Tier 2 — THE FIRST FIVE MINUTES. Cheap, and it reaches every one of the 500.

| # | Item | Size | Why here |
|---|---|---|---|
| ~~5~~ | ~~**`ONBOARD-SKIP-LABEL-01`** + **`COPY-DAYS-PLURAL-01`**~~ ✅ **SHIPPED 2026-09-18** | S | Both done. `ONBOARD-SKIP-LABEL-01`: busy flag → pending-action enum, primary label keys on the specific action (markup-guarded). `COPY-DAYS-PLURAL-01` shipped with #3. → feature-registry |
| ~~6~~ | ~~**`FOUNDATION-DECIDE-LATER-01`**~~ ✅ **SHIPPED 2026-09-18** | S | "Decide later" button deleted (SLT Fix A); the two identical handlers consolidated into one `handleFoundationDismiss`. → feature-registry |
| ~~7~~ | ~~**`FIRSTRUN-MOMENTS-01a`** runway reveal~~ ✅ **SHIPPED 2026-09-18** | S | 🥇 The runway note (stamped on meta, rendered nowhere) now surfaces as the first card at the reveal, led by the number. `RunwayRevealCard` + markup test; render-once decision locked. → feature-registry |
| ~~8~~ | ~~**`FIRSTRUN-MOMENTS-01b`** first-run reveal~~ ✅ **SHIPPED 2026-09-18** | S | The first session ("Monday. 20 min. Easy.") surfaces at the reveal under the runway card. `firstRunOfPlan` + `FirstRunCard`, both tested. → feature-registry |
| ~~9~~ | ✅ **`FIRSTRUN-MOMENTS-01c/d/e`** — SHIPPED 2026-09-18 → feature-registry. (e) derived live, per Hutchinson. Also threaded `preferredUnits` into the reveal, which had never received it, fixing 01a/01b too | S | done |

### 📉 Tier 3 — THE DROP-OUT MECHANISM. Where the cohort is actually lost.

| # | Item | Size | Why here |
|---|---|---|---|
| ~~10~~ | ✅ **`FIRSTRUN-MISSED-01` part 1** — SHIPPED 2026-09-18 → feature-registry. ⚠️ The "read by nothing" framing was **retracted before building** (the reason drives §21 via `/api/adjust-plan`); the real defect was the storage **displacing** real fatigue data in a five-entry window — 2 users had an unreachable trigger | S/M | done |
| ~~11~~ | ✅ **`FIRSTRUN-MISSED-01` part 2** — SHIPPED 2026-09-18 as **§112** → feature-registry. 🔴 The conflict scan found **`§R20-T4` DOES NOT EXIST** (cited for a year; two ratified sections depended on it), and the trigger was blind for a reason nobody had found: the route fetched the window with `.eq('status','complete')`, so a skip was **never in it** | — | done |

### 📦 Tier 4 — before the cohort arrives, not before the codes.

| # | Item | Size |
|---|---|---|
| 12 | ⏸️ **PARKED (founder, 2026-09-18)** — **`GTM-CHARITY-09`** partner FAQ (5 questions, charity's voice, **include "why hasn't my plan started"**). Writing, not a build; ships WITH the codes | S |
| ~~13~~ | ✅ **`FIRSTRUN-MOMENTS-01f`** — SHIPPED 2026-09-18 → feature-registry. ⚠️ **It was never blocked** (three doors into redeem, one is the wizard) and checking the data **cut a line of approved copy** that nothing measures | M |
| ~~14~~ | ✅ **`WIZARD-TIME-CHIPS-01`** — SHIPPED 2026-09-18 → feature-registry. Key-based chips + legacy-draft shim; labels now derived through `formatDuration` | S |
| 15 | ⏸️ **PARKED (founder, 2026-09-18)** — **iOS 16.6** minimum excludes iPhone 7 and older; no Android, no mobile-web dashboard. Tell Jack, do not build | — |

### ⏭️ Deliberately not in this queue

`FIRSTRUN-MARATHON-01` touchpoints 1, 3, 4, 6 · `REFUSAL-SCREEN-01` part 2 (the base-building plan — **Coaching Board first**, `FOUNDATION_MAX_WEEKS` is 3 and it needs ~20).

### What the SLT disagreed about, preserved rather than synthesised

- **Wood vs the founder's brief.** *"A wow experience they won't forget"* is feature-theatre language (Fried) and illusion-of-progress (Wood). **The item survives; its framing does not.** Fix the seven broken things and the experience is fixed.
- **Traynor vs Fried on what goes first.** Traynor wanted the paid-feature bug (live revenue); Fried wanted the cohort-facing lies (October deadline). **Resolved by fact, not vote:** #1 is one change at two sites and likely fixes a cohort item too, so it costs Fried nothing.
- **Sutherland vs Hutchinson on the refusal.** Sutherland wants the refused runner redirected; Hutchinson will not have Willy overruled by copywriting. **Genuinely unresolved — which is exactly why the copy fix and the alternative-distance decision are two items.**

### Sutherland's note, recorded because it may be the best idea in the review

> Oct to April is twenty-eight weeks. Every other running app would fill that with training. We are going to tell 500 anxious first-timers **"do almost nothing yet"** — that is the brand, in the one moment it matters most, to the one audience that has never heard it. **The foundation block is not touchpoint 5. It is the product.**

### MUST/NEVER, checked

**Nothing in this queue may change what the engine prescribes** — measured fit for this cohort (11/11 charity personas, and again after PLAN-FITNESS-01). **No gamification in touchpoint 7**: the first-missed-session response is a *context* intervention, never a streak, a badge or encouragement. `ui-patterns.md` bars popups; the foundation sheet is an existing `Sheet`, so fixing it is in-pattern — do not add a second one.

---

## ⚖️ GOVERNANCE TRIAGE — every queue item checked, 2026-09-18

*Asked before starting work: which of the agreed items need a Coaching Board or SLT sitting? All 13 checked; 3 needed one; all 3 sat below.*

| Item | Sitting | Why / why not |
|---|---|---|
| `AUTH-BEARER-MISSING-01` | **None** | Auth plumbing defect. No prescription, no tier change. Architecture call |
| `ONBOARD-SKIP-LABEL-01` | **None** | UI state defect restoring documented intent |
| `COPY-DAYS-PLURAL-01` | **None** | Copy typo. `inputs.ts` is not a doctrine file |
| `FOUNDATION-ADD-FAIL-01` | **None** | Bug plus observability |
| `WIZARD-TIME-CHIPS-01` | **None** | ADR-015 display formatting — **explicitly excluded** from the Coaching Board |
| iOS 16.6 minimum | **None** | Tell the charity. Founder comms, no build |
| `REFUSAL-SCREEN-01` part 1 (copy) | **Done** | SLT sat today on the alternatives question |
| `REFUSAL-SCREEN-01` part 2 (base-building plan) | **Gated** | Prescription → Coaching Board **before any line is written**. Not in the current queue |
| `MARATHON-VOLUME-GATE-01` | **Done** | Coaching Board sat today — CORRECT WITH AMENDMENT |
| `FIRSTRUN-MARATHON-01` | **🔴 SAT 2026-09-18** (challenged by the founder — my deferral was wrong) | The batch review re-scoped it (killed the "wow" framing, set touchpoint 7 as the priority). ⚠️ **Touchpoint 7's actual intervention needs its own sitting when scoped** — it is #7 in the queue, not immediate, and a sitting now would be ruling on a brief that does not exist yet |
| **§44/§52 `block` tier** | **🔴 SAT BELOW** | Date-critical, Hutchinson required it before October |
| **`FOUNDATION-DECIDE-LATER-01`** | **🔴 SAT BELOW** | The fix has two forms and choosing between them is a product call |
| **`GTM-CHARITY-09`** | **🔴 SAT BELOW** | *"Not necessarily a build"* — somebody has to decide which |

> ⚠️ **I DEFERRED `FIRSTRUN-MARATHON-01` AND THE FOUNDER OVERRULED ME, CORRECTLY.** My reason — *"it is #7 in the queue"* — confused the **shipping order** with the **priority**. It is the P0. The real obstacle was that no brief existed, and **writing the brief was my job, not a blocker**. Research done, sitting below.

---

### ⚖️ COACHING BOARD — §44/§52 `block` tier: marathon on fewer than 3 days a week. Sat 2026-09-18.

**The question.** The founder ruled on 2026-09-17 *"we shouldn't refuse people plans, we should just give them honest feedback."* The `warn` tier honours that via `acknowledged_prep_warning`. **The `block` tier has no acknowledgement path at all** — marathon/ultra below 3 days a week, and marathon below 10 weeks, are hard refusals. Read literally the ruling removes that tier too.

**🔍 Conflict scan.** §44 (refusal mechanism) · §52 (low-day extension, and the **60% long-run ceiling**) · §9 (long run as share of week) · §2 (weekly increase) · §40c (name the lever). **Unlike `MARATHON-VOLUME-GATE-01`, this gate IS governed**: thresholds live in `GENERATION_CONFIG.DAYS_AVAILABILITY_THRESHOLDS`, §52 owns the principle, and `daysAlternativesFor()` already returns alternatives.

**📊 Measured before ruling** — marathon, finish, first-timer, 25 km/week base:

| Days/week | Peak week | Peak long run | **Long run as share of its week** |
|---|---|---|---|
| **3 (lowest permitted)** | 52 km | 26.0 km | **50.0%** |
| 4 | 52 km | 26.0 km | 50.0% |
| 5 | 52 km | 26.0 km | 50.0% |

**🩹 Willy.** There is the argument, and it is arithmetic rather than opinion. At the lowest day count we permit, the long run is **already at 50% of the week** with ten points of headroom under §52's 60% ceiling. Take a day away and the same 26 km run sits in a week roughly 10 km shorter: **~65%, through the ceiling.** A two-day marathon week is not a worse plan, it is an **invalid** one.

**🏃 Hutchinson (chair).** That is the distinction the founder's ruling turns on, and it is not the same case as prep time. A `warn` acknowledgement says *"I accept a worse outcome"* — legitimate, and the runner is the right person to decide. **An acknowledgement here would say "I accept a plan that breaches our own long-run ceiling", and that is not the runner's to accept.** Acknowledging does not change the arithmetic.

**🎯 McMillan.** Agreed, with the practical caveat: two days a week is not a marathon, it is an injury. But the screen must say *which* lever — one more day — and §52 already computes it. The defect is display, not doctrine.

**📊 Seiler / ⚕️ Sims.** No objection from either seat.

**⚖️ RULING — CORRECT AS IS. The `block` tier stands.** The founder's ruling is honoured where it applies — the `warn` tier — and does not extend to a tier where acknowledgement would ratify an invalid plan. **No artifacts required: no principle, numeric or invariant changes.**

⚠️ **What this does NOT license.** The refusal is correct; **the way it is presented is not** — see `REFUSAL-SCREEN-01`. §52 computes the alternatives and the UI discards them. Fixing that is brand work and needs no board.

---

### ⚖️ SLT — `FOUNDATION-DECIDE-LATER-01`: delete the button, or make "later" real? Sat 2026-09-18.

**The choice.** Two handlers are byte-identical and the modal has one trigger, so "Decide later" is a promise the app cannot keep. **Fix A:** delete the third button. **Fix B:** build a real "later" — stamp the outstanding decision and re-offer it on the Plan screen.

**🔬 Wood.** I promoted this item, so let me be precise about what I promoted. The risk is not the duplicate button, it is **losing the foundation decision for ~500 people in the one low-stakes window where running becomes automatic.** But B only helps if the re-offer arrives somewhere the runner will act on it, and a banner on a plan screen they are already ignoring is not that. **A now. B only with a place to put it.**
**📦 Fried.** Three buttons where two are the same is just a mistake. Delete it today.
**🧠 Sutherland.** "Decide later" is the option people pick when they do not understand the question. The real fix is the sheet explaining itself better, which neither A nor B is.
**💰 Traynor.** No commercial dimension. Cheapest honest fix.

**✅ RECOMMENDATION — Fix A now.** Delete the button; two honest options remain. **Do not build B as scoped** — re-offering needs a surface that does not exist, and inventing one is the illusion-of-progress class. ⚠️ **Sutherland's point is the real follow-on** and belongs to `FIRSTRUN-MARATHON-01` touchpoint 5: the sheet should explain the 28 weeks, not just offer three buttons.

---

### ⚖️ SLT — `GTM-CHARITY-09`: is a partner FAQ enough for 500? Sat 2026-09-18.

**💰 Traynor.** 500 comped runners produce no support revenue and every ticket is a cost against a channel we are trying to build. **The failure mode is not volume, it is the charity fielding our questions** — that is what damages the referral. A partner FAQ that Jack can send with the codes is the cheapest thing that prevents it.
**📦 Fried.** Do not build a help centre for a cohort that arrives once. Write the document.
**🔬 Wood.** The predictable questions are knowable *today* — code will not redeem, no HR data, why is my plan so easy, why does it not start yet. That last one is new and matters: **the 28-week runway will generate support load nobody has planned for.**
**🧠 Sutherland.** Put it in the charity's voice, not ours. It arrives from Jack, so it should sound like Jack.
**🏃 Hutchinson.** One condition: *"why is my plan so easy"* is answered by §1 and §12, and the FAQ must not soften that into an apology. It is the product.

**✅ RECOMMENDATION — BUILD DIFFERENTLY: a partner-facing FAQ, not a support surface.** Five questions, drafted for Jack to send with the codes, in the charity's register. **Add the runway question** — Wood's point is not on the current list. Ships with the codes, not before them. **Still FREE, still one inbox** — no ticketing, no chat.

---

## 🎬 FIRSTRUN-MOMENTS-01 — full specs (SLT-approved 2026-09-18)

*Six sub-items. **Five are copy and arithmetic over data the app already holds** — no new screens, no prescription change, no board. The sixth is blocked on redemption sequencing. Ordered by the SLT's own ranking.*

> **The framing, per Wood, and it is binding on how these are judged:** the outcome is **not** "they felt special". It is **the perceived enormity of the first action falls far enough that they do it.** (a) and (b) do that structurally; (c)–(e) are cheap and pleasant and **must not be counted as behaviour change.**

---

### `FIRSTRUN-MOMENTS-01a` — move the runway line to the reveal · **S** · ✅ SHIPPED 2026-09-18

> ✅ **SHIPPED.** `components/shared/RunwayRevealCard.tsx` renders `meta.uncovered_runway_note` as the FIRST card at the plan reveal (`GeneratePlanScreen` preview), led by a bold `uncovered_runway_weeks` number ("You're early / 11 weeks early"). ⚠️ **It was not "buried further down" — it was rendered NOWHERE** (stamped on meta, required by an invariant, in `planRationaleNotes` never). No AI mark (rule-engine copy, AI-PROVENANCE-01). Rendered ONCE — a test locks that `planRationaleNotes` does not also surface it. Markup-guarded (number-first, plural, tokens, no em dash). → feature-registry.

**Simple.** The `uncovered_runway_note` already written by `foundationCompose.ts` is shown **at the moment the plan is revealed**, not buried as a note further down the plan screen.

**Why it is first.** It already exists, is already ratified (§57/§76), is already in perfect voice, and for a London 2027 first-timer it says **"You have 11 weeks before this plan starts"**. Sutherland: *the emotion is relief, and nobody else is selling it.* **This is a MOVE, not a write.**

- **Data:** `plan.meta.uncovered_runway_note` + `uncovered_runway_weeks` (already stamped).
- **Surface:** `GeneratePlanScreen` preview header, above the week list.
- **Lovable:** lead with the number. The sentence that lands is *"You are eleven weeks early"*, not *"you have spare weeks"*.
- **Complete:** absent when `uncovered_runway_weeks < FOUNDATION_UNCOVERED_WEEKS_NOTE_THRESHOLD` (2) · absent for a plan starting immediately · ⚠️ **must not render twice** — decide whether it also stays lower down, and assert the decision in a test.
- **Done when:** a first-timer generating a London 2027 plan reads it without scrolling.

---

### `FIRSTRUN-MOMENTS-01b` — the first run, before the plan · **S** · ✅ SHIPPED 2026-09-18

> ✅ **SHIPPED.** `lib/plan/firstRun.ts → firstRunOfPlan(weeks)` (pure) pulls the first non-rest session of the first week (foundation week if present); `components/shared/FirstRunCard.tsx` renders "First up / {Day}. {metric}. {effort}." under the runway card at the reveal. Duration via `formatDuration` (ADR-015); rounded km fallback; effort mapped honestly; null (card absent) when nothing concrete. No AI mark (rule-engine data). Tested both layers. → feature-registry.

**Simple.** Before 20 weeks of marathon block renders, show one thing: the first session.

> **Monday. 20 minutes. Easy.**
> That's the whole job this week.

**Why.** A first-timer sees a wall of marathon and feels sick. This collapses *"marathon"* into something they can picture doing on Monday. Wood funds this one: **it lowers the activation cost of the first action**, which is the behaviour that matters.

- **Data:** `weeks[0]` first non-rest session; **duration via `formatDuration`** (ADR-015 — it is `20 min`, never `20 minutes`).
- **Complete:** rest-day-first weeks · a foundation block present (the first run is then a foundation run, which is even gentler and **better**) · duration-anchored *and* distance-anchored sessions (beginners are duration-anchored 95.8% of the time).
- **Done when:** the first thing a first-timer reads is one sentence they could do tomorrow.

---

### `FIRSTRUN-MOMENTS-01c` — the ceremony says what they just told us · **S/M**

**Simple.** Replace the five fixed ceremony lines with lines derived from **this runner's** `GeneratorInput`.

Today, to everyone: *"Calculating your Zone 2 ceiling. Lower than you'd expect."*
Proposed, to them:
> *"You said three days a week. We're not going to ask you for five."*
> *"Your longest run is 8 km. Week one asks for 4."*
> *"You've told us about a knee. Every hard week is followed by an easy one."*
> *"Twenty weeks to Sunday the 25th of April."*

**Why.** This is not motivation. It is **the app proving it listened**, to someone who has just handed over fifteen answers including their injuries and their fears.

- **Lovable:** the voice table applies unchanged. Dry, specific, never congratulatory. **No line may claim anything the plan does not do.**
- **Complete:** a fallback line when a field is absent · never more lines than the enrichment window supports (28–35s) · free tier gets the same treatment (no AI needed — these are template lines over inputs).
- ⚠️ **Fried's condition:** put them in the existing component. **No `MomentFramework`.**

---

### `FIRSTRUN-MOMENTS-01d` — the distance reframe · **S**

**Simple.** One line on the reveal: *"Between now and April you'll run about 900 km. The race is 42 of them."*

**Why.** The marathon stops being the biggest thing they will ever do and becomes a fraction of what they will already have done.

- **Data:** sum `weekly_km` across all weeks including foundation. **Round hard** — "about 900 km", never 897.3.
- **Complete:** duration-anchored plans have no per-session km, so **use the same owner the engine uses** (`sessionKm` / `sumWeeklyKm`), never `distance_km ?? 0` (SESSION-KM-01: that reads a beginner's plan as zero) · suppress if the total is implausible.

---

### `FIRSTRUN-MOMENTS-01e` — name the worst day · **S** · ⚠️ conditional

**Simple.** *"The hardest thing this plan asks of you is one 3h 28 run, in March. Once."*

**Why.** Dread lives in the unknown. Naming the ceiling removes it, and it is very on-brand: honest, blunt, no comfort offered.

🔴 **HUTCHINSON'S BINDING CONDITION.** This is a **promise about a plan that can reshape**. It is true at generation and may be false in February. **Derive it live wherever it is shown, or do not say it.** Never stamp it into meta at generation.

- **Data:** max `duration_mins` across long runs, **via `formatDuration`** · the week it falls in.
- **Complete:** recompute on every render · absent if the plan has no long run yet.

---

### `FIRSTRUN-MOMENTS-01f` — "you are one of 500" · **M** · 🔴 BLOCKED

**Simple.** Once, for a charity-grant runner: *"You're one of 500 running London for Make-A-Wish. Most of them have never done this either."*

**Why.** The honest version of "not alone": a **true fact**, stated once. No feed, no leaderboard, no comparison — those are barred.

🔴 **BLOCKER RETRACTED 2026-09-18 — IT WAS NEVER BLOCKED.** I filed it as *"redeemed on the Me screen, after onboarding"*. **There are THREE doors into redeem** — `DashboardClient.tsx:306` says so in a comment — and one of them is **the onboarding wizard itself** (`GeneratePlanScreen.tsx:1662`, rendered when `isOnboarding || !hasPaidAccess`, with `redeemReturnTo: 'generate'` so a half-finished plan survives). A charity runner can redeem **before** generating, and `charityGrantRes` is already loaded on mount, so the grant IS known at the reveal. **Fourth "X is impossible" claim retracted today** — see [[feedback-trace-the-producer-not-the-consumers]].
>
> ⚠️ **What IS a real constraint, found by checking the data:** `charity_batches` holds `partner_name` and `cap`, so *"one of 500 for Make-A-Wish"* is real and fixed. **But "most of them have never run a marathon either" cannot be substantiated** — nothing measures that, and asserting it is the claim/computation mismatch class retracted three times today. **That sentence is cut.** The redeemed count is deliberately NOT used: it is a running counter, which this item's own spec bars as *"a leaderboard with extra steps"*, and it would change daily.

- **Complete:** only for a live charity grant (`resolveTier` reason) · the number must be **real** (redeemed codes), never a marketing round number · **shown once, never a running counter** — a counter is a leaderboard with extra steps.

---

### ⚖️ SLT — `FIRSTRUN-MOMENTS-01`: make the generation moment feel like something. Sat 2026-09-18.

**Founder's brief.** *"Up to 500 marathon runners, the vast majority have never run the distance. Drop-off is high and some never start. When they use the app I want them to feel something. On the wizard and the generation, what can we do to inspire them, or let them know they're not alone, or that they can do this?"*

**Tier: FREE.** Onboarding is FREE by doctrine and this cohort is comped regardless.

**📋 THE FINDING THAT REFRAMES THE WHOLE ITEM.** Two things established in code before this sitting:
1. **The generating ceremony is entirely generic.** Five fixed lines — *"Calculating your Zone 2 ceiling. Lower than you'd expect."* — shown to everyone. We hold a nervous first-timer's full attention for 28–35 seconds, having just asked them fifteen questions about themselves, and say **nothing that could only be about them.**
2. 🔴 **The single most reassuring sentence we own is already written, already ratified, and buried.** A London 2027 first-timer generating today gets `uncovered_runway_note`: *"You have **11 weeks** before this plan starts, and we are not going to pretend they are training… arriving at week one with the legs you have today is the point."* **It renders as a note on the plan screen.** So the brief is not "write inspiring copy". It is: **we already have the words and we say them in the wrong place, at the wrong moment, to someone who has stopped reading.**

**🧠 Sutherland.** Then stop calling it inspiration. **The emotion you are selling is RELIEF, and nobody else is selling it.** Every competitor tells a first-timer they can do it; you are the only one who can tell them *they have eleven weeks in hand and we are not going to fill them*. That is a genuinely novel sensation for someone who was handed a marathon place and immediately felt behind. Lead the reveal with it.

**📦 Fried.** Ideas 1 through 5 are copy and arithmetic over data we already hold. That is not a feature, it is writing, and I support all of it. **What I would kill is the word "moments"** — the second this becomes a thing with a name and a component, somebody builds a ceremony framework. Put the sentences in the existing surfaces.

**🔬 Wood.** I will support this and I will not support the framing. **"Feel special" is not a behavioural outcome and cannot be measured in week 8.** Reframe it: the job is to reduce the perceived enormity of the first action. Two of these do that structurally rather than emotionally, and they are the two I would fund — **the first-run reveal** (*"Monday. 20 minutes. Easy."*) collapses "marathon" into something a person can picture doing, and **the runway reveal** removes the "I am already behind" frame that produces the October drop-out. The other three are pleasant and change nothing. Ship them anyway, they are cheap, but do not count them.

**💰 Traynor.** This is the referral asset in one screen. A first-timer who feels *understood* at generation tells Jack. One who feels processed tells nobody, and one who feels patronised tells Jack something worse. **Cheapest brand-building available to us.**

**🏃 Hutchinson.** No prescription changes here, so this is not my other board's business. **One accuracy guard, and it is binding: idea 5 makes a PROMISE about a plan that can reshape.** *"The hardest thing this plan asks of you is one 3h 28 run in March"* is true at generation and may not be true in February after a reshape. Either derive it live every time it is shown, or do not say it.

**⚡ Conflicts**
- **Wood vs the founder's framing, twice in one day.** "Feel something" is not measurable; "acted on Monday" is. **The ideas survive, the framing does not** — and note this is the *second* time this week the wow/feeling framing has been reduced to a structural one.
- **Sutherland vs Wood on the other three.** He thinks relief is the product; she thinks only the two that lower activation cost count. **Unresolved, and cheap to resolve empirically** — they cost an afternoon, ship all five and see which the founder cuts by ear.

**✅ RECOMMENDATION — BUILD. Mostly re-placement, not new writing.**
1. **Move the runway line to the reveal.** It exists, it is ratified, it is the best thing we have. **Highest value on the list and it is a move, not a write.**
2. **First-run reveal before the plan renders** — *"Monday. 20 minutes. Easy. That's the whole job this week."* Data is in `weeks[0]`.
3. **Ceremony lines built from their own inputs** — *"You said three days. We're not going to ask for five."* One function over `GeneratorInput`.
4. **The distance reframe** — *"Between now and April you'll run about 900 km. The race is 42 of them."*
5. **Name the worst day** — ⚠️ **only if derived live**, per Hutchinson.
6. **The cohort fact** (*"one of 500, most have never done this either"*) — **BLOCKED, and worth unblocking**: the charity code is redeemed on Me *after* onboarding, so at wizard time we do not know they are a Make-A-Wish runner. Moving redemption to sign-up is the dependency.

**🚨 MUST/NEVER.** No streaks, no badges, no confetti, no *"You've got this"*. The voice table bars cheerleading and **a missed session is the worst place in this app to have taught someone to expect praise**. No new modal. No component called anything like `MomentFramework`.

**⚠️ Risks.** Item 1 moves ratified §57/§76 copy to a new surface — **the note must not appear twice**; decide whether it stays on the plan as well. Item 6 touches `GTM-CHARITY-04` redemption sequencing.

---

### ⚖️ SLT — `FIRSTRUN-MARATHON-01`, touchpoint 7: the first missed session. Sat 2026-09-18.

**Why this touchpoint.** The SLT batch named it the priority inside the P0: *the drop-out happens at the first missed session*, not at onboarding, where motivation is highest.

🔴 **CORRECTED 2026-09-18, BEFORE BUILDING — I OVERSTATED THIS AND THE SITTING BELOW IS WRONG IN ITS HEADLINE CLAIM.** The skip reason is **NOT** "read by nothing". Tracing the PRODUCER rather than grepping the consumers I had thought of: `DashboardClient.tsx:2541` and `:4390` fire `POST /api/adjust-plan` with `skipReason`, which becomes `planAdjustment`'s `skipSignal`, which applies **§21's content filter and a volume reduction for `'Injury / illness'`** (`planAdjustment.ts:586`). **A runner who reports an injury DOES get a plan response.** ⚠️ `'Too tired'` is deliberately excluded from that call (*"absorbed"*, both sites) — a design choice, not a defect.
>
> **The real defect is narrower, and still real: the reason is STORED in the wrong column.** It is written to `session_completions.fatigue_tag`, whose vocabulary is `Fresh · Fine · Heavy · Wrecked`. Two consequences, and the second is the one that bites:
> 1. No fatigue consumer can ever match it (`limiter.ts:236`, `disciplineLedger.ts:124`) — inert, as filed.
> 2. 🔴 **IT DEGRADES THE FATIGUE SIGNAL.** `DashboardClient:6901` pushes **any** truthy `fatigue_tag` into the trend, then `heavyFatigue` reads the **last three** and needs two of `Heavy/Wrecked/Cooked`. A `'Life got busy'` occupies a slot and **dilutes the trigger**. The dead input is not inert; it displaces real fatigue data in a fixed-size window.
>
> ⚠️ **THIRD RETRACTION TODAY OF A "NOTHING READS THIS" CLAIM** (after §80's branch and the deck's refusal thresholds). The pattern is the same every time: I grepped the consumers I could think of instead of tracing the producer's call path. See [[feedback-trace-the-producer-not-the-consumers]].
>
> **📋 WHAT HAPPENS TODAY — established in code, and the storage is the defect.**

A runner who misses a session gets `MissedSessionSheet`: *"Looks like Tuesday's session wasn't logged. What happened?"* with four buttons — **Injury / illness · Too tired · Life got busy · Bad weather** — and an immediate, well-written response (`getSkipResponse`): *"Right call. Don't push it."*

Then the answer is written to `session_completions.fatigue_tag` and **read by nothing.**

🔴 **ONE COLUMN, TWO DISJOINT VOCABULARIES.** `fatigue_tag` is also written by the post-run flow with `Fresh · Fine · Heavy · Wrecked`. **Every downstream consumer matches only that second vocabulary:**

| Consumer | Matches | Sees a missed-session reason? |
|---|---|---|
| `limiter.ts:236` (Trigger 4 fatigue accumulation) | `FATIGUE_HIGH_TAGS = ['Heavy','Wrecked','Cooked']` | **No** |
| `disciplineLedger.ts:124` | `'Heavy' \|\| 'Wrecked'` | **No** |
| `DashboardClient:6907` fatigue warning | `['Heavy','Wrecked','Cooked']` | **No** |
| `DashboardClient:3864` | `['Heavy','Wrecked','Cooked']` | **No** |

**The sets are disjoint. A first-time marathoner who reports an INJURY produces exactly one sentence of copy and zero change to anything else.** The limiter cannot fire, the discipline ledger cannot see it, the plan does not adapt. This is the `'Shin splints' ≠ 'shin_splints'` class (`feedback-fixtures-must-use-product-values`) and the INPUT-EFFECT-01 dead-input class, together, on the single most fragile moment in a beginner's training.

**🔬 Wood.** This is my argument, and I did not expect the evidence to be this clean. **We ask the question, we print a kind sentence, and we discard the answer.** The behavioural cost is precise: the runner has just told us they are injured, and the plan's silence teaches them the app is decorative at exactly the moment they are deciding whether they are *"someone who is behind"* or *"someone who missed a run"*. ⚠️ **And the fix is NOT to add encouragement.** It is to make the context respond — the same principle that decided ADR-012.
**📦 Fried.** Nobody has to build a feature here. **A dead input is a bug.** Fix the vocabulary, then decide what reads it.
**🧠 Sutherland.** Note which reason is most common and which is most serious are different questions. *"Life got busy"* will dominate; *"Injury / illness"* is the one that ends a marathon. Do not average them.
**💰 Traynor.** Jack's entire problem in one screen. The moment a place-holder becomes a non-runner is the moment they miss one session and nothing happens.
**🏃 Hutchinson.** Agreed on the defect, and here is the boundary. **Making the plan RESPOND to a missed session is prescription** — that is the Coaching Board, not this one, and §R20-T4 already owns fatigue-triggered softening. **What is in scope here without my other board: make the input reach the consumers that already exist.** Whether an injury report should reshape the plan is a separate ruling.

**✅ RECOMMENDATION — BUILD, in three separable parts. Only the first is unblocked.**
1. **Fix the dead input (defect, no board).** One column cannot carry two vocabularies. Separate the missed-session reason from the fatigue tag, or map it — and add a guard test that fails when a written value has no reader. **This is the whole of what can be built today.**
2. **Route it to the consumers that already exist (Coaching Board).** §R20-T4's softening, the discipline ledger, the limiter. Existing mechanisms, new input — still prescription, still a ruling.
3. **The runner-facing response (brand + Wood's condition).** Only after 1 and 2. **No encouragement, no streak, no "you've got this".** Context, not motivation.

**🚨 MUST/NEVER.** No gamification of a missed session — **the single highest-risk place in this app to put a streak**. No new modal; the sheet exists. Part 3 must not promise adaptation that part 2 has not delivered.
**⚠️ Risks.** `session_completions` is read by the discipline ledger, the reframe risk gate and `v_coach_engagement`. **Changing what `fatigue_tag` carries touches all three** — and `completionVerification.ts:55` already assumes *"skip-with-reason carries a fatigue_tag by definition"*.

---

## 🥇 P0 — FIRSTRUN-MARATHON-01: the first-time marathoner is the product

*Filed 2026-09-18 after the founder's call with Jack (Make-A-Wish UK). **This is now the number one priority.** Everything below it waits.*

**Why, in Jack's words.** Make-A-Wish give away marathon places and **a large share of the people who take them never run**. That is the charity's stated pain, said more than once on the call. Most of the 500 are **first-time marathoners or beginners**. So the thing Zonna is being asked to fix is not plan quality in the abstract: it is **the drop-out rate between "I have a place" and "I got to the start line"**.

**The brief.** From the first moment someone opens the app to the moment their plan appears, a first-time marathoner should get an experience they do not forget, and should never feel they are doing this alone.

**The measure that matters is not conversion. It is: did they still be running in week 8?** A first-timer who abandons in February costs the charity a place and Zonna a reference. Every decision under this item is judged against that, not against activation.

**Touchpoints in scope, in the order the runner meets them.**

| # | Touchpoint | What exists today |
|---|---|---|
| 1 | First open / sign-up | Generic. Nothing knows they are a charity runner or a first-timer. The code is redeemed on Me, *after* onboarding |
| 2 | The wizard | ~15 questions. Asks a beginner their VDOT-adjacent inputs, `hard_session_relationship`, weekday minute budgets |
| 3 | The generating moment | `GeneratingCeremony` — the single best "wow" surface we own and the least considered |
| 4 | First sight of the plan | 20+ weeks of a marathon block, which for a first-timer is the most intimidating object in the app |
| 5 | The long pre-plan runway | Oct → April is ~28 weeks. Most will get a **foundation-block choice** and an **uncovered-runway note** |
| 6 | Week 1 | No differentiated first-timer experience at all |
| 7 | The first missed session | The moment the drop-out actually starts, and we treat it identically for everyone |

**Known blockers and impediments already on this backlog** *(checked, not assumed — these are the items that make this harder, and each needs a decision under this priority)*:

- 🔴 **`FOUNDATION-DECIDE-LATER-01` (filed below).** The foundation-block sheet is touchpoint 5 for nearly every one of these 500 runners, and **"Decide later" never comes** — the modal has exactly one trigger, at generation.
- 🔴 **`FOUNDATION-ADD-FAIL-01` (filed below).** The founder could not add a foundation block at all, and the error path records nothing.
- 🟡 **`ONBOARD-SKIP-LABEL-01` (filed below).** Touchpoints 1–2: tapping "Connect later" tells the runner it is connecting.
- ✅ ~~**§44's `block` tier**~~ **CLOSED 2026-09-18 — Coaching Board ruled CORRECT AS IS, no artifacts required.** *(Stale until 2026-09-19; the sitting is
  in this file under § GOVERNANCE TRIAGE and this bullet still called it open.)* Willy's arithmetic carried: at 3 days/week the long run is **already
  50% of the week** with ten points under §52's 60% ceiling, so removing a day pushes the same run through it. Hutchinson drew the distinction the
  founder's ruling turns on — a `warn` acknowledgement says *"I accept a worse outcome"*, which is the runner's call; **an acknowledgement cannot
  ratify a plan that violates a ceiling**. ⚠️ **What it does NOT license:** the refusal is correct, its PRESENTATION was not — that was
  `REFUSAL-SCREEN-01`, and §52 computes alternatives the UI used to discard.
- 🟡 **`GTM-CHARITY-09`** — support is one inbox, and this cohort arrives together with the same few questions.
- 🟡 **Minimum iOS 16.6**, no Android, no mobile-web dashboard — a handful of 500 cannot install at all.
- ✅ **`CAT-DEPTH-01`** — ✅ **CLOSED 2026-09-19 — Coaching Board CB-BEGINNER-CATALOGUE-01, shipped.** The blocker was THREE gates, not a thin catalogue: the quality SLOT (`QUALITY_SESSIONS_PER_WEEK_MAX.beginner = 0`), the ROWS (1 of 29, Z2 aerobic, nothing in peak/taper), and the DOSE tables (4 of 6 with no `beginner` key, a runtime crash not a compile error). Delivered: two rows LOWERED (parity-IDENTICAL), one new `beginner_goal_pace_blocks` scoped by a new `fitness_level_max`, beginner dose entries, `BEGINNER_QUALITY_MIN_WEEKLY_KM = 20`, `qualityCeilingFor()` owner, `INV-PLAN-TIME-TARGET-QUALITY-FLOOR`. **Measured: parity 578/5,940 — beginner 578/1,980, intermediate 0, experienced 0; time_target 578, finish 0.** Plans with no quality at all **33.3% → 17.4%**. `measure:fitness` improved (never-builds 18.8→17.2 / 15.6→13.6). Sweep clean. See §110 Am.2, §110b, §8 Am.1 and `docs/decisions/cat-depth-01-plan.md`.

> 🔵 `S9-DURATION-FLOOR-01` **(P2, Coaching Board)** — §9's minimum-session-size floor is expressed in KM and `INV-PLAN-MIN-SESSION-SIZE` skips duration-anchored sessions, so it does not reach any beginner session (quality OR easy). **Pre-dates §110 Am.2**, which only widened the population. ⚠️ **The obvious fix was tried and is WRONG:** reading the size via `sessionKmSelfPaced` makes it fire on ordinary beginner easy runs — 30 minutes at a beginner's pace is 3.9 km against a 4 km floor. A km floor applied to a session prescribed in minutes asks the wrong question; §9 needs a MINUTES equivalent, which is a coaching decision.

> 🔵 `S53-PIGEONHOLE-ARM-01` **(P3)** — 2 plans in 14,486 (`5km/beginner/days=3/cwk=40`): five quality sessions from a pool of two rows, so some row must appear three times while §53's cap computes 2. **Arithmetically unsatisfiable**, which the pigeonhole arm exists to prevent — it computes 2 where `ceil(5/2) = 3`. Baselined in the sweep with this reason. ⚠️ **Do not fix by widening the pool**: the row that would do it is rung 5, which the board explicitly DEFERRED.

*(original scoping below.)* 🟡 **ROOT CAUSE NAMED WITH A NUMBER, 2026-09-19 — and it blocks a board ruling. ESCALATED TO SLT.** The backlog has said "root cause is catalogue thinness" for weeks. **The figure is 1 of 29: exactly ONE quality catalogue row is `fitness_level_min: 'beginner'`** (26 intermediate, 2 experienced), and it is `aerobic_steady` — category `aerobic`, **not a goal-pace session**. Consequence: `selectCatalogueSession` returns null for a beginner, the session is built with **no `catalogue_id`**, and `INV-PLAN-CATALOGUE-LINK` (ADR-018) fires — the exact rep-structure-lost defect ADR-018 exists to prevent. **Coaching Board 2026-09-19 (CB-BEGINNER-TIMEGOAL-01) ruled CORRECT WITH AMENDMENT** that a beginner with a TIME TARGET must get 1 quality/week (measured: beginner·time_target n=6,336 is **100% zero-quality and 0% goal-pace exposure**, against 0%/100% for every other level on the same goal — binary, not a lighter dose). **BUILT, MEASURED, 31 test failures across 13 files, REVERTED** — see §110 Amendment 2, which records the ruling as correct-and-unshippable. ⚠️ **The measurement that looked like success was reading the defect:** goal-pace exposure showed 0% → 100%, but those labels came from the null-row fallback. **A label is not a prescription.** The invariant caught it; the measurement did not. ⚠️ **Beginner FINISH-goal plans were ruled CORRECT AS IS** (unanimous) — 20 weeks of easy running plus §28 strides is right for a first marathon; the thinness there is an EXPERIENCE problem and belongs to the SLT, not the board. **Unblocking needs beginner-eligible goal-pace catalogue rows = a `session-catalogue.md` sitting.**

> 📋 **FULL RESOLUTION PLAN + IMPACT ANALYSIS: `docs/decisions/cat-depth-01-plan.md`** (2026-09-19) — three measured probes, the coaching research, three options and a six-step sequence with a gate on each. **Read it before starting; the headline is that the catalogue is the SECOND of three gates, not the first.**
>
> ⚠️ **THE TWO MEASUREMENTS THAT CHANGE THE APPROACH.** (1) Adding a beginner-eligible row changed **2,324 of 5,940 parity cases — 0 of 1,980 beginner plans and ~59% of intermediate AND experienced plans**, because `fitness_level_min` means "and everyone above" and the rotation is least-used-first. (2) **Lowering an EXISTING row to beginner is byte-for-byte IDENTICAL** across all 5,940 cases. So the route is lower-and-scope, never add-unscoped. (3) A third gate nobody had filed: **4 of 6 fitness-keyed dose tables have no `beginner` key** (`VO2MAX_WORK_TARGET_MINS`, `THRESHOLD_WORK_TARGET_MINS`, `SESSION_WORK_OVERRIDE_MINS`, `PROGRESSIVE_TEMPO_MAIN_MINS`), typed `Record<string, …>` so it is a **runtime undefined, not a compile error** — lowering `progressive_tempo` and opening the slot throws `resolveMainSet: parameter "third_secs" has no value`.
>
> **WHAT COMPLETING IT ACTUALLY REQUIRES (scoped 2026-09-19, from the catalogue itself).**
>
> **The state, precisely.** The catalogue has 29 quality rows. **One** is `fitness_level_min: 'beginner'`: `aerobic_steady` — category `aerobic`, `intensity_zones: ['Z2']`, `phase_eligibility: ['base','build']`. So a beginner has **zero** eligible `threshold` or `race_specific` rows at any phase, and in **peak** they have no eligible row at all — which is why `selectCatalogueSession` returns null, the session is built with no `catalogue_id`, and `INV-PLAN-CATALOGUE-LINK` (ADR-018) fires. The one row they do have is a **Z2 aerobic run**, which is not a quality stimulus.
>
> **Four things, in order:**
> 1. **A Coaching Board sitting on `session-catalogue.md`** (hard trigger) — the doctrine question is *what may a beginner be prescribed*: which stimulus, at what dose, in which phases. This is the blocker; everything else is execution. Willy's standing condition from 2026-09-19 applies — he blocked adding intensity to beginners who did **not** ask, so the scope is the time-target beginner first.
> 2. **Author the rows.** Each needs `id`, `name`, `category`, `purpose`, `phase_eligibility` (must include **peak**, which the existing beginner row lacks), `distance_eligibility`, `fitness_level_min: 'beginner'`, `difficulty_tier`, `main_set_structure`, `intensity_zones`, typical durations, `coach_voice_notes`. At least one must be **goal-pace capable**, or the time-target case is not solved.
> 3. **Un-revert §110 Amendment 2** — the ruling is already CORRECT and the code is written and recorded: `BEGINNER_TIME_TARGET_QUALITY_PER_WEEK_MAX = 1`, the `qualityCeilingFor()` shared owner, and `INV-PLAN-TIME-TARGET-QUALITY-FLOOR`.
> 4. **Re-measure** `verify` · `verify:parity` · `cohort:shape` · `measure:fitness` · `audit:plans`. The first attempt produced **31 failures across 13 files**; expect real blast radius on the beginner cohort.
>
> ⚠️ **§53 will NOT block a thin pool and must not be mistaken for the gate.** Its cap is `max(fraction, pigeonhole)`, and the pigeonhole arm means one row picked k times is *permitted*. So adding a single row makes the invariants pass while leaving the runner doing the same session ten times. **The reason to author more than one row is coaching, not the checker** — which is exactly the trap D-21 was written about, in reverse.
>
> ⚠️ **SEPARATE AND NOT THIS:** the beginner **finish-goal** plan (61 identical "Easy run — Zone 2" labels over 20 weeks) was ruled **CORRECT AS IS** by the board, unanimously. That thinness is an EXPERIENCE problem for the SLT and must not be fixed by adding intensity to runners who did not ask for it.

**What is NOT in scope, and why.** Not a new coaching model: the engine was measured fit-for-purpose for first-time marathoners on 2026-09-16 (11/11 charity personas) and again after PLAN-FITNESS-01. **The gap is experience, not prescription.** Anything here that would change what the engine prescribes goes to the Coaching Board first.

**✅ SLT HAS SAT (2026-09-18). The scope-setting review is done — this is now a build queue, not an open question.** The founder overruled the initial deferral (correctly — see the governance triage below); Wood's kill mandate was applied at the sitting and the "wow-feature" framing was killed. The output is a ranked, mostly-S-sized queue of concrete moments — `FIRSTRUN-MOMENTS-01a–f` (full specs below, from § "🎬 FIRSTRUN-MOMENTS-01 — full specs") and `FIRSTRUN-MISSED-01`. The two sittings are recorded below (§ "⚖️ SLT — `FIRSTRUN-MOMENTS-01`" and § "⚖️ SLT — `FIRSTRUN-MARATHON-01`, touchpoint 7"), and the SLT-ordered work queue is at the top of this file. **Touchpoint 7's actual intervention still needs its own sitting once scoped** — a brief does not exist for it yet. Anything that would change what the engine prescribes still goes to the Coaching Board first.

---

#### 🐞 Four observations from the founder's device — filed 2026-09-18

> 🔴🔴 **MARATHON-VOLUME-GATE-01 — an UNGOVERNED refusal sits in an API route and will refuse a large share of the Make-A-Wish cohort.** *(P0. Supersedes GTM-DECK-CORRECT-01, which is withdrawn. Coaching Board ruling below.)*
>
> `app/api/generate-plan/route.ts:28` — a `validate()` wrapper called at `:92`, **before** `generateRulePlan` at `:128`:
>
> ```ts
> if (input.days_available < 2) return 'At least 2 training days per week are required.'
> if (input.race_distance_km >= 42 && input.current_weekly_km < 20)
>   return 'Current weekly volume is very low for a marathon. We need at least 20 km/week to generate a safe plan. Build your base first.'
> if (input.race_distance_km >= 21 && input.longest_recent_run_km < 5)
>   return 'Longest recent run is very short for this distance. Log at least a 5 km run in the last 6 weeks before generating this plan.'
> ```
>
> **Who this refuses.** A first-time marathoner running **under 20 km a week** in October — which is a plain description of a large part of a charity marathon cohort — gets **no plan at all**. So does anyone attempting a half or a marathon whose longest recent run is under 5 km. **This is Jack's drop-out population, refused at the first screen**, and told to *"build your base first"* with no base-building plan offered.
>
> 🔴 **THE GOVERNANCE FAILURE IS THE POINT, and it is a class this repo has already paid for.** These three numbers:
> - are **hardcoded in an API route**, not in `GENERATION_CONFIG`;
> - have **no `CoachingPrinciples` section** — the comment says *"kept until promoted to a CoachingPrinciples section in a future round"*, and that round never came;
> - were therefore **never ratified by the Coaching Board**;
> - are **invisible to `configPrincipleSync.test.ts`** (it reads `GENERATION_CONFIG`) and to **`coaching-guard.py`** (it does not watch `app/api/`).
>
> **Identical to `peakKmByLevel` (§106, MAINT-PROFILE-01):** *"Every governance layer this project has, bypassed by a table being in the wrong place."* It happened again, and this time it is the gate that decides whether a runner gets a plan at all.
>
> ⚠️ **They also contradict the two gates that ARE governed.** §44 (prep time) and §52 (days) both compute **`alternatives`** — `daysAlternativesFor()` returns *"Race the Half at this event instead"*, *"Switch goal to finish"*. These three return a **bare string with no alternatives**, which §44's own text requires (*"Return error explaining why and listing alternatives"*).
>
> 🔴 **HOW I GOT THIS WRONG, recorded because the method matters more than the item.** Earlier the same day I "refuted" this claim by generating 42 combinations of volume × longest run and finding that **every one built a plan**. That measurement was correct and irrelevant: it called `generateRulePlan` directly and **never went through the route**. I verified the engine, not the path a runner takes, and told the founder to change a deck that was right. **A refusal that lives at the boundary is invisible to every test that starts inside it.**

> ⚖️ **COACHING BOARD — MARATHON-VOLUME-GATE-01, sat 2026-09-18. Ruling: the CONCERN is correct, the IMPLEMENTATION is INCORRECT.**
>
> **Trigger:** soft (`app/api/generate-plan/route.ts`) and it qualifies — this decides whether a runner gets a plan at all. ⚠️ **The hook did not fire and could not**: `coaching-guard.py` does not watch `app/api/`.
>
> **🔍 Conflict scan.** Touches **§44** (refusal mechanism — its own text requires *"listing alternatives"*, which these three do not do) · **§52** (days gate, which DOES compute alternatives) · **§2** (weekly increase cap) · **§18/§10** (longest run ≤ weekly volume) · **§23** (peak overload) · **§40c** (name the lever) · **§106** (the `peakKmByLevel` precedent — *"every governance layer bypassed by a table being in the wrong place"*). **No principle governs these three numbers at all**, which is itself the finding.
>
> **📊 Measured before ruling** — marathon, finish goal, 3 days, first-timer, London 2027, engine called directly:
>
> | Stated weekly km | Peak week built | Net build | `validatePlan` errors |
> |---|---|---|---|
> | 5 | 47 km | **+262%** | **0** |
> | 12 | 47 km | +135% | 0 |
> | **15 (REFUSED by the route)** | 47 km | **+135%** | 0 |
> | **20 (PERMITTED by the route)** | 52 km | **+160%** | 0 |
> | 40 | 53 km | +61% | 0 |
>
> **🩹 Willy.** The concern is real and I will not have it deleted: a first-timer declaring 5 km a week is handed a block peaking at 47 km, **+262%**, and **`validatePlan` returns zero errors** — nothing downstream catches it. Remove this gate with nothing in its place and that ships.
>
> **🏃 Hutchinson (chair).** And yet the gate does not track the thing Willy is worried about. **It refuses 15 km/week at +135% and permits 20 km/week at +160%.** The rule is non-monotonic in the quantity that matters: the runner it turns away gets a *gentler* ramp than the one it lets through. A threshold that inverts its own purpose across its own boundary is not a safety rule, it is a number someone typed.
>
> **🎯 McMillan.** *"Build your base first"* to someone holding a London place is not coaching, it is a door. And we already know how to do this properly — §44 and §52 both hand back alternatives. This one hands back a full stop.
>
> **📊 Seiler.** No objection to a floor existing. Note only that the refused runner and the permitted runner receive the same 208-minute long run, so the gate is not protecting the long run either.
>
> **⚕️ Sims.** A first-time marathoner told to "build your base" with no plan will build it unsupervised, which is where energy availability and bone loading go wrong. §76's *"they will fill it by guessing"* applies exactly.
>
> **⚖️ RULING — CORRECT WITH AMENDMENT.** A floor is **correct**: +262% off a 5 km base must not ship, and nothing downstream catches it. The **current implementation is incorrect** on four counts: ungoverned, non-monotonic across its own boundary, offers no alternatives (violating §44's own text), and expressed on `current_weekly_km` rather than on the ramp it is trying to bound.
>
> ⚠️ **DO NOT SIMPLY DELETE THESE THREE LINES.** That is the trap, and Willy's number is why.
>
> **📦 Required artifacts — this is the P0 build, not a docs edit:**
> 1. **Principle** — a new `CoachingPrinciples` section owning the base-volume floor, expressed as a bound on **net build / ramp**, not on stated weekly volume. Must state the §44 obligation to return alternatives.
> 2. **Numeric** — the threshold moves into `GENERATION_CONFIG` so `configPrincipleSync` and `coaching-guard` can both see it.
> 3. **Invariant** — `validatePlan` must catch the +262% case. **It currently returns 0 errors on it**, so this is a live hole independent of where the gate lives.
>
> **↗️ SLT escalation:** one question only, and it is commercial, not coaching — **what a refused charity runner with an allocated place should be offered.** "Race the Half instead" is the governed §52 answer and is unusable for someone with a London Marathon place. Recorded under `REFUSAL-SCREEN-01`.

> ⚖️ **SLT — "what do we offer a refused runner who already has the place?" Escalated by the Coaching Board, sat 2026-09-18.**
>
> **The question, precisely.** §52 computes the governed alternatives — *"Race the Half at this event instead"*, *"Switch goal to finish"*, defer the race. **All three are unusable for this cohort.** The place is for the London Marathon, the charity allocated it, the date is fixed, and the goal is already `finish`. So the one screen where we refuse someone has three ratified answers and none of them apply.
>
> **🧠 Sutherland.** You are asking what to say instead of "no". The answer is **"not yet"**, and it is not a softening — it is more accurate. A runner refused in October has **twenty-eight weeks**. "No" describes their state today; "not yet" describes the same fact and leaves them inside the product. The refusal screen is currently the only place in this app that forgets we know what the date is.
>
> **📦 Fried.** And it needs no new feature. You already build foundation blocks. The honest screen says *here is what you do for now, and we will build the marathon plan when you are ready for it*. **That is using what exists, not inventing a ceremony.** I would object to anything bigger.
>
> **🔬 Wood.** This is the strongest version of the habit argument I made on the queue. A runner who gets a small, achievable thing in October forms the behaviour in the low-stakes window. A runner who gets a door forms nothing. ⚠️ **But the plan we hand them must not be a marathon plan wearing a hat** — if "not yet" quietly becomes "here is the marathon plan anyway", we have lied twice.
>
> **💰 Traynor.** Commercially this is the whole item. These 500 are comped, so there is no conversion to protect — **the asset is Make-A-Wish as a referral channel**, and the thing that damages it is a runner telling Jack the app turned them away. "Not yet, here is the path" costs nothing and is the difference between a complaint and a story.
>
> **🏃 Hutchinson.** Agreed in direction, and I am going to slow the build down. **A base-building block that leads into a marathon plan is PRESCRIPTION**, and it is not the thing we already have: `FOUNDATION_MAX_WEEKS` is **3**. A twenty-week ramp from 12 km/week to marathon readiness is a new plan type, not a longer foundation block. **That goes to my other board before a line is written.**
>
> **✅ RECOMMENDATION — BUILD DIFFERENTLY, in two parts, and only the first is cheap.**
> 1. **Now (copy, brand, no board):** the refusal becomes **"not yet"** and states the date arithmetic the app already knows — how many weeks remain, and what would make the plan buildable. **Ship this with `REFUSAL-SCREEN-01`.**
> 2. **Not now (prescription, Coaching Board first):** an actual base-building plan that leads into the marathon block. **`FOUNDATION_MAX_WEEKS` is 3 and this needs ~20.** Do not scope it as a foundation-block tweak.
>
> **🚨 MUST/NEVER.** No new modal (`ui-patterns.md`). No gamification of the "not yet" state. **And the screen must not promise a plan we have not built** — Wood's second point is a hard line: *"not yet"* may only be said if part 2 exists, otherwise the copy says what is true today and nothing more.
>
> **⚠️ Risk to existing features.** Part 2 touches `foundationCompose` / `FOUNDATION_MAX_WEEKS` (§92) and the §91 on-ramp credit; `foundationResize.test.ts` pins onset parity and must stay green.

> 🔴 **REFUSAL-SCREEN-01 — a deliberate coaching decision is presented as a crash.** *(P1. The actionable half of REFUSAL-THRESHOLDS-01 below. Belongs to FIRSTRUN-MARATHON-01 touchpoint 2.)*
>
> `GeneratePlanScreen.tsx:1176`. When the engine declines to build a plan, the runner gets:
> 1. **An amber headline: *"Something went wrong building the plan."*** Nothing went wrong. **Change this first** — it is one string, it is false, and it is the sentence that makes a considered refusal feel like a broken app.
> 2. **The raw engine string** — `"2 days/week is not enough for a MARATHON. Minimum is 3 days/wk; 4+ recommended."` Diagnostic copy: shouty caps, `days/wk`, no voice. Every *generated* note in this engine is written for a runner; this one was written for a log.
> 3. ***"Try again"*** as the only action, which implies a transient fault and returns to the wizard **naming no lever**. §40c governs every note the engine emits and is absent from the one screen where the runner receives nothing at all.
> 4. **No alternative.** A charity runner with a fixed race date and two available days is told no and offered nothing.
>
> **Scope, and what needs whose approval:**
> - **Copy + framing (headline, voice, naming the lever): brand, no board.** Do this now. The lever is already known at the refusal point — the engine's own message contains it.
> - **Offering an alternative distance ("a half fits what you have") is a PRODUCT decision → `/slt-review`.** It changes what we sell someone who came for a marathon, and for a charity runner with a place already allocated it may be the wrong answer entirely.
> - **Removing the refusal itself is a Coaching Board question**, not this item. See §44's `block` tier under `PREP-ACK-UNLOCKS-MARATHON-01`.
>
> **Verify when done:** generate a marathon at 2 days/week and read the screen out loud.

> ✅ **AUTH-BEARER-MISSING-01 — SHIPPED 2026-09-18.** Both bearer-less calls (`/api/generate-plan/foundation`, `/api/recalibrate-zones`) now use `authedFetch`; the three hand-rolled inline-bearer copies were folded onto the same helper (except `wizard-benchmark-estimate`, which keeps its bespoke getSession timeout). Guard `lib/supabase/authedFetchGuard.test.ts` fails the build on any bare `fetch('/api/…')` to an authenticated route. **The scan found a sixth site the table below missed — `wizard-benchmark-estimate` — already sending its bearer.** Original analysis kept for the record:
>
> 🔴 **two client calls hit authenticated routes with no token.** *(P1. Root cause candidate for FOUNDATION-ADD-FAIL-01, and one other feature is silently exposed.)*
>
> `getUserFromRequest` reads the `Authorization` header and **falls back to cookies** — and its own comment says `@supabase/ssr` cookie sync to the server is **unreliable**, which is why most call sites send the token explicitly. Checked all five bare `fetch('/api/…')` sites against their routes:
>
> | Call site | Route needs auth | Sends bearer |
> |---|---|---|
> | `GeneratePlanScreen.tsx:966` → `/api/generate-plan` | yes | ✅ explicitly |
> | `ReflectionInput.tsx:87` → `/api/post-run-reframe` | yes | ✅ explicitly |
> | `GeneratePlanScreen.tsx:1091` → `/api/generate-plan/foundation` | yes | 🔴 **NO** |
> | `DashboardClient.tsx:2190` → `/api/recalibrate-zones` | yes | 🔴 **NO** |
> | `WaitlistForm.tsx:22` → `/api/waitlist` | no | n/a, correct |
>
> **Two defects, and the second is not one anybody has reported.** `/api/recalibrate-zones` is **ADR-014's time-trial recalibration — a PAID feature** (`dynamic_reshape_r20`). If the cookie does not reach the server on native, a paid runner completes a time trial, confirms the recalibration, and it **401s**. Nobody has looked, because nothing surfaces it.
>
> **Fix:** both call sites use `authedFetch` (56 other sites already do). Then re-test the foundation add on device. **Add a guard** — a test that walks `app/` + `components/` for `fetch('/api/` and fails on any site whose route calls `getUserFromRequest` without an `Authorization` header, with `waitlist` allowlisted. The pattern is `signOutOwner.test.ts`.

> ~~🟡 **GTM-DECK-CORRECT-01 — the Make-A-Wish deck carries a false engine claim.**~~ 🔴 **WITHDRAWN 2026-09-18, SAME DAY. THE DECK WAS RIGHT AND I WAS WRONG. DO NOT CHANGE THE DECK.** See `MARATHON-VOLUME-GATE-01` below. Original text kept for the record:
>
> The deck states the engine refuses a marathon below 20 km/week or a 5 km longest run. **Measured false** — see REFUSAL-THRESHOLDS-01 below; every one of 42 volume × longest-run combinations generated. **Correct it before the deck is shown again or sent to Jack.** The true constraints are *fewer than 3 days a week* and *fewer than 10 weeks* — and the 10-week one cannot affect anyone who signs up on time for London 2027.
>
> ⚠️ **The wider lesson, worth more than the correction:** this claim came from a previous session, went into a partner-facing deck unverified, and was ~10 minutes of code-reading away from being caught. **An engine claim in a customer-facing document gets checked against the engine.**

> 🟡 **WIZARD-TIME-CHIPS-01 — the wizard's own time chips break the rule the notes now follow, and relabelling them silently breaks a saved draft.** *(P2. Found while fixing NOTE-DURATION-FMT-01; recorded in the feature registry and NOT filed here until now.)*
>
> ADR-015 locks the duration rule: under 60 reads `45 min`, at or above it reads in hours. `MAX_WEEKDAY_CHIPS` (`GeneratePlanScreen.tsx:116`) reads **`30 min · 45 min · 60 min · 90 min · 2 hrs · 3 hrs`** — a third convention: minutes past the hour for two values, then hours, and `hrs` rather than `h`. The plan notes were fixed on 2026-09-18; the input screen the runner meets *first* was not.
>
> 🔴 **It is not a one-line relabel, which is why it is filed rather than done.** The saved wizard draft stores the chip's **LABEL**, and restore matches on it: `MAX_WEEKDAY_CHIPS.find(c => c.label === maxWeekdayChip)?.value` (`:870`). Change a label and any in-flight `zona_wizard_draft` matches nothing, `?.value` yields `undefined`, and the runner's stated weekday cap **silently becomes "No limit"** — which then changes the plan they get. Same `??`-over-a-missing-value class this repo has now paid for four times.
>
> **Do:** make the draft value-keyed first, then relabel through `formatDuration`. **Verify:** save a draft on the old labels, deploy, reopen the wizard, confirm the cap survived.

> 🟢 **COPY-DAYS-PLURAL-01 — "1 days/week".** *(P3, one line.)* The days-gate message does not singularise: a runner who says they can run one day a week is told *"1 days/week is not enough"*. Fix while in REFUSAL-SCREEN-01.

> ⚠️ **REFUSAL-THRESHOLDS-01 — the claim that shaped the marketing deck is WRONG about the trigger and RIGHT about the consequence.** *(Checked in code 2026-09-18. Correct the deck before it goes further.)*
>
> **The claim** (from a previous session, carried into the Make-A-Wish deck): *"The engine refuses a marathon plan if someone's running under 20 km a week, or their longest recent run is under 5 km."*
>
> 🔴 **RETRACTED 2026-09-18 — THE CLAIM IS TRUE AND MY REFUTATION WAS WRONG.** I measured `generateRulePlan` directly, which **bypasses `app/api/generate-plan/route.ts`'s own `validate()` wrapper** (`:28`), called at `:92` **before** generation at `:128`. The route holds exactly the thresholds the claim described. **I verified the engine, not the path a runner takes.** The grid below is accurate about the ENGINE and says nothing about the app. Original, wrong, kept for the record:
>
> ~~FALSE. Measured, not read.~~ A 7 × 6 grid over `current_weekly_km` (5→40) × `longest_recent_run_km` (2→12), marathon, `finish` goal, 4 days, ~30 weeks out: **every single combination generated a 20-week plan.** 5 km/week with a 2 km longest run builds a marathon plan. **There is no volume threshold and no longest-run threshold anywhere in the refusal path.** (Both fields feed `fitnessThresholds` — which *classifies* a runner as beginner, e.g. `beginner_max_long_km: 8` — and a classification threshold is not a refusal. That is the likely source of the confusion.)
>
> ✅ **What ACTUALLY refuses a marathon, both verified by generating:**
> | Condition | Message |
> |---|---|
> | **Fewer than 3 days/week** | *"2 days/week is not enough for a MARATHON. Minimum is 3 days/wk; 4+ recommended."* |
> | **Fewer than 10 weeks of preparation** | *"9 weeks is not enough preparation for a MARATHON. Minimum is 10 weeks."* |
>
> **For this cohort:** the 10-week gate cannot bite anyone who signs up on time — London 2027 is 2027-04-25, so it only starts refusing around **mid-February 2027**, and codes go out in October. **The 3-day gate is the live risk**, and it is the `block` tier with **no acknowledgement path** — the open sub-question under the resolved `PREP-ACK-UNLOCKS-MARATHON-01`.
>
> 🔴 **AND THE CONSEQUENCE IN THE CLAIM IS EXACTLY RIGHT — the refusal screen is a bare error.** Read from `GeneratePlanScreen.tsx:1176`. A charity first-timer who can run two days a week sees:
> - **Headline, in amber: *"Something went wrong building the plan."*** ⚠️ **This is false.** Nothing went wrong. The engine made a deliberate, correct coaching decision and the screen reports it as a system failure.
> - **Body: the raw engine string** — `"2 days/week is not enough for a MARATHON. Minimum is 3 days/wk; 4+ recommended."` Diagnostic copy, shouty caps, abbreviations. Not the brand voice.
> - **One button: *"Try again"***, which returns to the wizard. It implies a transient fault and **names no lever** — §40c's own doctrine, which every *generated* note obeys, is absent from the one screen where the runner gets nothing at all.
> - **No alternative offered.** Not "run three days", not "a half marathon fits what you have", not "talk to your charity". A dead end with a fixed race date.
>
> **This is the "bounce off at the first attempt and never come back" case, and it is real.** It belongs to `FIRSTRUN-MARATHON-01` touchpoint 2. Minor defect while in there: the message reads **"1 days/week"**.


> ✅ **ONBOARD-SKIP-LABEL-01 — SHIPPED 2026-09-18.** The boolean `busy` became a pending-action enum (`'connect'|'skip'|null` / `'enable'|'skip'|null`) on both screens; the primary label keys on the specific action (`pending === 'connect' ? 'Connecting…'`), and the skip link shows a neutral "One sec…" while its own write runs. Guarded by `lib/onboarding/onboardingSkipLabel.test.ts` (walks the source, falsified). → feature-registry. Original analysis kept for the record:
>
> 🔴 **tapping "Connect later" tells you it is connecting. Same defect, two screens.** *(P1, analysed in code, reproduction is by inspection.)*
>
> **Root cause, `app/dashboard/DashboardClient.tsx`.** One `busy` flag serves two mutually exclusive actions, and the PRIMARY button's label is bound to the flag rather than to which action is running:
> - `ConnectRunsScreen` — `skip()` sets `busy = true`; the primary button renders `{busy ? 'Connecting…' : 'Connect Apple Health'}` (`:3063`). Tap **"Connect later"** and the screen says **"Connecting…"**.
> - `PushOnboardingScreen` — identical shape: `{busy ? 'Setting up…' : 'Enable Notifications'}`. Tap skip, it says **"Setting up…"**.
>
> **The database is correct in both cases** — skip writes `connect_runs_seen: false` and never sets `healthkit_connected_at`; the Me-screen row reads `healthkit_connected_at` and reports honestly. **This is a lie told for the duration of one tap, and it is told at exactly the moment a beginner is deciding whether to trust the app.**
>
> **Fix:** separate the pending action from the flag (`busy: 'connect' | 'skip' | null`), or disable rather than relabel. One owner, both screens. **Add a markup test** — `signOutLink.markup.test.ts` is the pattern; this is exactly the class it exists for.

> ✅ **FOUNDATION-ADD-FAIL-01 — SHIPPED 2026-09-18.** Cause (the missing bearer on the foundation call) fixed under AUTH-BEARER-MISSING-01; the observability half added — the route records a durable `plan_foundation_add_failed` ops event on its 500 path (was a bare server console.error), and the client catch console.errors instead of swallowing. Engine path proven clean, so a firing is now a real regression, and it leaves a trace. → feature-registry. **On-device re-test is the residual** (needs the founder's device). Original analysis kept for the record:
>
> 🔴 **"Add Foundation Block" fails, and the app records nothing about why.** *(P1. Blocks FIRSTRUN-MARATHON-01 touchpoint 5.)*
>
> Founder tapped **Add Foundation Block** on the plan-setup sheet and got *"Couldn't add that. Try again."*
>
> ✅ **The engine is NOT the cause — reproduced, not assumed.** Running exactly what `POST /api/generate-plan/foundation` runs (`resizeForDeferredFoundationAdd` → `composePlanWithFoundation(…, 'add')` → `enforceViolations`) on three shapes including **London Marathon 2027, first-timer, low base**: all return **200, 3 foundation weeks added, 0 error violations**. `enforceViolations` only throws in dev/test, so it cannot 500 production either.
>
> 🔴 **THE REAL DEFECT IS THAT THIS CANNOT BE DIAGNOSED.** `handleFoundationAddBlock` (`GeneratePlanScreen.tsx:1101`) is `catch { setFoundationAddStatus('error') }` — **no status code, no message, no console, no ops event**. The runner gets a generic string and we learn nothing. **Fix this first, regardless of cause**, or the next report is identical.
>
> 🔴 **SHARPENED 2026-09-18 — near-conclusive.** Its sibling `/api/generate-plan` call, 120 lines earlier in the same file (`:966`), is also a bare `fetch` **but explicitly attaches the bearer token**, with the comment *"cookie sync to server is unreliable with @supabase/ssr"*. The foundation call at `:1091` sends **no `Authorization` header at all**. Same file, same route family, one authenticates and one does not — and the route's `getUserFromRequest` returns null without a token unless the cookie happens to work. That is the asymmetry, and on native the cookie is exactly what is documented not to work.
>
> 🟡 **Context: the call is one of only FIVE bare `fetch('/api/…')` sites in the whole app against 56 `authedFetch` call sites** — and it hits a `getUserFromRequest` route. `getUserFromRequest` falls back to cookies, and `@supabase/ssr` cookie sync to the server is documented **unreliable on native** in that helper's own comment. The sibling `/api/generate-plan` call two hundred lines up is bare too and works for him, so this is a suspect, not a conclusion. The other bare sites (`/api/recalibrate-zones`, `/api/post-run-reframe`) are the same latent shape.
>
> **Do:** add the error detail, switch all four authed bare-fetch sites to `authedFetch`, then re-test on device.

> ✅ **FOUNDATION-DECIDE-LATER-01 — SHIPPED 2026-09-18 (SLT Fix A).** The "Decide later" button is deleted; the two byte-identical handlers (`handleFoundationStartNow` / `handleFoundationSkip`) are consolidated into one `handleFoundationDismiss` used by "Start plan as-is" and the sheet's onClose. Two honest options remain; dismissing = start as-is, no hidden deferred state. → feature-registry. Original analysis kept for the record:
>
> 🟡 **two of the three buttons do exactly the same thing, and "later" never comes.** *(P1, and the founder spotted both halves.)*
>
> The sheet offers **Add Foundation Block** / **Start plan as-is** / **Decide later**.
>
> **Proven by reading the handlers:** `handleFoundationStartNow` and `handleFoundationSkip` are **byte-for-byte identical** — `setFoundationAddStatus('idle'); setFoundationModalOpen(false)`. "Start plan as-is" carries a comment saying it "communicates user intent" and communicates it to nothing.
>
> 🔴 **And "Decide later" is a promise the app cannot keep.** `setFoundationModalOpen(true)` appears **exactly once** (`:992`), immediately after generation. There is no re-offer on the Plan screen, none on Me, no stamp that a decision is outstanding. Dismiss it and the choice is gone permanently. **A brand-voice violation as well as a UX one — honest is the first word in the voice rules.**
>
> **Fix:** drop the third button. Two honest options, and the sheet's own copy already frames it.

> ✅ **Marathon / ultra tier gating — NOT A BUG, and the capability question is already decided.** *(Answered 2026-09-18, no item.)*
>
> **Marathon and both ultras ARE paid.** `PLAN_SIGNATURES` sets `free_tier_available: false` for MARATHON/50K/100K; `isPaidDistance` reads it; the wizard flags the chips; `POST /api/generate-plan` enforces `canGenerateDistance` at `route.ts:114` with an **allowlist** (`tier === 'paid' || 'trial' || 'admin'`) so it fails closed.
>
> **Why it looked ungated:** the Option A **hybrid reverse trial gives every new user 14 days of full access**, and a charity grant resolves to `paid` via `resolveTier` — so no Make-A-Wish runner will ever meet this gate. The founder's own account is `admin`.
>
> **The capability question — should a first-timer be allowed to pick a marathon at all — was resolved by founder decision on 2026-09-17** (`PREP-ACK-UNLOCKS-MARATHON-01`): *"present them the facts and they tick 'I understand' … we shouldn't refuse people plans."* ⚠️ **The one piece still open is the `block` tier**, and it is now charity-relevant: see FIRSTRUN-MARATHON-01's blocker list.

---

#### 🤝 Make-A-Wish UK partnership readiness — filed 2026-09-18

Source: `docs/partners/make-a-wish-readiness-2026-09.md`, a code-and-live-systems audit of the proposal
(~500 runners, full paid access via the existing code flow, Oct 2026 → Apr 2027). **Verdict: CONDITIONAL
GO.** The product mechanism is ready and shipped. The two blockers are both infrastructure and cost $315
across the seven months combined.

> ⚠️ **Provenance, checked before filing.** `DEPLOY-QUOTA-01` already held the Hobby-vs-Pro decision
> (deployment quota). `STRAVA-APP-INACTIVE-01` already holds the Strava application. `APNS_PRODUCTION=1`
> is already recorded as set at item 5 of the Make-A-Wish critical path. None of those are re-filed below;
> `OPS-VERCEL-PLAN-01` is a **different argument** for the same decision and says so.

> 🔴 **OPS-VERCEL-PLAN-01 — Vercel Hobby is contractually non-commercial, and Zonna sells a subscription.** *(P0 BLOCKER, founder, filed 2026-09-18.)*
>
> Live check: `list_teams` returns `service-nerd's projects`, **`plan: "hobby"`**.
>
> Vercel's fair-use page: *"Hobby teams are restricted to non-commercial personal use only. All commercial
> usage of the platform requires either a Pro or Enterprise plan"*, and it defines commercial usage to
> include *"any method of requesting or processing payment from visitors of the site."* Zonna sells
> £7.99/month through RevenueCat. **The account is out of compliance today**, before any charity runner
> exists; a 500-person partnership raises both the visibility and the cost of enforcement, and the
> enforcement action is an account pause.
>
> ⚠️ **This is NOT the same item as `DEPLOY-QUOTA-01`.** That one is the 100-deploys-per-day cap, which is
> a capacity annoyance with a workaround (batch pushes). This is a terms breach with no workaround. They
> resolve together but only one of them is a reason you cannot decline.
>
> **Second reason, independent of the terms:** Hobby caps function duration at **60 s**; plan enrichment is
> measured at **28–35 s** in the code's own comment (`app/api/generate-plan/route.ts:234`), and **no route
> sets `maxDuration`**, so every route runs at the platform default. Pro raises the ceiling to 300 s.
>
> **Capacity is otherwise fine on Hobby** and that is worth recording so nobody re-derives it: at 500
> users, ~150k invocations/month against 1M, under 1 hr Active CPU against 4, ~40–70 GB-hrs provisioned
> memory against 360.
>
> **Fix:** Vercel Pro, $20/month. Also frees the 2-cron cap that forced six crons onto GitHub Actions.
> **Closes the open half of `DEPLOY-QUOTA-01`.**

> 🔴 **OPS-SUPABASE-PLAN-01 — Supabase Free breaks at ~250–320 active runners, and has no backups at all.** *(P0 BLOCKER, founder, filed 2026-09-18.)*
>
> Live check: organisation `zqxxahbsnzyouuwaugjv`, **`plan: "free"`**. Project `Zonna Run`
> (`wkppmpsvqkaxbekdgzdm`), `eu-west-1`, **15 MB used**, 26 auth users.
>
> **Storage, measured not guessed.** Per-row cost from `pg_total_relation_size ÷ rows` (so indexes and
> TOAST included): activities **4.3 kB**, run analysis 1.5 kB, completions 0.78 kB, health samples 0.62 kB,
> notifications 0.75 kB, weekly reports 6.5 kB, plans ~12 kB. A 28-week block at 4 runs/week comes to
> **~1.5 MB per runner**, 2.0 MB for a heavy trainer.
>
> | | 500 runners | 150 (30%) |
> |---|---|---|
> | DB size | **765 MB – 1.02 GB** | 240 – 315 MB |
> | vs Free's 500 MB | **1.5× to 2× over** | 48–63% |
>
> **Breaks at roughly 250–320 active runners.** Egress is second: ~3 GB/month estimated against a 5 GB
> allowance, so ~60% used at full redemption. Compute (shared CPU, 500 MB RAM) is third and least
> predictable. Auth MAU (526 of 50,000) and file storage (0 of 1 GB, no bucket in use) are not factors, and
> the pooler is not a factor either because the app talks PostgREST over HTTP rather than direct Postgres.
>
> 🔴 **The part that is already true, with no runners at all: Free includes NO backups and NO PITR**, and
> the project auto-pauses after 7 idle days. Taking 500 people's training data for a season on a plan with
> zero recovery point is the risk here, not the 500 MB.
>
> **Fix:** Supabase Pro, $25/month: 8 GB (10× headroom on the worst case), 250 GB egress, 100k MAU,
> dedicated Micro compute, **7-day backups**, never pauses.
>
> **Deliberately NOT doing first:** stripping `hrSamples` from `strava_activities.raw_payload` would cut
> the biggest table 30–40% (the derived columns `avg_hr`/`max_hr`/`hr_pct_z*`/`hr_bpm_histogram` already
> carry everything the app reads). It is the right lever **if storage ever binds on Pro**, and the wrong
> one now: the raw stream is what would let a zone recalibration re-bucket historic runs, which ADR-011
> §263 records as a live defect.

> 🔴 **LEGAL-PRIVACY-01 — the privacy policy understates what goes to Anthropic, and omits Resend entirely.** *(P1, founder + me, filed 2026-09-18. Must land before codes go out; a charity will read this page.)*
>
> **What the page says:** *"When you use the AI coaching features, session data is sent to Anthropic's API
> to generate a coaching response."*
>
> **What `lib/plan/enrich.ts → buildUserMessage` actually sends:** the runner's **first name**
> (`- Name: ${input.athlete_name}`, resolved server-side from `user_settings.first_name` at the auth
> boundary so it cannot be spoofed) and their **injury history**
> (`- Injury history: ${input.injury_history.join(', ')}`), alongside race, date, distance, goal, weekly
> volume, days available, fitness level and difficulty band.
>
> A first name + an injury history + a named race on a named date is **not anonymous**, and "session data"
> does not cover it. What is genuinely never sent is worth stating too, because it is the reassuring half:
> no email, no surname, no user ID, no date of birth, no auth token, no billing detail, and **not the raw
> per-second HR stream** (only derived summaries and zone percentages).
>
> **Second gap: Resend is an undisclosed processor.** `lib/email/resend.ts` sends the trial emails and
> receives the runner's **email address**. The third-party list names Supabase, Anthropic, Strava, Vercel
> and RevenueCat. Not Resend.
>
> ⚠️ **Do not fix this by softening the sentence.** Same trap as `TT-PRICING-CLAIM-01`: name what is sent.
>
> **Also decide while in there:** `/privacy` and `/terms` still carry a full Strava section, including "your
> Strava access token is stored" and a cookies line about a Strava session token, while the Strava screen is
> admin-URL-only and the application is Inactive (`STRAVA-APP-INACTIVE-01`). Accurate *if* a runner ever
> connects; unreachable in practice. One clause settles it.

> 🔲 **GTM-CHARITY-05 — `admin_user_tiers` does not know charity grants exist, so 500 comped runners will read as free.** *(P1, me, filed 2026-09-18.)*
>
> `lib/trial.ts → resolveTier` is documented as **the single owner** of
> `admin → subscription → grant → trial → free`, and its header comment exists precisely because that order
> once lived in three places and drifted. The Supabase view `admin_user_tiers` is a **fourth copy**, and its
> `CASE` stops at `admin → subscription → trial → free`. It never reads `charity_codes`.
>
> **Consequence at 500 runners:** every comped runner reads `free` or `trial` in every admin and reporting
> surface, and `v_trial_conversion` (which is `LEFT JOIN subscriptions` on anyone with a `trial_started_at`)
> counts them as unconverted trials, which will make trial→paid look worse than it is for a whole season.
> `v_paying_users` counts `tier = 'premium'` and is unaffected.
>
> **Fix:** add the grant arm to the view, between subscription and trial, matching `resolveTier` exactly.
> **This is D-16 again** (no parallel semantics), so the fix should also answer why a SQL view is allowed to
> restate a rule the codebase says has one owner — either it reads a shared source, or it carries a comment
> naming `resolveTier` as the thing it must track.

> 🔲 **GTM-CHARITY-06 — there is no per-partner reporting, and only one analytics event exists in the whole app.** *(P1, me, filed 2026-09-18.)*
>
> The partnership will be asked "how did it go". Today nothing can answer it.
>
> - `lib/analytics.ts` declares **exactly one** event name: `coach_open`. That union is the documented
>   source of truth, so that is the entire behavioural dataset (90 rows).
> - The six admin views (`admin_user_tiers`, `admin_user_directory`, `v_paying_users`,
>   `v_trial_conversion`, `v_hr_present_pct`, `v_coach_engagement`) **none of them join `charity_batches`**.
> - `ops_events` is operational telemetry, not product analytics.
>
> **All six metrics asked for ARE derivable** from existing tables: codes redeemed, plans generated, weekly
> active, HealthKit-connected, sessions logged, against the batch cap. Smallest change is one view
> (`v_partner_cohort`, ~30 lines, drafted in full in the brief).
>
> ⚠️ **Two honesty caveats that must ship WITH the view, not after it.** "Weekly active" would be
> `auth.users.last_sign_in_at`, which is a **sign-in, not an app open** — there is no app-open event to
> count. And `healthkit_connected_at` records that the permission sheet was accepted, which iOS does not let
> the app distinguish from a silent denial, so it is an **upper bound**. Reporting either number to a
> partner without its caveat is the overclaim class this repo keeps catching.
>
> **Depends on `GTM-CHARITY-05`** if the view is to carry a tier column.

> 🔲 **GTM-CHARITY-07 — deleting an account returns a claimed code to the unclaimed pool.** *(P2, me, filed 2026-09-18.)*
>
> `charity_codes.claimed_by` is `ON DELETE SET NULL` (verified against production `pg_constraint`). Deleting
> an account nulls it while leaving `claimed_at` and `expires_at` populated. `/api/charity/redeem` gates
> only on `row.claimed_by`, so **the code becomes redeemable again by anyone who has it**, and the batch's
> redemption count silently drifts downward.
>
> Low likelihood, two real consequences: a small abuse path (redeem, delete, re-redeem), and reporting that
> understates redemption over a season.
>
> **Not obviously a `CASCADE`** — deleting the code row would destroy the batch's own record that a seat was
> used. More likely: keep the row, add a `released_at` or a `claim_state`, and have the redeem route treat
> a previously-claimed row as spent. **Decide the semantics before writing the migration.**
>
> ⚠️ Same sweep should cover `ai_rate_limits`, whose `bucket_key` is text (`ai:<route>:<userId>`) with no
> FK, so a row containing a user ID survives account deletion until its window rolls. Minor, but it is a
> user identifier persisting past a deletion the privacy policy calls permanent.

> 🔲 **GTM-CHARITY-08 — mint and field-test the 500-code batch, and fix the redeem-before-distance ordering in the charity's instructions.** *(P1, founder, filed 2026-09-18.)*
>
> **Mint:** `npx tsx scripts/mint-charity-codes.ts "Make-A-Wish UK" 500 --notes "London 2027 · race 2027-04-25" > mawuk-codes.csv`
> (script hard-caps at 1000; progress goes to stderr so the redirect captures only codes).
>
> ⚠️ **Redeem the test code on a NON-ADMIN account.** `getUserTier` resolves `admin → paid` before it ever
> reaches the grant, so redeeming on an admin account looks identical whether the grant landed or silently
> failed. `scripts/check-charity-code.ts` reads the row directly, which is the only check that means
> anything. (This is the same shape as the RevenueCat webhook defect that acknowledged events and wrote
> nothing.)
>
> 🔴 **The ordering problem, which is a wording fix not a code fix.** "Have a charity code?" sits on step 1
> of the wizard (`GeneratePlanScreen.tsx:1527`). A runner who taps **Marathon** first meets a PAID lock and
> is routed to Upgrade. The redeem link is on that screen too so the path recovers, but **the first thing a
> Make-A-Wish runner would see is a paywall.** The charity's instructions must say to tap the code link
> *before* choosing a distance. Three-step runner wording is drafted in the brief, section I.
>
> **No batch-level expiry exists, and that is fine here** — every runner in this cohort shares a race date,
> so re-anchoring gives each of them 2027-05-02 (race + 7) automatically on first plan save. A runner who
> redeems and never builds a plan lapses at 90 days, which is the intended outcome. Adding a batch expiry
> (~half a day: nullable column, `min()` in two pure functions, two tests) would only ever cut someone off
> **earlier** than race day, which is the exact failure the grant design exists to prevent. **Do not build
> it for this partnership.**
>
> **Founder verifications owed before codes go out** (all outside the repo, none checkable from here):
> App Store Connect — is `1.9.1` build 15 actually live? · Vercel env — is `APNS_PRODUCTION=1` set? (item 5
> of the critical path records it as set; nothing here can confirm it, and if it is wrong **every push
> silently fails for the whole cohort**) · Supabase Auth — reset-password template + `/auth/reset` redirect
> (the device test is still owed, `UX-AUTH-03`) · Anthropic Console — set a spend alert
> (`OPS-AI-SPEND-01`).
>
> ⚠️ **Minimum iOS is 16.6**, which excludes iPhone 7 and older. In a cohort of 500 a handful cannot install
> at all, and there is no Android build and no mobile-web fallback for the dashboard. Worth telling the
> charity rather than discovering it in the support inbox.

> 🔲 **GTM-CHARITY-09 — support for 500 runners is one email inbox.** *(P2, founder decision, filed 2026-09-18.)*
>
> The entire support surface is `support@zonna.run`: an in-app pre-filled email (Me → Support, free for all
> tiers, with a copy-address button), the `/support` page, and the same address in `/privacy` and `/terms`.
> No live chat, no ticketing, no help centre, **no in-app FAQ**.
>
> That has been correct at 26 users. 500 runners arriving as a single cohort, most of them first-time
> marathoners, is a different shape: they will arrive together, hit the same few questions (code won't
> redeem, no HR data, why is my plan so easy), and they will arrive at the charity too if the app is slow to
> answer.
>
> **Not necessarily a build.** The cheapest version is a short partner-facing FAQ the charity can send with
> the codes, covering exactly the questions this audit predicts. Decide which.

> 🔲 **SEC-15 — `/api/weekly-report` is the only AI route with no rate limiter.** *(P2, me, filed 2026-09-18.)*
>
> Eleven of the twelve AI routes call `guardAiRequest` or `enforceAiRateLimit`. `/api/weekly-report` calls
> neither, and it is a **Sonnet** route. It is authenticated and tier-gated on `activity_intelligence`, so
> it is not an open door, but it is the one path where a client loop could run Sonnet with no per-user
> ceiling.
>
> Add `enforceAiRateLimit(user.id, 'weekly-report')` after the tier gate. It takes no body, so the
> rate-limit-only guard is the right one (same shape as `daily-coach-note`).
>
> ⚠️ **Related, and NOT a bug to fix:** `checkAiRateLimit` **fails open** by design — an RPC error or an
> unreachable DB allows the request, because a false denial breaks the product while a brief limiter outage
> has bounded exposure. That trade is documented and correct. It does mean the limiter is not a hard cap,
> which is why `OPS-AI-SPEND-01` exists.

> 🔲 **OPS-AI-SPEND-01 — nothing in the app records token usage, so there is no spend visibility at all.** *(P2, founder + me, filed 2026-09-18.)*
>
> Grepped every AI call site: **not one reads `response.usage`.** No `input_tokens`, no `output_tokens`, no
> per-user or per-route accounting anywhere. The Anthropic Console is the only source of truth, and nothing
> in the repo can reconcile against it.
>
> The estimate in the brief (**~$2.40/runner over seven months; $1,200 at 100% redemption, $360 at 30%**) is
> therefore derived from prompt-file sizes and the literal `max_tokens` at each call site, **not measured**.
> It is almost certainly the right order of magnitude and it is not a reason to hold the partnership: AI cost
> per comped runner is under one month's subscription. But nobody can currently answer "what did it actually
> cost" without opening a browser.
>
> **Cheapest useful version:** a founder-set spend alert in the Console (minutes, no code). **Next
> increment:** persist `usage` into `ops_events` on the two Sonnet paths that dominate the recurring spend
> (post-run reframe and weekly report, together ~40% of the per-runner total). Do not instrument all twelve.

> ✅ **PLAN-RUNWAY-CHARITY-01 — ANSWERED 2026-09-19. Here is the shape, generated.** *(was P1. The measurement is done; what it FOUND is now the open item.)*
>
> Codes out **2026-10-05**, London **2027-04-25** = **29 weeks of runway**. Every runner who gets a plan gets the same shape:
>
> | cwk | longest | outcome | main weeks | foundation | **UNCOVERED** | peak | profile |
> |---|---|---|---|---|---|---|---|
> | 10 | 5 | 🔴 **REFUSED** (§111) | — | — | — | — | — |
> | 12 | 5 | built | 20 | 3 | **6** | 47 | maintenance |
> | 16 | 6 | built | 20 | 3 | **6** | 47 | maintenance |
> | 20 | 8 | built | 20 | 3 | **6** | 62 | build |
> | 30 | 12 | built | 20 | 3 | **6** | 65 | build |
>
> 🔴 **SIX WEEKS UNCOVERED, FOR EVERY ONE OF THEM.** The engine uses 23 of the 29 weeks (`FOUNDATION_MAX_WEEKS` is 3). A runner redeems a code in October, generates a plan, and then waits **a month and a half** before it starts. That is the window the charity's stated pain lives in — people who take a place and never run it — and the product currently has nothing in it.
> This is Sutherland's recorded point, now with a number against it: *"Oct to April is twenty-eight weeks… the foundation block is not touchpoint 5. It is the product."*
>
> ⚠️ **And the lowest-volume runners are refused outright**, which is the §111 chain. **The two findings compound: the cohort most at risk of dropping out gets either nothing, or six empty weeks followed by a plan labelled `maintenance`.**
>
> Codes go out ~Oct 2026 for a late-April 2027 race: **~26 weeks of runway**. Marathon plan length maxes at
> **20 weeks** (`PLAN_SIGNATURES.MARATHON.max_weeks`) and the foundation block adds at most **3**
> (`FOUNDATION_MAX_WEEKS`). So a runner starting immediately gets ~23 covered weeks and **2–3 uncovered**,
> which crosses `FOUNDATION_UNCOVERED_WEEKS_NOTE_THRESHOLD: 2` and surfaces the uncovered-runway note. A gap
> over 28 days (`FOUNDATION_GAP_AUTO_DAYS`) routes through the **deferred** foundation decision rather than
> auto-generating.
>
> **This is the exact shape all ~500 of them will hit, and it is not in any harness.** The charity personas
> and the cohort grid do not pin a 26-week runway against a 20-week cap. `verify:parity` pins `plan_start`,
> so it contains **no pre-plan-runway cases at all** and was already documented as structurally blind to
> FOUNDATION-LONG-RUNWAY-01.
>
> **Do:** generate one on a comped non-admin test account with an October start and 2027-04-25, then read
> the runner-facing note out loud. Not "does it validate" — `verify` already says yes. **Does the runway
> note read like something a first-time marathoner would act on**, and does the deferred foundation decision
> present sensibly on device.
>
> **Prep-time thresholds for reference, because the numbers differ from the plan-length ones:** marathon
> refuses below **10** weeks (12 for a returning runner), warns below 16 **on a time goal only**. A finish
> goal at 10–15 weeks generates with no friction. `PLAN_SIGNATURES.min_weeks` is 14 and is **not** the
> refusal threshold — it governs construction length. Nobody meets 14.

> 🔲 **TIER-TRIAL-CONFIDENCE-01 — the 14-day reverse trial is not literally full access.** *(P2, me, filed 2026-09-18. **Does not affect Make-A-Wish**; filed because the marketing claim is repo-wide.)*
>
> `canUseFeature('confidence_score', 'trial')` returns **allowed**. `lib/plan/enrich.ts:226` sets
> `wantPaidFields = tier === 'paid'`, and a trial resolves to `'trial'`. So **a trial user never receives
> `confidence_score`, `confidence_risks` or `coach_intro`** — the gate layer and the engine layer disagree,
> and the engine wins.
>
> ✅ **Charity grants resolve to `'paid'`, so comped runners DO get it.** Verified in `resolveTier`; pinned
> by `distancePaywall.test.ts` for the adjacent distance case.
>
> Why it still matters: the reverse trial is described everywhere as full access for 14 days, and on this
> one feature it is not. Either `enrich` should read `tier !== 'free'` (matching every other paid gate in
> the codebase) or the trial's description should stop saying everything.
>
> ⚠️ **`pricing.test.ts` cannot catch this** — it proves every PAID gate has a ROW on the pricing page. It
> cannot check that the row is reachable by everyone the page implies. Same blind spot as
> `TT-PRICING-CLAIM-01`, second instance, and worth noting as a pattern rather than a one-off.

---


> ✅ **PLAN-WEEK-COLLISION-01 — SHIPPED 2026-09-18. A brand-new plan arrived 94% already completed.**
>
> `week_n` is a WITHIN-PLAN coordinate that five tables used as a cross-plan key. A new race plan restarts
> `week.n` at 1 and inherited the previous plan's rows. **Measured: a fresh 12-week 10K arrived with 44 of
> 47 sessions (94%) complete or skipped, five linked to runs from five months earlier.**
>
> ⚠️ **The recommended fix was wrong and was withdrawn before it shipped.** Continuing the week sequence
> (ADR-013's own mechanism for the maintenance handoff) would have pushed foundation weeks — numbered
> NEGATIVE — positive, and the engine uses `w.n > 0` as its main-plan guard in the taper and peak passes.
> A display defect would have been fixed by shipping a coaching one.
>
> Resolution: nullable `superseded_at`, stamped on a race-identity change. **Marked, not deleted** — the
> trend card, discipline ledger and `v_coach_engagement` aggregate across plans. 45 reads filtered;
> run-keyed reads deliberately not, because `run_analysis` is `UNIQUE (user_id, apple_health_uuid)`.
> Record: `docs/incidents/2026-09-18-plan-week-collision.md` · ADR-013 amended · → feature-registry.
>
> 🔲 **ONE FOLLOW-ON, open.** A race-DATE change counts as a new race identity, so a runner **deferring
> their race** supersedes their whole history and starts from an empty plan. That is correct for the
> collision and arguably wrong for the runner: their completed sessions to date are still theirs. Decide
> whether a deferral should carry its completions forward. **Affects the charity cohort directly** — a
> London Marathon place moved by a week would trigger it.

> 🔲 **PLAN-CONCURRENCY-01 — plans are archive-and-overwrite, not two separate entities.** *(P3, founder-requested park, filed 2026-09-18.)*
>
> **Founder decision 2026-09-18: ONE plan at a time is fine for now. Parked deliberately, not deferred by neglect.**
>
> `PLAN-WEEK-COLLISION-01` fixed the BEHAVIOUR — a new plan now inherits nothing from the old one, and the
> old one's completions, analyses, reports, reshapes, overrides and reflections are all preserved. What it
> did not change is the STRUCTURE: `plans` is still one row per user (`onConflict: 'user_id'`), and the
> previous plan lives in `plan_archive` as a read-only snapshot.
>
> **What that means concretely:** you cannot switch back to a previous plan, and Plan History cannot show
> "plan one, with its sessions" — the superseded rows carry a timestamp, not a link to the archive row that
> owns them.
>
> **This is the multi-plan concurrency ADR-013 explicitly deferred**, in its own Follow-ons: *"If true
> multi-plan concurrency is ever needed, revisit the `plan_id`-scoped-completions migration (the rejected
> alternative)."* ⚠️ **Read that line carefully before picking this up** — the same Follow-ons note is what
> covered the transition that produced the 94%-pre-completed defect. A rejection that was correct for the
> case in front of it is not a rejection for every case.
>
> **Shape if it is ever built:** `plan_id` on `plans` (it has none today), the same column on the seven
> week-keyed tables, `superseded_at` retired in its favour, and a plan picker. Large — a migration across
> seven tables plus every read and write site. **Do not start it without a reason beyond tidiness.**

#### 💷 Cost, resilience and unit economics — filed 2026-09-18 (second pass)

From a founder cost review of the Make-A-Wish grant: *what does it cost per month, and what happens if
the Anthropic credit runs out mid-block?* Tracing the failure path found one real defect and three gaps.

> ⚠️ **Provenance:** `session_reflections`, `weekly-free-insight`, `MIN_LOGS`, "commission" and
> "auto-reload" each return **zero** hits across `backlog.md` and `roadmap.md`. The eleven existing
> `reframe` entries are all REFRAME-02 (voice input) or the risk gate; none touches persistence. Nothing
> below is a re-file. `OPS-AI-SPEND-01` is adjacent to `OPS-AI-FAILURE-ALERT-01` and the two are
> deliberately separate — one is *what did it cost*, the other is *did it work*.

> 🔴 **REFRAME-NOTE-LOSS-01 — the runner writes a reflection, the AI call fails, and their words are thrown away.** *(P1 DEFECT, me, filed 2026-09-18.)*
>
> `app/api/post-run-reframe/route.ts:505`:
>
> ```ts
> if (!reframeText) {
>   return NextResponse.json({ reframe: null, tier: dataTier, fallback: true }, { status: 200 })
> }
> // Persist          ← never reached
> ```
>
> `note_text: userNote` is written **only** in the upsert below that early return. So on any path where
> `reframeText` is null, the runner's own writing is discarded. The client
> (`components/training/ReflectionInput.tsx:108`) then does `setView('input')` with **no message**: the
> screen returns to an empty box and nothing says why.
>
> 🔴 **The route already knows this is wrong, and says so.** Three hundred lines earlier, the risk-gated
> path persists the note with this comment:
>
> > *"Persist a silenced row — the runner's note is sacred even when we don't reframe."*
>
> Same route, same table, same field, opposite behaviour. The principle is written down and then broken by
> the branch next to it.
>
> ⚠️ **This is NOT only an outage case.** `reframeText` stays null three ways, and only two are failures:
> 1. `!aiRes.ok` — credit exhausted, rate limit, API error.
> 2. `fetch` throws — network.
> 3. **`BAD_OUTPUT_RE.test(cleaned)`** (line 62: `amazing|crushing|smash|beast mode|you've got this|crushed|don't give up`). **The model answered, we were billed, the output was rejected for cheerleader words, and the runner still loses their note.** That fires in normal operation.
>
> **How often is unmeasured** and should be the first thing established: a reflection that reached the
> route but has no `session_reflections` row is invisible by construction, so nobody would ever report it.
>
> **Fix:** move the upsert above the early return and write the note with `reframe_text: null`, mirroring
> the silenced path exactly. Then give the client something to render other than an empty box.
> ⚠️ **`fix-test-check.py` will ask for a regression test and it should** — this is precisely the silent
> class where there is no symptom to notice next time.

> 🔲 **OPS-AI-FAILURE-ALERT-01 — every AI failure is silent to the OPERATOR as well as the runner.** *(P2, me, filed 2026-09-18.)*
>
> Every one of the twelve AI routes uses the same shape: `if (aiRes.ok) { use it } catch { silent
> fallback }`. That is correct design (ADR-006 — the deterministic engine always succeeds, AI is
> enrichment) and it should not change. **The gap is that nothing tells you it is happening.**
>
> `ops_events` records `plan_enrich_failed` for the generation path only. The other eleven routes log to
> `console` and return a fallback. With 500 comped runners mid-block you could serve the rule-engine
> version of the product for days, and **no runner would report it** (nothing looks broken) and **no
> dashboard would show it**.
>
> **Distinct from `OPS-AI-SPEND-01`**, which is about token accounting and cost. This is about knowing the
> coaching layer is degraded. A run of `api_error` responses is also the *earliest* signal that the credit
> balance is gone, which is what makes it worth having before the partnership starts.
>
> **Smallest useful version:** record an ops event on the non-ok branch of the two or three highest-traffic
> routes (daily note, run analysis, reframe) and surface a count in the existing daily digest. Do not
> instrument all twelve.

> 🔲 **OPS-ANTHROPIC-CREDIT-01 — enable auto-reload on the Anthropic account before codes go out.** *(P1, founder, XS, filed 2026-09-18.)*
>
> The API runs on a prepaid balance. At zero, Anthropic returns a non-2xx, `aiRes.ok` is false everywhere,
> and every AI surface silently degrades to rule-engine output for **all 500 runners at once**.
>
> ✅ **Nothing breaks, and that is worth stating plainly:** plans still generate, reshapes still apply, run
> scoring still works, Apple Health still syncs. The engine never calls Anthropic. What is lost is the
> written voice — plus `REFRAME-NOTE-LOSS-01` above, which is the one place a runner actively loses
> something.
>
> **But it would be a broken promise**, not a broken app: Make-A-Wish is being told "full access including
> AI enrichment", and the quiet version is close to the free tier.
>
> **Do:** turn on auto-reload at [platform.claude.com/settings/billing](https://platform.claude.com/settings/billing)
> and load **£900** (the central estimate for 7 months at 100% redemption; range £560–£1,870). Pair with
> the spend alert in `OPS-AI-SPEND-01`. A balance that *can* reach zero is the only version of this problem
> that exists; auto-reload deletes it.

> 🔲 **FIN-APPLE-COMMISSION-01 — Apple's cut is modelled nowhere, so every unit-economics number in the repo is 15% optimistic.** *(P2, founder + me, filed 2026-09-18.)*
>
> `lib/brand.ts → BRAND.PRICING` carries £7.99/month and £59.99/year **gross**. Grepped
> `monetisation-strategy.md` and `brand.ts`: **zero** mentions of commission, 15%, or 30%.
>
> Under Apple's Small Business Program (under $1M/year) Apple takes **15%**, so net is **£6.79/month** and
> **£50.99/year**. Above $1M it becomes 30% and net drops to **£5.59/month**.
>
> **What this touches:** `GTM-11 — pricing review` (currently reasons about £7.99 vs £9.99 on gross),
> every payback and break-even calculation, and the trial→paid economics the roadmap gates Apple Search
> Ads on. Traynor's *"kill in ~90 days if trial rate is ~0"* threshold is being judged against a number
> that is 15% too high.
>
> **Not necessarily a code change.** `BRAND.PRICING` should stay gross — that is what the runner is charged
> and what the App Store displays. The fix is a documented net figure wherever the business reasons about
> revenue, and a note on the pricing review that the £2 gap between £7.99 and £9.99 is really **£1.70**
> after Apple.
>
> ⚠️ **Also unmodelled: the annual plan.** At £59.99 the net is £50.99, or **£4.25/month** — cheaper than
> the monthly net and a 37% headline discount that is closer to **46%** against monthly net revenue.

> 🔲 **GTM-FREE-HOOK-01 — the free tier's only AI touchpoint is unreachable by the users it is meant to convert.** *(P2, SLT question, filed 2026-09-18.)*
>
> Traced while costing the free tier. A free user can reach **exactly one** AI surface: the weekly free
> insight. To see it they must satisfy all three of:
> 1. open the **Coach** screen (`CoachTeaser` fetches on view),
> 2. have logged **2+ sessions with an RPE** in the last 7 days (`MIN_LOGS_TO_QUALIFY = 2`,
>    `SESSION_WINDOW_DAYS = 7`), and
> 3. not be risk-gated.
>
> And free users get **no daily push** (`send-daily/route.ts:225` — `if (tier === 'free') skip`).
>
> **So the one thing that might pull a lapsed free user back requires them to already be back, logging
> consistently, and to go looking for it.** The cohort it can reach is the cohort least in need of it.
>
> **The cost argument is on the other side.** Measured this session: a free user costs **~$0.003 per
> insight**, capped at one per week by the `(user_id, week_start_date)` cache. 500 free users is **under
> $2/month** even at full engagement. There is no cost reason for the gate.
>
> **SLT question, not a build:** is the 2-log gate protecting output quality (a real concern — a model
> writing about nothing produces the cheerleader copy `BAD_OUTPUT_RE` exists to catch), or is it
> suppressing the only re-engagement loop the free tier has? **Measure before changing it:** how many free
> users hit `state: 'insufficient'` versus `state: 'insight'`. That number is not currently recorded, which
> is itself part of `GTM-CHARITY-06`.
>
> ⚠️ **Does not affect Make-A-Wish** — comped runners resolve to `paid` and never see this path. Filed
> because it is a live conversion question for everyone else.

> 🔲 **TT-PRICING-CLAIM-01 — `/pricing` sells the race projection as coming from "your real running". On 58% of plans there is none.** *(P2, filed 2026-09-17. **SLT escalation from the Coaching Board** — Hutchinson carried it up: the board rules on correctness and cannot rule on a marketing claim.)*
>
> **The claim**, `lib/marketing/pricing.ts`: *"What you are actually on for — a projected finish from your real running, updated as you train. No vanity numbers."*
>
> **Measured on the live database:** 11 of 19 plans (58%) carry no benchmark, so the estimate comes from two wizard answers and a derivation, not from running. State 4 is also **static by design** (the route's own comment: *"no R31/R32 — static estimate, can't show improvement"*). So on the majority path all three clauses fail: not from real running, not updated as you train, and the third is arguable.
>
> ⚠️ **`pricing.test.ts` passes throughout and always will** — it enforces that every PAID gate has a ROW on the pricing page. It cannot check whether the row is TRUE. The guard held while the claim rotted, which is worth knowing about every claim on that page, not just this one.
>
> **Traynor blocked the cheap fix** and the block should be recorded: do NOT quietly soften the copy so the derivation qualifies. That is writing the marketing down to meet the product. Either the majority path delivers something closer to the claim, or the claim names the states it applies to.


> 🔲 **PLAN-NOTE-PLACEMENT-01 — does the plan rationale belong at the TOP of the Plan screen at all?** *(P2, filed 2026-09-17 by the SLT. Deliberately NOT bundled with PLAN-NOTE-VOICE-01.)*
>
> **Wood's argument:** a runner asks *"why is my long run short?"* in week 3, when the long run feels short. Not on day one. Putting the answer at the top of the plan on day one hands someone who has just committed a list of things their life prevents, in our warning colour. Context beats motivation, and that context says "here is what you cannot do".
>
> **Why it was held, not actioned:** the 254-word version is what made the argument feel obvious, and it no longer exists (mean is now 67 words, one tile). Sutherland and Fried both wanted one tile kept where it is. **See the shortened version on device before deciding** — this is a placement question and it deserves its own decision, not a bundled one.
>
> **What would settle it:** evidence that runners act on the lever early (keep it on day one) versus go looking for the explanation later (move it behind the question).


> 🔲 **TT-FREE-BENCHMARK-01 — a free runner is prescribed a benchmark whose result they cannot apply.** *(P2, filed 2026-09-17 out of the TT-STRUCTURE-01 investigation. **SLT question, not a defect** — the copy half is already fixed.)*
>
> **Measured:** the §78 recalibration time trial is placed on **both** tiers — `free → recalibration_weeks: [8]`, `paid → [8]` on identical input. Applying the result is PAID (`dynamic_reshape_r20`, ADR-014), so a free runner runs a maximal 5K measurement and the paces it exists to refresh never move.
>
> **Not obviously wrong.** CLAUDE.md’s rule is *gate richness, never gate access*, and a runner who knows their fresh 5K time has something real even if the engine will not rewrite around it. `RecalibrationTile` already says so honestly, and TT-NOTE-HONESTY-01 stopped the coach note promising otherwise. So nothing currently **lies** to a free runner — this is a question about whether prescribing it is the right product call.
>
> **The three options, for the SLT:** (a) leave it — the measurement has standalone value and the tile is the upgrade moment; (b) let free runners apply the result once per plan — the recalibration is a pure function, the cost is real but bounded; (c) stop placing the trial on free plans — cleanest, but removes a genuinely useful session and weakens §78 for the tier that most needs a reality check on pace.
>
> **Do not "fix" this by deleting the trial from free plans without the SLT** — §78 exists because a stale VDOT propagates for a whole plan, and that is worse for a beginner than for anyone.


> ~~`S52-LOPSIDED-BOUND-01`~~ — ✅ **CLOSED 2026-09-19 — the eleventh instrument was built, measured and REVERTED, and its failure is ARITHMETIC not ordering.** A post-pass re-applying §114's share bound against the FINISHED week (placed correctly on the third attempt, after V1/V4/§47 Am.2/§6 Am.2). **Shortening the long run also shortens the week, so the share is a fixed point:** at 3 days with a 30-min weekday cap the week is `lr + 7.2`, so ≤60% requires a **10.8 km marathon long run**. Measured: worst share 78%→72%, affected plans 287→280 of 899, while the **injury cohort's median marathon peak long run fell 61.6%→52.1% of race distance** (~4 km off a knee-history runner's longest run). Reverted; `measure:fitness` back at baseline exactly. Residual declared under §34; `lopsidedNote` already names the real lever (the other days). **Do not propose a twelfth.** See CoachingPrinciples §52 *Recorded finding*.
> 🔲 `S24-FLOOR-REACHABILITY-01` **(P2, board)** — the last 1.2 km on marathon time goals.
> ✅ **2026-09-19 — `GRID-MARATHON-CAPABLE-01`, `MAINT-LIVENESS-01`, `STEPBACK-STALE-PEAK-01` and `INV-MSG-ROUNDING-01` all SHIPPED.** `LR-CONSEC-01` is **superseded** — §45 was blind to compounding because nothing bounded the long run against the week, and that is now §9's recorded structural finding, not a separate item. `LR-DELOAD-RESUME-01` remains record-only.
>
> ~~`PEAK-VS-DELIVERED-BUILD-01`~~ — ✅ **CLOSED 2026-09-19 — WITHDRAWN, not a defect. §23 already legislates this exact case.** §23's own text: *"most common when `current_weekly_km` is already close to the per-fitness-level target peak — there's nowhere to ramp to"*, and it prescribes the remedy (classify `maintenance`, carry a `volume_constraint_note`, run the plan). **Measured: of 15,464 plans under the 110% ratio, 15,464 are classified maintenance AND carry the note — 100%.** The item was filed on the premise that falling under 110% is a failure; §23 says it is a licensed, labelled outcome. Also withdrawn: my first reading that the peak CEILING was broken — with open inputs (5+ days, no weekday cap) an experienced 70 km/wk marathoner peaks at exactly 80 = `PEAK_KM_BY_LEVEL.MARATHON.experienced`, and §106's floor holds. The low build ratio is delivered WEEK 1 being anchored to a runner already running 70. ⚠️ **Willy's §106 condition was never tested because nothing needed changing** — raising `PEAK_FLOOR_VS_START_RATIO` above 1.0 would scale the ceiling off self-reported volume, which he would veto. Dissolved at the conflict scan, before any seat spoke. *(original filing below.)* **~~NEW, FOUND BY THE WIDENED GRID (P1, Coaching Board).~~** With `VOLUMES` reaching 70 km/week, **47.8% of EXPERIENCED 70 km/week marathon runners get a plan whose delivered peak is under 110% of delivered week 1** — §23's own overload threshold. 5K 65.7%, 10K 63.0%, HM 48.1%. ⚠️ **Not a grid artefact:** an experienced 70 km/week runner is entirely realistic, and the rate barely improves with level (beginner 86.2%, intermediate 60.1%, experienced 56.5%). ⚠️ **The CURVE satisfies §23 by construction** — `BUILD_VOL_INIT_CEILING_VS_PEAK` caps week 1 at 85% of peak, giving ≥1.176 — **so this is the curve-vs-delivered gap again**, the same class as §90/ADR-022 and §94. **Invisible until today because the grid topped out at 50 km/week.** Second-highest open engine item after the §9 architectural fix.

### 🔜 COACHING & ENGINE — two items, both for tomorrow

> ✅ **RAMP-GUARD-FAILS-OPEN-01 — SHIPPED 2026-09-17. Coaching Board: CORRECT WITH AMENDMENT (§94 Amendment 1).**
>
> Both trimable arms retired. `INV-PLAN-DELIVERED-RAMP` now fires on the whole-week delivered rise, above chronic load and above the absolute-km floor. Stays `warn`; no change to what the engine prescribes.
>
> **The measurement settled it and partly corrected the filing.** Over 2,799 plans / 14,515 healthy week-pairs: 926 weeks breached §2's own claim at delivery, **202 were silenced by a trimable arm, and 202 of 202 had the long run GROW.** Zero were the false-positive class the arm existed to prevent — a plausible mechanism written into a comment and never measured.
>
> ⚠️ **§52 was misread in the enforcing code.** It justified the arm on the long run being "§52-exempt, not permitted to trim". §52 is a 60% **ceiling** whose FIRST named lever is *"(a) reduce the long run"*, and below 60% it grants no protection at all — only 25 of the 202 were near it.
>
> ⚠️ **The root mechanism is §45, not §94** — all 202 jumps are legal ONLY via §45's `+5km absolute` allowance.
> ⚠️ **DANGLING REFERENCE FIXED 2026-09-19 (`XREF-DANGLE-01`).** This line promised an entry for `LR-ABS-ALLOWANCE-01` further down and there was none.
> That ID was a duplicate, removed the same day by `da96f3c`, which repointed **five** files — CoachingPrinciples §94 Am.1, `plan-invariants.md`,
> `feature-registry.md`, the decision record and `invariants.ts` — and **missed this one back-reference in the backlog it was editing**.
> The real item is **`LR-ABS-CAP-LOWVOL-01`, SHIPPED 2026-09-17 as §45 Amendment 2** (`LONG_RUN_ABS_STEP_MAX_PCT_OF_LR = 50`, so the absolute
> arm is `min(5 km, 50% of prior LR)`; worst in-plan jump 83% → 57%). **Its residual is `S45-ABS-STEP-01`** — the 50% bound only bites below a
> 10 km prior long run, so +5 km on a 10.5 km long run is still +48%.
>
> Live result: **764 violations / 651 plans (23.3%)**, matching prediction; sweep firing rate **6.3%**. Record: `docs/decisions/coaching-board-2026-09-17-ramp-guard.md`.
>
> *Verify closed:* `grep -c "nowTrimable <= prevTrimable" lib/plan/invariants.ts` → **0**.

> ✅ **PREP-ACK-UNLOCKS-MARATHON-01 — RESOLVED 2026-09-17, FOUNDER DECISION, NO CODE CHANGE.**
>
> **Ruling (Russ, 2026-09-17):** *"As long as we present them the facts and they tick 'I understand', that's fine. We shouldn't refuse people plans, we should just give them honest feedback."* **Willy's position carried; McMillan's recorded and not taken.**
>
> ⚠️ **Verified in code before closing, not assumed.** M3 (first marathon, 14 weeks, 18 km/wk, 3 days, 45-min weekday cap, longest ever 9 km) **builds today with or without the acknowledgement** — `validatePrepTime` returns `ok`, because §44's warn band binds only on `time_target` and M3 is a `finish` goal. It builds as `volume_profile: maintenance`, `difficulty_band: comfortable`, carrying the honest line: *"This plan is built to get you round, not to build you up — 3 days/week is below the recommended 4-day-minimum for a MARATHON build."*
>
> So the engine already does what was decided. The item asked whether to make §44 **stricter** (gate differently, or steer to another race); the answer is **no**. Nothing to build.
>
> 🔲 **ONE QUESTION LEFT OVER, NOT ANSWERED BY THIS RULING — the `block` tier.** *(P2, open 2026-09-17.)* §44 and the days gate each have TWO tiers: `warn` (acknowledgement unlocks it — the tier this ruling covers) and **`block`, which has NO acknowledgement path at all.** A runner is hard-refused at: marathon **< 10 weeks**, HM < 8, 10K < 6, 5K < 4, ultra < 14 (+2 for returning runners); and marathon/ultra on **fewer than 3 days a week**. Read literally, *"we shouldn't refuse people plans"* removes that tier too — which is a **§44 doctrine change and a Coaching Board question**, not a docs edit, and Willy's structural argument (a long run forced to dominate the week) is the thing that would be overruled. **Ask Russ before touching it.**

> 🔲 **INPUT-SEX-01 — the engine has NO sex field, and cannot know it.** *(P2, filed 2026-09-16 from the charity-cohort board review. A QUESTION to take, not a build.)*
> `GeneratorInput` carries `age` (for Tanaka max HR) and nothing about sex. So every numeric the
> engine applies was derived predominantly on male cohorts, and the plan **cannot say so, because it
> cannot tell**. Raised by Sims at the 2026-09-16 review sitting on a cohort described as
> predominantly female 20-29.
>
> **Founder decision 2026-09-16: NOT being introduced now.** Parked as a question. If it is ever
> added the shape is **male / female / prefer not to say / undisclosed** — a four-value optional
> field, never a required one, and `undisclosed` must be a first-class value the engine handles
> rather than a null it guesses around.
>
> ⚠️ **Do not confuse this with cycle-aware coaching (ENGINE-03 / CA-05).** Those are blocked on a
> DATA bridge that does not exist — `@capgo/capacitor-health` exposes no menstrual data type
> (ADR-011, verified 0 hits) — and Sims explicitly did **not** ask for cycle periodisation here.
> A sex field is a wizard + data-model change and unblocks nothing on its own.
>
> **What it would actually change is the open question**, and the board did not answer it: knowing
> the runner is female changes no pace, zone or volume formula we currently hold. The honest case
> for the field is (a) honesty about whose data the numerics come from, and (b) it is the
> precondition for the RED-S / energy-availability guidance Sims separately called the missing half
> of a load prescription. Without (b) it is a field that is collected and unread, which
> `configConsumer.test.ts` exists to prevent elsewhere.
>
> **SLT, not this board** — it touches reproductive-health data handling, the same incorporation +
> insurance gate that holds ENGINE-03. Hutchinson carries it.
> *Verify still open:* `grep -c "sex\|gender" types/plan.ts` → **0 = still open**.

> 🔲 **MAINT-LIVENESS-01 — the maintenance generator has NO liveness corpus, so NINE of its invariants have never been proven able to fire.** *(P2, filed 2026-09-17 out of LIVENESS-DEBT-01. Infra, no board.)*
>
> `INV-MAINT-PHASE1-SESSION-TYPES`, `-QUALITY-CAP`, `-VOLUME-CEILING`, `-REST-DAY`,
> `-NO-RACE-SPECIFIC`, `-CADENCE`, `-INJURY-EASY-ONLY`, `-REENGAGEMENT-WINDOW` and
> `INV-PLAN-ULTRA-NO-PACE-SEGMENTS` all sit in the liveness baseline under `corpus` — the harness
> never builds that plan SHAPE. That reason is honest and it has been honest for six days, which is
> exactly how the `unclassified` pile survived: **a declared reason is not a fixed problem.**
>
> ⚠️ **Two of these are a principle's ONLY stated mechanical coverage** — §67 (re-engagement window)
> and §75 (maintenance rest day) — and they are now the entire content of
> `UNPROVEN_INVARIANT_COVERAGE_BASELINE` in `principleCoverage.ts`. So two live coaching rules are
> counted as enforced by checks nobody has ever seen fire.
>
> ADR-013 makes post-race maintenance its own plan object with its own generator, so the fix is a
> **second corpus**, not a wider grid: build N maintenance plans from the maintenance path and run
> the same mutation battery over them. The `corpus` reason then has to be re-earned or paid down.
>
> ⚠️ **Do NOT fold maintenance into `cohortGrid`** — it is a different plan object, and the
> exhaustive-and-un-sampled property of that grid is doctrine (CLAUDE.md, cohort:shape).
>
> *Verify still open:* `grep -c '"corpus"' lib/plan/__fixtures__/invariantLivenessBaseline.json` → **9 = still open**.

> ✅ **LR-DELOAD-CUT-01 — SHIPPED 2026-09-17 (§3 Amendment).** Marathon finish knee+45+ **26.0 → 29.5km**, time-goal knee **30.5 → 32.0km**, M3 persona net build 54% → 79%. Worst single-week jump **+50% → +47%**; 2-week spikes 23.0% → 19.3%. ⚠️ Cost: marathon `maintenance` 68% → 72.7%, all §52 lopsidedness, founder-accepted. ⚠️ Willy's §52 bound did NOT prevent it — second time an amendment passed its condition and missed its purpose. Original entry below.
>
> 🔲 **(original) the deload cuts the LONG RUN harder than it cuts the WEEK.** *(P1, filed 2026-09-17. **Supersedes the framing of LR-DELOAD-RESUME-01 below — same defect, and the fix belongs at the CUT, not the resume.** Needs a §3/§9 board sitting.)*
>
> **Measured across 2,817 deload weeks:**
>
> | on a deload week | median cut | p90 |
> |---|---|---|
> | weekly volume | **22%** | 34% |
> | **long run** | **30%** | **44%** |
>
> **On 50.4% of deloads the long run is cut more than 5pp harder than the week.** Worst traced: a week falling 44 → 43 km (−2%) while its long run fell 20.5 → 13.5 km (**−34%**).
>
> **Why:** the deload week's long run is re-derived from §9's phase share of the reduced week, while the *preceding* week's long run sat ABOVE that share (pulled up by §24/§80 specificity). The drop is the specificity pull switching off, not a deload.
>
> ⚠️ **THIS IS THE CAUSE OF ALL THREE REMAINING FIT-FOR-PURPOSE GAPS**, measured 2026-09-17 after PLAN-FITNESS-01 shipped:
>
> | scenario | peak long run | floor | gap |
> |---|---|---|---|
> | Marathon, **time goal, ANY runner** | 29.0 km | 31.7 km (§24, 75%) | **2.7 km** |
> | Marathon, **finish goal, knee + 45+** | 26.0 km | 29.5 km (§80) | **3.5 km** |
> | Marathon, **time goal, knee + 45+** | 26.0 km | 31.7 km | **5.7 km** |
>
> ⚠️ **PRE-EXISTING, NOT CAUSED BY PLAN-FITNESS-01.** Verified against `9543583~1`: the time-goal peak was **29.0 km before and after** today's work, with the identical sawtooth. Today's changes did not make it worse and did not fix it.
>
> ⚠️ **5K, 10K and HALF MARATHON are unaffected** — every cohort, both goal types, meets its floor. This is marathon-only.
>
> **The proposed fix (needs the board): the deload's long-run cut should track the WEEK's cut**, rather than re-deriving from §9's share. A smaller drop needs a smaller climb back, so it also reduces the week-on-week jumps `LR-CONSEC-01` tracks — the opposite trade from the resume-as-floor below, which created them.
>
> ⚠️ **Do not attempt this as a resume/bounceback.** That was built, board-approved, and reverted — see below for exactly how it failed.

> 🔲 **LR-DELOAD-RESUME-01 — the resume-as-floor approach: board ruled CORRECT, BUILT AND REVERTED as unsafe. Kept as the record of what not to retry.** *(P2, filed 2026-09-17. Superseded in framing by LR-DELOAD-CUT-01 above.)*
>
> **The defect is real and measured.** §45 already says *"a long run following a deload week may step back up to the pre-deload long-run distance"* — but it is a **permission nothing ever asks for.** The allocator re-derives the long run from §9's share of the **reduced** week, so every deload resets it. Masters knee-history marathoner:
>
> | wk | 7 | 8 | 9 ↓ | 10 | 11 | 12 ↓ | 13 | 14 |
> |---|---|---|---|---|---|---|---|---|
> | long run | 14 | 19 | **10.5** | 15.5 | 20.5 | **11** | 16 | 21 |
>
> The 3-week masters cadence leaves two weeks to climb back, each cycle nets ~+1km, and it converges at **21km against §80's 29.5km floor**. At week 10 the specificity ramp asks for 25.6km and §45's cap from the reset base clamps it to 15.5.
>
> ⚠️ **Third rule found on 2026-09-17 re-deriving from a reduced week** instead of resuming what the runner had already done (§2 Am.3 is the weekly-volume twin, shipped). Hutchinson: assume there is a fourth.
>
> **Board 2026-09-17: CORRECT WITH AMENDMENT** — resume to pre-deload, bounded by §52's 60% of the resumed week (Willy), with the deload week itself untouched so §3 holds (McMillan).
>
> 🔴 **BUILT, MEASURED, AND REVERTED — it is UNSAFE as designed.** It delivered the target (marathon knee+masters **26.0 → 29.5km**, net build 35% → 41%, everything else unchanged, zero hard failures, §94 delivered-ramp warns **555 → 444**). But `longRunCapDurationAnchored.test.ts` — the LR-CAP-BLIND-01 guard — caught this on a **healthy low-base beginner**:
>
> | wk | 7 | 8 ↓ | 9 |
> |---|---|---|---|
> | long run | 18.5 | **7.3 (−61%)** | **18.5 (+154%)** |
>
> A first-time marathoner, 3 days/week, **longest run ever 9km**, jumping to **18.5km in one week**. ⚠️ **Willy's 60% bound did not catch it** (18.5 is 68% of that week — the bound reads a `weekly_km` that later changes, the same staleness class as `STEPBACK-STALE-PEAK-01`).
>
> ⚠️ **AND THE BOUND FAILED ITS OTHER PURPOSE TOO.** Willy added it to stop §52 breaches rising. Measured with and without, apples to apples on 1,452 plans: **identical either way, 792 → 964 (+21.7%)** — the breaches arise in the weeks AFTER the resume, not in it.
>
> **The real cause is one layer down:** the deload cuts the LONG RUN by ~61% while cutting the WEEK by 15-30%. §45's exception was written assuming a modest dip; resuming from a 61% cut is violent by construction. **A safer design likely bounds the deload's long-run cut rather than the resume** — but that is a §3 question and needs its own sitting.
>
> ⚠️ **Do NOT retry the resume-as-floor as built.** It is measured, it works for the target cohort, and it injures the low-base beginner.
>
> *Verify still open:* `grep -c "resumeFloorKm" lib/plan/ruleEngine.ts` → **0 = still open**.

> 🔴 **S52-LOPSIDED-BOUND-01 — REOPENED AND RE-DIAGNOSED 2026-09-19. THE FILED QUESTION WAS THE WRONG ONE, AND THE REAL DEFECT IS FAR MORE SERIOUS.** *(was P1; **P0 for the injury × fresh-return cohort**. Coaching Board sat 2026-09-19: **CORRECT WITH AMENDMENT** on the finding, instrument deferred. Record: `docs/decisions/coaching-board-2026-09-19-s52-composition.md`; §90 carries a *Recorded finding*.)*
>
> 🔴 **11.4% of injury × fresh-return runners who declare ≥4 days get SEVEN CONSECUTIVE BUILD/PEAK WEEKS containing TWO RUNS.** Every one of the 41 affected plans loses at least HALF its build phase. **Three other cells measured at exactly 0.0%** (healthy × established n=2,722, healthy × fresh-return n=873, injury × established n=374) — an interaction, not a gradient; removing either factor alone fixes it, verified factorially.
>
> **Worst case, printed not summarised.** Knee history, fresh return, beginner, 30 km/wk, longest 12 km, **four days declared**, marathon finish. Base weeks 1–6: 4 runs, 31–38% share. **Build/peak 7–14: 2 runs, share 71 → 87%.** Taper recovers. The peak week is **26.0 km of a 30 km week in one session**, against §9's own sizing of **9.6 km** — **2.7× the engine's own rule**.
>
> **Mechanism, exact.** `ruleEngine.ts:3550` — the ADR-022 injury easy-run trim floors at `Math.max(1, …)` **one** easy run, while the producer computed `daysVolumeCanFill = Math.max(3, …)` at `:2847` and the trim never consults it. **A floor computed and discarded downstream — the same shape as §113 Am.1, third instance in two days.**
>
> ⚠️ **§24 does NOT bind this case** — it governs `time_target` only and this is a `finish` goal. **No principle actually requires 26 km in a 30 km week**, and §9 already forbids it at 28–40%. The collision is **§80's specificity ramp vs §90's injury ceiling**, and nobody wrote down which wins.
>
> ⚠️ **ROUTE (c) FROM THE ORIGINAL FILING IS ALREADY SHIPPED** — `lopsidedNote` already says *"the lever is the other days"*. **Do not re-propose it.** McMillan: we are advising the runner to do the thing the engine just removed.
>
> ⚠️ **INSTRUMENT DEFERRED, and the reason is honest: every candidate reachable without a NEW NUMBER is blocked.** More easy runs at the configured 4 km easy floor pushes the week above the injury ceiling, which Willy's binding condition forbids; a sub-floor easy run needs a new constant the board declined to pick on argument alone. **Binding on any fix:** must not raise the injury ceiling · must not re-open `LR-DELOAD-RESUME-01` · measured on the **property sweep**, not a hand-rolled grid · `measure:fitness` before and after. **The standing "do not add a third per-week §52 bound" instruction SURVIVES — a floor on composition is a different object.**
>
> 🔴 **NO INVARIANT EXISTS AND ONE SHOULD.** §64 floors **rest** days; there is **no converse anywhere in the constitution**, so nothing checks that a week delivers the running days the runner declared. 17.2% of ALL plans deliver at least one week short of `days_available`.
>
> **Baseline §52 state for reference:** 2,531 breaches / 597 plans (15.5%), **100% warn, 0 error** (all maintenance-classified), distribution continuous and unimodal at 65–69%, worst 87%.
>
> Two separate fixes this session were amended by Willy with the same bound — *"resume/cut to the target, but never above §52's 60% of that week"* — specifically to stop §52 breaches rising. **Measured both times, apples to apples: it does not work.**
>
> | change | §52 warns without the bound | with it | baseline |
> |---|---|---|---|
> | LR-DELOAD-RESUME-01 (reverted) | 964 | **964 — identical** | 792 |
> | LR-DELOAD-CUT-01 (shipped) | — | **965** | 792 |
>
> **Why:** the bound caps the week it acts on. The long run then stays higher through the rest of the cycle, so the breaches land in the weeks **after** — which the bound never sees.
>
> ⚠️ **The visible consequence, shipped and founder-accepted:** marathon plans classified `maintenance` rose **68% → 72.7% (+4.7pp)**, driven **entirely** by §52 lopsidedness (88 → 106 in a 753-plan sample), **not** by floor failures (293 → 292). Those weeks genuinely are long-run-dominated; §52 is telling the truth. The question is whether the truth is acceptable.
>
> **Three routes for the board:** (a) accept §52 as a warn that is now breached ~965 times and stop bounding for it; (b) make §52 bind across the whole block rather than per-week — a much wider prescription change, since §52's lever (a) is "reduce the long run" and that would undo LR-DELOAD-CUT-01; (c) treat rising lopsidedness as the signal that the runner needs MORE DAYS or MORE WEEKLY VOLUME (§52's lever (b)) and say so in the note.
>
> ⚠️ **Do not add a third per-week bound.** It has been measured twice and moves nothing.
>
> *Verify still open:* `grep -c "LONG_RUN_MAX_PCT_OF_WEEKLY" lib/plan/ruleEngine.ts` → the per-week bound is still the only mechanism.

> 🔲 **INV-MSG-ROUNDING-01 — a violation message can read as self-contradictory because both numbers are rounded to integers.** *(P3, filed 2026-09-17. Cosmetic but corrosive.)*
>
> Observed on `INV-PLAN-MAIN-SET-ORDERING` during the PLAN-FITNESS-01 investigation: *"Got 18 min, expected ≤ 18 min (tempo + 3 min rounding tolerance)"*. **18 ≤ 18 is true, so the message says the check fired on a value that satisfies it.**
>
> The check itself is correct — it does not reproduce on a clean generate and the full sweep is clean. The real values are fractional (e.g. 18.4 against 17.6) and **both are `.toFixed(0)`-rounded for display**, which collapses them onto the same integer.
>
> ⚠️ **Why it is worth fixing:** the next person to hit this will conclude the invariant is broken and go looking for a bug that is not there — exactly the cost this repo keeps paying for misleading output. One decimal place in the message fixes it. Check the other invariants that format with `.toFixed(0)` at the same time.

> 🔲 **STEPBACK-STALE-PEAK-01 — §47's step-back is measured against a peak that a later pass then trims.** *(P2, filed 2026-09-17 out of PLAN-FITNESS-01. Infra/ordering, no board — restores documented intent.)*
>
> `applyPeakLongRunAlternation` sizes the step-back as a ratio of the peak long run **it can see**. `applyLongRunProgressionCap` runs **afterwards** and can trim that peak, so the ratio ends up measured against a number that no longer exists. Measured: a **166-minute step-back against a final peak of 206 — 80.6% against §47's 80% ceiling.**
>
> ⚠️ **Pre-existing.** The §24/§80 specificity ramp moved peak durations into a range where the gap exceeds one minute; it surfaced this rather than causing it.
>
> Interim: `peakLrStepbackMinutes.test.ts` tolerance widened 1 → 2 minutes (1% of a 206-minute session) **with the cause written into the test**. ⚠️ **If it ever needs widening again, fix the ordering instead** — a tolerance that keeps growing is a check being switched off a minute at a time.
>
> Fix is a pass-ordering change (re-clamp the step-back against the final peak, on whichever axis the plan is anchored). ⚠️ **A naive re-clamp was tried and reverted** — treating every sub-peak week as a step-back breaks §35 and §24. The clamp must key on the step-back itself.
>
> *Verify still open:* `grep -c "pct + 2" lib/plan/peakLrStepbackMinutes.test.ts` → **non-zero = still open**.

> 🔲 **LR-CONSEC-01 — §45 cannot see COMPOUNDING, and closing it collides with §38 and §47.** *(P1, filed 2026-09-17. Coaching Board ruled the mechanism **CORRECT** at 30%; **BUILD ATTEMPTED AND REVERTED** — it needs §38 and §47 amended first, which is a second sitting.)*
>
> **The defect is real and measured.** §45 compares a week to the one before it. **Nothing in the constitution looks across two**, so compounding is invisible — structurally the same blind spot §94's guard had, one principle over.
>
> | | Measured, 2,412 plans |
> |---|---|
> | Plans with a 2-week long-run rise > +40%, no deload between | **28.4%** |
> | that window — median / p90 / **max** | 33% / 87% / **126%** |
> | Plans with a 3-week rise > +50% | **13.1%** |
> | that window — median / p90 / **max** | 96% / 133% / **193%** |
>
> Worst case **6 → 9 → 13.6 km in a fortnight**, every individual step legal.
>
> **Board ruling (2026-09-17): CORRECT, at a 30% rolling two-week ceiling.** 30 not 40 because only 30 closes the three-week window (13.1% → **1.6%** vs → 10.0%). McMillan's marathon-buildability objection was measured and **withdrawn**: peak long run is identical at 0/40/30 (median 29.0km, max 31.5km) because §9's 210-minute cap binds first, not §45.
>
> 🔴 **WHY IT DID NOT SHIP — the coupling, which is the whole point of this entry.** The invariant-level trial was clean (zero error-severity violations, zero refusals, and it made §52 and §94 *quieter*: 722→675 and 466→419). ⚠️ **That trial measured INVARIANTS and missed other principles' NAMED TESTS.** Building it broke three, and **two of them fail at 30%, 40% AND 50% — so the collision is the MECHANISM, not the number:**
>
> | Broken | What it asserts | Why it breaks |
> |---|---|---|
> | **§38** `maintenanceNotePrescriptive` | *"raising the named day count flips the profile to build"* — the note is a PRESCRIPTION, not decoration | With a two-week ceiling the long run cannot climb fast enough to clear §24's floor, so 6 days stays `maintenance`. **The plan makes a promise it no longer keeps.** |
> | **§47** `peakLrStepbackMinutes` | the step-back is ≤ `PEAK_LR_STEPBACK_MAX_PCT` of peak | Peak is capped lower; the step-back is not, so it exceeds its own ratio (161 min vs 129.8 max). |
> | §35 `peakLrEarnedTier` | earned tier clears §24's floor | HM peak 16km vs 17.4km floor. **Recovers at 40%** — value-dependent, unlike the two above. |
>
> Cohort at 30%: maintenance **48.7% → 51.6% (+2.9pp)**, mean delivered peak volume 38.4 → 37.7km, plus 2 golden snapshots.
>
> **DECISION NEEDED — this is a founder/board call, not an edit.** Three routes:
> 1. **Amend §38 and §47** so the promise and the step-back ratio account for a capped climb. Correct but widest blast radius — §38's prescriptive-note doctrine is load-bearing.
> 2. **Scope the ceiling to where it hurts most** (e.g. low-volume only, as §45 Am.2 does) and re-measure the collisions.
> 3. **Accept the compounding** and record it as known-open under §34.
>
> ⚠️ **Do NOT re-attempt as a straight build.** It has been tried at 30/40/50 and §38 and §47 fail at all three.
>
> ⚠️ **UPDATED 2026-09-17 after PLAN-FITNESS-01.** The specificity ramp was expected to make compounding worse (it climbs the long run harder). Measured: it **improved**. Plans with a 2-week window >40% **28.4% → 23.0%**, 3-week >50% **13.1% → 10.7%**, worst 2-week **126% → 121%**, worst 3-week **193% → 165%**. Fewer plans and lower extremes, because plans that previously never climbed at all now do. p90 rises (87% → 95%) for the same reason. **Still open — the mechanism (§45 sees one week at a time) is unchanged.**
>
> *Verify still open:* `grep -c "LONG_RUN_TWO_WEEK_MAX_RISE_PCT" lib/plan/generationConfig.ts` → **0 = still open**.

> 🔲 **GRID-MARATHON-CAPABLE-01 — `cohortGrid` cannot express a marathon runner capable of §24, so every marathon measurement taken on it is scoped to runners who were never eligible.** *(P1, filed 2026-09-17 out of the LR-CONSEC-01 sitting. Infra, no board.)*
>
> §24 requires a marathon time-goal peak long run ≥ **31.65 km** (75% of race distance). §52 caps the long run at 60% of the week, so reaching that needs a week of **~52.8 km**. `cohortGrid`'s marathon `current_weekly_km` values are **20 / 35 / 50**. **Zero of its 7,776 marathon inputs can satisfy §24 by construction.**
>
> ⚠️ **This produced a measurement that read as a catastrophic engine finding and meant nothing**: "100% of marathon time-goal plans are maintenance-grade, 0% reach the §24 floor." True, and an artefact of the fixture. Caught only because the number was too extreme to believe. Same family as GRID-COVERAGE-01/02 and the liveness-corpus failures (2026-09-12, 09-15, 09-17) — **a grid that cannot build the shape reports the fixture, not the engine.**
>
> Fix: extend the marathon volume axis above ~55 km/wk, or add a targeted marathon grid (the `targetedGrid` pattern). ⚠️ **Adding an axis to `cohortGrid` doubles a check that runs in `npm run verify`** — the same runtime constraint GRID-COVERAGE-02 hit; prefer a second targeted grid.
>
> *Verify still open:* `npx tsx -e "import {cohortGrid} from './lib/plan/cohortGrid'; console.log(Math.max(...cohortGrid().filter(i=>i.race_distance_km>40).map(i=>i.current_weekly_km)))"` → **< 53 = still open**.

> 🔲 **S24-FLOOR-REACHABILITY-01 — §24's marathon floor is unreachable for most runners, and the constitution does not say so.** *(P2, filed 2026-09-17 out of the LR-CONSEC-01 sitting. **Coaching Board question — a principle's own reachability.**)*
>
> Measured on 108 marathon plans built from runners who genuinely can build (55–75 km/wk, longest 24–32 km, 5–6 days, 16–20 weeks, intermediate/experienced): **peak long run median 29.0 km, MAX 31.5 km, against §24's 31.65 km floor. 0 of 108 reach it.** The best plan misses by **0.15 km — less than the 0.5 km rounding step.**
>
> **Cause is §9's `LONG_RUN_CAP_MINUTES` (210 min for marathon), and §24 already says the time cap wins** *("the engine never prescribes a long run that exceeds the time cap, even if doing so would satisfy this floor")*. **So this is documented intent, not a defect.**
>
> ⚠️ **But the consequence is not written down anywhere:** 210 minutes reaches 31.65 km only at an easy pace of ~6:38/km or quicker, so **§24's floor is structurally unreachable for every slower runner**, and **95.4% of well-trained marathon runners are classified maintenance-grade against their time goal** as a result. A principle whose floor most of its population cannot reach is either mis-stated or needs its reachability condition written into it.
>
> Question for the board: should §24 state the pace condition explicitly, should the floor scale with the time cap, or is "most marathoners get a maintenance-grade classification" the honest intended answer? **Do not change the time cap without a sitting — §9's 210 minutes is Willy's tissue-tolerance ceiling, not an arbitrary number.**
>
> *Verify still open:* `grep -c "6:38\|reachab" docs/canonical/CoachingPrinciples.md` → §24 carries no reachability note.

### 🔬 test.test marathon review — 3 board amendments (filed 2026-09-16)

Coaching Board ran a fitness-for-purpose review of a real generated marathon plan (test.test@test.com, 26yo intermediate, 4:00 goal, 4 days, 60-min weekday cap, current 30 km/wk, longest-ever 12 km, plan_start 2026-09-21). Ruling: **CORRECT WITH AMENDMENT** — honest, runnable sub-4 plan; three amendments before clean sign-off. All three root-caused against `generateRulePlan` (live regen matches the stored plan byte-for-byte on the curve).

> ✅ **PEAK-STEPBACK-VOLUME-01 (was Root B of LR-RAMP-INTERMEDIATE-01) — SHIPPED 2026-09-16 (512f289).** Coaching Board sat on the two levers; **Lever A CORRECT**. §47 Amendment 2: a peak step-back is now a VOLUME step-back — `applyPeakStepBackVolume` trims easy volume to ≤90% of the preceding week (`PEAK_STEPBACK_WEEK_MAX_PCT`), guarded by `INV-PLAN-PEAK-STEPBACK-VOLUME`, scoped non-injury. test.test now runs 45→41→54 (was 45→50→54). The peak phase now carries a real volume down-week, which was the board's "insert a recovery week ~11". Three passes' worth of ordering pain recorded in the build-log.

> ✅ **LR-ABS-CAP-LOWVOL-01 — SHIPPED 2026-09-17. Coaching Board: CORRECT (§45 Amendment 2).**
>
> §45's `+5 km absolute` long-run step now tapers: `max(prevLR × 20%, min(+5km, prevLR × 50%))`. The `+20%` arm and the deload step-back exception are unchanged.
>
> **The control group settled it.** On the low-volume cohort (longest <18km AND volume <35km/wk), 32.5% of absolute-arm steps were **≥ +40% in a single week — against 2.7% in the control**. ⚠️ **Frequency was never the tell** (the arm binds MORE often on ordinary runners, 37.8% vs 29.2%); magnitude is, by 12×. A whole-population measurement would have shown nothing wrong, which is exactly why the first sitting ruled INSUFFICIENT EVIDENCE.
>
> ⚠️ **Willy withdrew his own supporting argument on the data** — he had reasoned these jumps were tolerable where a recovery week follows; the cohort turned out slightly BETTER protected on that axis than the control (61.9% vs 73.0% unprotected). The case rests on magnitude alone.
>
> ⚠️ **The basis changed during implementation and the rule did not.** Built on `prev.weekly_km` it broke **140 plans, which threw**: §45 runs mid-pipeline and the long run is re-anchored (duration→distance) afterwards, so producer and checker read different weekly volumes. Re-expressed on `prevLR` — arithmetically identical, since §9 puts the build long run at 30% of the week, so 15%-of-week IS 50%-of-long-run — and producer and checker now share the value the % arm already uses. **The re-expressed rule is strictly BETTER than the version the board costed**: peak long run falls on 12.5% not 22.7%, 7 plans lose their time goal not 18, worst jump 83%→51% not 57%.
>
> **Founder elected to ship immediately**, the day before the charity showcase, with the blast radius stated. Board had withheld timing.
>
> Verification: verify exit 0 (2,052 tests / 222 files) · sweep 0 hard failures · `cohort:shape` re-baselined, 4 metrics moved all declared (marathon maintenance 69→69.8) · `verify:parity` **1,085/5,940 (18.3%)** with **0 of 1,944 changed at 55km/wk** — the scoping proof. Record: `docs/decisions/coaching-board-2026-09-17-lr-abs-cap.md`.
>
> *Verify closed:* `grep -c "LONG_RUN_ABS_STEP_MAX_PCT_OF_LR" lib/plan/generationConfig.ts` → **non-zero**.

> ✅ **STEPBACK-NOTE-VOLUME-01 — RESOLVED by PEAK-STEPBACK-VOLUME-01 (512f289).** The note "absorb last week's peak" is now honest: the step-back week genuinely delivers less than the preceding week, so no copy change was needed — Lever A's option (b) (hold the week's volume) made the existing note true rather than rewriting it. The latent stale-`catalogue_id` concern flagged alongside it was already handled (`ruleEngine.ts` deletes it when §47 rewrites the session).

> ❓ **VP-MAINT-NAMING-01 — an +80% build is labelled `volume_profile: 'maintenance'`. NOT a bug.** *(P3, filed 2026-09-16. Hutchinson flagged it as a suspected misclassification; investigation cleared it. Naming/consequences question only.)*
>
> **Verified against the live engine: this is the documented §24 behaviour, not a defect.** The peak long run (29 km) cannot reach the §24 floor (31.65 km = 75% of 42.2) because §45's week-on-week cap prevents it, so `lrFails` fires (`ruleEngine.ts:6630`) and the plan is classified maintenance-**grade against the time goal**, with the honest `volume_constraint_note` the runner already sees. "Maintenance" here means "won't build to the time-goal's volume floor", **not** "doesn't add volume" — the plan genuinely builds 30→54 km (+80%). The board's instinct ("smells like a bug") was the thing to verify, and it was wrong — a clean example of the verify-against-the-live-function rule. **Open question, low priority:** the *word* "maintenance" reads as "not building" to a human, and the flag has downstream teeth (exempts §1's intensity ceiling at `invariants.ts:2011`, changes taper at `:3394`, drives `cohort:shape`). Worth a board naming pass on whether a building-but-goal-short plan should carry this label, but no runner-facing defect and nothing to fix now.

### 📡 Ops digest 2026-09-17 — 3 findings (daily digest reading prod)

The 2026-09-17 08:30 digest surfaced three issues. Verified against the live plan `a34d4892` (17-wk marathon, test account `4856757c`, generated 2026-09-16 19:24 UTC, `applied_partial`) and current `main`.

> ✅ **ENRICH-STRIDES-01 — the AI enricher silently dropped the §28 stride note. SHIPPED 2026-09-17.** Moved to `feature-registry.md`. The enrichment layer reverted **12 of 17 weeks** of the live plan to plain rule copy (`plan_enrich_failed` weeks [3,5,6,7,9,10,11,12,13,14,15,16], all `INV-PLAN-STRIDES-PRESENT`) because `buildUserMessage` strips `coach_notes` before the model sees them and `mergePlan` rewrites them wholesale — so the engine's "4×20s strides at 5K effort, full recovery between." line was deleted every build week. Fixed on two layers because §28 is a constitutional invariant and a prompt cannot guarantee "every week": `preserveStrideNote()` re-attaches it deterministically at merge (mirrors the §78 time-trial guard one field over), and the prompt now surfaces a `strides` field + demands the line verbatim so the visible AI voice stays rich. `stridesCopyProtected.test.ts`. Board-exempt (restores §28 intent); sweep 15,974 plans, 0 new above baseline.

> ✅ **FLEET-INVALID-DEBT-01 — legacy invalid-plan debt confirmed + young rows cleared. RESOLVED 2026-09-17.** *(P2, filed 2026-09-17.)* Plan-audit 2026-09-16 12:51 UTC: checked 17, invalid 17 — 11 in the 31d+ bucket, foundation-week (warm-up) violations up to 8 hits, newest breach 4 days old (pre-current-build), 0 in the 0-1d bucket. **Confirmed legacy, not a regression:** the failing-code count tracks plan age almost perfectly (Apr 8–15 codes, Jun 7–12, Sep 1–3), every failing invariant POSTDATES the plan it trips (`CATALOGUE-LINK` 2026-08-20, `DIFFICULTY-ANNOTATED` 2026-08-18, foundation-block 2026-09-15), and last-night's plan fails only `PEAK-STEPBACK-VOLUME` — shipped (512f289) 3h AFTER it generated. This is the live-plan policy working as designed (the audit route documents it; the digest reads newest-breach AGE, not the count). **Action taken (no invariant weakened):** `scripts/fleet-invalid-debt-01-regen.ts` (dry-run default, `--apply`, archives to `plan_archive` first) regenerated the **6** young test-account plans that have a future race + persisted `generator_input` + no in-progress data → all now valid. **Deliberately NOT touched:** `81e4b792` (has real `session_completions` → the live-plan / opt-in-refresh case, `[[FLEET-INVALID-DEBT-02]]`), 8 past-race plans (a past race can't be regenerated), 3 no-generator-input plans — all months old, so they no longer drive the digest's age signal. The full opt-in "refresh my plan" path for real active runners (archive → regen → preserve completions + enriched copy via ENRICH-PARTIAL graft → ADR-012 confirmation) is filed separately as the real build.

> 🔲 **FLEET-INVALID-DEBT-02 — opt-in "refresh my plan" for a REAL active runner on a stale-but-valid... invalid plan.** *(P3, filed 2026-09-17, deferred until there are real runners.)* The safe way to bring a live, in-progress plan up to current rules WITHOUT the silent-rewrite the live-plan policy forbids. Mechanism already exists in pieces: regenerate anchored to the runner's original `plan_start` (keeps `week.n`/dates stable so `session_completions`/`run_analysis`/reflections stay keyed), graft the runner's enriched copy back onto structurally-unchanged weeks (`foundationResize.ts` / `enrichPartialRevert.ts`, ENRICH-PARTIAL-01), archive the prior via `plan_archive`, and surface the change through ADR-012 magnitude → confirmation tile rather than applying it silently. Only worth building once a real runner holds a plan that breaches a SAFETY-relevant invariant (load/cap/empty-session), not a cosmetic annotation one. `81e4b792` is the current stand-in case.

> 🔲 **STRAVA-APP-INACTIVE-01 — the Strava APPLICATION is Inactive at Strava's end. EXTERNAL, no repo change applies.** *(filed 2026-09-17.)* `ops_events` logged `strava_subscription_missing (reason: app_inactive)` at 2026-09-16 13:28 UTC (403 "Inactive"). This is the whole application, not a missing subscription — **re-registering the push subscription will not help** (`scripts/strava-webhook-subscription.ts register` is a no-op while the app is inactive). Last `strava_webhook_received` was 2026-09-15 18:47 UTC; nothing since, consistent with a dead app. Same failure as the 2026-09-13 incident (`docs/incidents/2026-09-13-strava-webhook-no-app-link.md`). **Remedy is Russ's, in Strava developer settings (client ID 219980): reactivate the application.** The code already detects and reports it correctly (`lib/ops/stravaWebhookHealth.ts`); `INV`/health path unchanged.

---

> 🔲 **COMPLIANCE-PROGRAMME — the open half.** *(opened 2026-09-16; **gauge 97.7%, fit-for-purpose 97.7%, both past the 95% target** — what remains below is the residual, not the programme)*
>
> ✅ **CLOSED 2026-09-16 — CB-HSR-AVOID-01 (§110 + §110 Am.1 + the §21 defect).** `avoid` and an
> Achilles history set `plannedQuality = 0` for every week of every plan: 2,953 non-beginner plans,
> 18.5% of the sweep. Fit-for-purpose **25.6% → 97.7%**. ⚠️ **Two thirds of that movement was the
> STANDARD being wrong, not the engine** — the 25.6% scored as failures two outcomes the
> constitution ratifies (§40c's declared volume shortfall; a genuine beginner's zero quality), and
> the mandatory conflict scan would have caught both. Read §110 before re-measuring anything here.
>
> ✅ **CLOSED 2026-09-16 — the 3 undeclared plans (§40c).** They were REAL and
> reachable, not harness artefacts as first reported: all three reproduce with
> today's dates (5K time goal, 5-12 km/week, target 28 km, delivered peak 16 km,
> **no note of any kind**). **Root cause: two different shortfalls, one check.**
> `peak_shortfall_note` only fired when the plan peaked below the runner's
> CURRENT VOLUME (§106). It never asked whether the plan peaked below its own
> TARGET — and every other declaration missed it for the same reason, because
> they measure delivered volume against the internal volume CURVE, which is
> itself ramp-limited and so reports no shortfall. **The gap was curve-vs-target,
> which nothing compared.** Gated to time goals (a `finish` runner was never
> promised a volume, so §40c has nothing to declare). Reuses
> `VOLUME_SHORTFALL_NOTE_THRESHOLD_PCT` rather than adding a parallel number.
> SILENT **3 → 0**; all 14 charity personas still clean.
>
> ⚠️ **It demoted a better note twice before it was right, and both were caught
> by a hash diff, not by review.** The new note supersedes `load_residual_note`,
> so on first cut it replaced two golden FINISH plans' "week 9 rises 38%, be
> careful with it" safety warning with a volume observation; the goal gate fixed
> those, and 542 time-goal parity cases were still losing it until the
> precedence was split. §106's shortfall makes the load residual redundant
> (both read one struggling plan); §40c's does not (an unreachable target says
> nothing about a week ramping too fast). **Sessions were byte-identical on
> every one of those 542 cases** — the entire delta was which note the runner
> reads, which is precisely what a parity hash flags and only a human can
> adjudicate.
> The coaching-compliance gauge runs on the property sweep under `SWEEP_SCORE=1`. **A plan is
> ACCEPTABLE when it carries no error, no HIGH coaching deviation, no structural failure, and
> every residual it declares matches what it actually delivers.** Baseline 36.6% → **45.7%** after
> FIX-0/1/2/3 + INJURY-MATCH-01. Target 95%.
>
> ⚠️ **The gauge must be allowed to go DOWN.** FIX-0 moved it 36.6% → 35.9% because it stopped
> hiding 574 masked plans. A compliance metric that only ever rises is one being gamed; the
> `ACKNOWLEDGED_WARN_RATES` entry and the sweep baseline both carry their reasoning for the same
> purpose. Never re-baseline to go green.
>
> **Still open, in rough priority:**
> - 🔴 **LOPSIDED-ORDER-01** — `lopsidedWeek` (§52's third remedy, `ruleEngine`) evaluates BEFORE
>   the weekday-cap pass trims easy runs. Traced on the exact input: at `max_weekday_mins: 30` the
>   week falls 58 → 39 km while the long run is race-anchored and §52-exempt, so its share crosses
>   60% after the producer has already decided the week is fine. 2 plans in the sweep baseline.
>   ⚠️ Re-scoping `lopsidedWeek` backfired on 2026-09-15 (stripped 24 plans of maintenance, turned
>   an absorbed warn into a hard failure, reverted). Needs its own measurement, not a ride-along.
>   *Verify still open:* `BASELINE['INV-PLAN-LR-MAX-WEEKLY-PCT']` in the sweep → **2 = still open**.
> - 🔴 **SWEEP-AGE-01** — the sweep pins `age: 35` (corners 43), so `MASTERS_AGE_THRESHOLD` (45) is
>   NEVER crossed and §3's masters 3-week deload cadence has never been swept. That is where the
>   deload ratchet was worst (81.7% detraining vs 67.2%), so every masters figure in §2 Am.2 is
>   instrumented arithmetic, not sweep measurement. **Widening it revealed a second unrelated
>   defect immediately** — `INV-PLAN-MAIN-SET-ORDERING`, 13 plans — so it needs its own commit.
>   Also: the input-coverage gate passed because `age` took two distinct values; it does not check
>   whether variation crosses a threshold the engine BRANCHES on. That gate is worth strengthening.
>   *Verify still open:* `grep -c "age: pick(ages)" scripts/property-validate-plans.ts` → **0 = open**.
> - 🔲 **SWEEP-INJURY-01** — `'Plantar fasciitis'` is still unswept. The injury axis was held at 6
>   entries during INJURY-MATCH-01 so the seeded sample would not re-roll and rates stayed
>   comparable. Add it (and re-baseline the rates, declaring the move) as its own change.
> - 🔲 **The 0.7% detraining residual** — `INV-PLAN-NOT-DETRAINING` fell 15.1% → 0.7% but is not
>   zero, and the remaining cause is NOT traced. Do not present detraining as solved.
> - 🔲 **Promote `INV-PLAN-NOT-DETRAINING` to `error`** — shipped at `warn` only because
>   `enforceViolations` throws on error in dev/test and 15.2% of inputs would have taken verify
>   down. At 0.7% that objection is nearly gone. **If it does not reach ~0, the producer fix
>   failed** and that is the test.
> - 🔄 **BRAND-EMDASH-01** *(mechanism half CLOSED 2026-09-17 by COPY-GLYPH-01 — `emittedCopyGlyphs.test.ts` now guards the engine's EMITTED copy, which is what this item asked for. What remains is the FOUNDER DECISION: em dashes are in **100% of plans**, 26,727 session labels alone (`Easy run — Zone 2`), so removing them is a visible change to every session name, not a copy tidy. The guard holds the debt at 12 runner-facing fields meanwhile and re-baselines DOWN only.)*
>   ORIGINAL FILING:  — the §23 `structuralPeakInversion` note (`ruleEngine.ts`) contains TWO
>   em dashes in runner-facing copy, against the 2026-09-11 founder standard. Pre-existing and
>   unnoticed because `noEmDash.test.ts` covers MARKETING surfaces only, not plan `meta` notes.
>   Worth extending that guard to the engine's emitted copy rather than fixing the one line.
>   *Verify still open:* `grep -c "—" <(grep "hold your fitness rather than grow" lib/plan/ruleEngine.ts)` → **non-zero = open**.
> - ✅ **PARITY-HSR-01 — CLOSED 2026-09-16.** `verify-parity` did not vary
>   `hard_session_relationship` at all, so §110 reported "IDENTICAL, 5832 cases"
>   on the very change that rewrote what an `avoid` runner is prescribed. Four
>   principles key off that input (§35, §47, §96, §110) across 13 call sites.
>   **Not fixed with a 9th cartesian axis** (4x on an already slow check, to
>   re-test 5,832 combinations against a lever reading one field) — a focused
>   block is appended instead: every distance x level x goal for the three
>   non-default values. **108 rows on 5,832, +1.9%.**
>   **Falsification-tested, not assumed:** run against the pre-§110 commit it
>   reports `hsr avoid=18/36, love=0/36, overdo=0/36` — it catches the change it
>   was blind to, and correctly clears the two values §110 did not touch.
>   ⚠️ Adding it **silently broke the grid's own coverage guard**, which asserted
>   each goal branch existed via `endsWith('|finish')` — true only while `goal`
>   was the last key field. A coverage guard that fails open is worse than none
>   (the file's own trap 3). Both readers of the key layout now share one
>   `KEY_FIELDS` definition, and the same presence guard covers `hsr`.
> - ↗️ **RAMP-GUARD-FAILS-OPEN-01** and **PREP-ACK-UNLOCKS-MARATHON-01** were filed
>   here and have been PROMOTED to the top-level `PICK UP HERE` list — they are the
>   only two open coaching items. Do not re-file them from this section.
> - 🔲 **Compliance themes still unruled:** `maintenance` meaning three different things, and
>   warn-severity triage (any warn >20% is promoted or explained). Sims's fuelling /
>   energy-availability guidance is also still outstanding.
>   ✅ *zero-quality-by-accident is CLOSED by §110* — and the board's answer to "what should a
>   3-day novice marathoner deliberately receive" turned out to be already written: a genuine
>   beginner gets none, ratified 2026-08-30; everyone else gets at least one.
> - ✅ **GOAL-COHERENCE-01 (the §22 latent defect) — CLOSED 2026-09-16.** A time
>   goal with no `target_time` produced **3 error-severity**
>   `INV-PLAN-RACE-SPECIFIC-EXPOSURE` violations, which THROW in dev and test.
>   `goalPace` is null without a target time, yet **14 call sites** (11 in
>   `ruleEngine.ts`, 3 in `invariants.ts`) read `goal === 'time_target'` as
>   though a goal pace exists. Fixed at the boundary — `coherentGoal()` in
>   `inputs.ts` — rather than by teaching 14 consumers the same caveat (D-21:
>   the rule is fine, the INPUT was incoherent).
>   ⚠️ **Fixing only the producer was not enough, and the sweep proved it.**
>   Normalising inside `generateRulePlan` left every EXTERNAL caller of
>   `validatePlan` passing the raw input, so the checker went on failing plans
>   the producer had already corrected (2 violations survived). `coherentGoal`
>   is now the single owner both sides call — the producer/consumer split this
>   repo has paid for repeatedly (D-16, TIER-OWNER-01, §47).
>   **The sweep could not see any of it**: `target_time` is set unconditionally
>   in `randomInput()`, independent of the `goal` axis, so that combination was
>   ungeneratable. Added as a **corner case, not a `goalSets` entry** — a third
>   value on that axis re-rolls the whole seeded sample and moves every rate in
>   the file (the SWEEP-AGE-01 trap). Sweep is now 15,974.

### Off the table — do NOT re-open without reading the item first

| Item | Why |
|---|---|
| **SC-10 / CD-14** | ✅ **Appears FIXED.** My "91.9% breach" measured against a rule that governs none of those sessions — `INV-PLAN-VO2MAX-MAIN-SET-CAP` branches to the 12–18 min WORK band, and 3,996/3,996 sessions are work-governed. **The ruling on it is void.** Re-open only against WORK minutes. |
| **CV-ELIGIBILITY-01** | ✅ Re-verified; the 2026-09-06 "leave it" decision stands. A 1-point boundary case, not a defect. |
| **ZONE-BAND-01** | ⏸️ Correctly blocked on DATA (2 users). Has a numeric re-open trigger now: ≥20 users × ≥10 HR-bearing quality analyses. |
| **PV2-G** (Monday race) | Known, visible in every round via canonical case `07-hm-monday-race`. Needs an ADR + cross-week race-arc restructure. |
| §16's "20% of session" vs code's 20% of MAIN | Deliberately not changed — the card renders a bare `20%` with no referent, so it is invisible to the runner. Recorded in §39/§80 so it is not re-found. |

### ⚠️ Read this before producing any measurement
**[[feedback-the-denominator-is-where-claims-fail]]** — four wrong measurements on 2026-09-14, all with correct arithmetic over the wrong set, **one of which reached a Coaching Board ruling**. Before a number becomes a finding: read the **invariant's CODE**, not the principle's prose; name the denominator; check the quantity is comparable (a *main set* is work **plus recoveries**); and remember a category label is not a session type (`'hard'` is a benchmark; `classifyStimulus → 'vo2max'` includes hills).

---

---

> **Keeping this file honest (added 2026-08-15 after an audit found three stale entries).**
> Every open item carries a **`Verify still open:`** line — a grep, a file check, or an explicit
> gate. It exists so an audit is a script rather than a careful read: run the check, and if it
> comes back false the entry is stale and should be closed or corrected on the spot.
> Two mechanical backstops support it: `.claude/hooks/backlog-touch.py` flags open entries whose
> files a commit just touched (this is how PUSH-UNITS-01 stayed open for weeks after being fixed
> incidentally), and `/ship` moves finished items to `feature-registry.md`.
> **Note the three item formats** — status bullets, LATER table rows, and unscheduled bullets.
> A bullet-only grep misses ~40% of open items; that is why CA-08 once looked like it had vanished.

## Roadmap Waves — sequenced plan (SLT portfolio review 2026-07-22)

**Job of this section:** the open backlog is sequenced into six waves. Every open item carries a wave tag (`[W0]`…`[W6]`) inline next to its ID so a backlog review shows *what to build and in what order*, not just a flat list. Waves are an ordering, not a schedule — pull the top of the lowest-numbered wave that isn't blocked.

**The reordering fact:** Zonna is live but **paid acquisition is not switched on** and the user base is tiny (founder + early organic). Every wave sorts around the moment acquisition turns on. Cheap correctness + pre-acquisition hygiene come first; the L-effort competitive builds wait for installs to justify them.

| Wave | Theme | Items | Rule |
|---|---|---|---|
| **W0** | **Measurement** — unlocks everything gated | ~~INSTRUMENT-01~~ ✅ shipped 2026-07-22 | Nothing gated on a number can be evaluated until this exists. Done — see feature-registry. |
| **W1** ✅ | **Correctness & trust** — cheap, already-decided, protects the one thing we sell | ~~EMAIL-CRON-01~~ ✅ · ~~RESHAPE-FIX-WAVE2B-AUDIT~~ ✅ · ~~OPS-01~~ ✅ · ~~RESHAPE-FIX-WAVE3-PHASE2~~ ✅ | **Wave complete 2026-07-22.** Silent-failure class closed *for the reshape path*. See W1b — it recurred in the enricher. |
| **W1b + W1c** ✅ | **Generator correctness + Plan Generator v2** — the plan itself was wrong; now rebuilt | GEN-FIX-00…12 + PV2-A…I / CD-1…CD-13 | **✅ SHIPPED 2026-08-06 → feature-registry** (2 rows). All engine/code fixes + all 13 coaching decisions verified (411 tests + tsc + 414,720-plan sweep → 0 violations); User A's plan regenerated live + push delivered; founder note declined. Three input-gated follow-ups remain (PV2-G Monday-race, PV2-E HealthKit braces, PV2-H end-to-end verify) — see the collapsed *Plan generator v2 remediation* section below. Source: `docs/incidents/2026-08-06-plan-defects/analysis.md`. |
| **W1d** ✅ | **Session catalogue correctness** — what the engine is *allowed to prescribe* was never audited | SC-00…SC-10 (see § below) | **Opened 2026-08-19** by the Coaching Board ruling on the catalogue audit. W1b/W1c fixed how plans are *generated*; nobody had examined the *catalogue they are generated from*. Two live defects (SC-00, SC-01) block everything else in the wave. Same class as W1b: correctness in the one thing we sell. |
| **W2** ✅ | **Pre-acquisition commercial hygiene** — must land before any paid spend | ~~MON-TRIAL-01~~ ✅ · ~~HR-SYNC-04~~ ✅ | **Wave complete 2026-08-06.** Intro trial de-stacked; conversion re-measure pending installs. |
| **W3** | **Complete & deepen what shipped** — highest value-per-effort | ~~MAINT-02~~ ✅ · POST-RUN-REFRAME-02 | Finish the half-built PAID value. Voice-vendor decision gates REFRAME-02. |
| **W4** | **Competitive access** — start clocks now, build on evidence | CA-08 (Garmin) · CA-02 (Apple Watch) · POST-RUN-03 · Strava-secondary-source | Provisioning/approval clocks are no-regret NOW; L-effort builds gated on acquisition being scheduled. |
| **W5** | **Product bets, evidence-gated** — don't pull until the named trigger fires | R18 · R22 · R24 · R26 · ENGINE-03/CA-05/R27 · CA-07 · **WIZARD-REDESIGN** (CI-1/CI-2/UX-WIZARD-01/CI-4/CI-7) · **FORMS-PRIM-01** · CO-ONE sheet · AI-DEPTH-06 · AI-DEPTH-09 · R19 · R21 · Supplementary slots · Zone-method selector · GTM-11 · DS-04 | Each has an explicit trigger. Building ahead of it is building for a user who doesn't exist. |
| **W6** | **Debt & cosmetic** — fill gaps between waves; none blocks anything | ~~DS-06~~ ✅ · DS-07 (table rename) · Universal Links · BRAND-02/03/05/07/09/11/13 (~~08-pwa~~ ✅) · Vercel project rename · Tier-divergent rendering utility · FMT-02 · R23-D1 · R23-D3 · **UX-ZONES-01** · **UX-SESSION-GLYPH-01** · **V2-POLISH-01** | No-regret cleanup; slot opportunistically. |

> **Wave ordering note (2026-08-19).** W1d slots *ahead of* W3–W6 for the same reason W1b did: it is live-defect work on the product's core claim. W3+ do not start until W1d's blocking pair (SC-00, SC-01) is closed and the CORRECT-ruled items are through. W1d does **not** block the GTM/marketing workstream, which runs in parallel.

**Two net-new decisions this review surfaced (weren't in the docs before):**
1. **W0 instrumentation is a first-class line, not an afterthought** — four backlog items (ENGINE-03, CA-05, CA-07, CO-ONE) have numeric gates and nothing currently counts. New item `INSTRUMENT-01` below.
2. **Start the Garmin + Apple Watch clocks now** — Garmin dev-program approval takes 4–8 weeks; Apple Watch provisioning is the widget-extension family of pain. Both are no-regret to *begin*; the build waits (W4).

> **Wave 5 is a holding pen, not a queue.** Items there are ordered by the board's value read but every one is trigger-gated — see each item's detail for its specific gate. When a gate fires, that item promotes to the front of the next buildable wave.

> **Outside the waves — the v1.1 launch bundle.** The `NOW § A–D` items still marked ⏸️ (DSA/EU trader compliance, `STRIPE_*` env vars, the Stripe product + price) are deferred *as a unit* to the v1.1 web/EU launch, gated on the "turn on non-iOS acquisition" decision — not on any wave. They're a release gate, not feature-wave work, so they carry no `[Wn]` tag. When v1.1 is scheduled they move together.

---

## Native release batching — NATIVE-BATCH-01

**Principle.** Zonna loads the web app from Vercel (`server.url`), so ~everything ships instantly via web deploy with **no** App Store submission. Only *native-layer* work needs a new binary: Capacitor plugins, Swift/native code, entitlements, `Info.plist`, capabilities, app icon/splash, extension targets. **Every native binary costs one App Review cycle (~1–2 days).** So native work is *batched*, never shipped piecemeal — and each submission runs a fixed pre-flight checklist, because the silent-plugin-drop regression class (background push + widget both died on a raw `cap sync`, 2026-08) only bites native builds.

**Pre-submission checklist — run on EVERY native submission (do not skip):**
1. `npm run sync:ios` — **never** raw `npx cap sync ios` (it wipes local plugins from `packageClassList`; the wrapper re-adds via `scripts/fix-cap-config.mjs` then verifies). Confirm `[verify-cap-config] OK`. Local plugin list: `scripts/local-ios-plugins.mjs`.
2. Confirm required entitlements are in **both** `App.entitlements` (Debug) and `AppRelease.entitlements` (Release/TestFlight/App Store) — they diverge (dev vs prod `aps-environment`) and Xcode's capability UI often edits only one file.
3. **On-device smoke before archiving** (Xcode ▶ to a tethered iPhone — *not* the simulator) for anything the simulator can't exercise: background HealthKit delivery, real APNs, HR streams, widget.
4. **ASC ↔ binary parity:** any App Store Connect product/config change must match the binary in the *same* submission (e.g. MON-TRIAL-01 intro-trial removal) or it's a §3.1.2 rejection vector.
5. `APNS_PRODUCTION=1` in Vercel (already set — App Store/TestFlight builds register production APNs tokens; sandbox tokens are rejected by the prod server and vice-versa).

**Current native release (in flight, 2026-08):** background run-analysis push regression fix + duplicate-push dedup + relights the home-screen widget (`SharedStorePlugin`) — both were disabled by the same `cap sync` plugin-drop. Carries the new `com.apple.developer.healthkit.background-delivery` entitlement. **Do MON-TRIAL-01 (ASC config) at this submission** (W2).

**Batchable native items — group so each doesn't burn its own review cycle:**

| Item | Wave | Native surface | Readiness |
|---|---|---|---|
| **Universal Links** | W6 | Associated Domains entitlement (capability enabled in portal 2026-05-08) + AASA file at `zonna.run/.well-known/apple-app-site-association` (ships via web) | **Unblocked** — `zonna.run` is live. Most shovel-ready; biggest trust/UX win for the least native effort. |
| **POST-RUN-03** rich-media zone push | W4 | New Notification Service Extension target (own bundle ID `app.zonna.ios.NotificationService` + provisioning) | ~2–3 native days. The web image route can be built + validated first with no binary. |
| **POST-RUN-REFRAME-02** voice memo | W3 | Capacitor mic plugin + `Info.plist` `NSMicrophoneUsageDescription` | Gated on the OpenAI/Whisper vendor decision — resolve before it enters a batch. |
| **CA-02** Apple Watch app | W4 | New WatchKit/SwiftUI extension target + provisioning | **Its own release, not this batch** — L effort, no spec yet. Start portal provisioning now; build after `/slt-review` + `/frontend-design`. |

**Sequencing.** Ship the current fix now — it's a live-bug fix; do not hold it for feature work. The **next** native batch = **Universal Links + POST-RUN-03** (one review cycle); REFRAME-02 joins once the vendor call is made; CA-02 warrants its own release. Each still runs the checklist above. **Web-first where possible:** POST-RUN-03's `next/og` image route and the Universal Links AASA file both ship via Vercel *ahead* of the binary, so the native submission carries only the thin native shim (validate the web half on PWA first).

> Full per-item specs live in their own W-tagged entries below/above — this item is the release-coordination layer over them, not a duplicate spec.

---

## NOW — Critical path to App Store submission

Everything in this section blocks v1 launch. Group A (legal/policy) and Group D (external setup) can run in parallel with Groups B (engineering) and C (env config). Group E (QA) must follow.

### A. Legal & Apple compliance

- ⏸️ **DSA trader compliance** — EU Digital Services Act requires Apple to display verified trader contact info on EU listings (name, deliverable street address — no PO Box, phone, email — all become public). Selling subscriptions = trader by default. **EU deferred to v1.1+ (decision 2026-05-21).** v1 ships US/UK/anglosphere only — neither requires trader disclosure. Switching EU on later is a 30-min ASC config + 1–2 week verification wait — fully reversible. Address strategy when revisited: virtual office (~£25–£40/month, serviced office that accepts post for Apple verification) is the leading default for a solo founder. Home address rejected — publicly listed forever, privacy downside doesn't unwind. Ltd only if incorporating anyway for tax/liability/fundraising reasons.

### B. Engineering blockers

- 🔲 **[W4]** **Strava as secondary source** *(post-launch)* — once HealthKit is primary, keep Strava OAuth + webhook + `strava_activities` writes alive but optional. Dedupe rule: if a HealthKit workout and a Strava activity match within ±5 min and ±5% distance, prefer the source with HR stream data; otherwise prefer HealthKit (always present on iOS). Apply for Strava API approval in parallel — not blocking v1. **Ingest-time dedup rule SHIPPED 2026-05-30 (INGEST-DEDUP-01).** `consolidateIncomingHealthKitRow` (`lib/coaching/healthkitConsolidate.ts`) runs on the HealthKit ingest path (`/api/health/ingest`): if a Strava row or another HealthKit row already covers the same run (±5 min / ±5%, tighter than the ±15/±15% enrich path because suppressing a row is destructive), the incoming HK row is skipped (no delete, no FK re-pointing — the existing row stays canonical), lifting the HR summary onto the canonical row first if it lacked one. This is the symmetric partner to the pre-existing `tryEnrichHealthKitRow` (Strava-arrives-finds-HK). Pure decision unit-tested in `healthkitConsolidate.test.ts`. The 2026-05-23 backfill dupes were cleared by the one-time `scripts/cleanup-dupes.mjs` sweep. **R25 cohort cuts 2–3 are now safe** from cross-source double-counting. The same decision also guards the self re-sync case: re-ingesting an *already-enriched* HK workout (same `apple_health_uuid`, Strava id patched on) is now skipped rather than upserting `strava_activity_id: null` over the link + overwriting the Strava HR.
  - **Verify still open:** `test -f app/api/webhooks/strava/route.ts` → plumbing is live (verified 2026-08-15). Open condition is **external**: Strava API approval still pending.
- 🔲 **[W6]** **Universal Links** (defer until production domain is live) — replace custom URL schemes with `https://` deep links. Needs `apple-app-site-association` file at the domain root + Associated Domains entitlement in Xcode. Associated Domains capability enabled in Apple Developer portal 2026-05-08; awaiting custom domain. Better trust + UX than custom schemes; not blocking v1.
  - **Verify still open:** `ls public/.well-known/apple-app-site-association` → **absent = still open** (verified absent 2026-08-15). Also needs Associated Domains in Xcode.

### C. Vercel env config

- ⏸️ `STRIPE_SECRET_KEY` — **deferred to v1.1 (2026-05-21).** iOS-only launch.
- ⏸️ `STRIPE_WEBHOOK_SECRET` — deferred to v1.1.
- ⏸️ `STRIPE_PRICE_MONTHLY` + `STRIPE_PRICE_ANNUAL` — deferred to v1.1.

### D. External setup

- ⏸️ **Stripe product + price** — "Zonna Premium", £7.99/month + £59.99/year, 14-day trial. **Deferred to v1.1 (2026-05-21).** iOS-only launch; revisit ~2 weeks post-launch alongside marketing-site public flip + non-iOS acquisition.

---

## NEXT — First wave after App Store ship

**SLT-reviewed 2026-06-06. Priority stack below reflects board consensus.** (Wave 1b + 1c plan-generator remediation shipped 2026-08-06 → feature-registry.)

| Priority | Item | Effort | Tier |
|---|---|---|---|
| 1 | POST-RUN-REFRAME-02 — Voice memo (after vendor decision) | M | PAID |
| 2 | CA-02 — Apple Watch (dedicated sprint) | L | FREE/PAID |
| ⛔ | ENGINE-03a — Cycle false positives (DEFERRED behind gates — SLT 2026-06-22) | S | FREE |
| ⛔ | CA-05 — Cycle coaching (DEFERRED on ENGINE-03) | M | FREE |

*ENGINE-03a + CA-05 (cycle-aware coaching) — **SLT-reviewed 2026-06-22: build differently, deferred behind two gates.** The cheap no-data precursor (ENGINE-03-pre, RHR noise-hardening) shipped and fixes the same false-positive root for everyone. The cycle-specific native bridge waits for (a) usage evidence that female users with cycle data have mis-firing readiness, and (b) incorporation + insurance (reproductive-health data). Moat stays visible on the roadmap. Tier MUST be FREE (INV-DATA-001). Full steer in the ENGINE-03 detail below.*

### Plan generator v2 remediation — GEN-FIX (Wave 1b) + PV2 (Wave 1c) — shipped 2026-08-06 → feature-registry

*Full reasoning + the byte-for-byte defect register in `docs/incidents/2026-08-06-plan-defects/analysis.md`; signed coaching decisions in `docs/decisions/coaching-register-2026-08.md` (CD-1…CD-13).*

**Three open follow-ups remain — each input-gated, not effort-gated:**

| Item | Package | Blocked on | Effort | Tier |
|---|---|---|---|---|
| **PV2-G / CD-7 full** | The *Monday-race* case (no in-week day before the race) — needs the cross-week `buildRaceArc` restructure. In-week (Tue/Wed) case already shipped (`53a1372`). | An **ADR** for the race-arc builder. | M | FREE |
| **PV2-E / CD-6 braces** | HealthKit-verify half — wizard tempers declared volume toward the synced 4-wk average (ADR-011 path). Absolute `<6mo` 30km week-1 cap already shipped (`2c0931b`). | HealthKit client verification on device. | S | FREE (+device) |
| ~~**PV2-H end-to-end verify**~~ | ✅ **REMOVED from the backlog 2026-09-15 (founder).** Not engineering work — the living-plan recalibration tile is shipped, tsc-verified and unit-tested; what remained was one manual on-device confirmation (paid account, completed time trial in a recovery week, check the tile appears and the paces move). The founder will confirm it in passing. | — | — | PAID |

### Session catalogue remediation — SC (Wave 1d)

*Source: **`docs/decisions/coaching-board-2026-08-19-session-catalogue.md`** (signed ruling CD-14…CD-19) + evidence in **`docs/coaching-review/2026-08-19/session-catalogue-audit.md`**. **WAVE COMPLETE — SC-00…SC-10 all shipped → feature-registry** (SC-00…SC-07/SC-09/SC-10 on 2026-08-20/21; SC-08 on 2026-08-21, generalised and closed 2026-09-03). **Nothing below is open work** — the notes that follow are governance records, kept because each one records a decision that would otherwise be re-litigated. This line previously read "SC-08 is the only remaining item", which was stale for a day and long enough to be repeated as an open thread on 2026-09-04.*

> **⛔ Not backlogged, deliberately: prescribed downhill work (`descent_control`, audit § E.4).** Vetoed by the board on Willy's reasoning (no graded first exposure, inherits an exclusion list written for uphill work, no symptom gate or return-to-run path); Sims concurring on post-menopausal bone loading. Per ADR-017 §3 **this is not overrulable on commercial grounds.** It returns only as a *re-specified* proposal carrying all three of: its own exclusion criteria, a graded first exposure, and a hard prohibition inside the final three weeks with a defined symptom back-off. Do not re-add it from the audit's E.4 spec — that is the spec that was rejected.

> **DECIDED 2026-08-20 — live plans are left as they are. Not an open thread; do not re-raise.** `generateRulePlan` runs only at plan creation (`/api/generate-plan`); `adjust-plan` never re-runs it, so every Wave 1d fix applies to **new plans only**. At the time of the decision that meant 13 plans / 13 users, of which 2 contained VO2max (SC-07 placement) and 2 contained renamed sessions (the SC-08a 31% rep-structure defect), none carrying `catalogue_id`. **Founder's call: no backfill, no prompted reshape, no migration — existing plans stand and the fixes apply going forward.** Recorded so the arithmetic does not have to be redone next time doctrine changes.

> **SC-08 — v2 session-structure schema — shipped, closed 2026-09-03.** Full history and final scope in `feature-registry.md` ("Structure-driven sizing generalised to every threshold/race-pace row"). Not an open thread — `hm_pace_intervals` and the long-run-with-segment shapes remain v1 by design (out of scope, no known gap), not a deferred item.
> **Recorded as not mechanically checkable (ADR-017 §4):** Sims's recovery-duration and masters-threshold findings. **The engine does not collect sex anywhere in the plan inputs** — verified. Record each in the relevant CoachingPrinciples § as a **known gap** rather than leaving it silent.

> **⬆️ SLT escalation, carried by Hutchinson (2 items, both correctness-complete but blocked on data the product does not collect):** (1) **Sex is not collected in the plan inputs.** This blocks sex-aware recovery prescription and a sex-aware masters threshold. Unlike the cycle bridge this is an **ordinary input, not device data** — so it is a **product** decision, not a platform limitation. The board has no view on whether to ask; it notes that continuing without it means **the male trajectory is the default for every runner, and that this is currently undocumented.** (2) The **cycle bridge remains hard-blocked** — the health plugin exposes no menstrual data type (unchanged from ADR-011; see ENGINE-03 above). *Not escalated: the downhill veto (final); SC-00 and SC-01 (engineering); CD-15's free-tier reach.*

### Effort-governed & label-honesty follow-ups — EG / LBL (from the 2026-09-04 Coaching Board)

*Source: **`docs/decisions/coaching-board-2026-09-04-label-dose-effort.md`** (two sittings). **All four rulings are now closed → feature-registry.** Nothing open. Evidence is regenerated by `NODE_ENV=production npx tsx scripts/board-evidence-effort-governed.ts` — **R4 must stay at 0** (the §40b veto's regression tripwire).*

> **EG-01 closed as CORRECT-with-no-code-change.** A distance-anchored rep cannot fill a time-anchored dose band; `intervals_long` reaches its target in 39% of placements and that is the ceiling protecting slower runners, not a defect. Recorded in §8. **Both proposed remedies were rejected** — re-specifying the row's rep length would delete the session (SC-08 makes rep length the stimulus identity), and a target-reachable selection preference measured as unimplementable without breaking §53 (a plan draws exactly 3 VO2max sessions, one of each row; at 10K only two rows are eligible, so any effective preference produces 3/0 and leaves `intervals_long` unpicked — the exact CAT-ULTRA-THIN-01 failure). **Do not re-propose either without new measurement.**

### §79 / §80 follow-ups (from the 2026-08-31 returning-runner wave)

*Parent work shipped 2026-08-31 → feature-registry (three rows: §79 Phase 1, §79 Phase 2, §80 Phase 3), all verified on device 2026-09-02. **§79-PEAKKM and §79-INTENSITY-ROUTING both closed 2026-09-02** — board ruled on each, engine fixed, → feature-registry. No open remainder.*


*(§52 follow-ups and SWEEP-COVERAGE-02 all closed 2026-09-02 → feature-registry. No open items.)*


### Instrumentation (Wave 0)

*(no open items — INSTRUMENT-01 shipped + verified 2026-07-22 → see feature-registry. `analytics_events` table + `trackEvent` + four report views live; three gates (CA-07, MON-TRIAL-01, HR-SYNC) answerable by query, CO-ONE's `coach_open` event verified end-to-end. First reading: 27.3% of runs have HR at first query — corroborates HR-SYNC-04.)*

### Competitive analysis follow-ups (CA-01…)

*Source: `docs/gtm/competitive-positioning-analysis-2026-06-03.md` (Start/Stop/Continue + gap analysis). Ordered by SLT priority. Each needs FREE/PAID confirmed before build. The headline insight: the **wedge moment** — free user, fresh install, no Strava — is the most under-served experience in the product, and the single biggest commercial lever (CA-01). The **Apple Watch gap** (CA-02) is the biggest competitive table-stakes hole. Protect the **reframe risk gate** above all (it's the most defensible asset).*

- 🔲 **[W4]** **CA-02 — Apple Watch companion app (thin)** *(biggest competitive gap)* — Runna/Coopah/TrainAsONE all ship one; iPhone-only + HealthKit indirection is a category outlier reviewers will flag. MVP scope: **today's session + zone target + HR band on the wrist + one-tap start.** No coaching, no logging, no AI on-watch at MVP — just the prescription where the runner needs it. Reuses the `SharedStorePlugin` App-Group bridge pattern already used by the widget extension (`group.app.zonna.ios`). Competitive necessity, not differentiation. **Tier: FREE for prescription display / PAID for any analysis surface.** Effort: L (native, new WatchKit/SwiftUI extension target — widget-extension family of provisioning pain). Interim mitigation before it ships: pre-empt the question in the App Store description ("Apple Watch via Apple Health"). Sequence after TestFlight is exercising production APNs. **SLT: dedicated sprint, not before #1–5. Scope is locked — do not expand at MVP. Start provisioning setup in Apple Developer portal now.**
  - **Verify still open:** `find ios -iname '*Watch*' -maxdepth 3` → no WatchKit target = still open. **Gate:** not before TestFlight has exercised production APNs.

  > **Board note:** The restraint of what's *not* on the watch face is the product. Zone target + HR band + one-tap start. Nothing else. The friction-free start is where the real coaching happens — what the runner sees in the first 10 seconds of a run changes their behaviour for the next hour.

  > **Spec status (audited 2026-06-23):** Scope is locked at MVP level (above) — but **there is no engineering spec or design doc**. Missing before build: (a) WatchKit/SwiftUI architecture, (b) Watch-side screen layouts (no `frontend-design` pass done), (c) the SharedStorePlugin App-Group contract for what fields get written, (d) the one-tap-start handshake to the phone. Effort estimate is L = ~1–2 weeks of focused native work plus provisioning, in the team's effort vocabulary (M ≈ ~3d per POST-RUN-REFRAME-02). **Pre-build path:** Apple Developer portal provisioning is the only thing that should happen now; everything else waits for a spec pass (`/slt-review` on detail + `/frontend-design` for watch screens) before the sprint opens.

- ⛔ **[W5]** **ENGINE-03 — Cycle data → fix readiness false positives (prerequisite for CA-05/R27) — BLOCKED + DEFERRED behind gates (SLT 2026-06-22)** — **SLT steer (full review 2026-06-22):** *build differently.* (1) The cheap, no-cycle-data precursor **ENGINE-03-pre shipped 2026-06-22** — RHR no longer softens a session on a single elevated reading (persistence-or-corroboration); this fixes the same luteal false-positive root for **all** users without any reproductive-health data → see feature-registry. (2) Do **not** build the cycle-specific native bridge yet — defer behind **two gates**: **(a) usage evidence** — instrument whether real female users with cycle data actually have mis-firing readiness (don't build for an imagined cohort); **(b) entity/liability** — incorporate + insure before reproductive-health data enters the stack (Traynor's hard line; aligns with the pending LoGlide conversion). (3) **Tier MUST be FREE** — a PAID cycle feature would *require* HealthKit cycle data, violating INV-DATA-001. (4) **Keep the moat visible on the roadmap** — the competitive value is partly captured just by it being a visible roadmap item; the native bill can wait. (5) When built: ship the silent fix alone first, **confidence-gated** (Hutchinson: a wrong phase estimate would suppress a *genuine* readiness flag — a false negative, the more dangerous error; only mute a *marginal* RHR signal, never override a strong one). Sutherland's reframe: *the moat is the silence, not the note.* — Original blocker + spec retained below. **prerequisite check failed: `@capgo/capacitor-health@8.4.8` cannot read menstrual/cycle data.** The plugin's `HealthDataType` union (`node_modules/@capgo/capacitor-health/dist/esm/definitions.d.ts`) exposes steps/distance/calories/HR/RHR/HRV/sleep/etc. but **no menstrual, cycle, luteal, period, ovulation, or reproductive-health type** — iOS HealthKit's `HKCategoryTypeIdentifierMenstrualFlow` is not surfaced. There is no data path for the luteal-phase RHR suppression this feature depends on. **To unblock:** fork/patch the plugin with a custom Swift bridge exposing the reproductive-health types (iOS; Android Health Connect TBD), ingest a `cycle_phase` to `health_daily_samples`, then build the suppression. Until then ENGINE-03a (and CA-05 downstream) cannot ship. The readiness_signal trigger itself works correctly on RHR/HRV/sleep (CoachingPrinciples §59); this is purely the cycle-aware refinement that's blocked. Board note stands: the science (luteal RHR +2–5 bpm) is sound — only the data is missing. Original spec retained below for when the bridge exists. ~~luteal phase naturally elevates RHR by 2–5 bpm, which trips false-positive `readiness_signal` triggers (engine softens quality sessions that didn't need softening). Phase 1: use HealthKit menstrual data to SUPPRESS readiness_signal when RHR elevation is within expected luteal range.~~ Phase 2: proactive phase-transition note ("RHR may run a little high this week — your zones don't change, but readiness might"). **Architecture impact**: `readiness_signal` builder gets a `cyclePhase` input field; when `cyclePhase === 'luteal'` AND `isElevatedRHR` is within expected range (2–5 bpm), suppress the trigger. The note is informational, NOT a plan change. **Critical voice rule**: engine never mentions the menstrual cycle in output copy — it surfaces "recovery signals may be elevated" and uses the data silently to improve accuracy. "Matter-of-fact, never patronising" (R27 doctrine). **What it must NOT do**: auto-change plan based on cycle phase alone; change zones; generalise individual cycle patterns before personal history exists. **Two distinct use cases**: (a) fix false positives = ship first, no voice risk; (b) proactive coaching notes = requires voice spec review first. **Tier: FREE for (a) as a trust/accuracy improvement; PAID for (b) as coaching intelligence.** Effort: (a) S — add cyclePhase to readiness input, suppress condition in builder; (b) M — phase transition detection + note generation. Depends on HealthKit menstrual data query support in `@capgo/capacitor-health`. **Analysed 2026-06-04. SLT priority #6 (ENGINE-03a only — fix false positives first, voice coaching second).**
  - **Verify still open:** `grep -ci 'menstrual\|cycle' node_modules/@capgo/capacitor-health/dist/esm/definitions.d.ts` → **0 = still hard-blocked** (no data path). **Gates:** (a) usage evidence of real mis-firing readiness, (b) incorporation + insurance.

  > **Board notes:** This is a correctness fix, not a feature. False positives train users to ignore the app — every wrong coaching recommendation is a habit break. The suppression threshold (2–5 bpm above baseline) is scientifically grounded; do not widen it. **Verify `@capgo/capacitor-health` menstrual data support before committing to this sprint.**

- ⛔ **[W5]** **CA-05 — Cycle-aware coaching, thin slice** *(highest-leverage moat — DEFERRED behind ENGINE-03 gates, SLT 2026-06-22)* — a **single** matter-of-fact coaching note per phase shift ("RHR may run a little high this week — your zones don't change, but readiness might"). **SLT steer:** depends on the cycle bridge (ENGINE-03), which is deferred behind the usage-evidence + incorporation gates above; and the *note itself* is the risky part (Sutherland: naming the cycle can break the "uncanny restraint" magic and trip a creep-out reflex — the moat is the silence, not the note; Wood: must be truly once-per-shift or it becomes biology-monitoring, not habit). Build only **after** ENGINE-03 ships, and only after a voice review that guarantees once-per-shift silence. **Tier: FREE** (brand moat; PAID would violate INV-DATA-001). Effort: thin slice M (full R27 is L).
  - **Verify still open:** Blocked downstream of ENGINE-03 — re-check that gate first, then a voice review guaranteeing once-per-shift silence.

  > **Board notes:** Activation must be completely passive — HealthKit menstrual data syncs automatically; no wizard opt-in question needed if the data is already present. The feature activates silently when the data is present. Do not add a toggle or a settings row. This is the most counterintuitive product decision on the backlog: a running app that pays attention to specific human biology without asking for it. That's the thing competitors won't do.

- 🔲 **[W5]** **CA-07 — "Ask Kit about this run" (hold — needs product decision)** — *not* coach-chat. One capped, per-analysed-run "explain this further" affordance. Decision required before scoping. **Tier: PAID.** Effort: M. **SLT: hold until 50+ paying users. Build for actual questions, not imagined ones. Do not invite this before then.**
  - **Verify still open:** **Gate: 50+ paying users** (count the `subscriptions` table). Do not invite this before then.

### Competitive UX — Planzy / Runzy set (SLT 2026-08-29)

*Source: founder review of Planzy (6 screens) + a described Runzy chatbot. Full ruling: `docs/decisions/slt-2026-08-29-planzy-ux.md`. **Engineering scope + board brief: `docs/investigations/competitive-ux-scope-2026-08-29.md`** (current-state facts, per-item scope, the decisions each board must make — a living doc that absorbs incoming competitor analysis). Evidence: `docs/investigations/planzy-*.png`. Two Planzy screens (profile / data-source toggles) were dropped — Zonna already has the equivalents and Garmin/Apple Watch direct sync is not buildable (ADR-011).*

### 🔥 Coach crash, 2026-09-11 evening — React error 310

- ✅ **HOOKS-ORDER-01 — FIXED 2026-09-11 (`d1f40b1`), DEPLOYED 2026-09-12, and CONFIRMED WORKING ON DEVICE by the founder 2026-09-12.** The confirmation matters more than the deploy did: the crash only ever hit accounts with enough history for the aerobic trend to return, which is the one path no harness here can reach — it is why it could not be reproduced in the first place.** The fix sat committed and unreachable for 20 hours because the deploy cap was hit minutes before it landed (DEPLOY-QUOTA-01) — Coach went on crashing for a full day after it was fixed. The Coach screen crashed to the error boundary on **every** load.
  - **`TrendCard` called `useCountUp` twice at the BOTTOM of the component**, below the skeleton / locked / pending early returns. `useCountUp` is itself a hook containing **five** hooks (2 `useState`, 2 `useRef`, 1 `useEffect`). So the component rendered **1 hook in skeleton state and 11 in live state**. On Coach it mounts as `skeleton` while the aerobic trend is fetched and flips to `live` when it lands — `1 → 11` hooks on the next render is exactly what React error 310 names, and it takes the whole screen down.
  - ⚠️ **It only ever hit runners with enough history for the trend to RETURN.** A runner whose trend never resolves stays on the skeleton branch forever and never sees it. **That is also why I could not reproduce it:** in a scratch harness the trend fetch 401'd for want of a session, so the card never left skeleton and the hook count never changed. I was faithfully reproducing the one path that cannot fail.
  - Fix: both calls hoisted above every early return, reading live fields through a narrowed local (`props` is a discriminated union on `state`). **`useCountUp`'s deps changed `[]` → `[target, duration]`, and that is required, not tidying** — hoisted above the returns a skeleton render passes target `0`, and with `[]` the animation would run to zero once and never move again.
  - 🔎 **HOW IT WAS FOUND, and this is the reusable part.** `eslint-plugin-react-hooks` is **already installed** as a Next dependency, but **no eslint config exists in this repo**, so `rules-of-hooks` had never run over this code. One targeted run named the exact two lines in seconds, after an hour of reading diffs found nothing. **An entire class of crash is invisible to every gate we have.**

- ✅ **COACH-NULLWEEK-01 — FIXED and DEPLOYED 2026-09-11.** Separate, real, and found on the way: `getCurrentWeek` returns `past ?? weeks[0]`, which is `undefined` for an empty array, and the Coach block optional-chained `currentWeek` on one line then dereferenced it raw on the next two. Reproduced against the real function. Coach is the only screen that derives a week and dereferences it. Guard: `currentWeekGuard.test.ts`.

- ✅ **ERRORBOUNDARY-MESSAGE-01 — FIXED and DEPLOYED 2026-09-11.** The boundary had **always captured `error.message` into state and never rendered it** — the app knew exactly what had failed and showed "Something went wrong." A whole session went on a crash the screen could have named in one line. Now renders the message, offers **Copy details** (message + component stack), and names chunk errors ("The app updated while you had it open") which is the one case where reloading really is the instruction. Also dropped `data-theme="dark"`, dead since ADR-008.

- ✅ **HOOKS-LINT-01 — SHIPPED 2026-09-12.** `.eslintrc.hooks.json` (only `react-hooks/rules-of-hooks`, `noInlineConfig` so it cannot be silenced inline) + `npm run verify:hooks`, placed after `typecheck` in the chain. **No baseline was needed** — HOOKS-ORDER-02 was fixed first, so it ships with an empty debt register. Liveness-proved both directions on every run by `lib/hooksGate.test.ts`. *(Original entry, P1, small)* — the gap that let the above ship. `eslint-plugin-react-hooks` and `eslint` are both already installed; there is simply no config. A run over `app/` + `components/` currently reports **TodayScreen's violations plus nothing else** (TrendCard now clean). Needs a config that enables ONLY `react-hooks/rules-of-hooks` (the repo has deliberately never adopted a full lint config, and this should not smuggle one in), plus a baseline for TodayScreen until HOOKS-ORDER-02 lands. **Tier: FREE (infra).**

- ✅ **HOOKS-ORDER-02 — FIXED 2026-09-12.** The guard moved BELOW the last hook (not fourteen hooks hoisted above it), and the four `currentWeek` reads in between made defensive. ⚠️ **The real crash line was `parseLocalDate((currentWeek as any).date)`, which calls `.split` on its argument and throws a TypeError before React's hook-order error can fire** — two bugs on one line, and `as any` is why the compiler never said so. `plan.weeks[0]` carried the identical throw and was fixed with it. *(Original entry, P1)* — `if (!currentWeek) return (…)` at `DashboardClient.tsx:6620`, followed by **fourteen hooks** (`useState` ×5, `useMemo` ×4, `useRef` ×2, `useEffect` ×2, `useCallback` ×1). It fires whenever `currentWeek` flips between renders — the same condition COACH-NULLWEEK-01 guards against elsewhere. **Latent, not live**, which is why it was filed rather than rushed in while Coach was down. Fix is to move the early return BELOW the hooks, not to hoist fourteen of them. **Tier: FREE.**

- 🔴 **DEPLOY-QUOTA-01 — Vercel Hobby caps at 100 deployments per rolling 24h, and it was HIT** *(founder decision)* — confirmed by the platform: `Resource is limited - try again in 24 hours (more than 100, code: "api-deployments-free-per-day")`. **80 commits in one day, each push triggering a build.** Deployments then stop **silently**: no failed builds, every existing one reads `● Ready`, pushes simply produce nothing. Cost an hour of shipping fixes into a void while the founder reported "still crashing".
  - **Working practice from now on: BATCH commits into one push.** Pushing after every commit is what burned it.
  - **A push is not a deploy** — verify with `npx vercel ls zona` or by fetching a string unique to the new build out of the served chunk, before saying a fix is live.
  - ⚠️ **`.vercel/project.json` was linked to the DEAD `rts-training-hub` project**, so `vercel --prod` deployed there and failed for want of env vars — and I nearly reported that failure as the outage's root cause. Re-linked to `zona`. Verify with `npx vercel env ls production`: `zona` has env vars, `rts-training-hub` has none.
  - **Founder's call:** wait for the rolling reset, or move to Pro.
  - ✅ **The 2026-09-11 incident is closed.** The rolling window reset and HOOKS-ORDER-01 went to production on 2026-09-12 via `npx vercel --prod` (verified: new deployment is the one aliased to `www.zonna.run`, and it was built from a clean tree at `3ed202a`). **The item stays open for the Hobby-vs-Pro decision only** — nothing about the cap itself has changed, and the batching practice above is now the standing rule.

### 🩺 Founder test pass, 2026-09-11 — UX review for the Make-A-Wish demo

*Ten observations from using the app and site. Analysed as UX, not as tickets: root cause named in code where there is one. Audience for all of them is a BEGINNER on 10K / HM / marathon.*

- ✅ **MAINT-LABEL-01 — CLOSED 2026-09-11, both halves.** Copy closed on a second pass; the `volume_profile` VALUE went to the Coaching Board (MAINT-PROFILE-01), which **dissolved the filed question and found a real defect underneath it** — shipped as §106. Two sub-questions were deferred by the chair and are filed below as their own items, not as this one being unfinished.
  - ⚠️ **THE FIRST COPY PASS WAS INCOMPLETE AND I REPORTED IT AS DONE.** It rewrote the lopsided-week variant only. Reading what the engine actually emits across the 621-plan grid, **the sentence the founder objected to was still shipping** — *"Plan maintains current fitness rather than building it"* — on 5K through marathon, to beginners, in two other note families.
  - ⚠️ **And those notes named DATABASE FIELDS in the remedy:** *"increase `days_available` from 4 to 5"*, *"raise `max_weekday_mins` from 30 to 90"*. Identical defect class to UX-BEGINNER-01, which was fixed in `inputs.ts` the same morning and missed here. Now: *"run 5 days a week instead of 4"*, *"give your weekday runs more room — you have capped them at 30 minutes"*.
  - 🔴 **A THIRD DEFECT, THE WORST, FOUND THE SAME WAY — the engine was telling runners "Peak long run 0 km".** §24's floor read `s.distance_km ?? 0`, and a beginner's plan is **duration-anchored** (`duration_mins` set, `distance_km` null), so a **132-minute long run measured 0 km**, `lrFails` was unconditionally true, and the note stated a falsehood. **Measured: 45 of 135 HM/marathon time-target plans (33.3%).** Fixed via the new single owner (SESSION-KM-01). It now reads *"Peak long run 16.5 km is below the 17.9 km floor"* — true, and the maintenance classification it produced was **correct all along**. `cohort:shape` confirms: maintenance 49.8%, per-distance identical. **The reason was false, not the verdict.**
  - **A fourth, surfaced by the rewrite itself:** the "defer the race" remedy fired whenever the long-run or volume floor failed, so a runner with exactly enough runway was told *"current 16, recommended ≥16"* — advice to change nothing. Invisible while the copy was schema-shaped; obvious the moment it read as a sentence. Now gated on the weeks actually being short.
  - Guard: `lib/plan/noteVocabulary.test.ts` over the whole generated corpus — **no runner-facing note may contain a `GeneratorInput` field name** (the field list is DERIVED from the type declaration, never listed, so a new input joins the guard the day it ships) and none may tell a runner their plan will not build them. Both falsification-tested to RED. Golden-plan snapshots updated deliberately after confirming the only diffs were note strings.
  - ✅ **RESOLVED 2026-09-11 by Coaching Board MAINT-PROFILE-01 (§106) — and the answer was not the one filed.** Full analysis is in the sitting; the short version is that the investigation dissolved its own question and found a real defect underneath it.
    - **Three of the four things I filed were withdrawn at the conflict scan**, because the constitution already answers them: §45 says outright *"when the §24 floor cannot be reached without violating this cap, **this principle wins** and the plan downgrades to maintenance"*; §23 and §46 both anticipate their thresholds being unreachable and name maintenance as the outcome. The five invariant exemptions are each the principle's OWN prescribed remedy, not a loophole. CD-21's §1 intensity exemption suppresses **zero** violations in 621 plans — it is inert.
    - 🔴 **What was real: the peak ceiling is VOLUME-BLIND.** `peakKmByLevel` reads distance and level and never asks what the runner already runs. Measured: an experienced marathoner declaring **100 km/week** was handed a block starting at 76 km and peaking at **73** — below their current volume in both directions. §23 then correctly failed it and labelled it maintenance, so **every honesty layer worked perfectly on a plan that should never have been built**. §23/§46 license maintenance when THE RUNNER'S constraints prevent overload; ours was binding, not theirs.
    - **And the ceiling was ungoverned.** 18 coaching numerics in `lib/plan/length.ts`, outside `GENERATION_CONFIG` — no principle, invisible to `configPrincipleSync`, no coaching-guard hook. Moved in the same commit.
  - 🔴 **MEASURED 2026-09-13 — THE RULING'S MECHANISM DOES NOT EXIST. NOT SHIPPED. Brief: `docs/investigations/marathon-maint-label-01-measurement-2026-09-13.md`. Detector: `npx tsx scripts/measure-marathon-maint-label.ts`.**
    - 🔴 **`LONG_RUN_CAP_MINUTES` is not the blocker.** At the easy pace the engine derives for this cohort (6.26 min/km) the 210-minute cap buys **33.5 km — above** §24's 31.7 km floor, at every volume from 50 to 110 km/wk. The board's own worked example (80 km/wk, 30.5 km long run) sits at **191 min against a 210-min cap**: 19 minutes of headroom. The real limiter is **§45's week-on-week long-run growth cap**, which the shipped note already names out loud.
    - 🔴 **Implemented exactly as ruled, it flips ZERO plans** (maintenance stayed 135/135). The sets are disjoint: all 45 plans at the 210-min ceiling are beginners who also trip §46/§23; all 27 plans failing §24 ALONE sit at 64–79% of their ceiling. Reverted rather than shipped — SESSION-KM-02's brief already recorded the rule for this exact situation: *do not ship it, it reads like a fix and is not one.*
    - 📐 **The ~100% is not §24's doing.** Correctly attributed (a first pass over-counted §52 because the PRESCRIPTION text contains "days a week"): §23+§24 28.9%, **§24 alone 20.0%**, §46 15.6%, §23 13.3%, §46+§24 6.7%, §23+§46 4.4%, §52-structural 11.1%. A corrected exclusion reaches **20%, not ~100%**.
    - ⚖️ **And for those 20%, maintenance looks CORRECT.** They are `experienced`, 6 days, 20–50 km/wk, with a longest recent run of 7–17.5 km. §45 stops them reaching 31.7 km because a runner whose longest run is 17.5 km cannot safely build to 31.7 km in the weeks available — a readiness signal, not an artefact. §24's ratio is also mainstream (0.75 × 42.2 = 31.7 km is the conventional 20-mile peak; Pfitzinger/Daniels).
    - 🆕 **The one unambiguous defect found:** at **110 km/wk the peak long run is 31.5 km against a 31.65 km floor** — labelled maintenance by **150 metres**. A rounding artefact deciding a cohort. Candidate: one `DISTANCE_ROUNDING_PRECISION_KM` step of tolerance on §24's floor.
    - ✅ **RESOLVED — Coaching Board second sitting, 2026-09-13.** `docs/decisions/coaching-board-2026-09-13-marathon-maint-label-reopened.md`. **(1)** Substituting §45 ruled **INCORRECT** — §45 already legislates the downgrade in its own words; delivery path CLOSED, do not re-file. **(2)** The flat-100% complaint is **utility, not correctness** — escalated to the SLT as a labelling question, since for the 20% where §24 is the sole trigger the label is right. **(3)** The 150-metre artefact ruled **CORRECT** → §24 Amendment 1 SHIPPED (`d4a1229`): the floor comparison allows one `DISTANCE_ROUNDING_PRECISION_KM` step at both enforcement sites. Declared move: maintenance 51.0% → 50.6%, HM −1.8pp, marathon unchanged. **(4)** HM closed by the same ruling.
  - ✅ **HM-MAINT-LABEL-01 — CLOSED by the board 2026-09-13 (second sitting), not built as filed.** The cap-exclusion question is **moot at both distances**: `LONG_RUN_CAP_MINUTES` never binds — measured, 210 min buys 33.5 km against a 31.65 km marathon floor, and HM's 135 min likewise clears its 17.94 km floor. What WAS real is distance-agnostic and shipped for both: §24 Amendment 1's rounding tolerance. HM moved 40.7% → 38.9% maintenance as a result.

- 🔲 **[W5]** **AI-DEPTH-09 — Coach chat (deferred indefinitely)** *(scoped 2026-05-11)* — original audit Step-5 (injury/equipment diagnosis) was recommended for deferral on three grounds: liability surface, off-brand (Zonna is zone discipline, not shoe lacing), and the kit-and-blister advice from Russ's manual session wasn't where the real coaching value lived. If a paid-tier freeform chat is later considered, it slots here as a new gate `coach_chat`. Effort: L. Out of scope until product strategy explicitly invites it.
  - **Verify still open:** **Gate: none — deferred indefinitely.** Only revisit if product strategy explicitly invites a paid freeform chat.

### Post-run journey

- 🔲 **[W4]** **POST-RUN-03 — Rich-media zone preview on the link push** *(SLT: later — not before #1–5. Gated on production APNs anyway.)* *(scoped 2026-05-30)* — attach a small, *informative* image to the confident-auto-link push (POST-RUN-01/02, `lib/coaching/autoAnalyse.ts`) so the lock-screen ping shows the morsel, not just says it. Behavioural goal: make the post-run ping a thing users anticipate and want to open. Tier: **FREE-eligible — confirm before build** (the image is formula-derived, no AI; the deeper in-app zone-ring stays PAID). Effort: **M (~2–3 engineer-days, mostly native)**. **Gated on TestFlight exercising production APNs** — remote image fetch can't be validated in the simulator.
  - **What the image shows (the key constraint):** the link push fires *before* the analysis round-trip, so at send time we have only **avg HR, distance, day, and the planned zone band** — NOT time-in-zone or HR drift. So the image is the simplest honest thing: **a single horizontal zone band with the run's average HR plotted as a dot** — dot inside the green band = "Held the zone", dot above = "Bit warm". It's the visual twin of the `buildLinkPushCopy` morsel (word + picture agree). The full zone-ring donut stays the *inside-the-app* reward — do NOT spend it on the lock screen, and do NOT add a second post-analysis push (POST-RUN-02 deliberately removed it to avoid the silent-gap double-ping).
  - **Design for the thumbnail, not the expansion:** collapsed lock-screen art is ~40pt. Band + dot + one HR number reads at that size; a detailed chart turns to mush. Restraint here is legibility, not just brand. No tick, no emoji, no confetti — Warm Slate band (moss in-zone, `--warn` over) + ink dot.
  - **Image generation:** new route `/api/notif-image/zone?avg=152&low=140&high=160&state=held` returns a PNG via `next/og` (Satori — same capability as `app/api/og/route.tsx`). Satori can't read CSS custom properties, so the Warm Slate hex lives as data constants in `lib/brand.ts` (the existing `BRAND.og.*` precedent) — keeps hardcoded hex out of components and clears the pre-commit hook.
  - **Platform split — do web first:** **Web push (easy)** — set the `image` field in the notification payload (`lib/webpush.ts` + service worker); no extension. Validates the artwork and the route cheaply. **iOS (the real work)** — APNs payload gets `note.mutableContent = 1` + a custom image-URL key in `lib/apnpush.ts` (the `apn` package supports both), plus a new native **Notification Service Extension** target in Xcode (own bundle ID `app.zonna.ios.NotificationService`, own provisioning profile — same hand-rolled pattern as the widget extension; Capacitor doesn't manage it). The extension downloads the image and attaches it before display.
  - **Graceful degradation (de-risks it):** if the extension fails to fetch the image in the ~30s budget, iOS shows the text-only notification — i.e. exactly today's behaviour. Worst case is no regression. Keep the PNG tiny and served from Vercel edge so fetch is fast.
  - **iOS extension checklist:** new Service Extension target in Xcode · App ID `app.zonna.ios.NotificationService` + provisioning profile in Apple Developer portal · `mutable-content: 1` + image-URL key in `apnpush.ts` · device test via TestFlight (not simulator).
  - **Risks:** provisioning/extension setup is fiddly (widget-extension family of pain); one more native target to keep building; image-fetch latency must stay well under the extension budget. **Further horizon (not this item):** Live Activity / Dynamic Island for in-progress or just-finished runs — overkill until this lands and proves out.
  - **Sequencing:** web image + route first (prove the artwork at thumbnail size) → iOS extension once a TestFlight build is exercising production APNs anyway.
  - **Verify still open:** **Gate:** TestFlight exercising production APNs (`APNS_PRODUCTION=1`). Remote image fetch cannot be validated in the simulator.

- 🔲 **[W3]** **POST-RUN-REFRAME-02 — Voice memo input for the reframe** *(scoped 2026-05-22; deferred from POST-RUN-REFRAME-01 Phase 3)* — adds voice as an alternative input mode to the reframe textarea. Capacitor mic plugin + iOS `NSMicrophoneUsageDescription` + `/api/transcribe` (OpenAI Whisper — **first non-Anthropic vendor in the stack**, needs `OPENAI_API_KEY` in Vercel) + UI voice mode in `ReflectionInput`. The reflection text flow already populates `note_source='voice'`/`voice_duration_s`/`voice_transcript_confidence` columns — schema is voice-ready. Pickup gated on device-test capacity and a product decision on the new vendor. Effort: M (~3d). Tier: PAID (inherits `post_run_reframe` gate). **SLT priority #9 — make the Whisper/OpenAI vendor decision first. Don't let "vendor decision" become indefinite deferral.**
  - **Verify still open:** `test -d app/api/transcribe` → **absent = still open**. **Gate:** the OpenAI/Whisper vendor decision (needs `OPENAI_API_KEY`).

  > **Board note (Wendy Wood):** Voice is the highest friction-reduction change on the list for post-run reflection. Typing after a run is a significant barrier — voice removes it. The quality of reframe input (and therefore the quality of the AI output) improves when the medium suits the moment. This is worth the vendor dependency.

---

## LATER — Post-launch roadmap

No schedule. Ordered roughly by user value. Each needs FREE/PAID tag in `docs/canonical/feature-registry.md` before build.

---

| # | Title | Tier | Effort | Notes |
|---|-------|------|--------|-------|
| **R22** · **[W5]** | **Blockout days** — user marks days unavailable, plan reshapes around them | PAID | M | Bundle with R20 parked triggers — uses same reshape engine |
| **R18** · **[W5]** | **Plan confidence score** — derive from session completion + RPE. R17 coaching flags are the per-session atom this aggregates. Logically downstream of R25 — pairs naturally as the next item once the comparison engine ships | PAID | M | Display on dashboard or plan screen |
| **R24** · **[W5]** | **Multi-race support** (A/B race hierarchy) | PAID | L | Non-breaking additive: `meta.races: Race[]` on top of existing `meta.race_date`/`race_name` |
| **R21** · **[W5]** | **Strength sessions** — flesh out stubs (currently admin-only/hidden) | FREE display / PAID dynamic | M | |
| **CA-08** · **[W4]** | **Garmin Connect integration** — largest fitness-watch ecosystem in distance running; every Tier-1 competitor (Runna/Coopah/TrainAsONE) has it. Plumbing-grade: OAuth + activity push into the source-agnostic `strava_activities` log (`source='garmin'`), reusing the existing HealthKit/Strava dedupe (`lib/coaching/healthkitConsolidate.ts`, ±5min/±5%). Not a v1 blocker — HealthKit covers the iOS+Apple-Watch user; Garmin widens the addressable runner. Source: competitive analysis 2026-06-03 §4.1. | PAID | M | **SLT: Apply for Garmin Connect Developer Program NOW regardless of build timing. Approval takes 4–8 weeks. Don't let that clock start late.** Pairs with the Strava-secondary-source work — same ingest/dedupe path. |
| **R19** · **[W5]** | **Coaching tips in Supabase** — move hardcoded copy to a table for dynamic, user-specific messages | PAID | S | **Don't pick up without a product trigger.** Scoped 2026-05-01: current hardcoded copy (`getCompletionCopy`, `getReflectResponse` in `DashboardClient.tsx`; `ZONE_COPY` in `lib/coaching/zoneCopy.ts`) branches on session type + RPE — both already known client-side. No user segmentation exists, so the migration alone doesn't unlock "dynamic per user" — it just adds a DB read + fallback path. Worth building only when there's a real driver: a non-engineer copy editor, an A/B test you actually want to run, or the first cohort that genuinely needs different copy (e.g. beginner vs intermediate). Until then, two switch statements are the right level of abstraction. |
| **R26** · **[W5]** | **Background load (HealthKit)** — count daily step / non-run active minutes against the chronic side of `acuteChronicRatio`. Fixes the false-negative case where a user with a 15k-step day-job is carrying invisible load the plan can't see | PAID | M | Calibration risk — active job vs recovery walks vs cross-train all look the same in step count. Needs a tunable damping factor before it's safe to act on. New field `nonRunActiveMins` on the load calc; surface separately on weekly report before feeding into the trigger |
| **R27** · **[W5]** | **Cycle-aware coaching (HealthKit)** — phase-aware notes for female users using HealthKit menstrual data. Closes a class of false-positive readiness flags from the v1 readiness signal (luteal-phase RHR is naturally elevated). Single coaching note per phase shift, not full periodisation. **Thin first slice now tracked as CA-05 in NEXT** (competitive analysis 2026-06-03 calls this the highest-leverage moat on the backlog) | PAID | L | Real differentiator vs Strava/Runna/Planzy. Voice work needed first — matter-of-fact, not patronising. Needs opt-in flow in wizard or MeScreen. Tier sub-decision: gate behind PAID or include free as a brand moat |
### Scoped but unscheduled

- **[W5]** **CO-ONE dismissal sheet** *(Phase 2, ~half-day)* — "Manage what Kit watches →" slide-up sheet on Coach. Per-signal 14-day mute toggles (zone drift, benchmark staleness, future foldable signals). Reuses existing `zone_drift_dismissed_at` / `benchmark_recal_dismissed_at` persistence (left in schema during CO-ONE v1 ship). **Gate (revised 2026-06-19, post-portfolio):** build when ANY of the following silent-churn signals fires: (a) ≥10% of paid users open Coach 3+ times in a week without taking *any* downstream action (no run logged, no benchmark updated, no session marked done) — measurable proxy for "ignoring Kit"; (b) churn-survey responses cite "too repetitive" / "felt nagging" / "wouldn't shut up" verbatim; (c) ≥3 unsolicited user requests for signal mute in support. The original "≥3 user requests" gate was vague — runners rarely ask for a feature they don't know exists; the silent-ignore signal is the real failure mode. SLT call (2026-06-19) and recommendation refresh (2026-06-19): the heat-block / altitude-camp / mid-life-event runner case is real but speculative; ship the read clean first, add the sheet if a measurable silent-churn pattern emerges. Persistence already exists → minimal effort when triggered. Tier: FREE.
- **[W5]** **Zone method selector** — user picks HR zone calc method, stored in `user_settings` — PAID
- **[W5]** **GTM-11 Pricing review** — annual discount currently 37% vs category norm 44–49%. Monthly parameterised in `lib/brand.ts`; can raise to £9.99/month (50% annual discount) without a search-replace. Revisit after first 100 paid conversions
- **[W5]** **Supplementary session slots** — second session per day for strength / cross-train / yoga / mobility. Explicitly NOT AM/PM run-doubling (different audience pattern, counter to brand). Tier: slot FREE, AI placement PAID. Estimate ~3 weeks.
  - **Model (option B — primary + secondary):** primary session stays keyed by `day`. Adds optional `secondary_session: Session | null` on `Week.days[day]`. Adds `slot TEXT NOT NULL DEFAULT 'primary'` column (check `IN ('primary','secondary')`) to `session_completions`, `session_overrides`, `run_analysis`. Replaces unique constraints to include `slot`. Backfill all existing rows to `'primary'`. **Every `onConflict: 'user_id,week_n,session_day'` upsert in the codebase becomes `'user_id,week_n,session_day,slot'`** — grep before merge.
  - **Engine impact:** `validatePlan` invariants (secondary may only exist when primary exists; secondary type ∈ allowed supplementary types; intra-day load cap when primary hard + secondary hard); `buildReorderAdjustment` adjacency check goes 2-D (same-day across slots also counts as back-to-back hard); `autoMatchAndAnalyse` routes by activity type — `Run`/`TrailRun` → primary, `WeightTraining`/`Yoga`/`Ride`/`Swim` → secondary; `/api/adjust-plan` `{fromDay,toDay}` becomes `{from:{day,slot}, to:{day,slot}}`. Coaching call needed in `CoachingPrinciples.md` on whether strength counts toward fatigue load.
  - **UI:** Today renders secondary as a smaller, indented sub-card directly under primary (rule: *one day = one block, with optional sub-row* — secondary is visually subordinate, not a second equal card); Plan-screen `DayRow` gets a `+` affordance ("Add a session") + slot-aware Move; Wizard adds one question ("Do you do strength or cross-training? We'll fit it around your runs"). Cross-slot moves blocked at MVP — only same-slot moves between days.
  - **Value framing:** wizard frames it as accommodation not capability ("Most plans pretend you only run. We'll fit your strength work in without breaking the easy/hard rhythm"); empty-slot affordance copy promises restraint ("Add strength, yoga, or a cross-train. We'll watch it doesn't pile up"); coach narrative names doubled-day zone discipline when it lands ("Strength yesterday, easy run today. Kept it under control"); weekly report splits Run load vs Supplementary load. For users who don't opt in, nothing changes — feature is invisible.
  - **Phasing:** A — schema migration + backfill + Plan-screen `+` + manual log to secondary (~1w); B — engine integration: `validatePlan`, adjacency, autoMatch routing, coaching load (~1w); C — Wizard question + AI placement of secondary on plan generation (~1w); D — Coach narrative copy that names doubled-day discipline (S).
  - **Risks:** PK migration footprint (every `session_completions` upsert needs slot); autoMatch mis-routing (graceful fallback when a `WeightTraining` arrives at a day with no secondary slot — decision needed: create slot? skip? prompt?); visual creep on Today (must hold the "subordinate sub-row" rule); `plan_archive` JSON backwards-compat (easy if `secondary_session` stays optional); 3-layer invariant drift (`CoachingPrinciples.md` → `GENERATION_CONFIG` → `validatePlan` need same-PR updates); scope creep to AM/PM once slot exists — hold the line.
  - **Out of scope:** AM/PM run-doubling. Advanced-runner pattern, counter to *"Slow down. You've got a day job."* Stays deferred indefinitely; revisit only if the audience shifts.

### Go-to-Market — acquisition

- 🔲 **GTM-SEO-COMPARE-01 Wave 2 — comparison pages 2–8** *(FREE, marketing)* — page 1 (`/runna-alternatives`) shipped 2026-09-10 with the template. **Each further page is one entry in `COMPARISON_ARTICLES` + a 4-line `app/<slug>/page.tsx` shim**; the `/comparisons` hub, `sitemap.ts` and `comparisons.test.ts` all read the catalogue, so a new page self-registers everywhere. Required per entry: `metaTitle` <60, `metaDescription` <155, `hubSummary`, `publishedISO`/`lastUpdatedISO`, body blocks. House rules enforced by test: **no em dashes in copy**, brand name interpolated from `BRAND.name`, never a literal. Articles live at ROOT (the search query is "X alternatives"), not under `/comparisons/`.
  - **Cadence: founder-authored, one page per week (decided 2026-09-10).** This is not a stalled item — it is on a deliberate weekly drip, not a batch build. Do not offer to bulk-write pages 2–8; the writing is the founder's, the template is done. Re-check the count rather than the status.
  - **Hold external links to `/comparisons` until 3+ articles exist** — a one-row hub reads as thin to Google and to a reader. At one page/week that gate clears around 2026-09-24.
  - *Verify still open:* `grep -c "slug: '" lib/marketing/comparisons.ts` → **2** = only page 1 exists (the hub carries a `slug` too — the count is articles **+ 1**).

- 🔲 **BRAND-14 — `BRAND.brandStatement` on `/support` and `/terms`** *(P3, ~10 min, decision first)* — `brand.md` names only the **"privacy footer"** as a home for the brand statement, but `/support` and `/terms` each carry their own quiet 10px line too. **Pre-existing** (predates GTM-SITE-01) and genuinely arguable: either a three-page divergence, or a deliberate legal-page family that reads consistently. Raised rather than silently edited, because it is brand doctrine and legal pages. Related: DIV-020 (over-use degrades the asset), DIV-022 (why it was removed from the shared footer).
  - *Verify still open:* `grep -l brandStatement app/support/page.tsx app/terms/page.tsx` → both listed = still open.

- 🔄 **GTM-SEO-PLANS-01 — SEO plan pages as an acquisition asset** *(FREE, marketing; SLT-reviewed 2026-09-06 → "build differently")* — **Waves 1 & 2 SHIPPED 2026-09-06 (`d6b8e68`) → see feature-registry.** 9 plan pages + `/plans` hub live: by-distance (5K/10K/Half·12wk, Marathon·16wk) + by-goal-time (Sub-25 5K, Sub-50/Sub-45 10K, Sub-2 Half·14wk, Sub-4 Marathon·18wk). **Wave 3 remains — PARKED PENDING DATA (2026-09-11), not blocked:** the 9 live pages have produced no conversion data yet (shipped 09-06; sitemap submitted to Search Console 09-11), and Traynor's binding SLT call was "track email→trial→paid, kill in ~90 days if trial rate is ~0". Shipping 8 more pages of the same template before the first 9 have indexed doubles an unmeasured bet — and free-plan search traffic is the exact segment the item flags as skewing to non-payers. **Unpark trigger:** the 9 pages are indexed AND a trial-conversion number exists (est. early-mid Oct 2026). Scope when it unparks: beginner/first-timer variants (5K/10K/Half), 8-week short formats, and more goal times (Sub-30 5K, Sub-90 10-mile, Sub-3:30/Sub-4:30 marathon). Same shared `PlanPage` + catalogue — a Wave 3 plan is a new `MARKETING_PLANS` entry (even weeks, race-Sunday, guarded by `plans.test.ts`). Original scope below for reference:
  - attacks the measured constraint (empty top of funnel: 0 signups/24h, 5/7d). One indexable page per plan that **renders the engine's FREE plan inline as crawlable HTML** (not a locked download). Near-zero content cost: `generateRulePlan` already produces these FREE, `validatePlan()`-clean.
  - **SLC.** *Simple* — SEO landing pages that render a FREE engine plan + one CTA. *Lovable* — unmistakably Zonna (zone caps, capped easy days, "you can't outrun your easy days" on the page), not a Higdon clone; trigger `frontend-design`. *Complete* — page per distance, honest "flat template vs the app adapts it" framing, soft email CTA, SEO metadata, mobile, empty/edge states.
  - **The board's binding calls (SLT 2026-09-06):**
    - **Not a generic plan (Sutherland).** A standard 12-week plan is the most commoditised object online and erodes the anti-feature positioning. The page must lead with the brand diagnosis ("you're trying hard, that's the problem") and show the zone discipline *on the page*. Generic = don't ship.
    - **Marketing, not product (Fried/Wood).** Judge it on email→trial→paid, NEVER on downloads or session completions. It will NOT move the zero-completions activation problem — that's a separate issue; do not sell it internally as an engagement play (Wood kill-mandate if it is).
    - **Soft email, not a wall (Fried + doctrine).** The plan is freely readable; email/CTA unlocks "the version that adapts to your zones and moves when life happens" = the **existing trial**. A hard email-gate on the plan itself violates *"Free Users Are Never Abandoned — gate richness, never access"* and "credibility over cleverness". No fake urgency, no "enter email to reveal".
    - **Honest adaptivity claim (Hutchinson).** Label the static plan as the flat template; the app is the part that adapts/recalibrates. Selling a static plan as smart undercuts the paid proposition.
    - **Instrument the funnel (Traynor).** Track email→trial→paid, not volume — "free plan" queries skew to non-payers. Kill in ~90 days if trial rate is ~0.
  - **Reuse, don't fork:** the FREE plan generator (read-only — render its output, don't change it), the live waitlist + Resend capture (GTM-09/10), and the SEO-01 metadata pattern (`BRAND.marketingH1`, canonical/OG, `SoftwareApplication` JSON-LD — no fabricated ratings).
  - **Coaching Board:** NOT required *only if* the plans are unmodified engine output. Any hand-curation of a published plan → convene (it becomes a new prescription).
  - **Build hygiene:** no hardcoded brand strings/pricing/colours — `BRAND.*` + tokens only (marketing pages are where this slips).
  - **Risks:** audience-quality (free-plan traffic → non-payers; measure trial conversion); brand commoditization if the Zonna identity isn't loud on the page; touches `app/page.tsx` marketing surface + SEO-01 metadata; **no schema/engine changes** if rendering existing FREE output verbatim.
  - *Verify still open:* no `/plans/<distance>` marketing route rendering a FREE engine plan exists yet.

### Sweep coverage & the debt it surfaced

*Both items opened and closed 2026-09-04 → feature-registry. The input-coverage gate found both on its first run; nothing open here.*

### Verification that runs itself — VERIF (from the 2026-09-07 error post-mortem)

**Why this section exists.** On 2026-09-07 ten errors were made and all ten were
caught — but only **four** by a mechanism. The other six were caught because someone
chose to check: reading git history before deleting a principle, diffing two plans
instead of trusting a grep, measuring an invariant's firing rate before shipping it,
echoing a real exit code instead of reading a summary. **Six of ten would have
shipped on a tired afternoon.** Every one shared a shape — *a document was treated as
evidence about code*.

**BINDING REQUIREMENT ON ALL THREE ITEMS: they must be AUTONOMOUS.** Each ships as a
`vitest` test in the `npm run verify` chain, or as a `.claude/hooks/` hook — **never**
as a script that has to be invoked. A checker nobody runs is this repo's most
repeated failure (SWEEP-VACUOUS-01, §5's specificity ladder, `INV-PLAN-FOUNDATION-BLOCK`
never firing in production for months). If the answer to *"what makes this run?"* is
*"someone remembers"*, it is not done. `configPrincipleSync.test.ts` and
`configConsumer.test.ts` are the shape to copy.

- ✅ **INERT-INPUTS-01 — both halves CLOSED 2026-09-09.** (One UI follow-up spun out — TERRAIN-NOTE-SURFACE-01 below.)
  - ✅ **`terrain` — CLOSED 2026-09-09 by Coaching Board CB-TERRAIN-01 (wire it) + subtitle re-copy.** The board **VETOED** the obvious build (a terrain→pace multiplier) on §40b — you cannot invent a trail pace number the runner can't act on (pace swings 20%+ with grade/footing; §11 false precision; §14 HR already self-corrects). Terrain is instead wired to an **effort-lead note**: for `trail`/`mixed`, `meta.terrain_effort_note` says *"Off-road, let effort and HR lead — the pace targets are a road reference."* `road` is the pace-anchor baseline (no note). Three artifacts: §40b Amendment 3, `GENERATION_CONFIG.TERRAIN_EFFORT_GOVERNS`, `INV-PLAN-TERRAIN-EFFORT-NOTE-DECLARED`. The misleading *"Affects pace targets"* subtitle re-copied → *"Off-road, we coach by effort, not pace."* (frontend-design). terrain now **changes the delivered plan** (INPUT-EFFECT-01 confirms — moved out of INERT_DEBT via `terrain_effort_note` in the compared set). Verified: 583 plan tests, matrix 65/0, sweep 0 violations, invariants 88/88, tsc clean.
  - ✅ **`zone2_ceiling` — CLOSED 2026-09-09 by deletion.** The inert INPUT field removed from `GeneratorInput` (`types/plan.ts`, MAX-WEEKEND-MINS-01 treatment) — no caller sent it and the engine computes `meta.zone2_ceiling` from `zones.zone2Ceiling` regardless, so supplying it was silently discarded. The engine-computed **meta output** `meta.zone2_ceiling` (HR-target fallback, `PlanMetaSchema`) is untouched and still consumed. `inputEffect.test.ts` SPECS/INERT_DEBT updated; its self-healing "no spec names a removed field" test confirmed the cleanup. tsc clean, 579 plan tests.

- ✅ **PLAN-NOTE-SURFACE-01 — SHIPPED 2026-09-09 (core).** The plan-level meta-note family now renders on the Plan screen under a **"Why this plan"** section (ui-patterns.md §18) — `volume_constraint_note`, `volume_shortfall_note`, `long_run_shortfall_note`, `fitness_signal_note`, `terrain_effort_note` (CB-TERRAIN-01), `hard_pref_note` (HSR-INERT-01), plus a **derived level-fit line** (the CAT-DEPTH-01 SLT-pivot "shaped for you", honest not brag). **Single owner:** `lib/plan/planRationale.ts → planRationaleNotes(meta)` decides which/order/label/cap (3, Wood's "not a wall"); honest constraints rank first, the brag-risky line last; empty → nothing. Rendered via the shared `CoachNoteBlock` (`variant="why"`, `aiGenerated={false}` → **no AIMark/rail**, provenance honesty — rule-engine, unlike the adjacent AI `plan_intro`). Reuses the inline `SectionLabel`; no fork. This is what made terrain, love, AND the CAT-DEPTH pivot resolve from "stamped but invisible" to visible. `planRationale.test.ts` (ordering/cap/empty/derivation); tsc clean, `next build` passes, 595 plan tests. **Enricher consistency DONE 2026-09-09:** the rationale notes are now fed to the AI enricher prompt ("already shown to the runner — stay consistent, do NOT repeat or contradict"), reusing `planRationaleNotes()`, so the paid coach voice never paraphrases or contradicts them. `enrichRationaleContext.test.ts`. *Original systemic finding preserved below.* ~~**systemic finding:**~~

- ✅ **DOC-CLAIM-01 — CLOSED 2026-09-09.** `lib/plan/docClaims.test.ts` (in `npm run verify`) verifies every string marked **`**Engine copy:**` `…`** in `CoachingPrinciples.md` exists **verbatim** in `lib/`, failing the build on drift. Falsification-tested: it catches the exact §24c drift that motivated it (the old *"if HR exceeds this, walk 30 seconds"* text). **The scope changed on measurement, and that is the finding:** the backlog's "~30 lines, scan every quote" was unbuildable-clean — 56 `*"…"*` quotes are an indistinguishable mix of emitted cues, hypothetical runner speech, paraphrases, and *historical drift-descriptions* (a "Corrected" note quoting old wrong text on purpose); no heuristic separates them (a naive scan gave 34 false positives). So the check is **opt-in with zero false positives**: a `**Engine copy:**` marker (bold-required, so a prose mention of the convention isn't matched; single-line backtick span). **Limitation, stated:** coverage = marked claims, so a new emitted-copy claim written without the label isn't checked — the price of zero false positives on a corpus with no structural signal; every marked claim is protected forever, and coverage grows as authors mark. Seeded with 3 verified claims (§24c cue + 2 coach notes); convention documented in `CoachingPrinciples.md` §34. Closes the *principle → behaviour* gap (`configPrincipleSync` = key→principle, `configConsumer` = key→consumer, INPUT-EFFECT-01 = input→effect). **VERIF trio now complete** (NOISE-GATE-01, INERT-INPUTS-01, DOC-CLAIM-01 all shipped). 585 plan tests.

- ✅ **NOISE-GATE-01 — CLOSED 2026-09-09.** `property-validate-plans.ts` now measures **per-plan** warn firing rate for every warn-severity invariant (they were counted by NOTHING before — the loop filtered to `severity === 'error'`, which is exactly how a 44% warn stays invisible) and **fails the sweep above 30%** unless a human acknowledges the code with why the rate is the honest residual. Autonomous (in `verify:sweep` → `npm run verify`). **Found a real signal on its first run:** `INV-PLAN-PEAK-IN-PEAK-PHASE` (23.5%) and `INV-PLAN-INJURY-CAP-DELIVERED` (23.1%) — both documented board-scoped known-open residuals (plan-invariants.md), under threshold, so no acknowledgement needed. Threshold 30% sits between those honest residuals and the noise band (§94 shipped at 44.4%, Willy's example 71%). Allowlist is empty (acknowledgement EXEMPTS a code, so only genuinely-above-threshold justified codes belong there). *Metric bug caught in build: first cut counted violation INSTANCES ÷ plans (36.5% nonsense); the §94 standard is PLANS-firing ÷ plans — fixed to count each code once per plan.*

### Intensity distribution on low-day weeks — INTENSITY-3DAY-01 (found by INPUT-EFFECT-01, 2026-09-08)

- ✅ **INTENSITY-3DAY-01 — CLOSED 2026-09-09 by §97 Amendment 1.** The live P1 (a 3-day `experienced` runner shipped 27.3% quality on a 10K against §1's 25% ceiling — and, found in the same investigation, a 4-day HM shipped 21.2% against 20%) is fixed. **The filed mechanism was wrong and the correction is the lesson:** it was **not** §79's intensity allowance. Measured by plan-diff, the cause was **§89 early-onset (ADR-021)** shortening the all-easy base, which places a constant ~9 quality sessions regardless of day-count; on a 3-day `build` plan the running-session denominator (~33) collapses and ~1 quality/week breaches the ceiling. §97 already knew "a shorter base raises the quality share" and yielded the on-ramp *by distance* — but scoped only on distance, never on `days_available`, because the property sweep samples axes independently at random and never crossed `days_available: 3` with the full §89 gate. Fix: the short on-ramp is now **denominator-scoped** — granted only where `ceiling_fraction × days_available ≥ ONSET_SHORT_ONRAMP_MIN_WEEKLY_QUALITY_HEADROOM (1)`, which separates every breaching cell (10K@3d = 0.75, HM@4d = 0.80) from every safe one with no residual. When denied, base falls back to §91's two-week floor: §89's benefit is trimmed (onset one week later, still 2 weeks sooner than a non-gated runner; `experienced` still out-scores `intermediate` 8 vs 6), never lost. **Governance:** defect fix restoring documented intent (§79 "distribution still governs" + §97 "§1 yields nothing") → Coaching Board **exempt**. Verified: full property sweep 0 new violations, matrix 65/0, invariants 87/87, 576 plan tests green. **Regression is DETERMINISTIC** (the random grid could not be trusted to sample it): `earlyQualityOnset.test.ts` §97-Amendment-1 block + two `intensity-3day-01-*` CORNERS in `property-validate-plans.ts`. Artifacts: `CoachingPrinciples.md` §97 Amendment 1, `GENERATION_CONFIG.ONSET_SHORT_ONRAMP_MIN_WEEKLY_QUALITY_HEADROOM`.
  - **Lesson (recorded, cost a wrong filing — same class as HSR-INERT-01):** the mechanism was filed from a static read of §79 and was wrong; a one-line diff of two generated plans (experienced vs intermediate, and experienced with/without the §89 gate) found the true cause immediately. Where the question is "which input changes what a runner is prescribed," generate two plans and diff — never read the code and conclude.

### §1 vs the foundation block — INTENSITY-FOUNDATION (surfaced 2026-09-09 while closing INTENSITY-3DAY-01)

*Root cause shared by both items below: `INV-PLAN-INTENSITY-DISTRIBUTION` counts running sessions off `plan.weeks`, and `validatePlan` runs **twice on different objects** — once inside `generateRulePlan` on the BARE plan (`ruleEngine.ts:5814`, before foundation weeks exist) and again in `composePlanWithFoundation` on the ASSEMBLED plan (ADR-020). Foundation weeks (§57) are all-easy running, so they enlarge the §1 denominator and lower the quality share. The invariant was never given the `foundation_weeks_planned` credit that §91's `INV-PLAN-ONRAMP-FLOOR` already uses for exactly this two-objects problem — so it returns two different verdicts for the same plan. Evidence scripts: `/tmp/bareVsAssembled.ts`, `/tmp/gap0.ts` (reproductions; not committed — re-derive with a diff).*

- ✅ **INTENSITY-FOUNDATION-BLIND-01 — CLOSED 2026-09-09 (`bfda084`).** `INV-PLAN-INTENSITY-DISTRIBUTION` now DEFERS when a foundation block is pending (`meta.foundation_weeks_planned > 0`, no `n<=0` week yet) — the assembled-plan check owns the verdict. The bare-plan check at `ruleEngine.ts:5814` no longer console.errors a false positive / throws in dev/test on plans that ship clean. The count is not projected (foundation weeks are day-fitted §52b; projecting would drift) — same reasoning as §91 reading the stamped week count. Because `composePlanWithFoundation` uses the same `plannedFoundationWeeks` as generation, `fwp>0` on a DELIVERED plan always coincides with the weeks being present, so the defer never masks a real breach. Board-exempt (checker accuracy). Regression: `intensityFoundationBlind.test.ts` (defer/bind/deliver). *Original:* ~~for a plan whose bare form breaches §1 but is rescued by prepended foundation weeks, the internal validate console.errors in prod and throws in dev/test on a plan the runner receives clean (10/64=15.6% bare → 10/76=13.2% delivered).~~
  - **Fix options:** (a) credit `meta.foundation_weeks_planned × training-days-per-week` all-easy sessions into the §1 denominator inside the invariant — the direct §91 precedent (`INV-PLAN-ONRAMP-FLOOR` reads the same field for the same reason); or (b) make the *definitive* §1 check run only on the assembled plan (harder — the 5814 call validates all invariants at once). (a) is the clean single-owner fix. **Governance:** invariant-accuracy fix, no prescription change → Coaching Board **exempt**.
  - **Prerequisite for seeing -02 cleanly:** until the checker credits foundation weeks, its bare-plan verdict is noise, which is how the real delivered breach below hid inside "baselined" console spam.
  - *Verify still open:* `grep -n "foundation_weeks_planned" lib/plan/invariants.ts` → absent inside the `INV-PLAN-INTENSITY-DISTRIBUTION` block = still open.

- ✅ **INTENSITY-LONGDIST-LOWDAY-01 — CLOSED 2026-09-09 by Coaching Board CB-INTENSITY-50K-01.** A delivered 50K build plan breached §1 (worst valid **16.3%, 13/80**, at 5d/cwk40/16wk/experienced). **Scoped to 50K** — marathon (18%) showed no delivered build breach anywhere in the grid (its earlier 18.8% was the FOUNDATION-BLIND-01 bare-plan artifact), 100K's worst is 15.0% (at boundary, holds). The board ruled **CORRECT WITH AMENDMENT**: this is the *"a 50K build-profile breach reopens it"* that §1 pre-registered, resolved by the **100K precedent** (when §8's quality dose collides with §1 at ultra distances, **§1 yields** — 100K went 12→15). Both cut-quality options were rejected (contradict §8; Willy: the 50K base carries the long-run progression, least able to spare a week). **50K ceiling raised 15% → 17%** — minimal to clear the observed worst while still binding (Hutchinson); Seiler's dissent now directionally vindicated but he holds 17% is the conservative floor; Sims: ceiling-not-target language preserved. Three artifacts in one commit: §1 amendment, `INTENSITY_DISTRIBUTION['50K'] 15→17`, existing `INV-PLAN-INTENSITY-DISTRIBUTION` + deterministic `intensity-longdist-50k-5d-build` CORNER in `property-validate-plans.ts`. **A 50K build plan above 17% reopens it again.** Verified: sweep 0 new violations, matrix 65/0, invariants 87/87, 579 plan tests. *(Depended on FOUNDATION-BLIND-01 above — detection was masked until the checker read the delivered plan.)*

- ✅ **FOUNDATION-CHOICE-RESIZE-01 — CLOSED 2026-09-10.** Onset no longer depends on *when* the runner answered the foundation modal. On the >28-day choice band the decision arrives after generation, so §91's credit was never applied and a deferred-then-added block delivered quality a week later than the identical decision made up front (base 1/on-ramp 4/**week 2** deferred vs base 0/on-ramp 3/**week 1** decided). **The board's conservative default stands** (never presume `'add'` — CORRECT AS IS); the remedy re-sizes *when the answer lands*. `POST /api/generate-plan/foundation` now calls `resizeForDeferredFoundationAdd` (`lib/plan/foundationResize.ts`) before composing: for an **early-onset plan only** it re-runs the deterministic rule engine with `foundation_decision:'add'` (the single owner of phase sizing — no two-writer split) and grafts the runner's enriched copy back onto every structurally-unchanged week (`applied_partial`, ENRICH-PARTIAL-01). **Never re-pays for AI enrichment** — the ADR-020 clause is narrowed to the enricher, not the engine (ADR-020 amendment landed). No-op for every non-early-onset plan (gated on `meta.early_quality_onset`). Anchoring is provably stable (`calcPlanLength` counts back from race week → `planStart = meta.plan_start` round-trips). Board-**exempt** (coaching decision already ruled; this is the engineering remedy the board named). Regression: `foundationResize.test.ts` pins onset-**parity** (deferred add === decided-at-generation under a frozen clock) + the fast-path no-op + the no-stale-copy graft safety. 642 plan tests + tsc green. Governance-only: no `GENERATION_CONFIG` numeric changed.

### Zone & distance honesty (from the 2026-09-04 board, second sitting)

- ✅ **RAMP-BOUNCEBACK-01 — SHIPPED 2026-09-06** (Coaching Board CORRECT WITH AMENDMENT, Willy-led). The §2 post-deload exemption is now **bounded** for knee/shin runners by the §12 cap (5%), removing the `Math.max` override that shipped +26–43% single-week rises to injured tissue. Healthy bouncebacks stay unbounded (measured — a healthy cap flipped +50pp of plans to constrained for zero safety benefit). `INV-PLAN-BOUNCEBACK-BOUNDED` (warn — the delivered arm's §52 long-run residual closed alongside DELOAD-INVERSION-01/§90). No new numeric. See feature-registry + §2 amendment. **CB-PHASE-01's global base 35→30 is NOT the follow-on** — it was superseded by the per-runner §89 experience-gated onset (a global base shortener harms beginners; onset gates on demonstrated readiness instead).

- ✅ **RAMP-PRODUCER-01 — SHIPPED 2026-09-11** (Coaching Board CORRECT WITH AMENDMENT, §100). The week after a `V1-volume-quality-split` trim now ramps from **delivered** volume rather than the curve, cascading forward until the curve catches up. Reuses §2's 10% cap — **no new numeric**. `trimWeekEasyToTarget` extracted so V1 and the re-anchor share one trimmer (Willy's CD-16 instruction); the extraction was proved behaviour-neutral by `verify:parity` (2,916 cases IDENTICAL) before any behaviour changed.
  - **Measured both ways, deliberately.** 900-plan 5K/10K/HM grid (where the catalogue emits VO2max, so where V1 can fire): breaches **34.0% → 16.4%**. **The worst delivered rise is UNCHANGED at 79%** — the gain is frequency, not ceiling. (First reported as 22.7% → 11.5% / worst 55% → 39%; that grid carried invalid enum values the engine silently ignored, corrected same day — see §55's `InputEnumError`.) Full 16,038-plan sweep, every distance: `INV-PLAN-DELIVERED-RAMP` **4.0% (644) → 3.6% (572)**. The grid says the fix works; the sweep says how much it moved the product.
  - **Cost, in the board's own 2026-09-06 rejection metrics:** mean delivered peak 27.04 → 26.78 km, max peak 65.5 → 65.5, constrained-by-inputs 38.4% → 38.4%, maintenance 32.8% → 33.3%. The inverse of the healthy bounceback cap that was rejected (+50pp constrained for zero benefit), because the capped week sits in base/early build, not at peak.
  - **The §52 amendment is the part to remember.** As first built the cap drove two 11.5 km easy runs to the 4 km floor. §52's Case 04 already forbade that shape ("surface the constraint, not silently truncate weekday runs to single-digit km"), so no easy run may go below the smallest easy run of the week just completed. Where that blocks the cap it partial-applies and §94 reports the residual as a `warn`.
  - **The conflict scan did the real work:** §12's boxed correction of 2026-08-20 had ALREADY ruled this exact mechanism wrong for the injury cap (394 of 981 long-run violations). §100 applies a decided finding rather than making a new one.
  - `INV-PLAN-DELIVERED-RAMP` is deliberately left unchanged — it is the measurement the ruling rests on.

- ✅ **DELOAD-POS2-01 — SHIPPED 2026-09-15 → feature-registry (§95 Amendment 1).** Root cause of the 2026-09-14 revert: the guard `since === recoveryFreq - 3` **degenerates to `since === 0` at the masters cadence of 3**, placing a deload adjacent to the one just placed (`[3,6] → [3,4,7]`). Fixed with `since >= 1`; §95 is now a preference that yields to any ratified error the §87 placement does not also carry. Sweep firing **16.1% → 0.2%**, standard runners **21.7% → 0.0%**, adjacency **0**, `cohortShape` unchanged. Masters residual (52.2%) is the **provably unsatisfiable** set — 1,944/3,726 by brute force, against 0/3,726 standard. Board record: `docs/decisions/coaching-board-2026-09-15-deload-pos2-and-v2-swap.md`.

- ✅ **CAT-10K-RACE-SPECIFIC-01 — SHIPPED 2026-09-11** (Coaching Board CORRECT WITH AMENDMENT, §104). `tenk_race_simulation` ("10K-pace race simulation", 3 × 2km at goal pace / 90s jog, peak only) is 10K's second race-specific row. **Measured before: 100% of 96 10K time-target plans placed `tenk_pace_intervals` TWICE and no plan saw two different race-specific sessions; `goal_pace_sharpener` landed ZERO times.** After: plans seeing two different race-specific sessions **0% → 25%** — better, not solved; the residual is CAT-DEPTH-01's. `INV-PLAN-RACE-SPECIFIC-VARIETY` (warn, 5.7%) asks whether a repetition was a CHOICE (another eligible row existed), deliberately NOT "a distance must own N rows". **Row B (float recovery) was KILLED** — a float at easy-moderate is Z3, the grey zone §1 exists to prevent. → feature-registry.

- ✅ **MWM-STRUCTURED-MAINTENANCE-01 — RULED AND CLOSED 2026-09-11** (Coaching Board, §81 amendment). A structured session overrunning the weekday cap **tells the runner** and **does not reclassify the plan**.
  - **The deciding argument was §23's own definition.** `maintenance` means a plan whose peak volume failed to reach `PEAK_OVER_BASE_RATIO` × week 1 — a VOLUME-OVERLOAD failure. A session that will not fit a weekday is a TIME-BUDGET failure. Conflating them makes `maintenance` mean two unrelated things, which is exactly the defect §101 diagnosed for `compressed` ("a flag that is almost always true carries no information").
  - Measured: extending the downgrade took maintenance **20% → 80% at a 30-minute cap (+60pp)**; at 45+ nothing crosses the limit. §81 calls the long-run case rare (896 plans); the structured case is 60% of cap-30 plans.
  - `INV-PLAN-STRUCTURED-OVERRUN-DECLARED` (warn) enforces the SPEAK half. Falsification-tested live: 6/6 plans fire when the note is suppressed, 0/6 when it is not.

- ✅ **CAT-MARATHON-RACE-SPECIFIC-01 — SHIPPED 2026-09-11** (Coaching Board CORRECT WITH AMENDMENT, §105). `mp_blocks` ("Marathon-pace blocks", reps × 4km at goal pace / 3 min jog, peak only) separates marathon-pace exposure from long-run day. **Measured before: 100% of 96 marathon time-target plans reused `mp_long_run`, up to THREE times each** — every scrap of marathon-specific work lived inside the long run. After: plans seeing both rows **0% → 8%** (lower than 10K's 25%, because `mp_long_run` holds the long run while `mp_blocks` competes for a quality slot; the residual is CAT-DEPTH-01's).
  - ❌ **The proposed load guard was WITHDRAWN.** An invariant forbidding `mp_blocks` from sharing a week with a race-pace long run failed 228 tests broadly (§22's renames are board-sanctioned since R23) and 57 when narrowed (**HM has paired `hm_pace_long_run` with `hm_pace_intervals` since R23**). The premise is also weak: marathon pace is EASIER per km than HM pace, so the marathon pairing is less intense than the one already shipping. Condemning long-shipped reviewed behaviour is inventing a rule, not finding a defect.
  - ⚠️ **AND IT FOUND A MIS-SCOPING IN §104, shipped hours earlier.** `INV-PLAN-RACE-SPECIFIC-VARIETY` counted the LONG RUN as a race-specific slot, so it fired on **92% of marathon plans** the moment marathon gained a second row — noise by NOISE-GATE-01's own standard. Now excludes the long run and long-run-shaped alternatives. Firing 5.7% → 0%, falsification-tested that it still fires on the real defect.

- 🔄 **SIG-ULTRA-UNBUILT-01 — Coaching Board RULED 2026-09-10; honesty cleanup shipped, WIRE build SLT-gated** *(P2, surfaced 2026-09-07 by `configConsumer.test.ts`)* — §17 named `PLAN_SIGNATURES` as authority for per-distance shape; the audit found 8 fields describing behaviour that does not exist, several on PAID ultra distances. **Board sitting done (CORRECT WITH AMENDMENT), per-field disposition below.** The zero-behaviour-delta half shipped this session (strikes + reclassification, all reads-nothing so no prescription change):
  - **STRUCK → declarative** (a shipped principle already does the work; flag was decorative): `peak_includes_race_pace` + `peak_includes_mp_long_runs` → §24d; `mp_long_run_frequency_weeks` → §47. Moved to `SIG_SUPERSEDED` in `configConsumer.test.ts`.
  - **STRUCK → deleted** from `PLAN_SIGNATURES`: `night_run_optional` (unbuildable — no time-of-day, ADR-011); `fuelling_practice_from_week` (wrong shape — absolute week index, §44 fragility; wrong object — fuelling is a long-run cue, `time_on_feet` already carries `fuel_every_mins:30`).
  - **BOARD-RATIFIED real commitments, WIRE build SLT-gated** (kept + tracked in `SIG_UNBUILT`, may NOT be deleted): `back_to_back_from_phase` + `back_to_back_frequency_weeks` (§24e — the defining ultra adaptation; wire with Willy's three guards: counts as §47 peak-long stimulus, never adjacent to a deload, both days Z2) and `time_on_feet_sessions_in_peak: 2` (100K peak dose). **Escalated to SLT** — correctness settled, the open question is *when* to build for a PAID distance with, currently, zero users (W4/W5 ultra-competitive territory). Needs `INV-PLAN-ULTRA-BACK-TO-BACK-CADENCE` + `INV-PLAN-TIME-ON-FEET-PEAK-COUNT` when built.
  - **Artifacts landed:** §17 disposition rule + §24e back-to-back/fuelling commitments (principle); `PLAN_SIGNATURES` strikes (numeric); `configConsumer.test.ts` registers (mechanical check). Ruling record in this session's board output.
  - *Verify still open:* `SIG_UNBUILT` in `configConsumer.test.ts` is the live ratified-but-unbuilt list — closes when back-to-back cadence + time-on-feet count are wired and enforced.

- ✅ **PLANLEN-DUP-01 — CLOSED 2026-09-07 by §97.** `max_weeks` is live: `calcPlanLength` reads it for EVERY runner with surplus weeks (widened from the gated-only scope by §97 Am., 2026-09-16), which is what stops their surplus weeks becoming a §57 foundation block. `ideal_weeks` remains superseded by `DISTANCE_CONFIGS` and is registered as such in `configConsumer.test.ts`. Original entry: ~~plan-length bounds are defined in TWO tables and only one is read~~ *(P3, surfaced 2026-09-07)* — `PLAN_SIGNATURES[d].ideal_weeks` / `max_weeks` duplicate `DISTANCE_CONFIGS` in `length.ts`, and `calcPlanLength` reads only the latter. So 10K declaring `max_weeks: 14` still caps at `idealWeeks: 12`. **This is not cosmetic:** that cap is exactly what pushes surplus weeks into the §57 foundation block, which is the mechanism behind §91 — a runner 14 weeks out gets a 12-week plan plus 2 foundation weeks rather than a 14-week plan. Whether `max_weeks` SHOULD be honoured is a real coaching question (a longer plan is not automatically better — see §91's finding that a longer plan re-grew the base). Registered as superseded for now; reopening it means deciding which table is the authority. *Verify still open:* `grep -n "idealWeeks" lib/plan/length.ts` vs `grep -n "max_weeks" lib/plan/planSignatures.ts`.

- ✅ **SIG-DECORATIVE-01 — CLOSED 2026-09-07.** Split into SIG-ULTRA-UNBUILT-01 and PLANLEN-DUP-01 above once measured; the mechanical half shipped as `configConsumer.test.ts`, and `free_tier_available` (the one field that was a commercial boundary) is now wired. Original entry: ~~**SIG-DECORATIVE-01 — two `planSignatures.ts` flags are read by no engine code**~~ *(P3, honesty cleanup)* — `peak_includes_race_pace` (HM) and `peak_includes_mp_long_runs` (MARATHON) are declared and never consumed; HM's correct peak behaviour comes from `quality_categories_focus`, not from the flag that appears to cause it. Found while fixing §93, whose root cause was the *same class* — `SPECIFICITY_BY_PHASE` declared since R23 and read by nothing. **Anyone reasoning from these flags is reasoning about nothing.** Either wire them or delete them; leaving them is how the next §93 happens. Worth a broader sweep: which other `GENERATION_CONFIG` / signature keys have zero engine readers? `configPrincipleSync.test.ts` proves every key has a *principle*, not that any key has a *consumer*. *Verify still open:* `grep -rn "peak_includes_race_pace" lib --include="*.ts" | grep -v planSignatures` — no hits = still decorative.

- ⏸️ **ZONE-BAND-01 — RE-CHECKED 2026-09-14, still correctly BLOCKED. Now has a numeric re-open trigger.**
  - `qualityHR = z3Low–z3Top`, and `z3Low` **is** the easy-run ceiling. Nobody running 4×5 min at 10K goal pace touches it except on the way up, and a 27-beat span is "a weather forecast, not a target" (Seiler). Hutchinson and Seiler both hold that neither the old 145–172 nor the current 145–158 is right for the work.
  - 🔴 **The blocker is DATA, and it has not moved:** production holds 126 scored analyses across **2 users**. Narrowing a prescribed HR band for the whole product on two people's observed HR is precisely the overclaim this board exists to prevent. **Do not guess a band.**
  - ✅ **Re-open trigger (new, so this stops being a vague "blocked"):** ≥ 20 distinct users with ≥ 10 HR-bearing quality analyses each. Re-check with the aggregate query in `docs/decisions/` — no PII, counts only. Until then the INSUFFICIENT EVIDENCE ruling stands and re-raising it without new data is re-litigating a settled question.
- ~~🔲 **ZONE-BAND-02 (original entry) — the `Zone 2–3` long run's ceiling describes only part of the session**~~ *(**MEASURED 2026-09-12, brief ready for the Coaching Board: `docs/investigations/zone-band-02-brief-2026-09-12.md`. NOT yet convened — founder's call.** P3 as filed, but see scale)* — ⚠️ **396 sessions on the 621-plan cohort grid, not 48.** The 48 came from the §84 Amendment 1 sitting's own grid; both are correct for their population and the board must be told which it is ruling on. **All 396 are `goal: time_target`, all carry `hr_target: '< 145 bpm'`, and 198 of them — half — go to BEGINNERS.** Mechanism verified in code: the header zone label and `ZoneBar` read `session.zone` (Zone 2–3, both lit) while the HR line beneath reads `session.type` (`'easy'` → the Z2 ceiling). Two display owners, each faithfully reporting a different one of the session's own two disagreeing fields. Three options costed in the brief (range target / narrow the zone string / per-segment targets via ADR-019's `derived_set`). — a long run with a marathon-pace or HM-pace finish carries `zone: 'Zone 2–3'` and `hr_target: easyHR` (`< 145 bpm`). The ceiling is honest for the aerobic portion and silent about the finish, so the Session Detail header renders 132–158 while the coach note says `< 145`. Deliberately left out of §84 Amendment 1 (whose invariant is scoped to **range** targets) because it is a different mechanism and the board's sitting did not cover it. The fix is a coaching call: either the target becomes a range covering the finish, or the zone string narrows to Zone 2 and the finish is described in the structure only. *Verify still open:* `grep -n "zone: 'Zone 2–3'" lib/plan/ruleEngine.ts`

### Personalisation has no inventory behind it — CAT-DEPTH-01

- ⚖️ **CAT-VO2-TIERA — BOARD RULED 2026-09-13: delivery DECLINED. §8 and §53 stay as they are; the 2026-09-06 concept ruling is not reversed.** A1 pyramid + A6 cutdown spend only 2–6 min at Z4–5, below §8's 12–18 min dose band — §8 **rejects them correctly** (a session mostly below vVO2max is not a VO2 dose); weakening the band to admit them would mislabel the stimulus. They are mixed/threshold sessions mis-categorised as VO2; a home is a future **mixed-session category** (SLT value call, not a correctness block), not a §8 amendment. A4 broken ladder is a redundant 7th I-anchored variant §53 surfaces in **0/216 plans**; a round-robin change to force it reshapes every plan's draw across all distances — wide blast radius for dead weight, **INCORRECT** to make. B0 stays shelved (gated on A6). **Delivery path closed.** No code. Record: `docs/decisions/coaching-board-2026-09-13-batch.md` §6. *Original filing:* 3 Tier-A rows blocked on delivery — the board ruled **6** Tier A shapes correct in principle. **Three shipped** (`intervals_30_30`, `intervals_rolling` on 2026-09-06; **`cv_intervals`** added 2026-09-06 — CV cruise intervals, threshold-domain, §88 Amendment 1). The remaining **three cannot be delivered without amending the mechanic each collides with** — build attempts were made 2026-09-06 and reverted:
  - **A1 descending pyramid** (I→CV→T) and **A6 10K-pace cutdown** (CV→5K→3K): multi-system sessions whose VO2-zone work is only 2–6 min, **below §8's 12–18 min VO2max dose band**. §8 rejects them correctly (a session mostly below vVO2max is not a VO2 dose). *Needs §8 to gain a mixed-session dose model — a board question, not a build.*
  - **A4 broken 4-3-2-1**: a 4th I-anchored VO2 variant, **undeliverable through §53's rotation** — a 10K plan has ~3 VO2 slots against a 7-deep VO2 pool, and least-used rotation cannot surface a redundant 7th shape (measured **0 / 216 plans** → SC-05 dead weight). *Needs a §53 rotation-coverage change (round-robin that guarantees pool coverage) — wide blast radius.*
  - **B0 anchor resolve** (`R` / `race_5K` / `race_3K`): only ever needed by A6 (and the shelved B1/B2), so reverted with A6 — resolving an anchor no row uses is dead code. Re-do it *with* whichever row consumes it.
  - **B1/B2 standalone R-pace speed rows** stay SHELVED (both boards — injury data uncollectable, ADR-011).
  - *Verify still open:* `grep -c "id: 'intervals_desc_pyramid'\|id: 'intervals_broken'\|id: 'intervals_cutdown'" lib/plan/sessionCatalogueData.ts` — all absent (deferred). The route forward is a Coaching Board sitting on §8's dose model + §53's rotation coverage, **then** build; the concept ruling already stands.

- ✅ **GRID-COVERAGE-01 — SHIPPED 2026-09-14. `cohortGrid` varied 10 of 31 input fields; it now varies 13 and the widening woke two dead invariants immediately.**
  - 🔴 **MEASURED: of 31 declared `GeneratorInput` fields, `cohortGrid` set only TEN. Thirteen were never set at all; eight more were constant.** The property sweep varies 24 **and gates on it**; `cohortGrid` never had such a gate. So the sweep proved plans were **VALID** across 24 dimensions while `cohort:shape` proved the **POPULATION** was unchanged across only 10 — a change could reshape who-gets-what along a dimension the grid cannot see, and one did (QUALITY-ONSET-ORDER-01).
  - **Never set (13):** `user_declared_level`, `fitness_intensity_level`, `max_hr_source`, `training_age`, `weeks_at_current_volume`, `acknowledged_prep_warning`, `preferred_long_run_day`, `benchmark`, `day_budgets`, `training_style`, `motivation_type`, `terrain`, `foundation_decision`. **Constant (8):** `age=35`, `resting_hr`, `max_hr`, `recent_quality_training='occasional'`, `race_name`, `hard_session_relationship='neutral'`, `injury_history=[]`, `athlete_name`.
  - **Added three axes, in value order** — grid 648 → **7,776** rows (8.6s, from 1.4s):
    - **`benchmark`** (×2) — the most important. With **no VDOT anywhere**, `assessFitness` sets `structural = intensity = byVolume`, so §79's two-signal **DISAGREEMENT** — the entire reason §79 exists — could never occur in any check.
    - **`training_age`** (×3: unset / 2-5yr / 5yr+) — the trigger for §79's intensity lift, and the reason QUALITY-ONSET-ORDER-01 was invisible.
    - **`age`** (×2: 35 / 52) — §3's masters recovery cadence keys on age ≥ 45 and had **never fired** in the grid.
  - ✅ **The widening woke TWO previously-unproven invariants on the first run, which is the proof the gap was real:** `INV-PLAN-VDOT-RAW-EXCEEDS-ANCHOR` (needed a benchmark) and `INV-PLAN-RETURNING-RUNNER-NOTE-PRESENT` (needed a training age). Liveness baseline 63 → 65 woken, 36 → 34 unproven — removals only.
  - **Declared cohort re-baseline** (the GRID changed, so the measured population changed — not a test turned green): generated 621 → 7,452 · maintenance 50.6% → 50.7% · constrainedByInputs 25.6% → **29.4%** · volumeConstrained 27.1% → **34.0%** · meanDeliveredPeak 39.96 → 38.1 km · marathon maintenance 71.1% → 71.6%. **Rates are broadly stable**, which is the reassuring part: the new rows fill in dimensions rather than skewing the population.
  - ⚠️ **STILL BLIND — `earlyQualityOnsetPct` is 0 before AND after, so ADR-021/§89's whole early-onset mechanism remains unreachable.** It needs `recent_quality_training: 'regular'`, which is **constant `'occasional'`** in the grid. Ten fields remain unset. Next increment below.
- 🔲 **GRID-COVERAGE-02 — the ten fields `cohortGrid` still never sets** *(P2, direct follow-on from GRID-COVERAGE-01)*
  - **Highest value first, with what each unlocks:**
    - **`recent_quality_training`** (constant `'occasional'`) — unlocks **ADR-021/§89 early quality onset**, currently 0% in the grid and therefore unverifiable. §97's one-week on-ramp rides on the same gate.
    - **`injury_history`** (constant `[]`) — unlocks §21 injury-aware selection and ADR-022's whole delivered-volume-ceiling family. *(Note: `verify:parity`'s separate grid DOES vary injuries; `cohort:shape` does not, so injury-driven RECLASSIFICATION is invisible.)*
    - **`user_declared_level`** — §79's asymmetric override; `INV-PLAN-USER-LEVEL-NO-UPWARD-TONNAGE` guards it and the grid cannot reach it.
    - **`weeks_at_current_volume`** — §29 fresh-return detection.
    - **`day_budgets`** — UX-WIZARD-01's per-day budgets (shipped 2026-09-13, never in this grid).
    - **`foundation_decision`** — §57 / ADR-020's foundation block.
    - Lower value: `preferred_long_run_day`, `terrain`, `training_style`, `motivation_type`, `max_hr_source`, `acknowledged_prep_warning`, `fitness_intensity_level`.
  - ⚠️ **Runtime is the real constraint, so this cannot just be "add every axis".** 648 → 7,776 cost 1.4s → 8.6s. Each further ×2 doubles it, and `cohort:shape` runs inside `npm run verify`. Adding the top four naively would be ~140s. **Needs a deliberate design** — either a second targeted grid for mechanisms the main grid cannot reach (the liveness baseline's `corpus` reason already names this pattern), or pairwise coverage rather than the full cross-product. The exhaustive-and-un-sampled property of the main grid is doctrine and should not be given up casually.
  - **Add the coverage GATE too:** `property-validate-plans.ts` fails when a `GeneratorInput` field is never varied. `cohortGrid` has no such gate, which is why this went unnoticed. Whatever the final axis set is, the gate should assert it — with the deliberately-excluded fields listed and reasoned, the SWEEP-BASELINE-01 debt-register pattern.

- ✅ **QUALITY-ONSET-ORDER-01 — SHIPPED 2026-09-15 → feature-registry (§79 Amendment 1 + Amendment 2).** First-quality-is-VO2max **25.4% → 16.8%**. ⚠️ **TWO board questions that were PARKED INSIDE this entry are now ORPHANED** — CV-ELIGIBILITY-01's open half and the beginner first-exposure question. Both are re-filed in the *Coaching & engine — complete open list* section above; do not let them die with this entry. The measured history below is retained as the record of three wrong diagnoses.
  - 📌 *Original entry follows, preserved.*
- ⚖️ ~~**QUALITY-ONSET-ORDER-01 — a runner's FIRST quality session is the HARDEST one.**~~ *(shipped — see above)*
  - ⚠️ **CORRECTED 2026-09-14, same day. The first numbers I filed here were WRONG and the correction halves the claim.**
    - I originally reported *"Zone 4–5 first in 80.6% of plans and 100% of beginner plans (66/66)"*. My `QUALITY` set included session type **`'hard'`**, which is the **§78 recalibration 5K time trial** — a BENCHMARK on a base/build deload week, Zone 4–5 by nature because it is a maximal *continuous* effort (CLAUDE.md's own session-colour table says exactly this). **The entire beginner figure was that time trial.**
    - **Re-measured with the benchmark excluded: 216 of 414 (52.2%), identical for intermediate and experienced. Cohort-grid beginners: 0 of 0 — they receive NO quality sessions at all.** §8's ceiling is working.
  - 🔴 **What survives, and it is still real.** Review case 01 — `fitness_level: beginner`, finish-goal 5K — receives **"Short VO2max", Zone 4–5, HR 164–190, RPE 7, in week 5** as her first-ever quality session, with the Z3 work arriving in weeks 6 and 7 after it. Case 02 (intermediate 10K) likewise opens on Long VO2max; case 03 (intermediate HM) correctly opens on Zone 3, because the HM signature declares threshold first. So a structurally-beginner runner **can** be handed the hardest stimulus first — the cohort grid simply contains no beginner who receives quality, which is a **coverage gap in the grid**, not an absence of the problem. Review case 01 is a beginner, finish-goal 5K, returning from a six-month layoff: her first session is *Short VO2max*, Z4–5, HR 164–190, **RPE 7**, in week 5. The Z3 cruise intervals and tempo arrive in weeks 6 and 7 — **after** it. Week 10 then adds hill reps at **RPE 8**, two weeks out.
  - **`INV-PLAN-INTENSITY-ORDERING` does NOT cover this.** It guards PACE ordering (Z3 never prescribed faster than Z4–5). **Nothing governs which stimulus a runner meets first.**
  - 🔍 **Root cause, and it is RATIFIED rather than accidental — three ratified rules interacting:**
    1. §5's VO2max adaptation deadline. On a short plan `deadlineWeekN <= buildPhase.start_week`, so `vo2MustOpenBuild` is true and VO2max **must** open build or it never adapts in time.
    2. 5K/10K signatures declare `quality_categories_focus: ['vo2max', 'threshold']` and the **array order is load-bearing** (`ordered.indexOf('vo2max')`). HM/marathon declare threshold first — which is why the effect concentrates on short races.
    3. §8's ceiling is keyed on **`intensityFitness`, not structural fitness** (D2/§79, *"never merge them"*). A structurally-beginner runner with a decent VDOT is intensity-intermediate, clears the 0-quality beginner ceiling legitimately, and then meets the hardest category first.
  - ⚠️ **§8's own config comment says `beginner → 0 (no quality at all in base; light tempo only after week 4)`.** A structural beginner getting VO2max at RPE 7 is not "light tempo". §8 describes the structural runner's experience; the code applies it to the intensity axis. **That gap is the question.**
  - ❌ **A fix was attempted and REVERTED, and the reason matters.** Extending §79's intensity re-entry window to structural beginners is a **no-op**: the window is counted in PLAN weeks (`wn <= intensityReentryWeeks`) and a beginner's first quality lands in week 5, after a 2-week window has expired. It would also have stamped `meta.intensity_reentry_active: true` on every beginner — **a false claim, since they are not returning.** Measured before and after: 66/66 unchanged.
  - ⚖️ **BOARD SAT 2026-09-14 — ruled CORRECT, build ATTEMPTED AND REVERTED. The finding is solid; the fix is not a one-liner.**
  - 🔴 **THE REAL DEFECT, and it is sharper than the framing above: §79's intensity re-entry window is SYSTEMATICALLY INERT.** §79 says *"withhold VO2max/hills for the opening `RETURNING_RUNNER_INTENSITY_REENTRY_WEEKS` so quality leads with tempo/threshold"* — an ORDERING claim. It is encoded as *"no VO2max-category session in weeks 1–`intensity_reentry_weeks`"*: **CALENDAR** weeks. Weeks 1–4 are the all-easy BASE phase, where there is no quality to withhold, so the window closes the week before quality begins.
  - 📐 **MEASURED (`scripts/measure-reentry-reach.ts`, 72-plan grid): of 48 plans with re-entry ACTIVE, the first quality session falls inside the protective window in 0 of 48 (0.0%), and is Zone 4–5 anyway in 32 of 48 (66.7%).**
  - ⚠️ **`INV-PLAN-RETURNING-INTENSITY-REENTRY` is a DECORATIVE invariant.** It encodes the same calendar reading, so it is trivially true on every plan and **cannot fail** — which is exactly why it sits in the liveness baseline as never-woken. The check and the defect share a premise.
  - 🔴 **Why no harness caught it: the cohort grid never sets `training_age`, so §79's intensity lift never fires anywhere in the primary verification surface.** `verify`, `verify:parity` and `cohort:shape` are all green on a mechanism they cannot reach. ✅ **RESOLVED by `GRID-COVERAGE-01`, shipped 2026-09-14** — `cohortGrid.ts:76` now carries `TRAINING_AGES = [undefined, '2-5yr', '5yr+']` as a real axis, so §79's lift fires in the grid. ⚠️ **This line promised an entry for `GRID-COVERAGE-TRAINING-AGE-01` further down and there was none** — second instance of the same defect as the `LR-ABS-ALLOWANCE-01` reference, found by `XREF-DANGLE-01`'s guard rather than by reading.
  - ❌ **THREE fixes attempted, all reverted, recorded so they are not retried blind:**
    1. Adding a `structuralBeginner` arm to `intensityReentryActive` — **no-op** (window still calendar-anchored), and it would have stamped `intensity_reentry_active: true` on every beginner, a false claim.
    2. Re-anchoring the window to quality onset — real progress, 66.7% → 33.3%, but incomplete.
    3. Making §79 beat §5's `vo2MustOpenBuild` and separating the `undefined` sentinel (which meant BOTH "no window" and "withheld entirely") — **broke 29 tests including `cohortShape`, i.e. a silent cohort reclassification.**
  - 🛑 **Why it was reverted rather than pushed through:** VO2max placement has a **post-pass** (`applyV2Vo2MaxOnsetTiming`, V2's swap safety net) that moves it to meet §5's deadline *after* the rotation has chosen. Fixing the rotation without understanding that post-pass is guessing, and the third attempt proved it. **This needs the V2 swap path read end-to-end first.** Effort M, not S.
  - **The board's ruling stands and is recorded for the build:** §79's encoding must match its stated intent (anchor to quality onset, not plan start), and where §5's adaptation deadline and §79's tissue protection genuinely conflict, **§79 wins** — missing the deadline costs adaptation, giving a returning runner intervals before the tissue is ready costs them the block. §34's honest-residual pattern covers the shortfall.
  - ⚖️ **BOARD 2026-09-14 (batch): the earlier CORRECT stands. SHIP AFTER SC-10, and they do NOT interact.**
    - **Independent:** §5's adaptation deadline is arithmetic over **weeks** (`totalWeeks − taperWeeks − VO2MAX_ONSET_MIN_ADAPTATION_WEEKS`) and contains no session-size term, so repairing SC-10's ceiling changes how LONG a VO2max session is, not WHICH WEEK it lands in. `vo2MustOpenBuild` is unaffected.
    - **Order: SC-10 first** — smaller blast radius, repairs a leak rather than changing a policy, and it makes the sessions this item moves the correct SIZE before they are moved. Shipping this first would relocate mis-sized sessions and confuse attribution of any cohort move.
    - 🛑 **Willy, carried into the build:** both changes push the same direction (less VO2max, later). **Measure the COMBINED effect on total VO2max exposure**, not each in isolation, or the second ruling silently doubles the first.
  - ✅ **RE-VERIFIED 2026-09-14 against the GOVERNING RULE, not the prose** — the check I failed to do on SC-10. `INV-PLAN-RETURNING-INTENSITY-REENTRY` is literally `w.n <= plan.meta.intensity_reentry_weeks`: **plan weeks, no branch, no work-band equivalent hiding behind it.** The encoding IS the rule and it is vacuous. Premise confirmed.
  - 🎯 **SHOWCASE COHORT MEASUREMENT (`scripts/measure-charity-first-quality.ts`) — the charity partnership is the first acquisition channel and its runners are predominantly beginners taking on 10K / HM / marathon. Measured on all 11 `CHARITY_PERSONAS`:**
    | persona | level | §79 re-entry | first hard session |
    |---|---|---|---|
    | M1 first-timer marathon | beginner | no | **none — all easy** ✅ |
    | H1 first-timer HM | beginner | no | **none — all easy** ✅ |
    | T1 couch-to-10K | beginner | no | **none — all easy** ✅ |
    | M2 / M3 / M5 / H2 / H3 / T2 | intermediate | — | Zone 3 tempo ✅ |
    | **T3 masters 10K, age 55, knee history** | intermediate | **yes (4wk)** | **Long VO2max, Z4–5, RPE 7, wk 5** ❌ |
    | M4 sub-4:00 busy 3-day | — | — | ⛔ refused by design ✅ |
  - ✅ **The three true first-timers receive NO hard sessions at all** — §8's ceiling is doing its job, which is the right answer for the showcase.
  - ❌ **The one hit is the WORST-CASE persona: T3, a 55-year-old with knee history whose §79 protection is ACTIVE.** Window covers weeks 1–4; quality starts week 5. The protection expires the week before it is needed, on exactly the runner it exists for.
  - 🔍 **And the deeper point, which changes how the fix should be judged: M3 and M5 also have re-entry active and also have an expired window — they get Zone 3 first only because the MARATHON/HM signatures declare `['threshold','race_specific']`. §79 is protecting nobody; the DISTANCE SIGNATURE is doing the work by accident.** The 10K signature declares `['vo2max','threshold']`, which is why T3 is the one exposed. **Do not read "9 of 10 are fine" as §79 working.**
  - 🔧 **BUILD ATTEMPT 4 (2026-09-14) — THE FIX IS FOUND AND PROVEN ON THE SHOWCASE COHORT. It is blocked on ONE further defect, now precisely identified.**
    - ✅ **The change:** count the re-entry window in QUALITY-CARRYING weeks from quality onset (`insideReentryWindow(weekN)`), consumed by both `vo2BuildSlotIndex` and the week loop. **Three lines plus a helper.**
    - ✅ **SHOWCASE RESULT: T3 (masters 10K, age 55, knee history) goes "Long VO2max [Zone 4–5] RPE 7" → "Tempo run [Zone 3] RPE 7". Charity cohort first-hard-session-is-Z4–5: 1 of 10 → 0 of 10.** Synthetic grid 66.7% → 33.3%.
    - ✅ **Cohort move is negligible and was checked:** maintenance 50.7 → 50.6 (−0.1pp), meanDeliveredPeak 38.10 → 38.15 km, **`plansWithNoQualityPct` UNCHANGED at 33.3** — no plan lost its quality. The 15 `cohortShape` failures are the zero-tolerance baseline doing its job, not breakage.
    - 🔴 **THE BLOCKER: the property sweep goes 0 → 47 plans with ERROR violations**, and the invariant states the mechanism itself: *"'Progressive tempo''s stated duration does not fit its own prescribed structure (28.0 min of work+recovery needs ~48 min total with warm-up/cool-down). Got 43 min"* (`INV-PLAN-STRUCTURED-SESSION-DURATION-COHERENT`, §8), plus `INV-PLAN-RACE-SPECIFIC-EXPOSURE` (§22). **The session is SIZED as a VO2max session and then handed a tempo category — the size does not follow the category swap.** VO2max is capped short; tempo needs longer. Withholding VO2max changes WHICH row is selected but not the minutes already allocated to that slot.
    - ✅ **So the remaining work is precisely scoped:** make the slot's sizing follow the category the rotation actually chose. That is a sizing-ordering fix inside `buildWeekSessions`, not another attempt at the window.
  - ⛔ **BUILD ATTEMPT 5 (2026-09-14) — THE ATTEMPT-4 DIAGNOSIS ABOVE IS DISPROVED. The sizing fix is a MEASURED NO-OP. Real blocker is a prerequisite, filed as COHERENCE-SELECT-01.**
    - ✅ **Re-confirmed the ordering fix works:** onset-anchored window (`insideReentryWindow`, quality-carrying weeks from build start) → T3 *Long VO2max [Z4–5]* → *Tempo [Z3]*, **charity 0/10**, grid 33%→**66.7%**. tsc clean. This half is solid and ~10 lines.
    - ❌ **The "sizing follows the selected category" fix is a NO-OP for the 47 errors.** Measured directly: window-fix WITH the sizing fix = 47 failures; window-fix WITHOUT it = 47 failures — identical. **Reason: a structured session's `duration_mins` is `durationForMainSet(structuredMainMins)` — driven by the row's STRUCTURE, not by `distKm`.** Changing the distance cannot change the duration, so it cannot change duration-coherence. Attempt 4 mis-attributed the blocker. **Do not retry the sizing fix.**
    - 🔴 **The 47 errors are `INV-PLAN-STRUCTURED-SESSION-DURATION-COHERENT` (72/74 of a characterisation grid, ALL at volume 15–20) + `INV-PLAN-RACE-SPECIFIC-EXPOSURE` (all time_target, second-half).** They are a PRE-EXISTING latent defect the ordering fix merely EXPOSES: withholding VO2max forces §53's least-used rotation to select `progressive_tempo`, whose fixed fitness×phase work-target (`PROGRESSIVE_TEMPO_MAIN_MINS`, e.g. build 24 → 43 min vs peak 28 → 48 min) surfaces a coherence mismatch, and §53's rotation is **path-dependent** — every partial narrowing of the withhold reshuffles the tally into MORE incoherent picks (measured **47 → 594** repeatedly; this is the same class that broke 29 tests on attempt 3).
    - ❌ **DEAD END, do not retry: a volume-affordability gate on the withhold** (withhold only when the week affords the threshold structure). Conceptually wrong — the session duration is FIXED config, not budget-driven — so it "helped" only by coincidentally suppressing selection; got 25 failures but REVERTED protection to 33%. Confirmed not the path.
    - ✅ **Also confirmed clean:** non-re-entry runners are byte-identical under the onset window (the predicate returns false for them, matching the old one). The cohort move is scoped to the re-entry cohort only.
    - 🎯 **PATH FORWARD:** resolve **COHERENCE-SELECT-01** (below) first — give §53 selection a coherence guard so `progressive_tempo`/structured rows are never selected where their fixed structure can't be honoured. Then the onset-anchored ordering fix (`insideReentryWindow`, shared by the `vo2BuildSlotIndex` IIFE and the withhold arg via a single precomputed `Set` so the two channels can't diverge) drops in green. The single-`Set` sharing is REQUIRED — feeding the two channels different predicates is what produces the 594 ripple.
  - ❌ **MEASURED AND REJECTED — do NOT retry these two, they cost nothing but time:**
    - **§79 beating §5's `vo2MustOpenBuild`** (`vo2Slot = vo2BuildSlotIndex ?? (vo2MustOpenBuild ? 0 : …)`): **zero effect on the residual (16/48 unchanged) and breaks 29 tests.** The board ruled §79 wins that conflict, but the conflict is not what produces the residual.
    - **Guarding the `applyV2Vo2MaxOnsetTiming` post-pass** from swapping VO2max into a protected week: **zero effect (16/48 unchanged).** Defensively sensible, but shipping code with no measured effect is the decorative class this repo fights. If it is ever added, it must be with a test that proves it can matter.
  - 🛠️ **IMPLEMENTATION BRIEF — read this before touching the code, it is where three attempts went wrong.**
    - **The call path, in order:** `assessFitness()` (`lib/plan/fitnessAssessment.ts:~102`) sets `intensityLiftedForReturn` when `trainingAgeExperienced && intensity === 'beginner'` → `generateRulePlan` computes `intensityReentryActive` (`ruleEngine.ts:~5337`) and `intensityReentryWeeks` → the `vo2BuildSlotIndex` IIFE (`~5498`) walks BUILD weeks and returns the first rotation index not withheld → `preferredQualityCategory()` (`~2340`) resolves `vo2Slot = vo2MustOpenBuild ? 0 : vo2BuildSlotIndex ?? ordered.indexOf('vo2max')` → **and then a POST-PASS, `applyV2Vo2MaxOnsetTiming`, can move VO2max again to meet §5's deadline.** That post-pass is why fixing the rotation alone does nothing; read it first.
    - **`vo2BuildSlotIndex` returns `undefined` for TWO different states** — "no re-entry window, use the natural slot" and "the window withheld every eligible week". The consumer can only read one. A re-entry runner whose build is shorter than the window therefore falls back to the natural slot, i.e. **VO2max first**, the precise outcome §79 forbids. Needs a distinct sentinel.
    - **The window must be counted in QUALITY-CARRYING weeks from onset**, skipping deloads — not in calendar weeks. Quality onset is effectively `phases.find(p => p.name === 'build').start_week`.
    - ⚠️ **Touching this reshapes the cohort.** Attempt 3 broke **29 tests including `cohortShape`**. Expect a declared cohort move and a parity move; budget for re-baselining both **with the numbers stated**, and re-run `scripts/measure-reentry-reach.ts` (which now reports "first quality is PROTECTED", not the old calendar test).
    - **Also fix the invariant, not just the engine.** `INV-PLAN-RETURNING-INTENSITY-REENTRY` encodes the same calendar reading and is **trivially true on every plan** — it cannot fail, which is why it sits in the liveness baseline as never-woken. Re-express it against quality onset and give it a liveness mutation, or it will keep guarding nothing.
    - ✅ **The grid can now SEE this cohort** (GRID-COVERAGE-01, shipped): `training_age` and `benchmark` are varied, so §79's lift fires inside `cohort:shape` and the liveness corpus. Before that widening, any fix here was unverifiable.
  - **The question the build must also answer:** when structure says beginner and intensity says intermediate, should the first exposure be VO2max or tempo? §79 holds that upward declaration *"buys intensity only, never tonnage"* — but ALLOWANCE and ORDER are different axes. Delaying VO2max costs §5 adaptation weeks on a short plan; not delaying it hands the least-prepared cohort the hardest stimulus first. A third option is that a finish-goal beginner needs **no VO2max at all** — aerobic base plus threshold — which is what most coaches would prescribe.
  - **Folds in CV-ELIGIBILITY-01's open half:** *"should threshold-family rows require STRUCTURAL intermediate, not just intensity-intermediate?"* Same question, same axis.

- ✅ **V2-SWAP-S22-01 — SHIPPED 2026-09-15 → feature-registry (§22 Amendment).** Board ruled option B: a session displaced by §5's relocation is exempt from §22's per-week check, structural stamp, binding ratio condition measured clean (0/576). Detail retained below as the record.
  - **The defect.** `applyV2Vo2MaxOnsetTiming` displaces a quality session out of the week that held the first VO2max. `INV-PLAN-RACE-SPECIFIC-EXPOSURE` (§22, **ERROR**) governs second-half build/peak quality on a time-targeted plan and **exempts VO2max** (`isVo2maxSession`) — so before the swap the week was legal by exemption, and after it holds a threshold row that is neither race-pace nor exempt. **MEASURED: 84 failures in a 4,608-input probe**, every one `INV-PLAN-RACE-SPECIFIC-EXPOSURE`.
  - ⚠️ **`ruleEngine.ts:5500` ALREADY SAYS THIS** — *"the plan is CONSTRUCTED compliant instead of being built late and swapped afterwards (which breaks §22)"*. The comment was right and nothing enforced it.
  - **Why it blocks the onset fix:** the swap is inert today (see V2-SWAP-INERT-01) and only fires once §79 withholds VO2max. So repairing §79 turns a documented-but-dormant defect into 84 live ERROR violations.
  - ⚖️ **NEEDS A BOARD RULING — do NOT decide this unilaterally.** The obvious fix (decline swap candidates that would break §22) sits directly beside the option the board **rejected** on 2026-09-15 for the sizing question (declining phase-sized candidates makes §5's window unenforceable). The board's own note is that the correct long-term answer is **option C — retire the swap for construct-compliant placement** (`vo2MustOpenBuild` already does this), which it scoped OUT of the 2026-09-15 sitting. That is the question to put.
  - *Verify still open:* flip both call sites in `ruleEngine.ts` from `reentry.withheldIn(...)` to `reentry.withheldAtQualityIndex(...)` (the build-slot IIFE passes `idx`, the driver loop passes `buildRotationIndex`) and run the sweep → non-zero `INV-PLAN-RACE-SPECIFIC-EXPOSURE` = still open.

- ✅ **V2-SWAP-INERT-01 — RESOLVED 2026-09-15 as a side-effect of QUALITY-ONSET-ORDER-01.** The swap fired on 0 of 2,304 inputs; repairing §79 makes it fire on **576**, so it is no longer dead code and both fixes hanging off it are load-bearing. The longer-term question — retire the swap for construct-compliant placement — stays as the board's noted direction, not a defect.
  - **MEASURED: `V2-vo2max-onset-timing` fires on 0 of 2,304 varied inputs and 0 of the 7,452-plan cohort grid.** 346 of 2,304 record `V2-vo2max-onset-unreachable` (CD-22's honest "plan too short" path); the rest are already compliant by construction, because `vo2MustOpenBuild` builds them that way.
  - **Why this matters even though nothing is broken today:** a whole documented mechanism is dead, and the repo has been here before (§97's two inert gates, §79's inert window, `ZONE_DISCIPLINE_BANDS`). Dead-but-plausible code is what made both other items on this page mis-diagnosed twice each. Either the swap is retired in favour of the construct-compliant path (V2-SWAP-S22-01's option C) or it is kept and given a reachability test — not left looking load-bearing.
  - *Verify still open:* count plans whose `rule_adjustments` contain `V2-vo2max-onset-timing` across the cohort grid; zero = still open.

- ⚠️ **COHERENCE-SELECT-01 — RE-DIAGNOSED 2026-09-15 AND RENAMED `V2-SWAP-RESIZE-01`. THE CAUSE FILED BELOW IS WITHDRAWN — it is the second wrong diagnosis on this item.** *(record: `docs/decisions/coaching-board-2026-09-15-deload-pos2-and-v2-swap.md`)*
  - 🔴 **The real defect: `applyV2Vo2MaxOnsetTiming` (`ruleEngine.ts:4593-4597`) physically swaps two Session OBJECTS between weeks and updates ONLY `session.id`.** A `progressive_tempo` sized for BUILD (24 min main → `derived_set` 3×8 min → `duration_mins` 43) is relocated into a PEAK week, which requires 28 min main / ~48 total. The session is **not internally incoherent** — 24 min of work genuinely fits 43 min. It is carrying **the wrong dose for the block it now sits in**.
  - 📐 **MEASURED: 64 failures in a 2,916-input probe**, every one `progressive_tempo`, concentrated at low weekly volume (km=15: 16 · km=25: 8 · km=40: 0 · km=60: 0) — pool thinness is what makes this the displaced row, which is why the original "volume" framing *looked* right.
  - ⚖️ **RULING (option A): re-size the relocated session through the SAME sizer the constructor uses**, inheriting its floor protections (Willy/Sims: no bespoke resize path). ❌ Declining phase-sized swap candidates is REJECTED — it makes §5's adaptation window unenforceable exactly on the low-volume plans where it fires (CD-22 ruled it binding where reachable). ❌ Retiring the swap for construct-compliant placement is the correct LONG-TERM direction (already documented at `ruleEngine.ts:5500`) but is **explicitly out of scope for this change**.
  - 🔍 **The conflict scan also found an ENFORCEMENT-LAYER defect.** §8's prose says the invariant checks a session is *"internally consistent with its own `derived_set`"*. For `progressive_tempo` the code reads the **config table** instead (`progressiveTempoExpectedMainMins`), because the row's lengths are `{kind:'parameter'}` with nothing to sum. Prose and code disagree; §8 must be amended to say what the check actually does.
  - 📌 *Original filing preserved below as the record of the wrong diagnosis.*

- 🔲 ~~**COHERENCE-SELECT-01 — §53 quality selection has no volume/structure-coherence guard**~~ *(WITHDRAWN 2026-09-15 — see above)*
  - **The defect:** `selectCatalogueSession`'s least-used rotation (§53, CAT-ULTRA-THIN-01) picks purely on eligibility + usage tally. It has **no check that the runner's volume/paces can carry the selected row's fixed structure.** `progressive_tempo` (and peers) size their `duration_mins` from `durationForMainSet(PROGRESSIVE_TEMPO_MAIN_MINS[fitness][phase])` — a FIXED fitness×phase target — so when the rotation lands one on a week whose delivered shape doesn't match that target's phase read, `INV-PLAN-STRUCTURED-SESSION-DURATION-COHERENT` (§8) fires (e.g. 43 min stated vs 48 needed).
  - **Why it's latent (not currently firing on `main`):** the only cohort that reaches these rows at low volume is the **intensity-lifted returning runner** — and today §79's re-entry window is inert (QUALITY-ONSET-ORDER-01), so VO2max is never withheld and the rotation never has to reach `progressive_tempo` there. Repair §79 and it surfaces immediately. So this MUST land first (or same commit).
  - **Blast-radius note (measured):** §53's rotation is **path-dependent** — any change to which rows are consumed ripples the tally into different picks. A fix must be validated against the full property sweep, not a single cohort. Naive narrowings measured 47→594 failures.
  - **Board:** touches what the engine prescribes (which quality row a runner gets) → **Coaching Board** question. The guard is arguably defect-avoidance (never prescribe a structurally-impossible session), but the *substitution rule* (what to pick instead) is doctrine.
  - **Verify still open:** apply the onset-anchored §79 fix (`insideReentryWindow`) and run `NODE_ENV=test npx tsx scripts/property-validate-plans.ts` → non-zero `INV-PLAN-STRUCTURED-SESSION-DURATION-COHERENT` hard failures = still open.

- ✅ **CV-ELIGIBILITY-01 — RE-VERIFIED 2026-09-14, the 2026-09-06 decision STANDS. Not a defect.**
  - **Verified as filed:** golden P0 (3-day beginner HM, 5K benchmark 29:00) still reports `volume_profile: maintenance` **with CV intervals present**. That is exactly the state the decision recorded, so nothing has drifted.
  - **Why it stays:** the flip is a 1-point boundary case (peak-to-week-1 ratio 109% vs the 110% "build" threshold), "maintenance" is arguably the more honest label for a 3-day beginner half, and the plan explains itself in an honest note. A scoping preference, not a bug.
  - ⚖️ **The open half is now folded into a live board question.** "Should threshold-family rows require *structural* intermediate, not just intensity-intermediate?" is the same question as QUALITY-ONSET-ORDER-01 below — both ask whether a structurally-beginner runner should meet a given intensity at a given time. Tracked there rather than as a second P3 that nobody pulls.
- ✅ **HSR-INERT-01 — CLOSED 2026-09-09. Both halves resolved.** `overdo` closed 2026-09-07 by §96 (a brake, not a preference); the `love` half closed here: **the coaching question was already settled** — CB-HSR-01 (2026-09-07, §96) ruled the experience gate on `love`'s structural effect (peak-LR stretch + §47 back-to-back exception) **CORRECT** ("tissue-tolerance judgements"), and explicitly routed the residual — *"nothing tells the runner the answer is conditional"* — to **brand as copy, not coaching**. So no new board sitting was needed (the board's own conflict scan caught the prior ruling — governance anti-duplication working). That copy shipped: `meta.hard_pref_note` is now stamped for a `love` runner below the 5yr+ tier (*"You said you like hard sessions. The plan earns longer peak runs and more intensity as your training history deepens — not before your legs have proven they will take it."*). Trigger is the single `training_age !== '5yr+'` condition ON PURPOSE — re-deriving the full multi-branch gate would duplicate it; the copy is forward-looking so it stays honest for a 2-5yr HM runner who got the partial recent-run stretch. Copy, not coaching → **no invariant** (would force re-deriving the trigger). `hardPrefNote.test.ts`; 590 plan tests, sweep/matrix/tsc green. **Surfacing** folds into the generalised note-render gap below (PLAN-NOTE-SURFACE-01). Original filing preserved below as the diff-not-read lesson. *Original:* ~~`overdo` can never do anything, and `love` is silently gated on `5yr+`~~ — **the original filing of this item was wrong and is preserved as a lesson.** It said the input was inert on 5K/10K because the two consumers found by reading the code are gated `distKey === 'HM' || 'MARATHON'`. Measured by DIFF instead, the live branch is a *third* one — §47's peak long-run step-back exception (`ruleEngine.ts:3348`) — which is **distance-agnostic** and gated on `training_age === '5yr+'` + no injury history. Reading the code found the wrong two branches. The measured truth:

  | `training_age` | `love` | `overdo` |
  |---|---|---|
  | `6-18mo` | inert | inert |
  | `2-5yr` | inert | inert |
  | `5yr+` | **fires** (all distances) | inert |
  | `5yr+` + injury history | inert | inert |

  - ~~**`overdo` is a wizard option that cannot change anything, for any runner, at any distance, ever.**~~ **CLOSED 2026-09-07 by §96** (`eb74acc`, *"`overdo` is a brake, not a preference"*) — shipped hours after this item was filed, so the text above described a state that no longer existed. Re-measured 2026-09-08 by INPUT-EFFECT-01 and by this item's own `Verify still open` command: `overdo` now **differs from `neutral` on all four distances** (10K: quality sessions replaced by easy runs, plan shortened 14→12 weeks). **The `love` half below still stands.**
  - **`love` is gated on `5yr+`.** The boundary between the wizard's "2–5 years" and "5+ years" chips silently decides whether the runner's stated preference is honoured at all — and nothing tells them. **The founder is `2-5yr`**, which is why his plan showed no response.
  - **The sharpest question is `overdo`, and it is the most brand-aligned thing in this item.** *"I overdo it. Rein me in."* is the only answer where the runner asks for PROTECTION, and the engine treats it as "no preference". Zonna's core truth is "You're trying hard. That's the problem" — a runner self-identifying as that persona is the product's whole thesis, and the input is discarded. Whether `overdo` should behave nearer `avoid` (guard rails, tighter easy-run policing) than `neutral` is a **Coaching Board** question, not an SLT one.
  - **SLT ruling (2026-09-07) stands:** do not build a new engine lever to make `love` "work" on 5K/10K. §1 forbids the obvious route (a second quality session was rejected unanimously as CD-16's Option B). Fix the dishonesty; route the mechanism to the board.
  - **§1 accounting the board needs:** §24b's segmented long run ("marathon pace + HM-pace finish") stays `type: 'easy'`, so §1 — whose numerator is `quality` sessions — does not count it. Measured on a 5-day 10K: **17.9% counted, 21.4% if the segmented long runs counted**, against a 25% ceiling. So "there is headroom" depends entirely on whether a long run that is half at HM pace is an easy session. That question is prior to any proposal that adds more of them.
  - **Do not delete the input** — `avoid` works everywhere and is load-bearing, and the field feeds `athleteContext` for all six coaching surfaces.
  - *Verify still open:* `npx tsx scripts/board-evidence-hsr.ts` — as of 2026-09-08 every cell reads `differs`, so the **`overdo` half is closed**. What remains open is the `love` gate: a `2-5yr` runner's stated preference is silently discarded and nothing tells them. Measure that with a `training_age`-varying diff, not this script's default row.

  > **Lesson, recorded because it cost a wrong filing:** the first version of this item was written from a static trace of consumers. Three separate greps agreed, and all three found the wrong branch. A one-line diff of two generated plans found the truth immediately. **Where the question is "does this input change what a runner sees", generate two plans and diff them — never read the code and conclude.** The same fixture error also nearly produced the opposite error: the first diff run used `training_age: '2-5yr'` and reported HM/MARATHON as INERT, which is a property of the fixture, not the engine.

- ✅ **CAT-DEPTH-01 Phase 2 — RESOLVED 2026-09-09 (no engine change).** The coaching lever was Coaching-Board **VETOED** (4th time, §53); the SLT then ruled the differentiation goal **coaching-sufficient** and **pivoted to visibility**, which **shipped** as PLAN-NOTE-SURFACE-01 (the "Why this plan" surface + the derived level-fit line). Nothing actionable remains — this entry is the decision record. *(Detail below.)* **Phase 1 shipped 2026-09-04 (`749fb05`, CB-CAT-01 / §85)**. The Phase 2 goal (threshold work differentiates by fitness) was measured, routed to the Coaching Board (2026-09-09), and the proposed lever was **VETOED UNANIMOUSLY for the FOURTH time** (recorded in §53). **The correction is the finding:** the item's own framing — *"implement `scaling: 'rep_length'`, the most likely Phase 2 lever"* — is not a lever, it is a wall. Rep length is the **stimulus identity** (SC-08/EG-01); **rep COUNT is the dose, rep length is what the session IS**; and dose-selecting the longest rep is Seiler's exact "converge on the biggest that fits" load-inflation. The discrete-whole-minute-variant reframing is the same lever and was re-blocked. Measured root confirmed: `THRESHOLD_WORK_TARGET_MINS` **is** fitness×phase-scaled (int `{18,22}` / exp `{22,26}`), but a coarse rep (mile ≈ 7.2min, 10-min cruise) quantises the count so 18 and 22 both land on 3 reps.
  - **What the board ruled ships / doesn't:** the *collapse* of `tempo_cruise`+`tempo_cruise_short` into one `select_by: 'rotation'` parameterised row is permissible (variety + removes a two-row duplication — the doctrine's own "collapse when v2 lands"), but it is **not** fitness-differentiation and does **not** close this item. See the "permissible collapse" option below if ever wanted.
  - **SLT ruled 2026-09-09 — CLOSE the differentiation goal as coaching-sufficient; PIVOT to VISIBILITY (unanimous 5-0).** The reframed question — is plan-level differentiation (fitness-gated row **eligibility** + **rep count** + §8 **quality count** + §89 **onset**) commercially sufficient — was answered: **yes, the differentiation is real; the problem is it is invisible.** *"May as well use a Garmin plan"* is a **legibility/perception objection at the trial→paid moment** (Sutherland: "no one churned because their reps were 6 min not 7"), not a request for a finer dose. The board **rejected pursuing a new engine lever** (the row-selection preference) as the illusion-of-progress class — Wood's kill: it would change outcome/behaviour by ~nothing to move a *feeling*, is board-gated and speculative, and improves only what the runner can't see (Traynor/Fried: expensive surface area, not value). Hutchinson (dual hat): the near-identical per-session threshold *shape* is honest, not a defect — a 22-min vs 24-min threshold session *should* look almost the same; the difference is dose+frequency, not choreography, and the plan IS a defensibly different prescription.
  - **The pivot → surface "why this plan fits your level."** A single, honest, generated-at-plan-time explanation of the level-based decisions the engine already made. **This is the SAME gap as PLAN-NOTE-SURFACE-01** (the meta-note family that renders nowhere) — the level-explanation is one more note in that family, built on the ONE shared renderer, not a fork. Wood's guardrail: *once, honest, truthful to what the engine did* — never a persistent "personalised!" brag (decoration/off-brand). Hutchinson's constraint: copy must match the actual coaching, or it's a new prescription claim → board. Copy via `frontend-design`/brand. **No engine change, no new prescription, no Coaching Board for the surfacing.**
  - **Do NOT re-propose (five dead routes):** rep_length / rep-length-as-dose (§53, 4× vetoed); base compression, base −1 week, deload cadence, `difficulty_tier` selection bias (§85). All measured, all failed.
  - *Status:* the P1 *differentiation-lever* goal is **closed** (coaching-vetoed, SLT-sufficient). The residual is the **visibility** work, folded into PLAN-NOTE-SURFACE-01. This entry stays only as the decision record; the actionable work is PLAN-NOTE-SURFACE-01.

- ✅ **SC-10 / CD-14 — APPEARS FIXED. My 2026-09-14 "new measurement" was AGAINST THE WRONG RULE and is withdrawn. Do not re-open without reading this.**
  - 🛑 **What I claimed, and why it was false.** I reported *"VO2MAX_MAIN_SET_MAX_MINS (20) is exceeded by 91.9% of VO2max interval sessions"* and took it to the board, which ruled CORRECT WITH AMENDMENT on it. **The 20-minute MAIN-SET ceiling does not govern those sessions.** `INV-PLAN-VO2MAX-MAIN-SET-CAP` **branches**: where work minutes are derivable it checks the ratified **12–18 minute WORK band**; the 20-minute main-set figure is only the fallback for **legacy v1 rows**.
  - 📐 **Measured: 3,996 of 3,996 VO2max interval sessions (100%) carry a `derived_set` and a `pace_target`.** Every one is work-band governed, and the property sweep is clean — so every one is INSIDE 12–18. **There is no breach.**
  - 🛑 **The ordering comparison was the wrong QUANTITY too.** A main set is work **plus recoveries**. VO2max runs ~1:1 work:recovery; threshold runs short jogs. 15 min of VO2max work is a ~30 min main set; 22 min of threshold work is a ~26 min main set — **a longer VO2max main set is the CORRECT consequence of a shorter VO2max work dose.** The 25.5-vs-23.7 medians I reported are that, not an inversion.
  - ✅ **So SC-10's original defect (flat 18%-of-weekly sizing making VO2max the largest session) appears to have been FIXED by SC-08 / CD-14's work bands**, which size paced-rep rows from `VO2MAX_WORK_TARGET_MINS` / `THRESHOLD_WORK_TARGET_MINS` rather than from the flat share. The flat share still sets a base distance; the work content no longer follows it.
  - 🔍 **How it was caught: Willy's binding condition on the (void) ruling.** "Prove work minutes do not fall below the floor" sent me to the work reader, and the work reader showed the cap I had been measuring against was not the operative rule. **A condition attached to a ruling caught the ruling's own premise.**
  - ⚠️ **BEFORE RE-OPENING THIS, the question must be asked against WORK MINUTES, not main-set minutes.** The correct test is: are delivered work doses inside `VO2MAX_WORK_TARGET_MINS` (12–18) and `THRESHOLD_WORK_TARGET_MINS` (18–26), and is VO2max work < threshold work per plan? `scripts/measure-mainset-ordering.ts` measures MAIN SET and is therefore **the wrong instrument** — it is kept only as the record of this error.
  - **Still true and still correct:** the earlier rejection of category PERCENTAGES (15% → 187 ordering breaches, 220 undersized; 17% broke ordering outright) stands, and `mainSetSizing.test.ts`'s pin on the flat share should stay.

- 🗃️ **SC-10 (superseded entry — the withdrawn measurement, kept as the record)** — NEW MEASUREMENT DELIVERED 2026-09-14 (7,452 plans, not 16). The inversion is REAL, and a SECOND defect was found underneath it: the VO2max ceiling is breached by 91.9% of the sessions it governs.** *(P2)*
  - ⚠️ **The "masked, not fixed" warning was right, and the sample was the mask.** The item recorded the inversion as *"0 of 16"* and warned that green reads as evidence the ordering is governed. Re-measured on the widened cohort grid (GRID-COVERAGE-01): **252 of 1,296 plans carrying both a VO2max and a threshold session invert the ordering — 19.4%.** Not zero, and never was.
  - 🔴 **THE BIGGER FINDING — `VO2MAX_MAIN_SET_MAX_MINS` (20) is exceeded by 3,672 of 3,996 true VO2max interval sessions: 91.9%, mean overshoot +4.9 min, worst +16.3.** The ceiling that was supposed to be SC-10's answer (*"the main set needs sizing in ABSOLUTE minutes"*) is delivering 25 minutes where it declares 20.
  - 🔍 **MECHANISM — a unit round-trip through two different paces, verified on a real session, not inferred.** `vo2maxCapKm = durationForMainSet(20) / pace.minPerKmInterval` converts the cap minutes→km at **I-pace**, and it binds correctly: a traced "Short VO2max" came out at **8 km**, right on the 8.2 km ceiling. But the session's `duration_mins` is **43**, an implied pace of **5.38 min/km**, while its own `pace_target` reads **4:30–5:00 /km** (midpoint 4.75). So km→minutes is priced SLOWER than minutes→km was, and `mainSetMinutes(43) = 23.7` against a declared cap of 20. **The cap is applied in one currency and spent in another.** The code comment asserts the session "is priced at I-pace" — measured, it is not.
  - ✅ **Hill reps are NOT part of this and were excluded** (2,592 sessions). `classifyStimulus` returns `vo2max` for them, but `ruleEngine`'s own comment records that effort-governed hills are priced at easy pace deliberately and are *"not the work this ceiling exists to bound"* (SC-09). **Counting them inflated the ordering breach from 19.4% to 86.1%** — recorded because the first cut of this measurement did exactly that.
  - **Delivered main set by stimulus, 36,072 quality sessions:** tempo mean 22.3 / p50 23.7 · vo2max mean 26.8 / p50 25.5 · race_pace mean 29.9 / p50 24.6 (max 62.4). **VO2max still runs LONGER than tempo at the median** — the exact inversion SC-10 describes (*"25 minutes of threshold is a normal session and 25 minutes of VO2max is a race"*).
  - ⚖️ **What the board must now rule on, with the premise CHANGED.** SC-10's recorded conclusion was that percentages cannot work and absolute minutes are the answer. **The absolute-minutes ceiling was then built and does not hold.** So the open question is no longer "percentage vs absolute" — it is *"why does the absolute ceiling leak, and is the fix to price the session at the pace its own cap assumed?"* The earlier rejection of category percentages (15% → 187 ordering breaches, 220 undersized; 17% broke ordering) **still stands and must not be re-attempted**.
  - ⚖️ **BOARD RULED 2026-09-14: CORRECT WITH AMENDMENT — the cap must be spent in the currency it was set in. BUILD THIS FIRST of the three.**
    - **The declared 20 STANDS; the delivered 25 is what is wrong.** The board considered the inverse (25 is right, 20 is stale) and rejected it: the constitution already ratifies the dose ordering — `VO2MAX_WORK_TARGET_MINS` **12–18 min** against `THRESHOLD_WORK_TARGET_MINS` **18–26**, with Seiler's reasoning stated inline (*"threshold pace is sustainable far longer per minute than VO2max"*). A 20-min **main set** is coherent with a 12–18 min **work** dose plus recoveries; a 25-min main set is not.
    - **This CONFIRMS SC-10's original finding and replaces its DIAGNOSIS.** The answer was never "percentages vs absolute minutes" — **the absolute ceiling was correct and was leaking.** Seiler: this is the CD-19 error in a different costume, a quantity defined in one basis and consumed in another.
    - 🛑 **WILLY'S BINDING CONDITION:** after the fix, measure delivered **WORK** minutes and prove they do not fall below `VO2MAX_WORK_MIN`. Shortening the main set must not quietly convert a VO2max session into an under-dosed one — *fixing a ceiling by breaching a floor is not a fix.*
    - **Artifacts:** principle amendment (*a session is priced at the pace its own cap assumed*) · **no new numeric** (`VO2MAX_MAIN_SET_MAX_MINS = 20` confirmed, not changed) · a DELIVERED invariant `mainSetMinutes(duration_mins) <= cap` for vo2max-stimulus sessions, **excluding hill reps in code with the SC-09 reason stated** (counting them inflated the ordering breach 19.4% → 86.1%).
  - 🛠️ **IMPLEMENTATION BRIEF:** the cap is `ruleEngine.ts:~2821` (`vo2maxCapKm`); the km is floored back up by `Math.max(roundDist(qualKmPrimary), minDist.quality)` at `~3076`, which is a SECOND leak to check. The delivered main set is read as `mainSetMinutes(session.duration_mins)` — `sessionFormat.sessionSplit` is the single owner and applies a 15-min warm-up floor, so the cap's inverse `durationForMainSet` already accounts for it; the discrepancy is purely the pace used to turn km into minutes. Re-run `scripts/measure-mainset-ordering.ts` (excludes hills, fails loudly if no plan carries both categories). Expect a declared cohort + parity move.
  - ⚠️ `mainSetSizing.test.ts` pins the CAUSE (`QUALITY_SESSION_PCT_OF_WEEKLY` still 18, a flat share) and fails if per-category sizing appears. **That pin is still correct and should stay.**


### Ops

- ✅ **TRIGGER-AUDIT-01 — COMPLETE 2026-09-13. All eleven adaptation triggers audited; one structural defect found and fixed.** Detector: `npx tsx scripts/trigger-audit.ts` (live-checks the directional function, so a regression prints STRUCTURAL DEFECT rather than a stale PASS).
  - 🔴 **The defect — `zone_drift`, the TRIGGER (not the R30 card fixed hours earlier).** It keyed on `zoneDisciplineScore < 50`, the km-weighted mean of `hr_in_zone_pct` — a **band**, where §12 prescribes a **cap**. **3 of 17** runs under that threshold were predominantly too EASY. Worse than R30 because it **changes the plan**, `requiresConfirmation: false` so it **auto-applies silently**, and it rewrote every easy/long coach note to *"Easy sessions trending hard"*.
  - 🔴 **A second defect found in the same function: it was DESTROYING prescriptions.** It assigned a fresh single-element `coach_notes` array, deleting §24e's ultra fuelling cue, §96's overdo cue and §80's time-on-feet note. A silent auto-applied adjustment was erasing coaching the board had ruled on. Now appends, de-dupes, respects the 3-note cap.
  - ⚠️ **It had NO test coverage.** Every existing case passed `hrInZoneData: []`, which nulls the score and skips the gate, so the suite was green while the trigger fired on the wrong quantity in production. Six cases added.
  - ✅ **The other ten:** `shadow_load`, `acute_chronic_high`, `fatigue_accumulation`, `readiness_signal`, `rpe_disconnect`, `skip_with_reason`, `session_reorder`, `manual` — **PASS** (directional by construction, or user-initiated with no signal to be wrong about). `ef_decline` — PASS structurally, with the caveat recorded that EF is confounded by heat and terrain and **we hold `elevation_gain` unread and no weather at all**. `long_run_shortfall` — **NEEDS DATA**: completion is a DISTANCE ratio and a beginner's long run is duration-anchored with `distance_km` null (the SESSION-KM class). Filed below.
  - **Artifacts:** §12 Amendment 1 extended · `zoneDriftScore` in `loadCalc.ts` (a SECOND function, deliberately — descriptive vs drift are different questions) · `planAdjustment.test.ts` +6 cases.

- ✅ **RACE-WEEK-FITNESS-01 — SHIPPED 2026-09-14 as §39 Amendment 1 + §80 Amendment 1. Found by EYEBALLING plans, not by validation.**
  - 🔴 **§39's "mid-week" easy run landed on RACE EVE in 81 of 81 measured plans (100%).** Mean 54 min; worst case a **BEGINNER finish-goal marathoner on 25 km/week given 9 km / 72 minutes the day before their first marathon.** The preference order began `'sat'`, and for a Sunday race — nearly every real race — Saturday is the day before the gun. Unlike §30's shakeouts it bypassed `enforceCap`, and `applyWeekdayMinsCap` misses it because Saturday is not a weekday.
  - ⚖️ **Defect against documented intent, ruled by the board because the fix changes race week.** §39's own title says *mid-week*, §77 calls it *"the §39 mid-week easy"*, and §26 forbids any fatigue-adding session in race week. The code comment at the site had explicitly parked the question (*"deliberately not relitigated here"*).
  - **Fix:** earliest available non-shakeout day, and **no session within `RACE_EVE_PROTECTED_DAYS` (1) of the race may exceed §30's 35-min cap**. A **ceiling, not a prohibition** — the first draft banned every race-eve session and the golden plans caught it: CD-7 deliberately places a legitimate 30-min shakeout there. Race-eve exposure **100% → 0%**.
  - 🔴 **The race-day note told a 5K runner to run their whole race in Zone 2.** *"First 5 km at Zone 2."* was hardcoded for every distance: 12% of a marathon (correct — and where the number came from), **50% of a 10K, 100% of a 5K**. Now `RACE_OPENING_FRACTION = 0.12` — not a new number, the existing one derived back (5 km IS 11.85% of a marathon), leaving the marathon unchanged at 5.1 km. **Effort follows the goal:** Zone 2 for finish, **goal pace** for time-target, because a sub-50 10K runner opening in Z2 has lost the race in the first kilometre.
  - ⚠️ **The suite caught two of my own errors** and both are recorded in the decision doc: the over-strict first invariant, and a day filter reading `> N - 1` — a no-op that left `sat` reachable whenever earlier days were blocked. **The measurement grid showed 0/81 and looked clean; the property sweep found it.**
  - **Declared parity move: 4,320 of 5,832 cases** — 5K 972/972 and 10K 972/972 (where the note was most wrong), HM 810/972, marathon 702/972. **`cohort:shape` unchanged** — no plan reclassified. verify exit 0, 1789 tests / 198 files.
  - Artifacts: §39 Amendment 1 · §80 Amendment 1 · `RACE_EVE_PROTECTED_DAYS`, `RACE_OPENING_FRACTION` · `INV-PLAN-NO-RACE-EVE-SESSION` + `INV-PLAN-RACE-NOTE-SCALES` + rows + liveness mutation · `scripts/measure-race-eve-session.ts` · `docs/decisions/coaching-board-2026-09-14-race-week.md`.

- ✅ **REVIEW-HARNESS-MONDAY-01 — coaching-review cases FIXED 2026-09-14; the cohort grid is deliberately NOT.**
  - 🔴 **Every harness in the repo generates MONDAY races.** `CHARITY_PLAN_START` / `COHORT_PLAN_START` are Mondays and every grid derives race dates as `planStart + N × 7`, so race day is always Monday — where race week has **no in-week day before the race at all**. The cohort grid, the liveness corpus and all 17 review cases shared it.
  - **That is why RACE-WEEK-FITNESS-01 survived:** no harness could build the shape in which the defect appears, so every check was green on a configuration almost no real runner has.
  - **Fixed for the review round — a SAT/SUN split, not just Sunday.** ~95% of real races are weekend, and **Saturday and Sunday are not interchangeable**: the race weekday interacts with `preferred_long_run_day`, so a Saturday race with a Sunday long-run day pushes that long run AFTER the race (§77 must drop it) while a Sunday race puts the race ON the long-run day. The round is now **6 Saturday / 10 Sunday / 1 Monday**: canonical cases 02/04/05 Saturday, 01/03/06 Sunday, personas carry an explicit `raceDay`, and new case **`07-hm-monday-race`** keeps the early-week edge visible until PV2-G is built. Collapsing onto one weekday — or moving everything to Sunday without case 07 — would have turned a known open defect green. **Re-eyeballed after the split: every weekend case now has a 2–5 day gap with a capped shakeout; case 07 still correctly shows the 11.5 km long run on race eve.**
  - Two charity personas (H3, T2) were bumped a week: a Sunday race is 6 days short of a whole week, so a persona designed to sit exactly ON the prep-time minimum fell under it. Bumped to keep the scenario they were written to test rather than silently converting them into refusal cases.
  - ⚠️ **The cohort grid is NOT changed here.** Re-baselining `verify:parity` and `cohort:shape` onto weekend races is its own declared move and deserves its own commit, not a side effect of this one.

- ✅ **LR-SHORTFALL-DURATION-01 — SHIPPED 2026-09-14 as §66 Amendment 1. The premise was wrong and the finding was bigger.**
  - ⚠️ **Filed as a SESSION-KM silent-pass defect. It was not one.** The board's conflict scan found §66 bullet 3 states the exclusion explicitly: *"duration-primary long runs are out of scope (no distance to fall short of)"*. **Ratified doctrine, and the code was faithful to it.** The real question was whether that scope decision was still correct — and §80, written later, answers it: for a duration-anchored runner the prescription **is** their time on feet, so there IS something to fall short of.
  - 🔴 **What the exclusion cost, on the 621-plan cohort grid:** 2,547 of 7,965 long runs (**32.0%**) dropped before the trigger saw them; **completely dead on 153 of 621 plans (24.6%)**; 54 more (8.7%) partially blind, which is worse in kind — a dropped middle long run lets the "consecutive weeks" window compare non-adjacent ones. **A second gate** (`if (isLongRun(s) && s.distance_km)`) meant even a firing trigger would have shown a confirmation tile promising a trim that did nothing.
  - 🔴 **Upstream root cause, and it was user-facing.** The same expression writes `planned_load_km` in both analyse-run paths, so it was null on every duration-anchored analysis — and the post-run card renders **"No distance data."** whenever planned is null. A beginner met that line after every run, forever, with the run's distance plainly in front of them.
  - ⚖️ **The obvious fix was REJECTED and that is the ruling.** `sessionKmSelfPaced` recovers a km figure for **100%** of the dropped sessions. It must not be used: §80 expects walk breaks on this cohort and holds that time on feet accumulates whether or not every step is running, so a first-timer completing the full 90 minutes **with the walk breaks the plan told them to take** would be reported short against a number that never appeared in their plan. **A recovered number is not automatically the right number.**
  - **Shipped:** shortfall measured on the anchoring axis (distance wins where the session carried one); trim in minutes for duration-anchored, never a new `distance_km`; moving time not elapsed (Willy — *walking registers as movement*, so walk breaks do not under-count); **82% across both axes, no new numeric** (McMillan's parity-by-default, recorded as a choice not a finding); post-run card follows the same axis.
  - **Reach 68.0% → 100.0%; plans with a dead trigger 24.6% → 0.0%.** `verify` exit 0 (1789 tests / 198 files), **`verify:parity` IDENTICAL across 5,832 cases** — generation unaffected. Falsification: disabling the time axis turns 3 of 9 new tests red.
  - **Scale, honestly:** 137 production analyses, 2 users, near-zero live impact — but dead for beginners and first-timers, which is exactly what the Make-A-Wish channel delivers. **Fix-before-acquisition, not a live incident.**
  - Artifacts: §66 Amendment 1 · migration `20260914_run_analysis_load_mins.sql` (applied + ledgered) · `INV-PLAN-LONG-RUN-HAS-AN-AXIS` + `plan-invariants.md` row + `strip both anchors` liveness mutation · `planAdjustment.test.ts` 23 cases (14 pre-existing as distance-axis regression) · `scripts/measure-lr-shortfall-reach.ts` · `docs/decisions/coaching-board-2026-09-14-lr-shortfall-axis.md` · round `coaching-review/2026-09-14/`.

- ✅ **ADAPT-VISIBLE-01 — CLOSED 2026-09-13, PREMISE LARGELY VOID. Nothing built.**
  - **Filed on Fried's line** that "the runner cannot TELL" the plan adapted, because ADR-012 auto-applies low-magnitude adjustments silently, and Wood's that the causal link should be surfaced.
  - 🔴 **MEASURED: adaptations are visible in TWO places, and the summaries are already causal.** (1) The **notification inbox** — NOTIF-01 moved auto-applied adjustments there from the MeScreen log. (2) **MeScreen's "what changed this week"** audit surface (`recentChanges`, 14-day window, §69 honest absorption).
  - 🔴 **And every summary already states cause → effect**, which is precisely what Wood asked for: *"3 consecutive heavy sessions. Quality swapped to easy; long run trimmed 20%."* · *"Load ratio 1.4x. Trimmed easy/long sessions ~15% to protect recovery."* · *"Long runs averaging 74% completion over 2 weeks. Prescription pulled back to match where you're actually finishing."* The format is already [what we observed]. [what we changed].
  - **What ADR-012 actually makes silent** is the *moment of application*, not the *fact* — the runner is not interrupted, but the record is there and it explains itself. That is a defensible design, not a gap.
  - ⚠️ **Fourth premise of the day not to survive measurement.** Recorded because the pattern is the lesson: a board's verdict is its authority, its stated mechanism is a hypothesis. See `feedback-measure-the-premise-not-just-the-ruling`.
  - 🔲 **The one residual, and it is genuinely small:** the causal link is not shown AT the changed session. A runner reading Thursday's card does not see "eased because Tuesday ran hot" — they see it in the inbox or on Me. Whether that is worth moving is a design question with no correctness component, and it is **not** the "invisible by construction" problem this item was filed as. Re-file deliberately if it ever matters; do not resurrect this entry.
- ✅ **HR-LATE-RESCORE-01 — SHIPPED 2026-09-13. Late HR now re-scores the run; only the narrative is withheld.**
  - **The real path:** Garmin → Apple Health, and Garmin → Strava → Apple Health. HR can be **days** behind the workout shell, so this is the founder's everyday case, not an edge one.
  - 🔴 **The gate's stated intent was not being achieved.** `lateArrivalGate.ts` promises that outside the window it patches HR "for archival use (zone ledger, weekly report, fitness signals)". It patched `strava_activities` — and **every one of those consumers reads `run_analysis`**, which kept null HR forever. Measured: **1 of 12** no-HR analyses stranded, HR sitting in the activity row beside it. §108 Amendment 1 then made it visible rather than causing it: the score is withheld when HR is unmeasured, so that run showed nothing despite having data.
  - **The split that resolves it:** Hutchinson's rule is that two-day-stale **coaching** is dishonest. A score is deterministic arithmetic over stored columns and does not go stale. `scores_only` recomputes the numbers and **skips the AI call**. Defect fix restoring documented intent (the gate's own comment IS the intent) → ADR-017-exempt.
  - ⚠️ **The subtle part, and the property tested first:** the upsert must **OMIT** `feedback_text`, not send null. On an upsert, present-and-null **DELETES** the runner's existing coach note — the exact opposite of what the gate protects. Same omission applied to the response body, which would otherwise have told the caller the note was cleared.
  - **Guarded against the REAL source, not a mirror.** The first cut tested a local copy of the row-builder, which proves the copy. `lateRescore.test.ts` now reads `analyse-run/route.ts` and `health/ingest/route.ts` and fails if the flat `feedback_text: feedbackText` assignment returns or the stale branch is re-gated. **That source test immediately found a second flat assignment in the response body.**
  - Both ingest paths wired (same-uuid re-sync and cross-source consolidate). 11 cases.
- ✅ **R30-DIRECTIONAL-01 — SHIPPED 2026-09-13. The zone-drift detector no longer counts too-EASY runs as drift.**
  - **The defect:** R30 (PAID, 2026-05-04) fired on `hr_in_zone_pct < 60`, a **band**. §12 prescribes a **cap** — *"Easy runs are capped at the top of Z2"* — so running BELOW Z2 breaks no principle. Measured: **6 of 22 flagged runs (27%) were predominantly too EASY**, worst at 17% in zone with 83% below the floor and **0% above the ceiling**. Board ruled the shipped detector **INCORRECT**, unanimously.
  - **The fix:** reads `hr_above_ceiling_pct > ZONE_DRIFT_ABOVE_CEILING_PCT` (20). **Re-derived, not carried across** — the two are different scales. Production separated with **no overlap** (too-easy `0,0,1,2,3,19`% vs too-hard `23,40,47…94`%); 20 sits inside that gap, so it is robust at either edge.
  - **It removed false positives AND false negatives.** Same flag COUNT (22 of 42), entirely different membership: 6 too-easy runs out, 6 genuine drift runs in that the old rule missed (≥60% in zone with >20% above the cap).
  - **Artifacts:** §12 Amendment 1 · `ZONE_DRIFT_ABOVE_CEILING_PCT` · `zoneDrift.test.ts` (fixtures are the REAL production values, asserting both directions).
  - ⚠️ **n = 42.** Thin. The direction is unambiguous; re-measure the cut as the cohort grows. The `≥4 of the last 8` window was NOT re-derived — the board questioned the threshold, not the window.
- ✅ **POST-RUN-CONTEXT-01 — SHIPPED 2026-09-13. The post-run read now carries block-level meaning.**
  - **The differentiator, confirmed by research:** none of Runna, Trenara, Garmin, Coopah, Planzy or Runzy joins the individual run to the block. Garmin's Training Effect is **unsigned** and cannot say an easy run was too hard; our directional columns can. `docs/investigations/post-run-competitive-2026-09-13.md`.
  - **What a runner sees:** *"That's 3 of your last 5 easy runs above the ceiling."* One line, under the zone signal.
  - ⚖️ **Every board binding is a unit test, not a doc note** (`driftContext.test.ts`, 14 cases): **count never conclude** (no causal claim, and the hedged form was vetoed too), **easy runs only against their own ceiling** (NOT a §1 read — §1 counts sessions plan-wide and a 4-day week with one quality session is 25% against marathon's 18%, so a week-level §1 line would flag every normal build week), **directional**, **silence by default** (a single drifted run is not a pattern), and **never twice in a row** (Wood, binding).
  - 💡 **"Never twice in a row" needs no stored state.** Whether the line showed on the previous run is derivable by the same rule, so `driftContextFor` walks the sequence: `show[i] = drifted[i] && patternExists && !show[i-1]`. Deterministic from the rows alone, and it cannot drift out of sync with what was actually displayed.
  - **Selection and decision are separate on purpose:** `buildDriftContext` gathers the easy/recovery analyses (off `plan_json` types, never labels — D-17), `driftContextFor` decides. A change to the gathering cannot quietly reinterpret a ruling.
  - **Reuses `ZONE_DRIFT_ABOVE_CEILING_PCT`**, so the post-run line, the Coach card (R30) and the adaptation trigger can never disagree about what drift is.
  - 👀 **Verified by looking:** `/post-run-preview` gained both states (line shown, line silent) and was checked in the browser. A grammar slip ("above its zone ceiling" on a plural subject) was caught there, not by the compiler.
- 🔲 **POSTRUN-PLAN-FEEDBACK-01 — SLT REVIEWED 2026-09-13: "don't build; decide, then audit, then say it". PARKED at founder's request.**
  - ✅ **The answer to the fork: we are already on Trenara's side, with ELEVEN live triggers.** `acute_chronic_high`, `zone_drift`, `shadow_load`, `ef_decline`, `fatigue_accumulation`, `skip_with_reason`, `session_reorder`, `readiness_signal`, `manual`, `fitness_signal`, `long_run_shortfall` — governed by ADR-012 (magnitude-calibrated: low auto-applies **silently**, high surfaces a confirmation tile). **Nothing to build.** It was decided incident-by-incident and never stated as a position.
  - 🧠 **Sutherland:** this is a category difference, not a feature difference. Runna's insight is a comment on the past — read it, feel something, nothing changes. Ours **rewrites Thursday**. *"The plan changes because you did."*
  - 📦 **Fried:** the gap is not the feature, it is that the runner cannot TELL. ADR-012 auto-applies low-magnitude changes silently by design, so the best thing about the product is invisible by construction. A communication gap is far cheaper than a feature gap.
  - 🏃 **Hutchinson — BLOCKING on any marketing:** Runna's decoupling is defensible, not lazy. An insight that does not touch the plan can be wrong at no cost; one that reshapes Thursday cannot. **Every trigger we adapt on is a claim that the signal is real — and R30, one of the eleven, was firing on 27% false positives the same day.** The other ten need the R30 audit before this becomes a positioning line.
  - 🔬 **Wood:** silent auto-apply gets the behaviour change **without the learning** — the runner never connects Tuesday's drift to Thursday's easier session, so they never become self-correcting. Surface the **causal link**, keep the change silent: *"Thursday is easier because Tuesday ran hot."* Not a contradiction with ADR-012, which chose silence for the ADJUSTMENT, not the reason.
  - 💰 **Traynor:** this is the answer to "why pay for this" and it is on neither the pricing page, the App Store listing, nor the marketing site. We compete with Runna on **plan quality** — a features arms race we lose on resources — when we could compete on **adaptivity**, which they have explicitly ruled out in their own docs. Durable position, not a feature.
  - ⚡ **Recorded conflict:** Traynor wants to market it now; Hutchinson says audit first. **Hutchinson holds** — marketing a wrong adaptation is worse than not marketing a right one.
  - **Sequence when unparked:** (1) ratify the position in `brand.md`; (2) **audit all eleven triggers for false-positive rate, the way R30 was audited — blocking**; (3) surface the causal link (Wood); (4) only then GTM.
  - 🚨 **Never:** "the plan changes because you did" must not become a nudge to train MORE. It is a restraint mechanism.
- ✅ **ZONE-BAND-VOCAB-01 — CLOSED 2026-09-13, PREMISE VOID. No board sitting needed.**
  - **Filed on the belief** that a runner meets two vocabularies for one number: `scoreBandLabel` (80/60/40 → On target · Close · Slightly off · Off target) on the post-run card, and `ZONE_DISCIPLINE_BANDS` (85/70/50 → disciplined · decent · loose · freelancing) on Coach.
  - 🔴 **MEASURED: `classifyZoneDiscipline` has NO call sites.** That vocabulary is exported and never rendered — the Coach screen shows `zoneDisciplinePercent` as a bare NUMBER. **The runner never meets the second vocabulary**, so there is no conflict to unify and no thresholds for the board to choose between.
  - ⚠️ **Third instance today of the §93 class** — config declared, ratified, and read by nothing (`intensity_zones` and `fuel_every_mins` were the first two, both now live). `configPrincipleSync` proves a PRINCIPLE exists for a numeric; **it has never proved a CONSUMER does.** That gap is the real finding here.
  - **Done:** the deadness is recorded in `loadCalc.ts` beside the type so nobody assumes it ships, and the dead `ZONE_DISCIPLINE_BANDS` import left in `planAdjustment.ts` by the TRIGGER-AUDIT-01 fix is removed. `ZONE_DISCIPLINE_BANDS` itself is left in place — deleting a ratified coaching numeric is the board's call, not a cleanup.
  - ✅ **Worth its own item:** a mechanical check that a declared coaching numeric has a CONSUMER, not just a principle. CONFIG-CONSUMER-01 — SHIPPED 2026-09-14.

- ✅ **CONFIG-CONSUMER-01 — SHIPPED 2026-09-14. The consumer check now covers every config surface, and it found three live defects on the way in.**
  - **What existed already:** `configConsumer.test.ts` covered `GENERATION_CONFIG` and `PLAN_SIGNATURES`. **It did not cover the surfaces the 2026-09-13 orphans actually lived on** — `intensity_zones` and `fuel_every_mins` are session-catalogue ROW fields and `ZONE_DISCIPLINE_BANDS` is in `lib/coaching/constants.ts`. A check that proves a principle for half the surfaces is a check that tells you the other half is fine.
  - **Now covered:** `SESSION_FORMAT` (§16), session-catalogue **row fields** (ADR-010), and `lib/coaching/constants.ts`. Each gets the same three-state sort §17 already mandates — authority / declarative / superseded / registered debt — and each register only shrinks.
  - 🔴 **Three real defects found, all fixed in the same ship:**
    - **`HR_ZONE_TOLERANCE_BPM` was declared 3 and read by nothing, while `zoneRules.hitSessionZone` hardcoded `const tolerance = 2` for the same job.** The Configuration Singularity breached in both directions at once, with the NAMED number being the dead one. Wired at **2** — the value that has always shipped, because the defect is the hardcode plus the orphan, not the value; changing the tolerance would move `hr_in_zone_pct`, which feeds session scoring, the zone-drift trigger and the post-run card, and that would need the board.
    - **`SESSION_FORMAT.LONG_RUN_PEAK.race_pace_distances` was declared `['HM','MARATHON']` and read by nothing** → RACE-PACE-OVERLAY-REACH-01, below.
    - **The `SIG_SUPERSEDED` register cited the wrong principle.** `peak_includes_race_pace` was moved out of the debt register on 2026-09-10 as "delivered by §24d" — but §24d governs the FINISH-GOAL 5K/10K negative-split finish and says nothing about HM. The field was declared satisfied by a principle that does not cover it, while HM was in fact delivering nothing. Corrected to §16. **A register is only as good as its citations.**
  - ⚠️ **The checker itself shipped a bug worth recording.** The scan excludes the declaring FILE wholesale, which is right for `generationConfig.ts` (nothing but the declaration) and **wrong** for `sessionFormat.ts`, whose `sessionSplit`/`mainSetMinutes` helpers ARE the product consumer — it reported `quality_warmup_min_mins` dead while every quality session in the app reads it. Narrowed to strip the declaration LITERAL and keep the module. Then the narrowed version silently made the whole catalogue scan **vacuous**: `withoutDeclaration` returns the text unchanged when its regex misses, and `difficulty_tier` looked wired because the `SessionCatalogueRow` INTERFACE declares it forty lines above the array. A type declaration is not a consumer. **Both fixes carry their own test** — a fix to a checker needs a check.
  - **Registered, not hidden:** `main_pct` (declarative — the main set is a residual, not a fraction); `first_third`/`middle_third`/`final_third` (real debt — §16 declares a three-stage warm-up progression that `sessionComposer` writes out in its own vocabulary); `typical_duration_min`/`max` (real debt — a row can ship outside its own declared band with nothing to say so); `difficulty_tier` (declarative **by ratification** — §98: *"Tier is a description, not a lever"*, and a tier-selection bias is one of four levers already built, measured and failed).
  - **Known residual, stated:** the scan is substring-based and biased toward passing. A key read only by a DEAD function in the same module counts as consumed — which is exactly `ZONE_DISCIPLINE_BANDS`, read by `classifyZoneDiscipline`, which has no call sites. Closing that needs call-graph reachability, not grep.
  - Artifacts: `configConsumer.test.ts` (+9 cases, 16 total) · `HR_ZONE_TOLERANCE_BPM` wired · feature-registry row. **verify exit 0, 1777 tests / 198 files; `verify:parity` IDENTICAL across 5,832 cases.**

- ✅ **RACE-PACE-OVERLAY-REACH-01 — SHIPPED 2026-09-14 as §16 Amendment 1. Half a ratified principle was unreachable, and the card looked fine.**
  - 🔴 **§16 has always said the peak race-pace long run applies to "HM and MARATHON". The gate was `label.includes('marathon-pace')`.** The HM row is named *"Long run with HM-pace finish"*. **Measured on the real display path: HM rendered the overlay on 0 of 18 peak race-specific long runs; MARATHON on 12 of 12.** The session whose entire stated purpose is *"race pace on legs that are already tired"* showed the HM runner a plain easy run — so they either lost the session or invented their own finish. The D-17 label-classification class ADR-018 exists to remove.
  - **Two more unread facts on the same line:** the rows declared their own split (65/35 and 60/40) against §16's 20%, and `race_pace_zone` ('HM'/'MP') was declared per row while the card hardcoded *"MP target"* for every case.
  - ⚖️ **Coaching Board 2026-09-14 — CORRECT WITH AMENDMENT.** Gate on the row's declared `main_set_structure.type === 'long_run_with_segment'` (ADR-018, not the label). ⚠️ **The percentage half of this ruling was OVERTURNED the same day — see §25 Amendment 1 below.** ~~**§16's 20% governs** — Willy rejected the rows' 40% outright: on the measured mean peak long run that is **50–63 min at marathon pace** (76 on the longest), a marathon-pace tempo bolted onto a three-hour run in the plan's heaviest week, for runners whose floor on that row is merely `intermediate`. `easy_pct`/`race_pace_pct` **deleted** from both rows rather than left as a second contradicting declaration (§17). `race_pace_zone` becomes authority — the card quotes it, because telling a half-marathon runner to hit "MP target" hands them the wrong number on the one session where the number is the whole point (Sims, binding). The pace quoted is the session's own `lr_segment_pace` (§107), which five invariants govern and **nothing rendered** until now.~~ **(struck: §25 ratifies the final 25–40%, so the rows' 35/40 were correct and were restored.)**
  - ✅ **The three negative guards were measured, not reasoned:** §47 step-back long runs 30 → 0 overlays; §24b's 5K/10K three-part segmented long run 396 → 0; §24e ultra 342 → 0. After the fix: **HM 18/18, MARATHON 12/12.**
  - **Deliberately NOT changed:** §16's "20% of session time" vs the code's 20% of the main set. The card renders a bare `20%` with no referent, so the difference is invisible to the runner; changing it would move the marathon block 25 → 32 min for no visible gain. Recorded so it is not re-found as a defect.
  - Artifacts: §16 Amendment 1 · no new numeric (two competing row values deleted) · `racePaceOverlay.test.ts` (11 cases) · `session-catalogue.md` note · `scripts/measure-race-pace-overlay-reach.ts` · `docs/decisions/coaching-board-2026-09-14-race-pace-overlay-reach.md`. **No `validatePlan()` invariant, deliberately** — this is a display-boundary rule over a session the validator has already passed; `INV-PLAN-LR-SEGMENT-RECORDED` guards the generation side.

- ✅ **MAINT-LABEL-UTILITY-01 — CLOSED 2026-09-13. The runner-facing half is void; the real exposure is filed below.**
  - 🔴 **MEASURED: `volume_profile` is NEVER RENDERED.** No component reads it or `volume_constraint_note` directly. What the runner actually sees is `planRationaleNotes(plan.meta)` — a labelled note carrying the **specific, varying, actionable** sentence (*"Peak long run 24.0 km is below the 31.7 km floor … If you want it to build instead: run 5 days a week instead of 4"*). So "a flag that never varies stops being read" does not describe anything the runner meets. **Fifth premise of the day not to survive measurement.**
  - 🔴 **But checking it surfaced something worse** → filed as MAINT-EXEMPT-SCOPE-01.

- ✅ **MAINT-EXEMPT-SCOPE-01 — SHIPPED 2026-09-13 as §52 Amendment 1. A safety cap is never exempted, only downgraded.**
  - 🔴 **The defect:** `INV-PLAN-LR-MAX-WEEKLY-PCT` opened `if (volume_profile !== 'maintenance')`, justified as *"already surfaced in volume_constraint_note"*. **That note explains low TOTAL volume and says nothing about lopsidedness.** A safety check was switched off because something else was believed to report it, and it does not.
  - 📐 **Measured with the exemption removed: 268 of 6,588 weeks breach — EVERY ONE in a maintenance plan, NONE in a build plan.** 60 of 314 maintenance plans carry at least one. Worst: a **beginner marathon plan with a 26.0 km long run in a 34 km week (76%)**. 51% of the cohort classifies maintenance, so the cap was unchecked on half of all plans.
  - **Fix:** `warn` for maintenance, `error` for build. Not a hard error, because 60 plans would stop generating and the runner's volume constraint is real — §34's honest-residual pattern, as `INV-PLAN-DELIVERED-RAMP` and `INV-PLAN-DELOAD-IS-A-REDUCTION` already use. **Declared rate: 8.6% (1368/15973)**, where it previously reported nothing because it never ran.
  - ⚖️ **The other four maintenance exemptions were examined and LEFT ALONE, deliberately.** §24/§23/§46's checks are **circular** exemptions — a plan classified maintenance *because* it failed those floors would re-assert the same failure as an error, and the note already records it. **The test is whether an exemption is CIRCULAR (fine) or merely CONVENIENT (not).** §52's was convenient.
  - Artifacts: §52 Amendment 1 · no new numeric · `plan-invariants.md` row · `lopsidedWeek.test.ts` (6 cases, including the founder's 26-of-34 case and the boundary).
- ✅ **LR-RACE-SEGMENT-PCT-01 — SHIPPED 2026-09-14 as §25 Amendment 1. One segment, three numbers, two of them on the same card.**
  - 🔴 **Found by running the Coaching Board PROPERLY** after the founder asked whether a review had been run. The RACE-PACE-OVERLAY-REACH-01 sitting hours earlier was conducted **inline, skipping the mandatory conflict scan** — and that scan surfaced **§25**, which ratifies *"the final 25–40% of the long run"* for this exact session, one section away from the one I read.
  - 🔴 **What was live, measured on a 165-min marathon peak long run:** the catalogue row said `race_pace_pct: 40` (66 min); the hand-typed coach note said *"Final 30–50% at MP"* (50–83 min, **breaching §25's own 40% ceiling**); `composeSession` said *"20%"* of the MAIN set (27 min, **16% of the run**, below §25's floor). **Two of them rendered on the same card** — and on HM the contradiction (*"Final third"* vs *"20%"*) was **NEW, introduced by that morning's fix**, because before it the HM card carried no race-pace row at all.
  - ⚠️ **The morning's ruling had DELETED `race_pace_pct` from both rows** as "a second, contradicting declaration read by nothing". The reasoning was attached — in §25. **An unread number is not automatically a wrong one:** "read by nothing" is evidence a CONSUMER is missing, not that the VALUE is junk. Restored.
  - **Fix:** `race_pace_pct` is the single owner (HM 35, MARATHON 40, both inside §25's band), read by the note AND the card; the percentage is **of the long run** as §25's words say, so the structure block's parts now sum to the session; the two hand-typed note strings are gone (a coaching number inside prose is a number no check can see, which is how "30–50%" outlived the ceiling).
  - ⚖️ **Willy did not veto but put a guard on record:** the dose is a percentage so it scales with the longest sessions (76 min at MP on a 191-min long run), and he would prefer an absolute minutes ceiling. Declined here as **new doctrine**, not a reading of §25; §24's `LONG_RUN_CAP_MINUTES` bounds the session it is taken from. Sims flagged (non-blocking) that §24e's fuelling cue should eventually reach this session too.
  - **Declared parity move:** `verify:parity` **540 of 5,832 cases changed** — HM 324/972 and MARATHON 216/972, `time_target` 540 / `finish` 0; **5K, 10K, 50K, 100K all 0**. Golden snapshots confirm the per-plan delta is the two note strings and nothing else. `cohort:shape` unchanged.
  - Artifacts: §25 Amendment 1 + §16 correction · `LR_RACE_SEGMENT_PCT_MIN`/`MAX` · `INV-PLAN-LR-RACE-SEGMENT-PCT` + `plan-invariants.md` row + a liveness mutation proving it wakeable · `racePaceOverlay.test.ts` (14 cases) · `docs/decisions/coaching-board-2026-09-14-race-pace-segment-pct.md`. **verify exit 0, 1780 tests / 198 files.**

- ✅ **STRAVA-WEBHOOK-OBS-01 — SHIPPED 2026-09-13. Observability complete; ONE founder action remains, and it is outside the repo.** The no-app auto-link depends on a Strava push subscription whose `callback_url` lives at Strava — nothing here can fail, no deploy can break it, no test can see it (the "Untooled external subscription" class). **Now:** `strava_webhook_received` is recorded on every webhook hit (the heartbeat, above the `object_type` filter so an athlete event proves delivery too, inside `waitUntil` so telemetry can never blow Strava's 2s timeout); `POST /api/ops/strava-webhook-health` runs daily (`ops-cron-strava-webhook-health.yml`, 08:10 UTC) and makes **two independent checks** — the subscription observed DIRECTLY against Strava's API (unconditional, so it is true whether or not anyone ran) and prolonged silence (gated on connected athletes, 72h, because zero webhooks with zero connected athletes is the correct state and a probe that cries wolf gets muted). Decision logic is the pure, tested `lib/ops/stravaWebhookHealth.ts` (14 cases). Reused: `recordOpsEvent`, `secretMatches`, the reshape/onboarding-integrity route shape, the ops-cron workflow shape — no new primitives, no migration (`ops_events.kind` is plain TEXT).
  - 🔴 **ROOT CAUSE FOUND while building it — the Strava APPLICATION is Inactive.** Run with production credentials, Strava returns `403 { resource: 'Application', field: 'Status', code: 'Inactive' }`. Not a missing subscription: in that state **none can exist or deliver**, which is exactly the reported *"runs only link when I open the app"*. ⚠️ The local `.env.local` `STRAVA_CLIENT_SECRET` is **corrupted** (43 chars, non-ASCII final byte) and returns 401 instead — do not diagnose this locally. Record: `docs/incidents/2026-09-13-strava-webhook-no-app-link.md`.
  - 👤 **FOUNDER ACTION (cannot be done from the repo):** reactivate the application in the Strava developer settings — likely tied to the pending API approval. Until then `register` will keep failing and the killed-app auto-link stays dead. The probe now records this state daily with the remedy attached, so it can no longer be silent.
  - 💡 **Found by the first version of the probe being wrong.** It returned HTTP 502 on any non-OK Strava response — it would have failed the cron loudly and recorded **nothing about why**. `judgeApiFailure()` classifies 401/403 as `app_inactive` instead, because an authorization failure is the one state a deploy can neither cause nor fix.
- ✅ **ONBOARD-OBS-01 — client-side onboarding-finalise telemetry. SHIPPED 2026-09-13.** The finalise (`has_onboarded` flip + HR persist in `handlePlanSaved`) is a live browser write, so it could only `console.error` on failure — the blind spot behind Problem A. Now: **(Simple)** `POST /api/ops/onboarding-event` — bearer-authed via `getUserFromRequest` (user id from the verified token, never the body), records `onboarding_finalise_failed` via `recordOpsEvent`; the client fires it from the existing `onboardErr` branch (`authedFetch`, fire-and-forget, never breaks the finalise). Covers the flip AND the HR persist (they share one `onboardPatch`, so one failure signal covers both; `had_rhr`/`had_mhr` recorded). **(Complete)** `POST /api/ops/onboarding-integrity` — daily probe (`ops-cron-onboarding-integrity.yml`, 08:05 UTC) that OBSERVES the broken state — a `plans` row with `has_onboarded=false` — independent of where the write failed, dedup-windowed, recording `onboarding_incomplete`. Decision logic is the pure, tested `lib/ops/onboardingIntegrity.ts` (`incompleteOnboardingUserIds`, 7 cases). Reused: `recordOpsEvent`, `getUserFromRequest`, `authedFetch`, the reshape-integrity route shape, the ops-cron workflow shape — no new primitives, no migration (ops_events + kind enum only). `verify` green (1653 tests), typecheck + hooks clean. → feature-registry.

---

## Tech Debt

- ✅ **PLAN-AUDIT-01 + REAL-CORPUS-01 — shipped 2026-09-03.** Two of the five test-coverage proposals. Daily probe (`/api/ops/plan-audit`, 07:45 UTC) validates every stored plan and alerts on a *change* in violation set; real-input corpus (`lib/plan/__fixtures__/real-inputs.json`) replays every plan a real runner has generated. Both would have caught the 2026-09-03 defects independently. **All five proposals have now shipped:** #3 validate-at-the-exit-boundary via ADR-020 Option A (2026-09-03), #4 fail-the-build-when-a-field-is-never-varied via `lib/plan/sweepInputCoverage.ts` (2026-09-04), #5 invariant liveness via `npm run invariant:liveness` (2026-09-11). **A SIXTH is open and unaddressed:** #5 proves an *invariant* can be made to fire; nothing proves a *fix's own test* can fail. A phase-2 falsification once stayed green because the assertion (`duration > 45`) did not discriminate — the profile's old value was already 48. Falsifying an engine fix needs a test tight enough to reach the change, and no gate enforces that.

- ✅ **SWEEP-VISIBLE-01 — closed 2026-09-03.** `INV-PLAN-MAX-WEEKDAY-MINS` 238 → **0**, `INV-PLAN-RACE-SPECIFIC-EXPOSURE-RATIO` 155 → **0** (`0c2081c`), `INV-PLAN-MIN-SESSION-SIZE` 2,061 → 924 → **0** (Coaching Board §82, unanimous). The 924 remainder was misdiagnosed in the prior entry as "low-volume main weeks, unrelated to the weekday cap" — that was wrong (same error class as SC-05 earlier the same day: confirm the satisfying case, never infer from the failure). Every sampled violation read "got 3.5, expected 4" at `max_weekday_mins:30`: `applyWeekdayMinsCap` scaling an easy run below `MIN_SESSION_DISTANCE_KM.easy` with no floor check. Fixed by floor-protecting the session (hold at the floor, duration follows and exceeds the cap by minutes) and declaring maintenance when it recurs across 2+ weeks (`INV-PLAN-EASY-FLOOR-PROTECTION-DECLARED`). **Verify still closed:** `npm run verify:sweep` — 0 violations, baseline lowered to 0.

- ✅ **ADR-020 Option A — closed 2026-09-03.** Foundation-block construction moved server-side. `lib/plan/foundationCompose.ts → composePlanWithFoundation()` is the single owner of `plan.weeks` mutation post-generation, called from `/api/generate-plan` (the `'auto'` gap band, immediate) and the new `POST /api/generate-plan/foundation` (the deferred `'choice'`-band decision — composes onto the existing plan without re-running the rule engine or AI enrichment). `validatePlan()` now sees foundation weeks in the live path; the sweep and matrix call the same composer instead of hand-splicing. `WeekSchema.n` relaxed to allow `n ≤ 0` (CB-2 item 4). D-08 duplicate-ownership violation closed. Design validation caught two real bugs before they shipped: an enrichment-boundary revert branch that would have silently dropped a foundation block, and a client/server timing race on the deferred-decision path (kept the client-side `final_plan` re-attach for exactly that reason — see ADR-020's "Option A shipped" section). **Verify still closed:** `grep -n "generateFoundationBlock" app/dashboard/GeneratePlanScreen.tsx` returns nothing.



### Rebrand follow-ups (Vetra → Zonna, May 2026)

The Vetra → Zonna rename (commits `fda3ff6` + `ba469df`) is complete in code, native shell, icons, OG image, and current-truth docs. The items below are non-blocking hygiene and decisions that can land any time post-launch.

- 🔲 **[W6]** **BRAND-02 — Vercel project rename** *(P3, ~2 min)* — *(corrected 2026-06-22: the live project is already `zona`; `rts-training-hub` is legacy.)* Rename `zona` → `zonna` via Vercel dashboard if desired. Affects preview URLs only — code-side: nothing. **External — dashboard action.**
  - **Verify still open:** **External — Vercel dashboard.** No code impact: every `NEXT_PUBLIC_APP_URL` fallback already points at zonna.run (verified 2026-08-15).
- 🔲 **[W6]** **BRAND-03 — Supabase project rename (cosmetic)** *(P3, ~1 min, optional)* — Supabase project display name can be renamed but the ID `wkppmpsvqkaxbekdgzdm` is permanent. Purely cosmetic.
  - **Verify still open:** **External — Supabase dashboard.** Cosmetic only; project ID is permanent.
- 🔲 **[W6]** **BRAND-05 — Remove old `app.vetra.ios` allowlist entries** *(P2, ~5 min)* — once the new bundle ID is verified in TestFlight, remove the lingering `app.vetra.ios` entries from Apple Developer portal, Supabase Auth Redirect URLs, Supabase Apple provider Authorized Client IDs, Google OAuth iOS bundle IDs.
  - **Verify still open:** **External — four consoles** (Apple Developer, Supabase Auth Redirect URLs, Supabase Apple provider Authorized Client IDs, Google OAuth iOS bundle IDs). Do once TestFlight confirms the new bundle ID.
- 🔲 **[W6]** **BRAND-07 — Legacy storage key migration** *(P3, ~1 hr)* — `lib/health/clientSync.ts:26` uses `vetra_healthkit_last_sync_ts`; `DashboardClient.tsx` + `GeneratePlanScreen.tsx` use `zona_wizard_draft`, `zona_guide_seen` (`zona_coach_intro_seen` verified gone 2026-08-15 — zero refs). Renaming wipes user state. Write a one-time read-old → write-new → delete-old migration on app boot. Low priority — these are functional IDs invisible to users.
  - **Verify still open:** `grep -rl 'vetra_healthkit_last_sync_ts\|zona_wizard_draft\|zona_guide_seen' lib app components` → **any hit = still open**.
- 🔲 **[W6]** **BRAND-09 — App Store screenshot templates** *(P2, ~2 days)* — when screenshots get built, ensure they use the Zonna wordmark with NN-moss device. Per `brand-product-alignment.md §7`, the 5-screenshot narrative arc is locked but the visuals don't exist yet.
  - **Verify still open:** **External — design work.** Screenshots don't exist yet; the 5-shot arc is locked in `brand-product-alignment.md §7`.
- 🔲 **[W6]** **BRAND-11 — Convention reminder** *(P3, 0 min)* — new SQL migrations should use "Zonna voice" in comments. Committed migrations are immutable history; don't edit them.
  - **Verify still open:** Convention only, 0 effort. Check the newest file in `supabase/migrations/` uses Zonna voice in its comments.
- 🔲 **[W6]** **BRAND-13 — Rename GitHub repo `zona` → `zonna`** *(P3, ~5 min)* — currently push goes via the redirect (`zona` → was renamed from `rts-training-hub`; now stale). After rename: `git remote set-url origin https://github.com/Service-Nerd/zonna.git` locally.
  - **Verify still open:** `git remote get-url origin` → contains `/zona.git` = **still open** (verified 2026-08-15).

### Data source hygiene (from ADR-011)

- ⏸️ **[W5]** **DS-04 — HealthKit per-km splits bucketing** — deliberately deferred 2026-05-30. Full analysis and decision in the AI-DEPTH-02c entry under "AI coaching depth" above. Short answer: HealthKit only exposes total distance + total duration (no per-km data), so any bucketing produces constant synthetic pace that makes the muscular limiter permanently silent — honest behaviour, but not worth building as a placeholder. Revisit only when a HealthKit data source provides distance-over-time samples.
- 🔲 **[W6]** **DS-07 (table rename) — `strava_activities` → `run_activities`** *(P3, ~1 day)* — *(naming note: distinct from the now-shipped DS-07 composite-effort feature — this is the unrelated table rename)* — the table is source-agnostic but named after one provider. Misleads every new contributor. Migration: `ALTER TABLE strava_activities RENAME TO run_activities` + update all `from('strava_activities')` callsites (grep: 27 occurrences, verified 2026-08-15 — `grep -rn "from('strava_activities')" app lib components`). High-risk for regressions; do in a standalone migration with a single grep-and-replace PR. No schema change beyond the rename. Coordinate with any in-flight work that touches the table.
  - **Verify still open:** `grep -rc "from('strava_activities')" app lib components` → **non-zero = still open** (28 as of 2026-09-16).

### HR sync latency absorption (from ADR-011 §5)

*Source: SLT review 2026-06-24. Founder-data evidence: 2/3 recent runs missing HR permanently because Apple Watch sync didn't land before the row aged out. The "Hold the zone" brand promise depends on HR coaching — surfacing half-information when sync is pending violates the promise. Two sequenced layers + instrumentation + commercial copy. Strava approval is known-not-arriving so Layer 2 is committed (not gated on instrumentation).*

#### HR-SYNC-FUTURES — Swift bridge opportunity register *(not scoped backlog items — a reference list of what HR-SYNC-03's bridge unlocks)*

*Captured here so future prioritisation can pull from a known menu rather than rediscover gaps. No commitments. Each is a separate item to be scoped through SLT review when its time comes. Marked Tier A (significant near-term value), B (real but niche), C (known-but-deferred). See ADR-011 §Gaps for the gaps these would close.*

**Tier A — significant near-term value**
- **VO2max ingestion** — closes the `computeVO2CrossCheck` null path in `app/api/race-times/route.ts`. Race-readiness coaching depth improves meaningfully. Currently blocked by `@capgo/capacitor-health@8.4.8` (no `vo2Max` in `HealthDataType`). Apple HealthKit exposes `HKQuantityTypeIdentifierVO2Max` directly. **Unlocks**: race-times confidence ±10% divergence flag works reliably, PAID race-readiness card depth.
- **Background delivery for RHR / HRV / sleep** — same observer mechanism as HR. Readiness signal becomes fresher overnight; daily coach note can pull current-day metrics rather than yesterday's. Closes the readiness latency gap.
- **`HKWorkoutEvent.lap` per-km splits** — Apple Watch records lap events when auto-lap is enabled. Could give us per-km splits *for users who enable auto-lap*, closing part of the DS-04 gap (currently deferred because HealthKit "doesn't expose distance-over-time"). Not a full solution — depends on user settings — but a real path to splits without Strava for the subset that enables it. **Unlocks**: AI-DEPTH-02b pace-fade analysis for HK-only users.
- **`HKWorkoutRouteQuery`** — GPS polyline for workouts (CLLocation series). Apple has exposed this since iOS 11. Unlocks future route-aware features (terrain-aware pace targets, hilly-route warnings, route-history view). Not in current roadmap but a known future direction.

**Tier B — real but niche, future direction**
- **`HKQuantityTypeIdentifierRunningPower` / `RunningStrideLength` / `RunningGroundContactTime` / `RunningVerticalOscillation`** — running form metrics, iOS 16+, Apple Watch Series 7+. Hutchinson-grade form analysis. Combine with HR drift = form decay signal. Useful coaching dimension but niche audience (only newest Watches expose these).
- **`HKQuantityTypeIdentifierAppleSleepingWristTemperature`** — Apple Watch Series 8+ wrist-temperature baseline. Recovery-from-illness / overtraining detection signal. Strong recovery science but limited device coverage.
- **`HKQuantityTypeIdentifierWalkingHeartRateAverage`** — passive daily HR baseline. Background readiness signal that doesn't require workouts.

**Tier C — known-but-SLT-deferred**
- **`HKCategoryTypeIdentifierMenstrualFlow` + related cycle data** — ENGINE-03a / CA-05. Currently blocked behind two gates (usage evidence + incorporation/insurance) per SLT 2026-06-22. The bridge enables the data path; the SLT gates control whether to build the feature on top of it. Important: bridging the data doesn't activate the feature — the engine work to use cycle data is a separate prioritisation. **Activation policy still SLT-controlled; no behaviour change without the engine work.**

### Display formatting, units & temporal (from ADR-015 / ADR-016)

*Source: the 2026-08-10 "78m push" investigation. ADR-015 (formatting + preference singularity) and ADR-016 (date-aware plan resolution) shipped, with the core + all high-traffic surfaces migrated (see feature-registry). These are the deliberately-held follow-ons.*

> ✅ **FMT-02 and FMT-03 both SHIPPED 2026-09-12 and are in `feature-registry.md`** — removed from this file
> on 2026-09-16, because an item lives in exactly one of the two and these were in both.
> They were carrying a **`Verify still open:` line that contradicted their own ✅**: it claimed
> `grep -c preferredUnits` → **0 confirms it's unthreaded**, and the real count is **10** (threaded
> DashboardClient → StravaScreen → StravaPanel, which is what FMT-02 shipped). The two surviving
> `km'` hits are the prop default and its type union, not display units.
> **This is the exact failure the "keeping this file honest" note above describes** — a mechanical
> check that nobody re-ran, still asserting the pre-fix world four days after the fix.

### Security audit follow-ups (from docs/security-audit-2026-08.md)

*Source: full security audit 2026-08-19 (`docs/security-audit-2026-08.md` — the source of truth for status + fix direction). 10 of 14 findings fully fixed on branch `security/audit-2026-08-fixes` (2 more partial, 2 accepted); the items below are the deliberately-deferred remainder.*

- 🔲 **SEC-07-VERIFY — Native Strava OAuth smoke test** *(P3, external — gated on Strava being a live user path)* — finding 7 changed `/api/strava/connect` from a redirect to an authed JSON endpoint + HMAC-signed state. Web path verified; the native `SFSafariViewController` round-trip needs a real-device test. **Not urgent (down-ranked 2026-09-09):** Strava is not a live user path — HealthKit is the SOR (ADR-011), the Strava screen + connect flow are `isAdmin`-gated (`DashboardClient.tsx:2314`, nav entry removed), no paid feature requires it, and API approval is still pending. This device test only matters if/when Strava OAuth is re-surfaced to real users (post-approval, secondary-supplement CTA). Bundle it with that work, not a general TestFlight.
  - **Verify still open:** External — device test, **AND** gated on Strava becoming user-reachable. Until then the hardening is shipped and simply unexercised in the live flow.
- 🔲 **SEC-06 — Residual dependency-CVE majors** *(P2, needs testing before bump)* — safe non-breaking fixes shipped (finding 6). Remaining need major bumps held for sign-off: `apn` → `node-forge`/`jsonwebtoken` (highest value; `apn@2.0.0` is major → needs an on-device iOS push test first), Next 16, `@supabase/ssr@0.12.4`. Not live-exploitable in current usage (apn only *signs* outbound APNs tokens; the exploitable Next CVEs already closed at 14.2.35).
  - **Verify still open:** `npm audit --omit=dev` → any HIGH remaining = still open.
- 🔲 **SEC-08 (remainder) — ONE route left, deliberately** *(P3)* — **16 of 47 routes now use `createUserScopedClient`.** `analyse-run` and `weekly-report` are BRANCHED (user-scoped on the interactive path, service role on the cron path where `x-service-key` + `x-user-id` means there is no user JWT at all). **The only remaining convertible route is `/api/generate-plan`**, left alone on purpose: it is the most commercially important route in the product and it gained a 403 path the same day (TIER-ENFORCE-01). Convert it when it is next touched for another reason, and run `npm run check:db` first. 17 routes are BLOCKED with a stated reason (mostly the 11 calling `savePlanForUser`, which UPDATEs `charity_codes`); 11 are cron/webhook/admin where the service role is correct. `npx tsx scripts/rls-convertible-routes.ts` is the live list; `lib/supabase/rlsCoverage.test.ts` gates every conversion at build time.
  - **Verify still open:** service-role per-user read/write routes not yet converted to `createUserScopedClient` = still open.
- 🔲 **SEC-09 — `x-service-key` impersonation hardening (optional)** *(P3)* — `analyse-run`/`weekly-report` accept the service-role key + arbitrary `x-user-id` as an internal bypass (finding 9, accepted). Not client-forgeable; only worth a signature/allowlist if the service key's blast radius becomes a concern.
- 🔲 **SEC-14 — Prompt-injection delimiter escaping (optional)** *(P3)* — user free-text (`user_note`, `race_name`) is concatenated into prompts unescaped (finding 14, accepted). Contained (deterministic engine, React-text render, per-user keyed). Add delimiter-escaping + a "treat quoted text as data" guard for belt-and-suspenders.

### General

- 🔲 **[W6]** **Tier-divergent rendering utility** — once a second tier-divergent component lands (after `GeneratingCeremony.tsx`), centralise the `tier` prop pattern into shared context or typed convention. Document in `ui-patterns.md`
  - **Verify still open:** **Gate:** a second tier-divergent component must land after `GeneratingCeremony.tsx`. `RecalibrationTile.tsx` may already satisfy this — confirm before treating as blocked.

---

## Appendix — Open questions & reference

### R23 deferred items still open

- **[W6]** **R23-D1** — Tier 2 wizard fields (`treadmill_primarily`, `longest_run_ever_km`) need engine consumer / product decision before the wizard work is worth shipping
- **[W6]** **R23-D3** — Surface `compressed` flag in UI. Needs design rationale via `frontend-design` skill before shipping

### Free/paid audit (when usage data is available)

Revisits two resolved-but-watchable decisions if commercial signals warrant:
- ⚠️ **Intensity distribution — RE-OPENED 2026-08-19 as a *coaching* decision. See SC-03 (Wave 1d); this entry is no longer the owner.** ~~engine produces ~90% easy across distances; spec target was 75–88%. Currently kept by design (restraint as the brand). If users drop off citing under-stimulation, smallest change is +1 quality session in build phase for HM/Marathon intermediate+~~ **The Coaching Board (CD-19) ruled this a §34 enforcement failure — a declared constitutional value with zero mechanical check — and contested the target itself (Seiler: the 80/20 finding is a session-count observation misapplied to a time denominator, so the delivered ~90% is more defensible than the config).** Filing it here, as a commercial watch item to revisit if conversion warranted, is **why it survived four months unresolved**. Do not re-decide it on commercial signals: it is a board matter with a ruling attached.
- **Free regeneration policy** — currently lenient (free users regen freely; AI enrichment is the paid value). If conversion is low and "fresh start" emerges as a real subscription motivator, gate regen only when active future-dated plan exists
