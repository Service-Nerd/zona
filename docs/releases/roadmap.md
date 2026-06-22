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
**Last updated:** 2026-06-22 (post-launch reconciliation — GTM-09/10 + live-on-App-Store status)

---

## Where we are

iOS-only (US/UK/anglosphere). **🚀 LIVE ON THE APP STORE — v1.7 approved and released 2026-06-15.** The binary is in front of users; focus has shifted from "ship it" to acquisition + conversion + the NEXT product stack. Copyright `2026 Russell Shear`, support page, screenshots, demo account, subscription disclosure, legal copy (service-nerd removed) all done. **Operating entity for v1: Russell Shear personally** (Apple Developer account is Individual; convert to LoGlide Limited post-validation — see Legal & Ops).

**Remaining day-of action:** set `BRAND.appStore.url` in `lib/brand.ts` to the live listing URL → the marketing-site download badge becomes a real link (no Vercel change needed).

**`zonna.run` is now a real marketing page** (live 2026-06-03, redesigned 2026-06-04). Sutherland-flavoured positioning pass: tagline elevated to hero kicker, "What's not in the app" anti-feature grid, "Probably not for you if…" counter-positioning, waitlist + trial copy in brand voice, personalisation mechanic preview (wizard → session card), brand statement closes the page alone. SEO fully wired: `robots.txt`, `sitemap.xml`, page-level canonical + OG + 155-char description, `NEXT_PUBLIC_APP_URL=https://zonna.run` in Vercel. Waitlist form live and taking signups. On approval day: set `BRAND.appStore.url` → badge becomes a live download link.

**Acquisition + retention engine:** trial lifecycle emails (GTM-09/10) shipped 2026-06-08 — day-11 nudge + day-14 expiry via Resend, daily GitHub Actions cron. Waitlist capture live. No paid spend — correct at this stage (wait for trial→paid signal first).

---

## NOW — Launch ✅ COMPLETE (v1.7 live 2026-06-15)

*Goal was: get the binary in front of users. Done — app approved and released. Section retained as the launch record; live work now sits in NEXT.*

| WS | Item | Status | Notes |
|----|------|--------|-------|
| ⚖️ | **App Store copyright = `2026 Russell Shear`** | ✅ | Matches the Individual-account seller. Was briefly LoGlide Limited — reverted. |
| ⚖️ | **Entity decision for v1** | ✅ | Operate personally; LoGlide conversion is a planned post-launch migration (below). |
| ⚖️ | **Drop "service-nerd" from legal copy** | ✅ | Privacy + Terms now "operated by Russell Shear". Infra identifiers (gist URL, repo) left as-is. |
| 📣 | **App Store listing** (subtitle, description, keywords, screenshots) | ✅ | 5 screenshots uploaded; three-beat description rhythm optional polish (analysis §7). |
| 🏃 | **Pre-submission QA / journey test** | ✅ | Critical funnel passing; post-race bug fixed (`f2892b9`). |
| ⚖️ | **Submit for review → release** | ✅ | Approved and **released to the App Store 2026-06-15** (v1.7). Live to all traffic. |
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
| **Trial lifecycle emails** (GTM-09 day-14 + GTM-10 day-11) | ✅ | M | Shipped 2026-06-08 (`7cde428`). Resend, daily GH Actions cron, personalised from last analysed run, no scarcity. Op gate: set GH secrets `CRON_SECRET` + `VERCEL_URL`, confirm green run. |
| **CA-01 — Free-tier "why this plan" coach intro** | ✅ | S | Shipped 2026-06-04. |
| **In-app review prompt at a value moment** | 🔲 | S | After a "nailed" session / good weekly report — not at launch. |

### 🏃 Product — SLT priority order (reviewed 2026-06-06)

| Priority | Item | Status | Effort | Notes |
|---|------|--------|--------|-------|
| ✅ | **UPGRADE-ENTRY-01** | ✅ | S | Shipped 2026-06-04. |
| ✅ | **CA-04** — adjustment narrative | ✅ | S | Shipped (AI-DEPTH-10). |
| ✅ | **R25 cuts #2 + #3** — pre-run band + trend cards | ✅ | ~10h | Shipped 2026-06-04. Confirmed code audit 2026-06-06. Feature registry updated. |
| ✅ | **DS-07 Part A** — edit logged distance on complete manual sessions | ✅ | ~2h | Shipped 2026-06-22. "Update log" on a manual completion now opens the manual editor pre-filled with the logged distance (was a dead-end picker). Distance-correction only. |
| ✅ | **ENGINE-02** — long run shortfall detection | ✅ | S | Shipped 2026-06-22 (`b605088` engine + finalised). Migration `20260622_engine_trigger_types.sql` (also fixes ENGINE-01's missing trigger type) ⚠️ apply to live DB. Principle §66. |
| **#4** | **CA-03** — post-race "what next" goal-ladder | 🔲 | M | PAID. Fires in PostRunScreen for race sessions. Seeds wizard prefill. **Now the head of the actionable stack.** |
| ⛔ | **ENGINE-03a** — cycle false positive fix | ⛔ | S | **BLOCKED (verified 2026-06-22).** `@capgo/capacitor-health@8.4.8` exposes no menstrual/cycle data type — no data path. Needs a custom Swift bridge / plugin fork to unblock. |
| ⛔ | **CA-05** — cycle-aware coaching thin slice | ⛔ | M | **BLOCKED on ENGINE-03a** (same missing cycle data). |
| **#7** | **POST-RUN-REFRAME-02** — voice memo reframe input | 🔲 | M (~3d) | PAID. Make Whisper/OpenAI vendor decision — don't let it stay deferred by indecision. |
| **#8** | **CA-02** — Apple Watch companion app | 🔲 | L | FREE/PAID. Dedicated sprint. Scope locked: session + zone + HR + one-tap start only. Start Apple Developer provisioning now. |
| later | **POST-RUN-03** — rich-media zone push | 🔲 | M | Gated on production APNs. Not before #1–4. |

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
| **CA-06 — Plan history UI** | FREE | S | ✅ Shipped 2026-06-05. Read-only list in MeScreen. |
| **CA-02 — Apple Watch companion** | FREE/PAID | L | **NEXT #8** — moved to NEXT (dedicated sprint). Start Apple Developer provisioning now. |
| **CA-03 — Post-race goal-ladder** | PAID | M | **NEXT #4** — moved to NEXT. Closes post-race churn void. |
| **CA-07 — "Ask Kit about this run"** | PAID | M | Hold. Return when 50+ paying users — build for real questions, not imagined ones. |
| **CA-08 — Garmin Connect** | PAID | M | **Apply for Garmin Connect Developer Program now** (4–8 week approval). Build later. |
| **R18** Plan confidence · **R21** Strength sessions · **R22** Blockout days · **R24** Multi-race · **R26** Background load | PAID | M–L | Hold. No urgency. |
| **CA-05 / R27** — Cycle-aware coaching | FREE (recommended) | M | ⛔ **BLOCKED (2026-06-22)** — depends on ENGINE-03a, which is blocked: `@capgo/capacitor-health` has no menstrual/cycle data. Needs a plugin fork / Swift bridge before this moat is buildable. |
| **Supplementary session slots** | FREE slot / PAID placement | ~3wk | Big schema footprint. Dedicated window only. Hold the line on AM/PM run-doubling. |
| ~~**DS-05** sleep stages~~ ✅ shipped 2026-06-22 · **DS-06** manual run metrics | mixed | S–M | DS-05 done (quality-weighted readiness). DS-06 data hygiene, no urgency. |
| ~~**DS-07 Part A** — edit logged distance~~ ✅ shipped 2026-06-22 | FREE | ~2h | Done. DS-07 Part B (composite effort) remains on the bench. |

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
