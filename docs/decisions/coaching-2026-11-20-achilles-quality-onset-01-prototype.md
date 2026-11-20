# Coaching Board: `ACHILLES-QUALITY-ONSET-01`, ruled on a prototype

**Date:** 2026-11-20 · **Chair:** Hutchinson · **Seats:** Seiler, McMillan, Willy, Sims (Blagrove silent: no strength rule touched)
**Trigger:** soft (`lib/plan/ruleEngine.ts`, prescription changes for achilles histories); filed INSUFFICIENT EVIDENCE at the §94 Am.5 sitting (2026-11-04)
**Outcome:** **CORRECT WITH AMENDMENT.** The onset week holds the **long run**, not the easy runs, for **one** week, with §100's re-anchor and a bounceback gate. The item's "hold easy volume" remedy is **INCORRECT as specified**: it is arithmetically incompatible with V1.

---

## The question the 2026-11-04 sitting could not answer

When an achilles-history runner's first quality session arrives, can the easy running be held without trimming the
quality session (Willy, binding) and without breaking §2/V1, and what does each way of doing it cost in fitness,
specificity and delivered-load checks? The sitting had no plans built either way.

## Prototype

Branch `proto/achilles-quality-onset-01` @ `42712275` in worktree
`/Users/russe/rts-training-hub/.claude/worktrees/agent-a51c2c987170f8602`. Seam `__setAchillesOnsetPrototype(option, weeks)`,
default `off`. Scope keyword `achilles` (`hasInjuryKeyword`). Options:

| option | what it does on the first N quality weeks |
|---|---|
| `hold` | easy pool floored at the previous loading week's easy km; V1's first-quality trigger skipped (otherwise V1 trims it straight back) |
| `dose` | quality dose × 0.6 / 0.8 |
| `both` | hold + dose |
| `long` | long run does not grow over the previous loading week's long run; V1 intact |
| `long+dose` | long + dose |
| `long+reanchor` | long, then §100's existing re-anchor (`reanchorWeekAfterTrim`) from each onset week's DELIVERED volume |

Corpus: `targetedGridCore()` achilles rows, **1,536**, production input shape (no `fitness_level`), every row generated
(the cohort is taken whole, so no stride). Control: the other **4,608** rows of the grid. Plus the 6 masters × tendon
rows of `targetedGridExtra()`.

Commands (on the branch): `npx tsx scripts/proto-achilles-onset.ts --controls` ·
`PROTO_WEEKS=1|3 npx tsx scripts/proto-achilles-onset.ts --option long+reanchor` ·
`[PROTO_WEEKS=1] npx tsx scripts/proto-achilles-warndelta.ts <option>` ·
`[PROTO_WEEKS=1] npx tsx scripts/proto-achilles-fitness-on.ts <option>` (runs the REAL `measure()` from
`measure-plan-fitness.ts` with the option on) · `npx tsx scripts/proto-achilles-trace.ts 21.1 avoid experienced` ·
`npx tsx scripts/proto-achilles-reconcile.ts`.

## What the measurement found before any seat spoke

**1. The mechanism is V1, not the onset rule.** `V1-volume-quality-split` (§2 / CD-16, Willy's own gate) holds the
week that introduces quality at ≤ +5% of the last loading week by trimming EASY runs. So at onset
**Δeasy = −(quality km + long-run growth)** whenever V1 binds. The item's worst case, reproduced exactly
(HM · declared experienced · `avoid`):

```
W5 base   39 km  L11.5  e9.0 e9.0 e9.0
W6 build  39 km  L14.5  Q9.0 e7.5 e7.5      easy 27.0 -> 15.0; long +3.0; quality +9.0; total flat
```

Holding easy volume while V1 holds the total flat is impossible unless the long run or the quality gives. Willy's
condition forbids the quality. **That leaves the long run, or relaxing V1.**

**2. The item's own metric cannot distinguish any option.** "Easy non-long volume falls at onset": baseline
**1,152 of 1,152** (100%) against the previous loading week, **960** against the immediately preceding week. It stays
**100% under every option**, because at a fixed day count the quality session takes an easy **slot**. The figure
restated today (992 of 1,184) was **not reproduced** under either definition; its definition is not recorded.
The coaching-relevant measure is **the size of each easy run**: it falls on **384 of 1,152 (33.3%)**, and the long
run grows at onset on **960**.

**3. Results, achilles cohort (1,536), N = 2 onset weeks unless stated:**

| option | plans changed | per-run easy falls | long grows at onset | median onset-week total rise | quality | added warns | removed warns |
|---|---|---|---|---|---|---|---|
| off | — | 384 (33.3%) | 960 | 17.0% | 9,600 sessions / 68,000 km | — | — |
| hold | 960 | **0** | 960 | **26.9%** (max 42.6%) | 67,856 km, **96 plans lose quality km** | RAMP +248, INJ-CAP +392, BOUNCE +32 | BOUNCE −152, RAMP −96 |
| dose | 768 | 384 (33.3%) | 960 | 19.1% | median onset Q 7.0 → **7.0 (inert)** | (totals: RAMP 448, INJ-CAP 608) | |
| long | 1,152 | **0** | **0** | **8.5%** (max 21.3%) | 68,000 km | RAMP +192, INJ-CAP +192, BOUNCE +248, DELOAD +96 | RAMP −240, INJ-CAP −40 |
| long+reanchor, N=2 | 1,152 | **0** | **0** | 8.5% | 68,000 km, **0 plans lose** | BOUNCE +440, DELOAD +96 | RAMP −240, INJ-CAP −40 |
| **long+reanchor, N=1** | 1,152 | **0** | **0** | 8.5% | 68,000 km, **0 plans lose** | **BOUNCE +320, RAMP +32** | **RAMP −176, INJ-CAP −40** |
| long+reanchor, N=3 | — | 0 | 0 | 8.5% | 9,600 sessions | totals: spacing 1,024 → 1,312, RAMP 480 | marathon peak LR **69.9% → 61.6%** |

Warn totals at N=1: `INV-PLAN-DELIVERED-RAMP` 400 → **256** · `INV-PLAN-INJURY-CAP-DELIVERED` 488 → **448** ·
`INV-PLAN-DELOAD-IS-A-REDUCTION` 32 → **32** (128 at N=2) · `INV-PLAN-BOUNCEBACK-BOUNDED` 1,312 → **1,632**.
**0 `validatePlan` errors** under every option. **Control: 0 of 4,608 plans changed** under every option.

**4. Fitness (the item's "what settles it").** Achilles-scoped, every option: median net build **68.2% → 68.2%**,
never-builds **0% → 0%**, marathon median peak long run **69.9% → 69.9%** of race (N=1, N=2; **61.6% at N=3**), mean
peak long run **19.09 → 19.09 km**. Long-run km summed over the cohort **271,485 → 269,301 (−0.8%)** at N=1,
**264,405 (−2.6%)** at N=2. The real `measure:fitness` harness with `long+reanchor` ON (N=1 and N=2): **all four
buckets and all seven personas identical to the committed baseline**, because achilles sits inside `other standard`
(9,796 rows). 🔴 **The instrument the item named as its blocker cannot see this cohort.** The achilles-scoped
figures above are the evidence; the harness proves only that nothing else moved.

**5. §1 CD-19.** Running sessions **93,696 → 93,696**, quality sessions **9,600 → 9,600** under every option.

**6. Masters × tendon (6 rows).** `long` reaches the 3 achilles rows (per-run easy falls 4 → 2 of 6); the 3 plantar
fasciitis rows are outside the `achilles` keyword and unchanged.

---

## The board

**🏃 Hutchinson (chair).** Two things go on the record before remedies. The item's remedy, *hold easy volume*, was
never compatible with V1, which is this board's own rule and which nobody proposes to repeal; and its stated figure
(easy pool falls) is 100% under every possible build, so it could never have been the acceptance test. What the
prototype found is better than the item: the raid is paid by the **long run's growth** as well as by the quality
session. Nothing here is outcome evidence (§2 Am.2), and nobody is asking for a threshold; this is an ordering rule
inside the onset week. N=1 against N=2 and N=3 is a measured choice, not an invented number: N=3 costs 8.3pp of
marathon specificity, N=2 adds 96 deload inversions, N=1 adds neither.

**📊 Seiler.** Session counts identical, so §1 is untouched by construction. The 100% figure is slot substitution;
I said in November this was a swap, not a ramp: three easy runs become two easy runs and an interval session. That is
what a base-to-build transition is. The thing worth fixing was the per-run shrinkage, and `long` takes it from a third
of plans to zero. `dose` is inert because the session is sized by its row structure and floor, not the percentage: a
lever that does not move the number should not ship.

**🎯 McMillan.** This is the plan I asked for. Week 6 reads: same long run as last week, the same 9 km easy runs, and
the new session. The runner does not lose their easy running; they postpone one long-run step by a week, which a coach
does without thinking. I would not take `hold`: a 27% median jump in the week the hard work starts is a worse week,
not a kinder one.

**🩹 Willy.** My condition is met and measured: **0 plans lose a kilometre of quality** under `long+reanchor`, against
**96 that do under `hold`**, the option the item named. Tendon is a rate-of-change problem and the long run is the
single largest achilles load in the week, so pausing its growth in the week the new stimulus arrives is the right
instrument. `hold` breaks my own V1 gate and adds 392 delivered injury-cap breaches: rejected. What I will not let
through is the bounceback residual, **+320 `INV-PLAN-BOUNCEBACK-BOUNDED`** at N=1: the held week becomes a lower
pre-deload reference and the curve bounces back over it. That is §100's defect again, one deload later.
**Binding: the re-anchor carries through the next deload, and the build does not ship with a single new bounceback.**

**⚕️ Sims.** It does what I asked: the low-stress loading stays, and the high-stress arrival is not compounded by a
long-run step. **Dissent on scope:** plantar fasciitis is the same tissue argument and the same no-lever cohort, and
the three plantar rows in the masters cell are untouched. I accept `achilles` for this ruling because that is what was
measured; plantar needs its own measurement, not an assumption.

**💪 Blagrove.** No strength rule touched. No objection from this seat.

---

## Recorded disagreements

**Sims vs the chair, on scope.** Sims wants tendon = achilles + plantar. The chair holds achilles only: only achilles
was measured. *What would change it:* the same prototype on plantar rows; `targetedGridCore` carries none, so it needs
corpus rows first.

**Willy vs McMillan, on N.** McMillan would accept N=2 (two weeks of steady long run); Willy refuses it on the
measured +96 deload inversions. Settled at N=1 by the measurement, McMillan concurring.

---

## Ruling

1. **`hold` (the item's remedy): INCORRECT.** Breaks V1 (§2 / CD-16), median onset rise 26.9%, +392 delivered
   injury-cap breaches, and removes quality km from 96 plans, violating Willy's binding condition.
2. **`dose`: INCORRECT.** Inert on the onset session (median 7.0 → 7.0 km).
3. **`long+reanchor`, N = 1: CORRECT WITH AMENDMENT.** Amendment: §100's re-anchor must hold through the following
   deload/bounceback, so the build ships with **0 new `INV-PLAN-BOUNCEBACK-BOUNDED`** on the achilles cohort. If that
   is not achievable without trimming quality or breaking §3/§90, the build returns to this board; it does not ship
   with the residual declared.
4. **Refused again:** any threshold on the delivered magnitude (§2 Am.2, §94 Am.3).

## Build spec (three artifacts, one commit)

| | |
|---|---|
| **Principle** | **§89 Amendment** *"The first quality week of a tendon history pays with the long run's growth, not the easy runs"*: for an achilles history, on the plan's first quality week the long run does not grow over the last loading week's long run; each easy run is no smaller than the last loading week's; the quality session is untouched; the following weeks ramp from DELIVERED volume (§100), carried through the next deload. Cross-reference §2/V1 (unchanged) and §94 Am.5. |
| **Numeric** | `GENERATION_CONFIG.TENDON_ONSET_LONG_RUN_HOLD_WEEKS = 1` (measured against 2 and 3, above). Scope as a named list in `injuryScope.ts`: `TENDON_ONSET_INJURY_KEYWORDS = ['achilles']`, predicate `hasTendonOnsetHistory()` (single owner; never an inline `hasInjuryKeyword(…, 'achilles')`). |
| **Invariant** | `INV-PLAN-TENDON-ONSET-EASY-HELD` (**error**): for a `hasTendonOnsetHistory` runner, on the first non-deload week carrying a quality session, (a) the long run ≤ the last loading week's long run, and (b) mean easy-run km ≥ the last loading week's mean easy-run km − one rounding step. Liveness: restoring long-run growth at onset must wake it (baseline would fire on 960 / 384 plans). Row in `plan-invariants.md`. |

**Build acceptance (re-run on the build, not quoted from here):** per-run easy falls **384 → 0**; quality sessions and
km **unchanged** (9,600 / 68,000); **0 new** `INV-PLAN-DELOAD-IS-A-REDUCTION` and **0 new**
`INV-PLAN-BOUNCEBACK-BOUNDED` on the achilles cohort; `INV-PLAN-DELIVERED-RAMP` ≤ 400; 0 `validatePlan` errors; the
4,608 control rows byte-identical. `cohort:shape` reads `cohortGrid`, which has no injured rows, and will not move;
`verify:parity`'s grid must be checked for achilles reach before IDENTICAL is quoted. Implementation note: the
prototype placed the long-run hold right after `longKm = Math.max(floorDist(longKm), minDist.long)` in
`buildWeekSessions`, and the re-anchor after V1's trigger loop in `applyV1VolumeQualityStimulusSplit`; the build should
use a named owner and threaded state, not a module-level seam.

## What this does not prove

- **No outcome data.** That the achilles runner is less likely to be injured is not shown; this is engine evidence
  that the onset week is composed the way three seats asked for (§2 Am.2 binds).
- **The bounceback amendment is unprototyped.** Carrying §100 through the deload was not built here; the +320 is
  measured, its removal is a build condition.
- **Plantar fasciitis and other tendon-adjacent histories: not measured.**
- **One grid.** `targetedGridCore` is age 40, 30 km/week, 12 km longest run, 4 days; the masters cell is 6 rows.
- **The item's restated 992 of 1,184 was not reproduced** (1,152 / 960 under the two definitions tried).
- **`measure:fitness` is blind to this cohort** at its bucket granularity; it showed no change because it cannot.
