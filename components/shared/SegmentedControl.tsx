'use client'

// SegmentedControl — the single canonical contained-track toggle for a small
// set of mutually-exclusive options (sign-in/sign-up, km/mi, distance/duration).
// Replaces the two divergent toggle idioms (login's contained track + the Me
// screen's independent moss pills) with one control.
//
// For selecting from a larger/optional set (race distances, injuries), use
// <Chip> instead — that's a different job.
//
// ui-patterns.md § Form Fields & Pickers → SegmentedControl.

import type React from 'react'

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: ReadonlyArray<{ value: T; label: string }>
  value: T
  onChange: (v: T) => void
  ariaLabel?: string
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      style={{
        display: 'flex', gap: '3px',
        background: 'var(--bg-soft)',
        borderRadius: 'var(--radius-md)',
        padding: '3px',
      }}
    >
      {options.map(opt => {
        const active = value === opt.value
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            style={{
              flex: 1, padding: '8px 10px',
              background: active ? 'var(--card)' : 'transparent',
              border: active ? '1px solid var(--line)' : '1px solid transparent',
              borderRadius: 'calc(var(--radius-md) - 3px)',
              fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: active ? 600 : 500,
              color: active ? 'var(--ink)' : 'var(--mute)',
              letterSpacing: '0.04em',
              cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
