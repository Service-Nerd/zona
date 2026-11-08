# Contract — `POST /api/post-race-reshape`

**Authority**: this document defines the request and response contract. Any change to either
updates it in the same commit.

Written 2026-11-08 under `OPS-FN-DURATION-01`, which changed this route and found it had **no
contract at all** — one of `CONTRACT-BACKFILL-01`'s 13. 🥇 *Writing a contract is a code
review*, and this one is recorded below.

Tier: **PAID / trial**, via the `dynamic_reshape_r20` gate. ADR-012 (reshape authority) and
`CoachingPrinciples §74` govern the behaviour.

## Request

```ts
POST /api/post-race-reshape
Authorization: Bearer <supabase access token>     // native rides the Bearer token
{ race_result: RaceResult, race_week_n: number }
```

| Field | Required | Meaning |
|---|---|---|
| `race_result` | yes | What the runner logged: `finish_time`, `distance_km`, `rpe`, `outcome`, … |
| `race_week_n` | yes | `week.n` of the race week (ADR-013: keyed by `week.n`, never array position) |

## Responses

| Status | Body | When |
|---|---|---|
| 401 | `{ error: 'Unauthorized' }` | no user on the request |
| 403 | `{ error: 'Subscription required' }` | `dynamic_reshape_r20` not allowed for the tier |
| 400 | `{ error: 'race_week_n required' }` | the body omits it |
| 404 | `{ error: 'No plan found' }` | the runner has no plan |
| 500 | `{ error: 'Failed to save reshape proposal' }` | the `post_race_reshapes` insert failed |
| 200 | `{ reshape_available: false, reason: 'no_remaining_weeks', plan }` | the race was the last week — **the result is still saved** |
| 200 | the proposal (below) | a reshape was computed |

```ts
{
  reshape_id: string
  reshape_available: true
  summary: string | null            // null when the AI enricher failed (silent, ADR-006)
  weeks_affected: number
  sessions_modified: number
  recovery_window_weeks: number
  distance_bucket: string
  plan: Plan                        // the RESULT-embedded plan, already saved
  preview_weeks: Week[]             // only the affected weeks, each carrying `_week_n`
}
```

## Contract

- 🔴 **THE RESULT IS SAVED BEFORE THE RESHAPE IS PROPOSED, AND THAT ORDER IS THE CONTRACT**
  (§74). `savePlanForUser(planWithResult)` runs first, so logging a race is never lost because
  the reshape failed, was declined, or had nothing to reshape. **Both 200 shapes carry `plan`**
  for that reason: the client must reflect the logged result immediately either way.
- **The proposal is `pending`, never applied.** ADR-012: a structural change is confirmed, not
  silent. Applying it is `POST /api/post-race-reshape/confirm`.
- ⚠️ **AN EARLIER PENDING ROW IS SUPERSEDED, NOT LEFT**, and the reason is a live defect: without
  it, repeated submissions pile up `status: 'pending'` rows, the Today query takes the newest,
  and the card reappears on reload after the runner dismissed it.
- **AI enrichment degrades silently** (ADR-006). `summary` is `null` and `ai_prompt_version` is
  not stamped when it fails; the structural reshape is unaffected. ⚠️ `ai_model` and
  `ai_enriched_at` are the provenance — an `AIMark` belongs on the summary only when they are set.
- **`maxDuration = 300`** — see `docs/contracts/api/ai-route-duration.md`. Sonnet
  (`ANTHROPIC_MODEL_DEEP`); no duration has ever been measured for this surface (0 samples in
  `ops_events.ai_call`).
- **Rate limited** by `guardAiRequest` under the `post-race-reshape` key: `HEAVY_LIMIT` 10/hour
  (`AI_ROUTE_LIMITS`).

## Consumers

- `components/training/RaceResultSheet.tsx:141` — "Log result" calls this, then emits
  `onReshapeAvailable`
- `components/training/PostRaceReshapeCard.tsx` — renders the proposal; accept goes to `/confirm`
- `app/dashboard/DashboardClient.tsx:3188` — the dismiss path writes `post_race_reshapes` directly

## ⚠️ This path is ARRAY-POSITION numbered, end to end. Do not renumber it piecemeal.

`race_week_n` is **not** `week.n`. Traced through, every link agrees on position + 1:

| | |
|---|---|
| `DashboardClient.tsx:2501` | sends `raceWeekN: raceWeekIdx + 1` |
| `postRaceReshape.ts:145` | `const weekIndex = weekN - 1; reshapedWeeks[weekIndex]` |
| `postRaceReshape.ts:196` | `weeksAffected.push(weekN)`, the same loop variable |
| `injectAIEnrichment` | `const weekN = i + 1` |
| `preview_weeks` | `.map((w, i) => ({ ...w, _week_n: i + 1 }))` |

🔴 **I FILED THIS AS A DEFECT FIRST AND IT IS NOT ONE.** `preview_weeks` stamping `_week_n` from
the index looked like the ADR-013 class — *"`week_n` is keyed by `week.n`, not by array
position"* — so I wrote it up as latent. It survives only until you trace the PRODUCER: the
client sends a position, so the module consuming it as a position is **correct**, and the two
conventions never meet. ⚠️ **Checking the chain rather than stopping at the plausible smell is
what kept a false item out of the backlog.**

**What IS load-bearing:** the agreement is a convention held by five places and asserted by none.
It coincides with `week.n` for every plan whose weeks start at 1 and run contiguously, which is
every plan the engine generates. A future plan kind that numbers weeks otherwise — or any attempt
to "fix" one of these five to read `week.n` on its own — breaks the path silently, because a
wrong week still reshapes. `_week_n` itself has **no consumer outside this route**; it exists only
for the filter on the line below it.

## Not verified

Nothing has run on a device. The `reshape_available: false` branch has no production sample: it
needs a runner whose race is the final week of their plan.
