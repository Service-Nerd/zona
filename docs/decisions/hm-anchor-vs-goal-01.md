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

## 4. RULING — Coaching Board, 2026-09-21

**CORRECT WITH AMENDMENT** on the anchor. **INSUFFICIENT EVIDENCE** on the amendment's bound.
Net effect: **ratified, does not yet ship.** Principle landed as **§120**.

**Option 1 adopted.** On a time-target plan the `HM` anchor resolves to GOAL pace, as `T` has since
2026-09-03 and as the sibling `mp_blocks` row already does. Option 2 (ineligibility on divergence)
was rejected: it deletes race-specific work from most time-target half plans, breaking §22 to fix a
pace. Option 3 (fix the build rotation) was rejected: the 555 ratio failures are a symptom, and the
rotation is not where the wrong number comes from.

### What the conflict scan found that the submission did not

1. **`mp_blocks`** — the same `race_specific` job one row away — is anchored **`goal`**, while
   `hm_pace_intervals` is anchored `HM`. The catalogue already answered this and never carried it
   across.
2. **§44's difficulty note already promises this behaviour in production:** *"the pace you're
   targeting is quicker than your benchmark currently supports, so race-pace sessions will bite
   harder than the interval work."* They do not. The copy describes §120 and the engine does the
   opposite.
3. **§85's CV shield does not transfer.** CV is shielded because the "over" of an over-under is
   defined relative to threshold. "HM pace" is defined relative to a race the runner has named a
   target time for. Different kind of anchor.
4. **§1 is untouched** — it counts SESSIONS (CD-19), so a pace change cannot move it. Recorded so it
   is not raised later as a phantom gate.

### Why the bound is unresolved, and why that blocks the ship

Willy's amendment is chair-adopted: above some divergence the row is not offered. **Both obvious
gates were examined and rejected** — `goalBeyondMeasuredFitness` tests against INTERVAL pace and so
only catches an impossible goal, not a 20–30% reach; and `difficulty_band`, which tracks the reach
closely, is forbidden by **§44 point 3 (Willy's own constraint): the band is derived only from
pre-generation feasibility, never from plan-quality signals.**

So a new constant is needed and its value must be **measured**: a 15% bound costs 27% of these
sessions their row, 20% costs 19%, and losing the row presses on §22's own 50% floor. The bound
trades one principle against another and cannot be set by preference.

### Also measured, and recorded because it looked convincing and was wrong

I expected the no-benchmark cohort to be the whole problem. **29% of no-benchmark sessions exceed a
15% error and 27% of benchmarked ones do too.** Splitting by benchmark rescues nothing; the fault is
the anchor, not the estimate behind it.

## 5. To ship, in one commit

1. ✅ **Principle** — §120, landed 2026-09-21.
2. ⬜ **Numeric** — `GENERATION_CONFIG.RACE_PACE_ANCHOR_MAX_STRETCH_PCT`, value measured, with the
   §22 trade stated at the chosen number.
3. ⬜ **Invariants** — `INV-PLAN-RACE-ANCHOR-MATCHES-GOAL` and `INV-PLAN-HEADER-PACE-MATCHES-WORK`
   (the latter already written and falsified), both with `plan-invariants.md` rows.
4. ⬜ **`npm run measure:fitness` on the CHANGED engine.** The board's own procedure requires it
   before any prescription change and it has not been run, because the change has not been built.
5. ⬜ The header fix and the structural classifier, **in the same commit** — see below.

⚠️ **THE TWO CHANGES SHIP TOGETHER OR NOT AT ALL.** The honest header cannot ship alone:
`INV-PLAN-RACE-SPECIFIC-EXPOSURE-RATIO` classifies goal-pace work by READING that header, so
telling the truth drops 555 plans below §22. Once the anchor resolves to goal, those sessions are
genuinely goal-paced and the ratio is satisfied by the prescription rather than by the display.

⚠️ **The defect is LIVE in production and has been for as long as the HM anchor has existed.**
Doing nothing is a decision too.

---

## 6. A separate, smaller question this uncovered — NOT part of the §120 ruling

`minPerKm`, which sizes a session and therefore sets its prescribed **distance**, uses
`pace.minPerKmQuality` for every non-VO2max quality session regardless of its work anchor. So a
CV-anchored session's distance is computed at THRESHOLD pace, and an HM-anchored one likewise.

This is the sizing twin of the header defect and was deliberately left alone while fixing the
header: moving it changes prescribed distance, which is a prescription change on its own account.
**The board has not ruled on it and it is not covered by §120.** Its magnitude has not been
measured. Raise it as its own item when §120 ships, since both touch the same lines.
