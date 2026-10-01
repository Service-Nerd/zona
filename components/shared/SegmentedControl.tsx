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

/**
 * The tap-target floor for a segment, as a named constant.
 *
 * 44 is `design-rulings.md`'s 🟢 STANDING minimum (iOS HIG). It is a constant
 * rather than an inline `44` so the markup test can assert the VALUE and not
 * just the presence of a number, which is how `TrainingZonesScreen`'s
 * equivalent is held.
 */
export const SEGMENTED_MIN_HEIGHT_PX = 44

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
              // 🔴 TAP-TARGET-DECISIONS-01 (Design Board, 2026-10-01) — SHIP.
              // This primitive rendered at **30px**: `padding: '8px 10px'`
              // around 12px text, with **no `minHeight` at all**, against a
              // 🟢 STANDING 44px floor (`design-rulings.md`, iOS HIG).
              //
              // ⚠️ IT WAS THE HIGHEST-REACH CONTROL UNDER THE FLOOR — login,
              // Preferences, ModifyPlanSheet, Chip and DashboardClient all
              // inherit it — and `TAP-TARGET-FLOOR-01` could not see it, because
              // the floor arm measured only controls already on the shared
              // system and those floor at 44 by construction.
              //
              // 🔴 THE HAND-ROLLED VERSION OF THIS PATTERN GOT IT RIGHT.
              // `TrainingZonesScreen`'s tabs are the same band of buttons and
              // carry `minHeight: TAB_MIN_HEIGHT_PX = 44` with their own markup
              // test. **The component extracted to be reused was the one
              // missing the floor.**
              //
              // ⚠️ `.btn--inline-target` is NOT the answer here, and the board
              // said why: that pattern exists so a small VISUAL can carry a
              // 44px HIT AREA, which suits a chip in a settings row. A
              // segmented control fills its row, so the visual IS the hit area
              // and there is nothing to separate.
              flex: 1, minHeight: SEGMENTED_MIN_HEIGHT_PX, padding: '8px 10px',
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
