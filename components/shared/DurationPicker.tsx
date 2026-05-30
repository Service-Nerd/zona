'use client'

// Hour/minute stepper used wherever the user enters a finish time or target time.
// Single source of truth — used by the wizard (GeneratePlanScreen) and the
// benchmark recalibration screen (BenchmarkUpdateScreen).

import type React from 'react'

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
  const btnStyle: React.CSSProperties = {
    width: '44px', height: '44px', borderRadius: '8px',
    border: '1px solid var(--line)', background: 'none',
    cursor: 'pointer', color: 'var(--ink-2)',
    fontFamily: 'var(--font-ui)', fontSize: '20px', lineHeight: 1,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }
  const valStyle: React.CSSProperties = {
    fontFamily: 'var(--font-ui)', fontSize: '30px', fontWeight: 600,
    color: 'var(--ink)', minWidth: '52px', textAlign: 'center', lineHeight: 1,
  }
  const unitStyle: React.CSSProperties = {
    fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--mute)',
    textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '2px',
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '8px 0' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
        <button style={btnStyle} onClick={() => onHoursChange(Math.min(maxHours, hours + 1))}>+</button>
        <div style={valStyle}>{hours}</div>
        <div style={unitStyle}>hrs</div>
        <button style={btnStyle} onClick={() => onHoursChange(Math.max(0, hours - 1))}>−</button>
      </div>
      <span style={{ fontFamily: 'var(--font-ui)', fontSize: '28px', color: 'var(--mute)', fontWeight: 300, paddingBottom: '20px' }}>:</span>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
        <button style={btnStyle} onClick={() => onMinsChange(mins === 59 ? 0 : mins + 1)}>+</button>
        <div style={valStyle}>{String(mins).padStart(2, '0')}</div>
        <div style={unitStyle}>min</div>
        <button style={btnStyle} onClick={() => onMinsChange(mins === 0 ? 59 : mins - 1)}>−</button>
      </div>
      {showSeconds && (
        <>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: '28px', color: 'var(--mute)', fontWeight: 300, paddingBottom: '20px' }}>:</span>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
            <button style={btnStyle} onClick={() => onSecsChange?.((secs ?? 0) === 59 ? 0 : (secs ?? 0) + 1)}>+</button>
            <div style={valStyle}>{String(secs ?? 0).padStart(2, '0')}</div>
            <div style={unitStyle}>sec</div>
            <button style={btnStyle} onClick={() => onSecsChange?.((secs ?? 0) === 0 ? 59 : (secs ?? 0) - 1)}>−</button>
          </div>
        </>
      )}
    </div>
  )
}
