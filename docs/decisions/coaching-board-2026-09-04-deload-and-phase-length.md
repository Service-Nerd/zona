# Coaching Board — deload placement (CB-DELOAD-01) and base-phase length (CB-PHASE-01)

**Date:** 2026-09-04
**Chair:** Hutchinson. Seats: Seiler, McMillan, Willy, Sims.
**Origin:** the founder's complaint — *"I wanna get to some harder sessions
earlier on in the plan"* — after four selection levers had already failed
(CAT-DEPTH-01) and the mechanical blocker (DELOAD-OWNER-01) was discharged.

**Outcome in one line:** §87 shipped; the base 35→30 ruling was built, measured
and **reverted**, and the measurement found a live §12 gap that matters more than
the change did.

---

## The finding that reframed the whole thread

**For 5K and 10K, quality already starts on the first day of build.** Week 5 *is*
build week 1. There was never a lag to remove for the founder's own plan.

Measured, first quality week by distance at the current `base_pct: 35`:

| 5K | 10K | HM | MAR | 50K | 100K |
|---|---|---|---|---|---|
| W5 | W5 | W6 | W7 | W8 | W9 |

So the request decomposed into two separate questions, and only the second had
anything in it:

1. *Is the first quality session late?* — No, for the distance he races.
2. *Is the transition into build broken?* — **Yes, badly.**

---

## CB-DELOAD-01 — a recovery week must not open a phase

### The measurement

24 plans (6 distances × 2 day-counts × 2 ages):

| pattern | count | effect |
|---|---|---|
| deload lands **on** the first build week | 6/24 (25%) | 30–41% volume drop, **first quality slips a week** (HM W6→W7, 50K W8→W9, 100K W9→W10) |
| flat transition | 11/24 | build week 1 at 0 to −6% vs the last base week |

**71% of plans entered build with no volume step-up at all.**

### Why it was a defect at all — the disagreement worth keeping

**Hutchinson** and **McMillan** genuinely differed and it was not synthesised
away:

- *Hutchinson:* a deload immediately before a hard block is defensible — arriving
  fresh into build is a real argument. He resisted calling this a straight defect.
- *McMillan:* an outcome reached by accident will eventually land wrong, and the
  runner's experience of "build week that's easier than base, with no quality
  session either" is the product visibly failing to pay attention.

**What settled it:** the cadence was computed from absolute week number and knew
nothing about phase boundaries. Sometimes it put the deload the week *before*
build, sometimes on its first week, sometimes neither — decided entirely by where
week 1 fell relative to the phase split. **A defensible outcome reached at random
is a coincidence, not a decision.** Both seats accepted the fix once placement
became deliberate; neither wanted fewer deloads.

### Amendments

- **Willy — shift, never skip.** *"The 30–41% drops are on the ultras and masters,
  which is where I'd least want to remove recovery. A 50K runner dropping 79 km
  to 47 km is not a defect; that is recovery working."*
- **Sims — never lengthen a loading block** beyond the cadence's promise.
- **Not ratified:** starting quality earlier by removing recovery. That was the
  trade the request implied, and the board declined it explicitly.

### Two things the ruling got wrong, both found by measuring

**1. Rules 1 and 3 were mutually unimplementable.** Moving a deload ±1 week always
steals a week from one loading block and gives it to the other, so Sims's
amendment rejects **both** directions whenever the cadence divides evenly. HM
masters: raw `{3,6,9}`, worst loading run 2; `6→5` gives 3, `6→7` also gives 3.

> **The first implementation moved nothing at all, and read perfectly plausibly
> while doing so.** It was caught only because the measurement was re-run rather
> than the code re-read.

The mechanism that works is **re-anchoring** the cadence from each placed deload:
same case yields `{3,5,8}`.

**2. Willy's amendment was too strict as worded.** "Count preserved exactly" would
also have forbidden *correcting* a cadence that was under-delivering — an 8-week
masters plan produced a single recovery week (`{3}`) because week 6 fell in peak
and week 9 did not exist. `{2,5}` is the 3:1 §3 actually promises. **Restated at
ratification as a direction: recovery may rise, never fall.** Across 504 plan
shapes, 50 changed and every one added recovery; none removed any.

A third correction was needed after that: the greedy forward pass produced
`{3,5,8}` — two deloads with a single loading week between. Safe, but not the 3:1
cadence §3 promises, and the archetype matrix caught it as `deload cadence 2`.
A backward normalisation pass restores `{2,5,8}`.

### Result

| | before | after |
|---|---|---|
| deload on first build week | 6/24 | **0** |
| flat entry into build | 71% | 46% |
| worst first-quality week | W10 | **W9** |
| 30–41% drops | 6 | **0** |

Across 504 plan shapes: 0 boundary deloads, 0 over-long loading blocks, 0
back-to-back deloads, 0 reductions in recovery.

**Artifacts:** §87 · `GENERATION_CONFIG.DELOAD_PLACEMENT` ·
`INV-PLAN-DELOAD-PLACEMENT`. Owner: `lib/plan/deloadCadence.ts`.

---

## CB-PHASE-01 — base 35 → 30: ruled, built, **reverted**

### First sitting: INSUFFICIENT EVIDENCE

Sims blocked it: the measured gains landed unevenly across the masters cadence —
at 28% a 100K masters runner gained two weeks while the 30-year-old gained none.
*"You cannot explain to a 52-year-old why her plan restructured and her training
partner's didn't."* That unevenness was the deload artefact, not phase length,
so measuring one before fixing the other would have measured noise.

### Second sitting, after §87 shipped

The divergence vanished — first-quality week became uniform across ages at every
setting, and the two §22 failures at 25% **disappeared**, because they had been
caused by the deload artefact rather than by base length.

| base_pct | 5K/10K | HM | MAR | 50K | 100K | err |
|---|---|---|---|---|---|---|
| **35 (current)** | W5 | W6 | W7 | W8 | W9 | 0 |
| 30 | W5 | **W5** | **W6** | **W7** | W9 | 0 |
| 28 | W5 | **W5** | **W6** | **W7** | **W8** | 0 |
| 25 | **W4** | W5 | W6 | W6 | W8 | 0 |

**Ruled CORRECT: 35 → 30.** 25% declined by Seiler and Willy on the volume ramp —
*"the invariants passing is not the same as the training being right"*; base is
where tissue tolerance is built and is the one thing a runner cannot accelerate
by feeling ready.

### Then the build measured it, and it was reverted

On the §12 knee-injury archetype:

```
base 35:  45 45 48 38* 48 49 53 46* 50 56 59   worst jump W5 +26%
base 30:  45 45 48 38* 39 51 50 46* 53 56 60   worst jump W6 +31%
```

**The +26% at the CURRENT setting is already far above §12's 17% injury cap.** It
passes only because it is the week after a deload, and §2 exempts a post-deload
bounceback — correctly in principle, since returning to a volume held two weeks
ago is not a spike. **But the exemption is unbounded:** it permits the return
whatever its size, so a 26% rise is exempt on the same grounds as a 5% one.

Shortening base moved the phase boundary, suppressed that bounceback (W5 rose 3%)
and pushed the recovery into W6 — where the same rise is no longer a bounceback,
is no longer exempt, and reads as **+31% for a runner with knee injury history**.

**The shorter base did not create the spike. It un-masked one the exemption was
already hiding** — which means whether a 30% jump is legal currently depends on
where the phase boundary happens to fall. Nobody chose that.

Willy's support was explicitly conditional on the ramp remaining governed. It is
not governed, so the condition fails, and shipping a 31% week-on-week rise for an
injury-history runner to gain a week of build is the trade the board had already
declined in its own words.

**Reverted.** Both curves and the reasoning are recorded *in the config next to
the numeric*, so the next person to propose 30 finds the blocker rather than the
ruling. Filed as **RAMP-BOUNCEBACK-01**.

---

## Open, in priority order

1. **RAMP-BOUNCEBACK-01** *(P1)* — bound the post-deload bounceback rather than
   exempting it wholesale. A live §12 gap, not merely a blocker. Willy owns
   §2/§12; needs its own sitting.
2. **CB-PHASE-01 re-take** — ratifiable at 30 once (1) lands. Do not re-take it
   before, and do not re-propose 25.
3. **CAT-DEPTH-01 Phase 2** — unrelated to phase length; see the catalogue doc.

## Closed — do not re-raise

- *"Quality starts too late on a 10K plan."* It starts on the first day of build.
  Nothing in phase length moves 5K or 10K except 25%, which three seats declined.
- *"Remove a deload to start intensity sooner."* Declined at both sittings.
