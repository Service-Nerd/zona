# Coaching Board: the shape of a strength session (2026-10-28)

**Founder:** "Take all board sittings first then create plan to build", after using two strength sessions: *are we varying
rep and set ranges for the same exercises with different weights? To target strength and toning? Do we take sets down on
deload weeks? I noticed a lot of repeating main lifts. Do we not focus on upper and lower and always include core? I'm used
to super setting ... the warm up to be 2 or 3 rounds of 4 exercises or even 6 ... super setting each of the main session.*
Items: `STRENGTH-NO-LEGS-RESIT-01` (A), `STRENGTH-AB-SESSIONS-01` (A2), `STRENGTH-REP-BLOCKS-01` (C),
`STRENGTH-SUPERSET-MAINS-01` (D). Blagrove sits.

## Evidence (measured 2026-10-28, today's engine; 1,605 strength plans over generated run plans, `strengthProfileGrid`)

**The founder's plan** (general focus, 60 min, chosen days Mon + Wed, a Tuesday quality run from week 3): weeks 3 and 4
are two **identical** upper body + core sessions (bench, inverted row, the same accessories, calf raise as the only leg
work). The plan already carries `legs_day_suggestion: tue` (stack after the quality run, 6 weeks of legs), shown on the
strength setup and change screens, never on the session.

| | all | engine picks the days | runner chose the days |
|---|---|---|---|
| training weeks (2+ sessions) with **no heavy-leg session** | 22.9% | 8.5% | **52.0%** |
| plans with **2+ consecutive** such weeks | 23.2% | | |
| weeks whose two sessions are **identical** | **34.0%** | | |

Prototypes of S2 (in throwaway worktrees): **P1**, heavy legs allowed the day AFTER a hard run: no-leg weeks 22.9% → 10.9%
(chosen days 52.0% → 32.7%). **P2**, no clear days required AFTER heavy legs (legs the day before a hard run): → 1.6%, but
identical sessions rise to 47.3%.

**Dose today (S6):** reps fixed by role (heavy running-lower 5, other mains 8, accessories 10, core 30 s); sets change by
phase (3; peak −1; taper 2 / 1; **deload × 0.6**, so the founder's week-2 deload ran 2 × 8 and single accessory sets); load
moves only from logs (S14); an exercise is held `BLOCK_WEEKS` (4) then its next variant. **Supersets today (S10):**
accessories and core pair across regions; main lifts are straight sets. Pairing a lower with an upper main lift where a
session holds both: 15% of training sessions, saves 7.0 min (5.8 / 7.3 / 7.7 at 30 / 45 / 60). **Warm-up:** one pass of
6–7 moves ≈ 4.7 min against `WARMUP_MINUTES` 6 / 8 / 10.

## Conflict scan

- **S2 / §7** (heavy legs never the day before or after a hard run): P1 and P2 each break it.
- **S3 Am.2 (STRENGTH-CHOSEN-NO-LEGS-01, 2026-10-19, settled ground)**: this board already ruled the converted session keeps
  light leg work (calf, hip abduction, RIR ≥ 3) and the plan names the swap day. The founder's plan was the measured case.
  **New evidence today:** the 52.0% rate, the identical pair, and the founder in the sessions.
- **S6** (BLOCK_WEEKS, fixed reps by role) and **S14** (load from logs; one rise a week per lift).
- **S10** (supersets count rest once per round; never shorten rest; FILL_ORDER accessory, core, main).
- **S11** (core twice a week) and **S1** (2 sessions → full body × 2): both honoured; S1 is what the conversion overrides.

## The seats

🏃 **Hutchinson (chair).** We ruled the no-legs case nine days ago and the ruling was right on safety: heavy legs beside a
hard run is the thing §7 exists to stop, and both prototypes do exactly that. What the ruling did not solve is that the
runner on the session has no idea why there are no legs, and two identical sessions in one week look like a bug. That is
fixable without touching S2.

💪 **Blagrove.** Three separate things. First, A/B sessions: two full-body or two upper sessions in a week should not be
the same session. Standard practice is an A and a B, each lift appearing once a week, which still lets S14 progress it
weekly. Second, rep ranges: linear and undulating rep schemes give similar strength and size when volume is matched
(meta-analyses, moderate evidence); there is no case for changing reps every session, but a block-to-block cycle on
**general** focus is defensible and gives the variety the founder is asking for. Running focus keeps its heavy 5s: that is
the running-economy dose. "Toning" is not a training outcome; I will not have the app claim it. Third, supersets: pairing a
lower main with an upper main is fine at RIR 2 if each muscle still gets its full rest, which it does when the pair rests
the longer of the two. Never two lower lifts together, never a heavy lower lift with a plyometric.

🎯 **McMillan.** The founder's instinct is the instinct of most people who have lifted in a gym: parts, rounds, pairs.
Give it to him where it is coaching-neutral. Warm-up as two rounds of a shorter list is better practice than one pass of
seven, at 45 and 60 minutes. At 30 there is not the time.

🩹 **Willy.** Against P1 and P2, as nine days ago. On pairing mains: acceptable with the rest rule Blagrove states; I want
the heavy-legs rest (150 s) to be the pair's rest, not the 90 s. On light legs: I would accept one submaximal knee-dominant
item on a converted day (a split squat at RIR 4, two sets) if it is measured not to count as heavy and not to land the day
before a hard run; without that measurement, calf and hip stay the limit.

⚕️ **Sims.** A and B matters more for the women in this cohort than for anyone: two identical upper days and no lower
loading for weeks is the bone-loading gap I flagged in S10. Surface the swap day where the runner will act on it.

📊 **Seiler.** No objection from this seat.

## Recorded disagreements

- **Willy vs McMillan on light legs:** McMillan would add a knee-dominant item to converted days now; Willy only after it is
  measured against S2. Not ruled beyond calf and hip.

## Ruling

- **A, `STRENGTH-NO-LEGS-RESIT-01`: S2 is unchanged.** P1 and P2 are **INCORRECT** (each puts heavy legs beside a hard run;
  Willy, Hutchinson). S3 Am.2 stands. **CORRECT:** a converted session says so on the session, with the swap day the plan
  already holds (`legs_day_suggestion`), in the founder's words. A knee-dominant light item is **INSUFFICIENT EVIDENCE**
  (prototype and measure against S2 first).
- **A2, `STRENGTH-AB-SESSIONS-01`: CORRECT.** Two sessions of the same kind in one week are an A and a B: different variants
  (or a different accessory) in each slot, each lift once a week, still held `BLOCK_WEEKS` so S14 progresses it. **Check:**
  no two training sessions in one week are identical.
- **C, `STRENGTH-REP-BLOCKS-01`: CORRECT WITH AMENDMENT.** General focus cycles main-lift reps by block (`BLOCK_WEEKS`), for
  example 10 → 8 → 6, with load from the runner's logs (S14). Running focus keeps heavy 5s on its lower mains. No "toning"
  goal and no toning claim on any surface (outcome claim, Blagrove). Shown to the runner as the session's target, not as a
  range they must pick from. Exact numbers set at build with `strength:sweep` time measured.
- **D, `STRENGTH-SUPERSET-MAINS-01`: CORRECT WITH AMENDMENT.** A session holding both a lower and an upper main lift pairs
  them as a superset; the pair rests the LONGER of the two rests (heavy legs 150 s); never two lower lifts, never a heavy
  lift with a plyometric. Time saved goes to S10's fill order. **Warm-up: CORRECT** as `WARMUP_ROUNDS` rounds of a shorter
  list at 45 and 60 minutes (2 rounds of 4–5), one round at 30.

## Artifacts at build

StrengthPrinciples S6 Am. (rep blocks), S10 Am. (main pairs, warm-up rounds), S3 Am.3 (said on the session), S1 Am.3 (A/B);
`STRENGTH_CONFIG` constants for the rep cycle, `WARMUP_ROUNDS`, `WARMUP_ITEMS_PER_ROUND`; checks `S-AB-DISTINCT`,
`S-MAIN-PAIR-REST`, `S-WARMUP-ROUNDS`, plus `strength:sweep` measured before and after.

## SLT escalation

None.
