# Coaching Board — 2026-09-04

**Session-label honesty · VO2max dose quantisation · effort-governed sizing**

Convened after tracing a live 10K plan (`bcdec27a`, generated 2026-09-03) and finding four anomalies in its quality sessions. Three reached the board; one was withdrawn on inspection.

**Trigger:** `generationConfig.ts`, `CoachingPrinciples.md`, `sessionCatalogueData.ts` — hard trigger. Soft trigger on `ruleEngine.ts` qualifies (items ① and ④ change what the runner is told to do).

**Founder constraint, recorded verbatim in effect:** every ruling to be assessed across all six race distances and the full input space, not just the 10K case that surfaced it, and any change to propagate to those paths rather than be scoped to the surfacing case.

---

## 1. Evidence taken before any seat spoke

5,392 plans generated across the property sweep's own grid (6 distances × 9 day-shapes × 5 volumes × 4 fitness × 5 training-age × 4 declared level × 6 injury sets × 5 weekday caps × 4 HR sets × 2 goal types × 2 benchmark states × 2 tiers). Harness: `scripts/.board-evidence-2026-09-04.ts` (untracked, retained for re-verification until phase 2 lands).

### 1a. A measurement was discarded before it reached the board

The first run inherited `property-validate-plans.ts`'s `baseInput.target_time: '0:45:00'`, applied to **every** distance — handing a 100K runner a goal pace of **27 seconds per kilometre**. It produced 14/14 "incoherent" ultra sessions and a 6-minute climb session. Those were grid artifacts and were thrown away.

**This is itself a live defect in the commit gate**, fixed in this commit: everything downstream of `goal_pace_per_km` was nonsense on the four distances above 10K, so "0 violations" meant *no coverage* for the entire goal-paced path on HM, marathon, 50K and 100K. Same class as SWEEP-VACUOUS-01 and the `fitness_level`-always-set gap (§79) — **an input the grid gets wrong tests a runner who does not exist, and reads as safety.** A startup assertion now fails loudly if a distance is added without a target time.

Every figure below is from the re-run with realistic per-distance targets.

### 1b. Cross-distance results

| Item | 5K | 10K | HM | MAR | 50K | 100K |
|---|---|---|---|---|---|---|
| ① label collision (plans with 2 build sessions sharing a label but not a row) | 0.0% | 17.3% | 18.3% | 16.1% | 17.0% | 16.0% |
| ② VO2max dose >10% short of target | 52 / 1,251 | 133 / 1,120 | — | — | — | — |
| ③ effort-governed duration incoherent | 75 / 165 | 183 / 263 | — | — | — | 2 / 7 |
| ④ effort row relabelled goal-paced | 0 | 0 | 0 | 0 | 0 | 4 |

**① is not a 10K problem.** Every distance except 5K, and worse at the long end — four structurally different sessions reach the marathon runner under one name:

```
"MARATHON-pace progression" ← progressive_tempo, tempo_continuous, tempo_cruise, threshold_ladder
"100K-pace progression"     ← progressive_tempo, tempo_continuous, tempo_cruise, threshold_ladder
"50K-pace progression"      ← progressive_tempo, tempo_continuous, tempo_cruise, threshold_ladder
"HM-pace progression"       ← progressive_tempo, tempo_cruise, threshold_ladder
"10K-pace progression"      ← progressive_tempo, tempo_cruise, tempo_cruise_short
"5K-pace progression"       ← progressive_tempo, tempo_cruise
```

**② is confined to one row and two distances** — the only distances that reach a VO2max row:

| row | n | >10% short | worst | work-min range |
|---|---|---|---|---|
| `intervals_classic` (3 min reps) | 933 | 0 | 0.0% | 12.0–18.0 |
| `intervals_short` (400 m reps) | 307 | 0 | 8.8% | 14.4–18.0 |
| `intervals_long` (1000 m reps) | 1,131 | **185 (16.4%)** | **24.0%** | 12.0–18.0 |

Never below the floor — this is target attainment, not safety. Mechanism: `ceilReps = floor(18 / 4.6) = 3`; four reps would be 18.4 min, **0.4 over a hard ceiling of 18**, so the runner drops from 18.0 min of work in week 9 to 13.8 in week 10. Three-minute reps divide 12–18 cleanly; 4.6-minute reps admit only two counts, 30% apart.

**③ `hill_reps` incoherent in 258 of 428 placements (60.3%).** Worst: stated 31 min, main-set allocation 12.9 min, own closed steps ≥24 min — a 186% overrun.

**A claim withdrawn.** The originating bug report said the weekday cap was being honoured against an understated number. True in principle; **0 of 5,392 plans** had the honest duration breach `max_weekday_mins` when the stated one did not. Recorded as real-but-not-currently-binding, per Willy: *"That is luck, not design, and it will stop being true the moment someone widens the variants."*

---

## 2. Conflict scan

**§53 → item ①: the constraint protects against a check that no longer exists.**

LABEL-VARIETY-01's code comment justifies forcing "progression" onto every build goal-paced session because *"that cross-phase merge is what surfaces repetition §53 counts by label."* §53 has not counted labels since CAT-ULTRA-THIN-01:

> **Counts the ROW, not the label** — *"§22's goal-pace rename deliberately makes label ≠ row, so a label count both under-counts and mis-counts."*

Timestamps: `a4db6aa` (LABEL-VARIETY-01) landed **08:17**; `1021013` (row-counting) landed **09:19 the same morning**. The premise was true for sixty-two minutes; nobody removed the constraint once its reason was deleted. `INV-PLAN-QUALITY-VARIETY-FULL-PLAN` keys on `catalogue_id`. **Item ① costs label honesty to buy variety protection already provided elsewhere.**

**§40b → item ④: direct contradiction.** §40b — *"it does not invent a number the runner cannot act on… What is absent is the pace, and only the pace."* The tension with §22 was named in `ruleEngine.ts` and deferred to this board (*"a separate §22/§40b tension (board territory)"*). It was never brought.

**§19 → items ① and ④.** §19's own **Known limitation (SC-08)** says the check is label-based *"until SC-08 puts the row's identity on the session."* ADR-018 shipped `catalogue_id` on 2026-08-20 — **the precondition §19 names has been met and the check was never re-keyed.** §19 validates `pace_target` only, never `derived_set`, which is why both ① and ④ pass it.

**§8 → item ②.** No conflict; the band is honoured. §8 is silent on whether the target within it must be reachable.

**§16 → item ③.** No principle contradicted. §16 has simply never been asserted against effort-governed rows.

**Zone model:** no seat's argument depends on Z2/Z3 labelling. No translation failures.

---

## 3. Rulings

### ① Build-phase goal-paced labels — CORRECT WITH AMENDMENT — *not yet implemented*

Every phase takes the row's own shape word. **Amendment:** record this as a *revert of a constraint whose justification expired*, not as a new principle, or the next reviewer re-adds it. §53's row-counting is untouched.

McMillan: *"'Progression' means it gets harder as you go. If I tell an athlete they have a progression and they open the app to four times five minutes with ninety seconds jog, I have taught them the word means nothing. Do that twice in consecutive weeks with two genuinely different sessions and you have taught them the plan means nothing."*

### ② VO2max rep-count quantisation — CORRECT WITH AMENDMENT — *not yet implemented*

**The board explicitly rejects the tolerance approach.** `VO2MAX_WORK_MAX_MINS = 18` stays hard (Seiler, unopposed): *"The reason a ceiling exists is that a recreational athlete with a 90-minute Tuesday will happily extend the hard session, and the cost lands on Wednesday's easy run. If you soften 18 to '18 plus tolerance', someone will read that as 18.4 today and 19.2 next quarter."*

Rep selection changes to nearest-to-target among admissible counts — which **does not fix `intervals_long` on its own**, and that is the finding. The row is under-specified: 1 km reps admit only 3 or 4, 30% apart. **Bring the row's recovery/rep structure back as a follow-up ruling.**

Hutchinson, on what the principle text may claim: *"Fifteen minutes at vVO2max versus eighteen is not a difference anyone has demonstrated matters for a four-hour-a-week runner. What they are being short-changed on is internal consistency… Fix it for coherence, not for adaptation, and do not write a principle claiming an adaptive benefit we cannot support."*

### ③ Effort-governed session sizing — CORRECT WITH AMENDMENT — *phase 1 implemented*

Phase 1 (lower-bound invariant at `warn`) ships now: it restores §16's documented intent to a row that escaped it and changes no prescription.

Phase 2 (real sizing, promotion to `error`) is **gated on Seiler's condition**, which no other seat opposed: *"If hill sessions run 30% longer than the plan believes, then `INTENSITY_DISTRIBUTION` — which §1 measures in minutes — is being computed on fiction. I want that quantified before ③ ships."*

Sims: *"A plan that systematically understates session duration understates energy demand, and the population that pays for that first is the one already under-fuelling… A woman planning her fuelling against 39 minutes and running 55 is under-fuelling by design, every time that session appears."*

Willy: *"Every downstream load calculation — weekly minutes, the hard/easy spacing arithmetic, the 10% progression check in §2 — is computed against a session that is a third smaller than reality. The gap is largest exactly where the eccentric load is: eight descents that nothing in the model prices."*

### ④ Effort-governed rows relabelled goal-paced — INCORRECT. **Veto.** — *implemented*

Unanimous. An effort-governed row is excluded from §22's goal-pace override entirely — label, `pace_target` and `derived_set`. What would make it correct: nothing. McMillan: *"No runner has ever hiked a hill at 8:14 per kilometre."*

**Consequence handled, not absorbed.** Removing the override made `vert_hike_repeats` fail `INV-PLAN-RACE-SPECIFIC-EXPOSURE` — because it had only ever passed that check *by carrying the invented pace §40b forbids*. §22's per-week catch already exempts VO2max *"because their physiology is too valuable to lose"*; effort-governed sessions are now exempt on identical reasoning. §22 is not weakened — `INV-PLAN-RACE-SPECIFIC-EXPOSURE-RATIO` still holds the plan to a race-pace share at plan level.

---

## 4. Recorded disagreements

**Hutchinson vs. Seiler/Sims — what item ② is for.** Hutchinson: fix for internal consistency, claim no adaptive benefit. Seiler and Sims: fix the row's granularity, because the band is imprecise and a tolerance patch implies a precision it lacks. *Settled:* both want the same code change; they differ on what the principle may claim. **Resolution — the principle says consistency, not adaptation.**

**Willy vs. McMillan — item ② residual.** Willy would accept the under-dose over a 33% step-up before taper. McMillan says the runner reads it as the plan losing its nerve. *Not answerable from data Zonna holds. Both accept the row-granularity fix as making it moot.* **Recorded, not resolved.**

**Seiler's blocking condition on ③.** Quantify the intensity-distribution impact before phase 2 ships. No seat objected. **Treated as a required pre-condition, not a preference.**

---

## 5. Artifacts

### Shipped in this commit

| Ruling | Principle | Numeric | Invariant |
|---|---|---|---|
| ④ | §40b Amendment 1 | none — structural | `INV-PLAN-EFFORT-GOVERNED-NOT-GOAL-PACED` (error) |
| ③ phase 1 | §40b Amendment 2 | none — phase 2 adds the constants | `INV-PLAN-EFFORT-GOVERNED-DURATION-LOWER-BOUND` (**warn**) |
| — | — | — | `INV-PLAN-RACE-SPECIFIC-EXPOSURE` exemption extended (mechanical half of ④) |
| — (defect fix, board-exempt) | — | `TARGET_TIME_BY_DISTANCE` in the sweep | startup assertion on grid completeness |

Regression suite: `lib/plan/effortGovernedSessions.test.ts` (10 cases). Both new invariants are **falsification-tested** — each is shown firing on a deliberately broken plan, and the ④ engine fix was reverted to confirm 3 tests go red and return green when restored.

### Outstanding

| Ruling | Status |
|---|---|
| ① label shape word, all phases | CORRECT WITH AMENDMENT — needs `INV-PLAN-LABEL-MATCHES-STRUCTURE`, which also closes §19's own "Known limitation (SC-08)" |
| ② rep selection nearest-to-target | CORRECT WITH AMENDMENT — ceiling untouched; does not fix `intervals_long` alone |
| ② `intervals_long` row granularity | **Follow-up ruling required** — the row is under-specified, not the band |
| ③ phase 2 sizing + `error` promotion | Gated on Seiler's condition (quantify the §1 minute-share shift) |

**SLT escalation: none.** All four are correctness. No tier movement — every affected row is FREE-tier. No data Zonna cannot collect.

---

## 6. Verification

**Verified.** All four measured across 5,392 generated plans. §53's expiry established from commit timestamps, not inference. ④ reproduced with a realistic target time after the contaminated measurement was found and discarded. Both new invariants proven able to fire. Full `npm run verify` green after the change, against a recorded pre-change baseline.

**Not verified.** Nothing rendered in the UI. Seiler's intensity-distribution condition is unmeasured — no attempt made. The ② row-granularity follow-up has no proposal behind it yet. `vert_hike_repeats` appears 7 times in 5,392 plans, so every ultra figure here rests on a small sample.
