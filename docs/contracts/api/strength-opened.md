# POST /api/strength/opened — contract

**Route:** `app/api/strength/opened/route.ts` · **Item:** STRENGTH-ROW-OPEN-01 (the SLT's demand measure for
`STRENGTH-MEDIA-01`, 2026-10-21).

A runner opened an exercise row on the strength session screen.

## Request

```json
{ "exercise_id": "front_squat" }
```

## Responses

| Status | When |
|---|---|
| 200 `{ ok: true }` | Recorded one `strength_exercise_opened` ops event, detail `{ exercise_id }`, user from the bearer token |
| 401 / 404 | Not signed in / strength not released to this runner (`strengthGate`) |
| 413 / 422 | Body over 256 bytes / `exercise_id` not in `CATALOGUE_BY_ID` |

## Rules
- **Payload is a catalogue id only.** Free text is refused, so the event cannot carry anything the runner wrote.
- **Once per exercise per visit.** `StrengthSessionScreen` reports the first open of each row (`onExerciseOpen`);
  closing, and reopening the same row, report nothing.
- **Never costs the runner anything.** `useStrengthPlan → recordStrengthExerciseOpened` is fire and forget; a failure
  is swallowed.
- **Read it:** `select detail->>'exercise_id', count(*), count(distinct user_id) from ops_events where kind =
  'strength_exercise_opened' group by 1 order by 2 desc;` The SLT's buy trigger reads this against the number of
  strength sessions viewed.
