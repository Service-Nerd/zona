# Contract — Plan Fetch

**Authority**: This document defines the contract for fetching and saving the training plan JSON.
**Updated**: 2026-04-21 — Supabase `plans` table is now the primary store. GitHub Gist is a legacy migration source only.

---

## Fetch Priority (in order)

1. **`plans` table** (Supabase) — `SELECT plan_json FROM plans WHERE user_id = $uid LIMIT 1`
2. **`gist_url`** in `user_settings` — fetched with `cache: 'no-store'`, then auto-migrated to `plans` table (fire-and-forget)
3. **`plan_json`** in `user_settings` — legacy field, auto-migrated to `plans` table (fire-and-forget)
4. **`EMPTY_PLAN`** — user has no plan; navigate to the plan generator

Auto-migration is transparent to the user. After the first load, all subsequent reads come from the `plans` table.

---

## Owner

`lib/plan.ts` — `fetchPlanForUser(userId, supabase, opts)` is the sole fetch owner.
`DashboardClient` calls `fetchPlanForUser` on mount and passes results down as props. No child component fetches the plan independently.

---

## Save

`lib/plan.ts` — `savePlanForUser(userId, plan, supabase)`.
Upserts to `plans` table with `onConflict: 'user_id'` (one row per user).
`DashboardClient.handlePlanSaved` is the only caller for user-initiated saves.

---

## Schema

```
plans
  id          UUID        PK, gen_random_uuid()
  user_id     UUID        NOT NULL, REFERENCES auth.users(id) ON DELETE CASCADE
  plan_json   JSONB       NOT NULL — full Plan object per docs/canonical/plan-schema.md
  created_at  TIMESTAMPTZ DEFAULT NOW()
  updated_at  TIMESTAMPTZ DEFAULT NOW()
```

Unique index on `user_id` — one plan per user.
RLS: `auth.uid() = user_id` on all operations.

---

## Rules

- `fetchPlanForUser` is the **only** authoritative plan fetch path. No component or route fetches a plan independently.
- Gist fetch still uses `cache: 'no-store'` during migration reads.
- The plan JSON must match the `Plan` interface (`docs/canonical/plan-schema.md`) before saving.
- `plan_json` on `user_settings` is a legacy read-only field. Nothing writes to it after this migration. It may be dropped in a future migration once all users are confirmed migrated.

---

## Admin Impersonation (known gap)

RLS restricts admin from reading other users' plan rows via the standard client. Impersonation currently falls back to `gist_url` for users not yet migrated. A service-role admin API route is required to support impersonation for fully-migrated users — tracked as post-migration tech debt.
