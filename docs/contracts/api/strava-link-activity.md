# Contract — POST /api/strava/link-activity

**Route:** `app/api/strava/link-activity/route.ts`. Bearer-authenticated (`getUserFromRequest`),
then tier-gated on `activity_intelligence`. Called when a runner **manually** links an activity to
a planned session. Apple Health is the system of record, so every successful path ends on an Apple
Health row and triggers `analyse-run` with its `apple_health_uuid`; the route itself stores nothing
(STRAVA-WEBHOOK-SOR-01, STRAVA-SOR-REVIEW-FIX-01).

Written 2026-11-10 (`AI-ROUTE-HTTP-HOP-CEILING-01`) because the route changed and had no contract.
It is one of `CONTRACT-COVERAGE-01`'s declared-debt routes; that debt is now 11 of 71.

### Request

```json
{ "strava_activity_id": 123456789, "apple_health_uuid": "…", "week_n": 4, "session_day": "tue" }
```

| Field | Required | Meaning |
|---|---|---|
| `week_n`, `session_day` | **yes** | The planned session being linked. `422` if either is absent |
| `strava_activity_id` | one of | The Strava activity to link. If an Apple Health row already carries this id, that row is used with no Strava call; otherwise the activity is fetched and patched onto the matching Apple Health row |
| `apple_health_uuid` | one of | A HealthKit row already present; links it without touching Strava |

**`422`** if neither id is supplied. `apple_health_uuid` wins when both are sent.

### Responses

| Status | Body | When |
|---|---|---|
| 200 | `{ ok: true, mode: 'healthkit' }` | `apple_health_uuid` sent, **or** the Strava id is already on an Apple Health row (STRAVA-SOR-REVIEW-FIX-01: this used to be a false 409). Nothing is fetched from Strava; `analyse-run` is triggered on that row |
| 200 | `{ ok: true, mode: 'enriched_healthkit' }` | `tryEnrichHealthKitRow` found a matching HealthKit row and **patched** it, then `analyse-run` is triggered on it. Until STRAVA-SOR-REVIEW-FIX-01 this path returned **without** any analysis |
| 409 | `{ ok: false, mode: 'discarded_no_healthkit_match' }` | No HealthKit row matched. **Nothing is stored** (STRAVA-WEBHOOK-SOR-01, 2026-11-21); a `strava_activity_discarded` ops event is recorded. Until 2026-11-21 this path upserted a Strava-canonical row as `created_strava`. **Client obligation:** the completion was already saved with the Strava id, so the caller clears it through `/api/strava/unlink-activity`. Every client call goes through `lib/strava/linkActivity.ts → postLinkActivity`, which does that (gated by `linkActivity.test.ts`) |
| 400 | `{ error: 'Strava not connected' }` | No token in `user_settings` |
| 403 | `{ error: 'Subscription required' }` | `activity_intelligence` not allowed for the tier |
| 422 | `{ error: 'Activity is not a run' }` | Strava returned a non-run activity |
| 502 | `{ error: 'Strava activity fetch failed', status }` | Strava's own error, with its status passed through |

`mode` is the field a caller should branch on. The `analyse-run` hop is fire-and-wait with a
`console.warn` on failure; a failed hop still returns 200.

The client-side picker offers a Strava run only when `findEnrichMatch` (the merge's own matcher)
finds an unattached Apple Health run for it among the 100 newest, so a refusal is rare rather than
routine (`stravaRunIsLinkable`).

## ✅ ADR-011 / INV-DATA-008 — resolved 2026-11-21 (STRAVA-WEBHOOK-SOR-01)

The founder ruled: *"Apple health is sor for run data."* This route no longer writes `strava_activities`. A Strava
activity either patches a matching Apple Health row through `tryEnrichHealthKitRow`, or is discarded with a recorded
event. The tension this section used to record is closed. The pre-commit allowlist and the tree sweep in
`lib/strava/stravaSor.test.ts` both forbid the write.

<details><summary>The tension as it was recorded before 2026-11-21</summary>



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

`export const maxDuration = 300`, and the outbound `fetch` to `/api/analyse-run` (one since STRAVA-WEBHOOK-SOR-01; it was two) carries
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

</details>
