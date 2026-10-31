# CoachTeaser

**Component:** `components/dashboard/CoachTeaser.tsx`

The free Coach screen (COACH-KIT-CAUGHT-01, 2026-10-31), and the screen a paid runner sees when their plan has no
current week (`coach_teaser_empty`).

## Props

```ts
interface Props {
  plan: Plan
  firstName?: string
  onUpgrade: () => void
  receipts?: KitReceipt[] | null
  effortRuns?: EffortRun[]
  showUpgrade?: boolean
}
```

| Prop | Meaning |
|---|---|
| `plan`, `firstName` | Header: `{firstName} · W{n} of {N}` |
| `onUpgrade` | Opens the Upgrade screen (source `coach_teaser` / `coach_teaser_empty`) |
| `receipts` | `kitReceipts(...)`; `null` while the activity log loads (skeleton); `[]` shows the fallback |
| `effortRuns` | `effortRecord(...)`, drawn free by `EffortRecord`; also tells the empty state whether the runner has HR runs |
| `showUpgrade` | `false` for a paid runner: hides the "That part is Pro" line and the buy button |

## Rendering

Risk warning (always, when the route returns it) · receipts card, or with none the free weekly insight, or
"Nothing yet." (copy depends on whether the runner has HR runs; hidden under a risk warning) · every run, by zone.

## Consumers

`app/dashboard/DashboardClient.tsx` (two sites) · `app/coach-preview/page.tsx` · `app/coach-preview/full/page.tsx` ·
`app/copy-preview/page.tsx`.
