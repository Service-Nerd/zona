# Runbook — prove an iPhone purchase works end to end (IAP-PURCHASE-FAILED-01)

**Why:** no paid in-app purchase has ever succeeded in production (all 23 `subscriptions` rows are comped offer codes;
`upgrade_purchase_result` has never recorded `success`). The 2026-10-31 fix (`b496e737`) stopped cancellations being
recorded as failures and made every failure record its `stage` and Apple's `error_code`. It is live on Vercel; the iOS
app loads its code from `https://www.zonna.run/dashboard` (`capacitor.config.ts`), so **no new native build is needed**.

## Steps (founder, on a phone)

1. Install a **TestFlight** build (not expired: 90 days). TestFlight purchases use Apple's sandbox; nothing is charged.
2. iPhone Settings → App Store → **Sandbox Account**: sign in with the sandbox Apple ID (region UK).
3. Log into Zonna with a **test account**, not the founder's (his is admin with a seeded subscription and never reaches
   a real purchase).
4. Fully close and reopen the app so it loads the current code.
5. **Cancel test:** Me or Coach → Upgrade → Subscribe → close Apple's sheet. Expect: **no** "Something went wrong".
6. **Purchase test:** Subscribe → complete. Expect: **"You're in."**
7. Afterwards cancel the sandbox subscription (sandbox monthly renews every 5 minutes).

## What to check afterwards (read-only, from a session)

| Check | Where | Pass |
|---|---|---|
| Cancel recorded as a cancel | `analytics_events`, `event = 'upgrade_purchase_result'` | `outcome = 'cancelled'`, `stage = 'purchase'` |
| Purchase recorded | same | `outcome = 'success'` |
| Webhook landed | `subscriptions` for the test user | a `revenuecat` row, `status = 'active'`, `is_comped = false` |
| RevenueCat agrees | `GET https://api.revenuecat.com/v1/subscribers/<user id>` with `REVENUECAT_SECRET_API_KEY` (v1 legacy key; the v2 API refuses it) | an active subscription, sandbox |

If step 6 fails, the `failed` row now carries `stage` (`configure` / `offerings` / `package` / `purchase`) and
`error_code`. RevenueCat code **23** or an `offerings` stage points at App Store Connect (agreements, product status),
not the code (see the Apple IAP lessons memory). The Paid Apps Agreement was confirmed Active on 2026-10-31. The live
offering is correct: `default` → `$rc_monthly` (`zonna_premium_monthly`), `$rc_annual` (`zonna_premium_annual`).

## The digest

`docs/runbooks/digest-prompt-q9b-2026-10-31.txt` is the full daily-ops-digest prompt (routine last updated 2026-10-28)
with a new **Q9B**: purchase attempts that failed, succeeded, or found the runner already entitled. The SQL was run
against production (60-day window: returns the 4 pre-fix `failed` rows). **Paste it over the routine's prompt**
("Zonna daily ops digest"). **Not applied yet.**
