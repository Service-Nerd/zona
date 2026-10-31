# Incident — an iPhone cancellation was recorded as a failed purchase and shown an error

**Date found:** 2026-10-31 · **Live since:** 2026-05-15 (`ef5a3c63`, the RevenueCat purchase flow) · **Triage:** Systemic
**Fix commit:** see `IAP-PURCHASE-FAILED-01` in the feature registry · **Catalogue class:** NEW — a typed field the native bridge never delivers

## Symptom

`analytics_events` held 4 `upgrade_purchase_attempt` and 4 `upgrade_purchase_result` = `failed` in 56 days, from 2
runners, and none ever `success`. Read as "every iPhone purchase fails". A runner who closed Apple's sheet was told
*"Something went wrong. Please try again."*

## What was actually wrong

`isUserCancelled` (`lib/analytics.ts`) read `err.userCancelled === true`. RevenueCat's TypeScript `PurchasesError`
documents that field. On iOS the plugin rejects with `call.reject(message, "\(code)", nsError)`
(`PluginHelperExtensions.swift:20`), passing no data, and Capacitor's bridge copies only `message`, `errorMessage` and
`code` onto the error (`native-bridge.js:953`). A cancel arrives as `{ code: "1" }`. So: cancel → `failed`, plus the
error message. And `failed` carried no code or message, so a real failure was indistinguishable from a cancel.

What the 4 were: runner 2 (27 Oct) had redeemed an Apple offer code 2 s earlier and tapped Subscribe on a year they
already owned (access fine). Runner 1 (5 Oct, 3 attempts of 11 s / 3 s / 7 s) has no purchase in RevenueCat; cancel or
failure cannot be told now. The live offering is correct; the Paid Apps Agreement is active (founder, 2026-10-31).

## Why it survived

- **The test used the documented shape, not the delivered one.** `analytics.test.ts` asserted `{ userCancelled: true }`,
  which the type promises and the bridge never sends. The owner's own comment said both copies "reach the same verdict
  for RevenueCat's actual boolean" — the boolean was never actual on iOS.
- **No purchase has ever succeeded in production** (all 23 subscriptions are comped offer codes), so there was no
  `success` to compare against and `failed` looked like "the path is broken", not "the label is wrong".
- **The daily digest watched entitlements that failed to land, not purchase attempts**, so 8 weeks of `failed` were
  read by nobody.

## Blast radius

Upgrade screen only: subscribe and restore (2 call sites, one owner). No coaching, tier, schema or migration change.
Needs an app deploy (the web bundle the iOS shell loads). Not proven on a device: a TestFlight sandbox purchase and a
sandbox cancel are the verification.

## The fix

Cancel read from `code === "1"` as well; every native result carries `stage`; `failed` and the new `already_entitled`
carry `error_code` and `error_message`; a runner with an active entitlement after a store error sees the success screen.
Test fixtures use the bridged shape (falsified: the old rule turns two tests red). Digest: failed purchase attempts are
now reported.
