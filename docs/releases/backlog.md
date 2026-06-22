# Backlog — Zonna

**Job:** The detailed item store — full specs, scope notes, SLC framing for everything left to ship (product *and* go-to-market).
**View:** For the at-a-glance Now/Next/Later plan across product + market, see **`docs/releases/roadmap.md`** — it surfaces these items as one-liners on a horizon × workstream grid. This doc holds the detail behind each.
**Pair:** When an item ships, the `/ship` skill moves it to `docs/canonical/feature-registry.md` "Shipped Features" table. An item lives in exactly one of the two.

Status: 🔲 not started · 🔄 in progress · ❓ needs verification

---

## NOW — Critical path to App Store submission

Everything in this section blocks v1 launch. Group A (legal/policy) and Group D (external setup) can run in parallel with Groups B (engineering) and C (env config). Group E (QA) must follow.

### A. Legal & Apple compliance

- ✅ **Terms of Service** — draft shipped at `app/terms/page.tsx` (mirrors `/privacy` structure, brand voice, covers both Stripe-web and Apple-IAP subscription paths, England & Wales governing law). Linked from pre-login screen alongside privacy. **Approved by user 2026-05-05.** Hosting at the production URL is gated on the custom-domain task below — same blocker as `/privacy`.
- ✅ **Privacy policy hosted** — live at `https://www.zonna.run/privacy`
- ✅ **App Store Connect setup** — complete. App record, subscription products, copy, Privacy Details, demo account, screenshots all live. **App submitted for review 2026-06-05.**
- ⏸️ **DSA trader compliance** — EU Digital Services Act requires Apple to display verified trader contact info on EU listings (name, deliverable street address — no PO Box, phone, email — all become public). Selling subscriptions = trader by default. **EU deferred to v1.1+ (decision 2026-05-21).** v1 ships US/UK/anglosphere only — neither requires trader disclosure. Switching EU on later is a 30-min ASC config + 1–2 week verification wait — fully reversible. Address strategy when revisited: virtual office (~£25–£40/month, serviced office that accepts post for Apple verification) is the leading default for a solo founder. Home address rejected — publicly listed forever, privacy downside doesn't unwind. Ltd only if incorporating anyway for tax/liability/fundraising reasons.

### B. Engineering blockers

- ✅ **Native shell — Capacitor iOS** — bootstrapped. App boots in simulator with Zonna icon + splash, status bar polished (warm slate, dark text), splash auto-hides on web mount via `CapacitorBoot.tsx`, OAuth deep-link infrastructure in place via `app.zonna.ios://auth-callback` URL scheme. Plugins installed: `splash-screen`, `status-bar`, `browser`, `app`, `push-notifications`. `server.url` strategy with `allowNavigation` whitelist for OAuth providers. See `CLAUDE.md` § Native shell.
- ✅ **Google OAuth on native** — opens via SFSafariViewController (`@capacitor/browser`); returns through custom URL scheme; `CapacitorBoot.tsx` exchanges the code and `router.replace`s to `/dashboard`. Same pattern reusable for Strava (still on `window.location.href`).
- 🔲 **Strava as secondary source** *(post-launch)* — once HealthKit is primary, keep Strava OAuth + webhook + `strava_activities` writes alive but optional. Dedupe rule: if a HealthKit workout and a Strava activity match within ±5 min and ±5% distance, prefer the source with HR stream data; otherwise prefer HealthKit (always present on iOS). Apply for Strava API approval in parallel — not blocking v1. **Ingest-time dedup rule SHIPPED 2026-05-30 (INGEST-DEDUP-01).** `consolidateIncomingHealthKitRow` (`lib/coaching/healthkitConsolidate.ts`) runs on the HealthKit ingest path (`/api/health/ingest`): if a Strava row or another HealthKit row already covers the same run (±5 min / ±5%, tighter than the ±15/±15% enrich path because suppressing a row is destructive), the incoming HK row is skipped (no delete, no FK re-pointing — the existing row stays canonical), lifting the HR summary onto the canonical row first if it lacked one. This is the symmetric partner to the pre-existing `tryEnrichHealthKitRow` (Strava-arrives-finds-HK). Pure decision unit-tested in `healthkitConsolidate.test.ts`. The 2026-05-23 backfill dupes were cleared by the one-time `scripts/cleanup-dupes.mjs` sweep. **R25 cohort cuts 2–3 are now safe** from cross-source double-counting. The same decision also guards the self re-sync case: re-ingesting an *already-enriched* HK workout (same `apple_health_uuid`, Strava id patched on) is now skipped rather than upserting `strava_activity_id: null` over the link + overwriting the Strava HR.
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
- ⏸️ `STRIPE_SECRET_KEY` — **deferred to v1.1 (2026-05-21).** iOS-only launch.
- ⏸️ `STRIPE_WEBHOOK_SECRET` — deferred to v1.1.
- ⏸️ `STRIPE_PRICE_MONTHLY` + `STRIPE_PRICE_ANNUAL` — deferred to v1.1.
- ✅ `REVENUECAT_WEBHOOK_SECRET` — added to Vercel 2026-05-15
- ✅ `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_PRIVATE_KEY`, `APNS_TOPIC`, `APNS_PRODUCTION` — set. `APNS_PRODUCTION=1` flipped 2026-05-15 for TestFlight.

### D. External setup

- ⏸️ **Stripe product + price** — "Zonna Premium", £7.99/month + £59.99/year, 14-day trial. **Deferred to v1.1 (2026-05-21).** iOS-only launch; revisit ~2 weeks post-launch alongside marketing-site public flip + non-iOS acquisition.
- ✅ **RevenueCat app + entitlement** — project created, iOS app added (bundle ID `app.zonna.ios`), In-App Purchase key configured, products `zonna_premium_monthly` + `zonna_premium_annual` added manually, entitlement `zonna_premium` created + both products attached, default offering configured. Webhook set to `https://rts-training-hub.vercel.app/api/webhooks/revenuecat` with `Authorization` header. Public SDK key in Vercel as `NEXT_PUBLIC_REVENUECAT_API_KEY`. Done 2026-05-15. ✅ **MISSING_METADATA resolved 2026-05-28** — localization + review screenshot added on each product in App Store Connect; both `zonna_premium_monthly` and `zonna_premium_annual` now show "Ready to Submit".
- ✅ **Apple Small Business Program** — enrolled 2026-05-15. 15% commission rate active before first live transaction.
- ✅ **Custom domain** — `zonna.run` purchased and DNS pointed at Vercel 2026-05-15. Live and resolving. `capacitor.config.ts` `server.url` updated to `https://www.zonna.run/dashboard`. Privacy/terms TODO comments cleaned up.

### E. Pre-submission QA

- ✅ **TestFlight beta** — v1.7 build 8 archived + uploaded 2026-06-02. On-device smoke complete.
- ✅ **Full journey test** — complete. All journey legs exercised on device including fresh/trial-active account, wizard generation, log + reflect.
- ✅ **App Store assets** — screenshots captured (5 shots × iPhone 6.7" + 6.5"). Keywords, description, promotional text, per-product Review Information all live in ASC.

---

## NEXT — First wave after App Store ship

**SLT-reviewed 2026-06-06. Priority stack below reflects board consensus.**

| Priority | Item | Effort | Tier |
|---|---|---|---|
| ✅ | GTM-09 + GTM-10 — Trial emails (SHIPPED 2026-06-08 → registry) | M | PAID |
| ✅ | DS-07 Part A — Edit logged distance (SHIPPED 2026-06-22 → registry) | ~2h | FREE |
| ✅ | ENGINE-02 — Long run shortfall (SHIPPED 2026-06-22 → registry) | S | PAID |
| 4 | CA-03 — Post-race goal ladder | M | PAID |
| ⛔ | ENGINE-03a — Cycle false positives (BLOCKED — no plugin data, see below) | S | FREE |
| ⛔ | CA-05 — Cycle coaching (BLOCKED on ENGINE-03a) | M | FREE (recommended) |
| 7 | POST-RUN-REFRAME-02 — Voice memo (after vendor decision) | M | PAID |
| 8 | CA-02 — Apple Watch (dedicated sprint) | L | FREE/PAID |

*Note: R25 cuts 2–3 (Today pre-run band + Coach trend cards) were confirmed shipped 2026-06-04 via code audit 2026-06-06. Removed from priority stack. Feature registry updated.*

*Note: GTM-09/10 (trial emails) shipped 2026-06-08 (`7cde428`) — was the held commit, now on `origin/main`. The doc lag was caught 2026-06-22; entry moved to feature-registry. Code is live; firing depends on the GitHub Actions `email-cron-trial` workflow secrets (`CRON_SECRET` + `VERCEL_URL`) — confirm a green run.*

*Note: ENGINE-02 (long-run shortfall) shipped 2026-06-22 → feature-registry. Most of the engine had been built in `b605088` alongside ENGINE-01 but never finalised; the ship added the missing `plan_adjustments.trigger_type` CHECK-constraint migration (`20260622_engine_trigger_types.sql`), CoachingPrinciples §66, the AI few-shot, and unit tests. The same migration fixes a latent ENGINE-01 bug (its `fitness_signal` trigger type was also absent from the constraint). ⚠️ **Migration must be applied to the live Supabase DB.***

*Note: ENGINE-03a + CA-05 are BLOCKED (verified 2026-06-22). `@capgo/capacitor-health@8.4.8` exposes no menstrual/cycle/reproductive data type (`HealthDataType` union in `node_modules/.../definitions.d.ts` confirms it), so the luteal-phase RHR suppression has no data path. Unblocking needs a custom Swift bridge / plugin fork — see the ENGINE-03 detail below.*

*Note: DS-07 Part A + ENGINE-02 + DS-05 shipped 2026-06-22; ENGINE-03a/CA-05 blocked. **CA-03 (post-race goal ladder) is now the head of the actionable stack.** (DS-07 Part B — composite effort — remains open below.)*

Ordered by GTM impact. Each needs FREE/PAID tag confirmed before build.

### GTM commercial

| # | Item | Effort | Tier | Notes |
|---|------|--------|------|-------|
| GTM-08 ✅ | **Marketing site + waitlist** — **SHIPPED 2026-06-03.** `zonna.run` serves the marketing page (download-first: App Store badge + waitlist form, pricing/trial line, Apple Health mention, Support in footer). `MARKETING_SITE_ENABLED=true` in Vercel Production. Supabase `waitlist` table live; `/api/waitlist` route (public POST, service-role write, duplicate-silent). `BRAND.appStore` block in `lib/brand.ts` — set `url` on App Store approval to flip badge live (no redeploy needed). Components: `components/marketing/WaitlistForm.tsx`, `components/marketing/AppStoreBadge.tsx`. Migration: `20260603_waitlist.sql`. Commit: `bd27e2d`. | M | FREE | ✅ |
| GTM-09 ✅ | **Trial expiry email** (day 14) — **SHIPPED 2026-06-08** (`7cde428`, on `origin/main`). Resend, `kit@zonna.run`, GitHub Actions daily cron (08:00 UTC), idempotency stamp `trial_email_day14_sent_at`. Migration `20260608_trial_email_stamps.sql`. See feature-registry. **Op gate:** GH Actions secrets `CRON_SECRET` + `VERCEL_URL` must be set — confirm a green `email-cron-trial` run. | M | PAID | ✅ |
| GTM-10 ✅ | **Trial nudge email** (day 11) — **SHIPPED 2026-06-08** with GTM-09, same route/cron/infra. Idempotency stamp `trial_email_day11_sent_at`. See feature-registry. | S | PAID | ✅ |

> **Board notes — GTM-09/10:** Email content must not lead with scarcity ("your subscription is ending"). Instead: surface a specific run the user logged and what it showed — *"You ran 12km in Zone 2 last Tuesday. That's the plan working."* Contextual recall drives conversion better than deadline pressure. The most powerful line sounds like the app noticed something the user didn't — *"You've run 4 sessions in the zone. That's unusual in the first two weeks."* Make the vendor decision (Resend vs Supabase Edge) first — don't let it be the indefinite blocker.

### Competitive analysis follow-ups (CA-01…)

*Source: `docs/gtm/competitive-positioning-analysis-2026-06-03.md` (Start/Stop/Continue + gap analysis). Ordered by SLT priority. Each needs FREE/PAID confirmed before build. The headline insight: the **wedge moment** — free user, fresh install, no Strava — is the most under-served experience in the product, and the single biggest commercial lever (CA-01). The **Apple Watch gap** (CA-02) is the biggest competitive table-stakes hole. Protect the **reframe risk gate** above all (it's the most defensible asset).*

- 🔲 **CA-02 — Apple Watch companion app (thin)** *(biggest competitive gap)* — Runna/Coopah/TrainAsONE all ship one; iPhone-only + HealthKit indirection is a category outlier reviewers will flag. MVP scope: **today's session + zone target + HR band on the wrist + one-tap start.** No coaching, no logging, no AI on-watch at MVP — just the prescription where the runner needs it. Reuses the `SharedStorePlugin` App-Group bridge pattern already used by the widget extension (`group.app.zonna.ios`). Competitive necessity, not differentiation. **Tier: FREE for prescription display / PAID for any analysis surface.** Effort: L (native, new WatchKit/SwiftUI extension target — widget-extension family of provisioning pain). Interim mitigation before it ships: pre-empt the question in the App Store description ("Apple Watch via Apple Health"). Sequence after TestFlight is exercising production APNs. **SLT: dedicated sprint, not before #1–5. Scope is locked — do not expand at MVP. Start provisioning setup in Apple Developer portal now.**

  > **Board note:** The restraint of what's *not* on the watch face is the product. Zone target + HR band + one-tap start. Nothing else. The friction-free start is where the real coaching happens — what the runner sees in the first 10 seconds of a run changes their behaviour for the next hour.

- 🔲 **CA-03 — Post-race "what next" goal-ladder** — post-race reshape is shipped but handles only the immediate aftermath; there's no goal-laddering, so the subscription has no reason to persist between races (the "post-race void"). MVP: a single post-race card that proposes the next sensible target (maintain base / step up distance / chase a time) and seeds a fresh wizard prefill. Closes a retention gap, not an acquisition one. **Tier: PAID.** Effort: M. Pairs with R24 (multi-race) and R25 cuts 2–3. **SLT priority #4.**

  > **Board notes:** Fire the card in PostRunScreen for race sessions — meet the runner in the moment of achievement, don't wait for them to feel the void. Seeds wizard prefill so there's zero friction to starting a new plan. "What next" options must be sequenced correctly by the engine — don't suggest a full marathon the week after a 5K. The logic lives in the engine, not free text. Voice: one sentence, no celebration, one number. *"You ran 2:04 — 6 minutes inside your goal. What's the next line?"*

- ✅ **CA-04 — Adjustment narrative (coaching, not just a banner)** — shipped. See feature-registry.

- ✅ **ENGINE-02 — Long run distance shortfall** — SHIPPED 2026-06-22 → feature-registry. Fires when 2 consecutive long runs come in < 82% of planned distance (distance_score ≤ 50); reduces the upcoming long run 15% as a `reduce_volume` adjustment requiring one-tap confirmation. Distinct from fatigue_accumulation / skip_with_reason. Easy-run shortfalls: coach note only (§1). Peak long run protected by the shared taper guards. The engine had been built in `b605088` alongside ENGINE-01 but never finalised — the ship added migration `20260622_engine_trigger_types.sql` (the missing CHECK constraint, which also fixes ENGINE-01's same latent gap), CoachingPrinciples §66, the AI few-shot, and `lib/coaching/planAdjustment.test.ts`. ⚠️ Apply the migration to the live Supabase DB.

  > **Board notes:** Coaching card is one sentence — lead with the numbers, not the diagnosis. *"You planned 22km. You ran 17. That gap has appeared twice. We've adjusted."* Specificity is the credibility. Confirmation action is one tap — don't ask them to explain why. Don't build a diagnostic report; build an action.

- ⛔ **ENGINE-03 — Cycle data → fix readiness false positives (prerequisite for CA-05/R27) — BLOCKED (verified 2026-06-22)** — **prerequisite check failed: `@capgo/capacitor-health@8.4.8` cannot read menstrual/cycle data.** The plugin's `HealthDataType` union (`node_modules/@capgo/capacitor-health/dist/esm/definitions.d.ts`) exposes steps/distance/calories/HR/RHR/HRV/sleep/etc. but **no menstrual, cycle, luteal, period, ovulation, or reproductive-health type** — iOS HealthKit's `HKCategoryTypeIdentifierMenstrualFlow` is not surfaced. There is no data path for the luteal-phase RHR suppression this feature depends on. **To unblock:** fork/patch the plugin with a custom Swift bridge exposing the reproductive-health types (iOS; Android Health Connect TBD), ingest a `cycle_phase` to `health_daily_samples`, then build the suppression. Until then ENGINE-03a (and CA-05 downstream) cannot ship. The readiness_signal trigger itself works correctly on RHR/HRV/sleep (CoachingPrinciples §59); this is purely the cycle-aware refinement that's blocked. Board note stands: the science (luteal RHR +2–5 bpm) is sound — only the data is missing. Original spec retained below for when the bridge exists. ~~luteal phase naturally elevates RHR by 2–5 bpm, which trips false-positive `readiness_signal` triggers (engine softens quality sessions that didn't need softening). Phase 1: use HealthKit menstrual data to SUPPRESS readiness_signal when RHR elevation is within expected luteal range.~~ Phase 2: proactive phase-transition note ("RHR may run a little high this week — your zones don't change, but readiness might"). **Architecture impact**: `readiness_signal` builder gets a `cyclePhase` input field; when `cyclePhase === 'luteal'` AND `isElevatedRHR` is within expected range (2–5 bpm), suppress the trigger. The note is informational, NOT a plan change. **Critical voice rule**: engine never mentions the menstrual cycle in output copy — it surfaces "recovery signals may be elevated" and uses the data silently to improve accuracy. "Matter-of-fact, never patronising" (R27 doctrine). **What it must NOT do**: auto-change plan based on cycle phase alone; change zones; generalise individual cycle patterns before personal history exists. **Two distinct use cases**: (a) fix false positives = ship first, no voice risk; (b) proactive coaching notes = requires voice spec review first. **Tier: FREE for (a) as a trust/accuracy improvement; PAID for (b) as coaching intelligence.** Effort: (a) S — add cyclePhase to readiness input, suppress condition in builder; (b) M — phase transition detection + note generation. Depends on HealthKit menstrual data query support in `@capgo/capacitor-health`. **Analysed 2026-06-04. SLT priority #6 (ENGINE-03a only — fix false positives first, voice coaching second).**

  > **Board notes:** This is a correctness fix, not a feature. False positives train users to ignore the app — every wrong coaching recommendation is a habit break. The suppression threshold (2–5 bpm above baseline) is scientifically grounded; do not widen it. **Verify `@capgo/capacitor-health` menstrual data support before committing to this sprint.**

- 🔲 **CA-05 — Cycle-aware coaching, thin slice** *(highest-leverage moat)* — promote the R27 LATER item to an explicit thin first slice: a **single** matter-of-fact coaching note per phase shift ("RHR may run a little high this week — your zones don't change, but readiness might"). Not full periodisation. Unique vs every competitor; competitors avoid it because the voice work is hard — Zonna's voice is exactly right for it. **Tier: recommend FREE as a brand moat — confirm before build.** Effort: thin slice M (full R27 is L). **Depends on ENGINE-03a shipping first.** **SLT priority #8.**

  > **Board notes:** Activation must be completely passive — HealthKit menstrual data syncs automatically; no wizard opt-in question needed if the data is already present. The feature activates silently when the data is present. Do not add a toggle or a settings row. This is the most counterintuitive product decision on the backlog: a running app that pays attention to specific human biology without asking for it. That's the thing competitors won't do.

- 🔲 **CA-07 — "Ask Kit about this run" (hold — needs product decision)** — *not* coach-chat. One capped, per-analysed-run "explain this further" affordance. Decision required before scoping. **Tier: PAID.** Effort: M. **SLT: hold until 50+ paying users. Build for actual questions, not imagined ones. Do not invite this before then.**

### R23 engine polish (browser-in-loop work)

After Vercel deploy, verify with agent-browser:

1. ✅ **Phase 5 — Wizard UI updates** — `training_age`, `preferred_long_run_day`, `benchmarkDate` wired; new injuries (Shin splints, Plantar fasciitis, Hip) in list; `motivation_type` + `training_style` removed
2. ✅ **Phase 6.3 — Day-15 transition UI** — shipped 2026-04-29
3. ✅ **Phase 4.2 — Session card integration with `composeSession()`** — wired in DashboardClient; warm-up/main/cool-down rendered with left-accent bars
4. ✅ **Browser-verify B1 + B3 changes** — confirmed working 2026-04-29

### Small UX

- ✅ **UX-01** — fixed 2026-05-01: Profile email field is now read-only (`readOnly` + muted styling + `tabIndex={-1}` + `aria-readonly`). Email is auth identity owned by the OAuth provider — visible for orientation, not editable. Save button only commits first/last name; email passes through unchanged. Done.
- ✅ **UPGRADE-ENTRY-01** (PAID gate / compliance) — **add an always-visible upgrade entry so any non-paid user can reach the paywall at any time.** Today, `onUpgrade` is passed into `MeScreen` but never invoked, and every in-app path to `UpgradeScreen` is gated behind `!hasPaidAccess` (`CoachTeaser`, `LockedCoachingPreview`, `PostRaceReshapeCard` — the only place `onUpgrade()` actually fires, DashboardClient.tsx:5915). Result: a user in **active trial** (`hasPaidAccess === true`) has no way to view subscription options. Fix: add a persistent "Subscription" / "View plans" row in MeScreen that calls the existing `onUpgrade` prop, visible regardless of trial/free/expired state. Removes the §3.1.2 reviewer-reachability coupling that forced the demo account to be trial-expired for v1 submission (see launch-roadmap status 2026-06-02 rev.2). SLC: Simple — one row, reuses existing wiring; Lovable — matches MeScreen SectionLabel pattern (ui-patterns.md §17); Complete — show for trial + expired + free; hide only for already-Pro. Trigger frontend-design skill.

### AI visibility & provenance

*(no open items — see feature-registry for shipped AI provenance work)*

### AI coaching depth

*Surfaced by 2026-05-11 manual coaching audit (Russ's Goring Gap 53km debrief vs. what Zonna would have produced). Three highest-leverage items shipped that day as AI-DEPTH-01 (see feature-registry). Remaining gaps below — ordered by impact ÷ effort.*

- ⏸️ **AI-DEPTH-02c / DS-04 — HealthKit per-km splits bucketing** *(scoped 2026-05-11; fully analysed and deliberately deferred 2026-05-30)* — **Do not build until the data prerequisite exists. Re-read this note before picking it up.**

  **Why deferred:** HealthKit exposes only two scalars per workout — `totalDistanceMeters` and `durationSeconds` — plus HR samples with timestamps. There are no per-km distance markers. The only viable bucketing algorithm is a constant-pace model (divide total time evenly across total distance, assign HR samples to the resulting km windows). This produces `paceFade ≈ 0` on every run because all km windows have identical synthetic pace. Consequence: `computePaceFadeSummary()` returns a result, but the **muscular limiter hypothesis never fires** for HealthKit runs — pace fade cannot be detected without real pace data. The aerobic hypothesis is unaffected (HR drift is real). Building a constant-pace placeholder was rejected because: (1) it gives false precision — the coaching engine would see "perfect" pace consistency that doesn't reflect reality; (2) if a runner genuinely faded muscularly the engine would mis-attribute it to aerobic causes (the wrong diagnosis); (3) the existing HR-stream bucketing (`hr_in_zone_pct`, `hr_above_ceiling_pct` in `bucketHRSamples()`) already delivers the aerobic signal correctly. `splits_metric` remaining null for HealthKit rows is **correct behaviour** — both `computePaceFadeSummary()` and the limiter classifier handle null gracefully; the muscular branch simply stays silent, which is honest.

  **What would unlock this:** (a) Apple exposes native per-workout splits in HealthKit (not currently available — Apple Fitness app doesn't export split data); (b) Garmin→HealthKit sync brings split metadata (currently Garmin writes workout summaries to HealthKit but not split-level data); (c) a custom Watch app that logs splits to HealthKit workout metadata. None of these exist today. **Trigger for revisit: a HealthKit data source that provides distance-over-time samples, not just aggregate totalDistance.**

  **Do not add the `distance` standalone-sample permission back** (removed in DS-01) as a workaround — it gives cumulative step-count distance, not the granular per-timestamp GPS distance that would produce meaningful splits. Tier: PAID (when it eventually ships).

- ✅ **AI-DEPTH-04 — Conversation memory across weekly reports** *(shipped 2026-05-11)* — see feature-registry entry AI-DEPTH-02. Previous week's `weekly_reports.headline` + `body` now fetched in `app/api/weekly-report/route.ts` and passed to `buildWeeklyReportPrompt` as a `PreviousReportSummary` block. Prompt instructs at most one reference, only when this week's data tracks against last week's story (improvement or repeat-issue). Week 1 and silent-fallback weeks skip the fetch via conditional `Promise.resolve({ data: null })`. Closes the "every report fires standalone, no continuity" gap.

- ✅ **AI-DEPTH-10 — Cross-surface conversation memory** *(scoped + shipped 2026-05-11)* — see feature-registry entry. Extends the AI-DEPTH-04 pattern to the four remaining coaching surfaces (daily coach note, plan adjustment explanation, phase summary, session feedback), each with its own continuity reference: daily note ← last weekly report; adjustment explanation ← previous resolved adjustment; phase summary ← previous phase summary content; session feedback ← single most-recent same-type analysed session. Same "reference at most once, only when data tracks against it" rule across all four. Closes the "no memory of prior outputs" audit gap completely.

- ~~🔲 **AI-DEPTH-05 — Post-session structured capture (parked, decision needed)** *(scoped 2026-05-11)*~~ — **superseded 2026-05-22 by POST-RUN-REFRAME-01** in the Post-run journey section. Original scope (3–5-question structured sheet) is dead; the friction concern won that argument. Reframe-shaped feature with text + voice input replaces it.

- 🔲 **AI-DEPTH-06 — Image/vision analysis (paid-tier upsell)** *(scoped 2026-05-11)* — let users upload a screenshot of their watch's splits screen. Route through Claude with vision; extract the same metrics AI-DEPTH-02 would compute. Bigger build (1 week+), and the first surface where user-uploaded images leave the device — needs privacy review (retention, PII redaction). Lower priority than AI-DEPTH-02 because the structured-stream path is cheaper and more reliable. Tier: PAID (consider gating as premium-of-paid). Don't pick up until AI-DEPTH-02 has demonstrably shipped value.

- 🔲 **AI-DEPTH-09 — Coach chat (deferred indefinitely)** *(scoped 2026-05-11)* — original audit Step-5 (injury/equipment diagnosis) was recommended for deferral on three grounds: liability surface, off-brand (Zonna is zone discipline, not shoe lacing), and the kit-and-blister advice from Russ's manual session wasn't where the real coaching value lived. If a paid-tier freeform chat is later considered, it slots here as a new gate `coach_chat`. Effort: L. Out of scope until product strategy explicitly invites it.

### Plan adjustments

*(no open items — see feature-registry for shipped plan-adjustment work. The "Recent tweaks" log on MeScreen (PROFILE-ADJ-02) was relocated into the notification inbox — see NOTIF-01 in feature-registry — so auto-applied adjustments now arrive as push + inbox rows.)*

### Notifications

*(no open items — see NOTIF-01 in feature-registry for the shipped inbox + bell.)*

### Post-run journey

- 🔲 **POST-RUN-03 — Rich-media zone preview on the link push** *(SLT: later — not before #1–5. Gated on production APNs anyway.)* *(scoped 2026-05-30)* — attach a small, *informative* image to the confident-auto-link push (POST-RUN-01/02, `lib/coaching/autoAnalyse.ts`) so the lock-screen ping shows the morsel, not just says it. Behavioural goal: make the post-run ping a thing users anticipate and want to open. Tier: **FREE-eligible — confirm before build** (the image is formula-derived, no AI; the deeper in-app zone-ring stays PAID). Effort: **M (~2–3 engineer-days, mostly native)**. **Gated on TestFlight exercising production APNs** — remote image fetch can't be validated in the simulator.
  - **What the image shows (the key constraint):** the link push fires *before* the analysis round-trip, so at send time we have only **avg HR, distance, day, and the planned zone band** — NOT time-in-zone or HR drift. So the image is the simplest honest thing: **a single horizontal zone band with the run's average HR plotted as a dot** — dot inside the green band = "Held the zone", dot above = "Bit warm". It's the visual twin of the `buildLinkPushCopy` morsel (word + picture agree). The full zone-ring donut stays the *inside-the-app* reward — do NOT spend it on the lock screen, and do NOT add a second post-analysis push (POST-RUN-02 deliberately removed it to avoid the silent-gap double-ping).
  - **Design for the thumbnail, not the expansion:** collapsed lock-screen art is ~40pt. Band + dot + one HR number reads at that size; a detailed chart turns to mush. Restraint here is legibility, not just brand. No tick, no emoji, no confetti — Warm Slate band (moss in-zone, `--warn` over) + ink dot.
  - **Image generation:** new route `/api/notif-image/zone?avg=152&low=140&high=160&state=held` returns a PNG via `next/og` (Satori — same capability as `app/api/og/route.tsx`). Satori can't read CSS custom properties, so the Warm Slate hex lives as data constants in `lib/brand.ts` (the existing `BRAND.og.*` precedent) — keeps hardcoded hex out of components and clears the pre-commit hook.
  - **Platform split — do web first:** **Web push (easy)** — set the `image` field in the notification payload (`lib/webpush.ts` + service worker); no extension. Validates the artwork and the route cheaply. **iOS (the real work)** — APNs payload gets `note.mutableContent = 1` + a custom image-URL key in `lib/apnpush.ts` (the `apn` package supports both), plus a new native **Notification Service Extension** target in Xcode (own bundle ID `app.zonna.ios.NotificationService`, own provisioning profile — same hand-rolled pattern as the widget extension; Capacitor doesn't manage it). The extension downloads the image and attaches it before display.
  - **Graceful degradation (de-risks it):** if the extension fails to fetch the image in the ~30s budget, iOS shows the text-only notification — i.e. exactly today's behaviour. Worst case is no regression. Keep the PNG tiny and served from Vercel edge so fetch is fast.
  - **iOS extension checklist:** new Service Extension target in Xcode · App ID `app.zonna.ios.NotificationService` + provisioning profile in Apple Developer portal · `mutable-content: 1` + image-URL key in `apnpush.ts` · device test via TestFlight (not simulator).
  - **Risks:** provisioning/extension setup is fiddly (widget-extension family of pain); one more native target to keep building; image-fetch latency must stay well under the extension budget. **Further horizon (not this item):** Live Activity / Dynamic Island for in-progress or just-finished runs — overkill until this lands and proves out.
  - **Sequencing:** web image + route first (prove the artwork at thumbnail size) → iOS extension once a TestFlight build is exercising production APNs anyway.

- 🔲 **POST-RUN-REFRAME-02 — Voice memo input for the reframe** *(scoped 2026-05-22; deferred from POST-RUN-REFRAME-01 Phase 3)* — adds voice as an alternative input mode to the reframe textarea. Capacitor mic plugin + iOS `NSMicrophoneUsageDescription` + `/api/transcribe` (OpenAI Whisper — **first non-Anthropic vendor in the stack**, needs `OPENAI_API_KEY` in Vercel) + UI voice mode in `ReflectionInput`. The reflection text flow already populates `note_source='voice'`/`voice_duration_s`/`voice_transcript_confidence` columns — schema is voice-ready. Pickup gated on device-test capacity and a product decision on the new vendor. Effort: M (~3d). Tier: PAID (inherits `post_run_reframe` gate). **SLT priority #9 — make the Whisper/OpenAI vendor decision first. Don't let "vendor decision" become indefinite deferral.**

  > **Board note (Wendy Wood):** Voice is the highest friction-reduction change on the list for post-run reflection. Typing after a run is a significant barrier — voice removes it. The quality of reframe input (and therefore the quality of the AI output) improves when the medium suits the moment. This is worth the vendor dependency.

### Plan screen

### Review 2026-05-23

*Full execution spec: `docs/releases/review-2026-05-23.md`. Strava-resilience constraint applies to all items — every surface degrades silently to HealthKit-only data on day one and absorbs Strava when approved (no redesign). Items ordered by ship sequence.*




---

## LATER — Post-launch roadmap

No schedule. Ordered roughly by user value. Each needs FREE/PAID tag in `docs/canonical/feature-registry.md` before build.

| # | Title | Tier | Effort | Notes |
|---|-------|------|--------|-------|
| **R25** | **Historical run intelligence** — "how does this run compare to your past self?" Similarity matching + per-run cohort comparison + trend detection. ✅ **ALL THREE CUTS SHIPPED.** (1) post-run analysis line — shipped 2026-04-30; (2) Today pre-run band (`PreRunBandCard`, `/api/coaching/prerun-band`) — shipped 2026-06-04; (3) Coach trend cards (`TrendCard`, `/api/coaching/trend`) — shipped 2026-06-04. Code audit confirmed 2026-06-06. See feature-registry. | PAID | ✅ COMPLETE | Moved to feature-registry 2026-06-06. |
| **R22** | **Blockout days** — user marks days unavailable, plan reshapes around them | PAID | M | Bundle with R20 parked triggers — uses same reshape engine |
| **R18** | **Plan confidence score** — derive from session completion + RPE. R17 coaching flags are the per-session atom this aggregates. Logically downstream of R25 — pairs naturally as the next item once the comparison engine ships | PAID | M | Display on dashboard or plan screen |
| **R24** | **Multi-race support** (A/B race hierarchy) | PAID | L | Non-breaking additive: `meta.races: Race[]` on top of existing `meta.race_date`/`race_name` |
| **R21** | **Strength sessions** — flesh out stubs (currently admin-only/hidden) | FREE display / PAID dynamic | M | |
| **CA-08** | **Garmin Connect integration** — largest fitness-watch ecosystem in distance running; every Tier-1 competitor (Runna/Coopah/TrainAsONE) has it. Plumbing-grade: OAuth + activity push into the source-agnostic `strava_activities` log (`source='garmin'`), reusing the existing HealthKit/Strava dedupe (`lib/coaching/healthkitConsolidate.ts`, ±5min/±5%). Not a v1 blocker — HealthKit covers the iOS+Apple-Watch user; Garmin widens the addressable runner. Source: competitive analysis 2026-06-03 §4.1. | PAID | M | **SLT: Apply for Garmin Connect Developer Program NOW regardless of build timing. Approval takes 4–8 weeks. Don't let that clock start late.** Pairs with the Strava-secondary-source work — same ingest/dedupe path. |
| **R19** | **Coaching tips in Supabase** — move hardcoded copy to a table for dynamic, user-specific messages | PAID | S | **Don't pick up without a product trigger.** Scoped 2026-05-01: current hardcoded copy (`getCompletionCopy`, `getReflectResponse` in `DashboardClient.tsx`; `ZONE_COPY` in `lib/coaching/zoneCopy.ts`) branches on session type + RPE — both already known client-side. No user segmentation exists, so the migration alone doesn't unlock "dynamic per user" — it just adds a DB read + fallback path. Worth building only when there's a real driver: a non-engineer copy editor, an A/B test you actually want to run, or the first cohort that genuinely needs different copy (e.g. beginner vs intermediate). Until then, two switch statements are the right level of abstraction. |
| **R26** | **Background load (HealthKit)** — count daily step / non-run active minutes against the chronic side of `acuteChronicRatio`. Fixes the false-negative case where a user with a 15k-step day-job is carrying invisible load the plan can't see | PAID | M | Calibration risk — active job vs recovery walks vs cross-train all look the same in step count. Needs a tunable damping factor before it's safe to act on. New field `nonRunActiveMins` on the load calc; surface separately on weekly report before feeding into the trigger |
| **R27** | **Cycle-aware coaching (HealthKit)** — phase-aware notes for female users using HealthKit menstrual data. Closes a class of false-positive readiness flags from the v1 readiness signal (luteal-phase RHR is naturally elevated). Single coaching note per phase shift, not full periodisation. **Thin first slice now tracked as CA-05 in NEXT** (competitive analysis 2026-06-03 calls this the highest-leverage moat on the backlog) | PAID | L | Real differentiator vs Strava/Runna/Planzy. Voice work needed first — matter-of-fact, not patronising. Needs opt-in flow in wizard or MeScreen. Tier sub-decision: gate behind PAID or include free as a brand moat |
### Scoped but unscheduled


- **CO-ONE dismissal sheet** *(Phase 2, ~half-day)* — "Manage what Kit watches →" slide-up sheet on Coach. Per-signal 14-day mute toggles (zone drift, benchmark staleness, future foldable signals). Reuses existing `zone_drift_dismissed_at` / `benchmark_recal_dismissed_at` persistence (left in schema during CO-ONE v1 ship). **Gate (revised 2026-06-19, post-portfolio):** build when ANY of the following silent-churn signals fires: (a) ≥10% of paid users open Coach 3+ times in a week without taking *any* downstream action (no run logged, no benchmark updated, no session marked done) — measurable proxy for "ignoring Kit"; (b) churn-survey responses cite "too repetitive" / "felt nagging" / "wouldn't shut up" verbatim; (c) ≥3 unsolicited user requests for signal mute in support. The original "≥3 user requests" gate was vague — runners rarely ask for a feature they don't know exists; the silent-ignore signal is the real failure mode. SLT call (2026-06-19) and recommendation refresh (2026-06-19): the heat-block / altitude-camp / mid-life-event runner case is real but speculative; ship the read clean first, add the sheet if a measurable silent-churn pattern emerges. Persistence already exists → minimal effort when triggered. Tier: FREE.
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

- 🔲 **DS-07 — Composite effort logging** *(P2, ~2 days)* — two or more activities of the same type that together satisfy one planned session (e.g. hike + treadmill top-up = one planned long easy run). Distinct from Supplementary session slots (which is strength/cross-train alongside a run). Two parts:

  **Part A — Edit logged distance on complete sessions — ✅ SHIPPED 2026-06-22 → feature-registry.**
  When a session is manually complete (no linked HK/Strava activity), "Update log" now opens `ManualRunModal` pre-filled with the logged distance (`completion.strava_activity_km`) so the runner can correct the total (e.g. 8km → 13km). Previously it dead-ended into the activity picker — useless for a manual completion. Detection: `isComplete && !strava_activity_id && !apple_health_uuid` (`isManualCompletion` in `DashboardClient.tsx`). **Scope note:** distance-correction only — manual logs store distance (`strava_activity_km`) but not duration as a structured field (it's only embedded in the name string), so duration isn't pre-filled. Also fixed: the modal's save no longer nulls `rpe`/`fatigue_tag`, so editing distance can't wipe already-logged body-state. Tier: FREE.

  **Part B — True composite effort (~1.5 days, depends on Part A):**
  A dedicated "Add another effort" affordance on already-complete run sessions. Opens ManualRunModal in accumulate mode — shows current logged total, adds the new effort on top (new total = existing + new). Label updates to "2 efforts · 13.0km". Coaching sees the combined total. No new schema needed — `strava_activity_km` holds the aggregate, `strava_activity_name` holds the label. Tier: FREE for logging; zone analysis of combined effort stays PAID.

  **Explicitly out of scope for DS-07:** storing per-effort HR data for the combined session (that requires schema changes and is follow-on). The HealthKit/Strava auto-match guard already correctly blocks auto-match from overwriting a manually-logged session — both efforts are still ingested to `strava_activities` individually, they just don't link to the session.

  **Workaround until shipped:** "Log manually" on a complete session overwrites the existing log — user can manually enter the combined total (e.g. 13km for hike + treadmill). Clunky but functional.

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

### Data source hygiene (from ADR-011)

- ✅ **DS-01 — Remove `distance` HealthKit permission** — shipped 2026-05-30. Removed from `requestHealthKitAuth()` in `lib/health/clientSync.ts`. Distance comes from `HKWorkout.totalDistance`, not standalone samples. INV-DATA-003.
- ✅ **DS-02 — Add `calories` (active energy) to HealthKit ingest** — shipped 2026-05-30. `calories` added to permission list; `calories_kcal` added to `HealthKitActivityRow` interface and `adaptHealthKitWorkout()` mapper in `lib/health/adapter.ts`; migration `20260530_healthkit_calories.sql` adds `calories_kcal NUMERIC(8,1)` column to `strava_activities`. `totalEnergyKcal` was already read from HealthKit workouts — now it persists. INV-DATA-003.
- ✅ **DS-03 — Strava-free UI + HealthKit-first empty states** — shipped 2026-05-30. Seven surfaces updated: (1) `StravaConnectionRow` now self-gates on `is_admin` — non-admin users never see the Connect Strava button (Strava API approval still pending); (2–4) three CoachScreen empty state strings rewritten to be source-neutral ("Log a run with heart rate" vs "Connect Strava"); (5) `ZoneRings` reason prop changed from `stravaConnected ?` to `runs?.length ?` — source-agnostic; (6–7) `ZoneRings` and `RestraintCard` locked/empty copy removes Strava references; (8) upgrade nudge in session log corrected from "Connect Strava or Apple Health" to "Upgrade to unlock zone coaching"; (9) `raceProjectionsCopy.ts` both Strava-conditional strings updated. INV-DATA-004.
- ⏸️ **DS-04 — HealthKit per-km splits bucketing** — deliberately deferred 2026-05-30. Full analysis and decision in the AI-DEPTH-02c entry under "AI coaching depth" above. Short answer: HealthKit only exposes total distance + total duration (no per-km data), so any bucketing produces constant synthetic pace that makes the muscular limiter permanently silent — honest behaviour, but not worth building as a placeholder. Revisit only when a HealthKit data source provides distance-over-time samples.
- ✅ **DS-05 — Sleep stages ingest (iOS 16+)** — SHIPPED 2026-06-22 → feature-registry. `sleep_stages` JSONB column on `health_daily_samples` (migration `20260622_sleep_stages.sql`); `syncRecoverySamples()` buckets per stage; new `isPoorSleepQuality` readiness sub-signal fires when duration was adequate but deep sleep < 10% of staged sleep (`GENERATION_CONFIG.READINESS.DEEP_SLEEP_PCT_FLOOR`). Principle §59 extended. Tests in `lib/coaching/readinessBaseline.test.ts`. Tier: PAID (`activity_intelligence`/`readiness_signal`). ⚠️ Apply migration to live Supabase DB; on-device verification of real stage data outstanding.
- 🔲 **DS-06 — Manual run entry with metrics** *(P3, ~2 days)* — web and Android users with no Strava and no HealthKit path get manual completions (RPE + fatigue only). Adding optional distance + duration + avg HR to the completion flow (a single expandable "log more" row, not a full form) would let them receive zone-discipline and run-feedback scoring. Stores a `source='manual'` row in `strava_activities` with the entered fields. Tier: FREE for the entry UI; analysis scoring stays PAID (already gated). Prerequisite: DS-03 UX audit should happen first so we understand where the manual-entry entry point fits.
- 🔲 **DS-07 — Rename `strava_activities` → `run_activities`** *(P3, ~1 day)* — the table is source-agnostic but named after one provider. Misleads every new contributor. Migration: `ALTER TABLE strava_activities RENAME TO run_activities` + update all `from('strava_activities')` callsites (grep: ~35 occurrences). High-risk for regressions; do in a standalone migration with a single grep-and-replace PR. No schema change beyond the rename. Coordinate with any in-flight work that touches the table.

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
