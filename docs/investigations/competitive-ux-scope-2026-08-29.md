# Competitive UX — Scope & Board Brief

**Date:** 2026-08-29 · **Status:** living scoping doc (grows as more competitor analysis arrives)
**Backs:** SLT ruling `docs/decisions/slt-2026-08-29-planzy-ux.md` + backlog "Competitive UX — Planzy/Runzy set"
**Purpose:** give the SLT / Coaching Board a **complete engineering + product picture** of each competitive-inspired item before they rule — so decisions are made against real current-state facts, not screenshots.

**How to use this doc:** each item has *current state → the gap → the decision the board must make → scope (UI / engine / data) → effort → risks → tier → board routing*. New items (incoming screenshots, Runzy) get appended in the same shape under "§ Incoming".

---

## Summary table

| Item | SLT verdict | Real scope | Coaching Board? | Effort |
|---|---|---|---|---|
| **UX-WIZARD-01** per-day time sliders | Build (FREE) | **Bigger than it looks** — the *compelling* version is an engine change | **Yes** (for the version worth building) | **M–L** |
| **UX-ZONES-01** 5-zone pace reference | Build light (FREE) | Extend Profile `HRZonesSection` + add paces | No | **S** |
| **UX-SESSION-GLYPH-01** shape glyph | Build small (FREE) | Extend `PlanCalendar` DayRow; classifier off catalogue row | No | **S** |
| **UX-WIZARD-CHATBOT** Runzy chatbot | Rejected | — | — | — |
| **UX-PROGRESS-01** projection graph | Don't build (exists) | — | Yes, *if ever* revisited | — |

---

## UX-WIZARD-01 — per-day time-allocation sliders

### Current state (confirmed)
The wizard collects scheduling as **two separate steps** (`GeneratePlanScreen.tsx`): a `schedule` step (a **day-count** button picker `[2..6] days` + a Sat/Sun long-run chip) and a `constraints` step (7 Mon–Sun "never train" chips + **one global** max-weekday-minutes chip, footnoted "Applies Mon–Fri only"). The `GeneratorInput` it produces (`types/plan.ts`):
- `days_available: number` — a **count**, not day identities.
- `days_cannot_train?: string[]` — the **only** day-identity signal (a blocked set).
- `preferred_long_run_day?: 'sat' | 'sun'` — **weekend only**.
- `max_weekday_mins?: number` — **one global cap** for all of Mon–Fri.

The engine (`ruleEngine.ts`) uses `days_available` purely as a **slot budget** and **chooses the actual days itself** from hardcoded preference lists (long: `sun/sat/fri`; quality: `wed/thu/tue`; etc.). It knows **how many** days and **which are forbidden** — never **which days you chose**. The single `max_weekday_mins` is applied as a **post-hoc trim** (shrink a session that exceeds the cap), never as the driver of sizing.

### The gap Planzy fills
Planzy asks "**how much time on each day?**" — a per-day *budget*. Sutherland's point (why the SLT liked it): a budget is answered honestly, where "how many days?" is answered aspirationally. **That behavioural value lives entirely in the per-day *magnitude*** (Tue=60, Sun=MAX), which the current contract **cannot represent**.

### ⚖️ THE DECISION THE BOARD MUST MAKE
This is the crux, and it wasn't visible at the SLT's first pass. There are three real options, and they trade the feature's *value* against its *cost*:

| Option | What the user gets | Scope | Coaching Board | Keeps the behavioural magic? |
|---|---|---|---|---|
| **0 — reskin only** | Prettier day-count picker; no per-day anything | UI-only, trivial | No | **No** — it's just a nicer version of today |
| **A — day *selection* sliders** (NONE / RUN / LONG per day, ignore magnitude) | Pick *which* days + which is the long run | UI-mostly, **but** needs `preferred_long_run_day` widened beyond Sat/Sun (long run can land on a chosen weekday) → small engine + placement change | **Light** (long-run placement changes) | **Partly** — you choose days, but not "how much time" |
| **B — true per-day *time* budget** (Planzy as-is) | "I have 60 min Tue, 90 Sun" and the plan respects it | **Engine change:** new `day_budgets` input; day-identity-aware placement; per-day cap that feeds **sizing** not just trimming; volume redistribution when days differ; new `validatePlan()` invariant | **Yes — required** (changes what lands on which day and how long) | **Yes** — this is the version the SLT actually praised |

**The tension to resolve:** the version the board *liked* (B) is the expensive one; the cheap ones (0/A) throw away the exact thing that made it compelling. Recommendation for the board: **decide whether the per-day time budget is worth an engine change + a Coaching Board review**, or whether a lighter day-selection UX (A) is enough. Don't build B on autopilot, and don't ship A thinking it delivers B's value.

### Scope if B is chosen
- **UI** (`GeneratePlanScreen.tsx`, trigger `frontend-design`): collapse `schedule` + `constraints` into one slider screen; update `WizardSubStep`, `getStepSequence`, `STEP_META`, state vars, `GeneratorInput` assembly, and the `zona_wizard_draft` write/read/deps (three parallel spots that must stay in lockstep). Per-distance day-threshold gating re-keys off the slider count. Legacy drafts degrade gracefully (restore guards already no-op on missing keys).
- **Types** (`types/plan.ts`): add `day_budgets?: Record<Day, number|'none'>`; widen `preferred_long_run_day` (or derive the long day from the MAX slider). Note the byte-exact replay field `generator_input` changes shape.
- **Engine** (`ruleEngine.ts`): day-identity-aware placement (4 hardcoded preference lists intersect the chosen days); per-day cap replaces the global one and feeds sizing; `daysAvailable`/volume derivation reworked for uneven day budgets. Check `inputs.ts` `validateDaysAvailable`.
- **Doctrine**: `generationConfig.ts` + `CoachingPrinciples.md` (§ life-first / §9 long-vs-easy) + a new `validatePlan()` invariant, **in one Coaching-Board commit**.

### Risks
Rebuilds part of the just-stabilised wizard (D6/D7/D10). Input-shape change ripples into `ruleEngine`, `foundationBlock`, the property sweep, and draft persistence. A per-day cap that isn't wired into **sizing** (only trimming) can silently break the long-vs-easy invariant on a low-budget day.

**Tier:** FREE. **Effort:** A = M, B = L.

---

## UX-ZONES-01 — 5-zone pace reference (polish)

### Current state (confirmed)
Three zone components exist, **none shows per-zone pace**: `ZoneBar` (active-zone strip, no pace/HR), `ZoneInfoSheet` (one zone at a time, HR band + copy, no pace), `ZoneRings` (retrospective time-in-zone %, PAID analytics). **The closest thing to a reference already exists:** the Profile **`HRZonesSection`** (`DashboardClient.tsx:10626`) lists all 5 zones with a badge, name, one-line desc and **HR range** — with a good intro ("Five zones. Most of your running stays in Zone 2…"). It is **missing paces**.

### The gap
One surface showing all 5 zones with **HR + pace together**. Today HR-only lives in Profile; pace lives only per-session; nothing unifies them.

### Scope
- **Extend `HRZonesSection`** (do not fork) — add a pace line/column per zone. Optionally add a `paceBand` prop to `ZoneInfoSheet`. Reuse `ZoneBar` for the arc.
- **Data:** HR from `calculateZones`; paces derivable client-side from `meta.vdot` / `vdot_training_anchor` via `buildPaceFromVDOT` (`ruleEngine.ts:125`), which already yields easy/tempo/interval pace strings. Easy pace also available via the existing `aerobicPace` prop.

### Risks (worth the board knowing — latent inconsistency)
- **Zone-band groupings disagree across three sources:** `ZONE_DEFS` (5 zones), `zoneRules.ts ZoneBand` (**4** keys — collapses Z4-5), `ZONE_COPY` (has both split and collapsed forms). Pick one and be consistent or the reference will contradict session cards.
- **No VDOT/benchmark → no paces:** a runner without a benchmark has HR zones but no pace bands — the pace column must degrade gracefully.
- **Zone→colour is duplicated in 3 places** (ZoneBar, ZoneRings, ZONE_DEFS) and borrows session-type tokens; there are no dedicated Z1–Z5 colour tokens. If the polish touches colour, note this.

**Tier:** FREE. **Effort:** S. **Board:** none (presentation only, 5 zones kept).

---

## UX-SESSION-GLYPH-01 — session-shape glyph (polish)

### Current state (confirmed)
Session rows render in the shared **`DayRow`** (`PlanCalendar.tsx:695`, used by Plan screen + calendar): a 3px left accent rail (`SESSION_COLORS[type]`), label, a type chip, and a metric line. A runner distinguishes intervals from steady only by **reading the label**.

### The critical scoping finding
**`derived_set` is the WRONG driver.** It's populated only for `version: 2` catalogue rows — **6 of 22 rows** — so it's blank for the majority of sessions. A glyph keyed on it would be empty for most, failing Hutchinson's "real structure, not a guess" condition by omission.

**The reliable driver:** `catalogueRowFor(session)?.main_set_structure.type` (`catalogueLink.ts:25` is the single owner of the session→row join). Every catalogue row (v1 and v2) carries `main_set_structure.type` ∈ {`continuous`, `repeats`, `fartlek`, `progression`} → `repeats`/`fartlek` = bar-chart glyph; `continuous`/`progression` = solid. **Fallback** for sessions with no row (legacy/inline): `session.type`/`session.stimulus` (`intervals|hard`, `vo2max|hills|strides` → bars; `easy|long|recovery` → solid). `tempo`/`quality` alone is ambiguous (continuous tempo vs cruise intervals) — only the row's `main_set_structure.type` disambiguates, so a rare row-less, stimulus-less session defaults to solid (acceptable).

### Scope
- **Extend `DayRow`** (do not fork) — one small glyph in the label flex row, reusing the existing `accent` colour.
- Add a tiny pure classifier `sessionShape(session): 'steady' | 'intervals'` (catalogue row first, `type`/`stimulus` fallback).
- If wanted on **Today + Session Detail** too, those are separate render paths in `DashboardClient` — each needs the glyph added (scope creep flag).

**Tier:** FREE. **Effort:** S. **Board:** none (provided it reflects real structure).

---

## Not building (recorded)

- **UX-WIZARD-CHATBOT** (Runzy) — SLT rejected: friction/cost/conversion-risk for an overtrained audience; the slider answers the same surface better.
- **UX-PROGRESS-01** (projection graph) — the honest version already ships (PAID `RaceTimesCard` + R31 delta). A curve over-claims (no per-week data to model a trajectory — ADR-011), is the illusion-of-progress class, and violates "no dashboards." *If ever* revisited: Coaching Board first; honest ceiling is a 3-point baseline→current→target, never a line.

---

## § Incoming — Planzy full plan-generation wizard (22 screens, 2026-08-29)

Founder walked the entire Planzy onboarding→plan flow. Evidence: `docs/investigations/planzy-wiz-01…22-*.png` (named in flow order). Liked: the **simplicity**, one-question-per-screen, informative-as-you-go, and the **tactile input types**. This section is the complete board brief for that flow. Nothing is built until it has an SLT build/tier ruling and (if it changes prescription) a Coaching Board correctness ruling.

### The full Planzy flow (reference)
Welcome → **connect runs (Strava/Garmin/Apple Health) FIRST** → name → DOB (wheel) → gender (cards) → weight (arc dial) → height (ruler) → experience-with-structured-plans (Yes/First-time + explainer) → "adaptive" explainer → **auto-estimated benchmark** ("if you raced 10K today: 55:52" confirm/edit) → easy pace (**asks**, wheel + explainer) → weekly distance (ruler) → race distance (cards) → race date (wheel) → **time availability (per-day slider grid** = the earlier `planzy-allocate-time`) → building (loading %) → **plan ready: EASY / OPTIMAL / CHALLENGING** (3 tiers + preview card + projection chart) → "no one follows a plan perfectly" → **paywall** (Planzy Pro) → post-paywall **easy-pace education + coach's note**.

### What the founder likes (the pattern to capture)
**One question per screen · bold header · one-line "why we ask" · a distinctive tactile control · educate-as-you-go.** That's the wizard's *shape* — it extends UX-WIZARD-01 from "just the time sliders" into a fuller wizard-redesign.

---

### The decisions this batch surfaces

Each is *what Planzy does → Zonna today → the decision → tier → board routing*.

**CI-1 — Wizard shape: one-question-per-screen + educate-as-you-go.**
Planzy: single question per screen, each with a "why", plus teaching interstitials. Zonna: multi-field steps, terser. → **Decision:** adopt the shape as the frame for UX-WIZARD-01. **Tier:** FREE. **Board:** SLT (product/UX) + `frontend-design`. Low coaching risk (it's presentation + copy). *This is the umbrella the founder actually likes; the items below are its contents.*

**CI-2 — Tactile input primitives (wheel / arc dial / ruler / card-select / segmented / unit-toggle).**
Planzy uses a distinct control per quantity (DOB & pace & date = wheel; weight = dial; height & distance = ruler; gender & race = cards). Zonna has `TextField`, `Select`, `Chip`, `DurationPicker`. → **Decision:** this *is* the **forms-primitives initiative already scoped** ("end input drift" — 6 shared primitives, full scope, not yet in the backlog). Fold Planzy's controls in as the design reference and finally land that initiative. **Tier:** FREE (infra). **Board:** SLT + `frontend-design`. **Backlog:** open the forms-primitives item (currently only a memory).

**CI-3 — New personal data: gender, weight, height.** ⚠️ **Coaching Board question — "what's the coaching use?"**
Zonna collects none of these. The engine is VDOT + HR + volume based:
- **Gender** — Zonna's max-HR is Tanaka (`208 − 0.7×age`, **not** sex-specific) and VDOT (Daniels) isn't sex-specific, so there is **no current engine use**. BUT it is the prerequisite for *any* female-physiology work (Sims' seat), is cheap and respectful to collect, and its absence is itself a gap. Cycle data stays blocked (ADR-011) regardless. **Decision for the board:** collect-now-for-future-and-respect vs the "don't ask for data you don't use" restraint principle.
- **Weight + height** — **no defensible engine use** for a VDOT/HR/volume plan (no power/GPS for running-economy; Zonna does no calorie/BMI load). Collecting them is **data-without-a-use** — friction against "restraint is the feature." **Recommendation to pre-empt the board:** don't collect unless a concrete coaching use is named first.
- **Routing:** Coaching Board rules whether each has a defensible use *before* SLT rules on collecting it. Default expectation: gender = maybe (future/respect), weight/height = no.

**CI-4 — Connect-runs-FIRST + auto-estimated benchmark.**
Planzy connects data sources at step 2, then *auto-estimates* your race time from recent runs and asks you to confirm/edit (screen 10). Zonna: `ConnectRuns` is **post-plan**, and the benchmark is **manual** (wizard step 2, optional race/TT). Zonna already has the estimation engine (`/api/race-times`, 5-state confidence). → **Decision:** reorder onboarding so connect precedes the wizard, letting Zonna pre-fill the benchmark from real runs (pairs with the D3/HR-hydration work). **Tier:** FREE. **Board:** SLT (onboarding order / activation). Note the iOS ADR-011 reality: HealthKit-first, no Garmin, Strava pending — so "connect" = HealthKit for now.

**CI-5 — 3-tier plan preview: EASY / OPTIMAL / CHALLENGING.** ⚠️ **Strong brand tension.**
Planzy generates three difficulty tiers and lets the runner pick their "commitment level." Zonna generates **one** plan and honestly classifies it (`maintenance` vs build). → **The tension:** a "CHALLENGING — push harder" option is close to the exact behaviour Zonna exists to counter ("You're trying hard. That's the problem."). Offering a harder tier to an overtrained day-job runner invites the grey-zone overreach the product is built to remove. **Board:** Coaching Board (Willy on load; is a "challenging" ramp defensible?) **and** SLT (does it undermine the positioning?). **Expected outcome:** reject or heavily reframe — at most an *honest* pair (e.g. "sustainable" vs "time-crunched"), never a "try harder" upsell. Do **not** adopt as-is.

**CI-6 — Ask-vs-derive easy pace.**
Planzy **asks** the runner their easy pace (with a "not sure? we'll fine-tune" escape). Zonna **derives** it from VDOT/benchmark. → **Decision:** deriving is more accurate *when a benchmark exists*; asking gives agency and works with no benchmark. Hutchinson's call. Likely: keep deriving, but the *explainer copy* Planzy pairs with it is worth borrowing. **Board:** Coaching Board (light — it's about which signal drives the pace). **Tier:** FREE.

**CI-7 — Educate-as-you-go interstitials — including the easy-pace lesson.** ✅ **Most on-brand thing here.**
Planzy's easy-pace education (screens 21–22): *"90% of runners go too fast on easy days"*, *"even elites spend ~80% here"*, *"slow down… without burning out."* That is **almost verbatim Zonna's thesis** ("You can't outrun your easy days" / "Hold the zone"). → **Decision:** Zonna should do this *better* than Planzy — it's the brand. Add teaching moments (esp. the easy-day discipline lesson) into the wizard/first-run. **Tier:** FREE. **Board:** brand (`brand.md` voice) + SLT; low coaching risk. **Trigger `frontend-design`.**

### Reconfirmed against the first batch
- **UX-WIZARD-01** (per-day time sliders) = screen 15 — confirmed; the 0/A/B engine decision above still stands.
- **UX-PROGRESS-01** (projection graph) reappears on screens 18 & 22 — **still don't-build** (over-claims; "no dashboards"; the honest version already ships PAID). It's baked deep into Planzy; Zonna's restraint is the deliberate divergence.
- **Paywall model differs** — Planzy paywalls *before* revealing the plan; Zonna's reverse-trial gives 14 days full access. Not a change to make — recorded so the boards don't read Planzy's gate as a template.

### Suggested routing when the boards convene
- **Coaching Board first** on the two that touch prescription/data doctrine: **CI-3** (gender/weight/height — what's the use?) and **CI-5** (challenging tier — is it safe/on-thesis?). Expected: gender = maybe, weight/height = no, challenging-tier = reject/reframe.
- **SLT** on the rest as a bundle: **CI-1** wizard shape, **CI-2** forms primitives, **CI-4** connect-first + auto-benchmark, **CI-6** ask-vs-derive, **CI-7** teaching moments — most are FREE activation/brand wins with low coaching risk.

### Still pending
- **Runzy chatbot wizard** (no screenshots yet) — already SLT-rejected in principle (UX-WIZARD-CHATBOT); revisit if the founder brings the actual flow.

---

## Integration & non-regression — how this all fits together without breaking what's built

Both boards approved this as **one initiative, not many.** The five green-lit items are **facets of a single wizard redesign**, and the rejected items need no integration. This section is the contract any implementer follows so the pieces compose and nothing already shipped regresses.

### 1. The build items are ONE thing — build them together
CI-1 (shape), CI-2 (primitives), CI-4 (connect-first + auto-benchmark), UX-WIZARD-01 (per-day sliders), CI-7 (teaching) all live in the **same surface** (`GeneratePlanScreen` + onboarding order). Building them as five separate backlog items would rebuild the wizard five times and re-risk the just-stabilised D6/D7/D10 each time. → They are consolidated into **one epic: `WIZARD-REDESIGN`** (see backlog). Internally coherent, no cross-item conflict:
- the per-day **slider grid IS one of the primitives** (CI-2 ⊇ UX-WIZARD-01's control);
- **auto-benchmark (CI-4) feeds VDOT → derived easy pace (CI-6)** — synergy, not conflict;
- **teaching interstitials (CI-7)** interleave between question screens under the CI-1 shape.

### 2. What already-built things this touches — and the guard for each
| Built thing (recently shipped) | Risk | Non-regression guard |
|---|---|---|
| **Wizard fixes D6 / D7 / D10** | A redesign re-touches the exact code | Re-verify: "Adjust inputs" → first step (D6); sticky CTA clears Peak/Taper (D7); ceremony has no dead gap (D10) |
| **`GeneratorInput` → `ruleEngine` → `foundationBlock` → property sweep → `validatePlan`** | UX-WIZARD-01 **option B** changes the input shape | Keep the **D4** long-run-day fix + **Coaching-1** 35% foundation cap intact; run `property-validate-plans.ts` (0 new violations) + full vitest suite; the byte-exact `generator_input` replay field changes shape → handle old-plan compat |
| **ConnectRuns / D5** (CTA label, always-visible skip, Apple 5.1.1) + onboarding gate order (Orientation → Connect → Push) | CI-4 moves connect **pre-wizard** | Preserve the D5 skip + "Connect Apple Health" label + 5.1.1 compliance; keep `connect_runs_seen` / `healthkit_connected_at` / `orientation_seen` semantics; don't create a dead end |
| **Benchmark input (FREE) vs `/api/race-times` + `RaceTimesCard` (PAID)** | CI-4 auto-estimates a benchmark | The wizard's auto-estimate must be a **FREE** estimation and must **not** expose the PAID `RaceTimesCard` surface/gate — keep the tier line exactly where it is |
| **D3 HR hydration** (HR from `plan.meta`) | Wizard collects HR | Preserve the plan.meta → state hydration + `user_settings` persist |
| **`zona_wizard_draft`** | State shape changes | Write/read/deps + `validSubSteps` stay in lockstep; legacy drafts degrade gracefully (restore guards already no-op on missing keys) |
| **Shared form components** (`TextField`, `Select`, `Chip`, `DurationPicker`) used by login / profile / benchmark-update | CI-2 introduces new primitives | Migrate incrementally; every consuming screen re-checked; **iOS input-zoom trap** — any text input stays ≥16px |
| **Warm Slate + pre-commit hex/font guard** | New UI | Light-theme only; no hardcoded hex/fonts (hook blocks it); translate Planzy's dark/yellow, never copy it |

### 3. Sequence that de-risks (each step ships green before the next)
1. **Primitives the wizard needs** (CI-2 subset: wheel, ruler, slider-grid, card-select) — as shared components, behind the existing forms-primitives plan. *(Full migration of other forms is a separate, later pass.)*
2. **Wizard UI redesign** (CI-1 + those primitives + **UX-WIZARD-01 option A**, UI-only, existing `GeneratorInput`) — **no engine change yet**, so no property-sweep risk. Re-verify D6/D7/D10.
3. **UX-WIZARD-01 option B** (per-day time budget → engine) — **only** behind the Coaching Board ruling, with the new invariant + property sweep. Skippable if the per-day time value isn't judged worth the engine cost.
4. **CI-4 connect-first + auto-benchmark** — reorder onboarding; preserve D5 + gate order + tier line.
5. **CI-7 teaching interstitials** — additive, last, lowest risk.

### 4. Tier coherence
Every build item is **FREE** (wizard/activation/brand). Nothing crosses into PAID, and the one PAID adjacency (RaceTimesCard estimates) must stay untouched. No gate conflict.

### 5. The pre-ship gate (any WIZARD-REDESIGN slice)
`tsc` clean · full vitest green · property sweep 0-new (if engine touched) · D6/D7/D10 re-verified · D4 + Coaching-1 + D5 + D3 intact · draft round-trips · no hex/font violations · iOS ≥16px · `frontend-design` pass · Coaching Board sign-off **iff** option B or the reframed plan-choice.
