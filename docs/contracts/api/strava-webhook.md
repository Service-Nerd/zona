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
| activity create/update for an id a row already carries (an `update`, a redelivery, or the ingest backfill got there first) | nothing, and **no** event (STRAVA-SOR-REVIEW-FIX-01: these were recorded as false discards) |
| activity delete | `deleteStravaActivity`: removes a `source: 'strava'` row only; on an Apple Health row it reverts the patch (Strava fields null, name back to `Run`, HR buckets re-derived from the row's own `hr_bpm_histogram` at the runner's current zones) and never deletes the row; nulls the mirrored `strava_activity_id` on live `run_analysis` and `session_completions` rows. Every query error is recorded as `strava_sor_write_failed` |

Responds `{ status: 'ok' }` within Strava's 2-second timeout. The work runs in `waitUntil`.

⚠️ **Consequence:** a run recorded while the app is fully killed is no longer auto-linked by Strava. It links on the
next app open through `syncOnAppOpen` (HealthKit). Until 2026-11-21 the webhook stored a Strava-canonical row and
auto-matched it. With 0 Strava-connected runners on that date, no live runner was affected.

**The Strava-first race (STRAVA-SOR-REVIEW-FIX-01).** When this webhook arrives before the Apple Health run exists, the
activity is discarded. `/api/health/ingest` closes that gap: a newly inserted Apple Health row asks Strava for runs
within an hour of its start and patches the match through the same `tryEnrichHealthKitRow`
(`enrichNewHealthKitRowFromStrava`, `strava_healthkit_backfill` ops event). See `health-ingest.md`.
