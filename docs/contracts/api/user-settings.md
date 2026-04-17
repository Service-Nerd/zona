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
