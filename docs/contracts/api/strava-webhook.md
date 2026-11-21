# `POST /api/webhooks/strava` — Strava activity webhook

**Route:** `/api/webhooks/strava` (`app/api/webhooks/strava/route.ts`). `GET` answers Strava's subscription challenge.

## Behaviour (STRAVA-WEBHOOK-SOR-01, 2026-11-21)

Apple Health is the system of record for run data (founder, 2026-11-21; ADR-011 §3; INV-DATA-008).

| Event | Effect |
|---|---|
| any event | `strava_webhook_received` ops event (the silence probe's heartbeat), recorded in `waitUntil` |
| non-activity | `{ status: 'ignored' }` |
| activity create/update, a run, matching Apple Health row | `tryEnrichHealthKitRow` patches the Apple Health row (splits, temperature, suffer score, HR buckets) |
| activity create/update, no matching Apple Health row | **discarded**: nothing is stored, `strava_activity_discarded` ops event `{ reason: 'no_healthkit_match', strava_activity_id }` |
| activity delete | `deleteStravaActivity`: removes a `source: 'strava'` row only; on an Apple Health row it clears the Strava patch fields and never deletes the row |

Responds `{ status: 'ok' }` within Strava's 2-second timeout. The work runs in `waitUntil`.

⚠️ **Consequence:** a run recorded while the app is fully killed is no longer auto-linked by Strava. It links on the
next app open through `syncOnAppOpen` (HealthKit). Until 2026-11-21 the webhook stored a Strava-canonical row and
auto-matched it. With 0 Strava-connected runners on that date, no live runner was affected.
