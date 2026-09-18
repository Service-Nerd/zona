# CB-SUBFLOOR-ADMIT-01 — admit the sub-floor beginner, don't refuse them

**Source:** Coaching Board 2026-09-18, ruling (B) — **INCORRECT / veto** on the
current refusal. Founder P0: the ~500 Make-A-Wish first-timers hold a redeem code
and must be able to create a marathon plan.

---

## 1. The defect, stated precisely

`ruleEngine.ts:3106`:

```ts
longKm = Math.max(floorDist(longKm), minDist.long)   // minDist.long = 5
```

Three lines above it, §45's cap has just been applied
(`longest_recent_run_km × 1.10`). The comment above the floor line shows the
author guarding *rounding* from breaking that cap — and then the `Math.max`
breaks it outright.

For a runner whose longest run is 3 km:

| | week-1 long run | step |
|---|---|---|
| §45 cap alone | 3.3 km | **+10%, safe** |
| after the 5 km floor | 5.0 km | **+67%, unsafe** |

§113 then refuses that runner **because week one is a leap** — a leap the engine
itself introduced. §113's own header documents the mechanism
(*"the floor wins and the cap is silently discarded"*) without drawing the
conclusion.

**The refusal is not protecting the runner from their fitness. It is protecting
the engine from prescribing something it has no vocabulary for.**

## 2. Scope decision, and why it is NOT "make the config per-level"

`MIN_SESSION_DISTANCE_KM` has **27 call sites across 5 modules**. Threading a
per-level config to all of them is a large, high-risk change for a cohort the
engine currently refuses outright.

**Chosen design — one derived value, one owner.** `lib/plan/sessionFloors.ts`
resolves the floors *for this runner* once:

```
effectiveLongFloor = min(config.long, max(longest_recent_run_km, ABSOLUTE_MIN))
```

- A runner at or above the floor resolves to **exactly today's value** — so the
  change is a provable no-op for everyone the engine already serves.
- A sub-floor runner resolves to their own longest run, and §45's cap then
  places a safe +10% step.
- `ABSOLUTE_MIN` stops the floor collapsing to nothing: below it a "long run"
  is not a session.

## 3. ⚠️ The measurement trap, which is the most important line in this plan

**Neither plan grid contains a single row with `longest_recent_run_km < 5`
(measured: 0 of 37,248; the minimum is 8).** That is `GRID-SUBFLOOR-01`, which I
resolved earlier today as "do not add the row" — on the reasoning that those rows
produce no plan. **This change makes them produce plans, so that reasoning is now
void and the decision must be revisited.**

Consequences to hold onto:
- `verify:parity` and `cohort:shape` will report **no change**. That is not
  evidence of safety, it is evidence they cannot see the cohort.
- The **property sweep** does reach it (2,634 §113 refusals today). It is the
  only standing harness that can.
- A **dedicated measurement** of the newly-admitted cohort is required, because
  no standing harness covers a runner the engine has never served.

## 4. Build order, each step tested before the next

1. **`sessionFloors.ts`** — the resolver + unit tests. No behaviour change yet.
2. **Wire the long-run floor** at `ruleEngine:3106`. Test: a sub-floor runner's
   week-1 long run is `longest × 1.10`, not 5.
3. **Invariant `INV-PLAN-WEEK-1-LONG-NO-FLOOR-OVERRIDE`** — week-1 long run
   never exceeds §45's cap. ⚠️ Today's `INV-PLAN-WEEK-1-2-LONG-CAP` explicitly
   *permits* the override (`Math.max(rawCap, minDist.long)`), so it must be
   amended in the same commit or the new rule is unenforceable.
4. **§113 becomes runway-aware** — refuse on longest-run distance **and** runway,
   not distance alone. The board did not vote to admit everyone: a 3 km runner
   with 8 weeks is still correctly refused.
5. **Measure the admitted cohort**: do they get a plan that builds, and is every
   week-on-week step inside §45/§2?
6. **Re-run**: `verify`, sweep, `measure:fitness`, `cohort:shape`, parity —
   reporting which moved and which *cannot* move, with the reason.

## 5. Docs that must land with it

- **Principle:** §113 amendment (runway-aware) + the floor-yields-to-cap rule.
- **Numeric:** `MIN_SESSION_DISTANCE_ABSOLUTE_KM` in `GENERATION_CONFIG`.
- **Invariant:** new row in `plan-invariants.md`, amended row for the week-1 cap.
- **Registry + build-log + backlog**, and `GRID-SUBFLOOR-01` reopened with the
  reason its original resolution no longer holds.

## 6. What this plan does NOT do

- It does **not** raise `QUALITY_SESSIONS_PER_WEEK_MAX.beginner` (ruling A is a
  separate change: strides/hills as neuromuscular stimulus, not quality).
- It does **not** implement run/walk. Willy called that a strong recommendation,
  explicitly **not** a blocking condition, needing its own sitting.
- It does **not** touch §111's base-volume gate. Separate refusal, separate rule.
