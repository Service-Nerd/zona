# Architecture — Zona

## System Overview

Zona is a Next.js App Router application backed by Supabase,
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

## Subscription Payment Architecture

See `docs/architecture/ADR-005-subscription-payments.md` for the full decision record.

- **iOS**: RevenueCat SDK (in native wrapper) → StoreKit 2 → webhook → `subscriptions` table
- **Web**: Stripe Checkout → webhook → `subscriptions` table
- **Gating**: all reads from `subscriptions` table only — no direct Stripe or StoreKit calls in Next.js

A user is active if: `status IN ('trialing', 'active') AND current_period_end > now()`

### `subscriptions`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `user_id` | UUID | FK → `auth.users`, unique |
| `provider` | TEXT | `'revenuecat'` or `'stripe'` |
| `status` | TEXT | `'trialing'` · `'active'` · `'cancelled'` · `'expired'` |
| `current_period_end` | TIMESTAMPTZ | — |
| `created_at` / `updated_at` | TIMESTAMPTZ | — |

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

See `docs/architecture/ADR-002-plan-json-first.md` for the full decision record.

---

## Plan Generation Architecture: FREE vs PAID

Plan generation uses two separate engines depending on the user's tier.

### Free tier — Rule-based engine (no AI)

- Deterministic algorithm: inputs → template selection + parameter filling
- No Anthropic API calls. Zero.
- Templates cover: 5K / 10K / HM, 8 & 12-week variants
- Plan output is always valid JSON matching the canonical schema
- Guard rails applied before output (see `docs/canonical/coaching-rules.md`)

### Paid tier — AI engine (Claude API)

- Calls Claude API (`claude-sonnet-4-6`) via `app/api/generate-plan/route.ts`
- **All AI calls route through Next.js API routes only — never from the client directly**
- Token budget scales with plan length (≤12 weeks → 12,000 tokens; ≤20 weeks → 18,000; >20 weeks → 24,000)
- Guard rails checked server-side before the API call — invalid inputs never reach Anthropic
- Output parsed and validated before save; stub plan returned if `ANTHROPIC_API_KEY` is absent

See `docs/contracts/api/generate-plan.md` for the full route contract.

---

## Zone Method

Current implementation supports two zone formulas: Karvonen (Heart Rate Reserve) when the user's resting HR is known, % MaxHR otherwise. Both produce the same five named zones (Z1–Z5). Zone constants live in `GENERATION_CONFIG.ZONES` (`lib/plan/generationConfig.ts`); every consumer (rule engine, `aerobicPace.ts`, `coachingFlag.ts`, UI surfaces) reads from this single source. See `docs/canonical/zone-rules.md` for the table.

**Zone method selector** (user-configurable, stored in `user_settings.zone_method`) is a PAID feature scheduled but unstarted. The forward-compat hook lives in `GENERATION_CONFIG.ZONES`: adding Daniels, Coggan, or Friel is a new key under `ZONES` plus one lookup in `computeZones()`. No engine or consumer change required.

---

## Gist → Supabase Plan Storage Migration

Current state: plan JSON lives in a GitHub Gist, fetched fresh on every request with `cache: 'no-store'`.

ADR-002 establishes that JSON-first output makes the storage layer swappable without touching generator logic. The migration path is:

1. Add a `plans` table to Supabase (schema: `user_id`, `plan_json` JSONB, `created_at`, `updated_at`)
2. On plan save (post-generation or post-reshape), write JSON to `plans` table instead of Gist
3. On plan fetch, read from `plans` table via API route instead of Gist URL

> **TODO (product owner)**: Confirm whether the Gist → Supabase migration is in scope before or after launch. The R23 generator currently returns JSON to the client but the save step is not yet wired to Supabase. Decision needed before R0.5 / onboarding flow is built, as new users must have a plan storage target.

---

## AI Call Routing Invariant

All calls to the Anthropic API must route through Next.js API routes (server-side). Client components must never hold or use the `ANTHROPIC_API_KEY` directly.

This applies to:
- Plan generation (`/api/generate-plan`)
- Plan reshaping (`/api/reshape-plan` — future R20)
- AI coaching (Coach tab — currently admin-only)
- Any future AI feature

The `ANTHROPIC_API_KEY` environment variable must remain server-only. It must not be prefixed with `NEXT_PUBLIC_`.

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