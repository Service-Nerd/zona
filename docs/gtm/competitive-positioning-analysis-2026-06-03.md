# Zonna — Competitive & Positioning Analysis (v2.0)

**Date:** 2026-06-03
**Author:** PMM + PM + UXR + BA composite (assistant-generated, grounded in full codebase + canonical docs + App Store metadata)
**Status:** Reference document. Companion outputs:
- Roadmap items derived from this analysis → `docs/releases/backlog.md` § "Competitive analysis follow-ups (CA-01…)"
- Go-to-market plan derived from this analysis → `docs/gtm/go-to-market-plan-2026-06.md`

> **How to use this doc:** This is the strategic source of truth for *why* Zonna wins and *who* it wins with. When writing marketing copy, prioritising the roadmap, or pitching, start here. External competitor claims are training-data grounded — the flags in § "Assumptions" must be verified before any claim ships in public marketing.

---

## 0. TL;DR

- **The product reality:** a deterministic rule engine (`lib/plan/*`) carries the *prescription*; an Anthropic-only AI layer (Haiku fast / Sonnet deep) carries the *voice*. They're decoupled by design (ADR-006) — **AI failure is silent, the user still gets a working plan.** This rigour is the most underrated thing in the codebase.
- **The defensible square:** AI depth of TrainAsONE × positioning clarity of Planzy × voice quality of nobody in the category.
- **The single most defensible asset:** `lib/coaching/reframeRiskGate.ts` — the post-run reframe is *silenced* when overload signals fire. The app staying quiet when you expected a cheerleader is the moment the brand earns lifetime trust. **No competitor does this.**
- **The biggest commercial risk is not competitors — it's the wedge moment:** a free user, fresh install, no Strava, has *no AI surface at all*. The least-committed user gets the most under-served experience. Fix that one moment and the conversion math changes.
- **Recommended positioning:** voice-led — *"a running coach that holds your zones, tells you the truth about every run, and stays quiet when you need a real coach instead of a cheerleader."*
- **Recommended category frame:** *"A running coach that holds your zones."* Don't fight for "AI run coach" SEO — the AI is the engine, not the value. The value is zone discipline.

---

## 1. App Summary — What the Codebase Shows

Zonna is an iOS-first running coaching app: a Capacitor wrapper over a Next.js + Supabase web app. In TestFlight (build 8, v1.7, uploaded 2026-06-02), submitted to App Store, awaiting screenshots/final demo seed.

**Brand:** "Zonna" (renamed from Vetra, May 2026). All strings parameterised through `BRAND.*` in `lib/brand.ts`. Coach has a name: **Kit**.

**Three locked taglines, each with a job:**
- *Discovery* — "Plans that stop overtraining." (`BRAND.appStoreSubtitle`, App Store subtitle, 29/30 chars)
- *In-app* — "Slow down. You've got a day job." (`BRAND.tagline`)
- *Editorial voice* — "You can't outrun your easy days." (`BRAND.brandStatement`)
- *In-product voice anchor* — "Hold the zone." (`BRAND.voiceAnchor`)

**Positioning thesis (verbatim from `brand.md`):** "Zonna is for runners who blur their zones — who go medium-hard on everything, never truly recover, and never truly push." Core insight: **"You're trying hard. That's the problem."**

### 1.1 Feature Inventory

**CORE** (cannot ship without):
- Rule-engine plan generator (`lib/plan/*`, ADR-009 config-driven) — distance × race date × days × fitness → JSON plan
- Plan invariants validator (`lib/plan/invariants.ts`) — every plan mechanically checked against `CoachingPrinciples.md` before save
- 8-step wizard (free) / 11-step (paid) — `GeneratePlanScreen.tsx`
- Today / Session Detail / Plan / Me screens
- Session completion (manual + Strava-linked + HealthKit-linked) with RPE + fatigue tag
- HR zone calculation (formula-derived — no API call)
- Login (email/pw + Google OAuth + Sign in with Apple, all native via Capacitor)
- Supabase auth + RLS

**SECONDARY:**
- Plan reshape engine — 9 automatic triggers
- Push notifications (APNs iOS; VAPID web)
- Strava OAuth + webhook + activity dedupe vs HealthKit (`lib/coaching/healthkitConsolidate.ts`)
- HealthKit ingest (`@capgo/capacitor-health`)
- Plan archive (`plan_archive` — snapshots prior plan; no restore UI yet)
- Notification inbox (NOTIF-01 — auto-adjustment ledger)
- Trial expiry banner + Upgrade (RevenueCat + StoreKit 2; Stripe deferred to v1.1)

**DIFFERENTIATING:**
- **Post-run reframe with risk gate** (`lib/coaching/reframeRiskGate.ts`) — Sonnet-generated coaching response *silenced* by rule-engine flags when overload signals fire. Voice spec locked in `brand.md`, 4-case golden suite. **No competitor does this.**
- **Tiered evidence ladder** (`lib/coaching/reframeTier.ts`) — reframe degrades gracefully (Tier A multi-month cohort → B RPE pattern → C structural phase → silence). The system knows what it doesn't know.
- **Cohort intelligence** (`lib/coaching/runHistory.ts`, R25 cut #1 shipped) — "similar runs from your past self" context in post-run analysis.
- **AIMark glyph** (`components/shared/AIMark.tsx`) — visible AI provenance on every model-generated surface.
- **Plan invariants as constitutional layer** — three-layer agreement (principle → numeric in `GENERATION_CONFIG` → mechanical check in `validatePlan`).
- **Configuration singularity** (INV-CFG-001..005) — zero coaching numerics outside `GENERATION_CONFIG`.
- **Limiter inference** (`lib/coaching/limiter.ts`) — deterministic hypothesis (fatigue / HR drift / pace fade / heat / RPE mismatch) injected into the reframe causation sentence.
- **HealthKit-first iOS UX** (DS-03, shipped 2026-05-30) — Strava is admin-only in production; non-admin users see Apple Health as the primary integration.

### 1.2 The AI Framework

**Inputs (per surface):** athlete context (profile, race), run data (verdict, HR ceiling %, RPE, fatigue, zone breakdown, splits, temperature), plan context (phase, weeks-to-race, trends), and continuity memory (prior week's report, prior phase summary, last similar session). The AI does **not** see Strava segments, power, cadence, VO2max, calendar, or weather forecast.

**Adaptation:** 9 named triggers — `acute_chronic_high`, `zone_drift`, `shadow_load`, `ef_decline`, `fatigue_accumulation`, `skip_with_reason`, `session_reorder`, `readiness_signal`, `manual`. Each has confirm-vs-auto rules, taper protection (no adjustments in final 3 weeks), 2-per-week cap. **The rule engine decides the adjustment; the AI only explains it.**

**Transparency:** reframe sentence 2 *must* carry one specific data point; verdict labels (`nailed/close/off_target/concerning`) visible on every analysed session; confidence score + named risks (paid plan gen); trigger-not-algorithm summaries on adjustments; AIMark on every model surface. **Not exposed:** model identity, prompt structure, token cost, confidence thresholds.

**Voice:** (a) AI text on Today/Session/Coach/Post-run; (b) branded push titles ("Plan's been shifted.", "Kit noticed something."); (c) deterministic voice scaffolding (`lib/coaching/voiceRules.ts`) in every prompt. **No audio, no chat, no conversation threading** — the "Coach" is a dashboard, not an interlocutor.

**Failure handling:** silent across every surface — rule-engine output returned unchanged; null on coaching surfaces (UI hides the card).

**Models:** Haiku 4.5 (high-frequency/short) + Sonnet 4.5 (multi-point reasoning). No OpenAI/Whisper yet (voice-memo reframe POST-RUN-REFRAME-02 would be the first non-Anthropic vendor).

### 1.3 Target User (Inferred)

- **Experience:** Intermediate. No couch-to-5K onboarding; wizard assumes self-reported fitness. Beginners are intentionally not the wedge.
- **Goal framing:** Race target dominates. "Fitness without a race" is structurally second-class.
- **Autonomy:** High guidance, low interruption. No streaks, badges, or social.
- **Lifestyle:** Time-poor. The brand line is literally "You've got a day job." Anti-cheerleader. Values restraint as a virtue; data-curious without being a watch nerd.

### 1.4 App Store Metadata

| Field | Value |
|---|---|
| Name | `Zonna` |
| Subtitle | `Plans that stop overtraining.` (29/30) |
| Keywords (96/100) | heart rate,zones,marathon,half marathon,10k,5k,training,coach,easy runs,pace,recovery,vdot,tempo |
| Pricing | £7.99/month · £59.99/year (37% saving) · 14-day free trial |
| Description first 250 chars | "You're trying hard. That's the problem. Most amateur runners go medium-hard on everything…" |

---

## 2. AI Framework Assessment

**Verdict: the AI architecture is the strongest part of the product** — not because the models are unusual, but because the rule engine carries the prescription and the AI carries the voice.

**Strengths:**
1. **Reframe risk gate is genuinely novel** — overload silences cheerleading. Defensible product *and* brand moat in one line of code.
2. **Tiered evidence ladder** — knows what it doesn't know; degrades to silence rather than hallucinate.
3. **Limiter hypothesis is deterministic** — removes a major hallucination surface.
4. **Cohort intelligence** — "vs your past self" (Runna shows no comparison; Strava shows you vs everyone; only TrainAsONE attempts similar, opaquely).
5. **Continuity memory** (AI-DEPTH-04 + 10) — closes the "every AI call fires standalone" pattern.
6. **AIMark provenance** — unusually honest about when you're reading a model.

**Seams (honest engineering debt, not architectural opacity):**
1. No model fallback chain — Sonnet outage = no reframe/report/summary.
2. Cohort similarity has no recency weighting — 18-month-old match counts as much as last month.
3. Readiness signal needs a 14-day baseline — new users (most overload-prone moment) get no signal.
4. EF trend doesn't account for heat/terrain/fatigue — hot week misreads as fitness regression.
5. Plan enrichment caches only the system prompt — fresh token cost per plan JSON (irrelevant today, matters at 1000+/day).
6. **No coaching layer on the rule plan for free users** — the product is invisible until it's paid.
7. No transparency on enricher attempted-but-failed (backend logs only).

**The black-box statement:** Zonna's AI is *not* a black box. It is the most legibly-engineered AI coaching layer in this analysis. A competitor would learn more from copying `reframeRiskGate.ts` than from any other 200 lines.

---

## 3. Competitive Matrix

AI Depth (1–5): 1 = static · 2 = templated · 3 = adaptive, limited reasoning · 4 = adaptive + explained · 5 = adaptive + explained + degrades-gracefully + rule-governed.

| App | AI Depth | Explains Why? | Price/mo | Key Weakness | Threat |
|---|---|---|---|---|---|
| **Zonna** | 4 | **Y** (mandatory evidence; verdict labels; trigger summaries) | £7.99 / £4.99-equiv annual | New brand, no marketing, no track record, no Watch app | — |
| **Runna** | 3 | Partial (adjusts, doesn't surface causation) | ~£15.99 | Conservative adaptation; AI feels safe not honest; behind Strava now | **HIGH** — incumbent, polish, Strava distribution |
| **Coopah** | 3 | Partial (Race Day Confidence Score) | ~£12.99 | No cross-sport; less polished than Runna | Medium |
| **TrainAsONE** | 4 | **N** (algorithm-first, weak explanations) | ~$9.99 | Dated UI; sometimes back-to-back hard without saying why | Medium — closest in *philosophy*, opposite in *voice* |
| **RunMotion Coach** | 3 | Partial (coach-voice selector) | ~€9 | UK awareness low; functional not premium | Low-Med UK; High EU/trail |
| **Planzy** | 3 | Limited info | sub-£/mo | Tiny brand, minimal differentiation beyond positioning | **MED-HIGH for positioning** — closest direct positional competitor |
| **Nike Run Club** | 1 | N | Free | No adaptation; brand-led | Medium (free + brand draws the wedge) |
| **C25K** | 1 | N | Free | One programme | Low (different category) |
| **Strava** | 2 | N | Free / £6.99 | Thin AI; not a coach — but **owns Runna** | **HIGH as platform** |
| **Runsy** | *insufficient data — flag for manual research* | — | — | Unknown | **Unknown — monitor** |

**Reading:** The only competitor with comparable AI *architecture* is TrainAsONE (awful voice). The only competitor with comparable *positioning* is Planzy (no brand). Zonna's square is genuinely empty.

---

## 4. Gap Analysis

### 4.1 Feature gaps (vs competitor table stakes)

| Feature | Severity | Why it matters |
|---|---|---|
| **Apple Watch companion app** | **CRITICAL** | Runna/Coopah/TrainAsONE all have one. iPhone-only + HealthKit indirection is a category outlier; reviews will mention it. → CA-02 |
| **Garmin Connect integration** | IMPORTANT | Largest fitness-watch ecosystem in distance running. → CA-08 (LATER) |
| **App Preview video** | IMPORTANT | Apple plays it before screenshots. v1.1. |
| **Onboarding / first-week guidance** | IMPORTANT | C25K and NRC nail "first 7 days feel personal." Zonna's first week = rule plan + nothing. → CA-01 |
| **Marketing site live** | CRITICAL for launch | Built, dark-launched (GTM-08). Flip the flag. → GTM plan Phase 0 |
| **Multi-race / A/B race** | IMPORTANT | Intermediate+ runners think in seasons. R24. |
| **Plan history UI** | NICE | Data exists, UI doesn't. → CA-06 |
| **Voice-input reframe** | NICE-but-distinctive | POST-RUN-REFRAME-02. |

### 4.2 User-need gaps (the opportunity space)

| Need | How Zonna handles it | Verdict |
|---|---|---|
| AI explainability | Mandatory evidence; verdict labels; AIMark; trigger summaries | **CLOSES — category leader** |
| Generic personalisation | Config-driven plans, named principle per numeric | **CLOSES (paid); IGNORES (free)** |
| Life doesn't fit the plan | 9 reshape triggers + branded push | **PARTIAL — engine adapts, narrative is thin** → CA-04 |
| Cross-training | Strength stubs only | **IGNORES** (supplementary slots scoped) |
| Post-race void | Post-race reshape shipped; no "what next" | **PARTIAL** → CA-03 |
| Mental coaching | Reframe voice + risk gate | **PARTIAL — best in category at this moment**, single-reframe scope |
| Fuelling/nutrition | Not addressed | IGNORES (deliberate restraint) |
| Hardware dependency | HealthKit-first; admin-only Strava; no Garmin | **PARTIAL — iOS/AppleWatch-indirect is its own dependency** |
| Female-physiology awareness | R27 scoped | IGNORES — but uniquely *visible* as a roadmap item; real moat |
| Background load | R26 scoped | IGNORES — the 15k-step day job is currently invisible |

### 4.3 Experience gaps

| Gap | Where Zonna stands |
|---|---|
| Time to first coached run | Strong (~5 min to plan) |
| **AI trust building early** | **Weakest moment.** Free user, no Strava, no analysed runs → no AI surface. AIMark never lights up. The wedge moment is the most under-served. → CA-01 |
| Plain-language plan logic | Strong on confidence score (paid); weak elsewhere → CA-01 |
| Missed-session handling | Engine adapts, voice acknowledges — but the *coaching moment* is missed → CA-04 |
| Emotional tone | **Strongest in category** |
| Adjustment narrative | Thin (banner + 1-line) → CA-04 |

---

## 5. Positioning (April Dunford framework)

### 5.1 Competitive alternatives (what the user does without Zonna)
1. **Runna** (most likely) · 2. Free static plan (Hal Higdon/Reddit) · 3. TrainAsONE · 4. **Nothing structured** (most likely actual behaviour) · 5. C25K → nothing · 6. A human coach (~£100–200/mo).

### 5.2 Unique attributes (verified against the codebase)
| Attribute | Evidence | Unique? |
|---|---|---|
| Reframe risk gate (warmth-silenced on overload) | `reframeRiskGate.ts` + golden case D | **Yes — verified** |
| Tiered evidence ladder | `reframeTier.ts` | **Yes** |
| Plan invariants constitutional layer | `invariants.ts` | Internal rigour |
| Configuration singularity | `generationConfig.ts` + INV-CFG | Internal |
| Voice that doesn't perform | `brand.md` + voice scaffolding | **Yes — strongest in category** |
| Honest free tier (full plan, no AI voice) | `monetisation-strategy.md` Option A | Defensible |
| HealthKit-first iOS UX | DS-03 | **Yes — almost everyone leads with Strava** |
| Limiter hypothesis (deterministic) | `limiter.ts` | **Yes** |
| AIMark provenance | `AIMark.tsx` | Quietly unique |

### 5.3 Best-fit customer (behavioural)
**Primary wedge:** *intermediate runners who keep going medium-hard on everything, have a race in 8–24 weeks, work a job, have used Strava, and have tried a free plan that broke down the moment life got in the way.*

**Secondary spreaders:** runners who came off a Runna plan feeling unseen; adults returning from injury who don't trust themselves not to overcook the comeback; Apple-Watch-only runners with no Garmin/Strava budget.

**Not the target:** 100+ mi/week sub-elites; couch-to-5K; streak/badge/community seekers.

### 5.4 Market category
**Recommended frame: "A running coach that holds your zones."** A category Zonna creates and already speaks ("Hold the zone."). Don't fight for "AI run coach" SEO — the AI is the engine, not the value.

---

## 6. Start / Stop / Continue

### STOP
1. **Calling it an "AI" coach outside the App Store description.** Lead with "Kit." Use "AI" only where it earns trust; let AIMark do the rest.
2. **Treating the rule-engine plan as the free consolation prize.** Add one Haiku coach intro (~50 tokens) to the free plan — let the wedge user *feel* the voice before the gate. → CA-01
3. **Holding the "no chat" line as brand-defining.** It isn't — zone discipline is. A single gated "ask Kit about this run" affordance is a different feature from chat-as-app and worth reconsidering. → CA-07
4. **Vendor analysis-paralysis on voice memo.** It's device-test capacity, not Whisper-the-vendor. Ship POST-RUN-REFRAME-02.
5. **Defending "no Apple Watch app" by omission.** Either commit to one with a date or pre-empt it in the App Store description. → CA-02

### START (within 90 days)
1. **Apple Watch companion app** — even a thin one (today's session + zone target + one-tap start). Competitive necessity. → CA-02
2. **Free-tier "why this plan" coach intro** (Haiku, ~50 tokens). Closes the silent wedge moment; seeds the upgrade case. → CA-01
3. **R25 cuts #2 + #3** (Today pre-run band + Coach trend cards). Turns "coach for today" into "coach for your trajectory"; reason to stay subscribed between races.
4. **Adjustment narrative pattern** (1 Haiku call per adjustment). The system already adapts; the user only feels half of it. → CA-04
5. **R27 cycle-aware coaching — thin slice.** Highest-leverage moat on the backlog; competitors avoid it because it needs voice work.

### CONTINUE (protect)
1. **The reframe voice spec + golden suite** — brand-defining product asset; treat changes as constitutional.
2. **Config singularity + plan invariants** — durable, compounding, hard for a contractor to replicate.
3. **The honest free tier + Option A downgrade** — the only commercially-relevant trust signal on day one. Don't tighten gates without conversion data.

---

## 7. Proposition Options

**A. Voice-led (recommended).** *For intermediate runners with a day job, **Zonna** is the **running coach that holds your zones** that **tells you the truth about every run — and stays quiet when you need a real coach instead of a cheerleader**, unlike **Runna**, which **gives you a plan but doesn't say a word when you're overcooking it**.*

**B. Engine-led.** *…the **adaptive running coach** that **reshapes the week around what you actually did**, unlike **static templates** that **assume you'll follow them perfectly**.*

**C. Data-led.** *…the **intelligent training coach** that **explains every session, reshape, and weekly score in plain language**, unlike **TrainAsONE**, which **trusts the algorithm but doesn't tell you why**.*

**Recommendation: A.** It's the one the codebase keeps earning (every release strengthens the voice), it avoids the crowded "adaptive"/"intelligent" claims, and it maps directly onto the locked tagline triad.

**Tagline (under 8 words):** **"Hold the zone."** (already `BRAND.voiceAnchor`). The audience-naming line ("Slow down. You've got a day job.") stays.

**App Store subtitle:** keep `Plans that stop overtraining.` (locked, 29/30).

**Description opening — recommended rhythm (same words, three beats):**
> You're trying hard. That's the problem.
>
> Most amateur runners go medium-hard on everything — never truly recover, never truly push, and wonder why they don't improve.
>
> Zonna prescribes the zone for every session and holds you to it. Easy days are easy. Hard days are hard. The grey middle disappears.

---

## 8. Closing Call-outs

1. **Submit the screenshots and ship.** A week of real user data beats another pre-launch design round.
2. **The product is more honest than its public-facing self currently reflects.** Once R25 cuts #2+#3 and the R27 stub land, the story changes from "another AI run coach" to "the only running coach that tells you the truth and knows when to stay quiet."
3. **The biggest commercial risk is the wedge moment** (free user, fresh install, no Strava). Fix CA-01 and conversion changes.
4. **The reframe risk gate is the most defensible 200 lines in the codebase.** Protect it; make it more visible in marketing.

---

## Assumptions (verify before any public marketing claim)
- **Runna** pricing/acquisition: public reporting through 2025 — verify current pricing.
- **Planzy:** "busy lives" positioning verified; deeper feature specifics not.
- **Runsy:** insufficient data — manual App Store + web research required before any competitive campaign.
- **TrainAsONE** $9.99/mo: recall-grade, not verified.
- **Coopah** Race Day Confidence Score: positioning verified; algorithm depth not.

**Grounded in:** full reads of `CLAUDE.md`, `lib/brand.ts`, `brand.md`, `monetisation-strategy.md`, `app-store-copy.md`, `backlog.md`, `brand-product-alignment.md`, plus structured surveys of `lib/coaching/*`, `lib/plan/*`, `app/api/*`, `app/dashboard/*`. External competitor claims are training-data grounded with the flags above.
