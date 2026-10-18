# Coaching Board — STRENGTH-PROGRESSION-01: load progression from what the runner logs (Phase 4)

**Sat:** 2026-10-18. **Chair:** Hutchinson. **Seats:** Seiler, McMillan, Willy, Sims, Blagrove (strength).
**Trigger:** new doctrine (`StrengthPrinciples.md` S14, `STRENGTH_CONFIG`). **Founder:** *"do everything else while I
make the decision"* (on media), after asking for Phase 4.

**Proposed:** on a loaded main lift the runner may log what they lifted and how it felt; the next session of that lift
suggests a load. A suggestion, never a requirement.

## 🔍 Conflict scan
- **S6 (dose):** reps, sets and the `BLOCK_WEEKS` variant cadence stay the engine's. Progression changes LOAD only.
  S6 already says an exercise is kept for a block *"so load can progress"*; until now nothing progressed it.
- **S7 (RIR):** load is prescribed as reps in reserve, never %1RM, never to failure. A suggestion cannot change the
  RIR target; the runner's own feel against that target is the input.
- **S5 (taper) · S6 deload · S13 (recovery ease):** each is a week or day built to hold back. None may step load up.
- **S9 (injury steers):** an injury tag that an exercise loads must slow progression, not stop it.
- **Design Board E (2026-10-16):** *"no RPE, no per-set logging until Phase 4 reads them"*. This is the reader.
- **Entry-points ruling (Sierra):** *"real progress in load waits for Phase 4's logging; do not fake it before then."*

## Seats
**💪 Blagrove.** Log once per lift per session, not per set: the weight used and one of three feels against the target
(easy: two or more reps left over beyond it; right; hard: hit or nearly hit failure, or form went). Step up after
"easy", or after "right" twice at the same weight. Step size is the smallest sensible jump: 2.5 kg on a lower lift,
1 kg on an upper one. If that jump is more than a tenth of the weight (light dumbbells), add a rep instead, up to two,
then the weight. Bodyweight-only lifts log the feel only; their progression is the variant change the engine already
makes.
**🏃 Hutchinson.** Autoregulated progression from reps in reserve is at least as good as fixed percentages in trained
lifters **[M]**, and we have no 1RM, so it is the only honest option. It may hold or come down; it never jumps.
"Hard" holds; "hard" twice comes down a tenth. Nothing steps in a deload, taper, race week or eased session, and
those sessions' logs do not count towards a step.
**🩹 Willy.** One step per lift per week at most. If the runner's injury tags match what the lift loads (a calf raise
with an Achilles history, a squat with a knee), "easy" counts as "right": two good sessions, never one, before a step.
**🎯 McMillan.** Logging is optional and the plan never waits for it. A runner who logs nothing gets exactly today's
app. No step without a log: an un-logged session leaves the suggestion where it was.
**⚕️ Sims.** The tenth-of-the-load cap matters most for lighter lifters, who are more often women: a 2 kg dumbbell jump
on 6 kg is a third. Adding reps first is right. No objection beyond that.
**📊 Seiler.** No objection; strength is outside §1.

## ⚖️ Ruling: CORRECT WITH AMENDMENT
Amendments folded into the proposal: Willy's one-step-a-week cap and the injury slow-down; Sims's reps-before-load at
the 10% cap; Hutchinson's no-step weeks and their logs not counting.

## 📦 Artifacts
1. Principle: `StrengthPrinciples.md` **S14**.
2. Numerics (`STRENGTH_CONFIG`): `LOAD_STEP_KG_LOWER` 2.5 · `LOAD_STEP_KG_UPPER` 1 · `LOAD_STEP_MAX_PCT` 0.1 ·
   `REP_PROGRESSION_MAX` 2 · `LOAD_REDUCE_PCT` 0.1 · `LOAD_STEP_MIN_DAYS` 7 · `LOAD_ROUND_KG` 0.5.
3. Invariant: `S-PROGRESSION-BOUNDED` (a suggestion never exceeds one step, never rises in a no-step week or after
   "hard", never rises twice inside `LOAD_STEP_MIN_DAYS`), property-swept over generated histories.

## ↗️ SLT escalation
None. (Tier: strength is paid; logging adds no new gate.)
