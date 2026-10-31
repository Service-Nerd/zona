# KitReceipts

**Component:** `components/shared/KitReceipts.tsx`

`COACH-KIT-CAUGHT-01` (boards 2026-10-31). The runner's own receipts from `kitReceipts` (§133), on free Coach and the
Upgrade screen.

## Props

```ts
interface Props {
  receipts: KitReceipt[]
  title?: string
  meta?: string
  children?: ReactNode
}
```

| Prop | Type | Meaning |
|---|---|---|
| `receipts` | `KitReceipt[]` | `{ tone: 'held' \| 'drifted'; lead: string; text: string }`, at most 3. Empty renders nothing |
| `title` | `string` | Eyebrow; defaults to `What ${BRAND.coachName} caught`. The Upgrade screen passes *"In your trial, …"* |
| `meta` | `string` | Right-hand eyebrow (free Coach: `last 2 weeks`) |
| `children` | `ReactNode` | Footer under a hairline (free Coach: what Pro adds, and the buy button) |

## Consumers

`components/dashboard/CoachTeaser.tsx` (free Coach, and a paid runner with no current week, where `showUpgrade` is
false) · `app/dashboard/UpgradeScreen.tsx` (`receipts`, `inTrial` props, above the feature list) ·
`app/coach-preview/page.tsx` (`data-harness="kit-caught"`). Data: `DashboardClient` computes `receipts` once for every
tier, beside `effortRuns`.
