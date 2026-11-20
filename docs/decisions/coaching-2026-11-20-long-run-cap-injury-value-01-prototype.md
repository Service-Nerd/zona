# Coaching Board — 2026-11-20 — `LONG-RUN-CAP-INJURY-VALUE-01` (prototype sitting): the VALUE of §9 Am. 3's cap, back and plantar separately

Seats: Hutchinson (chair), Seiler, McMillan, Willy, Sims. Blagrove silent (no strength rule touched).

**Trigger:** hard — `GENERATION_CONFIG.LONG_RUN_CAP_MINUTES_BY_INJURY` is a doctrine numeric. Branch-only prototype
for a board measurement, not merged.

## The question the 2026-10-28 sitting could not answer
§9 Am. 3 ratified 120 min for both Back and Plantar fasciitis AS IS, value INSUFFICIENT EVIDENCE, because every raise
measured then (150/180/210) multiplied `INV-PLAN-LR-MAX-WEEKLY-PCT` warnings (578 → 3,483) and *"the week does not grow
with the long run."* It reopens on: (a) a prototype where the week grows with a raised long run, (b) back and plantar
treated separately (Willy: plantar has a time-on-feet mechanism, lumbar pain mostly does not), (c) injury recency.
(c) was ruled this morning (`coaching-2026-11-20-injury-recency-01.md`: *longer ago* lifts the cap for Back and
Plantar; current / within a year keep it; absent = current). **This sitting rules only on the value current /
within-a-year runners get, per injury, and does not touch the recency table.**

**The precise unanswered question:** are the share warnings a raised cap produces caused by the raise outrunning the
week, or are they the healthy engine's own §52 residual that the cap was suppressing? The 10-28 table compared each
raise to the CAPPED plan, never to the same runner without the chip.

## Options prototyped
Per injury, independently: **120 (today) · 135 (= §9's ratified HM cap, `LONG_RUN_CAP_MINUTES.HM`) · 150 · 180 ·
lifted** (distance cap governs), each against a **healthy twin** (same input, no chip).

## Prototype
- Branch `proto/long-run-cap-injury-value-01` @ `5e3d9e76`, worktree
  `/Users/russe/rts-training-hub/.claude/worktrees/agent-aaa1e514137acd5a9`. DO NOT MERGE.
- Seam: `__protoSetInjuryCaps()` in `lib/plan/longRunTimeCap.ts` writes the config table, so producer
  (`longRunTimeCap`) and checker (`invariants.ts`, which reads config itself) see the same value. Default off.
- Command: `npx tsx scripts/proto-long-run-cap-injury-value-01.ts 7`. Output committed as
  `scripts/proto-long-run-cap-injury-value-01.out.txt`.
- Corpus: `cohortGrid()` HM + marathon rows (20,736; the only distances where 120 is tighter than §9's distance cap),
  production shape (no `fitness_level`, asserted), every 7th row (7 coprime to 2⁸×81) = **2,963 inputs per variant**;
  chips in wizard spelling (`'Back'`, `'Plantar fasciitis'`). `validatePlan` run on every plan.

## Evidence (all figures from the command above)

**Marathon** (1,234 built, 247 designed refusals in every variant, 0 throws):

| variant | mean peak LR | mean peak week | LR ÷ peak week | maintenance | peak LR below runner's longest | share warn weeks | plans with one | errors | plans ≡ healthy |
|---|---|---|---|---|---|---|---|---|---|
| healthy twin | 26.2 | 48.3 | 53.3% | 73.0% | 17.3% | 1,727 | 342 | 0 | — |
| 120 (today) | **16.0** | 40.9 | 40.8% | 75.9% | **50.0%** | 557 | 72 | 0 | 0 |
| 135 | 17.9 | 42.8 | 43.6% | 72.9% | 50.0% | 682 | 82 | 0 | 0 |
| 150 | 19.9 | 44.5 | 46.2% | 70.2% | 41.8% | 985 | 119 | 0 | 52 |
| 180 | 23.5 | 47.0 | 50.7% | 70.3% | 22.1% | 1,441 | 277 | 0 | 206 |
| lifted | 26.1 | 48.3 | 53.2% | 73.1% | 17.4% | 1,701 | 330 | 0 | 1,068 |

**Half marathon** (1,482 built, 0 refusals): today's 120 binds under §9's 135.

| variant | mean peak LR | peak week | **maintenance** | share warn weeks | plans ≡ healthy |
|---|---|---|---|---|---|
| healthy twin | 17.2 | 39.5 | **47.1%** | 1,034 | — |
| 120 (today) | 15.8 | 38.3 | **74.2%** | 864 | 308 |
| 135 / 150 / 180 / lifted | 17.2 | 39.5 | **47.2%** | 1,046 | 1,209 |

**Back and Plantar are identical in plan shape at every value** (same fingerprint counts, same means). The only
difference is the checker: Plantar carries `INV-PLAN-INJURY-CAP-DELIVERED` warns (marathon 407 at 120 → 226 lifted;
HM 545 → 523), Back none. The plans that still differ from the healthy twin when lifted (HM 273, marathon 166) are
the any-injury gates, not the cap.

**Read, both figures for the 10-28 claim:** 10-28 *"share warnings 578 → 3,483 as the cap rises to 210"*; today
**557 → 1,701**, and the healthy twin carries **1,727**. Every share warning a raise "adds" is one the same runner gets
with no chip at all; all are `warn` (maintenance plans), **0 errors at any value**. The week DOES grow: peak week
40.9 → 48.3 km lifted, identical to healthy. The 10-28 reading compared a raise to the capped plan; against the
healthy twin the condition is met. What the cap buys is a peak long run under the runner's own longest recent run on
**50.0%** of marathon plans (17.3% healthy), and at the half a **+27 pp** reclassification to maintenance (§23
peak-over-base: the capped long run holds the week down) for a 1.4 km shorter long run.

## 🔍 Conflict scan
- **§9** (distance caps; the injury cap is its tightening) and **§9 Am. 3**: this sitting amends Am. 3's value for
  Back and its stated reason for both.
- **§52 / §52 Am. 1 / §114** (60% share; warn for maintenance): where the 10-28 objection lived. Measured: no raise
  exceeds the healthy twin's §52 residual; the residual is §52's to own, not §9 Am. 3's.
- **§23** (peak over base → maintenance): the HM flip is §23 firing because the cap holds the peak down.
- **§106** (never peak below where the runner is): has no long-run counterpart; the 50% below-longest figure is that
  gap, recorded not ruled.
- **§90 / §90 Am. 2** (`DELIVERED_CAP_INJURIES` has plantar, not back): consistent with treating them apart.
- **§24** marathon floor yields to the time cap: unchanged.
- **INJURY-RECENCY-01 (today)**: Back and Plantar *longer ago* lift the cap; current / within a year keep a cap;
  absent = current. Nothing here changes that table. One consequence, handed off below: at HM, Back's recency answer
  stops changing anything.

---

### 🏃 Alex Hutchinson (Chair)
*"The 10-28 ruling rested on one number, and it was the wrong comparison. 557 to 1,701 looks like the raise breaking
§52; 1,701 against 1,727 for the same runner with no chip says the raise only stops hiding warnings the healthy engine
already carries. So the share objection is answered. What is not answered, and cannot be from a corpus, is whether a
two-hour ceiling prevents a single injury. We have no outcomes. Any value is a prior; the job is to pick priors with
reasons, and to stop treating two different tissues as one."*

### 📊 Stephen Seiler
*"No intensity-distribution question. Long-run minutes are Zone 2; nothing of mine moves."*

### 🎯 Greg McMillan — partial dissent
*"Half the marathoners with a back history get a peak long run shorter than one they have already run. That is not
caution, it is a plan that de-trains the long run. At the half the cap barely touches the long run and flips a quarter
of plans to 'this plan doesn't build'. I would lift Back to the distance cap for every bucket. I accept the
half-marathon anchor as better than today."*

### 🩹 Rich Willy
*"Separate them. **Plantar**: the fascia is loaded by time on feet and a current or recent one flares on long
duration, so 120 minutes has a mechanism; I keep it for current and within a year, and this morning's ruling already
lifts it for longer ago. **Back**: the thinnest basis of any cap we hold, and now we can see what it costs. I will not
lift it to 210 for a back the runner tells us is still an issue, and doing so would empty the recency answer we ruled
this morning. I will not invent 150 either. The half-marathon cap is a number this board already ratified as the
longest a long run should be for that race; capping a current back there means no half-marathon runner loses anything
to it and a marathoner keeps a ceiling. My 10-28 condition was 'must not raise the share of the week'; the honest
version is 'must not exceed the same runner without the chip', and 135 does not."*

### ⚕️ Stacy Sims
*"Plantar is more common in women and in the 40 to 60 bracket that is most of our marathon entry, so I support keeping
its 120. My 10-28 condition binds unchanged: when the cap holds her long run, the plan says so, naming the right
injury now the two values differ."*

---

### ⚡ Recorded disagreements
**McMillan vs Willy on a current Back at the marathon.** McMillan: lift to §9's 210; the cap de-trains half the
cohort. Willy: a symptomatic back keeps a ceiling, and 210 empties today's recency answer for Back. **What would
settle it:** flare or recurrence data by long-run duration for runners reporting a current back complaint. Zonna
collects no outcomes; no prototype can produce it. Ruled at 135.

## ⚖️ Ruling — **CORRECT WITH AMENDMENT**
1. **The split is CORRECT.** Back and Plantar fasciitis carry separate values with separate stated reasons.
2. **Plantar fasciitis: 120 min stays**, now ratified on mechanism (time on feet), not "as is". Current / within a
   year; *longer ago* lifts it (INJURY-RECENCY-01, unchanged).
3. **Back: 120 → 135 min, defined as §9's HM distance cap** (`LONG_RUN_CAP_MINUTES.HM`), not a new number. Current /
   within a year; *longer ago* lifts it (unchanged). Measured: half-marathon back plans match the healthy twin on
   every measured figure (maintenance **74.2% → 47.2%**, LR 15.8 → 17.2); marathon LR **16.0 → 17.9 km**, peak week
   40.9 → 42.8, share warns 557 → 682 (all `warn`, under the twin's 1,727), 0 errors. Below-longest at the marathon
   stays **50.0%**: this value does not fix that, and the board says so.
4. **§9 Am. 3's reopen yardstick is restated**: a raise is measured against the **healthy twin**, not the capped
   plan. "No more §52 share warnings than the same runner without the chip" replaces "must not raise the share."

## 📦 Build spec (artifacts, one commit)
1. **Principle** — §9 Am. 3 amended: per-injury table (Back = HM cap, Plantar = 120), each reason (Willy's mechanism
   split), the healthy-twin yardstick with both figure pairs above, McMillan's dissent, and that the values remain
   priors with no outcome data.
2. **Numeric** — `GENERATION_CONFIG.LONG_RUN_CAP_MINUTES_BY_INJURY = { back: <HM cap>, plantar_fasciitis: 120 }`, with
   `back` read from the same named constant as `LONG_RUN_CAP_MINUTES.HM` (hoist 135 so both read one value), so the
   anchor cannot drift.
3. **Invariant** — `INV-PLAN-LONG-CAP-MINS` already reads the table per key, so it enforces the split with no code
   change; its `plan-invariants.md` row is amended (it says "(120)"). New arm in `lib/plan/injuryLongRunCap.test.ts`:
   `back === LONG_RUN_CAP_MINUTES.HM`, `plantar_fasciitis === 120`, and a back-history marathon long run over 135 min
   fails `validatePlan`. **Falsify** by setting `back: 120` (anchor arm red) and by making the producer skip the back
   cap (invariant red). The existing `toBe(120)` for back is updated.

## Conditions before the build ships
- **`npm run measure:fitness`** with the change applied, on a back/plantar overlay (its corpus holds no back cohort;
  same overlay the recency build's condition requires): no `neverBuildsPct` rise. **Not run here.**
- Report the count of foundation / maintenance-path weeks that move (`longRunTimeCapMins` serves three paths; this
  prototype measured race plans only).
- 🧭 **Design Board hand-off (a consequence, not a conflict):** with Back at 135, Back's recency follow-up changes
  nothing at the half (135 = HM cap), so by the SLT's *"if nothing changes, it is not collected"* the Back follow-up
  shows at marathon and ultra only; Plantar's still shows from the half.
- Sims: the binding-cap note names the injury whose ceiling bound.

## ⚠️ What this does not prove
- That 120 for plantar or 135 for back prevents injury: no outcomes exist; both are priors with reasons.
- 50K / 100K: outside `cohortGrid`; Back's change (120 → 135 there too) is **not measured**.
- Plantar's hill swap and §90 levers produced no plan difference from Back in this corpus; a corpus observation, not
  a claim those levers are inert.
- `measure:fitness`, `cohort:shape`, `verify:parity` not run (brief limits); stride-7 sample, not the full grid.
- The 10-28 absolute figures (578 / 3,483) used a different cohort; this comparison is like-for-like within one run,
  not a reproduction of theirs.

## ↗️ SLT escalation
None.
