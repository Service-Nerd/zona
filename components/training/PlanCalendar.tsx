'use client'

import React, { useState, useRef, useEffect } from 'react'
import type { Week, Session } from '@/types/plan'
import type { DerivedSet } from '@/lib/plan/resolveMainSet'
import { getSessionColor } from '@/lib/session-types'
import { getCurrentWeekIndex, parseLocalDate } from '@/lib/plan/weekResolution'
import { sessionKmSelfPaced } from '@/lib/plan/sessionDistance'
import { formatDistance, formatDuration, sumRoundedDistance, resolveSessionMetric, type DistanceUnits, type SessionMetric, type SessionMetricOverrides } from '@/lib/format'

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
  // catalogue_id/derived_set/label are what catalogueRowFor()/mainSetDescription() need to
  // resolve real main-set instructions — without them the detail screen falls back to a
  // generic "Quality main set." placeholder (D-08 bug, fixed 2026-09-03).
  label?: string
  catalogue_id?: string
  derived_set?: DerivedSet
  zone?: string
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

/** One attempt at moving a session, from pick-up to confirm or abandon. */
export interface MoveAttempt {
  mode: 'tap' | 'drag'
  /** Pointer interactions the runner spent: taps for 'tap', press+release for 'drag'. */
  interactions: number
  /** Milliseconds from pick-up to the confirmation row appearing. */
  ms: number
  outcome: 'staged' | 'abandoned'
  /** 'drag' only: releases that landed on no valid day. The cost Wroblewski named. */
  misses: number
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
  /** MOVE-PROTOTYPE-01 — which gesture picks a session up.
   *
   *  `'tap'` is what ships and what the 2026-06-26 incident hardened. `'drag'`
   *  is the prototype the Design Board asked for: long-press to pick up, drag
   *  to a day, release.
   *
   *  ⚠️ BOTH STAGE INTO THE SAME `pendingMove` AND THE SAME CONFIRMATION ROW.
   *  A drop is a commit gesture, and "the runner did not realise the thing he
   *  did was a move" IS the 2026-06-26 root cause — so drag that writes on
   *  release would be comparing a safe flow against an unsafe one and calling
   *  the unsafe one faster. The safety is held constant; only the acquire-and-
   *  place gesture varies. Defaults to `'tap'`: the Plan screen is unchanged. */
  moveMode?: 'tap' | 'drag'
  /** Prototype instrumentation only. Fires once per completed or abandoned
   *  attempt so the board can rule on a measurement. Never wired in the app. */
  onMoveTelemetry?: (e: MoveAttempt) => void
  /** Prototype instrumentation only — the GESTURE's own phases, which the
   *  browser-event trace on the preview page structurally cannot see. */
  onMovePhase?: (phase: string) => void
}

export default function PlanCalendar({ weeks, allOverrides, allCompletions, onOverrideChange, onSessionTap, overridesReady = true, units = 'km', preferredMetric = 'distance', sessionMetricOverrides = {}, moveMode = 'tap', onMoveTelemetry, onMovePhase }: Props) {
  const [showPast, setShowPast] = useState(false)
  // PLAN-STRIP-EXPAND: single Later-week may be expanded into a full WeekCard
  // for move/swap. State held here so navigating away resets — option-value,
  // not use-value, in the brand sense (the tap-to-reveal IS the friction).
  const [expandedLaterWeek, setExpandedLaterWeek] = useState<number | null>(null)

  /**
   * ⚠️ SUPABASE IS LOADED ON FIRST MOVE OR SWAP, NOT ON RENDER.
   *
   * Only `handleMove` and `handleSwap` persist anything, and both are already
   * async and already make network round-trips, so a dynamic import costs
   * them nothing measurable. A static import cost every page that renders
   * this component **139 kB** of `@supabase/supabase-js` up front.
   *
   * That is not a theoretical saving. The marketing homepage renders the real
   * week cards in its phone still (DESIGN-V3 — the screens must be what the
   * app does), and a still can never move or swap: measured, the homepage's
   * First Load JS went 110 kB -> 249 kB purely from this import, on the one
   * page where Lighthouse and crawl budget actually matter. Inside the app
   * the chunk is already in flight for other reasons, so this is a marketing
   * win and an app no-op.
   *
   * `createBrowserClient` returns the same instance per browser, so calling
   * it inside the handler rather than at render changes no behaviour.
   */
  async function persistence() {
    const [{ createClient }, { authedFetch }] = await Promise.all([
      import('@/lib/supabase/client'),
      import('@/lib/supabase/authedFetch'),
    ])
    return { supabase: createClient(), authedFetch }
  }

  const currentWeekIndex = getCurrentWeekIndex(weeks)
  const safeIndex = currentWeekIndex >= 0 ? currentWeekIndex : 0
  // week_n is keyed by the canonical week.n (NOT array position) so a standalone
  // maintenance plan (weeks numbered 26+ in a short array) reads/writes completions
  // at the right key. Falls back to array position for any legacy week missing `n`.
  // No-op for race plans, where n already equals array position (MAINT-06).
  const pastWeeks = weeks.slice(0, safeIndex).map((week, i) => ({ week, weekNum: (week as any).n ?? (i + 1) }))
  const currentAndFutureWeeks = weeks.slice(safeIndex).map((week, i) => ({ week, weekNum: (week as any).n ?? (safeIndex + i + 1) }))

  async function handleMove(weekN: number, originalDay: string, newDay: string, currentSlot: string) {
    if (currentSlot === newDay) return
    const { supabase, authedFetch } = await persistence()
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
    const { supabase, authedFetch } = await persistence()
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
        moveMode={moveMode}
        onMoveTelemetry={onMoveTelemetry}
        onMovePhase={onMovePhase}
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

  // Post-race maintenance seam (§75, #3b): the "After the race" seam marks the
  // FIRST maintenance week in the current/future list. Using first-maintenance
  // (not a race→maint transition) means it still renders once the athlete is
  // already INSIDE the block — the transition itself is in the collapsed past by
  // then, so a transition-only check showed nothing. -1 when no maintenance.
  const maintBoundaryIdx = currentAndFutureWeeks.findIndex(cw => isMaintWeek(cw.week))

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
          {maintBoundaryIdx === 0 && <MaintSeam />}
          <PlanSectionLabel>Now</PlanSectionLabel>
          {renderWeek(currentWeek)}
        </>
      )}
      {nextWeek && (
        <>
          {maintBoundaryIdx === 1 && <MaintSeam />}
          <PlanSectionLabel>Next</PlanSectionLabel>
          {renderWeek(nextWeek)}
        </>
      )}
      {laterWeeks.length > 0 && (
        <>
          {maintBoundaryIdx === 2 && <MaintSeam />}
          <PlanSectionLabel right={`${laterWeeks.length} week${laterWeeks.length !== 1 ? 's' : ''}`}>Later</PlanSectionLabel>
          {laterWeeks.map((w, j) => {
            // Boundary can also fall deeper inside Later (race + first maint weeks
            // still in Now/Next). Combined index of this later week is j + 2.
            const seam = (j + 2) === maintBoundaryIdx && maintBoundaryIdx > 2
              ? <MaintSeam key={`seam-${w.weekNum}`} />
              : null
            // PLAN-STRIP-EXPAND: when this Later week is the currently-expanded
            // one, replace the strip with a full WeekCard preceded by a single
            // brand-restraint eyebrow ("LATER — STILL FLEXIBLE"). Tapping the
            // eyebrow collapses. Single-week expansion at a time.
            if (expandedLaterWeek === w.weekNum) {
              return (
                <React.Fragment key={`later-${w.weekNum}`}>
                {seam}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', animation: 'zonna-fade-in 0.18s ease-out' }}>
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
                </React.Fragment>
              )
            }
            return (
              <React.Fragment key={`later-${w.weekNum}`}>
                {seam}
                <WeekStripCard
                  week={w.week}
                  weekNum={w.weekNum}
                  completions={Object.values(allCompletions[w.weekNum] ?? {})}
                  units={units}
                  isPast={false}
                  onTap={() => setExpandedLaterWeek(prev => prev === w.weekNum ? null : w.weekNum)}
                />
              </React.Fragment>
            )
          })}
        </>
      )}
    </div>
  )
}

/** Is this an appended post-race maintenance week? (§75) */
function isMaintWeek(week?: Week): boolean {
  const p = (week as any)?.phase as string | undefined
  return p === 'maintenance_restoration' || p === 'maintenance_base'
}

/** Seam marking the start of the post-race maintenance block (#3b, §75).
 *  A recovery-green eyebrow (distinct from the grey Now/Next/Later labels) so the
 *  block reads as its own "after the race" chapter, not W-n of the race plan. */
function MaintSeam() {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', gap: '8px',
      padding: '0 4px', marginTop: '22px',
    }}>
      <span style={{
        fontFamily: 'var(--font-ui)', fontSize: '11px', fontWeight: 700,
        color: 'var(--s-recov)', letterSpacing: '0.12em', textTransform: 'uppercase',
      }}>After the race</span>
      <span style={{
        fontFamily: 'var(--font-ui)', fontSize: '10px',
        color: 'var(--mute)', letterSpacing: '0.04em',
      }}>maintenance</span>
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

function WeekCard({ week, weekNum, completions, overrides, onSessionTap, onMove, onSwap, units, preferredMetric, sessionMetricOverrides, moveMode = 'tap', onMoveTelemetry, onMovePhase }: {
  week: Week; weekNum: number; completions: Completion[]; overrides: { week_n: number; original_day: string; new_day: string }[]
  /** MOVE-PROTOTYPE-01 — see Props. Defaults to the shipped tap flow. */
  moveMode?: 'tap' | 'drag'
  onMoveTelemetry?: (e: MoveAttempt) => void
  onMovePhase?: (phase: string) => void
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
  const phase = (week as any).phase as string | undefined
  const isMaint = phase === 'maintenance_restoration' || phase === 'maintenance_base'
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
  // 🔴 SESSION-KM-03 (2026-09-22) — THE SAME DEFECT THIS REPO HAS ALREADY PAID
  // FOR TWICE. This read `s?.distance_km` directly, and a session is anchored
  // EITHER by distance OR by duration: on a beginner's plan **95.8% of sessions
  // carry `duration_mins` and a null `distance_km`.** `sumRoundedDistance` skips
  // null, so such a week summed to ZERO and the total — gated on
  // `intendedKm > 0` below — simply did not render. That is the founder's
  // "some weeks show a total in the top right and some don't", and the same
  // report's "everything shows duration even though my profile says distance":
  // one defect, not two. There was no distance to show.
  //
  // `sessionKmSelfPaced` is the SINGLE OWNER of "how far is this session"
  // (lib/plan/sessionDistance.ts), written for exactly this: it reads
  // `distance_km` when present and converts from `duration_mins` at the
  // session's own prescribed pace when it is not. It returns `null`, never 0,
  // when neither is resolvable — `?? 0` is not a safe default, it asserts "this
  // session covered no ground", which is what produced SESSION-KM-01/02.
  const sessionDistances = Object.values(ws).map((s: any) => sessionKmSelfPaced(s))
  const intendedKm = sumRoundedDistance(sessionDistances, units)
  const completionMap: Record<string, Completion> = {}
  completions.forEach(c => { completionMap[c.session_day] = c })
  const actualKm = completions
    .filter(c => c.status === 'complete' && c.strava_activity_km)
    .reduce((sum, c) => sum + (c.strava_activity_km ?? 0), 0)

  // ── MOVE-PROTOTYPE-01 — the drag gesture, for the board's comparison ──────
  //
  // Long-press to pick up, drag to a day, release. It stages into the SAME
  // `pendingMove` as the tap flow, so what is being compared is acquisition and
  // placement, not safety.
  //
  // ⚠️ THE HARD PART IS THE ONE WROBLEWSKI NAMED: this list scrolls. A press
  // that becomes a drag must not steal a scroll, and a scroll must not become a
  // drag. So the press only "arms" after PRESS_MS with the finger still inside
  // PRESS_SLOP_PX — move first and it is a scroll, and we never touch it. That
  // threshold is the whole cost of the gesture and the prototype must expose it
  // rather than tune it away: `misses` counts every release that landed on no
  // valid day, which is the number the board should rule on.
  // ⚠️ THESE TWO NUMBERS WERE TESTING THE GESTURE UNFAIRLY, and the founder's
  // three failed attempts are what said so.
  //
  // 350 ms with NO FEEDBACK OF ANY KIND until it elapsed. Nothing on screen
  // said "I am listening", so there was nothing to teach the timing — you press,
  // you start moving at 150 ms like a person does, the list scrolls, and it
  // looks broken. Every time, with no way to learn otherwise. And an 8px slop
  // cancelled on any drift, which a finger on glass produces and a mouse does
  // not: the gesture was tuned on a device that cannot reproduce the problem.
  //
  // No shipped drag implementation omits press feedback. Letting the board rule
  // against drag on a prototype that did would be ruling on my build, not on
  // the interaction.
  const PRESS_MS = 250
  const PRESS_SLOP_PX = 14

  /** The finger is down and the press is being waited out. Drives the immediate
   *  feedback that was missing — see PRESS_MS above. */
  const [pressKey, setPressKey] = useState<string | null>(null)
  const [dragKey, setDragKey]   = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)

  // 🔴 WHY THIS EFFECT EXISTS — the prototype did not work on a phone, and the
  // way I verified it could not have told me.
  //
  // `touch-action` is resolved by the browser AT TOUCH START. The first cut set
  // `touchAction: 'none'` only once the long-press had ARMED, i.e. 350 ms into
  // a touch the browser had already classified as a possible scroll — so the
  // property changed and the in-flight gesture did not. The finger moved, the
  // list scrolled, the browser fired `pointercancel`, and the drag died every
  // time.
  //
  // Setting `touch-action: none` up front instead would kill scrolling on the
  // whole list, which is the objection the prototype exists to TEST, not to
  // dodge. So: the list scrolls normally, and once a press has armed we take
  // the gesture with a NON-PASSIVE `touchmove` listener and `preventDefault()`.
  // That is what every real drag library does, for this reason.
  //
  // ⚠️ React's own `onTouchMove` cannot do this — it is attached passively, so
  // `preventDefault()` inside it is ignored. It has to be `addEventListener`
  // with `{ passive: false }`.
  useEffect(() => {
    if (!dragKey) return
    const swallow = (e: TouchEvent) => e.preventDefault()
    document.addEventListener('touchmove', swallow, { passive: false })
    return () => document.removeEventListener('touchmove', swallow)
  }, [dragKey])
  const pressTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pressOrigin = useRef<{ x: number; y: number } | null>(null)
  const attempt     = useRef<{ started: number; interactions: number; misses: number } | null>(null)
  const suppressClick = useRef(false)

  // 🔴 THE BROWSER TRACE COULD NOT HAVE FOUND THIS, AND THAT IS THE LESSON.
  //
  // The preview page logs `pointerdown` / `pointercancel` / `scroll` — what the
  // BROWSER did. If the press never arms, or arms and is torn down by the first
  // move, the browser trace looks exactly like a working one. A gesture needs
  // its own state on the record, not just the events underneath it.
  // ⚠️ NOT `phase` — that name already means the TRAINING phase in this scope
  // (base / build / peak / taper). tsc caught the shadow; the catalogue calls
  // this class "shadowed identifier" and it normally does NOT get caught.
  function logPhase(s: string) { onMovePhase?.(s) }

  function beginAttempt() {
    if (!attempt.current) attempt.current = { started: Date.now(), interactions: 0, misses: 0 }
  }
  function endAttempt(outcome: 'staged' | 'abandoned') {
    const a = attempt.current
    attempt.current = null
    if (a && onMoveTelemetry) {
      onMoveTelemetry({ mode: moveMode, interactions: a.interactions, ms: Date.now() - a.started, outcome, misses: a.misses })
    }
  }
  function countInteraction() {
    beginAttempt()
    if (attempt.current) attempt.current.interactions += 1
  }

  function clearPress() {
    setPressKey(null)
    if (pressTimer.current) logPhase('press cancelled — moved before it armed')
    const wasArming = !!pressTimer.current
    if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null }
    pressOrigin.current = null
    // A press that moved before it armed is a SCROLL. Discard the clock rather
    // than logging it, or every flick down the list becomes an "abandoned
    // attempt" and drag's abandon rate becomes a count of scrolling.
    if (wasArming && !dragKey) attempt.current = null
  }

  /** Which day is under the pointer, or null. Hit-tested against the DOM rather
   *  than computed from row heights: rest rows are shorter than session rows,
   *  so arithmetic would be wrong on exactly the slots a move targets most. */
  function dayUnder(x: number, y: number): string | null {
    if (typeof document === 'undefined') return null
    const el = document.elementFromPoint(x, y) as HTMLElement | null
    return el?.closest<HTMLElement>('[data-daykey]')?.dataset.daykey ?? null
  }

  function onRowPointerDown(key: string, movable: boolean, e: React.PointerEvent) {
    if (moveMode !== 'drag' || !movable) return
    // 🔴 THE CLOCK STARTS HERE, AT FIRST TOUCH — not when the press arms.
    //
    // It used to start inside the timer callback below, so a drag was timed
    // from 350ms in while a tap was timed from the finger landing. Measured on
    // the prototype before anyone used it: a 450ms hold plus a move reported
    // **162 ms**. The instrument was under-reporting drag by exactly the press
    // threshold, which is the single largest cost of the gesture and the whole
    // thing being compared. A biased instrument does not produce a weak ruling,
    // it produces a confident wrong one.
    beginAttempt()
    pressOrigin.current = { x: e.clientX, y: e.clientY }
    // ⚠️ NO `setPointerCapture`. It was here, and it bought nothing: every row
    // carries the same handlers and the drop target is found geometrically with
    // `elementFromPoint`, so events retargeting to another row is harmless. It
    // only added a platform-quirk surface to a gesture that was already failing.
    logPhase(`press on ${key}`)
    setPressKey(key)
    pressTimer.current = setTimeout(() => {
      // 🔴 CLEAR THE TIMER ID THE MOMENT IT FIRES.
      //
      // `setTimeout` leaves its id in the ref after the callback runs, so
      // `pressTimer.current` stayed TRUTHY once armed — and `onRowPointerMove`
      // gates on exactly that to decide "still waiting for the press". So the
      // first move after arming took the arming branch, exceeded the slop, and
      // called `clearPress()` — cancelling the press that had already
      // succeeded. The drag armed and was torn down by the runner's own first
      // movement.
      pressTimer.current = null
      setPressKey(null)
      countInteraction()
      setDragKey(key)
      setMovingDay(key)
      logPhase(`ARMED on ${key}`)
      if (navigator.vibrate) navigator.vibrate(30)
    }, PRESS_MS)
  }

  function onRowPointerMove(e: React.PointerEvent) {
    if (moveMode !== 'drag') return
    if (pressTimer.current && pressOrigin.current) {
      const dx = Math.abs(e.clientX - pressOrigin.current.x)
      const dy = Math.abs(e.clientY - pressOrigin.current.y)
      // ⚠️ ONLY A PREDOMINANTLY VERTICAL MOVE IS A SCROLL. The old test was
      // `dx > slop || dy > slop`, so sideways drift — which is not a scroll on
      // a vertically scrolling list, and which a finger always produces — stood
      // the press down. Now it has to look like the runner meant to scroll.
      if (dy > PRESS_SLOP_PX && dy > dx) clearPress()
      return
    }
    if (!dragKey) return
    e.preventDefault()
    setDragOver(dayUnder(e.clientX, e.clientY))
  }

  /** The browser took the gesture (scroll, phone call, another finger). This is
   *  NOT a release — treating it as one is what made the first cut stage or
   *  miss on a scroll the runner never intended as a drop. */
  function onRowPointerCancel() {
    if (moveMode !== 'drag') return
    clearPress()
    if (!dragKey) return
    logPhase('CANCEL — the browser took the gesture')
    setDragKey(null)
    setDragOver(null)
    setMovingDay(null)
    endAttempt('abandoned')
  }

  function onRowPointerUp(e: React.PointerEvent) {
    if (moveMode !== 'drag') return
    clearPress()
    if (!dragKey) return
    // A release is followed by the row's own `onClick`, which opens the session.
    // Dropping a run on Thursday and landing on Session Detail is not a drop.
    suppressClick.current = true
    const target = dayUnder(e.clientX, e.clientY)
    setDragKey(null)
    setDragOver(null)
    logPhase(target ? `drop on ${target}` : 'released on nothing')
    if (target && target !== dragKey) {
      countInteraction()
      // Pass the source explicitly: `setDragKey(null)` above has already run and
      // `movingDay` may not have flushed, so the handler must not have to guess.
      handleTargetTap(target, dragKey)
      return
    }
    // Released on nothing, or back where it started. This is the cost.
    if (attempt.current) attempt.current.misses += 1
    setMovingDay(null)
    endAttempt('abandoned')
  }

  function handleMoveIconTap(key: string) {
    countInteraction()
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
  function handleTargetTap(targetKey: string, sourceKey?: string) {
    // 🔴 SIDE EFFECTS ARE NOT DONE INSIDE A STATE UPDATER ANY MORE.
    //
    // This body used to sit inside `setMovingDay(prev => { ... })`, reading the
    // source day from `prev`. That was tolerable while the only side effect was
    // another setState on the SAME component; adding `endAttempt()` — which
    // calls the PARENT's setter through `onMoveTelemetry` — made React say so:
    // "Cannot update a component (MovePreviewPage) while rendering a different
    // component (WeekCard)". React may run an updater during render, and under
    // StrictMode runs it twice, so the telemetry could double-count the very
    // measurement the prototype exists to produce.
    //
    // An event handler already has the current state. Read it, then set it.
    const prev = sourceKey ?? movingDay
    if (!prev) return
    const sourceSession = effectiveSessions[prev]
    if (!sourceSession) { setMovingDay(null); return }
    const sourceOriginal = sourceSession.originalDay ?? prev
    const targetSession = effectiveSessions[targetKey]
    const targetCompletion = targetSession ? completionMap[targetSession.originalDay ?? targetKey] : undefined
    const targetIsSwappable = !!targetSession
      && targetSession.type !== 'rest'
      && targetCompletion?.status !== 'complete'
      && targetCompletion?.status !== 'skipped'
    setMovingDay(null)
    endAttempt('staged')
    setPendingMove({
      sourceKey: prev,
      targetKey,
      sourceOriginal,
      targetOriginal: (targetIsSwappable && targetSession) ? (targetSession.originalDay ?? targetKey) : null,
      sourceLabel: sourceSession.label ?? 'session',
      targetLabel: targetSession?.label ?? null,
      isSwap: targetIsSwappable && !!targetSession,
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

  // Abandoning move mode without staging anything is an attempt too, and it is
  // the one a gesture comparison most needs: a flow you back out of has cost
  // the runner exactly as much as one you complete.
  function abandonMove() {
    setMovingDay(null)
    setDragKey(null)
    setDragOver(null)
    endAttempt('abandoned')
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
        : isCurrent ? '3px solid var(--moss)' : isMaint ? '3px solid var(--s-recov)' : undefined,
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
            color: isRace ? 'var(--s-race)' : isCurrent ? 'var(--moss)' : isMaint ? 'var(--s-recov)' : 'var(--mute)',
            letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '2px',
          }}>
            {isMaint
              ? <>{phase === 'maintenance_restoration' ? 'Restoration' : 'Base'} · {formatDateRange(weekStartDate)}</>
              : <>{isRace ? 'Race week · ' : ''}W{weekNum} · {formatDateRange(weekStartDate)}</>}
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
              // Swallow the click the browser sends after a drag release.
              if (suppressClick.current) { suppressClick.current = false; return }
              if (isMoveTarget || isSwapTarget) { countInteraction(); handleTargetTap(key); return }
              if (movingDay) { abandonMove(); return }
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
                label:          s.label,
                catalogue_id:   s.catalogue_id,
                derived_set:    s.derived_set,
                zone:           s.zone,
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
            dragMode={moveMode === 'drag'}
            isDragOver={dragOver === key && dragKey !== key}
            isPressing={pressKey === key}
            onPointerDownRow={(e) => onRowPointerDown(key, isMovable, e)}
            onPointerMoveRow={onRowPointerMove}
            onPointerUpRow={onRowPointerUp}
            onPointerCancelRow={onRowPointerCancel}
          />
        )
      })}

      {movingDay && !pendingMove && (
        <button
          onClick={abandonMove}
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

      {/* RESHAPE-FIX-WAVE2C confirmation row. Pattern 10b (Move-confirmation
          row) — corrected 2026-09-12; it cited Pattern 30, which is PullToRefresh.
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

function DayRow({ dayKey, session, date, isToday, isPast, isFuture, completion, isMovable, isMoving, isMoveTarget, isSwapTarget, isMoveMode, isLast, onTap, onMoveIconTap, units, metric, dragMode = false, isDragOver = false, isPressing = false, onPointerDownRow, onPointerMoveRow, onPointerUpRow, onPointerCancelRow }: {
  dayKey: string; session: EffectiveSession | undefined; date: Date; isToday: boolean; isPast: boolean; isFuture: boolean
  completion?: Completion; isMovable: boolean; isMoving: boolean
  isMoveTarget: boolean; isSwapTarget: boolean
  isMoveMode: boolean; isLast: boolean
  onTap: () => void; onMoveIconTap: () => void
  units: DistanceUnits
  metric: SessionMetric
  /** MOVE-PROTOTYPE-01 — drag prototype only; all default off. */
  dragMode?: boolean
  isDragOver?: boolean
  /** Finger is down, waiting out the press. Immediate feedback, so the hold is
   *  legible instead of being a silent quarter-second. */
  isPressing?: boolean
  onPointerDownRow?: (e: React.PointerEvent) => void
  onPointerMoveRow?: (e: React.PointerEvent) => void
  onPointerUpRow?: (e: React.PointerEvent) => void
  onPointerCancelRow?: () => void
}) {
  const isComplete = completion?.status === 'complete'
  const isSkipped  = completion?.status === 'skipped'
  const hasSession = !!session && session.type !== 'rest'
  const isRestType = !session || session.type === 'rest'
  const isTarget = isMoveTarget || isSwapTarget
  // PLAN-LONGRUN-COLOUR-01 — through the owner, so a long run reads as one
  // here too. This indexed SESSION_COLORS directly while ui-patterns.md already
  // called getSessionColor the sole owner: a documented claim with no mechanism.
  const accent = session ? getSessionColor(session) : 'transparent'

  return (
    <div
      onClick={onTap}
      // MOVE-PROTOTYPE-01 — `data-daykey` is what the drag hit-test reads. The
      // target is found with `elementFromPoint`, not by arithmetic on row
      // heights: rest rows are SHORTER than session rows, so computed offsets
      // would be wrong on exactly the empty slots a move aims at most.
      data-daykey={dayKey}
      onPointerDown={dragMode ? onPointerDownRow : undefined}
      onPointerMove={dragMode ? onPointerMoveRow : undefined}
      onPointerUp={dragMode ? onPointerUpRow : undefined}
      onPointerCancel={dragMode ? onPointerCancelRow : undefined}
      style={{
        // Only suppress the browser's own gesture while a drag is actually in
        // flight. Setting it up front would kill scrolling on the whole list,
        // which is the objection this prototype exists to test, not to dodge.
        // The list scrolls normally; the gesture is taken by a non-passive
        // touchmove listener once the press arms (see the effect above). Setting
        // touch-action here did nothing, because the browser resolves it at
        // touch START and the press arms 350ms later.
        WebkitTouchCallout: dragMode ? 'none' : undefined,
        display: 'flex', alignItems: 'center',
        padding: isRestType && !isTarget ? '6px 14px' : '10px 14px',
        borderBottom: isLast ? 'none' : '1px solid var(--line)',
        background: isMoving || isDragOver || isTarget
          ? 'var(--moss-soft)'
          : isPressing
          ? 'var(--bg-soft)'      // the instant the finger lands: "I am listening"
          : 'transparent',
        // A press that is being waited out settles very slightly. The gesture
        // has to be legible BEFORE it arms, or there is nothing to learn from.
        transform: isPressing ? 'scale(0.985)' : undefined,
        cursor: (hasSession || isTarget) ? 'pointer' : 'default',
        opacity: isMoving ? 0.7 : isMoveMode && !isTarget && !isMoving ? 0.4 : isSkipped ? 0.5 : isPast && !isComplete && hasSession ? 0.45 : 1,
        // dashed = move (empty slot); solid = swap (occupied slot); solid on the source while moving.
        outline: isMoveTarget
          ? '1px dashed var(--moss-mid)'
          : isSwapTarget || isMoving
          ? '1px solid var(--moss-mid)'
          : 'none',
        outlineOffset: '-1px',
        transition: 'background 0.12s, opacity 0.15s, transform 0.12s',
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
              {/* UX-PLAN-MOVE-01 (2026-09-11) — the type chip is GONE, and the
                  session label has the row back.
                  MEASURED over 5,280 generated sessions before removing it:
                    · 65.7% of chips were a VERBATIM DUPLICATE of the label
                      beside them (label "Easy run — Zone 2", chip "Easy run —
                      Zone 2"), and the duplicate took 115px of a 172px row
                      while clipping the original to 51px — "Easy…".
                    · On a long run it was WRONG. `SESSION_LABELS[session.type]`
                      reads `type`, and a long run carries `type: 'easy'`, so a
                      row labelled "Long run — marathon pace + HM-pace finish"
                      wore a chip saying "Easy run — Zone 2".
                    · On quality it was strictly LESS informative: "Quality
                      session" against a label reading "Short VO2max".
                  In no measured case did it add anything. The type signal the
                  chip carried in its colour is already on the row, in the
                  coloured left accent bar.

                  D9 had already asserted the intent — "the session label is
                  primary... let this secondary type chip yield first" — and set
                  `flexShrink: 1` on the chip to achieve it. It never fired: the
                  label is `flex: 1 1 0%`, so its basis is 0, there is never
                  negative free space, and a shrink factor with nothing to shrink
                  is decoration. A fix that looks applied and does nothing. */}
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
                const durStr = formatDuration(session.duration_mins)
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
                  ● {completion.strava_activity_name}{completion.strava_activity_km ? ` · ${formatDistance(completion.strava_activity_km, units, { exact: true })}` : ''}
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
          // UX-PLAN-MOVE-01 (2026-09-11) — the pill loses its chrome and its word.
          //
          // It arrived as RESHAPE-FIX-WAVE2C Defect 11, replacing a 3-line
          // hamburger at 0.45 opacity that read as "more options". THE RECORD OF
          // WHY HAS SINCE BEEN MISREAD, including by the backlog entry that
          // scheduled this change: it said the old handle "caused a documented
          // incident" and that reverting "re-opens a real defect". It did not.
          //
          // Wave 2c shipped THREE things, and the safety is in the other two:
          // `pendingMove` stages the move between target-tap and write, and an
          // inline confirmation row ("Move Long run from Sun to Thu?") must be
          // confirmed before anything is written. Before that, tapping the icon
          // then a day wrote to `session_overrides` and posted `/api/adjust-plan`
          // immediately — no preview, no confirm. THAT was the defect. An
          // accidental tap today costs a tap on Cancel and zero DB side-effect.
          //
          // So the affordance is free to be quiet again, and the founder asked
          // for that. What it must NOT go back to is the hamburger: `≡` is the
          // universal "menu" glyph, which is exactly the ambiguity Defect 11
          // named. `↕` means one thing. It now sits in `--mute` beside the row's
          // own `›` chevron, sharing that vocabulary — a handle, not a CTA.
          // Moss is reserved for CTA and active states (ADR-007); spending it on
          // every movable row devalues it where it has to mean something.
          //
          // Hit area is 44x44 (iOS HIG) with negative margins so the row height
          // is unchanged — the old pill was roughly 24px tall and under-sized.
          <button
            onClick={e => { e.stopPropagation(); onMoveIconTap() }}
            aria-label={`Move ${session?.label ?? 'session'}`}
            title="Move this session"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              width: '44px', height: '44px',
              margin: '-11px -7px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--mute)',
              fontSize: '16px', lineHeight: 1,
            }}
          >
            ↕
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
  const isMaint = phase === 'maintenance_restoration' || phase === 'maintenance_base'
  // SESSION-KM-03 — the second of the two sites. Both read `distance_km` raw;
  // fixing one and not the other is how five copies of the pace formatter
  // happened. See the note on the first.
  const sessionDistances = Object.values(ws).map((s: any) => sessionKmSelfPaced(s))
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
        borderLeft: isRace ? '3px solid var(--s-race)' : isMaint ? '3px solid var(--s-recov)' : undefined,
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
          color: isRace ? 'var(--s-race)' : isMaint ? 'var(--s-recov)' : isPast ? 'var(--mute)' : 'var(--ink-2)',
          letterSpacing: '-0.005em',
        }}>
          {isRace
            ? 'Race week'
            : isMaint
            ? `${week.label ?? 'Maintenance'} · ${formatDateRange(weekStartDate)}`
            : `W${weekNum} · ${formatDateRange(weekStartDate)}`}
          {!isRace && !isMaint && phase === 'taper' && <span style={{ color: 'var(--mute)' }}> · taper</span>}
          {!isRace && !isMaint && (week as any).type === 'deload' && <span style={{ color: 'var(--mute)' }}> · deload</span>}
          {!isRace && !isMaint && week.label && phase === 'peak' && <span style={{ color: 'var(--mute)' }}> · peak</span>}
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
