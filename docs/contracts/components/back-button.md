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
  style?: CSSProperties       // LAYOUT ONLY — merged, never replacing the container
}
```

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
| `style` | **Layout only** — `marginBottom`, a negative `marginLeft` inside a tile, or a conditional `color` for a busy state. It is deliberately **not** a route to a different appearance |

⚠️ **This is NOT `ScreenHeader`.** That is title + subtitle with **no back arrow**, for tab roots.
Conflating the two was a retracted finding in the review that produced this component, and the
mistake is easy to repeat because both live at a screen's top-left.

⚠️ **Four already-conforming arrows gained a 2px glyph** (18→20px) when this landed. A single
owner has to pick one size, and that is the price of there being one answer.

## Check

`lib/marketing/backArrowOwner.test.ts` — no screen may hand-roll a back arrow; the owner must draw
the documented 44px circle on `--bg-soft`; every caller must import it. Falsified two ways.
