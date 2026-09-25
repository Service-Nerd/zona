'use client'

// DurationPicker — the canonical time/duration entry. Used wherever the user
// enters a finish time, target time, or duration: the wizard (target + benchmark
// time), the benchmark recalibration screen, and the race-result sheet.
//
// Interaction is scroll WHEELS (WheelPicker columns hrs : min : sec), not the
// old +/- steppers — decided app-wide 2026-08-30.
//
// 🔴 SECONDS ARE NOT OPTIONAL (TIME-INPUT-SECONDS-01, Design Board 2026-09-25).
// `showSeconds` was a per-caller prop defaulting to FALSE, and it was set at
// three call sites and forgotten at three. That is the drift § Form Fields &
// Pickers was written to end — *"the same quantities were collected 2-3
// different ways across screens; these primitives end that drift"* — surviving
// as a prop instead of as a component.
//
// Measured on live data before the board ruled: **12 of 12 stored times end
// `:00`** (4 of 4 target times, 8 of 8 benchmarks). Not one runner had ever
// recorded a real seconds value, because three screens could not accept one —
// and those screens did not OMIT the seconds, they hardcoded `:00` into the
// stored string. The app asserted a precision it never collected.
//
// ⚠️ THE DIRECTION OF THE ERROR IS WHY THIS MATTERED (Sierra). Truncating to the
// minute always makes the runner look FASTER: worst case 11.8 sec/km at 5K, 5.9
// at 10K, 2.8 at HM. Every prescribed pace derives from that benchmark, in a
// product whose whole thesis is that people run their easy days too hard.
//
// The prop is GONE rather than defaulted to true, so no call site can turn it
// off and the compiler visits every one of them.
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
  showHours = true,
  maxMins = 90,
}: {
  hours: number
  mins: number
  /** Seconds. Always collected — see the header. */
  secs: number
  onHoursChange: (v: number) => void
  onMinsChange: (v: number) => void
  onSecsChange: (v: number) => void
  maxHours?: number
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
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: 'var(--space-2)', padding: '8px 0' }}>
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

      <span style={sepStyle}>:</span>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <WheelPicker values={secondValues} value={secs} onChange={onSecsChange} format={pad2} ariaLabel="seconds" />
        <div style={unitStyle}>sec</div>
      </div>
    </div>
  )
}
