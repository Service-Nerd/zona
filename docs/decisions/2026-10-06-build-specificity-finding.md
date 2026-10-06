# The catalogue-row sitting, and what it actually found: §5's build share delivers 0.0%

**2026-10-06, Coaching Board sitting 4 on `RACE-ANCHOR-CV-OVERRIDE-01`.** The board had deferred
option (a) — a build-eligible goal-paced `race_specific` row — with a named gate: *"its own sitting
with `measure:fitness` before/after, a refusal count, and selection MEASURED not inferred."*

**The gate was discharged, the row was refused, and the measurement found something larger.**

---

## 1. The gate, discharged

A throwaway prototype row (`goal_pace_blocks_proto`: `race_specific`, phases `['build','peak']`,
distances `['10K','HM','MARATHON']`, `fitness_level_min: 'intermediate'`, goal-anchored 10-minute
blocks with 2-minute easy recovery, modelled on `beginner_goal_pace_blocks`) was added **solely to
measure selection** and reverted before the sitting ruled. Over 39,632 plans:

| | |
|---|---|
| selected | **7,644** |
| **in BUILD** | **ZERO** |
| in PEAK | 7,644 |
| refusals | **1,840 — identical to baseline** |
| `measure:fitness` | healthy masters neverBuilds **18.6% → 18.5%**, every other cohort byte-identical |

## 2. Why it is inert, and it is structural rather than a tuning miss

`buildRotationCategories` reads `PLAN_SIGNATURES[dist].quality_categories_focus` and then **filters
it through `MIDWEEK_QUALITY_LADDER`, which is `['aerobic', 'threshold', 'vo2max']`.**
`race_specific` is not in that ladder, so:

- HM / MARATHON focus `['threshold','race_specific']` → filtered to **`['threshold']`**
- 5K / 10K focus `['vo2max','threshold']` → never mentions `race_specific` at all

**No build quality slot at any distance ever has `preferredCategory: 'race_specific'`.** The
selector's fallback cannot rescue it either — it fires only when no row of the preferred category is
eligible, and threshold rows are eligible throughout build. Measured, build quality slots are filled
by `progressive_tempo` 25,256 · `tempo_continuous` 19,292 · `tempo_cruise` 17,312 · `cv_intervals`
11,796 · `threshold_pyramid` 10,080 · `threshold_ladder` 8,200 · `tempo_over_under` 5,656 ·
`intervals_short` 5,616.

## 3. 🔴 THE REAL FINDING — §5 DECLARES BUILD 30% SPECIFIC AND BUILD DELIVERS 0.0%

`GENERATION_CONFIG.SPECIFICITY_BY_PHASE` has declared this since R23. Measured on 39,632 plans:

| phase | §5 declares | delivered |
|---|---|---|
| base | 0% | — (no quality) ✅ |
| **build** | **30%** | **0.0% — 0 of 118,764 quality sessions** |
| peak | 60% | **17.3%** |
| taper | 70% | **33.8%** |

🔴 **And §5's build entry is DECORATIVE CONFIG.** The whole constant has **one** consumer,
`invariants.ts:2709`, which reads `.peak.specific_pct` only. **`.build`, `.taper` and every
`general_pct` are read by nothing.**

⚠️ **`configConsumer.test.ts` passes it because the NAME appears, and its own header cites
`SPECIFICITY_BY_PHASE` as a prior example of this exact class.** It scans top-level keys, not nested
shapes — a limitation it documents about itself. This is the §1 `INTENSITY_DISTRIBUTION` failure one
key over.

**So the question the submission brought — "should build contain race-pace work?" — was answered by
ratified doctrine before it was asked.** It is not a new coaching decision; it is a delivery failure
with a number on it.

## 4. The ruling

- **(a) as framed — INCORRECT, a veto, on the submission's own measurement.** Zero build selections
  and 7,644 peak displacements: decorative where it matters, a side effect where it is not needed.
  🏃 Hutchinson: *"a change to peak dressed as a fix for build"*; the 0.1pp masters improvement is
  **noise offered as a benefit**, which the submission said itself.
- **The finding is CORRECT and is a DEFECT, not a new principle.** Build specificity is already
  ratified; the ladder cannot express it; `.build.specific_pct` has no consumer.
- **INSUFFICIENT EVIDENCE on the MECHANISM only.** Gate named: `MIDWEEK_QUALITY_LADDER` admitting
  `race_specific`, costed with `measure:fitness` before/after, a refusal count, `cohort:shape`,
  `verify:parity`, the §89 early-onset cell, and an assertion that the change **substitutes** a
  quality session rather than adding one (⚕️ Sims). **5K/10K costed SEPARATELY from HM/marathon**,
  because at 5K goal pace is near vVO2max and SC-05 already excludes 5K from §22's ownership arm
  (🩹 Willy).

📊 **Seiler, on the framing:** *"a ladder that cannot express a category is not a ladder with a gap,
it is a different ladder than the one documented. Those are incompatible objects and one of them is
wrong."* He would change it on doctrine alone; 🎯 McMillan and 🩹 Willy require the numbers first.
**Recorded as a sequencing disagreement, resolved by the chair as: doctrine establishes the
obligation, measurement sets the shape.**

🩹 **Load note:** at HM and marathon, goal pace sits **below** threshold, so substituting a goal-pace
block for a threshold session **reduces** intensity. §1 is untouched because it counts sessions and
this substitutes rather than adds.

## 5. Artifacts authorised now (the measurement step)

1. **Principle** — §5 Amendment: the build share is an obligation, not a declaration, and
   `.build.specific_pct` gains a consumer.
2. **Numeric** — **none new.** `SPECIFICITY_BY_PHASE.build.specific_pct` (30) already exists.
3. **Invariant** — `INV-PLAN-BUILD-SPECIFICITY`, the build twin of the peak arm. ⚠️ **`warn` first**:
   at 0.0% delivered it would fire on essentially every time-target plan, and promoting ahead of the
   fix is the failure that reverted `INV-PLAN-MAIN-SET-ORDERING`'s first promotion.

🔻 **`RACE-ANCHOR-CV-OVERRIDE-01` is now blocked on this, not the reverse.** The CV header lie, the
voided fifth exemption and the build gap are **one defect**: build cannot select race-specific work,
so §22 renames threshold work instead. Fix the ladder and the exemption becomes unnecessary.

---

# Sitting 5 — the mechanism, costed and REFUSED. The number is the defect.

**2026-10-06.** Sitting 4 ruled the defect CORRECT and the mechanism INSUFFICIENT EVIDENCE with a
named gate. **The gate was discharged, and it changed which lever is correct and then refused that
one too.**

## The ladder was the wrong lever, and the code said so in words

`MIDWEEK_QUALITY_LADDER` excludes `race_specific` **deliberately**, with the reason on the line
above it: *"they are long-run-slot work, not a midweek single-day session."* Measured anyway: a
prototype `race_specific` midweek row was **selected 7,644 times and ZERO of them in build.** The
ladder was never the lever and it was not changed.

## The actual lever, found by measurement

`useRaceSpecificLR = phase === 'peak' && !isDeload && goalPace` in `ruleEngine.ts`. That single
expression is why the **designed** channel delivered 0% in build too. Widened to
`(phase === 'peak' || phase === 'build')` and measured:

| | before | after |
|---|---|---|
| build specific share | 0.0% | **23.7%** |
| HM build | 0% | **37.6%** |
| marathon build | 0% | **33.3%** |
| 5K / 10K build | 0% | **0%** (untouched by construction) |

⚠️ **And the rows' own `phase_eligibility` is NOT consulted on that path** — they are found by ID, so
widening `hm_pace_long_run` / `mp_long_run` to `['build','peak']` changed **nothing, byte-identical.**
That field is decorative there.

**Every standing harness stayed green:** `verify` exit 0 / 4,331 tests · `measure:fitness`
**byte-identical** on every cohort and marathon persona · refusals **1,840 unchanged** ·
`cohort:shape` exit 0 · `review:coaching` six arms identical at **95.9%** · `verify:parity` 536 of
5,832, all HM/marathon time-target.

## 🔴 It was refused anyway, because the harnesses are green for STRUCTURAL reasons

| | |
|---|---|
| build non-deload weeks gaining a race-pace long run | **45.2%** |
| race-pace km **added per plan** across build | median **24.5 km**, p90 42.6, max 60.6 |
| share of build long-run km now at race pace | **16.6%** (was 0%) |

**§1 counts sessions and the long run's `type` stays `easy`. `measure:fitness` counts distance and
no distance changed.** Session count was unchanged at **262,988** and intensity still rose *inside*
the session. ⚕️ Sims's substitution condition was met and **was the wrong test**, which she owned.

🎯 **McMillan:** *"a median of 24.5 km of added race-pace running across the build block, in 45% of
its weeks, is not sharpening — it is racing your training."*
🩹 **Willy:** *"I ruled on a substitution that lowers intensity; this adds intensity to the one
session that is already the week's largest tissue exposure."*

## The conflict scan is what settles it: BOTH channels are closed by explicit design

1. **Midweek slot** — ladder excludes the category, with its reason written down.
2. **Long-run slot** — **§25 reserves the race-pace long run for PEAK**, in its principle (*"Peak
   phase ... MUST contain at least one"*) and its Config (*"peak-phase long-run path"*), on a
   phase-specific rationale: late-race simulation on tired legs, named by Daniels and Pfitzinger as
   **the single most race-specific session** for these distances.

🏃 **Hutchinson:** *"when a declared number has no designed channel, the likeliest error is the
number, not the delivery."*

## ⚖️ Ruling

- **The mechanism is INCORRECT — vetoed and reverted.** `ruleEngine.ts` and `invariants.ts` carry
  **no diff**; the golden snapshots were restored.
- **`.build.specific_pct` is an UNDEFENDED NUMBER, not an unmet obligation.** §5 Amendment rewritten
  to say so; the constant is flagged **declarative** at source.
- **`INV-PLAN-BUILD-SPECIFICITY` is WITHDRAWN.** It was written at `warn` and removed: a check firing
  on essentially every plan to enforce a value the board has called into doubt trains people to
  ignore the output. **Not mechanically checkable because the value is unsettled** — a stated known
  risk.

**Two seats corrected their own prior reasoning, and both corrections came from the measurement
rather than from argument:** 📊 Seiler had called the ladder *"a different ladder than the one
documented"* when its exclusion is deliberate and reasoned; ⚕️ Sims's session-count test could not
see intensity moving inside a session.

🔻 **What a future sitting needs: a DOSE decision** — how much race-pace work, in which build weeks,
at what fraction of the long run — argued on physiology, not on satisfying a config entry.
🔻 **Ultras are the same shape and also 0.0%**, for the same documented reasons, untouched.
✅ **Kept from this work:** `npm run measure:build-specificity`, which measures both channels and
whose first version counted only `type === 'quality'` and was blind to the long-run channel the
ladder's own comment designates.
