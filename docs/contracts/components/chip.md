# `Chip` — contract

**Component:** `components/shared/Chip.tsx`

The single canonical select-chip for choosing from a set. **5 importers.**

⚠️ **Written 2026-11-10 (`CONTRACT-COVERAGE-03`, highest reach first).**

## Prop interface

```typescript
interface ChipProps {
  label: string
  active: boolean
  onClick: () => void
}
```

⚠️ Declared inline in the component's destructure; the name above is the contract's, for the
prop-for-prop gate. `ChipProps` does not exist in the source.

## Invariants

1. 🔴 **THE CHIP IS STATELESS AND THE CALLER OWNS SELECTION.** Single-select: the caller tracks
   one active value. Multi-select: the caller tracks a `Set` and toggles. The chip knows only
   whether it is `active`. **There is no `selected` mode, no group component and no name
   attribute** — which is what lets the same primitive serve race distances, training-age bands,
   injuries and benchmark type.
2. 🔴 **`aria-pressed`, NOT `role="tab"`.** A chip is a toggle; a segmented control is a tablist.
   For two mutually-exclusive modes (km/mi, sign-in/up) the pattern is **`SegmentedControl`**, and
   choosing the wrong one is an accessibility defect rather than a style preference.
3. ⚠️ **THIS PRIMITIVE SHIPPED AT 37px.** `padding: '10px 18px'` around 14px text, no floor,
   against a 🟢 STANDING 44px minimum — the same shape as `SegmentedControl`'s own 30px miss.
   **The components extracted to be reused were the ones missing the floor**
   (`TAP-TARGET-DECISIONS-01` batch 8a). `minHeight: TAP_TARGET_MIN_PX` now, derived and never
   re-typed; both importers at the time (the wizard, the benchmark screen) gained the floor here.
4. **`whiteSpace: 'nowrap'`** — a chip's label is a token, not prose. A label long enough to want
   wrapping is the wrong label, not the wrong chip.
5. **`label` is a `string`, deliberately narrower than `ReactNode`.** A chip is not a place for
   composed content; keeping it a string is what makes the nowrap rule honest.
6. **Colour comes only from tokens** — `--moss`, `--moss-soft`, `--moss-strong`, `--line`,
   `--card`, `--ink-2`. The active state is a border, a wash and a weight change; never a fill in
   a session colour (accent-only rule).

## Pattern

`ui-patterns.md` § Form Fields & Pickers → Chip. Lifted from the wizard's chip, the cleaner of
the two prior versions, so the wizard and the benchmark screen stopped using differently-sized,
differently-tokened chips.
