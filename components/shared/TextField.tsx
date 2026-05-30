'use client'

// TextField — the single canonical text/number/email/date input for Zonna.
// Replaces the per-screen inline inputs (login, profile, HR, benchmark,
// wizard). Two rules are enforced here so they can never drift again:
//   1. fontSize is locked at 16px — iOS zooms any focused input below 16px and
//      the maximum-scale=1 viewport then traps the user zoomed in.
//   2. Warm Slate tokens only — no legacy System-B aliases.
//
// ui-patterns.md § Form Fields & Pickers → TextField.

import type React from 'react'

export function TextField({
  value,
  onChange,
  type = 'text',
  placeholder,
  inputMode,
  unit,
  min,
  max,
  readOnly = false,
  required = false,
  autoComplete,
  ariaLabel,
}: {
  value: string
  onChange: (v: string) => void
  type?: 'text' | 'email' | 'password' | 'number' | 'date'
  placeholder?: string
  inputMode?: 'text' | 'numeric' | 'decimal' | 'email'
  /** Optional unit suffix shown inside the field, right-aligned (e.g. "bpm"). */
  unit?: string
  min?: number
  max?: number
  readOnly?: boolean
  required?: boolean
  autoComplete?: string
  ariaLabel?: string
}) {
  const input = (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      inputMode={inputMode}
      min={min}
      max={max}
      readOnly={readOnly}
      required={required}
      autoComplete={autoComplete}
      aria-label={ariaLabel}
      style={{
        width: '100%', boxSizing: 'border-box',
        background: readOnly ? 'var(--bg)' : 'var(--bg-soft)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-md)',
        padding: unit ? '13px 38px 13px 14px' : '13px 14px',
        // 16px is non-negotiable — see header note.
        fontFamily: 'var(--font-ui)', fontSize: '16px',
        color: readOnly ? 'var(--mute)' : 'var(--ink)',
        cursor: readOnly ? 'default' : 'text',
        outline: 'none',
      }}
    />
  )

  if (!unit) return input

  return (
    <div style={{ position: 'relative' }}>
      {input}
      <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--mute)', pointerEvents: 'none' }}>
        {unit}
      </span>
    </div>
  )
}
