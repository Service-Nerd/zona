'use client'

// DayGridSelector — the canonical Mon–Sun day-of-week selector. One row of
// seven 44×44 targets. Multi-select (which days you can't train) or
// single-select (which day is your long run). Stateless: the caller owns value.
//
// Operates on the canonical 3-letter DayKey (matches lib/plan/effectiveSessions
// `DayKey`). Callers that persist a different wire format — e.g. the wizard's
// full-word `days_cannot_train` ('monday') — map at their own boundary; the
// primitive never emits full words.
//
// Before this, "days you can never train" was a bespoke inline row of circular
// buttons in GeneratePlanScreen. This ends that drift.
//
// For a 2-option day choice (Sat/Sun long-run day) use <Chip> — a seven-day
// grid is the wrong weight for two options.
//
// Pure selection logic lives in ./DayGridSelector.logic (node-testable).
//
// ui-patterns.md § Form Fields & Pickers → DayGridSelector.

import { DAY_GRID, toggleDay, type DayKey } from './DayGridSelector.logic'

export { DAY_GRID, toggleDay, type DayKey }

export function DayGridSelector({
  value,
  onChange,
  multiple = true,
  ariaLabel,
}: {
  value: readonly DayKey[]
  onChange: (v: DayKey[]) => void
  /** true (default) = multi-select; false = single-select (tap-again clears). */
  multiple?: boolean
  ariaLabel?: string
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}
    >
      {DAY_GRID.map(({ key, label }) => {
        const active = value.includes(key)
        return (
          <button
            key={key}
            type="button"
            aria-pressed={active}
            aria-label={label}
            onClick={() => onChange(toggleDay(value, key, multiple))}
            style={{
              width: '44px', height: '44px', borderRadius: '50%',
              border: `1px solid ${active ? 'var(--moss)' : 'var(--line)'}`,
              background: active ? 'var(--moss-soft)' : 'var(--card)',
              color: active ? 'var(--moss)' : 'var(--ink-2)',
              fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: active ? 600 : 400,
              cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
