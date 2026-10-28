# Coaching Board — a lift whose reps rise between blocks (STRENGTH-REP-BLOCKS-01, found at build)

**Date:** 2026-10-28 · **Chair:** Hutchinson · **Seats:** Seiler, McMillan, Willy, Sims, Blagrove
**Trigger:** `packages/strength/progression.ts` and `StrengthPrinciples.md` S14 (hard trigger: strength doctrine).

**Proposed change.** The general rep cycle ruled this morning (S6 Am.2, 10 → 8 → 6) means a main lift that carries
across a block change can be prescribed MORE reps than when it was last logged (6 → 10). S14's suggestion is
rep-blind, so it would offer the 6-rep weight for 10 reps.

**Measured** (819 sampled general plans): 904 carries with reps rising, in 429 plans; 4,256 with reps falling. Before
the cycle: 0 rising, 1,248 falling (all technique 10 → 8).

## Conflict scan

- **S14** "it may hold or come down; it never jumps": a rise must not raise the load, and the formula must not be used
  to raise one on a fall. **Reps, sets, RIR stay the engine's**: unchanged; the change is to load only.
- **S6 Am.2** (the cycle) and **S9** (a lift held for the block): unchanged; this sitting handles their consequence.
- **S7** (RIR is the effort target): the conversion is computed AT the RIR target, so the effort stays the same.
- No run-engine section touched.

## Seats

- **Blagrove.** Ten reps at a six-rep weight is not a harder session, it is a failed one: the runner either grinds
  past the RIR target or stops short. Carry the load down by the rep-load relation. **P1** ("start light") throws away a
  good log and reads as a new lift when it is not one. **P3** cannot be built for a one-option pool.
- **Hutchinson.** No 1RM, so no percentage tables. But the ratio between two rep counts at the same RIR does not need a
  1RM: Epley's `1 + reps/30`, taken at reps-to-failure (target reps + RIR), gives the cut. 6 at RIR 2 to 10 at RIR 2 is
  (1 + 8/30) / (1 + 12/30) = 0.905, about 10% lighter. It is an algorithm formula, not a coaching numeric (CLAUDE.md
  exempts those). Round DOWN, so error lands on the light side. Never use it upward.
- **Willy.** Agree with rounding down and never upward. On a fall (10 → 6) the carried weight is light for a block;
  that is an under-dose, not an injury vector, and S14's weekly step closes it. A formula that raises load from an
  estimate is how a hinge gets loaded past what the tissue has seen. No.
- **McMillan.** The runner sees a number and a feel; that is all they need. The cut must be on the screen as the
  suggestion, not as a rule to understand.
- **Sims.** Rounding down to 0.5 kg protects light upper lifts, where 10% is under a kilogram. No objection.
- **Seiler.** No objection from this seat.

## Disagreement recorded

Blagrove would also convert **downward** on a fall (load up for a 6-rep block, the stimulus S6 Am.2 is for). Willy and
Hutchinson refuse: S14 says it never jumps, and an estimated load rise is the one error that injures. **Stands as
written; what would change it:** measured logs showing general runners stall below their 6-rep weight for a whole block.

## Ruling

**CORRECT WITH AMENDMENT (P2, with the Epley ratio instead of `LOAD_REDUCE_PCT`).** When today's prescribed reps are
above the reps prescribed at the last counting log, the suggested load is that log's load × `(1 + (last reps + RIR)/30)
/ (1 + (today's reps + RIR)/30)`, rounded **down** to `LOAD_ROUND_KG`, with no extra reps carried. Equal or falling
reps: S14 unchanged. The cut never applies upward.

## Artifacts

1. Principle: StrengthPrinciples **S14 Am.1**.
2. Numeric: none new. Epley's 30 is an algorithm constant (exempt); `LOAD_ROUND_KG` reused.
3. Check: `S-PROGRESSION-BOUNDED` gains the arm "a suggestion never exceeds the last load when the reps rose".

## SLT escalation

None.
