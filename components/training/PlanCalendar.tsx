'use client'

import { useState } from 'react'
import type { Week } from '@/types/plan'
import { createClient } from '@/lib/supabase/client'
import { SESSION_COLORS, getSessionColor } from '@/lib/session-types'

interface Completion {
  session_day: string
  status: string
  strava_activity_name?: string
  strava_activity_km?: number
}

const DOW_ORDER = ['mon','tue','wed','thu','fri','sat','sun']
const DOW_FULL: Record<string, string> = { mon:'Mon', tue:'Tue', wed:'Wed', thu:'Thu', fri:'Fri', sat:'Sat', sun:'Sun' }
const DAY_OFFSETS: Record<string, number> = { mon:0, tue:1, wed:2, thu:3, fri:4, sat:5, sun:6 }


function getWeekDates(weekStartDate: Date): Record<string, Date> {
  const dates: Record<string, Date> = {}
  DOW_ORDER.forEach(key => {
    const d = new Date(weekStartDate)
    d.setDate(d.getDate() + DAY_OFFSETS[key])
    dates[key] = d
  })
  return dates
}

function formatDateRange(weekStartDate: Date): string {
  const end = new Date(weekStartDate)
  end.setDate(end.getDate() + 6)
  return `${weekStartDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
}

const loadMoreStyle: React.CSSProperties = {
  width: '100%', padding: '10px', background: 'none',
  border: '0.5px solid var(--border-col, #E2E8F0)',
  borderRadius: '10px', cursor: 'pointer',
  fontFamily: "'Inter', sans-serif", fontSize: '11px',
  color: 'var(--text-muted, #94A3B8)', letterSpacing: '0.06em', textTransform: 'uppercase',
}

interface Props {
  weeks: Week[]
  stravaRuns: any[]
  allOverrides: { week_n: number; original_day: string; new_day: string }[]
  allCompletions: Record<number, Record<string, any>>
  onOverrideChange: (overrides: { week_n: number; original_day: string; new_day: string }[]) => void
  onSessionTap: (session: any, weekN: number, weekTheme: string) => void
}

export default function PlanCalendar({ weeks, stravaRuns, allOverrides, allCompletions, onOverrideChange, onSessionTap }: Props) {
  const [showPast, setShowPast] = useState(false)
  const supabase = createClient()

  const currentWeekIndex = weeks.findIndex(w => (w as any).type === 'current')
  const safeIndex = currentWeekIndex >= 0 ? currentWeekIndex : 0
  const pastWeeks = weeks.slice(0, safeIndex).map((week, i) => ({ week, weekNum: i + 1 }))
  const currentAndFutureWeeks = weeks.slice(safeIndex).map((week, i) => ({ week, weekNum: safeIndex + i + 1 }))

  async function handleMove(weekN: number, originalDay: string, newDay: string, currentSlot: string) {
    if (currentSlot === newDay) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    let updated = allOverrides.filter(o => !(o.week_n === weekN && o.original_day === originalDay))
    updated = updated.filter(o => !(o.week_n === weekN && o.new_day === newDay))
    if (newDay !== originalDay) {
      updated = [...updated, { week_n: weekN, original_day: originalDay, new_day: newDay }]
    }
    onOverrideChange(updated)
    await supabase.from('session_overrides')
      .delete().eq('user_id', user.id).eq('week_n', weekN)
      .or(`original_day.eq.${originalDay},new_day.eq.${newDay},original_day.eq.${newDay}`)
    if (newDay !== originalDay) {
      await supabase.from('session_overrides').insert({
        user_id: user.id, week_n: weekN, original_day: originalDay, new_day: newDay,
        updated_at: new Date().toISOString(),
      })
    }
  }

  function renderWeek({ week, weekNum }: { week: Week; weekNum: number }) {
    return (
      <WeekCard
        key={weekNum}
        week={week}
        weekNum={weekNum}
        completions={Object.values(allCompletions[weekNum] ?? {})}
        overrides={allOverrides.filter(o => o.week_n === weekNum)}
        stravaRuns={stravaRuns}
        onSessionTap={onSessionTap}
        onMove={handleMove}
      />
    )
  }

  return (
    <div style={{ padding: '0 12px 32px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {pastWeeks.length > 0 && (
        showPast ? (
          <>
            {pastWeeks.map(renderWeek)}
            <button onClick={() => setShowPast(false)} style={loadMoreStyle}>↑ Hide past weeks</button>
          </>
        ) : (
          <button onClick={() => setShowPast(true)} style={loadMoreStyle}>
            ↑ Load {pastWeeks.length} past week{pastWeeks.length !== 1 ? 's' : ''}
          </button>
        )
      )}
      {currentAndFutureWeeks.map(renderWeek)}
    </div>
  )
}

function WeekCard({ week, weekNum, completions, overrides, stravaRuns, onSessionTap, onMove }: {
  week: Week; weekNum: number; completions: Completion[]; overrides: { week_n: number; original_day: string; new_day: string }[]
  stravaRuns: any[]
  onSessionTap: (session: any, weekN: number, weekTheme: string) => void
  onMove: (weekN: number, originalDay: string, newDay: string, currentSlot: string) => void
}) {
  const ws = (week as any).sessions ?? {}
  const weekStartDate = new Date((week as any).date)
  const weekDates = getWeekDates(weekStartDate)
  const isCurrent = (week as any).type === 'current'
  const isCompleted = (week as any).type === 'completed' || (week as any).type === 'deload_done'
  const weekTheme = (week as any).theme ?? ''
  const now = new Date()
  const todayDow = ['sun','mon','tue','wed','thu','fri','sat'][now.getDay()]
  const todayStr = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  const [movingDay, setMovingDay] = useState<string | null>(null)

  const effectiveSessions: Record<string, any> = {}
  DOW_ORDER.forEach(key => {
    if (!overrides.some(o => o.original_day === key) && ws[key]) {
      effectiveSessions[key] = { ...ws[key], originalDay: key }
    }
  })
  overrides.forEach(o => {
    if (ws[o.original_day]) {
      effectiveSessions[o.new_day] = { ...ws[o.original_day], originalDay: o.original_day, isOverride: true }
    }
  })

  const intendedKm = (week as any).weekly_km ?? 0
  const completionMap: Record<string, Completion> = {}
  completions.forEach(c => { completionMap[c.session_day] = c })
  const actualKm = completions
    .filter(c => c.status === 'complete' && c.strava_activity_km)
    .reduce((sum, c) => sum + (c.strava_activity_km ?? 0), 0)

  function handleMoveIconTap(key: string) {
    setMovingDay(prev => prev === key ? null : key)
    if (navigator.vibrate) navigator.vibrate(30)
  }

  function handleTargetTap(targetKey: string) {
    setMovingDay(prev => {
      if (!prev) return null
      const originalDay = effectiveSessions[prev]?.originalDay ?? prev
      onMove(weekNum, originalDay, targetKey, prev)
      return null
    })
  }

  return (
    <div style={{
      background: 'var(--card-bg, #ffffff)',
      borderRadius: '14px',
      border: `0.5px solid ${isCurrent ? 'rgba(91,192,190,0.4)' : 'var(--border-col, #E2E8F0)'}`,
      borderLeft: isCurrent ? '3px solid #5BC0BE' : undefined,
      overflow: 'hidden',
      opacity: isCompleted ? 0.5 : 1,
    }}>
      {/* Week header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 14px 10px',
        borderBottom: '0.5px solid var(--border-col, #E2E8F0)',
        background: isCurrent ? 'rgba(91,192,190,0.04)' : 'transparent',
      }}>
        <div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '10px', color: isCurrent ? '#5BC0BE' : 'var(--text-muted, #94A3B8)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '2px' }}>
            W{weekNum} · {formatDateRange(weekStartDate)}
            {movingDay && <span style={{ color: '#5BC0BE', marginLeft: '8px' }}>· tap a day to move session</span>}
          </div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '13px', fontWeight: 500, color: isCompleted ? 'var(--text-muted, #94A3B8)' : 'var(--text-primary, #0B132B)' }}>
            {(week as any).label ?? ''}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', justifyContent: 'flex-end' }}>
            {actualKm > 0 && <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '13px', color: '#5BC0BE', fontWeight: 500 }}>{actualKm.toFixed(1)}</span>}
            {actualKm > 0 && intendedKm > 0 && <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '10px', color: 'var(--text-muted, #94A3B8)' }}>/</span>}
            {intendedKm > 0 && <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '13px', color: 'var(--text-muted, #94A3B8)' }}>{intendedKm}km</span>}
          </div>
          {actualKm > 0 && <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '9px', color: 'var(--text-muted, #94A3B8)', textTransform: 'uppercase', marginTop: '1px' }}>done / target</div>}
        </div>
      </div>

      {DOW_ORDER.map((key, i) => {
        const s = effectiveSessions[key]
        const d = weekDates[key]
        const displayDate = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
        const isToday = key === todayDow && isCurrent
        const completion = s ? completionMap[s.originalDay ?? key] : undefined
        const isComplete = completion?.status === 'complete'
        const isSkipped = completion?.status === 'skipped'
        const isPast = d < now && !isToday
        const isFuture = d > now && !isToday
        const isMovable = !!s && s.type !== 'rest' && !isComplete && !isSkipped
        const isMoving = movingDay === key
        const isTarget = !!movingDay && movingDay !== key && !effectiveSessions[key]

        return (
          <DayRow
            key={key}
            dayKey={key}
            session={s}
            date={d}
            isToday={isToday}
            isPast={isPast}
            isFuture={isFuture}
            completion={completion}
            isMovable={isMovable}
            isMoving={isMoving}
            isTarget={isTarget}
            isMoveMode={!!movingDay}
            isLast={i === DOW_ORDER.length - 1}
            onTap={() => {
              if (isTarget) { handleTargetTap(key); return }
              if (movingDay) { setMovingDay(null); return }
              if (!s || s.type === 'rest') return
              onSessionTap({
                key: s.originalDay ?? key,
                day: DOW_FULL[key],
                title: s.label ?? '',
                detail: s.detail ?? '',
                type: s.type,
                date: displayDate,
                rawDate: d.toISOString(),
                today: isToday,
                completion,
                isPast: isPast && !isToday,
                isFuture,
              }, weekNum, weekTheme)
            }}
            onMoveIconTap={() => handleMoveIconTap(key)}
          />
        )
      })}

      {movingDay && (
        <button
          onClick={() => setMovingDay(null)}
          style={{
            width: '100%', padding: '10px 14px',
            background: 'rgba(91,192,190,0.06)',
            border: 'none', borderTop: '0.5px solid rgba(91,192,190,0.2)',
            cursor: 'pointer',
            fontFamily: "'Inter', sans-serif", fontSize: '11px',
            color: '#5BC0BE', letterSpacing: '0.06em', textTransform: 'uppercase',
            textAlign: 'center',
          }}
        >
          Cancel move
        </button>
      )}
    </div>
  )
}

function DayRow({ dayKey, session, date, isToday, isPast, isFuture, completion, isMovable, isMoving, isTarget, isMoveMode, isLast, onTap, onMoveIconTap }: {
  dayKey: string; session: any; date: Date; isToday: boolean; isPast: boolean; isFuture: boolean
  completion?: Completion; isMovable: boolean; isMoving: boolean; isTarget: boolean
  isMoveMode: boolean; isLast: boolean
  onTap: () => void; onMoveIconTap: () => void
}) {
  const isComplete = completion?.status === 'complete'
  const isSkipped  = completion?.status === 'skipped'
  const hasSession = !!session && session.type !== 'rest'
  const isRestType = !session || session.type === 'rest'
  const accent = session ? (SESSION_COLORS[session.type] ?? 'var(--text-muted, #94A3B8)') : 'transparent'

  return (
    <div
      onClick={onTap}
      style={{
        display: 'flex', alignItems: 'center',
        padding: '10px 14px',
        borderBottom: isLast ? 'none' : '0.5px solid var(--border-col, #E2E8F0)',
        background: isMoving
          ? 'rgba(91,192,190,0.08)'
          : isTarget
          ? 'rgba(91,192,190,0.04)'
          : 'transparent',
        cursor: (hasSession || isTarget) ? 'pointer' : 'default',
        opacity: isMoving ? 0.7 : isMoveMode && !isTarget && !isMoving ? 0.4 : isSkipped ? 0.5 : isPast && !isComplete && hasSession ? 0.45 : 1,
        outline: isTarget ? '1px dashed rgba(91,192,190,0.4)' : isMoving ? '1px solid rgba(91,192,190,0.5)' : 'none',
        outlineOffset: '-1px',
        transition: 'background 0.15s, opacity 0.15s',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      } as React.CSSProperties}
    >
      <div style={{ width: '40px', flexShrink: 0 }}>
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '10px', color: isToday ? '#5BC0BE' : 'var(--text-muted, #94A3B8)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {DOW_FULL[dayKey]}
        </div>
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: isToday ? '#5BC0BE' : 'var(--text-muted, #94A3B8)', fontWeight: isToday ? 600 : 400, marginTop: '1px' }}>
          {date.getDate()}
        </div>
      </div>

      {isTarget ? (
        <div style={{ width: '3px', height: '34px', borderRadius: '2px', background: 'rgba(91,192,190,0.5)', marginRight: '12px', flexShrink: 0 }} />
      ) : (
        <div style={{ width: '3px', height: hasSession ? '34px' : '16px', borderRadius: '2px', background: isComplete ? '#5BC0BE' : isSkipped ? 'var(--border-col, #E2E8F0)' : isMoving ? '#5BC0BE' : accent, marginRight: '12px', flexShrink: 0 }} />
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        {isTarget ? (
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '11px', color: '#5BC0BE', letterSpacing: '0.04em' }}>
            Move here
          </div>
        ) : isRestType ? (
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '11px', color: 'var(--text-muted, #94A3B8)' }}>
            {session?.label ?? 'Rest is the training.'}
          </div>
        ) : (
          <>
            <div style={{
              fontSize: '13px', fontWeight: 500,
              color: isMoving ? '#5BC0BE' : isSkipped ? 'var(--text-muted, #94A3B8)' : isFuture ? 'var(--text-secondary, #3A506B)' : 'var(--text-primary, #0B132B)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {session.label ?? ''}
              {isMoving && <span style={{ fontSize: '10px', marginLeft: '6px', opacity: 0.7 }}>moving...</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px', flexWrap: 'wrap' }}>
              {session.detail && <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '10px', color: 'var(--text-muted, #94A3B8)' }}>{session.detail}</span>}
              {isComplete && completion?.strava_activity_name && (
                <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '10px', color: '#FC4C02' }}>
                  ● {completion.strava_activity_name}{completion.strava_activity_km ? ` · ${completion.strava_activity_km}km` : ''}
                </span>
              )}
              {isSkipped && <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '10px', color: 'var(--text-muted, #94A3B8)' }}>skipped</span>}
            </div>
          </>
        )}
      </div>

      <div style={{ flexShrink: 0, marginLeft: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        {isComplete && !isMoveMode && <span style={{ color: '#5BC0BE', fontSize: '14px' }}>✓</span>}
        {hasSession && !isComplete && !isSkipped && !isMoveMode && (
          <span style={{ color: 'var(--text-muted, #94A3B8)', fontSize: '16px' }}>›</span>
        )}
        {isMovable && !isMoveMode && (
          <button
            onClick={e => { e.stopPropagation(); onMoveIconTap() }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '4px', display: 'flex', flexDirection: 'column', gap: '2.5px',
              opacity: 0.25,
            }}
          >
            {[0,1,2].map(i => (
              <div key={i} style={{ width: '14px', height: '1.5px', background: 'var(--text-primary, #0B132B)', borderRadius: '1px' }} />
            ))}
          </button>
        )}
        {isMoving && (
          <button
            onClick={e => { e.stopPropagation(); onMoveIconTap() }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5BC0BE', fontSize: '16px', padding: '2px' }}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  )
}
