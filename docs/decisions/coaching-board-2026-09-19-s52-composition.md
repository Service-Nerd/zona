# Coaching Board — 2026-09-19 — S52-LOPSIDED-BOUND-01 (reopened)

**Question as filed:** should §52 bind across the block rather than per-week, given a
per-week bound has failed twice?

**Answer: the filed question is the wrong one.** §52's percentage is a proxy. The thing
underneath is that the week loses the runner's declared days, and for one cohort the entire
build phase collapses.

**Ruling: CORRECT WITH AMENDMENT** on the finding. **Instrument deferred** — every candidate
reachable without a new constant is blocked by a binding condition. **Nothing shipped.**

---

## The finding

A *collapsed week* is a build or peak week delivering ≤2 running sessions to a runner who
declared ≥4 days available. Measured on cohortGrid + targetedGrid, coprime-stride sampled:

| cell | plans | any collapsed week | **≥ half the build/peak phase collapsed** | longest consecutive run |
|---|---|---|---|---|
| healthy × established | 2,722 | 0.0% | 0.0% | 0 |
| healthy × fresh-return | 873 | 0.0% | 0.0% | 0 |
| injury × established | 374 | 0.0% | 0.0% | 0 |
| **injury × fresh-return** | **361** | **11.4%** | **11.4% — all 41 affected** | **max 7, p95 7** |

Three cells at exactly zero and one at 11.4%: an **interaction**, not a gradient. Removing
either factor alone fixes the worst case, verified factorially.

### The worst case, printed

Knee history · fresh return (`weeks_at_current_volume: 4`) · beginner · 30 km/week ·
longest 12 km · **four days declared** · marathon **finish** · 18 weeks.

| wk | 1–6 base | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 peak | 15–17 taper |
|---|---|---|---|---|---|---|---|---|---|---|
| runs | 4 | **2** | **2** | **2** | 4 | **2** | **2** | **2** | **2** | 3–4 |
| share | 31–38% | 71% | 78% | 83% | 46% | 79% | 83% | 86% | **87%** | 37–48% |

Peak week: **26.0 km of a 30 km week in a single session**, beside one 3.6 km run. §9's own
sizing for that week is **9.6 km**. The engine prescribes **2.7× its own rule**.

### Mechanism

`ruleEngine.ts:3550` — the ADR-022 injury easy-run trim:
`easyToPlace = Math.min(remainingSlots, Math.max(1, Math.floor(remainingVolume / minDist.easy)))`.

Its floor is **one** easy run. The producer computed a running-day floor
`Math.max(3, Math.floor(dayCountKm / MIN_KM_PER_TRAINING_DAY))` at `:2847` and the trim never
consults it. **A floor computed and discarded by a later pass — the same shape §113
Amendment 1 vetoed at session level, third instance in two days.**

---

## Conflict scan

- **§90 / ADR-022** ratifies *"easy runs trim/drop to the ceiling; the long run never does"*
  — **but does not say how far they may drop.** The `max(1, …)` is an implementation choice
  with no principle behind it.
- **§9** sizes the long run at 28–40% and calls >35% *"a binge"*. The engine ships 87%.
  **Nothing enforces §9's share.**
- ⚠️ **§24 does NOT bind** — `time_target` only; this is a `finish` goal. **My submission
  claimed §24 required the 26 km and that was wrong.** No principle requires it.
- **§64** floors rest days. **No converse exists anywhere in the constitution.**
- **§52** lever (a) blocked by §90's wording; (b) blocked by the injury ceiling; (c) has
  already fired and changes nothing about the load.
- **§113 Am.1** — the precedent for the class.

## The board

**Hutchinson (chair).** With §24 removed the trilemma loses a horn: nothing requires 26 km,
and §9 already forbids it. The collision is **§80's specificity ramp against §90's injury
ceiling**, and nobody wrote down which wins. **The injury cap held its number and missed its
purpose** — third time today that sentence has been true.

**Seiler.** A two-run week halves §1's session-count denominator. No quality is placed here
so nothing fires today, but one quality session in a two-run week is a 50% share against an
18% ceiling. **Two independent routes to a week too small to hold a distribution, neither
guarded.**

**McMillan.** Four days declared, two delivered, and the note tells the runner *"the lever is
the other days"* — **advising them to do the thing the engine just removed.**

**Willy (author of ADR-022).** *"I wrote it to stop the delivered week exceeding the ceiling.
I did not specify how the week should be composed once it fits, and the engine resolved that
ambiguity by deleting the easy runs. Thirty kilometres over four days is a materially safer
week than thirty over two, and the cap treats them as identical. The ceiling is correct; what
is wrong is that 'trim the easy runs' has no floor, and I should have given it one."*

**Sims.** 26 km off a 12 km longest run is 2.5+ hours for most of this cohort, and the plan
has removed the shorter runs where fuelling would be practised. `weeks_at_current_volume: 4`
is frequently post-injury, post-illness or post-partum here.

**No seat dissented on the finding.**

## Binding conditions on any fix

1. Must **not** raise the injury ceiling (Willy).
2. Must **not** re-open `LR-DELOAD-RESUME-01`'s reverted failure (7.3 → 18.5 km).
3. Measured on the **property sweep**, not a hand-rolled grid — the S111 candidate read clean
   on 264 hand-built cases and threw 884 on the sweep, the same day.
4. `measure:fitness` before and after.
5. **Do not add a third per-week §52 bound.** That instruction survives; a floor on
   composition is a different object.

## Why the instrument is deferred

More easy runs at the configured `MIN_SESSION_DISTANCE_KM.easy` (4 km) pushes the week above
the ceiling — condition (1). A sub-floor easy run requires a **new constant**, which is the
ruling the board declined to make on argument alone. Both remaining routes need a number, and
the board will not pick one without the measurement conditions above.

## Artifacts

1. **Principle** — §90 *Recorded finding* (this measurement). **§90 itself unchanged.**
2. **Numeric** — deferred.
3. **Invariant** — **none exists and one should**: the converse of §64. Nothing checks that a
   week delivers the running days the runner declared. 17.2% of all plans deliver at least one
   week short of `days_available`.

## Baseline §52 state, for reference

2,531 breaches / 597 plans (15.5% of 3,859), **100% warn / 0 error** (all maintenance),
distribution continuous and unimodal at 65–69%, worst 87%, 70% marathon.

## SLT escalation — none. Pure correctness.
