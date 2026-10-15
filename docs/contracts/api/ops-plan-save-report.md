# Contract — POST /api/ops/plan-save-report

**Item:** `PLAN-SAVE-SILENT-FAIL-01` (2026-10-15) · **Route:** `app/api/ops/plan-save-report/route.ts`
· **Caller:** `lib/ops/reportPlanSaveFailure.ts`, from `GeneratePlanScreen.handleUsePlan`'s catch.

## Why it exists

Saving a freshly generated plan runs **in the browser**, so it cannot call `recordOpsEvent`
(service-role, server-only). Before this route, `handleUsePlan`'s catch reset the "Saving…" button
and **did nothing else** — no message to the runner, no record to us. A Make-A-Wish runner built an
identical marathon plan twice on 2026-10-08 and saved neither, and *"never tapped save"* could not
be told from *"tapped it and it failed"*.

Same shape, for the same reason, as `/api/ops/onboarding-event` and `/api/ops/health-sync-report`.

## Request

`POST`, bearer-authed (`authedFetch`). JSON body, **every field optional** — an empty body still
records the failure:

| Field | Type | Stored as | Bound |
|---|---|---|---|
| `message` | string | `detail.message` | truncated to 300 chars |
| `errorName` | string | `detail.error_name` | truncated to 60 chars |
| `raceDistanceKm` | number | `detail.race_distance_km` | finite, ≥ 0, capped at 1000; else `null` |
| `enrichmentPending` | boolean | `detail.enrichment_pending` | non-boolean → `null` |
| `attempt` | number | `detail.attempt` | finite, ≥ 0, capped at 100; else `null` |

## Response

| Status | When |
|---|---|
| `200 { ok: true }` | Authenticated. The event is recorded |
| `401 { error: 'Unauthorized' }` | No valid bearer token. **Nothing is recorded** |

## What it writes

One `ops_events` row: `kind = 'plan_save_failed_client'`, `user_id` = the **verified** caller.

⚠️ **The body cannot choose the kind or the user.** Both are fixed server-side. A client that could
name its own kind could write anything into the ledger `/api/ops/ai-spend` reads, and one that could
name the user could attribute a failure to someone else. Asserted in
`lib/ops/planSaveReport.test.ts`.

⚠️ **Distinct from `plan_save_failed`**, which is a SERVER reshape/write path. Kept apart so it is
always clear which side broke.

## Guarantees the caller relies on

- `reportPlanSaveFailure` **never throws** — it runs inside a catch on the critical save path, and a
  rejection there would replace the runner's real failure with a telemetry one.
- The runner is shown the failure **before** this is called, so a slow report can never delay it.

## Known adjacent gap

The Adjust sheet's save (`DashboardClient.tsx`, `modifyCoordRef`) **does** tell the runner — *"Could
not save that change. Try again."* — but records nothing for us. Same reporter would cover it; out
of this item's scope, recorded so it is not rediscovered.
