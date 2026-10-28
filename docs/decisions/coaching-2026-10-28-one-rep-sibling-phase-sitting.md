# Coaching Board: the sibling is build-only, the swaps are all in peak (2026-10-28, S9-ONE-REP-01, second sitting)

**Why:** the build's code review found that `tempo_cruise` is `phase_eligibility: ['build']`, while all 18 swaps the
morning's ruling approved land in peak (week 11). The morning's conflict scan named §19 Am. and §85 and never read the
sibling row's own eligibility; no invariant reads phase either. The founder sent it back (answer "1" to "take the
peak-phase question to the board before I commit?"). Built code is uncommitted while the board sits.

## Evidence

- **Why Cruise is build-only.** No principle states a physiological reason. The only reasoning on record is §19's CD-1
  ruling: `tempo_continuous` and `tempo_cruise` are "one intensity, two shapes, separated by fitness floor and phase",
  a pool-separation that keeps the threshold rotation varied. `threshold_mile_repeats`, the row the selector actually
  picks in these weeks, is build **and** peak.
- **Other selector filters the swap skips**, checked against the sibling: `tempo_cruise` is free tier like the mile,
  T-anchored like the mile, not a hill row, not high tissue stress, eligible at every distance the mile is (and 5K),
  intermediate like the mile, and carries no `min_weekly_km` (the mile's is 40). On every axis except phase it is at
  least as eligible as the row it stands in for.
- **The phase-respecting alternative, prototyped** (env-gated, restored from a saved copy): in peak, deliver the
  peak-eligible same-intensity row `tempo_continuous`. The same 18 sessions change, **0 validator codes move**, and none
  sits next to another continuous tempo. The session becomes **22 minutes continuous** at 10:11–10:37 /km (the week is
  goal-paced) against Cruise's 2 x 10 min with 2 min jog. Same work band.
- **Built option (Cruise in peak):** 18 sessions, 2 x 10 min, 43 min; parity 6,102 identical; sweep and verify green.

## Conflict scan

- **§19 CD-1 veto (cruise vs continuous):** separation by phase is a pool rule for the selector. Neither option merges
  the rows.
- **§19 Am. / Am.2:** the stand-in exists because the stimulus is the mile's. A phase tag on the sibling was never
  part of that equivalence.
- **§22 Am.3:** continuous goal pace capped at 8 min for 5K/10K beginners ("a time trial, weekly"). Not binding on an
  HM intermediate, but the same concern in kind applies to 22 continuous minutes at goal pace for the slowest runners.
- **§53 / §36:** neither option moves the variety checks (measured).

## The seats

🏃 **Hutchinson (chair).** The phase tag on Cruise is a rotation rule: it keeps the selector from offering two near-
identical threshold shapes in the same block. It is not a statement that 2 x 10 minutes at threshold is wrong in a peak
week, and nothing in the record says it is. The mile is peak-eligible; this slot is the mile's. What the morning missed
was not a coaching error, it was an unscanned field, and the fix is to write down which eligibility the stand-in
answers to.

📊 **Seiler.** Same work band either way, and neither moves §1. The 2-minute jog is what buys a slow runner the full
20 minutes at pace. Twenty-two minutes continuous at goal pace for a three-hour half-marathoner is a harder session than
the one the plan chose, for no measured reason. Cruise.

🎯 **McMillan.** For a half marathon, peak is where I would want continuous work at goal pace, so the alternative has an
argument. But the plan did not choose continuous work this week; it chose reps, and the rotation already gives these
runners their continuous sessions elsewhere. Swapping the shape in a stand-in path is the selector's decision made in
the wrong place. Cruise here, and if HM peak needs more continuous goal-pace work, that is its own question.

🩹 **Willy.** No load difference worth separating. The broken version is gentler for the slowest runners in the product.
Cruise.

⚕️ **Sims.** Agree with Seiler: for older and female slow runners, the jog is the difference between finishing the set
and abandoning it. Cruise.

💪 **Blagrove.** No objection from this seat.

## Recorded disagreement

McMillan holds that HM peak may be short of continuous goal-pace work in general. Not ruled here: it is a selector
question about every HM plan, not this stand-in. Not filed as an item; he named it as an observation without evidence.

## Ruling

**The phase-respecting alternative (Continuous tempo in peak): not chosen** (changes the session's shape to a harder,
continuous goal-pace effort the selector did not pick). **Cruise intervals in peak, as the mile's stand-in: CORRECT WITH
AMENDMENT.**

**Amendment to §19 Am.2:** the stand-in answers to the **selected row's** phase eligibility, not its own: a phase tag on
a catalogue row governs what the selector may offer, and the stand-in is not offered, it substitutes. On every other
eligibility axis the sibling must be at least as eligible as the row it stands in for (tier, pace anchors, distance,
fitness floor, no hill or tissue-stress class the row lacks, no higher volume gate), because the swap bypasses those
filters. **Check:** a test asserts that for every declared sibling.

## Artifacts

1. **Principle:** §19 Amendment 2 gains the eligibility paragraph.
2. **Numeric:** none new.
3. **Check:** `lib/plan/repeatsRepeat.test.ts`, "the sibling is at least as eligible as its row on every axis but phase".
