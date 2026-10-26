# Contract — Session detail, the structural note blocks

**Authority**: defines which **session-level** note fields the session detail screen renders, in what order, and what each one is for. Any change to these fields or their order must update this document in the same commit.

**Component:** `components/dashboard/SessionPopupInner.tsx`
**Renderer:** `components/shared/CoachNoteBlock.tsx`

> ⚠️ **NOT in `docs/contracts/components/`, deliberately.** `COMPONENT-CONTRACT-GATE-01`
> requires every file in that folder to carry a fenced props block that matches its
> component's own interface, and **it refused this file when I first filed it there** —
> correctly: this is a RENDERING contract for one note family, not a props contract for a
> screen. It sits beside `session-auto-match.md` at the `docs/contracts/` level, which is
> where non-props contracts live. `SessionPopupInner`'s props remain uncontracted and
> remain inside `CONTRACT-COVERAGE-01`'s declared debt.

> ⚠️ **This contract exists because `SessionPopupInner` has none.** It is one of the 60 uncontracted shared components in `CONTRACT-COVERAGE-01`'s standing debt, and on 2026-10-06 a **new runner-facing surface** was added to it (`weekday_overrun_note`). `audit-docs.sh` reported **ok** throughout, because its contracts arm checks that a changed component's contract was *touched*, **not that its content agrees with the component** — the same shape as the stale ranked table found the same day. Rather than widen the debt silently, this documents the note family alone. The rest of the screen remains uncontracted and declared.

---

## The blocks, in render order

| Order | Field | Label | Source | AIMark? |
|---|---|---|---|---|
| 1 | `session.run_walk_strategy` | `HOW TO RUN IT` | rule engine, §117 | **No** |
| 2 | `session.weekday_overrun_note` | `LONGER THAN YOUR WEEKDAY` | rule engine, §81 Am. 2 | **No** |
| 3 | `session.coach_notes` / `guidance` | `WHY THIS SESSION` | AI enricher, or hand-authored fallback | **Yes** when `aiNotes` |

**Order is doctrine, not layout preference.** CLAUDE.md's session-card hierarchy puts the **prescription above the why**: blocks 1 and 2 are *instructions about what to do and what it will cost you*, block 3 is *rationale*. A rationale rendered above an instruction inverts the card.

**Neither 1 nor 2 carries `<AIMark />`.** Both are rule-engine copy. The mark asserts model authorship and may only appear on actual model output (`ui-patterns.md` § AIMark).

---

## `weekday_overrun_note` — §81 Amendment 2

**Written by** `reconcileWeekdayOverrunNotes` (`lib/plan/weekdayOverrunNote.ts`) at the tail of `generateRulePlan` and in `composePlanWithFoundation`, **from the final minutes** (OVERRUN-NOTE-ALL-01, 2026-10-26). It used to be written at the `continue` that grants the structured exemption, but that pass is not last: a later step brought a stamped 32-minute run to 30 and the note stayed (46 sweep plans). Words from `weekdayOverrunNote()`: the structured/long-run line, or the floor-protected easy line; both name the day when the limit is the day's own.

**Present iff** the session is on a weekday, is not race week, is not strength / rest / race, has a `duration_mins`, and that exceeds its day's budget (`weekdayBudgetFor`: `day_budgets[day] ?? max_weekday_mins`). Any kind: structured, long run, **and the §82 floor-protected easy run**, in the main plan and in foundation weeks. Checked both ways by `INV-PLAN-WEEKDAY-OVERRUN-DECLARED`.

**Says** the magnitude and the lever (§40c), both durations through `formatDuration` (ADR-015's owner — so an 86-minute session reads `1h 26`, not a bare minute count).

**Engine copy:** `About 37 min against the 30 min you set for weekdays. Quality work is not shrunk to fit the clock, so take this one on a day with more room, or raise your weekday time in Profile.`

🔴 **Why it exists.** §81's title carries both clauses — *"Structured sessions are exempt from the weekday cap — **and the plan says when they don't fit**"* — and only the exemption had been built. Measured 2026-10-06: **675 structured weekday sessions past the ratified 50% tolerance, every one belonging to a runner who stated a 30-minute cap**, worst **86 min against that 30 (+187%)**; `INV-PLAN-STRUCTURED-OVERRUN-DECLARED` fired **zero** times because it tested the **maintenance** note's presence.

**Guarded by** `INV-PLAN-STRUCTURED-OVERRUN-DECLARED` (reads the **session's** note, not the plan's) and `lib/plan/weekdayOverrunDeclared.test.ts`, whose fifth arm **fails if the field is stamped but never rendered** — the inert-field defect this repo has shipped twice (`run_walk_strategy`, `DerivedStep.note`).

### Shown only on its planned day (OVERRUN-NOTE-ALL-01, 2026-10-26)

`SessionPopupInner` renders the note only when `overrunNoteApplies(session.key, session.rawDate)`: `key` is the PLANNED
day and `rawDate` the shown date (a date-only string is read as a local date). A moved or swapped session hides it,
because the note quotes the planned day's limit, and the old wording called a Saturday "your weekday". ⚠️ **Accepted
trade-off:** a session moved onto ANOTHER over-limit weekday shows no note; the screen does not know the new day's
limit. Silence over a wrong number.

### The words (founder-approved 2026-10-26), from `weekdayOverrunNote()`

| Why it is long | Line |
|---|---|
| §82 floor-protected easy run, at or above the floor | "…Any shorter and it stops being a training run, so take it on a day with more room" |
| §81 structured session | "…Quality work is not shrunk to fit the clock, so take this one on a day with more room" |
| Weekday long run | "…The long run is not cut to fit, so take it on a day with more room" |

A single weekday limit adds ", or raise your weekday time limit in Adjust your plan." A per-day limit names the day
("…you set for Fridays.") and offers no "raise" lever: that control does not reach per-day limits
(`MODIFY-WEEKDAY-INERT-01`). No reason fits, no sentence: the check flags it instead.
