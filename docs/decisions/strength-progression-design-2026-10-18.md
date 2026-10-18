# Design Board — STRENGTH-PROGRESSION-01: logging a lift and seeing what to lift next (Phase 4)

**Sat:** 2026-10-18. **Chair:** Zhuo. **Seats:** Silvanto, Sierra, Wroblewski, Collins. **Ruling:** SHIP WITH AMENDMENT.
**Input:** Coaching Board the same day (`strength-progression-coaching-2026-10-18.md`): log once per loaded main lift,
weight + one of three feels; the next session suggests a load; optional, never blocking.

## Settled-ground scan
- STRENGTH-APP-01 **E (logging):** done or skipped only *"until Phase 4 reads them"*. Phase 4 is the reader, so the
  ruling's condition is met, for loaded main lifts only. Accessories, core, warm-up and mobility stay done/skipped.
- STRENGTH-APP-01: **cues one tap deep**; **"in reserve" is jargon to most runners, say it plainly** (Sierra).
- Entry points (Sierra): *"real progress in load waits for Phase 4; do not fake it."* No PR badge, no streak, no chart.
- INLINE-ERROR-OWNER-01: a failed save is one InlineError line. ADR-015: every unit through `lib/format`.
- **Measured:** the exercise row is one `<button>`, so a field cannot sit inside it as it stands.

## Seats
- **Zhuo:** the job is "what do I lift today?". The answer belongs on the row before the set, not behind a tap.
- **Silvanto:** the suggestion is a supporting line in the row's existing 12px register under the dose. The dose stays
  the loudest thing on the row. No new size, no colour beyond the tokens already there. No veto.
- **Sierra:** plain words: *Easy*, *About right*, *Hard*, never "RIR". Showing last time's weight next to the
  suggestion teaches the runner the pattern; that is the useful part. No celebration when it goes up.
- **Wroblewski:**
  - logging sits in the opened row, beside the cues: one tap to open, type the weight, tap a feel;
  - the feel tap is the save, so there is no Save button;
  - the weight field opens the decimal keypad;
  - kg or lb follows the runner's units;
  - a logged row says *Logged* in text, and tapping another feel changes it.
- **Collins:** argued for the suggestion as the row's headline number (bigger than the dose). **Lost:** the dose
  (3 × 5) is the prescription and the weight is the runner's; putting theirs above ours inverts who sets the session.

## Ruling
1. Loaded main lifts only. **Collapsed row:** under the effort line, one 12px `--ink-2` line:
   *"Last time 20 kg, about right. Try 22.5 kg."* / *"New lift. Start light."* / reps form *"Try 20 kg for 6."*
2. **Opened row:** cues, then the weight field (decimal keypad, unit suffix) and three `Chip`s
   *Easy / About right / Hard*; the feel tap saves; *Logged* in text after. Bodyweight lifts show the feels only.
3. The row becomes a container: the header toggles, the opened panel holds the controls (fixes the button nesting).
4. A failed save: one `InlineError` in the row. Mark complete is unchanged and never waits for a log.
5. Never: a PR badge, a streak, a chart, a celebration, a required field.

## Artifacts
Pattern: `ui-patterns.md` § Strength lift log. Constants: `lib/strength-bridge/display.ts` (`LIFT_FEEL_LABEL`,
`liftSuggestionLine`), `lib/format.ts → formatWeight`. Checks: `components/dashboard/strengthLiftLog.markup.test.ts`.

## Copy
Drafted in the brand voice under the founder's 2026-10-17 standing instruction (*"Use the copy calls you have"*);
flagged for him in the report.
