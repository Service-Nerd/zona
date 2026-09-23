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

- **This route names NO table, deliberately (DB-USER-PURGE-01, 2026-09-23).** It calls
  `auth.admin.deleteUser(uid, false)` and nothing else. Every user-scoped table carries an
  `ON DELETE CASCADE` foreign key to `auth.users`, so deleting the auth row **is** the
  deletion. Hard delete, not soft: a soft-deleted auth row leaves every cascade unfired.
- Uses service role client — bypasses RLS.
- **If you are about to add a `.delete()` call here, the constraint is missing.** Add it in
  a migration and declare the table in `lib/supabase/userDataSurfaces.ts`. `npm run check:db`
  fails until a user-scoped table is both declared and wired.
- Two stores survive deliberately, anonymised rather than deleted: `ops_events` (the AI spend
  ledger, `user_id` → NULL) and `charity_codes` (released back to its batch, not consumed).
  Three more are cleared by the `on_auth_user_deleted` trigger because no FK can reach them:
  `ai_rate_limits`, `charity_codes.claimed_at`, `waitlist`.
- Apple App Store requirement — must be reachable from Me screen without authentication friction.

## History

🔴 **This contract previously read: _"Cascade deletes (in order): `session_completions`,
`subscriptions`, `user_settings`, then auth user"_ and _"Does NOT delete `plans`,
`strava_activities`, `run_analysis`, or `plan_adjustments` rows. Those orphan silently.
Future cleanup via DB cron if required."_**

Both halves were accurate, and that is the point worth keeping. The word **"Cascade"** in the
first line was wrong — there was no cascade; the public schema carried exactly ONE foreign key
of any kind and NONE to `auth.users`. And the second line **correctly documented the
orphaning and accepted it**, naming four tables when the real figure was twenty-one.

⚠️ So the orphaning was **known and filed**, not unnoticed — while `app/privacy/page.tsx`
promised deletion _"removes all associated data"_ (a GDPR Art.17 claim) and the Me screen
promised _"sessions, plan, and profile"_. **A limitation recorded in a contract does not
license a promise made to the user on another surface.** The deferral — _"future cleanup via
DB cron if required"_ — outlived the assumption that made it safe.
