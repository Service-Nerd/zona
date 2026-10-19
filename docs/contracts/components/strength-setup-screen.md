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
  draft?: StrengthProfile | null         // SAVE-PATTERN-01: the answers held while the consent screen was open
  legsDay?: StrengthPlan['legs_day_suggestion'] | null   // STRENGTH-LEGS-DAY-01: said beneath the days while unchanged
  onSave: (profile: StrengthProfile) => Promise<string | null>   // null = saved; a string = failed
}
```

## Rendering contract

Six questions in weight order on shared controls: focus `CardSelect`; **which days can you lift**
`DayGridSelector` (PINNED-DAYS-01, 2026-10-18: positive, 1–`MAX_CHOSEN_DAYS`; the picks ARE the count via
`withChosenDays`, so a fifth tap is ignored and the note says four is the most; nothing builds with no day picked);
length `SegmentedControl` (`formatDuration`); equipment `Chip` multi (bodyweight-ceiling `FieldNote` only without
load kit); experience `Chip`; bone flag `Switch`. "How many a week?" and "Days you can't" are gone. One primary CTA at the end;
failed → `InlineError`. **SAVE-PATTERN-01:** the caller decides what a save means; a runner with a plan sees *Here is
what changes* (`StrengthChangeConfirm`) first, and every save lands on Plan with the readback, so this screen no longer
says *"Built."* itself. Strings from `STRENGTH_SETUP` (`lib/strength-bridge/display.ts`).
Check: `components/dashboard/strengthScreens.markup.test.ts`, `components/dashboard/strengthSetupDays.markup.test.ts`.

**Legs note (STRENGTH-LEGS-NOTE-FOCUS-01, 2026-10-19).** Under the days, when the plan carries `legs_limited_by_run_week`, `STRENGTH_SETUP.legsLimitedNote(focus)`: running focus says *lighter leg work*; since `STRENGTH-GENERAL-LEGS-01` both foci get light leg work, so the note is one line again, followed by `legsDayLine(legsDay)` when the plan names a day (*"Lift on Tuesday after your quality run and your legs get a proper session."*).
