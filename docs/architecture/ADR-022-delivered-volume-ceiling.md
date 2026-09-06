# ADR-022 — The delivered week is the promise: reconciling placement with the volume ceiling

**Status**: SHIPPED (2026-09-06). Coaching Board CORRECT WITH AMENDMENT (Willy-led, this session). §90.
**Date**: 2026-09-06
**Supersedes**: nothing. **Amends**: CoachingPrinciples §3 (a deload reduces — now enforced at the delivered week, not just the curve), §8 (its 2nd peak quality yields to §12 for injured tissue), §12 (the injury cap is a delivered promise), §52 (the delivered ceiling is injury-scoped; healthy divergence stays here). ADR-012 (reshape authority — same delivered-vs-intended distinction).
**Related**: ADR-017 (Coaching Board authority), ADR-021/§89 (experience-gated onset — the deeper deloads this exposes were masking the sawtooth), RAMP-BOUNCEBACK-01/§2 (the curve-level injury bounceback bound whose delivered arm this continues), §87/CB-DELOAD-01 (deload placement).

---

## Context

The engine computes a weekly volume **curve** (`buildVolumeSequence → volumes[]`) and enforces every load rule on it: the §2 ramp cap, the §3 deload (`RECOVERY_WEEK_VOLUME_PCT`, 70%), and the §12 injury cap (`INJURY_WEEKLY_INCREASE_CAP_PCT`, 5%/wk for knee/shin). The curve is correct.

**But the runner never sees the curve.** They see `weekly_km = sumWeeklyKm(placed sessions)`, and session sizes are computed **independently** of the curve ceiling:

- the long run is race-anchored (§45/§47/§80),
- peak weeks carry two quality sessions (§8),
- easy runs are floored at `MIN_SESSION_DISTANCE`.

Nothing trimmed the placed sessions to fit the ceiling, so **delivered volume diverged above the curve**, worst on constrained (injury / low-volume) weeks. Two concrete, measured failures on the 2026-08-20 baseline:

1. **Deload inversion — 12.8% of plans at the curve.** A deload was set to 70% of the *uncapped* `lastBuildVol`, but the prior week had then been capped *lower* (injury/ramp). So "70% of uncapped" ≥ the delivered prior week — the recovery week reduced nothing, and some deloads were *bigger* than the week before them. A runner is told "recover" and handed more running.

2. **Injury cap breached at delivery — bouncebacks ≥ pre-deload on 18.8% of injury plans.** A green curve could still ship a **+39% delivered week** to an injured knee: a 2-quality peak + a growing long run + easy floors, none reconciled to the 5% ceiling. The §12 cap bound the curve and meant nothing to the tissue.

These are one class: **delivered ≠ curve**. The rule was honoured and still wrong (D-21). The old shallow deloads *masked* failure 2; ADR-021's correctly deeper deloads exposed it (a +36% W9→W10 sawtooth on the HM knee archetype).

## Decision

**For injury-history (knee/shin) runners, the delivered week must respect the ceiling, not just the curve.** Three levers, in strict order (the Coaching Board's ruling on least-harm):

1. **Deload curve re-anchor.** A deload is now `min(existing, RECOVERY_WEEK_VOLUME_PCT × the POST-CAP prior week)`. Re-anchoring to the actual prior week is §3's literal intent. Curve-level deload inversions **12.8% → 0%**. Deloads also keep their session **frequency** — the day-count grosses the deload target back up before dividing by `MIN_KM_PER_TRAINING_DAY`, so a recovery week is lower-volume, not fewer-days.

2. **§8 yields to §12 on injury peak weeks.** An injury-capped runner's peak week carries **one** quality session, not two. This is what makes the delivered cap *achievable* — two quality sessions plus the long run already exceed the ceiling before an easy km is placed.

3. **Easy runs trim/drop to the ceiling; the long run never does.** Easy volume reconciles down to fit. The **race-anchored long run is never trimmed** — §52 owns it. The enforceable delivered promise is therefore on the **trimable (non-long-run) portion**.

**One new maintenance trigger.** Injury history + a beginner's current volume + an ultra target (`distKm > 43`) cannot safely build to the distance — it classifies `volume_profile = 'maintenance'` with a note, rather than shipping an unsafe ramp.

**Scope: injury runners only (Hutchinson, firm).** A healthy runner's delivered divergence stays §52's accepted territory — the race sets their long run and the engine does not deform a whole week's structure to tidy a low-volume week's arithmetic. The delivered ceiling reconciliation binds only where the 5% cap is the binding promise: injured tissue.

## Consequences

**Positive.**
- An injury runner's delivered week now tracks the ceiling on its trimable portion — the +39% sawtooth is gone; the injuryCapCompounds archetype holds well under the old defect.
- A deload is a reduction at the curve for everyone, and at delivery wherever floors don't dominate.
- The distinction "curve is the intent, delivered is the promise" is now explicit doctrine (§90), reusable for the next placement question.

**Negative / accepted residual (stated honestly, not hidden).**
- **The delivered promise is not fully closed.** On low-volume / low-day injury plans the easy floor (`MIN_SESSION_DISTANCE`) dominates — you cannot place half an easy run — so the trimable portion can still rise above the cap (measured max: an 8→16 km non-long jump on a 5 km/3-day knee runner). And the §52-protected long run still inflates the *whole-week* delivered rise on peak weeks (the residual `injuryCapCompounds.test.ts` tolerances at `cap + 15`).
- These residuals are the delivered≠curve class in its last mile. Closing them means reconciling **long-run placement** itself, which is a separate §52 question with its own ruling — deliberately out of scope here.
- Consequently the three enforcing invariants are all `warn`, not `error` (see below).

## Artifacts

| Layer | Artifact |
|---|---|
| **Principle** | CoachingPrinciples **§90** — "A recovery week reduces, and the injury cap holds at delivery — the curve is not the promise"; amends §3/§8/§12/§52 by reference. |
| **Numeric** | No new coaching constant — the deload reuses `RECOVERY_WEEK_VOLUME_PCT` (§3), the cap reuses `INJURY_WEEKLY_INCREASE_CAP_PCT` (§12); the injury peak-quality count is `1` by §8/§12 precedence; the ultra trigger reuses the marathon/ultra distance boundary. |
| **Invariant** | `INV-PLAN-DELOAD-IS-A-REDUCTION` (`warn` — curve fixed, delivered residual pending), **new** `INV-PLAN-INJURY-CAP-DELIVERED` (`warn` — the trimable-portion cap, §52 long run excluded by construction), `INV-PLAN-BOUNCEBACK-BOUNDED` (`warn`, §2). Rows in `plan-invariants.md`. |
| **Test** | `lib/plan/deloadInversion.test.ts` (7 cases — the clean structural guarantees) + `injuryCapCompounds.test.ts` tolerance updated to the §52-residual reality. |

**Why the invariants stay `warn`.** All three read DELIVERED `weekly_km` and have a measured, declared-AND-exercised residual (§34): the floor-dominated low-volume plans and the §52-protected long run. Each becomes `error` when long-run placement is itself curve-reconciled — a future §52 item, not this change. Promoting them now would break the build on a residual the board deliberately left open. `INV-PLAN-INJURY-CAP-DELIVERED` is exercised (1892 week-instances over cap across a 600-plan injury grid), so it is not a dead check.

## Alternatives considered

- **Enforce the delivered ceiling for all runners.** Rejected by the board (Hutchinson): it forces deload-week placement surgery — trimming the long run or dropping easy days — on healthy runners whose §52 lopsided→maintenance path already handles the divergence honestly. A separate ruling if ever wanted.
- **Trim the long run to the week's share on injury weeks.** Rejected: §52 protects the race-anchored long run as the one session that must not be deformed; trimming it trades an injury-load promise for a race-specificity failure. The maintenance classification is the honest exit when even a capped long run breaks the week.
- **Promote the deload invariant to `error` now.** Attempted, reverted same session: it surfaced 563 healthy delivered inversions the board scoped out — enforcing them would deform healthy weeks the ruling deliberately left to §52.
