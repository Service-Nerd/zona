# Coaching Board, 2026-11-21: the base-build on-ramp ignores a knee/shin history (ADR-027 hotfix 2)

**Input:** ADR-027 (accepted; engine frozen except hotfixes), hotfix 2, and the final plan read
(`coaching-2026-11-20-final-plan-read.md`: knee/shin ramp plans rise more than 5.5% in a week, worst ×2.43).
No backlog item exists. This note names the ruling `ONRAMP-INJURY-CLIMB-01` so the build has a scope.
**Trigger:** soft trigger that qualifies. The fix changes what a knee/shin runner's ramp prescribes. The doctrine
edits (`CoachingPrinciples.md` §116, `invariants`/`baseBuildValidate.ts`, `plan-invariants.md`) belong to the build.
**Board:** six seats, Willy leading on load. Blagrove has no strength question here and is silent.

---

## 1. Analysis (before any seat spoke)

### The defect, re-derived

`onRampCurve` (`lib/plan/baseBuildOnRamp.ts`) has one rule for everyone: +10%/week (`MAX_WEEKLY_VOLUME_INCREASE_PCT`),
a 70% deload (`RECOVERY_WEEK_VOLUME_PCT`) every `BASE_BUILD_ONRAMP_DELOAD_FREQUENCY` (4) weeks, and a **carried build
line** that keeps climbing through the deload. So the week after a deload is `1.1²` = **1.21×** the week before the
deload, and `1.1 / 0.7` = **+57%** over the deload week. It reads no injury history.

C1 ramp grid (`planread/ramps/hf2.ts`, 11,040 inputs, production shape), today's code:

| measure | item | re-measured |
|---|---|---|
| knee/shin plans with a ramp | 540 | **425** with ≥2 base-build weeks (540 not re-derived; the denominator differs) |
| of those, an ordinary (non-bounceback) week rising >5.5% | 425 | **425 of 425**, worst ordinary rise **+10.7%** |
| worst post-deload week vs pre-deload week | ~1.21× | **+21.4%** |
| worst single rise | ×2.43 | **+142.9%** (a delivered deload at 50% of the prior week, then the bounceback) |

### 🔴 The brief's premise names a withdrawn amendment

The brief says *"§2 Am. 3 / RAMP-BOUNCEBACK-01 bounds the injury bounceback by the 5% cap"*. **§2 Am. 3
(PLAN-FITNESS-01, 2026-09-17) withdrew that bound.** Its text: *"the post-deload week may return to the pre-deload
volume, and no higher"*, conditional on `INJURY_RECOVERY_WEEK_VOLUME_PCT >= INJURY_BOUNCEBACK_MIN_DELOAD_PCT` (85 ≥ 85).
Am. 1 (capped bounceback) plus Am. 2 (85% deload) is the combination Am. 3 measured as **stuck**: break-even needs
`1/1.05³` = 86.4%, so 85% gives **−1.6% per cycle**. Attempt 1 (`hotfix2-attempt1.patch`) implemented Am. 1 + Am. 2
and reproduced that arithmetic exactly (`×1.05³ × 0.85 = 0.984`). **The rule combination did not fail; the brief
cited a superseded version of it.**

### How the race engine combines the same rules (`buildVolumeSequence`, `ruleEngine.ts:446`)

For a knee/shin runner (`injuryCapPct` = 5):

| rule | race engine | source |
|---|---|---|
| ordinary week | `≤ round(prev × 1.05)` (min of the allowance and the injury cap) | pass 2, §2 |
| deload depth | `min(pass-1 value, round(post-cap prior week × 0.85))`: 85% of the week the runner actually ran | pass 2, DELOAD-INVERSION-01, `deloadVolumeFraction` |
| bounceback | `max(prev × 1.05, preDeload)`, capped by the pass-1 line: **returns to pre-deload, no higher** | pass 2, §2 Am. 3, self-withdrawing gate |
| after the bounceback | +5% from pre-deload | pass 1 line, capped in pass 2 |
| cadence | §87 `computeDeloadWeeks` (4 standard / 3 masters) | `deloadCadence.ts` |

Per 4-week cycle: two +5% weeks, one 85% deload, one return to pre-deload, so **×1.05² = +10.25% per cycle**. It climbs.
Delivered checks agree: `INV-PLAN-BOUNCEBACK-BOUNDED` fires only on a return **above** pre-deload (`>`), and
`INV-PLAN-INJURY-CAP-DELIVERED` exempts the post-deload week.

### Candidates, measured read-only

Method: a throwaway git worktree in the scratchpad, attempt 1's profile plumbing, and the injury branch of
`onRampCurve` switched by an env var (`hf2-variants.patch`). Every call site (staged ×3, `assessOnRamp`,
`generateBaseBuildPlan`, `getRunningPlan`, `walkRunStart`, `runWalkApplies`) takes the profile. Scripts and logs:
`scratchpad/hf2x-evidence/` (`hf2.ts` grid, `probe.ts`/`probe2.ts` envelope, `cmp.ts`, `worst.ts`).

Curves from 8 km (17 weeks):

- **OFF (today):** 8 8.8 9.6 7.4 **11.7** 12.8 14.1 10.9 **17.1** …
- **L (attempt 1):** 8 8.4 8.8 7.4 7.7 8 8.4 7.1 7.4 7.7 8 6.8 … **6.8** (declines)
- **A (race-engine rule):** 8 8.4 8.8 7.4 **8.8** 9.2 9.6 8.1 **9.6** 10 10.5 8.9 **10.5** … **11.5**
- **B90 (90% deload, 5% bounce):** 8 8.4 8.8 7.9 8.2 8.6 9.0 8.1 8.5 … 8.9
- **C (carried line at 5%):** 8 8.4 8.8 7.8 **9.7** 10.2 10.7 9.5 **11.8** … 17.4

C1 ramp grid (425 knee/shin ramp plans; nets over the 348 with a deload in the ramp, 311 for OFF):

| | OFF | L | **A** | B90 | C |
|---|---|---|---|---|---|
| route flips served→refused / refused→served | 0 / 0 | 0 / 0 | **0 / 0** | 0 / 0 | 0 / 0 |
| healthy + achilles/back/hip/plantar plans changed | 0 | 0 | **0** | 0 | 0 |
| knee/shin plans changed | 0 | 425 | **425** | 425 | 425 |
| ordinary week rising >5.5% | 425 | 0 | **0** | 0 | 127 (rounding, max 5.7%) |
| worst bounceback vs pre-deload | +21.4% | 0.0% | **0.0%** | 0.0% | **+10.8%** |
| ramp ends at or below its start | 0 | **216** | **0** | 0 | 0 |
| net ramp build, median (min) | +185% (+45%) | **−0.4% (−25%)** | **+37.1% (+12.9%)** | +17.1% (+5.7%) | +70.7% (+20.0%) |
| `reaches_door` true→false | — | 73 | **18** | 37 | 12 |

Envelope marathon staged population (`distanceEnvelope(42.195)`, 3,056 staged, 1,280 knee/shin):

| | OFF | L | **A** | B90 | C |
|---|---|---|---|---|---|
| knee/shin reaching the door | 480 | **0** | **320** | 160 | 320 |
| `CURVE-CLIMBS` plans, as written | 0 | 320 | **320** (480 violations) | 320 | 0 |
| `CURVE-CLIMBS` plans, amended (below) | 0 | **320** | **0** | **320** | 0 |
| any other base-build code | 0 | — | **0** | — | — |

Reading the table:

- **A** is the race engine's rule. It climbs on every plan, holds every ordinary week at 5%, and never returns above
  pre-deload. Under A, the only thing that fires is `CURVE-CLIMBS` as written, and it fires on the bounceback week,
  which **equals** pre-deload. That arm reads "post-deload must exceed pre-deload". §2 Am. 3 makes "equal" the rule.
- **B** needs a new number. Any deload deeper than `1/1.05` (95.2%) leaves the bounceback **below** pre-deload, so
  `CURVE-CLIMBS` fails under both readings (320 at 90%). It also halves the door rate against A.
- **C** returns **above** pre-deload (+10.8%) and is +22% over the deload: §2 Am. 3's "no higher" forbids it.
- **L** declines: 216 of 425 ramps end at or below their start, and 0 knee/shin envelope runners reach the door.
- **Delivered deloads diverge from the curve.** Under A, 68 of 756 ramp deloads are delivered below 80% of the prior
  week, against the curve's 85%. Those 68 are the only bouncebacks above +20% over the delivered deload (worst +102%).
  The same 67–68 appear under L, and OFF has 707 of 707 above +20%. This is placement (ADR-022's delivered class), not
  the curve rule. It is outside this hotfix.

### What the evidence cannot show

- Whether +37% median over a ramp is enough fitness for the race that follows. `measure:fitness` and `cohort:shape`
  never build a ramp, so they are blind here by construction. They were not run.
- `verify:parity` is blind for the same reason (no staged ramps). The race-engine half of the build is the only part it
  can see.
- Production: not measured. Live-plan policy is new plans only.
- The cycle arm proposed below (pre-deload to pre-deload) was **not measured**. Only the bounceback arm was.

---

## 2. Conflict scan

- **§116 Am. 1** ("the same ramp rule as any other building block"): A is that rule for knee/shin runners. The ramp
  does not apply it today.
- **§2** (injury cap 5%), **§2 Am. 1** (capped bounceback, **withdrawn** by Am. 3), **§2 Am. 2** (85% injury deload),
  **§2 Am. 3** (return to pre-deload, no higher, self-withdrawing below 85): A honours all of these. L honours Am. 1,
  which no longer stands.
- **§3 / §87** cadence: the ramp keeps `BASE_BUILD_ONRAMP_DELOAD_FREQUENCY` (4). §116's config note excludes masters
  on purpose. Not reopened.
- **§12**: the cohort is `hasVolumeCappedInjuryHistory` (knee/shin), §12's producer owner. Achilles, back, hip and
  plantar histories are unchanged (measured: 0 changed).
- **§116 Am. 7** (the ramp ends on a build week) and **Am. 2/12** (per-run step): unaffected. 0 other base-build codes
  under A.
- **`INV-PLAN-ONRAMP-CURVE-CLIMBS`**: its first arm contradicts §2 Am. 3 for an injury ramp under A. This is the same
  checker-vs-principle class as the `>=`→`>` correction to `INV-PLAN-BOUNCEBACK-BOUNDED` (2026-09-17).
- **D-08**: two copies of one rule (race engine pass 2, ramp) produced this defect. The ruling asks for one owner.
- Zone model: no zone question.

---

## 3. Seats

### 🩹 Rich Willy (leading)

"The D-21 framing is right, and the answer is that we already solved it. On 17 September I withdrew my capped
bounceback because the curve was stuck, not slow: +6% over eighteen weeks. Attempt 1 rebuilt that exact rule on the
ramp, and the ramp is now stuck again, with 216 of 425 ending below where they started. A knee runner held at 6 km for
four months is not protected; they arrive at the race block with nothing.

What I accepted for the race engine I accept here. The bounceback is +17.6% back to a load the tissue carried seven
days earlier. No ordinary week goes above 5%. Nothing goes above pre-deload. My condition is still mechanical: if
anyone lowers `INJURY_RECOVERY_WEEK_VOLUME_PCT` below 85, the exemption withdraws itself in both places. That only
holds if both places read the **same** function. Two copies of my condition is how this happened."

On B: "A 90% 'deload' is a 10% trim. It is not a recovery week, and it still fails the climb check. No new number."
On C: "+22% off the deload and 11% above a week they have run is a spike. No."
On the 68 delivered deloads: "Those are placement. Today it is all 707 bouncebacks. A makes it 68. I want the delivered
side fixed, but not in a hotfix."

### 🏃 Alex Hutchinson (chair)

"The brief asked whether the rule combination *can* produce a climbing ramp. It can, and it does, in the race engine,
for every knee/shin runner, today. The literal reading failed because it read Amendment 1, not Amendment 3. That is the
finding, and the decision note says it first, because the next person to read §2 will make the same mistake.

I want one owner, not a second correct copy. Two copies of the injury bounceback rule, one current and one stale, is
precisely the shape of this defect. The cost is touching the race engine during a freeze. I accept that cost only with
`verify:parity` IDENTICAL as the gate on the race-engine half."

On the reach cost: "18 grid runners and 160 envelope runners lose the door, and none lose their plan. A door we cannot
reach safely should not be claimed."

### 🎯 Greg McMillan

"What does it feel like on a Tuesday? Today a knee runner goes 8, 8.8, 9.6, down to 7.4, then 11.7. That last week is
the one people get hurt in. Under A it is 8, 8.4, 8.8, 7.4, 8.8. They recognise that week; it is one they have already
run. That is the plan a coach writes."

On reach: "The runners who now miss the door still get the ramp and the checkpoint. The checkpoint asks again on what
they actually ran. That is §116 Am. 7 working, not a refusal." He wants the reach loss stated in the build record by
cohort, not as one total.

### ⚕️ Stacy Sims

Concurs. She records one concern, not a condition: the ramp uses the 4-week cadence for masters too (§116's config note,
ratified). Under A, a knee-history woman in her fifties gets three loading weeks before a deload, where the race engine
would give her two. "I am not reopening the ratified note in a hotfix. But the injury × masters cell has been the worst
one every time it has been measured, and nobody has measured it on the ramp."

### 📊 Stephen Seiler

The ramp is all easy (`INV-PLAN-ONRAMP-ALL-EASY`). No intensity question. No objection from this seat.

### 💪 Richard Blagrove

No strength question. Silent.

---

## 4. Recorded disagreements

- **Hutchinson vs McMillan, on extracting the owner during the freeze.** McMillan would ship the ramp branch alone and
  migrate the race engine in ADR-027's B-phase: "a hotfix should touch one file". Hutchinson rules the shared owner in
  now, gated on parity. What would change his mind: a non-IDENTICAL parity result. Then the ramp ships alone and calls
  the owner, and the race engine's migration goes to B0 as a named step.
- **Sims, on masters cadence:** recorded above; not a condition.

---

## 5. Ruling

**CORRECT WITH AMENDMENT: option (a), which is also option (c).** A knee/shin runner's on-ramp uses the race engine's
own combination of §2, §2 Am. 2 and §2 Am. 3:

1. An ordinary week rises at most `INJURY_WEEKLY_INCREASE_CAP_PCT` (5%) over the previous week.
2. A deload is `INJURY_RECOVERY_WEEK_VOLUME_PCT` (85%) **of the previous week as prescribed**, never of a carried line.
3. The week after a deload returns to the pre-deload week, **and no higher**. While
   `INJURY_RECOVERY_WEEK_VOLUME_PCT < INJURY_BOUNCEBACK_MIN_DELOAD_PCT`, it is bounded by the 5% cap instead
   (Am. 3's self-withdrawal, inherited).
4. Growth resumes at 5% from there. Cadence stays `BASE_BUILD_ONRAMP_DELOAD_FREQUENCY`.

Net: ×1.05² per 4-week cycle (+10.25%).

**Amendment 1:** one owner for rules 1–3, shared by the race engine and the ramp.
**Amendment 2:** `INV-PLAN-ONRAMP-CURVE-CLIMBS` is amended for injury ramps, and gains the arms that would have caught
both today's defect and attempt 1's.

Healthy runners and achilles/back/hip/plantar histories are unchanged (measured: 0 plans differ).

Options B and C are **INCORRECT**. B is a trim posing as a deload; it needs a new number and still fails the climb.
C returns above pre-deload, which §2 Am. 3 forbids. Option L (attempt 1) is **INCORRECT**: it implements §2 Am. 1,
which Am. 3 withdrew, and the curve declines.

---

## 6. Build spec (executable)

**Principle: §116 Amendment 15** *(15 only if Am. 13 and Am. 14, ruled 2026-11-20, land first; otherwise the next free
number. Say which in the commit)*: "§116 Am. 1, made literal for a §12-capped runner." The text must state:

- the four rules above;
- that §2 Am. 1's capped bounceback is withdrawn and must not be cited;
- the measured before/after from this note;
- that the healthy ramp's carried line is unchanged by this amendment.

**Config:** no new numeric. Reuse:

- `INJURY_WEEKLY_INCREASE_CAP_PCT` (5)
- `INJURY_RECOVERY_WEEK_VOLUME_PCT` (85)
- `INJURY_BOUNCEBACK_MIN_DELOAD_PCT` (85)
- `BASE_BUILD_ONRAMP_DELOAD_FREQUENCY` (4)

The low-volume "climb by at least one rounding step" floor in attempt 1 is the `floor1dp` unit, not a coaching numeric.
Keep it, cite `floor1dp`, and do not let it raise a **bounceback** above pre-deload.

**Single owner (Amendment 1).** In `lib/plan/deloadCadence.ts`, beside `deloadVolumeFraction`:

- `injuryBouncebackMayReturnToPreDeload(): boolean` reads the 85/85 gate;
- `buildWeekCeilingKm({ prevKm, preDeloadKm, prevWasDeload, allowancePct, injuryCapPct })` returns the **unrounded**
  ceiling: the cap applied to `prevKm`; after a deload it is raised to `preDeloadKm` (healthy, or injury while the gate
  holds) or to `min(preDeloadKm, prevKm × (1+cap))` (injury, gate withdrawn).

Callers:

- `buildVolumeSequence` pass 2 calls it and keeps its own `Math.round`.
- `onRampCurve`'s injury branch calls it and keeps `floor1dp`.

The race-engine change must be **byte-identical**: `npm run verify:parity` IDENTICAL, `cohort:shape` unchanged. If it is
not, ship the ramp half alone and record the race-engine migration as a B0 step.

**Profile.** `rampProfileFor(input)` reads `hasVolumeCappedInjuryHistory` and is **required** at every
`onRampCurve` / `onRampWeeksNeeded` call site, with no default. That is attempt 1's plumbing, kept. Eight call sites:

- `stagedRacePlan.ts` ×3
- `assessOnRamp`
- `generateBaseBuildPlan`
- `getRunningPlan`
- `walkRunStart`
- `runWalkApplies`

`generateBaseBuildPlan` stamps `meta.onramp_profile`, so a validator can read the profile without the input.

**Invariant (Amendment 2): `INV-PLAN-ONRAMP-CURVE-CLIMBS`** (`baseBuildValidate.ts`). `validateBaseBuildBlock` takes
`volumeCappedInjury` as a **required** option, from `meta.onramp_profile`.

- **Arm 1, amended.** Consecutive non-deload weeks climb strictly. For an injury ramp, the first build week after a
  deload may **equal** its pre-deload week (`>=`). Measured: 0 plans under A, 320 under L and under B90.
- **Arm 3, new (injury ramps), error.** No ordinary week exceeds `prev × 1.05 + 0.1 km`, and no bounceback exceeds its
  pre-deload week. Delivered, under A: worst ordinary +5.0%, worst bounceback vs pre-deload 0.0%. Today's code fails it
  on 425 of 425 grid plans.
- **Arm 4, new (injury ramps).** Each pre-deload week is strictly above the previous pre-deload week ("stuck is not").
  **Not measured.** The build must measure it on the hf2 grid and the envelope: 0 under A, and > 0 under L. Severity is
  `error` if A is clean on delivered `weekly_km`; otherwise `warn`, with the count stated.

**Row** in `docs/canonical/plan-invariants.md` amended to match.

**Tests.** Start from `onRampInjuryProfile.test.ts.attempt1`, rewritten for rule 3. The bounceback **equals**
pre-deload; it is not ≤ deload × 1.05. Add:

- a falsification that restores attempt 1's capped bounceback and goes red on arm 4 and on a "net climb" case;
- a falsification that restores the carried line and goes red on arm 3;
- a falsification that sets `INJURY_RECOVERY_WEEK_VOLUME_PCT` to 80 and checks the ramp's bounceback becomes 5%-capped
  (the shared gate reaching both callers).

**Gates to report in the commit:** the C1 grid diff (0 flips, 0 healthy/other-injury changed, `reaches_door` true→false
by cohort), the envelope staged counts, `verify:parity` result, and an explicit "`measure:fitness` / `cohort:shape`
cannot see ramps".

---

## 7. What this does not prove

- It does not prove the +37% median ramp build is enough for the race block. No harness measures post-ramp readiness.
- The delivered deload divergence remains: 68 of 756 ramp deloads under A are delivered below 80% of the prior week.
  Placement is untouched.
- Masters cadence on the ramp is unexamined for the injury × masters cell (Sims).
- Arm 4 is specified and **not measured**.
- Production: not measured. New plans only.

Sitting artifacts:

- `scratchpad/hf2x-evidence/`
- `scratchpad/hf2-variants.patch`
- `scratchpad/hotfix2-attempt1.patch`
