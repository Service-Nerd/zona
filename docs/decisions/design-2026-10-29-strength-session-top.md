# Design Board: the top of the strength session (2026-10-29, STRENGTH-SESSION-TOP-01)

**Trigger:** the founder's screenshot of his own *Upper body and light legs · Mon · Week 3* (375 pt, iPhone):
*"Look at the top where we have kit card and narrative above it."* Soft trigger, qualifies (what the runner reads changes).
**Change:** what sits between the tiles and the work.

## Settled-ground scan

- **STRENGTH-NOTE-01 (2026-10-17, SHIP):** the weekly note sits *"under the tiles"*. **Would be reversed in placement.**
  Its sitting chose the session screen over Today and Plan; it did not weigh it against the session's own lines, which
  did not exist yet.
- **STRENGTH-SESSION-PARTS-01 (2026-10-28 E, built 2026-10-29):** "New lifts this block…" once, under the tiles; the
  no-legs line on a converted session (Coaching Board A: *"says so on the session, with the swap day"*). **Kept.**
- **CLAUDE.md § Session Card Layout:** *TOP facts · MIDDLE the session · BOTTOM why / coach notes.* The run session
  already follows it; the strength screen put a coach note in the TOP.
- Token layer: none touched.

## Evidence (the founder's screenshot, 1206 × 2622 px, 3.216 px/pt, 815 pt tall)

- Tiles end at **233 pt**; the warm-up header starts at **475 pt**: **242 pt of prose, 30% of the screen**, in three
  blocks (1 + 2 + 4 lines) before any work.
- **Part 1 starts behind the nav pill (~738 pt): no lift is on the first screen.**
- The Kit note says what the no-legs line says (*"Upper body's taken both slots this week; light legs sat in…"*). Its
  prompt is told legs were limited and is **allowed** to say so (`strengthWeeklyNote.ts`), and nothing tells it the
  screen already does. The duplicate is by construction, on every converted session that carries a note.
- Not measured: a device in the hand; how often all three blocks stack (the no-legs line is on 12,450 of 51,692
  sampled training sessions, 24%; the note is every week for every runner with AI).

## Seats

🧭 **Zhuo.** Three blocks, two jobs. The two plain lines are about *this* session: start light, and why there are no
heavy legs. The note is about *the week*. The success condition, stated now: **the first training part starts above
the nav on a 375 × 812 screen, and nothing above the work is said twice.**

✋ **Silvanto.** Horizon again. Now, then over time. The week's note placed above today's work makes the runner read the
arc before the next five minutes. Our own session card already says where a coach note goes: the bottom. No palette or
type change, so no veto question.

🎓 **Sierra.** The runner reads the same fact twice and learns that one of the two voices is filler. The plain line says
it better: it names the day that would fix it. The note should say something the screen does not.

📱 **Wroblewski.** 242 pt of reading before the first lift, on a screen held in a gym. Moving the note down puts the
warm-up near 330 pt and Part 1 around 575 pt, above the pill. Counted from the screenshot, not felt on a phone.

🎪 **Collins.** Take the note off this screen. A weekly voice on a daily screen is the wrong shelf. **Lost:** its
sitting already ruled Today and Plan out, and the note is the only place the week's strength shape is said.

## Recorded disagreement

- **Collins** would remove the note from the session; the room keeps it and moves it. What would move the room: a place
  the week is read that is not the run's coach card.

## Ruling

**SHIP WITH AMENDMENT.**
1. **The weekly note moves below the parts, above the actions**, the bottom of the session (§ Session Card Layout).
   **Amends STRENGTH-NOTE-01's placement**; everything else in it stands (`aiGenerated`, absent renders nothing).
2. **The two session lines stay under the tiles**, unchanged.
3. **The note stops repeating the screen:** its prompt is told the session already says why heavy legs are off and
   which day would fit them, and must not say it again. A narrowing of what the note may say, no new claim and no
   prescription: inside the Coaching Board's 2026-10-17 rules (exempt, recorded).

## Artifacts

1. Pattern: `ui-patterns.md` § Strength session screen, the note's place.
2. Constant: none (order only).
3. Checks: `strengthScreens.markup.test.ts` (the note renders after the last part and before the actions), and
   `strengthNoteRules.test.ts` (the prompt carries the no-repeat rule on a legs-limited week), both falsified.

## Not settled

The note's own wording (*"so you've kept the load where it lands"* credits the runner with a choice the plan made) is
voice, the founder's. Nobody has held it on a phone.
