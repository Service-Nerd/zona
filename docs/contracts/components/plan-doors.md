# Contract — `PlanDoors` (`components/shared/PlanDoors.tsx`)

**Component:** `components/shared/PlanDoors.tsx`

**Ruling:** PLAN-DOORS-01, Design Board 6t-k (2026-10-22). The one owner of the two plan doors' faces.

## Exports

| Export | Props | Renders |
|---|---|---|
| `AdjustPlanDoor` | `onOpen: () => void` · `strengthAvailable: boolean` · `divider?: boolean` | `ActionRow` with `RowIcon name="run"`, title `ADJUST_PLAN_TITLE`, subtitle `adjustPlanSubtitle(strengthAvailable)` |
| `StrengthDoor` | `onOpen: () => void` · `subtitle: string` · `divider?: boolean` | `ActionRow` with `RowIcon name="dumbbell"`, title `STRENGTH_TITLE` |
| `PLAN_DOOR_GLYPH` | — | `{ run: 'run', strength: 'dumbbell' }` |

## Props (`AdjustPlanDoor`, the first export; `StrengthDoor` takes `onOpen`, `subtitle`, `divider`)

```ts
interface AdjustPlanDoorProps {
  onOpen: () => void
  strengthAvailable: boolean
  divider?: boolean
}
```

## Rules

- Rendered on Plan (`AdjustPlanDoor`), Me (both) and the Adjust screen (`StrengthDoor`). No surface hand-draws a plan
  door: `iconRule.test.ts` refuses an `ActionRow` titled with a door title outside this file.
- `strengthAvailable` is true exactly when the Adjust screen offers its Strength door (`strength.status` `none` or
  `ready`), so the subtitle never names something the runner cannot reach. Copy: founder, 2026-10-22.
- The callers own where Back goes: Strength opened from Adjust reopens Adjust (`'modify'` origin); Adjust opened from Me
  closes to Me. Held by `lib/ui/planDoorsReturn.test.ts`.
