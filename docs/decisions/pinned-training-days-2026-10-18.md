# Boards — the runner picks their training days, and sessions stay on them (PINNED-DAYS-01)

**Sat:** 2026-10-18. **Founder, verbatim:** *"I want to be able to select what days I can strength train on. Today I
think we select what we can't do. I'd think for both the run plan and strength plan we should say what days we can do
and not what we can't. If I chose to select strength on same day as a run so be it. But I want to be able to select
the days and it stays on the days I select."*

**Measured first (the founder's own strength plan):** 2 sessions a week, Thu–Sun blocked → 3 allowed days for 2
sessions, so the engine CHOSE which two each week: Mon/Wed in 5 weeks, Mon/Tue in one, one session in taper, mobility
in race week. Placement already fills every allowed day when allowed days = sessions; the movement came from the
question, not the engine. The run wizard already asks positively (`WeekGrid`); "Change your plan" still asks a count
plus "Days you cannot run".

## Coaching Board (Hutchinson chair; Blagrove, Willy, McMillan, Sims, Seiler)
**Conflict scan:** S1 (frequency → now the runner's days), S2 (heavy legs: legal days, 48 h spacing), S3 (never skip,
convert; Am.1 no strength on a two-run day), S4 (stacked after a run, ≥3 h), S5 (taper fewer, race week mobility, none
on race day or the day before), §126 (doubles).
- **Blagrove:** the habit lives on fixed days; the engine should decide what goes on a day, never which day. A chosen
  day that cannot take heavy legs takes upper body and core: that is S3 already.
- **Willy:** two chosen days back to back is fine: one heavy, one upper. Spacing stays the engine's job.
- **McMillan:** *"stays on the days I select"* is the whole ask. Honour it; say plainly the two weeks it cannot.
- **Hutchinson:** the exceptions that remain are safety, not preference: race day and the day before, the taper's
  fewer sessions, race week's single mobility session, and a day the runner has made a two-run day (three sessions in a
  day). Lifting on a day with one run is allowed and already carries the after-run note.
- **Sims, Seiler:** no objection.
**Ruling: CORRECT WITH AMENDMENT.** S1 Am.2: when the runner picks days (1–4), those days ARE the sessions; the engine
chooses only what goes on each (S2/S3), never moves one. A chosen day is left empty only for the S5 and S3 Am.1
exceptions above, never re-placed. **Artifacts:** S1 Am.2 · `MAX_CHOSEN_DAYS` (= the 4 of `SESSIONS_PER_WEEK_RANGE`)
· invariant `S-PINNED-DAYS` (in a base/build/peak/deload week every chosen day holds a session unless an exception
applies, and no session sits off a chosen day).

## Design Board (Zhuo chair; Silvanto, Sierra, Wroblewski, Collins)
**Settled-ground scan:** `SHEET-DAY-QUESTION-01` (2026-10-05) declined collapsing the sheet into one WEEK GRID because
it *"breaks the sheet's own one-row-per-setting architecture"*; `SHEET-CONTROL-VOCAB-01` found the two run-day rows ask
one question as two controls (*"6 declared / 6 blocked yields 1 run a week"*). STRENGTH-APP-01 setup ruling (seven
questions, ordered by weight).
- **Zhuo:** one question, asked the way the runner thinks: *which days*. A count plus a "can't" list is the engine's
  shape, not theirs.
- **Wroblewski:** strength: one `DayGridSelector`, positive, up to four; the count disappears because the picks are the
  count. Runs: the two rows become ONE row, *Days you run*, the same selector, 2–6. That keeps one row per setting, so
  it does not reverse 10-05; it removes the contradiction that ruling worked around.
- **Sierra:** say what happens: *"Your sessions stay on these days."*
- **Silvanto:** shared controls, no new type or colour. No veto.
- **Collins:** argued for the wizard's full `WeekGrid` (run / long per day) in the sheet. **Lost:** the long-run day is
  already its own row; the grid would make one row carry two settings, which is what 10-05 refused.
**Ruling: SHIP WITH AMENDMENT.** Strength setup: *"Which days can you lift?"* (1–4) replaces *How many a week?* and
*Days you can't*. Change your plan: *"Days you run"* (2–6) replaces *Days a week* and *Days you cannot run*.
**Artifacts:** pattern note in `ui-patterns.md` § Day selection · copy in `lib/strength-bridge/display.ts` /
`lib/plan/modifyPlan.ts` · checks in `strengthSetupDays.markup.test.ts` and `modifyPlanRunDays.test.ts`.

## SLT
Not needed: no tier change (strength paid; Change your plan rows keep their gates).

## Build findings (2026-10-18, folded in)
- **Long-run day must be a run day.** Measured across 512 generated plans: with the long-run day outside the chosen
  run days, 642 plan-weeks put the long run on a blocked weekend day (`INV-PLAN-NO-SESSIONS-ON-BLOCKED-DAYS` logging in
  production); 0 when it was inside. The old two rows could reach it (block Sat and Sun). The new row refuses a pick
  with no weekend day and moves the long run when its day is dropped. Held by a composition test through
  `generateRulePlan`.
- **Strength in the last week before a race (S5), engine defect.** Placement took the earliest allowed days, so a taper
  week's late days (inside the 7 days before the race) were never reached by accident. Chosen late days (or a long
  unavailable list) put upper-body sessions there (`S-RACE-WEEK`). Fixed in placement; the presence check exempts the
  window.
- **First jump level (S8), engine defect.** Jump level climbed from the week the gate OPENED, so a runner whose days held
  no leg day until week 13 met a level-2 jump first (`S-PLYO-START-LEVEL`). It now climbs from the first jump placed.
- Both strength defects were found by adding chosen-day profiles to the sweep grid, not by a test written for them.

## Design Board — icons (ICON-RULE-01 × this ruling)
Merging the day rows left the sheet at 7 setting rows; ICON-RULE-01 allows location icons at >= 8. **Zhuo:** the bound
was argued on a finding job and the list got shorter; moving 8 to 7 to fit the build is the ratchet this repo refuses.
**Wroblewski:** 7 rows in labelled groups of 4/2/1, and the eyebrows locate. **Sierra:** the runner opens this to
change a thing they can name. **Collins:** without the job a glyph is decoration; the door's lone dumbbell goes too.
**Silvanto:** dissent, the glyph language now changes between Me and the sheet; no veto (not a regression).
**Ruling: SHIP WITH AMENDMENT.** Bound unchanged; icons off the sheet (rows + Strength door); Me keeps them.
