# Coaching Board — NO-RUNNER-TURNED-AWAY-01, real plans read week by week (2026-10-25, sixth sitting)

**Trigger:** soft, qualifies. The founder asked for real plans for typical runners to be put in front of the board
before any switch-on. Every earlier sitting ruled on measurements; none had read a plan.
**Evidence:** four personas through the engine's own door (`scripts/staged-plan-walkthrough.ts`, flag on). Output in the
appendix. Persona A (10 km/wk, 26 weeks) is not staged: the engine builds the marathon directly. Persona D was refused
until a defect found by this walkthrough was fixed (`79bab01c`: a runner already at §117 Am.2's door is now staged).

## What the board read

| # | Seen in the plans | Who |
|---|---|---|
| **R1** | Every ramp puts its runs on **consecutive days** (Mon, Tue, Wed) with four rest days after. True of the live §116/§118 base-build plans too: the day-picker takes the first open days | Sims, Willy |
| **R2** | D's week 4 deload is **one 7.4 km run**, the longest run of the block, after weeks of 4.8 km. The per-run step check exempts deloads, which is the hole | Willy |
| **R3** | D's race block opens at 18 km after a 13 km checkpoint (+38%) | McMillan |
| **R4** | Walk-run 6/1 (≈90 min on feet, 66 running) to the ramp's first week (3 × 2 km at 6/1, ≈60 min) | Hutchinson |
| **R5** | The **half** option for a runner who came through the walk-run start carries **no run-walk**, so week 1's runs are ~20 minutes continuous after six-minute bouts: the near-tripling L5 forbids. The marathon block carries it | Willy |

## The board

**🏃 Hutchinson (chair).** This is why we read plans. Two of these (R1, R2) are in plans already live, and neither showed
in any measurement because both pass every check we have.
**🩹 Willy.** R1: a novice's tissue needs the day between. R2: a deload that contains the block's longest run is not a
deload. R5: L5 covers every block built from a walk-run start, not only the marathon. R3: not a defect; §2 Am. measures
the load per run, and four runs instead of three keep each step small.
**⚕️ Sims.** R1 is my point from the walk-run sitting, and it applies to the ramp as much as to walk-run.
**🎯 McMillan.** R4 is fine: an easier first running week is what a coach would write. R3 I accept on Willy's arithmetic.
**📊 Seiler.** All easy. No objection.
**💪 Blagrove.** Silent.

## Ruling — CORRECT WITH AMENDMENT

| # | Ruling |
|---|---|
| **R1** | Every base-building ramp (§116, §118, staged) places its runs **never on consecutive days** where the runner's open days allow. New plans only (live-plan policy). Invariant `INV-PLAN-ONRAMP-SPACED` |
| **R2** | A deload week's longest run never exceeds the previous build week's longest. `INV-PLAN-ONRAMP-PER-RUN-STEP` gains a deload arm |
| **R3** | No change (§2 Am., settled) |
| **R4** | No change |
| **R5** | Any race block built from a plan with a walk-run start carries §117's run-walk prescription (§117 Am. 4: the prescription is separable from the peak), half marathon included |
| **E0** | Switch-on stays gated: R1, R2, R5 built and re-measured, then the founder decides |

## Appendix — the plans

```

━━ A: 10 km/wk, 4 days, 26 weeks out (Tom-like)
  NOT STAGED: plan 

━━ B: 5 km/wk, 3 days, 26 weeks out (Sheena-like)
  checkpoint week 13 · target 9 km/wk (door 8) · target found true · 13 weeks left for the race
  W 1 walk_run_start             —    tue walk-run 1/2 30min · thu walk-run 1/2 30min · sat walk-run 1/2 30min
  W 2 walk_run_start             —    tue walk-run 2/2 30min · thu walk-run 2/2 30min · sat walk-run 2/2 30min
  W 3 walk_run_start             —    tue walk-run 3/2 30min · thu walk-run 3/2 30min · sat walk-run 3/2 30min
  W 4 walk_run_start  deload     —    tue walk-run 3/2 30min · thu walk-run 3/2 30min · sat walk-run 3/2 30min
  W 5 walk_run_start             —    tue walk-run 4/2 30min · thu walk-run 4/2 30min · sat walk-run 4/2 30min
  W 6 walk_run_start             —    tue walk-run 5/2 30min · thu walk-run 5/2 30min · sat walk-run 5/2 30min
  W 7 walk_run_start             —    tue walk-run 6/1 30min · thu walk-run 6/1 30min · sat walk-run 6/1 30min
  W 8 base_build                 6km  mon easy 2km (6/1) · tue easy 2km (6/1) · wed easy 2km (6/1)
  W 9 base_build               6.6km  mon easy 2.2km (6/1) · tue easy 2.2km (6/1) · wed easy 2.2km (6/1)
  W10 base_build               7.2km  mon easy 2.4km (6/1) · tue easy 2.4km (6/1) · wed easy 2.4km (6/1)
  W11 base_build      deload   5.5km  mon easy 2.7km (6/1) · tue easy 2.7km (6/1)
  W12 base_build               8.7km  mon easy 2.9km (6/1) · tue easy 2.9km (6/1) · wed easy 2.9km (6/1)
  W13 base_build               9.6km  mon easy 3.2km (6/1) · tue easy 3.2km (6/1) · wed easy 3.2km (6/1)
  ▸ ran 100% (9 km/wk): RACE BLOCK
  14 weeks · week 1 9km → peak 32km · longest training run 19km · 0 quality sessions · run-walk yes
  ▸ ran 90% (8.1 km/wk): You ran 8.1km a week. Marathon training needs about 9km to start safely. → half / later_race
    half option: 14 weeks · week 1 7km → peak 27km · longest training run 14.5km · 0 quality sessions · run-walk no

━━ C: 0 km/wk charity runner, 3 days, 29 weeks out
  checkpoint week 17 · target 13 km/wk (door 7) · target found true · 12 weeks left for the race
  W 1 walk_run_start             —    tue walk-run 1/2 30min · thu walk-run 1/2 30min · sat walk-run 1/2 30min
  W 2 walk_run_start             —    tue walk-run 2/2 30min · thu walk-run 2/2 30min · sat walk-run 2/2 30min
  W 3 walk_run_start             —    tue walk-run 3/2 30min · thu walk-run 3/2 30min · sat walk-run 3/2 30min
  W 4 walk_run_start  deload     —    tue walk-run 3/2 30min · thu walk-run 3/2 30min · sat walk-run 3/2 30min
  W 5 walk_run_start             —    tue walk-run 4/2 30min · thu walk-run 4/2 30min · sat walk-run 4/2 30min
  W 6 walk_run_start             —    tue walk-run 5/2 30min · thu walk-run 5/2 30min · sat walk-run 5/2 30min
  W 7 walk_run_start             —    tue walk-run 6/1 30min · thu walk-run 6/1 30min · sat walk-run 6/1 30min
  W 8 base_build                 6km  mon easy 2km (6/1) · tue easy 2km (6/1) · wed easy 2km (6/1)
  W 9 base_build               6.6km  mon easy 2.2km (6/1) · tue easy 2.2km (6/1) · wed easy 2.2km (6/1)
  W10 base_build               7.2km  mon easy 2.4km (6/1) · tue easy 2.4km (6/1) · wed easy 2.4km (6/1)
  W11 base_build      deload   5.5km  mon easy 1.8km (6/1) · tue easy 1.8km (6/1) · wed easy 1.8km (6/1)
  W12 base_build               8.7km  mon easy 2.9km (6/1) · tue easy 2.9km (6/1) · wed easy 2.9km (6/1)
  W13 base_build               9.6km  mon easy 3.2km (6/1) · tue easy 3.2km (6/1) · wed easy 3.2km (6/1)
  W14 base_build              10.6km  mon easy 3.5km (6/1) · tue easy 3.5km (6/1) · wed easy 3.5km (6/1)
  W15 base_build      deload   8.1km  mon easy 2.7km (6/1) · tue easy 2.7km (6/1) · wed easy 2.7km (6/1)
  W16 base_build              12.8km  mon easy 4.2km (6/1) · tue easy 4.2km (6/1) · wed easy 4.2km (6/1)
  W17 base_build              14.1km  mon easy 4.7km (6/1) · tue easy 4.7km (6/1) · wed easy 4.7km (6/1)
  ▸ ran 100% (13 km/wk): RACE BLOCK
  13 weeks · week 1 13km → peak 29km · longest training run 17km · 0 quality sessions · run-walk yes
  ▸ ran 90% (11.7 km/wk): You ran 11.7km a week. Marathon training needs about 13km to start safely. → half / later_race
    half option: 13 weeks · week 1 12km → peak 24km · longest training run 14km · 0 quality sessions · run-walk no

━━ D: 8 km/wk, 4 days, 18 weeks out
  checkpoint week 7 · target 13 km/wk (door 8) · target found true · 11 weeks left for the race
  W 1 base_build                 8km  mon easy 4km · tue easy 4km
  W 2 base_build               8.8km  mon easy 4.4km · tue easy 4.4km
  W 3 base_build               9.6km  mon easy 4.8km · tue easy 4.8km
  W 4 base_build      deload   7.4km  mon easy 7.4km
  W 5 base_build              11.7km  mon easy 5.8km · tue easy 5.8km
  W 6 base_build              12.8km  mon easy 4.2km · tue easy 4.2km · wed easy 4.2km
  W 7 base_build              14.1km  mon easy 4.7km · tue easy 4.7km · wed easy 4.7km
  ▸ ran 100% (13 km/wk): RACE BLOCK
  12 weeks · week 1 18km → peak 33km · longest training run 19km · 0 quality sessions · run-walk yes
  ▸ ran 90% (11.7 km/wk): You ran 11.7km a week. Marathon training needs about 13km to start safely. → half / later_race
    half option: 12 weeks · week 1 14km → peak 27km · longest training run 14.5km · 0 quality sessions · run-walk no
```
