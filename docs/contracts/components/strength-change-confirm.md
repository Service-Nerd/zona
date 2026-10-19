# `<StrengthChangeConfirm>` — contract

**Component:** `components/dashboard/StrengthChangeConfirm.tsx`

*Here is what changes* for a strength plan that already exists (SAVE-PATTERN-01, Design Board 2026-10-18). Body only;
the frame is `ChangeConfirm` (`change-confirm.md`), shared with the run plan's consent screen. A first build skips it.
Callers: `DashboardClient` (`strength-setup` screen, admin-only while strength is gated), `/strength-preview` fixture.

## Props

```ts
type StrengthChangeConfirmProps = {
  before: StrengthPlan          // the stored plan
  after: StrengthPlan           // POST /api/strength/plan { preview: true }: built, validated, written nowhere
  weekN: number                 // the run plan's current week (strength shares its numbering)
  onAccept: () => void
  onBack: () => void            // back to the answers, intact (the dashboard holds the draft)
  onCancel: () => void
  applying: boolean
  error?: string | null
}
```

## Render

Two named scales: *Your strength plan* (Days, Sessions a week, Session length; changed rows only) and *What changes this
week* through `AdjustmentDiff`, each session labelled by **kind**, never length (two sessions of one length otherwise
read as no change), named by `strengthSessionTitle`. When the built plan carries `legs_limited_by_run_week`, the line
*"Your run week keeps heavy legs off these days, so they get lighter leg work."* (STRENGTH-CHOSEN-NO-LEGS-01).
Nothing changed: *"Your sessions stay as they are."*

## Gates

`components/shared/planChangeJourney.markup.test.ts` (real engine plans: new days, unchanged plan, a change of kind).
