# MKT-PLAN-SHAPE-01 — I1–I10, what shipped and what conflicts

**Date:** 2026-09-21
**Source:** the coaching-logic audit of the nine published `/plans/*` pages
**Status:** four defects fixed; six proposed invariants conflict with ratified
doctrine and need a founder decision. **Nothing below was silently compromised** —
every deviation is named, measured, and attributed to the principle it collides with.

---

## 1. What was wrong, and the one cause behind most of it

**P0-A, P0-B and P1-B are a single defect.** `applyV1VolumeQualityStimulusSplit`
holds a week flat when it introduces the plan's first quality session — Willy's
gate on CD-16, *"intensity and volume do not progress in the same week"*. It
compared that week against `weeks[triggerIdx - 1]`.

On **7 of the 9 published plans** the week before the first quality session is the
base phase's **recovery week**. So "hold volume flat" meant "hold at 70% of what
the runner was already running" — a 38% cut, on the exact week the plan tells the
runner the hard work begins. `reanchorWeekAfterTrim` then correctly ramps the rest
of the block from the delivered value, so one wrong reference propagated through
build and peak:

```
half-marathon-12-week
  curve   39 42 46 32R 46 51 52 52 52 40 29
  before  37 41 45 28R 28 31 34 37 41 32 26   ← peak 41 km. Base week 3 was 45.
  after   37 41 45 28R 41 48 49 50 51 40 30
```

The published half-marathon plan **peaked in week 3, in the base phase**, and spent
nine weeks getting back. §2's own remedy was already written and implemented one
function away — `buildVolumeSequence` exempts a post-deload bounceback because
*"returning to a volume held two weeks ago is not a spike"*. V1 is a second
producer of that rule and never learned the exemption. Two writers of one fact,
drifting: the fault `DELOAD-OWNER-01` and `SESSION-KM-01` both exist to remove,
found a third time.

Fix: V1 measures against the last **loading** week. Defect fix restoring documented
intent, so ADR-017-exempt from the Coaching Board.

**Reach:** V1 fires on **60.4% → 31.8%** of cohort plans. Population effect is
small (`cohort:shape` moves nothing by more than 0.1pp; `measure:fitness`
unchanged) because where V1 fires mid-plan the trim is usually minor — it is the
post-deload case that was catastrophic.

---

## 2. Fixed

| # | Finding | Fix |
|---|---|---|
| **P0-A** | Build restarts at the recovery week's volume (7 of 9 plans) | V1 anchors on the last loading week |
| **P0-B** | Half-marathon peak (41 km) below base (45 km) | same |
| **P1-B** | Recovery weeks 3–9% below the weeks they recover from | same — they were flat because *build* was too low |
| **P1-C** (duration half) | `Marathon-pace long run · 29 km · 192 min` = 6:37/km, priced entirely at easy pace while its own note prescribes 5:40/km | `applyRacePaceSegmentDuration` prices each segment at the pace it prescribes. All five segmented long runs were overstated by 6–9%. Display arithmetic (ADR-015), not prescription |
| **D1** | Race week `weekly_km` includes the race, so it reads as the biggest week of the taper (half: 36 km against a taper of 41 → 32 → 26) | `lib/plan/weekVolume.ts` is a shared owner; the page renders `15 km + race`. `weekly_km` semantics are **unchanged** — ~40 call sites depend on them |
| **D2** | `MARATHON-pace reps` — an enum value leaking into runner-facing copy | `raceDistanceDisplayName` in `lib/format.ts` |

Regression gates shipped in the same commit: `lib/plan/marketingPlanShape.test.ts`
(inside `npm run verify`), with four falsification cases that reconstruct P0-A,
P0-B, P1-B and P1-A as hand-built plans and assert the checker catches each.
**One of those cases immediately found a bug in the checker itself** — the I4
injury carve read only the config constant, which is constant, so the
too-shallow arm never gated for anyone.

Sweep after the fixes: **14,253 plans, 0 hard failures, no new violations above
baseline.**

---

## 3. Ruled on by the Coaching Board

**P1-A — a recovery week in week 2** (`sub-4-hour-marathon-plan`: deloads at
2, 6, 10). Ratified as **§119** — a loading block is never one week, including the
plan's first. `MIN_LOADING_BLOCK_WEEKS = 2`, `INV-PLAN-MIN-LOADING-BLOCK` (`warn`).

Measured: **1,131 of 4,406** cohort plans (26.3%) and **2,048 of 6,144** targeted
(33.3%) carry a one-week loading block, and **every single one is the plan's
opening block**. Mid-plan: zero. §95's own remedy produces it and the
backward-normalisation pass parks it at the front.

**The producer change is filed, not taken.** Raising the floor greedily moves the
18-week marathon to `[4,8,12]`, which trades the week-2 deload for a peak phase
that never exceeds build. All 220 placements were brute-forced: **0 satisfy the
full constraint set**; exactly two (`[3,6,9]`, `[3,6,10]`) satisfy everything
except a *three*-week minimum, and neither is reachable by §87's greedy
forward-walk. The fix is a search. Filed as `DELOAD-PLAN-OPENING-01`.

---

## 4. ⚠️ Conflicts — these need your decision

Each is implemented exactly as the brief wrote it, measured on the nine plans,
and reported as **advisory** rather than gating, because gating it would overrule
a ratified decision. The audit prints all of them on every run.

### I1 — loading-week progression ≤ 10% or +3 km · **22 findings**

**This rule already exists.** It is `INV-PLAN-DELIVERED-RAMP` (§94), and it is
`warn` **by board ruling**. §94 names the producer change and declines it: *"it
would lower delivered peak volume — the tonnage ceiling §79 and §89 explicitly
protect — and no measurement yet says by how much."*

| | I1 as written | INV-PLAN-DELIVERED-RAMP |
|---|---|---|
| threshold | > 10%, or +3 km | > 20% (10% cap + 10pp rounding tolerance) **and** > 3 km |
| chronic-load gate | none | binds only above `current_weekly_km` |
| post-deload pair | compared to the last **loading** week | skipped entirely (§2's bounceback exemption) |
| severity | build-failing | `warn` |
| **fires on the nine** | **22** | **6** |

The whole 22-vs-6 gap is those three gates. `weekly_km` is an **integer**, so
37 → 41 reads +10.8% where the curve it came from read +7.7%.

> **Decision needed:** promote §94's `warn` to an error? That is a producer
> change the board declined once, on measurement.

⚠️ **One I1 finding is NOT §94's residual and is a real, separate defect:** the
5K plan steps **18 → 18 → 26 km (+44%)** at week 3. Cause: the week-1/2 long-run
cap (`longest_recent_run_km × multiplier`) holds the long run at 5.5 km, and §9's
long-vs-easy ratio then drags every easy run down to the 4 km floor with it,
costing the week 4–6 km against its curve. The cap lifts in week 3 and the whole
week jumps at once. **Fixing it means ramping that cap rather than cliff-edging
it — a prescription change, so a board item.** Filed as `WEEK12-LR-CAP-CLIFF-01`.

### I2 / I6 — resume after recovery · easy-run continuity · **1 + 3 findings**

Mostly correct and now gating. **Stated deviation:** on the 12-week plans the peak
phase *opens* on §47's step-back week, so the first loading week after the last
deload is deliberately reduced. The test therefore moves **one week** — the plan
must resume within the block, not necessarily in the very next week. Not waived:
if the following week also fails, it still fires.

§47's ordering was confirmed deliberate and recent (`LONG-RUNWAY-EARNS-PLAN-01`,
2026-09-16, which replaced an `offset % 2` parity that broke on three-week peak
phases). The remaining I2 advisory is the upper half — "no higher than
pre-deload" — which §2 Amendment 1 deliberately leaves **unbounded** for healthy
runners; a ceiling there was built, measured (+50pp "constrained by inputs", zero
safety benefit) and rejected on 2026-09-06.

### I3 — "loading weeks non-decreasing within each block" · **18 findings**

The first half ("peak ≥ base and build") **gates** and is clean. The second half
conflicts with **§47**: peak long runs alternate step-back / peak-level by design,
and `applyPeakStepBackVolume` lowers the step-back week's volume with them.

### I4 — recovery 20–35% below the preceding loading week · **5 findings**

The **too-shallow** direction gates (that was P1-B). The **too-deep** direction is
advisory: §3's 70% is applied to the volume **curve**, and the delivered deload
lands at ~62% because session floors bite harder on a smaller week — the identical
asymmetry §3's own `LR-DELOAD-CUT-01` amendment documents for the long run one
level up. Enforcing §3 at delivery is ADR-022's territory, and ADR-022 scoped
itself to injury-history runners on purpose.

> Also: `INJURY_RECOVERY_WEEK_VOLUME_PCT = 85` is a **15%** cut, below I4's 20%
> floor **by ratified design** (§2 Amendment 2, with Willy's mechanical condition).
> I4 as written fails every injury plan.

### I5 — first recovery no earlier than week 4 · **1 finding**

**Provably unsatisfiable.** See §3 above: 0 of 220 placements. It also fails every
masters plan by construction — §3's 3:1 cadence puts the first recovery on week 3
with two loading weeks before it. Its intent is ratified as §119 with a **two**-week
floor, which is satisfiable.

### I7a — anything faster than Z2 is `quality`, never `easy` · **5 findings**

**Conflicts with ADR-018, §9 and §52.** A long run carries `type: 'easy'` *by
design*, so §9's long-vs-easy ratio, §52's share cap and §1's session-count
denominator treat it as the aerobic volume it mostly is. Re-typing it moves it into
§8's count ceiling, §7's hard/easy spacing and §1's numerator simultaneously, and
breaks `getSessionColor`. The five sessions are 35–50% at race pace and 50–65% easy.

The **duration** half of the same finding had no conflict and is fixed (P1-C above).

> ⚠️ **Correction to the brief's arithmetic.** It reads *"192 min / 29 km =
> 6:37/km, i.e. easy pace… label and duration disagree"*, implying the whole run
> is prescribed at marathon pace. It is **40%** (§25's ceiling, ratified). The
> honest duration is **181 min, not ~136** — the overstatement was 6%, not 40%.

### I8 — max 1 quality/week on 4 days, 2 on 5 · **4 findings**

**Conflicts with §8**, where the ceiling is `QUALITY_SESSIONS_PER_WEEK_MAX` by
**fitness level** (beginner 0 or 1, intermediate 2, experienced 2) — a spec value
the board already overrode once, from 3 to 2, and deliberately not a function of
day count. The four findings are all "structured session + race-pace long run in
the same week", which only counts as two under I7a's re-typing.

The spacing half ("≥1 easy day between") has no conflict and **gates**.

### I9 — taper: 5K/10K 2 weeks, half 2, marathon 3 · **4 findings**

5K/10K already match. Half (3) and marathon (4) **conflict with §49**, whose own
comment records the opposite ruling: *"Round-2 Case 04 review found a 4-week
marathon taper detrains and compresses the build. The cap below holds marathon at
3 actual taper weeks (4 entries)."* The engine matches its config exactly.

> The separable part of P2-A — "phase labels don't match behaviour" — is real and
> is §47's step-back opening the peak phase. See I3.

### I10 — easy share ≥ 80% by time · **0 findings, clean**

Measured post-fix, **90.9%–96.2%**. See §5.

---

## 5. Easy share by time, post-fix — the carousel number

⚠️ **Read the definition before quoting it.** "Easy" is *prescribed at or below
Zone 2*, in minutes, across every session of every week including race week. A
quality session contributes its warm-up and cool-down to the easy side and its
main set to the hard side (`sessionSplit`, §16). A long run with a race-pace
finish contributes that segment to the hard side.

**This is not §1's number.** §1's ceiling is a ratio of *session counts* and says
nothing about minutes. The two will not agree.

| plan | easy share by time |
|---|---|
| sub-45-10k-plan | **91.5%** |
| sub-50-10k-plan | **91.6%** |
| sub-2-hour-half-marathon-plan | **92.2%** |
| sub-25-5k-plan | **92.9%** |
| 5k-12-week | **93.1%** |
| 10k-12-week | **94.1%** |
| sub-4-hour-marathon-plan | **94.4%** |
| half-marathon-12-week | **94.6%** |
| marathon-16-week | **96.2%** |

The brief expected these to be inflated by the mistyped long runs. They were — by
about **1pp**. Every plan cleared 80% before the fix as well.

---

## 6. What this does NOT prove

- The gate covers the **gating** findings only. 67 advisory findings across the
  nine plans are measured on every run and do not fail the build. A green run
  means *no new shape defect*, **not** "the nine plans satisfy I1–I10 as written".
  They do not, and §4 is why.
- `checkPlanShape` runs on the nine marketing plans and on hand-built fixtures.
  `INV-PLAN-MIN-LOADING-BLOCK` runs inside `validatePlan()` on **every** generated
  plan, in-app included. The other nine I-rules are **not** in `validatePlan()` —
  they are not yet ratified principles, so the in-app generator is covered for
  §119 and for everything `validatePlan` already checked, and not for I1–I10.
- Population claims come from a **1-in-9 coprime stride** over `cohortGrid`
  (4,406 of 41,472) plus the full `targetedGrid` (6,144). The cohort grid does not
  vary injury history; the targeted grid is entirely age 40.
- Nothing here has run on a device.
