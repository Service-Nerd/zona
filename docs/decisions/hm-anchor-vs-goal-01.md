# `HM-ANCHOR-VS-GOAL-01` — the session header was covering for the prescription

**Filed 2026-09-21. For the Coaching Board. Not actioned: the fix changes what the engine prescribes.**

**Origin.** A founder review of the published plan pages asked why a "week 7 CV header pace" looked
wrong. It was. Chasing it found a second, larger thing underneath.

---

## 1. What is wrong with the header (a defect, and the fix is one line)

A session card's header pace is documented as the session's **work** pace. §85 goes to the trouble
of computing a time-weighted mean for an over-under specifically so *"the header is honest about a
session whose steps run either side of threshold"*.

Every other row fell through to the generic quality band regardless of what its work steps were
anchored to. Two mechanisms, measured across the catalogue:

| Mechanism | Rows | Effect |
|---|---|---|
| Non-goal weeks: the `else` branch always uses `pace.qualityPaceStr` | `cv_intervals` (CV, faster than T), `hm_pace_intervals` (HM, slower than T) | Header disagrees with the reps in **both directions** |
| Goal-pace weeks: §22 substitutes the `T` anchor and **only** `T`, but the header switches to goal pace regardless | any row anchored `CV`, `HM` or `M` | Header claims a substitution that did not happen |

**Measured on `npm run verify:sweep`: 2,811 sessions displayed a pace their own reps contradicted.**

Live example, `/plans/10k-12-week`, the CV intervals session:

```
header   5:30–6:00 /km      <- threshold band
reps     5:21–5:34 /km      <- CV band, what the session actually is
```

A runner reading the header runs the reps up to **30 s/km too slow**, which is the session gone.

---

## 2. What was underneath it (the board's question)

`INV-PLAN-RACE-SPECIFIC-EXPOSURE-RATIO` decides whether a session counts as goal-pace work by
comparing its **header** to goal pace. A display field deciding a structural question: the exact
thing `INV-CLASS` forbids, and the comment on its sibling arm records that arm being fixed and this
one being missed.

So every one of those 2,811 sessions counted toward §22's 50% race-specific exposure **because of
the lie**.

With honest headers, **555 sweep cases fall below §22's 50% floor**, and 36 unit tests fail because
`generateRulePlan` throws on error-severity violations in `NODE_ENV=test`.

**It is not a measurement artefact.** Traced on a real input (21.1 km, 1:50:00 goal, 45 km/week,
4 days, age 40). Goal pace **5:13 /km**:

| Week | Row | Work prescribed | Goal pace? |
|---|---|---|---|
| 9 | `tempo_cruise` | 5:07–5:19 | yes |
| 10 | `progressive_tempo` | 5:07–5:19 | yes |
| 11 | `hm_pace_intervals` | **5:49–6:11** | no |
| 12 | `hm_pace_intervals` | **5:49–6:11** | no |
| 13 | `hm_pace_intervals` | **5:49–6:11** | no |

`HM` resolves to the runner's **current** half-marathon pace, not their **goal** one. For a runner
targeting a faster half than their present fitness, the three **peak-phase** race-specific sessions
are prescribed **36 to 58 seconds per kilometre slower than the pace they are training to hold**,
and the card read 5:07–5:19 over every one of them.

---

## 3. What the board has to rule on

1. Should `HM` resolve to **goal** pace on a time-target plan, as `T` already does under §22?
   §85 shields `CV` from that substitution for a stated reason ("the *over* of an over-under is
   defined relative to threshold, not to a race goal"). No equivalent reasoning exists for `HM`,
   and the case against substituting it is the mirror image: a runner should perhaps rehearse the
   pace they intend to run, not the one they currently hold.
2. Or should `hm_pace_intervals` be **ineligible** when goal and current HM pace diverge beyond
   some band, the way `CAT-ROW-ELIGIBILITY-01` handles an unresolvable anchor?
3. Or is §22's 50% floor simply **not met** for this cohort, and the remedy is in the selector's
   build rotation rather than in the anchor?

**Willy's angle is not neutral here:** option 1 makes three peak-phase sessions materially harder
for a runner who is, by construction, targeting a time above their current fitness. That is a load
change, not a relabelling.

---

## 4. Status

**Nothing shipped.** The header fix, the structural classifier and a new
`INV-PLAN-HEADER-PACE-MATCHES-WORK` invariant were all written, measured and then **reverted**,
because shipping them requires either changing what the engine prescribes or weakening a
constitutional invariant, and both are the board's call. The branch state is clean; this document
is the deliverable.

⚠️ **The defect is LIVE in production today** and has been for as long as the HM anchor has
existed. Doing nothing is a decision too.
