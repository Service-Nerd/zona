# Contract — StrengthSetupScreen

**Component:** `components/dashboard/StrengthSetupScreen.tsx`

The strength setup form (STRENGTH-ENGINE-01 Phase 2, Design Board `STRENGTH-APP-01` F). **Mounted by the dashboard's
`strength-setup` screen since STRENGTH-ENTRY-01 (2026-10-17)**, which renders the `ScreenHeader` (`STRENGTH_TITLE`,
`STRENGTH_SCREEN_SUB`) and returns to whichever door opened it (Me, the modify sheet, the rest card). This renders the
form only, so the title is said once.

## Prop Interface

```typescript
interface StrengthSetupScreenProps {
  profile: StrengthProfile | null        // null → defaults, CTA "Build my strength plan"; set → "Update"
  planInjuries: string[]                 // from the run plan; SHOWN, never asked (one owner of injury input)
  planNotes: StrengthNote[]              // the plan's honest notes, said once here
  initialDays?: Day[]                    // PINNED-DAYS-01: shown chosen on open (`prefillChosenDays`); [] = runner picks
  onSave: (profile: StrengthProfile) => Promise<string | null>   // null = saved; a string = failed
}
```

## Rendering contract

Six questions in weight order on shared controls: focus `CardSelect`; **which days can you lift**
`DayGridSelector` (PINNED-DAYS-01, 2026-10-18: positive, 1–`MAX_CHOSEN_DAYS`; the picks ARE the count via
`withChosenDays`, so a fifth tap is ignored and the note says four is the most; nothing builds with no day picked);
length `SegmentedControl` (`formatDuration`); equipment `Chip` multi (bodyweight-ceiling `FieldNote` only without
load kit); experience `Chip`; bone flag `Switch`. "How many a week?" and "Days you can't" are gone. One primary CTA at the end;
saved → `FieldReadback`, failed → `InlineError`. Strings from `STRENGTH_SETUP` (`lib/strength-bridge/display.ts`).
Check: `components/dashboard/strengthScreens.markup.test.ts`, `components/dashboard/strengthSetupDays.markup.test.ts`.
