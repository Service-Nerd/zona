# Coaching Board — 2026-11-20 (follow-up). `PLAN-NOTE-HEAVIER-WEEK-PLACEMENT-01` — does week N tell the runner?

**Trigger:** soft trigger, qualifies. This is a hand-off from the Design Board, not an edit. No doctrine file is
touched here. The question is whether a binding this board made on 2026-10-28 is still met if the plan-level tile
stops carrying it.
**Hand-off, verbatim** (`docs/decisions/design-2026-11-20-plan-note-heavier-week-placement-01.md`): *"Coaching Board:
only for the later rank sitting: whether the week-N surfaces discharge its 2026-10-28 binding"*, and under what it
does not settle, *"The plan-level tile's rank (deliberately; next sitting, on a measurement)"*.
**Questions:** (1) Do the ruled week-N surfaces discharge the 2026-10-28 binding for a FREE runner? (2) Where does the
plan-level `Heavier week` tile rank?
Seats: Hutchinson (chair), Seiler, McMillan, Willy, Sims, Blagrove.

**Settled ground (not re-ruled):** the morning Design Board ruling, SHIP WITH AMENDMENT (5). That covers a muted
eyebrow mark on week N in `WeekCard` and `WeekStripCard` (it replaces `· peak`), one `--ink-2` line on the WeekCard
(the action half, no percentages), the Today identity through `weekIdentity` ranked race › deload › taper ›
**heavier** › phase, one vocabulary (`Heavier week`), and mockups plus a device check before merge.

---

## The binding being tested

Coaching Board 2026-10-28, `INJURY-PEAK-JUMP-01`, now **§90 Amendment 3**. It reads: *"When `INV-PLAN-DELIVERED-RAMP`
or `INV-PLAN-INJURY-CAP-DELIVERED` warns, the plan carries `load_residual_note` **and the plan screen shows it**."* Its
reason: *"§34 requires an accepted residual to be declared."* Willy said at that sitting: *"the warn only protects her if
somebody reads it, and the runner is the somebody."* The enforcing test is `lib/plan/loadResidualNote.test.ts`
(*warned ⇒ stamped and shown*), and today "shown" means `planRationaleNotes`, the plan-level tile.

## 📐 Analysis: the stated figures re-derived

Evidence: `scripts/board-evidence-plan-note-heavier-week-placement-01-followup.ts` (read-only).
`NODE_ENV=production npx tsx scripts/board-evidence-plan-note-heavier-week-placement-01-followup.ts 23 free [injury]`.
It uses cohortGrid at stride 23 (1,728 plans generated, 76 threw). The 2026-11-14 measurement used the same stride. Tier
is `free`, and a second run at stride 131 with `trial` gave identical carrier counts (58/58), so the note does not depend
on tier. Plan-level ranks other than today's are computed by a **replica** of `planRationaleNotes`. Before any other rank
was read, the replica was **asserted label-for-label identical to the real producer at today's rank on all 1,728 plans:
0 mismatches.**

| | 2026-11-14 (stride 23) | **Today, healthy** | Today, `knee` overlay | Today, `achilles` overlay |
|---|---|---|---|---|
| warned by either ramp check (`validatePlan` on the composed plan) | — | **322** | 258 | 444 |
| carry `load_residual_note` + `load_residual_week` | 322 | **322**, 0 warned-not-carrier, 0 carrier-not-warned | 258 / 0 / 0 | 444 / 0 / 0 |
| week N present in `plan.weeks` | — | **322 of 322** | 258 of 258 | 444 of 444 |
| week N is the plan's first week | — | **0** (so a "Next" card always precedes it) | 0 | 0 |
| injury-scope note (*"above the … ceiling your injury history sets"*) | — | 0 (cohortGrid does not vary injury) | **149 (57.8%)** | **323 (72.7%)** |
| warned plans with **more than one** warned week | — | **94 of 322 (29.2%)** | 37 (14.3%) | 132 (29.7%) |

**The plan-level tile at five ranks**, for carriers. "Displacing" means another tile the runner would otherwise see is pushed
out. It is counted against the tile-absent baseline.

| rank | healthy shown | healthy displacing | of which | knee shown / displacing | achilles shown / displacing |
|---|---|---|---|---|---|
| **today** (ahead of `Long run`) | 322 (100%) | **182 (56.5%)** | Coming back 55 · Your level 47 · **Long run 24** · Your peak 22 · Hard sessions 17 · Your days 9 · Recovery week 8 · Shaped for you 4 · Your target 1 | 258 / 134 | 444 / 212 |
| behind `Long run` | 298 (92.5%) | 158 | as above less Long run | 236 / 121 | 419 / 187 |
| last among constraints | 176 (54.7%) | 40 | Your peak 22 · Your days 9 · Coming back 5 · Shaped for you 4 | 124 / 10 | 278 / 47 |
| dead last | 136 (42.2%) | **0** | — | 114 / 0 | 231 / 0 |
| goes | 0 | 0 | — | 0 / 0 | 0 / 0 |

The 2026-11-14 row reproduces exactly: 322 / 176 / 136 shown, 182 / 40 / 0 displacing, `Long run` 24 / 0. The engine has
not moved under it.

**Production (read-only):** 43 plans. **1 carries `load_residual_week`, and its week N is in the future.** 15 more carry an
older `load_residual_note` with no week. Those are never rendered by design (§90 Am.3: pre-28-Oct notes over-declared).
The live-plan policy settles them (new plans only); recorded below, not filed.

**Reach, read from code:**
- **Calendar.** `PlanCalendar` is rendered for every tier (`DashboardClient.tsx` ~5286), with no tier gate in the
  component. It renders **above** the "Why this plan" stack. The ruled mark sits on the same screen as the tile it would
  replace, higher up.
- **Today.** `weekIdentity(currentWeek)` is computed with no tier gate (`TodayScreen.tsx:1060`). The paid coach line is
  behind `hasPaidAccess` (`:1901`). For a FREE runner, Today in week N carries the **label only**.
- **What the free runner would read on week N, as ruled:** the word `Heavier week` (strip and card eyebrow, and Today),
  plus, on the Now/Next card, the action: *"keep the easy days easy, move the long run rather than shorten it"*.
  **What they would lose if the tile went:** the statement that the week rises **above the weekly ceiling the plan
  otherwise holds**. For the injury-scope note, they would also lose that the ceiling is **set by their injury
  history**. That is the residual itself, the thing §90 Am.3 exists to declare, and it is on 57.8% (knee) and 72.7%
  (Achilles) of injured carriers.

**What the evidence cannot show:** whether runners look at the calendar row or the tile (nothing is built), how either
reads on a phone, and whether being told changes what a runner does in week N. Nothing here is outcome data.
Foundation-block plans are not reached: the grid pins `plan_start`, so 0 carriers had a foundation block.

---

## 🔍 Conflict scan

- **§90 Amendment 3** (the binding). Its words are *"the plan screen shows it"*. The week-N surfaces are on the plan
  screen and on Today, so the surface clause can be met. Its reason is that the residual is **declared**. A bare
  `Heavier week` label and an action line do not declare it: every build week is heavier than the last, so the word
  alone says nothing the calendar does not already say. **This is the one place the ruled encoding falls short of the
  binding's meaning.**
- **§90 Amendment 2** (producer cap knee/shin, checker on load-bearing injuries). Untouched. The injury-scope wording is
  that amendment's output, and it is the part a free injured runner would lose.
- **§34**, as cited by §90 Am.3, is not the clause it is cited for. §34 is *"Invariant registry: declared and
  exercised"*. The declared-residual rule the 10-28 sitting relied on is stated in §90 Am.3 itself. No conflict, but it
  is a mis-citation. Observed, not filed.
- **§18 rules (SLT 2026-09-09)** and **ONE CAUSE, ONE TILE**. Not this board's, and the rank does not touch either.
- **§6ak / 2026-11-14 / this morning's ruling (Design)**. The sequence binds: surface first, rank second. Nothing here
  changes a rank today.
- Zone-model translation: not engaged; no zone is named.

No principle is contradicted. One is under-met by the encoding as ruled (§90 Am.3's *declared*).

---

## The board

🏃 **Hutchinson (chair).** *"Two questions, and only the first is ours outright. On the first, the plumbing is better than
I expected: 322 of 322 warned plans carry a week, 0 are warned and unstamped, 0 are stamped and unwarned, and the week
is never the first, so there is always a 'Next' card a week ahead. Where the telling goes is fine. What it says is the
problem. Our ruling was that an accepted residual is **declared**. 'Heavier week' is true of every build week in every
plan. If the tile goes and the week card says only 'keep the easy days easy', we have replaced a declaration with a
mood. The fact we have to keep is that this week rises past what the plan normally allows, said in words. No
percentages, so design's rule stands."*

📊 **Seiler.** *"Nothing here moves intensity distribution. One remark: 'keep the easy days easy' is the right instruction
for a heavy week, because the heavy week is where amateurs drift into the grey zone. If the line has room for only one
sentence, that is the one I would protect."*

🎯 **McMillan.** *"From a coaching standpoint the week card is the better place, not merely an acceptable one. A runner
told in week 1 that week 9 is heavy forgets it. Told on the Next card, they rearrange their week. On the rank: the tile
at today's rank costs `Coming back` on 55 plans and `Your level` on 47, and those facts are told **nowhere else**.
Once week N carries the warning, holding a duplicate above them means telling a runner something twice and something
else never. I would not accept that trade."*

🩹 **Willy.** *"Two things. First, the injury wording is not decoration. For 58% of knee carriers and 73% of Achilles
carriers the note says the ceiling comes from their injury history. That is the clause that makes an Achilles runner
treat week 7 differently from a healthy one, so it has to reach the week card in words. Second, and I want it recorded:
29% of warned healthy plans and 30% of Achilles plans breach in **more than one** week. The tile names one week in a
sentence. A calendar marks one week and leaves the others bare, which reads as 'these are fine'. That is a stronger
implied claim than the tile makes. It is not a defect against what we ruled in October, because we ruled per plan and
the producer names the largest rise. But I would not want it forgotten."*

⚕️ **Sims.** *"Agree with Willy on the injury clause. People who are told **why** a week is different hold the line.
People who are told only that it is different do not. That holds for women in particular, who are more often the
runner with the injury history in this cohort. On a free runner: the calendar is free and so is the Today label, so
nobody is told less for not paying, provided the words travel. No other objection."*

💪 **Blagrove.** No objection from this seat. No strength rule is touched.

## ⚡ Recorded disagreements

- **Willy (mark every warned week) vs the chair (one week, as ruled in October).** The chair holds that it is outside
  this sitting. Marking every warned week changes what the producer declares (one week per plan, the largest rise), so it
  is a new decision, not a discharge question. Settled only by its own item and a measurement of the second-week rises,
  and none is filed here (founder: *don't invent work*). See "Observed, not filed".
- **On the rank, inherited and not this board's:** Collins (tile goes) vs Sierra (a short mention stays). This board
  rules only the coaching floor beneath that choice.

## ⚖️ Ruling

**(1) Discharge: CORRECT WITH AMENDMENT.** The ruled week-N surfaces discharge the 2026-10-28 binding (§90 Am.3) for
every tier, FREE included, **on one condition of meaning.** The week-N text a free runner can read (the WeekCard line on
Now/Next/expanded Later) must **declare the residual in words**: that this week rises more than the plan otherwise
allows. For the injury-scope note (`ramp.scope === 'non_long'`), it must also say that the ceiling comes from the
runner's injury history. No numbers, per the Design ruling. The words are 👤 the founder's. Without the condition the
surfaces carry a location and an instruction but not the declaration, and the plan-level tile must keep carrying the
binding. The surface clause is met by the existing reach: calendar and Today identity are both ungated, the calendar
renders above the stack, and week N is never week 1.

**(2) Rank.** Ruled on the coaching half only. The rank itself is ⏸️ **NOT READY** and stays Design's.
- **While no week-N surface ships, nothing moves.** Today's rank and the 100% gate stand (2026-11-14 sequence).
- **Once the week-N surface ships with (1)'s condition and its gate, coaching sets no floor on the tile.** The binding no
  longer needs it.
- **One coaching condition binds whatever Design chooses then: a duplicate may not displace a fact told nowhere else.**
  Measured, that excludes today's rank (182 plans, including `Coming back` 55, `Your level` 47, `Long run` 24), behind
  `Long run` (158) and last-among-constraints (40: `Your peak` 22, `Your days` 9, `Coming back` 5). It leaves **dead
  last (shown 42.2%, displaces 0)** and **goes**. Choosing between those two is the Design Board's post-ship sitting, on
  its own measurement of where runners look. That measurement needs the build and does not exist yet.
  - Dead last is currently refused by `planRationale.test.ts`'s *"BOTH RANK LOW"* arm. That refusal protected the
    warning **because of this board's binding**. Once (1) is discharged, the reason for that arm is gone, and Design may
    retire it with the reason stated.

## 📦 Required artifacts (land with the BUILD, not here)

1. **Principle:** §90 Amendment 3, amended. *"The plan screen shows it"* becomes **week N's calendar row in both
   renderings and Today in week N, every tier, with the residual declared in words (and the injury source on the
   `non_long` scope).** The plan-level tile is then optional, and its rank is Design's under the no-displacement
   condition. Fix the §34 citation in the same edit.
2. **Numeric:** none. `MAX_WEEKLY_VOLUME_INCREASE_PCT` / `INJURY_WEEKLY_INCREASE_CAP_PCT` unchanged.
3. **Mechanical check:** `loadResidualNote.test.ts`'s *"warned ⇒ shown"* arm is **re-pointed, not deleted**, to the
   week-N mark (FREE tier). This is the same arm as the Design ruling's artifact 3, one test serving both boards. It adds
   an assertion that the WeekCard text carries the declaration for both scopes. The test asserts the scope's presence,
   not the founder's exact words. It must be falsified by un-wiring the mark, and by stripping the declaration. **It
   lands before or with any rank change, never after.**

## ↗️ Hand-offs

🧭 **Design Board:** the post-ship rank sitting, choosing between dead last and goes, on a measurement of where runners
look, and retiring the *"BOTH RANK LOW"* arm's coaching reason. It also places the declaration sentence within its
encoding (it adds words to a line ruled short). 👤 **Founder:** the declaration words for both scopes, alongside the
copy the morning ruling already routed. No SLT question: tier is unchanged (FREE).

## ⚠️ What this does not prove

- Not that any runner reads the calendar row, or acts differently for it. That is outcome data and does not exist.
- Not how the encoding reads at 320pt. Nothing is built.
- Foundation-block plans are not reached (the grid pins `plan_start`, 0 carriers had a foundation block), and neither
  are injury combinations beyond single `knee` and single `achilles` overlays.
- Production reach today is **1 plan**, with week N in the future. The engine figures are rates on a grid, not a
  population of runners.
- The rank columns other than today's come from a replica. It was asserted identical to the producer at today's rank
  (0 / 1,728), which proves the replica's ordering logic. It cannot prove that a future reordering of the real producer
  would behave the same.
