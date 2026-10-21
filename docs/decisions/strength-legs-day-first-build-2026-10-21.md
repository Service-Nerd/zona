# Design Board — the legs-day line on a first strength build (2026-10-21)

**Item:** `STRENGTH-LEGS-DAY-FIRST-BUILD-01`. The line naming the day that would give a proper leg session
(`STRENGTH-LEGS-DAY-01`) shows on the setup note, which reads a stored plan, and on *Here is what changes*, which a first
build skips (`SAVE-PATTERN-01`: strength confirms only when an existing plan changes). A first build lands on Plan with
*"Strength plan built. You lift on Mon and Wed."* and nothing else.

**Measured.** Engine, 180 chosen-day strength plans (profile grid × sampled run plans, read in code, not on a device):
172 carry `legs_limited_by_run_week`, 167 carry `legs_day_suggestion`. The grid's day picks are adversarial, so 93% is
the grid, not the population. Production: one strength plan (the founder's, General, Mon/Wed, generated 2026-10-18
20:14). It is legs-limited and has **no suggestion**, because it was built before `STRENGTH-LEGS-DAY-01` shipped, and
`GET /api/strength/plan` rebuilds only when the run week changes. Filed as `STRENGTH-ENGINE-REACH-01`.

## Settled ground
- `SAVE-PATTERN-01`: land on Plan with **one readback line naming the change**, FieldReadback weight, until the runner
  leaves. The consent screen is for an existing plan changing.
- `STRENGTH-LEGS-DAY-01`: name the day, never move one (Collins); one line.
- `STRENGTH-CHOSEN-NO-LEGS-01`: said where the plan is in hand, never guessed in the client.

## Seats
- **Zhuo (chair).** The ruling sent the line to the two places where a runner revises an existing plan, and the runner
  who most needs it is the one choosing days for the first time. That is the item's premise, and it holds. Success
  condition: every first build that carries a suggestion says it once, before the runner leaves Plan.
- **Wroblewski.** Three options. Routing a first build through *Here is what changes* adds a screen to every first
  build to serve some of them, and reverses `SAVE-PATTERN-01` by name. A live preview in setup costs a round trip per
  tap on the day grid. The readback is already on screen, already the runner's next read, and costs nothing. Acting on
  it is reopen setup, swap one day, accept: the normal edit journey.
- **Sierra.** Telling them where they choose would be better than telling them after. But the advice is in the
  runner's terms and they can act on it in one swap, so after is acceptable and silence is not.
- **Silvanto.** The readback confirms; advice in it is a second job. Acceptable at the same weight in the same
  `FieldReadback`, as a second sentence, only when the engine stamped it. No new component, no new type size.
- **Collins.** Reopening setup is not enough: nobody reopens a screen they have just finished. Wants it on the first
  build. Agrees with the readback.

No recorded disagreement on the ruling. Sierra's "say it at the moment of choosing" is noted as better and declined on
cost: it needs a preview on every day tap.

## Veto check
None. No palette or type change.

## Ruling: SHIP WITH AMENDMENT
On a **first** strength build whose plan carries `legs_day_suggestion`, the Plan readback is the existing first-build
sentence followed by `legsDayLine(suggestion)`, as one `FieldReadback`. Not on an update (*Here is what changes*
already said it). No new copy: both sentences are founder-approved, joined. Built in `strengthPlanReadback`, the
readback's one owner.

## Artifacts (with the build)
1. Pattern: `ui-patterns.md` § the plan-change readback: a first build may carry one engine-stamped advice sentence.
2. Constant: none new; `STRENGTH_SETUP.legsDayLine`.
3. Check: `strengthPlanReadback(null, plan)` contains the day line when stamped and not otherwise, and an update never
   carries it; falsified by removing the branch.

## Does not settle
The legs-limited note (*"…so they get lighter leg work."*) still shows only on reopening setup; nobody asked, and the
day line is the actionable half. Not seen on a device.
