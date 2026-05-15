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
| **DSA EU trader strategy** | Home address / virtual office / Ltd registered office / defer EU launch | EU App Store availability (US/UK ship doesn't need this) |
| **Beta testers** | Pick 5–10 people for TestFlight internal track | TestFlight beta phase — can't start without testers |
| **Web checkout at launch?** | Defer Stripe to v1.1 / ship Stripe alongside iOS | Stripe product setup, Stripe env vars, web upgrade flow QA |
| **Apple Small Business Program** | Re-attempt enrolment (15% vs 30% cut) | Not a blocker for submission, but every day delayed = 15% lost revenue once live |

---

## Phase 1 — Procurement (week 1, parallel kickoffs)

External setup; can all run concurrently. Each is a partial-day task + waiting period.

| Task | Owner | Effort | Notes |
|---|---|---|---|
| Buy domain | Russ | 30 min + DNS propagation (1–48h) | Once decided. Point at Vercel project. |
| RevenueCat account + app + entitlement | Russ | ~2h | Link to existing ASC products (`zonna_premium_monthly`, `zonna_premium_annual`). Set entitlement ID `zonna_premium`. Configure webhook → Supabase. |
| Apple Dev signing certificates + provisioning profiles | Russ | ~1h | Required before any TestFlight build. App Store Connect API key for CI uploads (Vercel doesn't build iOS — Mac does). |
| Retry Apple Small Business Program enrolment | Russ | 30 min | Direct URL: https://appstoreconnect.apple.com/business |
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
| **App Store description** | ~4000 chars | Lead with `BRAND.appStoreSubtitle` ("Training plans that stop you overtraining."). Body: overtraining thesis, what's included, what's not (honest), HealthKit privacy stance. End with `BRAND.brandStatement` ("You can't outrun your easy days."). |
| **Keywords** | 100-char comma list | Suggested: zone training, heart rate, hr training, marathon training, half marathon plan, 10k plan, easy runs, base training, polarised training |
| **Subtitle** | 30 chars | `BRAND.appStoreSubtitle` is the canonical line; verify it fits 30 chars. ("Training plans that stop you overtraining." = 43 chars → too long. Need a shorter variant. Decision needed.) |
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
- **DSA EU trader compliance** — defer EU launch to v1.1 unless trader address is already in hand.
- **AI coaching depth** (AI-DEPTH-02b/03/08, etc.) — every one of these is post-launch.
- **GTM-09/10 trial emails** — needs email platform; ships in NEXT after launch.
- **GTM-08 marketing site go-live** — built and dark-launched; flip env when domain + TestFlight both land.
- **R25 cuts 2/3, R22, R18, R24, R21, R26, R27, R19** — all LATER bucket.
- **Strava as secondary source** — post-launch dedupe work.
- **Multi-race, blockout days, strength session flesh-out** — post-launch roadmap items.
- **Tech debt items** — none are submission-blocking.

If a "but we should also..." thought lands during launch prep, write it in the backlog and move on. Restraint is the brand.

---

## Single-question status check

At any point: *"Which decision in the Open Decisions table is the longest-blocked thing?"* That's where the next hour goes.
