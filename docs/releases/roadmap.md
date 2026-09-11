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
**Last updated:** 2026-09-11 (**Cosmetics in the morning, then a partnership changed the priority.** *Morning:* **BRAND-08-pwa** shipped (16 PWA/favicon PNGs regenerated from the concentric-rings source; browser tabs had shown a mark we dropped in May, because the iOS *native* icon was regenerated on 05-13 and this set was missed, and **nothing in the repo can compare two icon sets in different formats made by different tools**). Also the **V2-POLISH-01** Me-screen half: all 53 inline card sites classified, 9 lifted, 44 left flat with reasons. En route, two false premises **in the backlog itself**: it named three components (`StatCell`/`StatRow`/`ActionListCard`) that **have never existed in this repo**, and its `--section-gap` half assumed a 28px section rhythm that does not exist (5 sites, none a section stack, against 25 uses of 20px; the token is read by nothing). Four of the design handoff's nine named components point at nothing. *Then:* **a charity partner is referring its runners to Zonna, the first real referral channel**, which made the homepage a cold-audience first-impression surface. Audited it: the founder flagged 3 problems on the hero device shot, it had **5**, and there were 2 more beside it. The two he could not have seen: the **wordmark was a hand-rolled span** that had diverged from the real component (lowercase, wrong weight, no NN-moss), and the facts band claimed **"1 notification a day", which is false** (five senders; the run-linked push has no preference gate, so any run day is already two). The **nav bar was invisible** because the content div is `position:relative` and the nav is `static`, so content overflowing a hand-measured crop painted over it — fixed structurally with `overflow:hidden`, not by re-measuring. SLT cut one of two Kit cards (dead Confirm/Revert buttons on a still; a claim every competitor makes) and the freed space restored the DateStrip and the voice anchor. **Plan pages were worse than the hero:** across 73 quality sessions, the set rendered as one flat sentence up to **433 characters** (a 13-step pyramid you could not see was a pyramid) and **11 of 73 (15%) rendered NOTHING** — all 5K time trials, every one already carrying a coach note the page had never read. **100% of quality sessions carry coach notes; zero were shown.** Also shipped: **no em dashes** as a brand standard (92 instances rewritten by hand, en-dash ranges and comments exempt, enforced by a falsification-tested guard) and **GTM-CHARITY-01**, a charity-runner landing page that names no charity and is honest up front that marathon generation is trial/paid. Day's end: 1150 tests / 137 files, tsc + `next build` clean. **Lesson, twice in one day: I trusted a document about code.** The backlog's component names and my own claim that RestraintCard "rendered flat on Today" were both wrong, and both would have survived review.)

**Previously (2026-09-10):** (**Engine correctness in the morning, the whole marketing site in the afternoon.** *Marketing:* shipped **GTM-SEO-COMPARE-01** (`/runna-alternatives` + `/comparisons`, built as a reusable template so pages 2–8 are a catalogue entry each) and **GTM-SITE-01** (a full-site review with the SLT and frontend-design). The site had five hand-written headers, four footers, and three pages with neither — the wordmark changed size as you navigated and the legal pages were dead ends. Now one `SiteHeader`/`SiteFooter` at a constant width. Also corrected two stale homepage claims: "four answers" against a ~15-question wizard, and "or you walk" against a monetisation doc that promises a graceful downgrade. **Three lessons worth more than the code:** (1) *marketing copy rots exactly like code and nothing fails when it does* — the four-answers claim survived five wizard changes, and then survived my own first fix by hiding in a second component; (2) *Next merges metadata SHALLOWLY*, which had silently dropped `og:image` from `/plans` and all 9 spokes; (3) **the canonical host pointed at a 307 redirect for every page, and my first fix was a no-op that my own verification passed** — I checked the local build, where the env var is absent, so it fell through to the new default and showed me what I wanted; production read `NEXT_PUBLIC_APP_URL` and was unchanged. Same class as the morning's engine bug: *verification that does not reach the real code path.* Env var now removed entirely so the value lives in git. *Engine, earlier:* **The day two fixes were superseded by asking whether the rule was right.** Pulled the 09-09 wave, then one investigation produced two ships. **INTENSITY-FOUNDATION-BLIND-02**: BLIND-01's defer key was false on the >28-day *choice* band — `plannedFoundationWeeks` returns 0 unless the decision is already `'add'`, and deciding later is that band's whole purpose — so a compliant marathon plan (18.6%, 13/70 bare → clean delivered) still logged in prod and *threw* in dev/test. Same commit made **`today` an injectable input to generation**: it was read from `new Date()` internally while the sweep pinned `PLAN_START` in the past and `gapDays` clamps to 0, so generation saw **gap 0 for all 16,038 plans** — §91's on-ramp credit and the whole §1 foundation path had **zero coverage**, and the pinned seed drifted with the wall clock. Restoring that coverage immediately exposed a **live production breach** (§91's credit collapses base to ZERO, quality starts week 1, 19.0% vs an 18% ceiling). **Then the Coaching Board changed the rule instead of the code**: **CB-FOUNDATION-DENOM-01** — §1's denominator is now main-plan weeks only, §57 foundation weeks excluded (§57: "never part of the periodisation arc"; CB-1: the block is "habit and routine, not adaptation"). Decisive argument: the old rule was **gameable by the calendar** — the ceiling got looser the earlier you generated, so two runners with an identical block and identical quality sessions got different verdicts. That ruling **deleted** the BLIND-01/02 defer machinery rather than extending it: the two `validatePlan` runs disagreed *by construction*. Measured before ruling — the dilution masked exactly **1** breach across 4,642 block-carrying plans, so it is a **coherence** fix, not a safety fix. Lesson of the day: *I fixed the same thing twice before questioning the rule behind it; a structured review is what supplies that question.* Also caught: §91 had shipped a prose claim doing a mechanical check's job for three days, and a near-miss where spreading `meta` in the compose owner would have silently dropped the free-tier AI intro. **Then a third wave, later the same day — both of those "open items" turned out to be one misdiagnosis and it is now SHIPPED.** **§98 / CB-ONSET-YIELD-01**: FOUNDATION-QUALITY-YIELD-01 blamed §91's foundation credit; measured, **§89's early onset breaches §1 by itself** — 29 breaches with the gate open, **0 with it closed**, and 11 of the 29 carried no foundation block at all. A credit-aimed fix took 34→31 and would have closed the item. §97's two gates were *inert*: they set the base cap, §91's credit subtracts from it, so base hit 0 in all twelve distance × day cells whatever the gate ruled. Fixed by a **bounded yield ladder** — walk base back a week at a time until §1 holds, never past the on-ramp an ungated runner would get. 178 of 212 gated plans untouched, **0 breaches, 0 worse than ungated**; sweep baseline 2→0. Three threshold levers measured and dead first (breaches sit at headroom 0.60 *and* 1.25 — no proxy separates them). Its runner-facing half shipped the same day and **caught a live overclaim §98 had just introduced**: `levelFitNote` claimed "quality starts earlier than a novice plan" for a runner trimmed back to the ungated bound. No invariant catches a true-sounding string. **Then CAT-ROW-ELIGIBILITY-01 + §99**: the selector could not say *"this row needs a pace this runner has"*, which had blocked a board-ruled migration since 2026-09-03. Gate built and applied to all three row-picking paths; the migration exposed that `hm_pace_intervals` had been stating **45 minutes for a session needing 57** (~71 with warm-up/cool-down) **since R23** — invisible because the v1 row had no structure to check against. *The migration gave the codebase eyes; it did not cause the bug.* Dose untouched throughout. Closes SC-10's flat-share surface. **Three separate "looks applied, does nothing" traps** en route, incl. two resolvers for one question shipping 859 sessions with no pace at all. Day's end: 1124 tests / 135 files, 90 invariants, matrix green, sweep 16,038 plans / 0 hard failures / 0 violations, `next build` clean, `main` pushed at `35438c8`. **One board-scoped item remains open from the morning: FOUNDATION-CHOICE-RESIZE-01 (P3, ruled CORRECT AS IS, real remedy is an ADR-020 change).**)

**Previously (2026-09-09):** (**Plan-engine correctness + verification-hardening day.** Shipped, all → feature-registry: **INTENSITY-3DAY-01** (P1, live — a 3-day `experienced` runner shipped 27.3% quality vs §1's 25% ceiling; cause was §89 early-onset, NOT §79 as filed — found by *diffing two plans*, not reading code; short on-ramp now denominator-scoped); **INTENSITY-FOUNDATION-BLIND-01** (the §1 check read the *bare* pre-foundation plan → false positive in prod / throw in dev-test on plans that ship clean; now measures the delivered plan); **CB-INTENSITY-50K-01** (§1's pre-registered "a 50K build breach reopens it" fired — 50K ceiling 15→17 via the 100K precedent, §1 yields to §8 at ultra distances); **NOISE-GATE-01** (warn invariants were counted by nothing — now firing-rate-gated in the sweep, found 2 unmeasured ~23% warns); **INERT-INPUTS-01** fully closed (`zone2_ceiling` deleted; **`terrain`** — a paid step promising "affects pace targets" that read nothing — wired via **CB-TERRAIN-01**, which *vetoed* a trail pace multiplier on §40b and wired an effort-lead note instead + re-copied the subtitle). Recurring lesson across all of them: *a document is not evidence about code, and my first mechanical instinct kept contradicting an existing principle* — read doctrine before coding. **VERIF trio completed** — **DOC-CLAIM-01** shipped too (a `**Engine copy:**` marker convention + `docClaims.test.ts` verifies every marked emitted-string claim exists verbatim in `lib/`; opt-in with zero false positives because a naive scan of the doc's 56 quotes couldn't separate emitted cues from hypothetical speech, paraphrase, and historical drift-descriptions). **Then a governance + visibility arc, all closed:** **HSR-INERT-01** (`love` gate already board-ruled CORRECT — shipped the brand honesty note `hard_pref_note`, no re-litigation); **CAT-DEPTH-01 Phase 2** — the paid-proposition item — routed to the Coaching Board, which **VETOED the rep-length lever a 4th time** (doctrine-blocked, SC-08/EG-01/§53), then to the SLT, which ruled the differentiation *coaching-sufficient* and **pivoted to visibility**; that pivot shipped as **PLAN-NOTE-SURFACE-01** — a "Why this plan" surface that renders the whole family of honest plan-level notes (the missing render path that made terrain, love AND the CAT-DEPTH pivot resolve to "stamped but invisible"), single-owner `planRationaleNotes()`, also fed to the AI enricher for voice consistency. The afternoon's lesson: *both governance boards did real work by being institutional memory — a veto/ruling from prior sittings is invisible unless you read it*; twice they stopped a wrong build. End-of-day audit: every item touched today ✅, 1070 tests, sweep 0 violations, matrix 65/0, invariants 88/88, tsc clean. One open residual: PLAN-NOTE-SURFACE-01 not yet visually smoke-tested behind auth.)
**Prior update:** 2026-09-02 (**Plan-engine correctness day — W1d follow-ups closed and the verification blind spot behind them.** Shipped: doc pipeline caught up (HR-MAX-01 + §79 Phases 1–3 → registry); **§79-PEAKKM** — a self-declared fitness level could raise *starting* tonnage via `peakKm` → the week-1 volume floor, now binds asymmetrically (upward = intensity only, downward = both); **§79-INTENSITY-ROUTING**; **§53** variety cap made satisfiable (`max(fraction, pigeonhole)`, D-21); **§52 closed entirely** — lopsided low-volume weeks now take §52's own third remedy and classify `maintenance`, taking `INV-PLAN-LR-MAX-WEEKLY-PCT` **59 → 0** including 35 that pre-dated the day. **Root cause of the two defects shipped and fixed mid-day: verification that could not reach the changed code.** The property sweep set `fitness_level` on all 17,957 plans and never set `training_age`, so the engine's assessment path was unreachable and "byte-identical, no new violations" meant *no coverage*. Sweep widened (18,060 plans) and the archetype matrix given the same treatment (SWEEP-COVERAGE-02, 14/14) — both falsification-tested. Two §52 hypotheses were disproven by measurement and abandoned before shipping. 760 tests, 0 sweep violations.)
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

## 🔴 NOW — CRITICAL PATH: Make-A-Wish handover (SLT-sequenced 2026-09-11)

> **The hard date.** The founder demos the site AND the app to Make-A-Wish within
> ~2 weeks, then charity codes go to their runners. Audience: **beginners at 10K,
> half marathon and marathon.** Standard: SLC — nothing ships with a known bug.
>
> **Traynor's framing, which sets the whole order: the demo is not the product and
> the codes are not the product. The product is week one for a runner who got a
> code.** So the path is everything between the email and a plan on screen.
> Nothing else is on it.

> **STATUS 2026-09-11, end of day: every item on this path is shipped, and the
> one founder-owned setting is wired.**
> The Supabase *Reset Password* template (UX-AUTH-03, item 5) was set by the
> founder on 2026-09-11. **The last thing outstanding is a device test of it**,
> which he holds: sign out on the iPhone, Forgot password?, open the email in
> Mail. A URL carrying `token_hash=` and a "Set a new password" screen means it
> took; a `?code=` URL and "This link cannot finish here" means the template did
> not save. `docs/runbooks/password-reset.md` has the procedure. Nothing in the
> repo can verify it — the template body is exposed neither to the service-role
> key nor to the Management API tools available here.

| # | Item | Owner | Effort | Why it is on the path |
|---|------|-------|--------|----------------------|
| ~~0~~ | ~~Redeem ONE code end-to-end~~ | founder | — | ✅ **DONE 2026-09-11 14:21.** Verified in production: 3 minted, **1 redeemed**, grant runs to 2026-12-10. The mechanism works end to end. **This is also how the ten UX observations below were found** — the founder redeemed a code and walked the flow. Closed; stop listing it as the blocker. |
| ~~1~~ | ~~**UX-BEGINNER-01**~~ | me | S | ✅ **DONE 2026-09-11.** A beginner types the honest answer (0 — never run) and is refused with a database field name. Wood: *"the first thing you asked them to be honest about, you punished."* |
| ~~2~~ | ~~**MAINT-LABEL-01 (copy half only)**~~ | me | S | ✅ **COPY HALF DONE 2026-09-11.** The `volume_profile` VALUE still needs a Coaching Board sitting and is NOT on this path. **89% of beginner marathon plans are labelled "maintenance"** — "maintains current fitness rather than building it" — to the exact cohort going 5km/week → 26.2 miles. Copy ships now; the `volume_profile` VALUE is load-bearing (confidence score, §38 notes) and needs a Coaching Board sitting. |
| ~~3~~ | ~~**UX-REDEEM-01**~~ | me | XS | ✅ **DONE 2026-09-11.** The last screen between a Make-A-Wish runner and their free access, and it asks for work the parser does not require. |
| ~~4~~ | ~~**BUG-KIT-DECIMALS-01**~~ | me | S | ✅ **DONE 2026-09-11.** Measured at **50.4% of prescribed session distances** disagreeing between prompt and card. `promptDistanceFormatters()` now owns the split; the raw-precision path survives only where both sides of a planned-vs-actual comparison need matching precision. |
| ~~5~~ | ~~**UX-AUTH-01**~~ + **UX-AUTH-03** | me + **founder** | S + XS | ✅ **UX-AUTH-01 DONE 2026-09-11** — the four `/privacy` and `/terms` links now go through `ExternalLink`, which opens native in SFSafariViewController; the other two candidate causes were read in the code and are not live. 🟡 **UX-AUTH-03 code half done; template WIRED by the founder 2026-09-11, device test still owed.** Until it was set, password reset could **never** succeed on iOS (the request is made in the Capacitor webview, the email opens in Safari, PKCE needs the same browser). The failure now names the real cause instead of claiming the link is invalid, so a bad template shows as *"This link cannot finish here"* rather than silence. |
| ~~6~~ | ~~**UX-AUTH-02**~~ | me | S | ✅ **DONE 2026-09-11.** The email form is now disclosed rather than displayed: Apple, Google, "Use email instead". Also fixed on the way through — a first-time runner typing their real email on the Sign in tab got GoTrue's "Invalid login credentials" verbatim, which never mentions that the account does not exist yet. |

### 🚫 Explicitly NOT before the demo — do not pick these up opportunistically

| Item | Why not |
|---|---|
| **UX-COACH-01** (Coach screen redesign) | Fried: *"a half-redesigned Coach screen is worse than a busy one."* Wood exercised the kill mandate: the progress dashboard is the founder describing himself, and he is not this cohort. **Recorded as a real disagreement with the founder, not synthesised away.** |
| **UX-POSTRUN-01** (four numbers → one) | Hutchinson: *"collapsing zone %, RPE and fatigue into one score is a claim that those three trade off in a known ratio. They do not."* Needs a Coaching Board sitting that will not happen in a fortnight. |
| **UX-WIZARD-01** (per-day time budgets) | Board-ruled BUILD, but it **moves peak volume by construction**. Not in the same fortnight as a launch. |
| ~~**UX-PLAN-MOVE-01**~~ | ✅ **DONE 2026-09-11.** **The premise of this row was wrong and I wrote it:** the handle did NOT cause the incident. RESHAPE-FIX-WAVE2C shipped three things and the safety is the other two (a staged move plus a confirmation row), so an accidental tap has cost nothing since June. Shipped quiet, and fixed a label-clipping defect found on the same row. |
| ~~**MAINT-LABEL-01 (the `volume_profile` value)**~~ | ✅ **BOARD SAT 2026-09-11 → §106.** **"Feeds the paid confidence score" was wrong** — nothing in any confidence path reads it. The board withdrew three of four filed findings at the conflict scan and ruled on the one that was real: the peak ceiling is volume-blind. |
| CAT-DEPTH-01 · marathon race-specific residual · SEC-08's last route · GTM-SITE-03 | None are between the email and a plan on screen. |

### The beginner gap, stated plainly

`brand.md` defines the audience as **"adult runners, 1+ years' experience"**. This
cohort is not that, and the product shows it in two places: the wizard refuses an
honest zero, and 89% of beginner marathon plans carry a label that reads as *you
will not improve*. **Both are fixable in copy and validation without touching the
engine** — which is why they are on the path and the Coach screen is not.
Whether the stated ICP widens is GTM-CHARITY-02's question, not a pre-demo one.

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
| **Free SEO plan pages** (GTM-SEO-PLANS-01) | ✅ Waves 1&2 · 🔲 Wave 3 | M | **Waves 1&2 shipped 2026-09-06 (`d6b8e68`).** 9 free plan pages + `/plans` hub — the engine's FREE plans rendered as crawlable HTML, unmistakably Zonna, soft email→trial CTA (reuses waitlist). By-distance (5K/10K/Half·12wk, Marathon·16wk) + by-goal-time (Sub-25 5K, Sub-50/45 10K, Sub-2 Half, Sub-4 Marathon). Full SEO template (FAQ + Breadcrumb JSON-LD, keyword titles/H1, sitemap, internal links). SLT-reviewed "build differently". **Op gate on Russ: ✅ DONE 2026-09-11** — sitemap submitted to Search Console. **Wave 3 deliberately parked pending data**, not blocked: Traynor's binding SLT call was "track email→trial→paid, kill in ~90 days if trial rate is ~0", and the 9 live pages have produced no conversion data yet (shipped 09-06, indexing started 09-11). Revisit once they have indexed and a trial number exists — est. early-mid Oct 2026. Building 8 more pages first would double an unmeasured bet. **Wave 3 (Later):** beginner/8-week/more goal times — see backlog + feature-registry. |
| **Competitor comparison pages** (GTM-SEO-COMPARE-01) | ✅ Page 1 · 🔄 Pages 2–8 (**founder, 1/week**) | M | **Page 1 shipped 2026-09-10.** **Cadence decided 2026-09-10: founder-authored, one page per week** — the template is done, the writing is the bottleneck and it is deliberately drip-fed, not batched. Hub reaches its 3-article external-linking gate ~2026-09-24. Page 1 is `/runna-alternatives` + the `/comparisons` hub. Built as a TEMPLATE: copy-as-data (`lib/marketing/comparisons.ts`), shared renderer (`ComparisonPage.tsx`), route file is a 4-line shim, so **pages 2–8 are one catalogue entry + one shim each** and self-register in the hub, sitemap and tests. Article JSON-LD via a reusable helper; `dateModified` reads the same field as the visible "Last updated" line so they cannot drift. House rules: no em dashes in copy, brand name always interpolated, no blog tooling (no avatar/tags/reading-time/related-posts/share). → feature-registry. |
| **Site chrome + IA standardisation** (GTM-SITE-01) | ✅ | M | **Shipped 2026-09-10.** Full-site review (SLT + frontend-design). Replaced 5 hand-written headers and 4 footers, and 3 pages that had NEITHER: the wordmark rendered 20px → 32px → 20px as you navigated, the homepage wordmark was not a link, and `/support`, `/privacy`, `/terms` were dead ends. Now one `SiteHeader`/`SiteFooter` at a constant `SITE_WIDTH`, two-item nav (Plans · Comparisons), one moss CTA, sticky. `/compare` → `/comparisons` (308). Homepage content-accuracy fixes ("four answers" vs a ~15-question wizard; "or you walk" vs the graceful downgrade the monetisation doc actually promises). Canonical host corrected apex → www. DIV-021 + DIV-022 closed. Pattern documented as `ui-patterns.md` § 6b. → feature-registry. |
| **Charity access codes** (GTM-CHARITY-04) | ✅ shipped · ⚠️ unverified end-to-end | M | **SLT-approved 2026-09-11.** The mechanism that actually delivers "we give the app away free" to a partner's runners. **Grants full PAID access, not the free tier** — the free tier cannot generate a marathon plan at all, and every injury-protective feature (reshaping, run analysis) is paid, which is the wrong thing to withhold from the highest injury-risk cohort we serve. Unique single-use codes, capped per partner; **the charity decides who gets one, so we never verify anything.** Window is **race date + 7 days** (founder call) with a 90-day default before a plan exists, extend-only, 18-month ceiling. Writes a `subscriptions` row with `provider: 'charity_grant'` so tier logic and all ten gated routes are untouched. **Explicitly NOT building:** a charity table/API/picker, or a wizard question (CI-3 precedent). Full spec in backlog. **Blocks the charity page's copy** — `/charity-runners` currently states the honest paid split and cannot mention free access until this ships. |
| **Site: pricing, about, hero, mobile, real product visuals** (GTM-SITE-02) | ✅ Shipped | M | **SLT-reviewed 2026-09-11** after the founder flagged a competitor he liked. The board's ruling was the useful output: **calm is an asset, austere is a liability, and the site was austere** — fix with craft and evidence, never volume. Shipped: **`/pricing`** (did not exist; the SLT called that a commercial defect, since a charity partner could not evaluate the offer), **`/about`** (ranked above the visual work for charity due diligence; photo still outstanding), **product above the fold** on a two-column left-aligned hero, a **moss accent second line** on section titles, and the homepage's mock coach note recoloured to amber because CLAUDE.md reserves it for coaching. Also fixed a measured bug where **every marketing page scrolled sideways on a phone** (433px document at a 375px viewport); now verified across 33 page × width combinations. **Item 3 shipped 2026-09-11:** the homepage now renders the REAL `SessionCard`, `CoachNoteBlock` and `ZoneRings` instead of three hand-written CSS imitations. The obstacle this item was parked on turned out not to exist: the backlog said those components are `'use client'` with handlers and would need shared wrappers, and none of them carries the directive or requires a handler, so a server page mounts them directly. Doing it immediately exposed a live drift in the hand-built `PhoneFrame` (`8 km` against `formatDistance()`'s `8km`), which is the argument for one definition rather than two. **Do not copy from the competitor:** gradients, neon, scroll animation, rotating badges, invented social proof. **Change no tokens** (the app shares globals.css). |
| **Charity-runner landing page** (GTM-CHARITY-01) | ✅ | S | **Shipped 2026-09-11.** `/charity-runners`, for the product's **first real referral channel**. **Re-scoped the same day from marathon-only to all distances** (founder: charity places are mostly 10K and half, with marathons and the odd ultra), and its content column corrected 1100 → 760 to match every other page; old slug 308s. SLT-ruled: do not bend the homepage toward a non-ICP audience, give them their own page. Leads with injury risk and reaching the start line, not speed. **Names no charity and claims no endorsement** — co-branding is a founder/legal decision made with the partner. Honest up front about the split: 5K/10K/Half build on the free tier, Marathon and ultra generation is trial/paid (`free_tier_available: false`), and there is no free static ultra plan at all. Sitemap 0.8, FAQ + Breadcrumb JSON-LD, linked from `/plans`; deliberately NOT in the two-item nav. → feature-registry. **Open follow-up:** the partner may want co-branding, and the brand's stated audience ("1+ years' experience") does not cover these runners — worth a positioning decision. |
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
| ~~**RAMP-BOUNCEBACK-01**~~ ✅ shipped 2026-09-06 | FREE | S | Done — knee/shin bounceback bounded by the §12 cap (removed the `Math.max` override that shipped +26–43% weeks to injured tissue); healthy stays unbounded (measured). Feature-registry + §2 amendment. |
| ~~**CB-PHASE-01 re-take** — base 35→30~~ ❌ superseded 2026-09-06 | FREE | XS | **Superseded by §89 experience-gated onset** (ADR-021). A global base shortener harms beginners who need the on-ramp; §89 instead gates a shorter base on *demonstrated* readiness (per-runner, injury-vetoed). The global 35→30 stays reverted; do not re-propose. |
| **CAT-DEPTH-01 Phase 2** — make the wizard's answers bite | FREE | M | Inventory shipped (§85/§86); threshold sessions still don't differentiate by declaration. Lever is finer rep granularity, **not** `rep_length` scaling (blocked by SC-08) and **not** more rows. |
| ~~**ONSET-INTENSITY-YIELD-01**~~ ✅ shipped 2026-09-10 as **§98 / CB-ONSET-YIELD-01** | FREE | M | Done — §89's early onset now yields to §1 via a bounded ladder. **The filing named the wrong cause**: it blamed §91's foundation credit; measured, §89 breaches §1 on its own (29 breaches gate-open / 0 gate-closed; 11 of 29 had no block at all) and a credit-aimed fix took 34→31. §97's two gates were inert (they set the cap; the credit subtracts from it). 178 of 212 gated plans untouched, 0 breaches, 0 worse than ungated. Sweep baseline 2→0. → feature-registry. Runner-facing note (**ONSET-YIELD-NOTE-01**) shipped the same day — and caught a live overclaim §98 had just introduced in `levelFitNote`. **Nothing outstanding.** |
| **FOUNDATION-CHOICE-RESIZE-01** — onset differs by when the runner answered a modal | FREE | M | Same delivered block, quality week 1 vs week 2, purely on decision timing. Board ruled the conservative default **CORRECT AS IS** (Willy: never size base against a decision not yet made). Real remedy re-sizes when the answer lands — an **ADR-020 change**, since the foundation route deliberately does not re-run generation. |
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
