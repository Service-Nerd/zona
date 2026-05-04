# Feature Registry — Zona

**Job:** What's been built + tier assignments. Single source of truth for "does this exist? is it free or paid?"
**Pair:** When a backlog item ships, the `/ship` skill appends it here. Forward work lives in `docs/releases/backlog.md`.
**Rule:** Every feature must be tagged FREE or PAID here before implementation begins. Untagged features are build blockers.

---

## R23 Rebuild — In Progress

The R23 plan generator is being rebuilt against an updated coaching spec (see `docs/architecture/ADR-009-config-driven-generation.md`, ADR-010, `docs/canonical/CoachingPrinciples.md`). The rebuild is config-driven and catalogue-driven; it does not change tier assignments.

| Concern | Tier (unchanged) |
|---|---|
| Plan generation — generic templates | FREE |
| Plan generation — personalised (rule engine + AI enrichment) | PAID at generation; retained-in-free after trial (Option A) |
| 5K / 10K / HM plans | FREE |
| Marathon / 50K / 100K plans | PAID |
| Dynamic reshape (R20) | PAID — ongoing |
| Strava intelligence | PAID — ongoing |
| AI coach notes (new) | PAID — ongoing |
| Session catalogue — full | granted at trial, retained in free for the trial-era plan |
| Session catalogue — ultra-specific rows (50K/100K) | PAID only (`is_free_tier = false`) |

See `docs/canonical/monetisation-strategy.md` for the Option A tier categories.

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
| VDOT zone model (Jack Daniels) | FREE (infra) | R24 | Replaces hardcoded pace brackets. Benchmark input (race or 30-min TT) → VDOT → E/T/I paces. Falls back to fitness-level brackets when no benchmark. |
| Fitness level derivation | FREE (infra) | R24 | Derived from weekly_km + longest_run + VDOT (if available). No longer self-reported. |
| Age field + Tanaka max HR | FREE (infra) | R24 | Age required in wizard. Max HR calculated via Tanaka formula (208 − 0.7 × age). max_hr field removed from wizard. |
| Dual-anchor training zones | FREE (infra) | R24 | Every session prescribes pace range + HR ceiling. HR governs on hills/heat/fatigue days. |
| Benchmark input (wizard step 2) | FREE | R24 | Optional recent race result (any distance) or 30-min TT. Populates VDOT for the plan. |
| Distance tier gating | TIER-DIVERGENT | R24 | 5K/10K/HM = FREE. Marathon/50K/100K = PAID. Locked chips in wizard for free users. |
| Recalibration week markers | FREE | R24 | Deload weeks in base/build phase flagged as recalibration weeks. Theme prompts a benchmark test. `meta.recalibration_weeks` array in plan. |
| Goal pace overlay | FREE (infra) | R24 | When goal = time_target, derives goal_pace_per_km. Surfaced in peak-phase quality sessions as a coach note. Not used as a training zone. |
| Enhanced guard rails | FREE (infra) | R24 | HM < 4 weeks, Marathon < 8 weeks, marathon with < 20km/week base, HM with < 5km longest run all blocked at API. |
| BenchmarkUpdateScreen | PAID | R24 | Manual zone recalibration screen. Enter new race/TT result → zones update for remaining plan weeks. Calls /api/recalibrate-zones. |
| /api/recalibrate-zones | PAID (infra) | R24 | Auth-gated API: takes benchmark input, recalculates VDOT/zones, updates all sessions from current week onwards, saves to Supabase. |
| Coach tab (paid users) | PAID | 2026-04-25 | Enabled for all paid/trial users. Was admin-only at launch. `CoachScreen` shows weekly report card + stats row (zone discipline, load ratio, sessions). Generate/regenerate buttons. Falls back to plan notes card when no report exists. |
| `lib/coaching/` module tree | PAID (infra) | 2026-04-25 | Per-session scoring (`sessionScore.ts`), session matching (`sessionMatch.ts`), aerobic efficiency (`efTrend.ts`), load calculations (`loadCalc.ts`), weekly report (`weeklyReport.ts`), plan adjustment triggers (`planAdjustment.ts`), coaching flag (`coachingFlag.ts`), aerobic pace (`aerobicPace.ts`), constants (`constants.ts`). Rule engine version stamped on every analysis row. |
| AI prompt templates | PAID (infra) | 2026-04-25 | `prompts/sessionFeedback.ts`, `prompts/weeklyReport.ts`, `prompts/planAdjustment.ts` — few-shot examples, structured output (Headline/Body/CTA). All use claude-haiku-4-5-20251001, silent fallback. |
| Strava webhook + auto-analysis pipeline | PAID | 2026-04-25 | GET challenge-response; POST fires `enrichAndPersist()` → HR stream fetch → zone % computation → strava_activities upsert → `triggerAutoAnalysis()` → session match → calls `/api/analyse-run` internally. |
| /api/analyse-run | PAID | 2026-04-25 | 4-dimension session scoring: HR discipline 50%, distance 25%, pace 15%, EF 10%. Verdicts: nailed/close/off_target/concerning. AI feedback text (claude-haiku, max_tokens 200, silent fallback). Upserts to run_analysis table. |
| /api/weekly-report | PAID | 2026-04-25 | Aggregates completions + run_analysis + load history. Computes acute:chronic ratio, zone discipline score. AI generates Headline/Body/CTA (claude-haiku, max_tokens 300, silent fallback). Cached per week unless `?force=true`. |
| /api/adjust-plan + /api/revert-adjustment | PAID | 2026-04-25 | Adjustment triggers: load_spike, zone_drift, shadow_load, ef_decline. Auto-apply low-risk; confirm-required for significant. Full revert to sessions_before snapshot. Hard caps: max 2/week, 3-week taper protection, 10% volume cap, 48hr quality spacing. |
| RunFeedbackCard | PAID | 2026-04-25 | Verdict chip + score/100 + 4 dimension bars (HR/Distance/Pace/Efficiency) + AI feedback text. Shown in session expanded view. |
| AdjustmentBanner | PAID | 2026-04-25 | Amber left-border banner on Today/Coach screens. Apply/Dismiss buttons. Dismiss calls `/api/revert-adjustment`. |
| Dynamic adjustments toggle (Me screen) | PAID | 2026-04-25 | Toggle in Me screen settings. Stored as `dynamic_adjustments_enabled` in user_settings. Opt-out only — default on. |
| Web Push notifications | PAID | 2026-04-25 | `public/sw.js` service worker. `/api/push/subscribe` (POST + DELETE). `/api/push/send-weekly-report` cron (Sundays 18:00 UTC via Vercel cron). push_subscriptions table. VAPID signing via `web-push` npm package. Auto-cleanup of 410 Gone subscriptions. |
| Brand constants rollout (GTM-01) | FREE (infra) | 2026-04-22 | `lib/brand.ts` wired to login tagline, loading screen, OrientationScreen, push notification title, UpgradeScreen pricing. |
| Copy fixes batch (GTM-02) | FREE | 2026-04-22 | 7 voice-batch string replacements across login, push, skip confirm, coach empty, plan error, teaser CTA, OrientationScreen sub. |
| UpgradeScreen rewrite (GTM-03 + GTM-04) | PAID | 2026-04-22 | Paywall copy + pricing labels + reordered feature list (weekly report first). Trial-expired loss-framing variant: "Your coaching has paused" + amber-accented LOSSES list. |
| Zone discipline teaser — Coach tab (GTM-05) | TIER-DIVERGENT | 2026-04-22 | Free users see locked CoachTeaser (muted report card + dimmed stats + upgrade CTA). Paid users unchanged. |
| Post-session Strava prompt — free users (GTM-06) | TIER-DIVERGENT | 2026-04-22 | Free users see "Connect Strava to see how your HR compared" below Done in reflect view. Taps to upgrade. |
| OG / social image (GTM-07) | FREE (ops) | 2026-04-22 | Dynamic `app/api/og/route.tsx` (next/og edge runtime). 1200×630, navy bg, teal accent, wordmark + tagline from BRAND. Layout metadata (title/description/OG/twitter) sourced from lib/brand.ts. |
| Plan archive (data protection) | FREE (infra) | 2026-04-24 | `plan_archive` Supabase table. Previous plan stored before every `savePlanForUser` call. No restore UI yet — data protection only. Migration: `20260424_plan_archive.sql`. |
| Account deletion flow | FREE | 2026-04-24 | Me screen → `DeleteAccountScreen` → `/api/delete-account` → cascade delete session_completions + subscriptions + user_settings + auth user. Apple App Store requirement. |
| R23 plan invariants (constitutional layer) | FREE (infra) | 2026-04-26 | `lib/plan/invariants.ts → validatePlan()` mechanically validates every generated plan against `CoachingPrinciples.md`. Throws on error-severity in dev/test; logs in prod. Three layers, one truth: principle → numeric → mechanical check. |
| Foundation Block | FREE (infra) | 2026-04-29 | Pre-plan preparation phase inserted before Week 1 when gap between today and plan_start is ≥ 7 days. Gap 7–28 days: auto-generated silently. Gap > 28 days: three-option modal (Add / Start as-is / Decide later). Foundation weeks carry `phase: 'foundation'`, negative `n` values, easy/rest/cross-train only. Volume starts at effective baseline (0.70× if fresh-return active), max +10%/week, ceiling at baseline×1.10. Constitutional layer: `INV-PLAN-FOUNDATION-BLOCK`. Config: `GENERATION_CONFIG.FOUNDATION_*`. Generator: `lib/plan/foundationBlock.ts`. |
| Property-validation harness | FREE (infra) | 2026-04-26 | `scripts/property-validate-plans.ts` sweeps wide input grid (race × fitness × days × volume × injuries). Exit 1 on any violation. Catches edge cases archetype matrix misses. |
| Coaching review packets | FREE (infra) | 2026-04-26 | `scripts/generate-coaching-review.ts` outputs three canonical test cases (5K/10K/HM) as markdown for Claude Desktop coaching audit. Committed output produces visible diff in coaching language on every engine change. |
| PlanCalendar stravaRuns prop removal | FREE (infra) | 2026-04-29 | Removed dead `stravaRuns: StravaActivity[]` prop from `PlanCalendar` and `WeekCard` — was threaded through but never consumed. Call site in `DashboardClient` and contract doc updated to match. |
| API contract docs (10 routes) | FREE (infra) | 2026-04-29 | Added `docs/contracts/api/` markdown files for all 10 previously undocumented routes: `analyse-run`, `adjust-plan`, `confirm-adjustment`, `revert-adjustment`, `recalibrate-zones`, `checkout`, `delete-account`, `weekly-report`, `push/subscribe`, `push/send-weekly-report`. Each documents method, auth, gate, request/response shapes, and gotchas. |
| Phase 6.3 — Feature gate UI + Day-15 transition | PAID | 2026-04-29 | MeScreen Reshape button gates on `hasPaidAccess`: free users see contextual copy ("Reshape needs Premium. The plan you have keeps running.") and tap routes to `UpgradeScreen`. Day-10 trial banner (≤4 days remaining) and `trialExpired` UpgradeScreen loss-framing variant were already in place. R23-D5 resolved. |
| Estimated race times | PAID | 2026-04-29 | 5-state detection: benchmark in plan.meta (high), ≥4 aerobic Strava runs (moderate), 1–3 runs (low), wizard fitness_level×training_age bracket (low, −5% discount), no signal (prompt). `GET /api/race-times`. `RaceTimesCard` in CoachScreen; locked stub in CoachTeaser. 5K/10K/HM/Marathon. Jack Daniels VDOT fractions. 4 VDOT functions exported from `lib/plan/ruleEngine.ts`. Feature gate: `race_time_estimates` in `PAID_ONLY_ONGOING`. |
| R20 plan-adaptation triggers (all 5) | PAID | 2026-04-29 | Full trigger set in `lib/coaching/planAdjustment.ts` + `/api/adjust-plan`. T1 session reorder: MoveSessionView day picker, hard-hard adjacency check (§7), confirmation required if violated. T2 skip with reason: "Life/weather" → make-up slot; "Injury" → §21 content filter + 15% volume cut; "Too tired" → silent absorb. T3 silent miss detection: app-open scans past days for gaps, surfaces MissedSessionSheet bottom sheet with 4 reason buttons. T4 fatigue softening (committed 5073f08): 3 consecutive Heavy/Wrecked/Cooked → swap quality→easy, trim long 20%. T5 RPE disconnect: RPE ≥ 8 on easy/long → Z2 ceiling coach note, no restructure. Taper guard (final 3 weeks) applies to auto triggers; user-initiated signals (skip, reorder) bypass it. Migration `20260429_r20_trigger_types.sql` adds skip_with_reason + session_reorder to trigger_type CHECK constraint. |
| Daily coach note | PAID | 2026-04-28 | `GET /api/daily-coach-note?date=YYYY-MM-DD`. AI-generated personalised note shown on Today screen for paid/trial users. Cached per user per local date; `?force=true` regenerates. Fetched on load in `DashboardClient`, passed as `dailyCoachNote` prop to `TodayScreen`. Free users receive 403; client-side gate skips the fetch. `lib/coaching/prompts/dailyCoachNote.ts`. |
| UI header update — all screens | TIER-DIVERGENT | 2026-04-29 | Today: days-out plain text → moss pill badge; static greeting → time-based (Good morning/afternoon/evening/Evening). Plan: title → "Your plan", race name moves to content heading, days-to-go removed from sub. Coach: title → "Your coach", dynamic headline (on track/catch up/ease up/here's your week) from coaching data, 2×2 stats grid (Zone discipline, Load ratio, Sessions, Weeks left) replaces hero card + 3-col row, `onGoToMe` removed. Me: back button removed (tab destination), `ScreenHeader "Your profile"`, identity card → name + tier label (Free/Trial/Pro), read-only training overview (race, date, W{N} of {total}), `trialDaysLeft` threaded in. |
| Load ratio tap-to-explain sheet | PAID | 2026-04-29 | Load ratio stat card in CoachScreen 2×2 grid is a tappable `<button>`. Tap opens inline slide-up sheet: label, title "Your training load balance", current value + status, three plain-English paragraphs explaining acute:chronic ratio, band thresholds (0.8/1.3), and why load consistency matters. Same visual pattern as `ZoneInfoSheet`. ⓘ indicator on card label. |
| Zone discipline tap-to-explain sheet | PAID | 2026-04-29 | Zone discipline stat card in CoachScreen 2×2 grid is now tappable. Tap opens inline slide-up sheet: label, title "Hitting the prescribed zone", current score + colour, three paragraphs explaining what zone discipline measures, why grey-zone running is harmful, and how to read the score. `DashboardClient.tsx` — `zoneDisciplineSheetOpen` state, same sheet pattern as load ratio. ⓘ indicator on card label. |
| MeScreen onBack prop removal | FREE (infra) | 2026-04-29 | Dead `onBack` prop removed from `MeScreen` function signature, type definition, and call site in `DashboardClient.tsx`. Back button was removed when Me became a tab destination; prop lingered unused. |
| RPE/fatigue capture before analysis | PAID (infra) | 2026-05-04 | `link-activity` call moved from `saveCompletion` to `handleReflectDone` in `SessionPopupInner`. RPE and fatigue are now written to `session_completions` before `analyse-run` reads the row. HealthKit auto-ingest path unaffected (no UI). |
| Verdict-based push notification title | PAID (infra) | 2026-05-04 | `analyse-run` route: `verdictPushTitle()` replaces static `BRAND.push.runAnalysis` in the notifyUser call. Titles: "Run nailed." / "Close. Worth a look." / "Drifted off plan." / "Worth checking." with `BRAND.push.runAnalysis` as fallback. |
| First-run coaching context | PAID (infra) | 2026-05-04 | `analyse-run` detects `isFirstAnalysis` via run_analysis COUNT. Passed to `buildSessionFeedbackPrompt` which adds a first-run example and soft-welcome framing note. |
| HealthKit provenance on RunFeedbackCard | PAID | 2026-05-04 | When `session.completion.apple_health_uuid` is set, a small "Apple Health · X.Xkm" label renders above the RunFeedbackCard. Source-aware — only shown for HealthKit-sourced analyses, not Strava. |
| Analysis pending fallback card | PAID | 2026-05-04 | `GaveUpCard` component shown when `pollGaveUp` is true (polling gave up after ~40s with no analysis result). Replaces silent disappearance with a calm "Taking longer than usual. Check back in a few minutes." message. |
| PendingAnalysisCard copy + time anchor | PAID | 2026-05-04 | Text updated from "Analysing your run. Coach note on the way." to "Analysing your run — usually takes 15–30 seconds." Sets honest time expectation. |
| Free tier upsell copy fix (reflect view) | TIER-DIVERGENT | 2026-05-04 | Reflect screen free-user nudge updated from "Connect Strava to see how your HR compared." to "Connect Strava or Apple Health to unlock coaching." Accurate for both data source paths. |
| Locked coaching preview — session detail | TIER-DIVERGENT | 2026-05-04 | Free users who have completed a session see a locked `LockedCoachingPreview` card where `RunFeedbackCard` would appear for paid users. Shows card shell + "Your coaching appears here" + upgrade CTA. No actual coaching data exposed. Taps to `UpgradeScreen`. |
| Activity unlink | PAID | 2026-05-04 | `POST /api/strava/unlink-activity` — clears `strava_activity_id` + `apple_health_uuid` from `session_completions`, deletes `run_analysis` row. `strava_activities` untouched. UI: "Unlink" text button below provenance label on `RunFeedbackCard`, inline confirm (no modal), session returns to completed-but-unanalysed state. |
| Next session row — session detail | PAID | 2026-05-04 | Compact "Up next" row rendered below `RunFeedbackCard` in the session expanded view. Shows next scheduled session in the current week: session type colour dot, type label, day, distance. Hidden when no next session exists or when viewing a historical session. |
| Rule-engine manual session feedback | FREE | 2026-05-04 | When a session is marked complete with RPE/fatigue logged but no activity linked, `handleReflectDone` calls `POST /api/analyse-run/manual`. Derives verdict + one-line coaching note from RPE + fatigue tag — no AI, no HR/EF scoring. Written to `run_analysis` with `source='manual'`. `RunFeedbackCard` hides score chip and metric quartet for manual rows. Migration `20260504_run_analysis_manual_source.sql` adds `source` column, updates CHECK constraint, adds partial unique index `(user_id, week_n, session_day) WHERE source='manual'`. |

---

## Tier Definitions

| Tier | Includes |
|---|---|
| FREE | Generic pre-built plan templates (5K/10K/HM, 8 & 12-week variants) via rule-based engine (no AI calls), core session display and tracking, formula-derived pace/HR targets, basic profile. No Strava, no dynamic coaching. |
| PAID | AI plan generation, dynamic plan reshaping, Strava integration, AI coaching, plan confidence score, all personalised or intelligent features. |

**Monetisation model**: Hybrid Reverse Trial — 14 days full (PAID) access for all new users, then graceful downgrade to FREE. See `docs/canonical/monetisation-strategy.md`.

**Rule**: FREE tier must not expose paid-tier data or imply its existence without an explicit product decision.

**Rule**: All AI calls (Anthropic API) route through Next.js API routes only — never client-side. Rule-based engine makes zero AI calls — enforced at route level.
