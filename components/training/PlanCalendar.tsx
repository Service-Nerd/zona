'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { Week } from '@/types/plan'
import { createClient } from '@/lib/supabase/client'

// ── Types ─────────────────────────────────────────────────────────────────

interface SessionEntry {
  key: string
  day: string
  title: string
  detail: string | null
  type: string
  date: string
  rawDate: Date
  today: boolean
  isOverride?: boolean
}

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

// ── Constants ─────────────────────────────────────────────────────────────

const DOW_ORDER = ['mon','tue','wed','thu','fri','sat','sun']
const DOW_FULL: Record<string, string> = { mon:'Mon', tue:'Tue', wed:'Wed', thu:'Thu', fri:'Fri', sat:'Sat', sun:'Sun' }
const DAY_OFFSETS: Record<string, number> = { mon:0, tue:1, wed:2, thu:3, fri:4, sat:5, sun:6 }

const TYPE_ACCENT: Record<string, string> = {
  easy:     '#378ADD',
  quality:  '#D4501A',
  run:      '#D4501A',
  race:     '#ff7777',
  strength: '#4a9a5a',
  rest:     'transparent',
}

const TYPE_LABEL: Record<string, string> = {
  easy:     'Easy run',
  quality:  'Quality',
  run:      'Long run',
  race:     'Race',
  strength: 'Strength',
  rest:     'Rest',
}

// ── Helpers ───────────────────────────────────────────────────────────────

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
  const startStr = weekStartDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  const endStr = end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  return `${startStr} – ${endStr}`
}

// ── Main component ────────────────────────────────────────────────────────

interface Props {
  weeks: Week[]
  stravaRuns: any[]
  onSessionTap: (session: any, weekN: number, weekTheme: string) => void
}

export default function PlanCalendar({ weeks, stravaRuns, onSessionTap }: Props) {
  const [allCompletions, setAllCompletions] = useState<Record<number, Completion[]>>({})
  const [overrides, setOverrides] = useState<Override[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const [compRes, overRes] = await Promise.all([
        supabase.from('session_completions')
          .select('week_n, session_day, status, strava_activity_name, strava_activity_km')
          .eq('user_id', user.id),
        supabase.from('session_overrides')
          .select('week_n, original_day, new_day')
          .eq('user_id', user.id),
      ])

      if (compRes.data) {
        const map: Record<number, Completion[]> = {}
        compRes.data.forEach((r: any) => {
          if (!map[r.week_n]) map[r.week_n] = []
          map[r.week_n].push(r)
        })
        setAllCompletions(map)
      }

      if (overRes.data) setOverrides(overRes.data)
      setLoading(false)
    }
    load()
  }, [])

  async function handleDrop(weekN: number, originalDay: string, newDay: string) {
    if (originalDay === newDay) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('session_overrides').upsert({
      user_id: user.id,
      week_n: weekN,
      original_day: originalDay,
      new_day: newDay,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,week_n,original_day' })

    setOverrides(prev => {
      const filtered = prev.filter(o => !(o.week_n === weekN && o.original_day === originalDay))
      return [...filtered, { week_n: weekN, original_day: originalDay, new_day: newDay }]
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
      {weeks.map((week, i) => (
        <WeekSection
          key={week.n}
          week={week}
          weekNum={i + 1}
          completions={allCompletions[i + 1] ?? []}
          overrides={overrides.filter(o => o.week_n === i + 1)}
          stravaRuns={stravaRuns}
          onSessionTap={onSessionTap}
          onDrop={handleDrop}
        />
      ))}
    </div>
  )
}

// ── Week section ──────────────────────────────────────────────────────────

function WeekSection({ week, weekNum, completions, overrides, stravaRuns, onSessionTap, onDrop }: {
  week: Week
  weekNum: number
  completions: Completion[]
  overrides: Override[]
  stravaRuns: any[]
  onSessionTap: (session: any, weekN: number, weekTheme: string) => void
  onDrop: (weekN: number, originalDay: string, newDay: string) => void
}) {
  const ws = (week as any).sessions ?? {}
  const weekStartDate = new Date((week as any).date)
  const weekDates = getWeekDates(weekStartDate)
  const isCurrent = (week as any).type === 'current'
  const isCompleted = (week as any).type === 'completed' || (week as any).type === 'deload_done'
  const now = new Date()
  const todayDow = ['sun','mon','tue','wed','thu','fri','sat'][now.getDay()]
  const todayStr = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

  // Apply overrides to session map
  const effectiveSessions: Record<string, any> = {}
  // First place non-overridden sessions
  DOW_ORDER.forEach(key => {
    const isOverridden = overrides.some(o => o.original_day === key)
    if (!isOverridden && ws[key]) {
      effectiveSessions[key] = { ...ws[key], originalDay: key }
    }
  })
  // Then place overridden sessions at their new day
  overrides.forEach(o => {
    if (ws[o.original_day]) {
      effectiveSessions[o.new_day] = { ...ws[o.original_day], originalDay: o.original_day, isOverride: true }
    }
  })

  // Calculate km totals
  const intendedKm = (week as any).weekly_km ?? 0
  const completionMap: Record<string, Completion> = {}
  completions.forEach(c => { completionMap[c.session_day] = c })
  const actualKm = completions
    .filter(c => c.status === 'complete' && c.strava_activity_km)
    .reduce((sum, c) => sum + (c.strava_activity_km ?? 0), 0)

  // Drop target state
  const [dragOverDay, setDragOverDay] = useState<string | null>(null)
  const [draggingDay, setDraggingDay] = useState<string | null>(null)

  return (
    <div style={{
      marginBottom: '0',
      borderBottom: '0.5px solid var(--border-col, #1c1c1c)',
    }}>
      {/* Week header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px 8px',
        background: isCurrent ? 'rgba(212,80,26,0.04)' : 'transparent',
        borderLeft: isCurrent ? '3px solid #D4501A' : '3px solid transparent',
      }}>
        <div>
          <div style={{
            fontFamily: "'DM Mono',monospace", fontSize: '10px',
            color: isCurrent ? '#D4501A' : '#444',
            letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '2px',
          }}>
            W{weekNum} · {formatDateRange(weekStartDate)}
          </div>
          <div style={{
            fontSize: '13px', fontWeight: 500,
            color: isCompleted ? '#444' : 'var(--text-primary, #fff)',
          }}>
            {(week as any).label ?? ''}
          </div>
        </div>
        {/* Km totals */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {actualKm > 0 && (
              <span style={{
                fontFamily: "'DM Mono',monospace", fontSize: '12px',
                color: '#4a9a5a', fontWeight: 500,
              }}>
                {actualKm.toFixed(1)}
              </span>
            )}
            {actualKm > 0 && intendedKm > 0 && (
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '10px', color: '#333' }}>/</span>
            )}
            {intendedKm > 0 && (
              <span style={{
                fontFamily: "'DM Mono',monospace", fontSize: '12px',
                color: '#444',
              }}>
                {intendedKm}km
              </span>
            )}
          </div>
          {actualKm > 0 && (
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '9px', color: '#333', textTransform: 'uppercase' }}>
              actual / target
            </div>
          )}
        </div>
      </div>

      {/* Day rows */}
      <div>
        {DOW_ORDER.map(key => {
          const s = effectiveSessions[key]
          const d = weekDates[key]
          const displayDate = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
          const isToday = key === todayDow && displayDate === todayStr
          const completion = completionMap[s?.originalDay ?? key]
          const isComplete = completion?.status === 'complete'
          const isSkipped = completion?.status === 'skipped'
          const isPast = d < now && !isToday
          const isFuture = d > now && !isToday
          const isDraggable = s && !isComplete && !isSkipped
          const isDragTarget = dragOverDay === key && draggingDay && draggingDay !== key

          return (
            <DayRow
              key={key}
              dayKey={key}
              session={s}
              date={d}
              displayDate={displayDate}
              isToday={isToday}
              isPast={isPast}
              isFuture={isFuture}
              completion={completion}
              isDraggable={!!isDraggable}
              isDragTarget={!!isDragTarget}
              onTap={() => {
                if (!s) return
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
                }, weekNum, (week as any).theme ?? '')
              }}
              onDragStart={() => setDraggingDay(s?.originalDay ?? key)}
              onDragEnd={() => { setDraggingDay(null); setDragOverDay(null) }}
              onDragOver={() => setDragOverDay(key)}
              onDrop={() => {
                if (draggingDay && draggingDay !== key) {
                  onDrop(weekNum, draggingDay, key)
                }
                setDraggingDay(null)
                setDragOverDay(null)
              }}
            />
          )
        })}
      </div>
    </div>
  )
}

// ── Day row ───────────────────────────────────────────────────────────────

function DayRow({ dayKey, session, date, displayDate, isToday, isPast, isFuture, completion, isDraggable, isDragTarget, onTap, onDragStart, onDragEnd, onDragOver, onDrop }: {
  dayKey: string
  session: any
  date: Date
  displayDate: string
  isToday: boolean
  isPast: boolean
  isFuture: boolean
  completion?: Completion
  isDraggable: boolean
  isDragTarget: boolean
  onTap: () => void
  onDragStart: () => void
  onDragEnd: () => void
  onDragOver: () => void
  onDrop: () => void
}) {
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [longPressed, setLongPressed] = useState(false)

  const isComplete = completion?.status === 'complete'
  const isSkipped  = completion?.status === 'skipped'
  const hasSession = !!session && session.type !== 'rest'
  const isRestType = !session || session.type === 'rest'
  const accent = session ? (TYPE_ACCENT[session.type] ?? '#555') : 'transparent'

  // Long press handlers for mobile drag
  function handleTouchStart(e: React.TouchEvent) {
    if (!isDraggable) return
    longPressTimer.current = setTimeout(() => {
      setLongPressed(true)
      onDragStart()
      // Vibrate if available
      if (navigator.vibrate) navigator.vibrate(30)
    }, 500)
  }

  function handleTouchEnd() {
    if (longPressTimer.current) clearTimeout(longPressTimer.current)
    if (longPressed) {
      setLongPressed(false)
      onDragEnd()
    }
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!longPressed) {
      if (longPressTimer.current) clearTimeout(longPressTimer.current)
      return
    }
    // Find element under touch point
    const touch = e.touches[0]
    const el = document.elementFromPoint(touch.clientX, touch.clientY)
    const row = el?.closest('[data-daykey]')
    if (row) {
      const targetKey = row.getAttribute('data-daykey')
      if (targetKey) onDragOver()
    }
  }

  return (
    <div
      data-daykey={dayKey}
      draggable={isDraggable}
      onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; setIsDragging(true); onDragStart() }}
      onDragEnd={() => { setIsDragging(false); onDragEnd() }}
      onDragOver={e => { e.preventDefault(); onDragOver() }}
      onDrop={e => { e.preventDefault(); onDrop() }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
      onClick={() => hasSession && onTap()}
      style={{
        display: 'flex', alignItems: 'center',
        padding: '10px 16px',
        borderBottom: '0.5px solid var(--border-col, #1c1c1c)',
        background: isDragTarget
          ? 'rgba(212,80,26,0.08)'
          : isDragging
          ? 'rgba(255,255,255,0.02)'
          : 'transparent',
        cursor: hasSession ? 'pointer' : 'default',
        opacity: isDragging ? 0.4 : isSkipped ? 0.5 : isPast && !isComplete && hasSession ? 0.45 : 1,
        transition: 'background 0.1s, opacity 0.15s',
        outline: isDragTarget ? '1px dashed rgba(212,80,26,0.4)' : 'none',
        userSelect: 'none',
      }}
    >
      {/* Day + date column */}
      <div style={{ width: '44px', flexShrink: 0 }}>
        <div style={{
          fontFamily: "'DM Mono',monospace", fontSize: '10px',
          color: isToday ? '#D4501A' : '#444',
          textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>
          {DOW_FULL[dayKey]}
        </div>
        <div style={{
          fontFamily: "'DM Mono',monospace", fontSize: '11px',
          color: isToday ? '#D4501A' : '#555',
          fontWeight: isToday ? 600 : 400,
          marginTop: '1px',
        }}>
          {date.getDate()}
        </div>
      </div>

      {/* Accent bar */}
      <div style={{
        width: '3px', height: hasSession ? '36px' : '20px',
        borderRadius: '2px',
        background: isComplete ? '#4a9a5a' : isSkipped ? '#2a2a2a' : accent,
        marginRight: '12px', flexShrink: 0,
      }} />

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {isRestType ? (
          // Rest day — on-brand copy matching RestDayCard
          <div style={{
            fontFamily: "'DM Mono',monospace", fontSize: '11px',
            color: '#333', letterSpacing: '0.04em',
          }}>
            {session?.label ?? 'Rest is the training.'}
          </div>
        ) : (
          <>
            <div style={{
              fontSize: '13px', fontWeight: 500,
              color: isSkipped ? '#444' : isComplete ? 'var(--text-primary, #fff)' : isFuture ? '#888' : 'var(--text-primary, #fff)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {session.label ?? ''}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
              {session.detail && (
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '10px', color: '#444' }}>
                  {session.detail}
                </span>
              )}
              {isComplete && completion?.strava_activity_name && (
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '10px', color: '#FC4C02' }}>
                  ● {completion.strava_activity_name}
                  {completion.strava_activity_km ? ` · ${completion.strava_activity_km}km` : ''}
                </span>
              )}
              {isSkipped && (
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '10px', color: '#333' }}>skipped</span>
              )}
            </div>
          </>
        )}
      </div>

      {/* Right side */}
      <div style={{ flexShrink: 0, marginLeft: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
        {isComplete && <span style={{ color: '#4a9a5a', fontSize: '14px' }}>✓</span>}
        {hasSession && !isComplete && !isSkipped && (
          <span style={{ color: '#2a2a2a', fontSize: '16px' }}>›</span>
        )}
        {isDraggable && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', opacity: 0.25, marginLeft: '4px' }}>
            <div style={{ width: '14px', height: '1.5px', background: 'var(--text-primary, #fff)', borderRadius: '1px' }} />
            <div style={{ width: '14px', height: '1.5px', background: 'var(--text-primary, #fff)', borderRadius: '1px' }} />
            <div style={{ width: '14px', height: '1.5px', background: 'var(--text-primary, #fff)', borderRadius: '1px' }} />
          </div>
        )}
      </div>
    </div>
  )
}
