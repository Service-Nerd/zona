# Design Board: where the "Heavier week" note sits (2026-10-28, PLAN-NOTE-HEAVIER-WEEK-SLOT-01)

**Founder:** "Yes to all", answering "approve the wording, and send its position on the plan screen to the Design Board?"
Wording approved by the founder the same day.

**Trigger:** `lib/plan/planRationale.ts` (the single owner of the "Why this plan" stack) and `ui-patterns.md` §18's
label list. Soft trigger, qualifies: the runner sees a new tile and, on some plans, loses another.
**Change:** rank the new `Heavier week` note (INJURY-PEAK-JUMP-01) in the rationale stack.
**Tier:** FREE.

## Settled-ground scan

- **§6ae PLAN-NOTE-BUDGET-INERT-01 (2026-10-07):** `PLAN_RATIONALE_MAX_WORDS` 180 and cap 3; **220 rejected**
  (Wroblewski: 90% see everything at 180 for a worst case he can defend). The per-note ratchet stays downward-only.
  Options C and D below reverse that ruling and are priced against it.
- **ONE CAUSE, ONE TILE (SLT 2026-09-17):** untouched; the ramp note is a different cause from Maintenance.
- **§18 rules (SLT 2026-09-09, Wood):** honest constraints first, "Shaped for you" last. The new note is a constraint.
- **Coaching Board 2026-10-28 (INJURY-PEAK-JUMP-01), binding (ADR-017):** a plan the ramp checks warn must tell the
  runner. An option that leaves warned runners untold is a coaching defect, not a design preference.
- Token layer: no token touched (`CoachNoteBlock` `variant="why"`).

## Evidence (2,879 cohort plans carrying the note: 4,500 inputs × healthy / Achilles / knee; `planRationaleNotes` run directly)

| Option | `Heavier week` shown | `Long run` kept | notes / plan | words / plan |
|---|---|---|---|---|
| **A** heavier first, 180 words, 3 tiles (built) | **100%** | 375 / 844 | 2.33 | 129 |
| **B** long run first, 180, 3 | 84% | 836 / 844 | 2.32 | 137 |
| **C** heavier first, 220, 3 | 100% | 506 / 844 | 2.57 | 143 |
| **D** heavier first, 240, 4 tiles | 100% | 842 / 844 | 2.84 | 162 |

Under A, the notes lost besides `Long run` are `Your level` 311, `Hard sessions` 293, `Coming back` 254 (of 1,323 plans
losing any). **Not measured:** anything on a device. Rendered nowhere yet; the copy was read, not seen.

## The seats

🧭 **Zhuo (chair).** B is not available: it leaves 16% of warned runners untold, and the Coaching Board has said that
is wrong. So the choice is A, or reopen the budget. The register already priced a looser budget nine days ago and said
no, and nothing in this sitting is new evidence about readability. That leaves A, and the real question of whether this
note belongs in this stack at all.

✋ **Silvanto.** It does not, ultimately. This note is about one week. The plan-level stack is about the plan's shape.
Putting "week 12 is the heavy one" at the top of the plan, twelve weeks early, is the horizon mistake: it competes with
what is true now. Its home is week 12, on the plan calendar row and on Today when week 12 arrives. Until that exists, A
is the honest interim. No veto: nothing regresses palette or type.

🎓 **Sierra.** The runner is better off knowing both things, the heavy week and the short long run. The long-run note
tells them the last stretch of the race will be new; that is the one I least want to lose. Which is another argument for
Silvanto's placement: put the week note on its week and both survive without anyone counting words.

📱 **Wroblewski.** I said 180 and I would say it again: four tiles and 240 words on the plan screen is a wall. Against D.
C buys 131 long-run notes for 40 more words; not enough. A now, the week placement next.

🎪 **Collins.** The stack is turning into a filing cabinet: nine note types fighting for three slots is a taxonomy that
has outgrown its container. Agree with Silvanto, and I would go further when the week placement lands: a plan-level tile
for a week-level fact should not exist.

## Recorded disagreements

Collins would remove the plan-level tile entirely once the week placement ships; Sierra would keep a short plan-level
mention so the runner sees it when choosing the plan. Settled at that build, on a measurement of where runners look.

## Veto check

None. No palette or type rule is regressed.

## Ruling

**SHIP WITH AMENDMENT.** A stands as built: `Heavier week` ranks with the constraints, ahead of `Long run`; budget 180
and cap 3 unchanged (§6ae holds; C and D declined). **Amendment, filed as its own item:** the ramp warning moves to
where it applies, week N's row in the plan calendar and Today in week N (`PLAN-NOTE-HEAVIER-WEEK-PLACEMENT-01`); when it
ships, the plan-level tile drops behind `Long run` or goes, decided then on a measurement.

## Artifacts

1. **Pattern:** `ui-patterns.md` §18: `HEAVIER WEEK` added to the label list, with its rank and the reason.
2. **Constant:** none new; `PLAN_RATIONALE_MAX_NOTES` 3 and `PLAN_RATIONALE_MAX_WORDS` 180 unchanged.
3. **Check:** `lib/plan/loadResidualNote.test.ts` "every warned plan carries the note, and the plan screen shows it",
   falsified by disabling the render line (red), and `PLAN-NOTE-DELIVERY-01` (red on the same mutation).

## What this ruling does not settle

Whether three tiles and 129 words read well on a phone: nobody has seen this on a device.
