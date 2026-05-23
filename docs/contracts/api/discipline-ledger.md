# API Contract — /api/discipline-ledger

**Method:** GET
**Auth:** Supabase session cookie (`getUserFromRequest`). Returns 401 otherwise.
**Tier:** All tiers. Tier is resolved server-side via `getUserTier()` and embedded in the response.

## Request

No body. No query params.

## Response — 200

```json
{
  "weeksWithinLines":  4,
  "currentWeekStatus": "pending",
  "advancedThisWeek":  true,
  "tier":              "free"
}
```

| Field | Type | Meaning |
|---|---|---|
| `weeksWithinLines` | integer ≥ 0 | Consecutive past weeks meeting the tier's criteria, ending at the most recent fully-judged week (excludes the in-flight week). |
| `currentWeekStatus` | `'on_track' \| 'broken' \| 'pending'` | Status of the in-flight week. `broken` only when an immediate-break signal has already landed (Heavy/Wrecked fatigue tag, or a skipped quality session). `pending` otherwise. `on_track` reserved for future use. |
| `advancedThisWeek` | boolean | True when the most recent past week pushed the count up by one and is adjacent to the current calendar week. Drives DOCTRINE-01's conditional brand-statement surface on SessionCompleteCard. |
| `tier` | `'free' \| 'trial' \| 'paid'` | Active tier — embedded so the client doesn't need a separate lookup. |

## Error responses

| Status | Condition |
|---|---|
| 401 | No authenticated user |

## Behaviour

Lazy compute on every request — no cron, no cached table. Pure function `lib/coaching/disciplineLedger.ts → computeLedger` does the work; the route is just plumbing.

**Free criteria** (per ISO week):
- ≥ 75% of planned non-rest sessions in that week have `session_completions.status='complete'`.
- No `fatigue_tag IN ('Heavy','Wrecked')` across the week's completions.
- No skipped session whose plan slot is in the quality family (`quality / tempo / intervals / hard`).

**Paid criteria** (in addition to free):
- Median `run_analysis.hr_in_zone_pct` across that week's analysed runs ≥ 75. Weeks with no analyses pass silently — the engine doesn't penalise infrastructure failures.

**Current-week evaluation** uses only the immediate-break criteria (fatigue tag, skipped quality). Completion ratio + paid zone discipline lock in once the week ends.

## Notes

- Counter, not a streak. Resets to 0 silently on a broken week. No notifications, no push, no toast — the number returning to 0 is the only feedback.
- Reads `plans`, `session_completions`, and (paid/trial only) `run_analysis`. No writes. RLS bypassed via service-role client.
- No cron — fire-on-view from `useDisciplineLedger()` (MeScreen, SessionPopupInner reflect view, PostRunScreen).
- Constants: `LEDGER_FREE_MIN_COMPLETION_PCT = 0.75`, `LEDGER_PAID_MIN_ZONE_DISCIPLINE_PCT = 75`. Exported from `lib/coaching/disciplineLedger.ts` — tune-by-edit, validated by `disciplineLedger.test.ts`.
