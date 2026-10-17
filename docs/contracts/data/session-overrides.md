# Contract — `session_overrides` and the effective week

**Owner of the read:** `lib/plan/effectiveSessions.ts → resolveEffectiveSessions(week, weekOverrides)`.
**Owner of a move:** `lib/plan/overrideMoves.ts → planMove()`. **Writer:** `PlanCalendar` (`handleMove`, `handleSwap`).
**Written 2026-10-17** (SESSION-SLOTS-01 Phase 0), before any slot code, per GOV-006.

## Table (today)

`session_overrides (user_id, week_n, original_day, new_day, updated_at, superseded_at)`

- One live row per `(user_id, week_n, original_day)`: **a convention only**. There is no unique key; the writer keeps
  it by deleting before inserting (`planMove().removedOriginalDays`). ⚠️ Phase 1 adds the key.
- `week_n` is the plan's `week.n` (ADR-013). `superseded_at` marks rows of a replaced plan (PLAN-WEEK-COLLISION-01);
  readers take `superseded_at IS NULL`.
- **A session keeps its ORIGINAL day as its identity.** Completions, run analysis, reflections and metric overrides key
  on `original_day`. The override changes only where the session is SHOWN.

## The effective week (today)

```ts
resolveEffectiveSessions(week, weekOverrides): Partial<Record<DayKey, { session; originalDay; isOverride }>>
```

- One session per shown day. A move onto an occupied day becomes a **swap** (the occupant takes the vacated day); if
  that is impossible the move is refused. Never drops a session (EFFSESS-COLLISION-01).
- **Every reader goes through it.** Today and Plan used hand-rolled copies that overwrote on a collision; both were
  removed 2026-10-17. Gate: `lib/plan/effectiveWeekOwner.test.ts` (no hand-placed session anywhere in the source).
- Readers that resolve one DATE use `getSessionForDate(weeks, date, overrides)` (ADR-016), and **must pass the live
  overrides** (READINESS-OVERRIDES-01). Callers: push send-daily, pre-session-readiness, the strength run context.

## Phase 1 target (ADR-025, not built)

- `new_slot text null check (new_slot in ('am','pm'))`; null keeps today's meaning. Unique key on
  `(user_id, week_n, original_day) WHERE superseded_at IS NULL`.
- `resolveEffectiveDay(...)`: `Record<DayKey, EffectiveSession[]>`, AM then PM; replaces `resolveEffectiveSessions`
  (removed, not kept beside it). `getSessionsForDate` replaces `getSessionForDate`.
- A slot is offered only for the doubles the Coaching Board allowed (`docs/decisions/same-day-doubles-coaching-2026-10-17.md`).
