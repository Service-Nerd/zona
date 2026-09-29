// SectionLabel — MICRO-LABEL-DRIFT-01 (Design Board, 2026-09-29).
//
// A screen-level section heading. The top of the three-level micro-label hierarchy:
// section label → eyebrow (inside a card) → data label (beside a number).
//
// ── 🔴 THE FOURTH INSTANCE OF THE SAME TRAP ──────────────────────────────────
// This was a LOCAL FUNCTION inside `DashboardClient` — 8 uses, unimportable. `PlanCalendar`
// needed a section label, could not reach it, and wrote `PlanSectionLabel` at different
// values. That is the chevron story for the fourth time (`ACTION-ROW-01`, then
// `CHEVRON-OWNER-01`, then `StatusBadge`'s two copies, now this), and the comment that sat
// directly above the old local function was itself about a previous incident of the class:
// *"whose entire remedy is 'import the real component', could not fire on it."*
//
// Collins, at the sitting: **"this codebase makes it easier to retype a style than to
// import a component, and until `components/shared/` is the obvious first place to look,
// instance five is already written."**
//
// ── ⚠️ ONE INTENTIONAL VISIBLE CHANGE, AND IT IS NOT A REFLOW ────────────────
// The old local function set **no `fontWeight` at all**, so it inherited **400** (measured:
// there is no `body` font-weight rule in `globals.css`). Silvanto ruled that an accident
// rather than a decision, and the value is **600**.
//
// 🔴 SIZE IS UNCHANGED AT 12px, WHICH IS THE POINT. Wroblewski's condition was about
// REFLOW — *"a screen-section label shrinking 17% moves everything under it"* — and
// nothing moves here. The weight change is a restyle, on a screen nobody has seen on a
// device, which is exactly why the size was left alone.

import type { ReactNode, CSSProperties } from 'react'
import { MICRO_LABELS } from './microLabels'

export function SectionLabel({ children, right, style }: {
  children: ReactNode
  /** Optional trailing text, baseline-aligned. `PlanCalendar`'s section labels use it. */
  right?: ReactNode
  /** Positioning only — never the type. */
  style?: CSSProperties
}) {
  const label = (
    <span style={{ fontFamily: 'var(--font-ui)', color: 'var(--mute)', ...MICRO_LABELS.sectionLabel }}>
      {children}
    </span>
  )
  // ⚠️ Two shapes, one type. `PlanSectionLabel` existed because it needed a trailing
  // value; that is a LAYOUT difference and never justified a second set of type values.
  if (right == null) {
    return <div style={{ padding: '0 16px', marginBottom: 'var(--space-2)', marginTop: 'var(--space-5)', ...style }}>{label}</div>
  }
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0 4px', marginTop: '18px', ...style }}>
      {label}
      <span style={{ fontFamily: 'var(--font-ui)', color: 'var(--mute)', ...MICRO_LABELS.eyebrow }}>{right}</span>
    </div>
  )
}
