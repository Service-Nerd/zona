# Roadmap — Zonna

**Job:** The single Now / Next / Later view across **everything** — product *and* go-to-market. Open this to answer "what are we doing, in what order, across the app and the business?"

**How the planning docs fit together:**

```
roadmap.md (THIS doc) ── the unified plan: horizons × workstreams, product + market
   │   each item is a one-liner + status + link
   ▼
backlog.md ──────────── the detail bench: full specs, scope notes, SLC framing
   │   when an item ships, the /ship skill moves it →
   ▼
feature-registry.md ─── what's already built (FREE/PAID tags)
```

Supporting strategy: `docs/gtm/go-to-market-plan-2026-06.md` (the GTM playbook — channels, budget, tactics) and `docs/gtm/competitive-positioning-analysis-2026-06-03.md` (why we win / positioning). The roadmap surfaces the *items*; those docs hold the *reasoning*.

**Workstreams:** 🏃 Product · 📣 Go-to-Market & Marketing · 🔁 Growth & Retention · ⚖️ Legal & Ops
**Status:** 🔲 not started · 🔄 in progress · ✅ done · ⏸️ deferred
**Last updated:** 2026-06-04 (session 3)

---

## Where we are

iOS-only (US/UK/anglosphere). TestFlight v1.7 build 8 uploaded. **App Store submission ready — one action left: Submit for review.** Copyright `2026 Russell Shear`, support page, screenshots, demo account, subscription disclosure, legal copy (service-nerd removed) all done. **Operating entity for v1: Russell Shear personally** (Apple Developer account is Individual; convert to LoGlide Limited post-validation — see Legal & Ops).

**`zonna.run` is now a real marketing page** (live 2026-06-03, redesigned 2026-06-04). Sutherland-flavoured positioning pass: tagline elevated to hero kicker, "What's not in the app" anti-feature grid, "Probably not for you if…" counter-positioning, waitlist + trial copy in brand voice, personalisation mechanic preview (wizard → session card), brand statement closes the page alone. SEO fully wired: `robots.txt`, `sitemap.xml`, page-level canonical + OG + 155-char description, `NEXT_PUBLIC_APP_URL=https://zonna.run` in Vercel. Waitlist form live and taking signups. On approval day: set `BRAND.appStore.url` → badge becomes a live download link.

**Acquisition + retention engine:** not yet running. Waitlist is the only capture. Trial emails (GTM-09/10) not built. No paid spend — correct at this stage (wait for trial→paid signal first).

---

## NOW — Launch (this week)

*Goal: get the binary in front of users. Almost everything is done; the remaining work is to submit and not ship with inconsistencies.*

| WS | Item | Status | Notes |
|----|------|--------|-------|
| ⚖️ | **App Store copyright = `2026 Russell Shear`** | ✅ | Matches the Individual-account seller. Was briefly LoGlide Limited — reverted. |
| ⚖️ | **Entity decision for v1** | ✅ | Operate personally; LoGlide conversion is a planned post-launch migration (below). |
| ⚖️ | **Drop "service-nerd" from legal copy** | ✅ | Privacy + Terms now "operated by Russell Shear". Infra identifiers (gist URL, repo) left as-is. |
| 📣 | **App Store listing** (subtitle, description, keywords, screenshots) | ✅ | 5 screenshots uploaded; three-beat description rhythm optional polish (analysis §7). |
| 🏃 | **Pre-submission QA / journey test** | ✅ | Critical funnel passing; post-race bug fixed (`f2892b9`). |
| ⚖️ | **Submit for review** | ✅ | Submitted. Manual release selected — smoke the live binary before flipping to traffic. |
| ⚖️ | **In-app medical/training disclaimer present** | ✅ | Terms §5 + §11 hold the full disclaimer. Login screen now shows a one-line in-brand pointer above the Terms/Privacy footer — every account creation passes through it. |

---

## NEXT — First 90 days post-launch

*Ordered by leverage. The headline: the product can wait a beat — **market presence and the conversion engine cannot.** The single biggest product lever (CA-01) is also a marketing lever.*

### 📣 Go-to-Market & Marketing — *the priority this quarter*

| Item | Status | Effort | Notes |
|------|--------|--------|-------|
| **Marketing site live** (GTM-08) | ✅ | — | **Shipped 2026-06-03. Redesigned + SEO 2026-06-04.** Sutherland positioning pass: tagline as hero kicker, anti-feature grid, counter-positioning, brand-voice copy, personalisation mechanic preview. SEO: `robots.ts`, `sitemap.ts`, canonical/OG metadata, `NEXT_PUBLIC_APP_URL=https://zonna.run`. `MARKETING_SITE_ENABLED=true` in Vercel. On approval: set `BRAND.appStore.url` in `lib/brand.ts` — badge goes live. |
| **Waitlist capture** | ✅ | — | **Shipped 2026-06-03.** Supabase `waitlist` table live. `/api/waitlist` route, duplicate emails silent-succeed. |
| **Set App Store URL on approval** | 🔲 | S (~5 min) | Day-of action. Set `BRAND.appStore.url` in `lib/brand.ts` → commit → push. Badge on the marketing site becomes a live download link. No Vercel env change needed. |
| **App Store Optimization loop** | 🔲 | S | Listing is the whole iOS funnel. Iterate keywords/screenshots on real conversion data once installs start. |
| **Content engine — "the grey middle"** | 🔲 | ongoing | Founder-led, phone-only. 1–2 POV pieces/week repurposed across Reddit / Shorts / carousel. Zero production budget. See GTM plan Phase 1. |
| **First 10 reviews + community seeding** | 🔲 | ongoing | Reviews are conversion fuel. Ask the TestFlight cohort before any acquisition push. |
| **Micro-PR / newsletters** | 🔲 | ongoing | Pitch the "a coach that tells you to slow down" angle to running newsletters. Free outreach. |

### 🔁 Growth & Retention

| Item | Status | Effort | Notes |
|------|--------|--------|-------|
| **Trial lifecycle emails** (GTM-09 day-14 + GTM-10 day-11) | 🔲 | M | Needs an email platform — **Resend free tier** (£0 at this scale). First money goes to retention, not acquisition. Directly lifts trial→paid (the north-star). |
| **CA-01 — Free-tier "why this plan" coach intro** | ✅ | S | Shipped 2026-06-04. Haiku intro on first free plan via `meta.plan_intro`; CoachByline + moss rail (§24b); renders in preview + saved Plan screen; silent fallback. Tier: FREE. |
| **In-app review prompt at a value moment** | 🔲 | S | After a "nailed" session / good weekly report — not at launch. |

### 🏃 Product

| Item | Status | Effort | Notes |
|------|--------|--------|-------|
| **UPGRADE-ENTRY-01 — always-visible upgrade entry** | ✅ | S | Shipped 2026-06-04. "Subscription / View plans" row in MeScreen; visible to free/trial/expired, hidden for active Pro. §3.1.2 compliant. |
| **CA-04 — adjustment narrative** (coaching, not a banner) | ✅ | S | Already shipped (built as part of AI-DEPTH-10). AI narrative via `buildAdjustmentExplanationPrompt` + Sonnet, PAID-gated via `dynamic_reshape_r20`, notification inbox + push wired. |
| **R25 cuts #2 + #3** (Today pre-run band + Coach trend cards) | 🔲 | ~10h | Turns "coach for today" into "coach for your trajectory" — retention between races. Tier: PAID. |
| **POST-RUN-03 — rich-media zone push** | 🔲 | M | Gated on TestFlight exercising production APNs. Web image first, then iOS Notification Service Extension. |
| **POST-RUN-REFRAME-02 — voice memo input** | 🔲 | M (~3d) | First non-Anthropic vendor (Whisper). Gated on device-test capacity + vendor decision. Tier: PAID. |

### ⚖️ Legal & Ops

| Item | Status | Effort | Notes |
|------|--------|--------|-------|
| **Insurance** (product/public liability + PI) | 🔲 | S | Operating personally → insure the health-app risk directly. More real protection than the corporate veil at this scale. |
| **Plan Apple Developer → Organization (LoGlide) conversion** | 🔲 | — | Verify UK in-place upgrade preserves apps + subscriptions; ideally convert *before* a large subscriber base. Moves income into the company too. Execution is a LATER item; the *decision + prep* is NEXT. |

---

## LATER — Post-launch roadmap

*No schedule. Roughly by value. Each needs FREE/PAID confirmed before build.*

### 🏃 Product

| Item | Tier | Effort | Notes |
|------|------|--------|-------|
| **CA-02 — Apple Watch companion app** (thin: session + zone + one-tap start) | FREE display / PAID analysis | L | Biggest competitive table-stakes gap. Reuses the `SharedStorePlugin` App-Group bridge. |
| **CA-03 — Post-race "what next" goal-ladder** | PAID | M | Closes the post-race retention void. Pairs with R24 + R25. |
| **CA-07 — "Ask Kit about this run"** (single gated affordance, *not* chat) | PAID | M | Needs product decision before scoping. |
| **CA-08 — Garmin Connect integration** | PAID | M | Largest watch ecosystem; same ingest/dedupe path as Strava-secondary. |
| **R18** Plan confidence score · **R21** Strength sessions · **R22** Blockout days · **R24** Multi-race · **R26** Background load · **R27** Cycle-aware coaching (thin slice = CA-05) | PAID | M–L | R27 cycle-aware is the highest-leverage moat (competitors avoid it). |
| **Supplementary session slots** (strength/cross-train second slot) | FREE slot / PAID placement | ~3wk | Big schema footprint. Hold the line against AM/PM run-doubling. |
| **DS-05** sleep stages · **DS-06** manual run metrics · **DS-07** rename `strava_activities`→`run_activities` | mixed | S–M | Data-source hygiene from ADR-011. |

### 📣 Go-to-Market & Marketing

| Item | Notes |
|------|-------|
| **Apple Search Ads** (£5–10/day, capped) | **Only after trial→paid ≥ 8% organically.** Highest-intent iOS traffic. |
| **Boost proven organic content** | Never boost cold; amplify what already worked. |
| **GTM-11 — pricing review** | Annual discount 37% vs category 44–49%; can move to £9.99/mo w/o code change. Revisit after ~100 paid conversions. |
| **Stripe / web checkout** (v1.1) | Unlocks non-iOS acquisition. Deferred from v1. |
| **Market expansion** — EU (DSA trader) + Android | EU needs trader disclosure (LoGlide registered address once converted). Android via Health Connect. |

### 🔁 Growth & Retention
| Item | Notes |
|------|-------|
| Cohort/trend retention surfaces | Largely R25 cuts 2–3 (in NEXT) → extend with seasonal trend cards once data accrues. |
| Additional trial-day nudges | Beyond GTM-09/10 + the shipped day-3 "Kit noticed" push (HOOK-02). |

### ⚖️ Legal & Ops
| Item | Notes |
|------|-------|
| **Execute Apple → Organization (LoGlide) conversion** | The build of the NEXT planning item. |
| **Rebrand tech-debt (BRAND-02…13)** | Vercel/Supabase/npm/GitHub renames, CSS keyframe aliases, storage-key migration, PWA icons. All non-blocking hygiene. |
| **Migrate plan-JSON gist off `Service-Nerd` account** | Optional — the last functional tie to the old name. Left for now (user decision 2026-06-03). |

---

## Reading guide

- **"What should I build next?"** → top of NEXT, by workstream. Product and Marketing both have a clear #1 (CA-01 / proper website).
- **"What's the full spec for item X?"** → `backlog.md` (search the ID).
- **"Is this already built? free or paid?"** → `feature-registry.md`.
- **"Why are we doing the GTM this way?"** → `docs/gtm/go-to-market-plan-2026-06.md`.
