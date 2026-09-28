'use client'

// CHARITY-CODE-CONTROL-01 (Design Board, 2026-09-28) — the one in-app code-redemption
// control, in one component, for all three placements.
//
// ── WHAT IT REPLACED ────────────────────────────────────────────────────────
// Three hand-rolled links, each opening `RedeemCodeScreen`: a text field where the
// runner typed a code we issued from our own database. 🔴 That is Apple Guideline
// **3.1.1** — unlocking paid functionality with a licence key redeemed outside IAP — and
// it had been redeemed **once, ever**, against two Apple offer-code redemptions in a
// single afternoon, both by URL before the app was even installed.
//
// This calls `presentCodeRedemptionSheet()` instead: Apple's own sheet, already compiled
// into the shipped binary (plugin pinned `^13.1.1` since 2026-05-15). Generic by
// construction, so the same control serves charity codes, ambassador codes and discounts
// with no further build.
//
// ⚠️ THE MODAL EXEMPTION IS A RULING, NOT AN EXCEPTION SOMEONE APPROVED.
// `ux-principles.md` § No popups says *"all interactions navigate to a full screen;
// modal overlays only for destructive confirmations, never for information"*. Apple's
// sheet is a non-destructive modal. The board amended the rule by name to carve out
// **OS-owned** sheets, on the grounds that we control neither their content nor their
// dismissal, so the rule cannot bind them. It does not license one of ours.
//
// 🔴 AND THE SHEET TELLS US NOTHING. `presentCodeRedemptionSheet(): Promise<void>`.
// No success, no cancellation, no error. Wroblewski's blocking condition: without a
// re-check afterwards the sheet closes, the screen is unchanged, and the runner taps it
// again assuming it failed. `onAfterSheet` is that re-check — `__rcIdentify` then the
// reconcile route, both built this morning for exactly this shape of problem.

import { useState } from 'react'
import { Capacitor } from '@capacitor/core'
import Button from '@/components/ui/Button'
import { REDEEM_CODE_LABEL, type AfterSheet } from '@/lib/subscriptions/redeemCode'

interface Props {
  /** Re-checks entitlement once the sheet closes. Resolves true if one was found. */
  onAfterSheet: AfterSheet
  /** Layout only. The type, colour and weight are this component's. */
  style?: React.CSSProperties
}

export function RedeemCodeLink({ onAfterSheet, style }: Props) {
  const [busy, setBusy] = useState(false)

  // Web has no StoreKit receipt and therefore no sheet to present. Rendering a control
  // that cannot work is worse than rendering nothing, and `empty means calm, not broken`
  // is the documented reading of an absent element here.
  if (!Capacitor.isNativePlatform()) return null

  async function present() {
    if (busy) return
    setBusy(true)
    try {
      const { Purchases } = await import('@revenuecat/purchases-capacitor')
      await Purchases.presentCodeRedemptionSheet()
      // The sheet is dismissed by the time this resolves. We do not know the outcome, so
      // we ask the server rather than assuming either way.
      await onAfterSheet()
    } catch {
      // ⚠️ SILENT ON PURPOSE, AND IT IS A DESIGNED STATE RATHER THAN AN INHERITED ONE.
      // The failure modes are "the runner cancelled" and "there was nothing to find",
      // which are the common cases and are not problems. A toast here would fire mostly
      // at people who changed their mind. A genuine redemption that our check misses is
      // recovered on the next app open, because the same check runs on mount.
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button
      variant="quiet"
      onClick={() => void present()}
      disabled={busy}
      style={{ fontSize: 'var(--fs-caption)', ...style }}
    >
      {busy ? 'Checking…' : REDEEM_CODE_LABEL}
    </Button>
  )
}
