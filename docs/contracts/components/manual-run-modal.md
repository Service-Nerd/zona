# `ManualRunModal` — contract

**Component:** `components/dashboard/ManualRunModal.tsx`

The hand-logging sheet: a run the runner types in rather than one that arrived from HealthKit or
Strava. **4 importers.**

⚠️ **Written 2026-11-15 (`CONTRACT-COVERAGE-03`, highest reach first).**

🔴 **THE NAME IS A MISNOMER AND IT READS AS A DOCTRINE VIOLATION.** This is not a modal. Its
whole body is wrapped in `<Sheet onClose={requestUnmount} maxHeightVh={90} ariaLabel="Log a
run">` — a slide-up sheet with the mirrored bottom nav bar `ui-patterns.md` requires. CLAUDE.md
§ UI Principles says *"No popups — modals only for destructive confirmations (delete, disconnect),
never for information"*, so anyone grepping `components/` for `Modal` finds a name that
contradicts the rule and an implementation that honours it. **The name is kept** because
`DASHBOARD-SCREEN-EXTRACT-02` lifted this file verbatim out of `DashboardClient.tsx` and its
consumers carry the same word (`showManualModal`, `manualAccumulate`); renaming is a separate
commit so the move stays a move. Recorded here rather than left as a trap.

## Prop interface

```typescript
interface ManualRunModalProps {
  weekN: number
  sessionKey: string | null
  preferredUnits: 'km' | 'mi'
  onClose: () => void
  onSaved: () => void
  sessionName?: string
  sessionType?: string
  plannedDistanceKm?: number
  plannedDurationMins?: number
  loggedDistanceKm?: number
  isEdit?: boolean
  accumulate?: boolean
  existingTotalKm?: number
  existingEffortCount?: number
  offPlan?: boolean
  sessionDate?: string | Date | null
}
```

⚠️ Declared inline; the name above is the contract's, for the prop-for-prop gate.

## Three logging modes, and they are not variants of one form

| Mode | Set by | What the entered distance means |
|---|---|---|
| first log | neither `isEdit` nor `accumulate` | pre-filled from `plannedDistanceKm`, raw |
| correct a log | `isEdit` + `loggedDistanceKm` | pre-filled from the stored km, converted to the runner's unit |
| another effort | `accumulate` + `existingTotalKm` | starts at **zero** and is ADDED to the total (`DS-07` Part B) |

`existingEffortCount` defaults to 1 and counts efforts already on the session.

## Invariants

1. 🔴 **`sessionDate` IS WHEN THE RUN HAPPENED, NOT WHEN IT WAS TYPED** (`LOAD-DEDUPE-MANUAL-01`).
   The ingest call used to stamp `new Date().toISOString()`, so a Monday run logged on Wednesday
   was recorded as a Wednesday run — and everything reading `start_date` inherited that:
   `bucketLoadByPlanWeek` could file it in the wrong PLAN WEEK, and the §58 cohort and the pace
   trend ordered it wrongly. Measured on production: two 7.5 km logs entered in one sitting for
   `week_1 mon` and `week_1 wed` carried the same timestamp, which is what made them look like
   one duplicated run. ⚠️ **Optional, and it falls back to now, deliberately** — an off-plan log
   genuinely has no session date, and a caller that cannot supply one must still be able to log.
2. 🔴 **`offPlan` WRITES THE ACTIVITY ROW ONLY — no completion, no scoring** (`LOG-OFFPLAN-02`).
   That is not a shortcut: an off-plan run has no prescription to be scored against.
   `session_completions` is keyed `(user_id, week_n, session_day)` — a plan coordinate — so a run
   with no session day had no slot at all, and the save path's `sessionKey ?? todayKey` bound
   every manual log to a prescribed day whether or not one was meant. On a rest day
   `showSessionHero` is false, so **no control rendered at all: 4 of 7 days on a 3-day plan.**
   `LOG-OFFPLAN-01`'s owner reads this shape as `offPlanKm`, so the run reaches actual load and
   shadow load and never the auto-trimming ratio.
3. **The write goes through the single ingestion gateway.** `/api/health/ingest` with
   `source: 'manual'` for the activity row, `upsertCompletion` for the completion. Direct
   `.insert()` on `strava_activities` from here would be an `INV-DATA-008` violation (ADR-011).
4. **`preferredUnits` is a prop, not a hook** — settings are fetched once at `DashboardClient`
   level (CLAUDE.md § Global State Pattern). The stored value is always km; the conversion is at
   the boundary, both directions.
5. **`onSaved` is required, `onClose` is required**, and they are different events: a save must
   refresh the parent, a dismissal must not.
6. **No hardcoded colour, no hardcoded font.** `getSessionColor(session)` resolves the accent —
   never `SESSION_COLORS[type]`, which cannot produce `--s-long`.

## Pattern

`ui-patterns.md` § Sheet. Rulings: `DS-07`, `LOG-OFFPLAN-01`/`-02`, `LOAD-DEDUPE-MANUAL-01`,
`DASHBOARD-SCREEN-EXTRACT-02`.
