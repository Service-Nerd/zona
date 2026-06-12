'use client'

// Select — canonical native-picker control for "one of a larger numeric or
// enumerated set" where Chip would be too dense and a stepper too slow.
// First use: year of birth in the plan wizard (76 options). On iOS Capacitor
// this renders the native wheel picker; on desktop, a standard dropdown.
//
// Mirrors TextField's Warm Slate styling and the 16px-no-zoom rule.
// ui-patterns.md § Form Fields & Pickers.

import type React from 'react'

export function Select({
  value,
  onChange,
  options,
  placeholder,
  ariaLabel,
}: {
  /** Empty string = nothing selected (placeholder shown). */
  value: string
  onChange: (v: string) => void
  /** Render order is the order shown to the user. */
  options: Array<{ value: string; label: string }>
  placeholder?: string
  ariaLabel?: string
}) {
  const empty = value === ''
  return (
    <div style={{ position: 'relative' }}>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        aria-label={ariaLabel}
        style={{
          width: '100%', boxSizing: 'border-box',
          background: 'var(--bg-soft)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius-md)',
          padding: '13px 38px 13px 14px',
          // 16px is non-negotiable — iOS zooms anything smaller and the
          // maximum-scale=1 viewport traps the user. See TextField.tsx.
          fontFamily: 'var(--font-ui)', fontSize: '16px',
          color: empty ? 'var(--mute)' : 'var(--ink)',
          cursor: 'pointer',
          outline: 'none',
          appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none',
        }}
      >
        {placeholder !== undefined && (
          <option value="" disabled>{placeholder}</option>
        )}
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <span aria-hidden style={{
        position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)',
        fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--mute)',
        pointerEvents: 'none',
      }}>▾</span>
    </div>
  )
}
