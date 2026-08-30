'use client'

// WeekGrid — the keystone "your week" control. A row of seven day cells, each
// tapped to cycle Rest → Run → (Long, weekend only) → Rest. One long run across
// the week. Absorbs the old two scheduling steps (days-per-week + days-you-can't
// -train) into one tactile moment: which days, honestly — not how many,
// aspirationally.
//
// Stateless: the caller owns the WeekPlan. The grid → GeneratorInput mapping
// (days_available / days_cannot_train / preferred_long_run_day) is pure and
// node-tested in ./WeekGrid.logic → weekPlanToInputs.
//
// ui-patterns.md § Form Fields & Pickers → WeekGrid.

import { cycleDay, WEEK_DAYS, type WeekPlan, type DayKey } from './WeekGrid.logic'

const LABEL: Record<DayKey, string> = {
  mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun',
}

export function WeekGrid({
  value,
  onChange,
  ariaLabel,
}: {
  value: WeekPlan
  onChange: (next: WeekPlan) => void
  ariaLabel?: string
}) {
  return (
    <div>
      <div role="group" aria-label={ariaLabel} style={{ display: 'flex', gap: '6px' }}>
        {WEEK_DAYS.map(d => {
          const st = value[d]
          const on = st === 'run' || st === 'long'
          const isLong = st === 'long'
          return (
            <button
              key={d}
              type="button"
              aria-label={`${LABEL[d]}: ${st}`}
              onClick={() => onChange(cycleDay(value, d))}
              style={{
                flex: 1, minWidth: 0, height: '60px', borderRadius: 'var(--radius-md)',
                border: on ? '1.5px solid var(--moss)' : '1px solid var(--line)',
                background: isLong ? 'var(--moss-soft)' : on ? 'var(--card)' : 'var(--bg-soft)',
                color: on ? 'var(--moss)' : 'var(--mute)',
                cursor: 'pointer', transition: 'all 0.15s',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '3px',
                fontFamily: 'var(--font-ui)',
              }}
            >
              <span style={{ fontSize: '11px', fontWeight: on ? 700 : 500 }}>{LABEL[d]}</span>
              <span style={{
                fontSize: '8px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                color: isLong ? 'var(--s-long)' : on ? 'var(--moss)' : 'var(--mute)',
                opacity: on ? 1 : 0.65,
              }}>
                {isLong ? 'Long' : on ? 'Run' : 'Rest'}
              </span>
            </button>
          )
        })}
      </div>
      <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)', lineHeight: 1.5, marginTop: '12px' }}>
        Tap a day to add it. Tap a weekend day again to mark your long run.
      </div>
    </div>
  )
}
