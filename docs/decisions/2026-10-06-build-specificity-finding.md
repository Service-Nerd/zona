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
