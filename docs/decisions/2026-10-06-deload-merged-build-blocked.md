# The merged deload build — why it did not ship, and the one measurement it needs

**2026-10-06.** `DELOAD-BADGE-TRUTH-01` (merged with `DELOAD-LR-GROWS-01` and
`WEEK12-LR-CAP-CLIFF-01`) plus `DELOAD-PLAN-OPENING-01`. Four items, one defect, ruled CORRECT WITH
AMENDMENT on 2026-10-05 with a three-part fix: **(a)** fix the arithmetic where a reduction is
possible, **(b)** fix the BADGE where the floors forbid one (§34), **(c)** ramp the week-1-2 cap.

**It is not shipped.** Two independent blockers, both measured.

---

## 1. The premise re-derived — and the distance gating reproduces exactly

`cohortGrid()`, 39,632 plans, **96,460 deload transitions**:

| | |
|---|---|
| deload weeks at or above the prior week | **5,396 = 5.6%** |
| strictly above | **3,604** |
| exactly equal | **1,792** |
| overshoot median | **0.50 km** · max **4.27 km** |

**Race-distance gated, 13x, exactly as the 2026-10-05 sitting found:**
**5K 15.3% · 10K 7.0% · HM 1.8% · marathon 1.2%.**

## 2. 🔴 BLOCKER ONE — the (a)/(b) SPLIT IS NOT MEASURED BY ANYONE, INCLUDING ME

The fix plan assigns 3,604 weeks to (a) and 1,792 to (b). **That split is an inference from the
SIGN of the overshoot** — strictly-above treated as reducible, exactly-equal as floor-bound — not a
test of whether a reduction is actually possible. Reducibility is what decides which fix applies, so
the split is load-bearing.

**I tried to measure it twice and both attempts were unsound, in opposite directions.**

**Attempt 1 said 100% floor-bound, and it was an arithmetic artefact.**
`GENERATION_CONFIG.MIN_SESSION_DISTANCE_KM` is an **OBJECT**
`{ long: 5, easy: 4, quality: 5, secondary_quality: 4 }`, not a number. `count * FLOORS` is
`number * object` = **NaN**, and `NaN <= target` is always false, so every case fell into
"floor-bound". ⚠️ **My `?? 4` fallback never fired and masked the shape error** — the same
`?? default` trap as `distance_km ?? 0` and `resting_hr ?? 0`.

**Attempt 2 used the real per-type floors and still said 0% reducible — and it is self-evidently
wrong.** The worked case:

```
5K beginner, 20 km/wk, week 8, badged deload
  prior week delivered 13.8 km  ->  70% target = 9.7 km
  this week  delivered 14.5 km  (overshoot +0.73)
  my "irreducible": long run 7.3 (§52) + 2 easy at the 4 km floor = 8.0  ->  15.3 km
  sessions ACTUALLY placed: easy 7.3 · easy 3.6 · easy 3.6
```

🔴 **A lower bound of 15.3 km on a week that delivers 14.5 km is impossible, and the reason is in the
session list: the engine is already placing 3.6 km easy runs, BELOW the 4 km floor I used.** So the
floors I read are not the floors the engine enforces here (§82 floor-protection and
`CB-SUBFLOOR-ADMIT-01` govern that), and the bound was wrong.

**With the long run alone as the bound, the same case flips to REDUCIBLE** — 7.3 ≤ 9.7, reachable by
dropping both easy runs. So the two defensible bounds give **opposite answers on the same week**, and
the split is genuinely open.

⚠️ **What would settle it:** the engine's own floor behaviour for a deload week, read from the
producer (`applyWeekdayMinsCap` / §82 floor protection / `CB-SUBFLOOR-ADMIT-01`) rather than from
`GENERATION_CONFIG`'s declared minimums, and a per-week decision on whether DROPPING a session is an
admissible reduction. **That last part is a coaching question, not arithmetic:** a 3-session deload
week becoming a 2-session week is a frequency change, and §95/§119's whole argument is that frequency
is not a free variable.

## 3. 🔴 BLOCKER TWO — placement cannot land alone, and the board's sequencing says it lands first

Recorded in full in `2026-10-06-deload-placement-search.md`: the placement search works and cuts
`INV-PLAN-MIN-LOADING-BLOCK` by 38.7% (marathon by 93%), but **it breaks three PUBLISHED plans'
deload depth** (`5k-12-week`, `10k-12-week`, `sub-25-5k-plan`: *"recovery week only 6% below w2
(18 → 17 km); band is 20–35%"*), because moving a deload changes the week it steps back FROM.

**That failure is fix (a)'s subject.** So placement needs (a), and (a) needs the split, and the split
is unmeasured. **The sequencing amendment is right that placement goes first and wrong that it can go
alone.**

## 4. What CAN be done without the split, and deliberately was not

Fix **(b)** — the badge — is tempting to ship alone: it changes no prescription, and it addresses the
published-page embarrassment directly. **It was not shipped because its population IS the split.**
Badging a week "not a reduction" when the engine could in fact have reduced it would hard-code the
wrong answer into runner-facing copy, and this repo's record on naming a wrong reason is one day old
(`DAYS-GATE-CAPACITY-01`: *"naming a wrong reason is worse than naming none"*).

## 5. Next step, named

1. **Measure reducibility from the producer**, not from declared config minimums.
2. **Route the frequency question** — is dropping a session an admissible reduction? — to the
   Coaching Board, because (a)'s population depends on the answer and §95/§119 already argue
   frequency is not free.
3. Then build **placement + (a) + (b) together**, with (c) separable.

🔻 **Nothing about this is urgent in the runner's experience:** overshoot median is **0.50 km** and
the max is **4.27 km**. It is a labelling defect on a week that is 0.5 km bigger than intended, and
it is `warn`. The reason to do it properly is that `INV-PLAN-DELOAD-IS-A-REDUCTION`'s promotion to
`error` is blocked behind it.
