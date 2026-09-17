# Coaching Board — 2026-09-17 — LR-ABS-CAP-LOWVOL-01

**Question:** should §45's `+5 km absolute` long-run step allowance taper at low volume?

**Trigger:** `CoachingPrinciples.md` §45 · `generationConfig.ts` · `ruleEngine.ts` · `invariants.ts` — **hard**. Changes what the engine prescribes.

**Ruling:** **CORRECT.** No dissent on correctness. Ship timing withheld by the board and escalated; **the founder elected to ship immediately.**

**Prior sitting (2026-09-16):** INSUFFICIENT EVIDENCE — Hutchinson: *"a 33% ceiling is a number I made up."* Willy's condition was a measurement scoped to the low-volume cohort.

---

## The measurement

Cohort per Willy: longest recent run < 18 km **and** current volume < 35 km/wk. 1,200 cohort plans / 5,586 long-run steps, against a 1,200-plan control of everyone else.

| | Cohort | Control |
|---|---|---|
| Steps legal **only** via the absolute arm | 29.2% | **37.8%** |
| Median jump | 33% | 26% |
| p90 jump | 52% | 33% |
| Max jump | **83%** | 45% |
| **≥ +40% in one week** | **32.5%** | **2.7%** |
| Not followed by a down week | 61.9% | 73.0% |

⚠️ **Frequency was never the tell** — the absolute arm binds *more* often on ordinary runners. **Magnitude is, by twelve-fold.** A whole-population measurement would have shown nothing wrong, which is precisely why the first sitting refused to rule.

⚠️ **Willy withdrew his own supporting argument.** He had reasoned the jumps might be tolerable where a recovery week follows. The cohort is slightly *better* protected on that axis (61.9% unprotected vs 73.0%). The case rests on magnitude alone.

## Conflict scan

- **§45** — amended. `+20%` arm and deload step-back exception unchanged.
- **§9** — **the principled anchor.** §9 sizes the long run as a share of weekly volume (build 30%). The `+5 km` allowance was the one part of long-run prescription that ignored weekly volume entirely. 15% of the week = half that share; expressed on the long run itself, **50%**.
- **§24** — **the cost.** Capping progression can prevent a time-targeted plan reaching the specificity floor, reclassifying it maintenance-grade. Measured: 7 of 1,149 (0.6%).
- **§52** — supportive; the taper pulls the same direction as the 60% ceiling.
- **§2 / §94 Am.1** — supportive; reduces acute-on-chronic spikes at source. §94 is the guard side, this is the prescription side.

## The seats

- **Hutchinson (chair).** The control group changed his position: frequency was never the issue, magnitude is, and §9 supplies the number so it is derived rather than invented. ⚠️ *"51% is still a large jump and the median plan is untouched. This cuts the extreme tail. Say what it does, not what we'd like it to do."*
- **Seiler.** The allowance ignoring weekly volume is the signature of a constant written once for a typical case and never revisited. Consistency fix as much as safety. §1 untouched — session counts unchanged.
- **McMillan.** Accepts only because the reclassified plans keep the honest `volume_constraint_note`. Likes that the median runner sees nothing change — a cap that bites only the tail is one runners never have to understand.
- **Willy.** *"The session that breaks people."* A 6 km long run going to 11 km is a different training stimulus arriving in one week, on the least-conditioned runner in the population. Chose 15%-of-week over 12% to protect race specificity.
- **Sims.** Bone-stress mechanism; risk higher in female runners, with low energy availability, and peri/post-menopause. The engine cannot see sex (`INPUT-SEX-01`, parked), so the load signal is the only lever left.

## ⚠️ Implementation finding — the basis changed, the rule did not

Shipped against `prev.weekly_km` the change **broke 140 plans, which threw.** §45 runs mid-pipeline and the long run is re-anchored (duration → distance) by later passes, so the producer and `INV-PLAN-LR-PROGRESSION-CAP` read **different** weekly volumes and disagreed.

Re-expressed on `prevLongRun` — arithmetically the same rule, since §9 puts the build long run at 30% of the week, so 15% of the week **is** 50% of the long run. `prevLongRun` is the value the `+20%` arm already reads, so producer and checker cannot drift. LR-CAP-BLIND-01 was one bug in two copies; this refuses to recreate that shape.

**The re-expressed rule is strictly better than the version the board costed:**

| | Board's weekly 15% | Shipped (50% of LR) |
|---|---|---|
| Peak long run falls | 22.7% | **12.5%** (median −1.5 km, max −3.0 km) |
| Plans losing their time goal | 18 (1.6%) | **7 (0.6%)** |
| Worst in-plan jump | 83% → 57% | 83% → **51%** |
| Median worst jump | 33% → 33% | 33% → 33% |
| Newly refused | 0 | **0** |

## Artifacts

1. **Principle** — §45 Amendment 2
2. **Numeric** — `LONG_RUN_ABS_STEP_MAX_PCT_OF_LR` (50)
3. **Invariant** — `INV-PLAN-LR-PROGRESSION-CAP` (producer + checker in lockstep) + registry row
4. Regression test — `lib/plan/lrAbsStepTaper.test.ts` (5 cases)

## Verification

`npm run verify` exit 0 — 2,052 tests / 222 files, 118 invariants, sweep 15,974 plans / 0 hard failures / no new violations, matrix 65/0, deviation HIGH 0.

`cohort:shape` re-baselined, **4 metrics moved, all declared**: marathon maintenance 69 → 69.8 (+0.8pp), overall maintenance 48.5 → 48.7, constraint-note 64.3 → 64.5, HM maintenance 34 → 34.2.

`verify:parity` **1,085 of 5,940 changed (18.3%)**, and the scoping is the proof:

| runner's weekly volume | changed |
|---|---|
| 15 km/wk | 814 / 1,944 (41.9%) |
| 30 km/wk | 271 / 2,052 (13.2%) |
| **55 km/wk** | **0 / 1,944** |

Zero effect on ordinary-volume runners — exactly what a low-volume taper should do.
