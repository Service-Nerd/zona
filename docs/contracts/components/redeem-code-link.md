# `RedeemCodeLink` — contract

**Component:** `components/shared/RedeemCodeLink.tsx`

The one in-app code-redemption control, for all three placements. **4 importers**
(`UpgradeScreen`, `GeneratePlanScreen`, `DashboardClient`, `MeScreen`).

⚠️ **Written 2026-11-15 (`CONTRACT-COVERAGE-03`, highest reach first).**

## Prop interface

```typescript
interface Props {
  onAfterSheet: AfterSheet
  style?: React.CSSProperties
}
```

`style` is **layout only** — the type, colour and weight are this component's.

## Invariants

1. 🔴 **IT REPLACED THREE HAND-ROLLED LINKS INTO AN APPLE 3.1.1 VIOLATION**
   (`CHARITY-CODE-CONTROL-01`, Design Board 2026-09-28). Each opened `RedeemCodeScreen` — a text
   field where the runner typed a code we issued from our own database, which is unlocking paid
   functionality with a licence key redeemed **outside IAP**. It had been used **once, ever**,
   against two Apple offer-code redemptions in a single afternoon, both by URL before the app was
   even installed. ⚠️ **That screen no longer exists**: retiring it was `REDEEM-SCREEN-UNREACHABLE-01`
   (2026-11-14), and this component is why it could go — the doors were already gone.
2. ✅ **IT CALLS `presentCodeRedemptionSheet()` — APPLE'S OWN SHEET**, already compiled into the
   shipped binary (`@revenuecat/purchases-capacitor` pinned `^13.1.1` since 2026-05-15). Generic
   by construction, so the same control serves charity codes, ambassador codes and discounts with
   no further build.
3. ⚠️ **THE MODAL EXEMPTION IS A RULING, NOT AN EXCEPTION SOMEONE APPROVED.**
   `ux-principles.md` § No popups says *"all interactions navigate to a full screen; modal
   overlays only for destructive confirmations, never for information"*. Apple's sheet is a
   non-destructive modal. The Design Board amended the rule **by name** to carve out **OS-owned**
   sheets, on the grounds that we control neither their content nor their dismissal, so the rule
   cannot bind them. **It does not license one of ours.**
4. 🔴 **THE SHEET TELLS US NOTHING — `presentCodeRedemptionSheet(): Promise<void>`.** No success,
   no cancellation, no error. Wroblewski's blocking condition: without a re-check afterwards the
   sheet closes, the screen is unchanged, and the runner taps it again assuming it failed.
   **`onAfterSheet` is that re-check** (`__rcIdentify` then the reconcile route) and it is
   **required, not optional** — a caller that cannot re-check must not render this control.
5. ⚠️ **WEB RENDERS NOTHING, AND THAT IS THE DOCUMENTED READING.** No StoreKit receipt means no
   sheet to present, and rendering a control that cannot work is worse than rendering nothing —
   *"empty means calm, not broken"* (CLAUDE.md § UI Principles). 🔴 **`useState` IS CALLED BEFORE
   THE `Capacitor.isNativePlatform()` RETURN, AND THAT ORDER IS THE INVARIANT** — it is what
   makes the hook count the same on both platforms. ⚠️ This contract first said the return came
   *before* any hook, which is both false and the opposite of the rule: implementing it as
   written makes the count conditional and trips React error 300 the moment the platform check
   flips. `TrendCard`'s `HOOKS-ORDER-01` is the same rule, paid for once already.
6. ⚠️ **THE CATCH IS SILENT ON PURPOSE, AND IT IS A DESIGNED STATE RATHER THAN AN INHERITED ONE.**
   The failure modes are *"the runner cancelled"* and *"there was nothing to find"* — the common
   cases, and not problems. A toast here would fire mostly at people who changed their mind. A
   genuine redemption our check misses is recovered on the next app open, because the same check
   runs on mount.
7. **The label comes from `REDEEM_CODE_LABEL`**, not a literal — one string for all three
   placements.
8. **The plugin import is dynamic** (`await import('@revenuecat/purchases-capacitor')`), so the
   web bundle never pulls StoreKit.

## Pattern

`ui-patterns.md` § Button (`variant="quiet"`). Ruling: `CHARITY-CODE-CONTROL-01`.
Related: `REDEEM-SCREEN-UNREACHABLE-01`.
