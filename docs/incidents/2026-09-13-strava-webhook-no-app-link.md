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

3. **HealthObserver background wake** (native) — the **SOR path**, and the one to state
   correctly. HealthKit is the SOR (ADR-011), but its no-app wake
   (`HealthObserverPlugin` → `syncOnAppOpen`) **only fires foreground/warm-background**.
   A **fully-killed app cannot background-ingest** — the `HKObserverQuery` callback fires
   but there is no JS runtime to receive it, so the run is picked up on next cold-start
   open (documented `HealthObserverPlugin.swift:24-26`). That is the founder's exact case
   (run ends, phone pocketed, app killed). The committed `packageClassList` is correct, so
   this is not a repo defect — it is an **architectural limit of the SOR on iOS**.

   **The doctrine consequence (now added to CLAUDE.md):** because the SOR cannot link a
   killed-app run in the background, the **only** device-independent auto-link for that
   (common) case is the **Strava webhook** — path 2. Strava remains the *supplement*, not
   a second SOR: the webhook consolidates onto the HealthKit row (`tryEnrichHealthKitRow`)
   and only stores a Strava-canonical row when no HK row exists. So the founder's "it used
   to auto-link with the app closed" was almost certainly the **Strava webhook** doing it,
   which is why its (external) breakage produced the regression — not a failure of the SOR.

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

---

## ⚠️ ROOT CAUSE FOUND, 2026-09-13 (later the same day) — the Strava APPLICATION is Inactive

Running the subscription check for the first time with **production** credentials
(`vercel env pull` into a scratch file, read-only `view`), Strava answered:

```
403 Forbidden
errors: [ { resource: 'Application', field: 'Status', code: 'Inactive' } ]
```

Not "no subscription" — **the application itself is inactive at Strava's end.** In
that state no push subscription can exist or deliver at all, so the no-app
auto-link path is completely dead. This is a precise match for the reported
symptom, *"runs only link when I open the app"*: HealthKit's observer cannot fire
into a killed app, and the webhook that would otherwise cover that case was never
going to arrive.

**Note the first local attempt returned 401, not 403.** The `STRAVA_CLIENT_SECRET`
in `.env.local` is corrupted (43 characters, non-ASCII final byte), so the local
check reported a credentials error and would have sent someone looking in the
wrong place. The production secret is intact. **Do not diagnose this from
`.env.local`.**

### What this changes

- **Founder action, and it cannot be done from this repo:** reactivate the
  application in the Strava developer settings. Most likely tied to the pending
  API approval (the backlog already records the open condition as *external*).
  Until then, `register` will keep failing and no amount of repo work restores the
  killed-app auto-link.
- **The probe was rebuilt around this.** Its first version returned HTTP 502 on
  any non-OK Strava response — it would have failed the cron loudly and recorded
  **nothing about why**. `judgeApiFailure()` now classifies 401/403 as
  `app_inactive` and writes it to `ops_events` with the remedy attached, because
  an authorization failure is the one state a deploy can neither cause nor fix.
- **A live 403 is why the heartbeat matters.** With the application inactive there
  will be zero `strava_webhook_received` events, so the silence check would also
  fire — deliberately suppressed while the subscription check is already failing,
  so the same finding is not written twice.

