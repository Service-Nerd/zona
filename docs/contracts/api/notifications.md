# Contract — Notifications (table + `recordNotification`)

**Status:** active (NOTIF-01, scoped 2026-05-25)
**Tier:** PAID/TRIAL — every notification type is paid-gated; the bell is hidden for free users.
**Owners:** `lib/notifications.ts` (write helper) · `supabase/migrations/2026MMDD_notifications.sql` (schema) · `app/dashboard/DashboardClient.tsx` (read + render, Phase B).

The notification inbox makes ephemeral pushes durable. Every push the app sends also writes one row here, keyed to the user (not the device). The bell reads these rows; tapping one navigates to the surface it's about.

---

## Table `notifications`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | `gen_random_uuid()` |
| `user_id` | `uuid` NOT NULL | FK `auth.users(id)` ON DELETE CASCADE |
| `type` | `text` NOT NULL | one of the five type keys (below). Not a DB CHECK — new types ship without a migration; the union is enforced in TS. |
| `title` | `text` NOT NULL | bold line — mirrors the push payload `title` |
| `body` | `text` NOT NULL | message — mirrors the push payload `body` |
| `url` | `text` NULL | deep link — mirrors the push payload `data.url` (e.g. `/dashboard?screen=coach`) |
| `read_at` | `timestamptz` NULL | null = unread; stamped when the inbox is opened |
| `created_at` | `timestamptz` NOT NULL | `now()` |

Index: `notifications_user_created (user_id, created_at desc)` — the only read pattern.

### Type keys

| `type` | Source surface | Fired from |
|---|---|---|
| `daily_training` | morning training push | `app/api/push/send-daily/route.ts` |
| `weekly_report` | weekly review | `app/api/push/send-weekly-report/route.ts` |
| `trial_insight` | one-shot mid-trial nudge | `app/api/push/send-trial-insight/route.ts` |
| `run_feedback` | auto-linked run | `lib/coaching/autoAnalyse.ts` (`notifyUser` path) |
| `plan_adjustment` | engine auto-applied tweak | `app/api/adjust-plan/route.ts` (non-manual `auto_applied` only) |

---

## RLS

```
select  using (auth.uid() = user_id)   -- inbox list
update  using (auth.uid() = user_id)   -- mark read_at
-- no insert policy → only the service-role client can insert
```

**Why RLS for reads, not an API route:** the browser `supabase-js` client holds a session on web *and* native (CapacitorBoot exchanges the OAuth callback into it), so list + mark-read go through the client under RLS — same pattern as the existing `plan_adjustments` fetch in `DashboardClient`. This is distinct from the push-subscribe bug, which was about *cookie-based server-client* routes having no native session. Inserts are always server-side, so they use the service-role client and bypass RLS by design.

---

## Write helper — `lib/notifications.ts`

```ts
export type NotificationType =
  | 'daily_training' | 'weekly_report' | 'trial_insight'
  | 'run_feedback'   | 'plan_adjustment'

export async function recordNotification(userId: string, n: {
  type: NotificationType
  title: string
  body: string
  url?: string
}): Promise<void>
```

**Contract:**
- Inserts **one row per user per event** (callers that loop per-device must dedupe — `send-weekly-report` iterates per subscription, so it guards with a `recorded` Set).
- **Best-effort: never throws.** Wraps the insert in try/catch and logs on failure. A failed inbox write must not break a cron run, a plan save, or a run auto-link (consistent with ADR-006 "enricher failure is silent").
- Uses the service-role client (`SUPABASE_SERVICE_ROLE_KEY`).
- Called **adjacent to the push send**, using the same `title` / `body` / `data.url` already built for the payload — the inbox row and the push must not diverge.

---

## Read pattern (Phase B — client, via RLS)

- **List:** `select id, type, title, body, url, read_at, created_at from notifications order by created_at desc limit 50`.
- **Unread count (bell):** `select count where read_at is null` — fetched in the `DashboardClient` mount `Promise.all`, refreshed on app-resume / return-to-Today.
- **Mark read:** on opening the inbox, `update { read_at: now() } where read_at is null` — clears the bell dot. Loaded rows keep their unread styling for the current view; gone next visit.

## Retention

Read rows older than 30 days are pruned by an existing daily cron (do **not** add a 3rd Vercel cron — Hobby plan caps at 2 and silently rejects the deploy otherwise).
