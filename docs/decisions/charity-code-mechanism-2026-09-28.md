# Charity code mechanism — SLT and Design Board, 2026-09-28

Two sittings on one day, plus a founder override. Recorded because the Design Board
requires a decision note and because the SLT's ruling was partly reversed within the hour.

---

## Context established first

The Apple offer-code path was proven end to end that afternoon: two independent Apple IDs,
two unrelated emails, entitlement in `subscriptions` nine seconds after sign-up, after four
defects were found and three fixed (`SUBS-CANCELLATION-TIER-01`, `SUBS-RECONCILE-RACE-01`,
`SUBS-RECONCILE-TRIAL-GATE-01`).

That created **two mechanisms for one job**:

| | Supabase grant (GTM-CHARITY-04) | Apple offer code |
|---|---|---|
| Window | race-anchored, re-anchored on plan save, 18-month ceiling | flat, fixed at creation |
| Cap | `charity_batches.cap` | Apple's redemption limit |
| Revocable | ✅ `revoked_at` | ❌ never |
| Codes | CSV of **unique** codes | **one shared** string |
| Writes | `charity_codes`, never `subscriptions` | `subscriptions` via reconcile |
| 3.1.1 in-app | non-compliant | compliant |
| Redemptions ever | **1** | **2** |

## SLT — `CHARITY-CODE-MECHANISM-01`

**Ruled:** Apple offer codes are the partner mechanism. Fix `v_trial_conversion` before
1 January. Keep `FIRSTRUN-MOMENTS-01f` alive. **Remove all three in-app doors and add
nothing** (Wood's kill mandate, on structural grounds). Keep the Supabase grant machinery
entry-point-free for deferrals. One offer code per partner, never shared across partners.
**Ambassadors: don't build.** `/charity-runners` copy → founder.

Two consequences nobody had priced until they were written down:

- 🔴 `FIRSTRUN-MOMENTS-01f` ("you are one of 500") reads `charity_codes` joined to
  `charity_batches`. An Apple-code runner has no such row, so the card never renders **for
  the exact cohort it was built for.**
- 🔴 `v_trial_conversion` would count 500 free runners as 500 paying conversions.

**Traynor's recall trigger is met.** His seat is stood down, so nobody at that table prices
churn or conversion — and this item turns on a redeemed-code funnel, which is literally the
trigger recorded for bringing him back.

## Founder override

> *"I want the redeem code to be at end of wizard for setup but before plan and I want it
> on profile page (that's if we are doing this)."*

Overturns the SLT's "add nothing". ⚠️ **And it improves on it:** Wood's objection was that
an in-app field requires the runner to remember they hold a code and find where to type it.
At the end of the wizard the app **asks**, so nothing has to be remembered. Her argument
was about Me.

## Design Board — `CHARITY-CODE-CONTROL-01` — SHIP WITH AMENDMENT

Six binding amendments; full register row in `design-rulings.md`. The two that were
findings rather than preferences:

1. **OS-owned sheets carved out of § No popups by name.** Apple's sheet is a
   non-destructive modal and hit the rule head on. The ground is that we control neither
   its content nor its dismissal. A sheet we build is still bound.
2. **A re-check after dismissal.** `presentCodeRedemptionSheet()` returns `Promise<void>`,
   so the control could not otherwise report anything.

🔴 **The settled-ground scan missed a test that forbade the change.**
`wizardDistanceGate.test.ts` existed to assert the opposite arrangement and its header
recorded the rejection with a mechanism. What defeats that mechanism is the locked marathon
tile routing to Upgrade, where the control was kept for an unrelated reason — so
reachability is a pair of facts, now asserted as a pair.

## Still open

| Item | Owner |
|---|---|
| Run the `SUBS-COMPED-CONVERSION-01` SQL, then ship its code half | founder, then me |
| `FIRSTRUN-MOMENTS-01f` cohort source | me, after the migration |
| `/charity-runners` three wrong steps | **founder** |
| The shared string's words | **founder** |
| Ambassadors | **don't build** until the funnel has numbers |
