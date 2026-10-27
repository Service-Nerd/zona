# Coaching Board submission: does a §9 cut have to say what it cost? (2026-10-27)

**Input:** `S9-RESIDUAL-STATED-01`, filed while building S9-RATIO-MINUTES-01; founder: "yes" to taking it to the board
after measuring. Measured at `fe161a86` on the main parity grid (2,094 plans, paid tier), read-only.

## What happens

When a pass shortens the long run (§45's progression cap, §47's step-back), §9 holds every easy run at
long ÷ 1.25. The minutes cut from the easy runs are not moved anywhere (Willy, binding, S9-RATIO-MINUTES-01), and no
note says so. Distance-anchored plans have always done this in km; since `4cfd397e` minutes plans do too.

## Measured against §40c's own bar

§40c's threshold is **10% of the intended peak week**, set because below it "is rounding and phase noise" and
"notes that fire on noise get ignored".

| Counterfactual | Plans changed | Peak week loses > 10% | > 5% | Worst peak loss |
|---|---|---|---|---|
| Minutes clamp off (before `4cfd397e`) | 137 | **0** | 1 | 6.0% |
| Both km clamps off (§45 and §47) | 326 | **0** | 4 | 9.6% |

No plan crosses the bar. Single weeks do, so here they are by shape (a week losing more than 10%):

| | Minutes clamp | km clamps |
|---|---|---|
| The week had been a +30% spike over the week before | 37 | 44 |
| After the cut it is still at least the week before | 2 | 24 |
| **After the cut it dips below the week before, then the build resumes** | **0** | **51** |

The 51 are the only shape a runner could see: for example a 5K plan at weeks 8–10 going 236 → 221 → 268 minutes, a
week 6–13% lighter in mid-build with no step-back label. They all come from the km clamps, which predate today.

## Ruled ground

- **§40c:** a *life-first constraint* that *materially* suppresses delivery is stated, with the lever. Threshold 10% of
  the intended peak week. A §9 cut is a structural rule, not a life constraint, and it has no lever the runner owns.
- **§34 / ADR-022:** residuals are declared when a rule is broken (the load residual note); here no rule is broken.
- **§90:** a week the runner is told is easier must deliver less. The reverse (a lighter week not called easier) has no
  ruling.
- **S9-RATIO-MINUTES-01 (Willy, binding):** the minutes are not moved into the long run.

## Questions for the board

1. Does a §9 cut need a note? The plan-level effect never reaches §40c's bar.
2. The 51 mid-build dips: leave them, label them, or smooth them?

## What this does not prove

The grid is the main parity grid, paid tier: no foundation runway, no blocked days, no weekday caps. Live plans were
not measured: the dip cannot be attributed without the counterfactual. Minutes are compared directly; km plans are
compared through their stored `duration_mins`. No device.
