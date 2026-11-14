# `POST /api/charity/redeem` — RETIRED 2026-11-14

**Route:** `/api/charity/redeem` — **deleted.** This file is the record, not a contract.

`REDEEM-SCREEN-UNREACHABLE-01`. The route's only caller was `app/dashboard/RedeemCodeScreen.tsx`,
which nothing could open: no code set `screen = 'redeem'`.

## Why it went, and why that is not a loss

`CHARITY-CODE-CONTROL-01` (Design Board 2026-09-28, on a founder instruction) replaced three
hand-rolled Supabase code fields with one control calling Apple's `presentCodeRedemptionSheet()`.
That retired the Apple 3.1.1 exposure, and the field it removed had been redeemed **once, ever**,
against two Apple offer-code redemptions in a single afternoon.

🔴 **Apple's sheet redeems an Apple OFFER CODE, not a `charity_codes` row.** So from 2026-09-28 the
Supabase mechanism had no entry point, which is why the goodwill batch issued on 2026-10-07 was
revoked the same day with *"no redeem path available"*.

## What replaced it

**App Store Connect → Offer Codes.** All 24 live paid accounts came that way, every one
`is_comped`, provider `revenuecat`. The runner redeems in the App Store; the RevenueCat webhook
writes `subscriptions`; `resolveTier` returns `reason: 'subscription'`.

Live surfaces: `REDEEM_CODE_PLACEMENTS` in `lib/subscriptions/redeemCode.ts` (the wizard's last
step, Upgrade, Me) → `RedeemCodeLink` → Apple's sheet.

## What is still live, and must not be swept with it

| Kept | Read by |
|---|---|
| `lib/charity/grantWindow.ts` | `lib/trial.ts` (`resolveTier`'s `grant` branch), `app/charity-runners/page.tsx` |
| `lib/charity/reanchor.ts` | `lib/plan.ts` |
| `charity_codes` / `charity_batches` | **one runner holds a claimed grant** |

🔻 `GTM-CHARITY-07` — *a seat is spent when it was CLAIMED* — had its enforcement in this route's
claim gate. The ruling still holds (`claimed_at` survives account deletion by founder decision,
`CHARITY-CLAIM-RELEASE-01`) but **nothing enforces it while nothing can redeem.** If the door is
rebuilt, that gate comes back with it.

Gate: `lib/charity/supabaseRedeemRetired.test.ts` — the dead path stays dead and the live path
keeps its three placements.
