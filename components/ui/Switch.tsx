// Switch — the boolean on/off control. SWITCH-PRIMITIVE-01 (Design Board,
// 2026-09-25), implementing the spec `ui-patterns.md` has carried since the
// ActionRow section was written.
//
// 🔴 WHY THIS EXISTS, AND IT IS NOT THE USUAL REASON. The other primitives this
// week (`BackButton`, `.cta-pill`, `TextField`) all EXISTED and were mis-scoped.
// This one never existed at all: `ui-patterns.md` § ActionRow described the
// control in four bullets — 44x26 pill, `--moss` on / `--line` off, 20px white
// thumb, 3px inset — and one thousand lines later § Input Primitives says
// *"Never build a one-off input, toggle, chip, or time entry inline."* The
// document told you not to build it inline and gave you no other way to build
// it. Collins: *"the document contradicted itself and we called it drift."*
//
// 🔴 THE DEFECT THAT FORCED IT. `BUTTON-ARCH-01` converted two of these to
// `<Button variant="primary">`. `.btn--regular` declares `min-height: 44px`,
// which BEATS an inline `height: 26px` — different properties, so the inline
// style never competes — and the thumb is `position: absolute; top: 3px` inside
// a box that grew 21px. Harness-measured: untouched switch 26px, both converted
// **47px**. The founder saw it as *"run notification toggles look mis shaped"*.
// Silvanto named it a regression against `ui-patterns.md:1789` and declined to
// veto, because this component is the remedy.
//
// ⚠️ `checked` IS REQUIRED, and that is Sierra's bound made structural. None of
// the three live switches carried `role="switch"` or `aria-checked`, so a
// VoiceOver user heard *"Toggle run notifications, button"* and could not tell
// whether notifications were ON — on the control that decides whether the
// product may speak to them at all. Same move as `IconButton.ariaLabel` this
// morning: the compiler stops the next one, not a reviewer.
//
// ⚠️ THE CALLER PASSES THE EFFECTIVE STATE; THIS NEVER DERIVES ONE
// (Wroblewski). `DailyPushToggleRow` is gated on push being enabled and renders
// OFF when it is not, even if the stored preference says on — deliberately, so
// nobody is promised a push that cannot arrive. A primitive that computed its
// own state from `checked && !disabled` would look identical and quietly own a
// product decision. It does not.
//
// ⚠️ 26px UNDER A 44px FLOOR, resolved the way this board ruled it that same
// morning for the Apple Health chip: keep the VISUAL, carry the HIT AREA in an
// invisible `::after`. A 44px-tall switch is not a switch; `:1789` is right and
// `:262` is also right, and the overlay is how both hold.

'use client'

import type { CSSProperties } from 'react'

export interface SwitchProps {
  /** Effective on-state, as the CALLER computes it. Required: it is announced. */
  checked: boolean
  onChange: () => void
  /** Accessible name. Required — `IconButton`'s precedent. */
  ariaLabel: string
  /** The control's OWN blocked state (permission denied, request in flight).
   *  A row that does not APPLY yet dims the row, not this — two grammars,
   *  kept apart on purpose (Silvanto). */
  disabled?: boolean
  style?: CSSProperties
}

export default function Switch({ checked, onChange, ariaLabel, disabled = false, style }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={disabled ? undefined : onChange}
      className={`switch${checked ? ' switch--on' : ''}`}
      style={style}
    >
      <span className="switch__thumb" aria-hidden />
    </button>
  )
}
