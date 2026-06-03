# Zonna — Go-To-Market Plan (June 2026)

**Date:** 2026-06-03
**Owner:** Russell (solo founder)
**Constraint:** Limited budget. This plan is **organic-first, founder-led**. Paid spend is a small, measured experiment that only starts *after* the free funnel proves it converts.
**Companion docs:** strategy → `docs/gtm/competitive-positioning-analysis-2026-06-03.md` · features → `docs/releases/backlog.md` (GTM-* and CA-* items) · launch ops → `docs/releases/launch-roadmap.md`

> **The one sentence:** Get Zonna in front of intermediate runners who are tired of trying harder, prove the voice converts on a tiny audience, *then* — and only then — spend money to widen the top of the funnel.

---

## 0. Where we are today (honest starting line)

| Asset | State |
|---|---|
| iOS app | TestFlight v1.7 build 8; submitted to App Store; awaiting screenshots final-check |
| `zonna.run` | Live on Vercel — but currently **just redirects to the app** (marketing site is built and behind the `MARKETING_SITE_ENABLED` flag, GTM-08) |
| Privacy + Terms | Live (`/privacy`, `/terms`) |
| Marketing site | **Built, dark-launched.** One flag flip from going live |
| Support URL | ✅ **Done & live** — `zonna.run/support` (`app/support/page.tsx`) exposes `support@zonna.run` + subscription/account/data/health sections; uploaded to the Apple submission |
| Email/lifecycle | None — GTM-09/10 (trial emails) not built; no email platform connected (verified: no Resend/SMTP in the codebase). Note: a `support@zonna.run` mailbox already exists (used on the support page) |
| Pricing | £7.99/mo · £59.99/yr · 14-day reverse trial · Apple Small Business Program (15% cut) |
| Scope | iOS-only, US/UK/anglosphere. No Stripe/web checkout, no EU, no Android (all deferred) |

**Reality of an iOS-only launch:** the **App Store listing is the entire conversion funnel.** Every organic effort drives to one place — the App Store page. So the listing (subtitle, screenshots, description, first-impression) *is* the most important marketing asset, and it's nearly done.

---

## 1. Objectives & the metric that matters

Don't chase downloads. Downloads are vanity on an iOS reverse-trial product. The funnel is:

```
Impression → App Store page → Install → Plan generated (activation) → Trial value moment → Paid conversion → Retained
```

**North-star for the first 90 days: paid conversions (trial → subscription).** Everything else is a leading indicator.

| Horizon | Target (deliberately modest — solo, organic) | Why |
|---|---|---|
| 30 days | 100 installs · 60 plans generated · 5–10 paid | Prove the listing converts impressions and the wedge message lands |
| 60 days | 400 cumulative installs · 30–50 paid · trial→paid ≥ 8% | Prove the *voice* converts trials, not just the pitch |
| 90 days | 1,000 cumulative installs · 80–120 paid · D30 retention measurable | Enough signal to justify the first £ of paid spend |

If trial→paid is healthy (≥8–10%) but installs are low → spend on top-of-funnel. If installs are fine but trial→paid is weak → fix the product wedge (CA-01) before spending a penny.

---

## 2. Positioning we lead with (from the analysis)

- **Category frame:** *"A running coach that holds your zones."* Do **not** compete for "AI run coach" SEO — crowded, and the AI is our engine, not our value.
- **The hook (what stops the scroll):** *"You're trying hard. That's the problem."*
- **The proof (what's unique):** the coach tells you the truth about every run — and **stays quiet when you're overcooking it** instead of cheering. No competitor does this.
- **The audience line:** *"Slow down. You've got a day job."*
- **The voice anchor / tagline:** *"Hold the zone."*

All marketing copy pulls from `BRAND.*`. Never hardcode brand strings (CLAUDE.md rule).

---

## 3. Who we're targeting and where they already are

**Primary wedge (from analysis §5.3):** intermediate runners, race in 8–24 weeks, work a day job, have used Strava, burned by a free plan that broke when life got in the way.

**Where they congregate (all free to reach):**
- Reddit: r/running, r/AdvancedRunning, r/Marathon_Training, r/firstmarathon, r/halfmarathon, r/C25K (graduates), r/RunningShoeGeeks (adjacent)
- Strava clubs (UK-focused running clubs)
- Instagram / TikTok / YouTube Shorts running niche
- Running newsletters & micro-podcasts (anti-hustle / masters / amateur-runner angle)
- Facebook groups (UK parkrun-adjacent, marathon-training cohorts)

**The wedge content angle that fits the brand:** *"why running everything medium-hard makes you slower"* / *"the grey middle"* / *zone discipline*. This is genuinely contrarian, educational, and on-brand — it's not a product ad, it's a point of view. That's what travels organically.

---

## 4. The plan — phased, with costs

### Phase 0 — Launch foundations (this week, ~£0)
*Free or near-free. Items confirmed already-done are marked ✅ so this list stays honest.*

1. ✅ **Support URL** — already live at `zonna.run/support` with `support@zonna.run`, and uploaded to the Apple submission. Nothing to do.
2. **Flip `MARKETING_SITE_ENABLED` → "true"** in Vercel so `zonna.run` serves the marketing page, not the redirect. The site is built (GTM-08). **First check whether it's already flipped** (`vercel env ls` / Vercel dashboard) — don't assume; the dark-launch default is redirect-to-dashboard. Only flip once the app is publicly live.
3. **Add a waitlist/notify-me email capture** to the marketing site (deferred enhancement in GTM-08, ~1h via a Supabase `waitlist` table — verified not built yet) — captures the iPhone-less and the not-ready-yet. Free.
4. **Nail the App Store listing** — screenshots (the last ASC asset), the three-beat description rhythm from the analysis §7, keywords already at 96/100. Highest-ROI work available — it's the whole funnel.
5. **Set up basic analytics** — App Store Connect gives install/conversion funnels free. Add product analytics only on a free tier (PostHog free / Supabase events) — don't pay yet.

**Cost: ~£0.**

### Phase 1 — Organic wedge launch (weeks 1–6, ~£0–£50)
*Founder-led, voice-first, no ad spend. Goal: first 100 paid-eligible installs and proof the message lands.*

1. **Build in public / founder story.** A solo founder who built an anti-overtraining coach because he was tired of running everything medium-hard is a *story*, not an ad. Post the journey on Reddit (r/running "I built…" posts do well when honest and not salesy), Indie Hackers, and a personal X/Threads/LinkedIn. The brand's honest, slightly-sarcastic voice is a natural fit for these channels.
2. **Content as point-of-view, not promotion.** 1–2 short pieces a week on the "grey middle" thesis — each is a 30–60s vertical video (talking head + simple captions) or a short written post. Topics: *"Why your easy runs are too fast", "The grey middle is why you're not improving", "What zone discipline actually means", "Stop trying harder."* Repurpose one idea across Reddit text, a Short, and an Instagram carousel. **Zero production budget — phone camera, no editor.**
3. **Seed the communities you're *in*, honestly.** Don't spam. Answer real questions in running subreddits with genuine value; mention Zonna only where relevant and disclosed. The risk-gate / "the app stays quiet when you're overcooking it" story is a great comment-level hook.
4. **Get 10–20 real testers → reviews.** TestFlight cohort + early adopters. App Store ratings are conversion fuel; the first 10 reviews matter more than the next 1,000. Ask happy trial users directly (in-app prompt at a value moment, not at launch).
5. **Micro-PR / newsletters.** Pitch 5–10 running newsletters and small podcasts with the contrarian angle (not "new app launched" — *"a coach that tells you to slow down"*). Free, just outreach time.

**Cost: ~£0–£50** (maybe a Canva Pro month if needed for assets — but the brand is deliberately minimal, so probably not).

### Phase 2 — Activation & retention infrastructure (weeks 2–8, ~£0–£20/mo)
*This is where limited budget should go first — keeping the users you already won is cheaper than buying new ones.*

1. **Build the trial lifecycle emails (GTM-09 + GTM-10).** Day-11 nudge ("3 days left") + day-14 expiry ("Kit's gone quiet."). Use **Resend** — free tier covers 3,000 emails/month / 100/day, which is ample at this scale (£0 until volume). This is the single highest-ROI build because it directly lifts trial→paid, the north-star metric.
2. **Ship CA-01 (free-tier coach intro).** From the analysis: the wedge moment is silent today. A ~50-token Haiku coach intro on the first free plan makes the voice *felt* before the paywall. Tiny build, tiny token cost, directly improves activation→trial. **This is a product fix that is also the best marketing.**
3. **In-app review prompt at a value moment** (after a "nailed" session or a good weekly report), not at launch.

**Cost: ~£0–£20/mo** (Resend free tier; Anthropic tokens for CA-01 are negligible at this volume).

### Phase 3 — Small, measured paid experiments (weeks 8–12+, only if Phase 1–2 convert)
*Do not start until trial→paid ≥ 8% organically. Paid amplifies a working funnel; it cannot fix a broken one.*

1. **Apple Search Ads — Basic / small budget.** The highest-intent traffic on iOS. Someone searching "marathon training plan" or "running coach" is bottom-of-funnel. Start at **£5–£10/day capped**, bid on a handful of exact terms (NOT "AI" terms — per positioning). Measure cost-per-trial and cost-per-paid. Apple Search Ads is the *only* paid channel worth touching first for an iOS-only product.
2. **Boost the one piece of organic content that already worked.** If a Short or Reel got traction organically, put £20–£50 behind it. Never boost cold.
3. **Hold everything else.** No Meta/Google display, no influencer fees, no agencies. Not at this budget, not at this stage.

**Cost: start ~£150–£300/month total, hard-capped, killed fast if cost-per-paid > ~1× annual price (£60).**

---

## 5. Budget summary

| Tier | Monthly | What it buys |
|---|---|---|
| **Floor (do this regardless)** | **~£0–£20** | Domain email, Resend free tier, App Store Connect analytics, founder time on content + communities |
| **Lean (recommended)** | **~£50–£100** | Above + occasional asset tooling + a tiny Apple Search Ads test once the funnel converts |
| **If a bit more frees up** | **~£200–£350** | Above + sustained Apple Search Ads (£5–£10/day) + boosting proven content |

**Spending principle:** every £ of paid spend must be traceable to a cost-per-paid-conversion. If you can't measure it, don't spend it. The first money goes to **retention infrastructure** (trial emails) before acquisition, because keeping a won user is cheaper than buying a new one.

---

## 6. Sequenced action list (next 90 days)

### Weeks 1–2 (ship + foundations)
- [x] ~~Support URL~~ — done (`zonna.run/support`, uploaded to Apple)
- [ ] Capture App Store screenshots, apply three-beat description rhythm, submit for review
- [ ] Once live: confirm/flip `MARKETING_SITE_ENABLED` in Vercel, add waitlist capture
- [ ] Write the founder "why I built this" post; line up the 10–20 reviewer cohort
- [ ] Stand up Resend (free) — scaffold GTM-09/10

### Weeks 3–6 (organic wedge)
- [ ] Publish 1–2 "grey middle" content pieces/week; seed running communities honestly
- [ ] Ship CA-01 (free-tier coach intro) — biggest activation lever
- [ ] Ship GTM-09 + GTM-10 trial emails
- [ ] Pitch 5–10 newsletters/podcasts with the "coach that tells you to slow down" angle
- [ ] In-app review prompt at a value moment

### Weeks 7–12 (measure, then amplify)
- [ ] Read the funnel: install→plan, trial→paid, D30 retention
- [ ] If trial→paid ≥ 8%: start Apple Search Ads at £5–£10/day on exact bottom-funnel terms
- [ ] Boost the one organic piece that already worked
- [ ] Revisit pricing (GTM-11 — annual discount 37% vs category 44–49%; can move to £9.99/mo without a code change) once ~100 paid conversions exist
- [ ] Decide v1.1 priorities from real data (Stripe/web, marketing-site depth, Apple Watch CA-02)

---

## 7. Channel fit — quick reference

| Channel | Cost | Fit for Zonna | Priority |
|---|---|---|---|
| App Store listing (ASO) | £0 | **The whole funnel.** Highest ROI work available | **DO FIRST** |
| Reddit (honest, value-first) | £0 | Wedge audience lives here; brand voice fits | **HIGH** |
| Short-form video (Shorts/Reels/TikTok) | £0 | "Grey middle" POV content travels; phone-only production | **HIGH** |
| Build-in-public (IH/X/LinkedIn) | £0 | Founder story is genuinely interesting | **HIGH** |
| Trial lifecycle email (Resend) | £0 free tier | Directly lifts the north-star metric | **HIGH (retention)** |
| Running newsletters / micro-podcasts | £0 (outreach) | Contrarian angle is pitchable | **MEDIUM** |
| Apple Search Ads | £5–£10/day | Highest-intent iOS traffic; only paid channel worth touching first | **MEDIUM (after funnel proves)** |
| Boosting proven organic content | £20–£50 one-off | Amplify what already works | **LOW (opportunistic)** |
| Meta/Google display, influencers, agencies | ££££ | Wrong stage, wrong budget | **HOLD** |

---

## 8. Risks & guardrails

| Risk | Guardrail |
|---|---|
| Spending before the funnel converts | Hard rule: no acquisition spend until trial→paid ≥ 8% organically |
| The wedge moment stays silent (free user never hears the voice) | Ship CA-01 early — it's the cheapest, highest-leverage fix |
| Apple Watch gap surfaces in reviews | Pre-empt in the description ("Apple Watch via Apple Health"); prioritise CA-02 for v1.1 |
| iOS-only caps the addressable market | Accept for v1 (deliberate); waitlist captures non-iOS demand for the v1.1 Stripe/Android decision |
| Founder-time is the real budget | Repurpose one content idea across 3 channels; batch-record; don't build bespoke per channel |
| Reviews/ratings cold-start | First 10 reviews from the tester cohort before any acquisition push |
| Competitor (Runna/Strava) noise | Don't compete on polish or "AI" — compete on the one thing they can't copy without rebuilding their voice: honesty + restraint |

---

## 9. What success looks like at day 90

- The App Store listing converts impressions at a healthy rate (the funnel works).
- Trial→paid ≥ 8–10%, driven by the voice (CA-01 + the reframe), not by discounting.
- A small, repeatable content engine ("grey middle" POV) producing organic installs at ~£0.
- Trial lifecycle emails recovering would-be churned trials.
- Enough paid-conversion signal to know whether Apple Search Ads pays back — and therefore whether to scale spend or keep iterating the product.
- A clear, data-backed v1.1 decision: web/Stripe + Apple Watch + (maybe) the first cautious paid scale.

> **The whole plan in one line:** prove the voice converts a tiny audience for free, fix the silent wedge moment, then spend only what you can trace to a paid conversion.
