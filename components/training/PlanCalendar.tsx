'use client'

import { useState } from 'react'
import type { Week, Session } from '@/types/plan'
import { createClient } from '@/lib/supabase/client'
import { authedFetch } from '@/lib/supabase/authedFetch'
import { SESSION_COLORS, SESSION_LABELS } from '@/lib/session-types'
import { getCurrentWeekIndex, parseLocalDate } from '@/lib/plan'
import { formatDistance, sumRoundedDistance, resolveSessionMetric, type DistanceUnits, type SessionMetric, type SessionMetricOverrides } from '@/lib/format'

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
  border: '1px solid var(--line)',
  borderRadius: '10px', cursor: 'pointer',
  fontFamily: 'var(--font-ui)', fontSize: '11px',
  color: 'var(--mute)', letterSpacing: '0.06em', textTransform: 'uppercase',
}

interface Props {
  weeks: Week[]
  allOverrides: { week_n: number; original_day: string; new_day: string }[]
  allCompletions: Record<number, Record<string, Completion>>
  onOverrideChange: (overrides: { week_n: number; original_day: string; new_day: string }[]) => void
  onSessionTap: (session: SessionTapPayload, weekN: number, weekTheme: string) => void
  overridesReady?: boolean
  units?: DistanceUnits
  /** Global distance/duration preference from MeScreen. */
  preferredMetric?: SessionMetric
  /** Per-session metric overrides from SessionScreen toggle, keyed `${weekN}_${sessionKey}`. */
  sessionMetricOverrides?: SessionMetricOverrides
}

export default function PlanCalendar({ weeks, allOverrides, allCompletions, onOverrideChange, onSessionTap, overridesReady = true, units = 'km', preferredMetric = 'distance', sessionMetricOverrides = {} }: Props) {
  const [showPast, setShowPast] = useState(false)
  // PLAN-STRIP-EXPAND: single Later-week may be expanded into a full WeekCard
  // for move/swap. State held here so navigating away resets — option-value,
  // not use-value, in the brand sense (the tap-to-reveal IS the friction).
  const [expandedLaterWeek, setExpandedLaterWeek] = useState<number | null>(null)
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
      // Trigger 1: session_reorder — fires the hard/easy adjacency check in
      // /api/adjust-plan and writes a plan_adjustments row when a violation is
      // detected. Plan-screen Move is the only surface that can produce this
      // signal now that SessionPopupInner's Move was removed. Paid-only; the
      // route 403s for free users and the call no-ops.
      void authedFetch('/api/adjust-plan', {
        method: 'POST',
        body: JSON.stringify({ fromDay: originalDay, toDay: newDay }),
      })
    }
  }

  async function handleSwap(
    weekN: number,
    sourceOriginal: string, sourceSlot: string,
    targetOriginal: string, targetSlot: string,
  ) {
    if (sourceSlot === targetSlot) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Drop any existing override rows for either session in this week — we're
    // about to recompute both. Each session ends up either at its original day
    // (no override row) or with a single fresh override pointing to its new slot.
    let updated = allOverrides.filter(o =>
      !(o.week_n === weekN && (o.original_day === sourceOriginal || o.original_day === targetOriginal))
    )
    if (sourceOriginal !== targetSlot) {
      updated = [...updated, { week_n: weekN, original_day: sourceOriginal, new_day: targetSlot }]
    }
    if (targetOriginal !== sourceSlot) {
      updated = [...updated, { week_n: weekN, original_day: targetOriginal, new_day: sourceSlot }]
    }
    onOverrideChange(updated)

    await supabase.from('session_overrides')
      .delete().eq('user_id', user.id).eq('week_n', weekN)
      .in('original_day', [sourceOriginal, targetOriginal])

    const ts = new Date().toISOString()
    const inserts: Array<{ user_id: string; week_n: number; original_day: string; new_day: string; updated_at: string }> = []
    if (sourceOriginal !== targetSlot) {
      inserts.push({ user_id: user.id, week_n: weekN, original_day: sourceOriginal, new_day: targetSlot, updated_at: ts })
    }
    if (targetOriginal !== sourceSlot) {
      inserts.push({ user_id: user.id, week_n: weekN, original_day: targetOriginal, new_day: sourceSlot, updated_at: ts })
    }
    if (inserts.length) {
      await supabase.from('session_overrides').insert(inserts)
    }

    // Trigger adjacency check for the source's new slot. The target also moved
    // but firing once is enough to surface hard/easy violations introduced by
    // the swap; the adjuster looks at the whole week.
    void authedFetch('/api/adjust-plan', {
      method: 'POST',
      body: JSON.stringify({ fromDay: sourceOriginal, toDay: targetSlot }),
    })
  }

  function renderWeek({ week, weekNum }: { week: Week; weekNum: number }) {
    return (
      <WeekCard
        key={weekNum}
        week={week}
        weekNum={weekNum}
        completions={Object.values(allCompletions[weekNum] ?? {})}
        overrides={allOverrides.filter(o => o.week_n === weekNum)}
        onSessionTap={onSessionTap}
        onMove={handleMove}
        onSwap={handleSwap}
        units={units}
        preferredMetric={preferredMetric}
        sessionMetricOverrides={sessionMetricOverrides}
      />
    )
  }

  function renderStrip({ week, weekNum }: { week: Week; weekNum: number }, isPast = false) {
    return (
      <WeekStripCard
        key={`strip-${weekNum}`}
        week={week}
        weekNum={weekNum}
        completions={Object.values(allCompletions[weekNum] ?? {})}
        units={units}
        isPast={isPast}
      />
    )
  }

  if (!overridesReady) return (
    <div style={{ padding: '0 16px 32px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {[120, 200, 160].map((h, i) => (
        <div key={i} style={{ height: `${h}px`, borderRadius: 'var(--radius-lg)', background: 'var(--bg-soft)', opacity: 1 - i * 0.15 }} />
      ))}
    </div>
  )

  // Split current-and-future into [current, next, ...later] so the render
  // can apply different visual weight to each section. Current week gets a
  // full WeekCard (dominant). Next week gets a full WeekCard (quieter).
  // Later weeks compress to strip cards (the arc, at a glance).
  const currentWeek = currentAndFutureWeeks[0]
  const nextWeek    = currentAndFutureWeeks[1]
  const laterWeeks  = currentAndFutureWeeks.slice(2)

  return (
    <div style={{ padding: '0 16px 32px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {pastWeeks.length > 0 && (
        showPast ? (
          <>
            <PlanSectionLabel>Past</PlanSectionLabel>
            {pastWeeks.map(w => renderStrip(w, true))}
            <button onClick={() => setShowPast(false)} style={loadMoreStyle}>↑ Hide past weeks</button>
          </>
        ) : (
          <button onClick={() => setShowPast(true)} style={loadMoreStyle}>
            ↑ Load {pastWeeks.length} past week{pastWeeks.length !== 1 ? 's' : ''}
          </button>
        )
      )}
      {currentWeek && (
        <>
          <PlanSectionLabel>Now</PlanSectionLabel>
          {renderWeek(currentWeek)}
        </>
      )}
      {nextWeek && (
        <>
          <PlanSectionLabel>Next</PlanSectionLabel>
          {renderWeek(nextWeek)}
        </>
      )}
      {laterWeeks.length > 0 && (
        <>
          <PlanSectionLabel right={`${laterWeeks.length} week${laterWeeks.length !== 1 ? 's' : ''}`}>Later</PlanSectionLabel>
          {laterWeeks.map(w => {
            // PLAN-STRIP-EXPAND: when this Later week is the currently-expanded
            // one, replace the strip with a full WeekCard preceded by a single
            // brand-restraint eyebrow ("LATER — STILL FLEXIBLE"). Tapping the
            // eyebrow collapses. Single-week expansion at a time.
            if (expandedLaterWeek === w.weekNum) {
              return (
                <div key={`expanded-${w.weekNum}`} style={{ display: 'flex', flexDirection: 'column', gap: '8px', animation: 'zonna-fade-in 0.18s ease-out' }}>
                  <button
                    onClick={() => setExpandedLaterWeek(null)}
                    aria-label="Collapse week"
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      width: '100%', padding: '0 4px',
                      background: 'none', border: 'none', cursor: 'pointer',
                    }}
                  >
                    <span style={{
                      fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 700,
                      color: 'var(--mute)', letterSpacing: '0.08em', textTransform: 'uppercase',
                    }}>Later — still flexible</span>
                    <span style={{
                      fontFamily: 'var(--font-ui)', fontSize: '12px',
                      color: 'var(--mute)', lineHeight: 1,
                    }} aria-hidden>⌃</span>
                  </button>
                  {renderWeek(w)}
                </div>
              )
            }
            return (
              <WeekStripCard
                key={`strip-${w.weekNum}`}
                week={w.week}
                weekNum={w.weekNum}
                completions={Object.values(allCompletions[w.weekNum] ?? {})}
                units={units}
                isPast={false}
                onTap={() => setExpandedLaterWeek(prev => prev === w.weekNum ? null : w.weekNum)}
              />
            )
          })}
        </>
      )}
    </div>
  )
}

/** Section label between week groups (Past / Now / Next / Later).
 *  Pattern: 11px 700 mute uppercase 0.12em letter-spacing. */
function PlanSectionLabel({ children, right }: { children: React.ReactNode; right?: string }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      padding: '0 4px', marginTop: '18px',
    }}>
      <span style={{
        fontFamily: 'var(--font-ui)', fontSize: '11px', fontWeight: 700,
        color: 'var(--mute)', letterSpacing: '0.12em', textTransform: 'uppercase',
      }}>{children}</span>
      {right && (
        <span style={{
          fontFamily: 'var(--font-ui)', fontSize: '10px',
          color: 'var(--mute)', letterSpacing: '0.04em',
        }}>{right}</span>
      )}
    </div>
  )
}

function WeekCard({ week, weekNum, completions, overrides, onSessionTap, onMove, onSwap, units, preferredMetric, sessionMetricOverrides }: {
  week: Week; weekNum: number; completions: Completion[]; overrides: { week_n: number; original_day: string; new_day: string }[]
  onSessionTap: (session: SessionTapPayload, weekN: number, weekTheme: string) => void
  onMove: (weekN: number, originalDay: string, newDay: string, currentSlot: string) => void
  onSwap: (weekN: number, sourceOriginal: string, sourceSlot: string, targetOriginal: string, targetSlot: string) => void
  units: DistanceUnits
  preferredMetric: SessionMetric
  sessionMetricOverrides: SessionMetricOverrides
}) {
  const ws = week.sessions ?? {}
  const weekStartDate = parseLocalDate(week.date)
  const weekDates = getWeekDates(weekStartDate)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const weekEnd = new Date(weekStartDate); weekEnd.setDate(weekEnd.getDate() + 7)
  const isCurrent = now >= weekStartDate && now < weekEnd
  const isCompleted = !isCurrent && weekStartDate < now
  // Race week gets --s-race left-rail accent so it stands out in the calendar
  // — mirrors the PlanArc treatment (which already paints race week --s-race).
  const isRace = (week as any).type === 'race' || (week as any).badge === 'race'
  const weekTheme = week.theme ?? ''
  const todayDow = ['sun','mon','tue','wed','thu','fri','sat'][new Date().getDay()]
  const [movingDay, setMovingDay] = useState<string | null>(null)
  // RESHAPE-FIX-WAVE2C (Defect 11) — pending move staged between target-tap
  // and the actual session_overrides + adjust-plan write. Set by
  // handleTargetTap; cleared by confirmPendingMove / cancelPendingMove.
  const [pendingMove, setPendingMove] = useState<{
    sourceKey: string
    targetKey: string
    sourceOriginal: string
    targetOriginal: string | null  // null when target is empty/rest (move); set when swap
    sourceLabel: string
    targetLabel: string | null
    isSwap: boolean
  } | null>(null)

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

  // RESHAPE-FIX-WAVE2C (Defect 11) — pendingMove confirmation step.
  // Pre-fix: tapping a target day immediately fired onMove/onSwap which
  // wrote session_overrides + posted /api/adjust-plan. The 2026-06-26
  // incident root cause was a runner who didn't realise the tap-to-move
  // UI was *a move* (he experienced it as a tap, not a drag) — the
  // override + AI summary lie that followed corrupted his taper. Now:
  // tapping a target day stages a pendingMove and renders an inline
  // confirmation row. Confirm fires the write path; Cancel aborts with
  // no DB side-effect. Move icon affordance also bumped (see DayRow).
  function handleTargetTap(targetKey: string) {
    setMovingDay(prev => {
      if (!prev) return null
      const sourceSession = effectiveSessions[prev]
      if (!sourceSession) return null
      const sourceOriginal = sourceSession.originalDay ?? prev
      const targetSession = effectiveSessions[targetKey]
      const targetCompletion = targetSession ? completionMap[targetSession.originalDay ?? targetKey] : undefined
      const targetIsSwappable = !!targetSession
        && targetSession.type !== 'rest'
        && targetCompletion?.status !== 'complete'
        && targetCompletion?.status !== 'skipped'
      setPendingMove({
        sourceKey: prev,
        targetKey,
        sourceOriginal,
        targetOriginal: (targetIsSwappable && targetSession) ? (targetSession.originalDay ?? targetKey) : null,
        sourceLabel: sourceSession.label ?? 'session',
        targetLabel: targetSession?.label ?? null,
        isSwap: targetIsSwappable && !!targetSession,
      })
      return null
    })
  }

  function confirmPendingMove() {
    if (!pendingMove) return
    if (pendingMove.isSwap && pendingMove.targetOriginal) {
      onSwap(weekNum, pendingMove.sourceOriginal, pendingMove.sourceKey, pendingMove.targetOriginal, pendingMove.targetKey)
    } else {
      onMove(weekNum, pendingMove.sourceOriginal, pendingMove.targetKey, pendingMove.sourceKey)
    }
    setPendingMove(null)
  }

  function cancelPendingMove() {
    setPendingMove(null)
  }

  // Metric pair size — current week dominates the visual hierarchy.
  // Future / past weeks stay at 18px so the current week reads as "you are here".
  const metricSize    = isCurrent ? 36 : 18
  const metricUnitSize = isCurrent ? 18 : 12

  return (
    <div style={{
      background: 'var(--card)',
      borderRadius: 'var(--radius-lg)',
      border: `1px solid ${isCurrent ? 'var(--line-strong)' : 'var(--line)'}`,
      borderLeft: isRace
        ? '3px solid var(--s-race)'
        : isCurrent ? '3px solid var(--moss)' : undefined,
      overflow: 'hidden',
      opacity: isCompleted ? 0.65 : 1,
    }}>
      {/* Week header */}
      <div style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        padding: isCurrent ? '14px 16px 12px' : '12px 14px 10px',
        borderBottom: '1px solid var(--line)',
        background: isCurrent ? 'var(--moss-soft)' : 'transparent',
      }}>
        <div>
          <div style={{
            fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 700,
            color: isRace ? 'var(--s-race)' : isCurrent ? 'var(--moss)' : 'var(--mute)',
            letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '2px',
          }}>
            {isRace ? 'Race week · ' : ''}W{weekNum} · {formatDateRange(weekStartDate)}
            {movingDay && <span style={{ color: 'var(--moss)', marginLeft: '8px', textTransform: 'none', letterSpacing: 'normal', fontWeight: 500 }}>· Tap where you want it.</span>}
          </div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 500, color: isCompleted ? 'var(--mute)' : 'var(--ink)', letterSpacing: '-0.005em' }}>
            {week.label ?? ''}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px', justifyContent: 'flex-end' }}>
            {actualKm > 0
              ? <span style={{ fontFamily: 'var(--font-ui)', fontSize: `${metricSize}px`, color: 'var(--moss)', fontWeight: isCurrent ? 800 : 600, lineHeight: 1, letterSpacing: isCurrent ? '-0.02em' : 'normal', fontVariantNumeric: 'tabular-nums' }}>{formatDistance(actualKm, units, { exact: true, noSuffix: true })}</span>
              : intendedKm > 0
              ? <span style={{ fontFamily: 'var(--font-ui)', fontSize: `${metricSize}px`, color: isCurrent ? 'var(--ink)' : 'var(--mute)', fontWeight: isCurrent ? 800 : 600, lineHeight: 1, letterSpacing: isCurrent ? '-0.02em' : 'normal', fontVariantNumeric: 'tabular-nums' }}>{intendedKm}</span>
              : null
            }
            {actualKm > 0 && intendedKm > 0 && (
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: `${metricUnitSize}px`, fontWeight: isCurrent ? 600 : 400, color: 'var(--mute)' }}>/{intendedKm}</span>
            )}
          </div>
          {intendedKm > 0 && <div style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 700, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '4px' }}>{actualKm > 0 ? `${units} done` : `${units} planned`}</div>}
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
        // In move mode, every other day is a potential target. Two flavours:
        //   - move target  → empty slot (no session, or only a rest placeholder)
        //   - swap target  → another non-rest, uncompleted session, which we'll
        //                    exchange slots with on tap.
        const isMoveTarget = !!movingDay && movingDay !== key && (!s || s.type === 'rest')
        const isSwapTarget = !!movingDay && movingDay !== key && !!s && s.type !== 'rest' && !isComplete && !isSkipped
        // Per-session metric override is keyed by originalDay (where the user
        // tapped the toggle in SessionPopupInner), not by display slot.
        const resolvedMetric: SessionMetric = s
          ? resolveSessionMetric(weekNum, s.originalDay ?? key, s.primary_metric, sessionMetricOverrides, preferredMetric)
          : preferredMetric

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
            isMoveTarget={isMoveTarget}
            isSwapTarget={isSwapTarget}
            isMoveMode={!!movingDay}
            isLast={i === DOW_ORDER.length - 1}
            units={units}
            metric={resolvedMetric}
            onTap={() => {
              if (isMoveTarget || isSwapTarget) { handleTargetTap(key); return }
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

      {movingDay && !pendingMove && (
        <button
          onClick={() => setMovingDay(null)}
          style={{
            width: '100%', padding: '10px 14px',
            background: 'var(--moss-soft)',
            border: 'none', borderTop: '1px solid var(--moss-mid)',
            cursor: 'pointer',
            fontFamily: 'var(--font-ui)', fontSize: '11px',
            color: 'var(--moss)', letterSpacing: '0.06em', textTransform: 'uppercase',
            textAlign: 'center',
          }}
        >
          Cancel move
        </button>
      )}

      {/* RESHAPE-FIX-WAVE2C confirmation row. Pattern 30 (inline banner) —
          no popup, no full-screen takeover. Honest about what's about to
          land: source label, destination day, swap call-out where relevant.
          The 2026-06-26 incident root cause was a runner unaware that the
          tap-to-move he'd just executed had structural consequences. This
          row makes the move legible before it writes. */}
      {pendingMove && (
        <div style={{
          padding: '12px 14px 14px',
          background: 'var(--warn-soft, var(--moss-soft))',
          borderTop: '1px solid var(--line)',
          display: 'flex', flexDirection: 'column', gap: '10px',
        }}>
          <div style={{
            fontFamily: 'var(--font-ui)', fontSize: '12px',
            color: 'var(--ink)', lineHeight: 1.4,
          }}>
            Move <strong>{pendingMove.sourceLabel}</strong>
            {' from '}<strong>{DOW_FULL[pendingMove.sourceKey] ?? pendingMove.sourceKey}</strong>
            {' to '}<strong>{DOW_FULL[pendingMove.targetKey] ?? pendingMove.targetKey}</strong>?
            {pendingMove.isSwap && pendingMove.targetLabel && (
              <div style={{ marginTop: '4px', color: 'var(--ink-2)', fontSize: '11px' }}>
                {pendingMove.targetLabel} swaps to {DOW_FULL[pendingMove.sourceKey] ?? pendingMove.sourceKey}.
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={cancelPendingMove}
              style={{
                flex: 1, padding: '10px 14px',
                background: 'none', border: '1px solid var(--line)',
                borderRadius: '10px', cursor: 'pointer',
                fontFamily: 'var(--font-ui)', fontSize: '11px',
                color: 'var(--mute)', letterSpacing: '0.06em', textTransform: 'uppercase',
              }}
            >
              Cancel
            </button>
            <button
              onClick={confirmPendingMove}
              style={{
                flex: 2, padding: '10px 14px',
                background: 'var(--moss)', border: 'none',
                borderRadius: '10px', cursor: 'pointer',
                fontFamily: 'var(--font-ui)', fontSize: '11px',
                color: 'var(--card)', letterSpacing: '0.06em', textTransform: 'uppercase',
                fontWeight: 600,
              }}
            >
              {pendingMove.isSwap ? 'Swap them' : 'Move it'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function DayRow({ dayKey, session, date, isToday, isPast, isFuture, completion, isMovable, isMoving, isMoveTarget, isSwapTarget, isMoveMode, isLast, onTap, onMoveIconTap, units, metric }: {
  dayKey: string; session: EffectiveSession | undefined; date: Date; isToday: boolean; isPast: boolean; isFuture: boolean
  completion?: Completion; isMovable: boolean; isMoving: boolean
  isMoveTarget: boolean; isSwapTarget: boolean
  isMoveMode: boolean; isLast: boolean
  onTap: () => void; onMoveIconTap: () => void
  units: DistanceUnits
  metric: SessionMetric
}) {
  const isComplete = completion?.status === 'complete'
  const isSkipped  = completion?.status === 'skipped'
  const hasSession = !!session && session.type !== 'rest'
  const isRestType = !session || session.type === 'rest'
  const isTarget = isMoveTarget || isSwapTarget
  const accent = session ? (SESSION_COLORS[session.type] ?? 'var(--mute)') : 'transparent'

  return (
    <div
      onClick={onTap}
      style={{
        display: 'flex', alignItems: 'center',
        padding: isRestType && !isTarget ? '6px 14px' : '10px 14px',
        borderBottom: isLast ? 'none' : '1px solid var(--line)',
        background: isMoving
          ? 'var(--moss-soft)'
          : isTarget
          ? 'var(--moss-soft)'
          : 'transparent',
        cursor: (hasSession || isTarget) ? 'pointer' : 'default',
        opacity: isMoving ? 0.7 : isMoveMode && !isTarget && !isMoving ? 0.4 : isSkipped ? 0.5 : isPast && !isComplete && hasSession ? 0.45 : 1,
        // dashed = move (empty slot); solid = swap (occupied slot); solid on the source while moving.
        outline: isMoveTarget
          ? '1px dashed var(--moss-mid)'
          : isSwapTarget || isMoving
          ? '1px solid var(--moss-mid)'
          : 'none',
        outlineOffset: '-1px',
        transition: 'background 0.15s, opacity 0.15s',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      } as React.CSSProperties}
    >
      <div style={{ width: '40px', flexShrink: 0 }}>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', color: isToday ? 'var(--moss)' : 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {DOW_FULL[dayKey]}
        </div>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: isToday ? 'var(--moss)' : 'var(--mute)', fontWeight: isToday ? 600 : 400, marginTop: '1px' }}>
          {date.getDate()}
        </div>
      </div>

      {isMoveTarget ? (
        <div style={{ width: '3px', height: '34px', borderRadius: '2px', background: 'var(--moss-mid)', marginRight: '12px', flexShrink: 0 }} />
      ) : (
        <div style={{ width: '3px', height: hasSession ? '34px' : '16px', borderRadius: '2px', background: isComplete ? 'var(--moss)' : isSkipped ? 'var(--line)' : isMoving || isSwapTarget ? 'var(--moss)' : accent, marginRight: '12px', flexShrink: 0 }} />
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        {isMoveTarget ? (
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--moss)', letterSpacing: '0.04em' }}>
            Move here
          </div>
        ) : isRestType ? null : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
              <div style={{
                fontSize: '15px', fontWeight: 500,
                color: isMoving || isSwapTarget ? 'var(--moss)' : isSkipped ? 'var(--mute)' : isComplete ? 'var(--mute)' : isFuture ? 'var(--ink-2)' : 'var(--ink)',
                textDecoration: isSkipped ? 'line-through' : 'none',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                flex: 1, minWidth: 0,
              }}>
                {session.label ?? ''}
                {isMoving && <span style={{ fontSize: '10px', marginLeft: '6px', opacity: 0.7 }}>moving...</span>}
                {isSwapTarget && <span style={{ fontSize: '10px', marginLeft: '6px', opacity: 0.7 }}>tap to swap</span>}
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
              {/* Structured metric (R23+ plans). Render only the chosen metric;
                  fall back to the other if the chosen one is missing on this
                  session. Legacy `detail` text remains the fallback for
                  hand-authored gist plans with no structured fields. */}
              {(session.distance_km != null || session.duration_mins != null) ? (() => {
                const distStr = session.distance_km != null
                  ? formatDistance(session.distance_km, units, { exact: session.type === 'race' })
                  : null
                const durStr = session.duration_mins != null
                  ? (session.duration_mins < 60
                      ? `${session.duration_mins}min`
                      : (session.duration_mins % 60 === 0
                          ? `${Math.floor(session.duration_mins / 60)}h`
                          : `${Math.floor(session.duration_mins / 60)}h ${session.duration_mins % 60}min`))
                  : null
                const value = metric === 'duration' ? (durStr ?? distStr) : (distStr ?? durStr)
                return value ? (
                  <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)', fontVariantNumeric: 'tabular-nums' }}>
                    {value}
                  </span>
                ) : null
              })() : session.detail ? (
                <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{session.detail}</span>
              ) : null}
              {isComplete && completion?.strava_activity_name && (
                <span style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', color: 'var(--strava)' }}>
                  ● {completion.strava_activity_name}{completion.strava_activity_km ? ` · ${completion.strava_activity_km}km` : ''}
                </span>
              )}
              {isSkipped && <span style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', color: 'var(--mute)' }}>skipped</span>}
            </div>
          </>
        )}
      </div>

      <div style={{ flexShrink: 0, marginLeft: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* Done: canonical 16px moss check circle (ui-patterns.md § SessionCard).
            Replaces a plain ✓ glyph so a scan of the plan reads the completion
            state more clearly. */}
        {isComplete && !isMoveMode && (
          <span aria-label="Complete" style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '16px', height: '16px', borderRadius: '50%',
            background: 'var(--moss-soft)',
            border: '1.5px solid var(--moss)',
            color: 'var(--moss)', fontSize: '9px', fontWeight: 800,
            lineHeight: 1,
          }}>✓</span>
        )}
        {hasSession && !isComplete && !isSkipped && !isMoveMode && (
          <span style={{ color: 'var(--mute)', fontSize: '16px' }}>›</span>
        )}
        {isSwapTarget && (
          <span style={{ color: 'var(--moss)', fontSize: '15px', lineHeight: 1 }} aria-label="Swap with this session">⇄</span>
        )}
        {isMovable && !isMoveMode && (
          // RESHAPE-FIX-WAVE2C (Defect 11) — clearer move affordance.
          // Pre-fix: a 3-line hamburger at 0.45 opacity looked like a
          // "more options" icon, not a move handle. The 2026-06-26
          // incident user reported never having "dragged" anything —
          // because he hadn't; he'd tapped this icon without realising
          // it initiated a move. Now: explicit ↕ glyph in a soft moss
          // pill, aria-labelled, opacity 0.85. Still unobtrusive
          // (restraint = brand) but legible as "move this session."
          <button
            onClick={e => { e.stopPropagation(); onMoveIconTap() }}
            aria-label={`Move ${session?.label ?? 'session'}`}
            title="Move this session"
            style={{
              background: 'var(--moss-soft)',
              border: '1px solid var(--moss-mid, var(--line))',
              borderRadius: '999px',
              cursor: 'pointer',
              padding: '3px 8px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-ui)', fontSize: '11px',
              color: 'var(--moss)', fontWeight: 600,
              letterSpacing: '0.05em',
              opacity: 0.85,
            }}
          >
            <span style={{ marginRight: '3px', fontSize: '12px', lineHeight: 1 }}>↕</span>
            Move
          </button>
        )}
        {isMoving && (
          <button
            onClick={e => { e.stopPropagation(); onMoveIconTap() }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--moss)', fontSize: '16px', padding: '2px' }}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * Compressed week summary — 7 status dots in a strip, single-line meta above.
 * Used for past weeks (when expanded) and distant-future weeks. Replaces the
 * full WeekCard at distance so the plan reads as an arc, not a wall of rows.
 *
 * Canonical week-strip pattern (ui-patterns.md §3). Same dot vocabulary as the
 * TodayScreen DateStrip:
 *   ● filled moss     — completed
 *   ○ outlined        — future session
 *   ─ dash            — rest day (or empty)
 *   ⊘ dashed circle   — skipped
 */
function WeekStripCard({ week, weekNum, completions, units, isPast = false, onTap }: {
  week: Week; weekNum: number
  completions: Completion[]
  units: DistanceUnits
  isPast?: boolean
  onTap?: () => void
}) {
  const ws = week.sessions ?? {}
  const weekStartDate = parseLocalDate(week.date)
  const isRace = (week as any).type === 'race' || (week as any).badge === 'race'
  const phase = (week as any).phase as string | undefined
  const sessionDistances = Object.values(ws).map((s: any) => s?.distance_km as number | undefined)
  const intendedKm = sumRoundedDistance(sessionDistances, units)
  const completionMap: Record<string, string> = {}
  completions.forEach(c => { completionMap[c.session_day] = c.status })
  const actualKm = completions
    .filter(c => c.status === 'complete' && c.strava_activity_km)
    .reduce((sum, c) => sum + (c.strava_activity_km ?? 0), 0)
  const headerKm = actualKm > 0 ? actualKm : intendedKm

  return (
    <div
      onClick={onTap}
      style={{
        background: 'var(--card)',
        border: '1px solid var(--line)',
        borderLeft: isRace ? '3px solid var(--s-race)' : undefined,
        borderRadius: 'var(--radius-lg)',
        padding: '14px 16px',
        opacity: isPast ? 0.65 : 1,
        cursor: onTap ? 'pointer' : 'default',
      }}
    >
      {/* Header row: week label + total km */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
        <div style={{
          fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 600,
          color: isRace ? 'var(--s-race)' : isPast ? 'var(--mute)' : 'var(--ink-2)',
          letterSpacing: '-0.005em',
        }}>
          {isRace ? 'Race week' : `W${weekNum} · ${formatDateRange(weekStartDate)}`}
          {!isRace && phase === 'taper' && <span style={{ color: 'var(--mute)' }}> · taper</span>}
          {!isRace && (week as any).type === 'deload' && <span style={{ color: 'var(--mute)' }}> · deload</span>}
          {!isRace && week.label && phase === 'peak' && <span style={{ color: 'var(--mute)' }}> · peak</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          {headerKm > 0 && (
            <div style={{
              fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: 700,
              color: isRace ? 'var(--s-race)' : 'var(--ink-2)',
              fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em',
            }}>
              {formatDistance(headerKm, units, { exact: isRace })}
            </div>
          )}
          {onTap && (
            // PLAN-STRIP-EXPAND affordance: chevron signals the strip is tappable.
            // No microcopy — the glyph is the message; instructional text would
            // breach the "no chrome" rule. Only present when `onTap` is provided
            // (Later weeks), so past-week read-only strips stay glyph-free.
            <span aria-hidden style={{
              fontFamily: 'var(--font-ui)', fontSize: '12px',
              color: 'var(--mute)', lineHeight: 1,
            }}>⌄</span>
          )}
        </div>
      </div>
      {/* 7-day status strip */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
        {DOW_ORDER.map(dayKey => {
          const session = (ws as any)[dayKey]
          const isRest = !session || session.type === 'rest'
          const status = completionMap[dayKey]
          const isComplete = status === 'complete'
          const isSkipped = status === 'skipped'
          const isRaceDay = isRace && session?.type === 'race'
          // Dot rendering — three states (rest, future/skipped/done, race)
          let dot: React.ReactNode
          if (isRest) {
            dot = <div style={{ width: '6px', height: '1.5px', borderRadius: '1px', background: 'var(--mute-2)', opacity: 0.5 }} />
          } else if (isComplete) {
            dot = <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--moss)' }} />
          } else if (isSkipped) {
            dot = <div style={{ width: '8px', height: '8px', borderRadius: '50%', border: '1px dashed var(--mute)', opacity: 0.6 }} />
          } else if (isRaceDay) {
            dot = <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--s-race)' }} />
          } else if (isPast) {
            dot = <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--mute-2)', opacity: 0.5 }} />
          } else {
            dot = <div style={{ width: '8px', height: '8px', borderRadius: '50%', border: '1px solid var(--mute-2)' }} />
          }
          return (
            <div key={dayKey} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
              <div style={{
                fontFamily: 'var(--font-ui)', fontSize: '9px', fontWeight: 600,
                color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.06em',
              }}>{(DOW_FULL as any)[dayKey].charAt(0)}</div>
              {dot}
            </div>
          )
        })}
      </div>
      {/* Race week tag */}
      {isRace && week.date && (
        <div style={{
          marginTop: '10px',
          fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 700,
          color: 'var(--s-race)', letterSpacing: '0.08em', textTransform: 'uppercase',
        }}>
          {(() => {
            // Race day = last non-rest session in the week (typically Sun)
            const raceDay = DOW_ORDER.slice().reverse().find(k => {
              const s = (ws as any)[k]
              return s && s.type === 'race'
            }) ?? 'sun'
            const offset = DAY_OFFSETS[raceDay] ?? 6
            const raceDate = new Date(weekStartDate)
            raceDate.setDate(raceDate.getDate() + offset)
            return raceDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
          })()}
          {week.label ? ` · ${week.label}` : ''}
        </div>
      )}
    </div>
  )
}
