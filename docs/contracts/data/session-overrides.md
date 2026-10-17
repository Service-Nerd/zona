# Contract — `session_overrides` and the effective week

**Owner of the read:** `lib/plan/effectiveSessions.ts → resolveEffectiveDay(week, weekOverrides)` (was `resolveEffectiveSessions`, removed at ADR-025 Phase 1).
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

## The effective week (Phase 1, built 2026-10-17)

```ts
resolveEffectiveDay(week, weekOverrides): Partial<Record<DayKey, { session; originalDay; isOverride; slot }[]>>
getSessionsForDate(weeks, date, overrides): ResolvedSession[]   // [] = nothing to show / do not send (ADR-016)
soleSession(list): T | undefined                                  // the day's one session, for a caller not yet taught about two
```

- **Phase 2 (built 2026-10-17):** a move with `new_slot` onto an occupied day becomes a **double** only when §126
  allows it (`lib/plan/doubles.ts → canDouble`: both runs easy or recovery; never the long run, quality/structured,
  race or 5K time trial; never race week). The mover takes its slot, the occupant the other half, and the mover's own
  day is left empty. A forbidden slotted move behaves exactly like an unslotted one (a swap). Never three on a day.
  Check: `CHECK-EFFECTIVE-NO-HARD-DOUBLE` (`plan-invariants.md` § Effective-week invariants).
- **No writer yet.** Nothing sets `new_slot` until the Phase 3 move flow, and `doubles.test.ts` fails if anything does
  before then, because the 8 `soleSession()` readers would drop the second session.
- **Every single-session read is a named `soleSession()` call**, counted (9 at Phase 1, 8 at Phase 2) and the count may only fall:
  Phase 4 teaches each caller about two sessions. The push's next-key-session scan already walks every session.

- One session per shown day. A move onto an occupied day becomes a **swap** (the occupant takes the vacated day); if
  that is impossible the move is refused. Never drops a session (EFFSESS-COLLISION-01).
- **Every reader goes through it.** Today and Plan used hand-rolled copies that overwrote on a collision; both were
  removed 2026-10-17. Gate: `lib/plan/effectiveWeekOwner.test.ts` (no hand-placed session anywhere in the source).
- Readers that resolve one DATE use `getSessionsForDate(weeks, date, overrides)` (ADR-016), and **must pass the live
  overrides** (READINESS-OVERRIDES-01). Callers: push send-daily, pre-session-readiness, the strength run context.

## Phase 1 data (migration `20261018_session_overrides_slot.sql`, ⚠️ NOT YET APPLIED)

- `new_slot text null check (new_slot in ('am','pm'))`; null keeps today's meaning. Unique key
  `session_overrides_live_key (user_id, week_n, original_day) WHERE superseded_at IS NULL` (measured before: 7 live rows,
  0 duplicate keys). Nothing writes `new_slot` until Phase 3.
- A slot is offered only for the doubles the Coaching Board allowed (`docs/decisions/same-day-doubles-coaching-2026-10-17.md`).
