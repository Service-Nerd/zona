# API Contract — /api/delete-account

**Method:** POST  
**Auth:** Bearer token (any tier).  
**Gate:** None — all authenticated users can delete their account.

## Request body

Empty body accepted.

## Response — 200

```json
{ "ok": true }
```

## Error responses

| Status | Condition |
|--------|-----------|
| 401 | No valid session |
| 500 | Supabase auth deletion failed |

## Notes

- Cascade deletes (in order): `session_completions`, `subscriptions`, `user_settings`, then auth user via `auth.admin.deleteUser`.
- Uses service role client — bypasses RLS.
- Does NOT delete `plans`, `strava_activities`, `run_analysis`, or `plan_adjustments` rows. Those orphan silently. Future cleanup via DB cron if required.
- Apple App Store requirement — must be reachable from Me screen without authentication friction.
