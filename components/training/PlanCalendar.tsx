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

  async function handleDrop(weekN: number, originalDay: string, newDay: string) {
    if (originalDay === newDay) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('session_overrides').upsert({
      user_id: user.id, week_n: weekN, original_day: originalDay, new_day: newDay,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,week_n,original_day' })
    setOverrides(prev => [...prev.filter(o => !(o.week_n === weekN && o.original_day === originalDay)), { week_n: weekN, original_day: originalDay, new_day: newDay }])
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
        onDrop={handleDrop}
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

const loadMoreStyle: React.CSSProperties = {
  width: '100%', padding: '10px', background: 'none',
  border: '0.5px solid var(--border-col, #1c1c1c)',
  borderRadius: '10px', cursor: 'pointer',
  fontFamily: "'DM Mono',monospace", fontSize: '11px',
  color: '#444', letterSpacing: '0.06em', textTransform: 'uppercase',
}

// ── Week card ─────────────────────────────────────────────────────────────

function WeekCard({ week, weekNum, completions, overrides, stravaRuns, onSessionTap, onDrop }: {
  week: Week; weekNum: number; completions: Completion[]; overrides: Override[]
  stravaRuns: any[]; onSessionTap: (session: any, weekN: number, weekTheme: string) => void
  onDrop: (weekN: number, originalDay: string, newDay: string) => void
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

  // Apply overrides to session map
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

  const [dragOverDay, setDragOverDay] = useState<string | null>(null)
  const [draggingDay, setDraggingDay] = useState<string | null>(null)

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
          <div style={{
            fontFamily: "'DM Mono',monospace", fontSize: '10px',
            color: isCurrent ? '#D4501A' : '#555',
            letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '2px',
          }}>
            W{weekNum} · {formatDateRange(weekStartDate)}
          </div>
          <div style={{
            fontSize: '13px', fontWeight: 500,
            color: isCompleted ? 'var(--text-muted, #777)' : 'var(--text-primary, #fff)',
          }}>
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
        const isDraggable = !!s && s.type !== 'rest' && !isComplete && !isSkipped
        const isDragTarget = dragOverDay === key && draggingDay !== null && draggingDay !== key

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
            isDraggable={isDraggable}
            isDragTarget={isDragTarget}
            isLast={i === DOW_ORDER.length - 1}
            onTap={() => {
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
            onDragStart={() => setDraggingDay(s?.originalDay ?? key)}
            onDragEnd={() => { setDraggingDay(null); setDragOverDay(null) }}
            onDragOver={() => setDragOverDay(key)}
            onDrop={() => {
              if (draggingDay && draggingDay !== key) onDrop(weekNum, draggingDay, key)
              setDraggingDay(null)
              setDragOverDay(null)
            }}
          />
        )
      })}
    </div>
  )
}

// ── Day row ───────────────────────────────────────────────────────────────

function DayRow({ dayKey, session, date, isToday, isPast, isFuture, completion, isDraggable, isDragTarget, isLast, onTap, onDragStart, onDragEnd, onDragOver, onDrop }: {
  dayKey: string; session: any; date: Date; isToday: boolean; isPast: boolean; isFuture: boolean
  completion?: Completion; isDraggable: boolean; isDragTarget: boolean; isLast: boolean
  onTap: () => void; onDragStart: () => void; onDragEnd: () => void; onDragOver: () => void; onDrop: () => void
}) {
  const rowRef = useRef<HTMLDivElement>(null)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const touchStartPos = useRef<{ x: number; y: number } | null>(null)
  const isLongPressedRef = useRef(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isLongPressed, setIsLongPressed] = useState(false)

  const isComplete = completion?.status === 'complete'
  const isSkipped  = completion?.status === 'skipped'
  const hasSession = !!session && session.type !== 'rest'
  const isRestType = !session || session.type === 'rest'
  const accent = session ? (TYPE_ACCENT[session.type] ?? '#555') : 'transparent'

  function cancelLongPress() {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null }
  }

  // Attach non-passive touch listeners directly to DOM for reliable preventDefault
  useEffect(() => {
    const el = rowRef.current
    if (!el || !isDraggable) return

    function onTouchStart(e: TouchEvent) {
      const touch = e.touches[0]
      touchStartPos.current = { x: touch.clientX, y: touch.clientY }
      isLongPressedRef.current = false
      longPressTimer.current = setTimeout(() => {
        isLongPressedRef.current = true
        setIsLongPressed(true)
        setIsDragging(true)
        onDragStart()
        if (navigator.vibrate) navigator.vibrate(40)
      }, 500)
    }

    function onTouchMove(e: TouchEvent) {
      if (!touchStartPos.current) return
      const touch = e.touches[0]
      const dx = Math.abs(touch.clientX - touchStartPos.current.x)
      const dy = Math.abs(touch.clientY - touchStartPos.current.y)

      if (!isLongPressedRef.current) {
        if (dx > 8 || dy > 8) cancelLongPress()
        return
      }

      // We're in drag mode — prevent scroll
      e.preventDefault()

      const target = document.elementFromPoint(touch.clientX, touch.clientY)
      const row = target?.closest('[data-daykey]') as HTMLElement | null
      if (row?.dataset.daykey && row.dataset.daykey !== dayKey) onDragOver()
    }

    function onTouchEnd(e: TouchEvent) {
      cancelLongPress()
      if (isLongPressedRef.current) {
        const touch = e.changedTouches[0]
        const target = document.elementFromPoint(touch.clientX, touch.clientY)
        const row = target?.closest('[data-daykey]') as HTMLElement | null
        if (row?.dataset.daykey && row.dataset.daykey !== dayKey) onDrop()
        isLongPressedRef.current = false
        setIsLongPressed(false)
        setIsDragging(false)
        onDragEnd()
      }
      touchStartPos.current = null
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: true })

    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [isDraggable, dayKey])

  return (
    <div
      ref={rowRef}
      data-daykey={dayKey}
      draggable={isDraggable}
      onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; setIsDragging(true); onDragStart() }}
      onDragEnd={() => { setIsDragging(false); onDragEnd() }}
      onDragOver={e => { e.preventDefault(); onDragOver() }}
      onDrop={e => { e.preventDefault(); onDrop() }}
      onClick={() => !isLongPressed && hasSession && onTap()}
      style={{
        display: 'flex', alignItems: 'center',
        padding: '10px 14px',
        borderBottom: isLast ? 'none' : '0.5px solid var(--border-col, #1c1c1c)',
        background: isDragTarget ? 'rgba(212,80,26,0.08)' : 'transparent',
        cursor: hasSession ? 'pointer' : 'default',
        opacity: isDragging ? 0.35 : isSkipped ? 0.5 : isPast && !isComplete && hasSession ? 0.45 : 1,
        outline: isDragTarget ? '1px dashed rgba(212,80,26,0.35)' : 'none',
        outlineOffset: '-1px',
        transition: 'background 0.1s',
        WebkitUserSelect: 'none',
        userSelect: 'none',
        WebkitTouchCallout: 'none',
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

      {/* Accent bar */}
      <div style={{
        width: '3px', height: hasSession ? '34px' : '16px', borderRadius: '2px',
        background: isComplete ? '#4a9a5a' : isSkipped ? '#222' : accent,
        marginRight: '12px', flexShrink: 0,
      }} />

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {isRestType ? (
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '11px', color: 'var(--text-muted, #444)' }}>
            {session?.label ?? 'Rest is the training.'}
          </div>
        ) : (
          <>
            <div style={{
              fontSize: '13px', fontWeight: 500,
              color: isSkipped ? 'var(--text-muted, #555)' : isFuture ? 'var(--text-secondary, #888)' : 'var(--text-primary, #fff)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {session.label ?? ''}
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

      {/* Right */}
      <div style={{ flexShrink: 0, marginLeft: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        {isComplete && <span style={{ color: '#4a9a5a', fontSize: '14px' }}>✓</span>}
        {hasSession && !isComplete && !isSkipped && <span style={{ color: 'var(--text-muted, #333)', fontSize: '16px' }}>›</span>}
        {isDraggable && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5px', opacity: isLongPressed ? 0.8 : 0.2, transition: 'opacity 0.2s' }}>
            {[0,1,2].map(i => <div key={i} style={{ width: '14px', height: '1.5px', background: 'var(--text-primary, #fff)', borderRadius: '1px' }} />)}
          </div>
        )}
      </div>
    </div>
  )
}
