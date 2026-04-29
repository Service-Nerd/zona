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
- Sessions can be moved via a drag handle (≡ icon). Move mode shows "tap a day to move" hint and highlights valid target slots.

## Supabase Writes

`PlanCalendar` writes session overrides directly to Supabase:

```
session_overrides.delete where user_id = userId AND week_n = weekN AND (original_day OR new_day match)
session_overrides.insert { user_id, week_n, original_day, new_day, updated_at }
```

After writing, calls `onOverrideChange` to update parent state. The parent (`DashboardClient`) is the source of truth for `allOverrides`.

## Known Issues

- `allCompletions` values are typed as `any` — should be `Completion`. Tech debt.
- `TYPE_ACCENT` colour map in `PlanCalendar` is a local duplicate of `session-types.ts`. Violates D-16. Should be removed and replaced with a call to `session-types.ts`. Tech debt.
