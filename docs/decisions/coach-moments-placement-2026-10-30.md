# Design Board: COACH-SEEN-MOMENTS-01 placement (2026-10-30)

**Trigger:** a new shared component (the earned line) on Coach, hard trigger. **Tier:** PAID (Coach).
**Change:** two rule-based sentences, each shown only in the week it is earned, placed beside their evidence.
**Input:** the founder approved the mockup the same day ("Yes": the placement, with the trend moment moved inside the
trend card). Thresholds are the Coaching Board's (`coaching-rulings.md` 2026-10-30).

## Settled-ground scan
- **Celebration forbidden → NARROWED** (`COACH-SEEN-MOMENTS-01`, this review): an earned, specific sentence with its
  evidence is allowed; no badge, medal, confetti, streak. Binding, and this ruling is its first use.
- **6t-g** (a hue is never small text; hue stays on marks): binds. The sentence is ink; only the dot carries moss.
- **PlanArc / Wood** (no peak celebration): binds. The bars do not emphasise the winning week; the sentence does the
  saying, once.
- **Pattern 32 amended** (`COACH-DISCIPLINE-HEADLINE-01`): the headline owns the number; the moment adds a comparison
  the number cannot make, so it is not a restatement.
- **AIMark**: rule-based copy, so no mark (CLAUDE.md § UI Principles).
- Token layer: `--ink`, `--moss` exist. Nothing new.

## Evidence
The founder's mockup at 375px (screenshots sent 2026-10-30). Production data, read-only: median weekly easy share 32%;
the Coaching Board measured moment 1 firing in 5 of 59 eligible weeks. **Not measured:** anything on a device.

## Seats
- 🧭 **Zhuo:** "The sentence must sit on its evidence, or it is a claim. Success: a runner who sees it can point at the
  bar that proves it." → the window is **the drawn record**, so "in {n} weeks" is countable on screen.
- ✋ **Silvanto:** "Ink sentence, Body 15/600, a 6px moss dot as the only colour. No motion: a moment that animates
  is asking to be noticed; this one has earned being read." No veto.
- 🎓 **Sierra:** "It names what the runner did, in their weeks, not ours. That transfers: next week they will know
  what an easy week feels like." Supports.
- 📱 **Wroblewski:** not tappable, no new control; one line at 320px wraps to two and stays legible. Supports.
- 🎪 **Collins:** "Inside the trend card the sentence repeats the 44pt numbers above it. Cut the numbers." **Lost:**
  the words are the founder's approved copy, and as the card's last line they read as its conclusion, not a second
  metric. Recorded as a loss.

## Ruling: SHIP WITH AMENDMENT
1. **Easiest week:** one line between the headline sentence and the bars. Window = the drawn record (this week plus up
   to 7 earlier, `EASY_SHARE_BARS`); `n` = weeks drawn. ⚠️ The Coaching Board measured "up to 8 previous"; this is up
   to 7, so the evidence is on screen. Firing rate re-measured at build and reported.
2. **Easy is costing you less:** the last line inside the live trend card, only in the week the drop first passes the
   noise floor with pace confirming (`paceContext === 'confirms'`). "First" is read as *crossed within the last 7
   days* (the series without the last week did not qualify; with it, it does). No stored state.
3. One component, `EarnedLine`, for both: 6px `--moss` dot (aria-hidden), Body 15/600 `--ink`, no animation, no AIMark.

## Artifacts
Pattern: `ui-patterns.md` § Earned line. Constants: `COACH_MOMENT_EASIEST_MARGIN_PTS`, `COACH_MOMENT_MIN_PRIOR_WEEKS`
(`lib/coaching/constants.ts`), `EARNED_DOT_PX`. Check: `earnedLine.markup.test.ts` (ink text, moss dot only, absent on
an ordinary week), falsified. Register row in `design-rulings.md`.

**Not settled:** how it feels on a device; whether a 10-point week that reverses next week makes the line feel cheap.
