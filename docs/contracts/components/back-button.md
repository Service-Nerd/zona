# Contract — BackButton

**Authority**: This document defines the prop interface and rendering contract for the app's one
back arrow. Any change to props must update this document in the same commit.

**Component:** `components/shared/BackButton.tsx`

---

## Prop Interface

```typescript
type Props = {
  onClick: () => void
  ariaLabel?: string          // default 'Back'; override only when the destination is named
  caption?: string            // optional text beside the arrow. A LABEL, never a second target
  style?: CSSProperties       // LAYOUT ONLY — merged, never replacing the container
}
```

---

## ⚠️ As of 2026-09-25 this is a WRAPPER (`ICON-BUTTON-01`)

**The prop interface above is unchanged and this contract stays valid.** What changed is where the
appearance lives: `BackButton` now renders `IconButton` with `shape="circle"`, the chevron, and
`ariaLabel` defaulting to `'Back'`. The 44px circle on `--bg-soft` is `.icon-btn--regular` +
`.icon-btn--circle` in `globals.css`.

🔴 **Why:** this component already WAS the general primitive and was carrying the name of one of its
uses, so 13 other controls needing the same shape could not reuse it and were hand-rolled — one of
them byte-for-byte this spec. See `ui-patterns.md` § 39.

⚠️ `backArrowOwner.test.ts` still substitutes every value in (44px, 50%, `--bg-soft`, never moss), now
against the class that owns it, plus an assertion that this component still asks for the circle shape.

---

## Why this exists

🔴 **`ui-patterns.md` has said *"back arrow top-left (44px circle, `--bg-soft` bg)"* for months,
and a census found 6 of 13 back controls obeying it** (`UI-BACKARROW-01`, 2026-09-22): two at
**36px** — below the 44px iOS HIG minimum this repo documents in its own *What Not to Build* —
two 8px squares on `--accent-soft`, one on `--moss-soft` (the CTA colour on a control that is not
a CTA), two with no container at all, and one drawn as the literal text `← Back`.

Extracted from `FounderNoteScreen`, which was the conforming version.

## The contract

| | |
|---|---|
| Container | **44×44 circle, `--bg-soft`, `--ink`.** Never the accent, never moss — it is navigation, not a CTA |
| Glyph | 20px chevron, `currentColor` |
| `caption` | Optional text alongside the arrow, **inside the same button**. The whole row is one control and one accessible name. Pass `ariaLabel` to match |
| `style` | **Layout only** — `marginBottom`, a negative `marginLeft` inside a tile, or a conditional `color` for a busy state. It is deliberately **not** a route to a different appearance |

⚠️ **This is NOT `ScreenHeader`.** That is title + subtitle with **no back arrow**, for tab roots.
Conflating the two was a retracted finding in the review that produced this component, and the
mistake is easy to repeat because both live at a screen's top-left.

⚠️ **Four already-conforming arrows gained a 2px glyph** (18→20px) when this landed. A single
owner has to pick one size, and that is the price of there being one answer.

## Check

`lib/marketing/backArrowOwner.test.ts` — no screen may hand-roll a back arrow; the owner must draw
the documented 44px circle on `--bg-soft`; every caller must import it. Falsified two ways.

## `caption` — BACKARROW-WIZARD-01 (2026-09-27)

Added so the wizard's hand-rolled back arrow could be deleted **without deleting the
affordance it carried**. `GeneratePlanScreen`'s plan preview showed a back arrow reading
*"Adjust inputs"*, where "back" alone is ambiguous between the previous STEP and the
inputs. Dropping it to conform would have been a design change smuggled in as a
conformance fix.

🔴 **THE FIRST CUT SHRANK THE TAP TARGET AND THE FOUNDER ASKED FOR IT BACK.** It rendered an
`IconButton` with an `aria-hidden` span beside it, taking the target from the whole ~150px row
to the 44px circle. He is right: that screen is where a runner decides whether to accept a
plan, one-handed.

⚠️ **The two obvious fixes are both wrong.** A `<div onClick>` around both is the exact shape
`LINK-HIERARCHY-01` ruled a defect (*"no role, no tabIndex, no focus ring"*). Two adjacent
buttons sharing a handler makes a screen reader announce the same action twice.

**So the captioned form is ONE `<Button>`** containing a `<span>` wearing the **shared**
`.icon-btn icon-btn--circle icon-btn--regular` classes. `ICON-EDGE-01`'s chrome edge arrives
for free, and `handRolledCircle.test.ts` stays silent for the right reason — there is no inline
geometry to catch — rather than by luck. **Using the shared class IS the compliant path.**

⚠️ It zeroes `.btn--compact`'s padding, which is an argued entry in
`buttonInlineOverride.test.ts`'s register: that padding around a 44px circle renders a 68px
control where every other back arrow is 44px.

The labelled pushed-screen header proper is `BACK-HEADER-OWNER-01`'s question, not this
component's.
