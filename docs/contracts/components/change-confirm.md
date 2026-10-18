# `<ChangeConfirm>` — contract

**Component:** `components/shared/ChangeConfirm.tsx`

The frame of every "Here is what changes" consent screen (SAVE-PATTERN-01, Design Board 2026-10-18). Changing a plan,
run or strength, is one journey: edit, see what changes, accept, land on Plan with a readback. This is the middle
step's frame; the body is the caller's. Callers: `ModifyPlanConfirm` (run), `StrengthChangeConfirm` (strength). Pattern:
`ui-patterns.md` § Changing a plan, one journey; § Confirmation diff (MODIFY-CONFIRM-DIFF-01).

## Props

```ts
type ChangeConfirmProps = {
  onBack: () => void            // back to the edit screen, edits intact (MODIFY-CONFIRM-01 clause 1)
  backLabel: string             // the back arrow's accessible name
  onAccept: () => void
  onCancel: () => void          // discard: the one destructive exit
  applying: boolean             // the primary button carries the state: "Saving your plan…"; Keep is disabled
  error?: string | null         // what was not saved, an InlineError directly under Accept
  children: ReactNode           // the scale-labelled body (ScaleLabel is exported beside it)
}
```

## Render

Back arrow top-left, *Here is what changes* (26px 800), *Nothing is saved until you accept.*, the body, then *Accept
and save* (primary) and *Keep my current plan* (secondary). No progress animation (declined, MODIFY-CONFIRM-DIFF-01).

## Gates

`components/shared/planChangeJourney.markup.test.ts` (busy state, error placement, both callers use the frame).
