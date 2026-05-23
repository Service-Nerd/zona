# Contract — user_settings (Supabase Table)

**Authority**: This document defines the `user_settings` Supabase table schema and the contract for reading/writing user preferences. Any column addition requires a migration file and an update to this document in the same commit.

---

## Table: `user_settings`

Stores per-user preferences, HR data, profile, and third-party tokens.

```sql
CREATE TABLE user_settings (
  id                  uuid PRIMARY KEY REFERENCES auth.users(id),
  preferred_units     text CHECK (preferred_units IN ('km', 'mi')) DEFAULT 'km',
  preferred_metric    text CHECK (preferred_metric IN ('distance', 'duration')) DEFAULT 'distance',
  resting_hr          integer,
  max_hr              integer,
  zone2_ceiling       integer,              -- stored at plan creation; user can override
  first_name          text,
  last_name           text,
  email               text,
  strava_client_id    text,
  strava_client_secret text,               -- NEVER in env files or git
  strava_access_token  text,
  strava_refresh_token text,               -- tech debt: refresh not yet implemented
  strava_token_expires_at timestamptz,
  theme               text DEFAULT 'light',
  updated_at          timestamptz DEFAULT now()
);
```

---

## Ownership Rules

- **One fetch location**: `user_settings` is fetched once at `DashboardClient` level and passed as props. No child screen fetches independently.
- **Strava secret**: Never stored in environment files or committed to git. Lives only in `user_settings.strava_client_secret`.
- **RLS**: Row-level security enforced — users can only read/write their own row.

---

## Read Contract

Fetched at `DashboardClient` initialisation. Fields consumed:

| Field | Consumer |
|---|---|
| `preferred_units` | All session cards, plan views |
| `preferred_metric` | Session cards (dist/duration default) |
| `resting_hr`, `max_hr` | Karvonen HR zone calculation |
| `zone2_ceiling` | HR target fallback (last resort) |
| `theme` | `applyTheme()` on load |
| `strava_*` | Strava OAuth flow and API calls |
| `first_name`, `last_name`, `email` | Me screen profile display |

---

## Write Contract

All writes via `supabase.from('user_settings').upsert({ id: user.id, ...fields })`.

Writes happen on:
- Me screen: units, metric preference, HR values, profile fields, theme
- Strava OAuth callback: token fields
- Plan creation (future): `zone2_ceiling` stored at creation time

---

## Pending Migration

```sql
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS email text;
```

---

## HOOK-01 Columns (migration `20260523_daily_push.sql`)

| Column | Type | Default | Purpose |
|---|---|---|---|
| `daily_push_enabled` | `boolean NOT NULL` | `true` | Opt-out toggle for the daily morning training-day push. Surfaced as a Me-screen toggle (paid/trial only). |
| `timezone` | `text NOT NULL` | `'UTC'` | IANA tz id. `DashboardClient` auto-captures `Intl.DateTimeFormat().resolvedOptions().timeZone` on first load when the stored value is still `'UTC'`. Used by the cron to compute local 06:30. |
| `daily_push_last_sent_on` | `date` | `NULL` | Date stamp the cron writes after a successful send. Idempotency backstop — never two pushes in the same local day. |
| `last_today_open_at` | `timestamptz` | `NULL` | Updated by `POST /api/me/today-heartbeat` on Today-screen mount. The cron skips the push if this is within the last 30 minutes. |

## HOOK-02 Column (migration `20260524_trial_insight_push.sql`)

| Column | Type | Default | Purpose |
|---|---|---|---|
| `trial_insight_push_sent_at` | `timestamptz` | `NULL` | Stamped by `/api/push/send-trial-insight` after the one-shot mid-trial "Kit noticed something." push fires. Never cleared — push is one-shot for life. |
