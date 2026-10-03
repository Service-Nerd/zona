# 2026-10-03 — the weekday cap: a third engine exemption the validator never learned

**Status:** RCA complete, no code changed. `/build` input.
**Reported by:** the daily ops digest, 2026-10-03 07:10.
**Severity:** systemic. Two live runners confirmed; 66.7% of a 105-plan sweep at a
30-minute cap. Both affected runners are in the Make-A-Wish intake window.

---

## The grid

| | |
|---|---|
| **Symptom** | `INV-PLAN-MAX-WEEKDAY-MINS` fires at **error** severity on two live paid marathon plans — 19 violations on `c848fd4c`, 46 on `4b037d2c`. |
| **Surfaces** | `validatePlan()` at generation · `ops_events.plan_rule_invalid` · the digest's Q4. **Not** the plan audit — there are no `source: plan-audit` rows for either user. |
| **Expected** | A weekday session never exceeds that day's stated cap, or the overrun is a declared, ratified exemption. |
| **Actual** | Every firing is a §82 floor-protected easy run the engine **deliberately** held over the cap and stamped `floor_protected: true`. The validator does not know that exemption exists. |
| **Repro** | Exact. `generateRulePlan(storedInput, 'paid', '2026-10-02')` reproduces **19** and **46** violations — matching the live `ops_events` code counts cell for cell. |
| **Since** | §82 shipped 2026-09-03 (Coaching Board). The mismatch has existed since that day. |

---

## Step 2 — which side is correct?

**The engine.** §82 is a ratified Coaching Board decision (2026-09-03), argued in
`applyWeekdayMinsCap`'s own comment: scaling an easy run to a 30-minute cap can drive
it below `MIN_SESSION_DISTANCE_KM.easy`, and *"the stated weekday cap is exceeded by a
few minutes, not honoured by a session that trains nothing."*

**The validator is the defect.** `invariants.ts:~2121` exempts `isLongRun ||
isStructuredSession` — §81's two — and nothing for §82. So the engine produces a plan
that fails its own constitution, which is the exact failure mode the function's
neighbouring comment warns about in writing:

> *"an engine exemption the validator does not share is a plan that fails its own
> constitution."*

**§81 got that sentence. §82 was written the same day and never got the carry-across.**

---

## Step 3 — localise

`applyWeekdayMinsCap` (`lib/plan/ruleEngine.ts:3749`) has **three** ways to leave a
weekday session over its cap:

1. `isLongRun(s)` → skip (§81)
2. `isStructuredSession(s)` → skip (§81)
3. **§82 floor protection** — holds the easy run at `floorKm`, sets
   `duration_mins = round(floorKm × pace)`, stamps `floor_protected = true`

`validatePlan` knows 1 and 2. **Nobody told it about 3.**

Both sides also share a fourth, undocumented blindness: `if (!s.duration_mins)
continue`. A weekday session with no duration is trimmed by neither and checked by
neither. See § The bigger breach.

---

## Step 4 — RCA: why it survived

Two recorded classes, stacked.

**(a) The remedy was applied to one twin.** §81 and §82 were ruled the same day, in
the same function. §81's exemption was mirrored into the validator and §82's was not.
Ninth-plus instance in this repo.

**(b) The checker's population excludes the cases at risk — and this is the sharp
one.** `scripts/property-validate-plans.ts` declares
`'INV-PLAN-MAX-WEEKDAY-MINS': 0` with the comment *"Kept as an explicit 0 so a
regression reads as NEW against a stated expectation."* That zero is **true for its
grid and false for the product**, because the grid's entire `benchmarkSets` is fast
runners: `none`, 10 km in 48:30, 10 km in 49:00, HM 1:50, 50 km in 5:00.

**Measured — the gate is PACE, not the cap and not day budgets:**

| HM benchmark | plans | plans raising the error |
|---|---|---|
| 1:30:00 | 20 | **0** |
| 1:45:00 | 20 | **0** |
| 2:00:00 | 24 | **0** |
| 2:16:00 | 24 | **24 (100%)** |
| 2:30:00 | 24 | **24 (100%)** |
| 2:45:00 | 24 | **24 (100%)** |

The arithmetic: 30 minutes covers 4 km only at 7:30/km, so **every runner slower than
that trips §82's floor.** The sweep contains no such runner. A charity marathon cohort
is almost entirely such runners — both live cases are HM 2:16 and HM 2:29.

---

## 🔴 The bigger breach, and it is NOT what was reported

`foundationBlock.ts` builds pre-plan foundation weeks (`n <= 0`) setting
**`distance_km` only — never `duration_mins`** (lines 261, 273), and never applies the
weekday cap. So foundation weekday sessions are skipped by `applyWeekdayMinsCap`'s
`!s.duration_mins` guard *and* by the invariant's identical guard.

Measured on `c848fd4c`, using the plan's **own** easy pace (week 1 Monday: 4 km / 34
min = 8.50 min/km) against her stated 30-minute Monday budget:

| session | distance | implied duration | vs 30-min budget |
|---|---|---|---|
| floor-protected easy (the reported error) | 4.0 km | 34 min | **+13%** |
| foundation week −3 Monday | 6.5 km | 55 min | **+84%** |
| foundation weeks −2, −1 Monday | 7.1 km | 60 min | **+101%** |

**The invariant caught the 13% and is structurally blind to the 101%** — and the
foundation block is what she runs *first*. Not reproduced by `generateRulePlan` at any
`plan_start` (0 duration-less weekday sessions across every start tested), because it
is composed by `composePlanWithFoundation` (ADR-020), a second construction path.

---

## Claims from the prior session — verdicts

| | Claim | Verdict |
|---|---|---|
| **C1** | Every error firing is a floor-protected easy run | ✅ **CONFIRMED.** Grace 19/19, age-55 46/46, and 70/70 plans in the sweep where every firing is `floor_protected` |
| **C2** | Current build cannot produce the error; needs a day budget ≤25 | 🔴 **FALSIFIED.** Day budgets make **zero** difference: flat 30, all-30, mon-20, tue/wed/fri-25 all give exactly **46** errors. Both live plans fired at 30. The gate is pace |
| **C3** | 100% of plans ship structured sessions over cap; ~1,016 sessions, 10.6/plan, worst 59 min | ✅ **CONFIRMED, numbers close.** Measured **105/105 plans, 1,180 sessions, 11.2/plan, worst 59 min vs 30 (+97%)**. ⚠️ But **zero on `c848fd4c`** — her per-day budgets (wed 60, thu 90) hold the structured sessions. Per-day budgets fix C3 where a flat cap does not |
| **C4** | Both honesty guards are hollow — presence not content | ✅ **CONFIRMED.** `STRUCTURED-OVERRUN-DECLARED` and `EASY-FLOOR-PROTECTION-DECLARED` both fire **false** on both live inputs while the overrun is present; `volume_constraint_note` is occupied by the volume-shortfall text |
| **C5** | The note quotes the flat cap, not the per-day budget | ✅ **CONFIRMED, different shape.** Grace's note says *"more room than the 30 min you have allowed"* — she allowed **60 on Wednesday and 90 on Thursday.** The note misrepresents her input |
| **C6** | No grid can reach it; the stated 0 is over a population that cannot contain the defect | ✅ **CONFIRMED — wrong reason.** The day-budget floor at 30 (`cohortGrid.ts:229`) and `max_weekday_mins: Math.min(...)` (`property-validate-plans.ts:492`) are both real, but **irrelevant**: day budgets don't gate it. The operative gap is that **no benchmark in the sweep is slower than 7:30/km easy** |

**Also corrected:** the digest called these *plan-audit* findings. They are
**generation-time** events, and `MAX-WEEKDAY-MINS` is the **only** code in each — these
plans breach nothing else.

---

## Step 5 — fix options and blast radius

**Not my call to pick the tolerance.** Routing below.

| | Fix | Blast radius |
|---|---|---|
| **A** | Mirror §82 into the validator: skip `floor_protected === true`. Restores documented intent | Clears 19 + 46 live errors and 70/105 in the sweep. **Does not change generation** — `verify:parity` should be IDENTICAL. Requires the sweep baseline 0 to stay 0 for the right reason |
| **B** | Make the two honesty guards read **content**, not presence — a declared overrun must name the weekday overrun | Touches `volume_constraint_note`'s 8-writer precedence chain (`ruleEngine.ts:~8489`). May move `cohort:shape`'s constraint-note rate — declare it |
| **C** | Fix C5: interpolate the **per-day** budget that actually bound | Copy only. No generation change |
| **D** | Widen the sweep with a slow benchmark, and `TARGETED_DAY_BUDGETS` below 30 | Will surface the real count. The baseline 0 must become a measured number with a reason, **not** re-baselined to stay green |
| **E** | Foundation weekday sessions: give them a duration, or give the cap a distance-aware arm | 🔴 **Changes what the runner is prescribed in the weeks they run FIRST.** Coaching Board |
| **F** | C3's structured overrun: 30 → 59 min, 11.2 sessions per plan | 🔴 Coaching Board. New intent |

## Step 6 — governance routing

- **A, B, C, D — exempt.** Defect fixes restoring documented intent plus harness
  coverage. One line stating the exemption and proceed.
- **E and F — `/coaching-board`, required, before any code.** §81 exempted structured
  sessions because the cap scales the label and not `derived_set`; it did not license
  **+97%** over a stated ceiling, ten times a block. And §82 justified *"a few
  minutes"* — 34 vs 30 is a few minutes; **60 vs 30 is not**, and the board has never
  seen the foundation-week case because no harness could show it.
- Do not pick a tolerance locally. Get a number ratified, then guard the ratified number.

## Step 7 — exit criteria

1. `floor_protected` exemption mirrored, and **falsified** by removing the stamp.
2. Twin sweep for other engine exemptions the validator lacks — **state the count, including zero.**
3. Both honesty guards made content-aware and falsified.
4. Sweep widened to a slow benchmark; the new count declared, never re-baselined to green.
5. `verify:parity` IDENTICAL for A/B/C; any move in `cohort:shape` declared with a number.
6. Board ruling recorded in `coaching-rulings.md` for E/F, including a DON'T SHIP.

---

## Corrections to this RCA, found while building

**1. The validator was not ignorant of `floor_protected` — it reads it 2,200 lines away.**
`INV-PLAN-EASY-FLOOR-PROTECTION-DECLARED` (`invariants.ts:~4343`, **error** severity)
counts floor-protected weeks and obliges the plan to classify maintenance and carry a
note. So §82's *existence* was mirrored; only its status as an **exemption from the cap
check** was not. The knowledge was in the file; the check that needed it did not use it.

**2. C4 is real but milder than filed.** Both live plans *are* `volume_profile:
'maintenance'` with a note, so §82's disclosure obligation is genuinely discharged —
Grace's `volume_shortfall_note` says *"Your weekday limit of 30 min is shaping this
plan."* What no surface says is that individual **sessions overrun** the cap. The notes
report volume *reduced*, never sessions *exceeded*. That is the true gap and it is
narrower than "the guards are hollow".

**3. 🔴 The test written for §82 could not reach §82's failure.** `LOW_VOLUME_MARATHON`
in `easyRunFloorProtection.test.ts` produces **3 floor-protected sessions, all at
exactly 30 minutes** against a 30-minute cap, and the assertion is
`toBeGreaterThanOrEqual(cap)` — which passes on the boundary, while the invariant only
fires STRICTLY over. The guard for this principle sat precisely on the line it was
written to police. Third instance of the population class in this one investigation
(the other two: the sweep's fast-only benchmarks, and `cohortGrid`'s day-budget floor).

**4. My foundation-week finding is adjacent to `HARNESS-COMPOSE-GAP-01`, not covered by
it.** That item records *"four of five harnesses cannot see a foundation week"* and
states the **error-severity half is covered** — the sweep composes them and found 0
violations. That is about **reachability**. Mine is about **expressibility**: even when
the sweep composes foundation weeks, a duration-less session cannot violate the cap
check, because both sides skip on `!s.duration_mins`. Widening a harness will not
surface it; only a check that reads distance when duration is absent will. Confirmed
this run: **20,980 foundation weeks swept, 0 violations.**

---

## Wave 1 — shipped, and what it proves

| | Result |
|---|---|
| §82 mirrored into `INV-PLAN-MAX-WEEKDAY-MINS`, **justification verified** (stamp AND at-the-floor) | live plans 19 → **0** and 46 → **0** |
| Sweep given a slow benchmark (`slowHM`, HM 2:30) | `MAX-WEEKDAY-MINS` **10,096 → 0** |
| `verify:parity` vs `f7ed36f2` | ✅ **IDENTICAL, 6,066 cases, byte-for-byte** |
| Sweep | ✅ 14,265 plans, 20,980 foundation weeks, no NEW violations |

**Falsified four ways, each mutation verified as landed:** disable the arm → live counts
return exactly (19, 46) · engine stamps away from the floor → still fires · blanket skip
without the floor check → **only** the trust arm reddens · unstamped run over cap → still
fires.

**No live plan was rewritten, because none was wrong.** All 65 reported violations were
the validator misreading a ratified exemption. The plans were correct.

**Still open:** `TAPER-OVER-PEAK-SLOW-01` (P1, filed) and waves 2–3 (B/C/E/F), B/E/F
board-gated.
