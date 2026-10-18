# Contract — StrengthSessionScreen

**Component:** `components/dashboard/StrengthSessionScreen.tsx`

One strength session's full brief (STRENGTH-ENGINE-01 Phase 2, Design Board `STRENGTH-APP-01` D). Pattern:
`ui-patterns.md` § Strength session screen. Rendered by `DashboardClient` for `screen === 'strength-session'`.

## Prop Interface

```typescript
interface StrengthSessionScreenProps {
  session: StrengthSession          // from the strength plan (packages/strength)
  dayLabel: string                  // e.g. "Thu" (formatDate weekday-only)
  weekN: number | null              // the run week the session sits in
  status: StrengthCompletion | null // 'done' | 'skipped' | null
  canLog: boolean                   // the day itself or after it, as on a run
  onBack: () => void                // back to Today or Plan, whichever opened it
  onSetStatus: (status: StrengthCompletion | null) => Promise<boolean>  // null = undo; false → inline error
  note?: string | null              // STRENGTH-NOTE-01: this week's AI note; null renders nothing
  lifts?: { suggestions, today, units, onLog? }   // STRENGTH-PROGRESSION-01: per main lift; absent = no logging
}
```

## Rendering contract

- `ScreenHeader`: title `STRENGTH_KIND_TITLE[kind]`, sub *"Strength · day · Week N"*, back arrow.
- Duration · Exercises tiles (Metric medium 17/700). Blocks in `StepSection` (warm-up/cool-down `--moss`,
  training blocks `--s-strength`). Exercise row: name 14/600, dose 15/800, support 12/700; **cues only when opened**.
- **No zone, pace, RPE or media placeholder.** Actions at the end of content: Mark complete (primary), Skip
  (secondary); once logged a `StatusBadge` and Undo. A failed save shows `InlineError`.
- Every string from `lib/strength-bridge/display.ts`. Check: `components/dashboard/strengthScreens.markup.test.ts`.

## Recovery ease (STRENGTH-RECOVERY-01, 2026-10-18)

An eased session (`session.eased_for === 'recovery'`, applied on read by `applyRecoveryEases`) shows `EasedMark` above the tiles, the record the run's session screen carries (ui-patterns § 10e). The blocks shown are the eased ones: nothing to toggle back. Gate: `components/shared/easedMark.markup.test.ts`.

## Lift log (STRENGTH-PROGRESSION-01, Design Board 2026-10-18)

Main lifts only. The collapsed row adds one 12px `--ink-2` suggestion line (`liftSuggestionLine`); the opened row adds a
weight `TextField` (decimal keypad, kg / lb from `weightUnit`) on a loaded lift and three `Chip`s *Easy / About right /
Hard*; the chip tap saves through `lifts.onLog`, which is passed only when `canLog`. *Logged* after a save; a failed
save is one `InlineError`. The row is a container whose header button toggles it (a field cannot sit inside a
button). Gate: `components/dashboard/strengthLiftLog.markup.test.ts`.
