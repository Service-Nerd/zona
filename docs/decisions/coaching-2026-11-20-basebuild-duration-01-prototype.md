# Coaching Board — `BASEBUILD-DURATION-01` · 2026-11-20 · prototype sitting · 🟢 CORRECT WITH AMENDMENT

**Input:** founder instruction, 2026-11-20: *"Yes prototype the engine builds. I want all coach engine items in a ready
state to build."* This follows the morning's NOT READY note (`coaching-2026-11-20-basebuild-duration-01.md`), which
named the missing evidence: a branch-only prototype of `b85d3e4f`'s three reusable parts on `HEAD`, plus a candidate
predicate for the fourth `assessOnRamp` outcome, swept with blocked days and absent budgets varied, with Willy's
served→refused / refused→served counts, the envelope delta, and the four live inputs as a reachability anchor.

## The question

When the runner's stated weekday budget cannot carry a climbing block, should the engine still offer one, and if not,
**which runners does it stop serving?** The board could not rule without that count. Today's ramp has no durations, so
the cap never binds and nothing in the tree can say which runners would get a flat ramp.

## Prototype

Branch **`proto/basebuild-duration-01` @ `302a5e18`**, worktree
`/Users/russe/rts-training-hub/.claude/worktrees/agent-ab1d49796b2958be7`. **Not merged, not pushed.**

A module seam, `__setBaseBuildDurationProto` in `lib/plan/baseBuildOnRamp.ts`, defaults to OFF. When OFF, the code is
byte-identical to HEAD. It reaches every producer of a base-build plan: get-running, staged, the staged checkpoint
search, and the walk-run composition.

| variant | what it does |
|---|---|
| **base** | HEAD |
| **A** | `b85d3e4f`'s three parts on HEAD: (1) thread `vdotFor` + `buildPaceFromVDOT`, so sessions carry `duration_mins` and §82's cap binds; (2) `spreadDays`' existing `prefer` = days the weekday cap does not govern; (3) `weekly_km` / `base_build_target_km` restated from the PLACED sessions |
| **C** | A, plus uncapped easy days keep what the water-fill gives them, so they absorb volume shed by capped days |
| **A_gated / C_gated** | the fourth outcome with predicate 1: a ramp failing `INV-PLAN-ONRAMP-CURVE-CLIMBS` on placed volume is not offered. A staged runner falls back to the refusal's §118 offer, gated the same way |
| **A + never-climbs** | the fourth outcome with predicate 2: not offered only if the placed final build week is ≤ placed week 1 |

**Corpus.** 28,800 inputs, wizard-shaped (`user_declared_level`, never `fitness_level`; full-name blocked days;
undated benchmarks so §10's clock cannot age them). Axes: distance {5, 10, 21.1, 42.2} × weekly km {3, 5, 8, 10, 12, 15}
× longest run {short, 0.6×} × runway {12, 20, 26, 36 wk} × **10 day sets**: weekend blocked none / one / both,
including the exact sets of all 4 live plans × **cap {absent, 20, 30, 45, 60}** × benchmark {absent, 5K 30:00,
5K 38:00}. Stride **7**, coprime to 28,800, gives **4,115 sampled**. Production sequence: `runEngine` unprompted, then
if a refusal carries a `get_running` offer, `runEngine` with `acceptBaseBuild`. **1,081** inputs reach the base-build
path (826 staged, 152 accepted, 103 refused with no offer). **978 base-build plans.**

```
npx tsx scripts/proto-basebuild-duration-sweep.ts 7 --live <live.json> --detail
npx tsx scripts/proto-basebuild-duration-sweep.ts 28799 --envelope
npx tsx scripts/proto-basebuild-duration-live.ts <live.json>      # read-only SELECT on plans
```

## Evidence (all run on the branch)

### The item's own figures, 978 base-build plans

| | base | A | C |
|---|---|---|---|
| sessions with no `duration_mins` | 17,619 / 17,619 (100%) | 6,329 / 17,615 (35.9%; no benchmark, so §122 declines) | same as A |
| weekday sessions over the stated cap (minutes at the runner's easy pace) | **1,839 / 7,029 (26.2%)** | **64 / 6,287 (1.0%)**: 15 are §82 floor-held, 49 not classified | 64 / 6,287 |
| plans whose stored `weekly_km` overstates the placed sessions | 0 | 0 | 0 |
| plans failing `INV-PLAN-ONRAMP-CURVE-CLIMBS` | 0 | **33 (3.4%)** | 39 |
| other new base-build validator errors | — | none | **`INV-PLAN-ONRAMP-PER-RUN-STEP` on 41** |
| plans with a multi-run week whose longest run is > 60% of the week (§52) | 0 | **20** | 41 |
| endpoint reduced, paired (819) | — | 105; median 0.0%, worst −85.9% | 91; worst −85.9% |

⚠️ **26.2% is not the item's 46.3%.** The item does not name the grid its figure came from. This grid includes cap
60 and absent-benchmark rows. Both figures say the same thing: the uncapped ramp overruns the stated budget routinely.

### The 33 climbs failures under A, by shape

- **9 never climb** (final build week ≤ week 1).
- **5 climb, then hold** at the budget's ceiling.
- **19 dip**: a post-deload week lands at or below the pre-deload week, because both sit on the budget's ceiling.
- **The budget held every flat week in all 33.** 32 show it directly: placed volume < the uncapped curve's week. The
  33rd is a pairing artefact: under A, the staged ramp went from 6 to 4 weeks. Against its own curve
  (`onRampCurve(8,4)` = 8, 8.8, 9.6, **10.6**, run) its flat week 9 is budget-held.
- **6 of 33 end below the runner's declared weekly km.** Worst: 15 km/week, 3 days, weekend blocked, 20-min cap →
  **6 km/week for 12 weeks** (3 × 2 km, 16 min). The input is incoherent: 3 × 20 min cannot hold 15 km at that pace.

### Willy's condition: served→refused AND refused→served, named, of 1,081

| | served→refused | refused→served | who |
|---|---|---|---|
| A, C (no gate) | 0 | 0 | — |
| **Predicate 1: fails CURVE-CLIMBS** (A_gated) | **32** | 0 | **benchmark present 32/32, cap present 32/32 (cap 20: 19 · 30: 6 · 45: 4 · 60: 3)**; weekend blocked both 18, one 13, none 1; days 3: 15 · 4: 8 · 5: 9 |
| Predicate 1 on C (C_gated) | 38 | 0 | similar |
| **Predicate 2: never climbs** (A) | **8 (0.7%)** | 0 | **all 8: 3 days, both weekend days blocked, benchmark present**; caps 20 ×5, 30 ×2, 45 ×1; 21.1 ×4, 42.2 ×4; weekly km 3 ×3, 5, 12, 15 ×3 |

**Refused→served is 0 by construction in every variant**: the outcome only removes offers. The staged checkpoint search
did move under A without changing anyone's route.

### §117's door: a consumer that still speaks for the curve

Staged plans whose `reaches_door: true` while the **placed** final week is below `door_km`: **base 41 → A 67 → C 53**,
out of 552 claiming the door. `reaches_door` stayed identical (lost 0, gained 0, of 667 paired) because it is computed
from the curve. That is one of the five consumers the item lists. ⚠️ **41 at baseline is a pre-existing gap, not this
change**. It is observed and not filed.

### Envelope (`review:coaching` step 4, stride 29, staging on)

**Whole product 94.6% → 94.6%; every distance unchanged.** Under A, the predicate reaches **0 of 115** envelope
base-build plans. This holds **by construction**: no envelope case carries a benchmark, a weekday cap or a blocked day.
**The envelope cannot see this cohort.** Its unchanged rate is not evidence that the outcome is safe.

### Reachability anchor: the 4 live base-build inputs, replayed at plan start 2026-11-23

All 4 route to staged here. **The predicate fires on 0 of 4 under every variant.**

- `3df045d5` (benchmark, cap 45, Sunday blocked): durations 0/27 → 27/27; over cap 0/21 base, 0/18 A; endpoint 21.2 unchanged.
- `016232f1` (benchmark, no cap): durations 0/20 → 20/20; nothing to cap.
- `2505666d` (no benchmark, no cap): unchanged, 7/7 without duration.
- `812e7e2e` (**cap 45, no benchmark**): unchanged, 4/4 without duration. **Its stated cap still cannot bind under
  A**, because §122 declines without a pace.

---

## 🔍 Conflict scan (amendments read, not headings)

- **§116 Am. 8** (*"must still be a good eleven weeks"*): option A alone breaches it for the 33. Predicate 1 refuses
  plans that climb then hold, which Am. 8 does not forbid.
- **§116 Am. 7** (the handover is not a dip): unaffected. 0 of 33 end below week 1.
- **§116 Am. 12** (per-run step is a ratio, §45): option C breaches it on 41 plans. **C is ruled out on this alone.**
- **§122 + Am. 1**: A closes §122 for the ramp wherever a pace is derivable. The long run stays uncapped by design.
- **§82 Am. 2**: the held run applies unchanged; 15 floor-held overruns remain.
- **§52** (60% long-run share): A raises it from 0 to 20 plans. The item already named this consumer. **It must be
  addressed in the build, not after.**
- **§117 / §118 Am. 4** (the door and its promise): `reaches_door` reads the curve, and the placed-below-door count
  rises 41 → 67. SLT 2026-09-20: *"when it does not happen, the runner concludes you lied."*
- **§118 + NO-RUNNER-TURNED-AWAY-01** (*"we can't just say no, go away"*): a fourth outcome that refuses collides with
  this founder directive. Who is served is not this board's to price.
- **§106 / `INV-PLAN-NOT-DETRAINING` vs §18** (the stated budget): 6 runners are cut below their declared volume.
- **`BASEBUILD-NO-LONG-RUN-01`** (prototyped in parallel on the same producer): see C3, below.

## Seats

🏃 **Hutchinson (chair).** "The morning's question was 'who does it refuse?', and now there is an answer: 8 runners
in 1,081 on the narrow predicate, 32 on the wide one. The wide predicate is the one the morning note named, and it is
wrong. It refuses 24 runners whose block climbs to what their week allows and then holds. All 33 flat weeks are
explained by the stated budget. A plan that holds at the runner's own ceiling has reached its ceiling; it has not
failed. The never-climbs cohort is different in kind. Every one of them has 3 days and the whole weekend blocked, so
every session is a capped weekday run and nothing can rise."

📊 **Seiler.** No objection from this seat. Every variant is all easy, and the change does not touch intensity
distribution.

🎯 **McMillan.** "This is what happens to a real Tuesday. A 20-minute budget is 20 minutes. The 15 km/week runner who
says they have three 20-minute weekdays is either wrong about the 15 or wrong about the 20. The plan has to believe one
of them, and the stated time is the one they will live by. But tell them. A flat block with no explanation reads as a
broken app. Option C is a coach trying to sneak volume back in on the weekend, and the per-run-step failures show what
that costs. No."

🩹 **Willy.** "My condition is discharged: 8 out, 0 in, named. No served runner gains load from A. The weekly peak
falls or holds, the per-run step is clean under A, and C breaches it 41 times, so C is the injury-vector option. My
binding conditions: §52's long-run share (0 → 20) is fixed in the same build, because a capped easy day leaves the
uncapped long run a larger share. And the climbs check may exempt a held week **only where the plan itself proves the
budget held it**. A producer stamp the checker trusts is self-certification."

⚕️ **Sims.** "The time a woman with a caregiving load states is the truth about her week. Option A is the first version
that respects it. Whatever the 8 receive, it is not a flat block labelled 'base building'. And the decline path still
leaves `812e7e2e` with a stated 45-minute limit that cannot bind for want of a benchmark. That is the same runner the
fix exists for, still unprotected."

💪 **Blagrove.** No strength content. Silent.

## ⚡ Recorded disagreements

- **Hutchinson vs McMillan, on the 6 runners cut below their declared volume.** Hutchinson: the block must say it is
  holding below what they say they run (§106's spirit). McMillan: the budget wins and a note is enough; he would not
  gate on it. **Settled for now by both:** a stated note, no gate. Hutchinson would revisit if live data shows the cut
  is a declaration error rather than a real budget.
- **Willy vs the morning framing, on refusal vs hold for the 8.** Willy would rather serve the honest flat block, with
  the levers named, than refuse. Hutchinson rules that a block that never climbs may not be presented as a base-building
  ramp (§116 Am. 8). **What replaces it is escalated to the SLT and founder.**

## ⚖️ Ruling: CORRECT WITH AMENDMENT

1. **Build option A** (all three parts of `b85d3e4f`) on HEAD. **Option C is INCORRECT (veto)**: +41
   `INV-PLAN-ONRAMP-PER-RUN-STEP` (§116 Am. 12), §52 breaches double (20 → 41), and more flat ramps (39 vs 33).
2. **The fourth outcome uses predicate 2, not predicate 1.** `OnRampOutcome` gains **`'budget_cannot_climb'`**,
   meaning the placed block's final build week is ≤ its placed week 1. Measured: 8 of 1,081 (0.7%).
3. **§116 Amendment 13: a ramp may hold at the runner's stated budget.** A build week that does not exceed the
   previous one is lawful only if the budget provably held it. The check recomputes this from the plan and the input:
   the week carries at least one weekday run at the day's limit (`duration_mins` ≥ cap − 1) or one `floor_protected`
   run. The block as a whole must still climb (end > week 1). Under this amendment all 33 of A's failures pass
   except the 9 never-climbs plans, which outcome 2 removes (8 runners, because one staged runner falls back to a get-running ramp that does climb).
4. **A held week says so.** The runner sees that the week is held at their weekday time, using the existing overrun or
   volume note mechanism, not new copy. Copy is the founder's.
5. **The curve's consumers read placed volume in the same build** (Willy, binding): `endsAtKm`, `door_km` /
   `reaches_door`, and §52's long-run share. Gate: placed-below-door with `reaches_door: true` must not rise above
   baseline (41 on this grid), and §52 > 60% must return to 0.

## 📦 Build spec (artifacts)

1. **Principle:** §116 **Amendment 13** (*"the ramp is sized in the runner's own time; it may hold at their stated
   budget, and a block that cannot climb at all is not offered as one"*). Re-applies the vacated Am. 12 *intent* from
   `b85d3e4f`, which became the 11-15 per-run-step amendment's number. Assign a fresh number.
2. **Numeric:** `ONRAMP_DELIVERED_DRIFT_TOLERANCE_PCT` = **2** (re-applied from `b85d3e4f`, for restating placed
   volume). **No new numeric for the outcome:** "end ≤ week 1" is arithmetic. The held-week test's "cap − 1" is minute
   rounding (`Math.round`), not a coaching choice. State that in the principle.
3. **Invariants:** `INV-PLAN-ONRAMP-DELIVERED-MATCHES` (re-applied) · `INV-PLAN-ONRAMP-CURVE-CLIMBS` **amended** with
   the budget-held exemption, recomputed and never stamp-trusted · `INV-PLAN-ONRAMP-LR-SHARE` **or** the existing §52
   check widened to base-build weeks (builder's choice; Willy's condition is the 0) · plan-invariants.md rows.
4. **Engine:** the `assessOnRamp` outcome is evaluated where a ramp is generated (get-running, staged, accepted). On a
   staged failure the engine falls back to the §118 offer, gated the same way.

## Conditions

- **C1 (Willy).** Re-run this sweep on the build. Served→refused must be ≤ 8 of 1,081 at stride 7, and must name the
  cohort.
- **C2 (Willy).** §52 > 60% in base-build weeks = 0. Placed-below-door ≤ baseline.
- **C3 (chair). Sequencing with `BASEBUILD-NO-LONG-RUN-01`.** That item's ruling must land first or in the same build.
  The 8 refused are all 3-day blocks with no long run (below `FOUNDATION_MIN_SESSIONS_FOR_LONG_RUN`). A long run that
  is §122 Am. 1-exempt from the cap would land on a weekday for them, could let their block climb, and would re-open an
  uncapped weekday session. **The outcome's cohort must be re-measured after that change.**
- **C4.** `verify:parity` on the build will show changed BASE_BUILD outcomes only. Declare the count.

## ↗️ SLT / founder escalation (Hutchinson carries)

**What do the 8 receive?** The outcome is decided: no climbing block is offered. The options are a refusal that names
the two levers (more weekday minutes, or a weekend day) or a declared hold plan. NO-RUNNER-TURNED-AWAY-01 is the
founder's, and the copy is the founder's. ⚠️ **The envelope cannot price this**: it has no cap, benchmark or blocked
day, so it reads 94.6% → 94.6% by construction.

## What this does not prove

- **`measure:fitness` and `cohort:shape` were not run.** Neither covers raceless base-build plans (§118: *"no harness
  watches this plan kind"*), and the morning note's conditions did not name them.
- **Rates are this grid's, not production's.** 4 live plans; the predicate reaches 0 of them.
- **The 49 non-floor-held over-cap weekday sessions under A were not classified.** The likely cause is weekday long
  runs, exempt under §122 Am. 1, for weekend-blocked runners. That is not measured.
- **Runners with no benchmark are untouched by A.** §122 declines without a pace. `812e7e2e`'s cap still cannot bind.
- **The Adjust-sheet path** (`acceptBaseBuild` at any edited volume, `BASEBUILD-NO-LONG-RUN-01`'s space) was swept
  only to 15 km/week.
- **The amended climbs check was measured by comparing against the uncapped curve**, not by implementing the
  "at the day's limit" recomputation. The build must falsify it: make a held week go red by lifting the cap.

**Observed, not filed:**
- `reaches_door: true` with the placed final week below `door_km` on 41 of 552 staged plans at **HEAD** (curve vs
  placement, before any change).
- The race engine duration-anchors beginners with no benchmark (CLAUDE.md, SESSION-KM), while the ramp declines for
  the same runner. Two answers to "is a pace derivable?"
