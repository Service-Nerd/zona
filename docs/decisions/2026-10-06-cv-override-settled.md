# RACE-ANCHOR-CV-OVERRIDE-01 — the settling artefact, and the fifth exemption built then blocked

**2026-10-06.** Two sittings had deadlocked §22 against §85 and the item recorded the measurement
that would settle it. That measurement is now taken, and it does settle the ownership question.

---

## 1. The settling artefact — the answer is NOTHING, and it is structural

The item's condition, verbatim: *"for each of the 92 sessions, what else was actually ELIGIBLE in
that slot for that runner — not what the catalogue owns, but what the selector would have returned.
If the answer is 'nothing', the deadlock belongs to the CATALOGUE."*

Measured from the catalogue:

| | |
|---|---|
| `race_specific` rows eligible in the **BUILD** phase | **exactly one** |
| that row | `beginner_goal_pace_blocks` — `fitness_level_max: 'beginner'`, `[HM, MARATHON]` only |
| available to an **intermediate-or-above** runner in build | **ZERO** |
| available at **5K or 10K** in build, any fitness | **ZERO** |

Every other `race_specific` row (`hm_pace_intervals`, `mp_blocks`, `mp_long_run`,
`hm_pace_long_run`, `tenk_pace_intervals`, `tenk_race_simulation`, `goal_pace_sharpener`) is
**peak-only or taper-only.**

🥇 **So neither §22 nor §85 is wrong — there is no row for them to disagree about.** §22 requires the
slot to be goal-paced, the selector has nothing goal-paced to put there, so it returns a threshold
row (`cv_intervals`), §22 renames it, and §85 correctly refuses to re-price it. **The deadlock
belongs to the catalogue.**

⚠️ **§22's own text predicted this and stopped one phase short:** *"10K had no race-specific session
while HM had two. That was not a decision anyone made; **it is where the catalogue stopped**."*
CD-18/SC-05 fixed **ownership**; the row it produced is peak/taper, and **nobody asked about
build-eligibility.** §22 also warns, in its own voice: *"a principle can close a review without
closing a gap."*

## 2. The board's ruling (sitting 3, 2026-10-06)

- **(b) widen `beginner_goal_pace_blocks` — INCORRECT, vetoed explicitly.** A beginner's first
  exposure to goal pace is not a dose for an experienced runner.
- **(a) a new build-eligible goal-paced row — INSUFFICIENT EVIDENCE, deferred with its own gate.**
  Probably right coaching; it is a prescription change across four distances and must not ride along
  with a display fix. Needs its own sitting with `measure:fitness` before/after, a refusal count,
  and **selection MEASURED not inferred.**
- **(c) a FIFTH exemption — CORRECT**, on the identical reasoning as the four that exist (VO2max,
  effort-governed §40b, mixed-anchor §85, §5-displaced): exempt a CV-anchored row from §22's
  override **and** from the per-week check, structurally (D-17), with
  `INV-PLAN-RACE-SPECIFIC-EXPOSURE-RATIO` as the **binding condition**.

⚠️ **The previous attempt was HALF an exemption and that is why it failed.** It removed the override
and left the per-week check, which then correctly went red on 100 tests. All four ratified exemptions
do both halves.

## 3. The exemption was BUILT, and the result is good except in one identified cohort

`hasCvAnchoredWork` (engine) + `rowIsCvAnchored` (checker, deliberately duplicated for the reason
`rowHasMixedWorkAnchors` states: *a checker that imports the producer's predicate cannot catch the
producer being wrong*).

| invariant | before | with the exemption |
|---|---|---|
| **`INV-PLAN-HEADER-PACE-MATCHES-WORK`** | **3,232** | **0** |
| every other invariant, all 12 | — | **byte-identical** |

🔴 **AND THEN THE BINDING CONDITION FAILED, ON A CASE NO GRID REACHES.**
`earlyQualityOnset.test.ts`'s `HM @ 4 days, time_target` — a §89 early-onset runner (`5yr+`,
`user_declared_level: 'experienced'`, `recent_quality_training: 'regular'`, 4 days) — threw
`INV-PLAN-RACE-SPECIFIC-EXPOSURE-RATIO`: **goal-pace ratio 40% (2/5) against a ≥50% spec.** Error
severity, so it breaks the build.

**By the board's own words the exemption is void where that ratio fails.** Reverted.

## 4. 🔴 Two of my own claims were wrong, and measurement caught both

**(i) "164 firings are `hm_pace_intervals`, possibly a second defect."** WRONG. That row's work
anchor is `HM`, so the CV exemption cannot touch it — yet the invariant went to **0**. The
attribution came from a probe matching sessions by **label substring**, which is unreliable. All
3,232 firings were CV-anchored rows. **There is no second defect.**

**(ii) "the ratio was being satisfied FRAUDULENTLY by the renamed CV sessions."** This was my
reframing after the test failed, and it reads well: the numerator counts sessions whose
`pace_target` is within 5% of goal pace, and the override WRITES `pace_target` to goal pace, so a CV
session counts itself in. **Measured on 18,960 time-target plans: plans whose ratio depends on CV
sessions being counted — ZERO. 0.0%.** The concealment is real only in the narrow §89 early-onset
low-day cell. **A mechanism that is obviously true at one case is not therefore true at population
scale, and I nearly published it as though it were.**

⚠️ **Third cohort I constructed by guessing instead of reading a fixture that already existed**
(after `days_available: ['tue','sat']` and the masters/HM denominator). My constructed time-target
grid returned **0 of 129** because it set `fitness_level` and `training_age: '2-5yr'` where the §89
gate needs `user_declared_level: 'experienced'` and `5yr+`. **The failing case was written down in
the test file.**

## 5. Where this leaves it — the resolution space is now fully enumerated

Three routes existed. Two are closed by measurement and one remains:

| route | state |
|---|---|
| exempt the CV row from the override only | 🔴 closed — half an exemption, red on 100 tests |
| make the CV row ineligible for the slot | 🔴 closed — `neverBuildsPct` rose, 3 plans refused |
| the fifth exemption (both halves) | 🟠 **built, safe on 39,632 plans, blocked by the §89 early-onset low-day cell** |
| **a build-eligible goal-paced catalogue row** | ⬅️ **the only route not closed** |

🥇 **And the two converge.** The §89 cell fails because that plan genuinely has little goal-pace
work — 2 of 5 — and the catalogue has nothing goal-paced it could have been given in build. **With
the row, the cell has a goal-paced option and the ratio holds.** The catalogue row is therefore not
an alternative to the exemption; it is its **prerequisite.**

**Next:** the deferred sitting on (a), with `measure:fitness` before/after, a refusal count, and
selection measured. The exemption lands with it, not before it.
