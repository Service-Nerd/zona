# Coaching Board — 2026-09-17 — PLAN-FITNESS-01

**Question:** are generated plans fit for purpose — do they build the runner, and far enough to finish the race safely?

**Trigger:** §2 Am.1 & Am.2, §3, §9, §24, §80 — hard.

**Ruling:** **CORRECT WITH AMENDMENT** (D1) and **CORRECT** (D2), Hutchinson chairing.

---

## ⚠️ Three earlier diagnoses were wrong. Recorded so they are not repeated.

| Claim | Status | How it was disproved |
|---|---|---|
| "The long run compounds and is the cause" | **Wrong** | The long run is 39% of a jump; only 24.7% of jumps are long-run-driven |
| "The volume curve is back-loaded" | **Wrong** | Dumped the curve — constant 10%/wk, flat at peak. Weeks 11–13 sat flat at 38 while delivery went 21→30→34 |
| "Post-pass safety caps subtract the volume" | **Wrong** | final ÷ allocated = **1.00 median** |
| "Allocation falls short of the curve" | **Wrong** | Instrumented the arithmetic: **0.0 km shortfall** |
| "Plans systematically under-deliver" | **Mostly artefact** | Split by weekday time budget: no cap → **0.95** of curve. The shortfall is the runner's own stated time budget, correctly honoured and declared (92% carry a note) |

Each was presented before being tested. The two defects below are what survived isolation.

## D1 — injury-history runners get zero net progression

**Isolated:** same runner, 18 weeks, everything identical but the knee flag.

| | net build | never builds |
|---|---|---|
| healthy, standard | **+91%** | 8.1% |
| **injury, standard** | **+6%** | **28.9%** |
| healthy, masters | **+79%** | 10.1% |
| **injury, masters** | **+3%** | **66.7%** |

A knee-history runner reached a marathon start line having never run beyond **14 km**.

**Mechanism.** Amendment 1 capped the post-deload bounceback at 5%. A deload cuts 15%, so recovery takes seven weeks and the next deload arrives in three. Amendment 2 (2026-09-16) found the ratchet and raised the deload 70% → 85%, but 85% is short of its own break-even: **86.4%** standard, **90.7%** masters. −1.6%/cycle and −6.3%/cycle.

⚠️ **The injury × masters cell existed in no grid** — `cohortGrid` does not vary injury, `targetedGrid` is all age 40 — so the worst case had never been measured.

**Amendment 1 set the condition it failed:** *"the curve still RISES within each block — slow is right, stuck is not."*

## D2 — the specificity floor arrives too late to be climbed to

**M1: a first marathon, 24-week runway, no injury, no time cap — peak long run 21 km, 50% of race distance** against a 30–32 km norm.

**Mechanism.** §24's and §80's floors were gated on `phase === 'peak'`. §80 asks a finish-goal marathoner for 42.2 × 0.70 = **29.5 km**, but only in the final two or three weeks, starting from §9's share of ~11 km, with §45 permitting +5 km/week. The climb cannot finish.

⚠️ **Not §52 and not §9.** The long run tracked §9's share for 14 of 19 weeks because nothing else asked; §52's 60% ceiling was never within reach.

⚠️ **The ruling named §24; the operative section is §80** — every charity marathon persona is `goal: 'finish'`, and §24 gates on `time_target`. Both carry the amendment.

## The seats

- **Willy (deciding seat).** Reversed his own RAMP-BOUNCEBACK-01 veto on the evidence. He rejected the unbounded return because a 70% cut returning to 100% is **+43%** onto healing tissue; Amendment 2's shallower cut makes it **+17.6%**, of a load carried seven days earlier. *"The injury I was protecting against has been replaced by a worse one."* Condition: the exemption is valid only while the cut stays ≥85%, gated on the constant.
- **Hutchinson (chair).** This is a defect against a ratified condition, not a reversal. COMPLIANCE-FIX-2 invoked D-21 yesterday and then shipped a number that cannot satisfy itself.
- **McMillan.** Eighteen weeks that finish where they started is not a training plan.
- **Sims.** Injury × masters is the worst cell and the one nobody measured; bone responds to progressive loading, so a flat curve is actively bad, not neutral.
- **Seiler.** No objection — aerobic volume, §1 untouched.

## Results

| | before | after |
|---|---|---|
| injury/standard net build | 18.2% | **45.5%** |
| injury/masters net build | 0% | **31.3%** |
| injury never-builds (standard) | 28.9% | **0%** |
| injury never-builds (masters) | 66.7% | **0%** |
| healthy net build | 41.2% / 32.4% | **41.4% / 30.8%** (unchanged) |

| persona | peak long run before | after |
|---|---|---|
| M1 first-timer, 24wk | 21.0 km (50%) | **26.0 km (62%)** |
| M2 compressed 12wk | 25.0 km (59%) | **29.5 km (70%)** |
| M3 returning + knee | 14.0 km (33%) | **26.0 km (62%)** |
| M5 masters 58 | 27.5 km (65%) | **29.5 km (70%)** |
| M1d declares experienced | 19.0 km (45%) | **23.5 km (56%)** |

**Long-run compounding IMPROVED**, against the concern that a harder climb would worsen it: plans with a 2-week window >40% **28.4% → 23.0%**, 3-week >50% **13.1% → 10.7%**, worst 2-week **126% → 121%**, worst 3-week **193% → 165%**.

## ⚠️ Costs, stated

- **`verify:parity` 3,310 of 5,940 cases changed (55.7%)** — knee/shin 72.6%, healthy 23.7%. The largest single change this engine has had.
- **Coaching deviation scan MED 23 → 25.** Both new ones are the honest trade: *"peak long run far beyond proven distance"* — M1 26 km vs a longest-ever 8 km (3.3×), H1 15.5 km vs 5 km (3.1×). **HIGH stays 0.**
- `cohort:shape` 5 metrics moved, all declared: marathon maintenance **69.8 → 68**, HM 34.2 → 34.7, constraint-note 64.5 → 64.2, overall maintenance 48.7 → 48.5, mean delivered peak 38.4 → 38.56.
- **M1 still reaches only 26 km, short of the 30–32 km norm.** §45's +5 km/week remains binding from a 15 km/week base. This closes most of the gap, not all of it.

## Artifacts

1. **§2 Amendment 3** · **§24/§80 Amendment**
2. `INJURY_BOUNCEBACK_MIN_DELOAD_PCT` (85) · `SPECIFICITY_RAMP_START_PCT` (60)
3. `INV-PLAN-BOUNCEBACK-BOUNDED` amended `>=` → `>` — a return **to** pre-deload is now legal
4. `lib/plan/injuryBouncebackBuilds.test.ts` (5 cases, incl. the unmeasured masters cell and a falsification)
5. `scripts/measure-plan-fitness.ts` — the before/after harness, committed and re-runnable

## Verification

`npm run verify` exit 0 — **2,057 tests / 223 files**, 118 invariants, sweep 15,974 plans / **0 hard failures** / no new violations, matrix 65/0, deviation **HIGH 0**.
