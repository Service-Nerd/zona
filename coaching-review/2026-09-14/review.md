# Coaching review round — 2026-09-14

**Generated:** `scripts/coaching-review-round.ts` — 6 canonical cases + 11 charity personas.
**Reviewer:** `/coaching-board` (supersedes the manual senior-coach reviewer, per README § Automation).

## Generation result

**16 of 17 cases generated with 0 error violations; 1 refused by design** (M4 sub-4:00 marathon on a busy 3-day week with a 45-minute weekday cap — §44 prep-time refusal, correct). Warn counts ranged 0–5 and were weighed below.

No case produced a finding against the plans themselves. **The round's substantive ruling came from the open backlog**, which is the honest record: the generator is clean, the gap was in what happens to a plan *after* the runner runs.

## Ruling — §66 Amendment 1 (LR-SHORTFALL-DURATION-01)

**CORRECT WITH AMENDMENT.** Full sitting: `docs/decisions/coaching-board-2026-09-14-lr-shortfall-axis.md`.

The shortfall trigger is measured on **the axis the session is anchored on**. §66's original exclusion of duration-primary long runs ("no distance to fall short of") was true and incomplete — §80, written later, makes time on feet the prescription for that cohort.

**Measured before:** 2,547 of 7,965 long runs (32.0%) dropped; the trigger **completely dead on 153 of 621 plans (24.6%)**. **After:** 100% comparable, 0% dead.

**The obvious fix was rejected.** Deriving kilometres via `sessionKmSelfPaced` recovers 100% of the dropped sessions — and would report a walk-breaking first-timer short against a number they were never given, reducing the long run of the runner §80 exists to protect.

## Ruling 2 — §39 Amendment 1 + §80 Amendment 1 (RACE-WEEK-FITNESS-01)

**CORRECT / CORRECT WITH AMENDMENT.** Full sitting: `docs/decisions/coaching-board-2026-09-14-race-week.md`.

**These came from READING the plans, not validating them.** Every case below was 0-error.

1. **§39's "mid-week" easy run landed on race eve in 81 of 81 measured plans (100%)**, mean 54 min, worst case 9 km / 72 min the day before a beginner's first marathon. Now: earliest available non-shakeout day, and a **ceiling** (not a ban) of §30's 35 min within 1 day of the race. **100% → 0%.**
2. **The race note said "First 5 km at Zone 2" on every distance** — 100% of a 5K, 50% of a 10K. Now a fraction of race distance, with effort following the goal.

## Harness finding — this round changed the cases themselves

**All 17 cases used MONDAY races**, because the plan-start constants are Mondays and race dates derive as `planStart + N × 7`. A Monday race has no in-week day before it, so **every round had been reviewing the one configuration in which the race-eve defect cannot appear.** The canonical cases now end on the Sunday of their final week, and new case `07-hm-monday-race` keeps the early-week edge visible until PV2-G is built.

## Charity-persona note

The 11 charity personas (M1–M5, H1–H3, T1–T3) are first-timers and low-base runners — the cohort §66 was dead for, and the cohort the Make-A-Wish referral channel will deliver. That is why this ruled as fix-before-acquisition despite near-zero live impact (137 analyses, 2 users).

## Open, carried to the next round

The remaining engine/coaching backlog items reviewed in this session: DELOAD-POS2-01 (premise stale — the invariant now fires on 16.1% of plans, not 0%), SC-10/CD-14, CV-ELIGIBILITY-01, ZONE-BAND-01 (blocked on data), and the adaptation-causality residual.
