# Contract — DistanceStepper

**Authority**: This document defines the distance stepper's props. Any change must update this document in the same
commit; `lib/contracts/componentContracts.test.ts` compares the two prop-for-prop, both directions.

**Component:** `components/shared/DistanceStepper.tsx`

```typescript
interface DistanceStepperProps {
  whole: number
  decimal: number
  onWhole: (n: number) => void
  onDecimal: (n: number) => void
  /** The runner's units, for the readout and the screen-reader value. */
  units: 'km' | 'mi'
}
```

## Rules
- The ratified distance input (STEPPER-CONTROL-01): whole units and one decimal, − / + each, no keyboard.
- Extracted from `ManualRunModal` (UNMEASURED-DISTANCE-01) so the "How far did you run?" sheet uses the same control; the
  markup is unchanged. Two `role="spinbutton"` readouts, each with `aria-valuenow` (held by `buttonOwnership.test.ts`).
- Used by `ManualRunModal` and `AddDistanceSheet`. A new distance input uses this, never a copy.
