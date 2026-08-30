'use client'

// DurationPicker — the canonical time/duration entry. Used wherever the user
// enters a finish time, target time, or duration: the wizard (target + benchmark
// time), the benchmark recalibration screen, and the race-result sheet.
//
// Interaction is now scroll WHEELS (three WheelPicker columns hrs : min : sec),
// not the old +/- steppers — decided app-wide 2026-08-30. The PUBLIC API is
// unchanged (hours/mins/secs + on*Change, maxHours, showSeconds), so every
// caller gets the wheel with no call-site change.
//
// ui-patterns.md § Form Fields & Pickers → DurationPicker / WheelPicker.

import type React from 'react'
import { useMemo } from 'react'
import { WheelPicker } from './WheelPicker'
import { buildRange } from './WheelPicker.logic'

const pad2 = (v: number) => String(v).padStart(2, '0')

// Wheel height = default rowHeight(40) × visibleRows(5); the separators match it
// so the ':' centres on the wheel's selection band, not the column (which also
// carries a unit label below).
const WHEEL_HEIGHT = 200

export function DurationPicker({
  hours,
  mins,
  secs,
  onHoursChange,
  onMinsChange,
  onSecsChange,
  maxHours = 23,
  showSeconds = false,
}: {
  hours: number
  mins: number
  /** Seconds — only used when showSeconds is true. */
  secs?: number
  onHoursChange: (v: number) => void
  onMinsChange: (v: number) => void
  onSecsChange?: (v: number) => void
  maxHours?: number
  /** Adds a third column for seconds. Needed for short-race finish times
   *  (a 5K is minutes:seconds, where seconds decide a PB). Off by default so
   *  the wizard/benchmark target-time callers stay HH:MM. */
  showSeconds?: boolean
}) {
  const hourValues = useMemo(() => buildRange(0, maxHours), [maxHours])
  const minuteValues = useMemo(() => buildRange(0, 59), [])
  const secondValues = useMemo(() => buildRange(0, 59), [])

  const unitStyle: React.CSSProperties = {
    fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--mute)',
    textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '2px',
  }
  const sepStyle: React.CSSProperties = {
    height: `${WHEEL_HEIGHT}px`, display: 'flex', alignItems: 'center',
    fontFamily: 'var(--font-ui)', fontSize: '28px', color: 'var(--mute)', fontWeight: 300,
  }

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: '6px', padding: '8px 0' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <WheelPicker values={hourValues} value={hours} onChange={onHoursChange} ariaLabel="hours" />
        <div style={unitStyle}>hrs</div>
      </div>

      <span style={sepStyle}>:</span>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <WheelPicker values={minuteValues} value={mins} onChange={onMinsChange} format={pad2} ariaLabel="minutes" />
        <div style={unitStyle}>min</div>
      </div>

      {showSeconds && (
        <>
          <span style={sepStyle}>:</span>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <WheelPicker values={secondValues} value={secs ?? 0} onChange={v => onSecsChange?.(v)} format={pad2} ariaLabel="seconds" />
            <div style={unitStyle}>sec</div>
          </div>
        </>
      )}
    </div>
  )
}
