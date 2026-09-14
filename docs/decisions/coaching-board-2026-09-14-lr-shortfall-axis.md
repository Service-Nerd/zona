# Coaching Board — §66 Amendment 1 (LR-SHORTFALL-DURATION-01)

**Date:** 2026-09-14
**Trigger:** `lib/coaching/planAdjustment.ts`, `app/api/adjust-plan/route.ts`, `app/api/analyse-run/route.ts` + `manual/route.ts` — soft, **qualifies**. Migration on `run_analysis`.
**Round:** `coaching-review/2026-09-14/`

**Proposed change.** A long-run shortfall is measured on the axis the session is anchored on — distance where the session carried one, **time** where it did not.

---

## 🔍 Conflict scan — and it overturned the item's premise

| § | Relationship |
|---|---|
| **§66** | **The governing section, and it already answers the question — the other way.** Bullet 3: *"Both/all qualifying runs have a real planned distance (`plannedKm > 0`) — duration-primary long runs are out of scope (no distance to fall short of)."* **The exclusion is ratified doctrine and the code is faithful to it.** The backlog filed this as a SESSION-KM silent-pass defect. It is not a defect; it is a scope decision, and the question is whether that decision is still correct. |
| **§80** | **Why it is not.** Written *later*: *"Duration, not distance, and the distinction is not cosmetic… a first-timer is time-on-feet limited."* So there **is** something to fall short of. §66 predates the axis. §80 also supplies the veto on the obvious fix — see below. |
| §45 / §24 | Peak long-run floors. Unaffected: §66's taper guard already suppresses the trigger in the window where the peak long run lives. |
| §1 | Untouched — counts sessions, plan-wide (CD-19). A long-run trim cannot move it. |
| §47 | Supplies the reusable pattern: PEAK-LR-STEPBACK-MINUTES-01 already expresses the step-back in minutes for duration-anchored plans. |
| SESSION-KM-01 | `sessionKmSelfPaced` is the ratified owner and would recover 100% of the dropped sessions. **Deliberately not used here** — see the ruling. |

---

## What was measured

On the 621-plan cohort grid:

| | |
|---|---|
| Long runs dropped before the trigger saw them | **2,547 of 7,965 (32.0%)** |
| Plans where the trigger is **completely dead** | **153 of 621 (24.6%)** |
| Plans partially blind (worse in kind — the "consecutive weeks" window can compare non-adjacent runs) | 54 (8.7%) |
| Recoverable by deriving km from the session's own pace band | **2,547 (100%)** |

**A second gate** in the same function — `if (isLongRun(s) && s.distance_km)` — meant even a firing trigger would have shown a confirmation tile promising a trim that changed nothing.

**Upstream root cause.** The same expression, `session.distance_km ?? null`, writes `planned_load_km` in both analyse-run paths. That stored column has three consumers and one is user-facing: the post-run card renders **"No distance data."** whenever planned is null — so a duration-anchored runner met that line after every run, forever, while the run in front of them plainly had a distance.

---

## The board

**Hutchinson (chair).** The conflict scan settles the framing and it is not the framing the item arrived with. §66 bullet 3 is explicit, and the code does exactly what it says. So this is an **amendment, not a defect fix**, and the distinction matters for how it ships. On the substance: §80 is later and more specific about this cohort, and it is right. A first-timer prescribed 90 minutes who stops at 55, twice, is telling us something we currently discard.

**Seiler.** No objection on distribution — §1 counts sessions, a long-run trim cannot move it. One caution and it is structural: the trigger reduces *volume*, and for a duration-anchored runner volume **is** time. Apply the trim in minutes or you convert their plan to a distance-anchored one behind their back.

**McMillan.** This is the cohort the trigger was written for. We built a pull-back for runners who consistently fall short and then excluded the runners most likely to fall short. On the threshold: 82% of time is not obviously the same signal as 82% of distance — distance shortfall can mean "ran out of road", time shortfall means "stopped", which is arguably stronger. I would still keep 82%, because a second constant is a second thing to tune and we have no evidence for a different number. **Record that we chose parity by default, not by measurement.**

**Willy — binding condition, resolved in sitting.** The walk-break interaction is the risk and it cuts the opposite way to the intuition. §80 expects walk breaks. My concern was that `moving_time_s` would under-count them — it does not: **walking registers as movement**. Only a full stop reduces moving time, and a runner standing still is not on their feet. That resolves it; use moving time. Second: the trim must be in minutes (with Seiler), and must not fight §80's peak floor — §66's taper guard already handles that, and I want it confirmed rather than assumed.

**Sims — non-blocking, recorded.** This cohort is disproportionately first-timers on charity places, many of them women and masters runners. Two things. The absence of a response here is **not neutral** — a runner consistently stopping short and hearing nothing learns the plan is not listening. But the *reason* a first-timer stops at 55 of 90 minutes is often fuelling or low energy availability rather than a tissue ceiling, so the reduction treats the symptom. Keep §66's existing voice rule exactly — *"build it back when it feels right"* — because the note must not imply their ceiling is fixed.

---

## ⚡ Recorded disagreements

**McMillan on the threshold.** He accepts 82% across both axes but wants it on record as a default rather than a finding. What would change his mind: completion-rate data on duration-anchored long runs showing the distributions differ.

---

## ⚖️ Ruling — CORRECT WITH AMENDMENT

1. Shortfall is measured on the axis the session is anchored on. **Distance wins where the session carried one.**
2. **Deriving kilometres is rejected.** It recovers 100% of the dropped sessions and would report a walk-breaking first-timer short against a number that never appeared in their plan — reducing the long run of the runner §80 exists to protect. §80: *"a floor the runner believes they have failed is worse than no floor."* **A recovered number is not automatically the right number.**
3. **Moving time, not elapsed** — because walking is movement (Willy, resolved).
4. **82% governs both axes. No new numeric** (McMillan's parity-by-default, recorded).
5. **The trim follows the axis** — minutes for a duration-anchored long run, never a new `distance_km` (§80, §47's pattern).
6. The post-run card's planned-vs-actual line follows the same axis. Display (ADR-015), but the **axis** is this board's.

### 📦 Artifacts

1. **Principle** — §66 Amendment 1.
2. **Numeric** — none new, deliberately. New columns `run_analysis.planned_load_mins` / `actual_load_mins` (`20260914_run_analysis_load_mins.sql`, applied + ledgered).
3. **Invariant** — `INV-PLAN-LONG-RUN-HAS-AN-AXIS` + `plan-invariants.md` row, proven wakeable by a new `strip both anchors` liveness mutation. **This is the amendment's PRECONDITION, not §66 itself**: the shortfall trigger runs on live analysis rows and is not a plan property, so `validatePlan()` cannot assert it. The trigger is covered by `planAdjustment.test.ts` (23 cases — 14 pre-existing as distance-axis regression, 9 new), including source guards that read the shipped route.

### ↗️ SLT escalation

None. Not a commercial question.

### Verification

- `npm run verify` — exit 0, **1789 tests / 198 files**; sweep 0 hard failures, 0 violations.
- `npm run verify:parity` — **IDENTICAL, 5,832 cases.** Generation provably unaffected; this is the analysis/adjustment path.
- **Reach: 68.0% → 100.0%** of long runs comparable; **plans with a dead trigger 24.6% → 0.0%** (`scripts/measure-lr-shortfall-reach.ts`, which exits non-zero if any long run is comparable on neither axis).
- **Falsification:** disabling the time axis turns 3 of the 9 new tests red; restoring it returns 23/23.
