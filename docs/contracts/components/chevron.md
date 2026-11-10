# `Chevron` — contract

**Component:** `components/shared/Chevron.tsx`

The *"this is a control"* mark. **5 importers.**

⚠️ **Written 2026-11-10 (`CONTRACT-COVERAGE-03`, highest reach first).**

## Prop interface

```typescript
interface ChevronProps {
  size?: number
}
```

⚠️ Declared inline; the name above is the contract's, for the prop-for-prop gate.

`size` defaults to 16 and sets both width and height. The `viewBox` is fixed at `0 0 16 16`, so
any `size` scales the same path rather than redrawing it.

## Invariants

1. 🔴 **IT IS A MODULE, NOT A LOCAL `const`, AND THAT IS THE ENTIRE POINT.** It was a local
   `const` inside the Me screen; `ACTION-ROW-01` moved it into `ActionRow.tsx` — **as a local
   `const` inside `ActionRow.tsx`** — and the founder caught the same defect twice in the same
   words. ⚠️ **One level up is still unreachable.** Do not re-inline it, and do not make
   `ActionRow` its only home: `ActionRow` is title + subtitle + chevron, `DashboardClient`'s
   `row()` is label + value + state dot. Two legitimate row shapes, one affordance.
2. 🔴 **`stroke="currentColor"` — THE CALLER OWNS THE COLOUR.** There is no colour prop and there
   must not be one. A caller sets `color` on the wrapper (`var(--mute)` in `ActionRow`), which is
   what lets the same mark sit on a card, a warn rail and a dark surface without a variant.
3. 🔴 **`aria-hidden="true"`, ON PURPOSE.** It is decoration on something that is already a
   `<button>` with a real label. Announcing "chevron" adds nothing a screen reader needs, and a
   label here would duplicate the control's own.
4. ⚠️ **`flexShrink: 0` IS LOAD-BEARING.** Without it a long title squashes the affordance in a
   flex row, which is precisely the legibility the component exists to guarantee. It lives on the
   `<svg>` so no caller has to remember it.
5. **No hardcoded colour and no token lookup.** The only colour reference is `currentColor`,
   which is how it passes both colour guards without an exemption.

## Pattern

`ui-patterns.md` § ActionRow. Rulings: `ACTION-ROW-01`, `CHEVRON-OWNER-01`.
