# Contract — POST /api/strava/link-activity

**Route:** `app/api/strava/link-activity/route.ts`. Bearer-authenticated (`getUserFromRequest`),
then tier-gated on `activity_intelligence`. Called when a runner **manually** links an activity to
a planned session, and it exists to mirror the Strava webhook's pipeline so a hand-linked run
produces the same `strava_activities` + `run_analysis` rows as an auto-linked one.

Written 2026-11-10 (`AI-ROUTE-HTTP-HOP-CEILING-01`) because the route changed and had no contract.
It is one of `CONTRACT-COVERAGE-01`'s declared-debt routes; that debt is now 11 of 71.

### Request

```json
{ "strava_activity_id": 123456789, "apple_health_uuid": "…", "week_n": 4, "session_day": "tue" }
```

| Field | Required | Meaning |
|---|---|---|
| `week_n`, `session_day` | **yes** | The planned session being linked. `422` if either is absent |
| `strava_activity_id` | one of | The Strava activity to pull and link |
| `apple_health_uuid` | one of | A HealthKit row already present; links it without touching Strava |

**`422`** if neither id is supplied. The two are not interchangeable: `apple_health_uuid` takes the
HealthKit-only branch and returns immediately.

### Responses

| Status | Body | When |
|---|---|---|
| 200 | `{ ok: true, mode: 'healthkit' }` | `apple_health_uuid` path — the row already exists; nothing is fetched from Strava |
| 200 | `{ ok: true, mode: 'enriched_healthkit' }` | `tryEnrichHealthKitRow` found a matching HealthKit row and **patched** it (ADR-011's supplement path) |
| 200 | `{ ok: true, mode: 'created_strava' }` | No HealthKit row matched, so a Strava-canonical row was upserted — see the ADR-011 note below |
| 400 | `{ error: 'Strava not connected' }` | No token in `user_settings` |
| 403 | `{ error: 'Subscription required' }` | `activity_intelligence` not allowed for the tier |
| 422 | `{ error: 'Activity is not a run' }` | Strava returned a non-run activity |
| 502 | `{ error: 'Strava activity fetch failed', status }` | Strava's own error, with its status passed through |
| 500 | `{ error: 'Failed to persist activity' }` | The `strava_activities` upsert failed |

`mode` is the field a caller should branch on: the three 200s are materially different outcomes
and were previously indistinguishable to anyone reading only the status.

## ⚠️ ADR-011 / INV-DATA-008 — the write, and a tension in the doctrine text

This route **upserts `strava_activities`** (`route.ts:132`) on the `created_strava` path.

🔴 **CLAUDE.md says two different things about that, and this contract records the tension rather
than resolving it.** INV-DATA-008 reads: *"writes to `strava_activities` are only allowed via
`/api/health/ingest` (insert) or `lib/coaching/healthkitConsolidate.ts` (patch). Any new code that
calls `.insert(...)` or `.upsert(...)` on `strava_activities` outside these paths is a doctrine
violation"* — and ADR-011's summary says *"If no matching HK row exists, the Strava activity is
**discarded** — never stored."* But the `STRAVA-WEBHOOK-OBS-01` paragraph in the same document
says the webhook *"consolidates onto the HealthKit row first and **only stores a Strava-canonical
row when no HK row exists** (ADR-011)"*.

**This route deliberately mirrors the webhook** — its own header says so — so its write is the
intended behaviour under the second reading and a violation under the first.

⚠️ **There is no mechanical gate for INV-DATA-008.** It is named in comments in
`lib/coaching/weeklyActualLoad.ts`, `lib/coaching/healthkitConsolidate.test.ts` and
`app/api/health/ingest/route.ts`,
and nothing enumerates the writers. Measured 2026-11-10, the files that write the table at all:
`health/ingest` (sanctioned), `healthkitConsolidate` (sanctioned), **`strava/link-activity`
(upsert)**, `recalibrate-hr` (updates), `race-times` and `post-run-reframe` (reads). **Which of
those the invariant intends to permit is an ADR-011 wording question, not a code question**, and
it is recorded here so the next reader does not have to re-derive it from two sentences that
disagree.

## Duration ceiling and the outbound hops (AI-ROUTE-HTTP-HOP-CEILING-01, 2026-11-10)

`export const maxDuration = 300`, and **both** outbound `fetch`es to `/api/analyse-run` carry
`signal: AbortSignal.timeout(AI_LIMITS.HOP_TIMEOUT_MS)` (30 s).

🔴 **This route was missed twice over.** `OPS-FN-DURATION-01` set `maxDuration` on every route in
`callAnthropic`'s **import** closure, which is the wrong population for a route that reaches an AI
route through a **URL string**; and the item that filed the gap named three waiting sites and
**neither of this route's two**. `lib/ai/aiRouteHopCeiling.test.ts` derives the population instead
of listing it, for that reason.

🔴 **And it was the last file carrying a hand-built server→server base.** Both hops read
`process.env.NEXT_PUBLIC_APP_URL ?? (VERCEL_URL ? …)` where `getInternalBaseUrl()` is the one
owner (GTM-SITE-01). The owner's own comment names the cost: `VERCEL_URL` *"carries Vercel
Deployment Protection and is not the canonical host"*, and it *"silently degraded the no-app
run-analysis on both ingest paths after 2026-09-10"*. `NEXT_PUBLIC_APP_URL` is deliberately
**unset**, so in production both hops resolved to a protected deployment URL — and the `catch`
only `console.warn`s, so it reported nothing. Both now call the owner, and the gate's last arm
fails if the hand-built form returns anywhere.
