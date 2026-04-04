'use client'

import type { Week } from '@/types/plan'

interface Props { weeks: Week[] }

const MAX_HRS = 5.0

export default function PlanGrid({ weeks }: Props) {
  return (
    <div style={{ display: 'grid', gap: '6px' }}>
      {weeks.map(w => <WeekRow key={w.n} week={w} />)}
    </div>
  )
}

function WeekRow({ week: w }: { week: Week }) {
  const isRace    = w.type === 'race'
  const isRaceEv  = w.type === 'race_event'
  const isDone    = w.type === 'completed' || w.type === 'deload_done'
  const isDeload  = w.type === 'deload'    || w.type === 'deload_done'
  const isCurrent = w.type === 'current'

  const d = new Date(w.date)
  const dateLabel = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })

  const borderColor = isCurrent ? 'var(--orange)'
    : isRace || isRaceEv ? 'var(--red)'
    : isDeload ? '#3d2000'
    : 'var(--border)'

  const bg = isCurrent ? 'var(--orange-dim)'
    : isRace || isRaceEv ? 'rgba(255,51,51,0.05)'
    : 'var(--card)'

  const badgeLabel = w.badge === 'race' ? 'Race Day'
    : w.badge === 'holiday' ? 'holiday'
    : w.badge === 'deload' ? 'deload'
    : null

  const pct = w.long_run_hrs ? Math.min((w.long_run_hrs / MAX_HRS) * 100, 100) : 0

  return (
    <div
      title={w.theme}
      style={{
        background: bg,
        border: `1px solid ${borderColor}`,
        borderLeft: isCurrent ? `3px solid var(--orange)` : undefined,
        borderRadius: '6px',
        padding: '11px 16px',
        display: 'grid',
        gridTemplateColumns: '32px 80px 1fr auto auto',
        alignItems: 'center',
        gap: '12px',
        opacity: isDone ? 0.38 : 1,
        transition: 'background 0.15s',
      }}
    >
      {/* Week number */}
      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.1rem', color: isCurrent ? 'var(--orange)' : 'var(--grey-light)', textAlign: 'center' }}>
        {w.n}
      </div>

      {/* Date */}
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.66rem', color: 'var(--text-dim)' }}>
        {dateLabel}
      </div>

      {/* Label */}
      <div style={{ fontSize: '0.83rem', color: 'var(--text)' }}>{w.label}</div>

      {/* Badge */}
      {badgeLabel ? (
        <div style={{
          fontFamily: "'DM Mono', monospace", fontSize: '0.58rem',
          padding: '2px 9px', borderRadius: '20px', letterSpacing: '0.08em',
          textTransform: 'uppercase', whiteSpace: 'nowrap',
          background: w.badge === 'race' ? 'rgba(255,51,51,0.12)' : w.badge === 'holiday' ? 'rgba(57,217,138,0.1)' : 'rgba(255,107,26,0.1)',
          color: w.badge === 'race' ? 'var(--red)' : w.badge === 'holiday' ? 'var(--green)' : 'var(--orange)',
          border: `1px solid ${w.badge === 'race' ? 'var(--red)' : w.badge === 'holiday' ? 'var(--green)' : 'var(--orange-mid)'}`,
        }}>
          {badgeLabel}
        </div>
      ) : <div />}

      {/* Bar or race label */}
      {isRace ? (
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.2rem', color: 'var(--red)' }}>100km</div>
      ) : isRaceEv ? (
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.1rem', color: 'var(--orange)' }}>50km</div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '72px', height: '3px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: 'var(--orange)', borderRadius: '2px' }} />
          </div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.62rem', color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
            {w.long_run_hrs ? `${w.long_run_hrs}hr` : '—'}
          </div>
        </div>
      )}
    </div>
  )
}
