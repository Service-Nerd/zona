# HM + marathon — where the engine fails our target market, and what I would NOT do about it yet

**Coach's analysis, 2026-09-23.** Full envelope, unsampled: 10,752 marathon
inputs, 4,608 HM. Engine byte-identical to production `5e5b38b`.

---

## 1. The one structural fact

**The engine is excellent for runners who already run, and collapses for runners
who don't. The cutover is 20–25 km/week — and our target market lives below it.**

### Marathon

| weekly km | refused | LONG-RUN-SHORT | WEEK1-LEAP | **CLEAN** | who the envelope says this is |
|---|---|---|---|---|---|
| 4 | **100%** | — | — | **0%** | below the on-ramp floor; the cohort ZERO-REJECTION-01 exists for |
| 8 | 77.2% | 9.6% | 0% | **13.2%** | barely running; §116 can reach them |
| **15** | 38.6% | **45.0%** | 26.3% | **12.0%** | 🔴 **couch-to-charity-place — the flagship persona M1/E1** |
| 25 | 0% | 1.7% | 2.9% | **92.9%** | the modal charity entrant |
| 35 | 0% | 0% | 0% | **100%** | established recreational |
| 50 | 0% | 0% | 0% | **100%** | experienced amateur |
| 70 | 0% | 0% | 0% | **100%** | serious club amateur |

The three bottom bands are **22% of the marathon market by weight** and run at
**0% / 13% / 12% clean**. Everything from 25 km/week up is 93–100%.

### Half marathon — the same shape, smaller

0% refused, 95.4% fit. **100% of both objections sit at 10 km/week.** At 20 km/week
and above: zero, on every measure.

| | 10 km/wk | 20+ km/wk |
|---|---|---|
| DEGENERATE-WEEK | 14.9% | **0%** |
| WEEK1-LEAP | 23.4% | **0%** |

And they split cleanly by level — **DEGENERATE-WEEK is beginner-only (6.6%, and
0% for intermediate/experienced); WEEK1-LEAP is the exact mirror (0% beginner,
5.3% intermediate)**. Days available changes DEGENERATE-WEEK not at all (1.8%
flat at 3/4/5/6 days), so it is not a scheduling problem — at 10 km/week there
is not enough volume to fill the declared days with sessions that clear §52b's
floor.

---

## 2. The mechanism, exactly

Refusal is **not** an absolute volume floor. It is a ratio:

```
minBaseKm = ceil(peakKm / MAX_BASE_BUILD_RATIO)      // cap = 4.0
refused  ⟺  peakKm / currentKm > 4.0                  // §111
```

`peakKm` is chosen by the engine. **So the door is set by the engine's own
ambition for the runner, not by the runner.** That is the whole lever, and §117
already pulls it: a finish-goal run-walk plan peaks at 34 km instead of ~55, so
the door drops from ~14 to ~9.

§117 applies only when **all five** hold:

1. marathon · 2. `goal === 'finish'` · 3. `fitness_level === 'beginner'`
4. `startKm < standardDoor` (i.e. §111 would refuse them)
5. the runway can build to 34 km at §2's 10%/week

---

## 3. Where the refusal mass actually sits

Weighted share of **all** marathon runners. Total refused **12.87%**.

| cohort | refused | runway could reach §117's peak |
|---|---|---|
| 15 km × intermediate × finish | **2.31%** | 2.06% |
| 4 km × beginner × finish | 1.74% | 0.49% |
| 8 km × beginner × finish | 1.51% | 0.84% |
| 15 km × intermediate × time | 1.42% | 1.26% |
| 4 km × beginner × time | 1.06% | 0.30% |
| 8 km × beginner × time | 0.85% | 0.53% |
| 15 km × experienced × finish | 0.80% | 0.69% |
| …9 smaller cells | 3.18% | 1.66% |
| **TOTAL** | **12.87%** | **7.83%** |

**Two populations, and they need different answers:**

- **7.71pp — intermediate/experienced below 20 km/week.** Blocked by gate 3.
- **5.16pp — beginners.** Blocked by gate 2 (time goal) or gate 5 (runway).

⚠️ **Only 7.83pp of the 12.87% have a runway that could build to §117's peak at
all.** The other **5.04pp is arithmetic, not policy** — from 4 km/week at a 10%
weekly cap you cannot reach 34 km inside the budget. No gate change reaches them.
**The realistic ceiling here is marathon ~78.7% → ~86.5%, not 100%.**

---

## 4. Two fixes that look obvious and are traps

### 🔴 Trap A — raise `MAX_BASE_BUILD_RATIO`

**Already built and rejected.** `baseVolume.ts` records it: at cap 5.0 the
refusal total barely moves (1,004 vs 1,001) **and the composition changes** —
*"a 10 km/week beginner marathoner is admitted at 4.70, the exact runner §111's
ratified text says must be refused."* A flat total hid a changed population.
Caught by `racePeakExclusion.test.ts`. **Do not re-propose.**

### 🔴 Trap B — offer "switch to a finish goal" on refusal

This was **my** first instinct, and it is worth almost nothing. I ran the
counterfactual — same runner, `goal` switched to `finish`, nothing else moved:

| | share of all marathon runners |
|---|---|
| refused asking for a time | 4.8% |
| **would generate as `finish`** | **0.4%** |
| still refused as `finish` | 4.4% |

**0.4pp.** It fails because gate 3 still blocks them: a 15 km/week runner labelled
intermediate is refused as a finisher too. A refusal screen offering a goal
change would, for 92% of the runners who took it, **refuse them a second time** —
which is worse than refusing once.

⚠️ I nearly recommended this off the 15 km band alone, where time goals are 50%
of refusals. **The band was not the population.**

---

## 5. The one real lever — and why I am not asking you to build it today

**§117 gates on `input.fitness_level`. At these volumes that field contradicts
the engine's own rule.**

`FITNESS_VOLUME_THRESHOLDS.beginner_max_weekly_km = 20`. So `fitnessFromVolume`
classifies **every** runner under 20 km/week as a beginner. But:

```ts
const assessedStructural = input.fitness_level ?? assessed.structural
```

A supplied `fitness_level` **overrides** the volume assessment, and §117 reads
that supplied value. So a runner at 15 km/week labelled `intermediate` is refused
a plan that the identical runner labelled `beginner` receives.

**As a coach: those two runners have the same tissue.** Weekly volume, longest
run, days available — identical. One has a longer running history. Willy's own
condition on §117 was that *"walk breaks reduce cumulative impact per session;
they do not accelerate bone remodelling, which runs on its own clock."* History
does not change the clock either. **§117's gate 3 is reading a label about the
past to answer a question about present capacity.**

### 🔴 But the number that would justify the build is unvalidated

The 7.71pp rests on an envelope assumption: that **~55% of sub-20 km/week
marathoners are labelled intermediate or experienced** (`levelBandsFor` assigns
45/45/10 at ≤25 km). That weight is an **estimate with a written rationale, not
an observation.** The file says so.

What production can tell us:

| evidence | value |
|---|---|
| marathon plans ever generated | **2** |
| HM plans ever generated | **4** |
| `plan_refused_by_design` events ever fired | **0** |

**Zero refusals have ever been recorded.** At 2 marathon plans that means
"no traffic", not "no problem" — but it equally means **the 12.9% has never been
observed, only modelled.** The single largest cell (15 km × intermediate,
2.31pp) may not exist in production at any meaningful rate.

⚠️ **This is the shape that has burned this engine before.** `RACE-ANCHOR-CV-OVERRIDE-01`
was built, measured, and reverted the same hour because the safety assumption
behind it was wrong. Six week-1 caps were built and rejected. Two engine caps
were vetoed for taking the marathon out of target. **Every one of those was a
fix aimed at a modelled number.**

---

## 6. What I would actually do, in order

### ① Do not touch the engine this week. Instrument the question instead.

`plan_refused_by_design` already records `fitness_level`, `current_weekly_km`,
`goal` and `weeks_to_race` on every refusal, and it has **never fired**. It is
the exact instrument needed and it costs nothing to wait for.

**The decision rule, written before the data arrives:** if refused marathoners at
under 20 km/week arrive carrying `fitness_level` above `beginner` at a rate
materially above zero, gate 3 is real and worth a board sitting. If they arrive
as beginners, §117 is already catching them and the 7.71pp is an artefact of
`levelBandsFor`'s weights — and the correct fix is to **re-weight the envelope**,
not to change the engine.

⚠️ Committing to the rule now is the point. Deciding after seeing the data is how
a measurement becomes a justification.

### ② The one change I would make now, because it is free and cannot regress a plan

**`BaseVolumeError` does not offer the §117 route it could often grant.** §44's
block alternatives name *"change goal to finish"*; `baseVolumeRefusal()` offers
only *"build your volume"* and *"come back in N weeks"*. For the 0.4pp who
would generate immediately, we currently say come back in eight weeks when the
engine would build them a plan **today**.

0.4pp is small and the change is copy inside an existing refusal, touching no
prescription. ⚠️ **It must be conditional on §117 actually applying** — offering
a goal switch that refuses again is worse than not offering it.

### ③ Ask the Coaching Board one question, without a proposal attached

> Should §117's eligibility read the **volume-derived** structural level
> (`assessed.structural`) rather than a supplied `fitness_level`, given
> `beginner_max_weekly_km = 20` already classifies every one of these runners as
> a beginner?

That is a **doctrine** question about which of two existing signals §117 should
trust. It is not a request to loosen §111, §2 or §3, and it should not be
presented as one.

### ④ HM: nothing yet, and say why

95.4% and **zero refusals**. Both objections are confined to 10 km/week, and
`DEGENERATE-WEEK` there is the same root cause as `DAYS-SHORT` — which the board
already exempted via `FREQ-SILENCE-01` because the plan declares the shortfall in
a frequency note.

⚠️ **The obvious move is to silence `DEGENERATE-WEEK` the same way, and I am not
proposing it.** `DAYS-SHORT-SILENCED` is already a watched exemption carrying
21.5% on HM, and the rubric's own warning is that *a rate that climbs means the
exemption is carrying more than it was measured carrying.* Silencing a second
objection with the same note would move a goalpost, not fix a plan. **If a
beginner at 10 km/week genuinely cannot be given three real sessions, that is a
finding about the floor, not about the objection.**

---

## 7. What this analysis does not prove

- **Every rate here is modelled on an assumed population.** 33,792 generated
  plans, 6 real ones.
- **I did not measure adherence or injury.** `WEEK1-LEAP` is FROZEN for exactly
  that reason and I have not tried to reopen it.
- **Coach objections have never been measured on a foundation-composed plan**
  (`HARNESS-COMPOSE-GAP-01`), and the low-base long-runway runner is precisely
  who gets a foundation block. **The 15 km/week cell is the one most likely to
  move when that gap closes.**
- **I have not costed any of this.** Tier, priority and sequencing are the SLT's.
