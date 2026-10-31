# UpgradeScreen

**Component:** `app/dashboard/UpgradeScreen.tsx`

The paywall. COACH-KIT-CAUGHT-01 added the runner's receipts above the feature list; IAP-PURCHASE-FAILED-01 changed
how a purchase result is recorded (`docs/contracts/api/analytics-events.md`).

## Props

```ts
interface Props {
  onBack: () => void
  trialExpired?: boolean
  grantExpired?: boolean
  onRecheckEntitlement?: AfterSheet
  source?: UpgradeSource | null
  receipts?: KitReceipt[] | null
  inTrial?: boolean
}
```

| Prop | Meaning |
|---|---|
| `source` | Which door sent the runner here (`upgradeSourceCoverage.test.ts`) |
| `trialExpired` / `grantExpired` | Loss framing (`upgradeFraming`) |
| `onRecheckEntitlement` | Re-checks entitlement after Apple's code sheet closes |
| `receipts` | `kitReceipts(...)`; shown under the headline when non-empty |
| `inTrial` | Titles the receipts "In your trial, Kit caught" (also for `trial-ended`) |

## Consumers

`app/dashboard/DashboardClient.tsx` · `app/coach-preview/full/page.tsx`.
