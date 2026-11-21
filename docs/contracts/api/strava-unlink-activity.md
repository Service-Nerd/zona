# POST `/api/strava/unlink-activity`

Written 2026-11-02 under `WEEK-KEY-PLAIN-UNIQUE-SURVIVORS-01` — the route changed and
`audit-docs.sh` was right that nothing described it. One of the 12 routes in
`CONTRACT-COVERAGE-01`'s standing debt; this pays off one.

## Job

Undo the link between a session and the activity matched to it, so the runner can re-link or
re-analyse. Auth: the runner's own bearer token; user id comes from the verified token, never
the body.

## Request

```
{ week_n: number, session_day: string }
```

## What it writes

| table | operation | scoping |
|---|---|---|
| `strava_activities` | clears the session link on the matched row | user-scoped |
| `run_analysis` | **DELETE** the rows for that session | `superseded_at IS NULL` + `user_id` + `week_n` + `session_day` |

🔴 **The live filter is load-bearing and was MISSING until 2026-11-02.** `week_n` is a
within-plan coordinate (ADR-013): it restarts at 1 on a new plan, so "delete the analysis for
week 3, Tuesday" also deleted the **archived** plan's week-3 Tuesday analysis. A delete is the
one operation superseding cannot undo, and nothing surfaced it — the runner unlinks a session
on their current plan and loses a row from a plan they finished months ago.

Deliberately a DELETE rather than a soft-delete: the row is regenerable by re-linking and
re-analysing, and that reasoning is unchanged. What changed is *which* rows it is allowed to
reach.

## Contract notes

- **Idempotent.** Unlinking an already-unlinked session is a no-op, not an error.
- **The analysis delete is not fatal to the response.** The link clear is the user-visible
  effect; a failed analysis delete is logged.
- **Every read of `run_analysis` filters `superseded_at IS NULL`** (PLAN-WEEK-COLLISION-01),
  so this write now agrees with every reader. Enforced by the delete arm of
  `lib/supabase/liveRowWrite.test.ts`, whose population is derived from `WEEK_KEYED_TABLES`.
