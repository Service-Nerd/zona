# Launch Roadmap — Zonna v1 iOS

**Job:** Get Zonna approved on the App Store. Everything else waits.
**Source:** distilled from `backlog.md` NOW section + dependency mapping.
**Status:** assembled 2026-05-12. Update as items land.

---

## Working assumption

iOS App Store launch is the goal. Web app at the Vercel URL continues to exist and serve users who already have access; **no new web-checkout work is on the v1 critical path** (Stripe lives in the post-launch slot). If that assumption is wrong, see the "Decisions" section below.

---

## Critical path

```
   ┌─────────────────────┐
   │ Domain decision +   │──── unblocks ────► Privacy/Terms hosting (live URL)
   │     purchase        │                ──► Universal Links (optional v1)
   │                     │                ──► GTM-08 marketing site go-live
   └─────────────────────┘                ──► OG image canonical URL
              │
              ▼
   ┌─────────────────────┐
   │ RevenueCat setup    │──── unblocks ────► StoreKit 2 integration
   │ (links to ASC       │                ──► REVENUECAT_WEBHOOK_SECRET env
   │  products — done)   │                ──► subscription flow end-to-end
   └─────────────────────┘
              │
              ▼
   ┌─────────────────────┐
   │ Subscription        │──── required by Apple §3.1.2(a) for any
   │ disclosure UI       │     auto-renewing subscription submission
   └─────────────────────┘
              │
              ▼
   ┌─────────────────────┐
   │ Build + signing     │──── unblocks ────► first TestFlight build
   │ pipeline finalised  │
   └─────────────────────┘
              │
              ▼
   ┌─────────────────────┐
   │ TestFlight smoke    │──── unblocks ────► flip APNS_PRODUCTION=1
   │ on real device      │                ──► full journey test
   └─────────────────────┘
              │
              ▼
   ┌─────────────────────┐
   │ App Store assets    │──── final blocker before submission
   │ (screenshots,       │
   │  description,       │
   │  keywords)          │
   └─────────────────────┘
              │
              ▼
       Submit to review
              │
              ▼
       Live on App Store
```

**Estimate:** ~2 weeks of focused work from today to "submitted." Apple review adds 1–7 days. Realistic live date: **early June** at the earliest, mid-June with normal slippage.

---

## Open decisions — make these this week

These gate the longest dependency chains. Without answers, downstream work stalls.

| Decision | Options | Blocks |
|---|---|---|
| ~~**Domain name**~~ | ✅ **`zonna.run` purchased 2026-05-15.** Point DNS at Vercel to unblock downstream. | Privacy hosting, Universal Links, GTM-08 go-live, OG image, paid acquisition |
| ~~**DSA EU trader strategy**~~ | ✅ **EU deferred to v1.1+ (2026-05-21).** Ship US/UK/anglosphere at v1 without trader info. EU verification adds 1–2 weeks of uncontrollable wait time and the address-strategy decision deserves more thought than launch prep allows. Switching EU on later is a 30-min ASC config + verification wait — fully reversible. Leading option when revisited: virtual office (~£25–£40/month, serviced office that accepts post for Apple verification). Home address rejected (publicly listed forever, privacy downside doesn't unwind). Ltd only if incorporating anyway for tax/liability/fundraising. | — |
| **Beta testers** | Pick 5–10 people for TestFlight internal track | TestFlight beta phase — can't start without testers |
| ~~**Web checkout at launch?**~~ | ✅ **Deferred to v1.1 (2026-05-21).** iOS-only launch. Stripe stays parked — focus on Apple for v1, fewer moving parts through review. Reopen ~2 weeks post-launch alongside marketing-site public flip + paid acquisition. | — |
| ~~**Apple Small Business Program**~~ | ✅ Enrolled 2026-05-15. 15% commission active. | — |

---

## Phase 1 — Procurement (week 1, parallel kickoffs)

External setup; can all run concurrently. Each is a partial-day task + waiting period.

| Task | Owner | Effort | Notes |
|---|---|---|---|
| Buy domain | Russ | 30 min + DNS propagation (1–48h) | Once decided. Point at Vercel project. |
| RevenueCat account + app + entitlement | Russ | ~2h | Link to existing ASC products (`zonna_premium_monthly`, `zonna_premium_annual`). Set entitlement ID `zonna_premium`. Configure webhook → Supabase. |
| Apple Dev signing certificates + provisioning profiles | Russ | ~1h | Required before any TestFlight build. App Store Connect API key for CI uploads (Vercel doesn't build iOS — Mac does). |
| ~~Retry Apple Small Business Program enrolment~~ | ✅ Done 2026-05-15 | — | 15% commission rate active |
| (Optional) Apply for DSA EU trader info | Russ | depends on strategy chosen | Only if shipping EU at v1. |

---

## Phase 2 — Integration (week 1–2, partly gated on Phase 1)

Engineering work. Each item is concrete and pickup-able.

| Task | Depends on | Effort | Where |
|---|---|---|---|
| **StoreKit 2 wiring** | RevenueCat setup | 1–2 days | `@revenuecat/purchases-capacitor` plugin, init on app boot, purchase flow in UpgradeScreen, restore-purchases handler, webhook ingest at `/api/webhooks/revenuecat` → write `subscriptions` table |
| **Subscription disclosure UI** | nothing | 2h | Strengthen `UpgradeScreen` copy: per-period prices, *"Payment will be charged to Apple ID at confirmation of purchase"*, functional links to Terms + Privacy, explicit renewal/cancellation language. Pre-submission cosmetic but mandatory. |
| **Privacy + Terms hosting verification** | Domain | 30 min | Once DNS lands, verify `/privacy` and `/terms` render at the new domain. Update any hardcoded fallback URLs in code. |
| **Strava OAuth on native** | nothing | 30 min | Port from `window.location.href` to the SFSafariViewController pattern Google already uses. Non-blocker but trivial; clear it now. |
| **Universal Links** | Domain | 2h | `apple-app-site-association` file at domain root + Associated Domains entitlement. Better UX than custom URL schemes. **Optional for v1** — custom schemes work; skip if running short on time. |
| **(If web checkout)** Stripe products + env + webhook | Web-checkout decision | 1 day | Skip entirely if iOS-first. |

---

## Phase 3 — Asset production (week 2)

Cosmetic but submission-blocking.

| Asset | Required sizes / counts | Notes |
|---|---|---|
| **Screenshots** | iPhone 6.7" + 6.5" + 5.5" (3 sets, ~5 shots each) | Capture from running simulator at correct device size. Suggested shots: Today screen with active session card, Session detail with coach note, Plan screen, Coach screen, MeScreen profile. Apple is strict — must be device-frame-accurate. |
| **App Store description** | ~4000 chars | First draft produced 2026-05-21 (see `docs/releases/app-store-copy.md`). Lead with `BRAND.appStoreSubtitle`, body covers overtraining thesis + what's in/out + HealthKit privacy stance, end with `BRAND.brandStatement`. Awaiting review. |
| **Keywords** | 100-char comma list | Draft produced 2026-05-21 (see `docs/releases/app-store-copy.md`). 96/100 chars. Awaiting review. |
| **Subtitle** | 30 chars | ✅ Done — `BRAND.appStoreSubtitle` = `"Plans that stop overtraining."` = 29 chars. Fits. |
| **Preview video** | optional | 15–30 second screen recording. Defer; not blocking. |
| **App icon** | already done | ✅ — bundled with Capacitor shell. |

---

## Phase 4 — Build + test (end of week 2 / start of week 3)

| Task | Owner | Notes |
|---|---|---|
| **Production build flags** | engineering | Flip `APNS_PRODUCTION=1` in Vercel env (production APNs server rejects sandbox tokens and vice versa). Flip `MARKETING_SITE_ENABLED=true` if and only if you want the marketing page public on launch day. |
| **First TestFlight build** | Russ via Xcode | Archive → upload to App Store Connect. Internal testing track first. Beta testers receive invite. |
| **Internal smoke on real device** | Russ + beta testers | Run through: install → onboarding → plan generation → log session → reflect view → push notification arrival → upgrade flow → restore purchases. Note bugs. |
| **Full journey test (agent-browser)** | engineering | Per backlog QA item: create account → onboarding → plan on screen → log session → post-log reflect → simulate trial end → attempt paid feature → upgrade prompt. Catches regressions in the funnel. |
| **HealthKit live data smoke** | Russ | Real watch streaming → workouts arrive → RHR/HRV samples ingested → readiness signal fires. Simulator-validated; needs real-device confirm. |

---

## Phase 5 — Submission

| Step | Notes |
|---|---|
| **Final asset upload to App Store Connect** | Screenshots, description, keywords, Review Information. Per-product Review Information for each subscription. |
| **Submit for review** | First review is usually 24–48h. Renewals can take 1–7 days. |
| **Review feedback handling** | Apple rejections are common on first submission. Most likely reasons for Zonna: (1) subscription disclosure not strong enough — fix copy and resubmit; (2) HealthKit usage description too vague — already mitigated by current Info.plist text; (3) demo account needed if reviewer can't easily test paid tier — provide one in Review Notes. |
| **Approval → release** | Choose: manual release (you flip the switch) vs auto-release on approval. Recommend **manual** — gives a buffer to do final smoke on the live store binary before traffic flows. |

---

## Explicitly OUT of scope for v1

Don't get pulled back into these. They're documented elsewhere.

- **Stripe web checkout** (unless web-checkout decision flips) — Stripe path stays for post-launch.
- **DSA EU trader compliance** — EU deferred to v1.1+ (decision 2026-05-21). Ship US/UK/anglosphere only at v1. Virtual office leading option when revisited; home address rejected.
- **AI coaching depth** (AI-DEPTH-02b/03/08, etc.) — every one of these is post-launch.
- **GTM-09/10 trial emails** — needs email platform; ships in NEXT after launch.
- **GTM-08 marketing site go-live** — built and dark-launched; flip env when domain + TestFlight both land.
- **R25 cuts 2/3, R22, R18, R24, R21, R26, R27, R19** — all LATER bucket.
- **Strava as secondary source** — post-launch dedupe work.
- **Multi-race, blockout days, strength session flesh-out** — post-launch roadmap items.
- **Tech debt items** — none are submission-blocking.

If a "but we should also..." thought lands during launch prep, write it in the backlog and move on. Restraint is the brand.

---

## Beta tester profile (target: 5–7 testers)

Drafted 2026-05-21 to help pick the TestFlight internal list. Aim for **coverage of user-type, not quantity**. Don't just invite friends; deliberately seed the testers around the failure modes you most want to catch.

| # | Profile | What they catch |
|---|---|---|
| 1 | **Serious-amateur runner in active race build** | The core target. Will exercise every feature daily. Best signal on whether "the coach knows what they're doing." |
| 2 | **Returning runner post-injury** | The brand thesis case. Will stress-test the "easy days are too hard" coaching voice and the injury-aware plan reshaping. |
| 3 | **First-time marathoner with no plan experience** | Onboarding stress test. The wizard, Tanaka HRmax estimate, the "what's a zone?" moment — if it doesn't land here, the product fails for half the App Store search audience. |
| 4 | **Garmin / Strava power user** | The conversion friction case. Will resent migrating; will complain about anything missing vs their existing app. Best signal on what to defend and what to add. |
| 5 | **iOS-savvy user with months of HealthKit history** | Tests data ingestion edge cases — long workout history, mixed sources (Apple Watch + Strava + manual), gaps. The cohort-similarity engine (R25 cut #1) needs density to fire correctly. |
| 6 | **Non-runner who'll judge the marketing surface** | Critical for landing-page copy reactions, screenshot judgment, "would I download this" gut-check. Doesn't need to use the product. |
| 7 | **(Optional) A pace-junkie who treats HR as backup** | Validates whether the zone-first brand pitch lands or feels backwards. If they push back ("but I need to know my pace") the messaging needs tightening. |

**Don't:** invite 5–7 versions of profile 1. You already are profile 1.

**Process:** App Store Connect → TestFlight → Internal Testing → Add Testers (max 100, but a focused 5–7 gives more usable signal). Apple TestFlight invitation needs each tester's Apple ID email. Allow 24h for first install.

---

## Full journey test (agent-browser, pre-submission)

The journey test in the backlog is one item: *create account → onboarding → plan generation → log session → reflect → trial-end → upgrade*. Worth scripting before TestFlight smoke so any regression caught on real device can be diffed against a known-passing browser baseline.

**Suggested steps:**

1. Boot Vercel preview (or `localhost:3000`); clear all cookies/local storage.
2. Sign in via Google OAuth using a fresh test account (or use the existing test fixture).
3. Run through wizard: race distance, race date, training_age, current weekly km, days/week, long-run day, no injuries.
4. Wait for plan generation; assert plan loads on Today screen with a session card.
5. Tap session card → assert detail view renders prescription (zone, HR target, pace bracket, description).
6. Log session manually (no Strava match needed): RPE 4, "felt good".
7. Assert reflect view renders with the post-run analysis (or "Kit is analysing…" pending state).
8. **Trial-end simulation:** override `trial_ends_at` via Supabase to yesterday, refresh dashboard.
9. Assert trial-expired UI appears; tap upgrade → assert UpgradeScreen renders with LOSSES variant.
10. Assert disclosure copy present, both pricing buttons visible, terms + privacy links clickable.

**Don't run a real purchase** in this script — that's TestFlight territory (StoreKit sandbox handles iOS, Stripe test mode handles web). The browser script's job is the funnel UI, not the payment leg.

---

## Companion docs

Drafted 2026-05-21 to make submission turnkey:

- **`app-store-copy.md`** — Name, subtitle, keywords, description, promotional text, per-product Review Information, screenshots specification with 5-shot narrative arc.
- **`pre-submission-audit.md`** — Apple Data Privacy questionnaire answers (ready to paste), Info.plist audit, entitlements verification, admin-surface and Vetra-legacy cleanup findings. Most action items resolved in commit `6aa16cf`; two minor verifications remain (Release scheme entitlements + privacy URL 200 check).
- **`production-build-checklist.md`** — pre-archive runbook: env-var verification, Xcode scheme + entitlements check, manual smoke protocol, post-upload verification, troubleshooting table.
- **`journey-test.md`** — 10-step end-to-end funnel test (landing → login → wizard → Today → session → log → reflect → trial-end → upgrade), runnable manually or via agent-browser. Run once per TestFlight cycle.
- **`beta-tester-briefing.md`** — two copy-paste-ready messages for the 5–7 TestFlight testers: the initial ask (with per-profile variants) + the post-install brief covering what to look for and how to send feedback. Plus an exit-survey template.
- **`rejection-response-templates.md`** — defensive doc. Pre-drafted root-cause checklists and response templates for the 6 most likely Apple rejection categories (§3.1.2(a) subscription disclosure, §5.1.1 privacy, §2.1 demo account, §1.4.1 health claims, 5.1.1(v) account deletion, 2.3 accurate metadata). Cuts iteration time on a rejection from days to hours.

When in doubt, work through them in the order above: copy first (content production), audit second (review-rejection prevention), build checklist + journey test last (turn the crank).

---

## Single-question status check

At any point: *"Which decision in the Open Decisions table is the longest-blocked thing?"* That's where the next hour goes.
