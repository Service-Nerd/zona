'use client'

import { useState } from 'react'
import type { Week, Session, StravaActivity } from '@/types/plan'
import { createClient } from '@/lib/supabase/client'
import { SESSION_COLORS, SESSION_LABELS } from '@/lib/session-types'
import { getCurrentWeekIndex, parseLocalDate } from '@/lib/plan'
import { formatDistance, sumRoundedDistance, type DistanceUnits } from '@/lib/format'

interface Completion {
  session_day: string
  status: string
  strava_activity_name?: string
  strava_activity_km?: number
}

/** Session as it appears after override resolution — augmented with routing metadata. */
type EffectiveSession = Session & { originalDay: string; isOverride?: boolean }

/** Shape passed to onSessionTap — matches docs/contracts/components/plan-calendar.md */
export interface SessionTapPayload {
  key: string
  day: string
  title: string
  detail: string
  type: string
  date: string
  rawDate: string
  today: boolean
  completion: Completion | undefined
  isPast: boolean
  isFuture: boolean
  // Structured session fields — always pass through so SessionScreen renders identically
  // regardless of whether it was opened from Today or Plan.
  distance_km?: number
  duration_mins?: number
  primary_metric?: 'distance' | 'duration'
  hr_target?: string
  pace_target?: string
  rpe_target?: number
  coach_notes?: [string, string?, string?]
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
  border: '0.5px solid var(--border-col)',
  borderRadius: '10px', cursor: 'pointer',
  fontFamily: 'var(--font-ui)', fontSize: '11px',
  color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase',
}

interface Props {
  weeks: Week[]
  stravaRuns: StravaActivity[]
  allOverrides: { week_n: number; original_day: string; new_day: string }[]
  allCompletions: Record<number, Record<string, Completion>>
  onOverrideChange: (overrides: { week_n: number; original_day: string; new_day: string }[]) => void
  onSessionTap: (session: SessionTapPayload, weekN: number, weekTheme: string) => void
  overridesReady?: boolean
  units?: DistanceUnits
}

export default function PlanCalendar({ weeks, stravaRuns, allOverrides, allCompletions, onOverrideChange, onSessionTap, overridesReady = true, units = 'km' }: Props) {
  const [showPast, setShowPast] = useState(false)
  const supabase = createClient()

  const currentWeekIndex = getCurrentWeekIndex(weeks)
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
        units={units}
      />
    )
  }

  if (!overridesReady) return (
    <div style={{ padding: '0 12px 32px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {[120, 200, 160].map((h, i) => (
        <div key={i} style={{ height: `${h}px`, borderRadius: '14px', background: 'var(--border-col)', opacity: 1 - i * 0.15 }} />
      ))}
    </div>
  )

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

function WeekCard({ week, weekNum, completions, overrides, stravaRuns, onSessionTap, onMove, units }: {
  week: Week; weekNum: number; completions: Completion[]; overrides: { week_n: number; original_day: string; new_day: string }[]
  stravaRuns: StravaActivity[]
  onSessionTap: (session: SessionTapPayload, weekN: number, weekTheme: string) => void
  onMove: (weekN: number, originalDay: string, newDay: string, currentSlot: string) => void
  units: DistanceUnits
}) {
  const ws = week.sessions ?? {}
  const weekStartDate = parseLocalDate(week.date)
  const weekDates = getWeekDates(weekStartDate)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const weekEnd = new Date(weekStartDate); weekEnd.setDate(weekEnd.getDate() + 7)
  const isCurrent = now >= weekStartDate && now < weekEnd
  const isCompleted = !isCurrent && weekStartDate < now
  const weekTheme = week.theme ?? ''
  const todayDow = ['sun','mon','tue','wed','thu','fri','sat'][new Date().getDay()]
  const [movingDay, setMovingDay] = useState<string | null>(null)

  const effectiveSessions: Record<string, EffectiveSession> = {}
  DOW_ORDER.forEach(key => {
    const session = ws[key as keyof typeof ws]
    if (!overrides.some(o => o.original_day === key) && session) {
      effectiveSessions[key] = { ...session, originalDay: key }
    }
  })
  overrides.forEach(o => {
    const session = ws[o.original_day as keyof typeof ws]
    if (session) {
      effectiveSessions[o.new_day] = { ...session, originalDay: o.original_day, isOverride: true }
    }
  })

  // Intended km = sum of rounded individual session distances, so the week
  // total matches what the user sees on each session row. Plan JSON's
  // weekly_km is ignored as a display source for this reason.
  const sessionDistances = Object.values(ws).map((s: any) => s?.distance_km as number | undefined)
  const intendedKm = sumRoundedDistance(sessionDistances, units)
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
      background: 'var(--card-bg)',
      borderRadius: '14px',
      border: `0.5px solid ${isCurrent ? 'var(--teal-mid)' : 'var(--border-col)'}`,
      borderLeft: isCurrent ? '3px solid var(--accent)' : undefined,
      overflow: 'hidden',
      opacity: isCompleted ? 0.65 : 1,
    }}>
      {/* Week header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 14px 10px',
        borderBottom: '0.5px solid var(--border-col)',
        background: isCurrent ? 'var(--teal-soft)' : 'transparent',
      }}>
        <div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: isCurrent ? 'var(--accent)' : 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '2px' }}>
            W{weekNum} · {formatDateRange(weekStartDate)}
            {movingDay && <span style={{ color: 'var(--accent)', marginLeft: '8px' }}>· tap a day to move session</span>}
          </div>
          <div style={{ fontFamily: 'var(--font-brand)', fontSize: '13px', fontWeight: 500, color: isCompleted ? 'var(--text-muted)' : 'var(--text-primary)' }}>
            {week.label ?? ''}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px', justifyContent: 'flex-end' }}>
            {actualKm > 0
              ? <span style={{ fontFamily: 'var(--font-ui)', fontSize: '18px', color: 'var(--accent)', fontWeight: 600, lineHeight: 1 }}>{formatDistance(actualKm, units, { exact: true, noSuffix: true })}</span>
              : intendedKm > 0
              ? <span style={{ fontFamily: 'var(--font-ui)', fontSize: '18px', color: 'var(--text-muted)', fontWeight: 600, lineHeight: 1 }}>{intendedKm}</span>
              : null
            }
            {actualKm > 0 && intendedKm > 0 && (
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)' }}>/{intendedKm}</span>
            )}
          </div>
          {intendedKm > 0 && <div style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: '2px' }}>{actualKm > 0 ? `${units} done` : `${units} planned`}</div>}
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
            units={units}
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
                distance_km:    s.distance_km,
                duration_mins:  s.duration_mins,
                primary_metric: s.primary_metric,
                hr_target:      s.hr_target,
                pace_target:    s.pace_target,
                rpe_target:     s.rpe_target,
                coach_notes:    s.coach_notes,
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
            background: 'var(--teal-soft)',
            border: 'none', borderTop: '0.5px solid var(--teal-dim)',
            cursor: 'pointer',
            fontFamily: 'var(--font-ui)', fontSize: '11px',
            color: 'var(--accent)', letterSpacing: '0.06em', textTransform: 'uppercase',
            textAlign: 'center',
          }}
        >
          Cancel move
        </button>
      )}
    </div>
  )
}

function DayRow({ dayKey, session, date, isToday, isPast, isFuture, completion, isMovable, isMoving, isTarget, isMoveMode, isLast, onTap, onMoveIconTap, units }: {
  dayKey: string; session: EffectiveSession | undefined; date: Date; isToday: boolean; isPast: boolean; isFuture: boolean
  completion?: Completion; isMovable: boolean; isMoving: boolean; isTarget: boolean
  isMoveMode: boolean; isLast: boolean
  onTap: () => void; onMoveIconTap: () => void
  units: DistanceUnits
}) {
  const isComplete = completion?.status === 'complete'
  const isSkipped  = completion?.status === 'skipped'
  const hasSession = !!session && session.type !== 'rest'
  const isRestType = !session || session.type === 'rest'
  const accent = session ? (SESSION_COLORS[session.type] ?? 'var(--text-muted)') : 'transparent'

  return (
    <div
      onClick={onTap}
      style={{
        display: 'flex', alignItems: 'center',
        padding: isRestType && !isTarget ? '6px 14px' : '10px 14px',
        borderBottom: isLast ? 'none' : '0.5px solid var(--border-col)',
        background: isMoving
          ? 'var(--teal-soft)'
          : isTarget
          ? 'var(--teal-soft)'
          : 'transparent',
        cursor: (hasSession || isTarget) ? 'pointer' : 'default',
        opacity: isMoving ? 0.7 : isMoveMode && !isTarget && !isMoving ? 0.4 : isSkipped ? 0.5 : isPast && !isComplete && hasSession ? 0.45 : 1,
        outline: isTarget ? '1px dashed var(--teal-dim)' : isMoving ? '1px solid var(--teal-mid)' : 'none',
        outlineOffset: '-1px',
        transition: 'background 0.15s, opacity 0.15s',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      } as React.CSSProperties}
    >
      <div style={{ width: '40px', flexShrink: 0 }}>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', color: isToday ? 'var(--accent)' : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {DOW_FULL[dayKey]}
        </div>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: isToday ? 'var(--accent)' : 'var(--text-muted)', fontWeight: isToday ? 600 : 400, marginTop: '1px' }}>
          {date.getDate()}
        </div>
      </div>

      {isTarget ? (
        <div style={{ width: '3px', height: '34px', borderRadius: '2px', background: 'var(--teal-mid)', marginRight: '12px', flexShrink: 0 }} />
      ) : (
        <div style={{ width: '3px', height: hasSession ? '34px' : '16px', borderRadius: '2px', background: isComplete ? 'var(--accent)' : isSkipped ? 'var(--border-col)' : isMoving ? 'var(--accent)' : accent, marginRight: '12px', flexShrink: 0 }} />
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        {isTarget ? (
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--accent)', letterSpacing: '0.04em' }}>
            Move here
          </div>
        ) : isRestType ? null : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
              <div style={{
                fontSize: '15px', fontWeight: 500,
                color: isMoving ? 'var(--accent)' : isSkipped ? 'var(--text-muted)' : isFuture ? 'var(--text-secondary)' : 'var(--text-primary)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                flex: 1, minWidth: 0,
              }}>
                {session.label ?? ''}
                {isMoving && <span style={{ fontSize: '10px', marginLeft: '6px', opacity: 0.7 }}>moving...</span>}
              </div>
              {!isMoving && SESSION_LABELS[session.type] && (
                <span style={{
                  fontFamily: 'var(--font-ui)', fontSize: '9px', fontWeight: 600,
                  textTransform: 'uppercase', letterSpacing: '0.07em',
                  color: accent, background: `color-mix(in srgb, ${accent} 18%, transparent)`,
                  borderRadius: '4px', padding: '2px 6px', whiteSpace: 'nowrap', flexShrink: 0,
                }}>
                  {SESSION_LABELS[session.type]}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px', flexWrap: 'wrap' }}>
              {/* Structured metrics first (R23+ plans). Falls back to legacy `detail` text for hand-authored gist plans. */}
              {(session.distance_km != null || session.duration_mins != null) ? (
                <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                  {[
                    session.distance_km != null
                      ? formatDistance(session.distance_km, units, { exact: session.type === 'race' })
                      : null,
                    session.duration_mins != null
                      ? (session.duration_mins < 60
                          ? `${session.duration_mins}min`
                          : (session.duration_mins % 60 === 0
                              ? `${Math.floor(session.duration_mins / 60)}h`
                              : `${Math.floor(session.duration_mins / 60)}h ${session.duration_mins % 60}min`))
                      : null,
                  ].filter(Boolean).join(' · ')}
                </span>
              ) : session.detail ? (
                <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{session.detail}</span>
              ) : null}
              {isComplete && completion?.strava_activity_name && (
                <span style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', color: 'var(--strava)' }}>
                  ● {completion.strava_activity_name}{completion.strava_activity_km ? ` · ${completion.strava_activity_km}km` : ''}
                </span>
              )}
              {isSkipped && <span style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', color: 'var(--text-muted)' }}>skipped</span>}
            </div>
          </>
        )}
      </div>

      <div style={{ flexShrink: 0, marginLeft: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        {isComplete && !isMoveMode && <span style={{ color: 'var(--accent)', fontSize: '14px' }}>✓</span>}
        {hasSession && !isComplete && !isSkipped && !isMoveMode && (
          <span style={{ color: 'var(--text-muted)', fontSize: '16px' }}>›</span>
        )}
        {isMovable && !isMoveMode && (
          <button
            onClick={e => { e.stopPropagation(); onMoveIconTap() }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '4px', display: 'flex', flexDirection: 'column', gap: '2.5px',
              opacity: 0.45,
            }}
          >
            {[0,1,2].map(i => (
              <div key={i} style={{ width: '14px', height: '1.5px', background: 'var(--text-primary)', borderRadius: '1px' }} />
            ))}
          </button>
        )}
        {isMoving && (
          <button
            onClick={e => { e.stopPropagation(); onMoveIconTap() }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: '16px', padding: '2px' }}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  )
}
