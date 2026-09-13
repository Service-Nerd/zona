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
  showHours = true,
  maxMins = 90,
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
  /** Drop the hours column for a minutes:seconds picker (a 5K/10K time trial
   *  is mm:ss, never hours). When false, `hours` is ignored and the minutes
   *  wheel runs 0..maxMins so a slow 10K past 59 min is still reachable. */
  showHours?: boolean
  /** Top of the minutes wheel when `showHours` is false. Ignored otherwise
   *  (hours mode keeps minutes at 0-59 and carries into the hours column). */
  maxMins?: number
}) {
  const hourValues = useMemo(() => buildRange(0, maxHours), [maxHours])
  const minuteValues = useMemo(() => buildRange(0, showHours ? 59 : maxMins), [showHours, maxMins])
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
      {showHours && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <WheelPicker values={hourValues} value={hours} onChange={onHoursChange} ariaLabel="hours" />
            <div style={unitStyle}>hrs</div>
          </div>

          <span style={sepStyle}>:</span>
        </>
      )}

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
