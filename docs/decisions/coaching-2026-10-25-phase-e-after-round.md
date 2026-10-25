# Coaching Board — NO-RUNNER-TURNED-AWAY-01 Phase E, the after-round (2026-10-25, fifth sitting)

**Trigger:** soft, qualifies. The founder's rule for this item: fit-for-purpose measurements before and after, and a
coach review with full plan analysis before anything is switched on. Phases B to D are built and dark.
**Proposed change:** rule on what the after-measurement found, and on whether the staged plan as built is fit to
switch on.

## Evidence (weighted marathon population, stride 7; `measure:envelope --staging`, `cohort-review.ts --staging`, `scripts/checkpoint-outcomes.ts`)

| | Before (B2) | After (D) |
|---|---|---|
| Marathon refused | 5.6% | **0%** |
| Staged (clean, at the door, best case) | 6.2% (4.2%) | 11.8% (5.0%) |
| Founder's bar | 84.2% | 85.0% |
| `review:coaching` (full) | all steps pass | all steps pass, no rate moved (flag off) |

**What a staged runner actually gets at the checkpoint** (share of staged weight):

| They ran | Race block | Only "a later race" | More base building |
|---|---|---|---|
| 100% of target | 33.2% | 66.8% | 0% |
| 90% | 0% | 80.0% | 20.0% |
| 75% | 0% | 87.1% | 12.8% |

**Why the 66.8% do not fit (at 100%):** walk-run, the race block is shorter than §44's (20.4%); walk-run, §113 at the
checkpoint because the ramp never builds a 5 km run (16.2%); ramp WEEK1-LEAP (7.9%, +5.0% with LONG-RUN-SHORT);
LONG-RUN-SHORT (12.6%).

**Re-asking cleanliness on observed facts** (NO-RUNNER-CHECKPOINT-NOFIT-01's question): **1.5%** of staged. The
build note that suggested 84 of 117 was an unweighted grid with an assumed 6 km long run, and is withdrawn.

**A half marathon on the same date**, built from what they ran: **clean for 28.3%** of staged at 100% (ramp 15.6%,
walk-run 12.7%), 21.2% at 90%. Still refused by §113 for 22.1% (walk-run).

## Conflict scan

§116 Am. 7 (never credited in advance) · Am. 9 (C1–C5, Q1–Q4) · floor note + L1–L5 · §113 (5 km floor) ·
`FOUNDATION_LONG_RUN_MAX_PCT` 35 (ramp long run) · §44 (block) · §117 (run-walk) · §111 · ADR-012 (the runner chooses
a structural change) · Design Board amendment 7 (at most three options, recommended first). E2 as asked conflicts with
the 35% cap: a 5 km long run inside a 12 km week is 42%.

## The board

**🏃 Hutchinson (chair).** Two numbers matter. Refusals went from 5.6% to zero, which is what the founder asked for. And
two-thirds of the runners we stage will, on the best case, be told at the checkpoint that their race does not fit.
That is not a lie as long as we have said so from the start; it becomes one if day one promises "Marathon training from
23 November" to a runner the engine already knows has no fitting target (`target_found: false`). The fix is honesty on
day one, and a better offer at the checkpoint, not a looser rule.

**📊 Seiler.** No objection. All easy, and the half option is a normal race plan.

**🎯 McMillan.** E1 is what a coach says in that conversation: "you won't be ready for the full marathon on the 25th,
but you can be on the start line of the half." Same day, same trip, often the same event. It turns a third of the
"later race" outcomes into a race on their date. On E3: never make someone who finished the walk-run start do it again.
Hold them at 6/1 for a couple of weeks and then start the ramp.

**🩹 Willy.** E2: no. Either the ramp's long run goes to 42% of the week, past the 35% cap I set for this population,
or the target rises to 14.3 km and the ramp gets longer than these runways allow. Both are the leap the ramp exists to
remove. The 16% are runners the calendar cannot serve for that date, and the half or a later race is the honest answer.
E3: agree with McMillan, two weeks at 6/1, then §116's ramp from 6 km, only where the runway still holds the block.

**⚕️ Sims.** Many of these are charity runners who signed up to a marathon. The half has to be offered, never
substituted, and the runner chooses. And I hold my point from the third sitting: no surprise at the checkpoint. A
runner whose target was not found at signup is told on day one.

**💪 Blagrove.** Silent.

## Recorded disagreements

None on the rulings. **Sims and McMillan on emphasis (E1):** McMillan would make the half the recommended option when
the marathon does not fit; Sims would keep it second to the runner's own race. **Settled:** the marathon outcome, when
available, stays first; when it is not, the half is recommended and labelled as a different race.

## Ruling — CORRECT WITH AMENDMENT

| # | Ruling |
|---|---|
| **E0** | **Not fit to switch on as built.** Switch-on is gated on E0a, E1 and E3 built, and this round's measurement re-run and reported to the founder. Turning it on remains the founder's decision |
| **E0a** | **Day one says it.** A staged plan whose target was not found (`target_found: false`) must not present the race block as a certainty. What it says instead is the founder's words, its encoding the Design Board's (Sims, third sitting) |
| **E1** | At the checkpoint, where the marathon block does not fit, offer **the half marathon on the same date** wherever the engine builds it clean from what they ran (same producer test as every option). Offered, never substituted (ADR-012). Order: more base building, the half, run-walk, a later race last; at most three, a later race always kept |
| **E2** | **No change.** Neither a 42% long run nor a higher target is acceptable here (Willy). These runners are served by the half (where §113 allows) or a later race |
| **E3** | Below the running floor at the checkpoint, after a walk-run start: **resume, never restart**. Hold §117's 6/1 for `WALK_RUN_RESUME_WEEKS` (2), then §116's ramp from `BASE_BUILD_ONRAMP_MIN_START_KM`, only where the runway still leaves §44's block; otherwise a later race |
| **E4** | Coaching side settled: a run logged with a date inside the base-building weeks counts toward the checkpoint exactly as Q2 counts any run (linked + off-plan). The picker is the Design Board's |
| **E5** | `NO-RUNNER-CHECKPOINT-NOFIT-01` withdrawn: measured at 1.5%, and E1 serves the same runners better |

## Artifacts (at build)

1. **Principle** — §116 Am. 9 gains E0a, E1, E3 and the switch-on gate; NOFIT withdrawal recorded.
2. **Numeric** — `WALK_RUN_RESUME_WEEKS = 2` (E3). E1 adds none (it reuses the race-block test).
3. **Checks** — E1: an option is offered only where its plan is clean (the existing producer-test pattern, falsified);
   E3: `INV-PLAN-WALKRUN-START-PROGRESSION` extended so a resumed plan begins at 6/1 and never at 1/2; E0a: a markup
   arm that a `target_found: false` plan never renders the certain race-block line.

## SLT escalation

None. The switch-on is the founder's.

## What this does not settle

The words (E0a, the half option's label). The five living runners' remediation. Nothing has run on a device.
