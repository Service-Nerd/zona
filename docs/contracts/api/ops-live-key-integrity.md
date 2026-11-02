# GET/POST `/api/ops/live-key-integrity`

`CHECK-DB-LIVE-KEY-CRON-01`, 2026-11-02. Daily schema probe: are production's week_n-keyed
unique indexes still scoped to the live plan?

## Why it exists

The five `%_live_key` partial unique indexes are the write side of PLAN-WEEK-COLLISION-01. A
unique on `(user_id, week_n, …)` **without** `WHERE superseded_at IS NULL` means a new plan's
row cannot insert beside its superseded history: `week_n` restarts at 1 (ADR-013), so the write
lands on the tombstone or fails, every read excludes it, and nothing errors. Invisible for weeks
twice — `COMPLETION-TOMBSTONE-01` and `WEEKLY-REPORT-SUPERSEDED-WRITE-01`.

🔴 **Neither existing check closes this.** `lib/supabase/liveKeyCoverage.test.ts` gates the
MIGRATIONS inside `npm run verify` and cannot see production — demonstrated the day it shipped,
when `session_overrides` turned out to carry a plain unique that no migration declares and the
test passed on it. `npm run check:db` does read production, and is referenced by nothing but its
own `package.json` line: not `verify`, not `verify:ci`, none of the workflows.

## Auth

`CRON_SECRET` via `Authorization: Bearer` **or** `x-cron-secret`, read through the shared
`cronSecretFrom` (`lib/security/secrets`). 403 on a mismatch, before anything is read.

## Response

```
200 { healthy: true,  live_scoped: 6, findings: [], out_of_scope: ["plan_weekly_notes.plan_weekly_notes_pkey"] }
200 { healthy: false, live_scoped: 5, findings: ["session_overrides.session_overrides_user_id_week_n_original_day_key (constraint) on (user_id,week_n,original_day) — predicate NONE"], … }
503 { healthy: null,  error: "week_key_uniqueness() unavailable — health could not be observed", remedy: "apply supabase/migrations/20261103_live_key_rpc.sql" }
```

⚠️ **The 503 refuses rather than reassuring.** A probe returning `healthy: true` because it could
not look manufactures confidence, which is worse than having no probe — the same precedent
`strava-webhook-health` states ("the probe refuses rather than reporting health it cannot
observe"). `healthy` is `null`, never `true`, when the RPC is missing.

`out_of_scope` is reported rather than hidden: rows on tables carrying no `superseded_at` cannot
have the predicate (`plan_weekly_notes`' pkey), so naming them stops the count reading as a miss.

## Ops events

| kind | when | dedup |
|---|---|---|
| `live_key_not_live_scoped` | a week_n-keyed unique on a stamped table has no live predicate | 20h, on the **set** of offending index names |
| `live_key_probe_unavailable` | the RPC is missing — health could not be observed | none |

⚠️ **Deduped on the signature, not a count.** A *different* index going wrong is a different
finding and must not be swallowed by a window opened for the first one.

## Reads / writes

Reads `public.week_key_uniqueness()` (read-only, `service_role` only, `20261103`) and
`ops_events` for the dedup check. Writes nothing but `ops_events`.

## Ownership

The classification is **`lib/supabase/liveKeyAudit.ts`**, shared with `scripts/check-db-drift.ts`.
Two hand-written answers to one question is the `DELOAD-OWNER-01` / `TIER-OWNER-01` shape, so the
scheduled probe and the hand-run check cannot disagree about what a defect is. The extraction was
proven inert: `check:db`'s output is byte-identical before and after.

Tests: `lib/supabase/liveKeyAudit.test.ts` (fixtures captured from the real RPC, before and after
`20261104`), plus `lib/security/cronAuth.test.ts`'s population arm — **whose population had to be
corrected to include this route**: it filtered on the literal `x-cron-secret`, so any route using
`cronSecretFrom` was exempt from the check about `cronSecretFrom`. It keys on `CRON_SECRET` now.

## Schedule

`.github/workflows/ops-cron-live-key-integrity.yml`, 08:20 UTC daily — clear of
reshape-integrity (07:30), plan-audit (07:45), the email cron (08:00), onboarding-integrity
(08:05) and strava-webhook-health (08:10). Needs `CRON_SECRET` and `VERCEL_URL`, both already set
for the existing ops crons. The workflow fails the run on `healthy:false`, on a 503, and on any
non-200 — silence is not success.
