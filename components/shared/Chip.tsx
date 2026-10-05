'use client'

import { TAP_TARGET_MIN_PX } from '@/components/ui/tapTarget'

// Chip — the single canonical select-chip for choosing from a set (race
// distances, training-age bands, injuries, benchmark type). Lifted from the
// wizard's Chip (the cleaner of the two prior versions) so the wizard and the
// benchmark screen stop using differently-sized, differently-tokened chips.
//
// Single-select: caller tracks one active value. Multi-select: caller tracks a
// Set and toggles. The chip itself is stateless.
//
// For two mutually-exclusive modes (km/mi, sign-in/up), use <SegmentedControl>.
//
// ui-patterns.md § Form Fields & Pickers → Chip.

export function Chip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      style={{
        // 🔴 TAP-TARGET-DECISIONS-01 batch 8a — this primitive rendered at 37px:
        // `padding: '10px 18px'` around 14px text, no floor, against a 🟢 STANDING
        // 44px minimum. Same shape as `SegmentedControl`'s own 30px miss — **the
        // components extracted to be reused were the ones missing the floor.**
        // Both its importers (the wizard, the benchmark screen) gain the floor here.
        minHeight: TAP_TARGET_MIN_PX,
        padding: '10px 18px',
        borderRadius: 'var(--radius-md)',
        border: `1px solid ${active ? 'var(--moss)' : 'var(--line)'}`,
        background: active ? 'var(--moss-soft)' : 'var(--card)',
        color: active ? 'var(--moss)' : 'var(--ink-2)',
        fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: active ? 600 : 400,
        cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  )
}
