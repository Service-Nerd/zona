# `DurationPicker` — contract

**Component:** `components/shared/DurationPicker.tsx`

The canonical time/duration entry — wherever a runner enters a finish time, a target time or a
duration. **6 importers.**

⚠️ **Written 2026-11-10 (`CONTRACT-COVERAGE-03`, highest reach first).**

## Prop interface

```typescript
interface DurationPickerProps {
  hours: number
  mins: number
  secs: number
  onHoursChange: (v: number) => void
  onMinsChange: (v: number) => void
  onSecsChange: (v: number) => void
  maxHours?: number
  showHours?: boolean
  maxMins?: number
}
```

Defaults: `maxHours` 23 · `showHours` true · `maxMins` 90.

⚠️ Declared inline in the component's destructure; the name above is the contract's, for the
prop-for-prop gate.

## Invariants

1. 🔴 **SECONDS ARE NOT OPTIONAL, AND THERE IS NO `showSeconds` PROP.** `TIME-INPUT-SECONDS-01`
   (Design Board, 2026-09-25) removed it rather than defaulting it to `true`, **so no call site
   can turn it off and the compiler visits every one of them.** It had been a per-caller prop
   defaulting to FALSE, set at three call sites and forgotten at three.
   📐 **Measured on live data before the board ruled: 12 of 12 stored times end `:00`** — 4 of 4
   target times, 8 of 8 benchmarks. Not one runner had ever recorded a real seconds value,
   because three screens could not accept one, **and those screens did not omit the seconds: they
   hardcoded `:00` into the stored string.** The app asserted a precision it never collected.
2. 🔴 **THE DIRECTION OF THE ERROR IS WHY IT MATTERED** (Sierra). Truncating to the minute always
   makes the runner look **FASTER**: worst case **11.8 sec/km at 5K**, 5.9 at 10K, 2.8 at HM. Every
   prescribed pace derives from that benchmark, in a product whose whole thesis is that people run
   their easy days too hard.
3. ⚠️ **`hours` IS REQUIRED EVEN WHEN `showHours` IS FALSE, AND IS THEN IGNORED.** A caller in
   mm:ss mode must still pass a number and an `onHoursChange` that will never fire. It is a trap
   worth knowing about rather than a defect: making them conditional would need a discriminated
   union, and the three mm:ss callers all pass `0` and a no-op.
4. ⚠️ **`maxMins` APPLIES ONLY WHEN `showHours` IS FALSE.** In hours mode the minutes wheel is
   fixed at 0–59 and carries into the hours column, so `maxMins` is silently inert there. In mm:ss
   mode it is the top of the minutes wheel, defaulting to 90 **so a slow 10K past 59 minutes is
   still reachable** — a floor that exists for the runners this product is for.
5. **Interaction is scroll WHEELS, never +/- steppers** — decided app-wide 2026-08-30. The columns
   are `WheelPicker`; this component owns only the layout, the separators and the unit labels.
6. **`WHEEL_HEIGHT = 200` is `rowHeight(40) × visibleRows(5)`, and the `:` separators match it**,
   so the colon centres on the wheel's selection band rather than on the column, which also
   carries a unit label below it.
7. **The picker is stateless.** Three values in, three callbacks out. It never assembles a time
   string — formatting is `lib/format.ts`'s (ADR-015).

## Consumers

The wizard (target time + benchmark time), the benchmark recalibration screen, and the
race-result sheet. ⚠️ **A change here reaches every stored benchmark**, which is the upstream of
every prescribed pace.

## Pattern

`ui-patterns.md` § Form Fields & Pickers → DurationPicker / WheelPicker. Ruling:
`TIME-INPUT-SECONDS-01`.
