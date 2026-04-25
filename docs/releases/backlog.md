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
| D4 | **Final pricing** | ✅ £7.99/month, £59.99/year. Parameterised in `lib/brand.ts` — never hardcoded. |
| D5 | **Canonical tagline** | ✅ **"Slow down. You've got a day job."** — all surfaces. Speaks directly to the target user's identity; names a person, not just a training approach. "Slow down. You're not Kipchoge." demoted to brand statement (editorial/App Store only). "Do less. Improve more.", "The slowest way to get faster.", and "effort-first training" retired. All strings live in `lib/brand.ts`. |
| D6 | **Monthly price** | ✅ £7.99/month, £59.99/year. Hold. Parameterised so it can be adjusted in `lib/brand.ts` without a search-replace. Annual discount currently 37% (category norm 44–49%) — revisit after first 100 paid users. |
| D7 | **Marketing site** | ✅ In-app Next.js page (replaces `app/page.tsx` redirect). Deferred — ships post-launch Phase 1 compliance. Not a separate domain. |
| D8 | **Zone discipline score for free users** | ✅ **Locked teaser on Coach tab.** Free users see the score category (zone discipline) in a locked/blurred state with upgrade CTA. Does not expose paid data. Mirrors the wizard teaser card pattern. Makes the upgrade value tangible without giving away the coaching signal. |
| D9 | **"effort-first training" sub-tagline** | ✅ Removed. Replace all instances with `BRAND.tagline` from `lib/brand.ts`. OrientationScreen is the only current location. |

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
| Wizard tier-divergence | ✅ Shipped | R23b: one-question-per-screen sub-step wizard. 8 steps (free) / 12 steps (paid/trial). Teaser card on constraints step for free users. Slide transitions, progress dots, OptionCard selectors. |
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
| Apply 6 coaching migrations in Supabase SQL editor | ✅ | `20260425_run_analysis.sql`, `20260425_weekly_reports.sql`, `20260425_plan_adjustments.sql` (includes strava_activities), `20260425_strava_athlete_id.sql`, `20260425_dynamic_adjustments.sql`, `20260425_push_subscriptions.sql` |
| Apply migration `20260428_orientation_seen.sql` | 🔲 | `ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS orientation_seen BOOLEAN DEFAULT FALSE` |
| Set `ANTHROPIC_API_KEY` in Vercel | ❓ confirm | Required for paid/trial plan enrichment (AI labels, coach intro, confidence score) and coaching pipeline (session feedback, weekly report, adjustment explanations). **Free-tier plan generation works without it** — rule engine has no AI dependency. If not set, enricher silently returns rule-engine plan. |
| Set `STRIPE_PRICE_MONTHLY` + `STRIPE_PRICE_ANNUAL` in Vercel | 🔲 | Price IDs from Stripe dashboard after creating product |
| Set `STRIPE_SECRET_KEY` in Vercel | 🔲 | Stripe dashboard → Developers → API keys |
| Set `STRIPE_WEBHOOK_SECRET` in Vercel | 🔲 | Stripe dashboard → Webhooks → add endpoint `https://zona.vercel.app/api/webhooks/stripe`, copy signing secret |
| Set `REVENUECAT_WEBHOOK_SECRET` in Vercel | 🔲 | RevenueCat dashboard → Integrations → Webhooks → set URL + copy secret |
| Set `SUPABASE_SERVICE_ROLE_KEY` in Vercel | 🔲 | Supabase dashboard → Settings → API → service_role key (keep secret) |
| Create Stripe product + price | 🔲 | Product: "Zona Premium", Price: £7.99/month + £59.99/year, 14-day trial |
| Configure RevenueCat app + entitlement | 🔲 | Link to App Store product ID, set entitlement identifier (e.g. `zona_premium`) |
| Enrol in Apple Small Business Program | 🔲 | 15% vs 30% cut — do before first live transaction |
| Point `zona.app/privacy` at live URL | 🔲 | Privacy policy page built, needs custom domain live |
| Set `STRAVA_WEBHOOK_VERIFY_TOKEN` in Vercel | 🔲 | Any secret string — used to verify Strava webhook subscription challenge |
| Set `CRON_SECRET` in Vercel | 🔲 | Any secret string — protects `/api/push/send-weekly-report` cron endpoint |
| Generate VAPID keys and set in Vercel | 🔲 | `npx web-push generate-vapid-keys` → set `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (e.g. `mailto:push@zona.app`) |
| Set `NEXT_PUBLIC_APP_URL` in Vercel | 🔲 | `https://zona.vercel.app` — used by cron to call internal API routes |
| Register Strava webhook subscription | ✅ | Subscription ID: `342248`. Callback: `https://zona.vercel.app/api/webhooks/strava`. To delete: `DELETE https://www.strava.com/api/v3/push_subscriptions/342248` with client_id + client_secret. |

---

## GTM & Commercial

Findings from the 2026-04-22 GTM audit (`docs/gtm/audit-2026-04-22.md`). Ordered by impact × ease. Items marked **pre-launch** must ship before App Store submission; items marked **post-launch** follow the store release.

### Decisions behind this section
D5–D9 resolved above. Key: tagline is "Slow down. You've got a day job." everywhere; all brand strings and pricing live in `lib/brand.ts`; zone discipline score shown as locked teaser to free users.

### Pre-launch GTM — Ship before App Store submission

| # | Item | Effort | Tier | Notes |
|---|------|--------|------|-------|
| GTM-01 | **Brand constants rollout** | S | FREE (infra) | ✅ Shipped. `lib/brand.ts` created and wired to: login tagline, loading screen, welcome screen, OrientationScreen (replaces "effort-first training"), push notification title, UpgradeScreen pricing. |
| GTM-02 | **Copy fixes — voice batch** | S | FREE | ✅ Shipped. All 7 strings replaced. See list below. |
| GTM-03 | **UpgradeScreen rewrite** | S | PAID | ✅ Shipped (copy + feature list). "Get Zona Premium" → "Start your subscription". "BEST VALUE" → `PRICING.annual.savingLabel`. Feature list reordered: weekly zone coaching first. Remaining: trial loss framing variant (GTM-04). |
| GTM-04 | **UpgradeScreen — trial loss framing** | S | PAID | ✅ Shipped. `trialExpired` state tracked in DashboardClient, passed to UpgradeScreen. When expired: headline "Your coaching has paused.", sub "14 days done. Here's what stopped.", amber-accented LOSSES list (zone coaching, weekly reports, session feedback, plan adjustments). Gain framing unchanged for non-expired gate. |
| GTM-05 | **Zone discipline teaser (Coach tab, free users)** | M | TIER-DIVERGENT | ✅ Shipped. Coach tab now always visible in More nav for all users. Free users see `CoachTeaser` component: locked report card anatomy (muted/dimmed), locked zone discipline + load ratio stats (—), teal-accent teaser card with upgrade CTA. Paid users see full `CoachScreen` unchanged. |
| GTM-06 | **Post-session Strava prompt (free users)** | S | TIER-DIVERGENT | ✅ Shipped. Prop chain: DashboardClient → SessionScreen → SessionPopupInner. Free users see "Connect Strava to see how your HR compared. →" below the Done button in the reflect view. Taps to upgrade screen (Strava is PAID). |
| GTM-07 | **OG / social image** | S | FREE (ops) | ✅ Shipped. Dynamic `app/api/og/route.tsx` using `next/og` ImageResponse (edge runtime). 1200×630, navy bg, teal left accent bar, Space Grotesk wordmark + tagline from `BRAND`. Layout metadata updated: title, description, openGraph, twitter card — all from `lib/brand.ts`. |

#### GTM-02 copy fixes detail

| Surface | File | Current | Replace with |
|---------|------|---------|-------------|
| Login signup sub | `app/auth/login/page.tsx` line ~97 | "Your 14-day trial starts today." | `BRAND.signupSub` — "14 days, no limits. After that, you decide." |
| Push notification title | `app/api/push/send-weekly-report/route.ts` line ~55 | "Zona · Weekly report" | `BRAND.push.weeklyReport` — "Your week, reviewed." |
| Skip confirm | `DashboardClient.tsx` line ~1989 | "Mark this session as skipped? It will show in your log." | "Skip it. It'll stay in your log." |
| Coach empty state | `DashboardClient.tsx` line ~3681 | "Log some sessions and runs to generate this week's coaching report." | "Log a few sessions first. The report needs something to work with." |
| Plan generation error | `GeneratePlanScreen.tsx` line ~578 | "Could not generate plan" | "Something went wrong building the plan." |
| Teaser card CTA | `GeneratePlanScreen.tsx` line ~329 | "Free trial →" | "Upgrade to personalise →" |
| OrientationScreen sub | `DashboardClient.tsx` line ~886 | "effort-first training" | `BRAND.tagline` — "Slow down. You've got a day job." |

---

### Post-launch GTM — After App Store release

| # | Item | Effort | Tier | Priority | Notes |
|---|------|--------|------|----------|-------|
| GTM-08 | **Marketing site (app/page.tsx)** | M | FREE | High | Replace dashboard redirect with one-page site: overtraining thesis, Zona voice, single CTA (sign up / download). Uses `lib/brand.ts` for all copy. Screenshots: session card, reflect view, coach screen. Must exist before any paid acquisition or press. |
| GTM-09 | **Trial expiry email** | M | PAID | High | Single Zona-voice email at trial day 14. Subject and body reference zone discipline coaching specifically — not abstract features. "Your zone coaching pauses today." Include upgrade CTA. Requires email platform (Resend or Supabase Edge Function + SMTP). |
| GTM-10 | **Trial nudge email (day 11)** | S | PAID | Medium | "3 days of full access left." Zona voice. Links to UpgradeScreen. Ships with GTM-09 — same infrastructure. |
| GTM-11 | **Pricing review** | — | — | Low | Annual discount currently 37% vs category norm 44–49%. Monthly is parameterised via `lib/brand.ts` — can raise to £9.99/month (50% annual discount) without a code search-replace. Revisit after first 100 paid conversions. |

---

## Post-testing UX Backlog (2026-04-24)

Items identified from device testing. Decisions logged in `docs/alignment/phase-4-decisions.md`.

| # | Item | Effort | Priority | Notes |
|---|------|--------|----------|-------|
| UX-01 | **Review name/email fields on Profile screen** | S | Low | Name is actively used (greeting, initials, header). Email is a no-op — auth identity can't be changed without re-verification flow. Decision: keep for now; review whether email field should be read-only or removed before launch. |
| UX-02 | ~~**Branding task: review brandStatement on login footer**~~ | S | Low | ✅ Done. brandStatement updated to "You can't outrun your easy days." Removed from login (tagline owns that space). Kept on privacy footer + meta. |
| UX-03 | ~~**Header analysis — complete before building**~~ | S | Medium | ✅ Done. Plan: race name as title, week+days as sub. Profile: text back-arrow, first name as title, race sub. Coach: week format aligned. Decisions 19–21. |

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

## R23 Rebuild — In Progress (2026-04-25)

Rebuild of the rule engine and configuration based on a coaching audit. Architectural rebuild, not a tuning job. End state: all coaching constants in a single config file, a session catalogue table replaces generic "quality" sessions, distance-specific plan signatures drive differentiation, universal run format template, feature gates implementing reverse trial Option A.

**Doctrine documents:**
- `docs/canonical/CoachingPrinciples.md` — the constitution (18 principles)
- `docs/canonical/session-catalogue.md` — domain doc for the 14 sessions
- `docs/architecture/ADR-009-config-driven-generation.md`
- `docs/architecture/ADR-010-session-catalogue.md`

**Decisions captured (2026-04-25):**
- Marathon stays PAID (not free per spec).
- Trial start trigger stays on first dashboard load (not first plan generation per spec).
- HR zones: adopt spec Z1–Z5 straight; display + scoring both at 70% HRR easy cap.
- Phase distribution: 35/35/15/taper (per spec).
- Taper duration: 10/14/21/28 days by distance (per spec).
- Quality cap: max 2 per week (override spec's 3 for experienced).
- Hard→long gap: 48 h (override spec's 24 h — typo).
- PlanMeta legacy: hard-remove `motivation_type` and `training_style`.
- SessionType vs catalogue category: two orthogonal taxonomies kept separate.

**Phases:**
| Phase | Status |
|---|---|
| Phase 0 — Pre-flight audit | ✅ Complete |
| Phase 0.5 — Documentation updates | ✅ Complete |
| Phase 1 — Foundation: config + catalogue | ✅ Complete |
| Phase 2 — Consumer migration | ✅ Complete |
| Phase 3 — New coaching rules | ✅ Complete (3.1–3.11) |
| Phase 4 — Universal run format composer | ✅ Logic complete; UI integration deferred (`docs/alignment/phase-4-ui-followup.md`) |
| Phase 5 — Wizard changes | ⏸ Deferred — see `docs/alignment/phase-5-wizard-followup.md` |
| Phase 6 — Feature gates (Option A) | ✅ Server-side helper shipped; day-15 UI deferred (`docs/alignment/phase-6-gates-followup.md`) |
| Phase 7 — Validation matrix | ✅ 11/11 cases pass; intensity dist flagged as known engine gap |
| Phase 8 — Release wrap | ✅ Complete |

**Known gaps for follow-up:**
1. Wizard UI updates (Phase 5) — needs browser-in-loop session.
2. Day-15 transition UI (Phase 6.3) — needs frontend-design skill + browser verification.
3. Session card UI integration with `composeSession()` (Phase 4.2) — needs design rationale + browser verification.
4. Intensity distribution gap — engine produces ~90% easy across all distances; spec targets 75–88%. To hit targets the engine would need to schedule more quality minutes (longer quality sessions, or one extra quality session in build phase). Coaching decision; not a regression.
5. R20 reshape API routes still call `hasPaidAccess()` — could migrate to `isFeatureAllowed('dynamic_reshape_r20')` for clarity.

**Out of scope (confirmed):**
- R20 reshaping logic (downstream concern; rebuild does not touch).
- R24 multi-race (not enabled).
- R21 strength stubs (remain as stubs).
- INV-PLAN-007 (zone/HR as strings — unchanged).
- 14-day trial timer mechanism (only the post-trial gate categories change, via Option A).

---

## R23 Rebuild — Deferred Items

Captured 2026-04-25 during follow-up audit. Each has a clear next step and ownership.

### R23-D1 — Tier 2 wizard fields (engine consumer required first)

| Field | Status | Engine work needed | Priority |
|---|---|---|---|
| `treadmill_primarily` (boolean) | Deferred | (a) bias catalogue selection away from `aerobic_hills` when true; (b) coach note on quality sessions: "outdoor only — skip strides on a treadmill". Touches `selectCatalogueSession` filter and `makeQualitySession` notes. | Medium — affects coaching quality for treadmill users |
| `longest_run_ever_km` (number) | Deferred — **needs product decision** | No clear engine consumer exists. Options: (a) widen week 1–2 long-run cap to `max(longest_recent × 1.10, longest_ever × 0.7)`; (b) peak-volume sanity check (don't prescribe a long run more than 30% above ever-longest); (c) abandon as a wizard input | Low — feature has no consumer until decision made |

**Why deferred:** Wizard fields without engine consumers add friction with zero value. Each requires a small coaching-design decision before the wizard work is worth shipping.

### R23-D2 — Catalogue lookup for legacy plans

**Status:** Deferred, recommend abandon

The Phase 4.2 session structure block uses `V1_SESSION_CATALOGUE.find(r => r.name === session.label)` to enrich the rendering. Pre-rebuild plans (generated before 2026-04-25) use legacy labels ("Tempo run", "Cruise intervals", "Tempo run — short") — these don't match catalogue names, so the structure block falls back to a generic main-set description.

**Why abandon:** Legacy plans expire as users regenerate. Building a `legacy_label → catalogue.id` mapping table is reverse-engineering work for a shrinking population.

### R23-D3 — Surface `compressed` flag in UI

**Status:** Deferred, needs design rationale

The R23 rebuild populates `meta.compressed = true` when the 10% volume cap prevents a plan reaching its target peak volume (e.g. returning runner with very low starting volume + short plan window). Currently invisible to users.

**Possible UX:**
- "Plan compressed" eyebrow on Plan screen header
- Coach note: "Your timeline is tight — we couldn't fully ramp to your target volume. The plan still works, just more conservative than ideal."
- Restraint card variant on Today screen for compressed plans

**Why deferred:** Needs design rationale (`frontend-design` skill) and copy review before shipping. No SLA — users with compressed plans don't experience anything broken; they just get a more conservative ramp.

### R23-D4 — Intensity distribution: spec target vs Zona audience

**Status:** ✅ Resolved 2026-04-25 — keep current behaviour. To revisit during free/paid audit.

**Decision:** Engine stays at ~90% easy / 10% quality across all distances. Spec target (75–88% easy depending on distance) is from polarised-training research on competitive runners. Zona's target audience is *runners who already train too hard* — being **more conservative than the textbook is the brand position made literal in volume math.** Restraint as the product.

If a coaching audit pushes back: the answer is *"yes, less quality than the textbook spec — by design for our audience."*

**Recorded for revisit:** Free/paid audit (TBD). If telemetry shows users dropping off because plans feel under-stimulating, the smallest change is adding a 2nd quality session in build phase for HM/Marathon intermediate+experienced only (one config addition, ~6pp shift). Don't change without signal.

### R23-D5 — F1: ReshapeScreen 403 has no upgrade CTA

**Status:** Deferred — defense-in-depth only

If a free user reaches `screen=reshape` via URL manipulation, the API returns 403 `{ error: 'Subscription required' }`. The screen renders the error message but with no "Upgrade" CTA. Primary gate is the MeScreen UI hide on `hasPaidAccess`, which works correctly.

**Fix:** When `error === 'Subscription required'`, show "See plans" CTA → `setScreen('upgrade')`. Two-line change.

**Why deferred:** Belt-and-braces only. No production user can hit this via supported flows.

### R23-D6 — Free regeneration policy (Option A interpretation)

**Status:** ✅ Resolved 2026-04-25 — lenient interpretation. To revisit during free/paid audit.

**Decision:** Free users may regenerate rule-engine plans freely. The paid value on regen is the **AI enrichment layer** (gated via `ai_coach_notes_new`), not the act of regenerating itself. Strict interpretation rejected because it creates a UX dead-end (race date passes → plan stuck in the past with no escape). Brand promise *"free users are never abandoned"* takes precedence over the marginal subscription value of locking regeneration.

**Code/doc changes shipped:**
- `lib/plan/featureGates.ts` — removed `new_plan_generation` from `PAID_ONLY_ONGOING`; added `rule_engine_regeneration` to `FREE_ALWAYS`. Comment block records the decision.
- `docs/canonical/monetisation-strategy.md` — Option A category lists updated; explicit note on regeneration policy added.
- `docs/canonical/CoachingPrinciples.md` §15 — same alignment.
- `docs/alignment/phase-6-gates-followup.md` — `new_plan_generation` paywall copy line removed.

**Recorded for revisit:** Free/paid audit (TBD). If commercial signals warrant tightening (low conversion, "fresh start" emerges as a real subscription motivator), the constrained-strict middle ground is available: gate regen only when the user has an active future-dated plan; allow it once race date has passed. Code change would be a small route addition that compares plan race_date against `now()` before allowing free-tier regen.

### R23-D7 — `length.ts` cleanup tracking

**Status:** Resolved this session — `taperWeeks` removed from `DistanceConfig` (Group A2). No further action.

---

## R23 Rebuild — Active Carry-Over

Items still queued for hands-on attention after the rebuild:

| Item | Owner | Status |
|---|---|---|
| Browser-verify Phase 5 + Phase 4.2 + Phase 6.3 + B1 + B3 changes after Vercel deploy | Russ | Awaiting deploy + manual check |
| Free/paid audit (revisits R23-D4 + R23-D6 if signals warrant) | Russ | Scheduled when usage data is available |

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

### R20 — Dynamic Plan Reshaping ✅ Complete
**Tier:** PAID | **Status:** Fully shipped
- Automatic triggers: `load_spike`, `zone_drift`, `shadow_load`, `ef_decline` — auto-apply low-risk, confirm-required for significant
- Phase-aware: taper blocked, peak phase preserves quality sessions on EF decline
- Plan adjustment API: `/api/adjust-plan` + `/api/confirm-adjustment` + `/api/revert-adjustment`
- Hard caps: max 2 adjustments/week, 3-week taper protection, 10% volume cap, 48hr quality spacing
- User-initiated reshape: Me screen → Training Intelligence → "Reshape plan" → `ReshapeScreen`
- **Parked — plan adaptation triggers (v1.1+):** See `docs/alignment/plan-adjustments-parked.md` for full product spec. Five triggers below are not built — infrastructure exists but nothing generates them yet.

| Parked trigger | Description | Target version |
|---|---|---|
| Session move → rebalance | User drags session to new day; hard/easy alternation preserved | v1.1 |
| Skip with reason | User marks session skipped with reason; plan responds (make up / push / absorb) | v1.2 |
| Silent miss detection | Day passes with no log; morning-after prompt | v1.2 |
| Fatigue-driven softening | 3+ consecutive Heavy/Wrecked logs → soften upcoming sessions | v1.3 |
| RPE disconnect | RPE 8+ on easy run → coach note only (no plan change — decision made) | v1.3 |

### R21 — Strength Sessions
**Tier:** FREE (display stubs) / PAID (dynamic)
- Flesh out strength session stubs in plan JSON
- Session cards with appropriate UI treatment
- Currently: admin-only, hidden from public plan + today view

### R22 — Blockout Days
**Tier:** PAID
- User marks days unavailable; plan reshapes around them

### R23b — Plan Generator Wizard UI ✅ Complete
**Tier:** PAID | **Status:** Shipped
- One question per screen (8 steps free / 12 steps paid)
- Slide + fade transitions, expanding pill progress dots
- Large OptionCard selectors for goal, hard-sessions, terrain, training-style
- SessionStorage persistence maintained; same API and data model

### R24 — Multi-Race Support
**Tier:** PAID
- Support multiple target races per user (A/B race hierarchy)
- **Schema path**: Current `meta.race_date` and `meta.race_name` are canonical primary-race fields and remain unchanged. R24 will introduce `meta.races: Race[]` as a non-breaking additive field. `Plan.phases[]` (added in R23) provides the structure for multi-race periodisation — phases can be anchored to different race targets.

### R25 — Historical Run Intelligence
**Tier:** PAID (`strava_intelligence` gate)  
**Source:** Russ idea, captured 2026-04-25  
**Theme:** "How did this run compare to your past self?"

When a Strava run completes, in addition to the existing per-session verdict (Part A — already shipped), Zona finds *similar past runs* in the user's history and surfaces whether they're improving, holding, or regressing. ZONA voice on the surface; rule-based + AI underneath.

#### Part A — already built (no work needed)
- `/api/analyse-run` runs on every Strava webhook → `enrichAndPersist()` → `triggerAutoAnalysis()` → 4-dimension scoring (HR discipline 50% / distance 25% / pace 15% / EF 10%) + verdict (nailed / close / off_target / concerning) + AI feedback text
- Post-log reflect view collects RPE + fatigue tag ("how did it feel")
- Surfaced in `RunFeedbackCard` on session expanded view

#### Part B — new for R25

**Similarity matching.** For the just-logged run, find prior runs in `strava_activities` (last 12 months) where:
- Distance within ±15%
- Elevation gain within ±20%
- (Open: should we also match by *intent* — i.e. session type from the linked plan session — or purely by raw metrics? See design decisions below.)

**Comparison metrics** for each match — and aggregated across the cohort:
- **Pace delta** — faster / slower at same distance
- **HR delta at same pace** — lower HR for same effort = aerobic improvement
- **HR delta at same HR target** — pace at constrained HR
- **EF (aerobic efficiency)** — pace / HR ratio, trended over time

**Trend detection** across the matched cohort (rolling, last 3–6 months):
- Improving — pace ↑ at same HR, or HR ↓ at same pace, or EF ↑
- Holding — within noise band
- Regressing — opposite direction over multiple sessions
- Inconclusive — too few similar runs to call

**Surfaces:**
- New section on `RunFeedbackCard`: *"You've run this kind of session 5 times in the last 4 months. You're trending faster at the same HR — aerobic engine is improving."*
- Or for regression: *"Same loop in March was 5 bpm lower at this pace. Could be heat, fatigue, or a hard day. Worth watching."*
- Empty state when insufficient data: *"Not enough history yet. Come back after a few more runs."*

#### Architecture sketch

| Concern | Where it lives |
|---|---|
| Similarity query | New helper `lib/coaching/similarRuns.ts` — reads `strava_activities` table |
| Trend detection | New helper `lib/coaching/runTrend.ts` — extends `efTrend.ts` patterns |
| Storage | Extend `run_analysis` table with `historical_comparison JSONB` column (or new `run_comparison` table — TBD) |
| AI prompt | Extend `lib/coaching/prompts/sessionFeedback.ts` to accept historical context |
| API surface | Extend `/api/analyse-run` to also compute + persist historical comparison; surface via existing `RunFeedbackCard` props |
| UI | Add comparison block to `RunFeedbackCard` (paid users only) |

#### Design decisions to resolve before build

| # | Question | Options |
|---|---|---|
| 1 | What defines "similar"? | (a) Distance + elevation only — pure metric match; (b) Distance + elevation + linked session type ("easy 8K vs easy 8K"); (c) Distance + elevation + observed effort band (RPE / HR zone) |
| 2 | Minimum cohort size to call a trend? | 3? 5? Below that, return "inconclusive" |
| 3 | Time window? | 12 months by default, but should it shrink for users with dense Strava history? |
| 4 | Voice for regression cases? | "Worth checking" framing only, or include possible explanations (heat, fatigue, life stress)? |
| 5 | Should the comparison be **per-run** (vs the closest matched single past run) or **vs cohort average**? | Per-run = more concrete copy; cohort average = more statistically robust |
| 6 | Tier: which `strava_intelligence` sub-gate? | All paid, or open to free users with limited cohort (e.g. 3 runs only)? Probably all paid — simpler. |

#### Dependencies + risks
- Requires reliable `strava_activities` table — currently populated by webhook ✓
- Requires elevation data — Strava provides `total_elevation_gain` ✓
- Brand-new users have no historical cohort → empty state must be lovable, not broken
- "Improvement" can be illusory: hot day, fatigue, route variation. Coaching copy must be cautious — no false confidence
- Privacy/sensitivity: regression copy can land badly if framed wrong. ZONA voice helps ("Worth checking" not "You got worse")

#### Estimated effort
~15 hours focused work, probably 2–3 sessions:
- Similarity helper + trend detection: ~6h
- DB schema extension + migration: ~1h
- API integration + AI prompt extension: ~3h
- UI block on `RunFeedbackCard`: ~3h
- Browser verification + edge-case testing: ~2h

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
| Strava token refresh | ✅ Done — `lib/strava.ts` `getStravaToken()` + `/api/strava/refresh` route. Full refresh flow in place. |
| `login/page.tsx` hardcoded values | ✅ Audited and fixed — heading, tagline, copy, spinner all corrected |
| `PlanCalendar` `stravaRuns` prop | Accepted but unused in WeekCard — remove or wire up |
| Hardcoded font strings | ✅ Done — `StravaPanel.tsx` (20), `PlanChart.tsx` (2), `DashboardClient.tsx` (1) all replaced with `var(--font-ui)` / `var(--font-brand)`. Zero remaining across `app/` and `components/`. |
| `nextMonday()` UTC drift in `route.ts` | ✅ Fixed — route.ts rewritten in R23; now uses `lib/plan/length.ts` `parseDateLocal()` throughout |
| Tier-divergent rendering utility | Once a second tier-divergent component lands (after `GeneratingCeremony.tsx`), centralise the `tier` prop pattern into a shared context or typed prop convention. Document as a pattern in `ui-patterns.md`. |
| API contract docs (10 routes) | Missing `docs/contracts/api/` entries for: `analyse-run`, `adjust-plan`, `confirm-adjustment`, `checkout`, `recalibrate-zones`, `revert-adjustment`, `delete-account`, `weekly-report`, `push/subscribe`, `push/send-weekly-report`. Write after UX rework — route shapes may change. |
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
