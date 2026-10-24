# Coaching Board — NO-RUNNER-TURNED-AWAY-01, the four numbers (2026-10-24, second sitting)

**Trigger:** soft, qualifies. The morning ruling (`coaching-2026-10-24-no-runner-turned-away.md`) set the shape and left
four values unset that the build cannot proceed without; acceptance criterion 6 requires the scoring definition before
any code.

## Evidence brought

| | |
|---|---|
| Weeks to reach the 12 km door, by start | 10 km: **3** · 8: **6** · 6: **9** · 5: **11** · 3: **16** · 2: **20** |
| At a 26-week runway, weeks left for the race | 10: 23 · 8: 20 · 6: 17 · **5: 15** · 3: 10 · 2: 6 |
| §44 marathon thresholds | block **10** weeks, warn **16** |
| §116's floor | `BASE_BUILD_ONRAMP_MIN_START_KM = 6`, Willy: *"below this the runner is not someone a RUNNING ramp serves … run-walk is for someone who cannot … RUN-WALK IS EXPLICITLY NOT SCOPED"* |
| §117 run-walk endpoint | `FINISH_GOAL_RUNWALK_RUN_MINS 6 / WALK_MINS 1` |
| Observed load owner | `weeklyActualLoad.ts`: `totalKm` = linked + off-plan (§2 Am. 4 clause 1, *"actual load is a measurement of what happened"*) |
| 🔴 **The two live base-build runners** | tom0508richards: planned **21 km** over 2 weeks, recorded **3.1**. sheenameek84: planned **16.5 km** over 3 weeks, recorded **0**: no activities, no completions. **`baseBuildHandover.ts` regenerates their race plan from the block's PLANNED end volume (37.9 and 18.9 km/wk)**, which is the credit-in-advance the September veto forbade |

## Conflict scan

§111 ratio (unchanged) · §116 Am. 1/3/6/7 · §116's floor note on run-walk (**amended by name below**) · §117's run-walk
door and ratio (reused) · §44 thresholds (reused) · §2 Am. 4 clause 1 (reused) · §3 cadence (reused) ·
`S111-FOUNDATION-CREDIT-01` (veto, upheld) · `ZERO-REJECTION-SERVED-01` (the measurement lesson).

## The board

**🏃 Hutchinson (chair).** The Tom and Sheena numbers decide question 2 before anyone speaks. A checkpoint on planned
volume would have passed both of them into marathon training on three kilometres and zero. Observed volume is not a
preference; it is the whole of Amendment 7.

**📊 Seiler.** All four answers stay easy-only until the race block. No objection to any of them on distribution.

**🎯 McMillan.** On Q1: a 5 km/week runner with 26 weeks is the charity runner, and telling them their checkpoint is in
eleven weeks and then fifteen weeks of marathon is honest and coachable. I would rather use §44's BLOCK line (10 weeks)
as the floor for the race block than its warn line, because a warn is a warning the runner can accept, not a wall. On
Q2 I would round: 11.6 against 12 is a pass in any coaching office I have worked in.

**🩹 Willy.** On Q1 and Q3 together: my floor was about RUNNING, and it stands. Below 6 km a week the start is
walk-run, which I said was out of scope in September because nobody had asked; the founder has now asked, so I amend
my own note. The walk-run start progresses the run share, not the distance: from 1 minute run / 2 walk to §117's
6 / 1, then the running ramp takes over at 6 km. On Q2: no rounding. **A tolerance on the door is a credit by another
name**, and the door already carries its own margin.

**⚕️ Sims.** Walk-run is where the women I worry about start, often after years off. Three sessions a week, not four:
recovery between impact days matters more at this stage than frequency, and the fuelling note carries (§116 Am. 4).
On Q2, I agree with Willy: the checkpoint must not pass a runner who has barely run, and Sheena's zero is the case.

**💪 Blagrove.** Silent.

## Recorded disagreements

1. **McMillan vs Willy on rounding (Q2).** McMillan: 11.6 passes. Willy: any tolerance is a credit. **Ruled for
   Willy**, with McMillan's point kept where it belongs: the outcome screen's recommended option for a near-miss is a
   **two-week extension**, which is the coaching-office answer without crediting volume.
2. **McMillan vs the warn line (Q1).** Ruled for McMillan: the race block needs at least §44's **block** threshold
   (10 weeks), and a staged plan landing between block and warn carries §44's existing warning, acknowledged at the
   wizard like any other.

## Ruling — CORRECT WITH AMENDMENT

| # | Question | Ruling | Numeric (new unless named) |
|---|---|---|---|
| **Q1** | Where is the checkpoint? | At the week the ramp reaches §111's door for this runner, **provided at least §44's block threshold remains for the race block**. If the door cannot be reached with that much left, the checkpoint sits at `runway − block` and its outcome is whatever the observed volume says. Starts at or above 6 km use §116's ramp; below 6 km use the walk-run start (Q3) first | `BASE_BUILD_CHECKPOINT_MIN_RACE_WEEKS` = §44 block (**reused**, not a new number) |
| **Q2** | What is "observed"? | **Mean of `totalKm` over the final two non-deload weeks before the checkpoint** (linked + off-plan, §2 Am. 4). Pass is `≥` the door, **no tolerance** (Willy). Zero recorded runs is the "no runs recorded" state, never a pass | `BASE_BUILD_CHECKPOINT_OBSERVED_WEEKS = 2` |
| **Q3** | The walk-run start (below 6 km/week, including 0) | **§116's floor note amended by name.** Three sessions a week (Sims), 30 minutes, run/walk from **1/2** to §117's **6/1** (reused), the run share stepping up once a week, §3's deload every fourth week held at the previous step. When it reaches 6/1 the §116 running ramp starts at 6 km. Fuelling note carried | `WALK_RUN_START_SESSIONS = 3`, `WALK_RUN_START_MINS = 30`, `WALK_RUN_START_RUN_MINS = 1`, `WALK_RUN_START_WALK_MINS = 2`; endpoint reuses `FINISH_GOAL_RUNWALK_RUN_MINS / WALK_MINS` |
| **Q4** | How a staged plan is scored | In `measure:envelope` and `review:cohort`, a base-volume case that is staged is scored as the **composed plan**: the generated base-building weeks plus the race plan generated from the checkpoint with `current_weekly_km` = the door (the pass case, exactly at the line), validated and objected to like any other plan. **Both figures are reported**: the existing one, and the founder's bar, where a staged plan counts as served only if its composed plan is clean. The pass-at-the-door assumption is **printed beside the number** (chair), because it is the best case | none; a measurement definition, owned by `coaching-measurement.md` |

**The handover defect is ruled a defect against §116 Am. 7** and is fixed in this build: `handoverInput` reads
observed volume through the Q2 rule, never `base_build_target_km`.

## Artifacts (at build, one commit with the morning ruling's)

1. **Principle** — §116 Am. 9 (staged race plan, Q1, Q2), §116 floor note amended (Q3), §118 Am. 4 (walk-run start),
   `coaching-measurement.md` (Q4).
2. **Numeric** — the five constants above in `GENERATION_CONFIG`.
3. **Invariants** — `INV-PLAN-ONRAMP-NO-RACE-BLOCK-BEFORE-CHECKPOINT`; `INV-PLAN-WALKRUN-START-PROGRESSION` (run share
   never steps more than one level a week; deload holds); a behavioural test that a planned ≠ observed checkpoint
   **fails** to pass.

## SLT escalation

None.

## What this does not settle

What Tom and Sheena are told, and whether their plans are restaged: the founder's remediation call. Nothing has run
on a device.
