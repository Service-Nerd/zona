# Design Board — same-day doubles on Plan and Today (SESSION-SLOTS-01 Phase 3)

**Sat:** 2026-10-17. **Chair:** Zhuo. **Seats:** Silvanto, Sierra, Wroblewski, Collins.
**Ruling:** SHIP WITH AMENDMENT. **Item:** `SESSION-SLOTS-01` (ADR-025 Phase 3).
**Inputs:** Coaching Board §126 (`same-day-doubles-coaching-2026-10-17.md`), SLT tier ruling
(`slt-same-day-doubles-2026-10-17.md`, FREE, built small, no promotion).

## Settled-ground scan
- Pattern 10b (move-confirmation row): **amended, not replaced**. "Swap them" keeps its meaning and stays primary.
- N-004 / CLAUDE.md "No popups": the choice stays inline in 10b. No modal, no sheet.
- STRENGTH-APP-01 (A): a second session on Today is one compact `SessionCard` row; precedent reused.
- STRENGTH-PLAN-GLYPH-01 (b) DON'T SHIP a run glyph: honoured, no run icon added.
- DESIGN-DAYDOT-CHANNEL-01: hue carries type only; the slot is a LABEL, never a colour.
- App type scale frozen: the slot token uses the existing 12px muted metric register, no new size.

## The ruling
1. **Plan move flow.** The confirm row offers a secondary **"Do both"** beside the primary **"Swap them"**, only when
   `moveChoices().both` (§126 allows the pair). The mover takes **PM**; the runner is not asked AM or PM
   (Wroblewski: a question with no basis for an answer). A day already holding two is **not a target**.
2. **Plan rows.** A double day is **two `DayRow`s under one date**: the date column is shown once, no divider
   between the two, each row keeps its own rail colour, and an **AM / PM token leads the 12px metric line**.
3. **Today.** The hero is the day's **first session not yet done**; the other is the compact `SessionCard` row under
   a `MICRO_LABELS` eyebrow AM / PM; `doubleAdvice()` is said **once**, beneath it, on the double day only.
4. **DateStrip:** one dot per day (the hero's colour). No second dot.
5. **Strength's "after your run"** copy is unchanged (no strength is placed on a two-run day, S-NO-STRENGTH-ON-DOUBLE).

**Collins lost** a "×2" mark on the day: a count beside a label that already shows two rows is decoration. Recorded.

## Read at build time (no new ruling)
- **From a double, a session may move or join another easy run, never swap.** The swapped-in session would land
  beside the half left behind, unslotted, and the resolver would turn it back into a swap. When "Do both" is the
  only offer it becomes the primary, and the target row's hint reads *"tap to double up"*.
- **Saving is checked.** Both the move and the swap writes revert and show one `InlineError` line on failure
  (they were fire-and-forget).

## Artifacts
- Pattern: `ui-patterns.md` § 10b amended + § 10d Same-day double.
- Constants: `SLOT_LABEL`, `moveChoices` (`lib/plan/doubles.ts`).
- Checks: `components/training/planCalendarDouble.markup.test.ts`, `components/dashboard/todayDouble.markup.test.ts`,
  `lib/plan/doubles.test.ts § moveChoices`, writer gate (two writers of `new_slot`). Each falsified.

## What this does not settle
Nothing has been felt in a hand on a device; checked at 375px in Chromium only. The Today headline names the hero's
distance, not the day's total; flagged, not ruled.
