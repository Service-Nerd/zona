# Contract — StrengthSetupScreen

**Component:** `components/dashboard/StrengthSetupScreen.tsx`

The Me → Strength door body (STRENGTH-ENGINE-01 Phase 2, Design Board `STRENGTH-APP-01` F). `MeScreen` renders the
`ScreenHeader` (`STRENGTH_TITLE`, `STRENGTH_SCREEN_SUB`); this renders the form only, so the title is said once.

## Prop Interface

```typescript
interface StrengthSetupScreenProps {
  profile: StrengthProfile | null        // null → defaults, CTA "Build my strength plan"; set → "Update"
  planInjuries: string[]                 // from the run plan; SHOWN, never asked (one owner of injury input)
  planNotes: StrengthNote[]              // the plan's honest notes, said once here
  onSave: (profile: StrengthProfile) => Promise<string | null>   // null = saved; a string = failed
}
```

## Rendering contract

Seven questions in weight order on shared controls: focus `CardSelect`; sessions `Chip` 1–4 with the suggestion
`FieldNote`; length `SegmentedControl` (`formatDuration`); equipment `Chip` multi (bodyweight-ceiling `FieldNote`
only without load kit); experience `Chip`; days off `DayGridSelector`; bone flag `Switch`. One primary CTA at the end;
saved → `FieldReadback`, failed → `InlineError`. Strings from `STRENGTH_SETUP` (`lib/strength-bridge/display.ts`).
Check: `components/dashboard/strengthScreens.markup.test.ts`.
