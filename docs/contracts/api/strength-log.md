# POST /api/strength/log — contract

**Route:** `app/api/strength/log/route.ts` · **Item:** STRENGTH-PROGRESSION-01 (S14; Coaching + Design Board 2026-10-18).

One loaded or bodyweight **main** lift, once per session: what the runner lifted and how it felt.

## Request

```json
{ "date": "YYYY-MM-DD", "exercise_id": "goblet_squat", "load_kg": 22.5, "feel": "easy" | "right" | "hard" }
```

`load_kg` is required (0 < kg ≤ 500) on a loaded lift (`isLoadedLift`, through the one owner `isLoadedExercise`: kit that anchors the body, e.g. the inverted row's bar, is not load) and is ignored on a bodyweight lift. The
client converts lb to kg (`weightToKg`) before sending.

## Responses

| Status | When |
|---|---|
| 200 `{ date, exercise_id, load_kg, feel, counts, reps }` | Upserted on `(user_id, session_date, exercise_id)` |
| 401 / 404 | Not signed in / strength not released to this runner (`strengthGate`) |
| 404 | The lift is not a MAIN lift of the session the runner's stored plan holds on that date |
| 413 / 422 | Body over 512 bytes / bad date, feel or weight, none on a loaded one. A weight sent for a bodyweight lift is **dropped, not refused** (since 2026-10-28, STRENGTH-BW-LOG-01: a screen loaded before the inverted row became bodyweight still sends one) |
| 500 | Read or write failed (`strength_save_failed`, `where: 'lift_log'`); never a silent success |

## Rules
- **`counts` is the server's, from the plan**: false in a deload, taper or race week, or on a recovery-eased date. A
  log that does not count never moves a suggestion (S14, Hutchinson).
- **Storage:** `strength_lift_logs` (migration `20261018_strength_lift_logs.sql`), cascade with the account, own-row RLS.
- **Read back** by `GET /api/strength/plan` as `lift_logs` (last 120 days, oldest first).

## Reps (STRENGTH-LOG-REPS-01, 2026-10-29)

The row carries `reps`: the reps the **stored plan** prescribed that lift on that date (S14 Am.1), never a value from the
request, so a later rebuild cannot move what a log was done at. Column added by
`supabase/migrations/20261029_strength_session_times_and_reps.sql` (`smallint`, 1–50, null on old rows). **Before that
migration is applied** the write fails with PGRST204 / 42703 (`isMissingColumn`, `lib/supabase/missingColumn.ts`): the
route records `strength_save_failed` (`where: 'lift_log_reps_column'`) and saves the log without `reps`. Any other error
is still a 500. Gate: `lib/api/strengthLogRoute.test.ts`.
