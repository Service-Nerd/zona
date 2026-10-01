# `Sheet` — contract

**Component:** `components/shared/Sheet.tsx`

SHEET-PRESENT-01 (Design Board) · `SHEET-CONTRACT-01`, 2026-10-01

**The single owner of sheet presentation.** Seven hand-rolled sheets each invented their
own z-index; five sat below the bottom nav and the founder could not see the panel that
opened over them. This primitive exists so that cannot recur, and
`sheetPresentation.test.ts` makes copying the old pattern back a build failure.

⚠️ **This is the most-used primitive in the app and it had no contract until now.** Four
sheets render it (`ModifyPlanSheet`, `HrCalibrationSheet`, `ZoneInfoSheet`, and
`/sheet-preview`, which imports the real one deliberately).

## Prop Interface

```typescript
interface SheetProps {
  /** Called once the exit animation has finished — unmount the sheet here. */
  onClose: () => void
  /** Sheet body below the drag pill. A FUNCTION receives an animated `close()`. */
  children: React.ReactNode | ((close: () => void) => React.ReactNode)
  /** Panel max width in px. Default 480, the app's phone column. */
  maxWidth?: number
  /** Panel max height as a percentage of the viewport, before the nav is subtracted. Default 88. */
  maxHeightVh?: number
  /** Accessible label for the dialog. */
  ariaLabel?: string
}
```

## Props

| Prop | Type | Required | Meaning |
|---|---|---|---|
| `onClose` | `() => void` | ✅ | Called **after** the exit animation finishes, not when dismissal starts. Unmount here. ⚠️ **Calling it yourself skips the animation** — use the `close()` the render prop hands you |
| `children` | `ReactNode \| ((close) => ReactNode)` | ✅ | Everything below the drag pill. **Pass a FUNCTION whenever the sheet has its own dismiss affordance** (a ✕, a bottom Close, a "Got it"), so that control animates out instead of vanishing |
| `maxWidth` | `number` | — | Default **480**, the phone column. A wider sheet is a layout decision, not a prop tweak |
| `maxHeightVh` | `number` | — | Default **88**. ⛔ **Silvanto's binding rule: a sheet covers the nav; it does NOT become a screen.** Raising this toward 100 is the regression that rule exists to stop, and `sheetPresentation.test.ts` holds it |
| `ariaLabel` | `string` | — | The dialog's accessible name. Absent, a screen reader announces an unnamed dialog |

## What the primitive owns, so a caller must not re-implement it

| Behaviour | Why it is here and not in the caller |
|---|---|
| **Portal** | The panel must escape the scrolling content container |
| **z-index** | From the `Z_LAYERS` ladder, never a literal. This is the defect the primitive was created for |
| **Nav occlusion** | The backdrop reserves nothing at the bottom and the panel covers the nav; the measured nav height is still consumed by the height bound |
| **Home-indicator clearance** | The panel clears it itself, now that the nav does not |
| **Body-scroll lock, Escape, focus trap + restore** | One effect, so teardown is symmetric |
| **Swipe down to close** | Founder, 2026-09-25. ⚠️ **The drag pill was drawn and dragged nothing** — a false affordance in the primitive that every sheet inherited. The gesture only starts at `scrollTop <= 0`, so a half-scrolled body scrolls rather than dismissing |
| **Enter transition** | `SHEET-RAF-FALLBACK-01`: released through `releaseOnNextFrame`, because `requestAnimationFrame` does not fire while `document.hidden` and a sheet mounting in that window left the panel off-screen behind a live scrim |

## States

| State | Behaviour |
|---|---|
| **Mounting** | Panel at `translateY(100%)`, scrim already up. Released on the next frame **or a 50ms backstop** |
| **Reduced motion** | `prefers-reduced-motion` short-circuits straight to shown — no transition |
| **Open, body short** | Panel sized to content, under the `maxHeightVh` bound |
| **Open, body long** | Body scrolls; the panel does not grow. Swipe-to-close is suppressed until scrolled back to the top |
| **Closing** | `setShown(false)`, then `onClose()` after `EXIT_MS` (280ms) |
| **Hidden document** | ⚠️ The one state that was broken: see the enter-transition row above |

## Checks

- `components/shared/sheetPresentation.test.ts` — portal, z-index ladder, nav occlusion, the 88vh rule, and that every sheet file imports the primitive rather than hand-rolling one
- `components/shared/sheetClose.test.ts` — the dismissal path
- `lib/ui/rafRelease.test.ts` — the enter-transition backstop, behaviourally
- `lib/contracts/componentContracts.test.ts` — **this file against the component**, both directions

🔻 **Not covered by any check:** `ariaLabel` is optional, so a sheet can ship without an
accessible name and nothing fails. Four sheets exist and whether each passes one is not
asserted.
