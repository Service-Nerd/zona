# Feature Registry — Zona

**Authority**: Every feature must be tagged FREE or PAID here before implementation begins. Untagged features are build blockers. See `docs/canonical/` for domain rules and `docs/releases/backlog.md` for status and ordering.

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

---

---

## Ordered Backlog

### GTM & Commercial (pre-launch, ordered by impact)

| Feature | Tier | Release | Notes |
|---|---|---|---|
| Brand constants rollout (GTM-01) | FREE (infra) | GTM | `lib/brand.ts` created. Wire to: login tagline, loading screen, OrientationScreen (replaces "effort-first training"), push notification title, UpgradeScreen pricing labels. No new UI — pure string reference pass. |
| Copy fixes batch (GTM-02) | FREE | GTM | 7 targeted string replacements. Login signup sub, push title, skip confirm, coach empty state, plan error, teaser CTA, OrientationScreen sub. See backlog for file/line detail. |
| UpgradeScreen rewrite (GTM-03 + GTM-04) | PAID | GTM | Paywall copy: "Start your subscription", pricing uses `PRICING.annual.savingLabel`. Feature list reordered: weekly report first. Trial-expired variant uses loss framing ("Your zone discipline coaching pauses here"). |
| Zone discipline teaser — Coach tab, free users (GTM-05) | TIER-DIVERGENT | GTM | Free users see locked zone discipline score category on Coach tab. Blurred state + upgrade CTA. Does not expose paid data. Mirrors wizard teaser card pattern. |
| Post-session Strava prompt — free users (GTM-06) | TIER-DIVERGENT | GTM | After manual session log, one-line prompt at bottom of reflect view: "Connect Strava to see how your HR compared." Taps to Strava connection / upgrade. |
| OG / social image (GTM-07) | FREE (ops) | GTM | `/public/og-image.jpg` 1200×630. Brand graphic + tagline. Currently missing — any shared link shows blank preview. |

### GTM & Commercial (post-launch)

| Feature | Tier | Release | Notes |
|---|---|---|---|
| Marketing site (GTM-08) | FREE | post-launch | Replace `app/page.tsx` redirect with one-page marketing site. In-app Next.js page (D7). All copy from `lib/brand.ts`. |
| Trial expiry email + day-11 nudge (GTM-09/10) | PAID | post-launch | Email platform required (Resend or Supabase Edge). Zona-voice copy referencing zone discipline coaching specifically. |

### Product Backlog

| Feature | Tier | Release | Notes |
|---|---|---|---|
| Plan Confidence Score | PAID | R18 | Derived from completion + RPE data |
| Coaching Tips in Supabase | PAID | R19 | Move hardcoded copy to DB; dynamic per user |
| Dynamic Plan Reshaping (user-initiated) | PAID | R20 | ✅ Complete. Phase-aware reshaping (`currentPhase` guards taper/peak). User-initiated flow: Me → "Reshape plan" → `ReshapeScreen` → analyse → confirm/dismiss. `/api/confirm-adjustment` route. `AdjustmentBanner.confirm()` bug fixed. |
| Strength Sessions | FREE (stubs) / PAID (dynamic) | R21 | Generator stubs exist; cards render with no content. **Admin-only for v1 launch** — filtered from public plan view until R21 ships full content. |
| Blockout Days | PAID | R22 | User marks unavailable days; plan reshapes |
| Plan Generator Wizard UI | PAID | R23b | ✅ Complete. One-question-per-screen sub-step wizard. 8 steps (free) / 12 steps (paid). Slide transition animation. Progress pills. Warm Slate tokens. OptionCard pattern for goal/terrain/style/hard-sessions. |
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
