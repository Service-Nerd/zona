# `SegmentedControl` — contract

**Component:** `components/shared/SegmentedControl.tsx`

The single canonical contained-track toggle for a small set of mutually-exclusive options.
**6 importers.**

⚠️ **Written 2026-11-10 (`CONTRACT-COVERAGE-03`, highest reach first).**

## Prop interface

```typescript
interface SegmentedControlProps<T extends string> {
  options: ReadonlyArray<{ value: T; label: string }>
  value: T
  onChange: (v: T) => void
  ariaLabel?: string
}
```

⚠️ **The component declares these INLINE in its destructure, not as a named interface.** The name
above is the contract's, so the gate can compare prop-for-prop; `SegmentedControlProps` does not
exist in the source and must not be imported.

Also exported: `SEGMENTED_MIN_HEIGHT_PX`.

⚠️ **It is generic in `T extends string`, and that is load-bearing.** `onChange` receives the
option's own `value` type, so a caller holding a union (`'km' | 'mi'`) gets a typed callback
rather than a `string` it has to re-narrow. A caller that widens `T` to `string` loses that and
should not.

## Invariants

1. 🔴 **MUTUALLY EXCLUSIVE, SMALL SET, ALWAYS ONE SELECTED.** `value` is required and not
   nullable: there is no empty state. For choosing from a larger or optional set (race
   distances, injuries, training-age bands) the pattern is **`Chip`**, which is a different job
   and carries `aria-pressed` rather than `role="tab"`.
2. 🔴 **`SEGMENTED_MIN_HEIGHT_PX` IS DERIVED FROM `TAP_TARGET_MIN_PX`, NEVER RE-TYPED.** It is an
   alias, kept only because this module's markup test asserts it **by name**
   (`TAP-TARGET-DECISIONS-01` batch 8a re-homed the value after it had been written out in 29
   places, three of them named constants). Renaming the export and re-homing the value in one
   commit would make a failure ambiguous between the two changes.
3. ⚠️ **THIS PRIMITIVE SHIPPED AT 30px AND THE HAND-ROLLED VERSION OF IT DID NOT.** `padding:
   '8px 10px'` around 12px text with **no `minHeight` at all**, against a 🟢 STANDING 44px floor.
   `TrainingZonesScreen`'s tabs are the same band of buttons and carried `TAB_MIN_HEIGHT_PX = 44`
   with their own markup test. **The component extracted to be reused was the one missing the
   floor**, and `TAP-TARGET-FLOOR-01` could not see it because that arm measured only controls
   already on the shared system, which floor at 44 by construction.
4. ⚠️ **`.btn--inline-target` IS NOT THE REMEDY HERE** and the Design Board said why: that pattern
   lets a small VISUAL carry a 44px HIT AREA. A segmented control fills its row, so the visual
   **is** the hit area and there is nothing to separate.
5. **`ariaLabel` is optional but should be set.** `role="tablist"` with no accessible name
   announces as an unnamed group. Omit it only when an adjacent visible label already names the
   choice.
6. **The control is stateless.** It renders from `value` and reports through `onChange`; it holds
   nothing. A caller that does not re-render on change gets a control that does not move.

## Consumers

The login screen, Preferences (km/mi, distance/duration), `ModifyPlanSheet`, `Chip`'s sibling
surfaces and `DashboardClient`. A change to the active/inactive treatment is visible on all of
them at once, which is the reason the two prior divergent idioms were collapsed into this one.

## Pattern

`ui-patterns.md` § Form Fields & Pickers → SegmentedControl. Tap-target floor:
`design-rulings.md` 🟢 STANDING 44px (iOS HIG).
