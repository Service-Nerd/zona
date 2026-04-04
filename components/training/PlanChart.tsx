'use client'

import type { Week } from '@/types/plan'

interface Props { weeks: Week[] }

const MAX_HRS = 5.0

export default function PlanChart({ weeks }: Props) {
  const chartWeeks = weeks.filter(w => w.type !== 'race' && (w.long_run_hrs ?? 0) > 0)

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '6px', padding: '20px', marginBottom: '18px' }}>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.62rem', color: 'var(--text-dim)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '14px', display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
        <span>Long Run Progression — Hours on Feet</span>
        {[
          { cls: 'var(--grey-light)', label: 'Done' },
          { cls: 'var(--orange)',     label: 'Current' },
          { cls: '#2a1400',           label: 'Deload' },
          { cls: 'var(--border)',     label: 'Upcoming' },
        ].map(({ cls, label }) => (
          <span key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: 8, height: 8, borderRadius: '2px', background: cls, display: 'inline-block', border: cls === '#2a1400' ? '1px solid #3d2000' : undefined }} />
            {label}
          </span>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '110px' }}>
        {chartWeeks.map(w => {
          const pct      = Math.min(((w.long_run_hrs ?? 0) / MAX_HRS) * 100, 100)
          const isDone   = w.type === 'completed'
          const isCurr   = w.type === 'current'
          const isDeload = w.type === 'deload' || w.type === 'deload_done'
          const isRaceEv = w.type === 'race_event'

          const bg = isDone ? 'var(--grey-light)'
            : isCurr   ? 'var(--orange)'
            : isDeload ? '#2a1400'
            : isRaceEv ? 'var(--orange)'
            : 'var(--border)'

          const shadow = isCurr || isRaceEv ? '0 0 8px rgba(255,107,26,0.5)' : undefined

          const d = new Date(w.date)
          const label = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })

          return (
            <div key={w.n} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', height: '100%', justifyContent: 'flex-end' }}>
              <div
                title={`W${w.n} · ${w.long_run_hrs}hr`}
                style={{ width: '100%', height: `${pct}%`, minHeight: '3px', background: bg, borderRadius: '2px 2px 0 0', boxShadow: shadow, border: isDeload ? '1px solid #3d2000' : undefined }}
              />
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.46rem', color: 'var(--text-dim)', writingMode: 'vertical-rl', whiteSpace: 'nowrap', maxHeight: '34px', overflow: 'hidden' }}>
                {label}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
