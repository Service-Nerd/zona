# Contract — FloatingBackButton

**Authority**: This document defines the prop interface and rendering contract for the back
arrow that stays put while a screen scrolls. Any change to props must update this document in
the same commit.

**Component:** `components/shared/FloatingBackButton.tsx`

---

## Prop Interface

```typescript
type Props = {
  onClick: () => void
  ariaLabel?: string          // forwarded to BackButton; default 'Back'
  caption?: string            // BACK-ARROW-FLOAT-02 — turns the float into a CHIP, see below
}
```

⚠️ **No `style` prop, deliberately.** `BackButton` accepts one for the layout its call site
owns. This component *is* the layout: position, inset, stick point and z-layer are its whole
job, and a call site reaching in to change them is how eight hand-written wrappers happened in
the first place.

---

## What it owns

| | |
|---|---|
| Position | `position: sticky`, `top: var(--space-4)` |
| Rest inset | `margin: var(--space-4) 0 0 var(--space-4)` |
| Layer | `Z_LAYERS.screenHeader` — page furniture; a sheet or the nav paints over it |
| Width | `fit-content` |
| Elevation | `--shadow-card` |

🔴 **The rest offset EQUALS the stick offset.** Both are `--space-4`, so the arrow does not
jump on the first scroll event. A 4px shift the moment a screen moves is a visible flinch on
exactly the screens this is meant to calm — the same reason `.pinned-chrome`'s border starts
transparent.

🔴 **The shadow is load-bearing, not decoration.** Measured: the circle's `--bg-soft` fill is
**1.21:1** against the `--card` white it scrolls over and **1.07:1** against the screen's `--bg`
ground. The fill cannot separate the arrow from what passes beneath it. Remove `--shadow-card`
and the arrow is not subtle, it is invisible. "No chrome" bans *stacked* shadows, not one
documented elevation.

---

## Uncaptioned vs captioned

**Uncaptioned** — a bare 44px circle, `borderRadius: 50%`, no background of its own. It needs
none: the circle carries `--bg-soft` and a `--chrome-edge` border.

**Captioned (`BACK-ARROW-FLOAT-02`)** — a CHIP: `--card` ground, `borderRadius: 999px`,
right padding. 🔴 **That ground is not styling.** `BackButton`'s captioned form is a *ghost*
button — only the circle carries a fill and **the label span carries nothing**. Floated bare,
the caption would be text sitting directly on whatever scrolls beneath it. The circle's own
`--chrome-edge` border is what lets it read on the card rather than melting into it.

⚠️ **The uncaptioned float must NOT gain a background.** It has no label needing a ground, and
inventing one would be a surface for a problem it does not have. `floatingBackButton.test.ts`
fails in **both** directions.

---

## When NOT to use it

**Only pushed screens whose arrow stands alone.**

- 🔴 **Not tiles or confirm surfaces.** `RecalibrationTile` and `ModifyPlanConfirm` use
  `BackButton` directly: they are not pushed screens, own no scroller, and `sticky` would
  resolve to the page and carry the arrow away from the thing it belongs to.
- 🔴 **Not where the arrow shares a header** with something the runner keeps needing. Pin the
  group with `.pinned-chrome` instead — see the wizard step (arrow + `ProgressLine`) and
  session detail (arrow + eyebrow + title). Floating the arrow out of such a header keeps the
  exit and lets *where am I* scroll away.

---

## Residual hazard, named rather than solved

`position: sticky` resolves against the nearest ancestor with `overflow` other than `visible`
— **even one that can never scroll**. Four screens in this app once declared `overflow-y: auto`
with `min-height: 100%` and no height, and a header pinned to one was never sticky at all
(measured at −800px after an 800px scroll). `stickyScroller.test.ts` guards those wrappers.
**If a caller's scroller is fake, this component silently stops floating and nothing goes red.**

---

## Governance

Design Board `BACK-ARROW-FLOAT-01` (2026-09-29). ⚫ The board ruled a pinned **bar**; the
founder overturned it and chose the hovering circle — recorded in `design-rulings.md` per
ADR-023. 🥇 The measurement then vindicated the board's reasoning while his choice stood, which
is why the shadow exists.
