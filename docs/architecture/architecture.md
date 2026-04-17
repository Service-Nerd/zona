# Architecture — ZONA

## System Overview

ZONA is a Next.js App Router application backed by Supabase,
deployed on Vercel. Training plan data lives in a GitHub Gist
(JSON), fetched fresh on each request. Strava provides run
data via OAuth.

---

## Data Flow
GitHub Gist (JSON)
│
▼
Next.js Server
│
├──▶ DashboardClient (fetches overrides + settings once)
│           │
│           ├──▶ Session Cards
│           ├──▶ Plan Calendar
│           ├──▶ Plan Chart
│           └──▶ Strava Panel
│
└──▶ Supabase (user data, overrides, completions)
---

## Key Files & Responsibilities

| File/Dir                        | Responsibility                                      |
|---------------------------------|-----------------------------------------------------|
| `app/dashboard/DashboardClient` | Root client component; owns global state fetch      |
| `app/login/page`                | Auth entry point                                    |
| `components/PlanCalendar`       | Week/calendar view of training sessions             |
| `components/PlanChart`          | Visual chart of plan structure                      |
| `components/StravaPanel`        | Strava activity display                             |
| `globals.css`                   | Single source of all CSS custom properties (tokens) |
| `layout.tsx`                    | App shell                                           |

---

## Supabase Schema

### `user_settings`
Stores per-user preferences and configuration.

```sql
-- Pending migration for profile fields:
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS email text;
```

### `session_completions`
Tracks which sessions the user has marked complete.

### `session_overrides`
Per-session overrides (e.g. swapped sessions, notes).

---

## Plan Data Schema (GitHub Gist)

- Format: JSON
- Primary metric flag: `primary_metric` (distance or duration)
- Both `duration` and `distance` present in schema
- Strength sessions are schedule stubs until R21
- Plan output = JSON first, never direct-to-DB
- Plan creation (R23) and reshaping (R20) are separate flows
  but share the same schema and rules

---

## Auth Flow

- Supabase Auth (email/password)
- Session persisted via Supabase client
- Strava OAuth separate — token cached in user_settings (tech debt: needs refresh logic)

---

## Strava Integration

- Free tier
- Garmin auto-syncs to Strava
- OAuth token stored in Supabase
- Known tech debt: token refresh not yet implemented
- OAuth testing: Hoppscotch only (curl multi-line fails on Mac Terminal)

---

## Theme System

- Single `globals.css` holds all CSS custom properties
- Light/dark toggle via `data-theme="dark"` on `<html>` only
- `applyTheme()` must only toggle the attribute — no `setProperty()` calls
- Components reference tokens only — no hardcoded values

---

## Deployment

- Vercel auto-deploys from GitHub main branch
- Workflow: build-check locally → commit → push → Vercel deploys
- No build log tailing required before deploy