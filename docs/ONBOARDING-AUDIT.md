# Onboarding & surface audit — Phase 0

**Produced:** 2026-09-20 · **For:** Miles teardown, Phase 1 reconciliation
**Scope:** read-only. No code changed, no backlog items written, nothing proposed.
**Method:** read from the code. Where this contradicts a prose doc, the code is cited and the doc
is flagged as a gap. Counts are derived by the command shown, never from memory.

> **What this document does not do.** It does not evaluate Miles, rank anything, or recommend.
> Every "we already do this" below is a statement about our code at the commit named, not a claim
> that ours is better — that judgement belongs to Phase 1, against the screenshots.
>
> **Commit audited:** `96e1942` (main, tree clean).

---

## 2.1 Onboarding and plan generation

### Q1 · Every screen in order, with path, question copy and helper copy

**Single owner:** `app/dashboard/GeneratePlanScreen.tsx`. Step order is computed by
`getStepSequence(hasPaidAccess, goal)` (line 241); copy lives in `STEP_META` (line 214). One
question per screen — that is a shipped decision (CI-1), not an accident.

| # | Step key | Title (exact) | Helper (exact) | Optional | Gate |
|---|---|---|---|---|---|
| 1 | `distance` | How far? | Start with the finish line. Work backwards from there. | | |
| 2 | `race-details` | Tell me about the race. | Race name is optional. The date is not. | | |
| 3 | `goal` | What matters most? | Crossing the line, or hitting a number. Both are valid. | | |
| 4 | `target-time` | What's the target? | Be honest. Optimistic goals make bad training plans. | | only if `goal === 'time_target'` |
| 5 | `teach-easy` | This plan will feel too easy at first. | *(eyebrow: Hold the zone)* | **interstitial** | |
| 6 | `weekly-volume` | How much are you running now? | Last four weeks, roughly. Real numbers only. | | |
| 7 | `longest-run` | Longest run in the last six weeks? | Tells us how much you can already hold. | | |
| 8 | `training-age` | How long have you been at this? | Consistent months, not total years. | ✓ | |
| 9 | `recent-quality` | Been doing the hard stuff? | Last month or two. What you actually did, not what you meant to. | ✓ | |
| 10 | `your-level` | Where are you right now? | Based on what you told us. Overrule it if we've got it wrong. | | |
| 11 | `birth-year` | What year were you born? | Only to estimate your max heart rate, if you haven't set one. Kept private. | ✓ | |
| 12 | `benchmark` | Recent race result? | Gives us precise pace targets for every session. Skip if you haven't raced lately. | ✓ | |
| 13 | `teach-easy-day` | Easy should feel easy. | *(eyebrow: The easy day)* | **interstitial** | |
| 14 | `your-week` | Which days do you run? | Tap the days you train. Tap a weekend day again to make it your long run. | | |
| 15 | `weekday-ceiling` | How long on a weekday? | Your cap Monday–Friday. Weekends stay open. Skip if you're flexible. | ✓ | |
| 16 | `hard-sessions` | You and hard sessions. | Intervals, tempo, threshold. Where do you land? | | **paid only** |
| 17 | `terrain` | Where do you run? | Road, trail, or a bit of both. Off-road, we coach by effort, not pace. | | **paid only** |
| 18 | `injuries` | Anything to flag? | Old injuries that still show up. Skip if you're clean. | ✓ | **paid only** |

**Counts:** free + finish goal = **14 screens, 12 questions** (2 are interstitials).
Paid + time goal = **18 screens, 16 questions.**

Then: `generating` (ceremony) → `preview` → save. `error` is a fourth terminal state.

**Progress indicator is a moss fill line with no number** (`ProgressLine`, line 256). The comment
records why: *"'Step 7 of 12' turns setup into a chore and invites drop-off; the line reassures
without counting."* This is a deliberate, documented decision (CI-1) — noted here because the
teardown's P-05 proposes adding step numbering, which would reverse it.

**Draft persistence:** `sessionStorage` key `zona_wizard_draft`, written on every field change,
restored on mount, cleared on `handleUsePlan` success.

---

### Q2 · Every input collected, and which part of the engine consumes it

Assembled at `GeneratePlanScreen.tsx:1001–1030`. `GeneratorInput` is declared in `types/plan.ts:31`.

| Wizard field | Schema name | Req? | Engine consumer |
|---|---|---|---|
| Distance tile | `race_distance_km` | ✓ | `raceDistanceKey` → `PLAN_SIGNATURES`; range-guarded 1–300 km (`inputs.ts`) |
| Race date | `race_date` | ✓ | plan length, `validatePrepTime` (§44), taper |
| Race name | `race_name` | ✗ | display + enricher only |
| Goal | `goal` | ✓ | §22 race-specificity; `coherentGoal()` downgrades a time goal with no time |
| Target time | `target_time` | cond. | goal pace, §22 race-pace sessions |
| Weekly volume | `current_weekly_km` | ✓ | peak km (§106), week-1 start, §111 base-build gate, §2 ramp |
| Longest run | `longest_recent_run_km` | ✓ | §45 long-run cap, `LongRunReadinessError`, §29 heuristic |
| Training age | `training_age` | ✗ | §79 level lift, §29 fresh-return heuristic, ADR-021 gate |
| Recent quality | `recent_quality_training` | ✗ | §89 experience-gated quality onset (ADR-021) |
| Level (accept/override) | `user_declared_level` | ✓ | §79 — **intensity allowance only upward**, both axes downward |
| Birth year | `age` | ✓ | Tanaka max HR (208 − 0.7 × age), masters cadence |
| Benchmark | `benchmark` | ✗ | VDOT → every pace band |
| Week grid | `days_available`, `days_cannot_train`, `preferred_long_run_day` | ✓ | §52 days minimum, placement, long-run day |
| Weekday cap + per-day rows | `max_weekday_mins`, `day_budgets` | ✗ | §18/§81 sizing, per-day placement, `waterFillEasyKm` |
| Hard sessions | `hard_session_relationship` | paid | §110 quality ceiling (`avoid` → floor, not off switch) |
| Terrain | `terrain` | paid | effort-governed coaching on trail |
| Injuries | `injury_history` | paid | §12 trim, §90 delivered ceiling, ADR-022, §28 |

Derived client-side before send: resting/max HR from HealthKit (`fetchAppleHealthHRSnapshot`),
`max_hr_source` stamped `observed` or `user_confirmed` per §50.
Injected server-side: `athlete_name` from `user_settings.first_name`
(`app/api/generate-plan/route.ts:96`) — deliberately not client-supplied.

---

### Q3 · Inputs the engine accepts but onboarding never asks for

| Field | Status | Consumer reality |
|---|---|---|
| `weeks_at_current_volume` | **No producer in `app/` at all** | Real consumers: §29 fresh-return (`ruleEngine.ts:6239`), §44 prep shift (`inputs.ts:120`), `foundationBlock.ts:38`. Only sender in the repo is the test fixture `charityCohort.ts:137`. A heuristic fallback exists (`ruleEngine.ts:6242`, experienced training age + volume and long run both below floors), so the engine degrades rather than breaks — **but the explicit path is unreachable from the product.** → **GAP-01** |
| `motivation_type` | Declared, validated, **reaches nothing** | Echoed to `meta` (`ruleEngine.ts:8598`). `property-validate-plans.ts:624` records it: *"Copied to plan.meta only. No prescription path reads it."* → **GAP-02** |
| `training_style` | Declared, validated, **reaches only the enricher** | `enrich.ts:389` prompt line; no rule-engine reader. Registered as known debt in `inputEffect.test.ts:220`. → **GAP-02** |
| `fitness_level` | API-only, by design | Structural declaration; the wizard deliberately sends `user_declared_level` instead (§79 asymmetry). Not a gap. |
| `fitness_intensity_level` | Engine-derived, not an ask | Fed back by `validateReshapedPlan`. Not a gap. |
| `foundation_decision` | Asked, but *after* generation | ADR-020 modal, second call to `/api/generate-plan/foundation`. Not a gap. |
| `acknowledged_prep_warning` / `acknowledged_days_warning` | Set on retry, never asked | §44 two-step confirmation. Not a gap. |
| **Sex** | **Not in `GeneratorInput` at all** | `grep -rn -w -i "sex\|gender" types lib/plan app` → 3 hits, all prose comments in `generationConfig.ts`. Tracked as `INPUT-SEX-01`. → **GAP-03** |

---

### Q4 · Is Strava connected before or after plan generation? Does any Strava value seed the plan?

**Strava: neither, and no.**

- The Strava screen has **no nav entry** and is reachable only by URL (admin).
- `ConnectRunsScreen` (`DashboardClient.tsx:2960`) offers **HealthKit only** — consistent with
  ADR-011 ("iOS onboarding CTAs: HealthKit only on day one").
- The Strava application is currently **Inactive at Strava's end** (`STRAVA-APP-INACTIVE-01`).
- **No Strava-derived value reaches `GeneratorInput`.** The wizard's only device read is
  `fetchAppleHealthHRSnapshot`.

**HealthKit: before, on native only.** `CONNECT-FIRST` (CI-4, `DashboardClient.tsx:1850–1861`)
shows `ConnectRunsScreen` to a brand-new **native** user *before* the wizard, explicitly so the
benchmark can pre-fill and RHR/MaxHR can seed. Web users get no pre-wizard connect and fall
through to the post-plan `CONNECT-01` path (line 1863).

| Platform | Order |
|---|---|
| iOS native, new user | ConnectRuns → **wizard** → generate → Orientation → Push |
| Web, new user | **wizard** → generate → *(no connect screen)* |

→ **GAP-04**: web users generate their first plan with no HR and no benchmark pre-fill, and no
screen ever offers them a source. This is a platform asymmetry, not a defect in either path.

---

### Q5 · Behaviour with no history — hardcoded defaults, or named constants?

**Named constants throughout. No hardcoded coaching defaults found.**

| Missing | Fallback | Where |
|---|---|---|
| Max HR | Tanaka `208 − 0.7 × age` | exempt-by-doctrine formula constant |
| Resting HR | %MaxHR instead of Karvonen | §14, `zone-rules.md` |
| Benchmark | `/api/wizard-benchmark-estimate` → if unavailable, manual ask → if skipped, population estimate by fitness level | route returns `{available:false}` and the wizard shows manual; **never a dead end** (route header) |
| Benchmark staleness | `GENERATION_CONFIG.VDOT_STALENESS_FRESH_WEEKS` softens pace | surfaced honestly on Me |

The wizard states the skip cost in its own copy (line 1968): *"Without a benchmark we use
population estimates for your fitness level. Still works — just less personal."*

---

### Q6 · Plan generation — sync or async? Wall time? Loading state?

**Two-stage NDJSON stream, not a single request.** `app/api/generate-plan/route.ts:547–568`:

1. `rule_plan` is enqueued immediately — deterministic, sub-second, always succeeds.
2. `final_plan` follows after enrichment. `waitUntil(enrichWork)` owns persistence so the write
   completes even if the client disconnects (ADR-006: enricher failure is silent).

**Loading state:** `components/GeneratingCeremony.tsx` — a ceremony, not a spinner.
Free = 4 lines, **1,800 ms minimum**. Paid/trial = 5 lines, **3,600 ms minimum**. Line 1 rotates
every 1,800 ms. The file's own comment sizes the paid enrichment window at **28–35 s**.

Personalised lines come first (`lib/plan/ceremonyLines.ts`, FIRSTRUN-MOMENTS-01c) and are built
from the runner's own answers, with generic copy backfilling. That module carries an explicit
constraint: *"NO LINE MAY CLAIM ANYTHING THE PLAN DOES NOT DO."*

**On the teardown's staged-latency caution:** for **paid**, the minimum is far below real
enrichment time, so nothing is staged. For **free** there is no enrichment, so the 1,800 ms floor
**is** a deliberate hold. It is a decision on the record, not an accident.

---

### Q7 · Phase name and per-week rationale?

**Both present.**

- `Phase` (`types/plan.ts:185`) = `{ name: 'base'|'build'|'peak'|'taper', start_week, end_week }`.
- `Week.phase` (line 312) carries a **wider** set than `Phase.name`: adds `foundation`,
  `maintenance_restoration`, `maintenance_base`. → **GAP-05**: two types answer "what phase is
  this?" with different vocabularies. Nothing is broken today because consumers read `Week.phase`,
  but `Phase` cannot represent a foundation or maintenance block.
- **Per-week rationale:** `Week.theme` (string, always present) is the rule-engine rationale.
  `Week.coach_debrief` is the AI one (maintenance weeks only, PAID).
- **Plan-level rationale:** `meta.plan_intro` (AI, free first plan) plus rule-engine notes rendered
  under "Why this plan" (`DashboardClient.tsx:8357–8380`).

---

### Q8 · Does any session carry a pace *ceiling* as distinct from a target?

**Yes — as a display transform, at exactly one call site.**

`lib/plan/easyPaceCeiling.ts → easyPaceAsCeiling(paceTarget, sessionType)` converts an easy or
recovery band into `"7:11 /km or slower"`. The module states the reasoning: *"An 81-second window
reads as a target a runner can fill the whole of; the point is the cap."* Quality, long and race
sessions keep their band, because there the range **is** the target. 10 unit tests.

**Rendered in one place only:** `DashboardClient.tsx:7881`, inside Session Detail.
It does **not** appear on Today, Plan, the week card, or the wizard preview. → **GAP-06**

**INV-PLAN-007 status — the brief asks me to check this, so precisely:**
- It is **not** in `docs/canonical/plan-invariants.md` and **not** in `lib/plan/invariants.ts`
  (both use named IDs; 124 registered, zero numeric).
- It belongs to a **separate legacy numeric register**, `INV-PLAN-001…011`, documented in
  `docs/canonical/plan-schema.md:288–302`. Those are architectural contracts (where data lives,
  what type it is), not coaching invariants — a different register, legitimately.
- **It is mechanically enforced**, by Zod: `lib/plan/schema.ts:38–41` carries the comment
  `// INV-PLAN-007` above `zone: z.string().optional()`, `hr_target`, `pace_target`. Since
  `SAVE-VALIDATE-01`, `PlanSchema` runs on the save path.
- **Consequence for any pace-ceiling work:** a ceiling must be a **string**, not a number or an
  object. A numeric field would now be caught at save. → **GAP-07** (the register split itself is
  undocumented: two invariant namespaces, no cross-reference between them).

---

### Q9 · Reusable input components already built

| Component | Path | Used by |
|---|---|---|
| `CardSelect` | `components/shared/CardSelect.tsx` | goal, level, recent-quality, hard-sessions, terrain |
| `Chip` | `components/shared/Chip.tsx` | volume, longest run, weekday cap, injuries |
| `WeekGrid` (+ `.logic`, `.test`) | `components/shared/WeekGrid.tsx` | `your-week` — derives `days_available`, `days_cannot_train`, `preferred_long_run_day` |
| `DayGridSelector` (+ `.logic`, `.test`) | `components/shared/DayGridSelector.tsx` | day picking |
| `DayBudgetRows` | `components/shared/DayBudgetRows.tsx` | per-weekday budgets (Stage C) |
| `WheelPicker` (+ `.logic`, `.test`) | `components/shared/WheelPicker.tsx` | birth year |
| `DurationPicker` | `components/shared/DurationPicker.tsx` | **every** time entry (FORMS-PRIM-01, shipped 2026-09-13) |
| `Ruler` (+ `.logic`, `.test`) | `components/shared/Ruler.tsx` | continuous numeric |
| `TextField` | `components/shared/TextField.tsx` | text/number |
| `SegmentedControl` | `components/shared/SegmentedControl.tsx` | binary/ternary |
| `Select` | `components/shared/Select.tsx` | dropdown |
| `Sheet` | `components/shared/Sheet.tsx` | slide-up sheets |

**A wheel picker for approximate values already exists and is the single owner of time entry.**
FORMS-PRIM-01 closed the last three bespoke time controls.

---

### Q10 · Do all colour / shadow / radius values resolve from `globals.css`?

**Radius and shadow: yes, tokens exist and are good.**
`--radius-sm|md|lg|xl` (10/14/18/22px) and **`--shadow-card`**, **`--shadow-lifted`**
(`globals.css:74–75`):

```
--shadow-card:   0 1px 2px rgba(26,26,26,.04), 0 10px 28px -10px rgba(26,26,26,.10);
--shadow-lifted: 0 1px 2px rgba(26,26,26,.05), 0 18px 42px -14px rgba(26,26,26,.16);
```

These are already warm-tinted (`26,26,26`, not neutral grey-blue) and already tokenised. Any
elevation proposal should start from these rather than introduce new ones.

**Colour: three hex breaches and 26 rgba breaches.**

Hex (`grep -rnE "#[0-9A-Fa-f]{3,8}\b" app components`, excluding tests, `/api/og`, `page.tsx`):

| File:line | Value | Note |
|---|---|---|
| `components/shared/CoachByline.tsx:57` | `#5A7C5A`, `#9A6F2A` | avatar gradient ends |
| `components/shared/CoachByline.tsx:76` | `#FFFFFF` | |
| `app/dashboard/layout.tsx:3` | `var(--bg, #111)` | CSS fallback, defensible |

rgba (`grep -rnE "rgba?\([0-9]" app components`, non-test): **26 occurrences.** Several are the
palette at alpha — `rgba(107,142,107,…)` is `--moss`, `rgba(61,38,0,…)` is `--coach-ink`. Examples:
`AdjustmentDiff.tsx:52,89` · `PendingAdjustmentBanner.tsx:142` · `RaceTimesCard.tsx:147,277,392` ·
`DashboardClient.tsx:9040,9696,9772,10534,10805,11993,12575,12576`.

→ **GAP-08: the enforcement hook does not check `rgba()`, shadows or radii.**
`.githooks/pre-commit` (versioned; `core.hooksPath=.githooks`) has four style checks — hex, banned
fonts, `setProperty`, four banned hex values. No rgba rule, no shadow rule, no radius rule. CI
(`.github/workflows/verify.yml`) runs correctness only and explicitly defers style to the hook.
So **26 hardcoded colours are live and nothing will ever flag them.**

⚠️ A stale copy of an older hook also exists at `.git/hooks/pre-commit`. It does not run
(`core.hooksPath` points elsewhere) but it differs from the versioned one and will mislead anyone
who reads it. → **GAP-09**

---

## 2.2 In-app surfaces

### Q11 · Tab structure. Is planned work split from completed work?

**Four tabs** (`DashboardClient.tsx:2633–2638`): **Today · Plan · Coach · Me**.

**Planned and completed are NOT split across tabs.** There is no Activities tab. Completions
render inline against the planned session on both Today and Plan, via `allCompletions` keyed
`{week_n, session_day}`. `runAnalysisMap` attaches the verdict to the same row.

Eleven further non-tab screens push on top: `session`, `generate`, `upgrade`, `benchmark`,
`reshape`, `post-run`, `founder`, `redeem`, `notifications`, `recalibration`, and the retired
`calendar`.

**Bearing on the open Plan/Activities merge question:** the premise does not transfer. We have
never had the split Miles has. What we have instead is *planned-vs-actual in one row already*, and
a separate `Plan` tab that is a **forward** view. The trade-off to weigh in Phase 1 is therefore
not "merge two tabs" but "should the Plan tab show history at all" — a different and smaller
question. Not decided here.

---

### Q12 · Plan screen — what blocks, in what order?

`PlanScreen`, `DashboardClient.tsx:8191`. Seven blocks:

| # | Block | Source | Line |
|---|---|---|---|
| 1 | `ScreenHeader "Your plan"` | — | 8301 |
| 2 | Race name + date + days-to-race | `meta` | 8303 |
| 3 | **Plan arc** — week bars, phases, deloads, race week | rule engine | 8319 |
| 4 | **Plan intro** — "why this plan" | **AI** (free first plan) | 8346 |
| 5 | **Why this plan** — rationale notes | rule engine | 8357 |
| 6 | **Plan voice** — this-week coaching card | **AI** | 8382 |
| 7 | **Plan calendar** — drag-reorder, tap-to-open | — | 8503 |

**Absent from this screen:** any projected finish time, any completion or compliance metric, any
modify-plan entry point, any pace ceiling. Phase label is derived and rendered on the arc.

---

### Q13 · Is there a modify-plan surface? Batched or per-change?

**No. There is no surface on which a runner can edit a plan parameter.**

- `ReshapeScreen` (line 6397) is **not** an editor. It calls `/api/adjust-plan`, and if the engine
  proposes an adjustment it renders `PendingAdjustmentBanner` with Confirm/Dismiss. The runner
  supplies no parameters.
- `MeScreen → "Your training"` (line 11829) contains exactly four rows: **Race benchmark ·
  Plan history · Distance units · Session display.** Units and display are presentation
  preferences (ADR-015), not training parameters.
- The only way to change days available, weekday cap, race date, long-run day, injuries, terrain,
  intensity or volume is to **run the whole wizard again and generate a new plan**, which archives
  the old one (`plan_archive`).

→ **GAP-10.** The batching question does not arise: there is nothing to batch.

---

### Q14 · Does anything show a diff before applying a plan change?

**Yes, and it exists because of an incident.**

`components/shared/AdjustmentDiff.tsx` renders a per-day before/after strip beneath the banner
prose, gated behind an explicit Confirm. Its header records the cause: *"The 2026-06-26 incident
root cause was a runner who could not see what Confirm would do — only the AI summary, which
lied."* Layering doctrine from that SLT: **prose handles WHY, the rule-engine diff handles WHAT**,
and the diff carries no AIMark because it is deterministic.

Two call sites: `PendingAdjustmentBanner.tsx:104` (the confirm path) and
`DashboardClient.tsx:12037` (the read-only "recent changes" log on Me).

**Scope limit:** it covers **engine-initiated** adjustments only, because those are the only plan
changes that exist (Q13). Magnitude-calibrated confirmation is ADR-012.

---

### Q15 · Profile headline metrics. Is a streak among them?

**No streak anywhere in the product.** `grep -rn -i "streak" app components lib` returns: two
marketing strings on `app/page.tsx` (449, 543) that advertise the *absence* of streaks, one comment
at `DashboardClient.tsx:9058` (*"Counter, not a streak"*), and internal `streakDist`/`streakCount`
locals in `ruleEngine.ts:5572–5592` that count consecutive equal long-run distances for §45. None
is a user-facing habit mechanic.

**Me has no big-number headline block at all.** The top card is **"What Kit knows about you"**
(line 11705) — a read-only synthesis of the engine's inputs, one row per input, each with a
state dot: `--moss` set / `--warn` stale / `--mute` unset. It surfaces staleness honestly rather
than scoring the runner. Sections below: Your profile · Your training · Connections ·
Notifications · Plan adjustments (paid) · Your access · Subscription · Support · Careful Now.

→ **GAP-11**: there is no discipline metric on Me either. The absence is symmetrical — no vanity
metrics *and* no earned ones.

---

### Q16 · Free vs paid gating, enumerated

`lib/plan/featureGates.ts → FEATURE_GATES`, three categories (Option A reverse trial).

**FREE_ALWAYS (6):** `generic_plan_templates` · `rule_engine_regeneration` ·
`manual_session_completion` · `plan_view` · `basic_strength_sessions` · `plan_difficulty_band`.

**GRANTED_AT_TRIAL_RETAINED_IN_FREE (6):** `personalised_plan` · `vdot_pace_zones` ·
`hr_karvonen_zones` · `ai_coach_notes_existing` · `session_catalogue_full` ·
`injury_adaptations_initial`.

**PAID_ONLY_ONGOING (9):** `dynamic_reshape_r20` · `ai_coach_notes_new` · `activity_intelligence` ·
`confidence_score` · `ultra_plan_generation` · `strength_sessions_tailored` · `race_time_estimates` ·
`post_run_reframe` · `maintenance_coaching`.

**Two things this file says about itself that matter:**

1. **`ultra_plan_generation` is not the enforcer.** Its own comment: *"Nothing calls
   `isFeatureAllowed('ultra_plan_generation')`."* The distance paywall (Marathon/50K/100K) is
   enforced by `PLAN_SIGNATURES[d].free_tier_available`, read **client-side** in
   `GeneratePlanScreen`. `/api/generate-plan` checks neither. Tracked as `TIER-ENFORCE-01`.
2. **`injury_adaptations_new` was deleted, not annotated** (2026-09-11), because the engine
   adapted for injury with no tier check and *the engine was right*. Hutchinson's ruling: an injury
   adaptation is "the plan not hurting someone", which is access, not richness.

In the wizard, paid gating is visible as: three paid-only steps (16–18) and a lock on the
Marathon/50K/100K distance tiles.

---

### Q17 · Every empty / cold-start state, and what it renders

| Surface | Trigger | Renders |
|---|---|---|
| **App boot** | `!bootReady` | Wordmark + `BRAND.tagline` splash (line 2003) |
| **No plan** | `loadedPlan.weeks.length === 0` | **Routes straight to the wizard** — `setPlan(EMPTY_PLAN); setScreen('generate')` (line 931). Nav bar hidden (line 2615). No zeroed Today screen is ever shown. |
| **Coach, no source** | no Strava token, no HealthKit | *"Nothing to coach from yet."* + "Connect a source" CTA |
| **Coach, no runs** | source connected, none logged | *"Waiting on your first run."* |
| **Coach, no HR** | runs exist, RHR/MaxHR missing | *"One more thing."* + "Set heart rate" CTA |
| **Coach, stale report** | report older than this week | *"Last week's report is below."* |
| **Coach, default** | all present, no report | *"Nothing to read yet."* |
| **Race times card** | insufficient data | `copy.empty.heading`, branched on Strava connected |
| **Pre-run band card** | too few runs | **renders nothing** — comment: *"no empty-state clutter"* |
| **Session detail pace** | pace not yet loaded | `'—'` placeholder, reserving the slot to prevent reflow |

The Coach empty state is a deliberate four-branch state machine (line 9572) that names the **one**
blocking action rather than a generic prompt.

**No rendered `0%` was found on any live screen.** `PlanProgressBar` (line 8145) *does* render
`"0 of 21 sessions complete"` with a `0%` bar on day one — it guards `totalSessions === 0` but not
`doneSessions === 0` — **but it is dead code.** `grep -rn "<PlanProgressBar" app components` → **0
hits.** `RestraintCard` is likewise defined and never rendered. → **GAP-12** (dead components, not
a live cold-start defect — stated this way deliberately, because the opposite reading would put a
non-existent bug into Phase 1).

---

## Gap register

| ID | Gap | Evidence | Severity |
|---|---|---|---|
| **GAP-01** | `weeks_at_current_volume` has three engine consumers and **no producer in `app/`** | `ruleEngine.ts:6239`, `inputs.ts:120`, `foundationBlock.ts:38`; only sender is `charityCohort.ts:137` | Med — heuristic fallback exists |
| **GAP-02** | `motivation_type` reaches nothing; `training_style` reaches only the enricher. Neither is asked | `ruleEngine.ts:8596–8598`; `property-validate-plans.ts:624–625` | Low — registered debt |
| **GAP-03** | No sex field anywhere in `GeneratorInput` | 0 hits in `types/plan.ts` | Tracked (`INPUT-SEX-01`) |
| **GAP-04** | Web users get no connect screen before **or** after first generation | `DashboardClient.tsx:1857` returns early off-native | Med |
| **GAP-05** | `Phase.name` and `Week.phase` are two vocabularies for one question | `types/plan.ts:185` vs `:312` | Low |
| **GAP-06** | The pace ceiling renders at **one** site — Session Detail only | `DashboardClient.tsx:7881` is the sole call site | **High** (differentiation) |
| **GAP-07** | Two invariant registers (`INV-PLAN-001…011` vs 124 named) with no cross-reference | `plan-schema.md:288` vs `plan-invariants.md` | Low — doc hygiene |
| **GAP-08** | 26 hardcoded `rgba()` + 3 hex live; the hook checks hex only, never rgba/shadow/radius | `.githooks/pre-commit`; `verify.yml` defers style | **High** (the stated #1 time sink) |
| **GAP-09** | Stale unused hook at `.git/hooks/pre-commit` differs from the versioned one | `core.hooksPath=.githooks` | Low — misleading |
| **GAP-10** | No plan-parameter editing surface exists at all | `MeScreen` "Your training" = 4 rows, none structural | **High** |
| **GAP-11** | No headline metric on Me — neither vanity nor discipline | line 11705 | Med |
| **GAP-12** | `PlanProgressBar` and `RestraintCard` are dead code | 0 render sites | Low |
| **GAP-13** | Backlog wave table lists shipped work as unstarted | `backlog.md:1982` lists WIZARD-REDESIGN (CI-1/CI-2/CI-4/CI-7/UX-WIZARD-01) and FORMS-PRIM-01 in W5 "product bets"; all six are in `feature-registry.md` (lines 88, 99, 101, 102, 482, 486), shipped 2026-08-30 → 2026-09-13 | Med — **Phase 1 reconciles against this table** |

**Mapping to existing items:** GAP-03 → `INPUT-SEX-01`. GAP-08 partially → `BRAND-*` tech debt.
GAP-13 → the wave table itself. **GAP-01, 02, 04, 05, 06, 07, 09, 10, 11, 12 map to no existing
backlog item.** Nothing was filed — Phase 0 is read-only.

---

## Backlog inventory

**Derivation, stated because the number matters for Phase 1 reconciliation.** Parsed
`docs/releases/backlog.md` (2,759 lines) for declaration lines carrying an item ID and a status
marker. **186 distinct IDs** appear as declarations; **78 declaration lines** carry an open marker
(🔲 ⛔ 🟡 🔴 ⏸️ 🔜) and no closed marker. Some IDs declare twice (a summary line and a full entry),
so the open *item* count is lower than 78. `feature-registry.md` holds the shipped record
separately.

⚠️ **This is a marker-based parse, not a semantic read.** An item whose entry says "SHIPPED" in
prose but still carries a 🔴 heading counts as open here. Three were checked by hand and corrected
below. Treat the table as a worklist, not an authority.

### The R-series — the items the brief names

| R-item | Status | Current scope |
|---|---|---|
| **R17** | Shipped | Coaching flags — the per-session atom R18 aggregates |
| **R18** | **Open**, W5, PAID, M | Plan confidence score from completion + RPE. Downstream of R25 |
| **R19** | **Open**, W5, PAID, S | Coaching tips → Supabase table. *"Don't pick up without a product trigger"* — current copy branches on session type + RPE, both known client-side; no user segmentation exists, so migrating alone unlocks nothing |
| **R20** | Shipped | Reshape engine. Parked triggers remain |
| **R21** | **Open**, W5, FREE display / PAID dynamic, M | Strength sessions — flesh out stubs (admin-only/hidden today) |
| **R22** | **Open**, W5, PAID, M | Blockout days — user marks days unavailable, plan reshapes. *"Bundle with R20 parked triggers — same reshape engine"* |
| **R23** | Shipped | The plan-generator rebuild. Two deferred items below |
| **R23-D1** | **Open**, W6 | Tier-2 wizard fields (`treadmill_primarily`, `longest_run_ever_km`) — need an engine consumer before the wizard work is worth shipping |
| **R23-D3** | **Open**, W6 | Surface the `compressed` flag in UI — needs design rationale first |
| **R24** | **Open**, W5, PAID, L | Multi-race (A/B hierarchy). Additive: `meta.races: Race[]` |
| **R25** | Shipped | Comparison engine |
| **R26** | **Open**, W5, PAID, M | Background load from HealthKit steps → chronic side of ACWR. Calibration risk flagged |
| **R27** | **Open**, W5 (⛔ blocked), PAID, L | Cycle-aware coaching. **Blocked on data**: `@capgo/capacitor-health@8.4.8` exposes no menstrual type |
| **R15b** | **Not an item — a release number** | The brief lists R15b alongside R17–R24 as a backlog item to reconcile against. It is not one. `R15b` appears only in `feature-registry.md` as the *release* in which something shipped: *Core app shell (R0–R15b)*, *Screen guide popups*, *Profile screen*, *Smoke tracker*. **Nothing is open under it and there is nothing to reconcile.** ⚠️ I first recorded this as a gap; that was wrong — corrected before reporting. |

### Open items by area — the set Phase 1 must reconcile against

**Onboarding / wizard**
`ONBOARD-SKIP-LABEL-01` (🟡 "Connect later" says "Connecting…") · `WIZARD-TIME-CHIPS-01` (🟡 time
chips break the duration rule; relabelling breaks saved drafts) · `INPUT-SEX-01` (🔲 P2, parked by
founder 2026-09-16) · `R23-D1`, `R23-D3`.

**Plan generation / refusals**
`MARATHON-VOLUME-GATE-01` (🔴🔴 P0 — ungoverned refusal in an API route, refuses marathon below
20 km/wk) · `LONGEST-RUN-GATE-01` (🔴 P1 — third ungoverned refusal in the same function) ·
`REFUSAL-SCREEN-01` (🔴 P1 — **a deliberate coaching decision is presented as a crash**) ·
`S111-SUBFLOOR-VOLUME-01` (🔴 P0, board INSUFFICIENT EVIDENCE, SLT escalated) ·
`FOUNDATION-DECIDE-LATER-01` (🔴 product call) · `FOUNDATION-ADD-FAIL-01` (🔴 P1 — add fails,
records nothing) · `CB-HILL-INJURY-01` (🔴 live safety defect).

**Plan screen / surfaces**
`PLAN-NOTE-PLACEMENT-01` (🔲 P2 — *does the rationale belong at the top of Plan at all?*) ·
`BRAND-MAINT-LABEL-01` (🟡 P2 — 4 of 5 marathon charity personas labelled `maintenance`) ·
`TT-PRICING-CLAIM-01` (🔲 — /pricing sells a projection absent on 58% of plans) ·
`TT-FREE-BENCHMARK-01` (🔲 — free runner prescribed a benchmark they cannot apply).

**Monetisation / tier**
`TIER-ENFORCE-01` (distance paywall is client-only) · `TIER-TRIAL-CONFIDENCE-01` (🔲 the trial is
not literally full access) · `GTM-FREE-HOOK-01` (🔲 free tier's only AI touchpoint is unreachable
by the users meant to convert) · `FIN-APPLE-COMMISSION-01` (🔲) · `GTM-11` pricing review.

**Charity / launch (P0–P1, October-dated)**
`GTM-CHARITY-05` · `-06` · `-07` · `-08` · `-09` · `OPS-VERCEL-PLAN-01` · `OPS-SUPABASE-PLAN-01` ·
`OPS-ANTHROPIC-CREDIT-01` · `LEGAL-PRIVACY-01` · `LEGAL-COUNSEL-01` · `CONSENT-DISCLOSURE-01` ·
`ENRICH-PII-MINIMISE-01`.

**Engine / coaching (board-owned)**
`LR-CONSEC-01` · `S24-FLOOR-REACHABILITY-01` · `STEPBACK-STALE-PEAK-01` · `S52-LOPSIDED-BOUND-01`
(reopened) · `LR-DELOAD-RESUME-01` (built and reverted as unsafe — kept as a record of what not to
retry) · `S112-HAZARD-01` (⏸️ unmeasurable) · `GRID-MARATHON-CAPABLE-01` · `GRID-COVERAGE-02` ·
`MAINT-LIVENESS-01` · `SWEEP-AGE-01` · `SWEEP-INJURY-01` · `LOPSIDED-ORDER-01` ·
`INV-MSG-ROUNDING-01` · `RACE-KEY-TWO-OWNERS-01` · `MARA-LR-LOWBASE-01` · `ULTRA-LR-ADEQUACY-01` ·
`RUBRIC-GAPS-01` · `GRID-EARLY-ONSET-01`.

**Defects**
`REFRAME-NOTE-LOSS-01` (🔴 P1 — runner writes a reflection, the AI call fails, **their words are
thrown away**) · `PLAN-WEEK-COLLISION-01` (shipped in two passes; heading still 🔴) ·
`DEPLOY-QUOTA-01` · `STRAVA-APP-INACTIVE-01` (external).

**Later / gated**
`R18` `R21` `R22` `R24` `R26` `R27` · `CA-05` `CA-08` · `AI-DEPTH-09` · `POST-RUN-03` ·
`POST-RUN-REFRAME-02` · `GTM-SEO-COMPARE-01` (weekly founder drip) · CO-ONE dismissal sheet ·
Zone-method selector · Supplementary session slots · `ZONE-BAND-01` (⏸️ blocked on 2 users) ·
`COHERENCE-SELECT-01` (⛔ build attempt 5 disproved attempt 4) · `POSTRUN-PLAN-FEEDBACK-01` (parked).

### Hand-corrections to the parse

- `PLAN-WEEK-COLLISION-01` — parsed OPEN; prose says shipped in two passes. **Closed.**
- `S52-LOPSIDED-BOUND-01` — parsed OPEN; index says closed as a negative result **and** the entry
  says reopened 2026-09-19. **Genuinely open**, re-diagnosed.
- `GTM-CHARITY-09` — declares five times; one item, **parked by the founder**.

---

## Three things the code contradicts in the brief

Recorded here as observations for Phase 1, not as conclusions.

1. **T-05's BEAT is already built.** "Strava connected → confirm the real number" exists as
   CI-4: `/api/wizard-benchmark-estimate` → *"Looks like a 10K in about 55:52"* → confirm or
   adjust → manual fallback. The source is HealthKit, not Strava, and it qualifies runs by HR zone
   rather than importing a race.
2. **P-05's "Step 3 of 7" reverses a shipped decision.** `ProgressLine` carries the reasoning in
   code (CI-1). If numbering is still wanted, that is a decision to overturn, not a gap to fill.
3. **T-06's BEAT rests on a premise the backlog already rejected.** "Sex — used for heart rate and
   pace modelling" would be an overclaim: `INPUT-SEX-01` records that *"knowing the runner is
   female changes no pace, zone or volume formula we currently hold"*, and that without the RED-S
   work it is "a field that is collected and unread".

---

## What this audit does not prove

- **It is a static read.** Nothing here was run on a device or in a browser. Every "renders X" is
  read from JSX, not observed. Device verification remains founder-owned and open.
- **It does not cover marketing surfaces.** `app/page.tsx`, `/pricing`, `/privacy`, `/comparisons`
  were excluded from the colour scan and every screen question.
- **The 26 rgba figure is a grep, not a review.** Some may be legitimate scrims or overlays with no
  token equivalent. None was individually judged.
- **The backlog inventory is marker-parsed.** Three items were hand-corrected; others may be
  mis-classified the same way. The count derivation is stated so it can be re-run.
- **I did not open the screenshots.** Phase 0 is an audit of our code. Every visual judgement in
  Section 3 of the brief is deferred to Phase 1, where the instruction is to view all 17.
- **No falsification was performed on the gaps.** GAP-06 and GAP-10 are absences, which cannot be
  falsified by making a green check go red; they were confirmed by exhaustive grep for call sites
  and the commands are given so they can be re-run.
