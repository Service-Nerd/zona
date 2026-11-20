# Coaching Board — `BASEBUILD-DURATION-01` · 2026-11-20 · ⏸️ NOT READY (the board did not sit)

**Input:** founder instruction, 2026-11-20: *"run all the board sittings and get answers and file them in relevant
documents. Do analysis before you take each item to the board and run only 1 relevant board sitting with each item."*

**The question the item puts to the board:** the *fourth `assessOnRamp` outcome*. When the runner's stated weekday
budget cannot carry a climbing block, do not offer one. The item says this is a new refusal path, that it moves the
envelope rate, that "who gets served is a board-and-SLT number", and that *"any re-measurement must vary blocked days"*.

---

## Analysis (before any seat spoke)

### What re-derived, and what did not

| Item's figure | Today | How |
|---|---|---|
| 4 live stored plans with 51/51, 12/12, 30/30, 7/7 ramp sessions carrying no `duration_mins` | **Confirmed: 4 live `base_build` plans, 51/51 · 12/12 · 7/7 · 30/30** | `npx tsx scripts/board-evidence-basebuild-duration-01.ts` (read-only, service-role SELECT) |
| 2,406 of 5,202 base-build weekday sessions over the stated cap (46.3%), §118 8,232 sessions / 21.7% | **Not re-measured.** The item does not name the grid these came from. The figures describe the uncapped ramp, which is unchanged, so there is no reason to think they moved, but that is not a measurement | — |
| Envelope rate 94.6% (`review:coaching` step 4) | **Not re-measured.** The brief asks for `review:coaching` to be avoided unless the item needs it, and the fourth outcome does not exist to measure | — |

### What the live population looks like (new, measured)

| plan | `max_weekday_mins` | days | blocked | declared km/wk |
|---|---|---|---|---|
| `3df045d5` | 45 | 4 | mon, wed, **sun** | 10 |
| `016232f1` | **none** | 3 | mon, wed, fri, **sun** | 10 |
| `2505666d` | **none** | 4 | mon, wed, **sat** | 10 |
| `812e7e2e` | 45 | 4 | tue, thu, **sat** | 5 |

- **2 of the 4 live base-build runners stated no weekday budget**, so a gate keyed on the budget could not reach them.
- **All 4 block exactly one weekend day.** That is the interaction the item warns attempt 2's grid never varied, and it
  is the *whole* live population, not an edge of it.

### Why the evidence cannot be produced read-only

The board cannot rule on a new refusal path without the count of who it refuses. Willy's standing condition, recorded
at `WEEK1-FROM-LONGEST-RUN-01`, asks for *served → refused AND refused → served as named cohort counts*. That count
needs a **predicate**: *"the stated budget cannot carry a climbing block"*. Today the tree has no such predicate.

1. **The current ramp is uncapped by construction.** Base-build sessions carry no `duration_mins`, so nothing in the
   tree can say which runners *would* flatline. That is the item's own defect.
2. **The only code that ever produced a capped ramp is reverted** (`b85d3e4f`, reverted in `db9cc0b6`). It is
   **194 commits** behind `HEAD`. The on-ramp producers have moved since: `git diff --stat db9cc0b6 HEAD` shows
   **157 lines changed across `baseBuildOnRamp.ts`, `baseBuildValidate.ts`, `engine.ts` and `getRunningPlan.ts`**. That
   includes the get-running walk-run path (`GETRUNNING-WALKRUN-FLOOR-01`) and the per-run step now validated as a ratio
   (`ENGINE-BASEBUILD-UNVALIDATED-01`). A cohort measured on `b85d3e4f` would describe an engine that no longer exists.
3. **A hand-built capacity model would be a third approximation.** The item records that both earlier ratifying
   measurements failed because they were made on something other than the producer: the uncapped curve, then a grid
   that left `days_cannot_train` unvaried. Re-applying the three reusable parts (the threaded pace, `spreadDays`'
   `prefer`, `weekly_km` restated from placed sessions) onto `HEAD` and sweeping it **is** a prototype engine build. The
   brief forbids that here.

### Readiness gate

**Not met.** The item names the evidence it needs: who the fourth outcome refuses, by cohort, with blocked days varied,
plus the envelope-rate delta. That evidence exists only once there is a prototype. The board did not sit. Sitting
without the count would repeat the failure the item records twice: ruling on a safety bound before measuring whether
the plan still serves the runner.

---

## ⏸️ What is missing, precisely

A **prototype on a branch, never merged**, that re-applies `b85d3e4f`'s three reusable parts onto current `HEAD`, plus a
candidate predicate for the fourth outcome. The natural candidate is *"the capped, placed ramp fails
`INV-PLAN-ONRAMP-CURVE-CLIMBS`"*, which reads the record attempt 2 made honest. Then one sweep that reports:

1. **served → refused and refused → served, as named cohort counts** (Willy's condition): by distance, declared volume,
   `max_weekday_mins` (including **absent**), `days_available`, and **`days_cannot_train` with a weekend day blocked and
   with both blocked**;
2. the **envelope-rate delta** (`review:coaching` step 4) with the new outcome wired;
3. the same predicate run against the **4 live base-build inputs**, as a reachability anchor.

Then the board sits on the fourth outcome. If it rules CORRECT, the SLT prices who gets served, as the item already
routes.

## What this does not prove

- It does not say the fourth outcome is right or wrong. The board did not sit.
- It does not re-derive the item's 46.3% / 21.7% overrun figures. Their grid is unnamed.
- The live-plan table is 4 runners. It shows the predicate's reach and nothing about rates.

**Evidence script:** `scripts/board-evidence-basebuild-duration-01.ts` (read-only: one SELECT on `plans`).
