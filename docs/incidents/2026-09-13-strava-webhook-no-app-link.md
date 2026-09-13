# Incident — auto-link/analysis stopped firing without opening the app

**Date found:** 2026-09-13 · **Live since:** ~2026-09-10 (GTM-SITE-01) for the analysis half; unknown for the delivery half · **Triage:** Systemic
**Fix commit:** `<this commit>` · **Catalogue class:** *Checker/caller reads a different source* (env removed out from under one caller) + a NEW class: **Untooled external subscription** (see below)

> Founder-reported (`/debug`): a 12k Garmin→Strava run only linked/was read by Kit
> once the app was opened. It previously auto-linked with the app closed, and should
> also be triggerable by pull-to-refresh on Today.

## Symptom

The run reached Strava but did not link to the planned session, was not analysed, and
sent no link-push until the app was opened — at which point `syncOnAppOpen()` linked it.

## What was actually wrong (what code can prove)

There are **three** paths to a no-app / on-open link, and they must be separated:

1. **`getInternalBaseUrl()`** (`lib/coaching/autoAnalyse.ts`) — the server→server base
   both the Strava webhook AND the HealthKit-ingest route use to call `/api/analyse-run`
   — still read the **removed** `NEXT_PUBLIC_APP_URL`, then fell back to the
   per-deployment `VERCEL_URL` / localhost. GTM-SITE-01 (2026-09-10) removed that env
   var and made the committed `?? 'https://www.zonna.run'` the single source of truth
   across 8+ metadata surfaces — and **missed this one helper.** So since 2026-09-10 the
   background *analysis* call on both ingest paths pointed at a deployment-protected /
   non-canonical host. **Fixed here** (`?? (VERCEL ? 'https://www.zonna.run' : localhost)`),
   guarded by `autoAnalyseBaseUrl.test.ts`. NB this breaks *analysis*, not the *link* —
   the link is a direct DB write in `claimAutoLink`, independent of this URL.

2. **Strava webhook delivery** (external state, not in the repo). The link not happening
   at all points here: if the webhook POST reached us, the upsert + `claimAutoLink` would
   have linked the run and fired the link-push regardless of (1). The subscription's
   `callback_url` is registered at Strava, not in our code, and **we had no tooling to
   inspect it.** The prime suspect is the same www-canonical migration: if the callback
   was the apex (`zonna.run/...`), it now **307-redirects**, Strava does not follow
   redirects, and after repeated non-2xx deliveries Strava deletes the subscription.
   **Now inspectable:** `npx tsx scripts/strava-webhook-subscription.ts` (view/register/
   delete; callback is pinned to the www canonical).

3. **HealthObserver background wake** (native). The committed `packageClassList`
   correctly lists `HealthObserverPlugin`, so the config is not the cause in-repo; any
   failure here is device-level (Garmin→Apple Health not enabled, or a local build that
   ran raw `cap sync`). Not diagnosable from here.

**Pull-to-refresh already works:** `handleRefresh` calls `syncOnAppOpen()` on native
(`DashboardClient.tsx:2136`), the same path app-open uses — so a drag-down on Today does
trigger the link. The user's second ask was already satisfied.

## Why it survived

- **(1) An env var removed out from under one caller.** GTM-SITE-01 swept the URL
  surfaces it could see (metadata, sitemap, JSON-LD) and this server-only helper was not
  in that mental set. Silent because the analyse-run call is fire-and-forget in a
  `try/catch` that only `console.warn`s — a failed background analysis has no user-facing
  error, and the link still worked on app-open, masking it.
- **(2) NEW class — Untooled external subscription.** The Strava webhook subscription is
  the single point that makes no-app linking work, and there was **no way to see it**: no
  script, no ops_event on webhook hit, no alert on delivery failure. External state with
  zero observability breaks invisibly and stays broken until a human notices runs aren't
  linking. Added to the silent-failure catalogue.

## Fix + follow-ups

- Fixed (1) at the single owner; regression test pins the www default on Vercel.
- Added the subscription inspection/repair script for (2).
- Filed **STRAVA-WEBHOOK-OBS-01**: record an `ops_event` on every webhook hit + a daily
  probe that flags "no webhook delivery in N hours", so a dead subscription is visible
  within a day (the same pattern `ops-cron-plan-audit` uses for stored plans).

## Verification (honest)

Fixed and tested: (1) the base-URL regression. Confirmed from the committed repo: (3) the
native plugin list is correct. **Not verifiable from here:** whether the Strava
subscription currently exists and where its callback points (2) — run the new script
against production to confirm, and re-`register` if the callback is stale/apex. Whether
the founder's run also went to Apple Health (would have exercised path 3) is unknown.
