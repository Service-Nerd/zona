'use client'

import type { Week } from '@/types/plan'

interface Props { weeks: Week[] }

const MAX_HRS = 5.0

export default function PlanChart({ weeks }: Props) {
  const chartWeeks = weeks.filter(w => w.type !== 'race' && (w.long_run_hrs ?? 0) > 0)

  return (
    <div style={{
      background: 'var(--card-bg)',
      border: '0.5px solid var(--border-col)',
      borderRadius: '12px',
      padding: '16px',
      marginBottom: '18px',
    }}>
      {/* Legend */}
      <div style={{
        fontFamily: "'DM Mono', monospace", fontSize: '10px',
        color: 'var(--text-muted)', letterSpacing: '0.08em',
        textTransform: 'uppercase', marginBottom: '14px',
        display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center',
      }}>
        <span style={{ letterSpacing: '0.05em' }}>Long run progression</span>
        {[
          { color: 'var(--text-muted)',         label: 'Done' },
          { color: '#D4501A',                   label: 'Current' },
          { color: 'rgba(212,80,26,0.2)',        label: 'Deload' },
          { color: 'var(--border-col)',          label: 'Upcoming' },
          { color: '#FC4C02',                   label: 'Race' },
        ].map(({ color, label }) => (
          <span key={label} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: 8, height: 8, borderRadius: '2px', background: color, display: 'inline-block', flexShrink: 0 }} />
            <span>{label}</span>
          </span>
        ))}
      </div>

      {/* Bars */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '100px' }}>
        {chartWeeks.map(w => {
          const pct      = Math.min(((w.long_run_hrs ?? 0) / MAX_HRS) * 100, 100)
          const isDone   = w.type === 'completed' || w.type === 'deload_done'
          const isCurr   = w.type === 'current'
          const isDeload = w.type === 'deload'
          const isRaceEv = w.type === 'race_event'

          const bg = isCurr   ? '#D4501A'
            : isRaceEv        ? '#FC4C02'
            : isDone          ? 'var(--text-muted)'
            : isDeload        ? 'rgba(212,80,26,0.25)'
            : 'var(--border-col)'

          const shadow = isCurr ? '0 0 8px rgba(212,80,26,0.4)' : undefined
          const border = isDeload ? '1px solid rgba(212,80,26,0.3)' : undefined

          const d = new Date(w.date)
          const label = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })

          return (
            <div
              key={w.n}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: '4px',
                height: '100%', justifyContent: 'flex-end',
              }}
            >
              <div
                title={`W${w.n} · ${w.long_run_hrs}hr`}
                style={{
                  width: '100%',
                  height: `${pct}%`,
                  minHeight: '3px',
                  background: bg,
                  borderRadius: '2px 2px 0 0',
                  boxShadow: shadow,
                  border,
                }}
              />
              <div style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: '0.46rem',
                color: isCurr ? '#D4501A' : 'var(--text-muted)',
                fontWeight: isCurr ? 600 : 400,
                writingMode: 'vertical-rl',
                whiteSpace: 'nowrap',
                maxHeight: '34px',
                overflow: 'hidden',
              }}>
                {label}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
