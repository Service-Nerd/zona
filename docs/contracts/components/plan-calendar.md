# Contract — PlanCalendar Component

**Authority**: This document defines the prop interface and rendering contract for `components/training/PlanCalendar.tsx`. Any change to props or session tap shape must update this document in the same commit.

---

## Prop Interface

```typescript
interface Props {
  weeks: Week[]
  allOverrides: { week_n: number; original_day: string; new_day: string }[]
  allCompletions: Record<number, Record<string, any>>   // keyed by week number, then day
  onOverrideChange: (overrides: { week_n: number; original_day: string; new_day: string }[]) => void
  onSessionTap: (session: SessionTapPayload, weekN: number, weekTheme: string) => void
}
```

### SessionTapPayload (passed to onSessionTap)

```typescript
{
  key: string           // original day key (e.g. 'mon') — respects overrides
  day: string           // display label (e.g. 'Mon')
  title: string         // session.label
  detail: string        // session.detail ?? ''
  type: string          // session.type
  date: string          // formatted date (e.g. "5 Jan")
  rawDate: string       // ISO date string
  today: boolean
  completion: Completion | undefined
  isPast: boolean
  isFuture: boolean
  // Structured session fields — always pass through so SessionScreen renders
  // identically regardless of whether it was opened from Today or Plan.
  // catalogue_id/derived_set/label are what catalogueRowFor()/mainSetDescription()
  // need to resolve real main-set instructions — without them the detail screen
  // falls back to a generic "Quality main set." placeholder (D-08 bug, fixed
  // 2026-09-03; see lib/plan/sessionDetailPayload.test.ts for the regression test).
  label?: string
  catalogue_id?: string
  derived_set?: DerivedSet   // from lib/plan/resolveMainSet.ts
  zone?: string
  distance_km?: number
  duration_mins?: number
  primary_metric?: 'distance' | 'duration'
  hr_target?: string
  pace_target?: string
  rpe_target?: number
  coach_notes?: [string, string?, string?]
}
```

---

## Rendering Contract

- Past weeks are collapsed behind a "Load N past weeks" button. Shown when tapped.
- Current week is determined by `week.type === 'current'`. Highlighted with teal left border.
- Completed/deload_done weeks render at 50% opacity.
- Sessions are rendered in `mon–sun` order regardless of plan JSON key order.
- Overrides are applied before render: `original_day` sessions appear at `new_day` slots. Overridden slots show the moved session.
- Rest sessions and empty days render a rest label — they are not tappable.
- Sessions can be moved via a drag handle (≡ icon). Move mode shows "tap an empty day to move, or another session to swap" hint and highlights two kinds of target slots:
  - **Move target** (empty slot — rest day or undefined day): dashed teal outline, body text reads "Move here". On tap, the source session moves into the slot and the rest placeholder disappears.
  - **Swap target** (another non-rest, uncompleted, unskipped session): solid teal outline, source session label tinted teal with "tap to swap" hint and `⇄` glyph on the right. On tap, the two sessions exchange slots in one atomic write.
- Completed and skipped sessions never become targets in move mode.

## Supabase Writes

`PlanCalendar` writes session overrides directly to Supabase. Two flows:

**Move** (drop into an empty slot):
```
session_overrides.delete where user_id = userId AND week_n = weekN AND (original_day OR new_day match)
session_overrides.insert { user_id, week_n, original_day, new_day, updated_at }
```

**Swap** (exchange two non-rest sessions):
```
session_overrides.delete where user_id = userId AND week_n = weekN AND original_day IN (sourceOriginal, targetOriginal)
session_overrides.insert ≤2 rows — one per session whose new slot differs from its original day.
  A session "going home" (original_day equals its new slot) gets no override row.
```

Both flows then `POST /api/adjust-plan { fromDay: sourceOriginal, toDay: newSlot }` to trigger the hard/easy adjacency check (paid-only; route 403s for free users).

After writing, calls `onOverrideChange` to update parent state. The parent (`DashboardClient`) is the source of truth for `allOverrides`.

## Known Issues

- `allCompletions` values are typed as `any` — should be `Completion`. Tech debt.
- `TYPE_ACCENT` colour map in `PlanCalendar` is a local duplicate of `session-types.ts`. Violates D-16. Should be removed and replaced with a call to `session-types.ts`. Tech debt.
