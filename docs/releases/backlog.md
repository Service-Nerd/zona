# Backlog — Zonna

**Job:** What's left to ship. Single source of truth for "what should I work on?"
**Pair:** When an item ships, the `/ship` skill moves it to `docs/canonical/feature-registry.md` "Shipped Features" table. An item lives in exactly one of the two.

Status: 🔲 not started · 🔄 in progress · ❓ needs verification

---

## NOW — Critical path to App Store submission

Everything in this section blocks v1 launch. Group A (legal/policy) and Group D (external setup) can run in parallel with Groups B (engineering) and C (env config). Group E (QA) must follow.

### A. Legal & Apple compliance

- ✅ **Terms of Service** — draft shipped at `app/terms/page.tsx` (mirrors `/privacy` structure, brand voice, covers both Stripe-web and Apple-IAP subscription paths, England & Wales governing law). Linked from pre-login screen alongside privacy. **Approved by user 2026-05-05.** Hosting at the production URL is gated on the custom-domain task below — same blocker as `/privacy`.
- ✅ **Privacy policy hosted** — live at `https://www.zonna.run/privacy`
- 🔄 **App Store Connect setup** — partial (2026-05-08). Done: app record created (Bundle ID `app.zonna.ios`), subscription group `Zonna Premium`, monthly product `zonna_premium_monthly` (£7.99), annual product `zonna_premium_annual` (£59.99), 14-day free trial configured on both. Outstanding: screenshots for all required device sizes, App Store description, keywords, per-product Review Information.
- 🔲 **DSA trader compliance** — EU Digital Services Act requires Apple to display verified trader contact info on EU listings. Selling subscriptions = trader by default. Apple needs trader name, deliverable street address (no PO Box), phone, email — all become public on EU App Store listings. Decide on address strategy (home / virtual office / Ltd registered office) before declaring. Blocks EU distribution only — not US/UK ship. Deferred 2026-05-08.

### B. Engineering blockers

- ✅ **Native shell — Capacitor iOS** — bootstrapped. App boots in simulator with Zonna icon + splash, status bar polished (warm slate, dark text), splash auto-hides on web mount via `CapacitorBoot.tsx`, OAuth deep-link infrastructure in place via `app.zonna.ios://auth-callback` URL scheme. Plugins installed: `splash-screen`, `status-bar`, `browser`, `app`, `push-notifications`. `server.url` strategy with `allowNavigation` whitelist for OAuth providers. See `CLAUDE.md` § Native shell.
- ✅ **Google OAuth on native** — opens via SFSafariViewController (`@capacitor/browser`); returns through custom URL scheme; `CapacitorBoot.tsx` exchanges the code and `router.replace`s to `/dashboard`. Same pattern reusable for Strava (still on `window.location.href`).
- 🔲 **Strava as secondary source** *(post-launch)* — once HealthKit is primary, keep Strava OAuth + webhook + `strava_activities` writes alive but optional. Dedupe rule: if a HealthKit workout and a Strava activity match within ±5 min and ±5% distance, prefer the source with HR stream data; otherwise prefer HealthKit (always present on iOS). Apply for Strava API approval in parallel — not blocking v1.
- ✅ **StoreKit 2 integration** — via `@revenuecat/purchases-capacitor`. Done 2026-05-15. SDK initialised in `CapacitorBoot.tsx` with Supabase user ID as `appUserID`. `UpgradeScreen` branches on `Capacitor.isNativePlatform()`: native → `getOfferings() → purchasePackage()` (StoreKit sheet); web → Stripe checkout (unchanged). Silent cancel handling (`userCancelled`). Success state after purchase. Webhook → `subscriptions` table → tier refreshes on next load.
- 🔲 **Universal Links** (defer until production domain is live) — replace custom URL schemes with `https://` deep links. Needs `apple-app-site-association` file at the domain root + Associated Domains entitlement in Xcode. Associated Domains capability enabled in Apple Developer portal 2026-05-08; awaiting custom domain. Better trust + UX than custom schemes; not blocking v1.
- ✅ **Build / signing pipeline** — Xcode automatic signing configured 2026-05-15. `APNS_PRODUCTION` flipped to `1` in Vercel for TestFlight. First TestFlight archive uploaded 2026-05-15 (TestFlight Internal Only).
- ✅ **Migration `orientation_seen`** — column exists in `user_settings`, read on load + written on completion. Done.
- ✅ **LaunchScreen redesign — solid Warm Slate, no circles** — shipped 2026-05-16 (LAUNCH-SCREEN-01). Storyboard reduced to a plain `UIView` with `backgroundColor = #F3F0EB`; orphaned `Splash.imageset` (1366×1366 concentric-circles PNG) left in `Assets.xcassets` for now (no storyboard reference, harmless ~840KB bundle weight — cleanup deferred). The wordmark/tagline native variant from the original spec was deliberately not built — minimum-viable solid-colour fix lets the parametrised web loading screen (in `DashboardClient.tsx`) be the only branded boot surface, which means `BRAND.tagline` rename safety is preserved without re-archiving. **Requires new TestFlight archive** for users to see it — Xcode manual step.

### C. Vercel env config

- ✅ `SUPABASE_SERVICE_ROLE_KEY` — confirmed present
- ✅ `STRAVA_WEBHOOK_VERIFY_TOKEN` — confirmed present
- ✅ `CRON_SECRET` — confirmed present
- ✅ `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` — confirmed present
- ✅ `NEXT_PUBLIC_APP_URL` — confirmed present
- 🔲 `STRIPE_SECRET_KEY` — needs Stripe product setup first
- 🔲 `STRIPE_WEBHOOK_SECRET` — needs Stripe webhook endpoint created
- 🔲 `STRIPE_PRICE_MONTHLY` + `STRIPE_PRICE_ANNUAL` — needs Stripe product + price IDs
- ✅ `REVENUECAT_WEBHOOK_SECRET` — added to Vercel 2026-05-15
- ✅ `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_PRIVATE_KEY`, `APNS_TOPIC`, `APNS_PRODUCTION` — set. `APNS_PRODUCTION=1` flipped 2026-05-15 for TestFlight.

### D. External setup

- 🔲 **Stripe product + price** — "Zonna Premium", £7.99/month + £59.99/year, 14-day trial
- ✅ **RevenueCat app + entitlement** — project created, iOS app added (bundle ID `app.zonna.ios`), In-App Purchase key configured, products `zonna_premium_monthly` + `zonna_premium_annual` added manually, entitlement `zonna_premium` created + both products attached, default offering configured. Webhook set to `https://rts-training-hub.vercel.app/api/webhooks/revenuecat` with `Authorization` header. Public SDK key in Vercel as `NEXT_PUBLIC_REVENUECAT_API_KEY`. Done 2026-05-15. **Note:** App Store Connect API credentials warning partially resolved; product MISSING_METADATA status requires localization + review screenshot on each product in App Store Connect.
- ✅ **Apple Small Business Program** — enrolled 2026-05-15. 15% commission rate active before first live transaction.
- ✅ **Custom domain** — `zonna.run` purchased and DNS pointed at Vercel 2026-05-15. Live and resolving. `capacitor.config.ts` `server.url` updated to `https://www.zonna.run/dashboard`. Privacy/terms TODO comments cleaned up.

### E. Pre-submission QA

- 🔄 **TestFlight beta** — build uploaded and processing 2026-05-15 (second upload after adding `NSHealthUpdateUsageDescription` to Info.plist — required by Apple when HealthKit entitlement is present even when app is read-only). Once available: add yourself as internal tester in App Store Connect → TestFlight, install on device, run full journey test.
- 🔲 **Full journey test** — agent-browser end-to-end: create account → onboarding → plan on screen → log session → post-log reflect → simulate trial end → attempt paid feature → upgrade prompt
- 🔲 **App Store assets** — screenshots (all required device sizes), preview video (optional), keywords, App Store description copy

---

## NEXT — First wave after App Store ship

Ordered by GTM impact. Each needs FREE/PAID tag confirmed before build.

### GTM commercial

| # | Item | Effort | Tier | Notes |
|---|------|--------|------|-------|
| GTM-08 🔄 | **Marketing site** (`app/page.tsx`) — **built and dark-launched 2026-05-12**. One-page site rendered: top nav, hero with `BRAND.appStoreSubtitle` headline + voice-anchor pill, overtraining thesis section ("Every run ends up in the same grey middle"), three pillar cards, three pure-CSS product mockups (session card / reflect view / Kit weekly note), closing `BRAND.brandStatement` moment, footer with Privacy + Terms. All copy via `BRAND.*` — no hardcoded brand strings. Gated behind `MARKETING_SITE_ENABLED` env flag; defaults to legacy redirect-to-dashboard so production discovery is unchanged. **Flip env to `"true"` in Vercel when custom domain + TestFlight are both ready.** Future enhancement (deferred): waitlist email capture for iPhone-only pre-launch visitors (~1h via Supabase `waitlist` table). | M | FREE | High — must exist before any paid acquisition or press |
| GTM-09 | **Trial expiry email** (day 14) — "Your zone coaching pauses today." Requires email platform (Resend or Supabase Edge + SMTP) | M | PAID | High |
| GTM-10 | **Trial nudge email** (day 11) — "3 days of full access left." Same infra as GTM-09, ships together | S | PAID | Medium |

### R23 engine polish (browser-in-loop work)

After Vercel deploy, verify with agent-browser:

1. ✅ **Phase 5 — Wizard UI updates** — `training_age`, `preferred_long_run_day`, `benchmarkDate` wired; new injuries (Shin splints, Plantar fasciitis, Hip) in list; `motivation_type` + `training_style` removed
2. ✅ **Phase 6.3 — Day-15 transition UI** — shipped 2026-04-29
3. ✅ **Phase 4.2 — Session card integration with `composeSession()`** — wired in DashboardClient; warm-up/main/cool-down rendered with left-accent bars
4. ✅ **Browser-verify B1 + B3 changes** — confirmed working 2026-04-29

### Small UX

- ✅ **UX-01** — fixed 2026-05-01: Profile email field is now read-only (`readOnly` + muted styling + `tabIndex={-1}` + `aria-readonly`). Email is auth identity owned by the OAuth provider — visible for orientation, not editable. Save button only commits first/last name; email passes through unchanged. Done.

### AI visibility & provenance

*(no open items — see feature-registry for shipped AI provenance work)*

### AI coaching depth

*Surfaced by 2026-05-11 manual coaching audit (Russ's Goring Gap 53km debrief vs. what Zonna would have produced). Three highest-leverage items shipped that day as AI-DEPTH-01 (see feature-registry). Remaining gaps below — ordered by impact ÷ effort.*

- 🔄 **AI-DEPTH-02 — HealthKit per-km splits + HR-over-time analysis** *(scoped 2026-05-11; HR-drift component shipped 2026-05-11 as AI-DEPTH-02a)* — **HR-drift component shipped** as `lib/coaching/streamAnalysis.ts` → `computeHrStreamSummary()`. Computes first-third vs last-third avg HR + drift bpm + drift % from `raw_payload.hrSamples` on HealthKit-sourced `strava_activities` rows. Fed into `buildSessionFeedbackPrompt` with a thresholded reference rule (≥10 bpm or ≥7% surfaces directly; sparse-sample flag downgrades confidence). **Still pending (AI-DEPTH-02b):** per-km splits analysis. HealthKit doesn't natively give per-km splits — would need to bucket the HR + distance samples into 1-km windows server-side. For Strava-sourced activities, pull `splits_metric` at link time when API access lands (`app/api/webhooks/strava/route.ts` enrichment step). Strava also doesn't currently persist per-sample HR (only bucketed zones) — `streamSummary` is null for Strava-sourced runs until that pipeline lands. Effort remaining: S–M (~3 days for splits + Strava ingestion). No schema change required for HK side; Strava-side needs raw stream persistence on webhook ingest.

- 🔲 **AI-DEPTH-03 — Multi-month trend block (same-effort run comparison)** *(scoped 2026-05-11)* — extends `lib/coaching/runHistory.ts` from single-comparison cohorts (R25 cut #1, already shipped) to a trend series. New `/api/coaching/trend?metric=hr_at_z2_pace&window=12w` returns a sparse series of same-effort runs over time, e.g. *"Long-run avg HR at 5:40/km pace, Feb 166 → May 149."* Surfaces on Coach screen as a third stat card or under the existing weekly report. Tier: PAID. Effort: M (~1 week). The manual audit caught this trend explicitly — Russ's long-run HR dropped 17 bpm at the same pace from Feb to May, which is exactly the kind of signal Zonna has the data for but no surface to show. Dependency: HealthKit data breadth (already there).

- ✅ **AI-DEPTH-04 — Conversation memory across weekly reports** *(shipped 2026-05-11)* — see feature-registry entry AI-DEPTH-02. Previous week's `weekly_reports.headline` + `body` now fetched in `app/api/weekly-report/route.ts` and passed to `buildWeeklyReportPrompt` as a `PreviousReportSummary` block. Prompt instructs at most one reference, only when this week's data tracks against last week's story (improvement or repeat-issue). Week 1 and silent-fallback weeks skip the fetch via conditional `Promise.resolve({ data: null })`. Closes the "every report fires standalone, no continuity" gap.

- ✅ **AI-DEPTH-10 — Cross-surface conversation memory** *(scoped + shipped 2026-05-11)* — see feature-registry entry. Extends the AI-DEPTH-04 pattern to the four remaining coaching surfaces (daily coach note, plan adjustment explanation, phase summary, session feedback), each with its own continuity reference: daily note ← last weekly report; adjustment explanation ← previous resolved adjustment; phase summary ← previous phase summary content; session feedback ← single most-recent same-type analysed session. Same "reference at most once, only when data tracks against it" rule across all four. Closes the "no memory of prior outputs" audit gap completely.

- 🔲 **AI-DEPTH-05 — Post-session structured capture (parked, decision needed)** *(scoped 2026-05-11)* — original audit recommendation was a 3–5-question structured sheet after long/quality/race. **User flagged friction concern 2026-05-11**: adding form questions trains users to skip the whole post-session flow including the RPE we already get value from. Three reframes to evaluate before committing:
  (a) **Event-triggered, not session-triggered.** Only ask when the rule engine flagged something the data alone can't explain (HR drift >15%, late-run pace fade, off-target on a routine session). Maybe once a month per user. Friction matches signal value.
  (b) **Voice memo, not form.** "Talk to your watch for 20 seconds about how that run felt." Whisper transcription + Haiku extraction. Lower friction, bigger build (3–4 days vs 1 day for form). Strong "this app listens" moment, on-brand.
  (c) **Defer entirely.** Ship AI-DEPTH-02/03/04 first; revisit only if AI is still demonstrably guessing at things only the runner knows.
  My current take: defer (c). The three data-side wins probably close ~70% of the qualitative gap without any new user friction. Revisit after AI-DEPTH-02 lands.

- 🔲 **AI-DEPTH-06 — Image/vision analysis (paid-tier upsell)** *(scoped 2026-05-11)* — let users upload a screenshot of their watch's splits screen. Route through Claude with vision; extract the same metrics AI-DEPTH-02 would compute. Bigger build (1 week+), and the first surface where user-uploaded images leave the device — needs privacy review (retention, PII redaction). Lower priority than AI-DEPTH-02 because the structured-stream path is cheaper and more reliable. Tier: PAID (consider gating as premium-of-paid). Don't pick up until AI-DEPTH-02 has demonstrably shipped value.

- 🔲 **AI-DEPTH-08 — Post-race reshape route** *(scoped 2026-05-11; unblocked by AI-DEPTH-07 shipping 2026-05-12)* — biggest item from the audit. Closest analogue to Russ's manual v2.4→v3.0 rewrite after Goring Gap. New `POST /api/post-race-reshape` consuming a structured race-result entry (you'd build the UI to log a finish: time, splits, HR drift, what went wrong/right, kit + fueling outcomes). Hybrid pattern per ADR-006: rule engine proposes structural changes (taper restructure, key_session flags, fueling protocol updates, run-walk strategy when a race day exposed a need), Claude-Sonnet adds voice and per-session coach notes. **Needs ANTHROPIC_MODEL_DEEP (Sonnet) — Haiku will fall over on plan-shaped reasoning.** Lift the `TAPER_PROTECTION_WEEKS` guard conditionally when a post-race reshape is the explicit trigger (currently any week within the taper window is locked). Tier: PAID — extends `dynamic_reshape_r20` gate. Effort: L (~2–3 weeks). Schema scaffolding (`Session.key_session`/`run_walk_strategy`/`fueling_protocol`, `Week.result_embedded`, `RaceResult` type) shipped 2026-05-12.

- 🔲 **AI-DEPTH-09 — Coach chat (deferred indefinitely)** *(scoped 2026-05-11)* — original audit Step-5 (injury/equipment diagnosis) was recommended for deferral on three grounds: liability surface, off-brand (Zonna is zone discipline, not shoe lacing), and the kit-and-blister advice from Russ's manual session wasn't where the real coaching value lived. If a paid-tier freeform chat is later considered, it slots here as a new gate `coach_chat`. Effort: L. Out of scope until product strategy explicitly invites it.

### Plan adjustments

*(no open items — see feature-registry for shipped plan-adjustment work)*

### Post-run journey

*(no open items — see feature-registry for POST-RUN-01 + POST-RUN-02)*

### Plan screen

- 🔲 **PLAN-VOICE-AI — AI-generated week voice on Plan screen** *(scoped 2026-05-14, deferred from PLAN-REDESIGN-01)* — upgrades the Plan screen's voice card from rule-engine derivation (`getWeekVoiceHeadline` / `getWeekVoiceItems` in `DashboardClient.tsx`) to a real AI surface. New `POST /api/plan-weekly-note` route fetches the week's session shape + phase + race countdown + previous week's note (continuity per AI-DEPTH-04/10 pattern) and returns a one-sentence headline + 1–2 items in Kit's voice. Cached per `(user_id, week_n)` to avoid re-generation cost. When this ships, the Plan voice card gains a `<CoachByline color="moss" role="This week" onClick={→ Coach} />` and a 3px moss left rail (already shipped as the rail). UI surface stays put — only the data source changes. Tier: PAID. Effort: M (~1 day). Dependency: reuses existing AI-DEPTH-04 continuity-memory pattern.

- 🔲 **PLAN-STRIP-EXPAND — Tap-to-expand WeekStripCard on Plan screen** *(scoped 2026-05-14, deferred from PLAN-REDESIGN-01)* — strip cards in the "Later" section are currently read-only. Move/swap is restricted to Now + Next weeks (the typical adjustment window). For users who need to move sessions in a Later week (e.g. planned trip 4 weeks out), add tap-to-expand: tap a strip card → it morphs inline into a full `<WeekCard>` with day rows, move/swap interactions. Tap the header again to collapse. State: `expandedLaterWeek: number \| null` in `PlanCalendar.tsx` (single-week expansion at a time keeps the UI predictable). Tier: FREE. Effort: S (~½ day). Dependency: none — additive to PLAN-REDESIGN-01.

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
| **R19** | **Coaching tips in Supabase** — move hardcoded copy to a table for dynamic, user-specific messages | PAID | S | **Don't pick up without a product trigger.** Scoped 2026-05-01: current hardcoded copy (`getCompletionCopy`, `getReflectResponse` in `DashboardClient.tsx`; `ZONE_COPY` in `lib/coaching/zoneCopy.ts`) branches on session type + RPE — both already known client-side. No user segmentation exists, so the migration alone doesn't unlock "dynamic per user" — it just adds a DB read + fallback path. Worth building only when there's a real driver: a non-engineer copy editor, an A/B test you actually want to run, or the first cohort that genuinely needs different copy (e.g. beginner vs intermediate). Until then, two switch statements are the right level of abstraction. |
| **R26** | **Background load (HealthKit)** — count daily step / non-run active minutes against the chronic side of `acuteChronicRatio`. Fixes the false-negative case where a user with a 15k-step day-job is carrying invisible load the plan can't see | PAID | M | Calibration risk — active job vs recovery walks vs cross-train all look the same in step count. Needs a tunable damping factor before it's safe to act on. New field `nonRunActiveMins` on the load calc; surface separately on weekly report before feeding into the trigger |
| **R27** | **Cycle-aware coaching (HealthKit)** — phase-aware notes for female users using HealthKit menstrual data. Closes a class of false-positive readiness flags from the v1 readiness signal (luteal-phase RHR is naturally elevated). Single coaching note per phase shift, not full periodisation | PAID | L | Real differentiator vs Strava/Runna/Planzy. Voice work needed first — matter-of-fact, not patronising. Needs opt-in flow in wizard or MeScreen. Tier sub-decision: gate behind PAID or include free as a brand moat |
### Scoped but unscheduled


- **Zone method selector** — user picks HR zone calc method, stored in `user_settings` — PAID
- **GTM-11 Pricing review** — annual discount currently 37% vs category norm 44–49%. Monthly parameterised in `lib/brand.ts`; can raise to £9.99/month (50% annual discount) without a search-replace. Revisit after first 100 paid conversions
- **Supplementary session slots** — second session per day for strength / cross-train / yoga / mobility. Explicitly NOT AM/PM run-doubling (different audience pattern, counter to brand). Tier: slot FREE, AI placement PAID. Estimate ~3 weeks.
  - **Model (option B — primary + secondary):** primary session stays keyed by `day`. Adds optional `secondary_session: Session | null` on `Week.days[day]`. Adds `slot TEXT NOT NULL DEFAULT 'primary'` column (check `IN ('primary','secondary')`) to `session_completions`, `session_overrides`, `run_analysis`. Replaces unique constraints to include `slot`. Backfill all existing rows to `'primary'`. **Every `onConflict: 'user_id,week_n,session_day'` upsert in the codebase becomes `'user_id,week_n,session_day,slot'`** — grep before merge.
  - **Engine impact:** `validatePlan` invariants (secondary may only exist when primary exists; secondary type ∈ allowed supplementary types; intra-day load cap when primary hard + secondary hard); `buildReorderAdjustment` adjacency check goes 2-D (same-day across slots also counts as back-to-back hard); `autoMatchAndAnalyse` routes by activity type — `Run`/`TrailRun` → primary, `WeightTraining`/`Yoga`/`Ride`/`Swim` → secondary; `/api/adjust-plan` `{fromDay,toDay}` becomes `{from:{day,slot}, to:{day,slot}}`. Coaching call needed in `CoachingPrinciples.md` on whether strength counts toward fatigue load.
  - **UI:** Today renders secondary as a smaller, indented sub-card directly under primary (rule: *one day = one block, with optional sub-row* — secondary is visually subordinate, not a second equal card); Plan-screen `DayRow` gets a `+` affordance ("Add a session") + slot-aware Move; Wizard adds one question ("Do you do strength or cross-training? We'll fit it around your runs"). Cross-slot moves blocked at MVP — only same-slot moves between days.
  - **Value framing:** wizard frames it as accommodation not capability ("Most plans pretend you only run. We'll fit your strength work in without breaking the easy/hard rhythm"); empty-slot affordance copy promises restraint ("Add strength, yoga, or a cross-train. We'll watch it doesn't pile up"); coach narrative names doubled-day zone discipline when it lands ("Strength yesterday, easy run today. Kept it under control"); weekly report splits Run load vs Supplementary load. For users who don't opt in, nothing changes — feature is invisible.
  - **Phasing:** A — schema migration + backfill + Plan-screen `+` + manual log to secondary (~1w); B — engine integration: `validatePlan`, adjacency, autoMatch routing, coaching load (~1w); C — Wizard question + AI placement of secondary on plan generation (~1w); D — Coach narrative copy that names doubled-day discipline (S).
  - **Risks:** PK migration footprint (every `session_completions` upsert needs slot); autoMatch mis-routing (graceful fallback when a `WeightTraining` arrives at a day with no secondary slot — decision needed: create slot? skip? prompt?); visual creep on Today (must hold the "subordinate sub-row" rule); `plan_archive` JSON backwards-compat (easy if `secondary_session` stays optional); 3-layer invariant drift (`CoachingPrinciples.md` → `GENERATION_CONFIG` → `validatePlan` need same-PR updates); scope creep to AM/PM once slot exists — hold the line.
  - **Out of scope:** AM/PM run-doubling. Advanced-runner pattern, counter to *"Slow down. You've got a day job."* Stays deferred indefinitely; revisit only if the audience shifts.

### Ops

- **Rename Vercel project** from `zona-service-nerds-projects` → `zonna` (or `zonna-app` if taken) when name available. Update `NEXT_PUBLIC_APP_URL`, `CLAUDE.md`, this file, `app/api/checkout/route.ts` fallback.
- **Update local git remote URL** — GitHub repo moved from `Service-Nerd/rts-training-hub` → `Service-Nerd/zona` (verified via push redirect notice 2026-05-12). Pushes still succeed via redirect, but the local origin URL is stale. Fix: `git remote set-url origin https://github.com/Service-Nerd/zona.git`. Ideally the GitHub repo gets a second rename to `zonna` to align with the brand — bundle both into one operation.

---

## Tech Debt

### Rebrand follow-ups (Vetra → Zonna, May 2026)

The Vetra → Zonna rename (commits `fda3ff6` + `ba469df`) is complete in code, native shell, icons, OG image, and current-truth docs. The items below are non-blocking hygiene and decisions that can land any time post-launch.

- ✅ **BRAND-01 — Domain rollout** — `zonna.run` live 2026-05-15. DNS pointed, custom domain in Vercel, email refs already `support@zonna.run`, TODO comments removed, `capacitor.config.ts` `server.url` updated, `VAPID_SUBJECT` set in Vercel 2026-05-15. **Outstanding:** set up email forwarding `support@zonna.run` → your inbox (registrar config, not code).
- 🔲 **BRAND-02 — Vercel project rename** *(P3, ~2 min)* — currently `rts-training-hub`. Rename via Vercel dashboard. Affects preview URLs only — code-side: nothing.
- 🔲 **BRAND-03 — Supabase project rename (cosmetic)** *(P3, ~1 min, optional)* — Supabase project display name can be renamed but the ID `wkppmpsvqkaxbekdgzdm` is permanent. Purely cosmetic.
- 🔲 **BRAND-04 — npm package rename** *(P3, ~1 min)* — `package.json:2` still says `"name": "vetra"`. Rename to `"zonna"` whenever convenient. Triggers `package-lock.json` regeneration on next install.
- 🔲 **BRAND-05 — Remove old `app.vetra.ios` allowlist entries** *(P2, ~5 min)* — once the new bundle ID is verified in TestFlight, remove the lingering `app.vetra.ios` entries from Apple Developer portal, Supabase Auth Redirect URLs, Supabase Apple provider Authorized Client IDs, Google OAuth iOS bundle IDs.
- 🔲 **BRAND-06 — CSS keyframe + alias rename** *(P3, ~20 min)* — `globals.css` still defines `--vetra-amber`, `--vetra-red`, `@keyframes vetra-fade-in`, `@keyframes vetra-slide-up`. `DashboardClient.tsx` (`vetra-shimmer` inline) and `ZoneInfoSheet.tsx` reference these. Rename to `--zonna-*` / `zonna-*` and update all callsites. No user-visible impact. Bundle with another `globals.css` cleanup pass. Currently documented in `brand.md` and `ui-patterns.md` with explicit "name retained pending BRAND-06" notes.
- 🔲 **BRAND-07 — Legacy storage key migration** *(P3, ~1 hr)* — `lib/health/clientSync.ts:26` uses `vetra_healthkit_last_sync_ts`; `DashboardClient.tsx` + `GeneratePlanScreen.tsx` use `zona_wizard_draft`, `zona_guide_seen`, `zona_coach_intro_seen`. Renaming wipes user state. Write a one-time read-old → write-new → delete-old migration on app boot. Low priority — these are functional IDs invisible to users.
- 🔲 **BRAND-08-pwa — Regenerate PWA icon PNGs** *(P2, ~5 min)* — `public/icons/icon-*.png` still rendered from the old ring+dot mark. Need to regenerate from the new concentric-rings SVG so PWA install / favicon / Add-to-Home Screen use the new design. iOS app icon (Capacitor) already done — this is web-only.
- 🔲 **BRAND-09 — App Store screenshot templates** *(P2, ~2 days)* — when screenshots get built, ensure they use the Zonna wordmark with NN-moss device. Per `brand-product-alignment.md §7`, the 5-screenshot narrative arc is locked but the visuals don't exist yet.
- 🔲 **BRAND-10 — Update `mockups/ai-visibility-audit.html`** *(P3, ~2 min, optional)* — still references Vetra. Outside the build, kept for design context. Update or archive on next visit to that file.
- 🔲 **BRAND-11 — Convention reminder** *(P3, 0 min)* — new SQL migrations should use "Zonna voice" in comments. Committed migrations are immutable history; don't edit them.
- 🔲 **BRAND-12 — Rebrand `scripts/generate-coaching-review.ts`** *(P3, ~10 min)* — hardcoded "Zona" in the Claude Desktop prompt template. Refactor to import `BRAND.name`.
- 🔲 **BRAND-13 — Rename GitHub repo `zona` → `zonna`** *(P3, ~5 min)* — currently push goes via the redirect (`zona` → was renamed from `rts-training-hub`; now stale). After rename: `git remote set-url origin https://github.com/Service-Nerd/zonna.git` locally.

### General

- 🔲 **Tier-divergent rendering utility** — once a second tier-divergent component lands (after `GeneratingCeremony.tsx`), centralise the `tier` prop pattern into shared context or typed convention. Document in `ui-patterns.md`
- 🔲 **Plan history UI** — data is archived to `plan_archive` table (migration `20260424`); browse + restore UI deferred. Schema has `race_name`, `race_date`, `archived_at` for future list display
- ✅ **AI coach_notes staleness on HR-data change** — fixed 2026-05-01 via option (b). Three changes: (1) `lib/plan/enrich.ts` system prompt now instructs Haiku to emit `{{zone2_ceiling}}` / `{{session_hr}}` / `{{session_pace}}` placeholders in `coach_notes` instead of literal numbers, with explicit good/bad examples and the full token vocabulary; (2) `app/dashboard/DashboardClient.tsx` "Why this session" block passes the joined `coach_notes` string through `renderGuidance` so placeholders resolve to live values via `guidanceContextFromSession`; (3) `lib/plan/renderGuidance.ts` hardened — tolerant of whitespace inside braces, orphan-token strip, double-space + pre-punctuation collapse, so any AI freelancing or unknown tokens render cleanly rather than leaking raw `{{...}}` to the user. Pre-tokenised legacy plans pass through unchanged. New plans get the fix on next enrichment.
- ✅ **"HR-derived estimate" label inconsistency on Est. pace tile** — fixed 2026-05-01 via option (a): `paceSource` flag derived alongside `paceBracket` in `SessionPopupInner`; tile label now reads "Pace target" when value comes from `session.pace_target` and "HR-derived estimate" only when it's the live `aerobicPace`. Skeleton-tile branch is by definition aerobic, so its label is unchanged. Done.
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
4. ✅ **Voice for regression:** neutral observation only, no cause speculation. Matches existing ZONNA voice rule ("honest, slightly sarcastic, never motivational"). Example: *"Pace at Z2 has slipped 8s/km over 6 weeks. Worth checking sleep and load."* Causes belong to the user.
5. ✅ **Per-run vs cohort:** both, surfaced separately. Per-run for similarity (post-run line + Today band: "this run vs your last 5"). Cohort average for trend (Coach screen: "your Z2 pace has improved 12s/km"). Don't conflate.
6. ✅ **Tier gate:** fully PAID. Slots into the existing `PAID_ONLY_ONGOING` gate in `lib/plan/featureGates.ts:31` — exactly the "ongoing intelligence layer" pattern that gate exists for. Free users get the plan; paid users get intelligence about how they're running it.

### Free/paid audit (when usage data is available)

Revisits two resolved-but-watchable decisions if commercial signals warrant:
- **Intensity distribution** — engine produces ~90% easy across distances; spec target was 75–88%. Currently kept by design (restraint as the brand). If users drop off citing under-stimulation, smallest change is +1 quality session in build phase for HM/Marathon intermediate+
- **Free regeneration policy** — currently lenient (free users regen freely; AI enrichment is the paid value). If conversion is low and "fresh start" emerges as a real subscription motivator, gate regen only when active future-dated plan exists
