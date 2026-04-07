'use client'

import { useState, useEffect, useRef } from 'react'
import type { Week } from '@/types/plan'
import { createClient } from '@/lib/supabase/client'

interface Completion {
  session_day: string
  status: string
  strava_activity_name?: string
  strava_activity_km?: number
}

interface Override {
  week_n: number
  original_day: string
  new_day: string
}

const DOW_ORDER = ['mon','tue','wed','thu','fri','sat','sun']
const DOW_FULL: Record<string, string> = { mon:'Mon', tue:'Tue', wed:'Wed', thu:'Thu', fri:'Fri', sat:'Sat', sun:'Sun' }
const DAY_OFFSETS: Record<string, number> = { mon:0, tue:1, wed:2, thu:3, fri:4, sat:5, sun:6 }

const TYPE_ACCENT: Record<string, string> = {
  easy: '#378ADD', quality: '#D4501A', run: '#D4501A',
  race: '#ff7777', strength: '#4a9a5a', rest: 'transparent',
}

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
  border: '0.5px solid var(--border-col, #1c1c1c)',
  borderRadius: '10px', cursor: 'pointer',
  fontFamily: "'DM Mono',monospace", fontSize: '11px',
  color: '#444', letterSpacing: '0.06em', textTransform: 'uppercase',
}

// ── Main export ───────────────────────────────────────────────────────────

interface Props {
  weeks: Week[]
  stravaRuns: any[]
  onSessionTap: (session: any, weekN: number, weekTheme: string) => void
}

export default function PlanCalendar({ weeks, stravaRuns, onSessionTap }: Props) {
  const [allCompletions, setAllCompletions] = useState<Record<number, Completion[]>>({})
  const [overrides, setOverrides] = useState<Override[]>([])
  const [showPast, setShowPast] = useState(false)
  const supabase = createClient()

  const currentWeekIndex = weeks.findIndex(w => (w as any).type === 'current')
  const safeIndex = currentWeekIndex >= 0 ? currentWeekIndex : 0
  const pastWeeks = weeks.slice(0, safeIndex).map((week, i) => ({ week, weekNum: i + 1 }))
  const currentAndFutureWeeks = weeks.slice(safeIndex).map((week, i) => ({ week, weekNum: safeIndex + i + 1 }))

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const [compRes, overRes] = await Promise.all([
        supabase.from('session_completions').select('week_n, session_day, status, strava_activity_name, strava_activity_km').eq('user_id', user.id),
        supabase.from('session_overrides').select('week_n, original_day, new_day').eq('user_id', user.id),
      ])
      if (compRes.data) {
        const map: Record<number, Completion[]> = {}
        compRes.data.forEach((r: any) => { if (!map[r.week_n]) map[r.week_n] = []; map[r.week_n].push(r) })
        setAllCompletions(map)
      }
      if (overRes.data) setOverrides(overRes.data)
    }
    load()
  }, [])

  async function handleMove(weekN: number, originalDay: string, newDay: string) {
    if (originalDay === newDay) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Delete any existing override for this original_day first, then insert fresh
    await supabase.from('session_overrides')
      .delete()
      .eq('user_id', user.id)
      .eq('week_n', weekN)
      .eq('original_day', originalDay)

    const { error } = await supabase.from('session_overrides').insert({
      user_id: user.id, week_n: weekN, original_day: originalDay, new_day: newDay,
      updated_at: new Date().toISOString(),
    })

    if (error) { console.error('Move failed:', error.message); return }

    setOverrides(prev => [
      ...prev.filter(o => !(o.week_n === weekN && o.original_day === originalDay)),
      { week_n: weekN, original_day: originalDay, new_day: newDay }
    ])
  }

  function renderWeek({ week, weekNum }: { week: Week; weekNum: number }) {
    return (
      <WeekCard
        key={weekNum}
        week={week}
        weekNum={weekNum}
        completions={allCompletions[weekNum] ?? []}
        overrides={overrides.filter(o => o.week_n === weekNum)}
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

// ── Week card ─────────────────────────────────────────────────────────────

function WeekCard({ week, weekNum, completions, overrides, stravaRuns, onSessionTap, onMove }: {
  week: Week; weekNum: number; completions: Completion[]; overrides: Override[]
  stravaRuns: any[]
  onSessionTap: (session: any, weekN: number, weekTheme: string) => void
  onMove: (weekN: number, originalDay: string, newDay: string) => void
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

  // Which day's session is currently in "move mode"
  const [movingDay, setMovingDay] = useState<string | null>(null)

  // Apply overrides
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
      onMove(weekNum, originalDay, targetKey)
      return null
    })
  }

  return (
    <div style={{
      background: 'var(--card-bg, #0d0d0d)',
      borderRadius: '14px',
      border: `0.5px solid ${isCurrent ? 'rgba(212,80,26,0.4)' : 'var(--border-col, #1c1c1c)'}`,
      borderLeft: isCurrent ? '3px solid #D4501A' : undefined,
      overflow: 'hidden',
      opacity: isCompleted ? 0.5 : 1,
    }}>

      {/* Week header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 14px 10px',
        borderBottom: '0.5px solid var(--border-col, #1c1c1c)',
        background: isCurrent ? 'rgba(212,80,26,0.04)' : 'transparent',
      }}>
        <div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '10px', color: isCurrent ? '#D4501A' : '#555', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '2px' }}>
            W{weekNum} · {formatDateRange(weekStartDate)}
            {movingDay && <span style={{ color: '#D4501A', marginLeft: '8px' }}>· tap a day to move session</span>}
          </div>
          <div style={{ fontSize: '13px', fontWeight: 500, color: isCompleted ? 'var(--text-muted, #777)' : 'var(--text-primary, #fff)' }}>
            {(week as any).label ?? ''}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', justifyContent: 'flex-end' }}>
            {actualKm > 0 && <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '13px', color: '#4a9a5a', fontWeight: 500 }}>{actualKm.toFixed(1)}</span>}
            {actualKm > 0 && intendedKm > 0 && <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '10px', color: '#333' }}>/</span>}
            {intendedKm > 0 && <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '13px', color: '#444' }}>{intendedKm}km</span>}
          </div>
          {actualKm > 0 && <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '9px', color: '#333', textTransform: 'uppercase', marginTop: '1px' }}>done / target</div>}
        </div>
      </div>

      {/* Day rows */}
      {DOW_ORDER.map((key, i) => {
        const s = effectiveSessions[key]
        const d = weekDates[key]
        const displayDate = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
        const isToday = key === todayDow && displayDate === todayStr
        const completion = completionMap[s?.originalDay ?? key]
        const isComplete = completion?.status === 'complete'
        const isSkipped = completion?.status === 'skipped'
        const isPast = d < now && !isToday
        const isFuture = d > now && !isToday
        const isMovable = !!s && s.type !== 'rest' && !isComplete && !isSkipped
        const isMoving = movingDay === key
        // A day is a valid target if: in move mode, this isn't the moving day, and it doesn't already have a session
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
              if (movingDay) { setMovingDay(null); return } // tap elsewhere = cancel
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

      {/* Cancel move banner */}
      {movingDay && (
        <button
          onClick={() => setMovingDay(null)}
          style={{
            width: '100%', padding: '10px 14px',
            background: 'rgba(212,80,26,0.06)',
            border: 'none', borderTop: '0.5px solid rgba(212,80,26,0.2)',
            cursor: 'pointer',
            fontFamily: "'DM Mono',monospace", fontSize: '11px',
            color: '#D4501A', letterSpacing: '0.06em', textTransform: 'uppercase',
            textAlign: 'center',
          }}
        >
          Cancel move
        </button>
      )}
    </div>
  )
}

// ── Day row ───────────────────────────────────────────────────────────────

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
  const accent = session ? (TYPE_ACCENT[session.type] ?? '#555') : 'transparent'

  return (
    <div
      onClick={onTap}
      style={{
        display: 'flex', alignItems: 'center',
        padding: '10px 14px',
        borderBottom: isLast ? 'none' : '0.5px solid var(--border-col, #1c1c1c)',
        background: isMoving
          ? 'rgba(212,80,26,0.1)'
          : isTarget
          ? 'rgba(212,80,26,0.06)'
          : 'transparent',
        cursor: (hasSession || isTarget) ? 'pointer' : 'default',
        opacity: isMoving ? 0.7 : isMoveMode && !isTarget && !isMoving ? 0.4 : isSkipped ? 0.5 : isPast && !isComplete && hasSession ? 0.45 : 1,
        outline: isTarget ? '1px dashed rgba(212,80,26,0.5)' : isMoving ? '1px solid rgba(212,80,26,0.5)' : 'none',
        outlineOffset: '-1px',
        transition: 'background 0.15s, opacity 0.15s',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      } as React.CSSProperties}
    >
      {/* Day + date */}
      <div style={{ width: '40px', flexShrink: 0 }}>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '10px', color: isToday ? '#D4501A' : 'var(--text-muted, #777)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {DOW_FULL[dayKey]}
        </div>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '12px', color: isToday ? '#D4501A' : 'var(--text-muted, #555)', fontWeight: isToday ? 600 : 400, marginTop: '1px' }}>
          {date.getDate()}
        </div>
      </div>

      {/* Accent bar or target indicator */}
      {isTarget ? (
        <div style={{ width: '3px', height: '34px', borderRadius: '2px', background: 'rgba(212,80,26,0.5)', marginRight: '12px', flexShrink: 0 }} />
      ) : (
        <div style={{ width: '3px', height: hasSession ? '34px' : '16px', borderRadius: '2px', background: isComplete ? '#4a9a5a' : isSkipped ? '#222' : isMoving ? '#D4501A' : accent, marginRight: '12px', flexShrink: 0 }} />
      )}

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {isTarget ? (
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '11px', color: '#D4501A', letterSpacing: '0.04em' }}>
            Move here
          </div>
        ) : isRestType ? (
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '11px', color: 'var(--text-muted, #444)' }}>
            {session?.label ?? 'Rest is the training.'}
          </div>
        ) : (
          <>
            <div style={{
              fontSize: '13px', fontWeight: 500,
              color: isMoving ? '#D4501A' : isSkipped ? 'var(--text-muted, #555)' : isFuture ? 'var(--text-secondary, #888)' : 'var(--text-primary, #fff)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {session.label ?? ''}
              {isMoving && <span style={{ fontSize: '10px', marginLeft: '6px', opacity: 0.7 }}>moving...</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px', flexWrap: 'wrap' }}>
              {session.detail && <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '10px', color: 'var(--text-muted, #555)' }}>{session.detail}</span>}
              {isComplete && completion?.strava_activity_name && (
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '10px', color: '#FC4C02' }}>
                  ● {completion.strava_activity_name}{completion.strava_activity_km ? ` · ${completion.strava_activity_km}km` : ''}
                </span>
              )}
              {isSkipped && <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '10px', color: 'var(--text-muted, #444)' }}>skipped</span>}
            </div>
          </>
        )}
      </div>

      {/* Right side */}
      <div style={{ flexShrink: 0, marginLeft: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        {isComplete && !isMoveMode && <span style={{ color: '#4a9a5a', fontSize: '14px' }}>✓</span>}
        {hasSession && !isComplete && !isSkipped && !isMoveMode && (
          <span style={{ color: 'var(--text-muted, #333)', fontSize: '16px' }}>›</span>
        )}
        {/* Move handle — tap to enter move mode */}
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
              <div key={i} style={{ width: '14px', height: '1.5px', background: 'var(--text-primary, #fff)', borderRadius: '1px' }} />
            ))}
          </button>
        )}
        {/* Cancel icon when this row is moving */}
        {isMoving && (
          <button
            onClick={e => { e.stopPropagation(); onMoveIconTap() }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#D4501A', fontSize: '16px', padding: '2px' }}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  )
}
