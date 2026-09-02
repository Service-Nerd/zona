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
**Sequenced waves:** the open backlog is sequenced into six waves (W0–W6) by the SLT portfolio review (2026-07-22). The wave map + per-item `[Wn]` tags live at the top of `backlog.md` (§ Roadmap Waves). This doc holds the horizon × workstream view; the wave map holds the build order.
**Last updated:** 2026-09-02 (**Plan-engine correctness day — W1d follow-ups closed and the verification blind spot behind them.** Shipped: doc pipeline caught up (HR-MAX-01 + §79 Phases 1–3 → registry); **§79-PEAKKM** — a self-declared fitness level could raise *starting* tonnage via `peakKm` → the week-1 volume floor, now binds asymmetrically (upward = intensity only, downward = both); **§79-INTENSITY-ROUTING**; **§53** variety cap made satisfiable (`max(fraction, pigeonhole)`, D-21); **§52 closed entirely** — lopsided low-volume weeks now take §52's own third remedy and classify `maintenance`, taking `INV-PLAN-LR-MAX-WEEKLY-PCT` **59 → 0** including 35 that pre-dated the day. **Root cause of the two defects shipped and fixed mid-day: verification that could not reach the changed code.** The property sweep set `fitness_level` on all 17,957 plans and never set `training_age`, so the engine's assessment path was unreachable and "byte-identical, no new violations" meant *no coverage*. Sweep widened (18,060 plans) and the archetype matrix given the same treatment (SWEEP-COVERAGE-02, 14/14) — both falsification-tested. Two §52 hypotheses were disproven by measurement and abandoned before shipping. 760 tests, 0 sweep violations.)
**Prior update:** 2026-08-06 (**Wave 1b + 1c SHIPPED — plan generator remediation complete.** All engine fixes (GEN-FIX-02…12) + all 13 signed coaching decisions (PV2-A…I / CD-1…CD-13) live and verified (411 tests + tsc + 414,720-plan sweep → 0 violations); User A regenerated live + push delivered; **acquisition hold struck** (no live acquisition). PV2-H living-plan recalibration wired (tsc-verified). Two rows added to feature-registry; record in `docs/incidents/2026-08-06-plan-defects/analysis.md`. Three input-gated follow-ups remain. Also: W2 closed — MON-TRIAL-01 resolved 2026-08-06.)
**Prior update:** 2026-07-22 (SLT portfolio review + first two waves shipped. **(1)** Full open backlog sequenced into Waves W0–W6 — wave map + inline `[Wn]` tags in backlog.md. **(2)** Shipped, same day: **W0** INSTRUMENT-01 (analytics baseline, live+verified); **W1 complete** — EMAIL-CRON-01, RESHAPE-FIX-WAVE2B-AUDIT, OPS-01, RESHAPE-FIX-WAVE3-PHASE2 (silent-failure class closed); **W2** HR-SYNC-04. Two doctrine guardrails added (N-014, N-015). Remaining W2: MON-TRIAL-01 (App-Store-cycle-gated, ASC-only). All in feature-registry.)
**Prior update:** 2026-07-17 (MAINT-01 post-race maintenance block added to LATER — SLT reviewed, build decision unanimous; full spec in backlog)
**Prior update:** 2026-06-24 (HR sync latency absorption SLT-reviewed + committed — HR-SYNC-01/02/03/04 added as priority #7a/b/c after the founder-data evidence that 2/3 recent Watch runs missed HR permanently; Strava approval confirmed not arriving so Layer 2 unconditionally committed; opportunity register `HR-SYNC-FUTURES` captured in backlog for the Swift bridge's wider unlock surface)
**Prior update:** 2026-06-22 (post-launch wave — shipped ENGINE-02, DS-05, DS-07 A+B, CA-03, ENGINE-03-pre, AUTH-RESET-01, BRAND tech-debt; GTM-09/10 reconciled; cycle coaching SLT-reviewed → deferred behind gates; Plan-restore cancelled)

---

## Where we are

iOS-only (US/UK/anglosphere). **🚀 LIVE ON THE APP STORE — v1.7 approved and released 2026-06-15.** The binary is in front of users; focus has shifted from "ship it" to acquisition + conversion + the NEXT product stack. Copyright `2026 Russell Shear`, support page, screenshots, demo account, subscription disclosure, legal copy (service-nerd removed) all done. **Operating entity for v1: Russell Shear personally** (Apple Developer account is Individual; convert to LoGlide Limited post-validation — see Legal & Ops).

**App Store URL — done:** `BRAND.appStore.url` is set to the live listing (`apps.apple.com/app/id6767516424`, verified live 2026-07-22) → the marketing-site download badge is a real link.

**`zonna.run` is now a real marketing page** (live 2026-06-03, redesigned 2026-06-04). Sutherland-flavoured positioning pass: tagline elevated to hero kicker, "What's not in the app" anti-feature grid, "Probably not for you if…" counter-positioning, waitlist + trial copy in brand voice, personalisation mechanic preview (wizard → session card), brand statement closes the page alone. SEO fully wired: `robots.txt`, `sitemap.xml`, page-level canonical + OG + 155-char description, `NEXT_PUBLIC_APP_URL=https://zonna.run` in Vercel. Waitlist form live and taking signups. `BRAND.appStore.url` set → the download badge is a live link (verified 2026-07-22).

> ✅ **2026-08-06 — acquisition hold lifted.** The GEN-FIX-00 hold was struck the same day: the founder confirmed there is no live acquisition to pause (no paid spend / ASO push / waitlist send), and the generator defects that motivated it are now fixed and verified. **Revisit trigger (don't lose):** when paid acquisition is first switched on, re-run the User-A exposure survey and read the INSTRUMENT-01 baseline against a clean cohort.

**Acquisition + retention engine:** trial lifecycle emails (GTM-09/10) shipped 2026-06-08 — day-11 nudge + day-14 expiry via Resend, daily GitHub Actions cron. Waitlist capture live. No paid spend — correct at this stage (wait for trial→paid signal first).

**Foundation waves shipped (2026-07-22):** the cheap, high-trust front of the post-launch roadmap is done — **W0 (measurement)** put an owned analytics baseline in place (INSTRUMENT-01: paying-user/trial-conversion/HR-present/Coach-engagement views — first reading, 27.3% of runs have HR at first query), and **W1 (correctness & trust)** closed the silent-failure class (trial-email cron drift, bare-stub analytics pollution, reshape write-failure monitoring, and the reshape Phase-2 quietness/validation/audit surface). Detail: the wave map at the top of `backlog.md` + feature-registry.

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
| **Marketing site live** (GTM-08) | ✅ | — | **Shipped 2026-06-03. Redesigned + SEO 2026-06-04.** Sutherland positioning pass: tagline as hero kicker, anti-feature grid, counter-positioning, brand-voice copy, personalisation mechanic preview. SEO: `robots.ts`, `sitemap.ts`, canonical/OG metadata, `NEXT_PUBLIC_APP_URL=https://zonna.run`. **On-page SEO pass 2026-09-02 (SEO-01):** keyword-first title, 148-char description, keyword-bearing H1 (`BRAND.marketingH1`, decoupled from the 30-char App Store subtitle), `SoftwareApplication` JSON-LD with no fabricated rating. → feature-registry. `MARKETING_SITE_ENABLED=true` in Vercel. `BRAND.appStore.url` set (2026-07-22) — download badge live. |
| **Waitlist capture** | ✅ | — | **Shipped 2026-06-03.** Supabase `waitlist` table live. `/api/waitlist` route, duplicate emails silent-succeed. |
| **Set App Store URL on approval** | ✅ | S | **Done — verified live 2026-07-22.** `BRAND.appStore.url` = `apps.apple.com/app/id6767516424`; the marketing-site download badge is a live link. |
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

### 🏃 Product — SLT priority order (reviewed 2026-06-06; **re-topped 2026-08-06**)

> ✅ **Wave 1b + 1c — plan generator remediation — SHIPPED 2026-08-06.** The first organic user's plan carried three P0 defects (ended 11 days before race day; HR zones 28 bpm low; beginner copy promising quality the engine couldn't produce). All engine fixes (GEN-FIX-02…12) + all 13 signed coaching decisions (PV2-A…I / CD-1…CD-13) are live and verified (411 tests + tsc + 414,720-plan property sweep → 0 violations). User A's plan regenerated live + push delivered. **Acquisition hold (GEN-FIX-00) struck** — founder confirmed no live acquisition; revisit when paid spend is first turned on. Two rows in feature-registry; full record in `docs/incidents/2026-08-06-plan-defects/analysis.md`. Three input-gated follow-ups remain (see below). The Product queue resumes at Priority 1.

| Priority | Item | Status | Effort | Notes |
|---|------|--------|--------|-------|
| ~~0~~ | **GEN-FIX + PV2 (Wave 1b + 1c)** — plan generator remediation | ✅ | XS–M | Shipped 2026-08-06 → registry. All 13 CDs live. Open follow-ups: PV2-G (Monday-race, needs ADR) · PV2-E braces (HealthKit device verify) · PV2-H end-to-end verify. |
| ✅ | **UPGRADE-ENTRY-01** | ✅ | S | Shipped 2026-06-04. |
| ✅ | **CA-04** — adjustment narrative | ✅ | S | Shipped (AI-DEPTH-10). |
| ✅ | **R25 cuts #2 + #3** — pre-run band + trend cards | ✅ | ~10h | Shipped 2026-06-04. Confirmed code audit 2026-06-06. Feature registry updated. |
| ✅ | **DS-07** — composite effort (A: edit logged distance · B: add another effort) | ✅ | ~2h + ~1.5d | Shipped 2026-06-22 (both parts). Manual completions can be distance-corrected and have second efforts stacked on (hike + treadmill = one session). |
| ✅ | **ENGINE-02** — long run shortfall detection | ✅ | S | Shipped 2026-06-22 (`b605088` engine + finalised). Migration `20260622_engine_trigger_types.sql` (also fixes ENGINE-01's missing trigger type) ⚠️ apply to live DB. Principle §66. |
| ✅ | **CA-03** — post-race "what next" goal-ladder | ✅ | M | Shipped 2026-06-22. TodayScreen card after a logged race: engine-sequenced next goals (chase/step-up/maintain) seed the wizard. Deterministic, PAID, principle §67. |
| ✅ | **ENGINE-03-pre** — readiness RHR noise-hardening | ✅ | S | Shipped 2026-06-22. The no-cycle-data precursor from the SLT review: a single RHR spike no longer softens a session (persistence-or-corroboration), fixing the luteal false-positive root for everyone. Principle §59. |
| ⛔ | **ENGINE-03a** — cycle false positive fix | ⛔ | S | **DEFERRED behind gates (SLT 2026-06-22).** Cycle bridge waits for (a) usage evidence of mis-firing readiness in female cycle-trackers + (b) incorporation/insurance. ENGINE-03-pre already banks most of the value. FREE only (INV-DATA-001). |
| ⛔ | **CA-05** — cycle-aware coaching thin slice | ⛔ | M | **DEFERRED on ENGINE-03** (SLT: the note is the risky part — "the moat is the silence, not the note"; build after a voice review only). |
| **#7a** | **HR-SYNC-01 + HR-SYNC-02** — HR sync latency absorption (Layer 1) | ✅ | S (~1.5 days) | Shipped 2026-06-24. See feature-registry. |
| **#7b** | **HR-SYNC-03** — Swift HealthKit bridge (Layer 2) | ✅ | M (~3–5 days) | Shipped 2026-06-24. See feature-registry. |
| **#7c** | **HR-SYNC-04** — Pre-purchase "works best with Apple Watch" copy | ✅ | S | **Shipped 2026-07-22 (W2).** Single-source `BRAND.hrRecommendation` on `UpgradeScreen` + marketing landing. See feature-registry. |
| **#8** | **POST-RUN-REFRAME-02** — voice memo reframe input | 🔲 | M (~3d) | PAID. Make Whisper/OpenAI vendor decision — don't let it stay deferred by indecision. *(was #7)* |
| **#9** | **CA-02** — Apple Watch companion app | 🔲 | L | FREE/PAID. Dedicated sprint. Scope locked: session + zone + HR + one-tap start only. Start Apple Developer provisioning now. *(was #8)* |
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
| ~~**CA-03 — Post-race goal-ladder**~~ ✅ shipped 2026-06-22 | PAID | M | Done — closed the post-race void. Pairs with R24 (multi-race). |
| **CA-07 — "Ask Kit about this run"** | PAID | M | Hold. Return when 50+ paying users — build for real questions, not imagined ones. |
| **CA-08 — Garmin Connect** | PAID | M | **Apply for Garmin Connect Developer Program now** (4–8 week approval). Build later. |
| **R18** Plan confidence · **R21** Strength sessions · **R22** Blockout days · **R24** Multi-race · **R26** Background load | PAID | M–L | Hold. No urgency. |
| **CA-05 / R27** — Cycle-aware coaching | FREE | M | ⛔ **DEFERRED behind gates (SLT 2026-06-22).** Precursor ENGINE-03-pre shipped (no-data RHR hardening). Cycle bridge gated on usage evidence + incorporation/insurance; moat kept visible. |
| **Supplementary session slots** | FREE slot / PAID placement | ~3wk | Big schema footprint. Dedicated window only. Hold the line on AM/PM run-doubling. |
| ~~**DS-05** sleep stages~~ ✅ shipped 2026-06-22 · **DS-06** manual run metrics | mixed | S–M | DS-05 done (quality-weighted readiness). DS-06 data hygiene, no urgency. |
| ~~**DS-07** — edit logged distance + composite effort~~ ✅ shipped 2026-06-22 | FREE | — | Done (both parts). |

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
| **MAINT-01 — Post-race maintenance block** | ✅ TIER-DIVERGENT. Shipped 2026-07-17. Auto-appends base-running weeks after race; distance-keyed duration, RPE/DNF modifiers. Today screen stays live post-race. |
| **MAINT-02 — AI voice for maintenance block** | 🔲 PAID S. Wire `maintenance_coaching` gate — AI-enriched per-session copy + weekly debrief notes. Full spec in backlog. |
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
