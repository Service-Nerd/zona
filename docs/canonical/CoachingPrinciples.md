# Coaching Principles — The Constitution

**Authority**: Every principle in this document is implemented by exactly one named constant in `lib/plan/generationConfig.ts` (or one of the other config modules listed below). Changing a coaching numeric requires updating both this document and the config — they cannot drift.

This document is the *why*. `GENERATION_CONFIG` is the *what*. `lib/plan/ruleEngine.ts` is the *how*.

**Related**:
- `docs/canonical/coaching-rules.md` — operational rules (when to schedule, how to lay out a week, guard rails)
- `docs/canonical/zone-rules.md` — HR zone calculation
- `docs/canonical/session-catalogue.md` — concrete sessions the engine can schedule
- `docs/architecture/ADR-009-config-driven-generation.md` — why the config exists
- `docs/architecture/ADR-010-session-catalogue.md` — why the catalogue exists

---

## How to read this document

Each principle has three parts:

- **Principle** — the coaching idea, in plain language.
- **Why** — the reason. Often a brand position, an injury vector, or a non-elite-specific failure mode.
- **Config** — the named constant(s) in `lib/plan/generationConfig.ts` (or the related config files) that implement it.

If you are editing a numeric, you are editing this document. If you are editing this document, you are editing a numeric.

---

## How this document is amended

This document is the constitution. It is not edited casually, and it is not edited alone.

**Every change goes through the Coaching Board** — the `coaching-board` skill, chaired by Hutchinson with Seiler (intensity distribution), McMillan (practical coaching), Willy (injury/load), and Sims (female physiology). The board rules on **correctness**; the SLT rules on whether to build, tier, and fund. An INCORRECT ruling is a veto the SLT cannot overturn on commercial grounds. Full model: `docs/architecture/ADR-017-coaching-board-authority.md`.

Convening is automatic. `.claude/hooks/coaching-guard.py` fires on any edit to this file, `session-catalogue.md`, `zone-rules.md`, `coaching-rules.md`, `generationConfig.ts`, `planSignatures.ts`, or `sessionFormat.ts`.

**A CORRECT ruling produces three artifacts, in one commit:**

1. **The principle** — a new or amended section here, with its *why*
2. **The numeric** — the named constant in `GENERATION_CONFIG` (or a sibling config)
3. **The mechanical check** — the invariant in `lib/plan/invariants.ts` plus its row in `plan-invariants.md`

A principle without an invariant is unenforced; if a principle genuinely cannot be mechanically checked, say so explicitly in its section. That is a recorded risk, not an oversight.

Before the board speaks it runs a **conflict scan** across every section here, naming the section numbers a proposal touches, contradicts, or weakens. At 80 sections this is the step no reviewer can reliably do from memory — it is the reason the board exists.

**Exempt from review** (state the exemption in one line and proceed): defect fixes restoring already-documented intent; formatting and typo corrections; refactors with no behavioural delta; and writing up artifacts for a review that has already ruled.

---

## 1. Polarised training — protection from grey zone

**Principle.** Most running should be easy. The rest should be genuinely hard. Almost nothing should sit in the middle.

**Why.** Non-elites overtrain by spending too much time in moderate-effort grey zone — runs that feel productive but produce neither aerobic adaptation nor true stress response. The brand position ("Slow down. You've got a day job.") is a statement of this principle. The longer the race, the more skewed toward easy the distribution becomes — ultras are won in Z2.

### The distribution is a share of SESSIONS, plan-wide, and it is a CEILING — corrected 2026-08-20 (Coaching Board CD-19)

**Principle.** `INTENSITY_DISTRIBUTION` declares the **maximum share of a plan's running sessions** that may be quality work. Three words carry the meaning, and all three were previously wrong or unstated:

| | Value | Why |
|---|---|---|
| **Sessions** | not minutes | The 80/20 finding is a *session-count* observation — about four in five **sessions** below the first ventilatory threshold. By time the ratio is far more skewed, typically 90/10 or beyond, because easy sessions are long and hard ones are short. Applying a session-count ratio to a time denominator **inflates the target by roughly a factor of two.** |
| **Plan-wide** | not per-week | Base phase is deliberately all-easy (§4/§5) and peak weeks may carry two quality sessions (§8). A per-week ratio would forbid the second quality session at any week length we support (2 of 5 = 40%) and contradict §8. |
| **Ceiling** | not a target | This is the coaching content, not the number. |

```
5K / 10K     → max 25% of running sessions are quality
HM           → max 20%
MARATHON     → max 18%
50K          → max 15%
100K         → max 12%
```

**Why a ceiling and not a target.** A target invites the engine to close the gap — and the only place a periodised plan has room to add quality is base phase, which §4/§5 make all-easy on purpose. Worse, the population this product serves already drifts upward into Z3 without any encouragement: a ninety-minute window is where every session drifts when you want to feel like you worked. **Writing 25% as something to reach would spend it, and spend it in the grey zone — the exact failure mode Zonna exists to prevent, introduced by the product's own config.** A ceiling is also robust to the underlying 80/20 work having been derived largely from male cohorts.

**What the correction actually revealed — worth reading before trusting any other declared number.** The traced 12-week 10K plan delivered **9.6% quality by minutes** against a declared 25%, and that was read for four months as a fifteen-point under-delivery. It was nothing of the kind. Measured on the correct basis the same plan delivers **exactly 25% in every phase where quality is prescribed**, and 17.0% plan-wide once the all-easy base phase is included. **The engine was right; the config was wrong.**

The reason the error survived is §34, not coaching judgement: **the table was read by an offline script and by no engine code, and no invariant referenced it.** Nothing computed the number, so nobody could see which quantity it was. The value being wrong was downstream of it never being exercised.

**Counting rule.** The numerator is `quality` sessions. It excludes the §78 recalibration **time trial** — typed `hard` *precisely so that it does not count against* `QUALITY_SESSIONS_PER_WEEK_MAX` — and the **race** itself, which is the goal rather than training. Counting either would contradict the rules that gave them their types. The denominator is running sessions; strength and cross-train are not part of an intensity distribution.

**§7 remains independently binding.** A plan can satisfy this ceiling and still stack its hard days. The ratio is not a substitute for the 48-hour spacing rule.

**Config.** `GENERATION_CONFIG.INTENSITY_DISTRIBUTION` — keyed by race distance, field `max_quality_session_pct`. The field is named for its unit so a call site cannot mistake it again. Checked by `INV-PLAN-INTENSITY-DISTRIBUTION`.

**The values are ratified, with two amendments — Coaching Board CD-21 (2026-08-20).**

An earlier version of this section claimed the six values were *"verified against a 1,244,160-plan sweep"*. **That claim was void** — the sweep was silently generating *zero* plans (SWEEP-VACUOUS-01), so it verified nothing. Once repaired it produced a real finding, and the shape of that finding matters more than the numbers:

| Bucket | Cases | Worst | `volume_profile` |
|---|---|---|---|
| **A** — low-frequency | 5K/10K/HM @ 2 days · 50K @ 3 days · 100K @ 3 days | 28.6% | **`maintenance`** in every case |
| **B** — 100K build | 4d (14.0%) · 5d (14.7%) · 6d (12.2%) · 7d (12.2%) | 14.7% | **`build`** |

**The first reading of this — "the ceiling is day-count sensitive" — was wrong, and acting on it would have left the real defect standing.** Bucket A correlates perfectly with the *volume profile*; day count is merely what triggers §52. Bucket B has nothing to do with day count at all — a **seven-day** 100K build plan breaches. Two buckets, opposite treatments.

### Amendment 1 — the ceiling does not apply to `maintenance`-profile plans

Not a day-count exemption. A **profile** exemption, keyed to the state §52 already assigns.

**Why.** A distribution ratio presupposes enough sessions to distribute. At two runs a week there is no distribution to describe — **the ratio is not violated, it is undefined** (Seiler). §9 forces the long run to ~56% of a 2-day week's volume, so "long run plus one quality" is the only shape available; it is also exactly what a coach would write for a time-crunched runner chasing a 5K (McMillan). Forcing compliance would mean two easy runs and no quality — which for the peri- and post-menopausal runners in this cohort removes the single highest-value stimulus in the plan, and there are only two sessions to take it from (Sims).

**Scoped strictly to this ceiling** (Willy's condition of approval). §7's 48-hour spacing, §2's 10% rule, §9's ratio and §45's progression cap all remain fully binding on maintenance plans. This is not exempt-from-load.

**Recorded, not silently skipped.** §52 already emits `volume_constraint_note` explaining the plan's shape to the runner — that is the runner-facing half, and duplicating it in `rule_adjustments` would be noise. The skip itself is asserted in `intensityDistributionCd21.test.ts`, so widening the maintenance trigger cannot quietly drop plans out of this check. Precedent: `INV-PLAN-PEAK-LR-RACE-RATIO` relaxes on the same flag for the same reason.

### Amendment 2 — 100K: 12% → 15%

**The six values were authored under the MINUTES basis and carried across the basis change unchanged** — the same class of error as the original misfiling: a number surviving a change to what it means.

Seiler, on his own finding: under a **time** denominator ultra training genuinely does look far more skewed than 10K training, and a descending ladder 25 → 12 is defensible. Under a **session** denominator the two **converge**, because the ultra runner's easy sessions are long, not numerous. **The descending ladder is an artifact of the old unit.** He can ratify ~25% as a session share for road; nothing he published supports 12% for 100K on that basis.

The failing evidence — a 24-week, 6-day 100K build plan:

| phase | weeks | quality | running | share |
|---|---|---|---|---|
| base | 8 | 0 | 48 | 0.0% |
| build | 8 | 6 | 48 | 12.5% |
| **peak** | 4 | 8 | 24 | **33.3%** |
| taper | 4 | 3 | 19 | 15.8% |
| **total** | 24 | 17 | 139 | **12.2%** |

**Its peak runs two quality sessions a week — exactly what §8 grants an experienced runner.** At 12% this section and §8 were arithmetically incompatible, and the engine obeyed §8. **§1 is the section that yielded**, and that is recorded here so the next person to tighten it knows what they would break. `QUALITY_SESSIONS_PER_WEEK_MAX` stays distance-blind.

15% clears every observed build-profile 100K plan (worst 14.7%) without clearing them so widely the check stops binding.

**Unchanged, deliberately:** 5K/10K 25%, HM 20%, MARATHON 18%, 50K 15%. No build-profile plan fails them. **Seiler's dissent is recorded against 50K's 15%** — he holds it carries the same discredited basis. Hutchinson (chair) prevails: unfounded is not the same as wrong, and moving numerics with no failing evidence is how this config drifted from the engine in the first place. A 50K build-profile breach reopens it.

**Severity restored to `error`.** It was `warn` for one day while the values were unratified. Willy, decisive: an `error` firing on 71% of a distance's plans is not a safety mechanism — it is noise, and noise gets suppressed, which is how a real violation gets missed later.


---

## 2. The 10% rule — injury prevention through gradual load

**Principle.** Weekly volume increases by no more than 10%. Returning runners with a deep training history get a temporary 15% allowance for the first three weeks.

**Why.** Rapid increases in training load relative to what the body is *accustomed to* are associated with injury in non-elite runners. Note the framing carefully — the risk lives in the relationship between acute and chronic load, not in the week-on-week delta considered alone. Nielsen's work points at change relative to recent chronic load; Buist's 2008 RCT found a graded 10%/week programme produced no injury reduction versus a control programme, so the rule is a useful heuristic for *sustained* ramping, not a law of physiology. It is applied here as a guard against enthusiasm, which is what it is good for.

*(Rationale rewritten 2026-08-06 — the previous text read "the 10% rule is a coaching cliché because it works", which is not defensible and led directly to the misapplication below.)*

The returning-runner exception acknowledges that an experienced runner rebuilding from a layoff is not the same as a beginner adding load — they have an aerobic and structural base waiting to be reawakened.

### The cap does not apply to a post-deload bounceback — amended 2026-08-06 (GEN-FIX-07 / D1)

**Principle.** The week following a recovery week may return to the **pre-deload volume** without the 10% cap applying. It may not exceed it; growth resumes from there the following week.

**Why.** The cap previously applied to the bounceback, and the arithmetic is fatal: a deload drops to `RECOVERY_WEEK_VOLUME_PCT` (70%), so the next week could rise only 10% above *that* — 77% of where the runner already was. Every deload ratcheted the ceiling permanently downward, which makes progressive overload **arithmetically impossible in any plan containing a recovery week** — that is, every plan of four weeks or more. The first organic user's 14-week half-marathon plan peaked in **week 3**, in the base phase, and never recovered; four of seven simulated personas peaked outside the peak phase.

Returning to a volume held comfortably two weeks earlier is not a spike. Chronic load has not moved — under any acute:chronic framing (the model this product already uses elsewhere for readiness) it is a **low**-risk week. No mainstream periodisation model applies a ramp cap to a bounceback; the near-universal convention is that a deload is a step back *within* a block and the following week resumes from the pre-deload level.

**Config.** No new numeric — the ceiling is the pre-deload week's volume, read from the sequence itself.

**Enforced by** `INV-PLAN-PEAK-IN-PEAK-PHASE` (warn) and the existing `INV-PLAN-PEAK-OVER-BASE`.

**Config.**
- `GENERATION_CONFIG.MAX_WEEKLY_VOLUME_INCREASE_PCT = 10`
- `GENERATION_CONFIG.RETURNING_RUNNER_ALLOWANCE_PCT = 15`
- `GENERATION_CONFIG.RETURNING_RUNNER_GRACE_WEEKS = 3`

**Volume sequence initialisation.** The starting weekly volume is clamped to a band relative to the user's target peak weekly km — too low and the plan never reaches peak; too close to peak and there's no room to ramp.
- `GENERATION_CONFIG.BUILD_VOL_INIT_FLOOR_VS_PEAK = 35` — floor: starting volume is at least 35% of peakKm.
- `GENERATION_CONFIG.BUILD_VOL_INIT_CEILING_VS_PEAK = 85` — ceiling: starting volume is at most 85% of peakKm.

A returning runner is identified by the wizard inputs `training_age > 2 years` AND `current_weekly_km < (typical for fitness level)`.

---

## 3. Recovery weeks — adaptation happens in rest

**Principle.** Every fourth week is a recovery week — volume drops to 70% of the prior build week. Masters athletes (age ≥ 45) recover every third week instead.

**Why.** Stress + rest = adaptation. Without the rest, the stress accumulates as fatigue and injury. The 4:1 cadence is a non-elite default; masters need more recovery because connective tissue and hormonal recovery slow with age.

**Config.**
- `GENERATION_CONFIG.RECOVERY_WEEK_FREQUENCY_STANDARD = 4`
- `GENERATION_CONFIG.RECOVERY_WEEK_FREQUENCY_MASTERS = 3`
- `GENERATION_CONFIG.MASTERS_AGE_THRESHOLD = 45`
- `GENERATION_CONFIG.RECOVERY_WEEK_VOLUME_PCT = 70`

Age is derived from `user_settings.date_of_birth` at plan generation time.

---

## 4. Phase structure — base, build, peak, taper

**Principle.** Plans progress through four phases. Each phase has a different purpose, a different intensity distribution, and a different long-run fraction.

**Why.** Specificity rises as the race approaches. Early phases build the aerobic engine; later phases sharpen for the demands of the actual race.

**Config.**
- `GENERATION_CONFIG.PHASE_DISTRIBUTION` — base 35%, build 35%, peak 15%, taper = remainder from `TAPER_BY_DISTANCE`
- `GENERATION_CONFIG.SPECIFICITY_BY_PHASE` — base/build/peak/taper general:specific ratios

---

## 5. Specificity — sessions resemble race demands as race approaches

**Principle.** Base phase work is general aerobic. Peak phase work looks like the race. Taper is mostly race-pace touches.

**Why.** The body adapts to what it is asked to do. A marathoner who has never run at marathon pace will run their first marathon-pace minutes on race day. The peak phase is where this is fixed.

**Config.** `GENERATION_CONFIG.SPECIFICITY_BY_PHASE`

```
base   → 100% general / 0% specific
build  → 70% general  / 30% specific
peak   → 40% general  / 60% specific
taper  → 30% general  / 70% specific
```

Specific work is selected from the catalogue (`session_catalogue.category = 'race_specific'` or `'ultra_specific'`).

---

### VO2max belongs in build, not only in peak — added 2026-08-20 (Coaching Board CD-16 / CD-22, SC-07)

**Principle.** For 5K and 10K, the first VO2max session must land early enough to adapt to: at least `VO2MAX_ONSET_MIN_ADAPTATION_WEEKS` of build/peak must follow it before the taper begins. VO2max is therefore eligible in **build**, not peak alone.

**Why — and the argument is this constitution's own.** SC-05 amended §22 so that for 5K/10K *"specific" resolves to race pace, not VO2max*. That reclassified VO2max as **general** work. §5's ladder puts build at **70% general** and peak at **40% general**. So after our own ruling, **build is where VO2max belongs, and peak-only was a leftover from the superseded assumption that VO2max was the specific work for a 10K.** The catalogue was never updated to follow the ruling.

Seiler, recorded: two isolated exposures in the last weeks before a taper are *the worst available position* — the full injury and fatigue cost of the hardest work in the plan, and none of the adaptation. *"Either commit to it properly in the build, or do not do it. The middle position is the only indefensible one."*

**The traced 12-week 10K before and after:**

| | Before | After |
|---|---|---|
| VO2max weeks | W9, W10 (peak, consecutive) | **W5** (build), W9, W10 |
| Gap to taper | 2 weeks | **6 weeks** |
| Quality sessions | 6 | **6 — unchanged** |

**Session-neutral, and that is binding (Seiler).** Build keeps **one** quality session per week; *what* it is rotates. **Build carries at most ONE VO2max exposure** — without that cap the rotation cycles back and a three-week build runs vo2max/threshold/vo2max, producing four VO2max sessions where the plan had two. *"Moving VO2max earlier must not become more VO2max."* Option B — a second build quality session — was **rejected unanimously**: it adds load to reach a stimulus, takes that volume from the easy running, and contradicts CD-20's arithmetic.

**Three locks held it, and finding all three mattered.** Granting the catalogue rows build eligibility **provably changed nothing** — verified experimentally before the board ruled. (1) `phase_eligibility: ['peak']`; (2) `preferredQualityCategory` hardcoded `'threshold'` for build and **never read the signature's `quality_categories_focus`**, so the 10K signature's declared focus was decorative; (3) build carries one quality slot, and the second slot — which flips to the alternate category — exists only in peak.

**Willy's gate, a condition of approval.** The week introducing VO2max **holds volume flat**. Intensity and volume do not progress in the same week (§2). Implemented by extending the existing volume/quality split rather than duplicating it. On a 12-week plan this is satisfied incidentally, because a deload precedes peak — *that coincidence is a property of one plan shape and is not the rule.*

**The window is binding where reachable, recorded where not (CD-22).** Below ~12 weeks the deadline falls inside base phase, where no quality session exists, so the window is arithmetically unsatisfiable — and `5K.min_weeks` is 8, so those plans are **supported, not hypothetical**. The number is **not lowered** to make them pass (the adaptation window does not shrink because the runner chose a shorter plan — Seiler), and generation does **not** throw (refusing a plan over a window its own geometry cannot contain is a crash, not enforcement — Hutchinson). The plan records `V2-vo2max-onset-unreachable` and says what it can and cannot deliver. **Same shape, same treatment, third time:** CD-20 recorded the withheld second quality; CD-21 exempted maintenance plans from §1.

**The old advisory is deleted, not amended.** The engine used to log *"No swap — catalogue places VO2max only in peak phase for this race distance"* and proceed. That sentence is now false, and a stale excuse in the record is worse than no record. A principle the engine logs a violation against and then proceeds past is not a principle (Hutchinson).

**Blast radius — only 5K and 10K move, by construction.** HM/MARATHON focus on `['threshold', 'race_specific']` and 50K on `['threshold', 'ultra_specific']`, whose second entry filters out as long-run-slot work; 100K's `['ultra_specific']` filters to empty and falls back to threshold. Asserted in `vo2maxOnsetPlacement.test.ts`.

**Config.** `GENERATION_CONFIG.VO2MAX_ONSET_MIN_ADAPTATION_WEEKS` (5); `PLAN_SIGNATURES[distance].quality_categories_focus` is now **load-bearing** in build. Enforced by `INV-PLAN-VO2MAX-ONSET`.

---

## 6. Taper — maintain intensity, cut volume, never detrain

**Principle.** Volume drops sharply in the taper. Intensity is kept — quality sessions stay on the schedule, just shorter. The race week is for shakeouts, not training.

**Why.** Detraining shows up within 10 days of stopping intensity. Keeping a single quality session per taper week preserves neuromuscular sharpness without adding fatigue. Volume is cut because volume is the fatigue driver.

**Config.**
- `GENERATION_CONFIG.TAPER_BY_DISTANCE` — taper duration (days) and volume reduction (% per week) per distance
- `GENERATION_CONFIG.TAPER_QUALITY_PER_WEEK` — quality session count per taper week, race week always `0`

**Enforcement — taper copy may not misstate taper length.** A coach note that names a taper duration ("Two week taper") MUST match the actual number of taper-phase weeks. `applyV7TaperRationale` (`lib/plan/ruleEngine.ts`) derives the word from the real week count (the source fix for analysis F9, where the note read from race distance while the length read from config — two owners for one fact). `INV-PLAN-TAPER-COPY-MATCHES-DURATION` in `validatePlan()` is the mechanical backstop at **error** severity: it re-derives the taper-week count and errors on any note that disagrees, so a future hardcoded taper string cannot silently reintroduce the lie. *(Backstop added 2026-08-06 per GEN-FIX-12, SLT Flag 2 — closes the 2-of-3 constitutional gap the incident's own §9 named deploy-blocking.)*

```
5K / 10K     → 10 days, 35% reduction, [1, 0]
HM           → 14 days, 45% reduction, [1, 1, 0]
MARATHON     → 21 days, 55% reduction, [1, 1, 1, 0]
50K          → 21 days, 55% reduction, [1, 1, 1, 0]
100K         → 28 days, 60% reduction, [1, 1, 1, 1, 0]
```

---

## 7. Hard / easy — never two hard days in a row

**Principle.** A quality session and a long run are both fatiguing. They cannot be back-to-back.

**Why.** Running a long run on heavy legs from a hard session the day before is the most reliable injury vector for non-elite runners with limited recovery time. Standard practice is at least 48 hours between any two stressors.

**Config.**
- `GENERATION_CONFIG.MIN_HOURS_BETWEEN_QUALITY = 48`
- `GENERATION_CONFIG.MIN_HOURS_BETWEEN_QUALITY_AND_LONG = 48`

Note: the rebuild spec proposed 24 h for the second value. Overridden to 48 h on coaching grounds — for the target audience, 24 h is the typo, not the rule.

---

## 8. Quality session frequency — fitness ceiling

**Principle.** A user's fitness level caps how many quality sessions per week the engine may schedule.

**Why.** A beginner asking for "intermediate" structure breaks down. Quality work requires an aerobic base to absorb it. The ceiling exists so the engine cannot generate a plan that the user is not ready to run.

**Config.** `GENERATION_CONFIG.QUALITY_SESSIONS_PER_WEEK_MAX`

```
beginner     → 0 (no quality at all in base; light tempo only after week 4)
intermediate → 2
experienced  → 2
```

(Spec proposed 3 for experienced. Overridden to 2 — for the target audience, the third quality session is rarely accommodated by life and consistently produces the symptoms ZONNA exists to prevent.)

**Quality session sizing:**
- `GENERATION_CONFIG.QUALITY_SESSION_PCT_OF_WEEKLY = 18` — primary quality session distance as % of weekly volume.
- `GENERATION_CONFIG.SECONDARY_QUALITY_PCT_OF_PRIMARY = 80` — when two quality sessions are scheduled (peak experienced), the second is 80% of the first. Different stressor profile, slightly less volume.

> **⚠️ The flat share inverts the main-set ordering. Known-open defect, measured but not fixed — SC-10 / CD-14, 2026-08-20.**
>
> Every quality session is sized identically, whatever kind it is. That is the CD-1 error one layer down, and it is **not neutral**. Delivered **main set** (session minus the warm-up floor and cool-down — the coaching-meaningful quantity) on the traced 12-week 10K:
>
> | Stimulus | Main set |
> |---|---|
> | **vo2max** | W9 **30 min**, W10 **32 min** |
> | race pace | W6 22 min, W7 26 min |
>
> The coaching truth is the reverse: *twenty-five minutes of threshold work is a normal session; twenty-five minutes of VO2max work is a race.* 32 minutes of continuous Zone 4–5 for a 43-year-old on 57 km/week is roughly a 10K race. And because sizing keys off weekly volume, **the VO2max session grows as volume peaks** — anti-correlated with the capacity to absorb it (Seiler), and worst for peri- and post-menopausal runners whose between-bout recovery is slower (Sims).
>
> **Why the fix was built and did not ship, and it is not a calibration problem.** Category percentages were implemented and swept across 13–17% for `vo2max`:
>
> | Value | Result |
> |---|---|
> | 13–14% | Peak week falls **below** the build week before it (§23) — volume freed from quality has nowhere to go, because easy runs are already at their §9 ceiling (`easy ≤ long / LONG_RUN_MIN_RATIO_VS_EASY`), so it is **lost** from the week rather than reallocated |
> | 15% | Passes the canonical 10K case, then fails at scale: **187 ordering breaches, 220 sessions under the size floor, 37 peak inversions** across 18,056 plans |
> | 17% | Ordering breaks outright |
>
> **The conclusion is about CD-14's premise, not its percentages.** Sizing quality as a *share of weekly volume* cannot express "VO2max is the least sustainable per minute", because share-of-volume makes every session scale with the week it sits in — and VO2max is scheduled in peak, the biggest weeks of all. **The main set needs sizing in absolute minutes, decoupled from weekly volume.** That is a change to the duration model, not a config edit: tracked as **SIZING-REALLOC-01**, paired with SC-08.
>
> **Hutchinson's CD-14 amendment 3, discharged:** the audit's claim that its model "validates" the 18% constant recovered its own inputs and is **withdrawn**. 18 was never justified either. Neither number has external support, and this section no longer implies otherwise.
>
> Checked by `INV-PLAN-MAIN-SET-ORDERING` at **`warn`** — declared *and* exercised (§34 satisfied), with the value open. It returns to `error` when SIZING-REALLOC-01 lands. Willy's CD-14 amendment 2 (a rep-count ceiling per category, with the budget overflowing into rep *length*) is **blocked on SC-08** — reps do not reach the plan at all today, so a ceiling on them cannot be expressed or checked.

### A second quality session needs a week long enough to hold it — added 2026-08-20 (CD-20 / SC-01)

**Principle.** The fitness ceiling above caps how many quality sessions a runner may be *given*. This is the second constraint: the **week** must be able to carry it. Below `GENERATION_CONFIG.MIN_TRAINING_DAYS_FOR_SECOND_QUALITY` (**5**) training days, the engine places one quality session regardless of fitness — and **records the decision** rather than leaving a silent absence.

**Why — this is arithmetic, not preference.** Quality consumes `18% + (18% × 80%) = 32.4%` of weekly volume. The remaining 67.6% must fit into the long run plus the easy slots, and easy is capped at `long / 1.25` by §9 (the long run stays the longest run of the week):

| Training days | Capacity | Against 67.6% needed |
|---|---|---|
| **4** — long + 1 easy | ≤ 1.8 × long ≈ **58%** of the week | **~8% structural shortfall** |
| **5** — long + 2 easy | ≤ 2.6 × long ≈ **83%** of the week | comfortable |

On four days the week cannot carry two quality sessions without either breaking §9 or under-delivering ~8% of its own volume. Observed in generation: peak fell 57 → 53 km, below the build peak, tripping §23. On five days volume held (57 → 58 km).

**And the shortfall comes out of the wrong thing.** The only slot left to absorb it is the easy run — the aerobic work that builds the tissue tolerance the hard sessions depend on (Willy), and which carries a disproportionate share of the bone-loading stimulus for peri- and post-menopausal runners (Sims). *Intensity up, easy volume down, same week* is the combination §2 exists to prevent.

It is also **3 of 4 sessions hard — 50% by session count**, against §1's 25% plan-wide ceiling.

**The history matters, because it nearly went the other way.** The engine had no such rule. It was blocking the second session on four-day weeks *by accident*, through a hardcoded candidate-day list that also never considered Friday — so it was simultaneously protecting four-day runners for the wrong reason and denying five-day runners a session they should have had. Fixing the placement defect without adding this rule would have converted a hidden bug into an explicit overload. **A defect that produces the right outcome is still a defect; the fix is to write the rule down, not to keep the bug.**

**Config.** `GENERATION_CONFIG.MIN_TRAINING_DAYS_FOR_SECOND_QUALITY = 5`. Enforced by `INV-PLAN-SECOND-QUALITY-MIN-DAYS`. The withheld decision is recorded on the plan as `rule_adjustments` entry `V8-second-quality-min-days`. §7's 48-hour spacing remains independently binding — this rule never licenses stacked hard days.

---

## 9. Long-run rules — fraction of weekly, capped by distance

**Principle.** Long runs scale with weekly volume (so a 30 km/week runner does not get the same long run as a 60 km/week runner). They are also capped by an absolute time ceiling per race distance.

**Why.** A long run that exceeds 35% of weekly volume is a binge — fatigue accumulates faster than aerobic gain. The absolute cap (in minutes, not km) protects against unrealistic time-on-feet for the race.

**Config.**
- `GENERATION_CONFIG.LONG_RUN_PCT_OF_WEEKLY_VOLUME` — phase-aware (base 28%, build 30%, peak 32%, taper 40%)
- `GENERATION_CONFIG.LONG_RUN_CAP_MINUTES` — per distance (90/120/135/210/300/420)
- `GENERATION_CONFIG.WEEK_1_2_LONG_RUN_CAP_MULTIPLIER = 1.1` — first two weeks may not exceed `longest_recent_run_km × 1.1`
- `GENERATION_CONFIG.LONG_RUN_MIN_RATIO_VS_EASY = 1.25` — long run must always be ≥ 1.25× the easy session distance. Engine redistributes weekly volume when the natural phase-fraction would invert this (low-volume / low-day-count plans).
- `GENERATION_CONFIG.MIN_SESSION_DISTANCE_KM` — floor distances per session type (long: 5, easy: 4, quality: 5, secondary_quality: 4). Below these, the session is too short to be coaching-meaningful.

---

## 10. VDOT conservatism — protect users from themselves (selectively)

**Principle.** Training paces derived from a benchmark are discounted by 3% by default for **easy** and **threshold** paces. Stale benchmarks (more than 6 months old) get a further 5% discount. **Interval (VO2max) paces use the raw benchmark VDOT** — no conservatism discount — because under-stimulating VO2max sessions undermines the adaptation they exist to produce.

**Why.** A non-elite runner who PBs a 5K and then trains at 100% of the implied VDOT pace on every easy run is a runner about to get injured. The discount on easy and threshold paces acknowledges that race-day pace is a peak output, not a sustainable training pace, and that fitness drifts — exactly where "going hard on the easy days" risk lives. But VO2max sessions are short, structured, with full recovery; they are MEANT to be hard. Discounting them produces under-stimulus and the runner loses the top-end adaptation. The conservatism principle and the polarised-training principle (§1) point the same way: protect easy days fiercely, train VO2max honestly. *(Doctrine clarified 2026-05-25 / R2/H-01 — Stance B.)*

**Config.**
- `GENERATION_CONFIG.VDOT_CONSERVATIVE_DISCOUNT_PCT = 3`  (applied to easy + threshold paces only)
- `GENERATION_CONFIG.VDOT_STALE_BENCHMARK_ADDITIONAL_DISCOUNT_PCT = 5`
- `GENERATION_CONFIG.VDOT_STALE_BENCHMARK_MONTHS = 6`

Implemented in `buildPaceFromVDOT(discountedVdot, rawVdot)` in `lib/plan/ruleEngine.ts`. Easy/quality paces use `discountedVdot`; interval pace uses `rawVdot`. The applied discount is surfaced in `plan.meta.vdot_discount_applied_pct` so the user can see what the engine did and why.

**A sub-6-month runner's declared volume is capped, because it is a claim, not a measurement.** *(CD-6, SLT-signed 2026-08-06.)* `current_weekly_km` comes from a wizard bucket ("20–40 km" → midpoint), taken at face value. For a `training_age: '<6mo'` runner that is the whole plan's foundation — it drives the fitness classification, the starting volume, and whether the runner gets any quality at all — and the downside of an over-claim is a genuine beginner handed an intermediate's load. So the starting volume is capped at `GENERATION_CONFIG.BEGINNER_WEEK1_VOLUME_CAP_KM = 30` regardless of what was declared (belt). Where a HealthKit connection exists, the declared figure should additionally be tempered toward the observed 4-week average (braces, ADR-011) — the device-only half, tracked in backlog PV2-E. This is §10's "protect users from themselves" applied to the input, not just the paces.

---

## 11. Pace ranges, not points

**Principle.** Pace targets are always quoted as ranges (e.g. `5:50–6:05 /km`), not point values.

**Why.** A point value is read as a target to hit. A range is read as a band to stay inside. The latter trains the right behaviour: pace discipline, not pace chasing.

**Config.** `GENERATION_CONFIG.USE_PACE_RANGES_NOT_POINTS = true`

**Display precision:**
- `GENERATION_CONFIG.DISTANCE_ROUNDING_PRECISION_KM = 0.5` — every session distance rounds to the nearest 0.5 km before display. 11.9 → 12.0; 14.7 → 14.5; 8.4 → 8.5. Whole-number-ish without losing useful precision.

---

## 12. Easy-run zone cap — Z2 ceiling

**Principle.** Easy runs are capped at the top of Z2.

**Why.** Z2 is the band where aerobic adaptation happens without accumulating fatigue. Running easy at Z3 looks productive — it is the grey zone the brand is built to prevent.

**Config.** `GENERATION_CONFIG.EASY_RUN_ZONE_CAP = 'Z2_TOP'` — resolves at runtime to the top of `GENERATION_CONFIG.ZONES.Z2` for the user's active zone method.

---

## 13. Fitness classification — VDOT first, volume fallback

> **Superseded for the classifier logic by §79 (dual-signal), SLT-approved 2026-08-06 (GEN-FIX-07/D2).** VDOT-first with a volume fallback misclassified a 30 km/week runner as a beginner on one slow 5K. §79 now requires VDOT *and* volume to agree before applying the beginner intensity ceiling. This section is retained for the definition of the three levels and their thresholds; the *derivation* rule is §79's.

**Principle.** Fitness level is one of `beginner | intermediate | experienced`. VDOT and weekly-volume signals both feed the classification — see §79 for how they combine.

**Why.** VDOT and volume answer different questions (speed vs durability); neither alone is sufficient, which is why §79 requires both.

**Config.**
- `GENERATION_CONFIG.FITNESS_VDOT_THRESHOLDS` — `intermediate_min = 35`, `experienced_min = 50`
- `GENERATION_CONFIG.FITNESS_VOLUME_THRESHOLDS` — beginner/experienced weekly-km + longest-run cutoffs
- Classifier: `assessFitness()` in `lib/plan/ruleEngine.ts` (§79)

---

## 14. HR zones — five zones, two formulas, one config

**Principle.** Five named zones (Z1–Z5) with explicit % bands. Karvonen (HR Reserve) when the user's resting HR is known; %MaxHR when only max HR is known.

**Why.** Five zones is the convergent industry standard (Daniels, Friel, Coggan all collapse cleanly to five). Karvonen is more personalised when RHR is captured. The %MaxHR fallback exists so a user without RHR still gets meaningful targets, not a refusal.

**Config.** `GENERATION_CONFIG.ZONES`

```
Z1 → 50–60% HRR  / 65–70% MHR
Z2 → 60–70% HRR  / 70–80% MHR
Z3 → 70–80% HRR  / 80–87% MHR
Z4 → 80–90% HRR  / 87–93% MHR
Z5 → 90–100% HRR / 93–100% MHR
```

The forward-compat hook for a future paid "zone method selector" feature lives here. Adding Daniels, Coggan, or Friel zone tables means adding a new key under `ZONES` and a single `user_settings.zone_method` lookup. See `docs/canonical/zone-rules.md`.

> **⚠️ Zone-label collision — read before importing any external source.**
> This five-zone model is **canonical for Zonna**. In it, **Z2 is easy** (the target
> for easy runs, capped at the top of Z2 per §12) and **Z3 is the grey zone** (§1).
>
> Three-zone models — including Stephen Seiler's, the origin of the 80/20 finding —
> label the moderate/threshold band **"Zone 2"** and call *that* the grey zone.
> **The same label means the opposite thing.** Any three-zone reasoning must be
> translated on the way in: an external "too much Zone 2" means "too much Zonna Z3."
>
> A review note that appears to attack Z2 easy running is almost certainly a
> translation failure rather than a real finding. Recorded here because zones are the
> brand and this collision would otherwise produce confident, entirely phantom
> conflicts. See ADR-017 §6.

---

## 15. Tier semantics — Option A: granted-at-trial, retained-in-free

**Principle.** What a user gets during their 14-day trial is theirs to keep within the free tier — *for the plan they generated*. Ongoing intelligent features (new plan generation, dynamic reshaping, AI coach notes on new sessions, Strava-derived intelligence) become paid-only at downgrade.

**Why.** The brand position is that free users are never abandoned. Stripping a user's plan after 14 days violates that. But ZONNA is also a business — ongoing intelligence is the value the subscription buys. Option A is the line.

**Config.** `lib/plan/featureGates.ts`:
- `FEATURE_GATES.GRANTED_AT_TRIAL_RETAINED_IN_FREE` — personalised plan, VDOT pace zones, HR zones, AI coach notes that already exist on a plan, full session catalogue, initial injury adaptations
- `FEATURE_GATES.PAID_ONLY_ONGOING` — dynamic reshape (R20), new AI coach notes, new injury adaptations, Strava intelligence, confidence score, ultra plan generation, tailored strength sessions
- `FEATURE_GATES.FREE_ALWAYS` — generic plan templates, rule-engine regeneration (no AI), manual session completion, plan view, basic strength sessions

**Note (R23-D6 resolution, 2026-04-25):** Plan regeneration itself is free —
users may rerun the wizard at any time. The paid value on regen is the AI
enrichment layer (gated via `ai_coach_notes_new`), not the act of regenerating.

---

## 16. Universal run format — every run has a shape

**Principle.** Every run prescribed by the engine has a structured warm-up, main set, and cool-down. Quality sessions add strides. Marathon and half-marathon long runs in peak phase add a race-pace segment.

**Why.** Telling a user "run 8 km easy" leaves the question of warm-up and cool-down unanswered. The structured format teaches the right habit and prevents the most common quality-session error (skipping the warm-up and starting cold into intervals).

**Config.** `lib/plan/sessionFormat.ts` exports `SESSION_FORMAT`:
- 10/80/10 warm-up/main/cool-down split, with minimums
- Quality warm-up minimum 15 minutes
- Strides: 4 × 20s for quality
- Long-run race-pace: 20% of session time at race pace, peak phase, HM and MARATHON only

---

## 17. Plan signatures — distance shapes the plan

**Principle.** Each race distance has a signature: minimum/ideal/maximum weeks, default sessions per week, taper final session, and the catalogue categories that apply.

**A declared focus MUST be reachable (amended 2026-08-20, CD-15 / SC-04).** `quality_categories_focus` is a promise about the plan's shape, not a label. For every distance, each declared focus category MUST have at least one catalogue session eligible for that distance outside base phase. A signature that names a category the catalogue cannot supply is a defect in one of the two, never an acceptable state.

**Why.** A 5K plan and a 100K plan share almost no structure beyond the four-phase shape. The signature captures the differences without forcing them into the engine's branching logic.

**Why reachability had to become a rule.** The 10K signature declared `['vo2max', 'threshold']` while **no threshold session was eligible for 10K at all**. Half the declared shape was unreachable, and the engine did not fail — it silently fell back to an aerobic row for the entire build phase and prescribed it at threshold pace (§19). The signature had become a statement of intent that no code was obliged to honour, and nothing compared the declaration against the catalogue. This is the §34 failure mode applied to plan shape: declared, never exercised.

**Config.** `lib/plan/planSignatures.ts` — `PLAN_SIGNATURES` keyed by distance. Enforced by `INV-PLAN-PHASE-FOCUS-REACHABLE`, which checks the declaration against `V1_SESSION_CATALOGUE` on every generated plan — so an unreachable focus surfaces on the first plan for that distance rather than waiting for an audit.

---

## 18. Blocked-day enforcement — life-first scheduling

**Principle.** Sessions MUST never be scheduled on days listed in `days_cannot_train`, regardless of week type (base, build, peak, taper, race). Race-week shakeouts MUST be placed on `days_available` only. If race-week scheduling cannot place two shakeouts without using a blocked day, place one shakeout — never violate the constraint to fit a default pattern.

**Why.** "Slow down. You've got a day job." is a literal claim. A user who cannot train on Tuesdays cannot train on Tuesdays in race week either. Hardcoded shakeout patterns (tue/thu) are residue from elite-runner templates and break the brand's core promise — that the plan respects the runner's life. The race week is the most visible week of the plan; getting it wrong undermines trust at the worst moment.

**Config.** No numeric — structural rule. Implemented by `blockedDays()` in `lib/plan/ruleEngine.ts` and enforced by `INV-PLAN-NO-SESSIONS-ON-BLOCKED-DAYS` in `lib/plan/invariants.ts`. The parser accepts both short forms (`'mon'`) and full forms (`'monday'`) so the engine is robust to wizard, API, and test inputs.

---

## 19. Session label integrity — name matches prescribed physiology

**Principle.** A session's name carries physiological meaning. If a session is named "VO2max" the prescription MUST land in Z4–Z5 at I-pace (95–100% vVO2max). If it is named "Threshold" / "Tempo" / "Cruise" the prescription MUST land in Z3 at T-pace (83–88% vVO2max). If a session is named after a race distance ("10K-pace intervals", "HM-pace intervals") the prescription MUST land within ±2% of derived goal pace. If the engine cannot satisfy the label given the runner's VDOT, it MUST rename the session to one the prescription does satisfy.

**The rule runs in both directions (amended 2026-08-20, CD-15).** A name that implies *easy* work — "Steady aerobic", "Aerobic with hills", "Easy", "Recovery" — MUST NOT be prescribed above Z2. Where a quality slot has no eligible session of the right category and the engine falls back to an aerobic catalogue row, it MUST rename that session to the label its *prescription* satisfies and MUST replace the row's coach voice (§33). An aerobic row's voice describes a Zone 2 run and is false on a session prescribed at T-pace.

**Why the second direction was missing, and why that mattered.** Every check originally asked one question — *the label claims hard work, is the pace hard?* Nothing asked the inverse. So a session named "Steady aerobic", prescribed at T-pace in Zone 3–4, raised no violation: the label contains none of the words the check inspects. This was not hypothetical. Because no threshold session is eligible for 5K or 10K (§24b, SC-04), the selector fell back to an aerobic row for the **entire build phase** of every 5K and 10K plan, and the engine then prescribed it at threshold pace. That shipped to production. It is §1's grey zone — the thing this product exists to prevent — arriving under a name that tells the runner they are taking it easy, which is the most effective possible way to produce it.

**Why.** A non-elite runner cannot tell from feel whether 5:00/km is VO2max work, threshold, or 10K race pace — they trust the name on the card. Mislabelling trains the wrong system: prescribing T-pace under a "VO2max" label gives the runner threshold adaptations and the false belief they're doing VO2max work. The first time they meet true VO2max pace will be on race day or in a future plan, and it will hurt for the wrong reasons. In the easy-label direction the harm is worse, because it is the one the brand is built against: a runner told "steady aerobic" and prescribed threshold has no way to know they are being asked to hold the wrong zone, and §12's easy-run ceiling is breached silently.

**Config.** No numeric — structural rule. Implemented by `makeQualitySession()` in `lib/plan/ruleEngine.ts`, which dispatches on `catalogueRow.category` (structural, never the label — INV-CLASS) and renames a repurposed aerobic row to the engine's own threshold label. Enforced by `INV-PLAN-LABEL-MATCHES-PACE` in `lib/plan/invariants.ts`, which now checks both directions. The `PaceGuide` interface carries `intervalPaceStr` (I-pace) and `qualityPaceStr` (T-pace) as separate bands so the engine can prescribe the correct one for each catalogue category.

**Known limitation (SC-08).** The invariant's easy-direction check is *label*-based, unlike the engine's, because the plan session carries no reference to the catalogue row that produced it — the reps and the category are re-joined at display time by matching the session's name. When SC-08 puts the row's identity on the session, re-key this check on the structural category. Until then, a hand-written or AI-rewritten label that avoids the four watched words can still evade it.

---

## 20. VDOT surface — auditable, table-comparable

**Principle.** The VDOT surfaced on the plan (`meta.vdot`) MUST be the *raw* benchmark-derived value, not the conservatism-discounted training anchor. The discounted anchor is also surfaced, separately, as `meta.vdot_training_anchor`. The gap between the two is `meta.vdot_discount_applied_pct`. Goal pace (`meta.goal_pace_per_km`) is computed from `target_time / race_distance_km` directly — it is the runner's stated target, not a derived training pace.

**Why.** A user who runs a 23:30 5K opens Daniels' Running Formula and sees VDOT ~41. If Zonna surfaces VDOT 40 (after a 3% discount) the user thinks the engine has miscalibrated their fitness. They lose trust. The discount is real and important — it produces the slow easy paces the brand exists to defend — but it lives in the *training paces*, not in the headline number. Surfacing both makes the engine's reasoning legible: "your benchmark gives VDOT 41; we're training at the 39.8 anchor for safety."

**Config.** No numeric — structural rule. Implemented in `generateRulePlan()` in `lib/plan/ruleEngine.ts` (raw and discounted both stored). Enforced by `INV-PLAN-VDOT-RAW-EXCEEDS-ANCHOR` in `lib/plan/invariants.ts`. The Daniels-Gilbert formula in `calcVDOT()` is intentionally conservative (~0.3 VDOT below his published 5K table at threshold race distances) — this is documented inertia from the published mathematics, not a bug; the table itself is interpolated.

---

## 21. Injury-aware session selection

**Principle.** `injury_history` modifies session *selection*, not just volume. During base and build phases, the engine MUST NOT prescribe hill repeats or steep-grade sessions to runners with knee, ITB, Achilles, shin, calf, or plantar history. Substitutes are progression runs or flat tempo at equivalent intensity. Peak phase may reintroduce hills only after a successful symptom-free build (a future paid feature; not yet wired).

**Why.** Hill repeats place loaded eccentric stress on the very tissues that are already symptomatic for these injury types — the knee under load on the descent, the Achilles at the top of each rep. The existing volume cap (5% week-on-week for knee/shin in §12) is necessary but insufficient; volume restraint cannot save a runner from inappropriate session *content*. The brand promise is "Slow down. You've got a day job." — a runner with a niggle still has both the niggle and the day job. The engine must respect both.

**Config.** `GENERATION_CONFIG.HILL_RESTRICTING_INJURIES = ['knee', 'itb', 'achilles', 'shin', 'calf', 'plantar']`. Catalogue rows tagged `main_set_structure.terrain === 'hills'` (or whose `id` contains `'hill'`) are excluded by `selectCatalogueSession()` when this filter applies. Enforced by `INV-PLAN-INJURY-NO-HILLS` in `lib/plan/invariants.ts`.

---

## 22. Race-specific exposure (time-targeted goals)

**Principle.** For `goal: time_target`, the runner needs sustained exposure to goal pace before race day. In the second half of the plan (weeks > ⌈total_weeks/2⌉), the engine MUST prescribe goal pace on the build/peak quality slot, with VO2max sessions exempt (their physiology is too valuable to lose). The session is renamed to a race-distance-specific label (e.g. "10K-pace intervals", "HM-pace intervals") and the prescription lands within ±2% of derived goal pace.

**Why.** A non-elite runner who has never run at goal pace in training will run their first goal-pace metres on race day. They will either go out at the wrong pace (because they don't know what it feels like) or fail to commit to it (because the pace feels alien). Specificity is the simplest fitness lever in coaching: if the race is at pace X, train at pace X. The brand promise is "training plans that stop you overtraining" — but a plan that's so cautious it never visits race pace is a plan that produces a race-day stranger to their target.

**"Specific" must resolve to a real catalogue entry, not a rename (amended 2026-08-20, CD-18 / SC-05).** A distance whose race pace is physiologically distinct from I-pace MUST own a `race_specific` catalogue session. The all-distance `goal_pace_sharpener` does not count as that distance's own entry. Where a distance-specific race session exists and is eligible, it is preferred over the generic — **most specific row wins**.

Applies to **10K, HM and MARATHON**. **5K is excluded**: at 5K, race pace and I-pace largely coincide, so the VO2max rows already deliver race-specific physiology. *Recorded as an engineering judgement for the board (SC-05): CD-18's "who this affects" says 5K has "the identical gap", but the audit's own analysis grounds the mismatch in race pace sitting **between threshold and VO2max for a 10K**, which does not transfer to 5K. If the board disagrees, add a 5K row and extend the invariant's distance list.*

**Why this needed saying.** 10K — one of two free-tier flagship distances — had no race-specific session while HM had two. That was not a decision anyone made; it is where the catalogue stopped. The gap was **invisible in the product** because the engine renames a borrowed row to "10K-pace progression", so the plan *looked* like it contained 10K-pace work. **§33 explicitly sanctions that rename and requires the borrowed voice be replaced — which the engine does correctly.** The failure is subtler and worth generalising: **§33 closed the review by fixing the symptom (borrowed voice) and left the cause (no 10K entry) in place. A principle can close a review without closing a gap.** Worth remembering the next time a principle is written to describe existing behaviour rather than to correct it.

**Config.** No numeric — structural rule. Implemented in `buildWeekSessions()` (`lib/plan/ruleEngine.ts`) which sets `goalPaceWeek` when `weekN > ⌈totalWeeks/2⌉`, `goal === 'time_target'`, and the phase is build or peak. `makeQualitySession()` honours the flag by overriding label and pace prescription. Taper selection ranks eligible `race_specific` rows by `distance_eligibility` size so the most specific wins without hardcoding ids. Enforced by `INV-PLAN-RACE-SPECIFIC-EXPOSURE` in `lib/plan/invariants.ts`, which now also requires the distance to own a real entry.

---

## 23. Peak overload requirement

**Principle.** A plan presented as a "build" must produce overload. For plans of `PEAK_OVERLOAD_MIN_PLAN_WEEKS` weeks or longer, peak weekly volume MUST be at least `PEAK_OVER_BASE_RATIO` times week 1 volume. If the engine cannot achieve this overload given the runner's constraints (`days_available`, `max_weekday_mins`, `current_weekly_km` already near peak target, injury caps), it MUST surface `volume_profile = 'maintenance'` with a `volume_constraint_note` explaining why. The plan still runs; the runner is informed of what it is and isn't.

**Why.** A plan whose peak equals its base is a maintenance plan, not a training plan. Selling it as a build is a trust violation: the runner expects to be fitter than they were when they started, and an honest engine says when that isn't possible. This case is most common when `current_weekly_km` is already close to the per-fitness-level target peak — there's nowhere to ramp to. Surfacing it lets the user adjust their inputs (e.g. spend a month consolidating before generating a build plan) instead of running a misleading 14-week loop.

**Config.**
- `GENERATION_CONFIG.PEAK_OVER_BASE_RATIO = 1.10`
- `GENERATION_CONFIG.PEAK_OVERLOAD_MIN_PLAN_WEEKS = 8`

Implemented in `generateRulePlan()` (`lib/plan/ruleEngine.ts`) which sets `plan.meta.volume_profile` and `plan.meta.volume_constraint_note` after week construction. Enforced by `INV-PLAN-PEAK-OVER-BASE` in `lib/plan/invariants.ts` — the invariant accepts either a passing ratio OR an explicit 'maintenance' classification.

**The beginner / finish-goal peak is specificity, not tonnage — said on purpose.** *(CD-10, SLT-signed 2026-08-06; D-19.)* For a low-training-age finish-goal runner the peak phase legitimately progresses via the **longest run and race-specificity (§80, time on feet), not more weekly volume.** Two consequences follow, and both are intentional, not defects: (1) once intensity enters the build, a hard session displaces a longer easy run, so *measured* weekly volume can hold or dip slightly even as training load rises — the plan's highest week may sit in the base phase; (2) such a plan is honestly classified `volume_profile = 'maintenance'` and its `volume_constraint_note` names the plan's true highest week so the figure can't mislead (V7). `INV-PLAN-PEAK-IN-PEAK-PHASE` stays **warn** for maintenance plans precisely for this reason. We do **not** force peak volume above base — doing so would raise injury risk for exactly the day-job runner this product protects (§1, §2), and contradicts the brand ("You're trying hard. That's the problem."). *Cleanup pending (CD-10a): the km-from-duration conversion in `sumWeeklyKm` divides every session's minutes by easy pace, under-counting hard sessions — correcting it to per-session pace removes most of the measured dip and is tracked as a fast-follow with its own volume-reclassification verification.*

---

## 24. Long-run race specificity (HM and marathon)

**Principle.** Time-targeted plans for HM and longer require race-distance specificity in the long run. For HM, peak long run MUST reach ≥85% of race distance; for marathon, ≥75%. Distances ≤10K have no such minimum (the long run is for aerobic development, not specificity). The absolute `LONG_RUN_CAP_MINUTES` ceiling per distance still wins — the engine never prescribes a long run that exceeds the time cap, even if doing so would satisfy this floor.

**Why.** A runner targeting a 1:55 HM who never runs a long run longer than 15 km will spend 6+ km of their race in genuinely unfamiliar territory. The fatigue profile of running for ~2 hours is fundamentally different from running for 100 minutes — pacing, fuelling, mental discipline. Without exposure to it in training, race day is a new experience. Daniels and Pfitzinger both prescribe long runs at 90–100% of race distance for HM specifically because of this. Capping at 15 km is a compressed-plan symptom; the principle exposes it as such.

**Config.** `GENERATION_CONFIG.PEAK_LR_RATIO_VS_RACE` — keyed by race distance:
```
HM       → 0.85  (≥17.9 km for a 21.1 km race)
MARATHON → 0.75  (≥31.7 km for a 42.2 km race)
```

Implemented in `buildWeekSessions()` peak-phase long-run sizing. The race-distance floor is applied between the early-week cap and the absolute time cap. Enforced by `INV-PLAN-PEAK-LR-RACE-RATIO` in `lib/plan/invariants.ts`.

---

## 24b. Long-run structure — 5K/10K peak phase (time-targeted)

**Principle.** For time-targeted 5K and 10K plans, the final two peak weeks embed two pace segments in the long run. The middle 20% of the run is at marathon pace (≈79% VDOT); the final 30% is at HM pace (≈84% VDOT). Both segments must be faster than the aerobic body of the run but substantially slower than race pace — the intent is to teach sustained effort under fatigue, not to simulate 5K race speed. Outside the final two peak weeks, the long run remains purely aerobic.

> **⚠️ Premise correction, 2026-08-20 (CD-15 / SC-04).** The "Why" below was written on the explicit premise that 5K/10K runners *already receive* threshold work — *"all their quality sessions at VO2max or threshold"*. **That premise was never true.** No threshold session was eligible for 5K or 10K until SC-04; those runners were getting VO2max in peak and an aerobic row prescribed at threshold pace in build (§19, SC-02). The board's conflict scan found this, and considered it closer to correcting a false statement in the constitution than to making a new coaching decision. The reasoning below still stands — but it stands *now*, because SC-04 made the premise true, not because it was true when written. **The lesson generalises: a principle can be written describing behaviour that does not exist, and nothing checks it. §17's reachability rule and `INV-PLAN-PHASE-FOCUS-REACHABLE` exist because of this section.**

**Why.** 5K and 10K runners often do all their long runs at Z2 and all their quality sessions at VO2max or threshold — the two extremes, nothing in between. The result is a runner who can grind long or go short-hard but has no ability to hold a sustained faster-than-easy pace at the end of a run when glycogen is depleted. Marathon pace is a physiological stimulus that specifically trains fat oxidation and glycogen economy without the muscle damage of full-race-pace intervals. HM pace at the finish, on tired legs, is the closest transferable simulation for the final 2K of a hard 10K. This is a specificity insertion, not a pace-work session.

**Config.** `GENERATION_CONFIG.LR_5K10K_PEAK_MID_SEGMENT_PCT` (0.20), `LR_5K10K_PEAK_FINAL_SEGMENT_PCT` (0.30), `LR_5K10K_PEAK_MID_PACE` (`'marathonPaceStr'`), `LR_5K10K_PEAK_FINAL_PACE` (`'hmPaceStr'`). Pace strings derived from `PaceGuide.marathonPaceStr` / `PaceGuide.hmPaceStr`. Applied in `buildWeekSessions()` when `distKey ∈ ['5K','10K']` and the week is in the final two peak weeks. Enforced by `INV-PLAN-5K10K-LR-PACE-CAP`.

---

## 24c. Long-run structure — build-phase Z2 ceiling (5K/10K, time-targeted)

**Principle.** In build-phase long runs for time-targeted 5K and 10K plans, the middle 10% of the run includes a short Z2-ceiling reminder segment — a brief emphasis on running at the top of Zone 2 rather than drifting above it. This is not a pace segment; it carries no time target. It is a mindfulness cue embedded in the session note: "Zone 2 ceiling — if HR exceeds this, walk 30 seconds." Total session type remains `easy`; zone tag stays Z1–Z2.

**Why.** Build-phase long runs are the most common place where runners inadvertently drift into Zone 3 — aerobically comfortable but metabolically expensive. For a 5K runner doing a 90-minute long run, the last 20 minutes at Z3 costs them three days of residual fatigue that shows up in the Tuesday interval session. The Z2-ceiling reminder is a soft structural cue, not a hard physiological stimulus. It respects the session's aerobic intent while nudging execution quality.

**Config.** `GENERATION_CONFIG.LR_BUILD_Z2_CEILING_SEGMENT_PCT` (0.10). Applied as a coach note segment in `buildWeekSessions()` build-phase long-run path when `distKey ∈ ['5K','10K']`. No invariant — this is a notes-layer cue, not a structural constraint.

---

## 24d. Long-run structure — finish-goal late-peak (5K/10K, finish-goal)

**Principle.** For finish-goal (non-time-targeted) 5K and 10K plans, the final two peak weeks embed a 10% easy-effort negative-split segment at the very end of the long run — run slightly faster than the aerobic body of the run, but with full effort control (no pace target). Session note: "Negative-split finish — last 10%, go by feel, slightly faster than the run's easy pace." This is not a pace-segment; it is a proprioception and confidence drill.

**Why.** Finish-goal runners are not targeting a time but they still benefit from closing a long run with intention rather than attrition. The negative-split finish teaches the runner that they have a gear they haven't used — that running faster at the end of a run is a skill, not luck. It also provides a low-stakes rehearsal for late-race acceleration without the injury risk of a hard effort on tired legs.

**Config.** `GENERATION_CONFIG.LR_FINISH_GOAL_LATE_PEAK_SEGMENT_PCT` (0.10). Applied as a session description note in `buildWeekSessions()` when `goal === 'finish'` and `distKey ∈ ['5K','10K']` and the week is in the final two peak weeks. Enforced by `INV-PLAN-FINISH-GOAL-LR-CAP`.

---

## 24e. Long-run structure — ultra-marathon (protected aerobic)

**Principle.** For ultra-marathon plans (50K and above), long runs are always pure aerobic — Zone 1–2, no embedded pace segments, no Z2-ceiling cues, no negative-split finishes. The long run's sole job in ultra preparation is time-on-feet and glycogen management training. Any pace-overlay on an ultra long run is a coaching defect.

**Why.** Ultra training stress is fundamentally different from road-racing training: the total weekly volume is higher, the long run already constitutes extreme duration, and the marginal fatigue cost of pace stimulation on a 3–4 hour run is disproportionately large. Pfitzinger's ultra-specific guidance and the ITRA/UTMB approach both converge on the same principle: ultra-distance training is about fatigue resistance, not pace range. Pace specificity lives entirely in the quality sessions. The long run is recovery-constrained time-on-feet.

**Config.** No config key — this is a structural prohibition. When `distKey ∈ ['50K','100K']`, the engine must not add any pace-segment field or pace-segment note to the long run, regardless of `goal` or phase. Enforced by `INV-PLAN-ULTRA-NO-PACE-SEGMENTS`.

---

## 25. Race-specific long run (HM and marathon, time-targeted)

**Principle.** Peak phase of a time-targeted HM or marathon plan MUST contain at least one long run with an embedded race-pace segment. The segment is the final 25–40% of the long run (the runner is already aerobically tired when they hit goal pace, simulating the late-race state). Naming convention: "Long run with HM-pace finish" for HM, "Marathon-pace long run" for marathon. Distances ≤10K do not require this — their long run remains aerobic.

**Why.** Threshold-pace cruise intervals teach pace discipline on fresh legs. Race-pace work on tired legs is a different adaptation: glycogen recruitment under fatigue, mental discipline at hour 1+, the specific feel of holding goal pace when easy pace would feel right. Daniels and Pfitzinger both call this the single most race-specific session for the HM and marathon. Without it, the runner has practised the pace and practised the duration but never together — and race day is the first time those two collide.

**Config.** Catalogue rows `hm_pace_long_run` (HM) and `mp_long_run` (marathon), both `category: 'race_specific'`. Selected in `buildWeekSessions()` peak-phase long-run path when `goal === 'time_target'` and the runner has a derivable goal pace. Implemented via `raceSpecificLongRunSession()`. Enforced by `INV-PLAN-RACE-SPECIFIC-LONG-RUN` in `lib/plan/invariants.ts`.

---

## 26. Race-week sharpening (not tempo)

**Principle.** In the final 7 days before race day (race week), any quality session MUST be a sharpening session — short reps at race pace or faster, with full recovery, total work volume ≤5 km. Continuous tempo, threshold intervals, progression runs, hill repeats, and long runs above 50% of peak long run distance are prohibited in race week. Permitted: 3–5×1 km at goal pace with ≥90s recovery, 6×400m at goal pace or slightly faster with ≥60s recovery, 4–6×100m strides appended to a shakeout.

**Why.** Detraining fitness gains take ~10 days; gaining fitness takes ~21. In the 7 days before a race, the runner can lose nothing important by NOT training hard, and they can lose everything (a fresh race-day) by training hard. Tempo and progression runs add fatigue without adding fitness — a directly negative trade. Sharpening reps preserve neuromuscular coordination and pace memory at minimal fatigue cost. The engine must never schedule a fatigue-adding session in race week.

**Config.** `GENERATION_CONFIG.TAPER_QUALITY_PER_WEEK[distance]` ends with `0` for race week across all distances. Enforced by `INV-PLAN-RACE-WEEK-SHARPENING` in `lib/plan/invariants.ts` — structural guard against future regression.

---

## 27. Theme matches prescription

**Principle.** Week themes are short coaching statements written for the runner. They MUST match what the engine has actually prescribed for that week. "Where the fitness is built" / "highest volume" themes apply only to weeks whose volume exceeds the most recent non-deload week. "Intensity stays" themes apply only to weeks where ≥1 quality session is prescribed. Race week's theme is exclusively "The work is done. Arrive rested.". The label "Race week" is exclusively the final week of the plan; earlier taper weeks use "Taper — trust the work" / "Taper — sharpening" / "Taper — final cut".

**Why.** A theme that contradicts the prescription gives the runner two messages — one from the words, one from the work — and they will believe the words. "Volume drops. Intensity stays." on a week with no intensity teaches the runner to disbelieve the engine's framing on every other week too. The cost of inconsistency is paid permanently in user trust. The standard is: read the theme, look at the week, no surprise.

**Config.** Implemented in `generateRulePlan()` (`lib/plan/ruleEngine.ts`) which selects the theme per week with awareness of `actualWeeklyKm`, `qualityCount`, and the prior non-deload weekly volume. `weekLabel()` taper labels extended from 2 to 3 entries so multi-week tapers (HM, marathon) don't reuse "Race week" for the second-to-last week. Enforced by `INV-PLAN-COPY-MATCHES-SESSIONS` in `lib/plan/invariants.ts`.

---

## 28. Strides on midweek easy

**Principle.** From `STRIDES_FIRST_WEEK` (week 3) onwards, every non-deload, non-race week appends a stride coach-note to one midweek easy run: "4×20s strides at 5K effort, full recovery between." The stride run is placed midweek (Wed preferred), avoids the day before the long run, and avoids the day after a quality session. Race week and deload weeks are exempt.

**Why.** Strides preserve neuromuscular sharpness — fast turnover, full extension, race-pace mechanics — without adding meaningful fatigue. They are the cheapest fitness asset in coaching: 80 seconds of work for an adaptation that compounds across a build. Without strides, a runner who only ever runs Z2 and threshold loses the ability to run faster than threshold pace efficiently; race day finds them flat-footed at the gun. They belong on an easy day so the legs are fresh enough to execute proper form.

**Config.** `GENERATION_CONFIG.STRIDES_FIRST_WEEK = 3`. Implemented at the end of `buildWeekSessions()` after easy fillers are placed. The stride note is appended to `coach_notes` rather than producing a new session — strides are a 4-minute appendix to a 45-minute easy run, not a session in their own right.

---

## 29. Fresh-from-layoff detection

**Principle.** When a user reports `weeks_at_current_volume < FRESH_RETURN_WEEKS_THRESHOLD`, the engine treats `current_weekly_km` as aspirational rather than consolidated. The plan starts at `FRESH_RETURN_START_FRACTION × current_weekly_km` and ramps at the standard 10% rate (no returning-runner allowance). The `plan.meta.fresh_return_active` flag exposes this so consumers can present a different framing.

**Why.** A runner who says "I'm doing 18 km/week" after a 6-month gap is naming the volume they aspire to, not the volume their tendons and bones have absorbed. Honouring the stated number as if it were sustained volume produces injuries the rest of the constitution exists to prevent. The 70% start fraction is a coaching cliché because it works: it gives the runner a few easy weeks to consolidate before the build's overload begins.

**Config.**
- `GENERATION_CONFIG.FRESH_RETURN_WEEKS_THRESHOLD = 8`
- `GENERATION_CONFIG.FRESH_RETURN_START_FRACTION = 0.7`

Implemented in `generateRulePlan()` (`lib/plan/ruleEngine.ts`) where `startKm` is computed before `buildVolumeSequence` runs. Mutually exclusive with the existing experienced-low-volume returning-runner allowance — a fresh return needs caution, not a faster ramp. The wizard surfaces `weeks_at_current_volume` as a follow-up to the volume question; a value of `null` means "consolidated" (current behaviour, no fresh-return logic).

---

## 30. Race-week shakeout cap and strides

**Principle.** Race-week shakeouts MUST cap duration at `RACE_WEEK_SHAKEOUT_MAX_MINS` (35 minutes), with RPE ≤ 3. The first shakeout of race week carries a stride coach-note ("4×100m strides at 5K effort, full recovery between.") to preserve neuromuscular sharpness without race-day fatigue cost. The second shakeout (when scheduled) is plain easy — no strides — to keep the day before/of-day arrangement uncluttered.

**Why.** A shakeout is a wake-up for the legs, not training. Anything longer than ~35 minutes has crossed into being a session, and starts to add fatigue the runner cannot recover from before race day. Strides on the earlier shakeout preserve fast-twitch coordination — the runner has rehearsed near-race-pace turnover within 48 hours of the gun, but only for 80 seconds of work. Without strides, six days of taper-pace running can leave the runner feeling flat-footed at the start.

**Amended 2026-08-06 (F14) — the two shakeouts are not the same session.** They were emitted identically (4 km, same label, differing only by the stride note), which reads as a copy-paste rather than a plan. They do different jobs and are now sized and named accordingly:

| Position | Distance | Job |
|---|---|---|
| Earlier (`RACE_WEEK_SHAKEOUT_DAYS_BEFORE_RACE[0]`) | `RACE_WEEK_SHAKEOUT_KM[0]` | Keep the legs turning over; carries the strides |
| Final (`[1]`) | `RACE_WEEK_SHAKEOUT_KM[1]` | Minimal. The last run before a race should leave the runner wondering if it was enough — that is the correct feeling |

**Config.** `GENERATION_CONFIG.RACE_WEEK_SHAKEOUT_MAX_MINS = 35`, `GENERATION_CONFIG.RACE_WEEK_SHAKEOUT_KM = [5, 3]`, `GENERATION_CONFIG.RACE_WEEK_SHAKEOUT_DAYS_BEFORE_RACE = [5, 3]` (§77). Implemented in the race-week branch of `buildWeekSessions()`. Distance is reduced proportionally when the cap binds (preserving easy pace).

---

## 31. Compression classification — three modes

**Principle.** When a plan does not reach its distance-and-fitness peakKm target, the user gets a classification, not a bare warning. Three modes:

- `optimal` — plan reaches its target. No warning.
- `appropriate_for_persona` — plan falls short of target, but the runner doesn't need more for their goal. The classic case is a beginner with a finish goal: race-day success is reaching the start line healthy, not maximising aerobic capacity.
- `constrained_by_inputs` — plan falls short and the runner could carry more. Inputs (`days_available`, `max_weekday_mins`, `current_weekly_km` near peak target) prevent overload. The user can increase capacity by adjusting one of these and regenerating.

**Why.** A binary "compressed" flag tells the runner something is wrong but not what or whether to act. For Sarah (beginner, finish goal), nothing is wrong — her plan is the right shape for her aim, even at modest volume. For Mark (intermediate, time goal) hitting the same flag, the runner needs to know which input is the bottleneck so they can decide whether to trade life-flexibility for fitness ceiling. The same warning means different things; surfacing the difference respects the runner's agency.

**Config.** `plan.meta.compression_classification: 'optimal' | 'appropriate_for_persona' | 'constrained_by_inputs'`. Implemented in `generateRulePlan()` (`lib/plan/ruleEngine.ts`) using the `compressed` boolean plus the (fitness, goal) pair as the discriminator. The bare `compressed` flag is retained for back-compat with existing UI.

**Feeds the difficulty band (§44).** This classification is a load-bearing input to the ordinal difficulty band: `constrained_by_inputs` forces the band off `comfortable`. The two are computed from the same `compressionClassification` const so they can never disagree. See §44 "The floor stays; the warn band becomes an honest difficulty signal".

---

## 32. Tune-up race callout

**Principle.** Plans of `TUNE_UP_MIN_PLAN_WEEKS` (10 weeks) or longer surface an optional tune-up race callout on the latest non-deload build week — the week immediately before peak phase begins. The callout suggests a parkrun PB or local 5K with explicit framing: "use the result as a fitness check, not a race effort." Optional — no session is added; the runner can ignore it.

**Why.** A mid-build benchmark gives the runner a fitness data point at the right moment: enough training has accumulated to feel the gains, but enough plan remains to act on the result (peak still ahead, taper to follow). It also gives the runner a competitive outlet that doesn't disrupt the plan — without this offer, motivated runners often add their own race that derails the build. Surfacing the callout in-plan defuses the "should I race this weekend?" question.

**Config.** `GENERATION_CONFIG.TUNE_UP_MIN_PLAN_WEEKS = 10`. Implemented as `Week.tune_up_callout?: string` set on the latest non-deload build week. UI consumers render this as an opt-in suggestion alongside the week's existing content; the engine never treats it as a session.

---

## 33. Coach notes by session intent

**Principle.** Coach notes attached to a session MUST be selected by the session's *intent* (the label the runner sees), not by the underlying catalogue row that happened to be selected. When the engine overrides a label (e.g. `goalPaceWeek` re-labels a "Steady aerobic" catalogue row as "10K-pace intervals"), the voice MUST be replaced — not appended — with one that matches the new intent. Banned cross-type combinations: VO2max sessions never get aerobic cues ("Boring is the point", "If it feels productive slow down"); easy/long sessions never get interval cues ("Exit each rep wanting more", "Rep three is the test"); tempo sessions never get sprint cues ("Explosive starts").

**Why.** A non-elite runner can't tell from feel whether 5:00/km is goal pace, threshold pace, or VO2max work — they trust the label and the coach note together. A "10K-pace intervals" session telling them "Boring is the point. If it feels productive, slow down" is incoherent: the label says "race-pace work" and the note says "easy aerobic". They will follow whichever instruction matches their bias on the day, and the engine will have failed twice — once on the prescription, once on the framing.

**Config.** Implemented in `makeQualitySession()` (`lib/plan/ruleEngine.ts`): when `useGoalPace` is true, the engine synthesises a goal-pace voice rather than appending the catalogue's voice. VO2max sessions keep their catalogue voice (the catalogue's vo2max entries are correct). Enforced by `INV-PLAN-COACH-NOTES-MATCH-INTENT` in `lib/plan/invariants.ts`.

---

## 34. Invariant registry — declared and exercised

**Principle.** Every invariant code emitted from `validatePlan()` MUST appear in `INVARIANT_CODES` (the registry), and every code in the registry MUST be emitted by some branch of `validatePlan()`. The three canonical review-packet cases (`01-5k-beginner`, `02-10k-intermediate`, `03-hm-intermediate`) MUST pass `validatePlan()` with zero error-severity violations under the current engine.

**Why.** Round-1 H-02 added an invariant that didn't catch the regression it was designed for, because the per-week zone check passed while the pace was actually wrong (the discounted-VDOT issue). A registry + canonical-case coverage check is the cheapest mechanical guard against "principle written, invariant added, but no test ever fires it." When a future principle ships, the build fails until the corresponding invariant is wired AND the canonical cases stay clean.

**Config.** `INVARIANT_CODES` constant in `lib/plan/invariants.ts` lists every code. `scripts/r2-coverage-check.ts` reads source, diffs registry vs emitted-code literals, and runs the three canonical cases through `validatePlan()`. Exits 1 on any failure. Run as part of CI pre-merge.

---

## 35. Persona-aware prescriptions — floors are minimums, not targets

**Principle.** When persona signals support more aggressive prescriptions, the engine SHOULD push higher than the spec floor where doing so doesn't violate other principles. Spec floors are *minimums*, not targets. The first place this applies is the peak long run for time-targeted HM/marathon plans:

- **Floor** (`PEAK_LR_RATIO_VS_RACE`) — conservative default that any plan reaches.
- **Target** (`PEAK_LR_RATIO_TARGET`) — runner's `longest_recent_run_km` is already at or above the floor of race distance.
- **Stretch** (`PEAK_LR_RATIO_STRETCH`) — runner has `hard_session_relationship: 'love'`, no `injury_history` from `HILL_RESTRICTING_INJURIES`, AND `longest_recent_run_km ≥ floor`.

The same tiering will eventually apply to weekly volume, quality session frequency, and goal-pace exposure (out of scope for R2 — single application here proves the pattern).

**Why.** Round-2 flagged Anna's peak long run sitting at 18 km — exactly the round-1 §24 floor of 85% × 21.1 km. Anna's `hard_session_relationship: 'love'`, no injury history, and `longest_recent_run_km: 18` clearly support a longer peak long run; an 85% floor that becomes a 85% ceiling is "floor-stopping" — a defect of conservatism, not a virtue. The brand is "Slow down. You've got a day job." for the easy days; on race-prep specificity for an experienced runner explicitly asking for more, restraint becomes under-coaching.

**Config.**
- `GENERATION_CONFIG.PEAK_LR_RATIO_VS_RACE` (HM=0.85, M=0.75) — floor
- `GENERATION_CONFIG.PEAK_LR_RATIO_TARGET`   (HM=0.90, M=0.80) — target
- `GENERATION_CONFIG.PEAK_LR_RATIO_STRETCH`  (HM=0.95, M=0.85) — stretch

Implemented in `buildWeekSessions()` peak-phase long-run sizing. Tier selection is deterministic from inputs; the chosen tier is applied via the same ceil-rounding pattern as the floor. `LONG_RUN_CAP_MINUTES` still binds.

---

## 36. Taper quality variety

**Principle.** Within taper phase, no two consecutive quality sessions may share the same label and pace target. The first taper week uses threshold/tempo work; subsequent taper weeks (until race week) prefer race-specific sharpening at goal pace. Race week itself stays shakeout-only (§26).

**Why.** When the round-1 engine ran out of taper-eligible threshold rows (HM has only one: `progressive_tempo`), Anna's W11 and W12 both prescribed identical Progressive tempo at identical pace with identical coach notes. Repetition reads as the engine being lazy. For a runner with `hard_session_relationship: 'love'`, the second tempo run in a row is a signal that no thought went into the prescription — and the runner stops trusting subsequent sessions. Variety isn't a polish feature; it's a credibility feature.

**Config.** Implemented in `buildWeekSessions()`: when `phase === 'taper'` and `taperIdx > 0` and `goalPace` is available, `preferredCategory` swaps from `'threshold'` to `'race_specific'`. New catalogue row `goal_pace_sharpener` (race_specific, taper-eligible across all distances) provides the alternate. Catalogue rows that mark themselves goal-pace via `main_set_structure.work.pace_target === 'goal'` trigger the same prescription override that `goalPaceWeek` does in build/peak. Future: an `INV-PLAN-TAPER-VARIETY` invariant.

---

## 37. Fresh-return heuristic — infer from input shape

**Principle.** The fresh-from-layoff path (§29) fires either explicitly (`weeks_at_current_volume < FRESH_RETURN_WEEKS_THRESHOLD`) or heuristically: when `training_age` says the runner is experienced (≥ 2 years) but `current_weekly_km < HEURISTIC_FRESH_RETURN_WEEKLY_KM` AND `longest_recent_run_km < HEURISTIC_FRESH_RETURN_LONG_RUN_KM`, the engine infers a layoff and applies the same start-volume reduction. The explicit input is preferred when present; the heuristic is the safety net for runners who don't think to mention a gap.

**Why.** Sarah's persona ("returning to running after a 6-month gap") is exactly the case the engine is supposed to protect. But the wizard collects `current_weekly_km` and `training_age` separately, and a runner self-reporting "18 km/week" after just rebuilding for 4 weeks doesn't think of themselves as returning. The shape of the inputs — experienced background, low current volume, no real long run — is enough to make the call. Conservative inference is better than aggressive default volume in this case; the worst outcome of a false-positive is a slightly easy first three weeks (recoverable). The worst outcome of a false-negative is injury (not recoverable).

**Config.**
- `GENERATION_CONFIG.HEURISTIC_FRESH_RETURN_WEEKLY_KM = 25`
- `GENERATION_CONFIG.HEURISTIC_FRESH_RETURN_LONG_RUN_KM = 10`

Heuristic AND-gates: BOTH thresholds must be hit. Implemented in `generateRulePlan()` (`lib/plan/ruleEngine.ts`). The combined `isFreshReturn` flag drives the start-volume reduction and surfaces in `plan.meta.fresh_return_active`.

---

## 38. Volume constraint notes are prescriptive

**Principle.** When a plan downgrades to maintenance (§23), the `volume_constraint_note` MUST include both the diagnosis (what's missing and why) and the prescription (which input to change to unlock the build profile). Format: `"{diagnosis}. To enable a build profile: {input changes}."` The engine identifies the actionable inputs (days_available, max_weekday_mins) and surfaces concrete deltas the runner can take to their plan-regen flow.

**Why.** Round-2 review flagged Anna's `volume_constraint_note` as descriptive but not actionable. "Plan maintains current fitness rather than building it" tells the runner there's a problem and not what to do about it. A runner staring at "maintenance" will either accept it (under-trained) or guess at the cause (often guessing wrong). Naming the input change is the difference between a passive notice and an actionable choice — and the engine has perfect information about which inputs are bottlenecks because it just ran the math.

**Config.** Implemented in `generateRulePlan()` (`lib/plan/ruleEngine.ts`). Suggestions:
- If `days_available < 6` → suggest +1 day.
- If `max_weekday_mins < 90` → suggest 90.

When neither suggestion applies, the diagnosis is surfaced alone (no false guidance). The bottleneck list expands as new inputs become tunable.

---

## 39. Race-week mid-week easy run for HM/marathon

**Principle.** For HM and marathon time-targeted plans, race week MUST include one slightly longer easy run (6–8 km for HM, 8–10 km for marathon) on a non-shakeout day, when the runner has `days_available >= 4`. For 10K and below, the existing shakeout-only race week is sufficient. Race day, two shakeouts, and one easy mid-week run = four sessions in race week.

**Why.** Round-2 review flagged Anna's race-week non-race volume at 8 km (two 4 km shakeouts) — too light for an HM taper. The taper-detraining curve takes ~10 days to bite; 7 days of nothing-but-shakeouts in HM/marathon prep removes more aerobic base than necessary. A short easy run mid-week preserves aerobic conditioning at minimal fatigue cost. Standard HM and marathon plans (Daniels, Pfitzinger) include a longer pre-race-week run for exactly this reason.

**Config.** `GENERATION_CONFIG.RACE_WEEK_EASY_KM = { HM: 7, MARATHON: 9 }`. Implemented in the race-week branch of `buildWeekSessions()`. Skipped when `days_available < 4` (the runner is already constraint-limited; adding a fourth session would force a back-to-back).

---

## 40. 5K finish-goal long-run cap

**Principle.** For `goal: finish` AND `race_distance_km ≤ 5`, the peak long run is capped at `LONG_RUN_CAP_MINUTES_5K_FINISH` (70 min) rather than the standard `LONG_RUN_CAP_MINUTES['5K']` (90 min). Aerobic development for 5K finish goals comes through frequency + total volume; extended long runs add fatigue without proportional benefit. Time-targeted 5K plans (where the runner is actually racing) keep the standard 90-min cap.

**Why.** Round-2 review flagged Sarah's 84-min peak long run for a 5K finish goal as HM-shaped — too aerobic-development-focused for what she's actually training for. A returning runner targeting a finish-line photo doesn't need a 14-km long run; she needs to reach race day with healthy connective tissue and the confidence she can run 5 km. Sub-cap LRs (35–60 min) accomplish that with less injury risk.

**Config.** `GENERATION_CONFIG.LONG_RUN_CAP_MINUTES_5K_FINISH = 70`. Applied in `applyLongRunCap()`. Standard `LONG_RUN_CAP_MINUTES['5K']` retained for time-targeted 5K plans (where 90 min remains coaching-appropriate as a ceiling).

---

## 40b. Effort-governed sessions — when there is no pace to check

*Added 2026-08-20 — Coaching Board CD-17a (SC-09), unanimous.*

**Principle.** A session may prescribe **effort instead of pace**, but never *neither*. Where the terrain sets the intensity, the plan states the effort and **omits the pace target entirely** — it does not invent a number the runner cannot act on.

**Why.** Hill repeats are the first session Zonna prescribes where effort is the primary instruction rather than a supporting note. A pace up a hill is meaningless: the gradient decides it, and the same effort produces a different pace on every hill. McMillan's argument for the session is exactly this — *no track, no measured loop, self-limiting by gradient, effort-governed so it works on a day when the legs are flat.* That is a feature, and prescribing a pace anyway would remove it.

**The problem this creates, and the rule that closes it.** §19 checks that a session's **label** matches its **pace**. A session with no pace cannot be checked that way — so an absent pace target is indistinguishable from a *lost* one. **`INV-PLAN-EFFORT-OR-PACE` closes that hole:** every quality session must carry a pace target **or** an RPE target. A zone alone does not satisfy it — "Zone 4–5" describes a physiological band, not an instruction a runner can execute on a hill.

**Reconciliation with §28 (strides).** Strides are already effort-governed — *"4×20s strides at 5K effort"* — and are the precedent, not an exception. The difference is scope: strides are a four-minute **appendix** appended to an easy run's coach notes, never a session in their own right, so they carry no pace target to check and §19 never engages. §40b governs sessions where effort is the **whole prescription**. Both express the same idea: some work is better instructed by feel than by a number.

**Tension with §11 (pace ranges, not points), recorded.** §11 requires a range rather than a single figure, on the grounds that a point target invites false precision. A hill rep has **no** pace at all — a case §11 does not contemplate. §40b does not weaken §11; it names the boundary of it. Where a pace exists it is still a range.

**What effort-governed does NOT license.** It is not a way to avoid prescribing. An effort-governed session still states the rep length, the rep count, the recovery and the descent. What is absent is the pace, and only the pace.

**Config.** No numeric of its own — the effort target lives on the catalogue row's step (`target: { kind: 'effort', rpe }`, ADR-019). Enforced by `INV-PLAN-EFFORT-OR-PACE`.

---

## 41. Effort copy matches the work prescribed

**Principle.** Theme copy that promises effort ("It will feel hard. That is correct.") MUST appear only on weeks that actually contain ≥1 quality session. An all-easy peak week — common for beginners and finish-goal plans — uses the consistency framing instead. Race week's "The work is done" is exempt (it describes a different state).

**Why.** Round-2 review flagged Sarah's peak weeks (W8/W9, all-easy) reading "It will feel hard. That is correct." A beginner being told to expect hard effort on a Zone 2 run will either push too hard (going beyond Z2 to satisfy the framing — exactly the brand failure) or distrust the engine when the run feels normal-easy. Coaching framing must match the prescription. Hard sessions get hard framing; easy weeks get steady framing.

**Config.** Implemented in `generateRulePlan()` theme selection: peak weeks with `qualityCount === 0` use "Consistency. The work is the volume." regardless of overload status. Enforced by `INV-PLAN-COPY-MATCHES-SESSIONS` extension catching "feel hard" / "feels hard" copy on zero-quality weeks.

---

## 42. VDOT staleness compounds

**Principle.** The VDOT conservatism discount (§10) scales with benchmark age. Benchmarks ≤ `VDOT_STALENESS_FRESH_WEEKS` (4 weeks) get the base 3% discount only. Beyond that, +`VDOT_STALENESS_PER_4WK_PCT` (1%) per additional 4-week block, capped at `VDOT_STALENESS_MAX_DISCOUNT_PCT` (7%). Replaces the legacy binary 6-month threshold which jumped from 3% straight to 8%.

**Why.** A 6-week-old benchmark and a 1-week-old benchmark used to get the same 3% discount. A 7-month-old benchmark jumped to 8%. The discontinuity is unrealistic — fitness drift is gradual. A graduated ramp matches actual physiology: a few weeks at low conditioning costs you noticeably less than two months. Capping at 7% prevents the engine from running away with conservatism on very old benchmarks (where the right answer is "ask for a re-test", not "discount more").

**Config.**
- `GENERATION_CONFIG.VDOT_STALENESS_FRESH_WEEKS = 4`
- `GENERATION_CONFIG.VDOT_STALENESS_PER_4WK_PCT = 1`
- `GENERATION_CONFIG.VDOT_STALENESS_MAX_DISCOUNT_PCT = 7`

Worked examples:
- 0–4 weeks old: 3%
- 5–8 weeks: 4%
- 9–12 weeks: 5%
- 13–16 weeks: 6%
- 17+ weeks: 7% (cap)

Implemented in `applyVdotDiscount()` (`lib/plan/ruleEngine.ts`). Legacy `VDOT_STALE_BENCHMARK_*` config retained for back-compat with any consumer that hasn't migrated; the new ramp supersedes them in `applyVdotDiscount`.

---

## 44. Prep-time validation — refusal mechanism

**Principle.** Before generating, the engine MUST validate that the runner has adequate preparation time for the chosen race distance and goal type. The engine is not obligated to produce a plan when the inputs cannot support a coachable outcome.

Minimum weeks of preparation by race distance:

| Distance | Block | Warn | OK |
|---|---|---|---|
| ≤5K | <4 | 4–7 | ≥8 |
| 10K | <6 | 6–9 | ≥10 |
| HM | <8 | 8–11 | ≥12 |
| Marathon | <10 | 10–15 | ≥16 |
| Ultra | <14 | 14–19 | ≥20 |

For returning runners (`returning_runner_allowance_active`, `weeks_at_current_volume < FRESH_RETURN_WEEKS_THRESHOLD`, or `fresh_return_active`), shift all thresholds up by 2 weeks.

For `goal: 'finish'`, only `block` thresholds apply. The `warn` zone is treated as `ok`. Finish goals are achievable on shorter timelines than time goals.

When validation returns:
- **block**: refuse generation. Return error explaining why and listing alternatives: defer race, change distance, change goal to "finish".
- **warn**: refuse generation unless input includes `acknowledged_prep_warning: true`. Return the warning with alternatives. This is a two-step pattern: first call surfaces the warning, second call (with explicit acknowledgment) generates.
- **ok**: proceed normally.

Plans generated under a `warn` condition MUST include `prep_time_status: 'warned'`, `prep_time_warning`, and `prep_time_alternatives` in plan meta. Plans generated under `ok` include `prep_time_status: 'ok'`.

**Why.** Brand position: *"Training plans that stop you overtraining."* That positioning is meaningless if the engine produces a time-targeted marathon plan from 11 weeks for a returning runner with hip injury history (case 04, 2026-04-28 review). Marathon builds for intermediates need 16–20 weeks. Compressing that into 11 weeks forces the engine to lie about what it can deliver — race-specific fitness cannot be built in that window. Refusing or warning is the honest coaching answer.

This principle composes with §23 (peak overload requirement). A plan that proceeds under `warn` must still satisfy all other invariants. Failures that result (e.g. inability to reach peak volume floor) flow through existing downgrade mechanisms (`maintenance` label, `volume_constraint_note`).

**Config.**
- `GENERATION_CONFIG.PREP_TIME_THRESHOLDS` — block / warn weeks per race distance.
- `GENERATION_CONFIG.PREP_TIME_RETURNING_RUNNER_SHIFT_WEEKS = 2`.
- `validatePrepTime()` in `lib/plan/inputs.ts`. Called at the top of `generateRulePlan()`.

Enforced by `INV-PLAN-PREP-TIME-STATUS-ANNOTATED` — every plan output carries `prep_time_status`.

### The floor stays; the warn band becomes an honest difficulty signal — amended 2026-08-18 (Coaching Board, Q1)

**Principle.** Refusal (`block`) is retained for the narrow band where no coachable plan exists — a prep window too short to build the race, or a goal reachable only by violating the ramp cap (§2/§45). For everything above that floor, the engine does not merely say "ok" — it surfaces an **ordinal difficulty band** on every generated plan describing how demanding the plan is *on the runner's chosen timeline and constraints*:

- `comfortable` — adequate timeline, plan reaches its target (or is `appropriate_for_persona`).
- `demanding` — safe but a real ask: a tight-but-adequate time-goal clock, or a plan the runner's inputs (`days_available`, `max_weekday_mins`, starting volume) hold below target (`constrained_by_inputs`).
- `very_demanding` — generated under an acknowledged prep-time `warn` (below the recommended minimum, above the block floor).

The refusal tier — *"not achievable in this window"* — **is** the §44 `block`; it throws before a plan exists, so it never appears as a band.

**Why.** A hard wall with no door loses the eager runner to a worse app that simply says yes; but "Hard, go for it!" where the goal is physiologically impossible is a lie with a smile. The honest middle is a *graded* signal: keep the floor for the impossible and the unsafe, and turn the large "warn" band into a difficulty read the runner can act on. Three constraints, all Coaching-Board rulings:

1. **Ordinal, never a percentage.** With one benchmark run and one max HR the engine cannot defend a probability — a "72% chance" is fabricated precision, and false precision is an overclaim. The ladder maps to something real (prep-time margin + input constraint); a number does not.
2. **The band describes demand on the *timeline/life*, not a verdict on the *runner*.** "Very Demanding" (of you) reads as respect and keeps the runner in the app; "low chance of success" reads as an insult and closes it. When the band lands in the top tiers it carries the same §44 alternatives (defer, drop to finish, shorter distance).
3. **A friendly band may never front a constrained or warned plan** (Willy). The band is derived *only* from **pre-generation feasibility** signals — never from plan-quality/enrichment signals. That keeps it structurally distinct from the **PAID** numeric confidence score (a *post-generation quality* read), so the two can never become competing verdicts on the same plan (SLT boundary, 2026-08-18).

### A target beyond measured fitness is the same class of statement — amended 2026-08-20 (CD-16 / SC-06)

**Principle.** The band takes a **third** feasibility input alongside prep-time margin and `compression_classification`: whether the runner's stated target pace is faster than the interval pace their benchmark supports. When it is, the band reads at least `demanding` and `meta.goal_beyond_measured_fitness` is set.

**Why this belongs to the band and not the confidence score.** It is computed from two *inputs* — target time and benchmark — **before any session exists**. It is a read on the feasibility of the runner's chosen goal, exactly like prep-time margin, not a judgement about the plan that was produced. The SLT boundary above is about *pre-generation feasibility vs post-generation quality*, not about which particular fields are consulted; this stays on the pre-generation side. The board named the band as the correct surface precisely because it is already ordinal, already FREE, and already exists to say "this is a real ask" without pretending to a probability.

**What the runner is being told.** Not "you will fail". The plan is built toward the target as stated; the band says the gap is real and names the artefact the runner would otherwise discover mid-plan — that their race-pace sessions bite harder than their interval sessions (see §83). Per constraint 2 above, the demand is on the **target**, not the athlete.

**Config.** `GENERATION_CONFIG.INTENSITY_ORDERING_TOLERANCE_PCT` (0.5%) — how far goal pace may exceed derived interval pace before the target counts as beyond measured fitness. Enforced by `INV-PLAN-INTENSITY-ORDERING`.

**Tier.** The difficulty band is **FREE** — it extends the already-FREE prep-time gate and is the honesty the brand is built on ("training plans that stop you overtraining"). The numeric confidence score stays **PAID**. SLT-signed 2026-08-18 (unanimous). `FEATURE_GATES.FREE_ALWAYS += 'plan_difficulty_band'`.

**Config.**
- `GENERATION_CONFIG.DIFFICULTY_COMFORTABLE_MARGIN_WEEKS = 2` — a time-target plan whose weeks-available is within this many weeks of the recommended (`ok`) minimum reads `demanding` rather than `comfortable`.
- `plan.meta.difficulty_band` (enum) + `plan.meta.difficulty_note` (present only for the demanding tiers — a one-line honest "why", mirroring `volume_constraint_note`). Derived in `generateRulePlan()` from the same `prepTime` result and `compressionClassification` const that §31 uses.

**Enforced by** `INV-PLAN-DIFFICULTY-ANNOTATED` (every plan carries a band) and `INV-PLAN-DIFFICULTY-NEVER-FRONTS-UNSAFE` (a `warned` plan must read `very_demanding`; a `constrained_by_inputs` plan may not read `comfortable`) — both **error** severity.

---

## 45. Long-run progression cap (universal, no phase exemption)

**Principle.** Long-run distance MUST NOT increase by more than +20% week-on-week OR +5km absolute, whichever is greater. The cap applies in ALL phases — base, build, peak, taper. There is no "specificity allows it" exemption.

The single permitted exception: a long run following a deload week may step back up to the pre-deload long-run distance (within +5%).

**Why.** Case 04 (2026-04-28 review) showed a W5 long run of 10.5km jumping to a W6 long run of 30km — a +185% week-on-week increase, presented in peak phase. The structural justification ("peak demands specificity") is the failure mode: peak phase needs the specificity *because* the runner has been progressively built toward it, not as a substitute. Spike-then-recover is the most reliable injury vector in the audience this engine serves.

When the §24 floor (peak long-run race ratio) cannot be reached without violating this cap, this principle wins and the plan downgrades to `maintenance` with both a `volume_constraint_note` and a `long_run_constraint_note` — the same mechanism used in §23 / §38.

**Config.**
- `GENERATION_CONFIG.LONG_RUN_PROGRESSION_CAP_PCT = 20` — % week-on-week.
- `GENERATION_CONFIG.LONG_RUN_PROGRESSION_CAP_ABS_KM = 5` — absolute km, whichever is greater.
- `GENERATION_CONFIG.LONG_RUN_DELOAD_STEP_BACK_TOLERANCE_PCT = 5` — slack when stepping back up to pre-deload distance.

Enforced by `INV-PLAN-LR-PROGRESSION-CAP`. Engine-side: long-run distances are clamped during week-by-week assembly in `generateRulePlan` via `applyLongRunProgressionCap`.

---

## 46. Peak weekly volume floor for marathon and ultra

**Principle.** Time-targeted plans for the marathon and ultra distances need an absolute weekly-volume floor in peak phase, not just a peak-vs-base ratio. The §23 ratio (peak ≥ 110% of W1) ensures growth but allows a peak of 46km for a 42.2km race — the runner is asked to cover further on race day than in any single training week. That is not a build; it is a hope.

Floors:

| Distance | Floor |
|---|---|
| Marathon (40–43 km) | ≥125% of race distance |
| Ultra 50K (43–55 km) | ≥100% of race distance |
| Ultra >55 km | ≥80% of race distance, capped at 130 km/week |
| HM and below | No absolute floor (existing peak-vs-base ratio is sufficient) |

Applies to `goal: 'time_target'` only. `goal: 'finish'` plans use the existing peak-vs-base ratio without an absolute floor (finishing the distance does not require carrying that mileage in training).

**Why.** Case 04 (2026-04-28 review): peak weekly volume 45–46km for a 42.2km race. The plan satisfied §23 (it grew over W1) but the absolute floor was below race distance. A coach would say: "your longest week of training is shorter than your race". That is the structural failure §46 prevents.

This composes with §23. Both must be satisfied. If the floor is unreachable given the runner's life constraints (`max_weekday_mins`, `days_available`), the engine downgrades to `maintenance` via the §23 / §38 mechanism — same outcome as a plan that fails the peak-vs-base ratio.

**Config.**
- `GENERATION_CONFIG.MARATHON_PEAK_VOLUME_FLOOR_RATIO = 1.25`
- `GENERATION_CONFIG.ULTRA_50K_PEAK_VOLUME_FLOOR_RATIO = 1.0`
- `GENERATION_CONFIG.ULTRA_LONG_PEAK_VOLUME_FLOOR_RATIO = 0.80`
- `GENERATION_CONFIG.ULTRA_PEAK_VOLUME_FLOOR_CAP_KM = 130`

Enforced by `INV-PLAN-PEAK-VOLUME-FLOOR-LONG-RACES`. Maintenance downgrade triggers in `generateRulePlan` meta block.

---

## 47. Peak long-run alternation

**Principle.** Within peak phase, no two consecutive weeks may both contain a peak-level long run. A "peak long run" here means a long run at ≥90% of the plan's peak long-run distance that includes race-pace segments (MP / HM-pace / similar specificity).

Permitted patterns:
- Peak long run → step-back long run (≤80% of peak distance, no race-pace segments)
- Peak long run → deload week
- Peak MP/HM-pace long run → easy long run

Exception: runners with `hard_session_relationship: 'love'`, no `injury_history`, and `training_age: '5yr+'` may have one occurrence of consecutive peak long runs per plan.

**Why.** Case 04 (2026-04-28 review): W6 and W7 were both 30km MP-finish long runs back-to-back. For a 47-year-old returning runner with hip history, two consecutive 30km efforts at marathon-pace specificity is the highest-risk session pattern in the entire plan. Alternation gives connective tissue a window to consolidate the stimulus.

This principle composes with §25 (peak phase requires ≥1 long run with race-pace segments). When peak is 2 weeks, one of the two carries the peak long run and satisfies §25; the other is a step-back. That is acceptable.

**Config.**
- `GENERATION_CONFIG.PEAK_LR_ALTERNATION_THRESHOLD_PCT = 90` — % of peak long-run distance defining "peak-level".
- `GENERATION_CONFIG.PEAK_LR_STEPBACK_MAX_PCT = 80` — % of peak distance defining "step-back".

Enforced by `INV-PLAN-PEAK-LR-ALTERNATION`. Engine-side: in peak weeks, if the prior week was a peak long run, the engine substitutes a step-back long run (race-pace segments dropped, distance reduced to ≤80% of peak distance) unless the experienced-no-injury exception applies and has not yet been spent.

---

## 49. Taper duration cap

**Principle.** Taper-phase weeks (INCLUDING race week) MUST NOT exceed the cap per race distance. Beyond the cap, additional taper weeks detrain the runner and compress the build phase further.

| Distance | Total taper weeks (incl. race week) | Actual taper weeks before race |
|---|---|---|
| 5K | 2 | 1 |
| 10K | 2 | 1 |
| HM | 3 | 2 |
| Marathon | 4 | 3 |
| Ultra (50K) | 4 | 3 |
| Ultra (100K) | 4 | 3 |

The engine MUST NOT allocate more weeks to the taper phase than the cap above. Excess weeks must flow to base or build, where they extend the aerobic engine and the specificity window.

**Why.** Case 04 (2026-04-28 review) showed a 4-week marathon taper compressing the build phase to two weeks of base, two of build, two of peak — a structurally non-coachable timeline. Marathon taper science is settled: 2–3 weeks of reduced volume with maintained intensity. Beyond that, fitness slides faster than freshness rises. The cap stops the engine from using "extra weeks" as taper padding when it should be using them as build.

The 100K timeline previously allowed 4 actual taper weeks (5 total entries). Reduced to 3 actual taper weeks per the same logic — ultras need a slightly different taper rhythm than marathons but not a longer one. The 4th entry was historical.

**Config.**
- `GENERATION_CONFIG.TAPER_QUALITY_PER_WEEK[distKey].length` — total taper-phase weeks. Must be ≤ `MAX_TAPER_PHASE_WEEKS[distKey]`.
- `GENERATION_CONFIG.MAX_TAPER_PHASE_WEEKS` — canonical cap. Authority for the invariant.

Enforced by `INV-PLAN-TAPER-DURATION-CAP`.

---

## 50. HR data fallbacks (assumption surfacing)

**Principle.** The engine MUST generate plans even when HR inputs are incomplete. Missing HR data does not block generation — it triggers a fallback with a surfaced assumption.

Fallback hierarchy:

| Inputs provided | Method | Surfaced note |
|---|---|---|
| `max_hr` + `resting_hr` | Karvonen: `Z2 ceiling = resting + (max − resting) × 70%` | None |
| `max_hr` only | Percent of max: `Z2 ceiling = max × 80%` | "Zones derived from max HR only. Add resting HR for more accurate zones." |
| `resting_hr` only | Estimate max from age (Tanaka), then Karvonen | "Max HR estimated from age (X bpm). Refine via field test." |
| Neither | Estimate max from age, percent of max | "Both max and resting HR missing. Zones estimated from age alone. Recommend HR field test in first 2 weeks." |

The engine NEVER refuses to generate due to missing HR inputs. The philosophy: a working coach makes a starting estimate and refines from feedback. The note pushes the runner toward better data without withholding the plan.

**Why.** Case 04 (2026-04-28 review): `resting_hr: 0` got past validation, and the engine still computed a Zone 2 ceiling at 140 bpm using an undisclosed fallback. The runner had no way to know their zones were derived from incomplete data. §55 (L-01) closes the validation hole; §50 closes the silence hole — when fallback fires, the runner is told.

This composes with §55 (input validation): nonsense values (`resting_hr: 0`, `max_hr: 50`) are rejected by §55 as invalid; missing values trigger the fallback hierarchy here. The two cases produce different runner experiences — rejected data prompts the user to fix it; missing data gets an estimate with the caveat surfaced.

### Plausibility — amended 2026-08-06 (GEN-FIX-05)

**The hierarchy above distinguishes *present* from *absent*. It never asked whether a present value was *believable*, and that is where it failed.**

**Principle.** A supplied `max_hr` deviating from the age estimate by more than `MAX_HR_PLAUSIBILITY_DEVIATION_PCT` is not trusted. The engine falls back to the Tanaka estimate, surfaces a note naming both numbers, and tells the runner how to override. §55 rejects values that are physiologically impossible; this rejects values that are physiologically *possible but almost certainly wrong for this runner*.

**Why.** A 43-year-old was issued a plan built on `max_hr: 138` — inside §55's `[120, 220]` range, so it passed validation, and supplied rather than estimated, so §50 emitted no note at all. Tanaka gives 178. Every HR target in that plan was ~28 bpm low, and the runner was never told the number was an inference. The value came from Apple Health's highest *recorded* heart rate, which for someone who has never worn a sensor during a hard effort is a floor, not a maximum — and that describes most of the people this product is built for. The better a runner fits the target audience, the more wrong the number gets. (`docs/incidents/2026-08-06-plan-defects/analysis.md` §6.)

**The fallback is deliberate, not advisory.** An implausible max HR poisons every HR target for the plan's entire duration. The cost of over-riding a genuine physiological outlier is one note and a Profile edit; the cost of trusting a bad number is a whole training block run in the wrong zones. The note always names the override path.

| Condition | Method | Behaviour |
|---|---|---|
| Supplied `max_hr` within tolerance of Tanaka | as per table above | unchanged |
| Supplied `max_hr` outside tolerance | `age_estimate_implausible_input` | **Use Tanaka.** Note names the supplied value, the estimate, and how to override |
| `max_hr` known to be device-observed (`max_hr_source: 'observed'`) and within tolerance | `observed_max` | Use it, but **always** note that it is derived from recorded activity, not a measured maximum |

**Provenance is best-effort.** `max_hr_source` is set when the wizard reads HealthKit directly. A value arriving via `user_settings` has no recorded provenance, so it degrades to the unmarked path — the plausibility gate still protects it, because that gate is source-independent by design. Adding provenance to `user_settings.max_hr` is tracked separately.

**This composes with §78.** The recalibration time trial is what replaces an estimate with a measurement. Tanaka is a stopgap that gets corrected every four weeks, not a permanent answer.

**Config.** `GENERATION_CONFIG.MAX_HR_PLAUSIBILITY_DEVIATION_PCT = 15`.

Plan meta MUST include:
- `hr_zone_method` — which method was used (`karvonen` / `karvonen_estimated_max` / `percent_of_max` / `percent_of_estimated_max` / `observed_max` / `age_estimate_implausible_input`).
- `hr_assumption_note` — user-facing explanation. Present whenever the zones rest on an assumption: any method other than `karvonen`, **and** `karvonen` where the max was device-observed or the supplied value was rejected.
- `hr_estimated_max` — the Tanaka-estimated max HR. Present when max was estimated.

**Config.** Implemented in `buildHRZonesWithFallback()` (`lib/plan/ruleEngine.ts`). Boundary percentages (Z2 = 70% Karvonen / 80% MaxHR) are inherited from `GENERATION_CONFIG.ZONES`. No new constants — the four-method classification is a control-flow decision, not a tuning knob.

Enforced by `INV-PLAN-HR-ASSUMPTIONS-SURFACED`. Non-Karvonen methods MUST surface `hr_assumption_note`; if the engine uses a fallback silently, the invariant catches it.

---

## 51. Returning-runner allowance must be communicated

**Principle.** When the engine activates the returning-runner allowance (§2) OR the fresh-from-layoff start fraction (§29), plan meta MUST surface a `returning_runner_note` that names the change and the reason. Silent mechanism is a coaching defect.

The note's format mirrors `volume_constraint_note` from §38: one human-readable string, one diagnosis, no jargon. The runner sees their week-1 volume and asks "why does this start so low?" or "why is this jumping faster than I expected?" — the note is the answer.

**Why.** Case 04 (2026-04-28 review) had `returning_runner_allowance_active: true` in plan meta but no user-visible explanation. The maintenance downgrade in round one (§38) does this well — the runner sees `volume_constraint_note` and understands what was sacrificed and why. Returning-runner allowance is the same pattern: a coaching choice the engine made, surfaced in language the runner can read.

The two sub-cases produce different notes:

- **Returning-runner allowance** (§2): training_age > 2 years AND current_weekly_km < threshold. Allowance permits 15% week-on-week growth for the first 3 weeks (vs standard 10%). Note explains the faster ramp.
- **Fresh-from-layoff** (§29): explicit `weeks_at_current_volume < 8` OR heuristic match. Engine starts week 1 at 70% of the runner's stated current_weekly_km. Note explains the lower start.

The two are mutually exclusive — fresh-return has structural-base concerns the allowance can't share — and the engine selects between them in `generateRulePlan`.

**Config.** Implemented in `generateRulePlan`'s meta block. No new config fields — the note's content is computed from existing constants (`RETURNING_RUNNER_ALLOWANCE_PCT`, `RETURNING_RUNNER_GRACE_WEEKS`, `FRESH_RETURN_START_FRACTION`, `MAX_WEEKLY_VOLUME_INCREASE_PCT`).

Enforced by `INV-PLAN-RETURNING-RUNNER-NOTE-PRESENT` — when either flag is set, the note must be present.

---

## 52. Long run not more than 60% of weekly volume

**Principle.** No single run in any week may exceed `LONG_RUN_MAX_PCT_OF_WEEKLY` (60%) of that week's total volume. When the long-run prescription would force this, the engine MUST either (a) reduce the long run, (b) raise weekly volume (if the persona allows), or (c) downgrade to maintenance via §38.

**Why.** Case 04 (2026-04-28 review): W6 weekday runs were cut to 4 km each to fit a 30 km long run within the weekly volume cap. The long run was 67% of weekly mileage. A lopsided week is a week that doesn't actually train the runner — the weekday work shrinks to nothing, the long run becomes the *only* run, and the runner arrives at the long run with no aerobic base laid down by the prior days. Recovery from the long run also dominates the entire next week.

The 60% threshold is intentionally below the natural §9 long-run fraction (peak phase = 32% of weekly). The buffer (60% vs 32%) gives the engine room to flex during cap-binding edge cases without auto-tripping. When the buffer is exhausted, the long run is too big *or* the weekly volume is too low, and the constitutional answer is to surface the constraint, not to silently truncate weekday runs to single-digit km.

**Config.**
- `GENERATION_CONFIG.LONG_RUN_MAX_PCT_OF_WEEKLY = 60`

Enforced by `INV-PLAN-LR-MAX-WEEKLY-PCT`. When violated, the engine downgrades to maintenance (composes with §38) and surfaces the cause in `volume_constraint_note`.

---

## 53. Quality session variety across the full plan

**Principle.** No single quality-session label may appear more than `floor(total_quality_sessions / 3) + 1` times across the full plan. Extends §36 (taper variety) to the base / build / peak phases as well.

**Why.** Case 04 (2026-04-28 review): three "Progressive tempo" sessions in 11 weeks (W5, W8, W10) with identical pace targets. Round-2 M-02 caught back-to-back taper repetition; this caught nothing because the repetition straddled build / peak / taper. Variety at the catalogue level is what keeps a plan coachable for the runner who actually has to do it — three identical tempos in the same plan is the engine declining to use the catalogue, not a coaching choice.

The `floor(N / 3) + 1` shape:
- 3 quality sessions: max 2 of any label.
- 6 quality sessions: max 3.
- 9 quality sessions: max 4.
- 12 quality sessions: max 5.

The +1 allowance prevents tripping plans where the catalogue genuinely has only one good fit for a phase (e.g. HM peak quality is `hm_pace_intervals` per the catalogue — appearing 2-3 times in a 13-week plan is correct, not a defect).

**Config.**
- `GENERATION_CONFIG.QUALITY_VARIETY_DENOMINATOR = 3`
- `GENERATION_CONFIG.QUALITY_VARIETY_ALLOWANCE = 1`

Enforced by `INV-PLAN-QUALITY-VARIETY-FULL-PLAN`. Race-week sharpening reps (sub-band repeats with no catalogue-named label) are exempt — they're structurally distinct from the broader catalogue.

---

## 55. Critical input validation — reject nonsense values

**Principle.** Critical physiological input fields MUST fall in the acceptable range below. Empty or out-of-range values are rejected at the entry point — `validateInputFields` runs BEFORE prep-time validation (§44).

| Field | Acceptable range |
|---|---|
| `age` | 13 – 90 |
| `resting_hr` | 30 – 100 |
| `max_hr` | 120 – 220 |

`age` is required. `resting_hr` and `max_hr` are optional and may be absent — but when they are present they must be in range. A value of exactly `0` is treated as invalid (rejected) rather than missing (which the §50 HR-fallback hierarchy would handle). This forces the user to KNOW their data was rejected, rather than the engine silently substituting an estimate.

**Why.** Case 04 (2026-04-28 review): `resting_hr: 0` got past validation, and the engine still computed a Zone 2 ceiling at 140 bpm using an undisclosed fallback. Two failures: (1) a sentinel-zero value got accepted as if it were the runner's actual resting HR; (2) the silent fallback hid the data quality issue from the runner. §55 fixes the first; §50 (L-03) fixes the second.

The reject-vs-fall-back distinction matters: a runner who entered `0` (defaulted form) deserves to be told their HR data is invalid so they can fix it. A runner who entered nothing deserves an estimate with the caveat surfaced (§50). Conflating the two cases breaks both flows.

**Config.** Hardcoded thresholds in `validateInputFields()` (`lib/plan/inputs.ts`). Not in `GENERATION_CONFIG` because these are physiological boundaries, not coaching tuning.

`InputFieldError` thrown on violation. The API route (`app/api/generate-plan/route.ts`) catches it and returns 422 with the offending field, value, and range. Mirrors the §44 PrepTimeError pattern.

---

## 57. Foundation Block

The Foundation Block is a pre-plan preparation phase generated when the gap between today and the plan's `plan_start` date exceeds a threshold. It sits **before** Week 1 of the main plan and uses negative week indices (−1, −2, −3…). Weeks in this phase carry `phase: 'foundation'` and are never part of the main plan's periodisation arc.

### When to generate

| Gap | Action |
|-----|--------|
| < 7 days | Inline nudge only — "You've got N days before your plan starts. Get moving." No block generated. |
| 7–28 days | Auto-generate Foundation Block silently. Surface in plan calendar with subdued styling. |
| > 28 days | Offer the runner a choice: Start Now (plan_start = today, no block) / Add Foundation Block (auto-generated, plan_start unchanged) / Skip (dismiss, re-surface if user revisits wizard). |

### Volume rules

- **Effective baseline** = `fresh_return_active ? stated_current_weekly_km × 0.70 : stated_current_weekly_km`
- Week 1 of the Foundation Block starts at effective baseline (never above it).
- Subsequent foundation weeks may increase by a maximum of **+10% per week** (hard cap).
- The final foundation week must not exceed effective baseline × 1.10 regardless of block length.
- Long run cap per foundation week: the lesser of `longest_recent_run_km` and 50% of that week's weekly volume.
- These caps are enforced by `INV-PLAN-FOUNDATION-BLOCK`.

### Session content

Foundation weeks contain only: `easy`, `rest`, `cross-train`. No quality sessions, no tempo, no intervals, no strides.

This is enforced by `INV-PLAN-FOUNDATION-BLOCK`.

### Prep-time integration

When calculating available prep weeks, `preparationWeeks = foundation_weeks + plan_weeks`. This prevents the engine from double-penalising a runner whose gap is large.

### Week numbering

Foundation weeks use `n` values ≤ 0 (e.g., −2, −1, 0 for a 3-week block). Week 1 of the main plan is always `n: 1`. The stride-insertion guard `weekN > 0` (§28) relies on this convention.

### ZONNA voice for Foundation Block weeks

- Coach notes use the standard ZONNA voice: honest, brief, no hype.
- Example week themes: "Shake the rust off.", "Building the base.", "Last week before the plan proper. Keep it easy."
- Never promise fitness gains. Never use motivational language.

### Invariants

- `INV-PLAN-FOUNDATION-BLOCK` — validates that foundation weeks contain no forbidden session types, volume does not exceed effective baseline, and the +10%/week cap is respected.
- Existing invariants `INV-PLAN-PEAK-OVER-BASE`, `INV-PLAN-LR-PROGRESSION-CAP`, `INV-PLAN-QUALITY-EXPECTED`, and `INV-PLAN-COPY-MATCHES-SESSIONS` all skip foundation-phase weeks.

---

## 58. Past-self comparison — cohort similarity matching

**Principle.** Generic coaching ("HR was high, ease back") is weaker than self-referenced coaching ("your usual easy 10ks sit at HR 145, today was 156"). The strongest mirror coaching can offer is comparison to the user's own past, not to the prescription. Past-self comparison surfaces three things the prescription alone cannot: slow drift (zone discipline eroding over weeks), genuine adaptation (same pace, lower HR), and one-off bad days (today vs the user's own baseline, not the population's).

**Why.** ZONNA's brand thesis — *"you're trying hard, that's the problem"* — assumes the user has run patterns that reveal their own truth. Comparing today's run to the user's median for similar runs is the most honest version of that mirror. Generic feedback is replaceable by any LLM; self-referenced feedback is a defensible coaching layer.

**Config.** `lib/coaching/constants.ts → COHORT_SIMILARITY`:

```
DISTANCE_TOLERANCE_PCT  → 15      (±15% — tolerates session-day variance, preserves type purity)
MIN_COHORT_SIZE         → 3       (below this, the sample is noise)
WINDOW_DAYS_DEFAULT     → 365     (captures seasonal patterns)
WINDOW_DAYS_DENSE       → 180     (shrinks to 6 months for dense users)
DENSE_THRESHOLD         → 30      (runs in last 6 months that triggers dense window)
HR_BAND_BREAKPOINTS     → { low: 145, mid: 165 }  (three-bucket effort classification)
```

**How.** Two-axis match (cut #1): same distance band (±`DISTANCE_TOLERANCE_PCT`) and same HR band per `HR_BAND_BREAKPOINTS`. Cohort summary statistics injected into the run-feedback AI prompt for narrative voice; the AI never invents the comparison — it formats deterministic numbers. Hybrid generation pattern (ADR-006): rule engine produces the cohort summary, AI enrichment uses it for voice, AI failure is silent.

**Third axis — coaching role (cut #2, REFRAME-COHORT-01, Coaching Board 2026-08-15).** Cohort matching also requires the same **coaching role**, resolved through `coachingSessionType()` (`lib/plan/sessionRole.ts`) — never a raw `session.type`. The generator models a long run as `type: 'easy'` (INV-CLASS), so raw-type equality pooled a two-hour long run with a thirty-minute shakeout.

**Why the role axis, when the distance band already separates most of them:** the long run is where musculoskeletal load and low-energy-availability risk concentrate. A rising RPE trend *specifically on long runs* is an early tissue-tolerance warning; pooled with short easy runs it averages away — long-run RPE climbing 5 → 7 against flat short-easy 3s reads as no change, and the warning never fires. The band alone also pools a midweek 14 km easy with a 16 km long run in higher-volume runners, which are not the same session.

**Cost, and how it is paid.** Narrowing a cohort shrinks it. For the reframe's RPE pattern this binds hard — a runner gets roughly one long run a week, so the 28-day Tier-B window would leave no tolerance for a missed session or an unlogged RPE. The role axis is therefore always paired with a wider window (`REFRAME_TIER.RPE_PATTERN_WINDOW_DAYS`). Tier *qualification* still uses `TIER_B_WINDOW_DAYS` — the two must not be conflated.

**This section binds the reframe route.** `app/api/post-run-reframe/route.ts` is a consumer of this principle, not the owner of a parallel cohort model. Any new comparison surface matches here.

**Surface.** `RunFeedbackCard` (`DashboardClient.tsx`), where `run_analysis.feedback_text` already renders below the completed session. AIMark provenance unchanged — the AI is still the author of the paragraph, the cohort numbers just inform it.

---

## 59. Pre-session readiness — composite RHR / HRV / sleep signal

**Principle.** Every existing adjustment trigger fires *after* a run, when the damage is already done. The body broadcasts whether it can absorb today's planned load *before* the user laces up — overnight RHR, HRV, and sleep duration are the three weakest individual signals coaching can use, and the strongest when voted together. A composite that fires when any one of the three deviates from the user's personal baseline lets the engine catch a bad-recovery day on a quality or long session and soften it before the user grinds through it.

**Why.** ZONNA's product thesis is that runners blur their zones because they can't tell the difference between sessions. The same applies to days. A user whose HRV is down 1 SD, RHR is up 7 bpm, and slept 5 hours is *not* the same user the plan was written for at this moment. Forcing them through a tempo session compounds fatigue and drags subsequent easy days into the grey middle. Softening today, on this day's data, is the cleanest expression of "hold the zone you're actually in." It is also the only adjustment trigger that pre-empts the run rather than reacting to it.

**Config.** `lib/plan/generationConfig.ts → GENERATION_CONFIG.READINESS` (re-exported via `lib/coaching/constants.ts → READINESS`):

```
RHR_ELEVATION_BPM     → 7      (today RHR ≥ baseline + 7 bpm fires)
HRV_DECLINE_SD        → 1      (today HRV ≤ baseline − 1 SD fires)
SLEEP_THRESHOLD_HOURS → 5      (last night < 5 h fires; absolute, no baseline needed)
DEEP_SLEEP_PCT_FLOOR  → 0.10   (DS-05 — deep < 10% of staged sleep fires, when duration was adequate)
BASELINE_WINDOW_DAYS  → 14     (rolling window over which RHR / HRV baseline is established)
LONG_RUN_SOFTEN_PCT   → 0.85   (long-run distance × this on a fired day; 15% trim)
```

**Sleep quality, not just duration (DS-05).** Total sleep hours is a blunt signal: seven hours of fragmented sleep with almost no deep stage is not the recovery seven good hours buys. HealthKit reports a per-stage breakdown (deep / rem / light / awake), so the composite gains a **fourth sub-signal** — `isPoorSleepQuality` — that fires when total sleep *was* adequate (≥ `SLEEP_THRESHOLD_HOURS`) but deep sleep was a smaller share of staged sleep than `DEEP_SLEEP_PCT_FLOOR`. It is deliberately the weakest of the four: deep sleep is noisy night-to-night, so the floor is conservative (healthy adults run ~13–23% deep; below 10% is genuinely low), and it is only assessed when the source supplied a real stage breakdown — undifferentiated "asleep" minutes never read as 0% deep (that would be a false positive). It does not fire on short nights: that is `isShortSleep`'s job, and double-counting one bad night across two reasons is noise. Stages are stored in `health_daily_samples.sleep_stages` (JSONB minutes); ingest captures them in `syncRecoverySamples` (`lib/health/clientSync.ts`). Config: `DEEP_SLEEP_PCT_FLOOR` in `GENERATION_CONFIG.READINESS`.

**RHR noise-hardening (ENGINE-03-pre).** Resting HR is the noisiest of the inputs — a single elevated reading can be a measurement artefact, a glass of wine, sleep position, or a normal hormonal rhythm, none of which mean "under-recovered." Softening a quality session on a *one-day* RHR spike is a false positive, and every wrong softening teaches the runner to ignore the signal. So RHR is no longer a standalone trigger: it softens only when it **persists** (today *and* the most recent prior day both ≥ baseline + `RHR_ELEVATION_BPM`) or is **corroborated** by another same-day signal (low HRV / short sleep / poor sleep quality). HRV, short sleep, and poor sleep quality still fire on their own — they are less artefact-prone and more behaviourally meaningful. The composite now exposes a single firing decision, `softeningWarranted`, computed in `computeReadiness`; callers use it rather than OR-ing the raw booleans. The individual booleans remain for the reason string + diagnostics. No new numeric — persistence reuses `RHR_ELEVATION_BPM`. **This is the no-cycle-data precursor to ENGINE-03a: it attacks the same false-positive root (a lone RHR bump over-firing) for *all* users, including the luteal-phase case, without any reproductive-health data or permission.**

**How.** Source: `health_daily_samples` table populated by the iOS HealthKit sync (`/api/health/samples`). On TodayScreen mount the dashboard calls `/api/pre-session-readiness`, which:

1. Loads today's planned session. Returns null if it isn't quality / intervals / tempo / long.
2. Loads the last 14 days of samples plus today's sample.
3. Calls `computeReadiness()` (`lib/coaching/readinessBaseline.ts`) — pure mean + standard-deviation kernel.
4. Returns `hasBaseline: false` and exits silently when fewer than 14 days of RHR + HRV samples exist (no false-positive pollution while the baseline accrues — new users see nothing).
5. When `softeningWarranted` is true (HRV / short sleep / poor sleep quality fire alone; RHR only when persistent or corroborated — see RHR noise-hardening above), runs the proposal through `checkAdjustmentTriggers` with only `readinessSignal` populated. The trigger sits **above zone_drift** in the priority order because it pre-empts the day.
6. Soften, never auto-skip:
   - `quality` / `intervals` / `tempo` → swap to easy.
   - `long` → trim by `LONG_RUN_SOFTEN_PCT`.
7. Coach copy uses `BRAND.voiceAnchor` ("Hold the zone.") because this is the moment that tests the user's commitment to zone discipline.
8. Persisted to `plan_adjustments` as a pending row; the existing `AdjustmentBanner` UI surfaces it. Idempotent — a second mount on the same day returns the existing pending row rather than writing a duplicate.

**Tier.** PAID (`activity_intelligence`). The free tier still reads its plan and logs sessions; this is the mid-day "your plan adapts to your body" intelligence the subscription pays for.

**Surface.** TodayScreen, above the Coach note block (mirrors post-run `AdjustmentBanner` placement). User accepts → softening applied; user rejects → row reverts. Same flow as every other pending adjustment.

---

## 60. Post-run reframe — the hug AND the truth

When a runner logs a tough session and writes a reflection, the AI's job is reframe, not feedback. Reframe is a distinct coaching surface from session feedback:

| | Session feedback (existing) | Reframe (POST-RUN-REFRAME-01) |
|---|---|---|
| Trigger | Strava-linked session, automatic | User writes a reflection, opt-in |
| Subject | What happened in the data | What the runner is feeling vs. what the data says |
| Voice | Honest, dry, one paragraph | Warmth-as-permission + evidence + goal anchor, 3–4 sentences |
| Structure | Free-form | Fixed: ACKNOWLEDGE → CAUSE → PROGRESS (opt) → ANCHOR |

**Why this exists as a separate principle:** the spiral after a bad session is a real and frequent failure mode for non-elite runners. They blow a zone, the next session feels awful, and they conclude their goal is impossible. The data almost always tells a different story (this is the Zonna thesis — *"You're trying hard. That's the problem."*). The reframe surface is the only place where Zonna gets to give the runner the hug AND the truth, on the runner's own data.

**Doctrine — non-negotiable:**

1. **Graceful degradation across data tiers.** The reframe must work for users with no Strava and no HealthKit. Tier A leans on cohort + trend + drift; Tier B on plan completion + RPE patterns; Tier C on phase position + sessions logged. Evidence falls back through the ladder; voice rules stay constant.
2. **Specific evidence in sentence 2 is mandatory.** No reframe without a named data point. Generic encouragement without evidence is the failure mode.
3. **Warmth lives in sentence 1, never the closer.** Permission ≠ cheerleading. *"You're allowed a bad one"* is on-brand; *"You've got this!"* is cringe.
4. **Risk flags trump reframe.** When `acuteChronicRatio` overload, `coaching_flag === 'flag'`, fatigue accumulation (3 consecutive Heavy/Wrecked), or severe HR drift (≥15 bpm / ≥10%) fires, the reframe is silenced. The coaching warning surfaces instead. Reframe-positive against a risk signal is harm.
5. **AIMark on every reframe.** This is model output. The runner is owed provenance.
6. **PAID-only.** Gate `post_run_reframe`. Free users see the existing static post-RPE one-liner; the reframe surface is part of the subscription value.
7. **A cohort's label must match its pool.** When the reframe names the sessions it compared against — "your recent long runs" — the pool must actually be those sessions. Cohort selection resolves through `coachingSessionType()` per §58, and the reported label is the same value the filter used. A mismatch is not a rounding error: it makes a specific claim about training the runner did not do, which is the failure §61 ("no signal → no claim") exists to prevent, and it is exactly the evidence §60.2 says every reframe must carry. Locked by `lib/coaching/reframeCohort.test.ts`.

**Where this lives:**
- Numerics: `REFRAME_TIER`, `REFRAME_RISK`, `TREND_SERIES` in `lib/coaching/constants.ts`
- Voice: `docs/canonical/brand.md` § Reframe Voice (locked register, 3 good + 4 bad examples)
- Regression suite: `docs/canonical/reframe-golden-cases.md` (one case per tier + a Case D for risk-gate silence)
- Prompt builder: `lib/coaching/prompts/sessionReframe.ts`
- Risk gate: `lib/coaching/reframeRiskGate.ts`
- Route: `app/api/post-run-reframe/route.ts`

---

## 61. Limiter hypothesis — naming the physiological cause

Post-session analysis names ONE most-likely physiological limiter when the signal is strong enough to defend. The hypothesis is specific ("heat" when temp ≥22°C + HR ≥5 bpm over ceiling) or it is not stated. Generic framings ("you were tired") without data are banned. The cause-space: heat, recovery deficit, aerobic limiter (HR drift ≥12 bpm), muscular limiter (pace fade ≥20 sec/km with flat HR), pacing error (>50% of session HR above ceiling), execution (didn't commit — >50% of hard session below floor), fueling (long-run shortfall ≥10%). If none fire, no hypothesis — "no signal → no claim" is always the correct answer when the evidence doesn't stack up.

Config: `LIMITER` in `lib/coaching/constants.ts`.

---

## 62. Post-race recovery — structured return to training (AI-DEPTH-08)

After a planned race, the remaining plan weeks are reshaped with a structured recovery curve before returning to quality training. The curve is distance-keyed.

**Why this matters:** coming back too fast after a long race is the most common training error for non-elites. The body is far more compromised than it feels at day +3. For a marathon, the "3 weeks of easy before hard sessions return" rule is well-established in elite coaching practice. Violating it doesn't cause visible short-term harm (the runner feels OK); the cost arrives 6–8 weeks later as an injury, illness, or performance plateau.

**Volume curve** (% of plan peak weekly_km, week-by-week post-race):

| Distance | Wk +1 | Wk +2 | Wk +3 | Wk +4 | Wk +5 |
|----------|-------|-------|-------|-------|-------|
| 5K       | 30%   | 55%   | —     | —     | —     |
| 10K      | 30%   | 55%   | —     | —     | —     |
| HM       | 25%   | 45%   | 65%   | —     | —     |
| Marathon | 20%   | 35%   | 55%   | 70%   | —     |
| 50K      | 15%   | 30%   | 50%   | 65%   | —     |
| 100K     | 10%   | 25%   | 40%   | 55%   | 70%   |

**Quality blackout:** quality/interval/tempo/long sessions are converted to easy recovery during the first `quality_blackout_weeks` (1 for 5K–HM; 2 for marathon/50K; 3 for 100K). Quality returns only when the body can do adaptive work, not junk miles at high intensity.

**Taper protection:** weeks within `TAPER_PROTECTION_WEEKS` of a future race (Race B) are never touched by the post-race reshape. The runner may still have a Race B.

**Outcome-awareness:** the Sonnet enricher reads the race outcome (on_target / pb / off_target / dnf) and adjusts the coaching voice accordingly. DNF gets matter-of-fact recovery notes. PB gets an acknowledgment then moves on. The volume structure is identical regardless of outcome — the physiology doesn't care about the result.

**User control:** the reshape is proposed (status: pending), not auto-applied. The runner sees the summary and must accept before the plan updates. They can reject and keep the original plan.

Config: `POST_RACE_RECOVERY_BY_DISTANCE` in `lib/plan/generationConfig.ts`.
Engine: `lib/coaching/postRaceReshape.ts`.
Routes: `POST /api/post-race-reshape`, `POST /api/post-race-reshape/confirm`, `POST /api/post-race-reshape/revert`.
UI: `RaceResultSheet.tsx` (log result) + `PostRaceReshapeCard.tsx` (accept/reject).

---

## 55. Fitness signal — benchmark recalibration prompt (ENGINE-01)

When a runner consistently outperforms their target pace band on quality sessions *and* HR stays controlled, the prescription is too conservative. The correct response is not to harden individual sessions — it is to ask whether the benchmark (VDOT) has moved. All paces flow from VDOT; fixing the root is one recalibration, not session-by-session surgery.

**Pattern required before firing:**
- `N ≥ FITNESS_SIGNAL_SESSION_THRESHOLD` quality/interval/tempo sessions with `paceScore ≤ FITNESS_SIGNAL_PACE_SCORE_MAX`
- *All* qualifying sessions also have `hrAboveCeilingPct ≤ FITNESS_SIGNAL_HR_CEILING_MAX` — the HR constraint is the distinguishing signal. Fast pace + high HR = going too hard. Fast pace + controlled HR = fitness has moved.
- No concurrent fatigue accumulation in the same window (checked upstream before this trigger fires)
- `currentWeekN ≥ FITNESS_SIGNAL_MIN_PLAN_WEEKS` — early-plan variance is noise; the signal needs a baseline

**What this trigger does NOT do:** auto-harden sessions, change the plan, or assume the benchmark has moved. It fires `flag_for_review` with no session changes, sends "Kit noticed something." as a push (curiosity-gap framing), and routes to ReshapeScreen which presents a direct "Update benchmark →" CTA. The runner decides.

**Voice rule:** frame this as a discovery, not a correction. The runner has outgrown the plan quietly — Kit noticed before they did. "The plan is working from an older version of you." Never say "your zones are wrong."

Config: `FITNESS_SIGNAL_PACE_SCORE_MAX`, `FITNESS_SIGNAL_HR_CEILING_MAX`, `FITNESS_SIGNAL_SESSION_THRESHOLD`, `FITNESS_SIGNAL_MIN_PLAN_WEEKS` in `lib/coaching/constants.ts`.
Engine: `buildFitnessSignalAdjustment` in `lib/coaching/planAdjustment.ts`.

---

## 66. Long-run shortfall — match the prescription to where the runner actually finishes (ENGINE-02)

A long run logged as "complete" at 70% of its planned distance, twice in a row, is not a complete long run — it is the plan asking for more than the runner can currently execute. Chasing the prescribed number a third time does not build the runner up; it just manufactures a third shortfall and the quiet erosion of trust that comes with always falling short. The correct response is to lower the prescription to a distance the runner will finish, then build back. This is **§1 in practice — honesty over optimism**: a number the runner hits beats a number the plan wishes for.

**Pattern required before firing:**
- `LONG_RUN_SHORTFALL_CONSECUTIVE` most-recent long runs each logged at `actualKm < plannedKm × LONG_RUN_SHORTFALL_COMPLETION_PCT` (under 82% of prescribed distance — equivalent to `distance_score ≤ 50`, the 70–85% band).
- Those long runs are in adjacent (or near-adjacent) weeks — a one-off short run is noise, not a pattern. The week-gap guard rejects scattered shortfalls.
- Both/all qualifying runs have a real planned distance (`plannedKm > 0`) — duration-primary long runs are out of scope (no distance to fall short of).

**What it does:** reduces the upcoming long run by `LONG_RUN_SHORTFALL_REDUCE_PCT` (15% trim) with a coach note, as a `reduce_volume` adjustment that **requires confirmation** — a structural change to a key session is the runner's call, one tap, no explanation demanded. Easy-run shortfalls are explicitly out of scope: per §1, zone discipline outranks volume discipline, so a short easy run earns a coach note at most, never a plan change.

**Why the peak long run is safe.** §24 requires the peak long run to reach ≥85% of race distance (HM) / ≥75% (marathon). ENGINE-02 could in principle fight that. It does not, because the shared adjustment guards (`guardCheck`) suppress every automatic trigger inside `TAPER_PROTECTION_WEEKS` of race day and during the taper phase — the window where the peak long run lives. The pull-back only fires earlier, where matching reality is the right call and there is still time to rebuild.

**Voice rule:** matter-of-fact, never a telling-off. The runner already knows the runs came up short — naming it as failure is the opposite of useful. Lead with the number, frame the change as alignment not punishment, leave the door open. *"Long runs averaging 71% completion over two weeks. Prescription pulled back to match where you're actually finishing — build it back when it feels right."* Never "you keep failing to finish."

Config: `LONG_RUN_SHORTFALL_COMPLETION_PCT`, `LONG_RUN_SHORTFALL_CONSECUTIVE`, `LONG_RUN_SHORTFALL_REDUCE_PCT` in `lib/coaching/constants.ts`.
Engine: `buildLongRunShortfallAdjustment` in `lib/coaching/planAdjustment.ts`.

---

## 67. Post-race goal ladder — the next line is the engine's call, not free text (CA-03)

The moment a goal race is run, the plan that justified months of training is spent — and with it the reason to keep the subscription open. The post-race reshape handles the *recovery* (the next two weeks); it does nothing about the *next goal*. That gap — the post-race void — is where runners drift away. The fix is to meet the runner in the moment of achievement with a single card that names what they just did and proposes the next sensible line, then seeds the plan wizard so starting again is one tap.

**The options are sequenced by the engine, never improvised.** Three kinds, each computed from the finished race (distance + finish time + goal + outcome):
- **chase_time** — same distance, a faster target. If they missed the goal, re-attempt the *same* time; if they hit/beat it, a modest improvement (`GOAL_SEQUENCING.CHASE_IMPROVEMENT_FACTOR`).
- **step_up** — the next rung on the distance ladder (5K → 10K → HM → Marathon), with a Riegel-predicted target time. **Capped at the marathon** — never auto-propose an ultra; stepping a marathoner to 50K is too big a jump to suggest unprompted.
- **maintain** — same distance, no time pressure. Always offered, always last: the low-pressure option is never the headline.

Ordering reflects the outcome: a missed goal leads with chasing the same time again; a PB or on-target race leads with stepping up. Every option carries a minimum sensible prep window (`PREP_TIME_THRESHOLDS`); the wizard enforces it. This is the §24 spirit in reverse — don't let a runner under-prepare for an over-reach.

**Voice:** the achievement line is one sentence, one number, never a celebration — *"You ran 2:04:00 — 6:00 inside your goal."* Then the options, plainly. The card is **rule-engine output, so it carries no AIMark** (provenance honesty) — the accent is the race colour, not the moss AI rail.

**Tier.** PAID (richness, not access — free runners can still start a new plan from the wizard manually; CA-03 is the *intelligent proposal*, gated like other paid coaching). The card is dismissable; dismissal persists per-race in `localStorage` and auto-clears once a new plan moves the goal race into the future.

**WHEN the ladder appears — amended 2026-08-02 (MAINT-07, SLT decision). The original "meet the runner in the moment of achievement" is wrong, and shipping it that way produced a contradiction on Today:** the maintenance announcement ("your body's still repairing — the plan's eased to base running") rendered directly above "Run another 100K and take time off." The ladder now waits for the maintenance block's **Phase 3 re-engagement window** (§75) and appears there, not at the finish line.

Three reasons, each independently sufficient:
1. **The decision is made worst at the finish.** Post-race, perceived readiness recovers well before neuromuscular function does. A runner three weeks post-marathon feels ready and is not. Asking them to choose "same distance, faster" — the *lead* option after a goal miss — inside that window systematically biases toward over-reach. This is §75's own argument applied to the surfacing layer.
2. **It reframes the block.** §75 forbids any maintenance modifier from referencing a future race, and the engine honours that. Hand the runner a next race in maintenance week 1 and the block silently becomes *base for the next thing* in their head. The plan JSON stays honest; the athlete's intent doesn't.
3. **Dismissal is one-shot.** It persists for the whole block. Offering the ladder on day one spends the single opportunity at the moment the runner is least equipped to use it.

**The delay is proportionate, not fixed** — Phase 3 is the block's tail, so a 5K runner waits ~3 weeks and a 100K runner ~9. It scales with the recovery it protects.

**What is never delayed: the action.** The plan wizard stays reachable throughout the block. This holds back the *proposal*, never the runner. The gate must never read as an unlock or a timed paywall — no "available in week 9" copy, anywhere.

**When there is no maintenance block** (generation failed, or a plan shape producing none) the ladder keeps its original post-result behaviour rather than disappearing.

Config: `GENERATION_CONFIG.GOAL_SEQUENCING`, `PREP_TIME_THRESHOLDS`, `POST_RACE_MAINTENANCE_BLOCK.PHASE3_LAST_WEEKS`. Engine: `lib/coaching/goalSequencing.ts → nextGoalOptions` / `achievementLine`; window reader `lib/plan/maintenance.ts → isReengagementWeek`. Card: `components/training/NextGoalCard.tsx`. Gate: `DashboardClient → nextGoalGateOpen`.

---

## 65. Day boundary — today is in flight until midnight

**Principle.** Every surface that compares "what the runner has done" against "what the plan asked for" treats today as **in flight**, not as **done**. A run due today and not yet completed at noon is **not missed** — the day isn't over. Apply the rule to every report, push, gate, and metric that anchors its comparison on the calendar.

**Why.** Zonna is for runners who already feel behind. The product can't earn its anti-overtraining promise if its own surfaces accuse the runner of falling behind before lunch. We shipped this bug twice on the same day (weekly report at noon; Coach "X of Y" mid-week). Both times the symptom was the same — the runner reads as "behind" while their day is still in front of them. Both times the brand contradicted itself.

**Implementation rule.** Use `lib/coaching/dayBoundary.ts → daysDueByEndOfYesterday(weekStart, now)`. It returns the strictly-past day-keys for the current week — today is excluded. Single source of truth.

**Surfaces that must call it:**
- Any weekly summary that says "X of Y this week"
- Any "you missed" message in a notification, banner, or read
- Any load / volume / discipline comparison whose "actual" is partial and whose "planned" is the full week
- Any insight that fires off a "you're behind" gate (the `low_data` insight in `weeklyReport.ts` is a current honest example — only fires when 2+ sessions were *strictly* due)

**Surfaces that don't need it:**
- Load calculations against prior weeks (acuteChronicRatio etc.) — both sides are "actual completed," same basis
- Push notifications that fire only in the morning window — forward-looking, not backward
- Discipline ledger (`disciplineLedger.ts`) — already uses user-action signals (Heavy/Wrecked tags, skipped quality), not date arithmetic

**Audit on 2026-06-19 (this commit):** `/api/push/send-daily`, `acuteChronicRatio`, `disciplineLedger`, all clean. Coach `liveSessionsPlanned` was broken — fixed by adding `liveSessionsDueToDate` and using it for the "behind / on track" judgement.

**Test enforcement.** `lib/coaching/dayBoundary.test.ts` locks the exact behaviour — noon Wednesday with a Monday week start returns `['mon', 'tue']` and never `['mon', 'tue', 'wed']`. If a future contributor "fixes" the off-by-one by adding +1, the test will scream.

**Originating decision:** Traynor flagged the pattern in the weekly-report SLT review (2026-06-19) — *"this is the second 'in-flight vs done' bug we've shipped (the picker date-window had the same pattern). Worth pulling out a dayBoundary doctrine."* Deferred at the time as out-of-scope; brought forward to canon the same day.

---

## 70. Plan's over, and a race is debriefed — not scored

**Principle.** Two related rules, both surfacing the day after a goal race:

1. **The plan can end.** Once today is past the final week's 7-day window, the plan is complete — there is no "today's session". `getCurrentWeekIndex()` pins to the last week forever (there's no week after to advance into, especially when the race *is* the last week), so any surface that reads "today's slot" must first confirm today is genuinely inside the resolved week's window (`isDateWithinWeek` / `isPlanComplete` in `lib/plan.ts`). The daily coach note switches to a recovery / what's-next line; it must never prescribe the final week's stale weekday slot.
2. **A race is a debrief, not a scorecard.** A race is run at race effort, not by holding easy zones. On a race week the zone-discipline % and the acute:chronic load ratio spike *by design* — a 100 km race is a 100 km load spike. Never frame either as overload, drift, or "ignoring the plan". Below-zone HR on a long race is disciplined, conservative pacing — never "ran too hot". The weekly report drops into race-debrief mode (`RaceDebrief` in `prompts/weeklyReport.ts`), naming the actual race day; the Coach zone-discipline and load-ratio tiles show race-appropriate context instead of the scolding verdict copy.

**Why.** The brand promise is "training plans that stop you overtraining." Accusing a runner of "racing hard, not smart" and "ignoring the plan entirely" the morning after they finished their goal race — for the crime of pacing a 100 km race below Zone 2 — is the single worst moment to contradict the brand. It also read the wrong day ("Sunday's race" when it was Saturday): the day index clamped to 6 once we were past the plan, and the model was told "it is currently Sunday, day in flight". Both are the same root cause as §65 — a surface that can't tell "in flight" from "over".

**Implementation rule.** Race detection: the week's session with `type === 'race'`, completed (a completion or a `run_analysis` row for that slot). Pacing direction comes from `run_analysis.hr_below_floor_pct` vs `hr_above_ceiling_pct`. On a race week, suppress the spotlight (it would name the race as "concerning").

**Test enforcement.** `lib/planDateWindow.test.ts` (window/plan-complete boundaries), `weeklyReport.test.ts` "race debrief framing" (names the real day, refuses zone/load scoring, reads below-zone as pacing), `prompts/dailyCoachNote.test.ts` "plan complete" (never prescribes once the plan is over).

**Originating decision:** post-race bug report, 2026-07-13 — founder finished a 100 km race Saturday; Monday's Coach card said "Sunday's race … you raced hard, not smart … ignoring the plan entirely" and Today prescribed a phantom 3 km shakeout from the already-finished plan.

---

## 71. A goal race is debriefed *with* the athlete — every surface, not just the weekly report

**Principle.** §70 stopped the *weekly report* scoring a race by zone discipline. This principle carries the same doctrine to **every** post-race and difficult-session surface — the daily coach note, the post-run reframe, and the limiter — and adds three rules that §70 did not state:

1. **The plan-scoring `verdict` never reaches a race debrief.** A race session is stamped `off_target` / `concerning` by the ordinary session scorer because HR sat below zone and pace was off prescription — both of which are *correct* race execution (§70.2). That verdict must be suppressed on any surface that speaks after a race. Surfacing it — directly, or by the model editorialising it into "the race didn't land where you wanted" — is scoring the race. The daily-note plan-complete branch and the reframe must switch into debrief framing for a `type === 'race'` last session, exactly as the weekly report does.
2. **Lead with the achievement.** The debrief opens by acknowledging what was accomplished — for an endurance goal race, *finishing is the achievement*; the time is secondary. Use the deterministic `achievementLine` (`lib/coaching/goalSequencing.ts`, CA-03) — no AIMark (rule-engine output). Acknowledgement is the opener, never the closer, and never manufactured reassurance ("not a referendum" installs the doubt it denies).
3. **The athlete's account outranks the device signal for a race.** The runner's own race narrative (`Week.result_embedded` — `notes`, `what_broke`, heat, injury) is authoritative over any classifier. If the runner says "injured at 60k" or "too hot, backed off", that is the cause of the shape of the run — not the pace-fade limiter. A confident wrong diagnosis ("running out of gas" for an injury-driven fade) destroys coaching credibility with an experienced runner; **when the limiter cannot be confident, it stays silent.** The limiter (`lib/coaching/limiter.ts`) returns `null` for a race session, an ultra-distance session, or when an acute-injury signal is present.

**Why.** The goal race is the emotional peak of the whole training cycle and the natural churn cliff (race done → why keep paying?). A deflating debrief at that moment torches renewal at the highest-LTV point in the paid lifecycle, and getting an ultra debrief visibly wrong signals the product is for beginners only. The brand promise is "training plans that stop you overtraining" — the post-race job is to *witness* the effort the runner already lived, not to re-diagnose it from telemetry the runner knows better than we do.

**Scope guard (SLT 2026-07-14).** Broaden context — plan phase, temperature, acute injury — onto the **post-race and difficult-session path only**. Do *not* dump per-prompt context into every coaching prompt (phase-summary, plan weekly note, etc. do not need a temperature block). The fix is broad across the surfaces that speak after a hard effort, not universal across all prompts.

**Implementation rule.** Temperature on the race path honours ADR-011 §5 (INV-DATA-005): present only as a Strava supplement, named-absent for HealthKit-only runs, never fabricated. Ultra threshold, injury flag, and limiter-suppression conditions live in `lib/coaching/constants.ts → LIMITER` per INV-CFG-001 — no inline numerics. Reuse `Week.result_embedded` (AI-DEPTH-08) and `achievementLine` (CA-03); do not fork them.

**Test enforcement.** `dailyCoachNote.test.ts` (race last-session → verdict suppressed, achievement-led, degrades with no `result_embedded`), `limiter.test.ts` (race / ultra / injury → `null`), reframe golden suite (`reframe-golden-cases.md` A–D stay green + a race-debrief case). §70's `weeklyReport.test.ts` must not regress.

**Originating decision:** post-race coaching SLT review, 2026-07-14 — the §70 fix (2026-07-13) corrected the weekly report but the same deflating, mis-attributing debrief persisted on the Today note and the run-analysis reframe, because the verdict leak and the missing athlete-narrative channel were never closed on those surfaces.

---

## 72. An ultra effort is read as time-on-feet — never scored on fade

**Principle.** Over ultra distance, back-half pace fade and late cardiac drift are **expected physiology** — glycogen depletion and accumulated fatigue, not a pacing error or a fitness gap. The coaching surfaces (`sessionFeedback`, `sessionReframe`, and the limiter) must not cite that fade as a fault or tell the runner to "start slower". This applies to any effort at/above the ultra threshold — a race *or* a 50km+ long run — not only to sessions tagged `type === 'race'`.

- The limiter (`lib/coaching/limiter.ts`) returns `null` at/above the threshold — a "muscular" or "aerobic" limiter call is invalid when the distance itself explains the fade.
- `sessionFeedback` and `sessionReframe` drop the pace-fade / HR-drift *citation* blocks for an ultra effort and frame the run as fatigue-resistance work. A non-race ultra keeps its ordinary training-session read (verdict, cohort, EF); only the fade-as-fault framing is suppressed.
- This is the debrief-surface complement to the plan-generation ultra doctrine already in force: ultra long runs are protected aerobic time-on-feet (§24e), ultra plans carry their own intensity distribution (§1), peak-volume floors (§46), taper rhythm, and post-race recovery curves (§62).

**Why.** A negative or even split over 100km is the rare exception even in elite fields; fade across the back third is near-universal. An engine that reads that fade as "you went out too hard" or "your legs aren't strong enough" is scientifically illiterate to any experienced ultra runner and destroys credibility with a high-commitment, high-willingness-to-pay segment (Hutchinson, SLT 2026-07-14). It is the same class of error as scoring a race by zone discipline (§70.2) — the wrong yardstick for the effort.

**Config.** The ultra threshold is `GENERATION_CONFIG`-adjacent: `lib/coaching/constants.ts → LIMITER.SUPPRESS_ULTRA_DISTANCE_KM` (50km, the standard ultra floor — beyond the marathon, where fatigue-resistance rather than pace is the demand). Single source, read by the limiter and both prompt builders (INV-CFG-001). Distinct on purpose from `getDistanceBucket`'s recovery-curve boundaries (§62) and `raceKeyFromKm`'s ladder buckets (CA-03) — those answer "which recovery/plan shape?", this answers "is fade a fault here?".

**Test enforcement.** `limiter.test.ts` (ultra-distance → `null`, control just under the threshold still fires), `sessionFeedback.test.ts` / `sessionReframe.test.ts` (ultra-distance non-race effort → no pace-fade citation, time-on-feet framing present).

**Originating decision:** RACE-DEBRIEF-03, 2026-07-14 — Phase 1 silenced the limiter on ultra distance; this principle extends the "fade is expected, not a fault" framing to the AI debrief surfaces for every ultra effort, and backstops the threshold constant (INV-CFG-002).

---

## 73. "Are we past plan-week N?" is a date-window question — never an index compare

**Principle.** Any surface reasoning about temporal position relative to a plan week — *is today past the race week? past the taper? past the plan?* — must ask a **date-window predicate**, never compare an index against `getCurrentWeekIndex()`.

- The current-week pointer **saturates at the final week**: `getCurrentWeek()` falls back to the last week once today is past the plan's window, so `getCurrentWeekIndex()` returns the last index forever. A comparison like `currentWeekIndex > raceWeekIdx` is therefore **unreachable when the target week is the last week** — and the goal race is *normally* the final week.
- The canonical predicates live in `lib/plan.ts`: `isDateWithinWeek(week, date)` (inside the window), `isDatePastWeek(week, date)` (past the window's end), and `isPlanComplete(weeks, date)` (a special case of `isDatePastWeek` on the last week). These are the single owner of "when are we?" reasoning (D-08). No surface reimplements it with index arithmetic.

**Why.** This is the third instance of one bug class: a saturating pointer used to reason about "done vs in-flight." It bit the day boundary (§65 — day-level), the plan-complete surfaces (§70 — daily note + weekly report), and then the **post-race result prompt**: `DashboardClient`'s `postRaceState` (`currentWeekIndex > raceWeekIdx`) and `finishedRace` (`currentWeekIndex <= idx`) both silently never fired when the race was the final week. The knock-on was large and invisible — the `RaceResultSheet` prompt never appeared, so `Week.result_embedded` was never captured, which starved *everything* downstream of it: the CA-03 goal ladder, the AI-DEPTH-08 post-race reshape, and the RACE-DEBRIEF-02 narrative enrichment. A whole shipped post-race surface was dead for the majority (final-week-race) case, and nothing errored — the prompts just never rendered.

**Implementation rule.** `isDatePastWeek(plan.weeks[raceWeekIdx], now)` replaces both index comparisons. When adding any "past week N" check, reach for the predicate. A raw `getCurrentWeekIndex()`-vs-index comparison used to decide "have we passed X" is a defect on sight — grep for it in review.

**Test enforcement.** `lib/planDateWindow.test.ts` — `isDatePastWeek` window boundaries (day before end = false, end day = true) and `isPlanComplete`-via-delegate parity on the last week.

**Originating decision:** POST-RACE-PROMPT-01, 2026-07-14 — surfaced while answering "what race result sheet?" during the RACE-DEBRIEF work: the founder had never seen the post-race prompt because it was gated on the saturating index compare, which also explained why their debrief carried no injury/heat context (no `result_embedded` was ever logged).

---

## 74. A logged race result persists on submit — the reshape never gates the write

**Principle.** Logging a race result is a single **unconditional write** that happens the moment the runner submits. The optional post-race reshape (recovery-week restructuring) is a layer offered *on top* — it never gates whether the result is saved. And the client reflects the saved result **immediately**, so submitting always produces a visible outcome.

- Both submit actions ("Log result" and "Log result only, keep my plan") POST through the same path and persist `Week.result_embedded`. There is no button that logs a result without saving it.
- On submit the server saves the result-embedded plan and returns it; the client applies it, so the CA-03 goal ladder ("what's next") and the debrief context appear at once — that surfacing IS the acknowledgment (no popup — N-004).
- "Keep my plan as-is" declines the *reshape*, not the *result*: the result stays, only the recovery restructuring is skipped (and no pending reshape row is staged, so nothing resurfaces on reload).

**Why.** The founder logged a 100k, submitted, and saw nothing: the "keep my plan" button made no network call (the result was silently discarded), the reshape path only wrote `result_embedded` on *Accept*, and no success path updated client state. For a final-week race there is no reshape and therefore no Accept button to find — so the write appeared to do nothing. A user's logged data must never be contingent on a downstream optional decision they may never reach. This is the race-result sibling of the completion write-boundary rule (RESHAPE-FIX-WAVE2B / ADR-011 §3b): the write lands at submit, at the boundary, unconditionally.

**Implementation rule.** `POST /api/post-race-reshape` always `savePlanForUser(embedRaceResult(plan))` before the reshape branch and returns `plan`; the `offer_reshape:false` body flag persists the result without staging a reshape. `RaceResultSheet` routes both buttons through one `submitResult(offerReshape)`; `DashboardClient` `onLogOnly`/`onReshapeReady` call `setPlan(updatedPlan)`.

**Test enforcement.** No route/component test infra in the repo today; the pure reshape engine (`postRaceReshape.test.ts`) is unaffected. Verified by typecheck + build + natural device use — a logged result must surface the goal ladder without a reload.

**Originating decision:** POST-RACE-PROMPT-02, 2026-07-14 — "yes fix it. It should be obvious. I didn't see anything that said Accept anywhere."

---

## 64. Day-level rest — every training week needs at least one rest day

**Principle.** Every plan week must contain at least one rest day. Six-on / one-off is the upper limit for non-elite runners; seven-on is overreaching dressed as commitment. Race week is excluded — the prescribed structure already includes its own rest.

**A rest day is the absence of a session, not a session.** *(Amended 2026-08-06 — GEN-FIX-09. Ratified by SLT 2026-08-06 — GEN-FIX-12.)* A week satisfies this rule when at least one of its seven days carries no training session. An explicit `type: 'rest'` entry also satisfies it — the post-race maintenance block emits those deliberately, because there the rest day is a *prescription* ("do nothing, it helps") rather than a gap.

**The six-day ceiling is deliberate and now legible.** *(SLT-ratified 2026-08-06 — GEN-FIX-12, Flag 1.)* `MAX_TRAINING_DAYS_PER_WEEK = 6`: the plan builds at most six training days and forces ≥1 rest day. The Generate-Plan wizard offers 2–6 days only — seven is never selectable — so the ceiling was previously enforced silently by omission. Per the board (Sutherland/Wood/Traynor: restraint the user can't see doesn't change behaviour and forfeits the credibility it earns), the wizard now names it in one line — *"Six is the cap, on purpose — a rest day does more than a seventh run would."* — turning a silent constraint into the product's stated point of view. Ratified: (a) implicit rest as canon, (b) the six-day cap as intended, surfaced not silent.

**Why the amendment.** The rule previously required an explicit `type: 'rest'` session. `generateRulePlan` has never emitted one — a 3-day-a-week plan simply leaves four days empty — so **every plan generated since R23 violated this principle once per non-race week**, and the error-severity invariant fired every time. It went unnoticed for months because `validatePlan` throws in dev/test but only logs in production, and plans are not generated in dev. The engine was right and the rule was wrong: demanding a session object to represent the absence of a session inverts what a rest day is. This is the failure mode §56 warns about — a numeric, or here a shape, with a principle behind it that nobody re-read.

**Why.** Day-level recovery sits beneath week-level recovery (§3). The weekly recovery week handles cumulative load over four-week cycles; the per-week rest day handles acute load between hard sessions. Without it, every "easy" day is forced to absorb someone else's recovery duty — which is exactly how easy creeps hot.

**Enforcement (three layers per Decision #4):**
1. **Principle** — this section.
2. **Constitutional invariant** — `INV-PLAN-WEEK-HAS-REST-DAY` in `lib/plan/invariants.ts → validatePlan()`. Plan generation produces a week without a rest day → error.
3. **Move-time trigger** — `lib/coaching/planAdjustment.ts → buildReorderAdjustment`. User drags a session onto the rest day → the post-move week has no rest day → flagged in the proposed adjustment. The override stays available — restraint isn't enforced, but it's named.

**Shared helper** — both triggers call `weekHasRestDay(sessions)` so the rule has one implementation. Single source of truth (D-08).

**Config** — none. This is a structural rule, not a tuning knob.

**Originating decision:** PL-MOVE, SLT-reviewed 2026-06-19. Decision #4 locked the three-layer pattern: principle + validator + trigger. Future per-week invariants follow the same shape.

---

## 63. Session intent — every type explains its place in the week

Every session type carries a one-line **rationale** — not what to do, why this session exists in this week. The detail screen used to explain *what* and *how* (prescription + execution) but rarely *why this exists*. For an anti-overtraining product, the rationale is the most persuasive sentence each surface owns. "This is easy on purpose, so Thursday can be hard." "Recovery, not light training — going hard here steals the next quality day."

**Where it lives:** `session_guidance` table in Supabase, one row per session type with optional phase variation. The `why` column is the rationale; `what` and `how` are prescription + execution. Render path: `DashboardClient.tsx → CoachNoteBlock variant="why"`. Free users see the rule-derived `why` line; paid users see AI-enriched `session.coach_notes` baked into the plan JSON which takes priority.

**Voice rules** (per `CLAUDE.md` voice table — honest, slightly dry, never motivational):
- One sentence is better than two. Specific beats abstract.
- The line names *the trade-off* or *the consequence* of doing this session wrong, not just what it is.
- Reference the zone idea when possible — that's the product thesis.

**The ten session types must each have a row.** A missing row means a free user on that session type sees no `why` block — the rationale is silent, the prescription has no defence. Audit periodically.

**Originating decision:** SD-WHY backlog item, SLT-reviewed 2026-06-19. Initial migration `20260619_session_guidance_sd_why.sql`.

---

## 68. Taper recalibration — re-anchor to the body that actually trained

**Principle.** When the runner enters their taper phase, recalibrate the taper week volume targets to their *functional peak* — the average of their top two actual training weeks — rather than the original planned peak. If actual functional peak is below 85% of planned, the original taper is too high.

**Why.** A taper is a reduction from what the body is adapted to, not from what was written on the plan. A runner who completed 60% of their planned peak volume carries none of the accumulated fatigue the original taper was designed to dissipate. Tapering from a fiction means arriving at the start line under-recovered *relative to what they actually did* — not over-rested, just mistargeted. The taper targets should reflect the body, not the spreadsheet.

Two distinct failure modes this prevents:
- *Undertrained runner*: planned taper targets are near or above their actual peak → almost no perceived reduction → no real freshening.
- *Inconsistently trained runner*: big weeks followed by collapses → a single peak week is an outlier, not an adaptation signal. Using the average of the top two weeks is more representative of what the body has consolidated.

Upward recalibration (overperformance) is intentionally excluded — a well-trained runner tapering below planned targets arrives fresh without penalty. Upward adjustment of taper volume carries injury risk and is the wrong intervention; the benchmark recalibration path handles confirmed fitness improvement.

**What is recalibrated.** Volume targets only. Session types, quality session counts, rest days, and race week structure are unchanged. Race week is never touched — its shakeout-only structure is sacred (§26, §30).

**Trigger.** Fires once, automatically, on the first day of the taper phase, when a paid/trial user has at least two weeks of actual data on record for their build/peak weeks. Idempotent — `plan.meta.taper_recalibrated_at` prevents re-runs.

**Config.**
- `GENERATION_CONFIG.TAPER_RECAL_VOLUME_THRESHOLD_PCT` (85) — trigger threshold
- `GENERATION_CONFIG.TAPER_RECAL_FUNCTIONAL_PEAK_WEEKS` (2) — weeks to average for functional peak
- `GENERATION_CONFIG.TAPER_RECAL_MIN_WEEKS_DATA` (2) — minimum data required

**Implementation.** `lib/plan/taperRecalibration.ts → computeTaperRecalibration()`. API route: `POST /api/recalibrate-taper`. Wired into `DashboardClient` at the paid coaching data load on taper entry.

---

## 69. Magnitude calibration — the structural change that earns confirmation

**Principle.** The engine auto-applies changes the runner would have consented to silently — small intensity tweaks, sub-15% distance trims, coach-note-only flags. The engine surfaces a confirmation tile for changes the runner needs to consciously sign off on — day-of-week moves, session-type changes at any slot, distance changes above the threshold per session, and cumulative week-volume changes above the floor.

**Why.** A coach who silently moves Sunday's long run to Tuesday is not coaching — they're rearranging someone's life without consent. The 2026-06-26 incident shipped exactly that, with an AI summary that lied about it. The fix is not "ask for permission on everything" (which destroys habit-formation automaticity and turns coaching into notification fatigue) and not "ask for permission on nothing" (which restores the autonomy the engine has not earned back). The fix is to draw the line at *what kind of change requires consent*, and then enforce that line in one place.

Habit research (Wood) is explicit: friction added to small, frequent decisions costs more than the decisions themselves. A runner who confirms a 0.7km easy-run trim three times a week stops paying attention; that engagement debt then bleeds the structural confirmations that *should* land. Reserve confirmation for the changes the runner would tell a real coach about: "you moved my long day," not "you trimmed Tuesday's easy by 700m."

**The line.**

| Category | Examples | Magnitude |
|---|---|---|
| Day-of-week move (any session) | session_reorder, swap | **high** — always confirm |
| Session-type change at a slot | tempo → easy, long → rest | **high** — diff `kind === 'replaced'` |
| Skip-with-reason | runner missed work, engine absorbing | **high** — runner signs off on how |
| Pre-session readiness softening | quality → easy on a high-RHR morning | **high** — pre-session prompt is visible by design |
| Per-session distance change > 15% | long_run_shortfall trimming 20%+ | **high** |
| Week-total distance change > 15% | compound small trims summing high | **high** — catches "death by 1000 cuts" |
| Per-session distance change ≤ 15% | acute_chronic_high standard 15% trim | low — auto-apply silently |
| Coach-note-only adjustment | zone drift HR reminder, EF decline flag | low — auto-apply silently |
| No structural change | informational triggers | low — auto-apply silently |

**Config.**
- `GENERATION_CONFIG.RESHAPE_AUTOAPPLY_THRESHOLDS.DISTANCE_CHANGE_PCT_THRESHOLD` (15) — per-session trim/extend ceiling for silent
- `GENERATION_CONFIG.RESHAPE_AUTOAPPLY_THRESHOLDS.WEEK_VOLUME_PCT_THRESHOLD` (15) — week-total ceiling for silent

15% mirrors the existing `LOAD_RATIO.watch` reduce-volume trim — that exact engine behaviour is sub-threshold by design. The engine's standard "this week was a bit too much, soften 15%" decision stays automatic; anything beyond it crosses into structural-change territory.

**Implementation.** `lib/coaching/reshapeMagnitude.ts → computeReshapeMagnitude(proposed)` is the single decision point. Pure function, deterministic. The route `/api/adjust-plan` calls it after the builder runs and uses its verdict as the authoritative `requiresConfirmation`. Builder-level flags are not consulted post-Wave-3 — ADR-012 is the architectural reference.

**Trade-offs deliberately accepted.**
- Builder `requiresConfirmation` is now informational only. Cleanup work to remove it from builder return shapes is tracked but low priority.
- A new trigger that needs domain-specific magnitude logic must extend the helper rather than self-determine. Acceptable cost — the alternative is the 2026-06-26 incident class re-emerging.

**Originating decision:** RESHAPE-FIX-WAVE3 / SLT 2026-06-26 (Sutherland, Fried, Hutchinson, Wood, Traynor). ADR-012 documents the architectural rationale; this principle is the coaching-language anchor.

---

## 75. Post-race maintenance block — protecting the recovery window

After a goal race, the body's repair work continues well past the finish line. Inflammation markers (CK, IL-6, cortisol) remain elevated for weeks in age-group runners — longer at greater distances, longer with higher RPE, longer after a DNF (incomplete effort plus accumulated load). Running quality sessions into this window produces adaptation in tissue that is not yet ready to adapt; the stimulus lands on a structure still repairing itself, not recovering from it.

**The maintenance block is not optional.** It is not a reward for racing well or a fallback for runners who feel bad. It is the mechanical consequence of what a race does to the body.

**Anchored to BASE, not peak (rev 2026-08-02).** The original model held Phase 2 at 70% of plan *peak* — near-full training load for weeks with no goal race, which is "way too much" for a recovery/maintenance window. Maintenance means "return to your sustainable base and tick over," so volume now anchors to the plan's **base** volume (the level the athlete built from), defaulted **below** it. Distance-general — every plan has a base.

**Two phases:**

*Phase 1 — Restoration.* Quality blackout — easy runs, rest, cross-training only. Volume ramps from a low start (`RESTORATION_START_PCT_OF_BASE`, 25% of base) up to the Phase 2 target. Distance-keyed duration, extended by the person-and-circumstance modifiers below.

*Phase 2 — Base.* A genuine tick-over: volume held at `PHASE2_VOLUME_PCT_OF_BASE` (55%) of base — scaled by intent (below), never above base. One mild quality session/week from week 2 — **unless injured**.

**True to the athlete, not just the distance (Layers 2–5, rev 2026-08-02).** Every data point available at generation shapes the block; none references a future race (there may not be one). Each modifier extends restoration and they **stack**:
- **Injury (Layer 2)** — any `injury_history` flag → no quality return anywhere (easy-only) + 1 extra restoration week (`INJURY_PHASE1_EXTENSION_WEEKS`). `INV-MAINT-INJURY-EASY-ONLY`.
- **Plan response (Layer 3)** — if the completed plan was hard on them (≥ `RESPONSE_HEAVY_TAG_FRACTION_THRESHOLD` of logged sessions tagged Heavy/Wrecked, or mean logged RPE ≥ `RESPONSE_HIGH_RPE_THRESHOLD`) → +1 restoration week. Requires ≥ 4 logged sessions — a hard block is never inferred from noise.
- **Recovery markers (Layer 4)** — if RHR/HRV are still off the personal baseline at generation (`computeReadiness`, §59) → +1 restoration week. Health data optional; neutral when absent.
- **Intent (Layer 5)** — what the athlete wants from the period (`rest` / `tick_over` / `stay_sharp`) scales the base-anchored volume via `INTENT_VOLUME_MULTIPLIER`. Default `tick_over`. Captured in the post-plan review — **never inferred from a next race**.

Race-day RPE (≥ 8) and DNF still each add a restoration week, as before.

**Why the specific durations (distance-keyed):**
- 5K/10K: 1 week blackout. Peripheral damage is low; central fatigue resolves in days.
- HM: 1 week blackout. Muscle glycogen and minor structural stress. ~3 weeks total.
- Marathon: 2–3 weeks blackout. Substantial glycogen depletion, inflammatory load, eccentric muscle damage. ~6–8 weeks total.
- 50K: 3 weeks blackout. Ultra loading adds time-on-feet stress beyond marathon pace stress. ~8 weeks total.
- 100K: 4 weeks blackout. Inflammation markers (CK, IL-6, cortisol) remain elevated 3–4 weeks in age-group runners — the standard literature floor (3 weeks) is the elite case. Non-elites absorbing accumulated fatigue with day-job stress need the extra week. ~10–12 weeks total.

**What is not permitted in Phase 1:** tempo, threshold, intervals, long run, VO2max, any race-specific or ultra-specific catalogue session. These are not optional omissions — they are banned. INV-MAINT-PHASE1-SESSION-TYPES enforces this mechanically.

**What is not permitted in any maintenance week:** race-specific or ultra-specific sessions. The race is over. The maintenance block is not race preparation. INV-MAINT-NO-RACE-SPECIFIC enforces this.

**Volume ceiling:** no maintenance week — Phase 1 or Phase 2 — exceeds **base** volume (`VOLUME_CEILING_PCT_OF_BASE`, 100% of base). Hard cap regardless of fitness signals or intent (even `stay_sharp` clamps at base). The runner may feel ready for more; the cap holds anyway. `INV-MAINT-VOLUME-CEILING`.

**Run cadence — the athlete's real rhythm, both frequency AND days.** The block runs on the days the athlete *actually ran*, at the frequency they actually ran — not a hardcoded day pattern, and never `meta.days_available` (which counts strength/cross-train days and may be aspirational). Resolution order:
1. **Actual completions first (`inferActualRunCadence`).** Cross-reference `session_completions` against the plan to find which day-of-week slots the athlete genuinely completed runs on (e.g. tue/fri/sat/sun) and how often. This drives both *which days* the block schedules and *how many* — so maintenance never lands runs on the athlete's strength/rest days. Requires a confidence floor of completed runs (`ACTUAL_CADENCE_MIN_COMPLETED_RUNS`); below it, don't infer a rhythm from a handful of logs.
2. **Plan-prescribed fallback (`inferRunDaysPerWeek`).** When logs are too sparse, use the frequency the plan prescribed, on the default day order.
3. **`meta.days_available`** as a last resort.

Two rules keep it conservative in both paths: **recovery jogs don't count** as a committed run day (supplemental easy volume, not a committed day), and when run-days drift across weeks the **lower median** wins — maintain at the sustainable cadence, not the busiest week. Exactly one long day per week (the last training day in week order). A maintenance week may never schedule more run days than this source cadence. `INV-MAINT-CADENCE`. Config: `ACTUAL_CADENCE_MIN_COMPLETED_RUNS`.

**Voice register during the block:**
- Phase 1: flat, factual. One sentence. No race reference after week 2. No forward goal language. DNF register: most restrained in the product — zero pressure, zero forward-looking framing. *"The body doesn't know what it didn't finish. Recover anyway."*
- Phase 2: quiet and settled. *"Back to base."* Nothing to prove. No celebration of what was.
- No "great job" framing anywhere in the block. The race happened. This is what comes after.

**A standalone plan, not an appended chapter (MAINT-06, ADR-013).** Maintenance is its OWN plan object. When the race completes, the race plan **ends and moves to history** (`plan_archive`, via `savePlanForUser`'s race-change guard) and a standalone maintenance plan (`meta.plan_kind='maintenance'`) becomes the sole active plan. A finished race must never read as the "active plan" — running it *closed* that plan; the maintenance block is a distinct, low-stakes cycle with no goal event. `week_n` continues the sequence (26+) so completions/analysis never collide with the archived race plan (no migration; the app keys by `week.n`).

**Surfacing — announce, never gate (MAINT-04).** The maintenance plan is auto-live; the runner never *approves* it (an accept/decline gate would hand an overtrained runner a way to decline their own recovery — SLT-rejected). But it must not appear silently: a one-time Today announcement marks the race done, explains in one sentence why the plan eased, and shows the shape (days/week · weeks · below base). Its affordance is "See the plan", not accept/decline — editable, not approvable. Seen state lives on `meta.maintenance_transition_seen` (on the maintenance plan). Rule-engine copy carries no AIMark; the PAID weekly debrief does.

**Phase 3 — re-engagement (MAINT-07).** The final `PHASE3_LAST_WEEKS` (2) weeks of Phase 2 are the block's closing register. **Training does not change at all** — same volume, same one-mild-quality cap, same invariants; these weeks stay `phase: 'maintenance_base'` and carry a separate `reengagement: true` marker rather than a third phase value (a new phase string would force every call site that switches on `maintenance_restoration|maintenance_base` to learn a case that has no training meaning). What changes is only what the app is permitted to say:

- The rule-engine theme becomes **"Still here. When you're ready."** (`PHASE3_THEME`) — the one place in the block where looking forward is allowed, stated once, without pressure. It never names a distance, a race, or a target, and never asks a question.
- The **CA-03 goal ladder surfaces here and nowhere earlier** (§67, amended). Phase 3 is the *only* forward-goal surface in the entire block.
- The PAID weekly debrief may match the register (`enrichMaintenance` prompt), still without naming a target.

**Phase 3 must arrive, not merely stop hiding.** The window is a deliberate beat: the block opened with the "After the race" announcement and closes wearing the same eyebrow and the same recovery-green rail, so it reads as the app coming back after waiting — never as a feature unlocking. `INV-MAINT-REENGAGEMENT-WINDOW` enforces the window's placement mechanically. `isReengagementWeek()` derives the window from the block's shape when the marker is absent, so maintenance plans generated before MAINT-07 reach Phase 3 without a migration.

**Config:** `GENERATION_CONFIG.POST_RACE_MAINTENANCE_BLOCK` — all numerics (base-volume anchors, intent multipliers, duration modifiers, thresholds, `PHASE3_LAST_WEEKS`) live there; none is hardcoded. Generator: `lib/plan/maintenance.ts → generateMaintenanceBlock()` (person inputs threaded from `app/api/maintenance-block/route.ts`, which derives base volume, injuries, whole-plan response, and recovery markers). `validateMaintenanceBlock()` in `lib/plan/invariants.ts` enforces structure mechanically.

---

## 76. The plan is anchored to race day, not to the start date

**Principle.** A plan is laid out **backwards from the race**, not forwards from the start date. The final week of every plan MUST contain `race_date`. When more calendar weeks are available than the distance's ideal plan length, the surplus **delays the start** — it is never dropped from the end.

**Why.** A training plan is a countdown to a fixed event. Every other rule in this document — taper depth, peak placement, race-specific exposure, recalibration cadence — is expressed relative to the race, so a plan whose final week is not the race week has silently mis-scheduled all of them at once. A runner who finishes the plan eleven days early does not get a longer taper; they get an unplanned, uncoached void at precisely the point where the plan's guidance matters most, and they will fill it by guessing.

The failure is specifically an *end*-truncation: `min(available, ideal)` weeks counted forward from the start discards the tail. Counting backwards from race week discards nothing — it moves the start, and the gap before it is already owned by the foundation block (§ Foundation block), which exists for exactly this situation.

**Consequences that follow from the anchor:**
- Surplus weeks are absorbed before the plan, never after it.
- When available weeks are fewer than ideal, the plan simply starts as soon as it can — the race week is still last.
- `meta.plan_start` is a **derived output**, not the caller's input. The caller proposes the earliest possible start; the engine returns the actual one.

**Config.** No numerics — this is structural. Week boundaries are Monday-anchored (a structural constant, exempt under INV-CFG-003), matching `nextMonday()` and `DAY_ORDER`.

**Enforced by** `INV-PLAN-COVERS-RACE-DATE` (error severity) in `lib/plan/invariants.ts`. Implemented in `calcPlanLength()` (`lib/plan/length.ts`), which owns all plan date arithmetic.

---

## 77. The race sits on race day, and race week builds towards it

**Principle.** The race session MUST be placed on the actual weekday of `race_date`. Race-week supporting sessions (shakeouts, the §39 mid-week easy) MUST fall **before** the race within that week — never after it.

**Why.** Placing the race by day-of-week *preference* rather than by its real date produces a plan that names the right week and still tells the runner to race on the wrong day. It also inverts race week: a shakeout scheduled two days "before" a Sunday race lands *after* a Wednesday one, so the runner is prescribed a warm-up for a race they have already run.

The race is an **external fixed event, not a training session.** Two rules follow:
- `days_cannot_train` does **not** apply to the race. A runner who cannot train on Wednesdays can still race on one; the constraint describes their training week, not their life.
- Every other race-week session **does** respect `days_cannot_train`, because those are training.

**Consequences.** A race early in the week leaves little or no room for shakeouts inside race week. That is correct and must not be "fixed" by borrowing days after the race. But **race week must not leave the runner on days of complete rest with no neuromuscular priming** — §30's strides matter most in the final 48h. So when the `[5,3]` offsets all fall outside race week (a Tue/Wed race), a single pre-race shakeout with strides is placed on the **nearest available day before the race that still sits inside race week** (CD-7, 2026-08-06). A Monday race genuinely has no earlier in-week day; there the preceding taper week should carry the priming — a cross-week change still open (backlog PV2-G). Race week may still legitimately contain only the race + this one shakeout.

**Config.** `GENERATION_CONFIG.RACE_WEEK_SHAKEOUT_DAYS_BEFORE_RACE` — the preferred spacing, in days before the race, of race-week shakeouts. Default `[5, 3]`, which reproduces the long-standing Tue/Thu placement for the Sunday-race case while generalising to every other race weekday. Offsets that fall outside the race week, or on a blocked day, are skipped rather than relocated.

**Enforced by** `INV-PLAN-RACE-ON-RACE-DAY` (error severity) in `lib/plan/invariants.ts`.

---

## 78. Recalibration weeks prescribe the benchmark, they don't just suggest it

**Principle.** A week listed in `meta.recalibration_weeks` MUST contain a benchmark session — a 5K time trial at maximal effort. The week's theme has always instructed the runner to "run a parkrun or timed 5K"; the session must actually be on the plan. `meta.recalibration_weeks` is derived from the produced plan, not from intent: a week only appears there if the session was genuinely placed.

**Distinct from §32.** §32's tune-up callout is an *optional* suggestion on a build week and deliberately adds no session. This is the opposite: a prescribed session on a deload week. They coexist and serve different jobs — §32 defuses "should I race this weekend?", §78 refreshes the numbers the whole plan is derived from.

**Why.** Everything downstream of generation descends from two measurements: a VDOT from one benchmark run, and a max HR. Neither is refreshed anywhere else in a plan's life. Paces, zones, the confidence score and every "you ran too hard" verdict inherit whatever those two values were on day one — and a stale VDOT propagates for the plan's entire duration.

It also closes a loop the engine could not otherwise escape. When max HR is estimated or observed too low, every easy run reads as above-ceiling, the coaching says slow down, the runner never approaches their true max, and the next observation confirms the same depressed value. **A maximal effort is the only exit, and an all-easy plan structurally forbids one.** (See `docs/incidents/2026-08-06-plan-defects/analysis.md` §6 — this is not hypothetical.)

Three further consequences, all deliberate:

- **It is the contrast case.** Zone discipline is a *discrimination* behaviour — the runner must tell easy from hard and commit to whichever is prescribed. A plan where every session is easy offers nothing to discriminate against, so "easy" stops being a choice and becomes just "running". One hard effort per block is what makes the other eleven sessions legible as a decision.
- **Beginners get it too.** The session is typed `hard`, not `quality`, so it does not count against `QUALITY_SESSIONS_PER_WEEK_MAX` (§ intensity ceiling). A beginner on a zero-quality plan still gets one legitimate hard effort per block. This is intentional: a benchmark is a *measurement*, not a training stimulus, and withholding measurement from the runners whose numbers are least reliable is exactly backwards.
- **It is placed on a deload week on purpose.** Fresh legs make the measurement meaningful, and the reduced surrounding volume absorbs the cost.

**Implementation.** The session converts the deload week's midweek easy run rather than adding a day — same distance, same duration, so weekly volume is unchanged. It is structured warm-up / 5K hard / cool-down, which is what a time trial actually is. If the slot is too short to contain a real 5K plus warm-up and cool-down, no conversion happens **and the week is not listed as a recalibration week** — the metadata follows the plan, never the intent.

**Config.** `GENERATION_CONFIG.RECALIBRATION_TIME_TRIAL` — `{ distance_km, min_slot_km }`.

**Enforced by** `INV-PLAN-RECALIBRATION-HAS-SESSION` (error severity).

---

## 79. Fitness level — VDOT and volume answer different questions

**Principle.** Fitness level is assessed from **both** the benchmark (VDOT) and current training volume. VDOT measures what a runner can currently *race*; volume measures what they can currently *absorb*. Where the two disagree, the plan takes the **lower** level for structure — weekly volume, peak km, long-run caps — and the **higher** level for the intensity allowance. The disagreement is surfaced in `meta`, never resolved silently.

**Why.** Classification ran from VDOT alone whenever a benchmark existed. The first organic user ran a 29:00 5K (VDOT 30.8 → beginner) while training 30 km/week with a 12 km long run (volume → intermediate). Being labelled a beginner set `QUALITY_SESSIONS_PER_WEEK_MAX` to 0, which removed **every quality session from a 14-week half-marathon plan**. One threshold, read from one signal, cascading into the whole plan shape — and the runner had explicitly said they *like* hard sessions.

The two signals fail in opposite directions, which is exactly why both are needed:

- **Fast but low volume** (a returning runner, or a short-distance specialist stepping up): VDOT says experienced, volume says beginner. Prescribing experienced-level volume risks injury. Prescribing beginner-level intensity wastes a working engine.
- **Slow but high volume** (the first organic user, and most of this product's audience): VDOT says beginner, volume says intermediate. Prescribing intermediate volume is a real risk. Prescribing zero intensity for fourteen weeks is under-training someone with a functioning aerobic base.

The asymmetry in the resolution is deliberate: **volume is where injuries come from, intensity is where progress is lost.** Being cautious about the first and generous about the second minimises the cost of being wrong in either direction.

**The beginner intensity ceiling itself is unchanged** (§ intensity ceiling, `QUALITY_SESSIONS_PER_WEEK_MAX.beginner = 0`). A genuine beginner — both signals agreeing — still gets no quality sessions, and that remains correct. What changed is *who counts as one*. The classifier was the defect, not the ceiling.

**Config.** `GENERATION_CONFIG.FITNESS_VDOT_THRESHOLDS`, `GENERATION_CONFIG.FITNESS_VOLUME_THRESHOLDS`.

**Meta.** When the signals disagree, `fitness_intensity_level` carries the higher level and `fitness_signal_note` explains the split in plain English — otherwise a consumer reads `fitness_level: 'beginner'` next to a quality session and sees a contradiction with no explanation.

---

## 80. Finish-goal long run — time on feet, not distance

**Principle.** For finish-goal HM and marathon plans, the peak long run must reach `FINISH_GOAL_PEAK_LR_RATIO_VS_RACE_DURATION` (70%) of **projected race duration**, subject to `LONG_RUN_CAP_MINUTES`, which still wins. Projected duration is computed at easy pace — a finish-goal runner will not race at threshold, and run-walk is expected. Every finish-goal peak long run carries explicit permission to walk. When the cap prevents reaching the floor, the plan says so.

**Why.** §45 mandates a peak long run of ≥85% of race distance for *time-targeted* HM, and finish-goal plans had no floor at all. So the runner least equipped for the distance got the least specific preparation: the first organic user peaked at 1:46 against a ~2:45 projected finish — 64%. §45's own rationale is *"the fatigue profile of running for ~2 hours is fundamentally different"*, which applies **more** to a first-timer, not less.

**Duration, not distance, and the distinction is not cosmetic.** A first-timer is time-on-feet limited, not aerobically limited. The constraint that actually binds — `LONG_RUN_CAP_MINUTES` — is already expressed in minutes, so a distance-based floor would hide what is doing the limiting. And "two and a half hours of moving" is a different psychological object from "18 kilometres": only one of them is achievable for someone who has never run either, and only one of them survives contact with a walk break.

**Walking does not undo it.** The session note says so explicitly. Time on feet accumulates whether or not every step is running, and a floor the runner believes they have failed is worse than no floor — they will either abandon the session or grind it out injured.

**The honest failure case.** Where the time cap binds, the plan cannot deliver race-specific endurance and must say that plainly, with the concrete consequence (the late race will be unfamiliar) and the actionable response (start slower, take walk breaks early rather than late). A silent shortfall is the failure mode this whole principle exists to prevent.

**Config.** `GENERATION_CONFIG.FINISH_GOAL_PEAK_LR_RATIO_VS_RACE_DURATION = 0.70`. Shortfall surfaced as `meta.long_run_shortfall_note`.

---

## 81. `compressed` means two different things, so it is two fields

**Principle.** A plan can be short of time or short of volume. These are unrelated failures with unrelated remedies, and they are reported separately: `time_compressed` (fewer calendar weeks than the distance's minimum) and `volume_constrained` (the ramp never reached target peak volume).

**Why.** One boolean OR-combined both, and was `true` for five of six test personas — including a 12-week 5K plan with 24 days to spare, and a plan simultaneously classified `volume_profile: 'build'`. A flag that is almost always true carries no information.

It is not merely cosmetic: the flag feeds the **paid** confidence score ("deduct 2 if plan is compressed"), so paying users were seeing a score dominated by a near-constant. The enricher now receives `time_compressed`, which is what that deduction was always describing.

**Remedies differ, which is the point.** Time compression is fixed by racing later or accepting a shorter build. Volume constraint is fixed by more days per week, a higher weekday time budget, or a longer runway. Telling a runner "your plan is compressed" when they have four weeks spare and the real problem is three-days-a-week availability sends them to the wrong lever.

**`compressed` is retained as a deprecated OR of the two** for one release, so saved plans and existing readers keep working.

---

## 82. An intentional downgrade is not a missing session

**Principle.** `INV-PLAN-QUALITY-EXPECTED` — build and peak weeks for intermediate/experienced runners must contain a quality session — is exempted when a reshape **deliberately removed** it in response to a fatigue or aerobic-efficiency signal, and the week records that it did (`Week.quality_downgraded`). Quality that is simply absent, with no recorded reason, still violates.

**Why.** The invariant asks *"did the generator build this week correctly?"*. That is the wrong question to ask of a week the generator no longer owns. When aerobic efficiency is falling or heavy sessions have stacked up, the reshaper swaps quality to easy — and that is the intervention working. It is also the product's whole thesis: back off when the body says so. Flagging it as a constitutional violation puts a structural rule in charge of a coaching decision, which is backwards.

Before this, every such reshape wrote a `reshape_invalid` ops event and soft-degraded in production — alert noise generated by the system doing the right thing, which is how teams learn to ignore alerts.

**The exemption must be earned.** It keys on a recorded reason, not on the absence itself. An engine that simply fails to place quality is still caught — otherwise this would quietly excuse the defect it is meant to distinguish from.

**Decision (SLT, 2026-08-06).** Option B of two: (A) keep the invariant and make the reshaper soften rather than remove quality; (B) exempt recorded downgrades. B chosen — A would have a structural invariant override a coaching intervention responding to real signal. **Revisit if** `ops_events` shows EF-triggered downgrades firing on runners who are not actually fatigued; that would mean the reshape trigger is too sensitive and A becomes the right answer.

**Config.** No numerics. Triggers that qualify: `INTENSITY_DOWNGRADE_TRIGGERS` in `app/api/adjust-plan/route.ts` (`ef_decline`, `fatigue`).

---

## 83. Sessions must be coherent with each other, not only with themselves

*Added 2026-08-20 — Coaching Board CD-16 / SC-06.*

**Principle.** A plan's sessions form an intensity ladder, and the ladder must not invert. Within one plan, a session prescribed in the threshold/race band (Zone 3) MUST NOT be prescribed **faster** than a session in the VO2max band (Zone 4–5), beyond `INTENSITY_ORDERING_TOLERANCE_PCT`. Where the runner's stated target creates such an inversion, the engine MUST either reconcile the two prescriptions or declare the inversion — `meta.goal_beyond_measured_fitness` set, and a difficulty band that does not read `comfortable` (§44). **A plan may be a stretch. It may not pretend not to be.**

**Why this is its own principle and not a clause in §19.** §19 asks whether a session's *name* matches its *own* prescription, and every session in the traced plan passed it. The defect only exists between two sessions:

> The goal-pace sessions were prescribed at **4:30/km** with a heart-rate ceiling of **160**. The VO2max sessions were prescribed at **4:33/km** with a heart-rate band of **160–188**. The sessions labelled VO2max were three seconds per kilometre *slower* than the sessions labelled race pace, while carrying a band 28 beats wider at the top.

A runner following pace finds the "VO2max" work easier than the race-pace work. A runner following heart rate finds the opposite. **The plan cannot be executed as written by both metrics.** The cause is structural rather than a slip: interval pace derives from *measured* fitness (VDOT), goal pace from the *stated target*. Any sufficiently ambitious target produces it — it is not an edge case.

**The general lesson, which is the reason this section exists.** Every invariant written before this one validated a single session against its own prescription. That is why nothing caught this: each session was individually defensible and the plan was only incoherent when two of them were placed side by side. **A constitution enforced one session at a time cannot see a contradiction that lives between sessions.** When adding a principle, ask which of its failures would survive a per-session check.

**Why only pace is checked, and why that is sufficient — corrected 2026-08-20.** An earlier draft of this section recorded "the HR ladder is not checked against the pace ladder" as a known gap. **That was wrong, and the correction is the interesting part.**

Heart-rate bands are a pure function of the zone: `qualityHR` is the Z3 band and `intervalsHR` is Z4→max, both derived from the zone the session was assigned. **The HR ladder therefore cannot invert** — it is structurally consistent with the zone labels by construction. Pace is the only quantity that can disagree with its own zone, because it comes from a different derivation (the runner's VDOT, or their stated target) rather than from the zone.

So the incoherence is not "two ladders disagree with each other" — it is **one ladder (pace) breaking rank with the zone that both it and heart rate are supposed to express.** Checking pace against zone catches the whole defect. A separate HR-vs-pace check would be a check that can never fire.

**The residual gap, stated accurately.** The invariant compares the *fastest* Zone 3 session against the *fastest* Zone 4–5 session across the plan. It does not assert finer ordering *within* a band. That is a real limitation and a small one.

**Config.** `GENERATION_CONFIG.INTENSITY_ORDERING_TOLERANCE_PCT` (0.5% — two independent derivations landing within a rounding width of each other is noise, not an inversion). Enforced by `INV-PLAN-INTENSITY-ORDERING` in `lib/plan/invariants.ts`. Surfaced via §44's difficulty band.

---

## 56. The constitution

These principles are the constitution. Every numeric the generator uses points back to one of them. If a numeric exists with no principle, it is a defect — either the numeric should be removed or the principle should be added.

If you are reviewing a plan that feels wrong, this is the document to read first. Find the principle that is failing. The fix lives in the config, never inline.
