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

> **A session-count ceiling is vulnerable to session REMOVAL, which CD-19 did not
> anticipate (§90 Amendment 1, 2026-09-15).** Counting sessions is right, and the
> correction below stands. But it means any rule that takes a *session* out of a
> plan moves this ratio without touching intensity: §2's injury-cap trim shrinks weeks
> until §52b drops a day, the day dropped is always an easy one, and the share
> climbs through the ceiling on a plan where nothing chose to train harder.
> **§1 is not spent by that, and it does not yield to it** — §90 Amendment 1 converts
> a quality session to easy instead. Recorded here because the next rule that removes
> a session will have the same effect and should be checked against this line.

**Why a ceiling and not a target.** A target invites the engine to close the gap — and the only place a periodised plan has room to add quality is base phase, which §4/§5 make all-easy on purpose. Worse, the population this product serves already drifts upward into Z3 without any encouragement: a ninety-minute window is where every session drifts when you want to feel like you worked. **Writing 25% as something to reach would spend it, and spend it in the grey zone — the exact failure mode Zonna exists to prevent, introduced by the product's own config.** A ceiling is also robust to the underlying 80/20 work having been derived largely from male cohorts.

**What the correction actually revealed — worth reading before trusting any other declared number.** The traced 12-week 10K plan delivered **9.6% quality by minutes** against a declared 25%, and that was read for four months as a fifteen-point under-delivery. It was nothing of the kind. Measured on the correct basis the same plan delivers **exactly 25% in every phase where quality is prescribed**, and 17.0% plan-wide once the all-easy base phase is included. **The engine was right; the config was wrong.**

The reason the error survived is §34, not coaching judgement: **the table was read by an offline script and by no engine code, and no invariant referenced it.** Nothing computed the number, so nobody could see which quantity it was. The value being wrong was downstream of it never being exercised.

**Counting rule.** The numerator is `quality` sessions. It excludes the §78 recalibration **time trial** — typed `hard` *precisely so that it does not count against* `QUALITY_SESSIONS_PER_WEEK_MAX` — and the **race** itself, which is the goal rather than training. Counting either would contradict the rules that gave them their types. The denominator is running sessions; strength and cross-train are not part of an intensity distribution.

**§7 remains independently binding.** A plan can satisfy this ceiling and still stack its hard days. The ratio is not a substitute for the 48-hour spacing rule.

**Config.** `GENERATION_CONFIG.INTENSITY_DISTRIBUTION` — keyed by race distance, field `max_quality_session_pct`. The field is named for its unit so a call site cannot mistake it again. Checked by `INV-PLAN-INTENSITY-DISTRIBUTION`.

### The denominator is the MAIN PLAN — §57 foundation weeks are excluded (Coaching Board CB-FOUNDATION-DENOM-01, 2026-09-10)

**Principle.** The share is counted over weeks `n >= 1`. §57 foundation weeks (`n <= 0`) are **not** part of the numerator or the denominator.

**Why.** §57 states that foundation weeks *"are never part of the main plan's periodisation arc"*, and §57's CB-1 ruling defines the block's job as *"habit and routine, not adaptation"*. A ratio that governs **training stimulus** cannot then spend weeks this document has already declared not to be training stimulus (Seiler). §22's SC-05 closure had already ruled the same way about a different measurement in the same file — `halfWeek` counting foundation weeks toward `totalWeeks` was a defect worth 155 violations, cited to that same §57 sentence. Two invariants were reading foundation weeks in opposite directions; this was the one out of step.

**The decisive argument is that the old rule was gameable by the calendar.** Including the block made the ceiling *looser the earlier a runner generated their plan*. Two runners with an identical 17-week block and an identical 15 quality sessions — one compliant, one in breach — differing only in when they opened the app. A ceiling satisfiable by prepending easy weeks is not a ceiling on anything (Hutchinson). Note the direction is backwards from safety: more warning time bought more licence.

**What this dissolved.** `validatePlan` runs twice on different objects — the bare plan inside `generateRulePlan`, and the assembled plan in `composePlanWithFoundation`. Foundation weeks exist on the second and not the first, so under the old rule **the two runs disagreed by construction**. That produced two successive defects (INTENSITY-FOUNDATION-BLIND-01, then -02 when the first fix's key proved false on the >28-day 'choice' band, where the decision arrives after generation), each fixed by deferring the check. Counting main weeks only makes both runs return the same verdict, so **the defers and their `foundation_decision_pending` / `foundation_composed` machinery were deleted rather than extended.** A defect class that cannot occur beats a check that catches it.

**Measured cost, stated plainly.** Breaches go **1 → 2** across 16,038 swept plans, of which 4,642 carry a block. **This is a coherence fix, not a safety fix** — recorded at Sims's insistence, because the two are routinely conflated and the second claim is the one that gets repeated.

**Config.** `GENERATION_CONFIG.INTENSITY_DISTRIBUTION_COUNTS_FOUNDATION_WEEKS` (`false`). A flag rather than a hard-coded filter because Seiler recorded a live revisit condition (if a cohort's delivered distribution is ever assessed across the block boundary) and flipping it is the cheapest way to re-measure. Read by `INV-PLAN-INTENSITY-DISTRIBUTION`; regression in `intensityFoundationBlind.test.ts`.

**Board:** CB-FOUNDATION-DENOM-01, 2026-09-10 — CORRECT WITH AMENDMENT, Hutchinson chairing. Amends §1 (denominator) and §91 (see below). Does not touch the six ceiling values, §8, or §57's session-content rule.

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

**Unchanged, deliberately:** 5K/10K 25%, HM 20%, MARATHON 18%, 100K 15%. No build-profile plan fails them. ~~50K 15%~~ — see the amendment below.

### 50K reopened — 15% → 17% (Coaching Board CB-INTENSITY-50K-01, 2026-09-09)

**The reopener fired.** The line above pre-registered *"a 50K build-profile breach reopens it,"* and INTENSITY-LONGDIST-LOWDAY-01 is that breach: a delivered 50K/intermediate/4-day/16-week build plan at **15.6% (10/64)**, worst observed across the build space **16.3% (13/80)** at 5 days. Not an early-onset artifact (intermediate gets no §89) — it is the ordinary build (1/wk) + peak (§8's 1–2/wk) quality accumulating against a low-day running denominator at the tightest ultra ceiling. Detection had been masked by INTENSITY-FOUNDATION-BLIND-01 (the §1 check read the bare plan; foundation weeks it hadn't yet seen were lowering the delivered share), now fixed.

**Resolved by yielding §1, not §8 — the 100K precedent, applied again.** When §8's quality dose and §1's ultra ceiling collide, the board has already ruled which yields: 100K went 12% → 15% *"and the engine obeyed §8; §1 is the section that yielded."* The alternatives were considered and rejected — **extending the base** (Willy: the 50K base carries the long-run progression and is the phase least able to spare a week) and **cutting a quality session** (contradicts §8 and coaches the decimal, not the athlete — McMillan). Raised **minimally** to clear the observed worst (16.3%) while still binding, exactly as 100K's 15% cleared its 14.7% worst — **17%**, not Seiler's session-basis-converged low-20s, because a ceiling that clears everything stops being a ceiling (Hutchinson, chair). The descending order holds (50K 17% < MARATHON 18%, longer race still skews easier).

**Seiler's dissent, updated:** now *directionally vindicated* — a failing plan appeared exactly where he said the minutes-era 15% was too tight — but he accepts 17% as the conservative floor of what's defensible, not the ceiling of it. **Sims's condition of approval:** this is a **ceiling, not a target** (§1's own language) — a looser number must never read as licence to *add* quality; the failure mode for the peri/post-menopausal ultra runner is under-recovery. **A 50K build-profile plan above 17% reopens it again** — same backstop that produced this sitting.

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

### The bounceback is bounded for injury-history runners — amended 2026-09-06 (RAMP-BOUNCEBACK-01)

**Principle.** The bounceback exemption above applies to **healthy** runners only. For a runner with a knee or shin-splint history (§2's injury cap), the post-deload week is bounded by the **injury cap** (`INJURY_WEEKLY_INCREASE_CAP_PCT`, 5%) exactly like every other week — it does **not** get the exemption. The return to pre-deload volume still happens, but gradually, over the weeks that follow rather than in a single jump.

**Why — the exemption was unbounded, and that was the hole.** The 2026-08-06 amendment let the bounceback return to pre-deload "without the cap applying" — and the engine implemented that as `Math.max(cappedValue, preDeloadVolume)`, which **silently overrode the injury cap**. A 70% deload returning fully to pre-deload is a **+43% single-week rise**, and it was exempt on exactly the same grounds as a 5% one. Measured on the §2 knee-injury archetype: a **+26%** week-on-week rise passed as a "bounceback". For injured tissue this is not low-risk. §2's own reasoning — "chronic load has not moved" — is an argument about the *acute:chronic* relationship, and it holds for **healthy** tissue; **injured tissue's binding constraint is the acute weekly load itself**, which a "return" does not lessen (cardiovascular readiness returns weeks ahead of musculoskeletal readiness — Willy). Whether a +26% jump was legal also depended on where the phase boundary happened to fall (a rise is exempt as a bounceback but capped as an ordinary week) — an arbitrariness no one chose, and the reason this blocked CB-PHASE-01 (base 35→30).

**The healthy bounceback stays unbounded — decided on measurement, not intuition.** The board provisionally proposed a dedicated healthy-runner bounceback cap (~20%). Measured across a 144-plan grid, a 20% cap flipped the difficulty note to "constrained by inputs" on **+50 percentage points** of plans and raised the `maintenance` rate **+7.6pp**, for **zero** safety benefit — §2's evidence is that a healthy return to a fortnight-ago volume is not a spike, and no mainstream model caps a bounceback. So the healthy cap was **not** added; the measurement resolved the board's recorded Willy/Hutchinson split toward Hutchinson for healthy runners. The only change is that the injury cap now binds on the injury bounceback.

**Consequence, and it is intended:** capping an injury runner's bounceback lowers their achievable peak, so more injury plans classify `volume_profile = 'maintenance'` (§52 surfaces it honestly). A runner rebuilding a knee *should* be on a maintenance-grade curve; forcing overload onto that tissue to satisfy a ratio is the injury (Willy). The curve still **rises** within each block — slow is right, stuck is not.

**⚠️ This fix is at the CURVE; the DELIVERED bounceback is only partly protected.** The injury cap governs the volume curve, but the delivered `weekly_km` diverges from the curve by session placement — a race-anchored long run (§45/§47) sized on its own schedule can inflate a low-target bounceback week above the curve. Measured after the fix: **6120 injury plans still deliver a bounceback at or above pre-deload volume**, worst on low-day/low-volume runners where a single long run dominates the week. That residual is the **same class as the deload-inversion** (delivered ≠ curve, `INV-PLAN-DELOAD-IS-A-REDUCTION`), and it clears only when **DELOAD-INVERSION-01** makes placement track the curve. So this ruling caps the curve and unblocks that fix; it does **not** by itself guarantee the injured runner never sees a delivered spike, and it likely does **not** fully unblock CB-PHASE-01, whose blocker is also delivered. Honest scope, recorded rather than overclaimed.

**Config.** No new numeric — injury bouncebacks reuse `INJURY_WEEKLY_INCREASE_CAP_PCT` (§2); healthy bouncebacks keep the pre-deload ceiling. **Enforced by** `INV-PLAN-BOUNCEBACK-BOUNDED` (`warn`, pending DELOAD-INVERSION-01 for the delivered arm).

**Board:** RAMP-BOUNCEBACK-01, 2026-09-06 — CORRECT WITH AMENDMENT (Willy-led, Hutchinson chairing); the healthy/injury split was set by measurement.

### Amendment 3 — the injury bounceback returns to pre-deload (PLAN-FITNESS-01, Coaching Board 2026-09-17)

**Principle.** For an injury-history runner the post-deload week may return to the
**pre-deload volume, and no higher** — the same ceiling healthy runners already have.
Amendment 1's cap on the bounceback is withdrawn, conditional on the cut staying
shallow (below).

**Why — Amendment 1's own acceptance criterion was not met.** It accepted a lower peak
for injured runners and said why that was right, then set the limit:

> *"The curve still **rises** within each block — slow is right, **stuck is not**."*

Measured 2026-09-17, the same runner with and without the knee flag, 18 weeks,
everything else identical:

| | net build | never builds |
|---|---|---|
| healthy, standard cadence | **+91%** | 8.1% |
| **injury, standard cadence** | **+6%** | **28.9%** |
| healthy, masters cadence | **+79%** | 10.1% |
| **injury, masters cadence** | **+3%** | **66.7%** |

That is stuck, not slow. A knee-history runner reached a marathon start line having
never run beyond **14 km**.

**Amendment 2 found the ratchet and under-shot the number.** It raised the injury
deload 70% → 85%, but break-even needs the deload to cover what the 5% cap can climb
back before the next one arrives:

| cadence | growth weeks | break-even deload | shipped |
|---|---|---|---|
| standard 4-week | 3 | 1 ÷ 1.05³ = **86.4%** | 85% → **−1.6%/cycle** |
| masters 3-week | 2 | 1 ÷ 1.05² = **90.7%** | 85% → **−6.3%/cycle** |

⚠️ **The injury × masters cohort existed in no grid** (`cohortGrid` does not vary
injury; `targetedGrid` is all age 40), so the worst case had never been measured. The
fitness harness now constructs it explicitly.

**Why Willy reversed his own veto, recorded in his words.** He rejected the unbounded
return in RAMP-BOUNCEBACK-01 because a 70% cut returning to 100% is a **+43%** week
onto healing tissue. Amendment 2's shallower cut makes the same return **+17.6%**, of
a load the tissue carried seven days earlier. *"The injury I was protecting against
has been replaced by a worse one."*

⚠️ **His condition is mechanical, not a note.** The exemption is valid only while
`INJURY_RECOVERY_WEEK_VOLUME_PCT >= INJURY_BOUNCEBACK_MIN_DELOAD_PCT` (85). Lower the
cut and the exemption **withdraws itself**, restoring Amendment 1's capped bounceback.

**Measured after.** Injury/standard net build **18.2% → 45.5%**, injury/masters
**0% → 31.3%**, never-builds **28.9% → 0%** and **66.7% → 0%**. **Healthy runners are
byte-identical** — the branch only differs for injury.

**Config.** `INJURY_BOUNCEBACK_MIN_DELOAD_PCT` (85). **Enforced by**
`INV-PLAN-BOUNCEBACK-BOUNDED`, amended: a return **to** pre-deload is now legal; only
a return **above** it is a violation.

**Board:** 2026-09-17 — CORRECT WITH AMENDMENT, Hutchinson chairing, Willy reversing
his own prior position on measurement. Record:
`docs/decisions/coaching-board-2026-09-17-plan-fitness.md`.

### Amendment 2 — the cut had to give, not the cap (COMPLIANCE-FIX-2, Coaching Board 2026-09-16)

**Principle.** A runner §12's volume cap governs (knee / shin-splint history) takes a
**shallower deload**: `INJURY_RECOVERY_WEEK_VOLUME_PCT` (85) rather than §3's 70. The
bounceback stays bounded by the injury cap exactly as Amendment 1 requires.

**Why — Amendment 1 above asserts something arithmetically impossible.** It states:
*"The return to pre-deload volume still happens, but gradually, over the weeks that
follow rather than in a single jump."* It does not happen at all. The cut is deeper
than the cap can climb back before the next deload arrives:

| | per cycle | |
|---|---|---|
| injury 5%, standard 4-week | 0.70 × 1.05³ = **0.810** | loses 19.0% |
| injury 5%, masters 3-week | 0.70 × 1.05² = **0.772** | loses 22.8% |

**The curve therefore RATCHETS DOWN geometrically.** Instrumented on a real plan:
`w1=44 w2=31 w3=33 w4=35 w5=25 w6=26 w7=27 w8=19 w9=20` — each deload cuts, and the
curve then resumes **from the deload floor**, never from the pre-deload week.
**D-21: a principle that cannot be satisfied is a defect in the principle.**

**Measured before the fix** on knee/shin plans: **67.2% detrained** at the standard
cadence, **81.7%** at masters. Across the sweep's injury cohort, 18.0% against 0.6%
for healthy runners — a 30× difference caused entirely by Amendment 1's removal of
the bounceback exemption.

**Why a shallower CUT rather than a faster CLIMB.** Break-even at the masters cadence
needs a **19.5%** weekly cap, far past anything safe for this tissue. So the cut is
the only lever. `85` is derived: the shallowest cut §12's 5% cap recovers within one
standard cadence (0.85 × 1.05³ = 0.98).

**It DOMINATES rather than trading off — this is the part that settled it.** Measured
against the board's own blocking gate (do not re-create the spike Amendment 1
removed):

| | detraining | single-week rise p95 | max rise |
|---|---|---|---|
| before | 74.4% | 66.7% | 133% |
| **shallower cut** | **17.5%** | **34.1%** | **78%** |
| *(alternative: allow full return)* | *18.1%* | *66.7%* | *100%* |

A shallower cut needs a **smaller jump back**, so it is safer on Willy's original
concern too. The alternative of simply restoring the full return was measured and
**REJECTED by that gate**: `INV-PLAN-BOUNCEBACK-BOUNDED` 15.6% → **88.9%**, which is
Amendment 1's defect restored.

Clinically this is also the plainer answer: a 30% cut is a *healthy* runner's deload.
Tissue that has been deliberately de-loaded all block does not need that depth — it
needs consistency. The deepest cut was being prescribed to the runners least able to
climb out of it.

**Delivered on the sweep:** injury detraining **18.0% → 0.7%**, mean decline
**10.7% → 3.0%** — now indistinguishable from healthy runners (0.6%).
`INV-PLAN-NOT-DETRAINING` **15.1% → 0.7%**.

**Config.** `GENERATION_CONFIG.INJURY_RECOVERY_WEEK_VOLUME_PCT = 85`.
`deloadCadence.ts → deloadVolumeFraction()` is the single owner of deload DEPTH, for
the same reason that module owns cadence: the fraction had **two writers** in
`ruleEngine` pointing opposite ways (the curve multiplies by it; the day-count pass
divides by it to keep deload frequency, DELOAD-INVERSION-01 part 3). Splitting depth
by cohort in one of them only would have made the gross-up recover a volume that was
never cut.

**Enforced by** the existing `INV-PLAN-NOT-DETRAINING` (§106 Am.) — deliberately NOT a
new invariant. It already measures this exact outcome and moved 15.1% → 0.7%; a second
checker for one phenomenon is the duplication this codebase keeps paying for.

> ⚠️ **Two things recorded rather than claimed as solved.** (1) Detraining is reduced,
> not eliminated — 0.7% remains and the residual is not traced. (2) The masters
> cadence, where the ratchet is worst, **still cannot be swept**: the grid fixes
> `age: 35`. Every masters figure above is instrumented arithmetic on targeted
> inputs, not sweep measurement. Filed as SWEEP-AGE-01.

**Board:** COMPLIANCE-FIX-2, 2026-09-16 — CORRECT WITH AMENDMENT, Hutchinson chairing.
Willy led and recorded that his own 2026-09-06 remedy was the cause. Amends §2
Amendment 1. Does not loosen §12's cap on genuine progression.


**Config.**
- `GENERATION_CONFIG.MAX_WEEKLY_VOLUME_INCREASE_PCT = 10`
- `GENERATION_CONFIG.RETURNING_RUNNER_ALLOWANCE_PCT = 15`
- `GENERATION_CONFIG.RETURNING_RUNNER_GRACE_WEEKS = 3`

**Volume sequence initialisation.** The starting weekly volume is clamped to a band relative to the user's target peak weekly km — too low and the plan never reaches peak; too close to peak and there's no room to ramp.
- `GENERATION_CONFIG.BUILD_VOL_INIT_FLOOR_VS_PEAK = 35` — floor: starting volume is at least 35% of peakKm.
- `GENERATION_CONFIG.BUILD_VOL_INIT_CEILING_VS_PEAK = 85` — ceiling: starting volume is at most 85% of peakKm.

A returning runner is identified by the wizard inputs `training_age > 2 years` AND `current_weekly_km < (typical for fitness level)`.

> **⚠️ The weekly cap lives in the VOLUME CURVE, not in the session loop — corrected 2026-08-20.**
>
> It used to be applied per-week downstream of the curve, measured against the curve's *unadjusted* previous value. **So it never compounded.** A week capped down was followed by a week measured against the higher curve value, which sailed through uncapped.
>
> **The injury-protection cap was producing the exact volume spike it exists to prevent, and only for injured runners.** Traced on an HM plan with knee history: W9 capped to 48.3km, W10 then jumping to 65km — a **35% rise** — dragging the long run from 11km to 19km and tripping §45. It accounted for **394 of the 981** long-run progression violations in the property sweep.
>
> Two further consequences, both fixed by the same move: everything anchored on the curve — **taper depth, deload step-down, long-run share** — was working from volumes the runner never actually saw (the archetype matrix caught a taper cutting 25% where it should cut 45%); and applying the cap in *both* places double-caps, measuring against an already-capped week, which drove delivered volume ~20% below the curve.
>
> **The curve is the single source of truth for volume.** `buildVolumeSequence` takes the injury cap and applies it alongside §2's standard allowance, in the same pass, so it compounds identically.

> *(Moved here from §12 on 2026-09-15, PRINCIPLE-XREF-12-01. It is entirely about the
> INJURY-PROTECTION CAP and the volume curve, and it sat in "Easy-run zone cap — Z2
> ceiling", which is about zones. **That misplacement is why the cap was cross-referenced
> as "§12" in sixteen places across this document** — the content really was there, so the
> references were not careless, they were following the text. The references now point at
> §2, which owns `INJURY_WEEKLY_INCREASE_CAP_PCT`, and the doctrine sits with them.
> A cross-reference correction and a text move, no behavioural delta — board-exempt.)*

---

### §2 Amendment 2 — the weekly ratio is a SCREEN; the per-run step is the confirmation (Coaching Board 2026-09-20, HM-WEEK1-PERRUN-01)

**Principle.** The ratio arm of the week-1 rule fires only where the increase
**per run** exceeds `WEEK1_PER_RUN_STEP_MAX_KM` (1.5 km). Arms 2 (absolute) and
3 (session load) are unchanged and remain the backstop.

**Why. A weekly total is not a training stress; a session is.** The half
marathon sat at 88.2% fit for purpose and **the entire 12% gap was this one
arm**, of which **100% was the 10 km/week cohort** — 0% at 20, 32 and 50 km/week,
and no dependence on days available or injury history at all. The plan it was
failing:

```
declared 10 km/wk, longest-ever run 5 km
wk1  14 km:  long run 5.3 km / 44 min · easy 3.9 km / 32 min · easy 3.9 km / 32 min
```

A long run **300 metres** beyond anything they have run, and two half-hour easy
runs. McMillan: *"I would write that week myself."*

**Measured across all 309 ratio-flagged plans product-wide:** worst per-run
increase **+2.40 km**; worst session exceeding the runner's longest-ever run
**+0.50 km**. The arm was identifying no load hazard anywhere.

**⚠️ 1.5 km WAS CHOSEN OVER 2.0 km DELIBERATELY, AND AGAINST THE SCOREBOARD.**
2.0 scored better — product 96.5% against 95.3%, HM 97.9% against 95.1% — and
retained only **12%** of the flagged population. 1.5 retains **51%**, so the arm
keeps its teeth. Hutchinson's recorded objection at that sitting was not the
evidence but **the pattern**: this predicate had been measured, found benign and
relaxed three times in one day, each time raising the headline. Taking the
larger relaxation because it scores higher **is** that pattern. The smallest
change that solves the problem wins.

**⚠️ HUTCHINSON'S BINDING CONDITION: this predicate is frozen after this
amendment until we hold adherence or injury data.** Any further relaxation
needs outcome evidence, not another corpus measurement.

**⚠️ TWO ENGINE ALTERNATIVES WERE BUILT AND VETOED, and the reason is the
priority order.** A flat 1.25× week-1 cap took the half to 97.0% and the
**marathon to 84.9%**; a runway-aware cap took the half to 93.3% and the
marathon to **88.4%**. Both remove the founder's priority-one distance from
target to fix a secondary one. Willy: *"stop proposing caps"* — a lower start
lowers the curve, which shortens the long run, three times running.

**Effect.** HM **88.2% → 96.2%**; **marathon unchanged at 90.1%** (the board's
hard condition); whole product **92.9% → 95.3%**. No prescription changed.

**Config.** `WEEK1_PER_RUN_STEP_MAX_KM = 1.5`.

**Enforced by** `planQuality`'s `WEEK1-LEAP` predicate and the per-distance
floors in `useCaseEnvelope.test.ts`, where the **marathon floor is the board's
condition made mechanical**.

---

### §2 Amendment — the week-1 step is measured against what the runner RUNS, and has three arms (Coaching Board 2026-09-20, WEEK1-FLOOR-SHORT-DIST-01)

**Principle.** The week-1 step is assessed against the runner's **declared
current weekly volume**, not `effectiveStartKm`. It is excessive when any of:

1. **ratio** — week 1 > 1.30× declared **and** more than 2 km absolute;
2. **absolute** — week 1 exceeds declared by ≥ `WEEK1_ABSOLUTE_STEP_MAX_KM`
   (10) **and** by more than `WEEK1_ABSOLUTE_STEP_MIN_RATIO` (1.15×);
3. **session load** — week 1's longest run exceeds the runner's longest recent
   run by more than `LONG_RUN_PROGRESSION_CAP_ABS_KM` (§45's step, reused).

**Why the denominator moved, when §111 moved the opposite way one day earlier.**
§111 Amendment 1 switched that gate **onto** `effectiveStartKm`; this switches
week 1 **off** it. Both follow the same sentence: *"the gate scored a ratio no
runner experienced."* For §111 the experienced quantity is the volume the
engine builds **from**. For week 1 it is the step from the mileage the runner
**actually runs** to the week they are handed — and `effectiveStartKm` is an
internal intermediate the **week-1 floor overrides** before a plan exists. The
runner never sees it.

**Measured.** 79% of everything the old rule flagged were §29 fresh-return
runners: scaled down for their own protection, then scored against the
reduction. **Beginners, who are not scaled, were 0% unfit while intermediates
were 48%** — that inversion was the tell. Against declared volume the median
flagged ratio is **1.33×**, not 1.79×.

**⚠️ THE LOAD EVIDENCE, WHICH IS WHY THIS IS NOT A LOOSENING.** Across all
3,880 flagged plans — the tail, not the median — the worst per-run increase is
**+2.4 km**, and the worst case of a week-1 session exceeding the runner's
longest-ever run is **+0.5 km**. The engine never asks a flagged runner to run
materially further in one session than they already have. Willy withdrew the
load objection on that evidence.

**⚠️ WILLY'S BINDING CONDITION WAS MIS-ENCODED FIRST AND THE MISTAKE MATTERED.**
He said the 15 km weekly jumps must stay visible. Encoded literally as ">= 10 km
absolute" it also swept up a runner declaring **90 km/week handed 100** — a
1.11× step, ten kilometres across six runs — and dropped 100K fit-for-purpose
**95.8% → 88.5%** on that alone. He named a step that is big **for the runner**,
not a big number. Hence arm 2's proportional guard. Verified both ways:
**47/47 hazardous steps flag, 0/28 benign ones do.**

**⚠️ ARM 3 IS INERT ON TODAY'S CORPUS AND THAT IS RECORDED, NOT HIDDEN.** It
fires on nothing (worst excess +0.5 km against a 5 km margin). It is kept
because it is the only arm describing the actual **hazard** — tissue load per
session — rather than an accounting ratio, and its liveness comes from mutation
rather than from the corpus.

**Effect.** 10K **78.3% → 99.3%**; whole product **87.0% → 92.9%, inside the
90–95% target.** No prescription changed: this is a measurement rule.

**Config.** `WEEK1_ABSOLUTE_STEP_MAX_KM = 10` (prevalence measured at 3.1% of
plans with any positive week-1 step before it was set),
`WEEK1_ABSOLUTE_STEP_MIN_RATIO = 1.15`, and §45's
`LONG_RUN_PROGRESSION_CAP_ABS_KM` reused rather than a second constant for the
same idea.

**Enforced by** `planQuality`'s `WEEK1-LEAP` predicate and the per-distance
floors in `useCaseEnvelope.test.ts`. **Not a `validatePlan` invariant, and that
is deliberate:** this governs whether we judge a plan defective, not whether the
plan is constitutional. Recorded so the missing invariant is not read as an
oversight.

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

### Amendment — the deload's LONG-RUN cut tracks the WEEK's cut (LR-DELOAD-CUT-01, Coaching Board 2026-09-17)

**Principle.** On a recovery week the long run is reduced **in proportion to the
week's own reduction**, bounded by §52's 60% share and §9's absolute minutes cap. It
is never cut harder than the week is.

**Why.** §3 above says *"volume drops to 70% of the prior build week"* — a statement
about the **week**. Nothing in §3 asks the long run to be cut harder, and it was, on
**half of all deloads**. Measured over 2,817 deload weeks: the week cut a median
**22%**, the long run a median **30%**, with the long run cut >5pp harder on
**50.4%**. Worst traced: a week falling 44 → 43 km (−2%) while its long run fell
20.5 → 13.5 km (**−34%**).

⚠️ **THE MECHANISM, established only after two hypotheses were disproved.** It is
**not** the §24/§80 specificity pull switching off in deloads — the gap is identical
in base phase, where no such pull exists. It is **not** sessions going unplaced —
placed easy count equals planned on 100% of weeks. It is this: **the long run hits
§9's share of the PLANNED week, and the rest of the week is trimmed during placement
(median −6 km, p10 −22 km).** Same numerator, smaller denominator, so the delivered
share rises from §9's 28–30% to **37–42%**. A deload's planned week is smaller, the
trim bites proportionally harder, and the share falls back to 33–34%. That asymmetry
*is* the disproportionate cut.

**The consequence.** The long run then has to climb all the way back and runs out of
weeks — the single root cause of every marathon shortfall left after PLAN-FITNESS-01.

**Measured after:**

| scenario | before | after |
|---|---|---|
| Marathon finish, knee + 45+ | 26.0 km ❌ | **29.5 km ✅** |
| Marathon time goal, knee | 30.5 km ❌ | **32.0 km ✅** |
| Marathon time goal, knee + 45+ | 26.0 km (−5.7) | **30.5 km** (−1.2) |
| M3 review persona | 26.0 km, +54% build | **29.5 km, +79% build** |

⚠️ **It is SAFER, not merely longer** — the point Willy's veto of the resume approach
turned on. On the low-base beginner the deload cut goes **−61% → −34%** and the worst
single-week jump **+50% → +47%**. Cutting less means climbing less. Across the
population, plans carrying a two-week long-run rise above +40% fall **23.0% → 19.3%**.

**Bounds (Willy's amendment, McMillan and Sims concurring).** §52's 60% and §9's
`LONG_RUN_CAP_MINUTES` both bind on the result. ⚠️ The minutes cap was missed on the
first build and `INV-PLAN-LONG-CAP-MINS` threw on 48 grid plans — a 5K long run at 92
minutes against a 90-minute ceiling. `applyLongRunCap` is the single owner and is
reused rather than re-expressed.

⚠️ **WILLY'S §52 BOUND DOES NOT PREVENT THE §52 COST, AND THIS IS THE SECOND TIME
THAT PATTERN HAS APPEARED.** It caps the **deload week**; the lopsidedness arises in
the weeks **after** it, because the long run stays higher through the cycle. Measured:
marathon plans classified `maintenance` rise **68% → 72.7% (+4.7pp)**, driven entirely
by §52 (88 → 106 in a 753-plan sample) and **not** by floor failures (293 → 292).

**The cost was accepted by the founder on 2026-09-17**: those weeks genuinely *are*
long-run-dominated and §52 saying so is correct behaviour, against the alternative of
leaving knee-history and masters runners 3.5–5.7 km short on the session that decides
whether they finish. **If §52's lopsidedness is ever tightened, this is one of the
things holding it up, and bounding the deload week will not be the lever.**

**Config.** No new numeric — reuses `LONG_RUN_MAX_PCT_OF_WEEKLY` and
`LONG_RUN_CAP_MINUTES`.

**Board:** 2026-09-17 — CORRECT WITH AMENDMENT, Hutchinson chairing. Both conditions
discharged: the mechanism is explained above, and §52 binding does not reopen the gaps.
Record: `docs/decisions/coaching-board-2026-09-17-plan-fitness.md`.

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

### Amendment 1 — the taper long run may not exceed the peak long run (PEAK-LR-NOT-IN-PEAK-01, Coaching Board 2026-09-15)

**Principle.** A taper week's long run MUST NOT exceed the longest long run of the
**peak** phase, within `TAPER_LR_VS_PEAK_TOLERANCE_KM`.

**Why.** §6 already says volume drops sharply in the taper. §9's phase shares
say base 28% / build 30% / peak 32% / **taper 40%** — the taper takes the
*largest* share of a smaller week. That is defensible in itself (you cut easy
volume harder than the long run) right up to the point where a larger share of a
smaller week beats the peak's smaller share of a bigger one.

**Measured across 1,440 plans: it inverts on 28 (1.9%).** Worst case an HM taper
long run of **20.5 km after a peak of 18.5 km** — 97% of race distance, two weeks
out. McMillan: *"that is a dress rehearsal, not a taper. A runner told they are
tapering will either do it and arrive flat, or skip it and stop trusting the
plan."* Willy: the taper exists to dissipate accumulated fatigue, and a long run
above anything in the peak phase does the opposite in the window with no time left
to absorb it. Sims: at 97% of race distance in a shortened week it is also a large
glycogen and bone-loading event placed exactly where intake usually drops because
training "feels" reduced.

**§9 still wins where the two collide.** The cap never reduces a long run below the
point where it stops being the longest run of the week (`LONG_RUN_MIN_RATIO_VS_EASY`).
Trading §6's inversion for §9's would be no gain.

> **THE RESIDUAL IS THE TAPER-DEPTH DEFECT, and the two items are the same root
> cause.** On the 1,440-plan diagnostic grid the cap takes inversions from **1.9%
> to 0.9%**. On the **property sweep's much wider grid (15,973 plans, 24 varied
> input fields)** the invariant fires on **3.7%** — the two figures are different
> populations, not a contradiction, and both are stated because quoting only the
> smaller one would understate what a real runner faces. The remainder cannot be
> capped because §9's ratio pins them.
>
> ⚠️ **CORRECTED 2026-09-15, same day, by the Coaching Board (TAPER-DEPTH-01).**
> This paragraph originally read *"That is the already-filed §6 taper-depth
> finding … Fixing taper depth clears this residual; capping the long run alone
> cannot."* **There is no taper-depth defect, so nothing clears the residual that
> way.** The taper cut is applied correctly to the curve and delivered
> faithfully: traced on a 50K plan the curve runs 95 → 78 → 60 → 43 km, exactly
> `volume_reduction_pct: 55` over three steps, and across a 504-plan grid the
> **taper is the BEST-delivered phase in the plan** — delivered / curve mean
> **0.981**, against build 0.870 and peak 0.906.
>
> What the original measurement actually found is a **peak-phase
> under-delivery**: on 3-day plans the peak phase delivers as little as **0.67 of
> its own curve** while every other phase clears 0.87, so the correctly-tapered
> week lands above it. That is §23's `structuralPeakInversion`, already ruled and
> already treated — its own source comment names this exact shape (*"the delivered
> taper exceeding the delivered peak, since the taper's smaller targets are
> achievable where the peak's are not"*). **Of the 8 plans in 504 whose first
> taper week exceeds the peak phase, 8 of 8 are classified
> `volume_profile: 'maintenance'` and carry a `volume_constraint_note`. Zero are
> silent.** The runner is told.
>
> **The genuine residual of THIS amendment is 6 plans in 504 (1.2%), each
> overshooting by 0.9–1.0 km** — 21.5 km against a peak of 20.5, 31.0 against
> 30.1. A kilometre on a 31 km long run is §9's ratio doing its job, not a dress
> rehearsal, which is why the invariant stays `warn` (NOISE-GATE-01, §34).
>
> **The lesson is worth more than the ruling.** `week.weekly_km` is
> `sumWeeklyKm(sessions)` — the DELIVERED figure, not the curve. A first pass
> compared it against itself, scored 0.99, and read that as proof the delivery
> tracked the curve. A delivered-vs-curve claim must instrument
> `buildVolumeSequence`; the plan object cannot answer the question.

**Config.** `GENERATION_CONFIG.TAPER_LR_VS_PEAK_TOLERANCE_KM = 0.5` — one
`DISTANCE_ROUNDING_PRECISION_KM` step. Not cosmetic: the 5K cases invert by
exactly one rounding step, and capping on a bare `>` would report rounding as a
coaching defect (NOISE-GATE-01).

**Also ruled at this sitting:** the plan's longest run sitting OUTSIDE the peak
phase is **accepted as correct** at 5K (28% of plans) and 10K (39%). §5/§93 make
peak race-specific, and specificity for a 5K is faster work, not a longer run —
the long run legitimately gives way. No change, and the invariant is deliberately
not extended to cover it.

Enforced by `INV-PLAN-TAPER-LR-NOT-ABOVE-PEAK`.

---

### Amendment 2 — the cut is a percentage of the week the runner ACTUALLY DID (TAPER-DEPTH-02, Coaching Board 2026-09-15)

**Principle.** §6's `volume_reduction_pct` is applied to the **delivered**
pre-taper week, not to the volume curve's intended one. Each taper week's
delivered volume is brought down to `delivered pre-taper × (1 − step × n)`, by
trimming **easy runs only**.

**Why — and the first diagnosis of this was WRONG, which is the more useful half.**
This was filed as "the taper barely reduces". It does not. The taper cut reaches
the curve correctly — traced, an HM curve runs **65 → 50 → 36**, a marathon
**50 → 41 → 32 → 22**, a 100K **90 → 72 → 54 → 36** — and the taper then
**delivers** it: delivered / curve **0.99–1.02**, the best-delivered phase in the
plan, against build 0.870 and peak 0.906.

**What fails is the PEAK phase, which delivers 0.70–0.90 of its own curve.** §23
(CD-10) already accepts why: the long run is pinned at `LONG_RUN_CAP_MINUTES` and
the easy runs are pinned by §9's ratio, and the board ruled those caps do not
move. This amendment prices the consequence nobody had costed — **anchoring the
taper on the INTENDED peak lets an accepted structural limit silently delete the
taper.** A taper week whose curve sat 23% below peak arrives 2% below the peak the
runner actually ran.

**Measured, 504 plans:** 86 (17.1%) carry a first taper week above 90% of the peak
phase. 74 are already honest — `volume_profile: 'maintenance'` with a
`volume_constraint_note`. **12 (2.4%) are classified `build` and say nothing.**
Worst: an HM plan peaking at **45.5 km with a first taper week of 44.5 km**, a 2%
cut against a configured 22.5% first step. After the amendment: **0**.

**The lever order is ADR-022's, already ratified — easy runs trim, the §52 long run
never does, and a quality session is never touched.** §6 keeps intensity and cuts
volume, so trimming the taper's quality session would invert the principle being
enforced (Seiler). §9's `LONG_RUN_MIN_RATIO_VS_EASY` cannot be broken here by
construction: trimming easy runs only ever widens the long run's margin over them.

**Willy's binding condition:** the trim stops at `MIN_SESSION_DISTANCE_KM.easy`.
*"A 3 km easy run is not a session, it is an apology."* Where the floor binds
before the target is reached, the remainder is **left and declared** — §34.

**Sims's binding condition:** a materiality gate, so a 1–2 km paper deepening does
not read to the runner as "your plan changed" (NOISE-GATE-01).

**Config.** `GENERATION_CONFIG.TAPER_DELIVERED_REANCHOR_MATERIAL_PCT = 5` —
percentage points **of the anchor week**, because the question is how much of the
promised cut evaporated, not how big the taper week is.

> **Two ordering lessons, both measured rather than reasoned, both worth keeping.**
> (1) The pass must run **after V1 and V4**. Placed immediately after §6 Am.1's
> long-run cap it left 6 sweep cases short with easy-run headroom untouched,
> because V1 scales non-quality sessions and V4 mutates long-run distances — the
> week it sized was not the week the runner receives. (2) The pass and the
> invariant must **measure in the same unit**: `sumWeeklyKm` rounds to whole km,
> and one HM case computed a 0.94 km excess from 25 and 22 where the true figures
> are 24.5 and 22.0 and the excess is 1.36. The gate skipped the trim; the
> invariant, measuring unrounded, then fired on a week the pass had deliberately
> left. Both sides now sum at full precision.

**§52 IS A HARD FLOOR ON THE TRIM, and it is an `error`, not advice.** The long
run is never trimmed here, so shrinking the easy runs raises its SHARE of the
week — and a first version drove **112 cohort plans past `LONG_RUN_MAX_PCT_OF_WEEKLY`
(60%) and made them throw** on `INV-PLAN-LR-MAX-WEEKLY-PCT`. The week may not be
cut below `long run ÷ 60%`. A second 24 survived that floor because
`roundDistance` rounds to NEAREST and could take 0.2 km more than asked for, so
the trim now ceilings to the same 0.5 km grid: this pass may undershoot §6's
target, never breach a floor it was given.

> **And the fix that was NOT made, because measurement said so.** `lopsidedWeek`
> — the >60% scan behind the "lopsided week" note — also reads taper weeks, and
> excluding them looked obviously right: a taper week is *meant* to be long-run
> dominant. It is also **§52's classification owner**: §52 Am.1 makes
> `INV-PLAN-LR-MAX-WEEKLY-PCT` an `error` for a build plan and a `warn` for
> maintenance, and `lopsidedWeek` is what downgrades the plan. Excluding the
> taper stripped 24 plans of that label and turned an absorbed `warn` into a
> hard failure. The scan stays exactly as it was. **A "note" that gates an
> invariant's severity is not a note.**

**Over-tapering is structurally impossible**, and that is a property of the code
rather than a measurement: the re-anchor treats the configured target as a
CEILING and stops there, so it can never cut below what §6 already ratified. It is
bounded below by §52's 60% cap and by `MIN_SESSION_DISTANCE_KM.easy`.

**Blast radius, declared.** `verify:parity` vs `0395b8a`: **1,078 of 5,832 cases
changed (18.5%)** — by distance 5K 39% · marathon 21% · HM 18% · 10K 17% · 50K 9% ·
100K 7%, and by days 3-day 28% · 4-day 18% · 5-day 9%, which is the mechanism's own
shape. Of 504 grid plans **137 first taper weeks moved, mean −17.7%, max −34.7%**
(<10%: 27 · 10–20%: 63 · 20–30%: 37 · >30%: 10). `cohort:shape` is UNCHANGED — no
cohort is reclassified.

**Four of the fourteen charity personas change, and the showcase is two days
away, so they are named.** Every one improves:

| Persona | pre-taper | taper before | taper after |
|---|---|---|---|
| M5 masters charity marathon (58) | 50 | **48** 38 26 | **41** 32 24 |
| M1d first-timer marathon, declares experienced | 34 | **33** 25 18 | **28** 23 18 |
| T2 sub-50 10K improver | 39 | **31** 18 | **28** 18 |
| M2 charity marathon, compressed 12wk | 37 | **33** 25 18 | **31** 25 18 |

M1d's first taper week was **3% below its pre-taper week**. That is a runner told
they are tapering and handed the same week again, and it was on the showcase
list.

**Residual, stated:** `INV-PLAN-TAPER-DELIVERED-DEPTH` fires on **4 of 15,973**
sweep plans (0.03%).

> ⚠️ **This figure was 3, then 181, then 4 within the same day, and the middle
> number is the one worth keeping.** Widening the sweep's `foundationGapDays` axis
> for FOUNDATION-LONG-RUNWAY-01 re-rolled the whole seeded sample and took this
> check to **181 of 15,973** — every one a **2-day week**, and every one a FALSE
> alarm. The check measured easy-run headroom but not **§52's cap**, which is what
> actually binds: trimming easy runs raises the long run's SHARE, so a 5K taper
> week showing 5.5 km of easy headroom had **0.2 km of LEGAL room**. The check was
> reporting room the engine is forbidden to use. Fixed by giving the invariant the
> same §52 floor the pass already had.
>
> Two lessons. **A firing rate is a property of the SAMPLE, not just the rule** —
> adding one axis value moved every warn rate in that table, so rates measured
> before and after are not comparable. And **a checker that knows only half the
> producer's constraints reports the other half as defects.** `INV-PLAN-TAPER-LR-NOT-ABOVE-PEAK` moves **584 → 588** — a
trimmed taper week makes the long run more clearly the longest, so §6 Am.1 now
measures the real one on four more plans. Neither is hidden.

**Also fixed here (`scripts/coaching-deviation-scan.ts`).** Its §6 check took
`peak` as the max over ALL weeks **including race week** — and an ultra's race week
is the biggest week in the plan, so the check was structurally incapable of firing
at 50K/100K, where the taper matters most. Race and deload weeks are now excluded,
matching how every §6 invariant filters.

Enforced by `INV-PLAN-TAPER-DELIVERED-DEPTH` (`warn`).


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
beginner     → 0 for a FINISH goal; 1 for a TIME TARGET (§110 Am.2)
intermediate → 2
experienced  → 2
```

(Spec proposed 3 for experienced. Overridden to 2 — for the target audience, the third quality session is rarely accommodated by life and consistently produces the symptoms ZONNA exists to prevent.)

### §8 Amendment 1 — the parenthetical said one thing and the value forbade it (Coaching Board CB-BEGINNER-CATALOGUE-01, 2026-09-19)

**This line read `beginner → 0 (no quality at all in base; light tempo only
after week 4)` from the original spec until 2026-09-19.** The parenthetical
declares light tempo after week 4. The value makes light tempo impossible, at
week 4 or ever. **Documented intent with a number that forbids it** — the §92
phantom-enforcement class in reverse, and it survived because a comment inside a
config block is read by people and by nothing else.

The reconciliation is NOT "implement the parenthetical as written". The board
ruled the same day that a beginner on a **finish** goal correctly receives no
quality (CORRECT AS IS, unanimous) — for a first marathon the limiter is tissue
and time on feet, and §28's strides and hill strides already supply the
neuromuscular stimulus. The parenthetical was too broad, not merely unimplemented.

**What replaces it:** the ceiling is 0 for a finish goal and 1 for a time
target, via §110 Amendment 2. The value and its description now agree, and the
one case the parenthetical was right about — a beginner who has declared a
target and needs to have run at it — is the case that got built.

**Quality session sizing:**
- `GENERATION_CONFIG.QUALITY_SESSION_PCT_OF_WEEKLY = 18` — primary quality session distance as % of weekly volume.
- `GENERATION_CONFIG.SECONDARY_QUALITY_PCT_OF_PRIMARY = 80` — when two quality sessions are scheduled (peak experienced), the second is 80% of the first. Different stressor profile, slightly less volume.
- `GENERATION_CONFIG.VO2MAX_WORK_MIN_MINS = 12` / `VO2MAX_WORK_MAX_MINS = 18` — **the VO2max dose is a bounded band of WORK minutes (time at Z4-5), decoupled from weekly volume** (SC-08 vo2max, Coaching Board 2026-08-21). `VO2MAX_WORK_TARGET_MINS` sets the target by fitness × phase.
- `GENERATION_CONFIG.VO2MAX_MAIN_SET_MAX_MINS = 20` — legacy main-set ceiling; the fallback for any VO2max session with no resolvable work minutes (there are none post-migration).

> **VO2max is sized by a bounded rep band — the CD-14 → SC-08 fix, shipped 2026-08-21.**
>
> Sizing every quality session at a flat share of weekly volume is the CD-1 error one layer down, and it is **not neutral**. *Twenty-five minutes of threshold work is a normal session; twenty-five minutes of VO2max work is a race.* Because a share of volume makes every session scale with the week it sits in — and VO2max is scheduled in peak, the biggest weeks — the flat 18% made the hardest session **grow into peak**, anti-correlated with the capacity to absorb it (Seiler) and worst for the slower-recovering runner (Sims). Tuning the *percentage* (13–17%) was rejected at scale: a share of volume can never express "least sustainable per minute."
>
> **The fix is an absolute, structure-driven dose.** The three flat VO2max rows are v2 (SC-08): rep LENGTH is the stimulus identity (3 min / 400 m / 1000 m, fixed), rep COUNT is the dose. The count fills a target inside `[VO2MAX_WORK_MIN_MINS, VO2MAX_WORK_MAX_MINS]` of WORK — measured as time at Z4-5, **not** main set, because full recovery lives inside the main set and is **never shortened to fit reps** (Willy/Sims). The target progresses by **fitness × phase, never by weekly volume**. Bounded at BOTH ends: below the floor it is not a VO2max stimulus (Hutchinson/Sims, RED-S-adjacent); above the ceiling it steals from tomorrow's easy volume (Seiler). The session's size is the rep structure's own length; freed distance returns to easy via the §9 re-derivation (VOL-SHORTFALL-01 proved that preserves total volume). Applies to **paced flat intervals only**; effort-governed hills/ultra-hikes are lower impact (SC-09) and, for ultras, deliberately long.
>
> Enforced hard by **`INV-PLAN-VO2MAX-MAIN-SET-CAP`** (error, now the work-minute band). The relative ordering **`INV-PLAN-MAIN-SET-ORDERING`** compares VO2max on its WORK minutes (its main set carries recovery the sustainable categories don't) — severity **as of this 2026-08-21 ruling was `warn`; see the 2026-09-03 amendment below, which promotes it to `error` and closes SIZING-REALLOC-01.** Do not read this paragraph alone for current severity.
>
> **⚠️ Correction, same day.** This section first explained the §23 peak inversions as *"volume freed from quality has nowhere to go because easy is at its §9 ceiling, so it is lost from the week"*. **Measured, that is false** — the §9 redistribution preserves total weekly volume, and moving the quality share 18% → 15% → 12% changed a week's delivered volume by 0 km. The claim was reasoned, not measured, which is the defect class this document exists to catch. The real shortfall mechanism is unrelated to quality sizing and is filed as **VOL-SHORTFALL-01**. **The decision to reject category sizing is unaffected** — it rests on 187 ordering breaches and 220 undersized sessions across 18,056 plans, independent of why any §23 check tripped.
>
> **Hutchinson's CD-14 amendment 3, discharged:** the audit's claim that its model "validates" the 18% constant recovered its own inputs and is **withdrawn**. 18 was never justified either. Neither number has external support, and this section no longer implies otherwise.
>
> **Promotion attempted and reverted, then re-attempted and shipped — Coaching Board, 2026-09-03, SIZING-REALLOC-01 CLOSED.** First attempt: the board ruled CORRECT-contingent on `warn` → `error`, conditional on the real test suite staying clean — measurement had shown 0 violations across 5,000 plans weighted toward the 15–40km/week risk band, plus 84 plans built to exercise the three rows the same-day sizing generalisation didn't reach (`tempo_cruise`, `tempo_continuous`, `goal_pace_sharpener`). The contingency did its job: `npx vitest run` immediately failed an existing test (`trainingDayFloor.test.ts`) — `experienced` fitness at 12km/week, 7 days available, VO2max's 18 min main set (an absolute band) exceeding `tempo_cruise`'s 8 min (still the flat `QUALITY_SESSION_PCT_OF_WEEKLY` formula, which shrinks at very low absolute volume). Reverted to `warn`, with the exact remaining task named: migrate the three unreached rows.
>
> **Second attempt, same day, after that migration.** `tempo_cruise`, `tempo_continuous`, and `goal_pace_sharpener` moved to structure-driven sizing (reusing `THRESHOLD_WORK_TARGET_MINS`, no new config for two of the three) — every threshold/race-pace catalogue row now sizes off an absolute band, closing the exact asymmetry that caused the first revert. Re-promoted to `error`; confirmed clean against the full test suite (841 tests) AND the full property sweep (18,059 plans, 0 hard failures, 0 violations) before shipping — not the smaller samples that missed the gap the first time. SIZING-REALLOC-01 is closed. Willy's CD-14 amendment 2 (a rep-count ceiling per category, with the budget overflowing into rep *length*) is **blocked on SC-08** — reps do not reach the plan at all today, so a ceiling on them cannot be expressed or checked.
>
> **The named remaining task, done, same day.** `tempo_cruise` and `goal_pace_sharpener` are the identical shape to `tempo_cruise_short`/`tenk_pace_intervals` (reps-scaled, jog recovery) — same mechanism, no new config. `tempo_continuous` is genuinely new (one continuous block, single sustained pace, not reps, not a progression) but the DOSE is the same threshold-work band already ruled correct, so it reuses `THRESHOLD_WORK_TARGET_MINS` rather than a new constant; its v2 block carries `label: 'sustained'` so the §22 goal-pace shape word survives migration (found via golden-snapshot review — without the label it silently fell back to the generic `'intervals'`, which is wrong for a continuous effort with no reps in it at all). **A genuine defect surfaced migrating `goal_pace_sharpener` specifically:** a very slow runner's *minimum* rep count (2 × 1 km at a 9:00/km goal pace) converted to 4.5 km — under `MIN_SESSION_DISTANCE_KM.quality` (5 km, §52b/INPUT-FLOOR-01) — even though the work-*minute* dose this section protects was satisfied. `pacedRepPlan` now grows reps past its own dose ceiling rather than ship a session under an already-established distance floor (D-21: the floor is the harder constraint, not the ceiling — "the day has to be sized for its worst case" is §52b's own reasoning, reapplied here). This affects every reps-scaled row, not just the three migrated today, but only binds for a runner slow enough that the ceiling and the floor would otherwise conflict.

> **Extended to threshold and race-pace paced reps — Coaching Board, 2026-09-03, unanimous.** The VO2max fix above was scoped "applies to paced flat intervals only." A real generated plan measured the same defect class in a different category: `tenk_pace_intervals` (4 × 1200 m @ goal pace, 2 min jog) was sized at `duration_mins: 25` by the flat `QUALITY_SESSION_PCT_OF_WEEKLY` path — but its own documented structure needs roughly 27.6 minutes. The session's stated length did not fit its own prescription, the same incoherence CD-14 already found and fixed for VO2max, simply never carried past it.
>
> **Same mechanism, a different band.** `tempo_cruise_short` and `tenk_pace_intervals` migrate to v2 `derived_set`; rep length stays the stimulus identity (already fully specified in `session-catalogue.md` — "4×5 min Z3 / 90s jog", "4×1200m @ goal pace / 2 min jog"), rep COUNT becomes the dose, filling `GENERATION_CONFIG.THRESHOLD_WORK_TARGET_MINS` (by fitness × phase) inside `[THRESHOLD_WORK_MIN_MINS, THRESHOLD_WORK_MAX_MINS]` (15–30 min) of work. **Not VO2max's 12–18 minute band** (Seiler) — threshold pace is sustainable far longer per minute than VO2max by definition, and reusing the VO2max band would under-dose a session meant to build lactate-clearance capacity.
>
> **A session's estimated distance must convert through the pace it is actually run at.** Generalising the sizing exposed a second, previously-invisible bug: the distance estimate for every structure-driven session converted through I-pace unconditionally, regardless of category — a threshold session's distance was quietly inflated by being timed at VO2max pace. Fixed alongside the band; `resolveAnchorPace` now resolves each row's own work-step anchor (T, I, or `goal`).
>
> **A goal-paced week's override must reach the derived_set, not just the label.** §22's existing goal-pace-week mechanism renames a session's label and `pace_target` to goal pace but, before this fix, never touched a v2 row's `derived_set` — so a threshold session could show "10K-pace progression" at goal pace on its headline while its own rep detail underneath still read true threshold pace. The T anchor now resolves to goal pace (formatted as the same band `pace_target` uses, not a bare point) whenever the session itself is goal-paced, for every threshold-category row — closing the same mismatch on `threshold_ladder` (migrated earlier, same category) as an unplanned but correct side effect.
>
> **Phase 2 — `progressive_tempo`'s continuous shape (same sitting, same ruling).** Not a reps structure — nothing repeats; it is one continuous effort that changes character as it goes. The board's ruling: one block, three equal sequential work steps — first third easy (E-anchor, ceiling — "hold back"), middle third the honest transition, final third threshold (T-anchor). The middle third has no single pace anchor a runner could hit and still be doing what this session is for — a moving target between Z2 and Z3 formatted as a point pace would be false precision — so it carries the zone band `Z2-Z3` as its target instead of a pace anchor. Sized directly by `GENERATION_CONFIG.PROGRESSIVE_TEMPO_MAIN_MINS` (fitness × phase, same shape as the WORK_TARGET bands above minus the reps-count derivation those need, since there is no rep count here to derive), split into three equal thirds. `threshold_ladder` is the structurally identical shape (one block, repeat 1, several sequential work steps, `scaling: 'fixed'`) and is **not** this ruling — nothing in the v2 schema marks "this is a progression, not a ladder", so the engine (`progressiveTempoPlan`) and the invariant (`progressiveTempoExpectedMainMins`) both key on the row's own id rather than any structural signal, which is honest about the schema's limit rather than inventing a discriminator the schema doesn't have.
>
> Enforced by `INV-PLAN-STRUCTURED-SESSION-DURATION-COHERENT` — a structured session's `duration_mins` must be internally consistent with its own `derived_set` (work + recovery + the §16 warm-up/cool-down floors), within `MAIN_SET_ORDERING_TOLERANCE_MINS` rounding tolerance. Mechanically prevents the exact incoherence (a session's own stated length not fitting its own prescribed structure) that surfaced this ruling. **Scoped to `scaling: 'reps'` rows** — the ones `pacedRepPlan` sizes (`tempo_cruise_short`, `tenk_pace_intervals`, the vo2max rows) — **plus `progressive_tempo` specifically**, whose expected main minutes are re-derived from `PROGRESSIVE_TEMPO_MAIN_MINS` directly (its row has no literal length on it to sum — `{ kind: 'parameter' }` lengths, ADR-019's whole point — so the row-only reader that works for reps/ladder shapes cannot recompute it). `threshold_ladder` carries `scaling: 'fixed'` and was never given structure-driven sizing by this or any prior ruling — its `duration_mins` still comes from the older generic quality-session formula, so this invariant does not check it; the goal-pace/`derived_set` fix in the paragraph above still applies to it, sizing does not.

### A time-anchored dose band cannot be filled by a distance-anchored rep — added 2026-09-04 (Coaching Board, EG-01)

**Principle.** `VO2MAX_WORK_TARGET_MINS` is a **target for rows whose rep length divides the band, and a direction of travel for those that don't.** Where rep length is anchored to a distance, the achievable doses are `reps × (rep distance ÷ this runner's I-pace)` — a set of integers, not a continuum — and the target may sit between two of them. That is a property of the prescription, not a defect in it.

**Why this needed saying.** Measured across 4,000 plans, target attainment by row:

| row | rep length | reaches target |
|---|---|---|
| `intervals_classic` | 3 min | **647 / 647 (100%)** |
| `intervals_short` | 400 m | 123 / 207 (59%) |
| `intervals_long` | 1000 m | **304 / 782 (39%)** |

`intervals_long`'s median work is 13.7 minutes against a target of 15–18. At a median I-pace of 4.56 min/km a kilometre rep is 4.56 minutes, so three reps give 13.7 and four give 18.2 — **over the hard ceiling of 18**. Only two counts are admissible and they are 33% apart.

**This is the ceiling working, not failing.** For a 6:00/km runner four kilometre-repeats is 24 minutes at Z4–Z5; for a 4:00/km runner it is 16. The ceiling is the mechanism that stops a distance-anchored rep silently costing a slower runner half again as much time in the hardest zone. Capping that runner at three reps is the correct answer (Seiler). Note too that the shortfall is worst in the **middle** of the pace range — a 6:00/km runner gets 18.0 exactly on three reps — so it is a quantisation artifact, not a bias against slow runners or fast ones (Hutchinson).

**And 13.7 minutes is a real session.** It is inside `[VO2MAX_WORK_MIN_MINS, VO2MAX_WORK_MAX_MINS]`, and the floor is the safety-relevant bound — below it the stimulus is not VO2max. Three by one kilometre is about as canonical a workout as the sport has (McMillan). What is genuinely lost is the **progression**: an experienced runner in peak should receive more work than the same runner in build, and on this row they receive 13.7 in both. That is a defect in a progression, not a deficiency in a session.

**Explicitly rejected: re-specifying `intervals_long`'s rep length.** SC-08 above makes rep length the **stimulus identity** — "3 min / 400 m / 1000 m, fixed". A 1000 m rep at I-pace *is* the long VO2max interval; shorten it and the row becomes `intervals_classic` with extra steps. Changing it would not tune a session, it would delete one.

**Also rejected, on measurement: preferring a target-reachable row at selection.** The board's ruling proposed that the selector favour a row that can reach its target where the pool allows, as a preference never a filter. Measured, this is unimplementable without harm. `selectCatalogueSession` uses least-used-first rotation (CAT-ULTRA-THIN-01), and a plan draws **exactly 3 VO2max sessions, currently one of each eligible row** — a perfectly even spread. At 10K only two VO2max rows are eligible, so §53's cap is 2; preferring `intervals_classic` produces 3/0 and **violates §53**, leaving `intervals_long` unpicked. That is precisely the failure CAT-ULTRA-THIN-01 was written to fix. Any preference strong enough to change the outcome is strong enough to break the rotation; any preference weak enough to be safe changes nothing. **The rotation already owns row selection and is already doing the right thing.**

**Config.** No numeric — the band and the target table are unchanged, and deliberately so. **Not mechanically checkable** (ADR-017 §4): a preference that was rejected has no violation state, and "the target is unreachable for this row at this runner's pace" is a property of the arithmetic rather than a defect a plan can carry. `INV-PLAN-VO2MAX-MAIN-SET-CAP` continues to enforce the band itself, which is the safety-relevant guarantee. Recorded as a known limitation rather than left silent.

### A quality session's distance is priced segment by segment — added 2026-09-04 (Coaching Board)

**Principle.** A structured session's **distance** prices each segment at the pace it is actually run — warm-up and cool-down at easy pace, the main set at its own work pace. Its **duration** comes from the structure. The two are derived independently; they are not two views of one number.

**Why.** `effectiveDistKm` divided the WHOLE session duration by the WORK pace, so a 15-minute warm-up and a 4.5-minute cool-down were priced at threshold or VO2max pace. A live card read **10 km** while its own displayed steps summed to **8.4**. Measured overstatement of quality distance: 5K **25.7%**, 10K **23.5%**, HM **11.4%**, MAR **19.1%**; worst single sessions "stated 10 km vs ~6.9" and "stated 16.5 km vs ~9.3".

Same reasoning as §40b Amendment 2 the same day — the runner plans against the number. McMillan: *"The plan said 45 km. They ran 38. Then they think they are under-performing their own plan, which is the precise anxiety this product is supposed to remove."* Willy adds the accounting point: `weekly_km` sums these, so the inflation landed **specifically on the hard component**, which is the one §2's progression cap and the long-run ratios are measured against. Sims: the third stated number in one day that a runner would plan and fuel against and that was not true.

**Freed distance goes to easy, or nowhere — never back into quality** (McMillan, Willy and Sims, independently). Nothing needed building: §9's re-derivation in `buildWeekSessions` sums the **actual placed** distances, so a smaller quality session automatically enlarges the easy runs. Measured on the golden plans: mean weekly change **+0.10%**, total 779 → 786 km. VOL-SHORTFALL-01's finding holds.

**Two things this got wrong first, both caught by tests rather than reasoning, and both worth keeping:**

1. **Duration followed distance down.** They were two views of one number, so segment-pricing the distance dragged the duration with it — a 4 × 5 min session reading 41 minutes instead of 46. That is the exact defect §40b Amendment 2 had fixed for hill reps hours earlier, reintroduced one field over. They are now derived independently.
2. **The floor checks used the old pricing.** `pacedRepPlan`'s floor loop still divided total duration by work pace, and `tempo_continuous` had **no floor protection at all** — so a low-volume 10K taper produced a 4.5 km quality session against a 5 km floor. **A floor measured in different units from the thing it guards is not a floor.** `segmentPricedDistance()` is now the single owner of that arithmetic, shared by the sizing functions and their callers.

**A consequence for the enforcement layer.** `continuousThresholdExpectedMainMins` recomputed the expected main set from `THRESHOLD_WORK_TARGET_MINS`, which was sufficient while that value was the whole story. Floor growth is runner-specific, so a config lookup can no longer predict it and the invariant fired on a correctly-sized session. It now reads the session's own `derived_set` — the right source for a *coherence* check, since the question is whether the stated duration fits **the structure the runner is shown**, and the row cannot answer it (its lengths are `{ kind: 'parameter' }` by design, ADR-019).

**This amends the 2026-09-03 ruling, it does not overturn it.** Structure-driven *sizing* stays; only the pace used to convert duration to distance changes.

**Config.** No new numeric. `segmentPricedDistance()` in `ruleEngine.ts`. Enforced by the existing `INV-PLAN-STRUCTURED-SESSION-DURATION-COHERENT` (duration ↔ structure) and `INV-PLAN-MIN-SESSION-SIZE` (the floor, now measured in the same units the engine prices in). Regression: `segmentPricedDistance.test.ts`.

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

### §9 — RECORDED STRUCTURAL FINDING: three principles size the long run and the engine obeys the loosest (2026-09-19, PLAN-QUALITY-AUDIT-01)

**This is not a rule change. It is a contradiction in the constitution, measured, written down so it is not rediscovered.**

**The contradiction.** Three principles size the same object and have never been reconciled:

| | says the long run is |
|---|---|
| **§9** (this section) | **28–40% of the week**, and *">35% is a binge — fatigue accumulates faster than aerobic gain"* |
| **§52** | permitted up to **60%**, as a *backstop against lopsidedness* |
| **§80 / §24 / §45** | sized from the **race**, silent about the other days |

**The engine ships 87%.** §52's 60% was written as a ceiling and has been read as a target; §9's sizing intent is enforced by nothing.

**Measured on priority one** (beginner marathon, 6,480 inputs, 4,122 generated): **45.2%** of plans contain a week where one session is ≥75% of it · **83%** regress the midweek runs below their base-phase best when the build phase begins · **29%** stall a midweek run for 5+ consecutive build weeks · **40.5%** contain loading weeks with ≤2 runs. The long run is being funded by the rest of the week.

🔴 **SIX INSTRUMENTS WERE BUILT AND MEASURED. EVERY ONE TRADED ONE DEFECT FOR ANOTHER.** Recorded in full so none is retried blind:

| instrument | result |
|---|---|
| Week-1 floor yields to §2's ramp | Door 12 → 8 km/wk, peak scales — **+884 sweep violations** |
| …bounded by `days × MIN_KM_PER_TRAINING_DAY` | **Measured no-op** (floor sits above the init floor) |
| Injury trim floors at 2 easy runs, sub-floor sizes | 3 weeks recover, 4 do not, **peak week breaches the injury ceiling** |
| §114 delivered-week bound at **45%** | BINGE-SEVERE eliminated — **LONG-RUN-SHORT 0 → 88.7%** |
| §114 at **60%** / **70%** | **0 → 44.2% / 39.6%**; M2 and M3 regress 70% → 56–60% of race |
| §45 absolute arm 50% → 30% | 50 plans better; **M2 net build 68% → 44%** |
| `MIN_KM_PER_TRAINING_DAY` 5 → 4 | DAYS-SHORT −31; **WEEK1-LEAP +135** |

**Why every one failed, which is the finding.** §45's cap is *multiplicative on the previous week's long run*. Reduce a long run in any week and the next week's permitted step is computed from the lower base, so **the trajectory ratchets down and never recovers.** A post-hoc bound on the long run is therefore structurally incapable of fixing composition without destroying specificity.

**The remedy, named but not built.** The long run and the week must be sized **together at construction** (`buildWeekSessions`), not adjusted afterwards — the week's composition decided as one allocation rather than a long run followed by whatever volume remains. That is an engine-architecture change, not a numeric, and it is the one thing that would let §9 and §24 both hold.

**Until then §52's 60% warn is the honest backstop it was written as**, and `npm run audit:plans` holds the numbers so they cannot silently worsen.

### §9 — THE ARCHITECTURAL FIX WAS ATTEMPTED, AND IT IS NOT IN THE CURVE (2026-09-19, second pass)

**§114 was built — the weekly volume curve carrying a floor derived from the long run the race asks for — and it is INERT. Four formulations, all measured, none shipped.** The finding below is what the attempt bought, and it is worth more than the code would have been.

| formulation | result |
|---|---|
| Floor on the raw requirement, applied after §2's cap pass | **Composition fixed outright** — severe binge 45.2% → 2.0%, degenerate weeks 40.5% → 7.5%, days-short 49.4% → 24.3%, specificity untouched. **But it broke §3 Am. (a 24% long-run cut against a 5% week cut) and §2 Am.3 (bounceback against a stale pre-deload value)**, because §2's cap, §3's re-anchor and the bounceback all read surrounding weeks and were computed before the floor moved them. |
| Same, applied *before* pass 2 | Relationships hold; **§2's cap erases the floor.** |
| Floor bounded by `week1 × 1.1^i` | **Inert** — the ramp already grows at §2's maximum for most of the plan. |
| Floor bounded by the §2-legal step from the previous week | **Inert** — that bound is *more* restrictive than the curve already is. |

🔴 **WHY THE CURVE WAS THE WRONG PLACE, and this is the finding.** The 93% week is not a week the curve under-sized. Printed for a knee-history runner at 8 km/week:

| wk | 1–7 (base) | 8 | 9 | 10 | 12 | 13 | 14 | **15** | 16 |
|---|---|---|---|---|---|---|---|---|---|
| week km | 7–22 | 14 | 18 | 23 | 19 | 24 | 23 | **28** | 29 |
| long run | 2.9–8.2 | 10.0 | 15.0 | 20.0 | 16.5 | 21.5 | 21.0 | **26.0** | 26.0 |
| share | 34–42% | 71% | 83% | 87% | 87% | 90% | 91% | **93%** | 90% |

**The long run climbs from 8 km to 26 km while the week never passes 29.** A coherent 26 km long run needs a 43 km week. **An 8 km/week runner cannot reach 43 km in nineteen weeks under §2's 10% rule once §3's deloads take their 30% four times over.** That is arithmetic about running, not a defect in the engine, and no volume lever can move it.

🔴 **AND §111 LETS EXACTLY THIS RUNNER THROUGH, because its metric falls as the plan degrades.** §111 refuses on **delivered peak ÷ current volume**. This runner's delivered peak is **29**, so their ratio is **3.63** — comfortably inside the 4.0 cap — *precisely because their week could not grow*. **A runner whose week cannot hold their long run has a LOW peak, therefore a LOW ratio, therefore passes.** §111 is **anti-correlated with the hazard it exists to guard**, and that single fact explains the sawtooth and the admitted-edge-worse-than-refused finding recorded under §111 earlier the same day.

**What this means for the fix.** The remedy is not in `buildVolumeSequence`. Either:
1. **§52's lopsidedness becomes a refusal or a plan-shape change for the marathon**, rather than a `warn` — the engine already knows the week cannot hold the run; it just ships it and says so quietly; or
2. **§111's metric changes** from peak ÷ current to the long run's share of its delivered week, which is the quantity that actually tracks the hazard.

**Both are Coaching Board decisions about what a first-time marathon plan should BE, not sizing rules.** They are also the same question from two ends, and (2) subsumes `PEAK-VS-DELIVERED-BUILD-01` — the curve-versus-delivered gap found the same day from the opposite direction, at 70 km/week.

---

## 10. VDOT conservatism — protect users from themselves (selectively)

**Principle.** Training paces derived from a benchmark are discounted by 3% by default for **easy** and **threshold** paces. Stale benchmarks (more than 6 months old) get a further 5% discount. **Interval (VO2max) paces use the raw benchmark VDOT** — no conservatism discount — because under-stimulating VO2max sessions undermines the adaptation they exist to produce.

**Why.** A non-elite runner who PBs a 5K and then trains at 100% of the implied VDOT pace on every easy run is a runner about to get injured. The discount on easy and threshold paces acknowledges that race-day pace is a peak output, not a sustainable training pace, and that fitness drifts — exactly where "going hard on the easy days" risk lives. But VO2max sessions are short, structured, with full recovery; they are MEANT to be hard. Discounting them produces under-stimulus and the runner loses the top-end adaptation. The conservatism principle and the polarised-training principle (§1) point the same way: protect easy days fiercely, train VO2max honestly. *(Doctrine clarified 2026-05-25 / R2/H-01 — Stance B.)*

**Config.**
- `GENERATION_CONFIG.VDOT_CONSERVATIVE_DISCOUNT_PCT = 3`  (applied to easy + threshold paces only)
- Staleness is handled by the compounding ramp below (`VDOT_STALENESS_FRESH_WEEKS`, `VDOT_STALENESS_PER_4WK_PCT`, `VDOT_STALENESS_MAX_DISCOUNT_PCT`) — **not** by a months threshold.

Implemented in `buildPaceFromVDOT(discountedVdot, rawVdot)` in `lib/plan/ruleEngine.ts`. Easy/quality paces use `discountedVdot`; interval pace uses `rawVdot`. The applied discount is surfaced in `plan.meta.vdot_discount_applied_pct` so the user can see what the engine did and why.

**A sub-6-month runner's declared volume is capped, because it is a claim, not a measurement.** *(CD-6, SLT-signed 2026-08-06.)* `current_weekly_km` is self-reported in the wizard, taken at face value. For a `training_age: '<6mo'` runner that is the whole plan's foundation — it drives the fitness classification, the starting volume, and whether the runner gets any quality at all — and the downside of an over-claim is a genuine beginner handed an intermediate's load. So the starting volume is capped at `GENERATION_CONFIG.BEGINNER_WEEK1_VOLUME_CAP_KM = 30` regardless of what was declared (belt). Where a HealthKit connection exists, the declared figure should additionally be tempered toward the observed 4-week average (braces, ADR-011) — the device-only half, tracked in backlog PV2-E. This is §10's "protect users from themselves" applied to the input, not just the paces.

**The input's granularity does not change its authority — the caps do.** *(Coaching Board 2026-08-30, CORRECT WITH AMENDMENT.)* `current_weekly_km` and `longest_recent_run_km` are now collected with the **Ruler** primitive — a continuous-but-**stepped** drag (`GENERATION_CONFIG.WIZARD_VOLUME_RULER`: weekly in 5 km steps, longest run in 1 km steps), replacing the earlier coarse bands (`WEEKLY_KM_CHIPS` / `LONGEST_RUN_CHIPS`). The bands looked conservative but were *worse*: a forced midpoint pushed a 25 km/wk runner up to a 30 km bucket, inflating the very starting load §2/§29 guard against. The finer figure is a *better* estimate, not a more-trusted one — the engine still treats it as a claim, tempered by the same belts (this §'s beginner cap, §2's +10% ceiling, §29's `FRESH_RETURN_START_FRACTION`). The step exists so the runner reports an honest "about 35", not a false-precision 37. **Coherence guard:** a self-reported longest run cannot exceed the whole week's volume — enforced by `INV-INPUT-LONGEST-LE-WEEKLY` (error). Continuous input made that nonsense combination easy to enter; the invariant closes it.

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

### Amendment 1 — drift is DIRECTIONAL; below the cap is not a breach — added 2026-09-13 (Coaching Board, R30-DIRECTIONAL-01)

**Principle.** §12 is a **ceiling**, not a band. Any detector that reports a runner
as drifting MUST measure time spent **above** the Z2 cap (`hr_above_ceiling_pct`).
Time spent **below** Z2 breaks no principle and must never be counted as drift.

**Why.** The shipped R30 zone-drift detector (PAID, 2026-05-04) fired on
`hr_in_zone_pct < 60` — a band. Measured in production 2026-09-13: **6 of 22
flagged runs (27%) were predominantly too EASY**, the worst at **17% in zone with
83% below the floor and 0% above the ceiling**. There is no reading of §1 or §12
under which that run is drift. The board ruled the shipped detector **INCORRECT**,
unanimously.

Seiler: the grey zone **has a direction** — it is what athletes do *instead of*
easy, not a band they fail to hit; a symmetric metric for an asymmetric phenomenon
will always mislabel roughly a quarter of cases, which is what was measured.
McMillan: those six runs belong to the runner who has finally understood the
product, and the app was flagging them — the worst possible false positive,
because it punishes the exact behaviour the whole plan exists to produce. Sims:
telling a runner who is already running gently that they are failing is the
pressure that produces over-reaching in the cohort least able to afford it.

**Config.** `ZONE_DRIFT_ABOVE_CEILING_PCT = 20` (`lib/coaching/constants.ts`).
**Re-derived, not carried across** — `< 60% in zone` and `> N% above ceiling` are
different scales and the old number means nothing on the new one. The production
distribution separates with **no overlap**: too-easy runs at `0, 0, 1, 2, 3, 19`%
above ceiling, too-hard at `23, 40, 47 … 94`%. The threshold sits **inside that
gap**, so it is robust at either edge rather than a coin-flip on the next sample.

**The fix removes false positives AND false negatives.** At 20% the detector flags
the same COUNT as before (22 of 42) with entirely different membership: 6 too-easy
runs drop out, and 6 genuinely-too-hard runs the old rule missed come in — runs at
≥60% in zone with more than a fifth above the cap.

> ⚠️ **n = 42 rows with HR data. Thin.** The direction is unambiguous (a run with
> 0% above the ceiling cannot be drift under any reading) but the exact cut should
> be re-measured once the cohort grows. The `≥4 of the last 8` cadence was NOT
> re-derived — the board questioned the threshold, not the window.

**Scope — the CARD and the TRIGGER are two surfaces, and both were wrong (TRIGGER-AUDIT-01, same day).**
R30 (the Coach card) was fixed first. An audit of all eleven `plan_adjustments`
trigger types then found the **`zone_drift` adjustment trigger** keying on the same
non-directional quantity via `zoneDisciplineScore`. That one is worse: it changes
the PLAN, under ADR-012 it **auto-applies silently** (`requiresConfirmation: false`),
and it rewrote every easy/long `coach_notes` to *"Easy sessions trending hard"* —
telling a runner who had finally understood the product the opposite of what they
did. It now keys on `zoneDriftScore`, deliberately a **second function** rather than
a change to `zoneDisciplineScore`: the latter answers *"how much of your running was
in zone?"* (a descriptive ledger figure, correctly symmetric), the former answers
*"how much was ABOVE the cap?"* (the drift claim). Collapsing the two is what
produced the defect. Both surfaces read `ZONE_DRIFT_ABOVE_CEILING_PCT`, so they can
never disagree about what drift is.

**And it was destroying prescriptions.** The trigger assigned a fresh single-element
`coach_notes` array, deleting whatever the engine had already put there — §24e's
ultra fuelling cue, §96's overdo cue, §80's time-on-feet note. A silent
auto-applied adjustment was erasing coaching this board had ruled on. It now
appends, de-duplicates, and respects the three-note cap.

**Enforcement.** `zoneDrift.test.ts` — fixtures are the REAL production
above-ceiling values, so a regression is a regression against observed data. It
asserts both directions: the old rule flagged every too-easy run (falsifying the
fix) and the new rule flags none, while still catching genuine drift and the
missed `65% in zone / 26% above cap` case.

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

**Amendment 1 — the overlay is gated on the CATALOGUE ROW, not the session's name (RACE-PACE-OVERLAY-REACH-01, Coaching Board 2026-09-14).** This section has said "HM and MARATHON" since it was written. The engine asked `label.includes('marathon-pace')`, and the HM row is named *"Long run with HM-pace finish"* — so **HM rendered the race-pace overlay on 0 of 18 peak race-specific long runs, against MARATHON's 12 of 12**. Half a ratified principle, unreachable, on the session whose entire stated purpose is race pace on tired legs. It was invisible because nothing looked broken: the card just showed a calm easy run, and the runner either lost the session or invented their own finish. The gate is now the row's own declared `main_set_structure.type === 'long_run_with_segment'` — the same discriminator the invariant layer already uses, and the D-17 label heuristic ADR-018 exists to remove.

**⚠️ CORRECTED SAME DAY — the percentage is NOT this section's; §25's is (§25 Amendment 1).** This paragraph originally read *"the percentage is THIS section's, and the catalogue's competing numbers are gone"*, and recorded that `easy_pct`/`race_pace_pct` had been **deleted** from `hm_pace_long_run` and `mp_long_run` as "a second, contradicting declaration read by nothing". **That was wrong.** §25 — "Race-specific long run (HM and marathon, time-targeted)" — ratifies *"the final 25–40% of the long run"*, and the rows' 35 and 40 are its faithful per-distance encoding. §16's 20% is the **general default for the universal run format**; §25 is the specific principle for this session and **overrides it**. The rows are restored and `race_pace_pct` is the single owner, read by the coach note and the session card alike.

The error is recorded rather than quietly fixed because the cause is procedural and repeatable: that sitting was run **inline, without the board's mandatory conflict scan**, which is the step that reads a change against every existing section. Run properly hours later it surfaced §25 immediately. **An unread number is not automatically a wrong one** — "read by nothing" is evidence that a CONSUMER is missing, not that the VALUE is junk, and deleting on that basis destroys ratified doctrine while looking like tidying. `race_pace_zone` was promoted to authority in the same sitting and that part stands: the card quotes the row's own word, because telling a half-marathon runner to hit "MP target" hands them the wrong number on the one session where the number is the whole point (Sims, binding).

**What the gate must NOT catch, verified by measurement rather than by reading.** §47's step-back peak long run (it strips label, zone, `lr_segment_pace` *and* `catalogue_id`, so both joins fail): 30 sessions, 0 overlays. §24b's 5K/10K three-part segmented long run (easy → MP → HM finish, built inline with no catalogue row — the two-part shape would hide its marathon-pace middle block): 396 long runs, 0 overlays. §24e's ultra prohibition: 342 long runs, 0 overlays. **§16's "20% of session time" against the code's 20% of the MAIN SET was examined and deliberately left alone** — the card renders a bare `20%` with no referent, so the difference is invisible to the runner and changing it would move the marathon block for no visible gain. Recorded so it is not re-found as a defect. Guarded by `racePaceOverlay.test.ts`; ruling: `docs/decisions/coaching-board-2026-09-14-race-pace-overlay-reach.md`.

**Single owner (Phase 3, Coaching Board 2026-09-03 sitting — D-08/INV-CFG-001 defect fix).** `sessionFormat.sessionSplit()` is the one formula for a quality session's warm-up/main/cool-down split; `mainSetMinutes()` and `durationForMainSet()` are thin wrappers over it. Before this, `sessionComposer.ts`'s quality branch independently re-derived the same split and added its own undocumented 5-minute cool-down floor `sessionSplit` never had — for a 25-minute session this disagreed with the invariant layer's own number (5 min main vs 7.5 min). No principle named that floor (INV-CFG-002), so the drift was accidental duplication, not two deliberate designs; fixing it required no new board ruling, only naming the owner this document had already implied.

---

## 17. Plan signatures — distance shapes the plan

**Principle.** Each race distance has a signature: minimum/ideal/maximum weeks, default sessions per week, taper final session, and the catalogue categories that apply.

**A declared focus MUST be reachable (amended 2026-08-20, CD-15 / SC-04).** `quality_categories_focus` is a promise about the plan's shape, not a label. For every distance, each declared focus category MUST have at least one catalogue session eligible for that distance outside base phase. A signature that names a category the catalogue cannot supply is a defect in one of the two, never an acceptable state.

**Why.** A 5K plan and a 100K plan share almost no structure beyond the four-phase shape. The signature captures the differences without forcing them into the engine's branching logic.

**Why reachability had to become a rule.** The 10K signature declared `['vo2max', 'threshold']` while **no threshold session was eligible for 10K at all**. Half the declared shape was unreachable, and the engine did not fail — it silently fell back to an aerobic row for the entire build phase and prescribed it at threshold pace (§19). The signature had become a statement of intent that no code was obliged to honour, and nothing compared the declaration against the catalogue. This is the §34 failure mode applied to plan shape: declared, never exercised.

**Config.** `lib/plan/planSignatures.ts` — `PLAN_SIGNATURES` keyed by distance. Enforced by `INV-PLAN-PHASE-FOCUS-REACHABLE`, which checks the declaration against `V1_SESSION_CATALOGUE` on every generated plan — so an unreachable focus surfaces on the first plan for that distance rather than waiting for an audit.

**Not every declared field is authority — the table is part v1 design document (SIG-ULTRA-UNBUILT-01, Coaching Board 2026-09-10).** A field in `PLAN_SIGNATURES` is authority only if engine code reads it. `configConsumer.test.ts` sorts every field into one of three states and fails the build if a new field escapes all three: **authority** (read by the engine, e.g. `min_weeks`, `quality_categories_focus`, `free_tier_available`); **superseded** (`SIG_SUPERSEDED` — a shipped principle does the work and the field merely names it: `long_run_cap_minutes`→`LONG_RUN_CAP_MINUTES`, `taper_final_session`→`TAPER_QUALITY_PER_WEEK`, and the three the board reclassified here — `peak_includes_race_pace`/`peak_includes_mp_long_runs`→§24d, `mp_long_run_frequency_weeks`→§47); **committed-but-unbuilt** (`SIG_UNBUILT` — a real coaching commitment the engine does not yet honour and may not be deleted: the ultra back-to-back cadence and 100K time-on-feet count, §24e, build SLT-gated). The board **struck two** fields outright — `fuelling_practice_from_week` (wrong shape, re-spec per §24e) and `night_run_optional` (unbuildable, no time-of-day, ADR-011). The rule this encodes: a declared-and-unread field looks identical to a working one, so the config must never *silently* carry aspiration — every field is authority, superseded, committed, or gone.

---

## 18. Blocked-day enforcement — life-first scheduling

**Principle.** Sessions MUST never be scheduled on days listed in `days_cannot_train`, regardless of week type (base, build, peak, taper, race). Race-week shakeouts MUST be placed on `days_available` only. If race-week scheduling cannot place two shakeouts without using a blocked day, place one shakeout — never violate the constraint to fit a default pattern.

**Why.** "Slow down. You've got a day job." is a literal claim. A user who cannot train on Tuesdays cannot train on Tuesdays in race week either. Hardcoded shakeout patterns (tue/thu) are residue from elite-runner templates and break the brand's core promise — that the plan respects the runner's life. The race week is the most visible week of the plan; getting it wrong undermines trust at the worst moment.

**Config.** No numeric — structural rule. Implemented by `blockedDays()` in `lib/plan/ruleEngine.ts` and enforced by `INV-PLAN-NO-SESSIONS-ON-BLOCKED-DAYS` in `lib/plan/invariants.ts`. The parser accepts both short forms (`'mon'`) and full forms (`'monday'`) so the engine is robust to wizard, API, and test inputs.

---

### §18 Amendment — when VOLUME, not life, caps the running days, the plan says so (FREQ-SILENCE-01, 2026-09-19)

**Principle.** Where `daysVolumeCanFill` reduces the week below the runner's
declared `days_available`, the plan MUST carry `frequency_constraint_note`
naming the days declared, the days used, and the reason.

**Why.** Measured: **18.7% of the weighted population across every distance
gets fewer running days than they declared, and the plan never mentioned it** —
**46% of 5K plans**. A runner who told the wizard "six days" and opens a plan
with three has been silently overruled and has no way to know it was
deliberate. §18 is life-first: the runner's availability is *honoured*, and
declining to spread volume thinner is a coaching decision made **on top** of it.
A decision made on the runner's behalf and not stated is the §40c failure
("a suppressed target is stated, never absorbed") applied to frequency.

**⚠️ THE PRESCRIPTION IS CORRECT AND DOES NOT CHANGE.**
`daysVolumeCanFill = max(3, floor(weeklyKm / MIN_KM_PER_TRAINING_DAY))`, and the
reasoning already recorded there holds: *"a runner on 12 km a week who selects
seven days gets seven ~1.7 km jogs, and no session in the week does anything."*
Measured against real inputs it **never fires above 40 km/week** and fires on
**65% of runners under 20 km/week**. It is volume, exactly as designed.

**⚠️ THE CAP WAS NEARLY FILED AS A DEFECT.** A plan holding three runs from
5 km/week to 17 km/week looks broken until you substitute the constant:
`floor(17 / 5) = 3`. Pinned by a test so it is not re-filed.

**⚠️ THE NOTE IS COMPUTED FROM THE FINAL WEEKS.** Twice on the same day a value
read mid-pipeline was stale by the time the runner saw it
(LONG-SESSION-FUEL-01, COPY-STALE-GEN-01). Frequency also **grows** within a
plan as volume does (measured 4→5 on a marathon, 3→5 on a half), so the note
quotes the real low and high rather than one number wrong for most of the block.

**Effect.** Fit-for-purpose **5K 50.6% → 91.8%**, whole product **66.7% → 78.0%**.
`verify:parity` IDENTICAL with the note stripped: 654 plans gained a sentence
and no plan changed a session.

**Config.** No new numeric — it reads `days_available` and
`MIN_KM_PER_TRAINING_DAY`.

**Enforced by** `planQuality`'s `DAYS-SHORT` predicate, which now fires only on
an **undeclared** shortfall. ⚠️ That relaxation raises the measured rate by
~18.7pp and is legitimate **only because the prescription was measured correct
first**; `frequencyConstraintNote.test.ts` case 5 strips the note and asserts
the objection returns, so the predicate is conditional and not switched off.

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

**Why.** Hill repeats place loaded eccentric stress on the very tissues that are already symptomatic for these injury types — the knee under load on the descent, the Achilles at the top of each rep. The existing volume cap (5% week-on-week for knee/shin, §2's injury cap) is necessary but insufficient; volume restraint cannot save a runner from inappropriate session *content*. The brand promise is "Slow down. You've got a day job." — a runner with a niggle still has both the niggle and the day job. The engine must respect both.

**Config.** `GENERATION_CONFIG.HILL_RESTRICTING_INJURIES = ['knee', 'itb', 'achilles', 'shin', 'calf', 'plantar']`. Catalogue rows tagged `main_set_structure.terrain === 'hills'` (or whose `id` contains `'hill'`) are excluded by `selectCatalogueSession()` when this filter applies. Enforced by `INV-PLAN-INJURY-NO-HILLS` in `lib/plan/invariants.ts`.

---

## 22. Race-specific exposure (time-targeted goals)

**Principle.** For `goal: time_target`, the runner needs sustained exposure to goal pace before race day. In the second half of the plan (weeks > ⌈total_weeks/2⌉), the engine MUST prescribe goal pace on the build/peak quality slot, with VO2max sessions exempt (their physiology is too valuable to lose). The session is renamed to a race-distance-specific label (e.g. "10K-pace intervals", "HM-pace intervals") and the prescription lands within ±2% of derived goal pace.

**Why.** A non-elite runner who has never run at goal pace in training will run their first goal-pace metres on race day. They will either go out at the wrong pace (because they don't know what it feels like) or fail to commit to it (because the pace feels alien). Specificity is the simplest fitness lever in coaching: if the race is at pace X, train at pace X. The brand promise is "training plans that stop you overtraining" — but a plan that's so cautious it never visits race pace is a plan that produces a race-day stranger to their target.

**"Specific" must resolve to a real catalogue entry, not a rename (amended 2026-08-20, CD-18 / SC-05).** A distance whose race pace is physiologically distinct from I-pace MUST own a `race_specific` catalogue session. The all-distance `goal_pace_sharpener` does not count as that distance's own entry. Where a distance-specific race session exists and is eligible, it is preferred over the generic — **most specific row wins**.

Applies to **10K, HM and MARATHON**. **5K is excluded**: at 5K, race pace and I-pace largely coincide, so the VO2max rows already deliver race-specific physiology.

**SC-05 CLOSED — Coaching Board, 2026-09-03.** This was recorded as an engineering judgement awaiting the board; the board has now ruled and **agrees with the exclusion as written**. Seiler: at 5K the distinction between "goal-pace work" and "VO2max work" is not physiologically real — you are at or near vVO2max either way — so requiring a *separate* race-specific catalogue row there demands a distinction the physiology does not make. The 10K case is genuinely different and still binds, because CD-18's analysis grounds the mismatch in race pace sitting **between threshold and VO2max**, which does not transfer to 5K.

**Scope of the closure: the OWNERSHIP arm only.** In the same sitting the board was asked to extend the 5K exclusion to §22's goal-pace **ratio** arm, on evidence that the ratio was unsatisfiable at 5K (155 sweep violations, every one reading `0% (0/1)`). **That evidence was wrong and the extension was NOT made.** Measured afterwards: across 108 5K time-target plans, **168 of 168** non-VO2max quality sessions in build/peak sit within ±5% of goal pace — at 0% delta, because the engine prescribes "5K-pace progression", "5K-pace sustained" and "5K-pace intervals", none labelled VO2max. The ratio is satisfied perfectly at 5K.

The 155 violations had a different cause entirely: `halfWeek` in `validatePlan` counted foundation weeks (n ≤ 0) toward `totalWeeks`, shifting the second-half boundary so the wrong weeks were assessed — contradicting this document's own statement that foundation weeks "are never part of the main plan's periodisation arc" (§57). Fixing that cleared all 155; an A/B with and without a 5K skip gave identical sweep totals. **The ratio arm binds at every distance, 5K included.**

*Recorded because the error is instructive: `0/N` in a violation message says the numerator was zero, not that it could never be non-zero. Unsatisfiability must be confirmed by measuring the satisfying case, never inferred from the failure.*

**Why this needed saying.** 10K — one of two free-tier flagship distances — had no race-specific session while HM had two. That was not a decision anyone made; it is where the catalogue stopped. The gap was **invisible in the product** because the engine renames a borrowed row to "10K-pace progression", so the plan *looked* like it contained 10K-pace work. **§33 explicitly sanctions that rename and requires the borrowed voice be replaced — which the engine does correctly.** The failure is subtler and worth generalising: **§33 closed the review by fixing the symptom (borrowed voice) and left the cause (no 10K entry) in place. A principle can close a review without closing a gap.** Worth remembering the next time a principle is written to describe existing behaviour rather than to correct it.

**Config.** No numeric — structural rule. Implemented in `buildWeekSessions()` (`lib/plan/ruleEngine.ts`) which sets `goalPaceWeek` when `weekN > ⌈totalWeeks/2⌉`, `goal === 'time_target'`, and the phase is build or peak. `makeQualitySession()` honours the flag by overriding label and pace prescription. Taper selection ranks eligible `race_specific` rows by `distance_eligibility` size so the most specific wins without hardcoding ids. Enforced by `INV-PLAN-RACE-SPECIFIC-EXPOSURE` in `lib/plan/invariants.ts`, which now also requires the distance to own a real entry.

---

### Amendment — a session displaced by §5's adaptation window is exempt (Coaching Board, 2026-09-15)

**Principle.** §22's PER-WEEK check does not apply to a quality session that was
RELOCATED into that week by §5's VO2max adaptation-window swap
(`applyV2Vo2MaxOnsetTiming`). This is a fourth exemption alongside VO2max
(`isVo2maxSession`), effort-governed rows (§40b) and mixed-anchor rows (§85),
and it rests on the same argument: **`INV-PLAN-RACE-SPECIFIC-EXPOSURE-RATIO`
still holds the PLAN to a race-pace share**, so exempting one displaced session
cannot let a plan avoid race-specific work overall.

**Why it was needed.** The week the session lands in was legal BEFORE the swap
only because a VO2max session sat there — and VO2max is already exempt. So §22
already tolerates a non-goal-pace session in that exact slot; the swap merely
changes which kind. Repairing §79's re-entry window (QUALITY-ONSET-ORDER-01)
pushes the first VO2max later, which is what makes the swap fire at all —
measured **288 ERROR violations**, a completely homogeneous cohort: 144x 5K +
144x 10K, **all** time-targeted, **all** `intensity_reentry_active`, **all**
`recent_quality_training: 'regular'`. `ruleEngine.ts` had documented that late
swapping "breaks §22" and nothing enforced it.

**What the board rejected, and why it matters.**
- **§79 yields** (don't withhold VO2max on time-targeted short races) —
  rejected. It reinstates exactly the defect §79 exists to prevent: a returning
  runner's FIRST quality session at Zone 4-5, for the runner whose tissue
  tolerance lags their aerobic engine (Willy, Sims).
- **§5 yields** (accept VO2max past its adaptation deadline) — rejected. Willy:
  pushing VO2max later compresses the same dose into fewer weeks before the
  taper, a DENSITY increase for the runner whose tissue is already the limiting
  factor. CD-22's own position is that the window is a physiological quantity.
- **Swap with a race-pace partner instead** — measured and insufficient: only
  **144 of the 288** failing plans have a `race_pace` candidate in the first
  half (first-half quality mix is vo2max 288 / race_pace 144, no threshold at
  all). A tactic, not a rule.
- **Retiring the swap** for construct-compliant placement remains the correct
  LONG-TERM direction (`ruleEngine.ts` already says so) and stays out of scope.

**Binding condition, measured at ratification:** across 576 plans carrying a
displaced session, `INV-PLAN-RACE-SPECIFIC-EXPOSURE-RATIO` violations **0** and
per-week §22 violations **0**. If that ratio ever fails on these plans the
exemption is void.

**Structural, never by label (D-17, INV-CLASS-002).** The relocation stamps
`Session.displaced_by_adaptation_window`, which the generator sets and
`EnrichedWeekSchema` cannot reach — a label test would be rewritten by the AI
voice pass, the same fault that silently killed the shakeout invariant for
months.

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

### Amendment 1 — the floor comparison is not decided by the engine's own rounding — added 2026-09-13 (Coaching Board, MARATHON-MAINT-LABEL-01 re-opened)

**Principle.** Where §24's peak long-run floor is compared against a runner's
actual peak long run, the comparison MUST allow one `DISTANCE_ROUNDING_PRECISION_KM`
step. The producer floor-rounds the long run to that precision before the
comparison happens; measuring a rounded value against an unrounded threshold makes
the engine's own rounding the deciding factor. This applies at **every** site that
compares against the floor — the `volume_profile` classifier and
`INV-PLAN-PEAK-LR-RACE-RATIO` alike.

**Why.** A computed 31.9 km long run is stored as 31.5 and fails a 31.65 km floor
by **150 metres**, downgrading the plan to `maintenance`. Measured 2026-09-13:
**9 of 162** time-target marathon plans below the floor sit inside that dead band,
and **6 of 78** HM plans. Willy: 0.5 km on a 31.65 km long run carries no tissue
implication — this is a comparison bug, not a load change. McMillan: six
kilometres short of the floor is a coaching fact the runner should be told, 150
metres is not, and today both produce the identical sentence.

**Two sites, deliberately.** The classifier's tolerance flips near-miss plans from
`maintenance` to `build`, and `INV-PLAN-PEAK-LR-RACE-RATIO` is **exempt while a
plan is maintenance**. So amending only the classifier un-exempts exactly the plans
it just forgave and errors on them — measured as 3 hard failures in the cohort grid
before the invariant was brought into line. Principle, numeric and mechanical check
must agree on what the floor IS.

**Config.** No new numeric. Reuses `GENERATION_CONFIG.DISTANCE_ROUNDING_PRECISION_KM`
(0.5), because the tolerance IS the rounding that caused the artefact. Stated
explicitly so the absence is not read as an oversight.

**Enforcement.** `INV-PLAN-LR-FLOOR-NOT-ROUNDING` — no plan is TOLD its peak long
run missed the floor by less than that step. It reads the two numbers the note
itself printed rather than recomputing the peak long run: the first version
recomputed with `sessionKmForCheck` while the classifier uses `sessionKmOrZero`,
the two disagreed on 3 plans, and a checker that derives the producer's input a
second way is racing it rather than checking it.

**Declared cohort move.** `cohort:shape` re-baselined: maintenance 51.0% → **50.6%**
overall; **HM 40.7% → 38.9% (−1.8pp)**; **marathon 71.1% → 71.1% (unchanged)**, because
66.7% of marathon plans below the floor are short by more than 6 km and are
correctly labelled. 5K and 10K untouched.

> ⚠️ **What this amendment is NOT, so it is not re-filed.** The 2026-09-13 batch
> sitting ruled that a time-target marathon must not be maintenance *solely*
> because §24's floor is unreachable under `LONG_RUN_CAP_MINUTES`, and predicted a
> ~100% relabel. **That mechanism does not exist.** At the engine's actual easy
> pace (6.26 min/km) the 210-minute cap buys 33.5 km — above the 31.65 km floor —
> at every volume from 50 to 110 km/wk; the board's own worked example sits at 191
> minutes against the cap, 19 minutes of headroom. Implemented exactly as ruled it
> flipped **zero** plans. Substituting §45 as the blocker was ruled **INCORRECT**:
> §45 already legislates this case in its own words (*"this principle wins and the
> plan downgrades to maintenance"*), so the amendment would have required
> overturning a ratified principle rather than clarifying one. And for the 20% of
> plans where §24 is the SOLE trigger, the label is correct — they are runners
> whose longest recent run is 7–17.5 km, who genuinely cannot build to 31.7 km in
> the weeks available. The complaint about the flat 100% rate is about **utility,
> not correctness**: a label that is right but undiscriminating needs a better
> label, which is a different item. Full measurement:
> `docs/investigations/marathon-maint-label-01-measurement-2026-09-13.md`.

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

**Principle.** Build-phase long runs on time-targeted 5K and 10K plans carry a Z2-ceiling reminder in the session's coach notes — a brief emphasis on running at the top of Zone 2 rather than drifting above it. It is not a pace segment, carries no time target, and applies to the **whole run**, not a slice of it. **Engine copy:** `Zone 2 ceiling — if HR starts climbing, back off to a walk for 30 seconds before resuming.` (verified verbatim against `lib/` by DOC-CLAIM-01 — this is the exact drift that check exists to catch). Total session type remains `easy`; zone tag stays Z1–Z2.

> **Corrected 2026-09-07 — this section described a feature that was never built, next to one that was.** It previously said the cue covered *"the middle 10% of the run"* and quoted note text (*"if HR exceeds this, walk 30 seconds"*) that differs from what ships. The engine has emitted an unconditional whole-run note since `b856009`; there is no 10% segment and never was. `GENERATION_CONFIG.LR_BUILD_Z2_CEILING_SEGMENT_PCT` (0.10) existed to size that segment and was read by nothing — found by `configConsumer.test.ts` and **deleted**, because inventing a position for a note that has none would be building structure to justify a constant. A whole-run cue is also the right shape: HR drift on a long run is not confined to its middle. **The lesson is the adjacency** — §24b's segment percentages, twenty lines up, ARE read and DO work. One principle in a block of four quietly described something else, and nothing compared the prose to the code.

**Why.** Build-phase long runs are the most common place where runners inadvertently drift into Zone 3 — aerobically comfortable but metabolically expensive. For a 5K runner doing a 90-minute long run, the last 20 minutes at Z3 costs them three days of residual fatigue that shows up in the Tuesday interval session. The Z2-ceiling reminder is a soft structural cue, not a hard physiological stimulus. It respects the session's aerobic intent while nudging execution quality.

**Config.** None — deliberately. The cue is unconditional on qualifying weeks, so there is no numeric to tune; the qualifying condition (`is5K10K && goal === 'time_target' && phase === 'build' && !isDeload`) is the whole rule and lives in `buildWeekSessions()`. No invariant — this is a notes-layer cue, not a structural constraint. **A principle is allowed to have no config, and saying so is better than keeping a constant to make the section look complete.**

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

**Back-to-back long runs are a governed commitment, not incidental (SIG-ULTRA-UNBUILT-01, Coaching Board 2026-09-10).** The `back_to_back_long` catalogue row is the defining ultra adaptation — the second long run on already-fatigued legs is where fatigue resistance is built. The board ruled the `PLAN_SIGNATURES` cadence a REAL commitment (50K every 3 weeks / 100K every 2 weeks, from the build phase), currently unhonoured — ultras get back-to-backs only if the ordinary rotation happens to pick the row. When wired, **Willy's three guards bind**: a back-to-back weekend counts as that week's peak long-run stimulus for §47 (never stacked on top of one), it never lands adjacent to a deload, and **both days stay Z2** (§1 — the second day is never "quality to save time"). The build is SLT-gated on ultra acquisition; the commitment is tracked in `configConsumer.test.ts` `SIG_UNBUILT` and enforced by `INV-PLAN-ULTRA-BACK-TO-BACK-CADENCE` once built. 100K's `time_on_feet_sessions_in_peak: 2` is a commitment of the same class.

**Fuelling practice — re-spec DELIVERED 2026-09-13 (ULTRA-FUEL-NOTE-01); history retained below.** The struck `fuelling_practice_from_week: 8` numeric was the wrong *shape* (an absolute week index means different things in a 16- vs 22-week plan — the §44 fragility) and the wrong *object* (fuelling is not a scheduled session — the `time_on_feet` row already carries `fuel_every_mins: 30`). The board (Sims leading — under-fuelling on 4–6h efforts is the RED-S / low-energy-availability vector, worse for the women and masters runners this serves) ruled the commitment real: re-specify as a **phase-anchored fuelling cue on the ultra long run** during the specific phase, not a calendar week. Tracked as `CAT-ULTRA-FUELLING-01`.

**The cue, as built (Coaching Board batch sitting 2026-09-13, item 7 — CORRECT).**
A `coach_notes` line on the long run, when `distKey ∈ {50K, 100K}` ∧ phase is
`peak` ∧ the week is not a deload. Peak only, deliberately: the same reasoning
§24c and §96 use — one cue on the session where it matters, not a note on every
long run, which becomes wallpaper and gets ignored (McMillan). Peak is also where
the durations actually reach the 3–4 h at which fuelling stops being optional
(measured: 179–210 min at 50K, 200–247 min at 100K).

**Config — no new numeric, and the reason is not the obvious one.** The ruling
held that the cadence already exists, and it does: `fuel_every_mins` sits on
`ultra_race_sim` (25) and `time_on_feet` (30). What it does **not** sit on is the
session the cue attaches to — measured 2026-09-13, **100% of 50K/100K peak long
runs carry no `catalogue_id` at all**; those two rows only ever land in the
*quality* slot. So the cadence is read as a RANGE across every ultra row that
declares one (`ultraFuellingCadenceMins()`, currently 25–30), not as a pick
between them. Picking 25 or 30 would have been a new coaching numeric on a 4-hour
effort, which is precisely what the ruling excluded — and the choice is not
neutral, since the shorter interval is the more protective one on Sims's own
RED-S grounds. **If the board wants a single tighter cadence, that is a numeric
decision and needs its own sitting.** Until then the range is what doctrine
already says out loud.

> ⚠️ **Adjacent finding, NOT fixed here (SIG-ULTRA-UNBUILT-01's class).**
> `ultra_race_sim`, `time_on_feet` and `back_to_back_long` are placed only as
> *quality* sessions and never as the long run, so the ultra long run is a plain
> `longSession()` throughout. That is why it carries no row to read a cadence
> from. Whether the ultra long run SHOULD be drawn from those rows is a
> prescription question, not a defect fix, and belongs with SIG-ULTRA-UNBUILT-01.

**Enforcement.** `ultraFuelNote.test.ts` — reach (every ultra peak long run),
containment (no other session, no other distance, 0 leakage measured across
5K/10K/HM/MARATHON), survival across the note-stacking cohorts (`overdo` adds
§96's Z2 cue to every long run, and `appendCoachNote` silently drops a 4th note),
§24e compatibility (`INV-PLAN-ULTRA-NO-PACE-SEGMENTS` stays clean — fuelling is
not pace), and a mutation test proving the cadence is READ rather than written
into the copy. `verify:parity`: 864 of 5,832 cases changed, **432/972 at 50K and
432/972 at 100K, and 0/972 at every non-ultra distance.**

---

### §24e Amendment — the fuelling cue is gated on DURATION, not on the race being an ultra (Coaching Board 2026-09-19, LONG-SESSION-FUEL-01)

**Principle.** The peak-phase long run carries fuelling guidance whenever its
duration reaches `FUELLING_PRACTICE_MIN_SESSION_MINS`, at **every** race
distance. Where the catalogue supplies an ultra cadence it is used verbatim;
otherwise the runner gets **practice** guidance carrying no cadence.

**Why — the hazard Sims named is a DURATION hazard, and the gate named a race.**
§24e's cue (CAT-ULTRA-FUELLING-01, 2026-09-13) was scoped
`distKey === '50K' || '100K'`. A long run of three and a half hours is a
low-energy-availability event whatever race it is training toward.

**Measured.** Of 88 plans containing a session of two hours or more, only **27
carried any fuelling guidance on that session — 69% silent**. The flagship case
is worse: the **never-run beginner marathoner is prescribed SEVEN sessions over
two hours, topping out at 3h28, with no mention of fuelling anywhere in the
plan.** After: **76 of 88**.

**Sims, recorded.** The under-fuelled first-time marathoner is disproportionately
a woman in her twenties or a peri-menopausal returner. The runner who bonks at
2h30 unfuelled does not conclude *"I needed to eat"*, she concludes she cannot
do this — so this is an **adherence** failure as much as a health one, which is
the founder's own question.

**⚠️ PRACTICE, NEVER A NUTRITION PRESCRIPTION.** No grams, no calories, no
schedule. Zonna holds no dietary data (ADR-011) and must not imply
individualised nutrition advice. The note tells the runner to rehearse what they
already intend to use.

**⚠️ `distance_km` (or its bucket) standing in for a coaching classification is
now the FIFTH instance** — LR-CAP-BLIND-01, SESSION-KM-01/02, V4-ANCHOR-01,
QUALITY-ZERO-SCOPE-01. It is a grep, not a discovery.

**⚠️ PEAK-ONLY AND NON-DELOAD ARE PRESERVED, deliberately.** §24c/§96's
reasoning holds at every distance: a cue on every long run is wallpaper. E1
would otherwise take it seven times.

**⚠️ IT RUNS AS A POST-PASS, AND THE PLACEMENT IS THE FIX.** The first version
sat at the placement boundary and read the long run's duration there. Measured:
at placement H1's peak long run is **116 minutes**; the runner receives **124**.
Something downstream lengthens it, so a duration read at placement is STALE and
the cue silently missed every session sitting just under the threshold. The
invariant caught it on the first run — the argument for shipping a rule and its
check in one commit.

**Config.** `GENERATION_CONFIG.FUELLING_PRACTICE_MIN_SESSION_MINS = 120`.
**120 is the defensible part:** carbohydrate intake during exercise has strong
support beyond roughly two hours and thin support below it, so a lower
threshold would be Zonna overclaiming — the failure mode Hutchinson's seat
exists to catch.

**Enforced by** `INV-PLAN-LONG-SESSION-FUELLING-NOTE`, **error** severity.
⚠️ It checks the **longest** peak long run, not every one, because **a step-back
week is invisible in the plan's structured data** (`type: 'normal'`, no badge,
`phase: 'peak'` — identical to the loading week beside it; only its prose says
otherwise). 🔎 **Filed, not fixed:** that missing marker will bite the next rule
that needs to tell loading from recovery.

---

## 25. Race-specific long run (HM and marathon, time-targeted)

**Principle.** Peak phase of a time-targeted HM or marathon plan MUST contain at least one long run with an embedded race-pace segment. The segment is the final 25–40% of the long run (the runner is already aerobically tired when they hit goal pace, simulating the late-race state). Naming convention: "Long run with HM-pace finish" for HM, "Marathon-pace long run" for marathon. Distances ≤10K do not require this — their long run remains aerobic.

**Why.** Threshold-pace cruise intervals teach pace discipline on fresh legs. Race-pace work on tired legs is a different adaptation: glycogen recruitment under fatigue, mental discipline at hour 1+, the specific feel of holding goal pace when easy pace would feel right. Daniels and Pfitzinger both call this the single most race-specific session for the HM and marathon. Without it, the runner has practised the pace and practised the duration but never together — and race day is the first time those two collide.

**Config.** Catalogue rows `hm_pace_long_run` (HM) and `mp_long_run` (marathon), both `category: 'race_specific'`. Selected in `buildWeekSessions()` peak-phase long-run path when `goal === 'time_target'` and the runner has a derivable goal pace. Implemented via `raceSpecificLongRunSession()`. Enforced by `INV-PLAN-RACE-SPECIFIC-LONG-RUN` in `lib/plan/invariants.ts`.

**Amendment 1 — the 25–40% is now a NUMBER with an OWNER and a CHECK (Coaching Board 2026-09-14, verification sitting).** This section has ratified "the final 25–40% of the long run" since it was written, and for months that band existed only as prose. Nothing named it, nothing enforced it, and **three different answers shipped side by side on the same session**:

| Source | What it said | As a share of a 165-min marathon long run |
|---|---|---|
| Catalogue row `mp_long_run` | `race_pace_pct: 40` | 66 min |
| The coach note, hand-typed at the call site | *"Final 30–50% at MP"* | 50–83 min — **breaches this section's 40% ceiling** |
| `composeSession` (the session card), applying §16's general 20% to the MAIN set | *"20%"* | 27 min, **16% of the run** |

Two of those rendered **on the same card**: the runner read *"Final 30–50% at MP"* in the coach note and *"Race pace — 20%"* in the structure block, for one segment. The HM card said *"Final third"* against *"20%"*.

**Ruling.** `main_set_structure.race_pace_pct` on the catalogue row is the **single owner** — HM 35, MARATHON 40, both inside this band — and it is read by the coach note and the session card alike. The percentage is **of the long run**, as this section's words say, not of the main set. `GENERATION_CONFIG.LR_RACE_SEGMENT_PCT_MIN` / `LR_RACE_SEGMENT_PCT_MAX` name the envelope so a future row cannot be added outside it, enforced by `INV-PLAN-LR-RACE-SEGMENT-PCT`. The hand-typed note strings are gone: a coaching number inside prose is a number no check can see, which is exactly how *"30–50%"* outlived this section's own ceiling.

**§16 is the general default; this section overrides it for this session.** §16 declares "20% of session time at race pace, peak phase, HM and MARATHON only" as part of the universal run format. §25 is the specific principle for the race-specific long run and ratifies a larger, per-distance dose, because that is the whole point of the session — goal pace on aerobically tired legs, which 16% of the run does not deliver.

> ⚠️ **An unread number is not automatically a wrong one, and this is the case that proves it.** Earlier the same day, RACE-PACE-OVERLAY-REACH-01 found `race_pace_pct` read by no code and **deleted it from both rows** on the reasoning that §16's 20% governed and the rows carried "a second, contradicting declaration with no reasoning attached". The reasoning was attached — here, in §25, one section away — and the deletion removed the faithful encoding of a ratified principle. The error was procedural: that sitting was run inline without the board's **mandatory conflict scan**, which is the step that reads a change against every existing section, and it is the step that caught this within minutes of being run properly. **The conflict scan is not paperwork.**

**Willy's guard, recorded.** The dose is a percentage, so it scales with the longest sessions: at 40%, a 165-minute marathon long run carries 66 minutes at marathon pace, and the longest measured peak long run (191 min) carries 76. He would prefer an absolute ceiling on top of the percentage. The board did not add one — that would be **new doctrine**, not a reading of this section, and §24's `LONG_RUN_CAP_MINUTES` already bounds the session the percentage is taken from. Filed as his stated position so a future sitting on ultra-long marathon blocks starts from it rather than rediscovering it.

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

### §28 Amendment 1 — strides and hill strides are ONE neuromuscular family (Coaching Board 2026-09-18, CB-BEGINNER-HILLS-01)

**The gap, measured across 4,259 generated plans.** Plans containing any hills:
**beginner 0.0%, intermediate 43.7%, experienced 40.5%.**

**Nobody decided beginners should not do hills.** It falls out of a type
assignment: `session-catalogue.md` types `hill_reps` as `vo2max` and
`aerobic_hills` as `intermediate`-minimum, and
`QUALITY_SESSIONS_PER_WEEK_MAX.beginner = 0` (§110, ratified). Hills reach a
beginner through no path at all — an exclusion by accident, not by ruling.

**Willy:** *"A short hill sprint is not a VO2max session. Six by ten seconds up
a moderate gradient is neuromuscular and tendon-loading — eccentric-heavy, it
builds exactly the tissue stiffness that pure easy volume does not, and it
carries lower impact per unit of stimulus than flat fast running because the
ground comes up to meet you. For a novice ramping volume for eighteen weeks that
is protective, not risky."*

**Principle.** For a runner at `fitness_level: 'beginner'`, every
`BEGINNER_HILL_STRIDE_EVERY_N_WEEKS`-th stride run **becomes** a short hill
stride run. Strides and hill strides are one family, governed by one onset
(`STRIDES_FIRST_WEEK`) and one placement rule.

⚠️ **IT ALTERNATES, IT DOES NOT ADD.** The board authorised hills *"dosed like
§28's strides"*. A hill run placed ALONGSIDE the weekly stride run would double
the neuromuscular dose, which no seat asked for. Measured after shipping:
beginner stride runs 10.1 → 4.6 per plan with hill strides on the remainder,
**zero weeks carrying both**, and intermediate/experienced unchanged at 10.1 /
10.2. Total dose is identical; only the variety changed.

⚠️ **IT REMAINS A COACH NOTE ON AN EASY RUN**, and that is what makes it
structurally incapable of counting as quality. `session.type` stays `'easy'`, so
`QUALITY_SESSIONS_PER_WEEK_MAX` (0 for beginners) and §1's session-count
distribution are untouched **by construction**, not by a rule anyone has to
remember. The board was explicit that
`QUALITY_SESSIONS_PER_WEEK_MAX.beginner = 0` stays and must not be raised.

⚠️ **THIS IS NOT A ROUTE TO `hill_reps`.** The catalogue's hill rows are
`vo2max` and `build`/`peak` phase and stay closed to this cohort. What is
authorised is a short neuromuscular hill stride, not a hill workout.

⚠️ **The strides half of the original ruling was WITHDRAWN.** It required
beginners to receive strides — which §28 had already given them, universally
(100% of plans at every level, mean 10.1 runs). The submission that prompted it
measured session `type` and `label` and could not see a coach-note
prescription. Legislating it would have shipped a no-op.

**Config.** `GENERATION_CONFIG.BEGINNER_HILL_STRIDE_EVERY_N_WEEKS = 2`, onset
shared with `STRIDES_FIRST_WEEK`.
**Enforced by** `INV-PLAN-BEGINNER-NEUROMUSCULAR`.

### §28 Amendment 2 — hill strides yield to §21, and the label tells the truth (2026-09-19, CB-HILL-INJURY-01 / STRIDE-VISIBILITY-01)

🔴 **A LIVE SAFETY DEFECT, shipped by §28 Amendment 1 on 2026-09-18 and closed
the next day.** `isHillStrideWeek()` keyed on week number and fitness level and
**never consulted `injury_history`**, so a beginner with knee history was
prescribed *"6×10s hill strides up a moderate gradient"* in weeks 5 and 9 —
with `'knee'` in `HILL_RESTRICTING_INJURIES` and §21 barring exactly that
session.

⚠️ **IT WAS INVISIBLE BECAUSE THE LABEL LIED, AND THAT IS THE LESSON.**
`INV-PLAN-INJURY-NO-HILLS` classifies hill work by matching the session
**label**. The label was `Easy run — Zone 2` while the coach note said hill
strides, so a §21 safety invariant was looking straight at the session and could
not see it. It surfaced the moment `STRIDE-VISIBILITY-01` made the label say
`Easy run + hill strides — Zone 2` — **the D-17 failure mode (never couple logic
to a display string) catching itself.** No measurement found this; making a
label honest did.

**The rule.** Hill strides are a hill session. Where §21 bars hill work, the
alternation collapses to its safe arm and the runner gets §28's flat strides
every stride week — a change of modality, never a loss of stimulus.

**Single owner.** `neuromuscular.ts → hasHillRestrictingInjury()`. ⚠️ **This
predicate existed THREE times before it existed once** — in `ruleEngine`'s
catalogue selector, in `invariants`' §21 check, and a fourth copy was about to be
written for hill strides. That omission *is* how the defect reached production:
the producer never asked the question the checker was asking.

**The label (`STRIDE-VISIBILITY-01`, SLT 2026-09-18).** §28 places strides on
**100% of eligible weeks — 22,558 of 22,558 measured** — and every one was
labelled identically to a plain easy run. The label is now derived at the point
of placement from the structural fact that strides were placed; nothing branches
on the string. Wood's binding condition holds: descriptive, never
congratulatory, no chip, no change to the description.

⚠️ **A second latent hazard went with it.** `hasStrideNote()` carried a
`label` arm that was dead while no label said "strides" and became a hole the
instant one did: the enricher can rewrite labels, so a stripped stride note
under an intact label would have passed the net that exists because the enricher
once stripped notes from 12 of 17 weeks of a live plan (`ENRICH-STRIDES-01`).
The arm is removed — **the note is the prescription, the label is display.**

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

### Verifiable engine-copy claims — the `**Engine copy:**` convention (DOC-CLAIM-01, 2026-09-09)

**Principle.** When this document quotes a string the engine **emits to the runner** (a coach cue, a note, a label) and asserts it is the *shipped* text, mark it with a bold `Engine copy:` label immediately followed by the exact string **in backticks**, on one line. The §24c Z2-ceiling cue above is the live worked example. `docClaims.test.ts` extracts every such marker and verifies the string exists **verbatim** in `lib/`, failing the build if it drifts. Backticks delimit (cues contain quotes and em-dashes); the label makes the intent explicit and the parse unambiguous — and single-line, so an unterminated backtick can't swallow the document.

**Why it is opt-in, not a scan of every quote.** §24c quoted a Z2-ceiling cue that had drifted from the shipped text, and reading the doc's words concluded the feature was *missing* when it had shipped in April — nothing compared the prose to the code (`configPrincipleSync` checks key→principle, `configConsumer` key→consumer, INPUT-EFFECT-01 input→effect; none check principle→behaviour). But a blanket "every `*"…"*` quote must exist in code" check is unbuildable-clean: the doc's quotes are an indistinguishable mix of emitted cues, **hypothetical** runner speech, **paraphrases**, and **historical** drift-descriptions (a "Corrected" note quoting the old wrong text on purpose). Measured 2026-09-09: 56 quotes, no heuristic separates them. So the marker is explicit and the check has **zero false positives** — and its coverage grows as authors mark claims.

**The escape hatch.** A quote that is illustrative or paraphrased — not verbatim shipped copy — is written **`Example copy:`** (or left as plain `*"…"*`) and is **not** checked. Do not mark a templated string with interpolated values as `Engine copy:` — the literal won't match; describe the fixed part or use `Example copy:`.

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

### Amendment 1 — the tier is a SIZING floor, not a delivery promise (LR-EARNED-TIER-01, Coaching Board 2026-09-15)

**Principle.** §35's tier is applied when the peak long run is **sized**. What the
runner is **delivered** is then governed by §45 (progression cap), §47 (peak
alternation) and §9 (build step-backs), and those win. §35 already said so —
"where doing so doesn't violate other principles" — and this makes the ordering
explicit rather than leaving it to be rediscovered.

**Why — §45 had already ruled the precedence.** §45's own text reads: *"When the
§24 floor cannot be reached without violating this cap, **this principle wins**
and the plan downgrades to maintenance."* §35's tier sits ABOVE §24's floor, so it
cannot outrank what the floor itself yields to. Reading §35 as a delivery promise
asks the plan to break a cap that exists because spike-then-recover is the most
reliable injury vector in this population (Willy).

**Traced, not inferred.** An HM runner earning the 95% stretch tier (20.5 km) left
`buildWeekSessions` with peak long runs of **23.4 km and 22.7 km** — above the
tier, so the lift never even bound. §47 then made one peak week a step-back and
the delivered peak became 19 km, at 119 min against a 135-min cap that was not
binding. **Nothing was under-prescribed; the safety rules were applied.**

> ⚠️ **`PEAK_LR_RATIO_STRETCH` IS CURRENTLY INERT, and that is recorded here rather
> than quietly corrected.** Measured across 36 comparable plans varying distance,
> volume, days and runway: the stretch tier changed the delivered peak long run in
> **0 of 36**. The TARGET lift is observable in 33 of 36 (floor-only runners get a
> materially shorter peak long run), so the tiering mechanism works — it is the top
> rung specifically that never survives to delivery.
>
> **Per §25 Amendment 1, "read by nothing" is evidence a CONSUMER is missing, not
> that the VALUE is junk** — and this is the same class one step on: the value IS
> read, and its effect is always erased downstream. It is NOT deleted. Either the
> ordering changes so the top rung can land, or §35 should carry two rungs instead
> of three. **That is a further board question, deliberately not answered here.**

**Recorded collision (Sims).** §35's stretch gate and §47's consecutive-peak
exception test the same question — "can this runner take more?" — with different
predicates:

| | §35 stretch | §47 exception |
|---|---|---|
| hard-session relationship | `love` | `love` |
| injury | no HILL-RESTRICTING injury | **no injury at all** |
| training age | not tested | **`5yr+`** |

A runner can earn §35's stretch tier and fail §47's exception, which is exactly the
traced case. **Sims's objection stands on the record: §35's gate turns on a
self-report about appetite for hard work and uses it to increase load, while §47's
requires a training-age floor and a clean injury history. If the two are ever
reconciled, reconcile toward §47's.** Not actioned here.

**Config.** No numeric changes. `PEAK_LR_RATIO_VS_RACE`, `_TARGET` and `_STRETCH`
are unchanged; only their STATUS is clarified. Inventing a constant to satisfy the
three-artifact habit would be the §25 duplicate-declaration failure.

**Mechanical check.** `INV-PLAN-PEAK-LR-EARNED-TIER` is **RETIRED** — it asserted a
delivery promise that this amendment says does not exist, and fired on 8 plans that
were correct. §24's `INV-PLAN-PEAK-LR-RACE-RATIO` continues to guarantee the runner
is not under-prescribed below the floor. The tier's observable half is pinned by
`lib/plan/peakLrEarnedTier.test.ts`.

**Board:** CORRECT WITH AMENDMENT. Hutchinson chairing; Willy vetoing the
re-application options; Seiler no objection; McMillan recording that the shape a
runner actually notices is the peak-phase long run being shorter than a build
week's (`INV-PLAN-PEAK-IN-PEAK-PHASE`, 21.2% of plans), which is a separate item.

### Amendment 2 — two rungs, not three (LR-TIER-GATE-RECONCILE-01, Coaching Board 2026-09-15)

**Principle.** The tier has **two** rungs: §24's floor, and the target ratio for a
runner whose `longest_recent_run_km` already clears that floor. The stretch rung is
removed and `PEAK_LR_RATIO_STRETCH` is deleted from `GENERATION_CONFIG`.

**Why — two reasons pointing the same way.**

1. **Its gate was the weaker of two answering one question.** §47's
   consecutive-peak exception decides the same thing ("can this runner take more
   long-run load?") and requires `love` **and no injury at all** **and
   `training_age: 5yr+`**. §35's stretch required `love`, no *hill-restricting*
   injury, and tested training age not at all. **The weaker gate was the one
   adding distance** (Sims). A runner could earn §35's stretch and fail §47's
   exception — the traced LR-EARNED-TIER-01 case exactly.
2. **It was inert.** Measured across 36 comparable plans (2 distances × 4 volumes
   × 3 day-counts × 2 runways), the stretch rung changed the delivered peak long
   run in **0 of 36**, while the target lift moved **33 of 36**. Removing it has
   provably no effect on any runner's plan.

Hutchinson: the evidence that a peak long run at 95% of race distance beats 90%
does not exist, so the rung was being defended on intuition. McMillan: three rungs
is a rule the runner must understand rather than experience, and the third never
changed their plan.

> ⚠️ **THIS IS A BOARD DELETION OF A MEASURED-INERT VALUE, NOT A TIDY-UP.** §25
> Amendment 1 exists because `race_pace_pct` was deleted as "read by nothing"
> while §25 ratified it one section away. The distinction: here the value **is**
> read, its delivered effect was **measured as zero**, and the board ruled on it
> explicitly. **Do not cite this as precedent for deleting an unread constant.**

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

**Amendment 1 — "mid-week" binds, and race eve is protected (Coaching Board 2026-09-14).**

This section is titled *"Race-week **mid-week** easy run"* and §77 refers to it in its own text as *"the §39 mid-week easy"*. The engine placed it from the preference order `['sat', 'fri', 'wed', 'mon', 'tue', 'thu']`, and for a **Sunday race — which is nearly every real race — `sat` is the day before the gun and it was first in the list.**

**Measured on an 81-plan Sunday-race grid: a session landed on race eve in 81 of 81 plans — 100.0%.** Mean 54 minutes. HM longest 56; marathon longest 72. **Worst case: a BEGINNER, finish-goal marathoner on 25 km/week, given 9 km / 72 minutes the day before their first marathon.** Unlike §30's two shakeouts, which pass through `enforceCap` and are bounded at 35 minutes with RPE ≤ 3, this run was built directly and nothing bounded it — `applyWeekdayMinsCap` does not reach it either, because Saturday is not a weekday.

**This was a defect against documented intent, not a new coaching decision.** The constitution already said mid-week in two places, and §26 already said *"the engine must never schedule a fatigue-adding session in race week"* — a 72-minute run the day before a marathon is fatigue-adding by any reading. The board ruled rather than exempting because the FIX changes what a runner is told to do in the most consequential week of their plan, and because the code comment at the site had explicitly parked the question (*"whether an easy run the day before a race is good coaching is a separate question — deliberately not relitigated here"*), which makes it an open question by the repo's own record rather than a typo.

**The rule.** §39's run takes the **earliest** available non-shakeout day in race week, not the latest, and **no session within `RACE_EVE_PROTECTED_DAYS` (1) of race day may exceed §30's shakeout cap** (`RACE_WEEK_SHAKEOUT_MAX_MINS`, 35 min). A §30 shakeout on race eve is *correct* and stays — it is "a wake-up for the legs, not training", and CD-7 deliberately places one there when §30's `[5, 3]` offsets fall outside race week. The first draft of this amendment forbade **every** session on race eve; the golden plans caught it, because that would have deleted a good session along with the bad one. The rule is a **ceiling, not a prohibition**. §30's `[5, 3]` offsets already place no shakeout there, so nothing legitimately belonged on race eve; this makes that explicit and checkable. Earliest rather than latest because §39's job is aerobic preservation, which any day serves equally — the only axis that varies is proximity to the race, and on that axis earlier is strictly better.

**Why 1 day and not 2.** A single day without running before a race is standard taper practice across Daniels, Pfitzinger and Hudson. The board declined to invent a longer protected window without evidence: two days of complete rest before a goal race is a real coaching position but a contested one, and §30's strides exist precisely because six days of taper running can leave a runner flat-footed. One day is the floor everyone agrees on.

**Config.** `GENERATION_CONFIG.RACE_EVE_PROTECTED_DAYS = 1`, expressed as days-before-race in §77's vocabulary so it generalises to any race weekday. Enforced by `INV-PLAN-NO-RACE-EVE-SESSION`.

---

## 40. 5K finish-goal long-run cap

**Principle.** For `goal: finish` AND `race_distance_km ≤ 5`, the peak long run is capped at `LONG_RUN_CAP_MINUTES_5K_FINISH` (70 min) rather than the standard `LONG_RUN_CAP_MINUTES['5K']` (90 min). Aerobic development for 5K finish goals comes through frequency + total volume; extended long runs add fatigue without proportional benefit. Time-targeted 5K plans (where the runner is actually racing) keep the standard 90-min cap.

**Why.** Round-2 review flagged Sarah's 84-min peak long run for a 5K finish goal as HM-shaped — too aerobic-development-focused for what she's actually training for. A returning runner targeting a finish-line photo doesn't need a 14-km long run; she needs to reach race day with healthy connective tissue and the confidence she can run 5 km. Sub-cap LRs (35–60 min) accomplish that with less injury risk.

**Config.** `GENERATION_CONFIG.LONG_RUN_CAP_MINUTES_5K_FINISH = 70`. Applied in `applyLongRunCap()`. Standard `LONG_RUN_CAP_MINUTES['5K']` retained for time-targeted 5K plans (where 90 min remains coaching-appropriate as a ceiling).

---

## 40d. A plan that cannot progress is labelled, not disguised

*Added 2026-08-20 — Coaching Board (VOL-STRUCTURE-01).*

**Principle.** When a runner's volume cannot be **structured** within their available days, the plan is declared **maintenance** and says why. Below a materiality line, a peak phase sitting slightly under the plan's maximum is a **plateau**, not a failure, and §23 tolerates it.

**Why.** 33% of realistic plans peaked *below their own base phase* — they detrained the runner and said nothing.

Traced (10K, 3 days, 60 km/wk): base weeks ran a 19 km long run at **119 of a 120-minute cap** plus two 15 km easy runs = 49 km. A quality session then **displaced a 15 km easy run with a ~9 km session**, and neither remaining slot could absorb the 6 km — the long run pinned at `LONG_RUN_CAP_MINUTES`, the easy runs capped at `long / LONG_RUN_MIN_RATIO_VS_EASY` (§9). **The volume fell out of the structure, not out of a coaching decision.**

Incidence scales with volume per available day: **4%** at ≤8 km/day, **53%** at 13–16, **73%** at 17+.

**The charitable reading was rejected.** A 60 km/week runner training for a 10K arguably *should* be cut. But a defensible reduction and an accidental one produce the same number, and the engine gave no evidence of intent — so §23 stands and the engine was at fault.

**Two fixes were built and rejected, both on measurement. Recorded so they are not retried:**

| Attempt | Result |
|---|---|
| Declare every inversion `maintenance` | Cleared all 1080 violations — and flipped **45% of realistic plans**, including a 45 km/week runner on four days. Relabelling at scale. |
| Clamp the volume curve to what a week can hold | **Net negative:** +118 peak violations, +43 long-run-share, and **636 new §1 breaches** — cutting volume raises the quality *share*. |

**What ships: one number, two mechanisms, no gap.** `PEAK_INVERSION_MATERIAL_PCT` (10) is simultaneously §23's plateau tolerance and §52's fourth maintenance trigger. Below it, tolerated; at or above it, declared. Nothing falls between them.

**The line is measured, not chosen.** Inversion distribution across realistic inputs: min 1.3%, **median 4.2%**, p75 10.6%, max 15.6%. **86% of the violations were under 10%** — rounding across 3–6 sessions a week, and §23's own note already allows holding volume from build through peak. The genuinely alarming cases — the traced 49→43 and a 50K at 94→83 — both sit at ~12%.

**Result:** maintenance now fires on **12%** of realistic plans rather than 45%, and correctly concentrated — 2% at ≤8 km per available day, 44% at 17+.

**The note names the lever** (§40c's rule): days, not effort. **The caps do not move** — `LONG_RUN_CAP_MINUTES` and §9 are both correct.

**Config.** `GENERATION_CONFIG.PEAK_INVERSION_MATERIAL_PCT = 10`. Enforced by `INV-PLAN-PEAK-IN-PEAK-PHASE` (tolerance) and §52's structural trigger (declaration).

---

## 40c. A suppressed target is stated, never absorbed

*Added 2026-08-20 — Coaching Board (VOL-SHORTFALL-01), unanimous.*

**Principle.** When a **life-first constraint** materially suppresses what the plan can deliver, the plan **says so, states the cost, and names the lever that would change it.** The constraint still wins. This governs what the plan *says*, never what it prescribes.

**Why.** `max_weekday_mins` is the runner's own statement about their life — *"I can't run more than 45 minutes on a weekday"* — and honouring it is correct. But it is not free, and the plan was silent about the price.

Measured by counterfactual (identical profile, cap vs no cap):

| Shape | Peak week, capped | Uncapped | Lost |
|---|---|---|---|
| HM, 4 days, 45 min | 49 km | 66 km | **26%** |
| 10K, 4 days, 45 min | 43 km | 57 km | **25%** |
| 10K, 3 days, 60 min | 39 km | 49 km | 20% |
| HM, 5 days, 60 min | 64 km | 65 km | 2% |

**32 of 36 shapes affected; median loss 18%, worst 27%.** Across a wider grid, **52% of capped plans** had more than a quarter of their weekday easy runs pinned exactly at the cap — the worst had all of them.

**The runner never knew.** They asked for a half-marathon time and a 45-minute weekday limit, received a plan built on a quarter less volume than the engine's own curve intended, and had no way to see the two asks were in tension. They would reasonably conclude that is simply what training for that time looks like.

**This is not a new idea, which is the uncomfortable part.** §44 already refuses to pretend about preparation time. §80 already states a long-run shortfall rather than shipping it silently. §52 already explains a maintenance-grade plan. The pattern was written down three times and this case still went unnoticed — because nothing computed the counterfactual, so there was no quantity to be silent *about*.

**Two boundaries, both binding.**

1. **The volume is not clawed back.** The engine does not move suppressed volume onto the weekend. Doing so converts a manageable week into a two-hard-days week — the exact pattern this product exists to prevent (Seiler).
2. **The note names the lever.** A note that only reports the loss is a disclaimer; naming the one thing that would change it is coaching (McMillan). The 5-day rows above are why the day count is the honest first lever — the same cap costs 2–11% there against 25% on four days.

**Threshold: 10% of the intended peak week**, and the bounds are measured, not chosen. Below it is rounding and phase noise — an unconstrained plan tracks its own curve to within ~1 km/week. Firing at 5% would be noise, and **notes that fire on noise get ignored, which costs more than the note gains** (McMillan).

**Voice.** State the fact; do not encourage. An early draft read *"a 44km week you run beats a 65km week you abandon"* — true, but that is motivation, and `brand.md` rules it out.

**Config.** `GENERATION_CONFIG.VOLUME_SHORTFALL_NOTE_THRESHOLD_PCT = 10`. Surfaced as `meta.volume_shortfall_note`; the measured percentage is stamped as `meta.volume_shortfall_pct` so the obligation is **mechanically checkable** — an invariant cannot recompute a counterfactual after generation. Enforced by `INV-PLAN-VOLUME-SHORTFALL-DECLARED`.

---

## 52b. A training day must be able to carry a real session

*Added 2026-08-20 — Coaching Board (INPUT-FLOOR-01), unanimous.*

**Principle.** Where weekly volume divided by available days falls below `MIN_KM_PER_TRAINING_DAY`, the engine uses **fewer days**. It does not spread volume across days it cannot fill.

**Why.** A runner on 12 km a week who selects seven days was given **seven ~1.7 km jogs**: the quality session fell under its own floor and the long run was barely longer than the rest. Nothing in the week did anything. The same 12 km over three days is a training week — something resembling a long run, and one session with enough length to have a purpose.

McMillan: *"Nobody coaching a new runner says 'run every day.' They say 'run three times, properly.'"* Willy adds the load argument: seven exposures a week on an unconditioned tissue, with no session long enough to drive adaptation, is cost without benefit.

**The question as filed was wrong, and that is the finding worth keeping.** This was raised as *"minimum weekly volume per race distance"*. Held against weekly volume alone, or against race distance alone, the signal is **flat zero at every value**. It exists only in the interaction:

| km per training day | Sessions below the floor |
|---|---|
| < 2 | **13%** |
| 2–3 | 7% |
| 3+ | **0%** |

A defect invisible to either axis on its own — the third time in one day that a mechanism was mis-identified by reasoning about one variable at a time.

**The floor is the LARGEST session floor, not the smallest.** `MIN_KM_PER_TRAINING_DAY = 5 = MIN_SESSION_DISTANCE_KM.quality`. It was set to 4 (the *easy* floor) first, on the reasoning that a day need only hold the least demanding session; measurement disagreed — the quality session then landed under its own 5 km floor. **A day must be sized for the biggest thing that might land on it.**

**Two boundaries.**
1. **Never below 3 days** — at or under that, §52's low-day rule already owns the shape and downgrades to maintenance with its own note.
2. **This does not override life-first (§18).** The runner's availability is unchanged and honoured; the engine declines to *spread* volume, not to accept the days. A well-fuelled runner keeps every day they asked for, up to §64's six-day cap.

**Say it, don't just do it** (Sims): a beginner who committed to running seven days has made a behavioural decision that matters, and a silent reduction reads as a demotion. The change is stated in the §52/§40c idiom — what changed, why, and that the days they get will contain real sessions.

**Config.** `GENERATION_CONFIG.MIN_KM_PER_TRAINING_DAY = 5`. Makes `INV-PLAN-MIN-SESSION-SIZE` satisfiable — it went from 188 sweep violations to **zero**.

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

### Amendment 1 — an effort-governed row is excluded from §22's goal-pace override — added 2026-09-04 (Coaching Board, unanimous VETO)

**Principle.** §22's race-specific override (rename the session after the race distance, prescribe at goal pace) **must not be applied to an effort-governed row**. The exclusion covers all three surfaces together: the label, the `pace_target`, and the `derived_set`.

**Why.** §40b above says an effort-governed session "does not invent a number the runner cannot act on". §22's override invented exactly that number, and the two principles had never been reconciled — the tension was noted in a `ruleEngine.ts` comment and deferred rather than resolved. A time-targeted 100K drew `vert_hike_repeats` — a power-hiking climb session prescribed at `rpe: 6`, whose own steps read *"hands on quads, short steps, tall chest"* and *"walk back down"* — and shipped it to the runner as **"100K-pace intervals" at 8:14–8:34 /km**. Measured at 4 occurrences in 5,392 swept plans (100K-only in that sample; the mechanism is distance-agnostic and any future effort-governed row on a time-target plan inherits it).

**Why it was invisible.** Two reasons, and the second is the more useful one. First, the `property-validate-plans.ts` grid applied `target_time: '0:45:00'` to *every* distance, which gave a 100K runner a 27 sec/km goal pace — so every goal-paced measurement above 10K was meaningless, and "0 violations" meant *no coverage*. Second, `isVo2max` was doing the excluding, and `vert_hike_repeats` is `ultra_specific`: **a category test only ever guards the categories that exist today.** The exclusion is now structural — *does this row's work step carry a pace at all?* — per INV-CLASS.

**The consequence for §22, stated rather than absorbed.** `INV-PLAN-RACE-SPECIFIC-EXPOSURE` requires second-half build/peak quality on a time-targeted plan to be goal-pace work, and already exempts VO2max *"because their physiology is too valuable to lose"*. Effort-governed sessions are exempt on the **identical** reasoning: power hiking is the skill that decides how a 100K finishes, it cannot be run at goal pace, and it must not be pushed out of peak to satisfy a naming rule. Note what the old behaviour actually was — the hike passed §22 *only by carrying the invented pace §40b forbids*. §22 is not weakened: the plan-level `INV-PLAN-RACE-SPECIFIC-EXPOSURE-RATIO` still holds the plan to a race-pace share, so exempting a session from the per-week catch cannot let a plan avoid race-specific work overall.

**Config.** No numeric — structural rule. Enforced by `INV-PLAN-EFFORT-GOVERNED-NOT-GOAL-PACED`, which checks the label and the pace target independently because they can regress apart.

### Amendment 2 — an effort-governed session is still sized against its own structure — added 2026-09-04 (Coaching Board)

**Principle.** A session's stated `duration_mins` must at minimum be able to hold the steps whose length is known. Effort-governance removes the pace; it does not remove the arithmetic.

**Why.** `hill_reps` was sized by the generic *distance ÷ easy pace* estimate, producing a stated 39 minutes for a session whose own prescription is 8 × (1:30 uphill + 1:30 jog down) = **24 minutes of reps inside a 20.1-minute main-set allocation**, before the eight open-ended standing recoveries and the run to the hill are counted at all. Measured 2026-09-04: incoherent in **258 of 428 placements (60.3%)**; worst observed 31 stated minutes against ≥24 minutes of reps, a 186% overrun.

**Why it was ungoverned — the generalisable part.** Three guards each decline effort-governed rows, and **every one of them is individually correct**: `pacedRepPlan` returns null when the work step has no pace; `pacedRepMainMinutes` returns null on landmark/open/mirror/parameter lengths ("skip rather than guess"); `INV-PLAN-VO2MAX-MAIN-SET-CAP` skips sessions with no `pace_target`. No guard is wrong, the union leaves the case with zero coverage, and **nothing in the system measures per-guard coverage** — so the hole is invisible by construction. Worth naming as a failure class in its own right: *orphaned by unioned exclusions*.

**Why the runner cares, from three seats.** McMillan: the day-job runner plans their evening around the duration, and a session that says 39 and takes 55 destroys the number they trust most. Willy: hill reps at 5–8% grade with eccentric descent loading are among the highest tissue-stress work in the catalogue, and every downstream load calculation — weekly minutes, hard/easy spacing, §2's progression cap — is computed against a session a third smaller than reality. Sims: a systematically understated duration is a systematically understated energy demand, and the runner who pays first is the one already under-fuelling.

**Shipped in two phases the same day, and the sequencing was the point.**

**Phase 1 — the lower bound at `warn`.** Open and landmark steps price at **zero**, so the check is weaker than the truth and can only under-report; a session it flags is definitively too short. `warn` rather than `error` because promoting ahead of the sizing fix throws in dev/test for 60% of hill placements — the failure that reverted `INV-PLAN-MAIN-SET-ORDERING`'s first promotion on 2026-09-03. At `warn` it measured the population the fix had to cover, before the fix existed.

**Phase 2 — the constants, and the promotion to `error`.** `effortGovernedPlan` now prices every step of the row's own structure, including the two it could not price before, and the session's `duration_mins` comes from that structure. A 10K hill session went **39 minutes → 54**.

| Constant | Value | Basis |
|---|---|---|
| `EFFORT_GOVERNED_RECOVERY_SECS` | **60** | The pause at the top before trusting the legs downhill. The descent is already priced (a `mirror` step), so this is only the standing recovery. |
| `EFFORT_GOVERNED_TRANSITION_MINS` | **2** | The gap between finishing the strides and starting rep one. |

**The recovery value was chosen on error asymmetry, not physiology, and that is worth stating plainly.** Willy argued the longer pause on eccentric-control grounds — a runner who starts down still gasping runs the descent sloppy, and sloppy downhill running across eight reps is where patellofemoral and calf-tendon problems come from. Sims argued the decisive point: being 15 seconds per rep **long** costs the runner nothing, being 15 seconds **short** costs them the number they planned their evening around, and a systematically understated duration is a systematically understated energy demand — with a sex-linked tail through under-fuelling, in a population already inclined to treat the plan's number as a ceiling. McMillan dissented at 45 seconds as the truer coaching number and accepted 60 on the asymmetry argument. **Recorded rather than synthesised.**

**The transition was argued down from 5 to 2, unopposed.** For most runners the fifteen-minute warm-up *is* the run to the hill; a separate five-minute approach double-counts it (McMillan).

**Neither value has literature behind it** (Sims). Four practitioners agreeing is better than one and is still not a measured number. Do not let a later citation get attached to these.

**The estimate is never the prescription.** "Until ready" stays on the card. Self-regulation against the gradient is the whole reason the session works on a day when the legs are flat, and a stopwatch number in its place builds a different, worse session (McMillan). This follows the pattern already in `makeQualitySession`, which estimates hill duration against easy pace and explicitly does not surface it. **If a future change puts these seconds in front of a runner, that is a new session and needs its own ruling.**

### Amendment 3 — runner-environment terrain governs pace-vs-effort EMPHASIS, never a fabricated pace — added 2026-09-09 (Coaching Board CB-TERRAIN-01)

**Principle.** The runner's environment terrain (`road` / `trail` / `mixed`, distinct from a session's `main_set_structure.terrain`) shifts *how the runner is told to govern* — not the pace numbers. For terrain in `GENERATION_CONFIG.TERRAIN_EFFORT_GOVERNS` (`trail`/`mixed`), the plan carries an effort-lead note (`meta.terrain_effort_note`): off-road, effort/HR leads and the pace targets are a **road reference**. `road` is the pace-anchor baseline and carries no note.

**Why the board VETOED a terrain pace multiplier.** The obvious build — scale the VDOT paces down for trail — is precisely what §40b forbids: *inventing a number the runner cannot act on*. Trail pace swings 20 %+ with grade and footing (a smooth towpath vs technical singletrack), and the input is a three-way enum, so any single multiplier is false precision at scale (§11). And Zonna governs by HR (§14, "Hold the zone") — pace is the follower, and terrain **already self-corrects** through it: trail Z2 simply arrives at a slower pace. Adjusting the follower to chase the leader's terrain is motion without meaning (Seiler). McMillan's frame carried the ruling: the runner's frustration (*"why can't I hit 5:00/km on the trail?"*) is real, and the coaching answer is never a secret trail pace — it is *"run the trail by effort; the pace targets are for the road."* That is a **note**, not a number. Willy: variable footing makes pace a poor governor anyway. Sims's condition of approval: the note must point *toward* effort discipline, never read as "run faster to compensate."

**Why it needed doing at all — the honesty half.** The wizard's `terrain` step subtitled itself *"Affects pace targets"* while the engine read `meta.terrain` for nothing (INERT-INPUTS-01). A paid step that states an effect it does not deliver is worse than an absent one. The board's resolution is **both**: wire terrain to the effort-lead note *and* re-copy the subtitle so it stops promising the invented number §40b forbids.

**Config.** `GENERATION_CONFIG.TERRAIN_EFFORT_GOVERNS` (`['trail', 'mixed']`). **Invariant.** `INV-PLAN-TERRAIN-EFFORT-NOTE-DECLARED` — a plan whose `meta.terrain` is effort-governed must carry `meta.terrain_effort_note`; a wired effect that can silently go missing is no effect (§34). **Not weakening §40b or §11** — it applies their logic to a new surface: where terrain sets intensity, state effort, do not invent a pace.

**Do not trim to preserve the old total** (Willy). The session got longer because it always *was* longer; cutting a rep to keep the number familiar would reintroduce the defect one field over. The dose is the eight reps; the duration is the consequence.

**DISTANCE is deliberately untouched.** The ruling was about duration. The first implementation also derived distance from the corrected duration and that was scope creep carrying a real defect: a slow runner's 45s-variant session came out at 4.5 km, under `MIN_SESSION_DISTANCE_KM.quality` (§52b/INPUT-FLOOR-01) — and unlike `pacedRepPlan` this shape cannot grow out of it, because the rep count **is** the variant. Leaving distance alone is also the more honest model: duration and distance stop implying one another, which is correct for a session where eight standing recoveries cover no ground and nothing surfaces a pace anyway.

**Config.** `GENERATION_CONFIG.EFFORT_GOVERNED_RECOVERY_SECS` (60) and `EFFORT_GOVERNED_TRANSITION_MINS` (2). Sized by `effortGovernedPlan` in `ruleEngine.ts` — the sibling of `pacedRepPlan` for the rows it declines. Enforced by `INV-PLAN-EFFORT-GOVERNED-DURATION-LOWER-BOUND` (**error** as of phase 2).

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

Implemented in `applyVdotDiscount()` (`lib/plan/ruleEngine.ts`).

> **`VDOT_STALE_BENCHMARK_MONTHS` / `_ADDITIONAL_DISCOUNT_PCT` are DELETED (2026-09-07).** This paragraph used to say they were *"retained for back-compat with any consumer that hasn't migrated"*. `configConsumer.test.ts` proved there was no such consumer and never had been — a 6-month cliff and a flat 5% sat in config, documented as live, superseded by the ramp above, and read by nothing. Kept here as the worked example of why that test exists: **"retained for back-compat" is a claim about consumers, and nobody was counting them.**

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

### §44 Amendment — a plan that admits it falls short may not read `comfortable` (Coaching Board 2026-09-19, DIFFICULTY-SHORTFALL-01)

**Principle.** Where a plan carries a declared shortfall — `long_run_shortfall_note`,
`peak_shortfall_note` or `volume_shortfall_note` — the difficulty band MUST NOT
read `comfortable`.

**Why — §44 was contradicting its own definition of its own bottom rung.** The
ladder above defines it plainly: *"`comfortable` — adequate timeline, plan
**reaches its target** (or is `appropriate_for_persona`)."* Measured across
4,536 plans, **751 read `comfortable` while carrying a note telling the runner
the plan does not reach the target** — 26% of every comfortable plan
(607 `peak_shortfall_note`, 150 `long_run_shortfall_note`). The escape clause
did not cover them: **721 of the 751 were classified `optimal`**, and only 30
were `appropriate_for_persona`. The runner met both statements on one screen —
a reassuring label beside a sentence explaining the plan falls short.

**⚠️ WHAT THE BOARD REJECTED, RECORDED BECAUSE IT IS THE MORE TEMPTING FIX.**
The finding was submitted as *"the band never reads the training load — it is
silent on session duration and acute weekly spikes"*, with real numbers behind
it: `comfortable` plans have a longer median longest session than `demanding`
ones (132 min vs 97), 94% of them contain a week jumping more than 40%, and 279
give a runner with under six months of running a session over 150 minutes.
**That framing was ruled INCORRECT.** §44 point 3 — *"A friendly band may never
front a constrained or warned plan (Willy). The band is derived only from
pre-generation feasibility signals, never from plan-quality signals"* — is
Willy's own constraint, and reading the produced plan back into the band is
precisely what it forbids. The band does not read `duration_mins`, ramp rate or
age, and must not start.

**Why a shortfall flag is not the same thing.** A shortfall states whether the
plan met the target it was given. That is the same class of fact as prep-time
margin, which the band already reads, and it is decided by the target rather
than by the sessions. The band still never inspects a session.

**Note copy.** The shortfall arm is evaluated **last** in the ladder, so a plan
already demanding for a louder reason keeps that reason's note. The arm moves
only plans that would otherwise have read `comfortable`.

**Measured effect.** On the canonical cohort grid, `difficultyComfortablePct`
**54.5% → 22.7% (−31.8pp)**; `comfortable`-with-a-shortfall **751 → 0**. With
`difficulty_band`, `difficulty_note` and the two re-entry fields stripped,
`verify:parity` is **IDENTICAL across 5,940 cases** — no session, no volume and
no prescription changed. This is a labelling fix and nothing else.

**Config.** No new numeric. The arm reads existing shortfall flags; inventing a
constant to satisfy the three-artifact rule would be decorative config, which
this repo already gates against (`configConsumer.test.ts`).

**Enforced by** `INV-PLAN-DIFFICULTY-NEVER-FRONTS-UNSAFE` arm (3), **error** severity.

---

## 45. Long-run progression cap (universal, no phase exemption)

**Principle.** Long-run distance MUST NOT increase by more than +20% week-on-week OR +5km absolute, whichever is greater. The cap applies in ALL phases — base, build, peak, taper. There is no "specificity allows it" exemption.

The single permitted exception: a long run following a deload week may step back up to the pre-deload long-run distance (within +5%).

### Amendment 2 — the ABSOLUTE arm tapers on a small week (LR-ABS-CAP-LOWVOL-01, Coaching Board 2026-09-17)

**Principle.** The absolute arm of the cap is no longer a flat +5 km. The permitted
step is:

> `max( prevLongRun × LONG_RUN_PROGRESSION_CAP_PCT , min( LONG_RUN_PROGRESSION_CAP_ABS_KM , prevLongRun × LONG_RUN_ABS_STEP_MAX_PCT_OF_LR ) )`

The `+20%` arm and the deload step-back exception are unchanged.

⚠️ **Basis is the prior LONG RUN, not the prior week — and that is the board's rule
re-expressed, not a different one.** §9 sizes the build-phase long run at 30% of the
week, so **15% of the week IS 50% of the long run.** The board ruled on the weekly
basis; implementation found the week is *not stable* at the point §45 runs — the long
run is re-anchored (duration → distance) by later passes, so the producer and
`INV-PLAN-LR-PROGRESSION-CAP` read different weekly volumes and **disagreed on 140
plans, which threw**. `prevLongRun` is the value the `+20%` arm already reads, so the
two cannot drift. LR-CAP-BLIND-01 was one bug in two copies; this refuses to recreate
that shape.

**Why.** §9 sizes the long run itself as a share of weekly volume (base 28%, build
30%, peak 32%). The `+5 km` allowance was **the one part of long-run prescription
that ignored weekly volume entirely** — which, as Seiler put it at the sitting, is
usually the signature of a constant written once for a typical case and never
revisited. It is a sensible step on a 30 km long run (+17%) and a different training
stimulus arriving in a single week on a 6 km one (**+83%**).

**Why this number, specifically.** The first attempt at this was ruled INSUFFICIENT EVIDENCE
on 2026-09-16 — Hutchinson: *"a 33% ceiling is a number I made up."* The ruled value is
**half the long run's own build-phase share of the week under §9** — a single week's
STEP may not exceed half of what the long run is entitled to BE. Derived from the
constitution, not tuned to a chart. Expressed on the long run itself (§9's 30% build
share) that is **50%**. *(Honest caveat: build phase is a choice — base would give 14%
of the week, peak 16%.)*

**The measurement** (Willy's condition: scoped to the low-volume cohort — longest
recent run < 18 km AND current volume < 35 km/wk). 1,200 cohort plans / 5,586 steps,
against a 1,200-plan control of everyone else:

| | Cohort | Control |
|---|---|---|
| Steps legal **only** via the absolute arm | 29.2% | **37.8%** |
| Median jump | 33% | 26% |
| p90 jump | 52% | 33% |
| Max jump | **83%** | 45% |
| **≥ +40% in one week** | **32.5%** | **2.7%** |

⚠️ **Frequency was never the tell.** The absolute arm binds *more* often on ordinary
runners. **Magnitude is the tell, by twelve-fold** — and a measurement averaged over
the whole population would have shown nothing wrong, which is exactly why the board
refused to rule without the cohort scope.

⚠️ **Willy withdrew his own supporting argument on the data.** He had reasoned these
jumps might be tolerable where a recovery week follows. Measured: 61.9% of cohort
jumps have no down week after, against **73.0%** in the control — the cohort is
slightly *better* protected on that axis, not worse. The case rests on magnitude alone
and does not need the down-week argument.

**The cost, accepted explicitly.** Counterfactual regeneration over 1,149 comparable
plans: peak long run falls on **22.7%** (median −1.5 km, max −8.5 km); **18 plans
(1.6%) can no longer reach §24's specificity floor** and reclassify as
maintenance-grade against their time goal. They keep the honest
`volume_constraint_note` — McMillan's condition of approval, and the reason he did not
object. Worst in-plan jump **83% → 57%**; p90 53% → 46%; **median unmoved at 33%**;
**zero** plans newly refused.

⚠️ **This does not "fix long-run progression". 57% is still a large jump**, and the
median plan is untouched. It cuts the extreme tail and leaves the ordinary case alone,
which is the correct shape for a safety cap — but say what it does, not what we would
like it to do.

**Config.** `GENERATION_CONFIG.LONG_RUN_ABS_STEP_MAX_PCT_OF_LR` (50 — the board's 15%-of-week, re-expressed on §9's 30% build share).
Enforced by `INV-PLAN-LR-PROGRESSION-CAP` in both producer and checker — kept in step
deliberately, because LR-CAP-BLIND-01 was one bug in two copies and the checker could
not catch the producer while it shared the defect.

**Board:** 2026-09-17 — **CORRECT**, Hutchinson chairing. No dissent on correctness.
Ship timing was withheld by the board and escalated; **the founder elected to ship
immediately, the day before the charity showcase, with the blast radius above stated.**
Record: `docs/decisions/coaching-board-2026-09-17-lr-abs-cap.md`.

### Amendment 1 — a runner prescribed in MINUTES is not exempt from a distance rule

*Added 2026-09-16 (LR-CAP-BLIND-01). Found by the Coaching Board's cold re-review of a generated plan, not by any check.*

**This section says "universal, no phase exemption" in its own title, and it had
never once run on a beginner's plan.**

A session is anchored EITHER by distance OR by duration, and §79/§80 prescribe
**duration** to beginners and to every race at or above 50 km. Both the producer
(`applyLongRunProgressionCap`) and the checker (`INV-PLAN-LR-PROGRESSION-CAP`)
bailed out on `distance_km == null`. **One bug, two copies** — and the checker
could not catch the producer because it shared the defect. Both now read the
session's size through `sessionKm` / `sessionKmSelfPaced`, the single owner.

**What was shipping.** A 14-week first marathon, 3 days, 45-minute weekday
ceiling, under six months of running, longest run ever 9 km. The long run ran
7.3, 7.8, 8.7, 8.7, 9.7, 8.5 and then **26.0 km — a +206% single step to 2.9×
the runner's lifetime longest**, held for a second week at 76% of weekly volume.
**§45's own founding case was +185%**, so the engine was producing something
worse than the incident that caused this section to exist, for the cohort least
able to absorb it. Willy named the injury (tibial or metatarsal bone stress) and
the week it presents (ten or eleven).

**Scope, measured:** 2,271 breaches across **1,568 plans, 9.8% of the sweep** —
and not beginners only. Intermediate and experienced ultra runners were equally
unchecked, because the exemption followed the ANCHOR, not the ability.

**Sims, on the record:** a **presentation** decision (minutes rather than
kilometres, made for good reasons under §79/§80) silently exempted one cohort
from a **safety** cap. Presentation is not supposed to have physiological
consequences. This one did, for months, aimed at the population with the highest
baseline bone-stress-injury risk.

**Downstream, declared rather than discovered later.** Capping the spike removes
the lopsided weeks it was creating, so §52's maintenance trigger fires less
often: `maintenancePct` **49.3 → 48.4**, marathon **71.8 → 68.7**,
`constraintNotePct` **65.1 → 64.2**, mean delivered peak **38.74 → 38.44 km**,
`INV-PLAN-LR-MAX-WEEKLY-PCT` **9.3% → 8.8%**. **Fewer plans are downgraded to
maintenance because fewer plans are lopsided** — the spike was manufacturing the
constraint it was then declared under. The beginner charity marathoner in
`maintenanceLabel.test.ts` now BUILDS (18 → 43 km) where she used to be told the
plan holds her fitness.

**⚠️ One guard was found failing open and is recorded, not fixed here.**
`INV-PLAN-DELIVERED-RAMP` requires BOTH the whole week and its trimable portion
to breach, and returns early when the trimable portion did not rise. A long run
that grows violently SHRINKS the rest of the week, so the check is silent
**precisely on the most extreme cases**. It stayed silent on the 70% weekly rise
above. Two independent guards missed one plan for two different reasons; that is
what happens when guards are written against the common case.

**Why.** Case 04 (2026-04-28 review) showed a W5 long run of 10.5km jumping to a W6 long run of 30km — a +185% week-on-week increase, presented in peak phase. The structural justification ("peak demands specificity") is the failure mode: peak phase needs the specificity *because* the runner has been progressively built toward it, not as a substitute. Spike-then-recover is the most reliable injury vector in the audience this engine serves.

When the §24 floor (peak long-run race ratio) cannot be reached without violating this cap, this principle wins and the plan downgrades to `maintenance` with both a `volume_constraint_note` and a `long_run_constraint_note` — the same mechanism used in §23 / §38.

**Config.**
- `GENERATION_CONFIG.LONG_RUN_PROGRESSION_CAP_PCT = 20` — % week-on-week.
- `GENERATION_CONFIG.LONG_RUN_PROGRESSION_CAP_ABS_KM = 5` — absolute km, whichever is greater.
- `GENERATION_CONFIG.LONG_RUN_DELOAD_STEP_BACK_TOLERANCE_PCT = 5` — slack when stepping back up to pre-deload distance.

Enforced by `INV-PLAN-LR-PROGRESSION-CAP`. Engine-side: long-run distances are clamped during week-by-week assembly in `generateRulePlan` via `applyLongRunProgressionCap`.

> **⚠️ The bounceback exemption covers long-run STEP-BACKS, not just deloads — corrected 2026-08-20.**
>
> `applyLongRunStepBacks` deliberately cuts every Nth **build** long run, in a week that is **not** a deload. The cap's tolerance only recognised `prev.type === 'deload'`, so the week following a step-back was measured against the reduced distance and read as a spike.
>
> **Two defects, one cause.** The cap also ran *before* the step-backs, so it never saw the sequence the runner actually gets. **All 430 remaining sweep violations of §45 were that ordering.**
>
> **Reordering alone would have been worse than the bug.** Capping after the step-backs without extending the exemption clamps every bounceback and ratchets the long run permanently down — the same fatal arithmetic **D-21** records for volume deloads, where *"the first organic user's 14-week plan peaked in week 3, in the base phase."* Returning to a distance covered two weeks ago is not a spike: chronic load has not moved.
>
> Engine and invariant detect a step-back the **same structural way** — the previous week's long run is shorter than the one before it — rather than re-deriving the step-back cadence, so the two cannot drift apart.

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

### Amendment 1 — a duration-anchored plan steps back in MINUTES (PEAK-LR-STEPBACK-MINUTES-01, Coaching Board 2026-09-13)

**Principle.** The step-back is applied on the axis the plan is anchored on.
`PEAK_LR_STEPBACK_MAX_PCT` is the same numeric on both: 80% of the peak long
run's **distance** for a distance-anchored plan, 80% of its **duration** for a
duration-anchored one. A duration-anchored step-back keeps `distance_km` absent.

**Why.** §47 was gated on `distance_km` in **four** places on one path, and a
beginner's plan is duration-anchored (95.8% of their sessions carry
`duration_mins` with `distance_km` null, against 0% for intermediate and
experienced). Every gate read zero, so the entry guard `peakMaxLrKm <= 0` was
unconditionally true and the function returned before doing anything: **a
beginner never received a peak long-run step-back week at all.** Willy: the
pre-taper recovery value is real, and denying it purely because a runner's plan
speaks in minutes is the SESSION-KM silent-pass class, not a coaching choice.

**Minutes, not a conversion** (McMillan, Hutchinson). Converting to km would put
one week reading "14 km" into a plan that otherwise says "90 minutes", which
breaks the runner's model of their own plan. §80 already settled that a
duration-anchored session's prescription IS its time on feet. The minutes floor
is the existing `MIN_SESSION_DISTANCE_KM.long` converted through the runner's own
easy pace, so no new numeric enters.

**The previously filed fix was a measured no-op, and that is why this got its own
build.** Swapping the two `?? 0` sites for the owner produced ZERO differences
across two independent grids, because two further gates nobody had filed sat
*inside* the mutation and in §9's easy clamp. Reaching the alternation is not the
same as the alternation doing anything.

**Measured.** Duration-anchored peak long runs stepping back: **0% → 50%**, the
same rate distance-anchored plans already had. `verify:parity`: 180 of 5,832
cases changed, **beginner 180/1944, intermediate 0/1944, experienced 0/1944**;
`finish` 0, `time_target` 180; HM 108 and MARATHON 72, every other distance 0.
`cohort:shape` **byte-identical** — no runner is reclassified.

**Declared residual (§34).** `INV-PLAN-DELIVERED-RAMP` rises for beginners by
exactly one case on the 135-plan attribution grid (5 → 6; **warn**, never error;
every other code and cohort identical). A week that steps back to 80% and returns
is a larger week-on-week rise by construction — that is what a step-back IS, and
distance-anchored runners have always carried it. `INV-PLAN-BOUNCEBACK-BOUNDED`,
the injury-relevant guard, did not move.

**§52 stays inert, deliberately.** Board item (3): 0 breaches across 2,337
duration-anchored sessions in scope, so no producer change — §9's easy ceiling and
the long-run cap hold the ratio. The CHECKER is sighted
(`INV-PLAN-LR-MAX-WEEKLY-PCT` moved onto `sessionKmForCheck`), and a breach
appearing there is the signal to revisit. The site carries this note in-line so
it is not re-filed.

> ✅ **A sixth gate, found and CLOSED in the same commit.** The invariant's own
> `isPeakLevel()` read raw `lr.distance_km` and returned false for any
> duration-anchored session, so `INV-PLAN-PEAK-LR-ALTERNATION` could not see the
> cohort the producer now serves — the producer fixed, the checker still blind,
> the same split §52 had and the reason §52's floor had never surfaced a beginner
> violation. It now reads `sessionKmForCheck` like the threshold beside it
> already did.
>
> It was measured before being shipped rather than baselined: with the checker
> sighted over the previously-invisible sessions, **0 violations across 15,973
> plans**, and it stays wakeable in the liveness harness. Zero is the producer
> fix confirming itself from the other side — beginners now genuinely alternate.
> Had it been non-zero this would have shipped narrow and been filed, as §107 was.

**Why.** Case 04 (2026-04-28 review): W6 and W7 were both 30km MP-finish long runs back-to-back. For a 47-year-old returning runner with hip history, two consecutive 30km efforts at marathon-pace specificity is the highest-risk session pattern in the entire plan. Alternation gives connective tissue a window to consolidate the stimulus.

This principle composes with §25 (peak phase requires ≥1 long run with race-pace segments). When peak is 2 weeks, one of the two carries the peak long run and satisfies §25; the other is a step-back. That is acceptable.

**Config.**
- `GENERATION_CONFIG.PEAK_LR_ALTERNATION_THRESHOLD_PCT = 90` — % of peak long-run distance defining "peak-level".
- `GENERATION_CONFIG.PEAK_LR_STEPBACK_MAX_PCT = 80` — % of peak distance defining "step-back".

Enforced by `INV-PLAN-PEAK-LR-ALTERNATION`. Engine-side: in peak weeks, if the prior week was a peak long run, the engine substitutes a step-back long run (race-pace segments dropped, distance reduced to ≤80% of peak distance) unless the experienced-no-injury exception applies and has not yet been spent.

### Amendment 2 — a step-back is a VOLUME step-back, not only an intensity one (Coaching Board 2026-09-16)

*Filed from the test.test marathon review. Found by reading a generated plan, not by any check.*

**Principle.** When §47 steps a peak long run back, the WEEK it lands in must also **deliver less total volume than the week before it** — not merely a gentler long run on a week whose total keeps climbing. The step-back week trims its **easy** volume to at most `PEAK_STEPBACK_WEEK_MAX_PCT` of the preceding week, never touching the long run (§52/§90 protect it) and never falling below §52's long-run share or the min-session floor.

**Why.** §47 as written eased only the long run — dropped its race-pace segment and capped its distance — and stamped the note *"Step-back week. Easy aerobic — absorb last week's peak."* But `weekly_km` is set by the volume curve, which §47 never touched, so the delivered week kept climbing. Measured: **6,720 plans (22.5% of the cohort grid) delivered a step-back week BIGGER than the week before it** — the marathon test case ran 45 → 50 → 54 km, a "recovery" week 5 km heavier than the one it was recovering from, with a note that said the opposite. This is §90's exact principle (*"a week the runner is told is easier must DELIVER less — the curve is not the promise"*), which had simply never been applied to the §47 surface. It also makes the peak block's load ramp honest: the board's injury concern (Willy) was a five-week unbroken climb into the peak with only an intensity dip; a real volume down-week breaks the accumulation.

**Scope — non-injury runners.** An injury-history runner's delivered peak volume is owned by §90/§2's injury reconciliation (the injury-yield pass), which runs *after* this trim and reshapes the peak weeks — so layering a second volume trim on top would both race with it (the yield lowers a peak-level neighbour beneath the step-back after this pass has read it) and double-govern the same weeks. The `cohortGrid` measurement initially read this cohort as empty; the **property sweep, not cohortGrid, corrected it** — injury + experienced + `hard_session_relationship: 'love'` plans do reach a §47 step-back, and their peak is already suppressed by the injury caps. Willy's concern at the sitting was the HEALTHY build's five-week unbroken climb, which this addresses; the injury cohort's peak weeks stay under §90. Producer and checker share the scope. For healthy runners the delivered week-on-week rise is already unbounded (§90 enforces §2 at delivery for injury only), so the return-to-peak the week after a step-back is a planned bounceback, not a spike.

**The engine aims stricter than the invariant enforces.** It trims toward `PEAK_STEPBACK_WEEK_MAX_PCT` (90%) of the preceding week; the invariant enforces the honest floor (≤ the preceding week), so a week that can only be trimmed to the min-session floor — where the long run + one quality + floored easy runs still exceed the target — is an honest floor-limited residual, not a violation. Measured after the fix: **0 genuine violations across 29,808 plans**; 1,656 floor-limited step-backs (small plans where the irreducible sessions dominate) carry the honest residual.

**Config.**
- `GENERATION_CONFIG.PEAK_STEPBACK_WEEK_MAX_PCT = 90` — % of the preceding week the step-back week may deliver.

Enforced by `INV-PLAN-PEAK-STEPBACK-VOLUME`. Engine-side: `applyPeakStepBackVolume` runs after V1/V4 (which scale easy volume and long-run distance), keyed on the step-back note `applyPeakLongRunAlternation` stamps, so producer and checker read the same marker.

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

### Asymmetry — amended 2026-08-31 (HR-MAX-01, Coaching Board CORRECT WITH AMENDMENT)

**The 2026-08-06 guard was symmetric. That was the residual bug it half-fixed.**

**Principle.** A recorded heart rate is, by construction, a **lower bound** on the true maximum: the heart demonstrably reached that rate, so the max is *at least* that. A recorded value tells you nothing about the ceiling. The plausibility guard is therefore **asymmetric**:

- **Below the estimate** — a device-observed or unattributed max is a **floor** and is rejected outright (low-side tolerance = 0). Only an explicitly **user-confirmed** max (`max_hr_source: 'user_confirmed'`) is trusted below the estimate, because genuine low-max athletes exist and a value the runner typed carries their confirmation.
- **Above the estimate** — the rate must have physically occurred, so it is trusted up to `MAX_HR_PLAUSIBILITY_DEVIATION_PCT` above the estimate; beyond that it is a sensor artifact (double-counted beats, a stray spike) and is rejected.

**Why.** Founder case (2026-08-30): age 44, Apple-observed max **159**, Tanaka estimate **177**, true max **188**. 159 is only ~10% below 177, so the *symmetric* 15% guard accepted it and every HR target ran ~15% low — connecting Apple Health made the plan **worse**, the opposite of what new data should do. The symmetric band treated a lower bound as a two-sided estimate, which is a category error. The value arrived via `user_settings` with no provenance, so the fix must reject unattributed sub-estimate maxes too — the dominant source of them is exactly this device-floor laundering.

| Condition | Method | Behaviour |
|---|---|---|
| Supplied max **below** estimate, `observed` or unattributed | `age_estimate_max_floor` | **Use Tanaka.** Note explains a recorded max below the estimate is a floor; names the override path |
| Supplied max **below** estimate, `user_confirmed` | `karvonen` / `percent_of_max` | **Trust it.** The runner confirmed it |
| Supplied max **above** estimate by more than tolerance | `age_estimate_implausible_input` | **Use Tanaka.** Likely a sensor artifact |

**Provenance is best-effort but now has three states.** `max_hr_source` is `'observed'` when read from device history, `'user_confirmed'` when the runner typed it in Profile and saved, and absent when the value arrived via `user_settings` with no recorded provenance. Unattributed degrades to the *device* path (rejected below the estimate) — not the trusted path — because we cannot distinguish a laundered device floor from a hand-typed value, and the asymmetry errs toward the estimate. A legacy hand-typed sub-estimate value self-heals: it falls back to Tanaka with a note, and re-saving in Profile re-tags it `user_confirmed`.

**This composes with §78.** The recalibration time trial is what replaces an estimate with a measurement. Tanaka is a stopgap that gets corrected every four weeks, not a permanent answer.

**Config.** `GENERATION_CONFIG.MAX_HR_PLAUSIBILITY_DEVIATION_PCT = 15` (upper tolerance); `GENERATION_CONFIG.MAX_HR_BELOW_ESTIMATE_TOLERANCE_PCT = 0` (lower tolerance for device/unattributed maxes).

**Invariant.** `INV-PLAN-MAX-HR-NOT-BELOW-ESTIMATE-FLOOR` — no plan may rest on a device-observed or unattributed max HR below its own age-estimated max (`hr_derived_max ≥ hr_estimated_max`, unless `hr_max_source = user_confirmed`).

Plan meta MUST include:
- `hr_zone_method` — which method was used (`karvonen` / `karvonen_estimated_max` / `percent_of_max` / `percent_of_estimated_max` / `observed_max` / `age_estimate_implausible_input` / `age_estimate_max_floor`).
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

**Wired 2026-09-02 (defect fix — this paragraph was already the documented intent; the engine was not doing it).** The engine built the lopsided week anyway and let the invariant fire, which reported the *runner's* plan as defective for a constraint the *engine* had chosen. It now detects a lopsided non-deload week at generation and takes remedy (c). **When it fires:** the long run is race-anchored (§45/§47 floors) while the week is runner-anchored (§2 ramp off current volume); at low volume the two diverge until the week is lopsided by construction — a 5 km/week runner building to a half marathon reaches a 14.5 km long run on a 24 km week (60.4%). Remedy (a) is unavailable there because reducing the long run collides with §45/§47's floors, so (c) is the remedy that needs no new ruling. Carries its own runner-facing note: the race sets the long run, your current volume sets everything else — the lever is weekly volume, not a longer long run. Measured cost: maintenance classification +1.9pp (6 of 315 plans). Sweep baseline for this invariant went 59 → **0**, clearing 35 violations that pre-dated the fix.

### Amendment 1 — a safety cap is never exempted, only downgraded — added 2026-09-13 (Coaching Board, MAINT-EXEMPT-SCOPE-01)

**Principle.** §52's cap is evaluated on **every** plan. A `maintenance`
classification may lower its SEVERITY; it may not switch the check off.

**Why.** The check opened `if (plan.meta.volume_profile !== 'maintenance')`, on
the stated grounds that *"the constraint is already surfaced in
volume_constraint_note"*. That justification does not survive reading: the note
explains why **total** volume is low and says nothing about **lopsidedness**. A
safety check was disabled because something else was believed to report it, and
that something else does not report it.

**51% of the cohort classifies maintenance**, so the cap went unchecked on half of
all plans. Measured 2026-09-13 with the exemption removed: **268 of 6,588 weeks
breach, every one of them in a maintenance plan and none in a build plan** — 60 of
314 maintenance plans carry at least one. The worst is a **beginner marathon plan
with a 26.0 km long run in a 34 km week: 76%** of the week's running in a single
session.

Willy (lead): the tissue does not care that the plan is labelled maintenance, and
one session carrying three-quarters of the week's load is **more** dangerous at
low volume, not less. McMillan: a beginner on a marathon plan is exactly who the
cap exists for. Sims: the low-volume beginner skews to the under-fuelled end, and
one enormous session in an otherwise small week is the worst shape for that.

**Config.** No new numeric. `LONG_RUN_MAX_PCT_OF_WEEKLY` unchanged.

**Severity, and why it is not an error.** `warn` for maintenance, `error` for
build. Making it a hard error would stop 60 plans generating, and the runner's
volume constraint is real — they cannot simply be told to run more. §34's
honest-residual pattern, the same one `INV-PLAN-DELIVERED-RAMP` and
`INV-PLAN-DELOAD-IS-A-REDUCTION` already use. **Visible, counted and declared
beats silent.**

**Declared rate.** `INV-PLAN-LR-MAX-WEEKLY-PCT` now reports **8.6% (1368/15973)**
in the sweep, where it previously reported nothing at all because it never ran for
those plans. Zero errors — no build plan breaches.

> ⚠️ **The general lesson, recorded because it generalises past §52.** Four other
> invariants are gated on `volume_profile !== 'maintenance'`:
> `INV-PLAN-PEAK-LR-RACE-RATIO` (§24), `INV-PLAN-PEAK-OVER-BASE` (§23),
> `INV-PLAN-PEAK-VOLUME-FLOOR-LONG-RACES` (§46) and
> `INV-PLAN-NO-PLACEHOLDER-COPY`. The first three are **legitimately** exempt: a
> plan classified maintenance *because* it failed those floors would be
> re-asserting the same failure as an error, and the classifier already records it
> in the note. The test is whether the exemption is CIRCULAR (fine) or merely
> CONVENIENT (not). §52's was convenient.

---
### RECORDED FINDING — the long run is not the lever, and the share cannot be driven to 60% by shortening it (2026-09-19, S52-LOPSIDED-BOUND-01)

**No prescription change. This records a measurement and closes an open item, so
the next person does not attempt an eleventh instrument.**

§114 sizes the long run against the week at construction. The obvious follow-up
was a post-pass re-applying the same bound against the FINISHED week, because the
week keeps shrinking after construction (V1 scales non-quality sessions, V4
mutates long-run distances, the weekday cap trims easy runs). It was built, placed
correctly on the third attempt (after V1/V4/§47 Am.2/§6 Am.2, the ordering both
neighbouring passes already document), measured, and **reverted**.

**Why it cannot work, in one line of arithmetic.** Shortening the long run also
shortens the week, so the share is a fixed point, not a target. For a three-day
runner with a 30-minute weekday cap the week is `lr + 7.2 km`, so

    share = lr / (lr + 7.2)  ≤  0.60   ⟺   lr ≤ 10.8 km

A marathon long run of 10.8 km is not a plan. The bound converged where it was
harmless and stalled where it mattered: worst share 78% → 72%, affected plans
287 → 280 of 899 — while the **injury cohort's median marathon peak long run fell
from 61.6% to 52.1% of race distance**, roughly 4 km off the longest run a
knee-history runner ever does before the start line. That is the exact regression
`measure:fitness` was built to catch on 2026-09-17, bought for a 6-plan
improvement on a proxy.

**So the remedy list in the principle above is ordered correctly and (a) is last
for a reason.** At three days with a 30-minute cap, (b) is unavailable (the cap is
the runner's own constraint) and (a) destroys the race. (c) is what fires, §52
warns, and `lopsidedNote` already tells the runner the truth: *the lever is the
other days: more running across the week, not a longer long run.*

⚠️ **Do not re-propose a share-based post-pass.** Ten instruments have now been
tried against this number; this is the eleventh and the first whose failure is
arithmetic rather than ordering. The residual is declared under §34 and is
honest: a runner who gives the plan three days and thirty minutes gets a lopsided
week, and the plan says so.



## 53. Quality session variety across the full plan

**Principle.** No single quality-session **catalogue row** may appear more than the variety cap across the full plan. Extends §36 (taper variety) to the base / build / peak phases as well.

**The cap is `max(fraction, pigeonhole)` — amended 2026-09-02 (Coaching Board, CORRECT).**
- *fraction* = `floor(total_quality_sessions / 3) + 1` — the original rule, and still the FLOOR, so wherever the catalogue offers variety this is exactly as binding as it always was.
- *pigeonhole* = the smallest max-count any arrangement could achieve given the pool the engine actually had. With `k` picks drawn from a pool of `p` eligible rows, some row must appear at least `ceil(k/p)` times.

**Why the amendment.** The fraction alone was arithmetically unsatisfiable on a thin pool, and **D-21 holds that a principle no plan can satisfy is a defect in the principle, not in the plan.** Worked case: a finish-goal marathon at 12 km/week is threshold-only, and of the five threshold rows `tempo_cruise_short` is 5K/10K-only while `threshold_ladder` requires `min_weekly_km` 45 — leaving 3 rows in build and 2 in peak/taper (`tempo_cruise` is build-only). Eleven quality sessions against that pool cannot be spread below 5, while the fraction demanded 4. The engine was doing the best available and being reported as defective for it.

**Pool size is measured from the ENGINE's eligibility, never from the rows the plan used** (`meta.quality_pool_sizes`, one entry per pick) — inferring it from what was used would let a lazy rotation excuse its own repetition. Per-pick rather than a plan-level union, because the pool varies by phase and a union hides the binding constraint.

**Why.** Case 04 (2026-04-28 review): three "Progressive tempo" sessions in 11 weeks (W5, W8, W10) with identical pace targets. Round-2 M-02 caught back-to-back taper repetition; this caught nothing because the repetition straddled build / peak / taper. Variety at the catalogue level is what keeps a plan coachable for the runner who actually has to do it — three identical tempos in the same plan is the engine declining to use the catalogue, not a coaching choice.

**Counts the ROW, not the label (Coaching Board 2026-08-21, CAT-ULTRA-THIN-01).** Variety is a property of the training, which is the catalogue row (`catalogue_id`), not the display string — and §22's goal-pace rename deliberately makes label ≠ row, so a label count both under-counts (one row split across names) and mis-counts (two rows sharing a name). This aligns §53 with its own sibling §36, which already keys on the row.

**A violation means the engine declined AVAILABLE variety — not that the catalogue is thin.** The board ruled the cap stays `floor(N/3)+1`; the fix for over-use is the engine, not a looser rule:
- **Rotation.** `selectCatalogueSession` picks the least-used eligible row and breaks ties against the previous pick of that category, so the eligible pool is exhausted before any row repeats (this also serves §36). The old stateless `weekN % pool` was a hash, not a rotation, and landed one row five times while an eligible sibling sat unused.
- **Pool width where it was genuinely too thin.** An intermediate marathon/ultra runner had only two eligible threshold rows in peak/taper. `threshold_ladder` is now gated on **weekly volume** (`THRESHOLD_LADDER_MIN_WEEKLY_KM`, Willy's load floor) rather than an `experienced` label that was only ever a proxy for volume — giving that runner a third row on its own coaching merit. A relative, per-runner floor (T-work as a share of weekly minutes — Sims) is the tracked refinement.

> **Ruled INSUFFICIENT EVIDENCE, then resolved — Coaching Board, 2026-09-03, CORRECT WITH AMENDMENT.** First sitting measured (5,000-plan sample): 49,551 week-rows sit below the flat 45km/week gate, and among them threshold-category work reaches as much as 36.3% of that week's total training minutes — a genuinely threshold-committed runner can still be denied the ladder purely on total volume. Asked for two follow-ups: does lowering the flat number work, and a concrete second-path proposal.
>
> **McMillan's ask, measured: lowering the number does not work.** "Committed" = threshold-category work >= 20% of a week's training minutes (13,518 committed week-rows in a 68,232-row sample). At the current 45km floor, 61.5% of committed weeks are STILL denied — the majority, not a tail. Lowering the floor to 25km still denies 4.6%, while 79.2% of newly-admitted weeks at that floor have NO threshold commitment at all. A flat number is a blunt instrument: closing the gap requires dropping it so far it admits huge numbers of unrelated runners.
>
> **Second path, resolved.** `THRESHOLD_LADDER_MIN_WEEKLY_KM` (45) OR: the runner has placed a threshold-category quality session in >= `THRESHOLD_LADDER_ALT_MIN_HITS` (2) of the previous `THRESHOLD_LADDER_ALT_LOOKBACK_WEEKS` (3) weeks of THIS plan, AND this week's volume hasn't dropped more than `THRESHOLD_LADDER_ALT_STABILITY_PCT` (20%) below that window's peak. Architecturally sound because weeks build in a single sequential forward pass — by the time week N's eligibility is checked, weeks 1..N-1 are already finalised, so this is a genuinely prior signal, never same-week circular. A first-time-ever threshold session still requires the volume floor; only a runner who has ALREADY demonstrated repeated exposure gets the alternate path — which is Willy's own standard (tissue readiness through repetition), operationalised, not claimed through one week's arithmetic (which is what Sims objected to).
>
> **"2 of 3" is a defensible default, not a measured optimum (Hutchinson) — stated honestly.** No literature is cited behind that specific window; it is a reasonable operational choice, and pretending otherwise would be worse than saying so.
>
> **Recorded, not resolved: Seiler's concentration concern.** A runner already clearing 20%+ threshold share at low volume is, by Seiler's own recreational-athlete finding, exactly the population that drifts toward "everything feels like threshold." Handing that runner access to one of the catalogue's longer threshold sessions could reinforce that pattern rather than correct it. Not a reason to withhold this specific access fix — a different, larger question about the catalogue's threshold-heaviness generally, left open for a future sitting.
>
> **Willy/Sims resolved the disagreement together, not by the chair.** Willy wanted a safety rail against a runner whose overall volume is declining while frequency alone still counts; Sims did not want that rail to become a volume floor by the back door. Both agreed a LIGHT collapse guard (not a minimum) would satisfy them — the stability check above is that guard: it says nothing about how low volume can be, only that it cannot be actively falling apart mid-window.
>
> **Mechanically checked at the point of decision, not post-hoc — and here's why not the latter.** A first attempt tried re-deriving eligibility from the FINISHED plan and immediately false-positived: the flat-floor check runs against the week's PRE-CAP TARGET volume at generation time, but a finished plan's stored `weekly_km` is POST-CAP ACTUAL volume — a weekday-cap-heavy scenario can legitimately target 48km/week (clearing the floor) and still deliver 32km once every other session is capped down, since `threshold_ladder` is itself structure-exempt from the weekday cap (§81) while the rest of the week shrinks around it. This is a pre-existing property of how target vs. delivered volume are threaded through the engine, unrelated to this ruling — re-deriving against the wrong volume produced a false violation on an entirely correct plan. Direct unit tests on `selectCatalogueSession` (`thresholdLadderAltPath.test.ts`) cover the OR-gate instead, falsification-tested.

The `floor(N / 3) + 1` shape:
- 3 quality sessions: max 2 of any row.
- 6 quality sessions: max 3.
- 9 quality sessions: max 4.
- 12 quality sessions: max 5.

The +1 allowance prevents tripping plans where the catalogue genuinely has only one good fit for a phase (e.g. HM peak quality is `hm_pace_intervals` per the catalogue — appearing 2-3 times in a 13-week plan is correct, not a defect).

**Config.**
- `GENERATION_CONFIG.QUALITY_VARIETY_DENOMINATOR = 3`
- `GENERATION_CONFIG.QUALITY_VARIETY_ALLOWANCE = 1`
- `GENERATION_CONFIG.THRESHOLD_LADDER_MIN_WEEKLY_KM = 45` (the ladder's volume gate)

Enforced by `INV-PLAN-QUALITY-VARIETY-FULL-PLAN` (cap = `max(fraction, pigeonhole)`, see above). Race-week sharpening reps (sub-band repeats with no catalogue-named label) are exempt — they're structurally distinct from the broader catalogue.

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
| > 28 days | Offer the runner a choice: **Start Now** (no block — see the correction below) / **Add Foundation Block** (auto-generated, plan_start unchanged) / **Skip** (dismiss, re-surface if user revisits wizard). |

> ⚠️ **"Start Now" DOES NOT mean `plan_start = today`, and it never could — corrected 2026-09-15 under D-21 (FOUNDATION-LONG-RUNWAY-01, Coaching Board).**
> This row read *"Start Now (plan_start = today, no block)"* for months. §76 anchors
> the plan backwards from race day and `calcPlanLength` sets
> `planStart = addDays(raceWeekStart, -(totalWeeks - 1) * 7)`, so whenever the
> calendar holds more weeks than §17's bound for the distance, **§76 forbids the
> behaviour §57 promised.** Measured on a 25-week marathon runway, `start_now` and
> `skip` produce byte-identical plans: `plan_start` 2026-11-09, 49 idle days. The
> value is read in exactly one place — `plannedFoundationWeeks`, where it falls
> through as "not add".
>
> D-21 says a principle that cannot be satisfied is a defect in the **principle**.
> The option is therefore *"start without a foundation block"*, which is what it
> has always done and is a real choice (a runner who would rather keep their own
> routine than be handed three prescribed easy weeks). It is **not** an offer to
> move the plan forward, and must never be presented as one.



### Volume rules

- **Effective baseline** = `fresh_return_active ? stated_current_weekly_km × 0.70 : stated_current_weekly_km`
- Week 1 of the Foundation Block starts at effective baseline (never above it).
- Subsequent foundation weeks may increase by a maximum of **+10% per week** (hard cap).
- The final foundation week must not exceed effective baseline × 1.10 regardless of block length.
- Long run cap per foundation week: the lesser of `longest_recent_run_km` and **35%** of that week's weekly volume (`GENERATION_CONFIG.FOUNDATION_LONG_RUN_MAX_PCT`).
- These caps are enforced by `INV-PLAN-FOUNDATION-BLOCK`.

**Why the long run is capped at 35%, not 50% (Coaching Board, Coaching-1).** The foundation block previously permitted a long run up to 50% of the week's volume — but §9 states that a long run exceeding **35% of weekly volume is a binge**, fatigue accumulating faster than aerobic gain. Foundation is *pre-base*; it should be no more aggressive on long-run fraction than base phase (28%), not nearly double it. The concern is sharpest for this block's primary population — fresh-return and novice runners, whose musculoskeletal and bone readiness lags their cardiovascular readiness (Willy, Sims). A long run at half of a deliberately reduced (0.70×) fresh-return week is a within-week load spike into exactly that gap. Consecutive easy days at controlled low volume were reviewed and ruled **correct** — no session-spacing rule is added (a distribution rule over an all-easy, low-volume block is a rule the runner must understand for no demonstrated benefit; §5's low-session-count logic applies). The absolute `longest_recent_run_km` guard remains, so the long run stays bounded by recent experience; the 35% cap only stops it dominating the week.

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

### What a foundation block is FOR (Coaching Board CB-1, 2026-09-03)

A foundation block's job is **habit and routine, not adaptation** (Sims). At the
volumes it runs at — a fresh-return runner on 8 km/week gets an effective baseline
of 5.6 km — it is not producing meaningful aerobic adaptation or bone loading, and
it must never be described as if it were. This is recorded so no future reader
mistakes it for a training stimulus and starts "optimising" it upward.

### Sizing: reduce DAYS, never shrink sessions (CB-1)

When the week's volume cannot fill the days the runner offered, the answer is
**fewer days**, not smaller sessions. Two days of 4 km is a training week; three
days of 2.7 km is fidgeting (McMillan). Consolidation also matters on load:
sub-3 km jogs deliver essentially no mechanical stimulus while still costing three
sessions of adherence (Willy). This mirrors §52b/INPUT-FLOOR-01, which already
applies the same rule to main weeks.

Every foundation session is therefore at or above `MIN_SESSION_DISTANCE_KM.easy`,
and the day count is `min(days_available, floor(weekly_km / that floor))`.

### A foundation week below four sessions has NO long run (CB-1)

**Derived, not chosen.** With the long run capped at `FOUNDATION_LONG_RUN_MAX_PCT`
(35%) and §9 requiring long ≥ `LONG_RUN_MIN_RATIO_VS_EASY` (1.25) × easy, the
remaining (n−1) easy runs share 65% of the week:

| sessions | long | each easy | ratio | §9 satisfied? |
|---|---|---|---|---|
| 2 | 35% | 65.0% | 0.54 | ✗ |
| 3 | 35% | 32.5% | 1.08 | ✗ |
| **4** | 35% | 21.7% | **1.62** | ✓ |

Below four sessions an inverted week is **arithmetically forced** by two numbers
this board itself set — the shortest run of the week ends up labelled "Long easy".
Measured before the fix: 49,974 `INV-PLAN-LONG-IS-LONGEST` violations across
24,219 foundation weeks, alongside 36,585 `INV-PLAN-MIN-SESSION-SIZE` and 13,428
`INV-PLAN-FOUNDATION-BLOCK`.

The board's ruling — *the inverted week is a defect at any volume* — leaves one
honest object: **equal easy runs, and no session claiming to be a long run.** The
threshold is `GENERATION_CONFIG.FOUNDATION_MIN_SESSIONS_FOR_LONG_RUN`. The same
applies when `longest_recent_run_km` caps the long run below the easy runs.

The long run, when there is one, is stamped `role: 'long_run'` at construction
(INV-CLASS-002). It was previously identified only by the word "Long" in its
label — the exact display-coupling INV-CLASS-001 forbids.

### Invariants

Foundation weeks are validated like any other week. The complete ruling
(Coaching Board CB-1, 2026-09-03):

| Invariant | Foundation weeks | Basis |
|---|---|---|
| `INV-PLAN-NO-SESSIONS-ON-BLOCKED-DAYS` | **BINDS** | §18 life-first has no phase exemption |
| `INV-PLAN-MAX-WEEKDAY-MINS` | **BINDS** | §18 (long run exempt per §81) |
| `INV-PLAN-WEEK-HAS-REST-DAY` | **BINDS** | §64 |
| `INV-PLAN-MIN-SESSION-SIZE` | **BINDS** | §9 — conditional on the day-fitting rule above |
| `INV-PLAN-LONG-IS-LONGEST` | **BINDS** | §9 |
| `INV-PLAN-FOUNDATION-BLOCK` | **BINDS** | It is the foundation invariant |
| `INV-PLAN-LR-MAX-WEEKLY-PCT` | **BINDS above 2 runs** | §5 — a fraction of the week is undefined at 1–2 sessions; a week that fits one run has a largest session at 100% by construction, which is SMALL, not lopsided. Same threshold the `INV-PLAN-FOUNDATION-BLOCK` long-run arm already used |
| `INV-PLAN-INTENSITY-DISTRIBUTION` | **CARVED OUT** | §1 is undefined over an all-easy block — no intensity to distribute. Same reasoning as CD-21's maintenance carve-out (Seiler) |
| `INV-PLAN-QUALITY-EXPECTED` | **CARVED OUT** | §57 — foundation is easy-only by definition |
| `INV-PLAN-PEAK-OVER-BASE` | **CARVED OUT** | Foundation is not in the periodisation arc |
| `INV-PLAN-LR-PROGRESSION-CAP` | **CARVED OUT** | Same |
| `INV-PLAN-COPY-MATCHES-SESSIONS` | **CARVED OUT** | Same |

**Why this ruling was needed at all:** foundation weeks were generated
client-side and prepended after the plan left the server, so `validatePlan()`
never saw them and `INV-PLAN-FOUNDATION-BLOCK` — ratified by this board in
Coaching-1 — had never once run in production. See ADR-020.

---

---

### Amendment — the weeks the plan does NOT cover must be declared (FOUNDATION-LONG-RUNWAY-01, Coaching Board 2026-09-15)

**Principle.** When more than `FOUNDATION_UNCOVERED_WEEKS_NOTE_THRESHOLD` whole
weeks sit between today and the first week the plan covers — after the foundation
block has taken what it can — the plan MUST carry
`meta.uncovered_runway_note` saying so.

**Why.** §76 says a runner left with an uncoached void *"will fill it by guessing"*,
and asserts that *"the gap before it is already owned by the foundation block,
which exists for exactly this situation."* **It is not.** `FOUNDATION_MAX_WEEKS` is
3, so measured on M1 (first-time marathon, 15 km/wk, `training_age: '<6mo'`):

| runway | gap | foundation | main | covered | **uncovered** |
|---|---|---|---|---|---|
| 20w | 14d | 2 | 18 | 20 | 0 |
| 22w | 28d | 3 | 18 | 21 | 1 |
| **25w** | **49d** | **3** | **18** | **21** | **4** |
| 30w | 84d | 3 | 18 | 21 | 9 |
| 40w | 154d | 3 | 18 | 21 | 19 |
| 52w | 238d | 3 | 18 | 21 | 31 |

A charity runner typically gets their place months out, so **a long runway is the
NORMAL case for this cohort**, not an edge case. At 25 weeks they open the app on
21 September and the first dated thing on their plan is 18 October.

**The filed remedy was VETOED on measurement.** Raising `FOUNDATION_MAX_WEEKS`
fails because §57's own ceiling — *"the final foundation week must not exceed
effective baseline × 1.10 regardless of block length"* — binds from week 2. A
forced 12-week block delivers **15.0 then 16.4 eleven times**. Nine identical weeks
is not preparation, and CB-1 already ruled the block is *"habit and routine, not
adaptation"* (Sims). Raising the ×1.10 ceiling instead would convert the block into
a base phase, which CB-1 ruled it is not.

**So the void is real and, for now, structural — which makes the obligation
honesty, not coverage.** Every other structural limit in this engine already pairs
with one: §23's maintenance note, §34's residual, §40c's shortfall note, §52's note,
ADR-022. The pre-plan gap had none, on a plan that was simultaneously carrying a
`volume_constraint_note` and a `long_run_shortfall_note`.

**Sims's binding point, recorded because it is the reason this is `error` and not
`warn`:** a runner in that gap **is not resting, they are training unsupervised**,
and for the women in this cohort unsupervised ramping into a first marathon is
exactly where energy availability and bone loading go wrong. We will never see it.
Silence is not neutral.

**The note may not oversell the gap.** It says how many weeks, why they sit before
the plan rather than inside it, and to keep running easy without ramping. It does
**not** call them preparation — copy that oversold unsupervised weeks would be
worse than the silence it replaces.

> **Willy, dissenting on the remedy while agreeing on the finding:** a `<6mo`
> training age is the widest cardiovascular-to-musculoskeletal gap we ever see, and
> those weeks are the cheapest tissue-adaptation weeks available. Spending them
> idle and then compressing the same preparation into 18 weeks is the **worse**
> injury path. He will not sign a longer foundation block — flat 16.4 km loads
> nothing — but he holds that the weeks should be **trained**, not merely declared.

> ✅ **RESOLVED 2026-09-16 — the runway now DOES earn a longer plan (McMillan/Willy).**
> This paragraph recorded a deferral: §97 (CB-ONSET-03) had already ruled this exact
> trade-off — *"'delay the start' does not create rest; it creates training that sits
> outside the periodisation arc and is carved out of five invariants"* — and raised the
> cap to §17's `max_weeks`, **but only for a §89-gated runner**, while M1 is the precise
> opposite of gated and needs it more. Hutchinson held it back on 2026-09-15 because
> plan length is the widest blast radius this engine has and §6 Amendment 2 had already
> moved 18.5% of parity that day, two days before a showcase.
>
> It was taken to its own sitting on 2026-09-16 with parity, `cohort:shape` and a
> deload-cadence check measured first, and carried as **§97's Amendment** (see §97).
> M1 at a 25-week runway now gets **20 main weeks of an available 20**, and the weeks
> this section declares as uncovered fall **4 → 2**. Willy's condition that `base_pct`
> stay untouched is binding and met; Sims's condition on deload cadence at the longer
> lengths was discharged by measurement.
>
> **The honesty obligation below is unchanged and still binds.** The extension closes
> at most two weeks; at a 30-week runway 7 remain uncovered and at 52 weeks, 29. The
> note is not superseded by the longer plan — it is what covers the part no plan length
> can reach.

**Config.** `GENERATION_CONFIG.FOUNDATION_UNCOVERED_WEEKS_NOTE_THRESHOLD = 2` —
one week before a plan starts is a rest-and-admin week and a note about it is noise
(NOISE-GATE-01); the <7-day case already has §57's inline nudge.

**Stamped, not recomputed.** `meta.uncovered_runway_weeks` carries the count
because it needs `today` and the built block together, and `today` is
generation-time state `validatePlan` never receives — the same reasoning
VOL-SHORTFALL-01 records for `volume_shortfall_pct`. Produced in
`composePlanWithFoundation`, ADR-020's single owner of both facts.

Enforced by `INV-PLAN-UNCOVERED-RUNWAY-DECLARED` (`error`).

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

## 103. Fitness signal — benchmark recalibration prompt (ENGINE-01)

*(Renumbered 2026-09-11 — this section shared its number with another. Code and cross-references cited the OTHER one, so that kept the number and this took a fresh one. See the duplicate-number guard in `principlesIntegrity.test.ts`.)*

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

**Amendment 1 — the shortfall is measured on the AXIS THE SESSION IS ANCHORED ON (Coaching Board 2026-09-14, LR-SHORTFALL-DURATION-01).**

The third bullet above used to read *"duration-primary long runs are out of scope (no distance to fall short of)"*. That sentence was true and **incomplete**. §80 — written later — established that for a duration-anchored runner the prescription **is** their time on feet. There is something to fall short of; this section simply predated the axis.

**What the exclusion cost, measured on the 621-plan cohort grid:** 2,547 of 7,965 long runs (**32.0%**) were dropped before the trigger saw them, and it was **completely dead on 153 of 621 plans (24.6%)**, with 54 more (8.7%) mixed — which is worse in kind, because a dropped middle long run lets the "consecutive weeks" window silently compare non-adjacent ones. A **second gate** in the same function (`if (isLongRun(s) && s.distance_km)`) meant even a firing trigger would have shown a confirmation tile promising a trim that changed nothing. After: **100% of long runs comparable, 0% of plans with a dead trigger.**

> ⚠️ **The obvious fix was rejected, and the reason is the whole ruling.** `sessionKmSelfPaced` (SESSION-KM-01's ratified owner) recovers a kilometre figure for **100%** of the dropped sessions — every one carries its own pace band. It must not be used here. §80 expects walk breaks on precisely this cohort and holds that *"time on feet accumulates whether or not every step is running"*, so a first-timer who completes the full prescribed 90 minutes **with the walk breaks the plan told them to take** covers less ground than the band implies. A derived-km comparison would report them short against a number that never appeared in their plan, and reduce their long run for doing the session exactly right. §80's own words: *"a floor the runner believes they have failed is worse than no floor."* **A recovered number is not automatically the right number.**

**Moving time, not elapsed (Willy, binding condition — resolved rather than deferred).** `actual_load_mins` comes from `strava_activities.moving_time_s`, and that is correct *because* walking registers as movement: a walk break does not under-count the session. Only a full stop does, and a runner standing still is not on their feet. Verified available on **100% of production activity rows** across both sources (69 Apple Health, 21 Strava).

**Parity of the threshold is a DEFAULT, not a finding (McMillan, recorded).** `LONG_RUN_SHORTFALL_COMPLETION_PCT` (82%) governs both axes and **no second constant was added**. A distance shortfall can mean "ran out of road"; a time shortfall means "stopped" — arguably a stronger signal. There is no evidence for a different number, and a second constant is a second thing to tune. If evidence ever arrives, this is the sentence to revisit.

**Distance still wins where the session carried one.** A row comparable on both axes is judged on distance, because distance is what that session prescribed. A fast runner covering 95% of the distance in 60% of the time is not short.

**The trim follows the axis too.** A duration-anchored long run is trimmed in **minutes** and never gains a `distance_km` — the same rule PEAK-LR-STEPBACK-MINUTES-01 applies to §47's step-back. Writing a kilometre figure onto a duration-anchored session converts the runner's plan to an axis it has never spoken in. §66's voice rule is unchanged on both axes: *"build it back when it feels right"*, never "you keep failing to finish."

**Sims, non-blocking, recorded:** this cohort is disproportionately first-timers on charity places, and a first-timer stopping at 55 of 90 minutes is often under-fuelled rather than at a tissue ceiling. The reduction treats the symptom. It is still the right response — the absence of any response is not neutral — but the note must not imply the runner's ceiling is fixed, which §66's existing voice rule already handles.

**Scale, stated honestly.** Production at the time of ruling: 137 analyses, 2 users, 12 rows with `planned_load_km` null. Near-zero live impact. The cohort this was dead for is beginners and first-timers — exactly what the Make-A-Wish referral channel will deliver. **A fix-before-acquisition, not a live incident.** Existing rows are not backfilled (live-plan policy); every consumer tolerates null on both axes.

**Config.** No new numeric. New columns `run_analysis.planned_load_mins` / `actual_load_mins` (migration `20260914_run_analysis_load_mins.sql`), written on every analysis by both analyse-run paths. Enforced by `INV-PLAN-LONG-RUN-HAS-AN-AXIS` (the plan-side precondition) plus `planAdjustment.test.ts` (the trigger itself is runtime, not a plan property — see below).

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
- Phase 1: flat, factual. One sentence. No race reference after week 2. No forward goal language. DNF register: most restrained in the product — zero pressure, zero forward-looking framing. **Engine copy:** `The body doesn't know what it didn't finish. Recover anyway.`
- Phase 2: quiet and settled. *"Back to base."* Nothing to prove. No celebration of what was.
- No "great job" framing anywhere in the block. The race happened. This is what comes after.

**A standalone plan, not an appended chapter (MAINT-06, ADR-013).** Maintenance is its OWN plan object. When the race completes, the race plan **ends and moves to history** (`plan_archive`, via `savePlanForUser`'s race-change guard) and a standalone maintenance plan (`meta.plan_kind='maintenance'`) becomes the sole active plan. A finished race must never read as the "active plan" — running it *closed* that plan; the maintenance block is a distinct, low-stakes cycle with no goal event. `week_n` continues the sequence (26+) so completions/analysis never collide with the archived race plan (no migration; the app keys by `week.n`).

**Surfacing — announce, never gate (MAINT-04).** The maintenance plan is auto-live; the runner never *approves* it (an accept/decline gate would hand an overtrained runner a way to decline their own recovery — SLT-rejected). But it must not appear silently: a one-time Today announcement marks the race done, explains in one sentence why the plan eased, and shows the shape (days/week · weeks · below base). Its affordance is "See the plan", not accept/decline — editable, not approvable. Seen state lives on `meta.maintenance_transition_seen` (on the maintenance plan). Rule-engine copy carries no AIMark; the PAID weekly debrief does.

**Phase 3 — re-engagement (MAINT-07).** The final `PHASE3_LAST_WEEKS` (2) weeks of Phase 2 are the block's closing register. **Training does not change at all** — same volume, same one-mild-quality cap, same invariants; these weeks stay `phase: 'maintenance_base'` and carry a separate `reengagement: true` marker rather than a third phase value (a new phase string would force every call site that switches on `maintenance_restoration|maintenance_base` to learn a case that has no training meaning). What changes is only what the app is permitted to say:

- The rule-engine theme (`PHASE3_THEME`) is **Engine copy:** `Still here. When you're ready.` — the one place in the block where looking forward is allowed, stated once, without pressure. It never names a distance, a race, or a target, and never asks a question.
- The **CA-03 goal ladder surfaces here and nowhere earlier** (§67, amended). Phase 3 is the *only* forward-goal surface in the entire block.
- The PAID weekly debrief may match the register (`enrichMaintenance` prompt), still without naming a target.

**Phase 3 must arrive, not merely stop hiding.** The window is a deliberate beat: the block opened with the "After the race" announcement and closes wearing the same eyebrow and the same recovery-green rail, so it reads as the app coming back after waiting — never as a feature unlocking. `INV-MAINT-REENGAGEMENT-WINDOW` enforces the window's placement mechanically. `isReengagementWeek()` derives the window from the block's shape when the marker is absent, so maintenance plans generated before MAINT-07 reach Phase 3 without a migration.

**Config:** `GENERATION_CONFIG.POST_RACE_MAINTENANCE_BLOCK` — all numerics (base-volume anchors, intent multipliers, duration modifiers, thresholds, `PHASE3_LAST_WEEKS`) live there; none is hardcoded. Generator: `lib/plan/maintenance.ts → generateMaintenanceBlock()` (person inputs threaded from `app/api/maintenance-block/route.ts`, which derives base volume, injuries, whole-plan response, and recovery markers). `validateMaintenanceBlock()` in `lib/plan/invariants.ts` enforces structure mechanically.

---

## 76. The plan is anchored to race day, not to the start date

**Principle.** A plan is laid out **backwards from the race**, not forwards from the start date. The final week of every plan MUST contain `race_date`. When more calendar weeks are available than the distance's ideal plan length, the surplus **delays the start** — it is never dropped from the end.

**Why.** A training plan is a countdown to a fixed event. Every other rule in this document — taper depth, peak placement, race-specific exposure, recalibration cadence — is expressed relative to the race, so a plan whose final week is not the race week has silently mis-scheduled all of them at once. A runner who finishes the plan eleven days early does not get a longer taper; they get an unplanned, uncoached void at precisely the point where the plan's guidance matters most, and they will fill it by guessing.

The failure is specifically an *end*-truncation: `min(available, ideal)` weeks counted forward from the start discards the tail. Counting backwards from race week discards nothing — it moves the start, and the gap before it is handed to the foundation block (§ Foundation block), which exists for exactly this situation.

> ⚠️ **CORRECTED 2026-09-15 (FOUNDATION-LONG-RUNWAY-01, Coaching Board).** That
> sentence used to read *"already **owned** by the foundation block"*, and for any
> gap longer than `FOUNDATION_MAX_WEEKS` (3) **it is not.** Measured: a first-time
> marathoner with a 25-week runway gets 3 foundation weeks and **4 uncovered**; at
> a 52-week runway, **31**. The block takes what it can and the remainder was owned
> by nothing and declared by nothing — while this very section says a runner left
> with an uncoached void *"will fill it by guessing"*. §76 was describing the
> failure it was itself producing, at the other end of the plan.
>
> The gap is still structural (see §57's amendment for why a longer block is
> measurably useless), so the obligation is **honesty, not coverage**: the plan must
> now carry `meta.uncovered_runway_note`, enforced by
> `INV-PLAN-UNCOVERED-RUNWAY-DECLARED`.

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

### Amendment 1 — the trial's copy is instruction, and the enricher may not replace it — added 2026-09-04 (defect fix, restores documented intent)

**Principle.** The recalibration time trial's coach notes are **instruction, not voice**. They must state that the session is a measurement rather than a training session, and must tell the runner to log the result. The AI enricher rewrites voice; it must not touch these, and the session's label is protected with them.

**Why.** Live plan `bcdec27a` (2026-09-03, `enrichment: "applied"`, `recalibration_weeks: [8]`) shipped this to the runner:

> "Hard session: {{session_zone}}, {{session_distance}} km. **This is pace work, not endurance.**"

in place of the engine's own:

> "This is a measurement, not a session. **Log the result in your profile and your paces update for the next block.**"

> **Amendment (TT-NOTE-HONESTY-01, 2026-09-17) — that second sentence is no
> longer the shipped copy, and the reason is not style.** It promised every
> runner an outcome the free tier cannot deliver: recalibration is PAID
> (`dynamic_reshape_r20`, ADR-014), and free plans carry the trial too
> (measured 2026-09-17 — both tiers generate `recalibration_weeks: [8]`). The
> runner was told "your paces update" while `RecalibrationTile`, one surface
> away, correctly told the same runner it was a paid feature. **Two surfaces,
> one fact, disagreeing** — and the honest one was not the prescription.
> "In your profile" was also the wrong place: the entry point is a tile on
> Today, and Me's route is labelled "Race benchmark".
>
> Now: *"This is a measurement, not a session. Log the time when you're done
> and you'll get the option to rebuild your paces around it."* True at both
> tiers, names no screen, and keeps ADR-014's prompted-and-confirmed model
> intact — the rewrite is never silent. The tile remains the single owner of
> what the option costs.
>
> **Board-exempt:** coaching copy and voice, governed by `brand.md`, not the
> Coaching Board (ADR-017). No numeric, no prescription change — the session,
> its distance and its effort are untouched.
>
> **Still open, and it is an SLT question rather than a copy one:** a free
> runner is prescribed a benchmark whose result they cannot apply. Filed as
> `TT-FREE-BENCHMARK-01`.

Fluent, on-voice, and **states the opposite of this principle** — while deleting the only instruction the feature depends on. **Nothing recalibrates unless the runner logs a result** (ADR-014), so the plan went on claiming week 8 was a recalibration week while the runner had been told it was pace work.

**How it escaped — the transferable part.** `validatePlan` *does* run post-enrichment (PV2-A), so the architecture was right. But the only copy invariant that could have caught it opened with `if (session.type !== 'quality') continue`, and this session is typed `hard`. **The `hard` typing chosen above so the trial would not count against `QUALITY_SESSIONS_PER_WEEK_MAX` also exempted it from every quality-scoped copy check** — a type chosen to opt out of one rule silently opted it out of an unrelated one. Worth remembering whenever a type is picked to dodge a specific rule: check what else keys on it. Compounding this, the invariant was a **two-phrase denylist**, and the harm here is what went *missing* — no banned-phrase check can ever catch that.

**Config.** No numeric — structural. Enforced at the single owner (`applyEnrichment` in `lib/plan/enrich.ts`, keyed on `type === 'hard'`, which `applyRecalibrationTimeTrial` is the only producer of anywhere in the codebase) and backstopped by a **positive** arm of `INV-PLAN-COACH-NOTES-MATCH-INTENT` that requires the instruction to be present. The check requires the *instruction*, not a specific sentence — a legitimate rewording that still says it passes, so this does not freeze the copy. ⚠️ **That arm required `measurement` OR `log the result` until 2026-09-17** — an OR, so dropping the instruction passed as long as the word "measurement" survived, which is half the defect it was written for. It now requires **both**.

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

### Returning runners & user-selectable level — amended 2026-08-31 (Coaching Board, CORRECT WITH AMENDMENT)

**Two signals were not enough for the runner in a dip. Training age is the third.**

**Principle.** A deep **training age** (`2-5yr` / `5yr+`) is a third fitness signal, consulted for **intensity only**. When such a runner reads `beginner` on current volume, they are **returning, not new** — a layoff erases volume, not the skill or the aerobic base that comes back fast. Their intensity allowance is therefore lifted off the beginner floor (to at least intermediate) so they are not handed a true-beginner's zero-quality plan. **Structure is untouched** — volume, peak km, ramp and long-run caps stay bound to current volume (§2, §29, §371), because tonnage is where injuries come from. This is §79's existing asymmetry, extended: training age answers "what can they *do*", volume answers "what can they *absorb now*".

**Why.** Founder case (2026-08-30): an experienced ultra runner, volume down after a 100K, generated a 10K plan classified `beginner` — no benchmark, so both original signals read the low current volume. The result was a true-beginner plan: **zero quality** (`QUALITY_SESSIONS_PER_WEEK_MAX.beginner = 0` removed all tempo/threshold/intervals/hills) and **duration-primary** sessions (§ metric). Neither fit a lifelong runner. The engine had the signal to know better — `training_age` — and ignored it for intensity.

**The metric recommendation follows experience, not raw volume.** Duration-primary is the *beginner* and *ultra* default (time on feet, §80). It is now keyed to `intensity` (which incorporates the training-age lift), not `structural` (raw current volume) — so a returning or experienced runner sees **distance** even when their current volume reads low, while a true beginner (every signal agreeing) still gets duration. (User-overridable per session or globally — display preference, ADR-015.)

**Progressive intensity re-entry (Willy, mandatory).** Cardiovascular readiness returns weeks ahead of musculoskeletal readiness — a returning runner *feels* ready for intervals and hills before the tissue is. So when intensity is lifted (or user-raised) for a returning/fresh-return runner, the **highest tissue-stress quality — VO2max intervals and hill reps (both catalogue category `vo2max`) — is withheld for the opening `RETURNING_RUNNER_INTENSITY_REENTRY_WEEKS`**; tempo and threshold carry the quality load first, mirroring §21's staged reintroduction. `intensity_reentry_active` / `intensity_reentry_weeks` surface this in meta.

**User-selectable level (wizard) — asymmetric, amended 2026-09-02 (Coaching Board).** The engine's assessment is a **recommendation the runner can override** (the wizard shows the recommended level and lets them change it). The runner's selection arrives on its own input, `user_declared_level`, and binds **asymmetrically**:

| Direction | Binds |
|---|---|
| **Upward** of the assessment (declaring *more* than the data says) | **Intensity allowance only.** Peak km, the week-1 volume floor, the ramp and the long-run caps stay on the assessment. |
| **Downward** of the assessment (declaring *less*) | **Both** intensity and structure. |

**Why the asymmetry.** It is evidential, and it is the same shape as §50's max-HR guard. A runner declaring *less* than the data says is credible about their own caution — there is no risk in believing them, and refusing to would make the control decorative. A runner declaring *more* is claiming a tissue tolerance that nothing has demonstrated; cardiovascular confidence runs weeks ahead of musculoskeletal readiness (Willy), and the plan, not the runner, would pay for the difference. Agency raises intensity, never tonnage (§10).

**Why this needed stating twice.** The rule above was already written here, and the engine did the opposite for the first two days of its life: a declared level set `fitness`, which set `peakKm`, which sets the week-1 volume floor via `BUILD_VOL_INIT_FLOOR_VS_PEAK` — so the dropdown raised *starting* tonnage above the runner's actual current volume. Measured: a 10K runner on 15 km/week declaring `experienced` went from week-1 13 km / peak 18 km to week-1 20 km / peak 35 km; a `<6mo` novice on 8 km/week took a marathon peak from 42 to 55 km, straight through the `BEGINNER_WEEK1_VOLUME_CAP_KM` protection (which caps the declared start, not the peak-derived floor). A principle is not enforced by being written down — hence the invariant below.

**Two inputs, two axes — do not merge them.** `fitness_level` is the **API-level structural declaration** (a caller stating what the runner is; drives peak km and volume caps — the long-standing contract used by the archetype matrix and property sweep). `user_declared_level` is **what the runner picked**. Collapsing them is what produced the defect: one enum was carrying two different authorities.

**Accepting is passed through too.** The wizard sends the level whether the runner accepted the recommendation or changed it. An earlier revision sent `undefined` on accept — a workaround for the peak-km binding, which left the runner accepting a level the engine never received. With structure protected, that seam is closed.

**Distribution still governs.** A user-elevated intensity on low volume cannot blow the §1 quality-share ceiling — `INV-PLAN-INTENSITY-DISTRIBUTION` remains binding at the elevated level.

### Amendment 3 — a user-raised NOVICE gets the same re-entry window a returner does (Coaching Board, 2026-09-15)

**Principle.** When `user_declared_level` is **above** the engine's structural
assessment AND the runner's `training_age` is shallow (`<6mo` / `6-18mo`), the
§79 intensity re-entry window opens: the highest tissue-stress quality — VO2max
intervals **and hill reps**, both catalogue category `vo2max` — is withheld for
the opening quality weeks. **Tempo and threshold still arrive immediately.** The
declaration is honoured; it is honoured in the right order.

**Why — the protection already existed and was scoped backwards relative to
risk.** The amendment above already mandates this for intensity that is *"lifted
(OR USER-RAISED)"*, but scopes it to **returning/fresh-return** runners. A
returner has historical tissue adaptation; a novice has none. §79's own sentence
is the argument: *"a runner declaring MORE is claiming a tissue tolerance that
nothing has demonstrated."* Nothing had demonstrated it, and nothing withheld
anything.

**Measured on the charity cohort — the reason this was found.** `T1`
"couch-to-10K charity beginner": **8 km/week, longest run 4 km, `<6mo` running,
no quality history**, 3 days/week. Declaring `intermediate` in the wizard
produced:

| week | session | zone | RPE |
|---|---|---|---|
| 4 | Continuous tempo | Zone 3 | 7 |
| **5** | **Hill reps — 90s** | **Zone 4–5** | **8** |
| 7 | Long VO2max | Zone 4–5 | 7 |

Zero invariant errors. `training_age: '<6mo'` fails every returning-runner arm,
so no window opened. After: all six sessions Zone 3 / RPE 7, peak km unchanged
at 19, structural still `beginner`.

**Scoped to a SHALLOW training age, and the scoping is the rule.** A runner with
`2-5yr`/`5yr+` who declares up is already covered by `intensityLiftedForReturn`.
Firing here too would withhold VO2max from a 55 km/week runner with five years
and regular quality behind them — caught on the first run by §96's brake test.
The two arms are complementary and must never overlap.

**Unchanged:** the structural axis does not move (§79/D2 — an upward declaration
buys intensity only, never tonnage; `INV-PLAN-USER-LEVEL-NO-UPWARD-TONNAGE`
still binds). Downward declarations keep §79's asymmetry. §1 still governs.
Where the rotation then places no VO2max at all, §79 Amendment 2's omission note
already declares it — with copy that does **not** tell a first-timer they are
"coming back", which was a real defect introduced and fixed inside this change.

**Invariant.** `INV-PLAN-RETURNING-INTENSITY-REENTRY` already checks exactly
this; its scope widens with the arm. No new numeric — reuses
`RETURNING_RUNNER_INTENSITY_REENTRY_WEEKS`.

### Amendment 4 — §79 beats §5's adaptation deadline, in BOTH mechanisms (implemented 2026-09-15)

**Principle.** Where §79's intensity re-entry window and §5's VO2max adaptation
deadline cannot both be satisfied, **§79 wins**. The board ruled this before
2026-09-14; it had never been implemented, and §5 overrode §79 on every plan
where both applied.

**Two mechanisms, not one — this is why the earlier attempt failed.**
1. `vo2MustOpenBuild` forced VO2max into the first build quality week. Now
   consulted only when NO re-entry window is open: with no window there is no
   conflict, and §5 behaves exactly as it always has. A previous attempt made
   the window win outright and **broke 29 tests including `cohortShape`**,
   because with no window the slot index IS the rotation's natural index, so it
   changed plans that had no §79 claim on them at all. **The scoping is the fix.**
2. `applyV2Vo2MaxOnsetTiming` relocates VO2max EARLIER to meet the deadline, and
   was landing it inside the very weeks §79 withholds it from — the rotation
   placed the slot correctly and the swap pulled it back. A swap that would put
   VO2max inside the protected window is now declined.

**§5 yields where no compliant placement exists (D-21).** With §79 winning, a
plan can have no legal VO2max week at all, and `INV-PLAN-VO2MAX-ONSET` would
then fire on a plan that correctly honoured the other rule — making the ruling
unimplementable. CD-22's own disposition already covers this shape: *binding
where reachable, recorded where not*. It was written for the GEOMETRIC case (a
plan too short to contain the window); the re-entry window makes it unreachable
a second way. `reachable` now accounts for both, derived from the PLACED
sessions so it matches `INV-PLAN-RETURNING-INTENSITY-REENTRY` exactly.

**The check stops being decorative.** `INV-PLAN-RETURNING-INTENSITY-REENTRY`
read CALENDAR weeks — all-easy by construction — so it was trivially true and
sat in the liveness baseline as never-woken: *the check and the defect shared a
premise*. Re-anchored to QUALITY weeks it is now **PROVEN wakeable** for the
first time since it was written.

**Config.** `GENERATION_CONFIG.RETURNING_RUNNER_INTENSITY_REENTRY_WEEKS = 4`; `GENERATION_CONFIG.USER_DECLARED_LEVEL_BINDS_STRUCTURE_DOWNWARD_ONLY = true`.

**Invariants.** `INV-PLAN-RETURNING-INTENSITY-REENTRY` — no VO2max-category session in weeks 1–`intensity_reentry_weeks` of a re-entry-active plan. `INV-PLAN-USER-LEVEL-NO-UPWARD-TONNAGE` — where `meta.fitness_level_declared` outranks `meta.fitness_level`, peak weekly volume must stay within the structural band's ceiling.

**Meta.** `fitness_level` (structural — what volume was built from), `fitness_intensity_level` (the allowance quality was built at; stamped whenever it differs from structural), `fitness_level_declared` (what the runner picked). All three are needed: `validateReshapedPlan` reconstructs its input from meta, and the quality-per-week ceiling is an *intensity* rule — checking it against the structural level fails a legitimately-built returning-runner plan on every reshape.

---

### Amendment — the window is counted in QUALITY weeks, not calendar weeks (QUALITY-ONSET-ORDER-01, 2026-09-15)

**Principle.** §79's re-entry window withholds VO2max/hill work for the runner's
opening **quality-carrying** weeks, not their opening **calendar** weeks.

**Why.** §79's claim has always been an ORDERING one — *"so quality leads with
tempo/threshold"* — but it was encoded as *"no VO2max-category session in weeks
1..N"*. `plannedQuality` is **0 for every base week and 0 for every deload
week**, so weeks 1..N are all-easy by construction and there was nothing in them
to withhold. **The window closed the week before quality began.** Measured: of
48 plans with re-entry ACTIVE, the first quality session fell inside the
protective window in **0 of 48 (0.0%)**, and was Zone 4-5 anyway in 32 of 48.
`INV-PLAN-RETURNING-INTENSITY-REENTRY` encoded the same calendar reading, so it
was trivially true on every plan and sat in the liveness baseline as
never-woken: **the check and the defect shared a premise.**

**Measured after the repair:** returning runners whose FIRST quality session is
VO2max **25.4% -> 12.7%** (1,152 -> 576 plans); first quality is
tempo/threshold **50.3% -> 63.0%**.

**Implementation note that is load-bearing.** The window has ONE owner
(`lib/plan/intensityReentry.ts`) because the predicate was previously
hand-written twice inside `generateRulePlan` with different loop variables.
Both consumers now ask `withheldAtQualityIndex` with the same counter — the
build-slot reservation passes its rotation index, the per-week selector gate
passes `buildRotationIndex`, and they walk the identical sequence. Feeding the
two channels different predicates measured **47 -> 594** sweep failures.

**Consequence, ratified separately:** repairing this makes §5's adaptation-window
swap fire for the first time, which required the §22 Amendment of the same date
(V2-SWAP-S22-01).

### Amendment 2 — the window may OMIT VO2max entirely, and omission must be DECLARED (Coaching Board, 2026-09-15, REENTRY-DEPTH-01)

**Principle.** The re-entry window WITHHOLDS; it carries no obligation to place
VO2max afterwards. A returning runner's plan may therefore contain **no VO2max or
hill work at all**, and that is a legitimate prescription. **But the plan must say
so** — `meta.intensity_reentry_omission_note`, rendered through the one note
renderer (`planRationaleNotes`). Silent omission is the defect; omission is not.

**Why omission is legitimate, on this constitution's own authority.** §5's
CD-16/CD-22 amendment records Seiler verbatim: *"Either commit to it properly in
the build, or do not do it. The middle position is the only indefensible one."*
§5 requires that VO2max, **where placed**, lands early enough to adapt. It has
never required presence.

**Why requiring DEFERRAL was REJECTED.** Forcing VO2max to appear after the
window produces precisely the position §5 names indefensible: one or two isolated
exposures jammed against the taper, carrying the full injury and fatigue cost of
the hardest work in the plan and none of the adaptation. Do not re-propose it.

**What the measurement showed, and why the filed question was the wrong one.**
This was filed as "the depth numeric needs recalibrating". It does not.
- Depths **1, 2 and 3 are identical to each other and change nothing**; only 4
  bites. Recalibrating down is turning the rule off while appearing to tune it.
- Of the plans where the quality-week reading changes the opening stimulus,
  **576 lost VO2max from the plan ENTIRELY and 0 were merely re-ordered.** The
  fix delivered 100% of its benefit by deleting the stimulus, not deferring it.
- Mechanism: with §53's rotation and a bounded number of quality slots, blocking
  VO2max in the opening quality weeks means the freed slots are filled by other
  categories and VO2max is never selected at all. **Withholding is not deferral.**

**The test this had to pass** is §87/§95's, stated twice already in this
document: *a defensible outcome reached at random is a coincidence, not a
decision.* Omission reached by rotation exhaustion is the coincidence. Omission
declared to the runner is the decision.

**NOT ratified by this amendment, and filed separately:** even with the window
inert, **49.7%** of re-entry-active quality-bearing plans already contain no
VO2max-category session and **74.8%** contain no hill reps. Nobody decided that.
It is a pre-existing finding this measurement surfaced, not a consequence of this
ruling (REENTRY-VO2MAX-BASELINE-01).

**Invariant.** `INV-PLAN-REENTRY-OMISSION-DECLARED` (error), derived from the
PLACED SESSIONS so the producer cannot satisfy it by asserting it behaved.

### Amendment 5 — the re-entry note must name the reason the window actually opened (Coaching Board 2026-09-19, REENTRY-CAUSE-01)

**Principle.** A plan carrying the intensity re-entry omission note MUST stamp
`meta.intensity_reentry_cause` as one of `returning` | `user_raised` |
`early_onset`, and only `returning` may render *"you are coming back"* copy.

**Why.** Measured on 576 plans of intermediate and experienced runners with
plausible long runs, the *"You are coming back, so the quality work leads with
tempo and threshold while your legs re-adapt"* copy appeared on **120 plans
(21%) — and 96 of those had `early_quality_onset` set.** That is ADR-021 §89's
cohort, which *requires* experienced intensity, a deep training age, regular
recent quality, no injury history, and explicitly **not returning and not
fresh**. **84 of the 120 were not returning by any arm at all.** The engine was
telling the runners it had itself certified as demonstrably ready that their
legs needed to re-adapt. A runner at 40 km/week with a 16 km long run reads
that, knows it is false about them, and discounts everything else the plan says.

**⚠️ The mechanism was not the obvious one, and naming it wrongly would have
produced a wrong fix.** It is not the fresh-return heuristic (25 km/wk **and**
10 km longest — nowhere near these runners) and not `isReturningRunner`
(current volume below 50% of peak). `oneWeekOnRamp = earlyQualityOnset` sits in
`reentryIsUserRaisedOnly`'s exclusion list, so an early-onset runner failed that
test and fell through a **binary** to the returning copy. Three causes needed
three branches.

**⚠️ This board already fixed this copy class once, in the arm next door.**
Amendment 3's closing line records *"copy that does **not** tell a first-timer
they are 'coming back', which was a real defect introduced and fixed inside this
change"*. One arm was fixed; this one survived, because the fix was a second
branch rather than a cause.

**The cause is STAMPED, not re-derived.** `INV-PLAN-REENTRY-NOTE-MATCHES-CAUSE`
reads the stamped field and the rendered note. A checker that recomputed the
predicate would share the producer's logic and be blind to the producer being
wrong — the `deloadCadence` / `tierResolution` failure class.

**Measured effect.** "Coming back" copy **120 → 24 plans**, and **0 of the 24
are non-returning** (was 96). Prescription unchanged: scoped `verify:parity` is
IDENTICAL across 5,940 cases with the note and cause fields stripped.

**Config.** No new numeric — the copy variant is selected from flags that
already exist. A constant here would be decorative.

**Enforced by** `INV-PLAN-REENTRY-NOTE-MATCHES-CAUSE`, **error** severity,
proven wakeable by two mutations in `invariantLiveness.ts`.

---

## 80. Finish-goal long run — time on feet, not distance

**Principle.** For finish-goal HM and marathon plans, the peak long run must reach `FINISH_GOAL_PEAK_LR_RATIO_VS_RACE_DURATION` (70%) of **projected race duration**, subject to `LONG_RUN_CAP_MINUTES`, which still wins. Projected duration is computed at easy pace — a finish-goal runner will not race at threshold, and run-walk is expected. Every finish-goal peak long run carries explicit permission to walk. When the cap prevents reaching the floor, the plan says so.

**Why.** §45 mandates a peak long run of ≥85% of race distance for *time-targeted* HM, and finish-goal plans had no floor at all. So the runner least equipped for the distance got the least specific preparation: the first organic user peaked at 1:46 against a ~2:45 projected finish — 64%. §45's own rationale is *"the fatigue profile of running for ~2 hours is fundamentally different"*, which applies **more** to a first-timer, not less.

**Duration, not distance, and the distinction is not cosmetic.** A first-timer is time-on-feet limited, not aerobically limited. The constraint that actually binds — `LONG_RUN_CAP_MINUTES` — is already expressed in minutes, so a distance-based floor would hide what is doing the limiting. And "two and a half hours of moving" is a different psychological object from "18 kilometres": only one of them is achievable for someone who has never run either, and only one of them survives contact with a walk break.

**Walking does not undo it.** The session note says so explicitly. Time on feet accumulates whether or not every step is running, and a floor the runner believes they have failed is worse than no floor — they will either abandon the session or grind it out injured.

**The honest failure case.** Where the time cap binds, the plan cannot deliver race-specific endurance and must say that plainly, with the concrete consequence (the late race will be unfamiliar) and the actionable response (start slower, take walk breaks early rather than late). A silent shortfall is the failure mode this whole principle exists to prevent.

**Config.** `GENERATION_CONFIG.FINISH_GOAL_PEAK_LR_RATIO_VS_RACE_DURATION = 0.70`. Shortfall surfaced as `meta.long_run_shortfall_note`.

**Amendment 1 — the race-day opening instruction scales with the race (Coaching Board 2026-09-14).**

`raceSession()` carried one hardcoded note for **every** distance: *"Start slower than feels right. First 5 km at Zone 2."* It never read the race distance.

| Race | "first 5 km" is | Verdict |
|---|---|---|
| Marathon 42.2 km | 12% of the race | Sensible, standard |
| HM 21.1 km | 24% | Defensible |
| 10K | **50%** | Gives away half the race |
| 5K | **100%** | **Instructs the runner not to race at all** |

**5 km IS 11.85% of a marathon.** The constant was the marathon's opening fraction, written out in kilometres and then applied to distances it was never derived for — the same shape as §16's race-pace overlay (RACE-PACE-OVERLAY-REACH-01, the same day). Deriving it back to a fraction leaves the marathon unchanged at 5.06 km and makes every other distance correct: 0.6 km for a 5K, 1.2 km for a 10K, 2.5 km for a HM.

**The effort follows the GOAL, not a fixed zone.** "Zone 2" is right for a finish-goal runner, whose race plan is to complete the distance. It is wrong for a time-targeted one: a runner chasing sub-50 for 10K who opens in Zone 2 has given the race away in the first kilometre and cannot get it back. A time-targeted race opens **at goal pace**, which is the pace the entire plan has been rehearsing (§5, §25). The instruction in both cases is the same coaching idea — *do not bank time you have not earned* — expressed against the target the runner actually has.

**Config.** `GENERATION_CONFIG.RACE_OPENING_FRACTION = 0.12`. Enforced by `INV-PLAN-RACE-NOTE-SCALES`.

### Duration-anchored display — amended 2026-08-31 (Coaching Board, CORRECT WITH AMENDMENT — HR-MAX-01 part 3)

**§79 keyed the metric recommendation to experience, so a finish-goal HM/marathon runner with an intermediate-or-higher intensity now sees distance by default. §80 must survive that.**

**Principle.** The metric a runner sees is a **recommendation they can override** (per session or globally, ADR-015) — with one exception: a session whose *prescription is time on feet* stays **duration-anchored**. The finish-goal peak long run carries `duration_anchored: true` and `primary_metric: 'duration'` regardless of the runner's metric preference; its distance is only ever a **secondary** value. A user metric override cannot strip the time framing from it.

**Why.** "Duration, not distance, and the distinction is not cosmetic" (above) — a first-timer is time-on-feet limited, not aerobically limited, and the binding cap is in minutes. If the global metric flip (or a user toggle) let this session read as "18 km", it would misrepresent what's limiting and set a target that a walk break appears to fail. And a converted/derived distance is shown with a `~` estimate marker (ADR-015), never as an exact prescribed target.

**Config.** Governed by the existing §80 constants (`FINISH_GOAL_PEAK_LR_RATIO_VS_RACE_DURATION`, `LR_FINISH_GOAL_LATE_PEAK_SEGMENT_PCT`) — no new numeric; the anchoring is a display-authority rule on the session those constants already build.

**Invariant.** `INV-PLAN-DURATION-ANCHORED-KEEPS-MINUTES` — a `duration_anchored` session must keep `duration_mins > 0` and `primary_metric: 'duration'`.

---

### Amendment — the specificity floor ramps through BUILD (PLAN-FITNESS-01, Coaching Board 2026-09-17)

**Principle.** The peak long-run specificity floor — §24's for time-targeted plans and
§80's duration floor for finish goals — is applied from the **start of the build
phase**, scaled from `SPECIFICITY_RAMP_START_PCT` of its peak value to 100% by the end
of build. The peak value itself is unchanged, and §45's week-on-week cap still clamps
every step.

**Why.** Both floors were gated on `phase === 'peak'`. The floor was right — §80 asks a
finish-goal marathoner for 42.2 × 0.70 = **29.5 km** — but it was only *requested* in
peak, and §45 permits **+5 km/week**, so the climb from §9's share (~11 km) could not
finish in the two or three peak weeks remaining.

Measured 2026-09-17 on the review personas: **M1, a first marathon with a 24-week
runway, no injury and no time cap, peaked at a 21 km long run — 50% of race distance**
against a 30–32 km coaching norm. M3 reached 14 km; M1d 19 km.

⚠️ **Two earlier diagnoses of this were wrong and are recorded so they are not
repeated.** The long run is **not** held down by §52 (its 60% ceiling was never within
reach — the long run sat at ~30% of the week for 14 of 19 weeks) and **not** by §9
being violated. §9's share was simply the only thing asking, because the floor had not
arrived yet. **The defect is a floor arriving too late to be climbed to, not a cap
holding the long run down.**

**Measured after**, peak long run as a share of race distance:

| persona | before | after |
|---|---|---|
| M1 first-timer, 24wk | 21.0 km (50%) | **26.0 km (62%)** |
| M2 compressed 12wk | 25.0 km (59%) | **29.5 km (70%)** |
| M3 returning + knee | 14.0 km (33%) | **26.0 km (62%)** |
| M5 masters 58 | 27.5 km (65%) | **29.5 km (70%)** |
| M1d declares experienced | 19.0 km (45%) | **23.5 km (56%)** |

⚠️ **Still short of the 30–32 km norm on M1.** §45's +5 km/week remains binding from a
15 km/week base. This closes most of the gap; it does not close all of it, and saying
otherwise would overclaim.

**Config.** `SPECIFICITY_RAMP_START_PCT` (60) — the share of the peak floor a build
phase opens at. Not tuned to a chart: §9's own build share already puts a typical build
long run near 60% of its peak value, so the ramp starts where the long run naturally
sits and pulls it up from there.

**Board:** 2026-09-17 — CORRECT, Hutchinson chairing. ⚠️ **The ruling named §24; the
operative section for the charity cohort is §80**, because every marathon persona is
`goal: 'finish'` and §24 gates on `time_target`. Both carry the amendment — same
defect, same shape. Record: `docs/decisions/coaching-board-2026-09-17-plan-fitness.md`.

### §80 Amendment 1 — the shortfall note must name the constraint that is actually binding, and must not fire on rounding

*Added 2026-09-18 — Coaching Board (LR-SHORTFALL-CAUSE-01). Raised by the founder from his own London Marathon 2027 plan.*

**Principle.** When §80's long-run shortfall is declared, the note states **which constraint produced it**, and it only fires when the shortfall is **material**. A note that names a lever the runner cannot pull is worse than no note: it converts a deliberate safety ceiling into an instruction to train more.

**The defect, measured across 35,952 plans (both grids).** The note fires on 5,264 (14.6%). It offers two causes — the long-run time cap, or weekly volume. **It named the time cap 0 times.** All 5,264 said *"your weekly volume is what limits it"*. The code carried a comment from §110's sitting (M5-EASY-CEILING-01, 2026-09-16) asserting it "now names whichever one is actually binding"; the claim and the computation had never agreed.

**Why it almost never fired, and why the fix is a tolerance rather than a rewrite.** The predicate was `peakLrMins + 1 >= capMins` — a one-minute tolerance. `LONG_RUN_CAP_MINUTES` is applied on the **kilometre** axis (`result = absCapMins / paceMinPerKm`) and the resulting distance is then rounded, so a capped long run lands a little **under** its own ceiling and almost never satisfies a one-minute tolerance.

> ⚠️ **Not "structurally impossible" — that was the board's first framing and it was too strong.** `noteNamesBindingLever.test.ts` constructs a high-volume, slow-paced marathoner whose long run DOES reach `cap − 1`, and that case fired correctly under the old predicate. The honest claim is **0 firings in 5,264 across the cohort and targeted grids**, not that the branch could never fire. "Zero in the corpus" is not "cannot happen" — the same distinction the liveness harness records about its own sample.

**The line is measured, not chosen** (the §40c standard). Gap between the delivered peak long run and its own cap, for notes blaming volume:

| Gap below cap | Notes |
|---|---|
| 2 min | 2,420 |
| 3 min | 1,316 |
| **4–5 min** | **0** |
| 6 min and beyond | 1,528, scattered |

**71.0% sit 2–3 minutes under the ceiling, and nothing at all sits at 4 or 5.** That discontinuity is two populations: the cap binding through a rounding artefact, and a genuinely volume-limited week. Any tolerance in 3–5 gives an identical split, so the threshold sits in a flat region rather than on a cliff.

**A cap-bound note names no lever, deliberately.** §40c requires the note to name the lever that would change the outcome. When the ceiling is what binds, there is none — the ceiling is the coaching decision, and §40 already settled that *"the caps do not move"*. So the note says the limit is deliberate rather than implying the runner should train more. Telling a marathoner two minutes under a 210-minute ceiling that their weekly volume is the problem hands them an injury vector as advice (Willy), unfuelled volume the plan never asked for (Sims), and volume most likely to be added in the grey zone (Seiler).

**Materiality, in §40c's idiom.** §40c fires at 10% of the intended peak week because *"below it is rounding and phase noise"*. §80's note had **no floor at all** and fired on a shortfall as small as 2 minutes (1.7% of the floor). Shortfall as a share of the floor: min 1.7%, p10 8.8%, median 11.9%, max 39.0%. **A 5% floor silences 2.6%** — the rounding cases — and keeps every genuine shortfall. 10% was rejected here: it would silence 30.5%, and a marathoner 10% short of the §80 floor is roughly 24 minutes short, which is signal.

**This changes what the plan SAYS, never what it prescribes.** No cap, ratio or session moves; `measure:fitness` is not gating.

**Config.** `GENERATION_CONFIG.LONG_RUN_AT_CAP_TOLERANCE_MINS` (3) and `LONG_RUN_SHORTFALL_MATERIAL_PCT` (5). Enforced by `INV-PLAN-LR-SHORTFALL-CAUSE` in `lib/plan/invariants.ts`.

---

## 101. `compressed` means two different things, so it is two fields

*(Renumbered 2026-09-11 — this section shared its number with another. Code and cross-references cited the OTHER one, so that kept the number and this took a fresh one. See the duplicate-number guard in `principlesIntegrity.test.ts`.)*

**Principle.** A plan can be short of time or short of volume. These are unrelated failures with unrelated remedies, and they are reported separately: `time_compressed` (fewer calendar weeks than the distance's minimum) and `volume_constrained` (the ramp never reached target peak volume).

**Why.** One boolean OR-combined both, and was `true` for five of six test personas — including a 12-week 5K plan with 24 days to spare, and a plan simultaneously classified `volume_profile: 'build'`. A flag that is almost always true carries no information.

It is not merely cosmetic: the flag feeds the **paid** confidence score ("deduct 2 if plan is compressed"), so paying users were seeing a score dominated by a near-constant. The enricher now receives `time_compressed`, which is what that deduction was always describing.

**Remedies differ, which is the point.** Time compression is fixed by racing later or accepting a shorter build. Volume constraint is fixed by more days per week, a higher weekday time budget, or a longer runway. Telling a runner "your plan is compressed" when they have four weeks spare and the real problem is three-days-a-week availability sends them to the wrong lever.

**`compressed` is retained as a deprecated OR of the two** for one release, so saved plans and existing readers keep working.

---

## 102. An intentional downgrade is not a missing session

*(Renumbered 2026-09-11 — this section shared its number with another. Code and cross-references cited the OTHER one, so that kept the number and this took a fresh one. See the duplicate-number guard in `principlesIntegrity.test.ts`.)*

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

### §80 Amendment 2 — a third arm: the injury cap, and the fuelling nobody rehearsed (Coaching Board 2026-09-20, MARA-LR-LOWBASE-01)

**Ruling: CORRECT WITH AMENDMENT. The PLAN is right; the NOTE was wrong.**
Record: `docs/decisions/coaching-board-2026-09-20-engine-backlog-review.md`.

**The measurement.** Marathon, finish goal, 3 days, `<6mo`, beginner, 29-week runway, race
weeks and race sessions excluded:

| `current_weekly_km` | healthy | knee history |
|---|---|---|
| **8** | **REFUSED** (§111) | **ADMITTED** — peak 29 km, LR 17 km = **40% of race** |
| **10** | **REFUSED** | **ADMITTED** — LR 17 km = **40%** |
| 12 / 15 / 20 | LR 26 / 26 / 26 km = **62%** | LR 17 / 17 / 19 km = **40 / 40 / 45%** |
| 25 / 35 | 62% | 62% |

**Same weekly volume, different long run.** §12's injury cap is what holds the injury cohort's
long run down — **not weekly volume.** The note said weekly volume, because it had only two arms.

**The principle.** The long-run shortfall note gains a **third arm**. When the runner has a
volume-capped injury history (§12: knee or shin splints) and the long-run time ceiling is not
binding, the note names **the injury cap**, and — like the cap branch of Amendment 1 — **it names
no lever.** A runner cannot train past their own injury history inside one build, and §40c's
"name the lever" becomes a harm when there is none: McMillan, *"a runner told 'your weekly volume
is what limits it' will go and add volume, which is precisely what their knee history says not to
do."* Willy, on the identical defect one amendment earlier: *"an injury vector served as advice."*

**Second half (Sims).** The existing tail warns about **distance**. Where the projected race
duration exceeds the peak long run by more than `FUELLING_PRACTICE_MIN_SESSION_MINS`, the note
also says the **fuelling** is untested. The measured case is 2h 16 of rehearsal against 5h 38 of
racing — **three and a half hours of unrehearsed fuelling** for a first-time, predominantly
female, 20–29 cohort whose documented failure mode is under-fuelling. ⚠️ Practice, never a
nutrition prescription (ADR-011).

⚠️ **THE THRESHOLD IS DERIVED, NOT CHOSEN, AND NO NEW NUMERIC WAS ADDED.**
`FUELLING_PRACTICE_MIN_SESSION_MINS` (120) is §24e's own bar for *"long enough that fuelling
matters"*. A gap wider than that is more than one whole fuelling-relevant session spent in
untested territory. Inventing a second constant for the same idea would be D-16.

🔴 **WHAT THIS AMENDMENT DELIBERATELY DOES NOT DO.** It changes **no prescription**. The injury
cap, §24's bar, §111's ratio and the long-run sizing are all untouched, and that is a ruling, not
an omission: §9's Recorded structural finding lists **ten instruments built and measured, every
one trading one defect for another** (§114 at 45% took LONG-RUN-SHORT from 0 → 88.7%; §45's
absolute arm at 30% took M2's net build 68% → 44%). **An eleventh is forbidden without adherence
or injury data.** Willy: *"17 km is the correct ceiling and I am not moving it."*

⚠️ **AND THE ADMISSION INCONSISTENCY STAYS OPEN, RECORDED HERE BECAUSE IT HAS NOWHERE ELSE TO
LIVE.** A healthy 8 km/week runner is **refused** while their knee-history twin is **admitted** —
because the injury cap lowers the peak, which lowers §111's ratio, which passes. **The injury
protection is functioning as an admission mechanism.** This is §111's *second* recorded inversion
(the first is in its own Recorded Limitation). The board cannot close it without touching §111,
which is `S111-SUBFLOOR-VOLUME-01`, which the SLT has parked behind asking the charity what their
runners actually run.

**Enforcement.** `INV-PLAN-LR-SHORTFALL-CAUSE` gains a second arm: a note blaming weekly volume
while a knee or shin-splint history is present is an `error`. Falsification-tested —
`lib/plan/lrShortfallCause.test.ts` proves it goes RED on the pre-amendment note and stays green
on the live one.

---

## 81. Structured sessions are exempt from the weekday cap — and the plan says when they don't fit

**Coaching Board MWM-02, 2026-09-03.**

`max_weekday_mins` is the runner's own statement about their life and binds every
weekday session (§18) — **except the long run and any structured session**
(quality, tempo, intervals, hard; `isStructuredSession` in `lib/plan/sessionRole.ts`).

**Extended to structured sessions 2026-09-03** on a stronger version of the same
argument. Capping a quality session does not shorten it *at all*. The cap scales
`distance_km` and `duration_mins`; it does **not** scale `derived_set`. Measured:

| | Uncapped | Capped at 30 min |
|---|---|---|
| Headline | Short VO2max — 9 km / 43 min | Short VO2max — **6.5 km / 30 min** |
| `derived_set` | 7 × 400 m @ 4:30–5:00/km | **7 × 400 m @ 4:30–5:00/km — unchanged** |

The runner still runs seven 400s. Only the number printed beside them moved. The
cap shortened the **label**, not the session — so the runner blocks out thirty
minutes for work that needs forty-three, every week, and concludes they are slow
or that running does not fit their life (McMillan). Willy: the mechanical load is
unchanged while the time that made it safe is gone, which is how compressed
recoveries turn a VO2max session into an injury.

An **easy run is not structured** — its prescription *is* its distance and
duration — so the cap applies to it normally.

**Never scale a structured session's `distance_km`/`duration_mins` without
scaling its `derived_set` to match.** Scaling only the headline is the defect.

**Why the exception.** A long run squeezed into a 30-minute weekday ceiling is not
a compromise, it is a different session: it stops being the longest run of the
week, and the label then lies to the runner. Measured across 2,688 plans, capping
it traded **1,615 §18 violations for 979 §9 violations** (+511
`INV-PLAN-LONG-IS-LONGEST`, +468 `INV-PLAN-MIN-SESSION-SIZE`). That is not a
resolution, it is relocation. The board vetoed it — Hutchinson, McMillan and
Willy arrived independently at *don't shrink to fit*.

Willy's load reading: a capped weekday long run is the worst of both. You lose the
progressive time-on-feet that builds tissue tolerance, and keep three same-sized
sessions that give no variation in loading — monotonous loading being its own
injury pattern.

**When does this even arise?** Only when the long run has been forced onto a
weekday, i.e. the runner blocked both weekend days. Among those runners, 823 of
896 plans put the long run over their weekday cap, median overrun **127%** — more
than double the time they said they had.

**The obligation that comes with the exemption.** An exemption is not a licence to
ignore the runner. Past `GENERATION_CONFIG.LONG_RUN_WEEKDAY_OVERRUN_MAINTENANCE_PCT`
(50%) the session is not a stretch, it is a different time budget, and the plan must:

1. **Say so** — §40c's rule, *a suppressed target is stated, never absorbed
   silently*, via `volume_constraint_note`. **This half applies to the long run
   AND to structured sessions alike.**
2. **Classify `maintenance`** — §52's third remedy. The runner keeps a plan; the
   plan stops claiming to build a long run it cannot build. **This half is the
   LONG RUN's remedy only** — see the amendment below.

### Amendment (Coaching Board, 2026-09-11) — the CLASSIFICATION does not extend to structured sessions

This section originally said the obligation applies "to the long run and to
structured sessions alike", and the engine applied neither half to structured
sessions. Fixing that as a defect shipped both halves, and the measurement after
the fact showed why the second is wrong.

**`maintenance` already has a defined meaning, and it is not this one.** §23 sets
it: a plan whose peak weekly volume fails to reach `PEAK_OVER_BASE_RATIO` times
week 1 — **a volume-overload failure**. A quality session that will not fit inside
a weekday is a **time-budget** failure. The plan's volume may ramp perfectly well;
what will not fit is one session, on one kind of day, in a week whose weekend is
not capped at all.

Conflating the two would make `maintenance` mean two unrelated things — which is
exactly the defect §101 diagnosed for `compressed` ("One boolean OR-combined both,
and was `true` for five of six test personas. A flag that is almost always true
carries no information"). The board is not going to repeat it one section later.

**Measured, which is what settled it.** Extending the classification took
`volume_profile: 'maintenance'` from **20% to 80% of plans at a 30-minute weekday
cap (+60pp)**; at a cap of 45 or above nothing crosses the limit at all. §81's own
description of the long-run case is *rare* — "only when the long run has been
forced onto a weekday", 896 plans. The structured case is 60% of 30-minute-cap
plans. The same remedy at sixty times the incidence is a different decision, and
+60pp is the magnitude this board rejected on 2026-09-06.

**And the substance, not only the number.** Weekends are not capped. A runner with
thirty-minute weekdays and a free Sunday can build perfectly well for a 10K.
Classifying that plan `maintenance` would tell them their training is not building
when it is — and it would tell it disproportionately to the cohort this section's
own closing paragraph exists not to turn away.

**So: the runner is told, and the plan is not relabelled.** Enforced by
`INV-PLAN-STRUCTURED-OVERRUN-DECLARED` (`warn`).

**Framing (Sims).** This constraint profile — no weekend availability — skews
heavily toward people with caregiving loads, disproportionately women. A bare
refusal reads as *you don't fit our app*. The note names the trade and the lever
("one longer session a week — a weekend morning, or a single weekday you can give
more time to") and the runner still gets a plan.

**Enforcement.** The exemption lives in `applyWeekdayMinsCap` and in
`INV-PLAN-MAX-WEEKDAY-MINS`, which must agree — an engine exemption the validator
does not share is a plan that fails its own constitution.

There is deliberately **no** final re-cap pass in the engine. The original
diagnosis (the cap ran mid-pipeline while later passes re-sized sessions) was
correct about ordering, but every re-expanded session proved to be the long run,
which this section exempts. With the exemption, 0 of 153,728 non-long weekday
sessions exceed the cap, and an A/B with the extra pass was byte-identical. It was
written, measured, and removed rather than shipped as a safeguard that provably
guards nothing. `validatePlan` on the finished plan remains the exit-boundary
check (ADR-020).

---

## 82. Easy runs are floor-protected against the weekday cap

**Coaching Board, 2026-09-03. Unanimous.**

`max_weekday_mins` (§18) binds an easy run's distance normally — §81 draws that
line explicitly, because unlike a long run or a structured session an easy run
has no `derived_set` or longest-run role to preserve, so the cap applies
"normally": scaled. But **the cap never scales an easy run below
`MIN_SESSION_DISTANCE_KM.easy`.** Where the ratio would cross that floor, the
engine holds the session at the floor instead — the runner's stated weekday
ceiling is exceeded by a few minutes, not honoured by a session that trains
nothing.

**Why.** SWEEP-VISIBLE-01 baselined 924 `INV-PLAN-MIN-SESSION-SIZE` violations as
"low-volume main weeks, unrelated to the weekday cap" — that diagnosis was
wrong, the same class of error SC-05 already recorded once this session
(confirm the satisfying case, never infer from the failure). Every sampled
violation read "got 3.5, expected 4" and carried `max_weekday_mins: 30`: the cap
scaling an easy run's distance below its own 4km floor, not a construction-time
volume problem. §9 already named the reason — below the floor, "the session is
too short to be coaching-meaningful" — and a 3.5km jog that satisfies a cap
number trains nothing while looking compliant.

**This is not a new exemption.** §81 is unchanged: easy runs stay capped in the
general case. §82 only stops the cap from crossing a named floor — the narrowest
fix available, not a re-opening of the same-day ruling that easy runs are
"capped normally" (McMillan / Hutchinson).

**Sequencing with §52b.** §52b (INPUT-FLOOR-01) already prohibits spreading
volume across more days than it can fill, and picks the day count at
construction time. §82 is the fallback for once that day count is already
minimal for the runner's volume and the weekday cap *still* bites a specific
session — not a substitute for §52b's remedy. Floor protection engaging on one
week is arithmetic; recurring across
`GENERATION_CONFIG.EASY_RUN_FLOOR_PROTECTION_MAINTENANCE_WEEKS` (2) weeks means
the day count and the stated time budget are structurally incompatible at this
volume — the same diagnosis as §52b, surfacing late because the cap runs after
§52b already chose the shape (Willy: persistence across weeks is the signal,
not a percentage overrun — a floor breach is binary per session, unlike §81's
graduated long-run overrun).

**The obligation that comes with floor protection** (mirrors §81/§40c — same
voice, same trade, do not introduce new copy for what is mechanically the same
constraint, per Sims). Past the threshold above, the plan must:

1. **Say so** — `volume_constraint_note`, naming day count as the lever.
2. **Classify `maintenance`** — §52's third remedy.

**No load objection (Willy).** 3.5km vs 4.0km easy is inside noise for tissue
tolerance — this is a coaching-meaningfulness question, not a load-progression
one.

**Config.** `GENERATION_CONFIG.EASY_RUN_FLOOR_PROTECTION_MAINTENANCE_WEEKS = 2`.
`MIN_SESSION_DISTANCE_KM.easy` (already 4, §9) is the floor being protected — no
new distance constant.

**Enforcement.** `applyWeekdayMinsCap` (`lib/plan/ruleEngine.ts`) stamps
`Session.floor_protected` when it holds a session at the floor. Enforced by
`INV-PLAN-EASY-FLOOR-PROTECTION-DECLARED` (the disclosure obligation, recomputed
directly from the finished plan) — `INV-PLAN-MIN-SESSION-SIZE` needs no change,
since a floor-protected session sits *at* the floor, not below it.

---

## 84. Displayed zone and HR derive from prescribed work — one source

**Principle.** The zone a runner SEES on a session — the session-detail "Hold the zone" header, the Today eyebrow, the ZoneBar — and the zone/HR a coach note states MUST both derive from the session's **prescribed work**, carried on `session.zone` as a single zone or a range ("Zone 3–4", "Zone 4–5"). They MUST NOT derive from the coarse `session.type` slot. Where the work spans zones, the header shows the **range** (floor-to-peak of the main-set work); where it sits in one zone, it shows the single zone. Warm-up, cool-down, and recovery steps do not widen the header range. A coach note MUST NOT state a literal zone or bpm that contradicts `session.zone` / `session.hr_target`.

**Why.** Every quality session — tempo, VO2 intervals, hill reps — is typed `quality`. A `session.type → zone` map (the old `zoneNumberForType`) therefore collapsed all of them to a flat "Zone 3 · tempo", while the engine had already written the honest zone to `session.zone` ("Zone 4–5" for hills and VO2) and the AI coach note read *that*. The runner saw two different zones for the same session on the same card — "Zone 3 · tempo, 145–158 bpm" in the header, "Zone 4–5, 158–185 bpm" from Kit. This is the §19/§27/§33 failure mode (name/theme/note must match the prescription) applied to the zone surface: a hill session at RPE 8 shown as "Zone 3" is a false claim a trained runner spots instantly, and disguising genuinely hard work as moderate is exactly how a runner is marched into overreaching without a warning sign (Sims). The fix is a single source — `session.zone` — feeding every display surface, so header and note can never disagree.

**Board.** Coaching Board 2026-09-04, CORRECT WITH AMENDMENT (unanimous). Amendment: range drawn from **main-set work steps only** (Seiler — never blur into the recovery jogs); **collapse to a single zone** when the work sits in one (McMillan — a pure tempo is "Zone 3", not a range on everything). No SLT escalation — pure correctness, no tier or data-collection change.

### Amendment 1 — the zone string is DERIVED from the HR target, not authored beside it — added 2026-09-04 (Coaching Board)

**Principle.** `hr_target` is the prescription; `session.zone` is a label *about* it. The label is derived from the target and the two are written in the same expression, so they cannot drift. §19's direction of travel, one field over: the label follows the prescription, never the reverse.

**Why — and this section is the cause, which is worth stating plainly.** The Config paragraph below asserted that the engine "already writes `session.zone` and `session.hr_target` together **and consistently** in every `makeQualitySession` branch (threshold → Zone 3–4/qualityHR; VO2 + hills → Zone 4–5/intervalsHR)". **That was true for the second pair and assumed for the first.** `qualityHR` is `z3Low–z3Top` — Zone 3 only — while the string said Zone 3–4. This principle then rebuilt the display on `session.zone` *on the strength of that unchecked claim*, and a live Session Detail card showed **"Zone 3–4 · threshold / 145–172 bpm"** as its headline above **"Hold 145–158 bpm for the whole interval"** in the coach card. Both components were faithful. The data was not.

The data inconsistency long predated §84; the **contradiction on screen was hours old**. Before §84 the header read `getSessionHRDisplay(session.type, session.hr_target, …)` — the same field the coach note reads — so the two agreed. Measured as the screen renders it: 5K 10.1%, 10K 9.3%, HM 14.8%, MAR 14.2%, 50K 12.7%, 100K 13.8% of sessions carrying both fields.

**No prescribed heart rate changes** (Willy). This is a relabel: threshold sessions read "Zone 3" because `qualityHR` **is** Zone 3. Confirmed by the golden snapshots — 41 lines changed, all `"Zone 3–4"` → `"Zone 3"`, and nothing else moved. Do not read it as a de-load. §1's grey-zone framing does not forbid it either: §1 governs *easy* runs drifting into Z3, not threshold work deliberately prescribed there.

**Recorded as INSUFFICIENT EVIDENCE, not folded in.** Hutchinson and Seiler both hold that neither current number is right for the work: `qualityHR`'s floor (`z3Low`) **equals the Zone 2 ceiling**, and nobody running 4 × 5 min at 10K goal pace touches it except on the way up; a 27-beat span is "a weather forecast, not a target" (Seiler). Narrowing that band is a real prescription change and needs observed HR data for this cohort, which Zonna does not hold. Its own ruling, not this one.

**Out of scope, deliberately:** the `Zone 2–3` long run with a marathon/HM-pace finish (48 sessions). Its `hr_target` is a *ceiling* describing the aerobic portion while the zone string describes the whole session including the faster finish — a different mechanism from the one ruled on here. The invariant is scoped to **range** targets so it does not sweep this in under a ruling that did not cover it.

**Config.** `zones.qualityZone` / `zones.intervalsZone`, authored in the same expression as `qualityHR` / `intervalsHR` (`ruleEngine.ts`). **Enforced by** the extended `INV-PLAN-DISPLAY-ZONE-MATCHES-WORK`, which now asserts the zone string's Karvonen band **equals** `hr_target`, reading the HR values from `plan.meta` rather than the raw input — §50's max-HR guard can reject a sub-estimate observed max, so the input is not what produced the target.

**Config (original).** `GENERATION_CONFIG.DISPLAY_ZONE_SOURCE = 'session.zone'`. ⚠️ The consistency claim that followed here was wrong — see Amendment 1. The engine writes `session.zone` and `session.hr_target` together in every `makeQualitySession` branch (threshold → "Zone 3–4"/qualityHR; VO2 + hills → "Zone 4–5"/intervalsHR), so this principle changes only what the *display* reads, not what the engine prescribes. `displayZonesForSession()` (`app/dashboard/DashboardClient.tsx`) and `zonesFromZoneString` / `hrBandForZoneString` (`lib/coaching/zoneRules.ts`) are the single owners of parsing that string into the displayed zone(s) and live HR band.

**Enforcement.** `INV-PLAN-DISPLAY-ZONE-MATCHES-WORK` in `lib/plan/invariants.ts`: every zone-bearing session carries a non-empty `session.zone`, and no `coach_note` states a literal `Zone N`/`Zone N–M` that contradicts it. Older plans with no stored `session.zone` fall back to the type-derived single zone at display time (graceful degradation, not a violation).

---

## 85. Intensity has an inventory, or the runner's answer means nothing

**Principle.** A runner who declares upward MUST be able to receive work an
intermediate runner does not. That requires the catalogue to CONTAIN harder
sessions — a selection rule cannot pick what does not exist. Where "harder" is
needed at threshold, it is expressed as DENSITY and CONTROLLED EXCURSION, never
as more minutes at the same intensity.

**Why this had to become a principle.** `THRESHOLD_WORK_TARGET_MINS` and
`VO2MAX_WORK_TARGET_MINS` already scale ~20% with the declaration, and had done
for months. Measured on a 12-week 10K plan, declaring `experienced` instead of
`intermediate` changed **one session out of six** — 5x3 min became 6x3 min, and
nothing else moved a byte. The dose responded exactly as designed; rep lengths of
5-10 minutes and 1 km simply swallowed it, because a 20% increase rarely crosses
an integer rep boundary (the same quantisation that closed EG-01).

Four separate selection levers were built and measured against this before the
cause was found — base-phase compression, deload cadence, a `difficulty_tier`
selection bias, and a shortened base. **All four failed for one reason**: every
threshold row in the catalogue was T-pace with easy recovery, differing only in
rep shape. Five rows, all tier 3, because they were one session written five ways.
There was nothing harder to select. **Do not re-attempt a selection lever before
checking the inventory it selects from** — that is the lesson this section exists
to carry.

**The distribution constraint that shapes the answer (Seiler).** The fix must not
be "more minutes at threshold". For a runner whose threshold is already developed,
more time in the same band is grey-zone accumulation — the thing the product
exists to prevent — arriving under a harder-sounding name. Harder must therefore
mean a different *stimulus*, not a longer *dose*.

**CV — the anchor that was missing.** `PACE_ANCHORS` declared eight anchors;
`resolveAnchorPace` resolved four. There was no anchor between T (0.855 vVO2max)
and I (0.975), which is precisely where an over-under's "over" segment lives, so
no over-under row could exist. **CV is 0.88-0.92, midpoint 0.90**, from discounted
VDOT (§10, §42 — only I-pace uses raw).

**The 0.90 midpoint is load-bearing and pinned.** Pace is inversely proportional
to velocity, so a 50/50 alternation between CV and T has a time-weighted mean
pace 2.56% faster than T. `INV-PLAN-LABEL-MATCHES-PACE` allows ±3% for a
threshold-labelled session. **The over-under is legal under §19 by 0.44 of a
percentage point.** Anchoring the "over" at 5K pace instead would breach it.
Widening the CV band or moving its midpoint faster breaks §19 silently.

**Dose is not transferable between stimuli (Sims).** 22 minutes of over-unders is
not 22 minutes of steady threshold — half the work sits above T. A row whose cost
per minute differs from its category's prices itself via
`SESSION_WORK_OVERRIDE_MINS`, keyed by row id. Absence from that map means the
category band applies; the default stays the rule.

**Tier is a description, not a lever (the honesty clause).** A row's
`difficulty_tier` states what the session IS. It must never be inflated to
populate a tier the selector wants to reach. `threshold_pyramid` is tier 3 despite
shipping in the same commit as two tier-4 rows, because its work minutes and its
pace are the ladder's — it is variety, not difficulty. The five pre-existing
threshold rows were correctly tiered all-3; the tier field was telling the truth
and the catalogue was the thing at fault.

**Upward declaration still buys intensity only, never tonnage (§79).** These rows
are gated on `min_weekly_km` as well as `fitness_level_min`, so a runner doing
25 km/week who selects "experienced" cannot reach them (Willy). The dropdown
opens a door; demonstrated volume decides whether it leads anywhere.

**Config.** `SESSION_WORK_OVERRIDE_MINS` (per-row work-minute band).
CV band fractions live inline in `buildPaceFromVDOT` alongside E/T/I, per
CLAUDE.md's standing exemption for that function's Daniels coefficients, and are
derived for the no-benchmark path via `CV_PACE_RATIO_OF_T`.

**Mechanical check.** `INV-PLAN-OVER-UNDER-MEAN-NEAR-THRESHOLD` — the §19 margin
above is NOT self-enforcing, because §19's numeric arm fires on the label and
"Over-unders" contains none of the words it watches (SC-08's label-evasion hole).
The invariant is keyed on `catalogue_id`, never the label, since §22 renames the
row on a goal-pace week and the enricher may rename it again.

**Board:** CB-CAT-01, 2026-09-04 — CORRECT WITH AMENDMENT. Hutchinson chairing;
amendments from Sims (own dose band), Willy (volume gate), McMillan (whole-minute
rungs), Seiler (no selection preference — over-unders stay one row among many).
Origin: CAT-DEPTH-01. See `docs/decisions/catalogue-additions-proposal-2026-09-04.md`.

---

## 86. A fixed-shape session still owes the runner a dose and an honest length

**Principle.** A session whose shape does not repeat — a ladder, a pyramid — must
still (a) state a duration its own structure fits, and (b) respond to the
runner's dose band where it has any means to. "Fixed shape" describes the
STRUCTURE, not a licence to ignore the band.

**Why (a).** `threshold_ladder` took its duration from the generic
quality-session formula rather than its own steps, and told a marathon runner
**61 minutes** for a 3-5-8-5-3 ladder whose structure needs **50**. Eleven
minutes of fiction on a session the runner then has to fit into a Tuesday
evening. McMillan: *"the runner finds out on the road."* Measured, two rows —
`threshold_ladder` and `hm_pace_intervals` — were **36 of 306 quality sessions
(11.8%)** still on the flat share after SIZING-REALLOC-01 closed for the other
nine. Not an architectural gap; two rows that were missed.

**Why (b), and the constraint on it.** A parameterised fixed-shape row selects
between VARIANTS, and variant selection was `weekN % variants.length` — a
rotation. For a pyramid the variant IS the dose (16 vs 23 minutes of threshold
work), so rotation made it the one session in the plan that ignored the band
entirely: an experienced runner could draw the 16 and an intermediate the 23.
Dose-aware selection picks the variant whose work minutes land closest to
`THRESHOLD_WORK_TARGET_MINS[fitness][phase]`.

**It is OPT-IN per row (`parameterisation.select_by`), and that is Seiler's
condition, not an implementation convenience.** Variants are normally a VARIETY
dial — 45-second and 90-second hill reps are different sessions to run, and
alternating them is deliberate. Converting every variant set to "pick the
biggest that fits" would raise training load under the name of selection. Rotation
stays the default; a row opts in only where the variant genuinely is the dose.

**What this does NOT license — `rep_length` scaling (recorded so it stops being
proposed).** The obvious way to make dose continuous is to scale rep LENGTH, and
`scaling: 'rep_length'` is declared in the v2 schema and read by nothing. **It is
blocked by doctrine, not by effort.** SC-08 makes rep length the *stimulus
identity*; EG-01 rejected re-specifying `intervals_long`'s on exactly this
ground — *"shorten it and the row becomes `intervals_classic` with extra
steps"*. Rep COUNT is the dose; rep length is what the session IS. This is the
third time the lever has been proposed and the first time the block has been
written down.

> **Re-vetoed a FOURTH time — CAT-DEPTH-01 Phase 2, 2026-09-09 (unanimous).** The
> proposal returned in discrete clothing: *collapse `tempo_cruise`/`tempo_cruise_short`
> into one parameterised row and `select_by: 'dose'` over whole-minute rep-LENGTH
> variants*, so a fitter runner draws longer reps. **Same lever, same veto** — rep
> length carrying the dose, plus Seiler's exact "converge on the biggest that fits"
> failure, plus it kills the within-plan variety the two rows currently alternate.
> Recorded because the item's own backlog still called rep_length *"the most likely
> Phase 2 lever"* — it is not a lever, it is a wall. The *collapse* refactor itself
> (with `select_by: 'rotation'`) remains permissible as variety, but it is not
> fitness-differentiation and does not close CAT-DEPTH-01. Whether the already-shipping
> plan-level differentiation (row eligibility + rep count + §8 quality count + §89
> onset) is commercially sufficient is an **SLT** question, not a coaching one.

**Also not re-opened: per-category sizing percentages.** CD-14 built and swept
them — 15% produced 187 ordering breaches and 220 undersized sessions, 17% broke
the ordering outright. That measurement stands.

**Config.** None new. Dose-aware selection reads the existing
`THRESHOLD_WORK_TARGET_MINS` / `VO2MAX_WORK_TARGET_MINS` bands and
`SESSION_WORK_OVERRIDE_MINS`; fixed-shape sizing reads the row's own steps and no
config at all — a ladder's dose IS its rungs.

**Mechanical check.** `INV-PLAN-STRUCTURED-SESSION-DURATION-COHERENT` extended
from `scaling: 'reps'` rows to the fixed-shape SIZED rows. Its documented blind
spot used to read *"threshold_ladder and any other `scaling: 'fixed'` shape stay
excluded"* — and the 61-minute ladder sat inside it. **The extension was itself
silently dead on first write**: it parsed step lengths and required a unit
suffix, so every step-set containing a `1:30` recovery returned null and the
session was skipped. It reported green with the defect deliberately reintroduced.
Falsification found that; the assertion alone did not. See
[[feedback-verification-must-reach-the-change]].

**Board:** CB-CAT-02, 2026-09-04 — CORRECT WITH AMENDMENT. Hutchinson chairing.
Amendments: Seiler (opt-in, no convergence on the longest variant), McMillan
(fix the ladder's stated length; keep hill-rep rotation), Willy/Sims (a fixed rep
count applied to everyone was set for someone and inherited by the rest).

**Ruled and then REVERTED in the same sitting: `hm_pace_intervals` v1 → v2.** The
migration was correct in principle — `reps: 4` hardcoded for every runner at every
fitness — and could not ship. Anchored at `goal` it threw on every finish-goal
plan; anchored at `HM` (its v1 pace) it threw for a **structurally-beginner**
runner, who has no HM pace by §24b yet can draw the row through an upward
declaration (§79's two axes). Failing soft breaks `INV-PLAN-DERIVED-SET`, which
requires a v2 row to stamp one. **The blocker is that eligibility cannot express
"this row needs a pace this runner has"** — filed, not forced.

---

## 87. A recovery week must not open a phase

**Principle.** §3 sets the recovery CADENCE. This sets where those weeks are
allowed to LAND: a deload may not fall on the first week of a phase. Where the
cadence would put one there, the cadence is shifted EARLIER and re-anchored from
that point — so the runner arrives fresh INTO the new block rather than being
deloaded on its opening week.

**Why.** The cadence was computed from absolute week number and knew nothing
about phase boundaries. Measured across 24 plans (6 distances x 2 day-counts x 2
ages), a deload landed on the **first week of build in 25% of them**, dropping
volume **30-41%** at the moment the plan says the hard work begins — and pushing
the first quality session back a week (HM W6→W7, 50K W8→W9, 100K W9→W10). 71%
entered build with no volume step-up at all.

**The argument that nearly saved the old behaviour, and why it fails.** A deload
immediately before a hard block is good coaching — arriving fresh into build is
a real argument, and Hutchinson made it. But the data showed the cadence landing
there *by arithmetic accident*: sometimes the week before build, sometimes its
first week, sometimes neither, decided entirely by where week 1 fell relative to
the phase split. **A defensible outcome reached at random is a coincidence, not
a decision** — and a coincidence lands wrong as often as right.

**What the runner experienced (McMillan).** They finish base, see "build" on the
card, and the week is easier than the one before it. Then no quality session
either. Two weeks where the plan visibly says *progressing* and the training says
*nothing is happening*.

**Why a +/-1 shift is unimplementable, and the mechanism that works.** Moving a
deload one week in either direction steals a week from one loading block and
gives it to the other, so Sims's amendment (never lengthen a loading block past
what the cadence promised) rejects BOTH directions whenever the cadence divides
evenly. On the HM masters case the raw cadence is `{3,6,9}` with a worst loading
run of 2; `6→5` yields a run of 3 and `6→7` also yields 3. **Measured, nothing
moved at all — while the code read perfectly plausibly.** Walking the plan
forward and RE-ANCHORING the cadence from each placed deload satisfies both
rules: the same case yields `{3,5,8}`, worst run still 2, count still 3.

**Recovery may RISE, never FALL (Willy, revised at ratification).** The condition
was first written as "shift, never skip — count preserved exactly", to stop
recovery being traded away for earlier intensity. As strict equality it would
also have forbidden *correcting* a cadence that was under-delivering: an 8-week
masters plan produced a single recovery week (`{3}`) because week 6 fell in peak
and week 9 did not exist. `{2,5}` is the 3:1 cadence §3 actually promises. So the
rule is a **direction, not an equality** — measured across 504 plan shapes,
placement never removed a deload and added one in 50, every one of those a case
where the raw cadence was short.

**Explicitly NOT ratified: starting quality earlier by removing recovery.** That
is the trade the original request implied and the board declined it. The ultras
are where deloads matter most — a 50K runner dropping 79 km to 47 km is not a
defect, that is recovery working (Willy).

**Config.** `GENERATION_CONFIG.DELOAD_PLACEMENT`.

**Mechanical check.** `INV-PLAN-DELOAD-PLACEMENT` — no deload opens a phase, and
the recovery count never falls below the raw cadence. Scoped to `base`/`build`
only: an exclusion list caught `foundation` and `maintenance_*` weeks, which are
composed after generation (ADR-020) and can carry week numbers <= 0, and two
real stored plans failed a rule about weeks the generator never owned.

**Ownership.** `lib/plan/deloadCadence.ts → computeDeloadWeeks()` is the single
owner, computed once per plan and read by all five consumers (DELOAD-OWNER-01).

**Board:** CB-DELOAD-01, 2026-09-04 — CORRECT WITH AMENDMENT, ratified after
re-measurement. Hutchinson chairing.

---

## 88. The VO2max pool owes dose granularity and a continuous shape

**Principle.** The 5K/10K build+peak VO2max pool gains two rows whose job is not a
new stimulus but a *reachable* one: **`intervals_30_30`** (30s @ I / 30s @ E,
continuous) and **`intervals_rolling`** (300m @ I / 300m @ E float, continuous).
Both are `category: vo2max`, sized on the existing `VO2MAX_WORK` band (12–18 min of
work at the I anchor), gated `fitness_level_min: experienced` with a `min_weekly_km`
floor. Neither adds a session to any week — they enrich *what* the single build /
peak VO2max slot can contain (§79, §53).

**Why — the pool was quantised and had a hole.** §338 already records that our VO2max
dose is a set of integers, not a continuum: with 3-min / 400 m / 1000 m reps the only
reachable doses are `reps × rep-length`, and the fitness×phase target routinely sits
*between* two of them — "a direction of travel for rows whose rep length doesn't divide
the band." A **30-second rep divides the band finely** (24–36 reps span 12–18 min in
half-minute steps), so the target becomes reachable rather than approached. That is
the whole of `intervals_30_30`'s value, and it is a fix to an acknowledged limitation,
not a new toy. Separately, the pool had **no continuous VO2max shape at all** — every
VO2max row was rep-and-jog-recovery. `intervals_rolling` is the fast-float: the float
is run, not jogged, so the heart rate never fully drops and time-at-vVO2max accumulates
across the whole set. Both are canonical amateur sessions (Billat 30-30; the "rolling"
surge set) that the catalogue simply lacked.

**Seiler's condition — the float is easy and it is meant.** A fast-float dies if the
float drifts to the grey zone; then the whole set is threshold-in-disguise, the exact
failure this product exists to prevent. The float step is anchored **E with
`mode: ceiling`** — a bound, not a suggestion. `intervals_rolling` is only correct if
the fast is truly fast and the float is truly easy.

**Willy's gate — turnover volume is where tissue fails.** 24–36 hard surges (30-30) or
a 30-minute continuous fast-float is high foot-speed and high turnover volume, and
cardiovascular readiness outruns musculoskeletal readiness for exactly the returning
runner. Both rows carry `fitness_level_min: experienced` **and** a `min_weekly_km`
floor (the §53/CB-CAT-01 mechanism that stops a 25 km/week runner ticking a dropdown
into tier-4 work), and both inherit §2196's re-entry withholding automatically by being
`category: vo2max`. `min_weekly_km` is set at the over-under's floor for the rolling set
and one step higher for 30-30, whose rep count is the highest in the catalogue.

**Sims — the bone-loading upside is real and it is why these reach women too.** Short,
fast, force-producing work is bone stimulus specifically hard to get elsewhere in a
training week and specifically valuable perimenopause (§ hill_reps records the same).
The `experienced` + volume gate is what keeps it from landing on an under-fuelled
runner as one more hard session; the floor band (`VO2MAX_WORK_MIN_MINS`) keeps it from
under-dosing.

**10K only, not 5K — the property sweep corrected the scope.** Both rows are authored
`distance_eligibility: ['10K']`. The board approved 5K + 10K on the premise that a
`category: vo2max` row has no §22 interaction (`useGoalPace` reads `!isVo2max`, so the
goal-pace *rename* never touches them). The sweep falsified that premise for 5K: §22's
race-specific *ratio* arm (`INV-PLAN-RACE-SPECIFIC-EXPOSURE-RATIO`) is enforced at 5K —
§22 records that 5K's ratio holds because the engine prescribes "5K-pace" sessions — and
adding VO2max inventory to the 5K pool DISPLACES those race-pace sessions in the
least-used-first rotation, dropping the second-half goal-pace ratio below 50% (12 swept
plans, all `5km/experienced`). The physiology agrees with the narrowing: **at 5K, I-pace
≈ race pace**, so an I-anchored VO2 row is near-race-pace work the existing 5K rows
already deliver; **at 10K, I-pace is distinctly faster than 10K race pace (≈ CV)**, so
these are genuinely additive top-end work — 0 violations at 10K. Same "what fits the
race" scoping as `intervals_short` (5K-only) and `threshold_mile_repeats` (excludes 5K).
5K eligibility would require §22's ratio to *credit* a 5K VO2max session as
race-specific — defensible by §22's own text but a separate board amendment, not smuggled
in here. (The CV-anchored and mixed-anchor Tier A rows — cruise/CV intervals, the
descending pyramid — touch §22's *rename* and §19, and land in a later section with the
`hasUnconvertibleWorkAnchor` and multi-system-label amendments they require.)

**Config.** No new work band — the rows reuse `VO2MAX_WORK_TARGET_MINS` /
`[VO2MAX_WORK_MIN_MINS, VO2MAX_WORK_MAX_MINS]` (SC-08). The only new numerics are the
per-row `fitness_level_min` and `min_weekly_km` on the catalogue rows themselves.
Enforced by the existing **`INV-PLAN-VO2MAX-MAIN-SET-CAP`** (the work-minute band) and
**`INV-PLAN-STRUCTURED-SESSION-DURATION-COHERENT`** (the session's stated length fits
its own `derived_set`), both of which already scope to `scaling: 'reps'` VO2max rows —
so this ruling's mechanical check is inherited, not newly authored.

**Not built (SLT, 2026-09-06): standalone R-pace / neuromuscular speed sessions.** The
Coaching Board ruled the standalone speed sessions INSUFFICIENT EVIDENCE (the deciding
injury data is uncollectable, ADR-011) and the SLT declined to build them — they serve
the smallest, most self-sufficient segment and hand the "medium-hard on everything"
runner one more hard session to abuse. §16 strides remain the universal neuromuscular
vehicle. The `R` / `race_5K` / `race_3K` anchors stay **unresolved** — their only
consumers were shelved, and resolving an anchor no row uses is dead code (B0 was
attempted 2026-09-06 and reverted with the rows that needed it).

**Amendment 1 (2026-09-06, Tier A) — the CV row lands; three others are deferred.**
Of the six Tier A shapes the board ruled correct in principle, only **`cv_intervals`**
(critical-velocity cruise intervals, `category: threshold`, 4-min reps at CV) ships
alongside `intervals_30_30` and `intervals_rolling`. Implementation showed the other
three each collide with an existing, deliberate mechanic — a **principle that was ruled
correct at the concept level but cannot be delivered without amending the constitution
it meets**:
- **descending pyramid** (I→CV→T) and **10K-pace cutdown** (CV→5K→3K) are multi-system
  sessions whose VO2-zone work is only 2–6 min — **below §8's 12–18 min VO2max dose
  band**. §8 rejects them, correctly: a session that spends most of its minutes below
  vVO2max is not a VO2max dose, and forcing one into that slot mislabels the stimulus.
  Making them fit needs §8 to gain a *mixed-session* dose model — a board question.
- **broken ladder** (a 4th I-anchored VO2 variant) is **undeliverable through §53's
  rotation**: a 10K plan carries ~3 VO2 slots against a 7-deep VO2 pool, and the
  least-used rotation cannot surface a redundant 7th shape (measured 0 / 216 plans).
  Shipping it would be SC-05 dead weight.
These are tracked in backlog **CAT-VO2-TIERA** for a dedicated board sitting; the
concept ruling stands, the delivery does not.

**Board:** this ruling, 2026-09-06 — CORRECT WITH AMENDMENT, Hutchinson chairing;
Seiler's float condition and Willy's gate are conditions of approval. `cv_intervals` is
threshold-domain (does not consume the ≤1 build VO2 slot, SC-07) and named to avoid a
false threshold pace-label (§85 shields its CV anchor from §22).

---

## 89. Experience-gated quality onset — a demonstrated base earns a shorter one

**Principle.** A runner who is **demonstrably ready** starts quality sooner, via a
**shorter (still all-easy) base** — not the fixed ~4-week base every runner gets today.
"Demonstrably ready" (`earlyQualityOnset`) requires **all** of: experienced *intensity*
(declared or assessed), structural fitness **≥ intermediate** (a real volume base),
deep training age (`2-5yr`/`5yr+`), **not** returning and **not** fresh-from-layoff
(they have a *current* base, not a memory of one), and — the signal that makes it
honest — `recent_quality_training = 'regular'`: they have been doing structured hard
sessions (intervals/hills/tempo) most weeks recently. **An injury history is an
absolute veto.** For such a runner, base uses `EARLY_ONSET_BASE_PCT` (15 vs 35); the
freed weeks flow to build and peak; the 2-week base floor (the existing `Math.max(2, …)`
in `computePhases`) always holds. Everyone else is untouched.

**Why.** The engine could not tell a beginner-with-a-base from an experienced runner
mid-block — both got the identical 4-week all-easy base, so a runner doing 30 km/week
with a 10 km long run who has been running intervals and hills for two months outside
the plan got a beginner's onramp: first quality at week 5 of a 12-week plan, the first
third of the plan indistinguishable from a novice's. They do not need four weeks to
rebuild an aerobic engine they already have and are actively using. §5 says base is
*general aerobic* work; for a conditioned runner that base is **maintenance, not
building**, so shortening it is descriptively correct, not a shortcut.

**This is NOT the base-primer §88's sibling vetoed.** §1's veto was of *adding quality
to base* (spending the quality-session budget in base's grey zone for an overtraining
population). This adds **no** quality to base — base stays 100% easy — it makes base
**shorter**. The distinction is the whole ruling: `computePhases` moves a boundary; it
never puts a hard session where an easy one belongs.

**The tonnage CEILING is unchanged — the §79 hinge, stated precisely.** §79 rules that
agency raises *intensity*, never *tonnage*. This extends §79: the intensity signal
governs *when* hard work starts, not only how hard it is. The **structural peak target
(`peakKm`) is untouched** — it is set by structural fitness, which this signal does not
move — and the ramp cap (§2) is untouched. What *does* change is that a shorter base
leaves more build/peak weeks, so the delivered curve ramps **more gradually** and
reaches that same ceiling slightly more fully (measured **+~4%** delivered peak on the
example, never above the structural target). Crucially the volume peak lands **later**
than the intensity onset, so intensity is **not pulling volume forward** — the exact
compounding Sims's condition guards against. A gentler ramp to an unchanged ceiling is
not "more tonnage" in the injury sense; it is the runner completing the progression
their structure already permits. Beginners (no experienced intensity) and returners (no
current base) keep the full base by the gate, so no one gets load their tissue has not
earned.

**The signal is a tissue-readiness proxy, and that is Willy's condition.** §79's
progressive re-entry (the "§2196" block above) exists because *cardiovascular readiness
returns weeks ahead of musculoskeletal readiness* — a runner **feels** ready for
intervals before the tissue is. `recent_quality_training = 'regular'` is the one thing
that falsifies that premise for a specific runner: they have **already loaded the
tissue with the exact stimulus** — recent, regular intervals and hills — so their
tendons and bones have seen the eccentric and impact loads. It is a demonstrated
*practice* question ("have you been doing it"), not a self-image one ("are you
experienced"). The injury veto stands because a self-report is about fitness and an
injury is about the tissue; the report cannot overrule a documented structure
(Willy/Sims).

**Lever A — the same signal relaxes re-entry, intensity-only.** A runner who **is**
returning (re-entry active) but reports `'regular'` conditioned training has the §2196
VO2max/hill withholding **shortened to `REENTRY_WEEKS_TISSUE_READY` (1 week), not
zeroed** (Willy: one week of tempo-first is cheap insurance). The **volume** caution —
the returning-runner ramp allowance — is **untouched**: tissue-stimulus readiness and
chronic-volume readiness are different things, and the signal speaks only to the first.

**Tier: FREE (SLT, 2026-09-06).** Plan *structure* — when quality starts — is the plan
itself, not a richness layer, so it cannot sit behind the paywall without abandoning
free experienced runners to a plan built wrong for them ("Free Users Are Never
Abandoned — gate richness, never access"). The paid line (AI coaching voice, dynamic
reshape) is untouched. The wizard question is framed as *recognition, not reward*
("you've got a base; we won't make you re-prove it"), factual and past-tense, so it
cannot be gamed into an "unlock harder training" incentive — the over-claiming risk the
brand exists to prevent. The consequence of over-claiming is bounded anyway: one
session slightly early, no added tonnage, easy-day discipline (§12) intact, injury veto
absolute.

**Config.** `EARLY_ONSET_BASE_PCT = 15` (the shorter base fraction),
`MIN_BASE_WEEKS_FLOOR = 2` (the base-week floor, formerly a hardcoded `Math.max(2, …)`
in `computePhases`, named per the Configuration Singularity so the phase builder and
`INV-PLAN-EARLY-ONSET-GATED` agree), `REENTRY_WEEKS_TISSUE_READY = 1`. Input: `recent_quality_training` on `GeneratorInput`. Surfaced as
`meta.early_quality_onset`. **Enforced by `INV-PLAN-EARLY-ONSET-GATED`.**

**Amends §79** (intensity governs quality *timing*, not only hardness/count; zero added
tonnage), **§5** (a demonstrated base earns a shorter maintenance base, floored), and
the §79 progressive-re-entry block (Lever A relaxation, intensity-only).

**Board:** §89, 2026-09-06 — Coaching Board CORRECT WITH AMENDMENT (injury veto, volume
floor, 2-week base floor, no added tonnage, intensity-only re-entry relaxation, matrix+
sweep clean); SLT FREE with recognition-not-reward framing. Hutchinson chairing both.

---

## 90. A recovery week reduces, and the injury cap holds at delivery — the curve is not the promise

**Principle.** Two coaching promises are made to the runner about *what they will
actually run*, and both were being enforced only on the internal volume **curve**,
not on the **delivered** week the runner sees:

1. **A deload week carries less than the week before it (§3).** A "recovery" week
   badged as such must deliver less volume than the week preceding it. Full stop.
2. **An injury-history runner's week-on-week rise stays within §2's injury cap (5% for
   knee/shin) at DELIVERY.** The cap is a promise about the load on healing tissue —
   it means nothing if it binds the curve but the placed sessions exceed it.

**The gap.** The engine computes a volume *curve* (`buildVolumeSequence → volumes[]`)
and enforces §2 (including its injury cap), §3 and §52 on it. But the runner never sees the curve — they see
`weekly_km = sumWeeklyKm(placed sessions)`, and session sizes are computed
**independently** of the curve ceiling: the race-anchored long run (§45/§47/§80),
peak quality (two sessions, §8), and easy runs (floored at `MIN_SESSION_DISTANCE`).
Nothing trimmed them to fit. So a plan with a perfectly-shaped, green curve could
still **deliver** a deload week bigger than the week before it, or a +39% week to an
injured knee — the exact spike §2's injury cap exists to prevent, shipped past a green validator.
Measured on the 2026-08-20 baseline: deload inversions **12.8%** of plans at the
curve; injury bouncebacks delivering ≥ pre-deload **18.8%**.

**What ships (DELOAD-INVERSION-01).** Three levers, in this order:

- **Deload curve fix.** A deload is now `min(existing, RECOVERY_WEEK_VOLUME_PCT × the
  POST-CAP prior week)`, not 70% of the uncapped `lastBuildVol`. The old form took 70%
  of a curve value the prior week had then been capped *below* (injury/ramp) — so
  "70% of uncapped" ≥ the delivered prior, and the deload reduced nothing. Re-anchoring
  to the actual prior week is §3's literal intent. Curve-level deload inversions
  **12.8% → 0%**. Deloads also keep their session *frequency* — the day-count grosses
  the deload target back up before dividing by `MIN_KM_PER_TRAINING_DAY`, so a recovery
  week is lower-volume, not fewer-days.
- **§8 yields to §2's injury cap on injury peak weeks.** An injury-capped (knee/shin) runner's peak
  week carries **one** quality session, not two. §8 grants the second to an experienced
  runner; §2's injury cap takes it back when the tissue is the binding constraint. This is what
  makes the delivered cap *achievable* — without it, two quality sessions plus the long
  run already exceed the ceiling before a single easy km is placed.
- **Easy runs trim/drop to the ceiling; the long run never does.** On an injury-capped
  week, easy volume is reconciled down to fit the cap. The **race-anchored long run is
  never trimmed** — §52 owns it ("the race sets the long run; do not deform it; if it
  ALONE breaks the cap, classify `maintenance`"). So the enforceable delivered promise
  is on the **trimable (non-long-run) portion**.

**Scope — injury runners only, and this is deliberate (Hutchinson, firm).** The
delivered *ceiling* reconciliation is applied only to knee/shin-history runners, whose
binding promise is the 5% cap. A **healthy** runner's delivered divergence from the
curve stays §52's accepted territory — the race sets their long run and the engine does
not deform a whole week's structure to make a low-volume week's arithmetic tidy. One
new maintenance trigger is added for the corner where even this cannot hold: an
**injury history + a beginner's current volume + an ultra target** (`distKm > 43`)
cannot safely build to the distance, so it classifies `volume_profile = 'maintenance'`
with a note, rather than shipping an unsafe ramp.

**Honesty about the residual.** The delivered promise is **not** fully closed, and that
is stated rather than hidden. On low-volume, low-day injury plans the easy floor
(`MIN_SESSION_DISTANCE`) dominates — you cannot place half an easy run — so the trimable
portion can still rise above the cap (measured max on a 5 km/3-day/low-volume knee
runner: an 8→16 km non-long jump). And the §52-protected long run still inflates the
*whole-week* delivered rise on peak weeks (the residual `injuryCapCompounds.test.ts`
tolerances at `cap + 15`). These residuals are the delivered≠curve class in its last
mile; closing them means reconciling long-run placement itself, which is a separate §52
question with its own ruling — not this change.

**Config.** No new coaching numeric — the deload fix reuses `RECOVERY_WEEK_VOLUME_PCT`
(§3) and the injury cap reuses `INJURY_WEEKLY_INCREASE_CAP_PCT` (§2); the injury
peak-quality count is `1` by the §8/§2-injury-cap precedence, not a new constant; the ultra
maintenance trigger reuses the existing marathon/ultra distance boundary. **Enforced by**
`INV-PLAN-DELOAD-IS-A-REDUCTION` (`warn` — curve fixed, delivered residual pending),
`INV-PLAN-INJURY-CAP-DELIVERED` (`warn` — the trimable-portion cap, §52 long run
excluded by construction), and `INV-PLAN-BOUNCEBACK-BOUNDED` (`warn`, §2). All three are
`warn` for the same reason: the delivered arm has a measured, declared-and-exercised
residual (§34) and becomes `error` when long-run placement is curve-reconciled.

**Board:** DELOAD-INVERSION-01, 2026-09-06 — Coaching Board CORRECT WITH AMENDMENT
(Willy-led: the 5% cap is a delivered promise for injured tissue; lever order
quality→easy→never the long run; injury-only scope; healthy stays §52; ultra+beginner+
injury → maintenance). Amends §2's injury cap, §3, §8, §52 by reference; does not loosen any of them.

**Amendment CHARITY-CAP-ABSFLOOR-01, 2026-09-13 — the delivered cap has an absolute-km
floor beneath the percentage.** A percentage on a LOW base magnifies a clinically
trivial rise: measured on the charity cohort, a knee-history masters 10K runner
(T3, 20 km/wk) adding **+3 km** of non-long-run volume trips the 5% delivered
injury cap at **+38%** — while the change is one short easy run. Surfaced by the
2026-09-13 charity-cohort board sitting, which ruled the plan itself fit to ship
and filed this as the follow-up. **The delivered-cap warn now fires only when the
week-on-week rise exceeds BOTH the % cap AND `DELIVERED_ABSOLUTE_FLOOR_KM` (3 km).**
Set on measurement: across a 2,790-plan injury/low-volume grid the flagged
non-long-run rises spanned **1–7 km (median 4)**; a 3 km floor silences the ≤3 km
arithmetic noise (**49%** of flags) while keeping **every rise ≥3 km** — so no real
low-base spike is masked. Sims' condition of approval: the floor stays at 3 km, not
5 km, because a 5 km floor would mask the genuine 4–7 km steps that appear on low
bases. Willy: this **sharpens** the signal — a warn that fires on trivial rises is
noise, and noise gets ignored, which is how a real breach is missed later (§1's own
standard). **It gates the CHECKER's warn, never the engine's trim** — the producer
still caps to §2's injury cap; the change does not loosen §2's injury cap, §52 or §90's lever order, it
narrows what the delivered warn reports to what a coach would act on. Applies
symmetrically to §94's healthy delivered ramp (measured on the whole-week rise
there). **Board:** CORRECT WITH AMENDMENT, Hutchinson chairing, Willy leading,
Sims' 3 km condition binding. Enforced by `INV-PLAN-INJURY-CAP-DELIVERED` (§90) and
`INV-PLAN-DELIVERED-RAMP` (§94).

### Amendment 1 — when the trim removes an easy RUN, quality yields (S1-INJURY-DENOMINATOR-01, 2026-09-15)

**Principle.** When §2's injury-cap trim has reduced a week far enough that the plan's
quality share would exceed §1's ceiling, the engine **converts a quality session to
easy** rather than letting the ratio stand. One session at a time, latest first,
until the plan complies. The week records the reason (`Week.quality_downgraded`,
trigger `injury_intensity_ceiling`), which is what earns it §102's exemption from
`INV-PLAN-QUALITY-EXPECTED`.

**Why.** The levers above trim easy volume and, as this section already says, easy
runs *"trim/**drop**"*. Trim far enough and §52b day-fitting removes a whole day,
and the day it removes is always an easy one, because §52 protects the long run and
§8 protects the quality slot. §1 counts **sessions** (CD-19), so the denominator
falls while the quality count holds and the plan breaches its intensity ceiling
**with no intensity having been added**. Measured, same runner, one field changed:

| `injury_history` | running sessions | quality | share | |
|---|---|---|---|---|
| `[]` | 46 | 8 | 17.4% | clean |
| `['knee']` | 39 | 8 | **20.5%** | breach, MARATHON ceiling 18% |

Willy, at the board: *"we are removing the thing that heals and keeping the thing
that provokes."* For patellofemoral pain the provoking load is high-magnitude work;
easy running is the tolerance-building stimulus. Seiler: under load the engine was
converting a polarised plan into a threshold plan, which is the failure this product
exists to prevent.

**This is not a new principle.** §90 already ruled *"§8 yields to §2's injury cap on injury peak
weeks"* — scoped to peak weeks and the second quality session only because that was
the case in front of the board. The reasoning was never peak-specific.

**Rejected alternatives, recorded.** Raising the MARATHON ceiling (the 50K remedy of
CB-INTENSITY-50K-01) would spend §1's headroom for every healthy marathoner to
accommodate six injured ones; that ruling turned on **distance**, this trigger is
**injury**. Holding a fourth easy run to preserve the denominator was vetoed by
Willy: kilometres on an injured knee to satisfy a ratio. Excluding injury-trimmed
weeks from §1's denominator (as foundation weeks are excluded) was rejected by
Hutchinson: foundation weeks are all-easy by construction and cannot hide intensity,
whereas injury-trimmed weeks are where intensity concentrates.

**Config.** `GENERATION_CONFIG.INJURY_QUALITY_YIELD_TO_INTENSITY_CEILING` — a flag,
not a threshold. The threshold already exists as `INTENSITY_DISTRIBUTION[distance]`,
and a second constant declaring the same ceiling is the §25 `race_pace_pct` failure.

**Mechanically checked by `INV-PLAN-INTENSITY-DISTRIBUTION`, which already existed
and already fired.** No new invariant: the yield is the engine obeying a check it
was failing, not a new claim needing one. Its liveness is proved by a named
falsification test instead (`lib/plan/injuryIntensityYield.test.ts`).

> ⚠️ **CONVERT, NEVER DELETE, and the arithmetic is the reason.** Deleting the
> session takes the denominator down with the numerator and does not even fix the
> breach: 38 running / 7 quality = **18.4%, still over**. Converting holds the
> session count: 39 / 7 = **17.9%**, compliant. Deletion is the obvious
> implementation and it is wrong.

> ⚠️ **Hold the DURATION, not the distance.** The board's amendment said "at the
> same distance". Building it that way broke `max_weekday_mins`: an easy run is
> slower than the quality it replaces, so the same distance is a *longer* session.
> §1 counts sessions, so distance cannot move the ratio at all. Holding the runner's
> evening keeps the denominator just as well and lowers the load, which is the
> direction §12 wanted. **The board's intent was right; the quantity it named was
> not the one carrying the intent.**

> ⚠️ **Three rules had to be re-served after the conversion, all found by measuring
> rather than reasoning:** §9's long-vs-easy *ratio* (a quality session floored at
> `MIN_SESSION_DISTANCE_KM.quality` can exceed a taper week's long run), §28's stride
> note (the stride pass runs at week build, so a week that gains its only eligible
> easy day afterwards was never served — 274 sweep violations), and §27's week copy
> (a label promising intensity the week no longer contains).

---

### §90 — RECORDED FINDING: the easy-run trim has no floor, and for one cohort the build phase collapses (Coaching Board 2026-09-19, S52-LOPSIDED-BOUND-01)

**Ruled CORRECT by the board, including by the seat that authored ADR-022. The instrument is NOT yet chosen and nothing has shipped — §90 is unchanged.**

§90 states *"Easy runs trim/drop to the ceiling; the long run never does."* **It does not say how far they may drop.** `ruleEngine.ts:3550` resolves that silence as `Math.max(1, …)` — one easy run — while the producer computed a running-day floor of `Math.max(3, …)` seven hundred lines earlier (`:2847`) and the trim never consults it. **A floor is computed and a later pass discards it: the same shape as §113 Amendment 1, for the third time in two days.**

**Perfect cohort isolation** (cohortGrid + targetedGrid, coprime stride, runners declaring ≥4 days; a *collapsed week* is a build/peak week delivering ≤2 running sessions):

| cell | plans | any collapsed week | **≥ HALF the build/peak phase collapsed** | longest consecutive run |
|---|---|---|---|---|
| healthy × established | 2,722 | 0.0% | 0.0% | 0 |
| healthy × fresh-return | 873 | 0.0% | 0.0% | 0 |
| injury × established | 374 | 0.0% | 0.0% | 0 |
| **injury × fresh-return** | **361** | **11.4%** | **11.4% (41 of 41 affected)** | **max 7, p95 7** |

**Three cells at exactly zero and one at 11.4% is an interaction, not a gradient** — removing either factor alone fixes it, verified factorially. And every affected plan loses at least half its build phase: **seven consecutive two-run weeks** is the typical case, not the worst one.

**The worst case in full, printed rather than summarised.** Knee history, fresh return (`weeks_at_current_volume: 4`), beginner, 30 km/week, longest 12 km, **four days declared**, marathon finish, 18 weeks:

| wk | 1–6 (base) | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 (peak) | 15–17 (taper) |
|---|---|---|---|---|---|---|---|---|---|---|
| runs | 4 | **2** | **2** | **2** | 4 | **2** | **2** | **2** | **2** | 3–4 |
| long-run share | 31–38% | 71% | 78% | 83% | 46% | 79% | 83% | 86% | **87%** | 37–48% |

Six sensible base weeks, then the build and peak phases become **a long run with a jog attached**, then a taper. §9's own sizing for week 14 is **9.6 km** (`LONG_RUN_PCT_OF_WEEKLY_VOLUME.peak` = 32% of 30 km); the engine prescribes **26.0 km — 2.7× its own rule.**

**Willy, who wrote ADR-022:** *"I wrote it to stop the delivered week exceeding the ceiling. I did not specify how the week should be composed once it fits, and the engine resolved that ambiguity by deleting the easy runs. Thirty kilometres over four days is a materially safer week than thirty kilometres over two, and the cap treats them as identical. The ceiling is correct; what is wrong is that 'trim the easy runs' has no floor, and I should have given it one."*

**Hutchinson:** the collision is **§80's specificity ramp against §90's injury ceiling**, and nobody wrote down which wins. ⚠️ **§24 does NOT bind here** — it governs `time_target` only and this is a `finish` goal, so no principle actually requires 26 km in a 30 km week. **§9 already forbids it at 28–40% and nothing enforces §9's share.**

**Seiler:** a two-run week halves §1's session-count denominator. No quality is placed in these weeks so nothing fires today — but one quality session in a two-run week is a 50% share against an 18% ceiling. **The engine has two independent routes to a week too small to hold a distribution, and neither is guarded.**

**McMillan:** the runner declared four days, received two, and the note shown to them says *"the lever is the other days: more running across the week"* — **advising them to do the thing the engine just removed.**

**Sims:** 26 km off a 12 km longest run is over two and a half hours for most of this cohort, and the plan has removed the shorter runs where fuelling would be practised. `weeks_at_current_volume: 4` is frequently post-injury, post-illness or post-partum in this population.

**Binding conditions on any fix (board):** (1) must not raise the injury ceiling; (2) must not re-open `LR-DELOAD-RESUME-01`'s reverted failure (low-base beginner 7.3 → 18.5 km); (3) must be measured on the **property sweep**, not a hand-rolled grid; (4) `measure:fitness` before and after. **Do not add a third per-week §52 bound** — that instruction survives; a floor on composition is a different object.

⚠️ **Instrument deferred, and the reason is honest: every candidate reachable without a new number is blocked.** More easy runs at the configured `MIN_SESSION_DISTANCE_KM.easy` (4 km) would push the week above the ceiling, which condition (1) forbids; a sub-floor easy run needs a new constant, which is the ruling the board declined to make on argument alone.

**No invariant exists for this and one should.** §64 floors **rest** days; there is no converse anywhere in the constitution, so nothing checks that a week delivers the running days the runner declared.

## 91. The on-ramp is counted in weeks the runner runs, not weeks in an array

**Principle.** The all-easy on-ramp that must precede a runner's first quality
session (§89's `MIN_BASE_WEEKS_FLOOR`, Seiler's condition of approval) is measured
as **base weeks + §57 foundation weeks**, not base weeks alone. For a §89-gated
runner, base is additionally capped in **weeks** (`EARLY_ONSET_BASE_MAX_WEEKS`),
not only as a fraction of plan length.

**Why — §89 did not deliver what §89 says it delivers.** §89 states its own purpose
in numbers: *"first quality at week 5 of a 12-week plan ... the first third of the
plan indistinguishable from a novice's."* It shortens base 35% → 15% so quality
starts ~2 weeks sooner, and it does — **inside `plan.weeks`**. But §76 anchors the
plan to race week and caps its length at the distance's `idealWeeks`, so a runner
whose race is further out has the surplus **delayed**, not truncated; ADR-020 then
fills the delay with up to three all-easy foundation weeks; and `computePhases`
never saw them. Measured on the founder's live 10K input, delivered onset by
weeks-to-race was:

| weeks to race | foundation weeks | onset in `plan.weeks` | **onset the runner counts** |
|---|---|---|---|
| 12 | 1 | 3 | 4 |
| 13 | 2 | 3 | **5** |
| 14 | 3 | 3 | **6** |
| 15 | 3 | 3 | **6** |
| 16+ | 0 | 3 | 3 |

**The relationship is non-monotonic, and that is the tell.** A runner who entered
their race 14 weeks out waited *six* weeks for quality; one who entered it 20 weeks
out waited *three*. Planning further ahead made the plan more conservative, which
no one decided and no coach would defend. **62% of swept plans (9,905/16,035) carry
a foundation block**, so this was not an edge case — it was the majority case, and
it returned §89's cohort to almost exactly the week-5 number §89 was written to fix.

**Why the credit is legitimate and not a loophole.** §57 foundation weeks are
all-easy running at the runner's current volume, capped at +10%/week. Base weeks
are all-easy running at the runner's current volume. **They are the same object to
the tissue.** Seiler's floor is a physiological on-ramp — a short polarised
approach before intensity — not an administrative property of which array a week
is stored in. Crediting them is descriptively correct; refusing to would be
double-counting the same easy running twice and charging the runner for it.

**Why base is now capped in weeks as well as percent.** `EARLY_ONSET_BASE_PCT` is a
fraction, so a *longer* plan re-grew the base it was meant to shorten — a 14-week
plan gave base 3 where a 12-week plan gave base 2. A demonstrated base does not
need more on-ramp because the race is further away. The cap makes §89's effect a
fixed quantity of easy weeks rather than a proportion of an unrelated number.

**Base may reach zero, and that is the intended terminal case** — two foundation
weeks *are* the two-week floor. It is never negative, and the floor binds in full,
unchanged, for every runner the §89 gate did not pass (beginners, returners,
fresh-from-layoff, and anyone with an injury history).

**What the board REFUSED, and why it matters more than what it approved.** Two
routes to the founder's stated ask — quality in calendar week 1 — were put and
both were declined:

- **Quality sessions inside the foundation block.** §57's CB-1 ruling (2026-09-03)
  already states the block's job is *"habit and routine, not adaptation"* and
  records that finding *"so no future reader mistakes it for a training stimulus
  and starts optimising it upward."* That is this proposal, three days later.
  Declined as written (Sims, Willy). The block's volume rules, its long-run cap and
  five of its invariant carve-outs are all premised on it containing no intensity;
  putting a hard session in it changes the object those rules were written about.
- **Dropping the floor to zero or one for gated runners.** Declined (Seiler). The
  floor is the condition on which §89 was approved at all, and removing it three
  days later on a single runner's preference is how a gate becomes decoration.

**What the board granted instead:** §57's stride prohibition is lifted for
§89-gated runners (§92). Strides are neuromuscular, fully recovered, and carry
none of the grey-zone drift risk §1 exists to prevent — so a demonstrably-ready
runner's first week can contain real fast running without the block becoming a
training stimulus. **Delivered result: quality at calendar week 3 (from 5–6), with
strides from week 1.**

**Honest residual.** At 14–15 weeks to race the runner still waits four calendar
weeks, because §57 caps the block at three weeks and all three are credited but
only two are needed. The alternative — truncating the block — was not taken, since
the weeks are otherwise the runner's own choice to train. Recorded, not hidden (§34).

**Config.** `GENERATION_CONFIG.EARLY_ONSET_BASE_MAX_WEEKS` (2);
`MIN_BASE_WEEKS_FLOOR` (2, unchanged) now applies to the SUM. The planned block
length is stamped as `meta.foundation_weeks_planned` by the single owner
`plannedFoundationWeeks()` in `lib/plan/foundationBlock.ts`, which both
`generateRulePlan` (to size base) and `composePlanWithFoundation` (to build the
block) call — they must never derive it independently, or a plan generated on a
Monday sizes its base against a different number than the one it ships with.
Enforced by `INV-PLAN-ONRAMP-FLOOR`, which replaces the base-only arm of
`INV-PLAN-EARLY-ONSET-GATED`. **That arm tested `baseWeeks === 1` exactly, so a
zero-week base — the more dangerous case — passed silently. An equality test on a
floor is a hole.**

**Board:** CB-ONSET-02, 2026-09-07 — Coaching Board CORRECT WITH AMENDMENT,
Hutchinson chairing. Amends §89 (floor basis, weeks cap) and §57 by reference
(§92). Does not loosen §4, §5 or the §57 session-content rule.

> **CORRECTION (CB-FOUNDATION-DENOM-01, 2026-09-10).** The sentence above used to
> end *"Does not loosen §1, §4, §5…"*. **The §1 half was false and was never
> measured.** The credit collapses base to zero for a demonstrated runner, quality
> starts in calendar week 1, and the delivered plan can exceed §1's ceiling:
> confirmed under production semantics at **19.0% (15/79) against MARATHON's 18%**
> for a 4-day / 60 km / intermediate runner generating 24 days out. §1 binds; the
> remedy — which lever yields to bring the share back under — is filed as
> FOUNDATION-QUALITY-YIELD-01 and is NOT settled by this ruling.
>
> Recorded because of *how* it survived: a prose claim in a board ruling did the
> job of a mechanical check for three days. §34's own lesson, one section over.
>
> **Also unresolved, and honest (§34):** on the >28-day 'choice' band the decision
> arrives after generation, so the credit is never applied — the same runner gets
> a 4-week on-ramp and quality in week 2 instead of a 3-week on-ramp and quality
> in week 1, purely on when they answered a modal. This is the *non-monotonic
> onset* defect §91 was written to fix, still live on that band. The board ruled
> the conservative default **CORRECT AS IS** on Willy's condition — never size
> base against a decision the runner has not made, because presuming 'add' and
> receiving 'skip' hands a shortened on-ramp to someone who then does no
> foundation weeks at all. The proper remedy is re-sizing when the answer lands,
> which is an ADR-020 change. Filed as FOUNDATION-CHOICE-RESIZE-01.

---

## 92. A demonstrated runner's foundation block may carry strides

**Principle.** §57's *"no strides"* rule is lifted for a runner who passes the §89
readiness gate. Every other §57 session-content rule stands: no quality sessions,
no tempo, no intervals. Strides only, on a midweek easy run, per §28's existing
placement rule.

**Why.** §57 forbids strides alongside quality because the block's population is
fresh-return and novice runners whose musculoskeletal readiness lags their
cardiovascular readiness (CB-1). §89's gated cohort is the opposite population, and
it did not exist when CB-1 ruled three days earlier — so the prohibition was
written without this runner in view rather than against them.

Strides are the one form of fast running that carries no grey-zone risk: 15–20
seconds, fully recovered, neuromuscular rather than metabolic. They are not a
training stimulus in the sense §57 is protecting (Sims's "habit and routine, not
adaptation" holds — strides do not change that), and they are not quality in the
sense §1 is protecting (they add no Z3 minutes and do not count against
`INTENSITY_DISTRIBUTION`, whose numerator is `quality` sessions).

**What this buys, stated plainly.** It is a **feel** fix, not a fitness one, and it
is recorded as such so no one later mistakes it for adaptation. A runner who has
answered *experienced*, *quality most weeks* and *bring it on* should not open the
app to a fortnight that looks identical to a beginner's. §35 already establishes
that a plan which ignores its own inputs teaches the runner to ignore the plan.

**Willy's condition of approval.** Strides are gated on the same predicate as §89 —
including the **absolute injury veto**. A runner with any injury history gets no
strides in foundation, regardless of every other signal.

**Config.** `GENERATION_CONFIG.FOUNDATION_STRIDES_REQUIRE_EARLY_ONSET` (true).
Enforced by the amended `INV-PLAN-FOUNDATION-BLOCK`, which permits strides only
when `meta.early_quality_onset` is set.

**Board:** CB-ONSET-02, 2026-09-07 — carried with §91. Amends §57 (session
content) and §28 (placement scope) by reference.

---

## 93. Peak rehearses the race — the specificity ladder is enforced, not merely declared

**Principle.** For a time-targeted 10K, the peak phase carries **at most
`PEAK_MAX_VO2MAX_SESSIONS` (2) VO2max exposures, and never more than half the
phase**; every remaining peak quality slot is race-specific work. No week may fill
both of its quality slots from the same catalogue category.

**Why — §5 has been decorative since R23.** §5 declares
`SPECIFICITY_BY_PHASE` — peak 40% general / 60% specific — and **no engine code
has ever read it.** Grepped 2026-09-07: the constant appears in
`generationConfig.ts`, in three documents, and in one `keyof` type alias. Nothing
computed it, so nobody could see what was being delivered against it.

What was being delivered, measured on 10K time-target plans: **0% specific.**
`preferredQualityCategory` opened its peak branch with

```ts
if (distKey === '5K' || distKey === '10K') return 'vo2max'
```

— unconditional, every peak week, both goals. This is the leftover CD-16 named and
did not remove: *"peak-only was a leftover from the superseded assumption that
VO2max was the specific work for a 10K."* SC-05 reclassified 10K race pace as the
specific work and VO2max as **general**; §5 then asks peak for 60% specific, and
the engine returned the exact inverse. HM, whose signature carries
`race_specific`, delivered 5/5 — so the engine could always do it, and only 10K
was wired the old way.

**This is §1/CD-19 verbatim, one section over.** That entry records: *"the table
was read by an offline script and by no engine code, and no invariant referenced
it. The value being wrong was downstream of it never being exercised."* §34 exists
to stop exactly this and §5 slipped through anyway. **Two further flags in
`planSignatures.ts` are decorative the same way and are recorded here rather than
quietly deleted: `peak_includes_race_pace` (HM) and `peak_includes_mp_long_runs`
(MARATHON) are read by no engine code.** HM's correct behaviour comes from
`quality_categories_focus`, not from the flag that appears to cause it. Anyone
reasoning from those flags is reasoning about nothing.

**Why the cap is proportional, not a flat two.** CD-16 fixed the number in prose —
*"one build exposure ... plus peak's two: three spread exposures"* — but its
arithmetic silently assumed a two-week peak. Once §91 shortened base, peak grew to
**five** weeks and the same unbounded return produced **five consecutive VO2max
sessions for a 44-year-old**, which no seat would sign. Capping at
`min(2, ceil(peakWeeks / 2))` honours CD-16 on a long peak and stops a short peak
spending both its slots on general work — peak is never majority-general at any
phase length.

**5K is untouched, deliberately.** §22/SC-05 (board-ratified 2026-09-03) excludes
5K because race pace ≈ I-pace there, so the VO2max rows *are* the specific work.
Requiring a separate race-pace row at 5K demands a distinction the physiology does
not make (Seiler). Finish-goal plans are also untouched: with no goal pace there is
nothing to rehearse, so peak falls to threshold (CD-2/§80).

**The same-category-twice arm, and why it was latent.** The second quality slot
picks an "alternate" category, and its map handled only `threshold ↔ vo2max`,
falling through to *the primary's own category* for anything else. While only HM
ever reached a race-specific primary this was invisible; the moment 10K peak got
one, a week filled both slots from `race_specific` — and 10K owns exactly **one**
such row, so it shipped the identical session twice in one week. The map is now
exhaustive.

**Honest residual — this exposes CAT-DEPTH-01 rather than solving it.** 10K owns a
single `race_specific` row (`tenk_pace_intervals`), so a three-week race-pace peak
reaches for it repeatedly, differentiated only by §22's rename of neighbouring
threshold rows. HM has shipped the same shape (5 × "HM-pace reps") since R23, so
this is not a new defect — but it is the clearest statement yet of the catalogue
thinness CAT-DEPTH-01 tracks, and the fix is **content**, not logic: 10K needs more
than one race-specific row. Recorded, not hidden (§34).

**Config.** `GENERATION_CONFIG.PEAK_MAX_VO2MAX_SESSIONS` (2); `SPECIFICITY_BY_PHASE`
(unchanged values, now actually read). Enforced by `INV-PLAN-PEAK-SPECIFICITY`
(`warn` — a two-week peak at 50% against a 60% target is the plan a coach would
write; it fires at **0%**, the state it was written to catch).

**Board:** CB-SPEC-01, 2026-09-07 — Coaching Board CORRECT, Hutchinson chairing.

**Amendment CB-SPEC-02, 2026-09-13 — for HM/MARATHON the race-pace LONG RUN counts as peak specificity.** Surfaced by the first auto-triggered coaching-review round (`coaching-review/2026-09-13/review.md`, PEAK-SPEC-MAINT-01): a constrained time-goal marathon (returning, 4 days, 38 km/wk) reported `INV-PLAN-PEAK-SPECIFICITY` **0%** — "no goal-pace rehearsal" — while its peak in fact carried a **Marathon-pace long run** (`mp_long_run`, category `race_specific`). The check counted only `type:'quality'` slots, so the marathon's canonical specific vehicle — the MP long run, the very thing §93's own decorative `peak_includes_mp_long_runs` flag names — was invisible, and the 0% message was **factually false**. This is the §1/CD-19 pattern once more: a documented intent (marathon specificity lives in the MP long run) that no code exercised. **The invariant now counts a `race_specific`-category long run toward peak specificity.** The long run's TYPE is unchanged — it stays `easy`, so §1's intensity distribution and §52's long-run ownership are untouched; it is counted in the §93 specificity ratio ONLY. A plain Zone-2 long run is not counted (it is aerobic volume, not rehearsal). Board: **CORRECT WITH AMENDMENT**, Hutchinson chairing; Seiler's dissent preserved (the long run is volume, not a quality session) and resolved by scoping the count to the long run's existing role without changing its type. **No prescription change** — the plans are unchanged; only the measurement was corrected, ending a false-0% warn. Full record: `docs/decisions/coaching-board-2026-09-13-peak-spec-maint.md`.
Reclassified from "new principle" to **defect**: §5, §22 and CD-16 all already
required this and the engine contradicted all three. Amends §5 (now enforced),
completes CD-16.

---

## 94. §2 is measured at delivery for every runner, not only the injured

**Principle.** The week-on-week volume cap is checked against the **placed
sessions**, for healthy runners as well as injured ones — but only once the week
exceeds the runner's established chronic load, and only when the whole week *and*
its trimable (non-long-run) portion both breach. `INV-PLAN-DELIVERED-RAMP`
(`warn`).

**Why.** §2's 10% rule is enforced on the volume CURVE by `buildVolumeSequence`.
The runner runs the placed sessions, and the two diverge — ADR-022 established
exactly this and scoped its remedy (`INV-PLAN-INJURY-CAP-DELIVERED`, §90) to
injury-history runners. So a healthy runner had **no delivered-volume check at
all**, and the divergence was invisible rather than absent.

**The mechanism is a safety rule creating the spike, which is why it survived.**
`V1-volume-quality-split` — Willy's own gate on CD-16 — holds a week flat when it
introduces the first VO2max session, because intensity and volume must not
progress together. Correct, and it fires as designed. But the NEXT week steps up
from the **curve's** value rather than the trimmed one, so the trim hands its
entire deficit forward. Measured on the founder's live 10K: the curve read
33 → 37 → 40 (+8%, legal); the trim held week 2 at 33; the runner therefore ran
**33, 33, 40** — a +23% delivered rise against a chronic load of 33. On the plan
shape that shipped before §91/§93 the same mechanism produced **+48%**.

**Measured, on a 525-plan grid, before and after §91/§93:**

| | plans flagged | worst week-on-week rise |
|---|---|---|
| before §91/§93 | 128 (24.4%) | **76%** |
| after | 89 (17.0%) | **63%** |

So the defect is **pre-existing and §91/§93 reduced it**. It is not a regression
introduced by those rulings, and the residual is recorded here rather than
implied.

**Two scoping decisions, both forced by measurement rather than taste.** The first
draft of this check fired on **44.4%** of the grid with a worst reading of 114%,
and almost all of it was noise:

- **§2 guards load the body has not adapted to, not every rise.** A runner
  reporting 20 km/week is given 13.5 → 16.5 → 18 — every week *below* the load
  they already carry. Nothing there is a spike. The cap now binds only above
  `current_weekly_km`.
- **The long run is §52-exempt and race-anchored, so the trimable remainder swings
  for no change in load.** A week moving from long 18 / total 25 to long 11 /
  total 26 reads +114% trimable while the runner ran one extra kilometre. Both
  the whole week and the trimable portion must now breach.

§1 records the standard this would otherwise have failed — Willy, on an `error`
firing at 71%: *"not a safety mechanism — it is noise, and noise gets suppressed,
which is how a real violation gets missed later."*

**What this ruling deliberately does NOT do.** It does not change the producer.
Re-anchoring the following week to the trimmed value is the obvious fix and it is
**not taken here**, because it would lower delivered peak volume — the tonnage
ceiling §79 and §89 explicitly protect — and no measurement yet says by how much.
The board's own precedent governs: on 2026-09-06 a healthy bounceback cap was
built, measured (+50pp of plans flipped to "constrained by inputs", +7.6pp
`maintenance`, zero safety benefit) and **rejected**. A producer change here gets
the same treatment or it does not ship. This ruling makes the residual visible so
that measurement is possible; it is the first half of RAMP-BOUNCEBACK-01's second
half, not a substitute for it.

**Excluded, each because another principle owns the question:** the post-deload
bounceback (§2 — settled, and explicitly re-measured and left unbounded for
healthy runners on 2026-09-06); deload weeks themselves (§90); taper (a planned
drop); injury-history runners (already covered, more strictly, by §90); and
foundation weeks (§57's own +10%).

**Config.** `GENERATION_CONFIG.MAX_WEEKLY_VOLUME_INCREASE_PCT` (10, unchanged —
this ruling adds no numeric, it gives an existing one a second enforcement site).
Enforced by `INV-PLAN-DELIVERED-RAMP` (`warn`, §34 declared AND exercised).

**Amendment CHARITY-CAP-ABSFLOOR-01, 2026-09-13.** As for §90, the delivered ramp
now requires the week-on-week rise to clear an absolute-km floor
(`DELIVERED_ABSOLUTE_FLOOR_KM`, 3 km) as well as the percentage, so a low-base plan
does not warn on a rise that is a large percentage of a small number. Measured on
the whole-week rise here (§2's own claim is about weekly volume). See §90's
amendment for the measurement and the board's reasoning; it gates the warn, not the
producer.

**Board:** CB-RAMP-02, 2026-09-07 — Coaching Board CORRECT WITH AMENDMENT,
Hutchinson chairing (Willy leading; the chronic-load and both-portions scopes are
conditions of approval). Extends §90's basis to healthy runners at `warn`; does
not loosen §2, §12, §52 or §90.

### Amendment 1 — the trimable arm is retired; §2's claim is the WHOLE week

*(Coaching Board, 2026-09-17 — RAMP-GUARD-FAILS-OPEN-01. CORRECT WITH AMENDMENT.
Filed by Hutchinson at the LR-CAP-BLIND-01 sitting: "a load guard that goes quiet
exactly when things are worst.")*

**Principle.** `INV-PLAN-DELIVERED-RAMP` fires on the **whole-week delivered
rise**, once the week exceeds the runner's established chronic load and the rise
clears the absolute-km floor. The additional requirement that the **trimable
(non-long-run) portion** also breach — stated in the original principle above and
the condition of CB-RAMP-02's approval — **is removed.** Severity stays `warn`.

**Why.** A long run that grows sharply *shrinks the rest of the week*, so the
trimable arm fell silent precisely when the long run was driving the spike.
Measured over 2,799 generated plans and 14,515 healthy week-pairs (2026-09-17):

| | |
|---|---|
| Weeks breaching §2's own claim at delivery | **926** |
| Reported by the guard | 562 (60.7%) |
| Silenced, below chronic load — legitimate | 162 (17.5%) |
| **Silenced by a trimable arm** | **202 (21.8%)** |

⚠️ **Of those 202, all 202 had the long run GROW. Zero were the false-positive
class the trimable arm was written to prevent.** The arm's stated defence — that a
race-anchored long run can jump and swing the trimable remainder for no change in
load — is a plausible mechanism that was never measured, and in the population
where §2's claim is actually breached it has never once performed its function.
It only suppressed.

⚠️ **§52 was misread in the enforcing code, and the misreading is the interesting
part.** The comment justified the arm on the long run being *"§52-exempt… not
permitted to trim"*. §52 says the opposite: when the long run forces the 60%
ceiling the engine **MUST** consider *"(a) reduce the long run"* first. §52 is a
ceiling, not a shield, and below 60% it says nothing at all — only 25 of the 202
(12.4%) were near it. A protection was invented in a comment and then relied on.

⚠️ **The root mechanism is §45, not §94.** All 202 silenced jumps are legal under
§45 — and **all 202 are legal only because of its `+5km absolute` allowance**
(`+20% OR +5km, whichever is greater`). On an 8 km long run, +5 km is **+63%**.
§94 is the messenger. **Willy's objection to that allowance on a small base is
recorded and filed separately (`LR-ABS-CAP-LOWVOL-01`) — it changes what the engine
PRESCRIBES and was not taken the day before the charity showcase.**

**The amendment (McMillan's condition, with Seiler's).** The violation MUST
attribute the driver. Where the long run accounts for more than
`DELIVERED_RAMP_LR_ATTRIBUTION_PCT` of the week's rise, the message names it.
Two reasons, from two seats:

- **Seiler:** §94 was written for a spike created by a *quality* trim handing its
  deficit forward — intensity and volume colliding. These 202 are pure aerobic
  growth in one long easy run. Physiologically distinct exposures; one code
  reporting both, undifferentiated, gets read as one thing.
- **McMillan:** the engine has no lever here — the long run is race-anchored and
  §45 permits the jump. A warning that reads as "the engine failed" when it did
  not is how runners learn to ignore warnings. Named as long-run-led, it reads as
  coaching.

**Willy and Sims, on why silence was the worse option.** The long run is a single
continuous bout and is where bone and tendon load accumulate; a 63% step in it is
the acute-on-chronic pattern that presents in clinic, and it is *less* alarming to
the runner in the moment precisely because it is aerobic. Sims adds that bone-stress
risk is not evenly distributed — higher in female runners, with low energy
availability, and peri/post-menopause — and the engine **cannot know sex**
(`INPUT-SEX-01`, parked), so the load signal is the only lever left.

**Blast radius.** Purely additive; nothing that fires today stops firing.
Week-pair rate 3.9% → 5.3%; plans carrying ≥1 warn 17.9% → 23.3%. Within the noise
standard this board has applied (Willy rejected a check at 71%;
`INV-PLAN-PEAK-NOT-BELOW-START` is acknowledged at 29.2%). No change to what the
engine prescribes.

**Config.** `GENERATION_CONFIG.DELIVERED_RAMP_LR_ATTRIBUTION_PCT` (50).

**Board:** 2026-09-17 — CORRECT WITH AMENDMENT, Hutchinson chairing. Recorded
disagreements: McMillan on actionability (resolved by the attribution amendment);
Willy vs the chair on whether to fix §45 now (filed, not folded in).

---

## 95. A recovery week must not fall on a phase's second week either

**Principle.** A deload may not land on the **second** week of the build phase.
§87 forbade a recovery week *opening* a phase; this is the same defect one week
over — the runner gets exactly one week of a new stimulus and is then recovered
from it. `INV-PLAN-DELOAD-PHASE-POSITION` (`warn`).

**Why.** Measured 2026-09-07 on the founder's live 10K: week 3 carried the plan's
first-ever quality session and week 4 was a deload. A one-week loading block is
not a training block. §87's own reasoning applies unchanged — *"a deload before a
hard block is defensible coaching, but a defensible outcome reached at random is a
coincidence, not a decision"* — and position 2 is reached by the same accident of
arithmetic §87 removed from position 1.

### Amendment 1 — the preference YIELDS, and on masters plans it usually must (Coaching Board, 2026-09-15)

**§95 is a preference, not a ceiling.** Where honouring it would breach a ratified
ERROR-severity rule, placement reverts to §87's and the `warn` stands. This is
§98's pattern exactly: measure the actual outcome rather than predict it, so there
is no constant to drift.

**What forced the amendment.** Re-locating a deload does not just move a recovery
week — it changes session COMPOSITION. Measured on a marathon archetype,
`[4,8,12] → [2,6,10]` turns former-recovery week 12 into a quality-carrying
loading week (**+1 hard**) while the earlier placements shed **3 running
sessions**. Numerator up and denominator down, so §1's share crosses the ceiling:
**19.6% against MARATHON's 18% (10 hard / 51 running)**. The same drift breaks
§53's variety cap on the same plan (`progressive_tempo` 5 times against 4). The
yield therefore triggers on **any** error the §87 placement does not also carry,
not on §1 alone.

**Two constraints are HARD and may never be traded for position 2:**
1. **No adjacent deloads** (Willy). Back-to-back recovery weeks do not add
   recovery; they remove a loading stimulus. The first implementation of this
   rule produced exactly that — `[3,6] → [3,4,7]` — because its count test
   `since === recoveryFreq - 3` degenerates to `since === 0` at the masters
   cadence of 3, firing on the very week after a placement. **453 plans flipped
   to a do-nothing maintenance plan** and the build was reverted.
2. **Never lengthen the worst loading run** (Sims, §87 rule 3, unchanged).

**On masters plans the rule usually cannot be satisfied, and that is recorded
rather than worked around.** Brute force over every legal placement on real
generated plans: the full constraint set is **unsatisfiable on 1,944 of 3,726
masters plans (52.2%)** and on **0 of 3,726 standard plans**. D-21 applies — a
rule that cannot be honoured is a defect in the rule, so §95 is explicitly a
preference for the masters cadence. Sims: masters are the population with the
slowest bone and connective recovery, and the alternatives (a longer loading
block, or back-to-back deloads) both take real recovery away from exactly them.

**Measured outcome.** Build position-2 rate **37.0% → 26.1%** overall;
**standard runners 21.7% → 0.0%**; masters unchanged at 52.2% (the provably
unsatisfiable set). Adjacent deloads **0**. `cohortShape` unchanged — no plan is
reclassified, which is the difference from the reverted build.

**Config.** `computeDeloadWeeks(..., avoidPosition2)`; the yield lives in
`generateRulePlan`. **Honesty flag:** `meta.deload_position2_yielded`.

**Attribution is clean.** It fired on both early-onset 10K cases and on **neither**
the non-gated control nor the HM case. §89's shorter base was the cause: it slid
the phase boundary underneath a deload cadence anchored to absolute week number.
§87 fixed where deloads fall relative to phases; §89 then made phase length
runner-dependent, and the two had not met.

**This ships as a CHECK, not a placement change, and that is the whole point.**
§91 moved the phase boundary again and the symptom **stopped reproducing on every
measured case**. `computeDeloadWeeks` still knows nothing about position 2 — the
defect is **masked by the current phase arithmetic, not repaired.** SC-10 is this
codebase's standing reminder that a masked defect and a fixed one are
indistinguishable until something moves, and that a green suite over a masked
defect actively misleads. Changing the placement algorithm on a symptom that no
longer reproduces would be unmeasurable; recording the rule so it goes red if a
future ruling shifts a boundary back is not.

That restraint is also forced by `deloadCadence.ts`'s own history: §87 records
that rules 1 and 3 (*don't open a phase on a deload*; *never lengthen a loading
block beyond the cadence's promise*) **cannot both be satisfied by moving a deload
one week**, and that the first implementation "moved NOTHING while reading
perfectly plausibly". Extending the constraint to position 2 tightens a system
already proven over-constrained. That needs a measured proposal, not an edit.

**Config.** No numeric — structural, and deliberately so. Enforced by
`INV-PLAN-DELOAD-PHASE-POSITION` (`warn` — the placement is undesirable, not
unsafe; it is more recovery, not less, the same reasoning §87 applied to its own
backward-normalisation pass).

**Board:** CB-DELOAD-02, 2026-09-07 — Coaching Board CORRECT WITH AMENDMENT,
Hutchinson chairing. Amendment: detection now, placement change only on measured
evidence. Extends §87; changes no existing placement.

---

## 96. `overdo` is a brake, not a preference

**Principle.** `hard_session_relationship: 'overdo'` — *"I overdo it. Rein me in."* —
is a **risk declaration**, and the engine acts on it in two ways: it **vetoes
§89/§91 experience-gated quality onset**
however ready every other signal says the runner is, and it puts §24c's Z2-ceiling
cue on **every long run**, at every distance and in every phase, rather than only
build-phase 5K/10K.

**Why — it did nothing at all, and that was measured, not suspected.** Diffing
generated plans across `training_age` × distance × injury history, `overdo` was
**byte-identical to `neutral` in every single cell**. Four wizard options, one of
which could never change anything for any runner, at any distance, ever.

**The structural gap it exposes is §35's.** §35 builds a three-tier ladder
*upward* — floor → target → stretch — selected by `hard_session_relationship:
'love'`, and says in its own text that the tiering *"will eventually apply to
weekly volume, quality session frequency, and goal-pace exposure."* **It never
built the rung going the other way.** Every mechanism attached to this input
pointed at giving a runner more work; the one answer asking for less had nowhere
to land.

**§79 supplies the decisive argument.** §79 already holds that a runner's
self-report is asymmetric — it may raise *intensity* but never *tonnage*, because
a claim pointing toward more work is trusted less than one pointing toward
caution. `overdo` is a self-report pointing squarely toward caution and was
weighted at **zero**. That is not conservatism; it is inconsistency.

**Why the onset veto specifically (Willy, McMillan).** §89's gate is a list of
*demonstrated readiness* signals — deep training age, current base, regular recent
quality. `overdo` is the one declared *risk* signal in the wizard, and its effect
was to be ignored while readiness signals accelerated the runner's first hard
session by two weeks. A runner who tells you they cannot self-regulate load is the
last runner who should reach intensity sooner. This is what a coach does: rope for
the athlete who is disciplined, a hand on the shoulder for the one who says *"I
know I'll push too hard if I can."*

**Why the cue rather than more copy (McMillan's condition).** §24c already exists,
already says the long run is where runners most often drift into Z3, and already
carries wording in brand voice. Extending its placement costs nothing and invents
nothing. It deliberately lands **once per week on the session where drift is
worst**, not on every easy run — a note on everything is wallpaper, and wallpaper
gets ignored. This is a cue the runner *experiences*, not a rule they must study.

**What the brake actually costs, measured — because the first draft of this
section got it wrong.** It claimed the veto "adds or removes no session and
changes no tonnage." That is false, and the tests written to assert it failed
immediately. Vetoing early onset lengthens the base phase, which is the whole
point, and a longer base means fewer build/peak weeks. Measured on a 5-day 10K
where every other readiness signal passes:

| | quality sessions | total km | base weeks |
|---|---|---|---|
| `neutral` (gate fires, accelerated) | 10 | 482 | 0 |
| `overdo` (gate vetoed) | **6** | **457** | **4** |
| a runner who never passed the gate at all | **6** | **457** | **4** |

**The brake returns the runner to the standard plan, byte for byte.** It does not
cut below baseline; it declines to accelerate past it. That is the correct claim
and it is stronger than the one it replaces — the runner who says "rein me in"
gets the plan every ordinary runner gets, not a punished version of it.

**What this is NOT, said plainly (Hutchinson).** It is not a claim that
self-reported over-reaching predicts injury; the evidence for that is thinner than
a strong claim would need. It is the weaker and defensible claim that **when a
runner volunteers a risk signal, discarding it entirely is worse than acting on it
conservatively** — and every effect here is in the conservative direction and
bounded by the default plan.

**Deliberately NOT done.** `overdo` does not suppress quality (that is `avoid`,
and conflating them would take work from a runner who asked to be paced, not
spared), does not alter the deload cadence (§3/§87 own that, and no measurement
supports a change), and does not tighten §2's ramp (§94 governs delivered load for
everyone; a per-persona cap would need the measurement §94 explicitly defers).

**Two findings recorded alongside this ruling, both open:**

1. **Is §24b's segmented long run an easy session?** It carries `type: 'easy'`, so
   §1's session-count numerator excludes it — yet it is 50% at marathon/HM pace.
   Measured on a 5-day 10K: **17.9% quality counted, 21.4% if segmented long runs
   counted**, against a 25% ceiling. Neither figure breaches, so nothing is wrong
   today. **But §35 anticipates extending goal-pace exposure, and the moment
   anyone does, this becomes binding.** Recorded as a known accounting gap (§34,
   declared and exercised) rather than reclassified on no failing evidence —
   re-opening CD-19's numerator needs a case, and there isn't one yet.
2. **`love` is gated on `training_age: '5yr+'`** (§47's exception) and on
   `longest_recent_run_km ≥ floor` (§35's stretch tier). Both gates are correct on
   their own terms — they are tissue-tolerance judgements about carrying
   back-to-back peak long runs. **The defect is that nothing tells the runner the
   answer is conditional.** That is copy, not coaching, and is routed to brand.

**Config.** `GENERATION_CONFIG.OVERDO_IS_A_BRAKE` (true). Enforced by
`INV-PLAN-OVERDO-BRAKE`.

**Board:** CB-HSR-01, 2026-09-07 — Coaching Board CORRECT, Hutchinson chairing.
Completes §35's unbuilt downward rung; consistent with §79's asymmetry. Amends §24c
(placement) and §89/§91 (gate) by reference. Loosens nothing.

---

## 97. A demonstrated runner's surplus weeks belong inside the plan

**Principle.** For a §89-gated runner, surplus calendar weeks are **not** filled with
a §57 foundation block. The plan itself extends to the distance's `max_weeks`, so
those weeks become validated, periodised weeks inside the periodisation arc. The
all-easy on-ramp floor for this cohort drops to `MIN_ONRAMP_WEEKS_GATED` (1), and —
Willy's condition of approval — the opening quality exposures are **threshold-domain,
with VO2max and hills withheld** for `REENTRY_WEEKS_ONE_WEEK_ONRAMP` weeks, reusing
§79's existing intensity re-entry rather than a second mechanism.

Delivered result: **quality in calendar week 2**, with the first VO2max in week 4.

**Why — "delay the start" does not create rest.** §76 anchors the plan to race day
and delays the start when there are surplus weeks; ADR-020 then fills the delay with
a foundation block. So the runner **trains those weeks either way** — the founder's
case is 30 km and 33 km. What §76 actually produces is not a later start but two
weeks of real training sitting *outside* the periodisation arc, carved out of five
invariants, and described by §57's own text as *"habit and routine, not adaptation."*
For a runner the §89 gate has just certified as having a current base and doing
structured work most weeks, that is the wrong object. `max_weeks` is the signature's
own declared bound — this honours a limit §17 already set, it does not exceed one.

**Why one week of on-ramp (Seiler).** §89's gate *requires*
`recent_quality_training: 'regular'`. For a runner doing intervals or tempo most
weeks, two weeks without intensity is detraining, not on-ramping. One week remains a
settling week for the new structure — new volume curve, new blocked days. **Seiler
accepts one and refuses zero**, which is why `MIN_ONRAMP_WEEKS_GATED` exists as a
floor rather than the constraint simply being deleted.

**The tension this ruling had to resolve, recorded because the first implementation
got it wrong.** Part one's rationale is that filler becomes *base* weeks; part two
shortens the on-ramp to one week. Those pull against each other — if the on-ramp is
one week, the freed weeks land in **build and peak**, not base. So §97 does deliver
*more* quality, not merely *earlier* quality: measured on the founder's input, 12
weeks + 2 foundation → **13 weeks**, and the quality count rises. That is the honest
description, and the board accepts it on the same ground as the rest: the weeks were
being trained regardless, and training them inside a validated ramp is better than
training them outside one.

**One dropped slot, four steps downstream — the defect this ruling surfaced.** The
first build implementation produced two `error` violations on the founder's own plan,
and the chain is worth recording in full because every step looked locally correct:

1. §97's re-entry withholds VO2max over the opening weeks.
2. Build carries exactly **one** VO2max exposure (Seiler's cap on CD-16), and its
   position was read off the rotation's own modulo. That week fell **inside** the
   withholding window, so the week returned threshold and **the slot was spent**.
3. Build therefore ended with **zero** VO2max, so the first exposure landed in peak
   — past §5's adaptation deadline.
4. That fired V2's swap safety net (`applyV2Vo2MaxOnsetTiming`), which carries its
   own already-documented defect: `goalPaceWeek` is applied at CONSTRUCTION, so a
   session built for an early week arrives in a second-half week still wearing the
   early week's treatment — breaking `INV-PLAN-RACE-SPECIFIC-EXPOSURE` and
   `INV-PLAN-STRUCTURED-SESSION-DURATION-COHERENT` on the displaced session.

**The fix is to state the slot positively.** Build carries one VO2max exposure at the
**first eligible rotation index at or after the rotation's natural one**, and every
other index rotates through the non-VO2max categories. Never *earlier* than natural —
pulling it to index 0 would open build on its hardest category, contradicting §2 and
McMillan's "alternate, don't front-load" amendment on CD-16. Runners with no re-entry
window are unaffected: their slot stays where it was.

> **The generalisable lesson:** the old code found the slot by asking *"is this index
> the VO2max one?"* and vetoing every other index that landed on it. That is a
> question about the rotation, not about the plan, and it has no answer when the
> slot's week turns out to be unavailable. A scarce resource should be **placed**,
> not **discovered** — a rule that identifies a slot by coincidence of arithmetic
> fails silently the moment the arithmetic and the availability disagree.

**Delivered onset, measured before and after — including the one regression.**

| weeks to race | §91 | §97 |
|---|---|---|
| 12 · 13 · 14 | 3 · 3 · 4 | **2 · 2 · 2** |
| 15 | 4 | **3** |
| 16 | 3 | **4** ← worse |
| 18 · 20 | 3 · 3 | **2 · 2** |

Six rows improve, one regresses. The 16-week case regresses for a specific and
understandable reason: extending the plan to `max_weeks` moves `plan_start` two
weeks earlier, which drops the gap from over 28 days (§57's *choice* band, where no
block is auto-generated) into the *auto* band, so a runner who previously received
no foundation block now receives one. **Recorded rather than chased** (§34): a runner
16 weeks out from a 10K has more runway than the distance warrants even at
`max_weeks`, and week 4 for them is not a bad plan — it is the honest consequence of
§57's own banding. Chasing it would mean special-casing the gap classifier, which is
how a rule accumulates exceptions nobody can reason about.

**§1 YIELDS NOTHING — the ceiling constrained this ruling, not the other way round.**
The first build breached it: a 7-day marathon reached **18.4% (19/103)** against §1's
18% MARATHON ceiling, because one fewer base week moves a week into build/peak and
one more quality session lands. §1 is a ceiling the board has twice refused to spend,
so §97 yielded. Two bounds resulted:

- `MAX_PLAN_EXTENSION_WEEKS` (2, renamed from `MAX_ONSET_PLAN_EXTENSION_WEEKS` by the
  2026-09-16 amendment below) — a bound so that an extension can never be the thing
  that spends §1's ceiling.
  > ⚠️ **CORRECTED 2026-09-16.** This bullet used to justify itself with *"the
  > signature's headroom is not uniform (2 weeks for 5K/10K/HM, 4 for
  > MARATHON/50K/100K)"*. That is the gap against `PLAN_SIGNATURES.ideal_weeks`, and
  > `calcPlanLength` **has never read that field** — it reads
  > `DISTANCE_CONFIGS.idealWeeks` in `length.ts`, which `configConsumer.test.ts`
  > already records as superseding it. Against the ideal the code actually uses the
  > headroom is **+2 everywhere except 5K, where it is +0**, so this bound **does not
  > bind at any distance today**. It is a guard on a future `max_weeks` change, and
  > saying so is the point (§34) — a green check here is not evidence it is working.
  > The 18.4% breach that motivated it was real and remains so; it was measured on the
  > gated path, where `EARLY_ONSET_BASE_PCT` caps base at one week and every gained
  > week therefore lands in build/peak.
- `ONSET_SHORT_ONRAMP_DISTANCES` (5K/10K/HM) — the shortened on-ramp itself is
  distance-scoped. **This is not "the founder races 10K".** §1's ceiling *descends*
  with distance (25% → 20% → 18% → 15%) while a shorter base pushes the quality share
  *up*, so the shortened on-ramp is affordable exactly where the ceiling is loosest
  and unaffordable where it is tightest. Willy's load argument points the same way: a
  marathon's base carries the long-run progression and is the phase least able to
  spare a week. **Long-distance runners keep `MIN_BASE_WEEKS_FLOOR` unchanged.**
  The invariant applies the same scope as the producer — a checker using a different
  scope would fail correct long-distance plans.

**Config.** `GENERATION_CONFIG.MIN_ONRAMP_WEEKS_GATED` (1),
`REENTRY_WEEKS_ONE_WEEK_ONRAMP` (2), `EARLY_ONSET_BASE_MAX_WEEKS` (1, was 2),
`MAX_PLAN_EXTENSION_WEEKS` (2), `ONSET_SHORT_ONRAMP_DISTANCES` (5K/10K/HM).
`PLAN_SIGNATURES[d].max_weeks` becomes **live config** — it was declared and read by
nothing (PLANLEN-DUP-01), which is precisely why surplus weeks became a foundation
block in the first place. Enforced by the amended `INV-PLAN-ONRAMP-FLOOR`, whose
floor is now cohort-dependent.

**Board:** CB-ONSET-03, 2026-09-07 — Coaching Board CORRECT WITH AMENDMENT,
Hutchinson chairing; Willy's threshold-first condition is a condition of approval.
Amends §76 (surplus no longer delays the start for this cohort), §89/§91 (floor),
§57 (block not generated for this cohort — bypassed, not weakened: its rules are
unchanged for everyone who still gets one), and completes PLANLEN-DUP-01.

### Amendment 1 — the on-ramp is denominator-scoped, not only distance-scoped (INTENSITY-3DAY-01, 2026-09-09)

The distance list above was the **right axis measured against an incomplete grid.**
Affordability of the shortened on-ramp is a function of **both** the ceiling (distance)
**and** the §1 denominator — running sessions, which is `days_available × weeks`. §97
controlled for distance and never for days, because `property-validate-plans.ts` samples
each input axis independently at random and never crossed `days_available: 3` with the
full §89 gate. The consequence shipped to production (`enforceViolations` only throws in
dev/test): a **3-day 10K** declaring `experienced` delivered **27.3% quality (9/33)** and
a **4-day HM** delivered **21.2% (11/52)**, against 25% / 20% ceilings — the exact §1
breach §97's own "the on-ramp yields, not the ceiling" disposition forbids. Same two-axes-
meet-where-nothing-guards shape as §79-PEAKKM.

**The rule.** The shortened on-ramp drives ~1 quality session per running week in
build+peak, so it is granted only where the distance ceiling permits **at least one**
quality session in a week the runner actually runs:

```
ceiling_fraction × days_available ≥ ONSET_SHORT_ONRAMP_MIN_WEEKLY_QUALITY_HEADROOM (1)
```

Below the threshold, ~1 quality/week necessarily exceeds the ceiling. Measured, this
separates every breaching cell (`10K@3d = 0.75`, `HM@4d = 0.80`) from every safe one
(`≥ 1.0`) with no residual and no over-denial of the 4-day-10K / 5-day-HM cases §97
already cleared. When denied, base falls back to §91's two-week floor: onset moves one
week later, still ~2 weeks sooner than a non-gated runner. **§89's benefit is trimmed,
never lost** (`experienced` still outscores `intermediate` — 8 quality vs 6 on the 3-day
10K). §1 yields nothing; the on-ramp yields — the same disposition as the distance list.

This is a **defect fix restoring documented intent** (§79 "distribution still governs" +
§97's own ceiling-yields ruling), so it is Coaching-Board-exempt; the fix that would need
a sitting is the opposite one — deciding a low-day `experienced` runner *should* carry
>25%, i.e. raising the ceiling.

**Config.** `GENERATION_CONFIG.ONSET_SHORT_ONRAMP_MIN_WEEKLY_QUALITY_HEADROOM` (1).
Checked by the existing `INV-PLAN-INTENSITY-DISTRIBUTION` (no new invariant — the ceiling
was always the check; the gap was a producer that respected it on the days axis) plus a
**deterministic** regression cell in `property-validate-plans.ts` and `earlyQualityOnset.test.ts`
that the random grid could not be trusted to sample.

---


---

### Amendment — the headroom is granted on SURPLUS, not on §89's gate (LONG-RUNWAY-EARNS-PLAN-01, Coaching Board 2026-09-16)

**Principle.** A plan runs to `planWeekCap(distance)` whenever the calendar has
surplus weeks, **for every runner**. It is no longer conditional on passing §89's
readiness gate.

**Why the original scope was wrong.** §97 above argues that *"'delay the start' does
not create rest; it creates training that sits outside the periodisation arc and is
carved out of five invariants"* — and that argument is about **the weeks**, not about
the runner. It was nonetheless applied only to a §89-gated runner, because §97 was
reasoning from the founder's own 10K input. Measured on M1, the charity cohort's
first-time marathoner (42.2 km, 15 km/wk, `training_age: '<6mo'`, the precise
opposite of gated):

| runway | main weeks | of available | foundation | uncovered | plan starts |
|---|---|---|---|---|---|
| 25w, before | 18 | 20 | 3 | **4** | 9 November |
| 25w, after | **20** | 20 | 3 | **2** | 26 October |

**Willy's dissent from the 2026-09-15 sitting, now carried.** A `<6mo` training age is
the widest cardiovascular-to-musculoskeletal gap we ever see, and those weeks are the
cheapest tissue-adaptation weeks available. Measured on the live engine, max ramp
between non-deload weeks: **35.7% at 14-15 weeks, 20.0% at 16-18.** A longer plan is a
gentler tissue progression, and `INV-PLAN-DELIVERED-RAMP` was already firing as a
`warn` on this exact persona.

**`base_pct` is untouched — Willy's binding condition of approval.** §97's own
extension shortens base for a gated runner, so its gained weeks land in build and peak
and it had to concede *"§97 does deliver more quality, not merely earlier quality"*.
This amendment changes no phase percentage, so the gain is proportional: measured,
M1's phases go `b6 b6 p2 t4` → `b7 b7 p2 t4`. And §1's denominator is main-plan weeks
(CB-FOUNDATION-DENOM-01), which two more weeks **enlarge** — the quality share moves
down, not up. Cohort-wide `meanQualityPerBuildWeek` moved 0.50 → 0.51.

**The scoping condition is structural, not a special case.** The board's 2026-09-15
condition was *"scoped to runners who would otherwise idle; if it reaches runners who
would not, it does not ship."* `calcPlanLength` takes `min(weeksAvailable, weekCap)`,
so raising the cap changes nothing unless `weeksAvailable > idealWeeks` — which **is**
the surplus case. Measured on marathon: runway 14/16/18 → delta 0; 19+ → delta 1-2.
No gate was added, because the arithmetic already answers the question and a flag
would have been a second answer to it.

**Declared population movement (`cohort:shape`, 31,104 inputs).** A move is something
to declare with a number, not to hide behind a re-baseline:

| metric | before | after |
|---|---|---|
| `meanPlanWeeks` | 13.86 | **14.35** |
| `maintenancePct` | 50.2 | **49.3** |
| maintenance @ HM | 38.6 | **34.7** |
| `meanDeliveredPeakKm` | 38.35 | **38.74** |
| `plansWithNoQualityPct` | 33.3 | 33.3 |
| `earlyQualityOnsetPct` | 6.6 | 6.6 |

The HM maintenance drop is the largest single move and it is an improvement: a
first-time HM runner on a 16-week runway now builds for 16 weeks instead of being
capped at 14 and classified as unable to build.

> ⚠️ **A claim made at the sitting was FALSIFIED by the measurement, and is corrected
> here rather than quietly dropped.** Willy argued *"we are not adding load: the peak
> is set by `peakKmByLevel`, not by week count."* **That is wrong.** The volume curve
> ramps toward `peak_km_target` under §2's cap, so more weeks let it get **closer** to
> a target it was previously undershooting: M1's delivered peak rises **40.0 → 47.0
> km** against a `peak_km_target` of 52. Population-wide the effect is small
> (`meanDeliveredPeakKm` +0.39 km, +1.0%) because few plans have that much surplus,
> but for the extreme long-runway case it is +17.5%. The board re-examined it on the
> number and holds: the ramp **rate** is unchanged (20.0% max step in both), so this
> is a plan delivering more of its own prescribed peak over more weeks, which is the
> safe way to reach it — not a steeper climb.

**Sims's blocking condition, discharged by measurement.** She would withdraw support
if §3's cadence produced adjacent or missing deloads at the longer lengths — the exact
failure mode that got DELOAD-POS2-01 reverted on short plans. Measured across 72
extended plans (4 distances × both age cadences × 3 day-counts × 3 volumes):
**0 adjacent deloads, 0 plans ≥ 8 weeks without one, 0 error violations.**

**Config.** `GENERATION_CONFIG.MAX_PLAN_EXTENSION_WEEKS` (2) — renamed from
`MAX_ONSET_PLAN_EXTENSION_WEEKS`, value unchanged. A key whose name asserts a scope it
no longer has is the decorative-config failure running backwards: the name reads as
governance and governs nothing. `calcPlanLength`'s `allowMaxWeeks` parameter is
**deleted** rather than defaulted to `true`, and `planWeekCap()` in `length.ts` is now
the single owner of the bound (D-08) for both the producer and the invariant.

Enforced by `INV-PLAN-SURPLUS-IN-PLAN`, widened from `INV-PLAN-GATED-SURPLUS-IN-PLAN`
by dropping its `early_quality_onset` guard.

**Board:** LONG-RUNWAY-EARNS-PLAN-01, 2026-09-16 — CORRECT WITH AMENDMENT, Hutchinson
chairing. Amends §97 (scope) and discharges the dissent §57's amendment recorded on
2026-09-15. Does not touch §89's gate, §98's yield ladder, `base_pct`, or §57's
session-content rules.

## 98. §89's onset is granted only as far as §1 permits

**Principle.** §89's earlier quality onset is **conditional, not absolute**. A gated
plan that would breach §1's distance ceiling gives base back **one week at a time**
until it complies. The walk is bounded by the **effective on-ramp an ungated runner
would receive** (§91: base weeks + §57 foundation weeks); if no rung complies within
that bound, the runner receives the plain ungated plan. §1 is never spent, and §8's
per-week quality dose is never reduced.

**Why — §89 breached §1 on its own, and the defect was filed against the wrong
section.** Measured 2026-09-10 over a 240-plan grid (4 distances x 3-6 days x 30-80
km x 14-26 weeks out, all `experienced` / `5yr+` / `recent_quality_training: regular`):
**34 of 212 gated plans exceeded their ceiling**, worst **HM at 3 days: 29.5% against
20%**; MARATHON at 5 days 24.7% against 18%; 10K at 3 days 29.3% against 25%. The
same cells with the gate closed produced **zero** breaches.

The item was filed as *"§91's foundation credit spends §1's headroom"*. **It is not.**
Isolation on 120 comparable cells, toggling only `recent_quality_training`: 29 breaches
with the gate open, 0 with it closed — and **11 of the 29 carried no foundation block
at all**. §91's credit is an amplifier (18 of 29), not the mechanism. A remedy aimed at
the credit was built and measured: breaches 34 -> 31. It would have closed the item
having fixed a third of it.

**Why §97's existing gates could not reach this.** §97 scopes the shortened on-ramp by
distance, and Amendment 1 by denominator headroom. Both decide the base **cap** (2 weeks
or 1). §91's credit then subtracts `min(foundation_weeks, cap)` — so base lands at
**zero in all twelve distance x day cells regardless of which verdict the gate returned**.
HM at 3 days and every MARATHON cell were explicitly *denied* the short on-ramp and
reached zero anyway. A gate that sets a cap cannot govern a rule that subtracts from it.

**Why a ladder and not a numeric.** Three threshold-shaped levers were measured and
rejected, the last decisively: breaches occur at `ceiling_fraction x days_available`
of **0.60 and also 1.25**, so no proxy of that shape separates the breaching cells from
the safe ones. **This measures the actual §1 share instead of predicting it.** There is
no constant to drift, and the breach becomes impossible by construction rather than
caught afterwards — CB-FOUNDATION-DENOM-01's own standard, one day earlier: *"a defect
class that cannot occur beats a check that catches it."*

**The bound is the load-bearing half.** An unbounded ladder cleared all 34 breaches and
introduced a regression: one runner (10K, 3 days, 14 weeks out) ended with an effective
on-ramp of **6 weeks against 5 for the same runner ungated** — demonstrating readiness
made the plan *more* conservative, which is exactly the non-monotonic onset §91 exists
to prevent. So the ladder stops at the ungated runner's effective on-ramp and falls
through to the ungated plan rather than past it. §89's benefit is **trimmed, never
inverted** — §97's own language, now mechanically true.

**Measured, bounded, over the same grid — no residual:**

| outcome | plans |
|---|---|
| compliant at full §89 benefit, untouched | **178** (84% of the gated cohort) |
| corrected within the bound (rungs 1 / 2 / 3) | **33** (13 / 16 / 4) |
| fell through to the ungated plan | **1** |
| **§1 breaches remaining** | **0** |
| **plans worse than ungated** | **0** |

Mean cost to a corrected plan **+1.71 on-ramp weeks** (max +3). Of the 34 corrected
plans, 31 still reach quality earlier than the same runner ungated; 2 tie; none is later.

**Why the check may run on the bare plan.** CB-FOUNDATION-DENOM-01 (2026-09-10) made
§1 count main-plan weeks only, so `validatePlan`'s bare and assembled verdicts are now
identical. The ladder therefore lives entirely inside `generateRulePlan` and does not
touch ADR-020's compose path. **This is a direct dividend of that ruling** — under the
old denominator the ladder would have had to run after composition, or measure a share
it could not yet see.

**Cost, stated.** Up to four generations for the ~16% of gated plans that breach; one
generation for everyone else, including every ungated runner. Not profiled.

**Config.** `GENERATION_CONFIG.ONSET_YIELD_MAX_RUNGS` (4) — a **safety stop, not a
tuning knob**: the real bound is the ungated effective on-ramp comparison, and the
measured maximum rung actually required is 3.

**Mechanical check.** `INV-PLAN-ONSET-YIELD-BOUNDED` (`error`). The ladder stamps
`meta.onset_yield = { rungs, bound, effective }` when it acts, and the invariant asserts
`effective <= bound` — so the §91 guarantee is checkable from a single plan without
regenerating a hypothetical ungated one. **Falsification-tested**: it goes red on
`effective 6 > bound 4`, stays green at equality, and stays green when absent. §1 itself
remains policed by the existing `INV-PLAN-INTENSITY-DISTRIBUTION`, which is now expected
to be unreachable for this cohort rather than merely baselined.

**Board:** CB-ONSET-YIELD-01, 2026-09-10 — Coaching Board CORRECT, Hutchinson chairing.
Amends §89, §91 and §97 (the onset becomes conditional). **Moves no ceiling and reduces
no §8 quality dose.** Sims recorded this as safety-adjacent, explicitly unlike
CB-FOUNDATION-DENOM-01 which she required be logged as coherence-only.

---

## 99. A session states the length its own structure needs

**Principle.** A session built from a fixed v2 shape is sized by **summing its own
steps**, not by the flat `QUALITY_SESSION_PCT_OF_WEEKLY` share. The stated duration
follows the structure; the structure never shrinks to fit a stated duration.

**Why — the runner was told 45 minutes for a session that takes over 70.** Measured
2026-09-10 on generated plans, `hm_pace_intervals` (4 x 2 km at HM pace, 3 min jog):

| runner | stated | main set alone needs | real session with warm-up + cool-down |
|---|---|---|---|
| intermediate | **45 min** | **57 min** | ~71 min |
| experienced | 59-61 min | 51 min | ~64 min |

§86/CB-CAT-02 fixed this class for `threshold_ladder`, which **overstated** (61 for a
session needing 50). This row **understated**, which is the direction that costs a
day-job runner their evening — the session they skip, or the one that eats a night
they had not budgeted (McMillan). For an app whose promise is *"Slow down. You've got
a day job"*, understating session length is a brand failure as much as a coaching one.

**It had been shipping since R23 and was invisible until the same day it was fixed.**
The row was v1 and carried no `derived_set`, so there was no structure to compare a
stated duration against. CAT-ROW-ELIGIBILITY-01's v2 migration EXPOSED it; the
migration did not cause it. **A defect can be older than every mechanism capable of
seeing it** — which is the argument for structural stamping generally (ADR-018/019).

**The dose did not change** (Willy's condition of approval): 4 x 2 km at HM pace,
before and after. Only the number the runner is told moved. A "fix" that trimmed reps
to fit 45 minutes would have been the wrong half yielding.

**What the honest number exposed, recorded rather than smoothed (§34).** The session's
true length is ~80 minutes and it lands midweek. That is not deformed to fit
`max_weekday_mins`, because §81 already ruled structured sessions exempt from the
weekday cap — scaling the stated duration does not scale `derived_set`, so capping
would restore exactly the lie this section removes. Where a runner's stated
availability genuinely cannot hold it, §52's third remedy and §40c apply: the plan
says so. **Whether 4 x 2 km is the right dose for a four-hour-a-week runner is a
different question**, and the SLT closed it on CAT-DEPTH-01 (differentiation ruled
coaching-sufficient; do not chase a finer dose). It is deliberately not reopened here.

**Second-order effect, measured and accepted.** This row was consuming 10 km of the
weekly budget while demanding 14 km of running, so every peak week was silently
over-subscribed. With honest sizing the week's easy runs give up the difference
(11.5 km -> 9.5 km on the golden plan) and the weekly total is preserved. That trade
is correct: the alternative is a plan whose stated weekly volume is not what the
runner would actually run.

**Config.** No new numeric. `fixedShapePlan`'s `FIXED_SHAPE_SIZED` allowlist gains
`hm_pace_intervals` — kept an explicit allowlist, not "every fixed row", because
joining it changes the length the runner is told and that is a board matter.

**Two mechanical traps this change had to clear, both silent.** (1) `fixedShapePlan`
priced only `duration` and `parameter` steps, so a **distance**-based row fell out at
its own guard and kept the flat share — the allowlist entry would have looked applied
and done nothing. (2) It asserted `anchors.has('T')`, written when both allowlisted
rows were threshold rows, so "one anchor" and "T" were the same statement; an
HM-anchored row returned null. Both now generalised, priced through
`resolveAnchorPace` so this and the derived set cannot disagree.

**Board:** CB-HMPACE-SIZING-01, 2026-09-10 — Coaching Board CORRECT, Hutchinson
chairing. Extends §86. Moves no ceiling, no dose, no §1.

---

## 100. A safety trim must not hand its deficit to the next week

*(Coaching Board, 2026-09-11 — RAMP-PRODUCER-01. CORRECT WITH AMENDMENT.)*

**Principle.** When a rule deliberately holds a week's volume DOWN, the following
week ramps from the volume the runner **actually received**, not from the volume
curve's value for the week that was trimmed. The cap is §2's existing 10%; it is
applied forward until the curve catches up with delivered volume.

**Why.** `V1-volume-quality-split` holds a week flat when it introduces the first
quality or VO2max session (Willy's gate on CD-16: intensity and volume must not
progress in the same week). That is correct and is not changed here. But the next
week was built from the CURVE, which still believed the trimmed week sat at its
curve value, so **the trim handed its entire deficit forward**. The safety rule
was not removing a spike, it was moving it by seven days.

Measured on the founder's live 10K: the curve read 33 → 37 → 40 (+8%, legal); the
trim held week 2 at 33; the runner therefore ran 33, 33, 40 — a **+23% delivered
rise against a chronic load of 33**.

**This exact defect has been ruled on before, in another place.** §12's boxed
correction of 2026-08-20 records the injury cap doing the same thing: "applied
per-week downstream of the curve, measured against the curve's *unadjusted*
previous value. **So it never compounded.** A week capped down was followed by a
week measured against the higher curve value, which sailed through uncapped." It
accounted for 394 of 981 long-run progression violations. The board did not need
to decide whether a cap measured against an unadjusted curve is wrong; it decided
that in August. §100 applies the same finding to the volume/quality split.

**It cascades, and is self-limiting.** Capping only the immediately-following
week moves the spike one week further out: the curve keeps climbing while
delivered volume restarts lower. Each capped week raises the delivered baseline
by the full 10%, so the walk forward terminates on its own when the curve catches
up. Deloads, taper and race week end it immediately — those are planned drops and
§2's rise cap has nothing to say about them.

### Amendment (§52) — it partial-applies rather than emptying the week

**The board amended the proposal on §52's authority.** As first built, the cap
drove two 11.5 km easy runs to the 4 km `MIN_SESSION_DISTANCE` floor in a single
week, to hold a +62% delivered rise down to +10%. §52 has already ruled on that
shape, in its own Case 04: weekday runs "cut to 4 km each ... a lopsided week is
a week that doesn't actually train the runner", and "the constitutional answer is
to **surface the constraint, not to silently truncate weekday runs to single-digit
km**".

So no easy run may be trimmed below **the smallest easy run of the week the runner
has just completed**. This introduces no numeric: the floor is the runner's own
most recent easy session. Where it prevents reaching the cap, the trim
partial-applies and §94 continues to report the residual as a `warn` — the same
honest-residual treatment §52 and §90 already use, and §34's standard.

**Config.** No new constant. Reuses `GENERATION_CONFIG.MAX_WEEKLY_VOLUME_INCREASE_PCT`
(10) — the same §2 cap, measured at delivery instead of on the curve.

**Mechanical check.** `INV-PLAN-DELIVERED-RAMP` (§94) already measures exactly
this and needs no change: it was written as the detector for this producer and
stays `warn` because of the §52-exempt long run and the partial-apply above.
Producer is `reanchorWeekAfterTrim` in `ruleEngine.ts`; the shared trimmer
`trimWeekEasyToTarget` is used by both V1 and the re-anchor, so the two cannot
drift apart (Willy's standing instruction from CD-16: "that machinery exists —
extend it rather than inventing a parallel rule").

**Measured — 900 healthy plans, 5K/10K/HM, 3–6 days, 15–50 km/wk, pinned seed.**
V1 fires in 64.2% of them.

| | baseline | §100 (cascade + §52 floor) |
|---|---|---|
| plans breaching §94 | 34.0% | **16.4%** |
| worst delivered week rise | 79% | **79% — unchanged** |
| mean rise among breaches | 30.4% | 26.2% |
| mean delivered PEAK week | 27.04 km | 26.78 km |
| max delivered PEAK week | 65.5 km | 65.5 km |
| constrained by inputs | 38.4% | 38.4% |
| maintenance profile | 32.8% | 33.3% |

> **⚠️ CORRECTED 2026-09-11, hours after this section shipped.** The table first
> published here read 22.7% → 11.5% with the worst rise falling 55% → 39%. Those
> came from a grid that passed **two invalid enum values** (`recent_quality_training:
> 'occasionally'` and `hard_session_relationship: 'regularly'`, neither of which
> exists) plus `fitness_level: 'advanced'`, which is not in the union either. The
> engine did not reject any of them — it matched nothing and fell to defaults — so
> 611 plans generated cleanly from inputs that were partly fiction. §55 now
> rejects an unrecognised enum (`InputEnumError`), which is how this was found.
>
> **The ruling is unaffected and the benefit is LARGER than first reported** — a
> 52% relative cut in breaches rather than 49%. But one claim was simply wrong:
> **the worst delivered rise does not improve at all.** 79% before, 79% after.
> The improvement is in how OFTEN a plan breaches, not in the ceiling of the
> worst case, because the worst cases are driven by long-run placement the engine
> is not permitted to trim — which is the residual §94 already documents as
> `warn`. Recorded rather than quietly restated: a measurement that flatters the
> change is exactly the one to re-check.

**And the same change on the FULL property sweep, which is the honest denominator.**
16,038 plans across every distance: `INV-PLAN-DELIVERED-RAMP` fell from **4.0%
(644 plans) to 3.6% (572)**, a 11% relative reduction rather than 52%. Both
figures are real and they measure different populations. The focused grid above
is 5K/10K/HM only — the distances where the catalogue emits a VO2max session and
therefore the only ones where V1 can fire at all — so it reports the effect where
the mechanism lives. The full sweep dilutes it with marathon and ultra plans the
rule never touches, plus the injury-history runners §94 excludes by design.
**Quote the sweep number when asked "how much did this improve the product", and
the grid number when asked "does the fix work".** Reporting only the second would
be the flattering half of a true answer.

**Why this shipped when the 2026-09-06 healthy bounceback cap did not.** That one
was built, measured and REJECTED: +50pp of plans flipped to "constrained by
inputs", +7.6pp maintenance, zero safety benefit. §79/§89 reserve peak structure
to the runner's inputs, and the board will not spend it for nothing. The profile
here is the inverse — half the breaches removed for 0.6% of mean peak volume and
0.5pp of maintenance — because the capped week sits in base or early build, not
at peak. **The precedent is the METHOD, not the verdict:** measure the cost in
the same units, then decide.

---

## 104. A peak rehearses the race more than one way

*(Coaching Board, 2026-09-11 — CAT-10K-RACE-SPECIFIC-01. CORRECT WITH AMENDMENT.)*

**Principle.** Where a distance's peak carries more than one race-specific slot,
those slots should not all be filled by the same catalogue row while another
eligible row exists. A peak that rehearses the race with one session repeated is
not several rehearsals; it is one rehearsal run several times.

**Why.** §93 provisions a time-targeted 10K peak with up to three race-specific
slots. §22's CD-18 amendment requires such a distance to OWN a race-specific row,
and 10K did. Neither said how many, and 10K owned exactly one.

**Measured before the sitting, on 96 generated 10K time-target plans: 100% placed
`tenk_pace_intervals` twice, and not one plan saw two different race-specific
sessions.** The all-distance `goal_pace_sharpener` landed zero times, because it
is taper-only and loses to the 10K row that covers peak AND taper.

This is the SC-05/CD-18 finding one turn further on. That sitting found §33 had
"fixed the symptom (borrowed voice) and left the cause (no 10K entry) in place".
The entry exists now. There is one of it, and §22/§33 rename neighbouring
threshold rows so the plan still LOOKS varied.

**The remedy is content, never a selection tweak.** A scheduler told to prefer
unused rows would spread a thin catalogue more evenly and teach nobody anything.

### What shipped

`tenk_race_simulation` — "10K-pace race simulation", 3 × 2km at goal pace off 90s
jog, peak only, intermediate minimum. It differs from `tenk_pace_intervals` on the
axis that carries 10K specificity: time at goal pace per repetition against a
recovery ratio closer to the race's continuous demand (~6km at pace in three
efforts, against ~4.8km in four). It is **not** a duplicate of the threshold rows
beside it — `threshold_mile_repeats` and `tempo_cruise_short` are anchored at
threshold, this at `goal`, and §22 is explicit that the goal-pace exposure is the
point. Peak-only and intermediate-minimum on Willy's guard: 90 seconds of recovery
on 2km repetitions is a real step up in continuous load.

**Measured after: plans seeing two different race-specific sessions went 0% → 25%.**
Reported honestly — the other 75% still repeat, because two rows across several
slots is better, not solved. That residual is CAT-DEPTH-01's.

### Amendment 1 — Row B was KILLED

A second row was proposed: 10K pace with a *float* recovery (5 × 1km at goal pace
with 1km at easy-moderate between). **Rejected.** A float at easy-moderate is
Zonna **Z3** — the grey zone this product exists to prevent (§1). Prescribing it
deliberately, to a runner training four hours a week, contradicts the positioning
in the one place the runner would be sure they were doing the right thing. Seiler's
own caveat is the argument: recreational runners already drift into that band
without being told to; a session that mandates it is the wrong tool for this
population, however sound it is for an elite.

### Amendment 2 — `goal_pace_sharpener` stays taper-only

Proposed for `peak` so it could fill a slot. Declined: it is a taper sharpener and
it is correct as one. The reason it never lands for 10K is §22's own
most-specific-row-wins rule working, not a phase error.

### The check does NOT encode a content target

`INV-PLAN-RACE-SPECIFIC-VARIETY` (`warn`) fires when a time-targeted peak fills
two or more race-specific slots from one row **while another peak-eligible row for
that distance exists**. It deliberately does not assert "a distance must own N
rows" — that writes a content target into the constitution and would be wrong the
moment §93's slot logic changed. Where the catalogue genuinely offers one row it
stays silent: a plan is not defective because the catalogue is thin. The depth
itself is a register, `catalogueDepth.test.ts`, in the shape of SWEEP-BASELINE-01.

**⚠️ MARATHON HAS THE IDENTICAL GAP — one peak-eligible race-specific row
(`mp_long_run`).** Found by the same scan and deliberately NOT fixed here: a
marathon race-specific row needs its own sitting, and shipping prescription as a
by-product of a 10K ruling is how unreviewed coaching gets in. It is the distance
the charity referral channel sends us, so it should not wait long. Registered in
`catalogueDepth.test.ts` as a known gap rather than left to be rediscovered.

**Config.** No new numeric. The row is catalogue content; the check derives its
question from §93's existing slot logic.

---

## 105. Marathon pace must exist away from the long run

*(Coaching Board, 2026-09-11 — CAT-MARATHON-RACE-SPECIFIC-01. CORRECT WITH AMENDMENT.)*

**Principle.** A distance's race-specific work must not live entirely inside one
session shape. For MARATHON it did: every scrap of goal-pace exposure was a
segment of the long run.

**Measured on 96 marathon time-target plans: 100% reused `mp_long_run`, up to
THREE times in a single plan** (216 placements). So a marathon runner met goal
pace on long-run day or not at all — and a runner whose long run was already the
week's binding constraint (§52 lopsidedness, §81's weekday ceiling, a step-back
week under §47) met it nowhere.

**What shipped.** `mp_blocks` — "Marathon-pace blocks", reps × 4km at goal pace
off 3 minutes jog, peak only, intermediate minimum. It separates goal-pace
exposure from long-run day, so MP work survives a week the long run does not. A
well-established shape (Daniels' M-pace repeats, Pfitzinger's MP work), and
distinct from the threshold rows beside it by ANCHOR — MP, not T.

**Named in the "…-pace…" family, on §104's rule.** `Session.stimulus` is stamped
from the generator label, so a `race_specific` row named outside that family
stamps nothing and is invisible to §22's own check. Learned the expensive way
hours earlier, when "Broken 10K" failed every 10K plan.

### Amendment 1 — the proposed load guard was WITHDRAWN

The brief proposed an invariant forbidding `mp_blocks` from sharing a week with a
race-pace long run, on the reasoning that ~12km at MP plus a long run 40% at MP is
too much race-pace load. **It does not survive contact with the catalogue.**

Written broadly it failed 228 existing tests, because §22 renames a borrowed
threshold row to "10K-pace intervals" in the second half of a time-targeted plan
— so a race-pace long run beside a race-pace-renamed quality session is the
engine's normal, board-sanctioned behaviour and has been since R23. Narrowed to
genuine `race_specific` rows it still failed 57, because **HM has paired
`hm_pace_long_run` with `hm_pace_intervals` in one week since R23** and no board
has objected.

And the premise is weak on its own terms: **marathon pace is easier per kilometre
than HM pace.** The marathon pairing is a LOWER intensity than the one already
shipping. There is no evidence the pairing harms anyone, and the precedent argues
it is fine. A new error-severity rule condemning long-shipped, reviewed behaviour
is not a finding — it is inventing a rule. Withdrawn.

### Amendment 2 — §104's invariant was MIS-SCOPED, and this found it

`INV-PLAN-RACE-SPECIFIC-VARIETY` (§104, shipped hours earlier) counted the LONG
RUN as a race-specific slot. `mp_long_run` is a race_specific row that occupies
the long run, and repeating it across peak weeks is **§47's alternation working
as designed**, not a variety failure.

The moment marathon gained a second row, the invariant fired on **92% of marathon
plans** — which by Willy's own NOISE-GATE-01 standard ("a check firing at 71% is
not a safety mechanism, it is noise, and noise gets suppressed") would have made
it worthless within a week. It now excludes the long run, and excludes
long-run-shaped rows from counting as an *alternative* for a quality slot.

It was not caught when §104 shipped because 10K's only race_specific rows are
quality sessions, so the distinction never arose. Firing rate went 5.7% → 0% on
the full sweep; falsification-tested that it still fires on the real defect (two
peak quality slots filled from one row while an alternative exists).

**Config.** No new numeric. Content plus a scoping correction to an existing
check.

**Honest residual.** Plans seeing both marathon race-specific rows: **0% → 8%.**
Lower than 10K's 25%, because `mp_long_run` occupies the long run while
`mp_blocks` competes for a quality slot against the threshold and VO2max rows.
Better, not solved; the depth question stays CAT-DEPTH-01's.

---

## 106. A plan never peaks below where the runner already is

*(Coaching Board MAINT-PROFILE-01, 2026-09-11. CORRECT WITH AMENDMENT.)*

**Principle.** The peak weekly volume target is the runner's level band **or the
volume they already run, whichever is higher**. A plan may never prescribe a peak
week below the weekly volume the runner told us they are currently doing.

**Why.** `PEAK_KM_BY_LEVEL` reads race distance and fitness level and never asks
what the runner already runs. Measured 2026-09-11: an experienced marathoner
declaring **100 km/week** was handed an 18-week block starting at 76 km and
peaking at **73** — below their current volume in both directions. Every honesty
layer then worked perfectly on a plan that should never have been built: §23
correctly observed the peak was 96% of week 1, the plan was classified
`maintenance`, and the note explained itself. **§23 and §46 license maintenance
when THE RUNNER'S constraints prevent overload — they name `days_available` and
`max_weekday_mins`. Neither was binding. Ours was.** The constitution has never
licensed the engine creating the condition it then honestly reports.

Sims, on who pays for it: a peri- or post-menopausal runner has usually built her
volume deliberately for bone loading. A block that quietly reduces her training
for 18 weeks while she believes she is building — and while she eats for the
training she thinks she is doing — is an unopposed loss of mechanical stimulus at
the age it is hardest to recover. That is not a label problem.

**A FLOOR ON THE CEILING, NEVER A SCALED TARGET.** This was Willy's condition of
approval and he would veto the general form: self-reported weekly volume is the
least reliable number on the intake form, and scaling the ceiling off it turns an
unverified self-report into permission to **add** load. This adds none. `startKm`
is already the runner's declared volume; all §106 does is refuse to build a curve
whose top is below its own start. §2's 10% rule, §45's long-run progression cap
and §3's deload cadence remain **fully binding** — nothing here permits a larger
week-to-week step. §10/CD-6's `<6mo` over-claim cap still governs `startKm`
before §106 reads it. Raising the ceiling **above** the level band on the strength
of a self-report is a new sitting.

**§79 wins where they meet.** A runner who declares UPWARD gets an intensity
allowance only — *"peak km, the week-1 volume floor, the ramp and the long-run
caps stay on the assessment"*. §106's floor therefore **does not apply to an
upward declaration**, and `INV-PLAN-USER-LEVEL-NO-UPWARD-TONNAGE` keeps its veto.
The residual is real and deliberate: a declared-upward runner on high volume still
gets a reduced plan. It is **visible rather than silent** —
`INV-PLAN-PEAK-NOT-BELOW-START` warns on it. *(The board's own conflict scan
missed §79; the engine's invariant caught it. Recorded because the layered
governance working is the point of having it.)*

**Deferred, not settled.** The sitting also measured that **100% of time-targeted
marathon plans (54 of 54)** classify `maintenance` — a distinction that never
varies carries no information, and Willy's own standard is that a check firing on
71% of a distance is noise. The chair declined to recalibrate §23's ratio or
§46's floor in the same sitting: this defect inflates the population those
thresholds measure, and you do not tune a threshold against a broken input.
~~Re-measure after §106 has been live.~~ **RE-MEASURED 2026-09-13 (batch board
sitting):** still 100% (54/54 cohort, 99.8% expanded), §106 changed nothing here —
the subset was already saturated. The board found the lever is **NOT** §23/§46: the
high-volume tail is pinned by **§24's peak-LR specificity floor (31.7 km) being
structurally unreachable under `LONG_RUN_CAP_MINUTES.MARATHON = 210` (≈30.5 km)**,
so a runner plainly building is labelled maintenance. Ruled CORRECT WITH AMENDMENT
(a plan must not be maintenance solely because §24's LR floor is unreachable under
the time cap) and re-filed as **MARATHON-MAINT-LABEL-01** — its own build, because
it relabels ~100% of time-target marathons. **Do not re-open the §23/§46
recalibration; that was measured and is the wrong lever.** Record:
`docs/decisions/coaching-board-2026-09-13-batch.md` §2.

**Config.**
- `GENERATION_CONFIG.PEAK_FLOOR_VS_START_RATIO = 1.0` — the floor, as a multiple
  of the runner's declared weekly volume. Tunable: a coach could argue for 0.95
  (allow a slight reduction) or 1.05 (require growth).
- `GENERATION_CONFIG.PEAK_KM_BY_LEVEL` — **moved here from `lib/plan/length.ts`
  in the same commit.** Eighteen coaching numerics setting the single most
  consequential figure in a plan had been living outside `GENERATION_CONFIG`, so
  no principle governed them, `configPrincipleSync.test.ts` could not see them,
  and the coaching-guard hook did not fire on edits. Values unchanged; only their
  home and their governance are. Hutchinson: *"every other numeric in this app has
  a section explaining what it is for, and that is precisely the discipline that
  would have caught this."*

**Measured effect** (`npm run cohort:shape`, 621 plans): mean delivered peak
**39.26 → 39.96 km**, maintenance **49.8% → 51.0%**, constraint-note
**65.7% → 66.8%**, marathon maintenance unchanged at 71.1%. The maintenance rise
is a consequence, not a regression: a larger plan trips more structural checks,
and each one is declared to the runner.

Enforced by `INV-PLAN-PEAK-NOT-BELOW-START` (`warn`), which measures the
**DELIVERED** week rather than the target — §106 floors `peakKm`, but the runner
reads `weekly_km` on placed sessions and the two diverge downward through the
weekday cap and §2's injury-cap trims. ADR-022's finding restated. **Not excusable by
`volume_profile: 'maintenance'`**, unlike its neighbours §23/§46/§52: a
detraining block is not an honest response to a constraint, and relabelling it
must not make it acceptable.

---


---

### Amendment — the plan may not fall below its OWN start either (COMPLIANCE-FIX-1, Coaching Board 2026-09-16)

**Principle.** A plan's lowest **progressive** week (base, build or peak) may not fall
more than `MAX_DELIVERED_DECLINE_PCT` below its own week 1. `volume_profile:
'maintenance'` does **not** excuse it.

**Why the section above was not enough.** §106 fixes the peak *target* against the
volume the runner **stated**. A plan can clear that in week 1 and then collapse. The
review case that prompted this amendment (2026-09-16 cohort sitting) ran **43 km in
week 1, 18 km by week 9**, and a peak phase of 22-27 km — and satisfied §106
throughout, because week 1 exceeded the stated 40 km. **§106's reference point is the
runner's declaration; this amendment's is the plan's own first week.** The two are
different questions and the sweep confirms it: they overlap on 5.8% of plans.

**This is not a new position, it is the 2026-09-11 ruling reaching the shape it
missed.** §106's invariant already records this board's words: *"A detraining block is
not an honest response to a constraint, it is a worse plan than no plan, and
relabelling it must not make it acceptable."*

**Measured, 15,973 sweep plans.** 2,425 (15.2%) decline 30% or more across
base/build/peak. **2,046 of them carry a note claiming the plan "maintains your
fitness"** while the median such plan drops 35%; **379 say nothing at all.** Median
decline across all plans is 0% and p75 is 14%, so this catches a tail, not ordinary
variation.

> ⚠️ **The claim and the delivery disagreed inside a single sentence.** The
> maintenance note states its own numbers — *"this plan peaks at 27km against 43km
> earlier in the plan"* — and then concludes *"It maintains your fitness rather than
> building it."* A 37% fall described as maintenance. The board ruled the remedy is
> **structural, not editorial**: the plan must stop descending, and the note follows
> the plan rather than the reverse.

**The mechanism, traced.** On a low-day, time-capped runner the long run is already at
its §45/§80 time cap and easy runs are capped against it (§9). Adding a quality
session therefore **displaces** easy volume instead of adding to it — the note says so
itself. Volume collapses at exactly the base→build boundary where quality enters.
**Fixing that trade is the producer half of this amendment and is not yet shipped.**

**Config.** `GENERATION_CONFIG.MAX_DELIVERED_DECLINE_PCT = 30` — **derived, not
chosen**: the complement of `RECOVERY_WEEK_VOLUME_PCT` (70). §3 sanctions a deload at
70% of the prior week, so 30% is the largest reduction this constitution anywhere
calls legitimate, and a base/build/peak week falling further than a sanctioned deload
is not a training week.

**Measured on the right set, which took three attempts.** Race week, deload weeks and
the taper are all excluded — each is low **by design**, and including any of them
measures the design rather than a defect. Including the taper put the median at 47%
against 35% without it, and the prompting case's lowest week was a *taper* week while
its actual defect was a *build* week.

Enforced by `INV-PLAN-NOT-DETRAINING`.

> ⚠️ **Shipped at `warn`, against the board's ruling of `error`, as a stated
> sequencing decision.** `enforceViolations` throws on `error` in dev/test, so
> shipping at that severity would make `generateRulePlan` throw for 15.2% of inputs
> and take the whole verify suite down before the producer fix exists. The board's
> intent is preserved in full: **the compliance gauge counts a detraining plan as
> unacceptable regardless of this severity.** Promote to `error` once the producer
> fix brings the count near zero — and if it does not, the producer fix failed.

**Board:** COMPLIANCE-FIX-1, 2026-09-16 — CORRECT, Hutchinson chairing, no dissent on
the finding. Extends §106. Does not touch §23/§46/§52's licensing of maintenance where
the RUNNER's constraints genuinely bind.

## 107. A session may not prescribe work it does not record

*(Coaching Board ZONE-BAND-02, 2026-09-12. CORRECT WITH AMENDMENT — the amendment
being that the first step is not a display change.)*

**Principle.** Where a session prescribes a **pace segment** — a portion of the
session run at a named pace other than the session's own — that segment MUST be
recorded in a structured field. The whole-session `pace_target`, `hr_target` and
`rpe_target` describe the session's **aerobic body**; they are not its complete
prescription and must not be read as one. A session that cannot express its
segments — because the paces they need are not derivable for that runner — is
not prescribed at all; the runner receives the unsegmented session instead.

**Why.** §84 Amendment 1 settled that `hr_target` is the prescription and
`session.zone` is a label derived from it, so the two cannot drift. The segmented
long run was explicitly carved out of that invariant's scope (it is scoped to
*range* targets, and this session carries a *ceiling*) and recorded rather than
swept in. Measured 2026-09-12 across the 621-plan cohort, that carve-out was
hiding three separate failures, not one label disagreement:

1. **All three whole-session fields described the easy portion only.**
   `pace_target: '7:30–9:00 /km'`, `hr_target: '< 145 bpm'`, `rpe_target: 6` — on
   a session whose coach notes prescribe *"middle 20% at marathon pace, final 30%
   at HM pace"*. `session.zone` (`Zone 2–3`) was the **only field telling the
   truth**, which is why the board rejected the proposal to narrow it: that
   option removed the one honest signal and left the card internally consistent
   and wrong (Sims — disguising hard work as moderate is §84's own named failure
   mode; Hutchinson — tidying, not correcting).
2. **288 of 396 such sessions recorded no segment at all.** The structure existed
   as prose in `coach_notes` and nowhere machine-readable, so no invariant could
   check it and no surface could render it.
3. **108 of those were a live text defect.** `buildFallbackPace` returns null
   marathon and HM paces for beginners and says why in as many words — *"no pace
   segments prescribed (§24b)"* — but the producer built the session anyway and
   fell back to the literal **words**, so every beginner on a time-targeted 5K or
   10K plan read *"Middle 20% (≈2.1 km) at marathon pace: marathon pace."* in
   their final two peak weeks: a sentence that repeats itself and gives them no
   number. 108 of 108 beginner sessions; 0 of 108 intermediate/experienced.

Widening `hr_target` to a range covering the finish was rejected on the opposite
ground (Seiler, Willy): 50–70% of that run must stay under the aerobic ceiling,
and putting the fast work at the **end** is what makes that safe. Dissolving the
ceiling to fix a display would delete the training constraint to solve a
rendering problem — and half these sessions go to beginners.

**Config.** No new numeric. §24b's `LR_5K10K_PEAK_MID_SEGMENT_PCT` (0.20) and
`LR_5K10K_PEAK_FINAL_SEGMENT_PCT` (0.30), and §25's segment fractions, already
exist and are already read. This principle records their output; it does not add
a knob. The absence is deliberate and stated so it is not read as an oversight.

**Enforcement.** `INV-PLAN-LR-SEGMENT-RECORDED` — a long run carrying §24b's
segmented zone (`Zone 2–3`) must store `lr_segment_pace`. Keyed on
`session.zone`, which the engine authors and the AI enricher does not rewrite
(D-17), never on the label or the notes. Selection is gated in
`buildWeekSessions()` on `pace.marathonPaceStr && pace.hmPaceStr`, and
`fiveKTenKPeakLongRunSession` now **throws** rather than substituting placeholder
text if that gate is ever removed.

> ✅ **Scope CLOSED 2026-09-13 (LR-SEGMENT-RECORDED-§25).** The note below is
> retained as the record of what was open and how it was shut.
>
> ⚠️ **Scope, declared — §25's two producers were NOT covered at first ship.** The
> HM (`hm_pace_long_run`, 108 sessions) and marathon (`mp_long_run`, 72)
> race-specific long runs recorded no segment, and `session.zone` was authored
> beside `hr_target` rather than derived from the segments. That was the remainder
> of the board's ruling — steps 1 (for §25) and 2 — open work, not a silent gap.
> The invariant shipped scoped to §24b so it landed clean rather than with a
> 180-session baseline.
>
> **How it closed** (Coaching Board batch sitting 2026-09-13, ruled **EXEMPT**:
> recording what the engine already prescribes is defect-closing, restores
> documented intent, ADR-017-exempt).
> · **Step 1** — `raceSpecificLongRunSession()` writes `lr_segment_pace` at goal
>   pace. Goal pace IS the segment pace for these two rows (the final portion runs
>   at MP or HM pace), so no §24b ceiling applies and `INV-PLAN-5K10K-LR-PACE-CAP`
>   stays correctly 5K/10K-only. Measured on a 30-session HM/MARATHON grid:
>   **0% → 100% recorded**, same session count.
> · **Step 2** — the zone is now DERIVED from the catalogue row's
>   `intensity_zones` via `zoneStringFromZoneKeys()` (the inverse of
>   `zonesFromZoneString`, in the same module, round-trip tested). The row already
>   declared `['Z2','Z3']` and **nothing read it** — decorative config, §93's
>   class — while the producer hand-wrote the same fact beside it. 30/30 sessions
>   already agreed, so this is a **no-op in output** that converts a coincidence
>   into a guarantee. A mutation test proves the derivation is live rather than
>   decorative; without it the equality would prove nothing.
> · **Step 3** — `INV-PLAN-LR-SEGMENT-RECORDED` broadened to HM/MARATHON in the
>   same commit, as the ruling required. **Zero new violations** across the
>   15,973-plan sweep (every warn rate byte-identical to the prior run).
>
> ⚠️ **A third defect, found by the broadening** — §47's peak long-run alternation
> promises to "drop race-pace catalogue specificity" and dropped the label, zone,
> notes and segment pace, but left **`catalogue_id`** pointing at
> `mp_long_run` / `hm_pace_long_run` on a session it had just rewritten into a
> plain Zone 2 step-back. ADR-018 makes that id the session→row join, so the plan
> carried a row identity its prescription no longer matched. Latent rather than
> live — `composeSession` derives its MP sub-shape from the LABEL, which §47 does
> rewrite — which is precisely how it would have bitten later, since ADR-018's
> direction of travel is re-keying label heuristics onto `catalogue_id`. Fixed in
> the same commit; total output delta across both golden personas is **four
> lines** (2 × `lr_segment_pace` added, 2 × stale `catalogue_id` removed).
>
> ⚠️ **A second scoping trap found while falsification-testing this invariant.**
> The first version sat inside the `plan.meta.vdot` block alongside
> `INV-PLAN-5K10K-LR-PACE-CAP` and **could not be made to fire** — a plan paced
> from `fitness_level` rather than a benchmark has no VDOT, so that entire block,
> including the pace cap, does not run for those runners. This check needs no
> VDOT and now sits outside it. The cap's own VDOT gate is legitimate (it computes
> a ceiling from one) but its reach is narrower than it looks.

---

## 108. What a run SCORES, and what stays outside the score

*(Coaching Board UX-POSTRUN-01, 2026-09-12. Split ruling: INSUFFICIENT EVIDENCE
on the filed question, CORRECT on governing the numerics the scan found.
**Ratifies the values that already ship — no runner-visible change.**)*

**Principle.** A completed run is scored on **four objective axes**, weighted:

| Axis | Weight | Why |
|---|---|---|
| HR discipline | **0.50** | The only axis that speaks to intensity distribution, which is the product's entire thesis. A run at the right distance and pace with the heart rate in the wrong zone is the failure Zonna exists to name, so it carries half the score alone. |
| Distance | 0.25 | Did the prescribed work actually happen. Objective, and the runner controls it. |
| Pace | 0.15 | Deliberately BELOW distance: pace is the axis most distorted by heat, hills and traffic, and §1's grey zone is entered by runners chasing it. |
| Efficiency factor | 0.10 | The longest-horizon signal and the noisiest run-to-run, so it informs the score without being able to dominate it. |

Banded into a verdict: **nailed ≥ 80 · close ≥ 60 · off_target ≥ 40 · concerning
< 40.** "Concerning" is deliberately the unbounded tail rather than a band — a
session can be arbitrarily far from its prescription, and the word should be
reachable when it is.

**Subjective inputs stay OUTSIDE the score.** RPE and fatigue are collected,
stored and shown, and are **not** weighted into `total_score`. Folding them in
would assert an exchange rate between how hard a session *felt* and how
disciplined the heart rate *was*, and no such rate is known (Hutchinson). Sims
adds the reason it matters beyond modelling: subjective load carries signal the
device does not — particularly across the menstrual cycle and in under-fuelled
runners — and averaging it into a composite is how that signal stops being
actionable. **They belong beside the score, never inside it.**

**Why this section exists at all — and it is the same failure twice.** These
numerics ship today and have since scoring launched. They had **no principle and
no mechanical check**, because they live in `lib/coaching/constants.ts` and
`configPrincipleSync.test.ts` read only `GENERATION_CONFIG`. That is
`peakKmByLevel` verbatim: the Configuration Singularity bypassed by a file path,
the exact lesson CLAUDE.md records from §106 — *"when you add a coaching numeric,
the file it lives in is part of the decision."* Nobody could say why HR
discipline is 0.50 rather than 0.4, or what `< 40` is for, and both decide what a
runner is told about their run.

**Config.** `lib/coaching/constants.ts`:
- `SCORE_WEIGHTS.hr_discipline` = 0.50 · `SCORE_WEIGHTS.distance` = 0.25 ·
  `SCORE_WEIGHTS.pace` = 0.15 · `SCORE_WEIGHTS.ef` = 0.10 (sum 1.0)
- `VERDICT_BANDS.nailed` = 80 · `VERDICT_BANDS.close` = 60 ·
  `VERDICT_BANDS.off_target` = 40 (below it, "concerning")

**Values unchanged by this ruling** — it ratifies and explains them. The literal
keys are named here on purpose: the sync check requires the principle to name the
WEIGHT, not merely the group, because "SCORE_WEIGHTS" appearing once would
otherwise document four separate coaching decisions with a single word.

**Enforcement.** `configPrincipleSync.test.ts` now reads `lib/coaching/constants.ts`
**as well as** `GENERATION_CONFIG`, so a coaching numeric can no longer escape the
singularity by living in a different file. The weights are additionally asserted
to sum to 1.0 — a weighting that does not is a silent rescaling of every score.

> ⚠️ **NOT ratified, and recorded so it is not assumed later:** any exchange rate
> between RPE/fatigue and the objective axes. A future proposal to fold them in
> is a NEW board question, not an extension of this section.
>
> 🔲 **The filed question is still open (INSUFFICIENT EVIDENCE).** UX-POSTRUN-01
> asks whether "four numbers after a run" should become one. **Those four numbers
> could not be found in the product**: `SessionCompleteCard` renders one 44px
> headline — zone % once the analysis lands, RPE while it polls — plus a fatigue
> chip. Before anything is built the founder must point at the screen that felt
> confusing. What would settle it: a screenshot, or the wizard/screen name.

### Amendment 1 — no composite score when the HR axis is unmeasured — added 2026-09-13 (Coaching Board)

**Principle.** When `hr_discipline` cannot be computed, **no total score and no
verdict are produced.** The axes that WERE measured are still shown. A neutral
value is never substituted for an unmeasured axis.

**Why.** The function substituted **75** — a "close" score — for the axis carrying
**half** the weight, so 37.5 points of every no-HR score were invented. §108 gives
that axis 0.50 precisely *"because it is the only axis that speaks to intensity
distribution, which is the product's entire thesis"*; defaulting it to a pass
asserts the thesis was satisfied when nothing observed it.

**Measured in production 2026-09-13:** 126 scored runs, **12 (9.5%) with no heart
rate at all**, scoring `61, 69, 69, 69, 76, 81, 81, 81, 81, 81, 81, 81`. **Seven
were told "nailed"** — a verdict about intensity discipline on a run where
intensity was never measured.

**It also inverted the incentive.** The same run scored **41 ("off target")** with a
monitor showing poor discipline and **69 ("close")** with no monitor at all. Not
wearing the strap was worth 28 points, while the coach note told the runner to
wear it. McMillan: *"You cannot coach someone whose scoreboard rewards not being
measured."*

**Renormalising over the remaining axes was REJECTED.** It would make a no-HR score
*more* confident, not less. Seiler: the point of measuring distribution is
measuring it, and for recreational runners the honest prior for an unmeasured easy
run is worse than neutral, not better. Same principle as §107 — a session may not
prescribe work it does not record.

**A single average HR still counts as measured.** The coarse fallback (avg HR
against the ceiling parsed from `hr_target`) is an observation, not an assumption.
Withholding there too would punish chest-strap and older-device runners for the
engine's preference for streams — and Sims noted the iPhone-only cohort skews
older and more female, which is where under-recovery matters most.

**Config.** No new numeric. The rule keys on the existing
`SCORE_WEIGHTS.hr_discipline` (0.50).

**Enforcement.** The TYPE is the check: `SessionScoreResult.totalScore` and
`.verdict` are now `number | null` / `Verdict | null`, so the compiler forces every
consumer to handle absence rather than rendering a fabricated number. Two call
sites were caught by it on the first compile. Tests: `sessionScore.test.ts` — which
**did not exist before this amendment**, on the function that decides whether a
runner is told "nailed" or "concerning".

---

## 109. A progress surface may remember and compare. It may not predict.

*(Coaching Board, 2026-09-12, CORRECT WITH AMENDMENT. Extends §44's
fabricated-precision doctrine from plan feasibility to progress display.)*

**Principle.** A surface showing a runner's progress may state:
- **where they were** — a stored baseline, recorded at plan creation;
- **where they are** — an estimate from *measured* fitness, carrying its
  confidence **in the copy, not in a tooltip**;
- **the goal they chose** — the runner's own `target_time`, framed by
  `meta.goal_beyond_measured_fitness` as within reach or demanding on current
  evidence.

It may **NOT** state a time the runner did not supply for a date that has not
happened. No projected race-day finish, no rising line toward a race date, no
percentage or probability of achieving a goal.

**Why.** §44 already settled this for plan feasibility, and the reasoning
transfers without modification: *"with one benchmark run and one max HR the
engine cannot defend a probability — a '72% chance' is fabricated precision, and
false precision is an overclaim."* A projected race-day time is that same claim
wearing a different number. Fitness does not extrapolate linearly, and the last
eight weeks of improvement are the **worst** available predictor of the next
eight, because the early gains are the cheap ones (Hutchinson). A VDOT-derived
time is a statement about a *test* — "an athlete with this measured economy
typically runs X" — and is defensible when labelled as that. The moment it is
drawn as a line toward a date, a trajectory has been asserted that nobody can
defend (Seiler).

Two further reasons the board recorded:
- **Willy:** show a beginner a potential time faster than their goal and some of
  them will train for the potential instead of the plan. The projection becomes
  an unsupervised target, which is how a sensible plan gets run 15 sec/km too fast.
- **Sims:** the four confidence states exist because data quality genuinely
  varies. A woman in the luteal phase, under-fuelled, sees an estimate that
  reflects the day rather than her fitness. "Potential" without "on current
  evidence" reads as a verdict on her.

**The regression case is designed FIRST, not last (McMillan).** A progress
surface that can only speak when the arrow points up is marketing. It must be
able to say *"you have gone backwards, and here is why that is normal in week 3
of a build"*. If it cannot, it does not ship.

**Config.** No new numeric. `meta.goal_beyond_measured_fitness` (§44 Amdt,
CD-16/SC-06) and the four confidence states already exist and are already
computed.

**Enforcement.** `raceProjectionHonesty.test.ts` — the race-times contract
carries no field naming a future-dated projection, and no user-facing projection
copy makes a forward-looking claim. Mechanically checkable because the copy is
centralised in `raceProjectionsCopy.ts` and nothing user-facing is hardcoded in
the component.

> **Ratified by this section and not to be re-derived:** `baselineSeconds`,
> `currentSeconds` and `deltaSeconds` (R31) are **memory and comparison**, not
> prediction, and were never in question. Only the third element of "where I
> was, where I am, what the potential is" invents anything — and the ruling is
> that it must not.

### Amendment 1 — when there is NO measurement, state the band, not the time (Coaching Board 2026-09-17)

**The gap this closes.** The principle above permits *"where they are — an
estimate from **measured** fitness, carrying its confidence **in the copy, not
in a tooltip**"*. It never said what a progress surface may do when there is no
measured fitness **at all**. The race-projections card fell straight through
that gap, and breached both of the clause's conditions at once: nothing had been
measured, and the confidence lived in the **colour of a chip**, which is less
than a tooltip.

**What it was doing.** With no benchmark and no qualifying runs, the card
asserted a VDOT from a hand-authored 3×4 table indexed on two wizard answers,
then rendered a marathon finish **to the second** (`3:54:16`). Measured on the
live database: **11 of 19 plans (58%) carry no benchmark**, so this was the
majority path, not an edge case. The whole no-benchmark population had **nine
distinct outcomes**. One of the two inputs is an OPTIONAL wizard step, and a
runner who declined it was silently given the middle bracket — so *"I'd rather
not say"* and *"18 months"* produced **identical figures**, and 2 of 6
comparable live plans were in exactly that state.

**Principle.** Where no fitness has been measured, a progress surface may still
orient the runner, but:

1. **The estimate is DERIVED from the runner's classification band (§13), never
   asserted independently of it.** A number that contradicts our own classifier
   is not a conservative estimate, it is a second opinion nobody authored.
2. **Its precision must match its evidence.** Minute precision, never seconds.
   *Precision is a louder signal than any caveat* — a runner reads sixteen
   seconds as a measurement whatever the label beside it says.
3. **A declined input widens the estimate; it never substitutes a default.**
   Silently taking the middle bracket converts a shrug into a finish time.
4. **The action leads.** On this state the useful content is not the figures, it
   is the one thing that replaces them with a measurement.

**Why the table was ruled INCORRECT.** ⚠️ **Six of its twelve cells asserted a
VDOT that §13's own `FITNESS_VDOT_THRESHOLDS` classifies as a DIFFERENT level
from the label that selected the cell.** A runner classified `experienced` was
handed 45 or 48, both below `experienced_min: 50`; a `beginner` was handed 37,
above `intermediate_min: 35`. It also applied its own bare `× 0.95`, a second
conservatism doctrine against §10's ratified 3%, named nowhere. And it lived in
`app/api/race-times/route.ts` — outside `GENERATION_CONFIG`, so no principle
explained it, `configPrincipleSync.test.ts` could not see it and the
coaching-guard hook never fired on it. **The `peakKmByLevel` / §106 class
exactly: every governance layer bypassed by a table being in the wrong file.**

**Chair's note on the remedy (Hutchinson).** The board refused a re-tune. Twelve
hand-authored numbers drift from the principle beside them — that is what had
already happened — so the estimate is now **derived** and the contradiction is
impossible by construction rather than corrected once.

**Provenance, stated because nobody could state it before (Sims).** These are a
**prior**, not a measurement, and the population they describe is unrecorded.
Daniels' normative data skew male. They are **not** sex-adjusted and must not be:
VDOT is a performance measure, and a woman who runs the time has the VDOT. The
honest correction is the **width** of the claim, not its level.

**Recorded, unresolved (Seiler vs McMillan).** The band fractions decelerate
because improvement in recreational runners is front-loaded. The board recorded
**INSUFFICIENT EVIDENCE** on the exact curve — nobody has the amateur cohort data
— and anchoring on §13 sidesteps it, since that requires only that we stop
contradicting ourselves, not that we know the true curve. McMillan separately
defends the flat top of the beginner row on structural grounds ("beginner" is
low volume and modest speed, not time served, so a plateau is honest). **Do not
re-tune these fractions without cohort data.**

**Config.** `GENERATION_CONFIG.ESTIMATE_VDOT_BAND_FRACTIONS` (positions within
the band; they are offsets 3/7/10/13 of the 15-wide band, i.e. exactly the
shipped intermediate row, so the majority path does not move) and
`ESTIMATE_VDOT_DISCOUNT_PCT: 5` — deliberately larger than §10's 3%, which
discounts paces from a **real** benchmark. Band edges are derived from
`FITNESS_VDOT_THRESHOLDS`; no new band numeric enters.

**Enforcement.** `INV-EST-VDOT-AGREES-WITH-CLASSIFIER` —
`lib/plan/estimateVdotAgreesWithClassifier.test.ts`. ⚠️ **Deliberately NOT a
`validatePlan()` invariant:** it asserts that two CONFIG SURFACES agree, and no
Plan is involved at any point. As a plan invariant it would run only when a plan
happened to be generated, which is strictly weaker than running always. Total,
not sampled: twelve combinations, raw and discounted. Falsified against the
shipped table, where it names all six offending cells.

**Willy's condition, verified before the ruling landed:** the projected VDOT
reaches no prescription path. `bracketVdotFor` has one call site, the route is
read-only, and the only consumer is a display component. Had it fed goal pace or
session targets, this would have been a separate sitting.

---

## 56. The constitution

---

## 110. `avoid` is a floor, not a switch

*Added 2026-09-16 — Coaching Board (CB-HSR-AVOID-01). Unanimous on the ruling; one dissent recorded on scope.*

**Principle.** `hard_session_relationship: 'avoid'` caps quality at
`HARD_AVERSE_QUALITY_PER_WEEK_MAX` (1) per week and joins §96's brake on §89/§91
early onset. It **never sets quality to zero.** A runner who says they avoid hard
sessions gets fewer and later, not none.

**What it replaced.** `suppressQuality` in `buildWeekSessions` set
`plannedQuality = 0` for **every week of every plan**. Measured on the
15,973-plan property sweep: **2,197 non-beginner plans (13.8%)** received zero
quality across 8+ weeks. Those runners had chosen a race. Several had chosen a
time goal.

**Why no seat could defend zero.**

- **Seiler.** Self-organising recreational runners land at 10–15% hard. 100/0 is
  outside any population he has measured. It is not a conservative reading of
  80/20; it is a different model, and LSD-only has a documented ceiling. *"The
  point of the polarised distribution is that the easy is easy so the hard can
  be hard."*
- **Willy.** The volume curve still ramps. Zeroing intensity does not remove
  load, it swaps intensity risk for monotonous-volume risk, which is the one
  that produces bone stress injuries.
- **Sims.** Monotonous low-intensity running is close to the worst osteogenic
  stimulus available, and bone is where this lands for the peri- and
  post-menopausal runners in this demographic. She also expects `avoid` to be
  selected more often by women for cultural rather than physiological reasons:
  **a default that silently removes intensity, selected disproportionately by
  women, and justified nowhere in this document, is the pattern her seat exists
  to catch.**
- **McMillan.** *"I avoid hard sessions"* means *I don't know how*, or *the last
  one hurt*. Each is an argument for one small well-explained hard session, not
  none.
- **Hutchinson.** No evidence supports zero intensity as preparation for a time-
  goal race. The overclaim was in the product, not the physiology.

**Why 1 — §96's precedent forces the number.** §96 ruled that a brake *"returns
the runner to the standard plan, byte for byte. It does not cut below baseline."*
1/week **is** the baseline for build phase (§8) and for a non-experienced peak.
What `avoid` gives up is the experienced runner's **second** peak quality session.
The brake removes the surplus, never the substance.

**This is the rung §35 declared and never built.** §96 named the gap exactly —
*"It never built the rung going the other way"* — and then built it for `overdo`.
`avoid` was the other half, and what existed in its place was an off switch.

**§40c applies and was breached.** `hard_pref_note` fired for `love` **only**, so
2,197 runners had every quality session removed and **the plan said nothing**.
§40c's standing rule is that a suppressed target is stated, never absorbed
silently, and that the note must name the lever. It now does.

**Achilles is removed from the suppression entirely, and that half is a DEFECT
FIX, not a ruling.** §21 prescribes **substitution** for hill-restricting
injuries — *"Substitutes are progression runs or flat tempo at equivalent
intensity"* — and that is already wired: `excludeHillSessions` filters hill rows
out of `selectCatalogueSession()` via `HILL_RESTRICTING_INJURIES`, which contains
`achilles`. `suppressQuality` then **deleted the flat session §21 had just
substituted**, for 756 plans. The engine satisfied §21 and overrode itself 400
lines later. Willy, decisive: tendinopathy management is progressive **loading**,
not unloading — the hill exclusion is right because the eccentric load at the top
of each rep is the aggravator, and flat tempo is not. No principle change was
needed; §21 already said the right thing.

**⚠️ WHY THIS SURVIVED — the transferable part. §1 is a CEILING with no floor.**
`QUALITY_SESSIONS_PER_WEEK_MAX` is an upper bound, so a plan delivering 0%
quality breaches nothing, and **no invariant fired anywhere on 2,197 plans.** An
assertion expressed only as an upper bound cannot detect the floor falling out.
This is why `INV-PLAN-QUALITY-NOT-ZERO` is a condition of the ruling rather than
a nicety: without it, the next mechanism to zero out quality is exactly as
invisible as this one was. Same family as §5's `SPECIFICITY_BY_PHASE` (declared,
never read) and §1's own four-month error — **a value nothing can falsify is not
governed.**

**Recorded dissent (McMillan).** He would have the reduced dose start on the
normal schedule and not delay onset; Willy's position (delay, on §96's exact
logic) prevailed as the more conservative and the one consistent with precedent.
**What would settle it:** first-quality-session adherence by
`hard_session_relationship`, which does not exist yet.

**Measured blast radius.** Fit-for-purpose across the sweep **54.3% → 97.7%**.
Delivered volume is **unchanged** — peak and week-1 identical in the traced cell,
confirming VOL-SHORTFALL-01's finding that §9 redistribution preserves weekly
total. `avoid` plans converge on the `neutral` cohort's existing residual rates
(`INV-PLAN-PEAK-IN-PEAK-PHASE` 44 → 123 against neutral's 111;
`INV-PLAN-NOT-DETRAINING` 28 → 48 against neutral's 50) — **they were previously
quiet because zero quality left those checks partly unreachable, not because
those plans were better shaped.** `INV-PLAN-PEAK-SPECIFICITY` rose 433 → 769 for
the same reason: it opens `if (peakQuality > 0)` and could not see a plan with no
key sessions at all.

### Amendment 1 — what "fewer" means for a runner already at one a week

*Added 2026-09-16, same day, second sitting. The first sitting's numeric was wrong and measurement is what said so.*

The first sitting set `HARD_AVERSE_QUALITY_PER_WEEK_MAX = 1` and reasoned that
§96's precedent fixed the value. **Measured across a 540-cell grid, that left
`avoid` byte-identical to `neutral` for 72.6% of runners and 100% of
intermediates** — an intermediate never earns two quality sessions a week, so a
cap of 2→1 cannot bind on them. That is §96's own defect reproduced one section
later, and it was caught by `coaching-deviation-scan` flagging the persona as
unreached, not by review.

**The misreading, stated plainly, because it is the reusable part.** §96's
*"does not cut below baseline"* was scoped to `overdo`. §96 line 4771 had already
settled the distinction: conflating the two *"would take work from a runner who
asked to be **paced**, not **spared**."* `overdo` is paced — baseline. `avoid` is
spared — **below** baseline. Quoting a precedent without checking which persona
it was scoped to produced a numeric that did nothing.

**The amendment.** `avoid`'s quality session is **smaller**, sized at
`HARD_AVERSE_QUALITY_DOSE_PCT` (85%) of the standard share. Freed distance
returns to the easy runs through §9's re-derivation, so the week is the same size
and only the hard part of it is shorter. That is what *spared* should mean, and
it is what McMillan asked for: the runner who says the last one hurt gets a
**shorter** one.

**⚠️ TWO OTHER LEVERS WERE BUILT, MEASURED AND WITHDRAWN. Recording why is the
durable part of this amendment.**

1. **A quality session every other build week.** It collided with **three**
   separately-ratified rules in succession: §5's VO2max adaptation deadline (on a
   14-week 10K the natural slot lands *exactly* on the deadline, so any earlier
   skip fires `INV-PLAN-VO2MAX-ONSET`), then §53's variety cap (a thinner
   rotation repeats `tempo_continuous` — **61 new errors**), then §79's intensity
   re-entry window (**264 new errors**). Each fix produced the next collision.
   **The build rotation is tightly coupled** — §5's deadline, §22's rename, §53's
   variety and §79's window all key off its index and calendar position — so
   removing half its weeks perturbs all four. Three collisions from one lever is
   a signal the lever is wrong, not that a fourth patch is needed. **Dose is the
   one axis nothing else keys on.**
2. **Withholding VO2max plan-wide**, reusing §79's `excludeHighTissueStress`.
   Produced **61 new §53 variety errors**: removing a whole category leaves the
   eligible pool too thin to satisfy the anti-repeat cap. That is CAT-DEPTH-01's
   known catalogue thinness, and §79's lever is calibrated for a few weeks of one
   runner's plan, not a standing preference — **stretching a bounded mechanism
   past its calibrated duration is what broke it, not the idea.** Withdrawn under
   D-21, and it bought no measured reach.

**Reach, measured.** Beginner 100% inert (correct — they have no quality for
`avoid` to modify, which the 2026-08-30 classifier ruling ratifies); intermediate
100% → **27%**; experienced 18% → **0%**. The intermediate residual is cells whose
quality session is already pinned at `MIN_SESSION_DISTANCE_KM`, where a
percentage cut cannot bind. **That residual is declared, not absorbed** (§34) —
those runners still carry `hard_pref_note`.

**Config.** `GENERATION_CONFIG.HARD_AVERSE_QUALITY_PER_WEEK_MAX = 1`,
`GENERATION_CONFIG.HARD_AVERSE_QUALITY_DOSE_PCT = 85`,
`GENERATION_CONFIG.QUALITY_FLOOR_MIN_PLAN_WEEKS = 8`. Enforced by
`INV-PLAN-QUALITY-NOT-ZERO`.

**85 is derived, not chosen.** Swept 70/75/80/85 across 15,973 plans: everything
below 85 fires a new `INV-PLAN-LR-MAX-WEEKLY-PCT` error on a 3-day HM profile,
and 85 is clean. The mechanism **qualifies a finding this document already relies
on**: VOL-SHORTFALL-01 measured that shrinking a quality session preserves weekly
volume, because §9 hands the freed distance to the easy runs — but that was
measured on a **five**-day profile. On a three-day week there are not enough easy
slots to absorb it against §9's own easy ceiling, so the week genuinely shrinks
and the long run's share climbs past §52's 60% cap. **VOL-SHORTFALL-01's result
holds where it was taken, and not below it.**

### Amendment 2 — a beginner who set a TIME TARGET gets one quality session (Coaching Board CB-BEGINNER-TIMEGOAL-01 + CB-BEGINNER-CATALOGUE-01, 2026-09-19)

**Principle.** A runner the engine classifies `beginner` who has set a **time
target** receives quality capped at `BEGINNER_TIME_TARGET_QUALITY_PER_WEEK_MAX`
(1) per week, entering at the **existing onset and never earlier**. A beginner
on a **finish** goal is unchanged and still receives none — the same board ruled
that half CORRECT AS IS, unanimously, and did not reopen it.

**Why. The gap was BINARY, not a lighter dose** — measured across 45,888 plans:

| cohort | n | zero-quality | any goal-pace session |
|---|---|---|---|
| beginner · time_target | 6,336 | **100%** | **0%** |
| intermediate · time_target | 6,336 | 0% | **100%** |
| experienced · time_target | 6,336 | 0% | **100%** |

Every cohort that sets a time target runs at that pace except one, which runs at
it **zero percent of the time** — handed a goal pace they will never once have
run. The contradiction was already inside §110: its own ratified rationale
records Hutchinson — *"No evidence supports zero intensity as preparation for a
time-goal race"* — and the floor built from that ruling exempted beginners
**without separating the beginner who set a time goal from the one who did
not.** §8 had said the same thing even longer (§8 Am.1).

**Why 1.** §96's precedent, the same one that fixed
`HARD_AVERSE_QUALITY_PER_WEEK_MAX`: 1/week **is** the build-phase baseline (§8).
McMillan: *"I am not asking for six kinds of session, I am asking for one."*
**Willy raised the frequency objection and withdrew it on the numbers** — the
literature starts a new runner at one session every *two* weeks, and measured
onset here is week 5–7 with 6–10 sessions across a 20-week plan, which averaged
over the block already is roughly every other week. The onset gate is unchanged
and deliberately so.

**§28 is not a substitute and was checked.** Beginner plans already carry
strides and hill strides (14 sessions in the traced 20-week plan) — genuine
neuromuscular and osteogenic stimulus, which is why Sims did not press her §110
bone-loading objection. Seiler's point stands regardless: strides are not **a
repeatable hard session the runner can learn to pace**, and pacing is the entire
content of a time goal.

**⚠️ FIRST ATTEMPT WAS REVERTED, AND THE REASON IS THE USEFUL PART.** Shipping
the ceiling alone produced **31 test failures across 13 files**: of 29 catalogue
rows exactly ONE was beginner-eligible (`aerobic_steady`, Z2 aerobic, base+build),
so a beginner had no eligible row in peak or taper, `selectCatalogueSession`
returned null, and the session shipped with no `catalogue_id`
(`INV-PLAN-CATALOGUE-LINK`, ADR-018). **The ruling was correct and the engine
could not honour it.** That is what CB-BEGINNER-CATALOGUE-01 then fixed.

**⚠️ AND THE MEASUREMENT THAT LOOKED LIKE SUCCESS WAS READING THE DEFECT.** The
post-change table showed beginner time-target goal-pace exposure going 0% →
**100%**, which is exactly what a working fix looks like. Those labels came from
the null-row fallback — sessions with no catalogue row. **A label is not a
prescription.** The invariant caught it; the measurement did not.

**Config.** `GENERATION_CONFIG.BEGINNER_TIME_TARGET_QUALITY_PER_WEEK_MAX = 1`.
**Single owner:** `lib/plan/qualityCeiling.ts → qualityCeilingFor()`, read by
BOTH `buildWeekSessions` and `INV-PLAN-QUALITY-PER-WEEK`. The ceiling stopped
being a plain table lookup the moment it became conditional, and a checker
holding its own copy of a table cannot catch the producer's copy being wrong
(DELOAD-OWNER-01, TIER-OWNER-01).

**Enforcement.** `INV-PLAN-TIME-TARGET-QUALITY-FLOOR` (error) — a time-target
plan with build/peak weeks and `QUALITY_FLOOR_MIN_PLAN_WEEKS`+ weeks must carry
at least one quality session. A floor on the COUNT, not the dose.

---

## 110b. What a beginner may be prescribed — the rung ladder

*Added 2026-09-19 — Coaching Board CB-BEGINNER-CATALOGUE-01, CORRECT WITH AMENDMENT.*

**Principle.** A beginner progresses through a **ladder** of stimuli, and the
engine may only prescribe a rung the runner has reached. The ladder is:

| rung | stimulus | status |
|---|---|---|
| 1 | strides | §28 — every beginner plan |
| 2 | hill strides / short hill sprints | §28 Am.1 — alternating with strides |
| 3 | unstructured fartlek | **not granted** — deferred, see below |
| 4 | progression run / continuous tempo | `progressive_tempo`, `tempo_continuous` |
| 5 | threshold repeats | **deferred** |
| 6 | goal-pace blocks inside an easy run | `beginner_goal_pace_blocks` |

**Why a ladder rather than a level flag.** Mainstream coaching practice for new
runners is strides and hill sprints for three to four weeks, *then* effort-based
work, *then* pace-based work. Zonna shipped rungs 1–2 and gated off everything
above them, so the ladder stopped one rung in. Rungs 4 and 6 are now reachable
for the beginner who set a time target (§110 Am.2); rungs 3 and 5 are deferred
with reasons, not forgotten.

**Rung 3 (fartlek) deferred.** `fartlek_unstructured` is `base`-phase only, and
a beginner's quality slot opens in **build**, so granting it would change other
cohorts' plans without serving this one. Revisit only with a phase change, which
is its own measurement.

**Rung 5 (threshold repeats) deferred.** McMillan would allow `tempo_cruise_short`
at 5K/10K; Hutchinson and Willy prefer to see whether beginners complete rung 6
first. **Recorded as a disagreement, not a rejection.** What would settle it:
completion data, which does not exist.

**⚠️ WHY RUNG 6 HAD TO BE A NEW ROW — §22 IS THE BINDING CONSTRAINT.**
`INV-PLAN-RACE-SPECIFIC-EXPOSURE-RATIO` raises a **per-session error** for any
second-half build/peak quality on a time-target plan that is not `race_pace`.
Lowering only the tempo rows would have taken this cohort from **vacuously
passing** (no quality at all) to **failing**. `progressive_tempo`'s mixed-anchor
exemption does not apply — that test counts PACE-anchored work steps excluding
E, and the progression's middle third is a ZONE target, so its anchor set is
`{T}`, size 1. **§22 was not an obstacle to route around; it was naming the
right prescription.**

**Willy's condition of approval — BLOCKS, NOT REPEATS.** `beginner_goal_pace_blocks`
recovers with an easy **run**, not a standing jog, and its work steps are minutes
rather than a rep distance: *"reps invite a beginner to race the recovery."*
This is also what the literature prescribes for a first-time marathoner with a
time goal — short goal-pace blocks embedded in a midweek run, not intervals.

**⚠️ A ROW WRITTEN FOR A COHORT MUST BE SCOPED TO IT — `fitness_level_max`.**
`fitness_level_min` means "and everyone above", and the §53 rotation is
least-used-first, so a NEW row starts at usage 0 and is picked **first** by the
cohorts it was not written for. Measured: adding one beginner-eligible row
changed **2,324 of 5,940 parity cases (39.1%) — 0 of 1,980 beginner plans and
~59% of intermediate AND experienced plans.** The exact inverse of the intent.
`fitness_level_max` is optional and absent on every pre-existing row, so adding
it is inert (measured: parity IDENTICAL).

**⚠️ LOWERING an existing row is FREE; ADDING one is not.** Lowering
`fitness_level_min` cannot put a row into a pool it was not already in —
measured byte-for-byte identical across 5,940 cases. That is why rungs 4 came
from lowering and only rung 6 is new.

**⚠️ TWO THRESHOLD ROWS, NOT ONE, AND §53 WOULD NOT HAVE CAUGHT IT.** With only
`progressive_tempo` lowered, a beginner marathon time-target plan received it
**ten times** (weeks 8–17, 19). `MIDWEEK_QUALITY_LADDER` excludes
`race_specific`, so marathon's midweek rotation can only ask for threshold, and
a pool of one row means the same session every week. **§53's cap is
`max(fraction, pigeonhole)` and one row picked ten times satisfies the
pigeonhole arm** — the checkers would have gone green on the exact symptom
CAT-DEPTH-01 describes. `tempo_continuous` was lowered as well; both size off
`THRESHOLD_WORK_TARGET_MINS`, so no new config.

**Config.**
- `GENERATION_CONFIG.THRESHOLD_WORK_TARGET_MINS.beginner = { build: 14, peak: 17 }`
- `GENERATION_CONFIG.PROGRESSIVE_TEMPO_MAIN_MINS.beginner = { build: 18, peak: 21, taper: 15 }`
- `GENERATION_CONFIG.BEGINNER_QUALITY_MIN_WEEKLY_KM = 20` — **the week must be
  able to carry the session** (Willy's condition of approval). A quality session
  is sized by an ABSOLUTE work-minute band, deliberately decoupled from weekly
  volume (§8/SC-08), so the same 8–11 km session is a quarter of a 40 km week
  and **71% of a 16 km one**. Measured without this floor: **640 NEW §52
  breaches on the property sweep, every one a beginner at 5–12 km/week.** The
  value is derived, not chosen — the largest beginner quality session measured
  is 11.4 km and §52's 60% cap needs a week of at least 11.4 / 0.6 = 19 km to
  carry it. Below the floor the runner gets the plan they had before: all easy,
  plus §28's strides and hill strides.
  **⚠️ A FLOOR ON THE WEEK, NOT A SCALING OF THE DOSE** — shrinking the session
  to fit the week is the CD-1 error (a share of volume cannot express "least
  sustainable per minute") and would hand a 5 km/week runner a homeopathic
  tempo. **⚠️ FAILS CLOSED:** unknown volume yields no quality, never unchecked
  quality. **⚠️ CONSTRUCTION-TIME ONLY** — the checker cannot re-evaluate this
  arm, because the post-passes trim the delivered week and re-reading it
  produced **216 false violations** (the curve-vs-delivered gap, §90/ADR-022's
  class). §52 catches the real consequence on the delivered week.

**⚠️ The evidence for those two numbers is PROPORTIONALITY AND NOTHING ELSE.**
Each level in the existing ladder steps roughly +20–25% on the one below, so
beginner steps down by the same. There is no external source for 14 any more
than there is for 18, and this section does not imply otherwise (the same
honesty §8 applies to `QUALITY_SESSION_PCT_OF_WEEKLY`).

**⚠️ A FITNESS-KEYED TABLE WITH A MISSING LEVEL IS A LATENT CRASH.** These
tables are typed `Record<string, Record<string, number>>`, so a missing key is
`undefined` and TypeScript is silent. Before the beginner entries existed,
lowering `progressive_tempo` and opening the slot threw
`resolveMainSet: parameter "third_secs" has no value in this variant` on **every**
beginner time-target plan. When a level becomes reachable, every fitness-keyed
table must be checked.

**Enforcement.** `INV-PLAN-TIME-TARGET-QUALITY-FLOOR` (see §110 Am.2) plus
`INV-PLAN-CATALOGUE-LINK` (ADR-018), which is what caught the first attempt.
The `fitness_level_max` scope is covered by `lib/plan/beginnerCatalogue.test.ts`.

---

## 111. The base-build ceiling — a marathon plan may not build too far off the base the runner actually has

*Added 2026-09-18 — Coaching Board (MARATHON-VOLUME-GATE-01), CORRECT WITH AMENDMENT. Ratifies the artifacts for a floor the board had already ruled correct in concept; the amendment set the metric, the cap, and error severity.*

**Principle.** For the marathon and ultra distances (`race_distance_km ≥ `BASE_BUILD_RATIO_MIN_DISTANCE_KM` = 42`), the plan's **delivered peak weekly volume** may not exceed `MAX_BASE_BUILD_RATIO` (4.0) times the runner's **raw stated `current_weekly_km`**. Over that ceiling the engine **refuses to generate** — it does not ship the plan — and returns, per §44, the lever and an alternative: the base volume to reach first (`ceil(peak / cap)` km/week). A `current_weekly_km` of 0 is an infinite ratio and is refused. The refusal is surfaced as "not yet", not "no" (SLT, REFUSAL-SCREEN-01): the runner has a fixed race date weeks away and the honest thing is the base to build, not a door.

**Why the metric is peak ÷ current, and not peak ÷ week1.** The danger is the jump from where the runner **is** to what the plan **demands** — a 5 km/week first-timer handed a 47 km peak is being asked for a 9.4× build, and nothing downstream caught it (`validatePlan` returned zero errors). Measured, `peak/week1` cannot see this: week 1 is floored at `BUILD_VOL_INIT_FLOOR_VS_PEAK` (35%) of peak, so `peak/week1` sits flat at ~2.6 across the entire low-volume cohort and a cap there would refuse everyone or no one. `peak/current` is monotonic in current volume and discriminating: first-timer marathon 5 km→9.4×, 12 km→3.9×, 15 km→3.1×, 20 km→2.6×, 40 km→1.3×.

**Why 4.0.** Two binding points fixed it. **The admission floor:** the flagship first-time charity marathoner (persona M1, 15 km/week → peak 47 = **3.13×**) must generate — any cap ≤ 3.13 refuses the exact cohort this exists to serve, and the board explicitly ruled 15 km (3.1×) and 20 km (2.6×) should pass. **The reckless ceiling:** ≤ 10 km/week beginner marathon (≥ 4.7×) must be refused. 4.0 sits between them: it admits current ≥ ~12 km/week (peak ~47) and refuses below, which is *less* restrictive than the ungoverned gate it replaces (`current < 20`, which refused M1 itself).

**What it replaced, and why the old gate was wrong on four counts** *(the board's ruling, recorded).* The gate was `if (race_distance_km ≥ 42 && current_weekly_km < 20) refuse`, hardcoded in `app/api/generate-plan/route.ts`. It was **(1) ungoverned** — no principle, invisible to `configPrincipleSync` and the coaching-guard hook, the `peakKmByLevel`/§106 class again; **(2) non-monotonic across its own boundary** — it refused 15 km/week (peak/week1 2.61) and permitted 20 km/week (2.60), near-identical plans; **(3) alternative-less** — a bare string where §44 requires the lever; **(4) expressed on stated volume, not the ramp it was trying to bound.** And because it lived at the route, every internal test (which calls `generateRulePlan` directly) passed while the live app refused the cohort — the boundary-invisibility §44's siblings avoid by throwing from the engine.

**Relationship to the neighbours.**
- **§23 (peak overload).** §23 is the opposite bound on a different denominator: a **minimum** on peak/**week1** (a build must overload). §111 is a **maximum** on peak/**current** (the overload must not be reckless off the real base). A plan satisfies both; they do not collide, because §111 refuses the low-base case before §23's "is this enough of a build" regime is reached.
- **§46** (absolute peak-LR floor) is about long-run distance, not weekly ramp — orthogonal.
- **§29 (fresh-return)** lowers the *start* when current volume is aspirational; §111 uses raw `current_weekly_km` as the base deliberately — it is measuring how far the ask is from where the runner says they are.
- **§10/CD-6** treats a beginner's declared volume as a claim; §111 is the refusal side of the same input.

**The base-building plan that would let a low-base runner in is deferred** (SLT part 2, Coaching Board first): `FOUNDATION_MAX_WEEKS` is 3 and a ~20-week ramp from 10 km/week to marathon readiness is a new plan type, not a longer foundation block. Until it exists, §111 refuses honestly rather than promising a plan we have not built.

**Config.**
- `GENERATION_CONFIG.MAX_BASE_BUILD_RATIO = 4.0` — delivered peak weekly_km / current_weekly_km ceiling.
- `GENERATION_CONFIG.BASE_BUILD_RATIO_MIN_DISTANCE_KM = 42` — marathon and ultra only.

**Enforcement.** The refusal is thrown from `generateRulePlan` (`BaseVolumeError`, mirroring `PrepTimeError`/`DaysAvailableError`); the computation is owned by `lib/plan/baseVolume.ts` and read by both the refusal and `INV-PLAN-BASE-BUILD-RATIO` (error) so they cannot drift. The invariant is the defense-in-depth backstop: the refusal pre-empts it in the generation path, and it catches any plan that reaches `validatePlan` over the ceiling by another route.

**Supersedes MAINT-LABEL-01/UX-BEGINNER-01 for the reckless tail only** *(Coaching Board, reconvened same day on the collision the first scan missed).* MAINT-LABEL-01 gave a very-low-base beginner marathoner (5 km/week) an honest-labelled plan rather than refusing them. **Measured, that plan starts week 1 at 18 km regardless of the stated base** (the week-1 floor is 35% of peak), so for a 5 km runner it is a **3.6× acute jump in week one** that §2's ramp cap does not govern — the load hazard MAINT-LABEL-01 never audited (it fixed the *label*, not the load). §111 refuses that tail with "not yet", which is a coaching answer, not the database-field-name refusal UX-BEGINNER-01 removed and not "you'll fail". For a 12–15 km runner the same 18 km week 1 is a 1.2–1.5× step, safe, and the honest note still fires — so MAINT-LABEL-01's actual subject (the beginner who *does* generate) and UX-BEGINNER-01's input acceptance (`validateInputFields` still accepts a 0 base, §55) are both untouched. Short distances (5K/10K/HM) are outside §111 entirely, so a never-run beginner still generates there.

**Out of scope, flagged not fixed.** The route's `longest_recent_run_km < 5` gate for half-plus is the same ungoverned-number smell but a distinct coaching question (long-run readiness, not weekly ramp) — a separate sitting, untouched here.

### Amendment 2 — the denominator is the volume the engine STARTS FROM (Coaching Board + SLT, 2026-09-19, S111-DENOMINATOR-01)

**Principle.** §111's ratio is `delivered peak ÷ effectiveStartKm` — the volume
the engine actually builds from, after §29's fresh-return scaling and §10's
`<6mo` cap — **not** the raw `current_weekly_km` the runner typed. Owner:
`lib/plan/startVolume.ts`, shared with the producer so gate and engine cannot
drift.

**Why.** The gate scored a build no runner performs. Declared 50 km/week starts
at 30 and scored 1.2× against a real 1.8×; a fresh returner declaring 20 starts
at 14, scored 3.0× against a real 4.2×. **Wrong in both directions, and most
wrong where §10's cap bites hardest.**

**⚠️ THE COST, MEASURED AND ACCEPTED: +456 beginner-marathon refusals**
(2,321 → 2,777 of 6,480, **+19.6% for the cohort ranked first**). Held for most
of 2026-09-19 for exactly that reason. Both boards then ruled on evidence about
what those runners were being given instead:

| the newly-refused plans, as they shipped | |
|---|---|
| median TRUE build ratio (peak / real start) | **5.57×** against a cap of 4.0 |
| median week-1 leap above their real start | **+114%** |
| median peak long run | 62% of race |
| **genuine plan defects** | **ZERO** |
| typical profile | 12 km/week, **longest run ever 0 km**, marathon in 29 weeks |

**The zero matters as much as the 5.57.** These plans passed every check the
engine owns and still doubled a never-run beginner's weekly volume in week one.
That is a check measuring the wrong thing.

- **Willy:** *"a +114% week-one jump in a runner with no long-run history is the
  clearest bone-stress setup in this whole engine."*
- **Sims:** this cohort pays for an over-ambitious week one in **stress
  fractures**, and the under-fuelled first-time marathoner skews female.
- **Hutchinson:** *"declining to apply a correction because the truth is
  expensive is not a coaching position."*
- **McMillan** voted to apply it and dissented on emphasis: a runner with a
  London place refused at the door is someone we have failed — **recorded, and
  the reason the return trigger below is a condition rather than a nicety.**
- **SLT unanimous to ship.** Traynor: waiting for the charity's numbers buys
  nothing, because they say HOW MANY are affected, not WHETHER the plan is safe.

**⚠️ RUNWAY DOES NOT RESCUE THEM, measured.** ≤16 weeks is **worse** (+157%
week-1 leap, peak long run 50% of race). The hazard is the week-1 floor (35% of
peak), which does not scale down with the runner, so more time cannot fix it.
§2's ramp cap governs week-on-week and **not week 1** — the gap §111's own text
already names.

**⚠️ THE CAP MUST NOT BE RAISED TO ABSORB THIS — do not retry it.** Raising
`MAX_BASE_BUILD_RATIO` to hold refusals flat looks clean (cap 5.0 → 1,004
refusals against today's 1,001) and is wrong. `effectiveStartKm` differs from
raw **only** for fresh-return and `<6mo` runners, so a cap raise is a pure
loosening for everyone else: **a flat total hid a changed composition.** At cap
5.0 a 10 km/week beginner marathoner is admitted at 4.70, the exact runner this
section says must be refused. Caught by `racePeakExclusion.test.ts`.

**⚠️ THE DOOR IS UNMOVED for a runner whose start equals their declaration** —
10 km/week still refused, 12 km/week still generates. The correction bites only
where §29 or §10 change the start.

### Amendment 2a — the refusal names WHEN to come back (Wood's condition, SLT)

**Principle.** A §111 refusal states the base to reach **and the number of weeks
of easy running it implies**.

**Why.** Wood: *"a number plus 'come back' is a goal, and goals do not change
behaviour"* — she had called the same shape a pure motivation intervention
earlier the same day. A date is a context cue the runner can act on. Sutherland:
the refusal should read as the beginning of the relationship, not a verdict —
same information, different object.

**Derived, not guessed.** §2 caps weekly growth at
`MAX_WEEKLY_VOLUME_INCREASE_PCT`, so
`weeks = ceil(log(minBase / current) / log(1 + rate))` — the same arithmetic the
runner's own plan would have used. Measured: 5 km/week → 10 weeks, 8 → 5,
10 → 2.

**Config.** No new numeric. The ratio and cap are unchanged
(`MAX_BASE_BUILD_RATIO = 4.0`); only the value feeding the denominator changed,
and the return trigger reuses §2's existing ramp constant.

**Enforcement.** `INV-PLAN-BASE-BUILD-RATIO` reads `assessBaseBuild` and so
inherits the correction with no change — producer and checker share one owner
by construction. Gated by `lib/plan/baseVolumeDenominator.test.ts` (6
assertions, including that the door is unmoved and the cap is still 4.0).

### §111 — RECORDED LIMITATION, not yet remedied (Coaching Board 2026-09-19, S111-SUBFLOOR-VOLUME-01)

**The board ruled INSUFFICIENT EVIDENCE on admitting the sub-12 km/week cohort, and ruled CORRECT on the finding below. §111 stands unchanged. This is a limitation written down so the next reader does not rediscover it.**

**1. The threshold sits where the acute step is WORST.** §111's stated hazard is *"the jump from where the runner **is** to what the plan **demands**"*. Measured on the delivered week 1 (London-2027 profile: 29 weeks, finish goal, 4 days, age 38, `<6mo`, longest = 0.4 × cwk), with the cap temporarily lifted to see what the refused cohort would receive:

| `current_weekly_km` | 4 | 6 | **8** | **10** | **11** | **12** | 14 | 16 | 20 |
|---|---|---|---|---|---|---|---|---|---|
| delivered week 1 | 9 | 9 | 9 | 13 | 13 | **18** | 18 | 18 | 24 |
| acute step | +125% | +50% | **+13%** | **+30%** | **+18%** | **+50%** | +29% | +13% | +20% |
| §111 | refuse | refuse | **refuse** | **refuse** | **refuse** | **admit** | admit | admit | admit |

The step is **sawtooth, not monotonic**, because week 1 is `max(startKm, peakKm × BUILD_VOL_INIT_FLOOR_VS_PEAK)` and the floor is flat across a band while the base rises through it. §111 therefore **refuses +13%, +18% and +30% and admits +50%** — its admitted edge case is the largest acute jump in the band.

⚠️ **This is the second of the four defects §111 was convened to remove, reproduced one layer up.** The ruling that created §111 records the old gate as *"non-monotonic across its own boundary — it refused 15 km/week and permitted 20 km/week, near-identical plans"*. The metric changed; the property did not. Willy, who owns this ceiling: *"a gate that admits +50% and refuses +18% is not enforcing my concern, it is enforcing a proxy for my concern that inverts at the boundary."*

**2. The ceiling is runway-blind.** At `current_weekly_km` 10 with **20, 29 and 52** weeks of preparation the ratio is 4.70 and the refusal is byte-identical. A runner with a full year is refused exactly as hard as one with twenty weeks. A ratio with no time denominator is not a measure of load — §2's own text locates the risk in *"the relationship between acute and chronic load"*, and this measures neither over time.

**3. §2 does not govern the step, and cannot.** §2's implementation compares week *n* to week *n−1* **inside the plan**; week 1 has no predecessor, so the current→week-1 jump is unguarded by construction. `validatePlan` returns five violations on the admitted 12 km/week plan and **none of them is about the +50%**. No invariant can close this: the step compares a plan to an input outside it.

**4. Why nothing shipped, recorded so it is not retried blind.** Two candidates were built and measured at the sitting:

| Candidate | Result |
|---|---|
| Floor yields to §2's ramp — `min(peak × 35%, startKm × 1.10)` | Opens the door 12 → 8 km/wk and makes the peak scale (cwk 10 → 35, 16 → 46, 30 → 65), **but +884 NEW error violations on the property sweep**: `INV-PLAN-LR-MAX-WEEKLY-PCT` +516, `INV-PLAN-QUALITY-VARIETY-FULL-PLAN` +207, `INV-PLAN-INTENSITY-DISTRIBUTION` +161. **Rejected.** |
| Same, bounded below by `days_available × MIN_KM_PER_TRAINING_DAY` | **Measured no-op.** At 4 days that floor is 20 km, above the 16.45 km init floor, so it dominates and nothing moves. |

The first candidate's 884 violations are **§52 failing to apply its own remedies** (*"reduce the long run, raise weekly volume, or downgrade to maintenance"*) at week sizes the engine has never had to produce: a 6.9 km tempo is 62% of an 11 km week, and removing easy running from the denominator raises §1's quality *share* without adding a single quality session (Seiler). ⚠️ **Willy additionally blocks any form that scales the PEAK off `current_weekly_km`** — §106 made "never a scaled target" his condition of approval, and it binds in both directions because self-report is unverified in both.

**5. The blocking chain, and the remedy §111 already named.** `S52-LOPSIDED-BOUND-01` (P1, failed twice, standing instruction: *do not add a third per-week bound*) → `S111-SUBFLOOR-VOLUME-01` → `S111-DENOMINATOR-01`. Nothing that lowers the opening week can ship until §52's remedy path works below ~15 km/week.

**Escalated to the SLT, because the question stopped being correctness.** Four of five seats would admit this runner; Willy will not admit them through *this* mechanism; and §111's own paragraph above already names the answer — a base-building plan — and says it is not built (`FOUNDATION_MAX_WEEKS` is 3 against the ~20 weeks needed). Whether to build it before October is commercial, not coaching.

⚠️ **This board reached the OPPOSITE conclusion to §113 Amendment 1 on the same structural question, nine hours apart, on 2026-09-18.** §113 Am.1 vetoed a refusal because *"a rule that manufactures the hazard it then refuses over is not coaching-correct"*; §111 was ratified citing the manufactured 18 km week 1 **as its justification for refusing**. Neither ruling is wrong in isolation — a session floor sizes one session, a weekly floor decides whether the week can hold a structure at all, which is why the precedent does not transfer. **What was missed is that they were the same question.**

---

These principles are the constitution. Every numeric the generator uses points back to one of them. If a numeric exists with no principle, it is a defect — either the numeric should be removed or the principle should be added.

If you are reviewing a plan that feels wrong, this is the document to read first. Find the principle that is failing. The fix lives in the config, never inline.

### §111 Amendment 3 — the reckless ceiling is a RATIO, and §117 does not breach it (Coaching Board 2026-09-20)

**§117 admits a runner §111's ratified text appears to refuse, and this records why that is not a contradiction.**

§111's *"Why 4.0"* fixes the reckless ceiling as: *"**≤ 10 km/week beginner marathon (≥ 4.7×) must be refused.**"*
The parenthesis is the principle. **10 km/week was reckless because it implied 4.7× at a 47–52 km peak**, not because
of the raw number.

Under §117 that same runner is built to a **32 km peak**, so their ratio is **3.2×** — below the 4.0 cap, and inside a
band this board **explicitly ratified as admissible**: the same paragraph rules that M1 at **3.13×** must generate.
**3.2× sits between a case the board said must pass and the cap it set.** §111 is satisfied on its own metric.

⚠️ **WHAT MOVED IS THE PEAK, AND THE DOOR IS DOWNSTREAM OF IT.** `MAX_BASE_BUILD_RATIO` is untouched at 4.0;
`assessBaseBuild` is untouched; §2's ramp and §3's cadence are untouched. A reader who remembers "the door is 12
km/week" is remembering a *consequence* of the 52 km peak, not a rule.

⚠️ **AND THE CONFLICT SCAN DID NOT CATCH THIS — the test suite did.** `baseVolumeDenominator.test.ts` asserts
*"THE DOOR IS UNMOVED"* at 10 and 12 km/week, and it went red. The scan read §111's principle statement and its
config, both of which are ratio-expressed, and missed that the *rationale paragraph* pins two raw volumes. **A
principle's worked examples are load-bearing too, and a scan that reads only the rule misses them.**

**The test now asserts the RATIO reasoning** rather than the two raw volumes, so it cannot go stale the next time a
peak moves — and it gains a case pinning that a §117 runner's delivered ratio stays under the cap.

## 112. Consecutive self-reported cost softens the long run — and a skip is part of the evidence

*Added 2026-09-18 — Coaching Board (FIRSTRUN-MISSED-01 part 2). Willy and Sims carried; McMillan's dissent recorded below and not taken.*

**Principle.** When a runner reports, on `FATIGUE_ACCUMULATION_THRESHOLD` (3) **consecutive** sessions, that the training is costing more than it should, the next long run is softened to `FATIGUE_SOFTENING_LONG_RUN_PCT` (80%). **A session skipped because the runner was too tired to start counts toward that evidence**, provided the window also contains at least one session they ran and tagged.

🔴 **THIS SECTION EXISTS BECAUSE THE MECHANISM HAD NO PRINCIPLE AT ALL.** `lib/coaching/constants.ts:89` cited *"CoachingPrinciples §R20-T4"* for a year. **There is no §R20-T4.** The constitution's only `R20` reference is `FEATURE_GATES.PAID_ONLY_ONGOING`, an unrelated tier gate. Worse, two ratified sections **depend** on the mechanism while never defining it: §70's risk gate silences the reframe on *"fatigue accumulation (3 consecutive Heavy/Wrecked)"*, and the recalibration trigger requires *"no concurrent fatigue accumulation"*. **The constitution leaned on a rule nobody wrote.** This is the §92 claimed-enforcement class inverted: there a principle named an invariant that did not exist; here code named a principle that did not exist.

> ⚠️ **NOT a file-path bypass, and the distinction matters.** `lib/coaching/constants.ts` is the **sanctioned** home for coaching scoring and load thresholds (CLAUDE.md, config table). Unlike `peakKmByLevel` (§106) and the base-volume gate (§111), the numerics were in the right place. **The file was right and the principle was missing** — a different failure with a different fix, and calling it the same thing would have sent the remedy to the wrong layer.

**Why a skip counts.** A runner who logs `Heavy` **completed** the session. A runner who reports *"too tired"* **could not begin it**. Willy: *"Not starting is not a weaker signal than starting and feeling heavy — it is a stronger one."* Sims: repeated inability to start, in a day-job runner, is a low-energy-availability presentation until proven otherwise, **and the previous design guaranteed we would never see it** — they did not run, so they logged no fatigue tag, so the trigger that exists to catch exactly this could not observe them.

**Measured, and the n is stated because it is small.** Across 83 tagged completions in production, **one** runner shows `Injury / illness → Too tired → Too tired → Too tired`: four consecutive *"I could not run"* reports, three of them explicitly fatigue, and the plan never softened. **`FATIGUE_ACCUMULATION` has never fired in production** — there exists no run of three consecutive `Heavy/Wrecked/Cooked` anywhere in the data. ⚠️ **n = 1 user, 3 events. That is a signal, not a rate, and it is not offered as one.** The chair declined to move the threshold on this evidence; it stays at 3.

**A skip may not reach the threshold alone** (`FATIGUE_WINDOW_REQUIRES_LOGGED_SESSION`). McMillan's objection, taken at its cheapest price: *"'Too tired' on a Tuesday is often a bad night's sleep, a late meeting, a toddler. Softening a long run for three of those is coaching the dataset, not the athlete."* So the window must contain **at least one session the runner actually ran and tagged**. A runner who only ever skips is a different problem and not this rule's job.

**Recorded disagreement, preserved.** McMillan holds that a plan which softens when you skip may teach skipping. Willy: *"a 20% long-run cut is not a reward, and a runner on three consecutive skips is already not training."* **What would settle it:** whether skip rate rises in the window after a softening fires. **Not measurable today** — too few events. Revisit once the charity cohort produces volume.

**Asymmetry the chair recorded.** A skip is a **stronger** signal of *cost* and a **weaker** one of *magnitude*: no RPE, no HR, no duration. It is counted as evidence of cost only; it does not scale the softening.

**Config.** `FATIGUE_ACCUMULATION_THRESHOLD` (3), `FATIGUE_SOFTENING_LONG_RUN_PCT` (0.80), `FATIGUE_COUNTING_SKIP_REASONS` (`['Too tired']`) and `FATIGUE_WINDOW_REQUIRES_LOGGED_SESSION` (true) in `lib/coaching/constants.ts`.

**Enforcement: a named test, not an invariant, and the reason is structural.** `validatePlan()` validates a generated **plan object**. This mechanism runs at **coaching time** against `session_completions` and never appears in a plan, so no `Plan => Violation[]` can reach it by construction — the same `static` class the invariant-liveness baseline already records. Enforced by `lib/coaching/fatigueAccumulation.test.ts`.

---


## 113. Long-run readiness — a plan must have something to build FROM

*Added 2026-09-18 — Coaching Board (LONGEST-RUN-GATE-01). Willy carried; McMillan concurring on delivery.*

**Principle.** For a race at or beyond `LONG_RUN_READINESS_MIN_RACE_KM` (21 km), the engine refuses to build when the runner's longest recent run is below `MIN_SESSION_DISTANCE_KM.long`. Week one's long run would be a leap rather than a step, and the refusal **names what would change it**.

**Why the floor is exactly that number, and not a second one.** §45's `WEEK_1_2_LONG_RUN_CAP_MULTIPLIER` (1.10) already bounds the opening long run against the runner's real longest run, and it works — at a 5 km longest run, week one lands **+7%**. But `MIN_SESSION_DISTANCE_KM.long` is applied **after** that cap (`ruleEngine.ts:3033`, then `:3101`), so below the floor **the floor wins and the cap is silently discarded**:

| Longest recent run | Week-1 long run | Jump |
|---|---|---|
| 5 km *(permitted)* | 5.3 km | **+7%** |
| 4 km *(refused)* | 4.8 km | +21% |
| 3 km *(refused)* | 4.8 km | +62% |
| 2 km *(refused)* | 4.8 km | **+142%** |

**The engine cannot honour its own safety cap for a runner below its own floor.** The refusal states that limitation honestly instead of shipping a plan that pretends otherwise. Willy: *"+142% into a first marathon block is exactly the acute jump I object to, and unlike §111 the concern and the threshold agree."*

> ⚠️ **THIS IS THE OPPOSITE RULING TO §111 ON SUBSTANCE AND THE SAME ON GOVERNANCE, and the distinction is the point.** §111's base-volume gate was **non-monotonic** — it refused 15 km/week at +135% while permitting 20 km/week at +160% — so its threshold was wrong and had to be re-expressed on the ramp. This gate **is** monotonic and tracks exactly what it protects against, so the threshold is right. What was wrong is everything around it: a hardcoded `5` in an API route, ungoverned, invisible to `configPrincipleSync` and to `coaching-guard.py`, returning a bare string where §44's own text requires alternatives — and a **second copy of a number that already had an owner**. Ruling one of these the way the other was ruled would have destroyed a correct threshold in the name of consistency.

**Single owner, deliberately.** The floor is not restated here: `minLongestRunKm()` reads `MIN_SESSION_DISTANCE_KM.long`. The route's own `5` is deleted. Change the engine's floor and the gate follows it, which was not true before.

**The refusal names the lever** (§44). *"Build up to one 5 km run, then come back. Nothing else needs to change."* McMillan: to a runner with months in hand that is real coaching, not a door — and it is the one refusal in this engine whose remedy is entirely within the runner's control.

**A missing value is not a short one.** No stated longest run means §113 has nothing to say, and it passes. Turning an unanswered question into a rejection is a different defect.

**Config.** `GENERATION_CONFIG.LONG_RUN_READINESS_MIN_RACE_KM` (21); the floor itself is `MIN_SESSION_DISTANCE_KM.long`. Thrown as `LongRunReadinessError` from `generateRulePlan`, mirroring §44/§52/§111 so one screen renders every refusal. Enforced by `lib/plan/longRunReadiness.test.ts`.

**Enforcement is a named test, not an invariant, and the reason is structural** — the same as §112. This refuses *before* a plan exists, so there is no `Plan` for `validatePlan()` to inspect. ⚠️ **But unlike the old route gate, the sweep now sees it**, because it throws from the engine rather than from the boundary.

---

### §113 Amendment 1 — the floor may not manufacture the leap it then refuses over (Coaching Board 2026-09-18, CB-SUBFLOOR-ADMIT-01)

**Ruling: the refusal as written is INCORRECT. This was a veto.**

**The mechanism, measured.** `MIN_SESSION_DISTANCE_KM.long` (5 km) is applied
AFTER §45's week-1 cap, three lines later in `ruleEngine`, and wins:

| runner's longest run | §45 cap alone | after the flat floor |
|---|---|---|
| 3 km | 3.3 km (**+10%, safe**) | 5.0 km (**+67%, unsafe**) |

§113 then refused that runner **because week one was a leap** — a leap the engine
itself introduced. §113's original header documented this exact sequence
(*"the floor wins and the cap is silently discarded"*) without drawing the
conclusion. **A rule that manufactures the hazard it then refuses over is not
coaching-correct** (Hutchinson, chair).

**Willy, for the record, because he was the seat expected to defend the floor:**
*"I cannot. At longest 3 km, §45 gives 3.3 km. That is a 10% step and it is safe.
The floor makes it 5.0, a 67% step, which is not — and then §113 refuses the
runner to protect them from a jump the engine introduced. The tissue-tolerance
argument runs the other way from how it has been implemented."*

**The principle.** A session-size floor expresses what is worth PRESCRIBING. A
progression cap expresses what is SAFE. **Where they conflict, the cap wins.**
The floor is resolved for the runner in front of the engine
(`lib/plan/sessionFloors.ts → sessionFloorsFor`), never as a flat constant, and
is bounded below by `MIN_SESSION_DISTANCE_ABSOLUTE_KM` — under which a long run
is not a session at all.

⚠️ **This does NOT open the door to everyone.** §113 still refuses; it now
refuses on longest run **and runway together**, not on distance alone. A 3 km
runner with eight weeks is still correctly told no. What was vetoed is refusing a
runner with seven months because of a constant.

⚠️ **The floor was MASKING two other defects, both found only once it moved.**
Pinning every early week at 5 km hid (a) a §45 week-on-week progression breach
(W2 2.9 km → W3 4.97 km, +71%) in `applyLongRunProgressionCap`, which re-floored
the long run straight back up after bounding it, and (b) a §9 long-vs-easy ratio
inversion once both floors collapsed to the same value. **A floor that hides
violations is not a safety feature.**

**Config.** `GENERATION_CONFIG.MIN_SESSION_DISTANCE_ABSOLUTE_KM = 2`.
**Enforced by** `INV-PLAN-WEEK-1-2-LONG-CAP`, **amended** rather than duplicated.

⚠️ This section first named a NEW invariant, `INV-PLAN-WEEK-1-LONG-NO-FLOOR-OVERRIDE`,
and `principleCoverage.test.ts` rejected it within the minute: *"§113 claims
enforcement by … which is not registered at all."* That is precisely the §92
failure class — a principle naming an enforcer nobody wrote, which read as
enforced for eight days. The board's requirement is satisfied by **removing the
floor allowance from the existing check** (`effectiveCap` was
`Math.max(rawCap, minDist.long)` and is now `rawCap`), because a second invariant
asserting the same rule is duplication, not coverage.



---

## 114. The long run fits the week it is in — the "get you round" plan

*Added 2026-09-19. **Founder decision**, taken after the Coaching Board reached a genuine trilemma and recorded it. McMillan's position carried.*

**Principle.** For HM and marathon, a single run may not exceed `LONG_RUN_MAX_PCT_OF_DELIVERED_WEEK` of the week it sits in. Where §24/§80's specificity floor would push it past that, **the long run yields and the plan says so.** The alternative on the table was refusing these runners outright.

**The decision, in the founder's words:** *"Give them a get you round plan."*

**The contradiction it resolves.** Three principles sized the same object and had never been reconciled — §9 (28–40% of the week, *">35% is a binge"*), §52 (60%, a *backstop*), and §80/§24/§45 (sized from the **race**, silent about the other days). The specificity floors are applied with `Math.max`, so the race won unconditionally and **every kilometre it demanded came out of the other days.**

**What that produced, printed rather than summarised.** A knee-history runner at 8 km/week, 19 weeks out:

| wk | 1–7 | 8 | 9 | 10 | 13 | 14 | **15** | 16 |
|---|---|---|---|---|---|---|---|---|
| week km | 7–22 | 14 | 18 | 23 | 24 | 23 | **28** | 29 |
| long run | 2.9–8.2 | 10.0 | 15.0 | 20.0 | 21.5 | 21.0 | **26.0** | 26.0 |
| share | 34–42% | 71% | 83% | 87% | 90% | 91% | **93%** | 90% |

**A 26 km long run inside a 28 km week.** Across 6,480 beginner-marathon inputs: **45.2%** of plans carried a week with one session ≥75% of it, **40.5%** had loading weeks with ≤2 runs, and **83% regressed the midweek runs when the build phase began.**

**Why the long run yields and not the week.** §114 was first built as a floor on the **volume curve** — raise the week to hold the run — in four formulations. All four were inert or broke §2/§3 (recorded in §9's *Recorded structural finding*). **The week cannot be raised:** an 8 km/week runner cannot reach the 43 km a 26 km long run needs, in nineteen weeks, under §2's 10% rule once §3's deloads take 30% four times over. That is arithmetic about running.

**McMillan, whose position the founder took.** *"For a first-timer, 'get you round' IS the goal."* A runner who does a 17 km longest run and run-walks the last stretch finishes. A runner handed a 26 km run off an 8 km/week base is injured in week 15 and does not start.

**Measured result on priority one:**

| | before | after |
|---|---|---|
| a week with one session ≥75% of it | 45.2% | **0%** |
| loading weeks with ≤2 runs | 40.5% | **0%** |
| any week over §52's 60% | 37.9% | **0.2%** |
| delivers fewer days than asked | 49.4% | **33.7%** |
| **refused outright** | 2,358 | **2,321** — *fewer* |

**The shortfall is DECLARED, never silent, and that is half the decision.** §80's shortfall note fires on the delivered long run, so an affected runner is told: *"Your longest run tops out at 2h 20… we'd normally want it nearer 3h 27, but your weekly volume is what limits it… Expect the last stretch of race day to be new territory; go out slower than feels right and take the walk breaks early rather than late."* **A shorter long run nobody mentions is not a "get you round" plan, it is a worse plan.**

**Why 60 and not 45.** Seiler's first number was 45%, from §9's sizing intent. Measurement falsified it: at a 47 km peak week a 26 km long run is 55%, which is what every novice marathon plan in print does, and 45% took plans short of 55% of race distance from 0% to 88.7%. **60 is §52's own number** — this introduces no new threshold, it makes §52's existing one bind at construction instead of warning after the fact.

**Mechanics, and each one is a measured correction.**
- **Applied at CONSTRUCTION, not as a post-pass.** Ten post-hoc bounds were built first and every one destroyed specificity: §45's cap is multiplicative on the previous week's long run, so reducing any week ratchets the trajectory down permanently.
- **It only ever REDUCES.** Written with the §9 ratio floor as a `Math.max` it could *raise* the long run past §45's week-1 cap — `INV-PLAN-WEEK-1-2-LONG-CAP` threw across the charity cohort.
- **Race week exempt** — its long run is the race (§77).
- **Floored by §9's long-vs-easy ratio**, so the bound can never make the long run shorter than the easy runs it must exceed. Where that floor sits above the 60% share, the share gives way and §52's warn declares the residual (§34).

**Supersedes, for this cohort, PLAN-FITNESS-01's unconditional §80 floor.** `deloadLongRunCut.test.ts` now asserts a disjunction: the floor is met **or** the shortfall note is present.

**Config.** `GENERATION_CONFIG.LONG_RUN_MAX_PCT_OF_DELIVERED_WEEK = 60`.
**Enforced by** `INV-PLAN-LR-MAX-WEEKLY-PCT` — deliberately the same invariant as §52, because §114's number is §52's number and its observable consequence is exactly what that invariant already asserts. A second invariant on the same threshold would be duplication, not coverage.

---

## 116. The base-build on-ramp — §111's named remedy, made possible

*(Coaching Board 2026-09-20, P-16. CORRECT WITH AMENDMENT as a two-stage shape, eight amendments. Built behind a flag at the founder's authorisation; the chair's measurement gate stands.)*

**Principle.** A runner whom §111 refuses may be offered a **standalone base-building plan** that
climbs at §2's rate under §3's deload cadence, after which §111 is asked again against the volume
they have actually **performed and re-declared**.

**The deadlock this resolves.** §111 refuses the sub-12 km/week marathoner and **names a
base-building plan as the remedy**. §57 made that remedy structurally impossible:
`foundationBlock.ts` sized every week as `min(baseline × 1.1^i, baseline × 1.10)`, so **from the
second week onward every week is `baseline × 1.10` — flat, at any length.** Two principles in
deadlock, each unseen by the other because **each sitting was convened on its own question**. §57
is not wrong; it was ratified as a gap-filler and a gap-filler has no reason to climb.

**Measured at the sitting.** Ramping at §2's own rate with §3's cadence: cwk 8 → 18 km/wk in
**11 weeks**, leaving **18 weeks** of marathon plan (above §44's warn threshold of 16),
**§111 ratio 2.61** against a cap of 4.0, and the **acute step into week 1 goes from +50% to 0%**.

### The eight binding amendments

| # | Amendment | Seat |
|---|---|---|
| 1 | **§2's rate, not §57's.** A pre-plan block that builds is governed by the same ramp rule as any other building block | Willy |
| 2 | **The per-run step is governed under §2 Am. 2.** At 8 km/wk over 4 days that is 2 km a run; at 18 it is 4.5. **The per-run doubling is the load event**, not the weekly total | Willy |
| 3 | **Lower bound where the ramp leaves ≥16 weeks** — §44's ratified threshold, reused rather than re-chosen | McMillan |
| 4 | **It carries the fuelling note.** *"A silent ramp is not a fuelled ramp"* | Sims |
| 5 | **Labelled pre-plan**, with the missed-weeks degradation path specified before build | McMillan |
| 6 | **All easy, no quality** | Seiler |
| 7 | **§111 is evaluated at the END of the ramp, on re-declared volume — never credited in advance** | Chair |
| 8 | **The ramp is a plan the runner can follow standalone.** If they never return it must still be a good eleven weeks | Chair |

⚠️ **Amendment 7 is what distinguishes this from `S111-FOUNDATION-CREDIT-01`, which was VETOED.**
Credit means §111 divides by a volume the runner has not run. Here §111 is simply **not asked
yet**: the runner performs the block, reports real volume, and is gated on **observed** data. It is
the same self-report we already accept at the wizard, taken later, after eleven weeks of evidence.

⚠️ **RUN-WALK IS EXPLICITLY NOT SCOPED.** Willy: a runner at 8 km/week over four days is already
running 2 km at a time, and run-walk is for someone who cannot — who is below
`BASE_BUILD_ONRAMP_MIN_START_KM` anyway. **Do not build it to copy a competitor.**

⚠️ **Why the §52 blocking chain does not apply.** Candidate A's 884 violations came from shrinking
**main-plan** weeks. A pre-plan block does not — verified at four sites in `invariants.ts`: §2's
ramp skips foundation (`:3393`), week 1 is the first non-foundation week (`:2511–2513`), delivered
peak excludes it (`:2660`), and §1's denominator excludes it (CB-FOUNDATION-DENOM-01). And
`FOUNDATION_LONG_RUN_MAX_PCT = 35` is **already tighter than §52's 60% bound**.

⚠️ **Risk, knowingly taken.** `invariants.ts:820–825` records that the foundation block has broken
server-side invariants **three times**. A fourth block class walks into that history, which is why
**one week-builder serves both curves** rather than a second construction path existing.

**Config.** `BASE_BUILD_ONRAMP_MAX_WEEKS`, `BASE_BUILD_ONRAMP_DELOAD_FREQUENCY`,
`BASE_BUILD_ONRAMP_MIN_START_KM`, `BASE_BUILD_ONRAMP_MIN_REMAINING_WEEKS` — in `GENERATION_CONFIG`.
⚠️ **Not in `foundationBlock.ts` and not in a route.** §106 (`peakKmByLevel` in `length.ts`) and
`MARATHON-VOLUME-GATE-01` (the volume gate hardcoded in the API route) are both on record as the
same defect: a coaching numeric outside the singularity is invisible to `configPrincipleSync`, to
`configConsumer`, and to the coaching-guard hook.

**Owner.** `lib/plan/baseBuildOnRamp.ts` decides and sizes; `generateFoundationBlock` builds the
weeks under a `curve` policy. **Enforced by** `INV-PLAN-ONRAMP-CURVE-CLIMBS`.

⚠️ **The 0% acute step is NOT mechanically checkable** — it compares a plan to an input outside it.
Recorded as a known enforcement gap rather than left to be discovered.

---

## 117. The finish-goal run-walk marathon — a lower target, not a looser rule

*(Coaching Board 2026-09-20, ZERO-REJECTION-01. CORRECT WITH AMENDMENT, four binding amendments. Founder directive: "we cannot be rejecting nearly 50% of beginner runners" and "we just need to help them get to the end.")*

**Principle.** A first-time marathoner on a finish goal whose base sits below §111's standard door is prepared to **complete** the distance with **prescribed** walk intervals, at a reduced peak, rather than refused.

**The mechanism, and it loosens nothing.** §111's door is `ceil(peak / MAX_BASE_BUILD_RATIO)`. A beginner marathon peak of 52 km/wk puts it at 13. But 52 is the tonnage to **run** 42.2 km, not to **finish** it:

| peak km/wk | §111 door | weeks from 4 km/wk (budget 13) |
|---|---|---|
| **52 (standard)** | 13 | **14 — refused** |
| **32 (§117)** | **8** | **9 — admitted** |

⚠️ **§2's ramp rate, §3's cadence and §111's ratio are all untouched.** The door moves as a *consequence* of a lower target. Willy, recorded: *"walk breaks reduce cumulative impact per session; they do not accelerate bone remodelling, which runs on its own clock. §2's 10% stays. Do not come back and ask me to raise it because the runner is walking some of it."*

⚠️ **NOT NEW DOCTRINE, AND THAT IS WHY IT IS NOT §9's FORBIDDEN ELEVENTH INSTRUMENT.** §80 (2026-08-06) already anchors finish-goal peak long runs on race **duration** and states that *"run-walk counts"* and *"every finish-goal peak long run carries explicit permission to walk."* What never existed was the engine **prescribing** it. A principle-to-behaviour gap, which §9's Recorded structural finding does not cover. Chair's ruling, on the conflict scan rather than on the submission's own argument.

### The four binding amendments

| # | Amendment | Seat |
|---|---|---|
| 1 | **Peak 30–34 km/wk.** Completing 42.2 km run-walking needs repeated exposure to 3+ hours on feet, not weekly tonnage. **Below 26 the last 10 km is genuinely unrehearsed.** | Willy |
| 2 | **§2's ramp rate is UNCHANGED.** Run-walk lowers the target, not the rate. | Willy |
| 3 | **The walk break is PRESCRIBED, not permitted** — a named interval from week one. | Willy **and** McMillan, independently |
| 4 | **§24e's fuelling cue is scoped to this shape from the start.** | Sims |

⚠️ **Amendment 3 is the entire safety argument.** §117 lowers the peak, which lowers the door, and that trade is honest **only if the runner is actually doing the thing the lower peak prepares them for.** McMillan's objection was the strongest in the sitting: *"'run 40 minutes, walk if you need to' is a dare. '6 minutes running, 1 minute walking, ten times' is a session."* An unstamped session is the door opened with nothing behind it. Enforced by `INV-PLAN-RUNWALK-PRESCRIBED`.

⚠️ **DERIVED, NEVER ASKED.** There is no wizard input and there must not be. A runner who has told their friends they are running a marathon will not tick a box saying they will walk some of it, and asking would filter out the exact cohort this serves.

⚠️ **§117 PLANS DO NOT TAKE `PEAK_FLOOR_VS_START_RATIO`.** That floor raises the peak to at least the runner's current volume, which is right for a normal plan and self-defeating here — this runner's problem *is* their low base, and floating the peak back up would re-close the door the lower peak just opened.

### §117 Amendment 1 — REVISED 2026-09-20 (S117-PEAK-VS-TIME-01): the range is the number, the three hours is withdrawn as a floor

**Amendment 1 gave two numbers and they do not reconcile.** Measured on generated plans:

| peak | §111 door | longest run | time on feet | ≥3h? | refusal (198-profile grid) |
|---|---|---|---|---|---|
| 32 | 8 | 16.5 km | 2h12 | ✗ | 29.3% |
| **34** | **9** | **18.5 km** | **2h28** | ✗ | **29.3%** ← ruled |
| 36 | 9 | 20.0 km | 2h40 | ✗ | 36.4% |
| 42 | 11 | 23.0 km | 3h04 | ✓ | 36.4% |
| 52 | 13 | 26.0 km | 3h28 | ✓ | 45.5% (standard) |

**Willy, ruling on his own amendment:** *"the range was the number I priced."* The three hours
described the **shape** of the demand — duration, not tonnage — and was never a floor he had
costed. Buying it costs **seven points of admission for 36 minutes**, which he would not trade for
a runner who is otherwise refused outright.

⚠️ **32 is STRICTLY DOMINATED.** 32 and 34 refuse identically, so 34 buys 16 minutes and 2 km for
nothing.

⚠️ **§9's own record settles the adequacy, and the conflict scan found it rather than a seat
recalling it.** McMillan, the position the founder took: *"a runner who does a 17 km longest run
and run-walks the last stretch finishes."* **34 delivers 18.5.**

⚠️ **Sims contradicted the framing that 42 was the cautious option.** A higher peak is more weekly
running volume for a 20–29 female first-timer over 29 weeks, so on bone health and energy
availability **42 is the riskier choice, not the safer one.**

⚠️ **Two of the submission's own findings were WITHDRAWN before the board ruled.** Both measured
§117 against §80's 70%-of-race-duration bar. That bar is unreachable for this runner at any peak
and §80 says so itself — `LONG_RUN_CAP_MINUTES.MARATHON` (210) against a ~338-minute projected
race is **62%**, and the standard plan scores exactly 62% because it is sitting on the cap.
**A floor that yields to a cap is not a bar you can fail.**

🔴 **ZERO REJECTION IS NOT REACHABLE BY COACHING.** At peak 34 the door is 9 km/week; a runner at
2 km/week is 15× below the delivered peak and needs 25 weeks of base building before a block can
start. **45.5% → 29.3% is what coaching can do. The remainder is a product decision.**

### §117 Amendment 2 — the `LONG-RUN-SHORT` exemption is BOUNDED (Coaching Board 2026-09-20, chair-mandated at S116-FLOOR-VS-TARGET-01)

**Principle.** A finish-goal run-walk plan whose peak long run falls below
`FINISH_GOAL_RUNWALK_MIN_PEAK_LR_KM` (**17 km**) is **not exempt** from the long-run adequacy
check. It is broken.

🔴 **WHY — and it is the closest call of the day.** `LONG-RUN-SHORT` was made **watched rather
than scored** on §117 plans, correctly: 55% of race distance is the bar for a plan built to RUN the
race, and the board had ruled 18.5 km adequate at peak 34. **But nothing distinguished 18.5 from
13.5.**

Had the on-ramp floor dropped 6 → 3 as proposed at the same sitting, a 3 km/week runner would have
spent 13 weeks ramping, entered a 15-week block, and arrived at a marathon off a **13.5 km**
longest run — **and the rubric would have scored that plan FIT.** The marathon would have cleared
the founder's 90% bar for the first time **by admitting people to plans that do not work.**

**The exemption was correct. Its bound was missing. An exemption without a bound is not a
relaxation, it is a hole.**

⚠️ **The floor is not invented here.** It is §9's Recorded structural finding — McMillan, the
position the founder took: *"a runner who does a 17 km longest run and run-walks the last stretch
finishes."* §117 at peak 34 delivers 18.5, so the bound binds on nothing today and is a **guard
against a future peak or runway change**, which is exactly when it would otherwise have been
discovered by a runner.

**Config.** `FINISH_GOAL_RUNWALK_MIN_PEAK_LR_KM = 17`. **Enforced by** `INV-PLAN-RUNWALK-ADEQUATE`.

### Recorded, because it is a real trade and not a free win

**Sims:** a lower-peak run-walk build is a **better** bone-stress profile than the 13 km/wk plan we would otherwise have given them — *and* **total exposure rises, because we are admitting runners we previously refused. Some will now be injured who would have been told no and done nothing.** That is a judgement the founder has made and is entitled to make; the board declines to pretend it is free.

**It does not reach zero rejection.** At a 32 km peak the door is 8 km/wk. **A runner at 2–5 km/wk is still outside it.** For them the honest answer is a plan that is not a marathon plan, and that is a product decision, not a coaching one.

**Config.** `FINISH_GOAL_RUNWALK_PEAK_KM` (32), `FINISH_GOAL_RUNWALK_RUN_MINS` (6), `FINISH_GOAL_RUNWALK_WALK_MINS` (1).
**Owner.** `lib/plan/runWalkPlan.ts`. **Enforced by** `INV-PLAN-RUNWALK-PRESCRIBED`.

---

## 118. The get-running plan — what we offer the runner no race plan can serve

*(Coaching Board 2026-09-20, CORRECT WITH AMENDMENT, three amendments. Founder directive after the board twice ruled zero rejection unreachable by coaching.)*

**Principle.** A runner whose base no race plan can safely build from is given a **get-running plan**: §116's ramp, standalone, with **no race and no promise of one**. It builds for the weeks available at §2's rate under §3's cadence and stops.

**Why it can exist when `S116-FLOOR-VS-TARGET-01` was vetoed.** That proposal failed because a 3 km/week runner cannot be built to a **marathon** in 29 weeks — every ramp target left a 13.5–15 km peak long run against the 17 km ruled adequate. **A plan with no start line cannot miss it.** Remove the marathon promise and the runway constraint disappears with it.

**No new prescription machinery.** §116's ramp was already ruled correct **as a standalone plan** (§116 amendment 8: *"if they never return it must still be a good eleven weeks"*). Same generator, same curve owner, same validator.

**⚠️ The target is DERIVED FROM THE RUNWAY, not fixed.** Imposing one would invent a deadline the runner does not have and then refuse them a second time for missing it — the exact failure this exists to end.

### Generated, at 15 weeks

| start | ends at | longest run W1 → end | total build |
|---|---|---|---|
| 2 km/wk | 7.5 | 2.0 → 2.5 km | 3.75× |
| 3 km/wk | 11.3 | 1.5 → 2.8 km | 3.77× |
| 5 km/wk | 18.9 | 1.6 → 4.7 km | 3.78× |
| 7 km/wk | 26.5 | 2.3 → 6.6 km | 3.79× |

**Most of them finish above §117's door of 9 km/wk with 13 weeks to spare.** For most of this cohort the get-running plan is not a consolation — **it is the route back in.** ⚠️ **A 2 km/week runner does not clear it, and must not be told a marathon follows.** Two outcomes under one plan name is how a promise gets made by implication (McMillan).

### The three amendments

| # | Amendment | Seat |
|---|---|---|
| 1 | **`GET_RUNNING_MAX_WEEKS` 16 → 15**, so the total build stays inside §111's 4.0. Reuse the ceiling; do not create a second one | Willy |
| 2 | **The total build is enforced mechanically** (`INV-PLAN-GET-RUNNING-BUILD-RATIO`) | Willy |
| 3 | **§24e's fuelling cue scopes here** — a rising-load block does not stop being one because there is no race | Sims |

🔴 **Amendment 1 exists because a bound chosen for LEGIBILITY was doing physiological work nobody had checked.** `GET_RUNNING_MAX_WEEKS` was 16 on the reasoning *"a plan nobody can see the end of is not a plan"*. Sixteen weeks of §2's lawful 10% under §3's four deloads compounds to **4.17×** — above §111's ceiling. **Every week legal, the sum not.**

⚠️ **And the ratio is a property of the CURVE, not the runner.** 2→8.3, 3→12.5, 5→20.8 and 7→29.2 are all ~4.17×. It was first reported as *"a 7 km/week runner ends at 4.2×"*, which would have sent someone hunting for a per-runner cap. **It was the sixteenth week.**

⚠️ **§2 CHECKS WEEK-ON-WEEK AND CANNOT SEE THE ENDPOINT.** That blind spot is general, and this is the first place it has been closed.

⚠️ **NO HARNESS WATCHES THIS PLAN KIND.** `measure:fitness` and `measure:envelope` are both shaped around a race. Inventing a way to score a raceless plan would be the decorative-check failure, so it is **filed as a known gap, not papered over** (chair).

**Config.** `GET_RUNNING_MIN_WEEKS = 8`, `GET_RUNNING_MAX_WEEKS = 15`.
**Owner.** `lib/plan/getRunningPlan.ts`. **Enforced by** `INV-PLAN-GET-RUNNING-BUILD-RATIO`.
