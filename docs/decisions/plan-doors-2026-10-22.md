# Design Board — the two plan doors (PLAN-DOORS-01), 2026-10-22

**Input:** founder: "On the plan screen you can tap to adjust the plan. This has no icon. I argue it should. When tapped
if you scroll you can then adjust your strength plan which again has no icon. It does have an icon when accessed via me
screen. And you can't adjust your current plan via the me screen ... They are technically different things."
**Trigger:** soft, qualifies (a runner would notice and would have to learn where things are). **Tier:** FREE (run door);
strength is admin-only until release.

## Evidence: the journey as built (read from the code, not a device)

| Door | Where met | Title | Glyph | Goes to | Back returns to |
|---|---|---|---|---|---|
| Run plan | Plan (one action row) | Adjust your plan | none | Adjust screen | Plan |
| Run plan | Me | **no door** | — | — (Me has only *Start a new plan*, which replaces the plan) | — |
| Strength | Me, *Your training* | Strength | dumbbell | Strength setup | Me |
| Strength | Adjust screen, *Around your runs*, below 7 settings (scroll) | Strength | none (removed 2026-10-18) | Strength setup | **Plan, not Adjust** (opening it closes Adjust) |
| Strength | Today rest card (no strength yet) | invite line | — | Strength setup | Today |
| Auto-adjust settings | Me (paid) | **Plan adjustments** | **adjust** (sliders) | auto-adjust screen | Me |

Saves land on Plan with a readback from every entry (SAVE-PATTERN-01): consistent. Adjust is withheld on plans with no
stored `generator_input` (45% of live plans, measured 2026-09-20; not re-measured).

**Settled ground:** ICON-RULE-01 (icons by MEANING, or LOCATION on lists of 8+; "does not: Plan rows"); ICON-RULE-01 ×
PINNED-DAYS-01 (2026-10-18: icons off the Adjust screen's rows **and its Strength door**; **Silvanto dissent recorded:
"Me and the sheet reach each other, so the glyph language now changes at that seam"**; re-adding "on a measured finding
problem is a ruling"); STRENGTH-ENTRY-01 (dumbbell "where it carries meaning ... Strength rows"); PLANVERB-01 (Plan
"Adjust your plan" keeps the plan, Me "Start a new plan" replaces it); ME-PURPOSE-01 (Me is the INDEX: "find the thing
you want to change, and go there"); SAVE-PATTERN-01; A2/R-4 (Plan earns ONE action row above the weeks).

## The seats

🧭 **Zhuo:** the three observations are one finding: there are two plans and no consistent door to either. The icon is
the symptom the founder can see. Success condition, stated first: *a runner on Plan or on Me can reach either plan in
one tap, and each door looks and reads the same wherever it is met.*

✋ **Silvanto:** this is the seam I named on 18 Oct, arriving as a founder finding, which is the condition that ruling
set for revisiting. A door's glyph is part of the door's identity, not decoration on the surface it sits on. The
Strength door wearing a dumbbell on Me and nothing on the Adjust screen is the same door changing its face. One glyph
per destination, everywhere. No veto: nothing here regresses palette or type.

🎓 **Sierra:** a runner does not think "run plan" and "strength plan"; they think "my plan doesn't fit this week". The
moment of change is where both should be visible. And Me, the index, cannot today send them to the thing they most
often want to change. That is the bigger defect than the icon.

📱 **Wroblewski:** counted. Run plan from Me: impossible (tab switch, then a tap). Strength from Plan: two taps and a
scroll, and Back drops you on Plan rather than where you were, which is a broken return. "Plan adjustments" (auto) and
"Adjust your plan" (manual) share a word and the sliders glyph sits on the one that is NOT the manual edit.

🎪 **Collins:** five names for three actions: *Adjust your plan*, *Plan adjustments*, *Start a new plan*, *Strength*,
*Change it any time*. Proposed one "Your plans" hub screen with two rows. **Lost:** the Adjust screen already is that
hub for the run plan, a new screen is a fourth place, and R-4 gives Plan one action row. Recorded as lost. He wins the
collision: "Plan adjustments" must not keep a name that reads as the manual edit.

## Ruling: SHIP WITH AMENDMENT (PLAN-DOORS-01). Ruled, not built.

1. **Two doors, each identical wherever it is met:** same title, subtitle and glyph. **Run plan:** "Adjust your plan" +
   the `run` glyph. **Strength:** "Strength" + `dumbbell`.
2. **Me gains the run-plan door** under *Your training*, beside *Start a new plan* (PLANVERB-01 stands: two verbs, two
   doors). Same withholding rule as Plan (no stored inputs, no door).
3. **Plan's Adjust row carries the `run` glyph. Amends ICON-RULE-01 by name:** a third qualification, IDENTITY: a door
   that is met on more than one surface carries its destination's glyph on every one. Bounded to these two plan doors.
4. **The Adjust screen's Strength door regains the dumbbell** (restores STRENGTH-ENTRY-01; reverses the 2026-10-18
   removal for this door only). Its seven setting rows stay icon-free.
5. **Back from Strength returns to where it was opened from**, including the Adjust screen (reuse the existing origin
   state; no second mechanism).
6. **"Plan adjustments" is renamed** so it cannot read as the manual edit; it keeps the sliders glyph, which then means
   one thing. 👤 **Words are the founder's** (board suggests "Auto-adjust").
7. **Plan's Adjust subtitle names strength when strength is available**, so it is found without scrolling. 👤 Founder's
   words. The door's position (below the settings) stays: it opens a different plan.

## Artifacts at build
Pattern: ui-patterns ICON-RULE-01 amendment (identity glyph) + § the two plan doors. Constant: the door definitions in
one owner (`meDoors.ts`) read by Plan, Me and the Adjust screen. Check: `iconRule.test.ts` arm that both doors render the
same glyph on every surface, plus a back-origin arm; each falsified.

## Does not settle
How it feels on a phone (nothing run on a device); whether the 45% figure still holds; the words in 6 and 7.
