# Data + API Contract — `ops_events` + reshape-integrity probe (OPS-01)

**Tier:** Ops/internal — not a user-facing feature; no FREE/PAID gate.
**Owner:** `lib/ops/recordOpsEvent.ts` (write) · `app/api/ops/reshape-integrity/route.ts` (probe) · `supabase/migrations/20260722_ops_events.sql` (schema).
**Motivation:** postmortem of the 2026-06-26 reshape incident (a live paid feature broken nine days, founder-dogfooding the only detection). Owned-in-Supabase telemetry — no third-party monitoring vendor (same doctrine as INSTRUMENT-01).

## Table `ops_events`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | `gen_random_uuid()` |
| `kind` | `text` NOT NULL | Event kind. **No CHECK** — union enforced in TS (`OpsEventKind`); new kinds ship without a migration. |
| `user_id` | `uuid` NULL | FK `auth.users` ON DELETE CASCADE. Nullable — some events are system-wide. |
| `detail` | `jsonb` NOT NULL `'{}'` | Structured context. No PII beyond the user id. |
| `created_at` | `timestamptz` NOT NULL | `now()` |

**RLS:** enabled with **no policies** → anon + authenticated fully denied; only the service-role key (server) reads/writes. Same lockdown as `waitlist`. Never reachable from the client.

## Write — `lib/ops/recordOpsEvent.ts`

```ts
recordOpsEvent(kind: OpsEventKind, detail?: Record<string, unknown>, userId?: string | null): Promise<void>
```

- **Server-only** (own service-role client). Do **not** import into client/isomorphic modules (e.g. `lib/plan.ts`).
- **Never throws** — telemetry must not break the path it monitors; degrades to `console.error`.
- Awaitable, so a caller can guarantee the row lands before rethrowing the original error.

### `OpsEventKind`

| Kind | Written by | Meaning |
|---|---|---|
| `plan_save_failed` | `/api/adjust-plan` catch around `savePlanForUser` | A server reshape write threw. `detail`: `{ route, week_n, message }`. |
| `plan_integrity_mismatch` | the probe | An `auto_applied` adjustment never landed in `plan_json`. `detail`: `{ adjustment_id, week_n, adjustment_at, plan_updated_at }`. |

## Probe — `GET|POST /api/ops/reshape-integrity`

**Auth:** `CRON_SECRET` via `Authorization: Bearer` or `x-cron-secret` (403 otherwise).
**Schedule:** daily 07:30 UTC via GitHub Actions (`.github/workflows/ops-cron-integrity.yml`) — Vercel Hobby's 2 cron slots are used, hence GH Actions (same pattern as the email/push crons).

**Logic (timestamp relationship, NOT content diff):** `savePlanForUser` bumps `plans.updated_at`; the route inserts the `plan_adjustments` row before saving. So a healthy auto-apply has `plans.updated_at >= adjustment.created_at`. For each user's **latest** `auto_applied` adjustment older than `RECONCILE_GRACE_MIN` (5 min): if `plans.updated_at` is missing or `< adjustment.created_at`, the follow-up save never landed → record `plan_integrity_mismatch` (deduped within `DEDUP_WINDOW_HOURS` = 20h so a stuck user isn't re-flagged every run).

- **Why not deep-equal `sessions_after` vs `plan_json`:** AI enrichment mutates sessions after apply → constant false positives. A timestamp/state relationship is noise-free. (Codified as architectural-principles **N-015**.)
- **`pending` adjustments excluded** by construction (they legitimately leave the plan unchanged until confirmed).

**Response 200:** `{ checked: number, mismatches: number, flagged: string[] }`

## Reviewing findings

```sql
select kind, count(*) from ops_events group by kind;                          -- overview
select * from ops_events where kind = 'plan_integrity_mismatch' order by created_at desc; -- stuck plans
select * from ops_events where kind = 'plan_save_failed' order by created_at desc;         -- caught throws
```

## Apply + verify

- Migration `supabase/migrations/20260722_ops_events.sql` — apply to live Supabase (operator, dashboard SQL editor).
- GitHub repo secrets `CRON_SECRET` + `VERCEL_URL` (points at prod, e.g. `https://www.zonna.run`) must be set for the workflow.
- Verify: `workflow_dispatch` the `ops-cron-integrity` action once, confirm a 200 `{ checked, mismatches }` and no error rows.
