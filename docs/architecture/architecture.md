# Architecture — Zonna

## System Overview

> **Rewritten 2026-11-21 (ADR-027 B1, `ADR027-B1-DOC-DRIFT`).** The previous overview described Gist plan
> storage, a separate AI plan generator for paid users and a dark-mode toggle. None of those is the current
> system. **Target architecture:** `docs/architecture/ADR-027-coaching-engine-service.md` (accepted
> 2026-11-20), which rebuilds the engine as a layered service; the current engine is frozen except the
> ADR-027 hotfixes. This page describes what runs today.

Zonna is a Next.js 14 App Router application backed by Supabase (Postgres + Auth), deployed on Vercel.
The iOS app is a **Capacitor shell** (`capacitor.config.ts`, bundle `app.zonna.ios`) that loads the same
Vercel-hosted app through `server.url` and layers native plugins on top (HealthKit, push, Sign in with
Apple, RevenueCat). There is one codebase for web and iOS.

- **Plans** live in the Supabase `plans` table (`plan_json`, one row per user). A legacy GitHub Gist is read
  only as a migrate-on-read source for a runner with no `plans` row (`fetchPlanForUser` in `lib/plan.ts`;
  contract `docs/contracts/api/plan-fetch.md`). Every plan write goes through `savePlanForUser`, which
  validates and archives the previous plan to `plan_archive` on a race change.
- **Generation** is one deterministic rule engine for every tier (`runEngine` in `lib/plan/engine.ts` →
  `generateRulePlan` in `lib/plan/ruleEngine.ts`, validated by `validatePlan()` in `lib/plan/invariants.ts`).
  AI is optional enrichment on top (ADR-006), never the generator. See § Plan Generation below.
- **Run data:** HealthKit is the system of record on iOS (ADR-011), ingested by `/api/health/ingest` into
  `strava_activities` (the source-agnostic activity log). Strava is an optional supplement: a Strava
  activity first tries to patch a matching HealthKit row (`tryEnrichHealthKitRow`). ⚠️ When no row matches,
  `app/api/webhooks/strava/route.ts` upserts a `source: 'strava'` row; ADR-011 and `CLAUDE.md` say such an
  activity is discarded. That disagreement is recorded here, not ruled on.
- **Theme:** a single light theme, Warm Slate (ADR-007, ADR-008). No dark mode, no `data-theme`, no toggle.

---

## Data Flow
```
Supabase `plans.plan_json` ◀── savePlanForUser ◀── /api/generate-plan (runEngine → optional enrich)
│                                               ◀── reshape / adjust / recalibrate / maintenance routes
▼
DashboardClient (fetches plan, overrides and settings once; passes them down as props)
│
├──▶ Today / Session / Plan / Coach / Me screens
│
HealthKit (iOS) ──▶ /api/health/ingest ──▶ strava_activities (source-agnostic activity log)
Strava webhook  ──▶ tryEnrichHealthKitRow (patch a matching HealthKit row; no match → upsert a Strava row)
```

---

## Key Files & Responsibilities

| File/Dir | Responsibility |
|---|---|
| `app/dashboard/DashboardClient.tsx` | Root client component; owns the global state fetch and the screen router |
| `app/auth/login/page.tsx` | Auth entry point (email/password, Google, Sign in with Apple) |
| `lib/plan.ts`, `lib/planRead.ts` | Plan read (`fetchPlanForUser`, `readPlanJson`) and the single write (`savePlanForUser`) |
| `lib/plan/engine.ts` | `runEngine`: the engine boundary every generation route calls |
| `lib/plan/ruleEngine.ts` | Deterministic plan construction |
| `lib/plan/invariants.ts` | `validatePlan()`: the constitutional check on every generated plan |
| `lib/plan/enrich.ts`, `lib/plan/freeIntro.ts` | AI enrichment (paid) and the free first-plan intro line |
| `lib/ai/callAnthropic.ts` | Single owner of every Anthropic call |
| `lib/trial.ts` | `resolveTier`: single owner of the tier order |
| `components/training/PlanCalendar.tsx` | Week/calendar view of training sessions |
| `components/training/PlanChart.tsx` | Visual chart of plan structure |
| `components/strava/StravaPanel.tsx` | Strava activity display (admin-only screen) |
| `app/globals.css` | Single source of all CSS custom properties (tokens) |
| `app/layout.tsx` | App shell |
| `capacitor.config.ts`, `ios/` | Native iOS shell |

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

Profile fields `first_name`, `last_name` and `email` are live columns (listed in
`lib/contracts/tableColumns.ts`, which records what the table actually has).

### `plans`
One row per user: `id`, `user_id`, `plan_json` (JSONB), `created_at`, `updated_at`. The only store a
runner's current plan is read from. Previous plans are kept in `plan_archive`.

### `session_completions`
Tracks which sessions the user has marked complete.

### `session_overrides`
Per-session overrides (e.g. swapped sessions, notes).

### `session_reflections`
Post-run reflective notes + AI reframe output (POST-RUN-REFRAME-01). Composite key `(user_id, week_n, session_day)` matching `session_completions`. Stores the runner's reflection text + the Sonnet reframe, or a silenced flag when the risk gate fires. Voice metadata columns (`note_source`, `voice_duration_s`, `voice_transcript_confidence`) pre-wired for POST-RUN-REFRAME-02 (voice memo follow-up).

---

## Plan Data Schema (`plans.plan_json`)

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

**One engine for every tier.** `/api/generate-plan` calls `runEngine` (`lib/plan/engine.ts`), which runs the
deterministic rule engine and `validatePlan()`. The engine is tier-blind in what it prescribes (ADR-003: the
route is the auth boundary). The tier changes only what AI adds afterwards (ADR-006, hybrid generation):

### Free tier
- The rule plan is returned as JSON with `meta.enrichment = 'skipped'`. No enrichment.
- **One AI call, on the runner's first plan only:** `generateFreeIntro` (`lib/plan/freeIntro.ts`) is awaited
  when the user has no `plans` row yet and writes one short line to `meta.plan_intro` (model
  `ANTHROPIC_MODEL`). Any failure leaves the rule plan unchanged. Later free plans make no AI call.

### Paid / trial tier
- The route streams NDJSON: the rule plan first (`type: 'rule_plan'`), then the enriched plan
  (`type: 'final_plan'`) once `enrich()` (`lib/plan/enrich.ts`) finishes. Enrichment adds voice, coaching copy
  and a confidence assessment; it never changes the prescription.
- Enrichment runs under `waitUntil`, so it can persist after the response ends. If it fails, the rule plan
  stands and the failure is recorded in `meta.enrichment`.

All model calls go through `lib/ai/callAnthropic.ts`; model IDs live in `lib/ai/models.ts`.
See `docs/contracts/api/generate-plan.md` for the full route contract and
`docs/contracts/engine.md` for the engine boundary.

---

## Zone Method

Current implementation supports two zone formulas: Karvonen (Heart Rate Reserve) when the user's resting HR is known, % MaxHR otherwise. Both produce the same five named zones (Z1–Z5). Zone constants live in `GENERATION_CONFIG.ZONES` (`lib/plan/generationConfig.ts`); every consumer (rule engine, `aerobicPace.ts`, `coachingFlag.ts`, UI surfaces) reads from this single source. See `docs/canonical/zone-rules.md` for the table.

**Zone method selector** (user-configurable, stored in `user_settings.zone_method`) is a PAID feature scheduled but unstarted. The forward-compat hook lives in `GENERATION_CONFIG.ZONES`: adding Daniels, Coggan, or Friel is a new key under `ZONES` plus one lookup in `computeZones()`. No engine or consumer change required.

---

## Plan Storage

Plan JSON is stored in the Supabase `plans` table. The Gist → Supabase migration described in earlier
versions of this page is done: `fetchPlanForUser` reads `plans` first, and migrates a legacy `gist_url` or
`user_settings.plan_json` into `plans` on first read. A failed `plans` read throws `PlanReadError` rather than
falling through, so a legacy plan is never saved over a current one. ADR-002's JSON-first output is what made
the storage layer swappable.

---

## AI Call Routing Invariant

All calls to the Anthropic API must route through Next.js API routes (server-side). Client components must never hold or use the `ANTHROPIC_API_KEY` directly.

This applies to:
- Plan enrichment and the free first-plan intro (`/api/generate-plan`)
- Plan adjustment, reshaping and recalibration routes (`/api/adjust-plan`, `/api/post-race-reshape`, …)
- Coaching surfaces (daily coach note, run analysis, weekly report, post-run reframe; Coach screen is paid/trial)
- Any future AI feature

The `ANTHROPIC_API_KEY` environment variable must remain server-only. It must not be prefixed with `NEXT_PUBLIC_`.

---

## Auth Flow

- Supabase Auth: email/password, Google OAuth and Sign in with Apple (`app/auth/login/page.tsx`)
- On iOS, OAuth opens in `@capacitor/browser` and returns via the `app.zonna.ios://auth-callback` scheme
- Session persisted via Supabase client
- Strava OAuth separate; tokens stored in `user_settings` and refreshed by `/api/strava/refresh`

---

## Strava Integration

- Optional supplement to HealthKit (ADR-011). No paid feature requires Strava
- A Strava activity first patches a matching HealthKit row (`tryEnrichHealthKitRow`); see § System Overview for what the webhook does when none matches
- `/api/webhooks/strava` is the only device-independent auto-link when the app is killed
- OAuth tokens stored in Supabase `user_settings`; refresh via `/api/strava/refresh`
- OAuth testing: Hoppscotch only (curl multi-line fails on Mac Terminal)

---

## Theme System

- Single light theme, Warm Slate (ADR-007, ADR-008). No dark mode and no theme toggle
- Single `app/globals.css` holds all CSS custom properties
- No `data-theme` attribute and no `setProperty()` calls; `applyTheme()` no longer exists
- Components reference tokens only — no hardcoded values (enforced by the pre-commit hook and `npm run sweep:colours`)

---

## Metric Exclusion Invariant (INTERNAL-ACCOUNTS-01)

**All user metrics exclude `is_admin` AND `is_internal`.**

`user_settings.is_internal` marks a non-admin internal account — tester, friend, Apple App
Review, demo. It is a **reporting flag and grants nothing**: `resolveTier` remains the single
owner of access (admin → subscription → grant → trial → free) and never reads it, so testers
keep receiving plans, coaching, emails and push. That is deliberate; they are the QA population.

**One owner: `public.v_metric_users`** — the set of users that count toward metrics. Every
user-metric view joins it rather than restating the predicate.

```sql
create or replace view public.v_metric_users as
  select s.id as user_id from public.user_settings s
  where not coalesce(s.is_admin, false)
    and not coalesce(s.is_internal, false);
```

🔴 **There was no mechanism to copy, which is why this exists.** Before 2026-11-11, of the five
metric views only `v_trial_conversion` referenced `is_admin` at all — and it did not filter on
it. Three shapes were in use: a tier **ladder** (`admin_user_tiers`, so admins fall out of
`v_paying_users` as a side effect of never being `'premium'`), a **`_real` boolean** plus a
`looks_like_test` email heuristic (`v_trial_conversion`), and **nothing** (`v_coach_engagement`,
`v_partner_cohort`, `v_hr_present_pct`).

**Two shapes obey the rule**, and the gate accepts both:
- **join `v_metric_users`** — for a view that should not contain the rows at all;
- **expose `is_internal` and exclude it in the computed column** — for a row-per-user analytical
  view like `v_trial_conversion`, which must keep the internal rows in order to mark them.

**Exempt by kind, not by debt:** `admin_user_directory` and `admin_user_tiers` are admin views and
must SHOW the flag; `v_paying_users` counts *tiers*, not users, so a `where` clause there would be
wrong rather than redundant.

⚠️ **`v_partner_cohort` is split.** Capacity columns (`codes_minted`, `codes_redeemed`,
`grants_active`) are the **batch's** record of its own capacity, not user metrics, and
`GTM-CHARITY-07` is ratified that a seat is spent when it was claimed. Filtering a tester out of
them would make a partner's redeemed count disagree with `charity_codes`. Engagement columns are
filtered.

**Gate:** `lib/ops/metricViewExclusion.test.ts`. It scans migrations from
`20261111_internal_accounts.sql` onward, so a new metric view is in scope the moment it is
written. ⚠️ It proves what we WROTE, not what is APPLIED — `npm run check:db` is the live-schema
check and is not in `verify:ci`.

🔴 **Related, and worse than the task that found it:** the `user_settings` UPDATE policy is
`USING (auth.uid() = id)` with **no `WITH CHECK`**, and `authenticated` held table-wide UPDATE on
all 45 columns — so a signed-in user could set `is_admin = true` on their own row and obtain
`{tier:'paid', reason:'admin'}`. Closed by `revoke update (is_admin, is_internal,
internal_reason) … from anon, authenticated`. See
`docs/decisions/2026-11-11-internal-accounts.md`.

## Deployment

- Vercel auto-deploys from GitHub main branch
- Workflow: build-check locally → commit → push → Vercel deploys
- No build log tailing required before deploy