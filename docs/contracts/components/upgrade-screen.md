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

## Order of the two price cards (`ACT-PAYWALL-01`, Design Board 2026-11-12)

**The annual option is FIRST in the DOM**, monthly second. It was the other way round, and the only
thing giving annual precedence was the saving badge pinned above it — 📱 Wroblewski: *"two equal
cards in a left-to-right row: the left one is read first"*; ✋ Silvanto: *"care should be visible in
the thing, not applied on top of it."* The badge is kept and now confirms the choice rather than
carrying it.

⚠️ **The order is a DECISION and a reorder is invisible in a diff summary** — no new string, no new
token. `lib/subscriptions/paywallOrder.test.ts` reads it, and also asserts the saving badge stays on
the annual card and that **no price is typed into the component** (every figure from `BRAND.PRICING`,
ADR-015 / INV-CFG-001).

## Consumers

`app/dashboard/DashboardClient.tsx` · `app/coach-preview/full/page.tsx`.
