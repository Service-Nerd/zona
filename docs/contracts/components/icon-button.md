# `IconButton` — contract

**Component:** `components/ui/IconButton.tsx`

The single owner of a glyph-only control. **7 importers.**

⚠️ **Written 2026-11-08 (`CONTRACT-COVERAGE-03`, highest-reach first).**

## Prop interface

```typescript
interface IconButtonProps {
  icon: ReactNode
  ariaLabel: string
  shape?: IconButtonShape
  inlineMark?: boolean
  className?: string
}
```

`IconButtonShape = 'circle' | 'square' | 'bare'`

⚠️ **The component's own `IconButtonProps` also declares `style`, and this block does not —
deliberately, and it is not a divergence.** The interface extends
`Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label' | 'children'>`, and `style` reaches
the DOM through `...rest` rather than being destructured. The gate compares the
**destructured** names (`componentContracts.test.ts` reads the default export's destructure when
the interface declaration is not adjacent to its name, which `extends` on its own line makes
true here). Documenting `style` would therefore read as a *fictional* prop and fail the gate.
**`style` is LAYOUT ONLY — margin, flex, alignSelf. Never a route to a different look.**

## Invariants

1. 🔴 **`ariaLabel` IS REQUIRED and must say what the control DOES, in a runner's words.**
   "Close", "Dismiss", "Increase distance" — **never the glyph's name and never a description of
   the icon.** A glyph-only control with no name is unusable with a screen reader, and
   `aria-label` is `Omit`ted from the inherited button attributes precisely so a caller cannot
   satisfy it the wrong way round.
2. **The icon is decorative by definition — mark it `aria-hidden`.** The control's name is
   `ariaLabel`; announcing both says it twice.
3. 🔴 **`inlineMark` IS THE ONLY SANCTIONED WAY TO BE UNDER 44px VISUALLY, and it does not make
   the hit area smaller.** `SessionSteps`' 15px ringed "i" sits inside a 12px uppercase label;
   at 44px it stops being an inline mark and shoves the type around. **The glyph stays 15px and
   the hit area is grown with padding plus a compensating negative margin, so the runner sees 15
   and taps 44.** Everything else owes the full 44px (iOS HIG).
4. **Shape is semantic, not decorative:** `circle` for a back/close on a surface · `square`
   inside a bordered group · `bare` for a glyph in a dense row. Default `bare`.
5. **Styling is class-based** (`icon-btn`, `icon-btn--{shape}`, `icon-btn--inline-mark` /
   `--regular`) and lives in `globals.css`, so there is one place to change the look of every
   glyph control. `className` is appended, never replaced.

## Gates

`lib/contracts/componentContracts.test.ts` · `components/ui/buttonGeometry.test.ts` (the 44px
floor, including the inline-mark compensation) · `components/ui/buttonOwnership.test.ts` (no
hand-rolled glyph buttons outside this one).
