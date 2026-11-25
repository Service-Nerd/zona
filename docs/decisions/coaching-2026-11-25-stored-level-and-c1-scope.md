# Coaching Board — the stored-plan level, the maintenance claim, delivered tonnage, and C1's scope

**Date:** 2026-11-25 · **Convened by:** ADR-027 B3 (`VERIFIER-STORED-LEVEL-01` is a cut-over blocker)
**Seats:** Hutchinson (chair), Seiler, McMillan, Willy, Sims. Blagrove silent (no strength question).

**Trigger:** Q1 is a **soft trigger** on `lib/plan/fitnessAssessment.ts` (generation code) that does
**not** qualify — see the exemption below. Q2 and Q3 are proposals for new rules, so they are this
board's. Q4 is a scope correction to this board's own ruling of 2026-11-22.

---

## 📐 Measurements taken before any seat spoke

All on the **live fleet, 44 stored plans**, read-only, 2026-11-25. Where a figure of mine was wrong,
it is corrected here with both numbers, because the first one was in a filed item.

| # | Question | Answer |
|---|---|---|
| M1 | Plans where §79 split the two axes (`fitness_intensity_level` ≠ `fitness_level`) | **10 of 44** |
| M2 | …of those, how many the stored profile fails to reproduce | **1** — the other 9 are masked because they ALSO carry an upward declaration that happens to resolve to the same level |
| M3 | Does the stored request carry the field the assessment would need? | **10 of 10.** `storedPlanInput` sets `fitness_intensity_level` from meta deliberately, for §79 |
| M4 | Does anything read `input.fitness_intensity_level`? | `invariants.ts:1100` does. **`resolveLevels` does not, and its parameter type is a `Pick<>` that structurally cannot see it** |
| M5 | Does the wizard ever send it? | **No** — `wizardShape.ts` lists it under `NOT_WIZARD`. No corpus sets it either |
| M6 | **Spiked:** `resolveLevels` reads it. Effect? | **The collapse goes 1 → 0, and `verify:parity` is IDENTICAL over 6,210 cases.** (Full suite NOT run under the spike) |
| M7 | Rules C1 moved onto the profile's level | **9**, of which **2 EXEMPT a beginner** (`QUALITY-NOT-ZERO`, `QUALITY-EXPECTED`), so the stored path checks LESS, not more |
| M8 | Does §10's staleness ramp move any live plan's level today? | **0 of 44** |
| M9 | Plans claiming `volume_profile: 'maintenance'` | **19 of 44**; **0** of them without a `volume_constraint_note` |
| M10 | …of those, how many a RUNNER-SIDE cause explains (near the peak target, ≤2 days, or a volume-capped injury) | 🔴 **4 of 19. I first reported 1 of 19 and that figure was my predicate's fault** — it omitted §23's own primary stated cause (`current_weekly_km` already near the per-level peak target). Corrected: near-target 1, ≤2 days 0, capped injury 3 |
| M11 | …so how many have no runner-side cause at all | **15 of 19** — e.g. a beginner at 20 km/week building a marathon against a 52 km target: §46's floor is simply out of reach |
| M12 | Plans delivering above their structural peak band | **1 of 44, by 1 km** (39 delivered against a 38 km beginner band) |
| M13 | Plans carrying an upward declaration | **10 of 44** |

---

## 🔍 Conflict scan (amendments included, and it decided two of the four)

- 🔴 **§79, "Two inputs, two axes — do not merge them":** *"`fitness_level` is the **API-level
  structural declaration** … `user_declared_level` is **what the runner picked**. Collapsing them is
  what produced the defect: one enum was carrying two different authorities."*
  `fitnessAssessment.ts:201` reads `assessedIntensity = input.fitness_level ?? assessed.intensity` —
  **it lets the structural declaration set the intensity axis.** That is the merge §79 forbids, in a
  sentence §79 wrote *because the engine had already done it once.* **Q1 is a defect against
  documented intent, not a policy question**, and the item's framing ("which level is a stored plan
  judged at?") was mine, not doctrine's.
- **§79's Meta clause** — *"when the signals disagree, `fitness_intensity_level` carries the higher
  level"* — makes the field doctrine. Nothing in the assessment reading it is the whole defect.
- 🔴 **§23 ratifies the label as the MECHANISM, not as a tolerated self-label:** *"it MUST surface
  `volume_profile = 'maintenance'` with a `volume_constraint_note` explaining why"*, and *"the
  invariant accepts either a passing ratio OR an explicit 'maintenance' classification."*
- **§46** does the same: *"the engine downgrades to `maintenance` via the §23 / §38 mechanism."*
- **§23's CD-10 paragraph** keeps `INV-PLAN-PEAK-IN-PEAK-PHASE` at **warn** for maintenance plans on
  purpose, and says so. The severity read C1 left in place is ratified.
- **ADR-022 / §90** already governs curve-vs-delivered divergence, declared and bounded, fixed for
  injury runners and left to §52 for healthy ones. Q3 proposes a second rule in that territory.
- **`RUNWALK-ASSESSED-LEVEL-01`** is the recorded reason `storedPlanInput` takes the levels from
  `meta`: a stored plan is judged at the level it was BUILT at. Q1 restores that for the intensity
  axis; it does not reverse it.
- ⚠️ **`RUNWALK-ASSESSED-LEVEL-01-PEAK` carries a standing condition on this board** — *"served →
  refused and refused → served as named cohort counts; aggregate refusal rates no longer accepted."*
  It binds any ruling that changes prescription. Q1 changes none (M6), so it is satisfied by
  measurement rather than by argument.

No zone-model translation issue: nothing here touches Z2/Z3.

---

## 🏃 Alex Hutchinson (Chair)

On **Q1**, I am not going to rule on a question the constitution has already answered. §79 contains
the sentence *"collapsing them is what produced the defect: one enum was carrying two different
authorities"*, and the line we are being asked about collapses them. The submission arrived framed as
*"which level should a stored plan be judged at"*, which sounds like a policy choice and is not one —
it is the same merge, in a function nobody re-read. **The exemption applies and I am stating it rather
than dressing a defect fix as a ruling.**

One thing I want on the record, because it is the part that would have bitten us. The measurement says
**1 of 44 plans collapses today and 10 are exposed.** The nine that look fine are fine *by
coincidence*: they carry an upward declaration whose level happens to equal the one §79 derived. That
is not a mechanism, it is an accident of the data, and it would stop being true the first time a
runner declares something different from what §79 lifted them to. **A defect masked by a coincidence
in nine of ten cases is more dangerous than one that fires in all ten**, because the one case reads
as an edge case.

On **Q2** and **Q3**: both are proposals the submitter brought and both are undermined by the
submitter's own numbers. I will take that as good faith rather than a wasted sitting, but the rulings
are not close.

On **Q4**: accepted, and the reasoning is stronger than the submission claimed. The submission argued
`volume_profile` *cannot* be re-derived. §23 says something better: reading it is **what the rule
says to do**. *"The invariant accepts either a passing ratio OR an explicit 'maintenance'
classification."* That is not a self-label the checker tolerates; it is the declared outcome §23
requires the engine to surface and the checker to accept.

## 📊 Stephen Seiler

On **Q1**, the thing that concerns me is which axis a mistake lands on. §79's asymmetry is deliberate
and I have argued for it here before: take the lower level for structure, the higher for intensity,
because volume is where injuries come from and intensity is where progress is lost. The defect
collapses the **higher** reading down to the **lower** one — so it fails on the side that costs
progress. For the two rules that exempt a beginner that means the checker stops asking a §79-elevated
runner's plan for quality at all. **The engine prescribed correctly and the checker then agreed with
a plan it should have questioned.** That is the worst direction for a checker to be wrong in, and it
is why I would not leave this open for another wave.

On **Q3**, no objection from this seat on the proposal's direction, but 1 plan over by 1 km is not a
distribution finding and it is not a tonnage finding. It is a rounding boundary.

## 🎯 Greg McMillan

**Q2 is the one I want to speak to**, and the corrected number is the whole answer. Fifteen of
nineteen maintenance plans have no runner-side cause at all, and when you look at them they are
obvious: a beginner on twenty kilometres a week who has entered a marathon, against a fifty-two
kilometre floor. There is nothing wrong with that classification. The engine looked at the gap and
said *this is not a build, and here is why* — in a sentence the runner reads. **A rule demanding that
the runner's own facts justify the claim would reject fifteen correct answers to protect against a
case that has never occurred.** Nineteen of nineteen already carry their note.

I will say the obvious thing about the first figure, too. The submission said one of nineteen, and the
honest version is four of nineteen, and the difference was a test that did not include §23's own
stated reason. Either number kills the proposal, so it did not change the outcome — but *the figure
that nearly went into a ruling was computed by a predicate narrower than the rule it was testing*, and
that is the third time this year.

On **Q1**: fix it. The runner at the centre of §79's own founder case — the lifelong runner whose
volume dropped after a hundred kilometre race — is exactly the runner this collapses.

## 🩹 Rich Willy

**Q1 is safe in the direction that matters and I want that stated rather than assumed.** The fix
raises what the *checker* reads on the intensity axis. It does not raise what the engine
*prescribes*: parity is byte-identical across six thousand two hundred and ten cases. Structure —
peak km, the ramp, the long-run caps — stays bound to current volume, which is §79's asymmetry and
my condition on it. So this is a checker becoming able to ask a question again, with no tonnage
consequence. **Approved from this seat, with one condition below.**

**Q3 I am closer to than the chair is**, and I want the reason recorded rather than the vote. The
question — does the volume a runner actually *receives* stay inside their assessed band — is a
legitimate load question and it is not the same question §79 asks. §79 polices the *target*. ADR-022
polices the curve against the delivered week and leaves the healthy case to §52. So there genuinely is
no rule that reads the delivered peak against the band. **But one plan, one kilometre over, is not the
evidence for one.** I will not hold a veto open on a finding that size. What would move me is named
below, and it is not an aggregate.

## ⚕️ Stacy Sims

On **Q1**, the cohort this lands on is the one I keep raising. §79's training-age lift exists for the
returning runner, and the returning runner in this product's demographic is disproportionately a
peri- or post-menopausal woman whose volume has dropped and whose aerobic base has not. Collapsing
her intensity allowance back to beginner means the checker stops noticing that her plan has no
quality in it — and loaded, intense work is precisely what the bone and muscle evidence supports for
that runner. **The silence lands on the group least able to afford it.**

On **Q2**: no objection to the ruling, and a note that is not an objection. A plan that only ever
*adds* load will never surface low energy availability, and `volume_profile: 'maintenance'` with a
written note is one of the few places this product tells a runner *less is the answer here*. I would
not want a justification rule to make the engine reluctant to say it.

---

## ⚡ Recorded disagreements

- **Q3, Willy vs Hutchinson — not resolved, deliberately.** Willy holds that a delivered tonnage
  ceiling is a real gap in the rule set: §79 polices the target, ADR-022 polices the curve, and
  nothing reads the delivered peak against the assessed band. Hutchinson holds that a gap with one
  instance at one kilometre is not a gap you legislate for. **Both agree the current evidence does
  not settle it**; they differ on whether the question stays open. It stays open as
  INSUFFICIENT EVIDENCE rather than being closed, which is Willy's position on the filing and
  Hutchinson's on the rule.
- **No disagreement on Q1, Q2 or Q4.**

---

## ⚖️ Rulings

### Q1 — `VERIFIER-STORED-LEVEL-01`: which level is a stored plan judged at?

⚙️ **EXEMPT — NOT THIS BOARD'S. §79 ALREADY RULED IT, AND THIS IS A DEFECT FIX RESTORING DOCUMENTED
INTENT.** §79: *"Two inputs, two axes — do not merge them … collapsing them is what produced the
defect: one enum was carrying two different authorities."* `resolveLevels` lets the API **structural**
declaration (`input.fitness_level`) set the **intensity** axis, which is that merge. The fix is to
read `input.fitness_intensity_level` — a field §79's Meta clause mandates, that `storedPlanInput`
already carries for this exact purpose, that `invariants.ts` already reads, and that the assessment's
parameter type cannot currently see.

**Build it. Conditions, all three binding:**
1. **`verify:parity` IDENTICAL** — measured already (6,210 cases). The wizard never sends the field
   and no corpus sets it, so this is a no-op for generation; if parity moves, stop and re-convene.
2. 🔴 **`scripts/property-validate-plans.ts` and `scripts/r23-phase7-validation.ts` must both run
   clean**, because §79 names them as the long-standing consumers of the `fitness_level` API override
   and neither is inside parity's grid. **This is the condition the parity run does not cover.**
3. **The nine masked plans are named in the build record**, not just the one that fires: the exposure
   is 10 of 44 and the measurement must not be reported as 1.

⚠️ **And the item's own framing is corrected in the backlog**: it is filed as a Coaching Board
question and it is not one.

### Q2 — `MAINTENANCE-CLAIM-JUSTIFIED-01`: must a maintenance claim be justified by the runner's facts?

🔴 **INCORRECT — this is a veto on the rule as proposed.**

**15 of 19 live maintenance claims have no runner-side cause**, and every one of them inspected is a
correct §46 / §52 / §81 / §82 outcome: the absolute floor, the long-run overrun or the easy-floor
overrun is out of reach for that runner's week. A rule requiring runner-side justification would
reject fifteen correct classifications to guard against a case with **zero instances**.

**And §23 forecloses the premise.** The label is not a self-description the checker tolerates; §23
*requires* the engine to surface it and the invariant to accept it: *"the invariant accepts either a
passing ratio OR an explicit 'maintenance' classification."* Reading `volume_profile` IS the rule.

**What already enforces honesty:** the `volume_constraint_note` requirement, which **19 of 19 live
plans satisfy**, plus `INV-PLAN-EASY-FLOOR-PROTECTION-DECLARED` and
`INV-PLAN-VOLUME-CONSTRAINT-DECLARED`. **Close the item.** ⚠️ Sims' note recorded, not ruled: this is
one of the few surfaces where the product tells a runner that less is the answer, and nothing should
make it reluctant to.

### Q3 — `DELIVERED-TONNAGE-VS-BAND-01`: is there a delivered tonnage ceiling?

🟡 **INSUFFICIENT EVIDENCE. The item stays open; no rule is authored.**

**1 of 44 live plans delivers above its structural band, by 1 km.** That is a rounding boundary, not a
load finding, and ADR-022 already declares and bounds the curve-vs-delivered divergence.

**What would settle it (Willy, and it is not an aggregate):** the delivered peak against the assessed
band across the cohort grid and the targeted grid, reported as **named cohort counts** — how many
runners, at what level, which distance, and by how many kilometres — with the injury and masters cells
constructed explicitly, since neither grid varies injury. Per the standing condition on
`RUNWALK-ASSESSED-LEVEL-01-PEAK`, **an aggregate rate will not be accepted on this item.** If the
answer is a handful at under a kilometre, §52 and ADR-022 already cover it and the item closes.

### Q4 — C1's scope correction: `volume_profile` and `peak_km_target`

🟢 **CORRECT, AND ON BETTER GROUNDS THAN THE SUBMISSION ARGUED.** Both fields are construction records
and C1 was right not to convert them. The submission's reasoning was that `volume_profile` *cannot*
be re-derived (true, and measured: 3,544 of 17,200 plans pass §23 while being maintenance for one of
the other five triggers). **The stronger reason is that §23 and §46 both prescribe reading it** — the
invariant is told to accept the declared classification, and CD-10 keeps
`INV-PLAN-PEAK-IN-PEAK-PHASE` at `warn` for maintenance plans on purpose.

`peak_km_target`: §79's subject is the **target** — *"an upward declaration never raises the peak
target above the assessed band"* — so substituting the delivered peak changes the rule's question.
Confirmed. The two **levels** in that rule were C1's and correctly converted.

**C1's row in `coaching-rulings.md` is amended** to carry the §23 / §46 grounds rather than only the
"cannot re-derive" argument.

---

## 📦 Required artifacts

| Ruling | Principle | Numeric | Mechanical check |
|---|---|---|---|
| **Q1** | **None** — §79 already states it; a defect fix authors no principle. A cross-reference is added at §79's "two axes" paragraph naming `resolveLevels` as the site that breached it | **None** — no value changes | A test that `resolveLevels` honours `fitness_intensity_level` on the stored round-trip, falsified against today's line; plus the step-3 shadow's `level_mismatch` going 1 → 0 |
| **Q2** | None (veto) | None | None. **The item closes** |
| **Q3** | None (insufficient evidence) | None | None. The item stays open with the measurement named above |
| **Q4** | None | None | None — a scope correction. Register row amended |

⚠️ **`measure:fitness` was NOT required for this sitting and that is deliberate**: Q1 is measured
parity-identical, so no plan changes and the harness has nothing to see. Q2 and Q3 author no rule.
**If parity moves on Q1's build, `measure:fitness` becomes mandatory and this sitting is void.**

## ↗️ SLT escalation

**None.** Nothing here touches tier, price, build cost or roadmap order.
