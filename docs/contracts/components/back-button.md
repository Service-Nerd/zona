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
| `caption` | Optional text beside the arrow, in a flex row. 🔴 **NOT a second tap target** — the 44px circle stays the only control and the caption is `aria-hidden`. Pass `ariaLabel` alongside it so the accessible name carries the caption's meaning |
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

🔴 **The tap area is genuinely smaller than the copy it replaces, and that is stated
rather than hidden.** The wizard wrapped arrow AND text in one `<Button>`, so the whole
~150px row was tappable. Here the 44px circle is the control and the caption is a label.

**A `<div onClick>` around both would restore the area and is refused** — `LINK-HIERARCHY-01`
ruled exactly that shape a defect (*"no role, no tabIndex, no focus ring"*). The labelled
pushed-screen header proper is `BACK-HEADER-OWNER-01`'s question, not this component's.
