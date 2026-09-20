# The backlog, by category

> ⚠️ **SUPERSEDED IN PART, 2026-09-20 (later the same day).** Nine items shipped after this was
> written. Current state and what moved: see the ⚖️ RULED block in `docs/releases/backlog.md` and
> the feature registry. **Shipped since:** `MARA-LR-LOWBASE-01` (§80 Am.2) · `REFRAME-NOTE-LOSS-01`
> · `P-13a/b` · `P-03` · `P-01` · `ENRICH-PII-MINIMISE-01` · `LEGAL-PRIVACY-01` ·
> `CONSENT-DISCLOSURE-01`. **Closed as no-action:** `BRAND-MAINT-LABEL-01` (stale entry),
> `P-07` (SLT: don't build). **73 open → 64.**

**Date:** 2026-09-20 · **Source:** `docs/releases/backlog.md`, cross-checked against
`docs/canonical/feature-registry.md`

**73 open items.** Derived mechanically: every ID declared with an open marker, then
each checked for a feature-registry row. ⚠️ **18 items that read as open by their marker
are actually SHIPPED** — they appear in prose as cross-references, in 🔴 sentences, inside
other items' bodies. A marker-only parse would have over-counted by a quarter.

> `PLAN-WEEK-COLLISION-01` · `CB-HILL-INJURY-01` · `MARATHON-VOLUME-GATE-01` ·
> `LONGEST-RUN-GATE-01` · `FOUNDATION-DECIDE-LATER-01` · `FOUNDATION-ADD-FAIL-01` ·
> `ONBOARD-SKIP-LABEL-01` · `REFUSAL-SCREEN-01` · `WIZARD-TIME-CHIPS-01` ·
> `MAINT-LIVENESS-01` · `INV-MSG-ROUNDING-01` · `STEPBACK-STALE-PEAK-01` ·
> `GRID-MARATHON-CAPABLE-01` · `GRID-COVERAGE-02` · `MAINT-EXEMPT-SCOPE-01` ·
> `RACE-PACE-OVERLAY-REACH-01` · `S9-DURATION-FLOOR-01` · `GTM-SEO-COMPARE-01` (page 1)

---

## On the categories

You proposed **coaching engine · user experience · user interface**. Those are the right
three to start from and they cover **28 of 73**. Seven more are needed, and each earns its
place because the work, the owner and the decision-maker all differ:

| Category | Why it is not one of your three |
|---|---|
| **Engine governance & verification** | Not prescription — it is the harness that proves prescription. Different skill, no board, and it is **a fifth of the engine work**. Folding it into "coaching engine" hides that. |
| **Brand, voice & copy** | Every item needs **your** sign-off (§4A). UX and UI items mostly do not. |
| **Commercial & monetisation** | SLT-owned. Tier, price, paywall, trial honesty. |
| **GTM & charity launch** | **October-dated.** A deadline is a category. |
| **Legal, privacy & data** | Founder + counsel. Not ours to decide. |
| **Infrastructure & ops** | Mostly **founder actions on external accounts** — no code at all. |
| **Live defects** | Runners are hitting these now. Everything else is potential. |

**UX vs UI, kept separate deliberately.** UX is what happens; UI is what it looks like.
They have different reviewers and different failure modes — a beautiful screen in the
wrong flow position fails at UX, not UI.

---

## 🏃 Coaching engine — prescription · **16 items**

*What the plan actually tells a runner to do. Coaching Board owns correctness.*

| Item | State | Note |
|---|---|---|
| **P-16** base-build on-ramp | 🟢 **Board: CORRECT as a shape.** SLT: **build, not for October** | 6 binding amendments. §111 names this remedy and §57 makes it impossible |
| **P-17** RED-S / energy availability | 🔴 **Filed as a SAFETY item** | The one third of the "Sims pattern" that is real. Data question first |
| `S111-SUBFLOOR-VOLUME-01` | 🔴 P0, INSUFFICIENT EVIDENCE, escalated | **Now answered by P-16.** The door is exactly 12 km/wk |
| `LR-CONSEC-01` | 🔲 P1 | §45 cannot see compounding; closing it collides with §38 and §47 |
| `S52-LOPSIDED-BOUND-01` | 🔴 reopened | **Failed twice. Standing instruction: do not add a third per-week bound** |
| `LOPSIDED-ORDER-01` | 🔴 | §52's third remedy evaluates in the wrong order |
| `S24-FLOOR-REACHABILITY-01` | 🔲 P2 | §24's marathon floor is unreachable for most runners |
| `MARA-LR-LOWBASE-01` | 🔲 P1 | |
| `ULTRA-LR-ADEQUACY-01` | 🔲 | |
| `COHERENCE-SELECT-01` | ⛔ build attempt 5 | Attempt-4 diagnosis disproved; a measured no-op |
| `LR-DELOAD-RESUME-01` | 🔴 **record of what NOT to retry** | Board-approved, built, **reverted as unsafe** — sent a beginner 7.3 → 18.5 km |
| `S112-HAZARD-01` | ⏸️ P3 | Unmeasurable today — §112 has never fired |
| `INPUT-SEX-01` | 🔲 P2, **founder-parked** | **An honest null** — no formula we hold reads it |
| `ZONE-BAND-01` | ⏸️ blocked on data | Re-open trigger: ≥20 users × ≥10 HR-bearing analyses |
| `R26` background load | 🔲 W5 | ⚠️ P-05c's cross-training veto touched this — declared data beats step-count inference |
| `R27` / ENGINE-03 cycle | ⛔ **blocked** | No menstrual type in `@capgo/capacitor-health`. **Contested science *and* missing data** |

🔴 **The category's headline:** §111 names a base-building plan as its remedy and §57
makes it structurally impossible. Measured — an 8 km/wk runner reaches 18 in 11 weeks and
the acute step into week 1 goes **+50% → 0%**.

---

## 🔬 Engine governance & verification · **6 items**

*Proving the engine does what the constitution says. No board; this is mine.*

| Item | State | Note |
|---|---|---|
| `SWEEP-AGE-01` | 🔴 | Sweep pins `age: 35`, so `MASTERS_AGE_THRESHOLD` (45) is never crossed |
| `SWEEP-INJURY-01` | 🔲 | `'Plantar fasciitis'` still unswept |
| `GRID-EARLY-ONSET-01` | 🔲 | |
| `RUBRIC-GAPS-01` | 🔲 | The fit-for-purpose rubric's own blind spots |
| `RACE-KEY-TWO-OWNERS-01` | 🟡 P3, **founder decision** | Two `raceDistanceKey` functions, different bucket boundaries |
| `FLEET-INVALID-DEBT-02` | 🔲 P3 | Opt-in refresh for a real runner on an invalid plan |

⚠️ **This category is where green ticks have hidden holes before** — a sweep that generated
zero plans, a grid that could not express the cohort it measured. It is not optional work.

---

## 🧭 UX & flows · **18 items**

*What happens, in what order. SLT owns build/don't-build; no coaching board unless prescription changes.*

| Item | State | Note |
|---|---|---|
| **P-02** modify-plan sheet | 🔲 **L — biggest build in the set** | ⚠️ Ships **without** the intensity row (vetoed). Supersedes `R22`, absorbs parts of `R21`/`R20` |
| **P-15** the refusal gains an action | 🔴 **October deliverable** | No engine change, no board. Today we refuse and offer nothing |
| **P-05** onboarding (3 surviving parts) | 🔲 | (a) plan-length on tiles ✅ unblocked · (b) nameless-runner fallback · (c) cross-training ❌ **vetoed** |
| **P-06** plan reveal sequence | 🔲 | Card stack + annotations. Updates `FIRSTRUN-MOMENTS-01` |
| **P-08** code entry | 🔲 **split** | (a) placement conflict with `GTM-CHARITY-08` is P1 · (b) referral codes P3 |
| **P-10** cold-start sweep | 🔲 | Dead code to delete + the **web-user connect gap** |
| **P-12** profile plan card | 🔲 | State what you have before what you don't |
| **P-14** review prompt | 🔲 | We have **neither** half. (a) is one row |
| `FIRSTRUN-MARATHON-01` | 🔴 sat 2026-09-18 | The first-time marathoner is the product |
| `PLAN-NOTE-PLACEMENT-01` | 🔲 P2 | Does the rationale belong at the top of Plan? **The teardown independently agreed it might not** |
| `PLAN-CONCURRENCY-01` | 🔲 P3, founder-parked | Plans are archive-and-overwrite |
| `POSTRUN-PLAN-FEEDBACK-01` | 🔲 parked | SLT: "don't build; decide, then audit, then say it" |
| `POST-RUN-03` | 🔲 W4 | Rich-media zone preview on the push |
| `POST-RUN-REFRAME-02` | 🔲 W3 | Voice memo input |
| `AI-DEPTH-09` | 🔲 deferred indefinitely | Coach chat |
| `R21` strength sessions | 🔲 | ⚠️ **Three entries describe parts of one feature** — this, P-02's row, and "Supplementary session slots" |
| `R22` blockout days | 🔲 → **superseded by P-02** | And its **PAID tag is overturned** — accuracy is free |
| `R24` multi-race | 🔲 L | Additive `meta.races[]` |

---

## 🎨 UI & design system · **5 items**

| Item | State | Note |
|---|---|---|
| **P-01** semantic colour | ✅ **SLT: BUILD, resolution A, before October** | ⚠️ Threshold is ratified (`ZONE_DRIFT_ABOVE_CEILING_PCT = 20`) — **no new board sitting needed** |
| **P-03** pace ceiling | 🔲 **XS — cheapest real win** | ✅ **Proven display-only**: 656 sessions transformed, **0 non-easy altered** |
| **P-04** zone-compliance block | 🔲 **highest differentiation** | Needs P-01. ⚠️ Its **PAID tier is flagged for your confirmation** |
| **P-13** depth + gate + illustration | ✅ **SLT: SPLIT** | (a)+(b) engineering; (c) one piece, after P-01 |
| **P-11** launch screen | 🔲 P3 | Gated on footage licensing |

🔴 **A BANNED COLOUR IS LIVE IN THE PRODUCT.** `GeneratingCeremony.tsx:265` renders
`rgba(91,192,190, 0.14)` = **`#5BC0BE`**, the retired teal, in the shimmer every runner
sees. The pre-commit hook blocks the **hex** form and has no rgba rule, so it walked
straight past. **That is P-13(b)'s evidence, and it moves it from hygiene to a
demonstrated guard failure.** 17 of the 26 rgba instances are the palette at alpha; 6 are
legitimate scrims.

---

## ✍️ Brand, voice & copy · **3 items**

*Every one needs your sign-off.*

| Item | State | Note |
|---|---|---|
| **Copy patterns** (7) | ✅ **SLT: approve at pattern level** | ⚠️ **The zero case needs your words** — must carry a cause or an action, never a bare count |
| **P-07** coach register | 🔴 **DON'T BUILD** | Wood's kill mandate. **Paid DHTB register ruled out permanently** |
| `R19` coaching tips → Supabase | 🔲 **STAYS PARKED** | ⚠️ I claimed P-07 unblocked it. **It does not, because P-07 is not being built** |
| `BRAND-MAINT-LABEL-01` | 🟡 P2 | 4 of 5 marathon charity personas read `maintenance` |

---

## 💰 Commercial & monetisation · **6 items**

| Item | State | Note |
|---|---|---|
| **P-09** paywall + exit offer | 🔲 **BLOCKED** | ⚠️ Blocked on `TIER-TRIAL-CONFIDENCE-01`. Our annual is **£1.15/wk vs their £1.54** — cheaper already |
| `TIER-TRIAL-CONFIDENCE-01` | 🔲 P2 → **now blocking** | The 14-day trial is **not literally full access** |
| `GTM-FREE-HOOK-01` | 🔲 P2 | The free tier's only AI touchpoint is unreachable by those meant to convert |
| `TT-PRICING-CLAIM-01` | 🔲 P2 | `/pricing` sells a projection absent on **58%** of plans |
| `TT-FREE-BENCHMARK-01` | 🔲 P2 | A free runner is prescribed a benchmark they cannot apply |
| `FIN-APPLE-COMMISSION-01` | 🔲 P2 | Apple's cut modelled nowhere — every unit-economics number is 15% optimistic |

⚠️ **A live tension across this category and UI:** P-04 being PAID means **the free tier
states the thesis and never scores it.** The SLT reads scoring as richness; it is close
enough to *"gate richness, never access"* that you should confirm rather than inherit it.

---

## 📣 GTM & charity launch · **5 items — October-dated**

| Item | State | Note |
|---|---|---|
| `GTM-CHARITY-08` | 🔲 P1 | Mint + field-test 500 codes. ⚠️ **Conflicts with P-08's placement proposal** |
| `GTM-CHARITY-05` | 🔲 P1 | `admin_user_tiers` cannot see grants — 500 comped runners read as free |
| `GTM-CHARITY-06` | 🔲 P1 | No per-partner reporting; **one** analytics event exists |
| `GTM-CHARITY-07` | 🔲 P2 | Account deletion returns a claimed code to the pool |
| `GTM-CHARITY-09` | ⏸️ **founder-parked** | Partner FAQ |

---

## ⚖️ Legal, privacy & data · **5 items**

| Item | State | Note |
|---|---|---|
| `LEGAL-COUNSEL-01` | 🔴 P1 **FOUNDER** | Two hours before October. **The SLT stated it could not rule on this** |
| `LEGAL-PRIVACY-01` | 🔴 P1 | Policy understates what goes to Anthropic; omits Resend. **Blocking of the three** |
| `ENRICH-PII-MINIMISE-01` | 🟡 P1 | Stop sending the name. ⚠️ **Sequence BEFORE the policy rewrite** |
| `CONSENT-DISCLOSURE-01` | 🟡 P1 | One line at Health-connect, **not** a consent screen |
| `SIGNOUT-TOKEN-RESIDUAL-01` | ⏸️ P3 accepted | No action |

---

## 🔧 Infrastructure & ops · **7 items — mostly founder actions, no code**

| Item | State | Note |
|---|---|---|
| `OPS-VERCEL-PLAN-01` | 🔴 **P0 BLOCKER** | Hobby is non-commercial and we sell a subscription — **already out of compliance** |
| `OPS-SUPABASE-PLAN-01` | 🔴 **P0 BLOCKER** | Breaks at ~250–320 runners; **no backups at all** |
| `OPS-ANTHROPIC-CREDIT-01` | 🔲 P1 | At zero balance every AI surface silently degrades for all 500 at once |
| `OPS-AI-SPEND-01` | 🔲 P2 | No call site reads `response.usage` |
| `OPS-AI-FAILURE-ALERT-01` | 🔲 P2 | Eleven of twelve AI routes fail silently to the operator too |
| `DEPLOY-QUOTA-01` | 🔴 founder | 100 deploys/day, **hit** |
| `STRAVA-APP-INACTIVE-01` | 🔲 external | Founder action at Strava |

---

## 🐛 Live defects · **1 item**

| Item | State | Note |
|---|---|---|
| `REFRAME-NOTE-LOSS-01` | 🔴 **P1** | **A runner writes a reflection, the AI call fails, and their words are thrown away.** The only item here where a real user loses something they created |

---

## What the categories say when you stand back

**Three numbers worth noticing.**

1. **Two P0 blockers are infrastructure, not product** — Vercel and Supabase. Neither is a
   line of code. Both are compliance or capacity failures that arrive with the cohort.
2. **Legal + GTM + Ops = 17 of 73 and almost all of it is October-dated and founder-owned.**
   The teardown added 17 proposals to a backlog whose nearest deadline is untouched by any
   of them.
3. **Engine + governance = 22 of 73**, and the single most consequential item in the whole
   backlog (P-16) **cannot be measured until it is built.**

**One thing the categorisation makes visible that the flat list did not:** ⚠️ **`R21`,
P-02's strength row, and "Supplementary session slots" are three descriptions of one
feature**, filed at three different times, and they sit in the same category. That is how
`CA-08` once looked like it had dropped out.
