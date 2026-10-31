# Design Board — SHARE-ICON-01 · Share becomes an icon, and goes quiet

**Date:** 2026-10-31 · **Input:** founder instruction, with a device screenshot of Coach
(*"We use the share cta across the app in a number of places. I want us to use the standard
globally recognised share icon instead. A share shouldn't dominate the screen and should be
secondary."*)
**Trigger:** soft, qualifies: every runner who meets a Share control sees it change.
**Tier:** follows each surface (Coach weekly share is PAID; session/post-run share follows its screen).
**Mockups:** before/after for every surface, 375px (sent to the founder 2026-10-31).

## Population, counted from the code

| # | Surface | Control today | File |
|---|---|---|---|
| 1 | Coach, Kit's weekly read | `ShareWeekButton`: **full-width primary**, 52px moss fill | `app/dashboard/DashboardClient.tsx` |
| 2 | Session detail, completed run | `SaveImageButton`: soft pill | `DashboardClient.tsx` (SessionScreen) |
| 3 | Post-run screen | `SaveImageButton`: soft pill | `DashboardClient.tsx` (PostRunScreen) |
| 4 | Log sheet after rating a run | `SaveImageButton`: soft pill | `components/dashboard/SessionPopupInner.tsx` |
| 5 | Coach free tier, "Share your week" | an upgrade row; opens Upgrade, shares nothing | `components/dashboard/CoachTeaser.tsx` |

Four share actions, two components, one upgrade row. **Website: 0.**

## Settled-ground scan

- **ICON-RULE-01** (2026-09-22): an icon earns its place by MEANING or by LOCATION. The share
  glyph qualifies by **meaning**, exactly as the notification bell does: universally understood,
  no compact text equivalent. Not a row icon, so `iconRule.test.ts`'s row arms do not apply.
- **ICON-BUTTON-01 / §39**: a control whose whole label is a glyph is an `IconButton` with a
  required `ariaLabel`. `bare` is for *"a glyph in a dense row"*; `circle` is *"a surface that
  says control"*. ICON-EDGE-01: the circle carries the hairline, no elevation.
- **SAVE-IMG-01**: the session share lives **outside** the card so a screenshot frames it clean.
  Kept.
- **COACH-READ-BUTTON-01** (2026-10-30): the read lost its Generate button; Share was left as
  the card's only button, which is how it became the loudest control on Coach.
- **§ What Not to Build**: no spinners. A dimmed glyph is the busy state, not a spinner.

## Evidence

📐 **Usage, production `analytics_events`, read-only, all time:** `share_week_pressed` **4 times,
one account; 4 of 4 ended `error`; 0 successes.** The last was 08:28 today, a minute before the
screenshot. The session share (`SaveImageButton`) records nothing, so its usage is unknown.

📐 **Why it failed, for the latest press:** that account's week-2 `weekly_reports` row is live
with `zone_discipline_score` 10, and `run_analysis` holds **zero rows** for `week_2_*`. The card
route (`/api/og/weekly-zone-card`) scores the week from `run_analysis`, so it returns 404 and the
runner is told *"Need 2+ logged runs with HR data this week."*, which is not true of a week the
screen has just scored. The button's gate reads one source; the card reads another. Filed as
`SHARE-WEEK-CARD-SOURCE-01` (NO BOARD defect). **Not measured:** how many other runners are in
the same state.

**Not measured:** any of this on a device in the hand.

## The board

🧭 **Zhuo (chair).** The user problem is real and visible in the founder's own screenshot: the
largest control on Coach is Share, a 52px moss fill directly under the read, so the screen's one
button says *"post this"* instead of *"do this"*. Success condition, stated now: **on every surface,
the share control is the lowest-weight control in its region: no fill, no text, no wider than
44px.** And the evidence changes the order of work: we are about to make a broken control quieter.
Quieter is right; it is not a fix.

✋ **Silvanto.** The glyph is right; the shape in the first mockup was wrong. `bare` is for a
glyph inside a dense row. A glyph alone on its own line under a card has no row to belong to,
so it reads as an ornament that happens to be tappable. Use `circle`: `--bg-soft`, the hairline,
the same object as the back arrow. That is quiet and still says *control*. No veto: nothing here
regresses palette or type.

🎓 **Sierra.** Sharing is the app being talked about, not the runner getting better, so demoting
it costs the runner nothing. One question for the record: the card we invite them to share is the
honest one, 10 out of 100 included. That is fine *if* it is their choice; the button should never
be the thing the eye lands on after a bad week.

📱 **Wroblewski.** Counted: today the Coach share is a 52px full-width target; after, a 44px
circle at the right edge, inside thumb reach at 375pt. An icon loses the label that carried the
status (*Preparing… / Saved / Share failed*), so the status needs a home: a 12px `--mute` line to
the left of the icon, two seconds, `aria-live="polite"`. And the error copy must be true; the one
on record told a runner something false. That is the defect, not this ruling, but this ruling
must not ship a quieter way to show it.

🎪 **Collins.** I'll take quiet here; it is right, not safe. But the weekly card, a number a
competitor whose proposition is encouragement cannot print, is the most Zonna object in the app.
Demote the button, not the moment. If it ever works, it deserves a better invitation than a pill,
and an icon at the edge is a better invitation than a pill.

## Recorded disagreements

- **bare vs circle.** The proposal (bare, matching the bell) lost to Silvanto and Wroblewski
  (circle). What would reverse it: a dense row, where `bare` is the documented shape.
- **Top-right of the card vs under it, on Coach.** Silvanto raised the iOS convention (share
  top-right of the thing). The board kept **under the object, right-aligned** on all four
  surfaces: one rule, and SAVE-IMG-01 already forbids inside the session card.

## Veto check

None. Silvanto declined: no documented palette or type rule is regressed.

## Ruling — SHIP WITH AMENDMENT (subject to founder approval of the mockups)

1. Every share action is the **iOS share glyph** (box with an up arrow, the bell's 1.6 line
   family) in an **`IconButton shape="circle"`**, 44px, `ariaLabel` *"Share this week"* /
   *"Share this run"*.
2. Placement: **right-aligned directly under the object it shares**, outside it, on all four
   surfaces.
3. **One owner**: a single share control component; `ShareWeekButton` and `SaveImageButton` pass
   their share function to it. No `<Button>` labelled *Share* anywhere in `app/` or `components/`.
4. Status words move off the label to a 12px `--mute` line beside the icon, `aria-live`;
   busy = the icon disabled and dimmed, no spinner.
5. Row 5 (*"Share your week"* upgrade row) **unchanged**: it shares nothing, and a share glyph
   would promise an action it does not do.
6. **Order:** `SHARE-WEEK-CARD-SOURCE-01` is fixed first or in the same build. The Coach share
   must not render when the card cannot be produced.

## Artifacts (at build)

1. **Pattern:** `ui-patterns.md` § Share control, and ICON-RULE-01's MEANING row names the share
   glyph beside the bell.
2. **Constant:** the share glyph drawn once in the owner; no new token (circle uses existing ones).
3. **Check:** a source test: no `Button` labelled Share in `app/`/`components/`; every share call
   site renders the owner; the owner renders `IconButton` with `shape="circle"`. Falsified by
   restoring the pill.

## What this ruling does not settle

Whether the weekly card should exist when the runner's week is poor; whether the session share
is used at all (it records nothing); how the icon feels in the hand (not seen on a device).
