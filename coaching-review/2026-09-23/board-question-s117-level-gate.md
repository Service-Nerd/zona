# Coaching Board — §117 eligibility reads a declaration, not the volume

**Convened:** 2026-09-23, by the coaching review round.
**Trigger:** soft — no doctrine file is being edited. **A QUESTION IS BEING ASKED,
NOT A CHANGE PROPOSED.** Nothing ships from this sitting.

---

## The question, in one sentence

> **Should §117's eligibility read the VOLUME-DERIVED structural level
> (`assessed.structural`) rather than a supplied `input.fitness_level`, given
> that `FITNESS_VOLUME_THRESHOLDS.beginner_max_weekly_km = 20` already classifies
> every runner in the affected band as a beginner?**

---

## 🔍 Conflict scan — amendments, not headings

| § | reading | verdict |
|---|---|---|
| **§111 Am.3** (09-20) | *"What moved is the PEAK, and the door is downstream of it. `MAX_BASE_BUILD_RATIO` is untouched at 4.0."* §117 admits a 10 km/week runner at **3.2×**, inside a band the board explicitly ratified. | ✅ **No conflict.** This question does not touch the ratio, the peak, §2's ramp or §3's cadence. It asks only **who** reaches §117's already-ratified 34 km peak. |
| **§111 RECORDED LIMITATION** (09-19) | Board ruled **INSUFFICIENT EVIDENCE** on admitting the sub-12 km/week cohort. ⚠️ Willy **blocks any form that scales the PEAK off `current_weekly_km`**. | ⚠️ **Adjacent, and must be named.** §117's peak is a **fixed 34 km**, not scaled off anything. But this question *would* admit more low-volume runners, which is the cohort that ruling left open. **The board must decide whether that ruling binds here.** |
| **§117 Am.2** (09-20) | The `LONG-RUN-SHORT` exemption is **bounded** at `FINISH_GOAL_RUNWALK_MIN_PEAK_LR_KM = 17`. *"An exemption without a bound is not a relaxation, it is a hole."* | ✅ **This is the safety net, and it is already load-bearing.** Measured today: of 45 runners a gate-level predicate judged eligible, **11 were refused again by this bound**. Anyone widened in who cannot reach an adequate long run is still stopped. |
| **§79** (09-02) | Two axes, two inputs, do not merge. `input.fitness_level` is *"the API-level STRUCTURAL declaration [that] stands in for the volume-derived assessment"*. | ⚠️ **The crux.** §117 reading the declaration is **consistent with §79's contract**. The question is whether that substitution should hold for **eligibility for a lower target**, as distinct from plan shape. |
| **§44 / §44 Am.** | Refusal is *"not yet"*, never *"no"*; the ordinal difficulty band carries the honesty. | ✅ No conflict. |

**Scan result: no contradiction, one genuine tension (§111's open ruling), one
crux (§79's substitution).**

---

## The measurement

Full marathon envelope, unsampled: **10,752 inputs**, engine byte-identical to
production `5e5b38b`.

### The deficit is one cohort

| weekly km | refused | LONG-RUN-SHORT | **clean** |
|---|---|---|---|
| 4 | **100%** | — | **0%** |
| 8 | 77.2% | 9.6% | **13.2%** |
| **15** | 38.6% | **45.0%** | **12.0%** |
| 25 | 0% | 1.7% | **92.9%** |
| 35 / 50 / 70 | 0% | 0% | **100%** |

**At 25 km/week and above the engine is essentially perfect. Below it, it
collapses.** The three bottom bands are **22% of the marathon market by weight**.

### Where the 12.87% refusal mass sits

| | share of all marathon runners |
|---|---|
| intermediate/experienced **below 20 km/week** — blocked by §117's level gate | **7.71pp** |
| beginners — blocked by the time-goal gate or the runway gate | **5.16pp** |
| …of which, runway could reach §117's peak at all | **7.83pp of the 12.87** |

⚠️ **The ceiling is 7.83pp, not 12.87pp.** From 4 km/week you cannot reach 34 km
inside the budget at §2's 10% cap. **5.04pp is arithmetic, not policy**, and no
gate change reaches it. Realistic best case: marathon **78.7% → ~86.5%**.

### The specific asymmetry

`fitnessFromVolume` classifies **every** runner under 20 km/week as a beginner.
But `assessedStructural = input.fitness_level ?? assessed.structural`, and §117
reads the supplied value. So:

> **A runner at 15 km/week labelled `intermediate` is refused a plan that the
> identical runner labelled `beginner` receives.** Same weekly volume, same
> longest run, same days available, same age, same injury history.

---

## 🩹 What the board is really being asked (Willy's question, put plainly)

**Does a longer running history change present tissue tolerance at 15 km/week?**

Willy's own condition on §117 was: *"walk breaks reduce cumulative impact per
session; they do not accelerate bone remodelling, which runs on its own clock."*
If the clock is the constraint, **history does not move it either** — and §117's
gate 3 is reading a label about the **past** to answer a question about **present
capacity**.

The counter-argument, which this submission does not attempt to settle: a
declared `intermediate` at 15 km/week may be a runner *detraining downward* from
a higher base, whose tissue carries residual adaptation a true novice lacks. The
envelope's own note for the `experienced` band at this volume says exactly that:
*"Rebuilding after time off."* **§29 territory.** If that is the real population,
§117's gate is right and the label is doing honest work.

---

## 🔴 Why this submission does NOT ask for a build

**The 7.71pp rests on an assumption, not an observation.**

`levelBandsFor` assigns **45% beginner / 45% intermediate / 10% experienced** at
≤25 km/week. That is a weight with a written rationale. It is **not measured**,
and the file says so.

What production can actually tell us:

| evidence | value |
|---|---|
| marathon plans ever generated | **2** |
| HM plans ever generated | **4** |
| `plan_refused_by_design` events ever recorded | **0** |

**Zero refusals have ever been observed.** At two marathon plans that means *no
traffic*, not *no problem* — but it equally means **the 12.87% has never existed
outside a model.** The single largest cell (15 km × intermediate, 2.31pp) may not
occur in production at any meaningful rate.

⚠️ **This is the shape that has cost this engine most.**
`RACE-ANCHOR-CV-OVERRIDE-01` was built, measured and reverted the same hour
because its safety assumption was wrong. Six week-1 caps were built and rejected.
Two engine caps were vetoed for taking the marathon out of target. **Every one
was aimed at a modelled number.**

---

## The decision rule, written BEFORE the data arrives

Committing to it now is the point. Deciding after seeing the data is how a
measurement becomes a justification.

> `plan_refused_by_design` already records `fitness_level`, `current_weekly_km`,
> `goal` and `weeks_to_race` on every refusal.
>
> - **If refused marathoners under 20 km/week arrive carrying `fitness_level`
>   above `beginner` at a rate materially above zero** → gate 3 is real, and this
>   question deserves a full sitting with a proposal attached.
> - **If they arrive as beginners** → §117 is already catching them, the 7.71pp
>   is an artefact of `levelBandsFor`'s weights, and **the correct fix is to
>   re-weight the envelope, not to change the engine.**

---

## 📦 Artifacts

**None, and that is the ruling being sought.** No principle is authored, no
numeric moves, no invariant is added. This sitting exists to put a question on
the record with its measurement, so the next reader does not rediscover it and
so the answer is not invented after the data lands.

## ↗️ SLT escalation

**Possibly, and not yet.** §111's own recorded limitation already escalated the
adjacent question — *"four of five seats would admit this runner; Willy will not
admit them through this mechanism"* — and named the remedy §117 was not yet built
to provide. If the board rules the level gate correct as written, the remaining
lever is a base-building plan of ~20 weeks against `FOUNDATION_MAX_WEEKS = 3`,
which is a build-cost question, not a coaching one.

---

## What this submission does not prove

- **Every rate is modelled.** 33,792 generated plans; 6 real ones.
- **No adherence or injury data.** `WEEK1-LEAP` is FROZEN for that reason and is
  not reopened here.
- **Coach objections have never been measured on a foundation-composed plan**
  (`HARNESS-COMPOSE-GAP-01`). The 15 km/week cell — long runway, low base — is
  **the one most likely to move** when that gap closes. This question may look
  different afterwards.
