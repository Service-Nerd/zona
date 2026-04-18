'use client'

// CalendarOverlay — extracted from DashboardClient.tsx
// Hidden from the main UI for now. Entry point removed from Today/Plan screens.
// Re-enable by: adding 'calendar' back to the Screen type nav and restoring
// onOpenCalendar props in TodayScreen and DateStrip.

import { useState } from 'react'
import type { Plan } from '@/types/plan'
import { getCurrentWeekIndex, getCurrentWeek } from '@/lib/plan'
import { SESSION_COLORS } from '@/lib/session-types'

const DOW_ORDER = ['mon','tue','wed','thu','fri','sat','sun']
const DOW_LETTER: Record<string, string> = { mon:'M', tue:'T', wed:'W', thu:'T', fri:'F', sat:'S', sun:'S' }
const DOW_FULL:   Record<string, string> = { mon:'Mon', tue:'Tue', wed:'Wed', thu:'Thu', fri:'Fri', sat:'Sat', sun:'Sun' }
const DAY_OFFSETS: Record<string, number> = { mon:0, tue:1, wed:2, thu:3, fri:4, sat:5, sun:6 }

export default function CalendarOverlay({ plan, stravaRuns, allOverrides, allCompletions, onBack, onOpenSession }: {
  plan: Plan
  stravaRuns: any[]
  allOverrides: { week_n: number; original_day: string; new_day: string }[]
  allCompletions: Record<number, Record<string, any>>
  onBack: () => void
  onOpenSession: (s: any) => void
}) {
  const [showPast, setShowPast] = useState(false)

  const now = new Date()
  const todayDow = ['sun','mon','tue','wed','thu','fri','sat'][now.getDay()]

  const currentWeekIndex = getCurrentWeekIndex(plan.weeks)

  const pastWeeks = plan.weeks.slice(0, currentWeekIndex).map((week, i) => ({ week, weekNum: i + 1 }))
  const futureWeeks = plan.weeks.slice(currentWeekIndex).map((week, i) => ({ week, weekNum: currentWeekIndex + i + 1 }))

  function groupByMonth(items: { week: any; weekNum: number }[]) {
    const months: { label: string; weeks: { week: any; weekNum: number }[] }[] = []
    items.forEach(({ week, weekNum }) => {
      const weekDate = new Date((week as any).date)
      const monthLabel = weekDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
      const last = months[months.length - 1]
      if (!last || last.label !== monthLabel) {
        months.push({ label: monthLabel, weeks: [{ week, weekNum }] })
      } else {
        last.weeks.push({ week, weekNum })
      }
    })
    return months
  }

  const pastMonths = groupByMonth(pastWeeks)
  const futureMonths = groupByMonth(futureWeeks)

  function getDotColor(type: string, completion?: any): string {
    if (completion?.status === 'complete') return 'var(--teal)'
    if (completion?.status === 'skipped') return 'var(--border-col)'
    return SESSION_COLORS[type] ?? 'transparent'
  }

  function renderWeekRow(week: any, weekNum: number) {
    const ws = (week as any).sessions ?? {}
    const weekStartDate = new Date((week as any).date)
    const isCurrent = getCurrentWeek(plan.weeks) === week
    const weekCompletions = allCompletions[weekNum] ?? {}

    const weekOverrides = allOverrides.filter(o => o.week_n === weekNum)
    const effectiveWs: Record<string, any> = {}
    DOW_ORDER.forEach(key => {
      if (weekOverrides.some(o => o.original_day === key)) return
      if (ws[key]) effectiveWs[key] = { ...ws[key], originalDay: key }
    })
    weekOverrides.forEach(o => {
      if (ws[o.original_day]) effectiveWs[o.new_day] = { ...ws[o.original_day], originalDay: o.original_day }
    })

    return (
      <div key={weekNum} style={{
        display: 'grid', gridTemplateColumns: '40px repeat(7, 1fr)',
        marginBottom: '4px',
        background: isCurrent ? 'var(--accent-soft)' : 'transparent',
        borderRadius: '8px',
        border: isCurrent ? '0.5px solid var(--accent-dim)' : '0.5px solid transparent',
        padding: '4px 0',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: "'Inter', sans-serif", fontSize: '10px',
          color: isCurrent ? 'var(--accent)' : 'var(--text-secondary)',
        }}>
          W{weekNum}
        </div>
        {DOW_ORDER.map(key => {
          const s = effectiveWs[key]
          const originalDay = s?.originalDay ?? key
          const d = new Date(weekStartDate)
          d.setDate(d.getDate() + DAY_OFFSETS[key])
          const displayDate = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
          const isToday = key === todayDow && isCurrent
          const completion = weekCompletions[originalDay]
          const dotColor = s && s.type !== 'rest' ? getDotColor(s.type, completion) : null
          const isPast = d < now && !isToday
          const isFuture = d > now && !isToday

          return (
            <button
              key={key}
              onClick={() => {
                if (!s || s.type === 'rest') return
                onOpenSession?.({
                  key: originalDay, day: DOW_FULL[key],
                  title: s.label ?? '', detail: s.detail ?? '',
                  type: s.type, date: displayDate,
                  rawDate: d.toISOString(), today: isToday,
                  completion, isPast: isPast && !isToday, isFuture,
                  fromCalendar: true,
                })
              }}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', gap: '3px',
                background: 'none', border: 'none',
                cursor: s && s.type !== 'rest' ? 'pointer' : 'default',
                padding: '4px 2px', borderRadius: '6px',
                opacity: isPast && !completion && s && s.type !== 'rest' ? 0.35 : 1,
              }}
            >
              <span style={{
                fontFamily: "'Inter', sans-serif", fontSize: '12px',
                color: isToday ? 'var(--accent)' : 'var(--text-secondary)',
                fontWeight: isToday ? 600 : 400,
                background: isToday ? 'var(--accent-soft)' : 'transparent',
                borderRadius: '50%', width: '20px', height: '20px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {d.getDate()}
              </span>
              <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: dotColor ?? 'transparent' }} />
            </button>
          )
        })}
      </div>
    )
  }

  const currentMonthLabel = now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

  function renderMonths(months: { label: string; weeks: { week: any; weekNum: number }[] }[]) {
    return months.map(({ label, weeks }) => {
      const isCurrent = label === currentMonthLabel
      return (
        <div key={label} style={{
          background: 'var(--card-bg)',
          borderRadius: '16px',
          border: isCurrent ? '0.5px solid var(--accent-mid)' : '0.5px solid var(--border-col)',
          overflow: 'hidden',
          marginBottom: '10px',
        }}>
          <div style={{
            fontFamily: "'Inter', sans-serif", fontSize: '10px',
            color: isCurrent ? 'var(--accent)' : 'var(--text-secondary)',
            letterSpacing: '0.1em', textTransform: 'uppercase',
            padding: '12px 12px 6px',
            borderBottom: '0.5px solid var(--border-col)',
            display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            {label}
            {isCurrent && <span style={{ background: 'var(--accent-soft)', color: 'var(--accent)', fontSize: '10px', padding: '2px 8px', borderRadius: '20px', border: '0.5px solid var(--accent-mid)' }}>current</span>}
          </div>
          <div style={{ padding: '6px 8px 8px' }}>
            {weeks.map(({ week, weekNum }) => renderWeekRow(week, weekNum))}
          </div>
        </div>
      )
    })
  }

  return (
    <div style={{ minHeight: '100%', background: 'var(--bg)', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 16px 8px',
        borderBottom: '0.5px solid var(--border-col)',
        position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={onBack} style={{ border: 'none', color: 'var(--accent)', fontSize: '22px', cursor: 'pointer', padding: '0', lineHeight: 1, width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', background: 'var(--accent-soft)' }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M13 4L7 10L13 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <div style={{ fontSize: '18px', fontWeight: 500, color: 'var(--text-primary)', fontFamily: "'Space Grotesk',sans-serif", letterSpacing: '-0.3px' }}>
            Plan
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {[{ color: 'var(--blue)', label: 'Easy' }, { color: 'var(--accent)', label: 'Run' }, { color: 'var(--teal)', label: 'Done' }].map(({ color, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: color }} />
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '10px', color: 'var(--text-muted)' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Day header row */}
      <div style={{
        display: 'grid', gridTemplateColumns: '40px repeat(7, 1fr)',
        padding: '8px 12px 4px',
        position: 'sticky', top: '53px', background: 'var(--bg)', zIndex: 9,
        borderBottom: '0.5px solid var(--border-col)',
      }}>
        <div />
        {DOW_ORDER.map(key => (
          <div key={key} style={{ textAlign: 'center', fontFamily: "'Inter', sans-serif", fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {DOW_LETTER[key]}
          </div>
        ))}
      </div>

      <div style={{ padding: '0 12px 32px' }}>
        {pastWeeks.length > 0 && (
          <div style={{ padding: '12px 0 4px' }}>
            {showPast ? (
              <>
                {renderMonths(pastMonths)}
                <button
                  onClick={() => setShowPast(false)}
                  style={{
                    width: '100%', padding: '12px',
                    background: 'none', border: '0.5px solid var(--border-col)',
                    borderRadius: '8px', cursor: 'pointer',
                    fontFamily: "'Inter', sans-serif", fontSize: '12px',
                    color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase',
                    marginBottom: '8px',
                  }}
                >
                  ↑ Hide past weeks
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowPast(true)}
                style={{
                  width: '100%', padding: '12px',
                  background: 'none', border: '0.5px solid var(--border-col)',
                  borderRadius: '8px', cursor: 'pointer',
                  fontFamily: "'Inter', sans-serif", fontSize: '12px',
                  color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase',
                }}
              >
                ↑ Load {pastWeeks.length} past week{pastWeeks.length !== 1 ? 's' : ''}
              </button>
            )}
          </div>
        )}
        {renderMonths(futureMonths)}
      </div>
    </div>
  )
}
