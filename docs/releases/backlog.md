# Backlog — Zona

**Job:** What's left to ship. Single source of truth for "what should I work on?"
**Pair:** When an item ships, the `/ship` skill moves it to `docs/canonical/feature-registry.md` "Shipped Features" table. An item lives in exactly one of the two.

Status: 🔲 not started · 🔄 in progress · ❓ needs verification

---

## NOW — Critical path to App Store submission

Everything in this section blocks v1 launch. Group A (legal/policy) and Group D (external setup) can run in parallel with Groups B (engineering) and C (env config). Group E (QA) must follow.

### A. Legal & Apple compliance

- 🔲 **Terms of Service** — write, host at public URL, link pre-login alongside privacy policy
- 🔲 **Privacy policy hosted** — page is built (`/privacy`); needs to be live at `zona.app/privacy` before submission
- 🔲 **Subscription terms disclosure UI** — show price, billing frequency, 14-day trial length, auto-renewal terms before user subscribes (Apple requirement)
- 🔲 **App Store Connect setup** — active developer account, app record, subscription product (ID + pricing tiers + trial config), screenshots for all required device sizes, App Store description and keywords

### B. Engineering blockers

- ✅ **Native shell — Capacitor iOS** — bootstrapped. App boots in simulator with Vetra icon + splash, status bar polished (warm slate, dark text), splash auto-hides on web mount via `CapacitorBoot.tsx`, OAuth deep-link infrastructure in place via `app.vetra.ios://auth-callback` URL scheme. Plugins installed: `splash-screen`, `status-bar`, `browser`, `app`, `push-notifications`. `server.url` strategy with `allowNavigation` whitelist for OAuth providers. See `CLAUDE.md` § Native shell.
- ✅ **Google OAuth on native** — opens via SFSafariViewController (`@capacitor/browser`); returns through custom URL scheme; `CapacitorBoot.tsx` exchanges the code and `router.replace`s to `/dashboard`. Same pattern reusable for Strava (still on `window.location.href`).
- 🔲 **HealthKit primary data source** ⚠️ **App Store blocker — supersedes Strava as v1 data source.** Strava is still in Single Player Mode (1-athlete cap), API approval is opaque + slow, and we cannot run TestFlight beta on a single token. Apple Health needs no approval. Audit (2026-04-30) confirmed `lib/coaching/*` is source-agnostic — every consumer reads `strava_activities` rows as a canonical internal shape, not a Strava-shaped contract. HKWorkout maps 1:1; HR samples replace the Strava stream summary. Strava becomes an optional secondary import post-launch. Sub-tasks:
  - Install plugin (`@capacitor-community/health` or `capacitor-health` — pick during build; both expose HKWorkout + HKQuantitySample). Add `HealthKit` capability to Xcode App target. Add `NSHealthShareUsageDescription` to `ios/App/App/Info.plist` ("Vetra reads your runs to provide coaching feedback. Vetra never writes to Apple Health.")
  - Migration: add `source TEXT NOT NULL DEFAULT 'strava'` and `apple_health_uuid TEXT` to `strava_activities`; make `strava_activity_id` nullable; replace the unique constraint with two partial unique indexes (one per source). Don't rename the table for v1 — it's an internal label, not a public surface
  - `lib/health/adapter.ts` — pure mapper from HKWorkout + HR samples → `strava_activities` row shape. Reuses `fetchHRStreamSummary`'s zone-bucket logic against the user's plan zones
  - `lib/health/sync.ts` — foreground sync on app open: `HKSampleQuery` for runs since last sync, write rows, mirror webhook's `triggerAutoAnalysis` flow per new workout. (Background `HKObserverQuery` deferred — foreground sync is sufficient for coaching cadence)
  - New endpoint `POST /api/health/ingest` — accepts the device-side workout payload, runs the same enrichment pipeline as the Strava webhook (`enrichAndPersist` semantics + `triggerAutoAnalysis`)
  - First-launch HealthKit auth prompt in `MeScreen`, mirror the existing Strava connect UI; copy: "Connect Apple Health" / "Vetra reads your runs to coach you"
  - Rename feature gate `strava_intelligence` → `activity_intelligence` in `lib/plan/featureGates.ts` and all call sites (`/api/analyse-run`, `/api/strava/link-activity`, `/api/strava/callback`, `/api/race-times`, `lib/trial.ts`, `UpgradeScreen`, `BenchmarkUpdateScreen`). Tier semantics unchanged
  - Update `/privacy` page Strava section to add HealthKit disclosure: read-only, never written, on-device-only token, deletable from Profile
  - **Pre-fill RHR + MaxHR in `BenchmarkUpdateScreen`** from HealthKit when available (one-tap "Use your Apple Health values"), fall back to manual entry. Reads `restingHeartRate` (daily Watch-derived) + max-recent-run-HR sample. ~1 hour. High-trust personalisation moment for free
  - **VO2 max → race-times sanity check** — pull `vo2Max` (monthly Watch estimate) on sync; in `app/api/race-times/route.ts`, use it as a cross-check against VDOT-derived estimates. Diverges by >10% → flag for review. Same data feeds R18 confidence score when that ships
  - **Readiness signal — new plan-adjustment trigger.** New `readinessSignal` input on `lib/coaching/planAdjustment.ts → AdjustmentCheckInput` alongside the existing `rpeSignal`. Fires when RHR ≥ baseline + 7 bpm OR HRV ≤ baseline − 1 SD OR sleep < 5h on a quality/long day. Pre-session adjustment (only signal in the stack that fires *before* the run, not after). Composite — three weak signals voted into one. Baseline = 14-day rolling on the same user; trigger is dormant until baseline is established (silent for new users, no false-positive pollution). Voice copy uses `BRAND.voiceAnchor` ("Hold the zone."). Soften today's quality/long, not auto-skip. Priority above zone-drift in `selectAdjustment()`'s ordering since it's earliest in the day
  - Smoke test: agent-browser end-to-end on simulator with seeded HealthKit data — log a session manually, sync, verify auto-match + analysis pipeline produces a `run_analysis` row, and (with seeded readiness data) a readiness adjustment fires on a quality day
- 🔲 **Strava OAuth on native** *(deprioritised — no longer a launch blocker; Apple Health handles primary data path)* — currently uses `window.location.href` from `MeScreen` Strava connect button (DashboardClient.tsx line ~5234). Port to the same SFSafariViewController + URL-scheme pattern Google uses when we revisit Strava as the secondary source. Low risk, ~30 min.
- 🔲 **Strava as secondary source** *(post-launch)* — once HealthKit is primary, keep Strava OAuth + webhook + `strava_activities` writes alive but optional. Dedupe rule: if a HealthKit workout and a Strava activity match within ±5 min and ±5% distance, prefer the source with HR stream data; otherwise prefer HealthKit (always present on iOS). Apply for Strava API approval in parallel — not blocking v1.
- 🔲 **Sign in with Apple** — Apple §5.1.1d, mandatory because Google OAuth is present. Use `@capacitor-community/apple-sign-in` plugin; bridge to Supabase Auth with the returned identity token. Depends on Apple Developer approval (signing entitlement).
- 🔲 **StoreKit 2 integration** — via `@revenuecat/purchases-capacitor`. Webhook → Supabase `subscriptions` table (per project memory). Stripe path stays for web users. Alternative: apply for External Purchase Entitlement (slow, not guaranteed). Depends on Apple Dev + RevenueCat app setup.
- 🔄 **Push notifications** — engineering done (layers 1 + 2): `@capacitor/push-notifications` plugin registers the device, `/api/push/subscribe` accepts `{ platform: 'ios', token }`, `lib/apnpush.ts` sends via APNs (using `apn` npm package), `/api/push/send-weekly-report` branches by platform. Migration `20260430_push_platform.sql` adds `platform` column. **Outstanding (layer 3, gated on Apple Dev):**
  - Enable Push Notifications capability in Apple Developer portal for `app.vetra.ios`
  - Generate APNs key (.p8) in Apple Developer portal; download once (Apple won't show it again)
  - Add the Push Notifications capability to the Xcode App target (Signing & Capabilities)
  - Vercel env vars: `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_PRIVATE_KEY` (full .p8 contents — include the `-----BEGIN PRIVATE KEY-----` headers), `APNS_TOPIC=app.vetra.ios`, `APNS_PRODUCTION=1` for production builds (omit / set to `0` for sandbox testing)
  - Test on a real device — the iOS Simulator can't receive live APNs, only simulated payloads via drag-and-drop .apns files
- 🔲 **Universal Links** (defer until production domain is live) — replace custom URL schemes with `https://` deep links. Needs `apple-app-site-association` file at the domain root + Associated Domains entitlement in Xcode. Better trust + UX than custom schemes; not blocking v1.
- 🔲 **Build / signing pipeline** — Xcode signing certificate, provisioning profile, App Store Connect API key for CI uploads. Vercel keeps hosting JS; iOS builds happen on the Mac. Gated on Apple Dev.
- ✅ **Migration `orientation_seen`** — column exists in `user_settings`, read on load + written on completion. Done.

### C. Vercel env config

- ✅ `SUPABASE_SERVICE_ROLE_KEY` — confirmed present
- ✅ `STRAVA_WEBHOOK_VERIFY_TOKEN` — confirmed present
- ✅ `CRON_SECRET` — confirmed present
- ✅ `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` — confirmed present
- ✅ `NEXT_PUBLIC_APP_URL` — confirmed present
- 🔲 `STRIPE_SECRET_KEY` — needs Stripe product setup first
- 🔲 `STRIPE_WEBHOOK_SECRET` — needs Stripe webhook endpoint created
- 🔲 `STRIPE_PRICE_MONTHLY` + `STRIPE_PRICE_ANNUAL` — needs Stripe product + price IDs
- 🔲 `REVENUECAT_WEBHOOK_SECRET` — needs RevenueCat app setup first
- 🔲 `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_PRIVATE_KEY`, `APNS_TOPIC`, `APNS_PRODUCTION` — needs Apple Developer approval + APNs key generated

### D. External setup

- 🔲 **Stripe product + price** — "Zona Premium", £7.99/month + £59.99/year, 14-day trial
- 🔲 **RevenueCat app + entitlement** — link to App Store product ID, set entitlement identifier (e.g. `zona_premium`)
- 🔲 **Apple Small Business Program** — 15% vs 30% cut, enrol before first live transaction
- 🔲 **Custom domain** — point `zona.app/privacy` at live URL

### E. Pre-submission QA

- 🔲 **TestFlight beta** — internal testing on device before public submission
- 🔲 **Full journey test** — agent-browser end-to-end: create account → onboarding → plan on screen → log session → post-log reflect → simulate trial end → attempt paid feature → upgrade prompt
- 🔲 **App Store assets** — screenshots (all required device sizes), preview video (optional), keywords, App Store description copy

---

## NEXT — First wave after App Store ship

Ordered by GTM impact. Each needs FREE/PAID tag confirmed before build.

### GTM commercial

| # | Item | Effort | Tier | Notes |
|---|------|--------|------|-------|
| GTM-08 | **Marketing site** (`app/page.tsx`) — replace dashboard redirect with one-page site: overtraining thesis, ZONA voice, single CTA. Uses `lib/brand.ts` for all copy. Screenshots: session card, reflect view, coach screen | M | FREE | High — must exist before any paid acquisition or press |
| GTM-09 | **Trial expiry email** (day 14) — "Your zone coaching pauses today." Requires email platform (Resend or Supabase Edge + SMTP) | M | PAID | High |
| GTM-10 | **Trial nudge email** (day 11) — "3 days of full access left." Same infra as GTM-09, ships together | S | PAID | Medium |

### R23 engine polish (browser-in-loop work)

After Vercel deploy, verify with agent-browser:

1. ✅ **Phase 5 — Wizard UI updates** — `training_age`, `preferred_long_run_day`, `benchmarkDate` wired; new injuries (Shin splints, Plantar fasciitis, Hip) in list; `motivation_type` + `training_style` removed
2. ✅ **Phase 6.3 — Day-15 transition UI** — shipped 2026-04-29
3. ✅ **Phase 4.2 — Session card integration with `composeSession()`** — wired in DashboardClient; warm-up/main/cool-down rendered with left-accent bars
4. ✅ **Browser-verify B1 + B3 changes** — confirmed working 2026-04-29

### Small UX

- 🔲 **UX-01** — Profile screen email field. Me screen rebuilt (2026-04-29); `ProfileSection` still renders email as editable input but saving email is a no-op (no re-verification flow exists). Decision still needed: make read-only or remove the field entirely.

---

## LATER — Post-launch roadmap

No schedule. Ordered roughly by user value. Each needs FREE/PAID tag in `docs/canonical/feature-registry.md` before build.

| # | Title | Tier | Effort | Notes |
|---|-------|------|--------|-------|
| **R25** | **Historical run intelligence** — "how does this run compare to your past self?" Similarity matching + per-run cohort comparison + trend detection. Source: `strava_activities` table, source-mixed (HealthKit primary + Strava supplementary for users who connect both). Three shippable cuts: ✅ (1) post-run analysis line — augment `/api/analyse-run` AI prompt with cohort-similarity context (~2h, **founder pickup, shipped 2026-04-30**); 🔲 (2) Today pre-run band — single card above session card showing past-self stats for matched cohort, fires only when ≥3 similar runs exist (~4h); 🔲 (3) Coach screen trend cards — 1–3 cards with one sentence + one number each, no charts (~6h) | PAID | ~10h remaining (cuts 2–3) | **Cut #1 done** — `lib/coaching/runHistory.ts` (source-agnostic reader), `COHORT_SIMILARITY` config in `lib/coaching/constants.ts`, principle §58 in `CoachingPrinciples.md`, cohort context wired into `buildSessionFeedbackPrompt`. Two-axis match (distance + HR band) for cut #1; three-axis (adding session.type) deferred to cuts #2/#3. Cuts #2/#3 still depend on HealthKit primary task landing for cohort breadth — wait until that ships before resuming. **Follow-ups deferred:** unit tests for `runHistory.ts` (D-15 journey-test scope when release closes); rename `strava_intelligence` → `activity_intelligence` gate (rolls up into HealthKit primary task) |
| **R22** | **Blockout days** — user marks days unavailable, plan reshapes around them | PAID | M | Bundle with R20 parked triggers — uses same reshape engine |
| **R18** | **Plan confidence score** — derive from session completion + RPE. R17 coaching flags are the per-session atom this aggregates. Logically downstream of R25 — pairs naturally as the next item once the comparison engine ships | PAID | M | Display on dashboard or plan screen |
| **R24** | **Multi-race support** (A/B race hierarchy) | PAID | L | Non-breaking additive: `meta.races: Race[]` on top of existing `meta.race_date`/`race_name` |
| **R21** | **Strength sessions** — flesh out stubs (currently admin-only/hidden) | FREE display / PAID dynamic | M | |
| **R19** | **Coaching tips in Supabase** — move hardcoded copy to a table for dynamic, user-specific messages | PAID | S | |
| **R26** | **Background load (HealthKit)** — count daily step / non-run active minutes against the chronic side of `acuteChronicRatio`. Fixes the false-negative case where a user with a 15k-step day-job is carrying invisible load the plan can't see | PAID | M | Calibration risk — active job vs recovery walks vs cross-train all look the same in step count. Needs a tunable damping factor before it's safe to act on. New field `nonRunActiveMins` on the load calc; surface separately on weekly report before feeding into the trigger |
| **R27** | **Cycle-aware coaching (HealthKit)** — phase-aware notes for female users using HealthKit menstrual data. Closes a class of false-positive readiness flags from the v1 readiness signal (luteal-phase RHR is naturally elevated). Single coaching note per phase shift, not full periodisation | PAID | L | Real differentiator vs Strava/Runna/Planzy. Voice work needed first — matter-of-fact, not patronising. Needs opt-in flow in wizard or MeScreen. Tier sub-decision: gate behind PAID or include free as a brand moat |

### Scoped but unscheduled


- **Zone method selector** — user picks HR zone calc method, stored in `user_settings` — PAID
- **GTM-11 Pricing review** — annual discount currently 37% vs category norm 44–49%. Monthly parameterised in `lib/brand.ts`; can raise to £9.99/month (50% annual discount) without a search-replace. Revisit after first 100 paid conversions

### Parking lot

- Session swap (PAID)
- AM/PM scheduling (PAID)

### Ops

- **Rename Vercel project** from `zona-service-nerds-projects` → `zona` or `zona-app` when name available. Update `NEXT_PUBLIC_APP_URL`, `CLAUDE.md`, this file, `app/api/checkout/route.ts` fallback

---

## Tech Debt

- 🔲 **Tier-divergent rendering utility** — once a second tier-divergent component lands (after `GeneratingCeremony.tsx`), centralise the `tier` prop pattern into shared context or typed convention. Document in `ui-patterns.md`
- 🔲 **Plan history UI** — data is archived to `plan_archive` table (migration `20260424`); browse + restore UI deferred. Schema has `race_name`, `race_date`, `archived_at` for future list display
- 🔲 **AI coach_notes staleness on HR-data change** — `session.coach_notes` are AI-baked into plan JSON at generation/enrichment time and embed numeric values like the Z2 ceiling. When a user updates `resting_hr` or `max_hr` in `user_settings`, live Karvonen recomputes (and surfaces using `getSessionHRDisplay` / `sessionHRBand` follow live), but baked notes still carry the old number. Surfaced by UX-3 audit (2026-04-30): the "Why this session" block reads `session.coach_notes` raw at `DashboardClient.tsx:2190`. **Fix options (pick at build time):** (a) regenerate AI notes when HR inputs change — expensive, full enrichment pass; (b) substitute placeholders at render via the `renderGuidance` template path and stop baking literals into notes; (c) "Refresh notes" prompt in MeScreen when HR delta detected. Option (b) is the architectural fix — eliminates the bake-time literal. Tag: PAID (lives behind `strava_intelligence` / future `activity_intelligence` gate)
- 🔲 **"HR-derived estimate" label inconsistency on Est. pace tile** — the Session detail Est. pace tile (`DashboardClient.tsx:1976–1978`) labels itself "HR-derived estimate" but its value falls through `session.pace_target ?? aerobicPace` (`DashboardClient.tsx:1620`). Only `aerobicPace` is HR-derived (computed in `lib/coaching/aerobicPace.ts` from Strava runs in the Z2 HR band); `session.pace_target` is a coach-prescribed range from the plan. Surfaced by UX-4 commit (2026-04-30). **Fix options:** (a) make label conditional — "Pace target" when source is plan, "HR-derived estimate" when source is `aerobicPace`; (b) always prefer `aerobicPace` for the est. pace tile and route plan-prescribed pace to a separate "Target pace" tile; (c) drop the qualifier label entirely. Option (a) is smallest, brand-truthful change. Tag: FREE display
- ✅ **R20 reshape API gating** — all API routes use `isFeatureAllowed()` not `hasPaidAccess()` directly. Done.

---

## Appendix — Open questions & reference

### R23 deferred items still open

- **R23-D1** — Tier 2 wizard fields (`treadmill_primarily`, `longest_run_ever_km`) need engine consumer / product decision before the wizard work is worth shipping
- ✅ **R23-D2** — Catalogue lookup for legacy plans: abandoned. Legacy plans expire naturally as users regenerate; no restore path needed.
- **R23-D3** — Surface `compressed` flag in UI. Needs design rationale via `frontend-design` skill before shipping
- ✅ **R23-D5** — ReshapeScreen 403 fixed: MeScreen Reshape button now gates on hasPaidAccess, routes free users to UpgradeScreen. Done 2026-04-29.

### R25 design decisions — resolved 2026-04-30

All six locked. Implementation spec:

1. ✅ **Similarity definition:** three-axis match — distance within ±15%, same `session.type`, same observed HR band (low/mid/high). Distance alone is too loose; type alone misses the "went too hard on easy" case.
2. ✅ **Minimum cohort size:** 3 for similarity (post-run line, Today pre-run band), 5 for trend detection (Coach screen). Trend claim is stronger so requires more signal.
3. ✅ **Time window:** 12-month default; auto-shrink to 6 months when cohort > 30 in the last 6 months. **Source under HealthKit pivot:** cohort reads from `strava_activities` table source-mixed — HKWorkout history (every Apple Watch user has months) plus Strava activities for users who connect both. Pre-pivot text said "dense Strava users"; replace with "dense HealthKit + Strava users." The 6-month threshold is more commonly hit under HealthKit primary because HKWorkout coverage is broader than Strava ever was.
4. ✅ **Voice for regression:** neutral observation only, no cause speculation. Matches existing ZONA voice rule ("honest, slightly sarcastic, never motivational"). Example: *"Pace at Z2 has slipped 8s/km over 6 weeks. Worth checking sleep and load."* Causes belong to the user.
5. ✅ **Per-run vs cohort:** both, surfaced separately. Per-run for similarity (post-run line + Today band: "this run vs your last 5"). Cohort average for trend (Coach screen: "your Z2 pace has improved 12s/km"). Don't conflate.
6. ✅ **Tier gate:** fully PAID. Slots into the existing `PAID_ONLY_ONGOING` gate in `lib/plan/featureGates.ts:31` — exactly the "ongoing intelligence layer" pattern that gate exists for. Free users get the plan; paid users get intelligence about how they're running it.

### Free/paid audit (when usage data is available)

Revisits two resolved-but-watchable decisions if commercial signals warrant:
- **Intensity distribution** — engine produces ~90% easy across distances; spec target was 75–88%. Currently kept by design (restraint as the brand). If users drop off citing under-stimulation, smallest change is +1 quality session in build phase for HM/Marathon intermediate+
- **Free regeneration policy** — currently lenient (free users regen freely; AI enrichment is the paid value). If conversion is low and "fresh start" emerges as a real subscription motivator, gate regen only when active future-dated plan exists
