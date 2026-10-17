# Incident — recovery easing never reached a runner, and would have eased Monday

**Date found:** 2026-10-17 · **Live since:** 2026-06-26 (`a2673172`, RESHAPE-FIX-WAVE1) · **Triage:** Systemic
**Fix:** `READINESS-WRONG-DAY-01` · **Catalogue class:** NEW — *a guard hardened for one caller, fatal to the other,
swallowed by the client*

## Symptom
The founder asked whether we make enough of recovery-driven plan changes. Production answered first: **0
`readiness_signal` changes of 19 ever**, while in the last 30 days 20 runners sent resting HR, 12 HRV and 15 sleep.

## What was actually wrong
1. `app/api/pre-session-readiness/route.ts` passed `currentWeekSessions: [todaySession]`. On 2026-06-26
   `checkAdjustmentTriggers` gained a guard requiring seven entries (Mon → Sun) and **throws** otherwise. Every
   softening threw; the route answered 500; `DashboardClient` (the only caller) swallows its failures.
2. Behind it: `confirm-adjustment` / `revert-adjustment` wrote the stored list back **by position**, so the
   one-session row would have written the eased session onto **Monday**.
3. The obvious repair (pass the week) was wrong too: `buildReadinessAdjustment` eased **every** quality session and
   the long run, relying on a code comment that said the caller passes only today.
4. Pending readiness rows never expired; "today" was the server's UTC date.

## Why it survived
- **The guard was correct, and it was written for the OTHER caller.** RESHAPE-FIX-WAVE1 hardened the boundary
  after `/api/adjust-plan` sent malformed weeks. The readiness route was the second caller and nothing checked it.
- **The failure was swallowed** by a boot-time `try {} catch {}`; no ops event; the route had no test.
- **A comment was load-bearing**: *"Caller passes only today's session … so this map only modifies the target
  session by construction."* True when written, and the only thing keeping the builder safe.
- **No population to notice it:** most plans have not started, it only checks quality and long days, needs a
  14-day baseline, and is paid. Zero events looked like a quiet feature, not a dead one.

## Blast radius
None realised (0 rows ever written). Every paid runner with a baseline lost the recovery ease since 2026-06-26.

## Fix
Route passes `orderedWeekSessions(week)`, stamps `sessionDay` (stored key), `sessionDate` and `displayDay`, uses
the client's local date, expires stale pending rows, records `readiness_failed`. The builder edits only the target
day. `applyAdjustmentDays` is the one write-back owner: seven entries or refuse (409), only changed days.
**Tests:** `lib/api/readinessWrongDay.test.ts` (7 arms) runs the REAL route; falsified against the original route
(4 red), the all-hard-sessions builder (1 red) and the write-every-day write-back (2 red).
