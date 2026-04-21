# Feature Registry — Zona

**Authority**: Every feature must be tagged FREE or PAID here before implementation begins. Untagged features are build blockers. See `docs/canonical/` for domain rules and `docs/releases/backlog.md` for status and ordering.

---

## Shipped Features

| Feature | Tier | Release | Notes |
|---|---|---|---|
| Core app shell (3 screens, nav) | FREE | R0–R15b | Today, Plan, Me screens. Coach tab built but disabled for v1 launch — admin-only until post-launch. |
| Screen guide popups | FREE | R15b | First-load onboarding |
| Progress bar | PAID | R17 | Session completion % |
| RPE input post-session | PAID | R17 + reflect UX | Stored in `session_completions`. Post-log reflect view (2026-04-19): dedicated step after Strava log or manual log — replaces instant-dismiss toast. Zona voice responds to RPE, session-type-aware. |
| Fatigue tags | PAID | R17 | Canonical vocabulary: `Fresh / Fine / Heavy / Wrecked`. Shown in reflect view and on collapsed card badge. Skip reason also stored in `fatigue_tag`. |
| Session Card Redesign | PAID | 2026-04-20 | New card hierarchy; compact metric strip; zone chip; per-session toggle (expanded only). |
| Coaching Signal | PAID | 2026-04-20 | `coaching_flag` per session (`ok`/`watch`/`flag`); `avg_hr` from Strava; execution summary in expanded card; flag badge on collapsed card. DB migration deployed. R18-ready. |
| Plan Generator (API route + form) | FREE (templates) / PAID (AI) | R23 | FREE = rule-based engine, no AI calls; PAID = rule engine + AI enrichment (labels, voice, confidence) |
| `lib/plan/schema.ts` (Zod) | FREE (infra) | R23 | Canonical plan schema shared by rule engine, enricher, R20, R24 |
| `lib/plan/length.ts` | FREE (infra) | R23 | Auto plan-length calculator — weeks from race date, min/ideal by distance, compressed flag |
| `lib/plan/ruleEngine.ts` | FREE | R23 | Deterministic plan generator — no AI calls, always produces a valid plan |
| `lib/plan/enrich.ts` | PAID | R23 | Claude enrichment layer — voice labels, coach_notes, confidence score. Silent fallback on failure. |
| `lib/plan/generate.ts` | TIER-DIVERGENT | R23 | Single entry point: `generate(input, tier)`. Calls rule engine always; calls enricher for trial/paid. |
| `components/GeneratingCeremony.tsx` | TIER-DIVERGENT | R23 | Generating screen — skeleton shimmer + staged ZONA-voice copy. Different copy for free vs paid/trial. |
| Wizard Step 4 (terrain / injuries / HR / style) | PAID | R23 | Hidden for free users. Teaser card shown instead. |
| Teaser card (post-Step-3, free users) | TIER-DIVERGENT | R23 | Upsell above the generate CTA for free users. Taps → UpgradeScreen. Non-blocking. |
| Profile screen | FREE | R15b | First name, last name, email on `user_settings` |
| Smoke tracker | FREE | R15b | Days since quit, displayed on dashboard |
| Theme toggle (light/dark) | FREE | R0 | `data-theme` on `<html>` only |
| Dist/duration toggle (global) | FREE | Session Card Redesign | Lives in Me screen |
| Dist/duration toggle (per-session) | PAID | Session Card Redesign | Expanded card only; saves per session |
| Strava integration | PAID | — | OAuth, run sync, aerobic pace derivation |

---

---

## Ordered Backlog

| Feature | Tier | Release | Notes |
|---|---|---|---|
| Onboarding flow | FREE / PAID | R0.5 | Questionnaire → template plan (free) or AI plan (paid/trial) → plan on screen. Target: first value in <3 mins. Requires plan storage decision (Gist vs Supabase). |
| Rule-based plan engine | FREE | — | Deterministic plan generation from pre-built templates. Zero AI calls. Powers the free path in R0.5 and post-trial plan regeneration. |
| Gist → Supabase plan storage | FREE (infrastructure) | 2026-04-21 | `plans` table with RLS. `fetchPlanForUser` + `savePlanForUser` in `lib/plan.ts`. Auto-migration from gist_url / plan_json on first load. Contract: `docs/contracts/api/plan-fetch.md`. |
| Reverse trial infrastructure | FREE (infrastructure) | — | `trial_started_at` in `user_settings`; `isTrialActive()` helper; PAID gates in API + components; upgrade prompt; downgrade flow. See `docs/canonical/monetisation-strategy.md`. |
| Plan Confidence Score | PAID | R18 | Derived from completion + RPE data |
| Coaching Tips in Supabase | PAID | R19 | Move hardcoded copy to DB; dynamic per user |
| Dynamic Plan Reshaping | PAID | R20 | Separate from creation; shared schema with R23 |
| Strength Sessions | FREE (stubs) / PAID (dynamic) | R21 | Generator stubs exist; cards render with no content. **Admin-only for v1 launch** — filtered from public plan view until R21 ships full content. |
| Blockout Days | PAID | R22 | User marks unavailable days; plan reshapes |
| Plan Generator Wizard UI | PAID | R23b | Multi-step wizard; replaces current form |
| Multi-Race Support | PAID | R24 | A/B race hierarchy |

---

## Scoped But Unscheduled

| Feature | Tier | Notes |
|---|---|---|
| Estimated race times | PAID | 5K/10K/HM/Marathon — data-driven |
| Zone method selector | PAID | User chooses HR zone calculation method; stored in Supabase |

---

## Parking Lot (Deprioritised)

| Feature | Tier | Notes |
|---|---|---|
| Session swap | PAID | Manual session reordering |
| AM/PM scheduling | PAID | Time-of-day session placement |

---

## Tier Definitions

| Tier | Includes |
|---|---|
| FREE | Generic pre-built plan templates (5K/10K/HM, 8 & 12-week variants) via rule-based engine (no AI calls), core session display and tracking, formula-derived pace/HR targets, basic profile. No Strava, no dynamic coaching. |
| PAID | AI plan generation, dynamic plan reshaping, Strava integration, AI coaching, plan confidence score, all personalised or intelligent features. |

**Monetisation model**: Hybrid Reverse Trial — 14 days full (PAID) access for all new users, then graceful downgrade to FREE. See `docs/canonical/monetisation-strategy.md`.

**Rule**: FREE tier must not expose paid-tier data or imply its existence without an explicit product decision.

**Rule**: All AI calls (Anthropic API) route through Next.js API routes only — never client-side. Rule-based engine makes zero AI calls — enforced at route level.
