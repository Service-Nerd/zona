# `POST /api/webhooks/strava` — Strava activity webhook

**Route:** `/api/webhooks/strava` (`app/api/webhooks/strava/route.ts`). `GET` answers Strava's subscription challenge.

## Behaviour (STRAVA-WEBHOOK-SOR-01, 2026-11-21)

Apple Health is the system of record for run data (founder, 2026-11-21; ADR-011 §3; INV-DATA-008).

| Event | Effect |
|---|---|
| any event | `strava_webhook_received` ops event (the silence probe's heartbeat), recorded in `waitUntil` |
| non-activity | `{ status: 'ignored' }` |
| activity create/update, a run, matching Apple Health row | `tryEnrichHealthKitRow` patches the Apple Health row (splits, temperature, suffer score, HR buckets) |
| activity create/update, no matching Apple Health row, and no row already carrying this id | **discarded**: nothing is stored, `strava_activity_discarded` ops event `{ reason: 'no_healthkit_match', strava_activity_id }` |
| activity create/update for an id a row already carries (an `update` or a redelivery) | nothing, and **no** event (STRAVA-SOR-REVIEW-FIX-03: these were recorded as false discards) |
| activity delete | `deleteStravaActivity`: removes a `source: 'strava'` row only; on an Apple Health row it reverts the patch through `revertHealthKitEnrichment` (Strava fields null, name back to `Run`, HR buckets re-derived from the row's own `hr_bpm_histogram` at the runner's current zones) and never deletes the row. Every query error is recorded as `strava_sor_write_failed`. ⚠️ It does **not** clear the `strava_activity_id` the merge mirrored onto `run_analysis` / `session_completions` (trimmed, STRAVA-SOR-REVIEW-FIX-03) |

Responds `{ status: 'ok' }` within Strava's 2-second timeout. The work runs in `waitUntil`.

⚠️ **Consequence:** a run recorded while the app is fully killed is no longer auto-linked by Strava. It links on the
next app open through `syncOnAppOpen` (HealthKit). Until 2026-11-21 the webhook stored a Strava-canonical row and
auto-matched it. With 0 Strava-connected runners on that date, no live runner was affected.

**The Strava-first race is open, deliberately.** When this webhook arrives before the Apple Health run exists, the
activity is discarded and nothing patches it later. An ingest-side backfill was built and trimmed
(STRAVA-SOR-REVIEW-FIX-03): it put Strava calls and a rate limit on every runner's Apple Health ingest for a supplement
only the founder uses.
