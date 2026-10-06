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

**Written by** `applyWeekdayMinsCap` (`lib/plan/ruleEngine.ts`), **at the `continue` that grants the structured-session exemption** — the declaration belongs on the line that creates the obligation.

**Present iff** the session is structured (or a long run), is on a weekday, is not race week, and `duration_mins` exceeds that day's budget (`day_budgets[day] ?? max_weekday_mins`).

**Says** the magnitude and the lever (§40c), both durations through `formatDuration` (ADR-015's owner — so an 86-minute session reads `1h 26`, not a bare minute count).

**Engine copy:** `About 37 min against the 30 min you set for weekdays. Quality work is not shrunk to fit the clock, so take this one on a day with more room, or raise your weekday time in Profile.`

🔴 **Why it exists.** §81's title carries both clauses — *"Structured sessions are exempt from the weekday cap — **and the plan says when they don't fit**"* — and only the exemption had been built. Measured 2026-10-06: **675 structured weekday sessions past the ratified 50% tolerance, every one belonging to a runner who stated a 30-minute cap**, worst **86 min against that 30 (+187%)**; `INV-PLAN-STRUCTURED-OVERRUN-DECLARED` fired **zero** times because it tested the **maintenance** note's presence.

**Guarded by** `INV-PLAN-STRUCTURED-OVERRUN-DECLARED` (reads the **session's** note, not the plan's) and `lib/plan/weekdayOverrunDeclared.test.ts`, whose fifth arm **fails if the field is stamped but never rendered** — the inert-field defect this repo has shipped twice (`run_walk_strategy`, `DerivedStep.note`).
