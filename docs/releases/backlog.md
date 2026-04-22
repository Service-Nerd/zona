# Backlog — Zona

## Status Key
- ✅ Shipped
- 🔄 In Progress
- 🔲 Not Started

---

## What's Shipped

| Release | Summary |
|---------|---------|
| R0–R15b | Core app shell (Today, Plan, Me, Coach screens), nav, screen guide popups, localStorage, profile screen, smoke tracker, theme toggle |
| R17 | RPE + fatigue tags, progress bar, post-log reflect view, Zona voice responses |
| Session Card Redesign | New card hierarchy, zone chip, metric grid, execution summary, coaching flag badge |
| Coaching Signal | `coaching_flag` + `avg_hr` on session completions, `getCoachingFlag()` pure function, DB migration deployed |
| Architecture hygiene | Pre-commit hook, `lib/session-types.ts`, CSS token audit, ADRs 001–004, docs restructure |
| UX audit (P1–P3) | Race countdown, week narrative, fatigue trend, HR zone labels, post-log reflect, Coach fallback, fatigue-informed session framing, fitness-level copy, first name greeting, Strava reconnect flow, past session log state, weekly session count, palette + font audits — all shipped |
| App Store basics | Error boundary, Strava OAuth disclosure, privacy policy link pre-login, 13+ age gate |
| R23 — Plan generator | Hybrid generation (ADR-006): rule engine always runs, AI enricher for trial/paid with silent fallback. Tier-divergent wizard (3-step free / 4-step paid). Generating Ceremony. Free users now get plans (403 removed). `lib/plan/ruleEngine.ts`, `enrich.ts`, `generate.ts`. |
| R0.5 — Onboarding | New user auto-routed to wizard on empty plan. Wizard state persisted in sessionStorage. Upgrade-from-wizard routing. Plan archive (data protection). Welcome screen bug fixed. |
| Design system fixes | Zone colour coherence (Z1–Z5 now match session type colours). `--red` token removed. Strava HR colour fixed. Plan overwrite warning. `ui-patterns.md` zone invariant documented. |
| Login + loading screen audit | Login heading/subtext now mode-aware. Tagline aligned to canonical copy. Loading button copy improved. Signup subtext surfaces 14-day trial. Spinner removed from loading state (no-spinner principle). Google Fonts weight range extended to 400;500;600;700 — bold metrics and headings now render at correct weight throughout the app. |
| Strava coaching features (Phases 1–5) | Full coaching pipeline: per-session run analysis (4-dimension scoring: HR discipline 50%, distance 25%, pace 15%, EF 10%), weekly report generation, AI-generated feedback and report copy (claude-haiku-4-5-20251001, silent fallback to rule-based). Strava webhook for auto-analysis pipeline. Coach tab enabled for paid users (was admin-only). Dynamic plan adjustment triggers + revert. Push notifications (web-push + VAPID, service worker, Vercel cron Sunday 18:00). `lib/coaching/` module tree with constants, scoring, matching, EF trend, load calc, weekly report, plan adjustment, AI prompt templates. 6 Supabase migrations: run_analysis, weekly_reports, plan_adjustments, strava_activities, strava_athlete_id, dynamic_adjustments_enabled, push_subscriptions. R20 dynamic reshaping merged into Feature 3 (plan adjustment triggers). |

---

## v1 App Store Launch Roadmap

### Decisions resolved

| # | Decision | Resolution |
|---|----------|------------|
| D1 | **StoreKit (Apple IAP) vs web checkout** | ✅ RevenueCat + StoreKit 2 for iOS; Stripe for web. See ADR-005. |
| D2 | **Upgrade prompt UX** | ✅ Dedicated full screen (`UpgradeScreen`). Shipped. |
| D3 | **Gist → Supabase migration timing** | ✅ Before launch. Required for onboarding. |
| D4 | **Final pricing** | ✅ £7–10/month billed annually. Exact price TBD but does not block build work. |

---

### Phase 1 — Legal & Platform Compliance
**All P0. Apple will reject without every item here.**

| Item | Status | Notes |
|------|--------|-------|
| Sign in with Apple | 🔲 Not Started | Apple §5.1.1d — mandatory when any other social login is present (Google OAuth is). |
| Account deletion flow | ✅ Shipped | Me screen → `DeleteAccountScreen` → `/api/delete-account` → cascade delete session_completions + subscriptions + user_settings + auth user. |
| Terms of Service | 🔲 Not Started | Required for any app with accounts or IAP. Write, host at public URL, link pre-login alongside privacy policy. |
| Privacy policy hosted | 🔲 Not Started | Page is built (`/privacy`). Needs to be live at `zona.app/privacy` before submission. |
| StoreKit 2 integration **or** External Purchase Entitlement | 🔲 Not Started | Depends on D1 above. If IAP: implement StoreKit 2 purchase + receipt validation. If web checkout: apply for entitlement — not guaranteed and slow. |
| Subscription terms disclosure UI | 🔲 Not Started | Apple requires price, billing frequency, 14-day trial length, and auto-renewal terms shown before user subscribes. |
| App Store Connect setup | 🔲 Not Started | Active developer account, app record, subscription product (ID + pricing tiers + trial config), screenshots for all required device sizes, App Store description and keywords. |

---

### Phase 2 — Infrastructure
**Blocks all new-user flows. Must ship before Phase 3.**

| Item | Status | Notes |
|------|--------|-------|
| Subscription webhooks | ✅ Shipped | `/api/webhooks/stripe` + `/api/webhooks/revenuecat`. `subscriptions` table live in Supabase. ADR-005. |
| Gist → Supabase plan storage | ✅ Shipped | `plans` table with RLS. `fetchPlanForUser` + `savePlanForUser` in `lib/plan.ts`. Auto-migration from gist_url/plan_json on first load — all 4 existing users migrated transparently. Contract: `docs/contracts/api/plan-fetch.md`. Known gap: admin impersonation falls back to gist_url for migrated users (needs service-role admin route, tracked as tech debt). |
| Reverse trial infrastructure | ✅ Shipped | `lib/trial.ts` — `isTrialActive()` + `hasPaidAccess()`. `trial_started_at` set on first load. Gates on `/api/generate-plan`, `/api/claude`, `/api/strava/callback`. `UpgradeScreen` (dedicated screen, D2 resolved). `/api/checkout` stub ready for Stripe wiring. Migration: `20260422_trial_started_at.sql` — apply in Supabase. |

---

### Phase 3 — Onboarding
**The core new-user journey. No new user can reach the product without this.**

| Item | Status | Notes |
|------|--------|-------|
| Rule-based plan engine | ✅ Shipped | `lib/plan/ruleEngine.ts` + `lib/plan/enrich.ts` + `lib/plan/generate.ts`. Hybrid architecture: rule engine always runs; AI enricher runs for trial/paid (silent fallback). Route rewritten to remove 403 for free users. `lib/trial.ts` adds `getUserTier()`. |
| Generating Ceremony | ✅ Shipped | `components/GeneratingCeremony.tsx`. Skeleton shimmer + staged ZONA copy + phase-arc reveal (80ms stagger). Tier-divergent: 3-line/1.8s-min for free, 5-line/3.6s-min for paid/trial. Replaces interim spinner. |
| Wizard tier-divergence | ✅ Shipped | `GeneratePlanScreen` is 3-step for free (teaser card above CTA), 4-step for paid/trial. Error retry and back routing are tier-aware. All hardcoded fonts fixed. Red replaced with amber throughout. |
| R0.5 — Onboarding flow | ✅ Shipped | New user → auto-route to wizard (empty plan detection). Wizard state persisted in sessionStorage (survives back-nav + upgrade flow). Upgrade-from-wizard routing: after UpgradeScreen, draft resumes wizard. Plan archive: previous plan archived to `plan_archive` table before overwrite. OrientationScreen shown post-save. Welcome screen bug fixed (new users skip the "Your plan is ready" screen). Migration: `20260424_plan_archive.sql`. |

---

### Phase 4 — Pre-submission Quality

| Item | Status | Notes |
|------|--------|-------|
| TestFlight beta | 🔲 Not Started | Internal testing on device before public submission. |
| Full journey test | 🔲 Not Started | Tested end-to-end with agent-browser: create account → onboarding → plan on screen → log session → post-log reflect → simulate trial end → attempt paid feature → upgrade prompt. |
| App Store assets | 🔲 Not Started | Screenshots (all required device sizes), preview video (optional), keywords, App Store description copy. |

---

### Launch Config Checklist
**Non-code tasks that must be done before go-live. No code changes required — ops/dashboard work.**

| Item | Status | Notes |
|------|--------|-------|
| Apply migration `20260422_trial_started_at.sql` | ✅ | `ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ` |
| Set `STRIPE_PRICE_MONTHLY` + `STRIPE_PRICE_ANNUAL` in Vercel | 🔲 | Price IDs from Stripe dashboard after creating product |
| Set `STRIPE_SECRET_KEY` in Vercel | 🔲 | Stripe dashboard → Developers → API keys |
| Set `STRIPE_WEBHOOK_SECRET` in Vercel | 🔲 | Stripe dashboard → Webhooks → add endpoint `https://zona-service-nerds-projects.vercel.app/api/webhooks/stripe`, copy signing secret |
| Set `REVENUECAT_WEBHOOK_SECRET` in Vercel | 🔲 | RevenueCat dashboard → Integrations → Webhooks → set URL + copy secret |
| Set `SUPABASE_SERVICE_ROLE_KEY` in Vercel | 🔲 | Supabase dashboard → Settings → API → service_role key (keep secret) |
| Create Stripe product + price | 🔲 | Product: "Zona Premium", Price: TBD (depends on D4), billing: monthly + annual, 14-day trial |
| Configure RevenueCat app + entitlement | 🔲 | Link to App Store product ID, set entitlement identifier (e.g. `zona_premium`) |
| Enrol in Apple Small Business Program | 🔲 | 15% vs 30% cut — do before first live transaction |
| Point `zona.app/privacy` at live URL | 🔲 | Privacy policy page built, needs custom domain live |
| Apply 6 coaching migrations in Supabase SQL editor | 🔲 | `20260425_run_analysis.sql`, `20260425_weekly_reports.sql`, `20260425_plan_adjustments.sql` (includes strava_activities), `20260425_strava_athlete_id.sql`, `20260425_dynamic_adjustments.sql`, `20260425_push_subscriptions.sql` |
| Set `STRAVA_WEBHOOK_VERIFY_TOKEN` in Vercel | 🔲 | Any secret string — used to verify Strava webhook subscription challenge |
| Set `CRON_SECRET` in Vercel | 🔲 | Any secret string — protects `/api/push/send-weekly-report` cron endpoint |
| Generate VAPID keys and set in Vercel | 🔲 | `npx web-push generate-vapid-keys` → set `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (e.g. `mailto:push@zona.app`) |
| Set `NEXT_PUBLIC_APP_URL` in Vercel | 🔲 | e.g. `https://zona-service-nerds-projects.vercel.app` — used by cron to call internal API routes |
| Register Strava webhook subscription | 🔲 | POST to Strava API with callback URL `https://zona-service-nerds-projects.vercel.app/api/webhooks/strava` after VAPID/env vars are set and app is deployed |

---

## v1 SLC — What Ships, What Doesn't

### In v1
1. Create account (email/password + Sign in with Apple + Google)
2. Onboarding questionnaire → plan on screen in under 3 minutes
3. Today screen — session with zone, HR, and pace targets
4. Log a session (manual or Strava) → post-log reflect (RPE + feel + Zona voice)
5. Plan screen — full training plan view
6. Me screen — profile, HR zones, Strava connection, theme
7. 14-day full access trial → graceful downgrade to free tier
8. Free tier: template plans, session tracking, formula-derived targets

### Explicitly out of v1
| Feature | Why deferred |
|---------|-------------|
| Plan confidence score (R18) | PAID, post-launch. |
| Strength sessions full content (R21) | Admin-only for launch — ghost feature, hidden from public view. |
| Blockout days (R22) | PAID, post-launch. |
| Multi-race support (R24) | PAID, post-launch. |
| Plan generator wizard UI (R23b) | PAID, post-launch. |

---

## Post-Launch Roadmap

Ordered by value. Each item needs FREE/PAID tag confirmed in `docs/canonical/feature-registry.md` before build begins.

### R18 — Plan Confidence Score
**Tier:** PAID
- Derive confidence score from recent session completion + RPE data
- R17 coaching flags are the per-session atom this aggregates
- Display on dashboard or plan screen

### R19 — Coaching Tips in Supabase
**Tier:** PAID
- Move hardcoded coaching copy into Supabase table
- Enables dynamic, user-specific coaching messages

### R20 — Dynamic Plan Reshaping ✅ Merged into coaching pipeline
**Tier:** PAID | **Status:** Core shipped as Feature 3 (plan adjustment triggers)
- Adjustment triggers shipped: load_spike, zone_drift, shadow_load, ef_decline — auto-apply low-risk, confirm-required for significant
- Plan adjustment API: `/api/adjust-plan` + `/api/revert-adjustment` (full revert to sessions_before snapshot)
- Hard caps enforced: max 2 adjustments/week, 3-week taper protection, 10% max volume increase, 48hr quality spacing
- Remaining post-launch: user-initiated reshape flow (manual trigger from Me screen), phase-aware reshaping using `Plan.phases[]`

### R21 — Strength Sessions
**Tier:** FREE (display stubs) / PAID (dynamic)
- Flesh out strength session stubs in plan JSON
- Session cards with appropriate UI treatment
- Currently: admin-only, hidden from public plan + today view

### R22 — Blockout Days
**Tier:** PAID
- User marks days unavailable; plan reshapes around them

### R23b — Plan Generator Wizard UI
**Tier:** PAID
- Multi-step wizard replacing the current form
- One question per screen with progress indicator
- Better mobile UX for longer forms

### R24 — Multi-Race Support
**Tier:** PAID
- Support multiple target races per user (A/B race hierarchy)
- **Schema path**: Current `meta.race_date` and `meta.race_name` are canonical primary-race fields and remain unchanged. R24 will introduce `meta.races: Race[]` as a non-breaking additive field. `Plan.phases[]` (added in R23) provides the structure for multi-race periodisation — phases can be anchored to different race targets.

---

## Scoped But Unscheduled

| Feature | Tier | Notes |
|---------|------|-------|
| Estimated race times | PAID | 5K/10K/HM/Marathon — data-driven |
| Zone method selector | PAID | User chooses HR zone calculation method; stored in `user_settings` |

---

## Parking Lot (Deprioritised)

| Feature | Tier |
|---------|------|
| Session swap | PAID |
| AM/PM scheduling | PAID |

---

## Scoped But Unscheduled — Ops

| Item | Notes |
|------|-------|
| Rename Vercel project to `zona` (or `zona-app`) | Currently `zona-service-nerds-projects` — taken at rename time. Pick a cleaner name when available, then update `NEXT_PUBLIC_APP_URL` env var, `CLAUDE.md`, `docs/releases/backlog.md`, and `app/api/checkout/route.ts` fallback. |

---

## Tech Debt

| Item | Status |
|------|--------|
| Strava token refresh | Not started — currently single-use; needs cache + refresh logic |
| `login/page.tsx` hardcoded values | ✅ Audited and fixed — heading, tagline, copy, spinner all corrected |
| `PlanCalendar` `stravaRuns` prop | Accepted but unused in WeekCard — remove or wire up |
| `DashboardClient.tsx` hardcoded fonts | ~228 occurrences of `'Inter', sans-serif` / `'Space Grotesk', sans-serif` hardcoded; 7 instances of `'Inter', monospace` (wrong fallback) |
| `nextMonday()` UTC drift in `route.ts` | ✅ Fixed — route.ts rewritten in R23; now uses `lib/plan/length.ts` `parseDateLocal()` throughout |
| Tier-divergent rendering utility | Once a second tier-divergent component lands (after `GeneratingCeremony.tsx`), centralise the `tier` prop pattern into a shared context or typed prop convention. Document as a pattern in `ui-patterns.md`. |
| Plan history UI | Data is archived to `plan_archive` table (migration `20260424`). UI (browse archived plans + restore) deferred post-launch. Schema has `race_name`, `race_date`, `archived_at` for future list display. |

---

## Archive — Shipped UX Audit (2026-04-18)

All items below are complete. Preserved for context.

| # | Title | What it fixed |
|---|-------|--------------|
| UX-01 | Fatigue tag vocabulary | Standardised to `Fresh / Fine / Heavy / Wrecked` everywhere |
| UX-02 | Me screen IA | Grouped into Profile / Training / Connections / App Settings |
| UX-03b | Post-log reflect view | RPE + feel + Zona voice after every session log or skip |
| UX-04 | Coach fallback (no Strava) | Plan-aware static coaching when no Strava activity present |
| UX-05 | Fatigue-informed session framing | Contextual note on today's card when 3+ heavy fatigue logs |
| UX-05b | Fitness-level copy | Beginner vs experienced copy in rest + coach screens |
| UX-06 | First name in greeting | `firstName` used in RestDayCard and Coach screen header |
| UX-07 | Post-wizard orientation screen | Week number + first session + zone explanation after plan generation |
| UX-08 | Strava reconnect flow | Expired token surfaced as actionable prompt in Coach screen |
| UX-09 | Past session "not logged" state | Log label on past unlogged dots in CalendarOverlay |
| UX-10 | Weekly session count on Plan screen | Done/total mirrors Today screen narrative |
| UX-11 | `session-types.ts` hex audit | All hardcoded hex replaced with `var(--session-*)` CSS vars |
| UX-12 | `PlanChart.tsx` + `StravaPanel.tsx` audit | All hardcoded hex/rgba replaced with CSS vars |
