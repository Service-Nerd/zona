# ADR-016 — Date-aware plan resolution & send-gating

**Status:** Accepted (2026-08-10)
**Related:** §73 (temporal position via date-window predicates, never index math), ADR-013 (`week.n` keying), N-014 (cron windows)

## Context

A daily push fired **"Easy 1h 18 today"** for a user whose plan starts the following Monday. Root cause: `getCurrentWeek()` **saturates to `weeks[0]`** when today is before the plan (its fallback looks for the last week `≤ today`; when every week is in the future there is none, so it returns the first). `getCurrentWeekIndex()` therefore reads "week 1" for a plan that has not begun, and the push maps today's weekday onto week 1.

The audit found this is a **class**, not a single bug:

- **Only one end is guarded.** `isPlanComplete()` guards *after-end*; nothing guarded *before-start*.
- **Two send paths select by day-of-week alone** (`send-daily`, `pre-session-readiness`) rather than confirming the week's date window actually contains today.
- **No single predicate** for "is there a real planned session on calendar date D?" — the logic is re-derived in five places, two of them wrongly.

This is exactly the failure §73 warns about: temporal position reasoned about with an index (`getCurrentWeekIndex`) that saturates, instead of a date-window predicate.

## Decision

**One canonical resolver owns "what is active on calendar date D": `getSessionForDate(weeks, date, overrides)` in `lib/plan.ts`.**

It locates the week whose 7-day window **contains** `date` (never the saturating fallback), applies move/swap overrides, and returns the effective session — or **`null`** when there is genuinely nothing: before the plan starts, after it ends, in a between-week gap, or on an empty day. It keys by canonical `week.n` (ADR-013), so it is correct for standalone maintenance plans whose array restarts at index 0.

A companion predicate `isDateBeforePlan(weeks, date)` is the missing counterpart to `isPlanComplete` — the explicit before-start guard.

### Send-gating rule

**No scheduled send (push, email, digest) may fire without an active plan AND a real session for the target calendar date** (INV-TIME-001). Every send/derive path gates on `getSessionForDate(...) !== null`. `null` means "do not send / show the empty state" — a caller may **never** fall back to `weeks[0]`.

The gate only ever *suppresses* sends that should not happen — a fail-safe direction, so wiring it cannot cause a wrong send.

### What does NOT change

`getCurrentWeek()` / `getCurrentWeekIndex()` keep their saturating behaviour — it is correct for the "show me the nearest week" UI surfaces (an over-plan runner should still see their last week). They are simply no longer trusted as a **send/derive gate**; that job moves to the date-aware resolver. Per §73 the index must never be used for in-flight-vs-done reasoning.

## Consequences

- The before-start push (and its siblings in `pre-session-readiness`, `weekly-report`, and any other day-of-week derivation) are closed by one predicate at every send site, not patched individually.
- One place to reason about "active session for date D"; five ad-hoc derivations collapse onto it.
- New invariant **INV-TIME-001** added to the `zona-architectural-principles` skill: no user-facing session may be derived by weekday alone, and no scheduled send may fire without the active-plan + real-session gate — with a pre-ship checklist item.
- Phased rollout: Phase 1 lands `isDateBeforePlan` + `getSessionForDate` + tests additively. Phase 2 wires the gate into all five send/derive paths and replaces the two day-of-week-only lookups.
