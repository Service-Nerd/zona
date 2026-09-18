# Coaching Board ruling — 2026-09-18 round

**Packet:** `generated-plans.md` (21 cases: 4 canonical + 11 charity personas + 6 variants)
**Ruling: CORRECT.** All 20 generated plans pass on coaching correctness. M4's
refusal is correct. No veto, no amendment, and therefore **no principle, numeric
or invariant change** — a review that finds the constitution already correct
produces no artifacts, and manufacturing one would be this board's own recorded
failure mode.

## Evidence the sitting ran on

`measure:fitness` (exit 0, no regression): never-builds **0% for both injury
cohorts** (was 28.9%, and 66.7% for masters, as recently as 2026-09-17).

Marathon charity personas:

| Persona | Weeks | Peak week | Peak LR | LR % week | LR % race | Profile |
|---|---:|---:|---:|---:|---:|---|
| M1 first-timer, low base | 20 | 59 km | 26.0 km | 65% | 62% | maintenance |
| M2 charity, COMPRESSED 12wk | 12 | 50 km | 29.5 km | 70% | 70% | maintenance |
| M3 returning + knee | 18 | 59 km | 29.5 km | 69% | 70% | maintenance |
| M4 sub-4:00, 3 days, 45-min cap | — | — | — | — | — | **refused by design** |
| M5 masters (58) | 20 | 66 km | 29.5 km | 45% | 70% | build |
| M1d first-timer, DECLARES experienced | 18 | 59 km | 26.0 km | 60% | 62% | maintenance |

Warns across the 11 charity personas (0 errors): 12 `LR-MAX-WEEKLY-PCT`,
8 `DELIVERED-RAMP`, 6 `LARGEST-SESSIONS-SPACED`, 2 `BOUNCEBACK-BOUNDED`,
2 `DELOAD-PHASE-POSITION`, 1 `DELOAD-IS-A-REDUCTION`. Clean: T1, T1d, H1d.

## Rulings

**(a) M1/M1d's 26.0 km peak long run is NOT a shortfall. Question withdrawn by
the chair.** It was submitted comparing against a "30–32 km first-marathon norm",
which is a **distance** norm. §80 is titled *"Finish-goal long run — time on
feet, not distance"* and states the distinction is *"not cosmetic"*; the
governing constant is a **duration** ratio. Measured: M1 and M1d are the only two
personas carrying the §80 note, and it reads *"tops out at 3h 28"* — their long
run is capped by `LONG_RUN_CAP_MINUTES`. 26 km at their projected pace is already
3h28 on feet; 32 km would be a **four-and-a-half-hour training run** for someone
whose longest run was 8 km. §80's *"honest failure case"* clause requires the
plan to say so plainly, and it does.

⚠️ **This is the second consecutive sitting where a rejection premise did not
survive measurement.** On 2026-09-16, four plans were rejected across three
passes and not one reason held up. The conflict scan caught this one.

**(b) The 12 `LR-MAX-WEEKLY-PCT` warns are correct as residual.** Not an
unenforced rule: §52 specifies that a plan which cannot satisfy the bound is
downgraded to maintenance with the cause in `volume_constraint_note`, and the
invariant is `severity: volume_profile === 'maintenance' ? 'warn' : 'error'`.
The standing instruction on `S52-LOPSIDED-BOUND-01` (do not add a third per-week
bound) **holds, with a reason now recorded**: Willy's point that such a bound
would trim the easy runs further and make the week *more* lopsided, not less.

**(c) INSUFFICIENT EVIDENCE to tighten the 5% materiality threshold.** What would
settle it: the distribution of shortfall magnitudes across the finish-goal
corpus. Bimodal (rounding vs real gaps) → 5% is fine; continuous → the threshold
is arbitrary. **Do not change it on intuition.** Silencing the measured 1.7%
(2-minute) case is unambiguously right. Filed as `S80-MATERIALITY-EVIDENCE-01`.

## Recorded disagreements (not synthesised)

**McMillan vs Seiler on `maintenance`.** Four of five marathon charity personas
are labelled `maintenance`. Seiler: it is a mechanical classification and reading
it as a verdict is a category error — these runners get 59–66 km peak weeks,
which is not maintenance in any ordinary sense. McMillan: the runner cannot see
the mechanism and will read the word; for a first-timer, *"get you round"* **is**
the goal, so language derived from that label may read as a downgrade.

Both are right about different audiences. The runner-facing note currently reads
*"This plan is built to get you round, not to build you up"* and **never uses the
word "maintenance"** — closer to McMillan's position than either seat realised,
which makes this a brand/product question, not a coaching one. Escalated as
`BRAND-MAINT-LABEL-01`.

**Sims on (c).** The materiality axis that matters at the bottom of the volume
range is **energy availability**, not marathon experience — a charity first-timer
on 15–20 km/week with fundraising stress is in the RED-S risk population, and a
plan that only adds load will never surface it. Unbuildable today (ADR-011: no
cycle or intake data), so not a gate. Recorded that 5% is a male-derived default
for "meaningful shortfall" and there is no data either way.

## Defect found by the sitting

`plan-invariants.md` listed `INV-PLAN-LR-MAX-WEEKLY-PCT` as `error` with no
mention of the maintenance downgrade — the registry was narrower than the code,
which is why 12 warns appeared on plans the registry said could only error.
**Corrected in the same commit as this ruling.**
