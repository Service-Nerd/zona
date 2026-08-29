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

## § Incoming — additional competitor analysis (placeholder)

*To be filled as the founder supplies more screenshots (Runzy chat flow + others). Each new idea gets scoped in the same shape above — current state, gap, decision, scope, risks, tier, board routing — so the boards always rule against a complete picture. Nothing here is built until it has both an SLT tier/build ruling and (if it changes prescription) a Coaching Board correctness ruling.*
