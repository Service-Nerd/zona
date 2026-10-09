'use client'

// DASHBOARD-SCREEN-EXTRACT-04 — lifted verbatim out of `DashboardClient.tsx`, the last
// of the fourteen. Module-level in the original, so it closed over nothing.
//
// ⚠️ Bodies UNCHANGED. Edit in a separate commit so the move stays a move.

import AIMark from '@/components/shared/AIMark'
import Button from '@/components/ui/Button'
import CoachByline from '@/components/shared/CoachByline'
import CoachNoteBlock from '@/components/shared/CoachNoteBlock'
import ConnectRunsBanner from '@/components/dashboard/ConnectRunsBanner'
import ManualRunModal from '@/components/dashboard/ManualRunModal'
import NextGoalCard from '@/components/training/NextGoalCard'
import PendingAdjustmentBanner from '@/components/shared/PendingAdjustmentBanner'
import PostRaceReshapeCard from '@/components/training/PostRaceReshapeCard'
import PreRunBandCard from '@/components/shared/PreRunBandCard'
import SessionCard from '@/components/shared/SessionCard'
import SessionPopupInner from '@/components/dashboard/SessionPopupInner'
import TrendCard from '@/components/shared/TrendCard'
import ZoneBar from '@/components/shared/ZoneBar'
import type { NextGoalOption } from '@/lib/coaching/goalSequencing'
import type { Plan, Session, Week } from '@/types/plan'
import type { PostRunData, SessionEntry } from '@/components/dashboard/dashboardHelpers'
import type { ReshapeProposal } from '@/components/training/RaceResultSheet'
import type { Zone } from '@/components/shared/ZoneBar'
import { BRAND } from '@/lib/brand'
import { DOW_FULL, DOW_LETTER, DOW_ORDER, computeSessionDate, displayZonesForSession, fmtDurationMins, getSessionHRDisplay } from '@/components/dashboard/dashboardHelpers'
import { MICRO_LABELS } from '@/components/shared/microLabels'
import { NotificationBell } from '@/components/shared/NotificationBell'
import { TRIAL_DAYS } from '@/lib/trial'
import { Wordmark } from '@/components/ui/Wordmark'
import { authedFetch } from '@/lib/supabase/authedFetch'
import { classifyHrPending } from '@/lib/coaching/hrPending'
import { convertDistanceString, convertPaceString, formatDate, formatDistance, formatDuration, formatRaceCountdown, resolveSessionMetric } from '@/lib/format'
import { renderPlanProse, planProseContext } from '@/lib/plan/renderGuidance'
import { easyPaceAsCeiling } from '@/lib/plan/easyPaceCeiling'
import { getSessionColor, getSessionLabel } from '@/lib/session-types'
import { isFatigueTag } from '@/lib/coaching/completionVocab'
import { isLongRun } from '@/lib/plan/sessionRole'
import { parseLocalDate } from '@/lib/plan'
import { resolveAutoMatch } from '@/lib/coaching/sessionAutoMatch'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { weightOf, zoneDiscipline } from '@/lib/coaching/weeklyZoneAggregate'

// AdjustmentBanner — now wraps PendingAdjustmentBanner with API call logic.
// State management lives here (and in DashboardClient), UI delegated to the shared component.
function AdjustmentBanner({ adjustment, onConfirmed, onReverted, preferredUnits = 'km' }: {
  adjustment: any
  onConfirmed?: (plan: any) => void
  onReverted?:  (plan: any) => void
  preferredUnits?: 'km' | 'mi'
}) {
  const [loading, setLoading] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  async function confirm() {
    setLoading(true)
    try {
      const res  = await authedFetch('/api/confirm-adjustment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adjustment_id: adjustment.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onConfirmed?.(data.plan)
    } catch { /* keep visible on error */ } finally { setLoading(false) }
  }

  async function revert() {
    setLoading(true)
    try {
      const res  = await authedFetch('/api/revert-adjustment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adjustment_id: adjustment.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onReverted?.(data.plan)
      setDismissed(true)
    } catch { /* keep visible on error */ } finally { setLoading(false) }
  }

  // RESHAPE-FIX-WAVE2A — pass the structural diff to the banner so the
  // per-day before/after strip renders under the prose. Defends against
  // the 2026-06-26 incident pattern: AI summary said one thing, diff
  // showed another; the user could only see the prose.
  return (
    <div style={{ margin: '0 0 12px' }}>
      <PendingAdjustmentBanner
        onConfirm={confirm}
        onRevert={revert}
        loading={loading}
        sessionsBefore={adjustment.sessions_before ?? undefined}
        sessionsAfter={adjustment.sessions_after ?? undefined}
        units={preferredUnits}
      >
        {adjustment.summary}
      </PendingAdjustmentBanner>
    </div>
  )
}

// A1 (Design Board, sitting three) — Today is ONE DAY; Plan owns weeks.
//
// This strip used to carry `‹ Week 4 of 12 ›` with working arrows, and the
// whole Today screen answered a horizontal swipe by changing week. So the two
// screens both navigated the plan, and `screen-architecture.md § Today` had
// already said they should not: "session history beyond today" and "weekly
// summaries or trends" are both listed under *does not belong here*.
//
// ⚠️ THIS IS A RESTORATION, NOT A NEW RULE. The doc was right and the code had
// drifted from it — which is why `weekIndex` / `onWeekChange` are gone from the
// props rather than defaulted: a prop nobody passes is how the drift comes back.
//
// The seven day cells stay. They are this week's shape, which is context for
// today's session, not navigation away from it.
function DateStrip({ sessions, completions, selectedKey, onSelect }: {
  sessions: SessionEntry[]
  completions: Record<string, any>
  selectedKey: string | null
  onSelect: (key: string) => void
}) {
  const sessionMap = Object.fromEntries(sessions.map(s => [s.displayKey, s]))
  /**
   * DAYDOT-TEALKEY-01 — the dot's STATE and its COLOUR are separate answers.
   *
   * 🔴 This returned a colour only, and the dot sized itself with
   * `dotColor === 'var(--teal)' ? '6px' : '4px'` — a string comparison against
   * `--teal`, a token `CLAUDE.md` lists as BANNED (retired in favour of `--moss`) and which survives only as a legacy alias in `globals.css`. So
   * the ONE redundant channel completion had was keyed on a retired token
   * name: the moment anyone did the obvious tidy-up and returned
   * `'var(--moss)'`, the dot would silently stop growing and completion would
   * be carried by colour alone. That is D-17 — never branch on a display
   * string another layer is allowed to rewrite — reappearing in the palette.
   *
   * The wider problem (session type, completion, skip and move all sharing one
   * colour channel) is `DESIGN-DAYDOT-CHANNEL-01`, Design Board § 6q, wave 3.
   * This fixes only the booby trap.
   */
  function getDot(key: string): { colour: string; complete: boolean; skipped: boolean } | null {
    const s = sessionMap[key]
    if (!s || s.type === 'rest') return null
    const comp = completions[s.key] // use originalDay for completion lookup
    // DESIGN-DAYDOT-CHANNEL-01 — THE HUE IS THE SESSION'S TYPE, ALWAYS.
    // It used to be overwritten: complete returned --teal and skipped returned
    // --text-muted, so a completed interval and a completed easy run were one
    // dot and the type was destroyed by finishing the run. State now rides on
    // the SHAPE (filled = done, ring = not yet) and on opacity (skipped),
    // which is the fill-vs-ring candidate the filing proposed and the one
    // encoding that survives at 4px, where neither a glyph nor a label fits.
    return {
      colour: getSessionColor(s),
      complete: comp?.status === 'complete',
      skipped: comp?.status === 'skipped',
    }
  }

  return (
    <div style={{ borderBottom: '0.5px solid var(--border-col)', background: 'var(--bg)', padding: '6px 0 10px' }}>
      {/* Day cells */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', padding: '0 8px', gap: '2px' }}>
        {DOW_ORDER.map(key => {
          const s = sessionMap[key]
          const isSelected = key === selectedKey
          const isToday = s?.today ?? false
          const dot = getDot(key)
          const dateNum = s ? s.rawDate.getDate().toString() : ''

          return (
            <Button variant="ghost" 
              key={key}
              onClick={() => onSelect(key)} style={{ flexDirection: 'column', gap: '3px', padding: '4px 2px', background: 'none', borderRadius: '12px' }}>
              {/* Day letter */}
              <span style={{ ...MICRO_LABELS.eyebrow, fontFamily: 'var(--font-ui)',
                color: isSelected ? 'var(--accent)' : isToday ? 'var(--accent)' : 'var(--text-secondary)' }}>
                {DOW_LETTER[key]}
              </span>

              {/* Date circle */}
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isSelected ? 'var(--accent)' : isToday && !isSelected ? 'var(--accent-soft)' : 'transparent',
                border: isToday && !isSelected ? '1px solid var(--accent-mid)' : 'none',
                transition: 'background 0.15s',
              }}>
                <span style={{
                  fontFamily: 'var(--font-ui)', fontSize: '13px',
                  color: isSelected ? 'var(--card)' : isToday ? 'var(--accent)' : dateNum ? 'var(--text-muted)' : 'var(--text-primary)',
                  fontWeight: isToday || isSelected ? 600 : 400,
                }}>
                  {dateNum}
                </span>
              </div>

              {/* Session dot. The size reads the STATE, never the colour
                  (DAYDOT-TEALKEY-01), and now so does the FILL
                  (DESIGN-DAYDOT-CHANNEL-01): a done session is a solid dot in
                  its own type colour, an outstanding one is a ring in the same
                  colour, and a skipped one is that ring at half strength. Hue
                  is the type and only the type. Drawn at a constant 8px box so
                  the ring and the fill occupy the same space and the strip
                  does not reflow as runs are logged — the old 4px/6px swap
                  moved every dot on the row. */}
              <div style={{
                width: '8px', height: '8px', borderRadius: '50%',
                boxSizing: 'border-box',
                background: dot?.complete ? dot.colour : 'transparent',
                border: dot && !dot.complete ? `1.5px solid ${dot.colour}` : 'none',
                opacity: dot?.skipped ? 0.45 : 1,
                transition: 'background 0.15s, opacity 0.15s',
              }} />
            </Button>
          )
        })}
      </div>
    </div>
  )
}

// ReadinessSteadyChip — the calm/positive half of the SLT TD-READY spec
// (fresh/steady/cooked). When the readiness route returns `all_clear` or
// `no_trigger` with a baseline, render a small chip above the session card
// so the runner sees Kit IS watching, not just hears from him when something
// goes wrong. Tap once to expand the underlying numbers (RHR / HRV / sleep
// vs baseline). Rule-derived — no AIMark per Pattern 16 provenance.
//
// CoachingPrinciples §59. Gated upstream — only the cooked path writes a
// pending row; this chip surfaces the "we ran the check and it's fine" state
// the route already computes but never previously reached the UI.
function ReadinessSteadyChip({ detail }: {
  detail: {
    rhrBaseline?: number; rhrToday?: number
    hrvBaseline?: number; hrvToday?: number; hrvSd?: number
    sleepHours?: number
    samplesUsed?: number
  }
}) {
  const [expanded, setExpanded] = useState(false)

  // Compose individual signal lines only when the underlying numbers exist.
  // Some users will have RHR and sleep but not HRV (depends on watch).
  const lines: string[] = []
  if (detail.rhrToday != null && detail.rhrBaseline != null) {
    lines.push(`RHR ${detail.rhrToday} bpm (baseline ${Math.round(detail.rhrBaseline)})`)
  }
  if (detail.hrvToday != null && detail.hrvBaseline != null) {
    lines.push(`HRV ${detail.hrvToday} ms (baseline ${Math.round(detail.hrvBaseline)})`)
  }
  if (detail.sleepHours != null) {
    lines.push(`Sleep ${detail.sleepHours.toFixed(1)}h`)
  }
  if (lines.length === 0) return null

  return (
    <Button variant="secondary" fullWidth 
      onClick={() => setExpanded(v => !v)} style={{ marginBottom: 'var(--space-2)', position:     'relative' }}>
      {/* 3px moss left rail — same coaching-surface rule as elsewhere */}
      <div style={{
        position:     'absolute',
        left:         '8px',
        top:          '10px',
        bottom:       '10px',
        width:        '3px',
        background:   'var(--moss)',
        borderRadius: '2px',
      }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', justifyContent: 'space-between' }}>
        <span style={{
          fontFamily: 'var(--font-ui)', fontSize: '11px', fontWeight: 700,
          color: 'var(--moss)', textTransform: 'uppercase', letterSpacing: '0.12em',
        }}>
          Readiness · steady
        </span>
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--mute)' }}>
          {expanded ? '▴' : '▾'}
        </span>
      </div>
      {expanded && (
        <div style={{
          marginTop: 'var(--space-2)',
          fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--ink-2)',
          lineHeight: 1.55,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {lines.join(' · ')}
        </div>
      )}
    </Button>
  )
}

function RestDayCard({ session, nextSession, weekPhase, weekType, fitnessLevel, firstName, onLogRun }: {
  session: SessionEntry | null
  nextSession: SessionEntry | null
  weekPhase?: string
  weekType?: string
  fitnessLevel?: string
  firstName?: string
  /**
   * 🔴 LOG-OFFPLAN-02 — a rest day had NO log control of any kind.
   *
   * `showSessionHero = isRunDay || isStrengthDay`, so on a rest day the whole
   * session block — including its log buttons — never rendered. On a 3-day plan
   * that is **4 of 7 days with no way to record a run.**
   *
   * ⚠️ IT IS `secondary`, NOT `primary`, AND THAT IS THE RULING NOT A TASTE.
   * This card's job is to say "do nothing, it helps" (§ rest copy, and the
   * brand's own voice example). A moss CTA here would argue with the sentence
   * above it. `ui-patterns.md:3699` gives it a surface because it is a real
   * action on this screen; `:456` keeps a de-emphasised action off moss.
   */
  onLogRun?: () => void
}) {
  const isRestOrEmpty = !session || session.type === 'rest'
  const copy = getRestCopy(weekType, weekPhase, isRestOrEmpty ? undefined : session?.type, fitnessLevel, firstName)

  return (
    <div style={{ margin: '12px 12px 0' }}>
      <div style={{
        background: 'var(--card-bg)', borderRadius: '16px',
        border: '0.5px solid var(--border-col)', padding: '20px 18px', marginBottom: 'var(--space-3)',
      }}>
        <div style={{ ...MICRO_LABELS.eyebrow, fontFamily: 'var(--font-ui)', color: 'var(--text-muted)', marginBottom: 'var(--space-3)' }}>
          {copy.label}
        </div>
        <div style={{ fontSize: '22px', fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.25, marginBottom: 'var(--space-2)', letterSpacing: '-0.3px' }}>
          {copy.headline}
        </div>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
          {copy.body}
        </div>
      </div>

      {nextSession && (
        <div style={{
          background: 'var(--card-bg)', borderRadius: '12px',
          border: '0.5px solid var(--border-col)', padding: '14px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ ...MICRO_LABELS.eyebrow, fontFamily: 'var(--font-ui)', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Next run · {nextSession.day} {nextSession.date}
            </div>
            <div style={{ fontSize: '15px', color: 'var(--text-muted)', fontWeight: 500 }}>{nextSession.title}</div>
            {nextSession.detail && (
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{nextSession.detail}</div>
            )}
          </div>
          <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: getSessionColor(nextSession), flexShrink: 0, marginLeft: 'var(--space-3)' }} />
        </div>
      )}

      {/* LOG-OFFPLAN-02. "a run", never "this run" — there is no session to
          point at, and that one word is the whole distinction. */}
      {onLogRun && (
        <Button variant="secondary" size="compact" fullWidth
          onClick={onLogRun} style={{ marginTop: 'var(--space-3)' }}>
          Log a run
        </Button>
      )}
    </div>
  )
}

// TD-READY hero — readiness-led pre-session permission.
//
// When recovery signals (RHR / HRV / sleep) say today is cooked, the plan
// proposes an eased prescription. Default action: "Ease the session" — the
// app gives permission to back off. Override: "Run it anyway →" — never a
// coercive gate; the runner stays in charge. Rule-derived (no AIMark).
//
// Replaces the generic AdjustmentBanner for trigger_type === 'readiness_signal'
// so the call-to-action reads as permission, not as system-prompts-please-confirm.
// Other adjustment types (load_spike, fatigue, etc.) keep using AdjustmentBanner.
//
// CoachingPrinciples §59. PAID gated upstream — the readiness signal route
// returns null for free users, so no pending row is ever written.
function TdReadyHero({ adjustment, onConfirmed, onReverted }: {
  adjustment: any
  onConfirmed?: (plan: any) => void
  onReverted?:  (plan: any) => void
}) {
  const [loading, setLoading] = useState(false)
  const detail = adjustment.trigger_detail ?? {}

  // Compose the reason chips from the boolean signals the engine recorded.
  const reasonChips: string[] = []
  if (detail.isElevatedRHR) reasonChips.push('RHR up')
  if (detail.isLowHRV)      reasonChips.push('HRV down')
  if (detail.isShortSleep)  reasonChips.push('Short sleep')

  async function ease() {
    setLoading(true)
    try {
      const res  = await authedFetch('/api/confirm-adjustment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adjustment_id: adjustment.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onConfirmed?.(data.plan)
    } catch { /* keep visible on error */ } finally { setLoading(false) }
  }

  async function runAnyway() {
    setLoading(true)
    try {
      const res  = await authedFetch('/api/revert-adjustment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adjustment_id: adjustment.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onReverted?.(data.plan)
    } catch { /* keep visible on error */ } finally { setLoading(false) }
  }

  return (
    <div style={{
      background:   'var(--card)',
      borderRadius: 'var(--radius-lg)',
      border:       '1px solid var(--line)',
      padding:      '18px 20px 16px 22px',
      position:     'relative',
      marginBottom: 'var(--space-4)',
    }}>
      {/* 3px warn left rail — coaching-warning rail, NOT moss CTA rail.
          Same colour rule as the discipline ledger: rule-derived caution
          uses --warn, never --danger (no red in training UI per INV-DS-005). */}
      <div style={{
        position:     'absolute',
        left:         '8px',
        top:          '14px',
        bottom:       '14px',
        width:        '3px',
        background:   'var(--warn)',
        borderRadius: '2px',
      }} />

      {/* Eyebrow + reason chips */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)', flexWrap: 'wrap' }}>
        <span style={{ ...MICRO_LABELS.eyebrow, fontFamily: 'var(--font-ui)',
          color: 'var(--warn)' }}>
          Readiness · easing today
        </span>
        {reasonChips.length > 0 && (
          <>
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--mute)', opacity: 0.5 }}>·</span>
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--mute)' }}>
              {reasonChips.join(' · ')}
            </span>
          </>
        )}
      </div>

      {/* Permission line — the summary IS Kit-voice already (see
          buildReadinessAdjustment in lib/coaching/planAdjustment.ts). */}
      <p style={{
        fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 400,
        color: 'var(--ink)', lineHeight: 1.55, margin: '0 0 14px',
      }}>
        {adjustment.summary}
      </p>

      {/* Two actions: ease (primary) + run-anyway (secondary).
          Override stays equally visible — restraint isn't enforced. */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
        <Button variant="primary" fullWidth
          onClick={ease}
          disabled={loading}>
          Ease the session
        </Button>
        <Button variant="ghost" 
          onClick={runAnyway}
          disabled={loading} style={{ background:   'transparent', color:        'var(--ink-2)', padding:      '0 12px', minHeight:    '44px', fontSize: '13px', fontWeight: 500, cursor:       loading ? 'default' : 'pointer', opacity:      loading ? 0.5 : 1 }}>
          Run it anyway →
        </Button>
      </div>
    </div>
  )
}

/** Parse legacy free-text detail field into structured distance/duration */
function parseSessionDetail(detail: string | null): { distance?: number; duration?: string } {
  if (!detail) return {}
  const s = detail.trim()
  const hm = s.match(/^(\d+)h(\d{2})\b/)
  if (hm) return { duration: `${hm[1]}h${hm[2]}` }
  const h = s.match(/^(\d+)h\b/)
  if (h) return { duration: `${h[1]}h` }
  const min = s.match(/^(\d+(?:\.\d+)?)\s*min\b/i)
  if (min) {
    const d = formatDuration(parseFloat(min[1]))
    if (d) return { duration: d }
  }
  const km = s.match(/^(\d+(?:\.\d+)?)\s*km\b/i)
  if (km) return { distance: parseFloat(km[1]) }
  return {}
}

function getRestCopy(weekType?: string, weekPhase?: string, sessionType?: string, fitnessLevel?: string, firstName?: string): { label: string; headline: string; body: string } {
  const name = firstName ? `, ${firstName}` : ''

  // Non-running session types
  if (sessionType === 'strength') return { label: 'Strength today', headline: 'No running today.', body: "Legs get a pass. The gym work matters. Don't skip it thinking you're saving energy for the run." }
  if (sessionType === 'cross') return { label: 'Cross-train today', headline: 'No running today.', body: 'Keep the effort aerobic. This counts. Your legs will thank you on the long run.' }

  // Special week types take priority
  if (weekType === 'race' || weekType === 'race_event') {
    return { label: 'Race week', headline: "It's race week.", body: "Your legs need to forget how tired they were. One more run fixes nothing. Leave it." }
  }
  if (weekType === 'deload' || weekType === 'deload_done') {
    return { label: 'Deload week', headline: "Deload week.", body: "You've been piling on the load. This is the week your body catches up. Don't ruin it with extra miles." }
  }

  // Phase-based rest copy — varied by fitness level
  const isBeginner    = fitnessLevel === 'beginner'
  const isExperienced = fitnessLevel === 'experienced'

  switch (weekPhase) {
    case 'taper':
      return {
        label: 'No run today',
        headline: 'Step away from the trainers.',
        body: isBeginner
          ? `You've earned this${name}. The fitness is there; rest is how it stays.`
          : isExperienced
          ? "Fitness is locked. Any run now is a liability. Leave it."
          : "You've done the work. The fitness is locked in. Resting now is the last thing on the plan.",
      }
    case 'peak':
      return {
        label: 'No run today',
        headline: "You're sharp enough.",
        body: isBeginner
          ? `Rest is part of the plan${name}. Your body is catching up to the training load.`
          : isExperienced
          ? "Peak sharpness requires restraint. One more run won't help. One bad recovery will."
          : "One more run won't make you fitter. This rest keeps you there. Trust it.",
      }
    case 'build':
      return {
        label: 'No run today',
        headline: 'The work is done.',
        body: isBeginner
          ? `Your body is adapting${name}. Rest is where the fitness actually gets built.`
          : isExperienced
          ? "The hard sessions are compressing your system. Recovery is the other half of the adaptation equation."
          : "The hard sessions are taxing your system. This is where adaptation happens. Sit down.",
      }
    case 'base':
    default:
      return {
        label: 'No run today',
        headline: 'Rest is the work.',
        body: isBeginner
          ? `This is how it works${name}. Run, rest, adapt, in that order. The rest day is non-negotiable.`
          : isExperienced
          ? "Aerobic base is built in the margins: the sleep, the rest, the boring discipline of doing nothing."
          : "Aerobic fitness isn't built during the run. It's built in the recovery that follows. This day matters.",
      }
  }
}

export default function TodayScreen({ plan, weekIndex, daysToRace, raceName, preferredMetric, sessionMetricOverrides, stravaRuns, allOverrides, overridesReady, onOpenSession, allCompletions, preferredUnits, zone2Ceiling, onManualSaved, restingHR, maxHR, aerobicPace, stravaLoading, firstName, pendingAdjustment, readinessData, onAdjustmentConfirmed, onAdjustmentReverted, trialDaysLeft, onUpgrade, hasPaidAccess, dailyCoachNote, coachNoteSettled, runAnalysisMap, runAnalysisReady, onOpenCoach, onOpenPostRun, unreadNotifications = 0, onOpenNotifications, showRacePrompt, pendingReshape, nextGoalData, onPickNextGoal, onDismissNextGoal, showMaintCard, onDismissMaintCard, showMaintTransition, maintReengagement, maintThemeLine, onSeeMaintPlan, onAckMaintTransition, onLogRaceResult, onReshapeAccepted, onReshapeDismissed, recalTile, attributionRow }: {
  recalTile?: React.ReactNode
  /** OPS-ATTRIB-01 — passed as a NODE, the same shape as `recalTile`, so Today
   *  does not need a Supabase client or the answered-state. Design Board
   *  2026-09-28: renders LAST, below everything, because it is admin. */
  attributionRow?: React.ReactNode
  plan: Plan
  /** A1 — the week Today RENDERS. Always the current week: there is no longer
   *  a setter, because Today does not navigate weeks (Plan does). */
  weekIndex: number
  daysToRace: number; raceName: string; preferredMetric: 'distance' | 'duration'
  sessionMetricOverrides: Record<string, 'distance' | 'duration'>
  stravaRuns: any[]
  allOverrides: { week_n: number; original_day: string; new_day: string }[]
  overridesReady: boolean
  onOpenSession?: (s: any) => void
  allCompletions: Record<number, Record<string, any>>
  preferredUnits: 'km' | 'mi'
  zone2Ceiling: number | null
  onManualSaved?: () => void
  restingHR?: number | null; maxHR?: number | null; aerobicPace?: string | null
  stravaLoading?: boolean
  firstName?: string
  pendingAdjustment?: any | null
  /** Captured response from /api/pre-session-readiness — drives the steady chip
   *  on Today (fresh/steady half of the SLT TD-READY spec). Cooked path is on
   *  pendingAdjustment, not here. */
  readinessData?: {
    adjustment?: any | null
    reason?: string
    detail?: {
      rhrBaseline?: number; rhrToday?: number
      hrvBaseline?: number; hrvToday?: number; hrvSd?: number
      sleepHours?: number
      samplesUsed?: number
    }
  } | null
  onAdjustmentConfirmed?: (plan: any) => void
  onAdjustmentReverted?: (plan: any) => void
  trialDaysLeft?: number | null
  onUpgrade?: () => void
  hasPaidAccess?: boolean
  dailyCoachNote?: string | null
  coachNoteSettled?: boolean
  runAnalysisMap?: Record<number, Record<string, any>>
  runAnalysisReady?: boolean
  /** Navigates to the Coach tab — wired to Kit chip on AI-generated notes. */
  onOpenCoach?: () => void
  /** POST-RUN-01: route the retroactive RPE nudge into PostRunScreen. */
  onOpenPostRun?: (data: PostRunData) => void
  /** NOTIF-01: unread count + opener for the bell on the wordmark row. */
  unreadNotifications?: number
  onOpenNotifications?: () => void
  /** AI-DEPTH-08: post-race prompt and reshape card. */
  showRacePrompt?: boolean
  pendingReshape?: ReshapeProposal | null
  nextGoalData?: { achievement: string; options: NextGoalOption[] } | null
  onPickNextGoal?: (opt: NextGoalOption) => void
  onDismissNextGoal?: () => void
  /** MAINT-01 — quiet "Base running" card visible during the maintenance block. */
  showMaintCard?: boolean
  onDismissMaintCard?: () => void
  /** #1 — one-time post-race announcement that the maintenance block is live. */
  showMaintTransition?: boolean
  /** MAINT-07 — runner is in the §75 Phase 3 window (real current week, not the
   *  viewed one: the register follows where they actually are). */
  maintReengagement?: boolean
  /** Rule-engine line for the ongoing maintenance card — the real current week's
   *  `theme`, which is already phase-correct per §75. */
  maintThemeLine?: string
  onSeeMaintPlan?: () => void
  onAckMaintTransition?: () => void
  onLogRaceResult?: () => void
  onReshapeAccepted?: (plan: Plan) => void
  onReshapeDismissed?: () => void
}) {
  const currentWeek = plan.weeks[weekIndex]
  // week_n keyed by canonical week.n, not array position (MAINT-06) — so a
  // standalone maintenance plan keys completions at 26+ not 1. No-op for race plans.
  const weekNum = (currentWeek as any)?.n ?? (weekIndex + 1)
  // Display ordinal (1-indexed array position) — what the user sees ("Week 4"),
  // never the week.n key (which reads "Week 29" on a maintenance plan). ADR-013.
  const weekOrdinal = weekIndex + 1
  const totalWeeks = plan.weeks.length

  // HOOKS-ORDER-02 — the empty-plan guard used to return HERE, above fourteen
  // hooks. `currentWeek` flipping between renders then changed the hook COUNT,
  // which is React error 310 and takes the whole screen down — the same defect
  // that crashed Coach (HOOKS-ORDER-01, TrendCard). The guard now returns below
  // the last hook; every `currentWeek` read between here and there is defensive
  // for that one render, and none of those values reach the DOM.

  // Completions for this week — derived from shared allCompletions prop
  const completions = allCompletions[weekNum] ?? {}
  const [showManualLog, setShowManualLog] = useState(false)
  /** LOG-OFFPLAN-02 — a run the plan did not prescribe. Separate state from
   *  `showManualLog` on purpose: that one logs THE SESSION, this one logs A RUN,
   *  and collapsing them is how the modal would bind an off-plan run to a
   *  prescribed day again. */
  const [showOffPlanLog, setShowOffPlanLog] = useState(false)

  // MAINT-02 — AI weekly debrief for the viewed maintenance week (PAID; present
  // only when the enricher ran). Distinct from the rule-engine card copy so the
  // provenance byline marks only the model output.
  const maintDebrief =
    currentWeek?.phase === 'maintenance_restoration' || currentWeek?.phase === 'maintenance_base'
      ? currentWeek.coach_debrief
      : undefined

  // #1 — shape summary for the transition announcement (rule-engine; no AIMark).
  // Days/week from a representative maintenance week; rest/cross-train excluded.
  const maintWeeksAll = plan.weeks.filter(
    w => (w as any).phase === 'maintenance_restoration' || (w as any).phase === 'maintenance_base',
  )
  const maintWeekCount = maintWeeksAll.length
  const maintDaysPerWeek = maintWeekCount
    ? Object.values(maintWeeksAll[0].sessions ?? {}).filter(
        (s: any) => s && s.type !== 'rest' && s.type !== 'cross-train' && s.type !== 'cross_train',
      ).length
    : 0

  // POST-RUN-01: retroactive RPE nudges. Sessions auto-completed via the
  // webhook (strava_activity_id set, status='complete') but missing RPE in the
  // last 7 days. Tap → PostRunScreen with the analysis pre-loaded. Capped at
  // 3 to avoid burying Today.
  const missingRpeNudges = useMemo(() => {
    if (!plan?.weeks?.length) return []
    const now    = new Date()
    const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const days   = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
    const dayNames = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
    type Nudge = {
      session: any; weekN: number; dayKey: string
      dayName: string; distKm: number | null
      stravaActivityId: number | null; stravaActivityName: string | null
      sessionDate: Date
    }
    const result: Nudge[] = []
    for (const week of plan.weeks) {
      const weekStart = parseLocalDate((week as any).date)
      days.forEach((dayKey, idx) => {
        const completion = allCompletions[week.n]?.[dayKey]
        if (!completion) return
        if (completion.status !== 'complete') return
        if (completion.rpe != null) return
        if (!completion.strava_activity_id && !completion.apple_health_uuid) return
        const sessionDate = computeSessionDate(weekStart, dayKey)
        if (sessionDate < cutoff || sessionDate > now) return
        const session = (week.sessions as Record<string, any> | undefined)?.[dayKey]
        if (!session) return
        result.push({
          session,
          weekN:               week.n,
          dayKey,
          dayName:             dayNames[idx],
          distKm:              completion.strava_activity_km ?? null,
          stravaActivityId:    completion.strava_activity_id ?? null,
          stravaActivityName:  completion.strava_activity_name ?? null,
          sessionDate,
        })
      })
    }
    // Most recent first, max 3
    return result.sort((a, b) => b.sessionDate.getTime() - a.sessionDate.getTime()).slice(0, 3)
  }, [plan, allCompletions])

  // Derive this week's overrides from shared prop — no fetch needed
  const overrides = useMemo(() => {
    const map: Record<string, string> = {}
    allOverrides.filter(o => o.week_n === weekNum).forEach(o => { map[o.original_day] = o.new_day })
    return map
  }, [allOverrides, weekNum])

  // Swipe whole screen = week change
  // A1 — the screen-wide swipe-to-change-week is GONE with the strip's arrows.
  // Leaving the gesture while removing its visible control would be worse than
  // either: an undiscoverable way to end up on a week Today cannot explain.

  // Build 7-day session list
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const todayDow = ['sun','mon','tue','wed','thu','fri','sat'][now.getDay()]
  // HOOKS-ORDER-02: `parseLocalDate(undefined)` throws on `.split`, so this is
  // the line the guard used to protect. Never rendered when the week is missing
  // — the guard below returns before any of it reaches the DOM.
  const weekStartDate = currentWeek ? parseLocalDate((currentWeek as any).date) : new Date()
  const todayStr = formatDate(now, 'short')
  const ws = (currentWeek as any)?.sessions ?? {}

  // Pre-start state: viewing the first plan week before its start date.
  // Plans created with a future start date land here on the first open and
  // need different framing — the regular session hero would render the
  // first session ("5km, slowly.") as if today, which falsely implies the
  // user should be running. Gated on weekIndex === 0 so a user swiping to
  // future weeks for a peek doesn't trip the pre-start view.
  const planStartDate = plan.weeks[0] ? parseLocalDate((plan.weeks[0] as any).date) : new Date()
  const daysToPlanStart = Math.max(0, Math.ceil((planStartDate.getTime() - now.getTime()) / 86400000))
  const planNotStarted = planStartDate > now && weekIndex === 0

  // Apply overrides — memoised so it recomputes when overrides state changes
  // Each entry carries originalDay so completion lookups always use the stable key
  const effectiveWs = useMemo(() => {
    const result: Record<string, any> = {}
    DOW_ORDER.forEach(key => {
      if (Object.keys(overrides).includes(key)) return // moved away
      if (ws[key]) result[key] = { ...ws[key], originalDay: key }
    })
    Object.entries(overrides).forEach(([originalDay, newDay]) => {
      if (ws[originalDay]) result[newDay] = { ...ws[originalDay], originalDay }
    })
    return result
  }, [overrides, weekIndex])

  const sessions: SessionEntry[] = useMemo(() => DOW_ORDER.map(key => {
    const s = effectiveWs[key]
    const originalDay = s?.originalDay ?? key
    const d = computeSessionDate(weekStartDate, key)
    // `?? ''` — the owner returns null on an unparseable date; this row's
    // `date` field is a required string.
    const displayDate = formatDate(d, 'short') ?? ''
    // Parse legacy free-text detail as fallback for hand-authored plans
    const parsed = s ? parseSessionDetail(s.detail ?? null) : {}
    return {
      key: originalDay,
      displayKey: key,
      day: DOW_FULL[key],
      title: s?.label ?? '',
      detail: s?.detail ?? '',
      type: s?.type ?? 'rest',
      date: displayDate,
      rawDate: d,
      today: key === todayDow && d.toDateString() === now.toDateString(),
      distance: s?.distance_km ?? parsed.distance,
      duration: s?.duration_mins != null ? fmtDurationMins(s.duration_mins) : parsed.duration,
      // Canonical fields preserved for SessionPopupInner / composer
      label: s?.label ?? undefined,
      role: s?.role ?? undefined,
      catalogue_id: s?.catalogue_id ?? undefined,
      derived_set: s?.derived_set ?? undefined,
      distance_km: s?.distance_km ?? undefined,
      duration_mins: s?.duration_mins ?? undefined,
      primary_metric: s?.primary_metric ?? undefined,
      zone: s?.zone ?? undefined,
      hr_target: s?.hr_target ?? undefined,
      pace_target: s?.pace_target ?? undefined,
      rpe_target: s?.rpe_target ?? undefined,
      coach_notes: s?.coach_notes ?? undefined,
    }
  }), [effectiveWs, weekIndex])

  // Default selected day. selectedKey holds the calendar day (displayKey),
  // not the session's originalDay — otherwise a moved session and the now-empty
  // origin day collide on the same key and the lookup picks the wrong entry.
  const [selectedKey, setSelectedKey] = useState<string>(() => {
    const t = sessions.find(s => s.today)
    if (t) return t.displayKey
    const next = sessions.find(s => s.rawDate >= now && effectiveWs[s.displayKey] && effectiveWs[s.displayKey].type !== 'rest')
    if (next) return next.displayKey
    const last = [...sessions].reverse().find(s => effectiveWs[s.displayKey])
    return last?.displayKey ?? 'mon'
  })

  // Reset selected key on week change
  useEffect(() => {
    const t = sessions.find(s => s.today)
    if (t) { setSelectedKey(t.displayKey); return }
    const next = sessions.find(s => s.rawDate >= now && effectiveWs[s.displayKey] && effectiveWs[s.displayKey].type !== 'rest')
    if (next) { setSelectedKey(next.displayKey); return }
    const last = [...sessions].reverse().find(s => effectiveWs[s.displayKey])
    if (last) setSelectedKey(last.displayKey)
  }, [weekIndex, overridesReady, sessions])

  const selectedSession = sessions.find(s => s.displayKey === selectedKey) ?? null
  // ADR-015 / INV-FMT-001 — single-owner metric resolution. The Today-screen
  // hero used to decide distance-vs-duration by field presence alone
  // (`selectedSession.distance != null ? ... : selectedSession.duration ...`),
  // never reading `primary_metric` — the exact drift ADR-015 exists to
  // prevent. Resolved once here via the same resolver the session-detail card
  // already calls (line ~7738), consumed by the hero below.
  const heroMetric = selectedSession
    ? resolveSessionMetric(weekNum, selectedSession.key, selectedSession.primary_metric, sessionMetricOverrides, preferredMetric)
    : 'distance'
  const selectedEntry = selectedSession ? effectiveWs[selectedSession.displayKey] : null
  // Completion lookups must use the session's originalDay (stable id), not the
  // calendar day — completions are keyed by originalDay so they survive moves.
  const selectedCompletionKey = selectedSession?.key ?? ''

  // R25 Cut #2 — pre-run band: cohort stats for similar past runs shown above
  // today's session card. PAID only. Fires when a today session with a planned
  // distance is selected; silently absent when < 3 similar runs exist.
  const [preRunBand, setPreRunBand] = useState<{ cohortSize: number; avgHr: number | null; avgInZonePct: number | null; medianDistanceKm: number } | null>(null)
  const [preRunBandLoading, setPreRunBandLoading] = useState(false)
  useEffect(() => {
    const PRE_RUN_TYPES = new Set(['easy', 'long', 'run', 'quality', 'tempo', 'intervals', 'recovery'])
    if (!hasPaidAccess || !selectedSession?.today || !PRE_RUN_TYPES.has(selectedSession.type) || !selectedSession.distance) {
      setPreRunBand(null)
      return
    }
    setPreRunBandLoading(true)
    const params = new URLSearchParams({
      session_type: selectedSession.type,
      distance_km:  String(selectedSession.distance),
    })
    authedFetch(`/api/coaching/prerun-band?${params}`)
      .then(r => r.ok ? r.json() : null)
      .then((data: { cohort: { cohortSize: number; avgHr: number | null; avgInZonePct: number | null; medianDistanceKm: number } | null } | null) => {
        setPreRunBand(data?.cohort ?? null)
      })
      .catch(() => { setPreRunBand(null) })
      .finally(() => setPreRunBandLoading(false))
  // selectedSession.displayKey changes when user picks a different day
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSession?.displayKey, hasPaidAccess])

  const RUN_TYPES = ['run', 'easy', 'quality', 'race']
  const isRunDay      = selectedEntry && RUN_TYPES.includes(selectedEntry.type)
  const isStrengthDay = selectedEntry?.type === 'strength'
  const showSessionHero = isRunDay || isStrengthDay

  // HR-SYNC-02: per-card retry state. Tracks which apple_health_uuid is
  // currently mid-retry so the matching SessionCard renders the "Checking…"
  // copy. Single key — only one retry can be in flight at a time (matches
  // the throttle behaviour in retryHrFromUi).
  /**
   * 🔴 LOG-ONE-INTENTION-01 — Today answers "which run" ITSELF now.
   *
   * It could always have done: `stravaRuns` is already a prop and
   * `resolveAutoMatch` is pure. Not asking is what produced TWO buttons —
   * "Log this session" and "Log manually" — which are the same intention
   * ("I did this run") differing only in whether we can find the data. Collins
   * filed that in September; the founder hit it on his own device.
   *
   * ⚠️ ONE OWNER, not a copy of the session screen's `useMemo`. That copy was
   * the obvious move and it is how a parallel classifier is born.
   */
  const todayAutoMatch = useMemo(() => {
    if (!selectedSession?.today) return null
    return resolveAutoMatch(selectedSession, (currentWeek as any)?.date, selectedSession.key, stravaRuns)
  }, [selectedSession, currentWeek, stravaRuns])

  const [retryingForHrUuid, setRetryingForHrUuid] = useState<string | null>(null)
  const handleHrRetry = useCallback(async (uuid: string) => {
    setRetryingForHrUuid(uuid)
    try {
      const { retryHrFromUi } = await import('@/lib/health/clientSync')
      await retryHrFromUi()
    } finally {
      // Brief hold so the "Checking…" state is felt even on instant returns.
      setTimeout(() => setRetryingForHrUuid(cur => (cur === uuid ? null : cur)), 400)
    }
  }, [])

  // Guard against empty plan (e.g. failed Gist fetch). HOOKS-ORDER-02: this
  // returns BELOW every hook on purpose — moving it back above them reinstates
  // React error 310. `rules-of-hooks` now enforces that in `npm run verify`.
  if (!currentWeek) return (
    <div style={{ padding: '32px 16px', textAlign: 'center', fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)' }}>
      Unable to load plan. Check your connection and try again.
    </div>
  )

  // Next run session after selected day
  const nextRunSession = sessions.find(s =>
    s.rawDate > (selectedSession?.rawDate ?? now) && RUN_TYPES.includes(s.type)
  ) ?? null

  const weekTheme = (currentWeek as any).theme ?? ''

  // Week narrative data — phase, session progress, km target
  const totalSessionsThisWeek = sessions.filter(s => s.type !== 'rest').length
  const completedSessionsThisWeek = sessions.filter(s =>
    s.type !== 'rest' && (completions[s.key]?.status === 'complete' || completions[s.key]?.status === 'skipped')
  ).length
  const weeklyKm = (currentWeek as any).weekly_km as number | undefined
  const weekPhaseLabel = (() => {
    const p = (currentWeek as any).phase as string | undefined
    return p ? ({ base: 'Base', build: 'Build', peak: 'Peak', taper: 'Taper' }[p] ?? null) : null
  })()

  // Fatigue trend — last 5 tagged completions sorted chronologically
  const fatigueHistory = (() => {
    const entries: { tag: string; weekN: number; dayIdx: number }[] = []
    Object.entries(allCompletions).forEach(([wn, days]) => {
      const wNum = Number(wn)
      Object.entries(days).forEach(([day, c]: [string, any]) => {
        // FIRSTRUN-MISSED-01 — `if (c?.fatigue_tag)` accepted ANY truthy value,
        // so a missed-session reason entered this window and displaced real
        // fatigue data. The backfill moved the existing ones to `skip_reason`;
        // this makes it structurally impossible for a non-fatigue value to
        // re-enter, rather than trusting that no writer ever gets it wrong again.
        if (isFatigueTag(c?.fatigue_tag)) {
          const di = DOW_ORDER.indexOf(day)
          entries.push({ tag: c.fatigue_tag, weekN: wNum, dayIdx: di >= 0 ? di : 99 })
        }
      })
    })
    entries.sort((a, b) => a.weekN !== b.weekN ? a.weekN - b.weekN : a.dayIdx - b.dayIdx)
    return entries.slice(-5)
  })()

  // Fatigue warning — 2+ of last 3 tags are Heavy or Wrecked
  const heavyFatigue = fatigueHistory.length >= 3 &&
    fatigueHistory.slice(-3).filter(f => ['Heavy', 'Wrecked', 'Cooked'].includes(f.tag)).length >= 2

  // Fitness level from plan meta — for RestDayCard copy calibration
  const fitnessLevel = (plan.meta as any)?.fitness_level as string | undefined

  if (!overridesReady) return (
    <div style={{ paddingBottom: 'var(--space-2)' }}>
      <div style={{ padding: '16px 16px 6px' }}>
        <div style={{ width: '180px', height: '28px', borderRadius: '6px', background: 'var(--border-col)', marginBottom: 'var(--space-2)' }} />
        <div style={{ width: '100px', height: '14px', borderRadius: '4px', background: 'var(--border-col)' }} />
      </div>
      <div style={{ margin: '12px', height: '60px', borderRadius: '12px', background: 'var(--border-col)' }} />
      <div style={{ margin: '12px', height: '120px', borderRadius: '14px', background: 'var(--border-col)' }} />
    </div>
  )

  // ── Hero display line builder ────────────────────────────────────────
  // Derives the two-part hero: "[distance]km," (ink) + "[adjective]." (moss)
  // For rest days: "Today, you rest" / "Do nothing." / "It helps."
  // Fatigue-aware: heavy trend on easy sessions → "really slowly"
  function getHeroAdverb(type: string): string {
    if (heavyFatigue && ['easy', 'recovery', 'run'].includes(type)) return 'really slowly'
    const map: Record<string, string> = {
      easy:          'slowly',
      recovery:      'slowly',
      long:          'long and slow',
      quality:       'at tempo',
      tempo:         'at tempo',
      intervals:     'hard',
      hard:          'hard',
      race:          'fast',
      strength:      'with weights',
      'cross-train': 'easy',
      cross:         'easy',
      run:           'slowly',
    }
    return map[type] ?? 'steadily'
  }

  // ── Coaching note headline (plan-derived + fatigue + injury context) ─
  function getPlanCoachNote(): string {
    const phase = (currentWeek as any).phase as string | undefined
    const ws = (currentWeek as any).sessions ?? {}
    const sessionList = Object.values(ws) as any[]
    const hasQuality = sessionList.some(s => s && ['quality','tempo','intervals','hard'].includes(s.type))
    const hasLong    = sessionList.some(s => s && isLongRun(s))
    const injuries   = (plan.meta as any)?.injury_history as string[] | undefined

    // Fatigue context — prepend when there's a heavy trend
    const fatiguePrepend = heavyFatigue ? "Heavy effort showing. " : ""

    // Injury context on long run weeks
    const injuryNote = (() => {
      if (!hasLong || !injuries?.length) return ""
      if (injuries.some(i => i.includes('achilles'))) return " Watch the achilles on the long run."
      if (injuries.some(i => i.includes('knee')))     return " Protect the knee on hills."
      if (injuries.some(i => i.includes('shin')))     return " Easy on the downhills. Shin splints risk."
      return ""
    })()

    let base: string
    if (phase === 'taper') base = "Taper week. Back off and trust the work."
    else if (phase === 'peak')  base = "Peak week. You're sharp. Don't add more."
    else if (hasQuality && hasLong) base = "Quality and long run this week. Hard stuff first, long stuff rested."
    else if (hasQuality) base = "Quality session this week. Everything else is recovery."
    else if (hasLong)    base = `Long run week. Keep easy runs genuinely easy.${injuryNote}`
    else base = "Steady week. Execute consistently."

    return fatiguePrepend + base
  }

  // ── Zone discipline (HR-derived, time-weighted) ──────────────────────
  // Show actual % of time spent in each session's PRESCRIBED zone (i.e.
  // Z2 for easy/long, Z3 for tempo, Z4-5 for intervals), weighted by run
  // distance. Until 2026-05-22 the underlying figure was always "% in Z2"
  // regardless of session type — so a perfectly executed tempo run pulled
  // the discipline score down. The figure now honours each session's own
  // prescription. Sessions without run_analysis data (no Strava/HK HR
  // stream) are excluded from the denominator.
  const completedThisWeek = sessions.filter(s =>
    s.type !== 'rest' && completions[s.key]?.status === 'complete'
  )
  // Through the single owner (`weeklyZoneAggregate`). This and the Coach
  // screen's figure were the same formula written twice, and the Coach one
  // carried a comment promising they would agree. They now agree by
  // construction rather than by promise.
  //
  // ⚠️ The `completedThisWeek` filter above excludes `type === 'rest'`, which
  // the Coach site does not. Preserved rather than unified: a rest day has no
  // run_analysis row, so it is dropped by the `!a` guard either way, and
  // quietly changing a filter while extracting a function is how a refactor
  // stops being behaviour-neutral.
  const analysisRows = completedThisWeek
    .map(s => {
      const a = runAnalysisMap?.[weekNum]?.[s.key]
      if (!a || a.hr_in_zone_pct == null) return null
      return { inZone: a.hr_in_zone_pct as number, weight: weightOf(a.actual_load_km as number | null) }
    })
    .filter((v): v is { inZone: number; weight: number } => v !== null)
  const { pct: zoneDisciplinePercent, hits: zoneDisciplineHits } = zoneDiscipline(analysisRows)

  return (
    <div style={{ paddingBottom: 'var(--space-6)' }}>

      {/* CONNECT-01 — one-shot reminder banner for users who skipped the
          ConnectRuns ceremony. Self-contained; renders null on the wrong
          platform / state. Dismiss stamps connect_runs_banner_dismissed_at
          so the banner never reappears — the runner can still connect later
          via the Me-screen Apple Health row. */}
      <ConnectRunsBanner />

      {/* PV2-H — recalibration prompt (the living plan). Renders when a recovery-week
          time trial is completed and not yet applied; null otherwise. */}
      {recalTile && <div style={{ padding: '12px 16px 0' }}>{recalTile}</div>}

      {/* ── WORDMARK ROW ─────────────────────────────────────────────── */}
      <div style={{
        padding: '16px 16px 0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--space-2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <Wordmark size="xs" className="wordmark-today" />
          {/* Moss dot with soft halo */}
          <div style={{ position: 'relative', width: '8px', height: '8px', flexShrink: 0 }}>
            <div style={{
              position: 'absolute', inset: '-3px',
              borderRadius: '50%',
              background: 'var(--moss-soft)',
            }} />
            <div style={{
              position: 'absolute', inset: 0,
              borderRadius: '50%',
              background: 'var(--moss)',
            }} />
          </div>
        </div>
        {/* NOTIF-01 — bell. Paid/trial only (free users can't have notifications).
            Negative margins absorb the 44px tap target so it doesn't balloon the row. */}
        {hasPaidAccess && onOpenNotifications && (
          <div style={{ margin: '-11px -10px -11px 0' }}>
            <NotificationBell unreadCount={unreadNotifications} onClick={onOpenNotifications} />
          </div>
        )}
      </div>

      {/* ── HERO BLOCK ───────────────────────────────────────────────── */}
      <div style={{ padding: '20px 16px 0' }}>

        {/* Context row: Phase · Week N · hairline · "10 weeks out"
            (formatRaceCountdown — weeks, flipping to days inside the final
            week. NOT raw days; that was the pre-2026 format.) */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          marginBottom: 'var(--space-3)',
        }}>
          <span style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--mute)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}>
            {weekPhaseLabel ? `${weekPhaseLabel} · ` : ''}Week {weekOrdinal}
          </span>
          <div style={{ flex: 1, height: '1px', background: 'var(--line)' }} />
          {daysToRace > 0 && (
            <span style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--moss)',
              letterSpacing: '0.04em',
              background: 'var(--moss-soft)',
              borderRadius: '20px',
              padding: '3px 9px',
            }}>
              {formatRaceCountdown(daysToRace, { suffix: 'out' })}
            </span>
          )}
        </div>

        {/* Hero label + display */}
        {planNotStarted ? (
          <>
            <div style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '15px',
              fontWeight: 500,
              color: 'var(--mute)',
              marginBottom: '4px',
              lineHeight: 1,
            }}>
              {(() => {
                const h = new Date().getHours()
                const greeting = h >= 5 && h < 12 ? 'Good morning' : h >= 12 && h < 17 ? 'Good afternoon' : h >= 17 && h < 22 ? 'Good evening' : 'Evening'
                return firstName ? `${greeting}, ${firstName}` : greeting
              })()}
            </div>
            <div style={{ lineHeight: 1, marginBottom: 'var(--space-3)' }}>
              <span style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '56px',
                fontWeight: 800,
                color: 'var(--ink)',
                letterSpacing: '-2.5px',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {daysToPlanStart === 1 ? 'Tomorrow.' : `${daysToPlanStart} days.`}
              </span>
              <br />
              <span style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '56px',
                fontWeight: 800,
                color: 'var(--moss)',
                letterSpacing: '-2.5px',
              }}>
                {/* CD-5/N7 — a short gap before the plan can rest; a longer one
                    must keep ticking over, or the runner detrains before week 1. */}
                Until then, {daysToPlanStart > 3 ? 'keep it easy.' : 'rest up.'}
              </span>
            </div>
            <div style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '13px',
              color: 'var(--mute)',
              marginBottom: daysToPlanStart > 3 ? '8px' : '20px',
            }}>
              Plan begins {formatDate(planStartDate, 'weekday-long')}.
            </div>
            {daysToPlanStart > 3 && (
              <div style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '14px',
                color: 'var(--ink-2)',
                lineHeight: 1.5,
                marginBottom: 'var(--space-5)',
              }}>
                A few easy runs a week, nothing hard. Arrive at week one fresh.
              </div>
            )}
          </>
        ) : showSessionHero && selectedSession ? (
          <>
            <div style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '15px',
              fontWeight: 500,
              color: 'var(--mute)',
              marginBottom: '4px',
              lineHeight: 1,
            }}>
              {(() => {
                const h = new Date().getHours()
                const greeting = h >= 5 && h < 12 ? 'Good morning' : h >= 12 && h < 17 ? 'Good afternoon' : h >= 17 && h < 22 ? 'Good evening' : 'Evening'
                return firstName ? `${greeting}, ${firstName}` : greeting
              })()}
            </div>
            <div style={{ lineHeight: 1, marginBottom: 'var(--space-4)' }}>
              {(heroMetric === 'distance' ? selectedSession.distance != null : selectedSession.duration == null) && selectedSession.distance != null ? (
                <>
                  <span style={{
                    fontFamily: 'var(--font-ui)',
                    fontSize: '56px',
                    fontWeight: 800,
                    color: 'var(--ink)',
                    letterSpacing: '-2.5px',
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {formatDistance(selectedSession.distance, preferredUnits, { exact: selectedSession.type === 'race' })},{' '}
                  </span>
                  <br />
                  <span style={{
                    fontFamily: 'var(--font-ui)',
                    fontSize: '56px',
                    fontWeight: 800,
                    color: 'var(--moss)',
                    letterSpacing: '-2.5px',
                  }}>
                    {getHeroAdverb(selectedSession.type)}.
                  </span>
                </>
              ) : selectedSession.duration ? (
                <>
                  <span style={{
                    fontFamily: 'var(--font-ui)',
                    fontSize: '56px',
                    fontWeight: 800,
                    color: 'var(--ink)',
                    letterSpacing: '-2.5px',
                  }}>
                    {selectedSession.duration},{' '}
                  </span>
                  <br />
                  <span style={{
                    fontFamily: 'var(--font-ui)',
                    fontSize: '56px',
                    fontWeight: 800,
                    color: 'var(--moss)',
                    letterSpacing: '-2.5px',
                  }}>
                    {getHeroAdverb(selectedSession.type)}.
                  </span>
                </>
              ) : (
                <span style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: '40px',
                  fontWeight: 800,
                  color: 'var(--ink)',
                  letterSpacing: '-1.5px',
                }}>
                  {selectedSession.title}
                </span>
              )}
            </div>
          </>
        ) : (
          <>
            <div style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '15px',
              fontWeight: 500,
              color: 'var(--mute)',
              marginBottom: '4px',
            }}>
              {(() => {
                const h = new Date().getHours()
                const greeting = h >= 5 && h < 12 ? 'Good morning' : h >= 12 && h < 17 ? 'Good afternoon' : h >= 17 && h < 22 ? 'Good evening' : 'Evening'
                return firstName ? `${greeting}, ${firstName}` : greeting
              })()}
            </div>
            <div style={{ lineHeight: 1, marginBottom: 'var(--space-4)' }}>
              <span style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '56px',
                fontWeight: 800,
                color: 'var(--ink)',
                letterSpacing: '-2.5px',
              }}>
                Do nothing.{' '}
              </span>
              <span style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '56px',
                fontWeight: 800,
                color: 'var(--moss)',
                letterSpacing: '-2.5px',
              }}>
                It helps.
              </span>
            </div>
          </>
        )}

        {/* Trial nudge — appears when ≤4 days remain (TRIAL-NUDGE-01).
            Day-keyed escalation: factual → attachment → loss preview → stark.
            Calm reminder, not a paywall. Plan stays either way; coaching pauses. */}
        {trialDaysLeft != null && trialDaysLeft > 0 && trialDaysLeft <= 4 && (() => {
          const daysIn = TRIAL_DAYS - trialDaysLeft
          const messages: Record<1 | 2 | 3 | 4, { headline: string; sub: string }> = {
            4: { headline: 'Four days of full access left.',                 sub: 'Plan is yours either way.' },
            3: { headline: `Kit's read ${daysIn} days of your runs.`,        sub: 'Three days left to keep him.' },
            2: { headline: 'Two days. Then this becomes a static plan.',     sub: 'Plan still works. Coaching stops.' },
            1: { headline: 'One day left.',                                  sub: 'Kit goes quiet at midnight.' },
          }
          const msg = messages[trialDaysLeft as 1 | 2 | 3 | 4]
          return (
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <Button variant="secondary" 
                onClick={onUpgrade} style={{ justifyContent: 'flex-start', width: '100%', textAlign: 'left', padding: '14px 16px', background: 'var(--card)', borderLeft: '3px solid var(--moss)', borderRadius: 'var(--radius-md)', gap: 'var(--space-3)' }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '2px' }}>
                    {msg.headline}
                  </div>
                  <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)', lineHeight: 1.4 }}>
                    {msg.sub}
                  </div>
                </div>
                <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 600, color: 'var(--moss)', whiteSpace: 'nowrap' }}>
                  See plans →
                </span>
              </Button>
            </div>
          )
        })()}

        {/* Trial expired banner — shown when trial has ended and no active subscription.
            Voice aligned with UpgradeScreen trial-expired headline (TRIAL-NUDGE-01).
            Warn accent (not moss — this is not a nudge). Plan still runs. */}
        {trialDaysLeft === 0 && !hasPaidAccess && (
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <Button variant="secondary" 
              onClick={onUpgrade} style={{ justifyContent: 'flex-start', width: '100%', textAlign: 'left', padding: '14px 16px', background: 'var(--card)', borderLeft: '3px solid var(--warn)', borderRadius: 'var(--radius-md)', gap: 'var(--space-3)' }}>
              <div>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '2px' }}>
                  Kit&rsquo;s gone quiet.
                </div>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)', lineHeight: 1.4 }}>
                  Plan still runs. Coaching needs a sub.
                </div>
              </div>
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 600, color: 'var(--warn)', whiteSpace: 'nowrap' }}>
                Bring Kit back →
              </span>
            </Button>
          </div>
        )}

        {/* AI-DEPTH-08: post-race reshape prompt + card ───────────────────
            Shown when the race week is in the past and no result logged yet.
            Priority order: pendingReshape card > prompt button > nothing. */}
        {pendingReshape && (
          <div style={{ marginBottom: 'var(--space-4)', animation: 'zonna-fade-in 0.2s ease-out' }}>
            <PostRaceReshapeCard
              state="live"
              reshapeId={pendingReshape.reshapeId}
              summary={pendingReshape.summary}
              weeksAffected={pendingReshape.weeksAffected}
              sessionsModified={pendingReshape.sessionsModified}
              distanceBucket={pendingReshape.distanceBucket}
              onAccepted={(reshapedPlan) => {
                // PostRaceReshapeCard called /api/post-race-reshape/confirm which
                // saved the plan to Supabase and returned the reshaped_plan_json.
                // We set local state directly to avoid a round-trip fetch.
                onReshapeAccepted?.(reshapedPlan)
              }}
              onDismiss={() => onReshapeDismissed?.()}
            />
          </div>
        )}

        {showRacePrompt && !pendingReshape && (
          <div style={{ marginBottom: 'var(--space-4)' }}>
            {hasPaidAccess ? (
              <Button variant="secondary" fullWidth 
                onClick={() => onLogRaceResult?.()}>
                <div>
                  <div style={{ ...MICRO_LABELS.eyebrow, fontFamily: 'var(--font-ui)', color: 'var(--moss)', marginBottom: '3px' }}>
                    Race done
                  </div>
                  <div style={{ fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 600, color: 'var(--ink)', lineHeight: 1.2 }}>
                    How did it go?
                  </div>
                  <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)', marginTop: '2px' }}>
                    Log your result · Zonna will adjust your plan
                  </div>
                </div>
                <span style={{ fontFamily: 'var(--font-ui)', fontSize: '18px', color: 'var(--moss)', flexShrink: 0 }}>→</span>
              </Button>
            ) : (
              <PostRaceReshapeCard
                state="locked"
                onUpgrade={() => onUpgrade?.()}
                onDismiss={() => onReshapeDismissed?.()}
              />
            )}
          </div>
        )}

        {/* MAINT-01/02: quiet "Base running" card — visible throughout the
            maintenance block. No ceremony, no push. When the AI enricher (MAINT-02,
            PAID) has written a weekly debrief, the card carries Kit's voice with a
            CoachByline + moss rail (Pattern 16b); otherwise it shows the rule-engine
            line with NO provenance mark. AIMark marks the enriched copy only. */}
        {/* #1 — one-time transition announcement. Marks the race done, explains
            (§75) why the plan eased, shows the block shape. Auto-live: the
            affordance is "See the plan" (→ adjust on the Plan screen), never
            accept/decline. Rule-engine copy → NO AIMark. Recovery-green rail
            mirrors the Plan-screen seam. */}
        {showMaintTransition && (
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <div style={{
              position: 'relative',
              background: 'var(--card)', boxShadow: 'var(--shadow-card)',
              borderRadius: 'var(--radius-lg)',
              padding: '16px 16px 12px 19px',
              border: '1px solid var(--line)',
              overflow: 'hidden',
            }}>
              <span style={{
                position: 'absolute', left: '8px', top: '16px', bottom: '16px',
                width: '3px', borderRadius: '2px', background: 'var(--s-recov)',
              }} />
              <div style={{ ...MICRO_LABELS.eyebrow, fontFamily: 'var(--font-ui)',
                color: 'var(--s-recov)',
                marginBottom: 'var(--space-2)' }}>
                After the race
              </div>
              <div style={{
                fontFamily: 'var(--font-ui)', fontSize: '17px', fontWeight: 800,
                color: 'var(--ink)', letterSpacing: '-0.01em', marginBottom: 'var(--space-2)',
              }}>
                {(() => {
                  const src = (plan.meta as any).source_race_name as string | undefined
                  return src ? `That's ${src} done.` : "That's the race done."
                })()}
              </div>
              <p style={{
                fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--ink-2)',
                lineHeight: '1.45', margin: '0 0 10px',
              }}>
                Your body&apos;s still repairing. The plan&apos;s eased to base running while it does.
              </p>
              {maintWeekCount > 0 && (
                <div style={{ ...MICRO_LABELS.sectionLabel, fontFamily: 'var(--font-ui)',
                  color: 'var(--mute)', marginBottom: 'var(--space-4)' }}>
                  {maintDaysPerWeek} day{maintDaysPerWeek === 1 ? '' : 's'}/week · {maintWeekCount} week{maintWeekCount === 1 ? '' : 's'} · below your base, on purpose
                </div>
              )}
              <Button variant="primary" fullWidth
                onClick={onSeeMaintPlan} style={{ marginBottom: '4px' }}>
                See the plan
              </Button>
              <Button variant="secondary" size="compact" fullWidth 
                onClick={onAckMaintTransition}>
                Got it
              </Button>
            </div>
          </div>
        )}

        {/* MAINT-07 — §75 Phase 3. In the block's final weeks the card changes
            register: it takes back the recovery-green rail and the "After the
            race" eyebrow it opened the chapter with (the transition card, above),
            so the block closes in the same voice that opened it — the app coming
            back, not a card appearing. Rule-engine copy → NO AIMark. When the PAID
            debrief is present it owns the card instead (CoachByline + moss rail);
            never both marks at once — provenance stays unambiguous. */}
        {showMaintCard && (
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <div style={{
              position: 'relative',
              background: 'var(--card)', boxShadow: 'var(--shadow-card)',
              borderRadius: 'var(--radius-lg)',
              padding: (maintDebrief || maintReengagement) ? '14px 16px 10px 19px' : '14px 16px 10px',
              border: '1px solid var(--line)',
              overflow: 'hidden',
            }}>
              {maintDebrief ? (
                <>
                  {/* Moss left rail — canonical AI-card signal (Pattern 16b) */}
                  <span style={{
                    position: 'absolute', left: '8px', top: '14px', bottom: '34px',
                    width: '3px', borderRadius: '2px', background: 'var(--moss)',
                  }} />
                  <div style={{ marginBottom: 'var(--space-2)' }}>
                    <CoachByline color="moss" role="Maintenance" />
                  </div>
                  <p style={{
                    fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--ink-2)',
                    lineHeight: '1.45', margin: '0 0 10px',
                  }}>
                    {maintDebrief}
                  </p>
                </>
              ) : (
                <>
                  {maintReengagement && (
                    <>
                      {/* Recovery-green rail — the transition card's rail, returning */}
                      <span style={{
                        position: 'absolute', left: '8px', top: '14px', bottom: '34px',
                        width: '3px', borderRadius: '2px', background: 'var(--s-recov)',
                      }} />
                      <div style={{ ...MICRO_LABELS.eyebrow, fontFamily: 'var(--font-ui)',
                        color: 'var(--s-recov)',
                        marginBottom: 'var(--space-2)' }}>
                        After the race
                      </div>
                    </>
                  )}
                  {/* The week's own theme — rule-engine copy, already phase-correct
                      (§75 voice register). Phase 3 weeks carry PHASE3_THEME, so the
                      closing line needs no separate string. Replaces a hardcoded
                      "…while you decide what's next", which was forward-goal
                      language during Phase 1, where §75 forbids it. */}
                  <p style={{
                    fontFamily: 'var(--font-ui)',
                    fontSize: '13px',
                    color: 'var(--ink-2)',
                    lineHeight: '1.4',
                    margin: '0 0 10px',
                  }}>
                    {/* COACH-INTRO-TOKEN-01 — a week theme can be AI-written
                        (`/api/post-race-reshape` writes `enrichment.theme`), so it
                        can carry an unresolved `{{token}}`. Through the owner. */}
                    {renderPlanProse(
                      maintThemeLine,
                      planProseContext(plan.meta),
                      t => convertDistanceString(t, preferredUnits),
                    ) || 'Base running.'}
                  </p>
                </>
              )}
              <Button variant="secondary" size="compact" fullWidth 
                onClick={onDismissMaintCard}>
                Dismiss
              </Button>
            </div>
          </div>
        )}

        {/* CA-03: post-race "what next" goal ladder — sequenced next goals that
            seed the wizard. Rule-engine output (no AIMark).
            MAINT-07: when a maintenance block exists, this is held until its §75
            Phase 3 window (gate: `nextGoalGateOpen`) so it never lands beside the
            "plan's eased to base running" announcement, and never asks for a
            racing decision while the runner is still repairing. */}
        {nextGoalData && (
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <NextGoalCard
              achievement={nextGoalData.achievement}
              options={nextGoalData.options}
              onPick={(opt) => onPickNextGoal?.(opt)}
              onDismiss={() => onDismissNextGoal?.()}
            />
          </div>
        )}

        {/* Pending adjustment — above coach note, prominent position.
            TD-READY: readiness-signal adjustments render as a permission
            pill instead of the generic confirm/revert banner — "ease the
            session" reads as permission, not as system-please-confirm.
            Other adjustment triggers (load_spike, fatigue, etc.) keep the
            existing banner. */}
        {pendingAdjustment && (
          pendingAdjustment.trigger_type === 'readiness_signal' ? (
            <TdReadyHero
              adjustment={pendingAdjustment}
              onConfirmed={onAdjustmentConfirmed}
              onReverted={onAdjustmentReverted}
            />
          ) : (
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <AdjustmentBanner
                adjustment={pendingAdjustment}
                onConfirmed={onAdjustmentConfirmed}
                onReverted={onAdjustmentReverted}
                preferredUnits={preferredUnits}
              />
            </div>
          )
        )}

        {/* Coach note — paid/trial only. Free users see no coach card.
            AI note (cached daily) preferred; rule-based fallback when AI is
            unavailable so paid users always see something.
            While the fetch is in flight (coachNoteSettled = false) we show a
            skeleton so the rule-based copy never flashes before the AI note. */}
        {hasPaidAccess && (() => {
          if (!coachNoteSettled) {
            return (
              <div style={{ marginBottom: 'var(--space-5)' }}>
                <div style={{
                  background: 'var(--warn-bg)',
                  borderRadius: '14px',
                  padding: '16px 18px',
                }}>
                  <div style={{ height: '8px', width: '48px', background: 'var(--warn)', opacity: 0.25, borderRadius: '4px', marginBottom: 'var(--space-3)' }} />
                  <div style={{ height: '10px', background: 'var(--warn)', opacity: 0.12, borderRadius: '4px', marginBottom: 'var(--space-2)', animation: 'ai-mark-pulse 1.6s ease-in-out infinite' }} />
                  <div style={{ height: '10px', width: '70%', background: 'var(--warn)', opacity: 0.12, borderRadius: '4px', animation: 'ai-mark-pulse 1.6s ease-in-out infinite' }} />
                </div>
              </div>
            )
          }
          const ruleNote = getPlanCoachNote()
          const coachLabel = weekPhaseLabel ?? 'COACH'
          if (dailyCoachNote) {
            return (
              <div style={{ marginBottom: 'var(--space-5)' }}>
                <CoachNoteBlock label={coachLabel} aiGenerated onChipClick={onOpenCoach}>
                  {dailyCoachNote}
                </CoachNoteBlock>
              </div>
            )
          }
          if (heavyFatigue) {
            return (
              <div style={{ marginBottom: 'var(--space-5)' }}>
                <CoachNoteBlock label="COACH">
                  Heavy trend. {ruleNote ? `${ruleNote} ` : ''}Ease it back today.
                </CoachNoteBlock>
              </div>
            )
          }
          return (
            <div style={{ marginBottom: 'var(--space-5)' }}>
              <CoachNoteBlock label={coachLabel}>
                {ruleNote}
              </CoachNoteBlock>
            </div>
          )
        })()}
      </div>

      {/* ── DATE STRIP ───────────────────────────────────────────────── */}
      <DateStrip
        sessions={sessions}
        completions={completions}
        selectedKey={selectedKey}
        onSelect={setSelectedKey}
      />

      {/* ── HOLD THE ZONE ──────────────────────────────────────────────
          First daily use of BRAND.voiceAnchor in the product UI. Renders
          only when today is a zone-bearing run session (skipped on rest /
          strength / cross-train). Names the zone explicitly without
          hijacking the hero's poetic slot. */}
      {showSessionHero && selectedSession && (() => {
        const dz = displayZonesForSession(selectedSession)
        if (!dz) return null
        return (
          <div style={{
            padding: '0 16px',
            marginBottom: 'var(--space-3)',
            display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
          }}>
            <span style={{
              width: '6px', height: '6px', borderRadius: '50%',
              background: 'var(--moss)',
              animation: 'ai-mark-pulse 2.4s ease-in-out infinite',
              flexShrink: 0,
            }} />
            <span style={{
              fontFamily: 'var(--font-ui)', fontSize: '11px', fontWeight: 700,
              color: 'var(--moss)',
              letterSpacing: '0.12em', textTransform: 'uppercase',
            }}>
              Hold the zone · {dz.rangeLabel} today
            </span>
          </div>
        )
      })()}

      {/* ── TODAY'S SESSION ──────────────────────────────────────────── */}
      <div style={{ padding: '16px 16px 0' }}>

        {/* Section label */}
        {showSessionHero && selectedSession && (
          <>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 'var(--space-3)',
            }}>
              <span style={{
                fontFamily: 'var(--font-ui)',
                ...MICRO_LABELS.eyebrow,
                color: 'var(--mute)',
              }}>
                {selectedSession.today ? "Today's session" : selectedSession.day}
              </span>
              {/* Right metric: zone or type */}
              {(selectedSession.zone || selectedSession.type !== 'rest') && (
                <span style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: '10px',
                  color: 'var(--mute-2)',
                }}>
                  {selectedSession.zone ?? getSessionLabel(selectedSession)}
                </span>
              )}
            </div>

            {/* TD-CLOSE — the day's close. When today is done (logged,
                skipped, or a rest day) Today resolves to a calm one-line
                read above the session card. The brand's anti-cheerleading
                voice: "Do nothing. It helps." for rest; "That's the day.
                Nothing to prove now." for a logged session; "Benched.
                Tomorrow's still the plan." for skipped.
                No confetti. The reward is closure, not celebration. */}
            {selectedSession.today && (() => {
              const todayCompletion = completions[selectedCompletionKey]
              const isDone    = todayCompletion?.status === 'complete'
              const isSkipped = todayCompletion?.status === 'skipped'
              const isRest    = selectedSession.type === 'rest'
              if (!isDone && !isSkipped && !isRest) return null

              const headline = isRest ? 'Do nothing. It helps.'
                : isSkipped ? "Benched. Tomorrow's still the plan."
                : "That's the day. Nothing to prove now."

              // The day's one number. For a logged run: distance. For rest /
              // skipped: nothing — the headline IS the read.
              const distKm = isDone ? todayCompletion?.strava_activity_km ?? null : null
              const metric = distKm != null ? formatDistance(distKm, preferredUnits) : null

              return (
                <div style={{
                  background:   'var(--card)',
                  border:       '1px solid var(--line)',
                  borderRadius: 'var(--radius-lg)',
                  padding:      '16px 20px 16px 22px',
                  marginBottom: 'var(--space-2)',
                  position:     'relative',
                }}>
                  {/* 3px moss left rail — completion accent, no warn here.
                      Restraint is the reward; --moss is the brand's quiet
                      "well done" colour without saying "well done". */}
                  <div style={{
                    position:     'absolute',
                    left:         '8px',
                    top:          '14px',
                    bottom:       '14px',
                    width:        '3px',
                    background:   'var(--moss)',
                    borderRadius: '2px',
                  }} />
                  <div style={{ ...MICRO_LABELS.eyebrow, fontFamily: 'var(--font-ui)', color: 'var(--moss)', marginBottom: '4px' }}>
                    {isRest ? 'Rest day' : isSkipped ? 'Benched' : "Today's done"}
                  </div>
                  <p style={{
                    fontFamily: 'var(--font-ui)', fontSize: '17px', fontWeight: 600,
                    color: 'var(--ink)', letterSpacing: '-0.3px', lineHeight: 1.3,
                    margin: 0,
                  }}>
                    {headline}
                  </p>
                  {metric && (
                    <div style={{
                      marginTop: 'var(--space-2)',
                      fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 500,
                      color: 'var(--ink-2)', fontVariantNumeric: 'tabular-nums',
                    }}>
                      {metric}
                    </div>
                  )}
                </div>
              )
            })()}

            {/* R25 Cut #2 — pre-run band. Shows cohort stats for similar past
                runs when the user is about to head out. PAID, today only.
                Formula-derived: no AIMark. Absent when < 3 similar runs.
                TD-READY (Decision #3): hides when a readiness-signal pending
                adjustment exists. Both want this real-estate; readiness wins
                because permission > confirmation on a cooked morning.
                TD-CLOSE: also hides when today is done — pre-run guidance
                is irrelevant after the run. */}
            {/* TD-READY steady chip — the calm/positive half of fresh/steady/
                cooked. Renders ONLY when: paid, today is selected, today's
                session is eligible (route returns detail only for quality/
                long/intervals/tempo), no cooked adjustment firing (TdReadyHero
                gets that), today isn't done, baseline exists. Tap to expand
                the numbers (RHR / HRV / sleep vs baseline). Rule-derived,
                no AIMark per Pattern 16 provenance. */}
            {hasPaidAccess
              && selectedSession.today
              && pendingAdjustment?.trigger_type !== 'readiness_signal'
              && !completions[selectedCompletionKey]?.status
              && selectedSession.type !== 'rest'
              && readinessData
              && !readinessData.adjustment
              && (readinessData.reason === 'all_clear' || readinessData.reason === 'no_trigger')
              && readinessData.detail
              && <ReadinessSteadyChip detail={readinessData.detail} />
            }

            {hasPaidAccess && selectedSession.today && pendingAdjustment?.trigger_type !== 'readiness_signal' && !completions[selectedCompletionKey]?.status && selectedSession.type !== 'rest' && (
              preRunBandLoading
                ? <PreRunBandCard state="skeleton" />
                : preRunBand
                ? <PreRunBandCard state="live" cohort={preRunBand} sessionType={selectedSession.type} />
                : null
            )}

            {/* Session card.
                Pace fallback chain: plan-baked pace_target → live aerobicPace
                (computed from Strava history) → '—' placeholder while Strava
                runs are still loading and an aerobic pace is expected. The
                placeholder reserves the slot so the detail line doesn't
                reflow when aerobicPace lands a beat later. */}
            {(() => {
              const expectsAerobicPace = (selectedSession.type === 'easy' || selectedSession.type === 'run') && !selectedSession.pace_target
              // PACE-UNITS-01 — same conversion, same reason, before the ceiling helper.
              const rawPaceForDetail = convertPaceString(selectedSession.pace_target, preferredUnits)
                ?? (expectsAerobicPace ? aerobicPace : null)
                ?? (expectsAerobicPace && stravaLoading ? '—' : null)
              // CD-11 / §12 — an easy run's pace is a ceiling, not a window.
              const paceForDetail = easyPaceAsCeiling(rawPaceForDetail, selectedSession.type)
              // P2 fix: route HR through getSessionHRDisplay (live Karvonen) instead of
              // reading the baked plan string directly. Mirrors what the expanded card does.
              const liveHrStr = getSessionHRDisplay(
                selectedSession.type,
                selectedSession.hr_target,
                restingHR ?? null,
                maxHR ?? null,
                zone2Ceiling ?? undefined,
              )
              return (
            <SessionCard
              type={selectedSession.type}
              role={selectedSession.role}
              name={selectedSession.title}
              detail={[
                selectedSession.zone,
                liveHrStr ? `${liveHrStr} bpm` : undefined,
                paceForDetail,
              ].filter(Boolean).join(' · ') || undefined}
              distanceKm={selectedSession.distance}
              units={preferredUnits}
              metric={resolveSessionMetric(weekNum, selectedSession.key, selectedSession.primary_metric, sessionMetricOverrides, preferredMetric)}
              durationMin={selectedSession.duration_mins}
              state={
                completions[selectedCompletionKey]?.status === 'complete' ? 'done'
                : completions[selectedCompletionKey]?.status === 'skipped' ? 'skipped'
                : selectedSession.today ? 'current'
                : 'future'
              }
              completion={completions[selectedCompletionKey]?.status === 'complete' ? {
                distanceKm: completions[selectedCompletionKey]?.strava_activity_km ?? undefined,
                avgBpm: completions[selectedCompletionKey]?.avg_hr ?? undefined,
                viaStrava: !!completions[selectedCompletionKey]?.strava_activity_id,
                activityName: completions[selectedCompletionKey]?.strava_activity_name ?? undefined,
              } : undefined}
              {...(() => {
                // HR-SYNC-02: look up the activity matching this completion and
                // classify HR-pending. Only applies when complete + an HK uuid
                // links the completion to an activity log row.
                const comp = completions[selectedCompletionKey]
                if (comp?.status !== 'complete' || !comp?.apple_health_uuid) return {}
                const act: any = stravaRuns?.find((r: any) => r.apple_health_uuid === comp.apple_health_uuid)
                if (!act || act.source !== 'apple_health') return {}
                const state = classifyHrPending({
                  source:        act.source,
                  avg_hr:        act.average_heartrate ?? null,
                  start_date:    act.start_date ?? null,
                  moving_time_s: act.moving_time ?? null,
                }, new Date())
                if (state !== 'pending' && state !== 'fallback') return {}
                return {
                  hrPendingState: state,
                  onHrRetry: state === 'fallback' ? () => handleHrRetry(comp.apple_health_uuid) : undefined,
                  isHrRetrying: retryingForHrUuid === comp.apple_health_uuid,
                }
              })()}
              onClick={() => {
                const isPast = selectedSession.rawDate < now && !selectedSession.today
                const isFuture = !selectedSession.today && selectedSession.rawDate > now
                onOpenSession?.({
                  ...selectedSession,
                  rawDate: selectedSession.rawDate.toISOString(),
                  completion: completions[selectedCompletionKey],
                  isPast,
                  isFuture,
                  weekN: weekNum,
                  weekTheme,
                })
              }}
            />
              )
            })()}

            {/* Zone bar — 5-segment strip under the session card. Reinforces
                "you are here" in the 5-zone arc. No labels on Today (this is
                glance-only); Session Detail's prescription card carries the
                labelled version. Renders only for zone-bearing sessions. */}
            {(() => {
              const dz = displayZonesForSession(selectedSession)
              if (!dz) return null
              return <ZoneBar activeZones={dz.zones} style={{ marginTop: 'var(--space-3)' }} />
            })()}

            {/* Primary CTA — only on today's session if not yet done.
                🔴 NOT DOCKED, AND THAT IS A MEASURED REVERSAL (TODAY-CTA-CLEARANCE-01,
                reverted 2026-09-25 within the hour). `position: sticky` pinned this
                button above the nav, which cleared it — and with Today's real content
                height the pin lands at 685-736 while the session card is at 760-852,
                **entirely below the fold**. The CTA floated over empty ground 167px
                ABOVE the card it refers to. Founder: *"we've moved the log session
                button too close to the session with spacing. It looks awful."*

                ⚠️ THE LESSON IS ABOUT WHICH ACTIONS CAN DOCK. A sticky primary works
                for a GLOBAL action — a form's submit, a sheet's apply — where the
                button means "finish this screen". This one means "log THAT session",
                so it is bound to the card above it, and detaching it breaks the
                sentence. Clearance is still owed; docking is not the way to pay it. */}
            {/* 🔴 LOG-ONE-INTENTION-01 — ONE BUTTON. It was two: "Log this
                session" (moss) and "Log manually" (white), which the founder
                read as an unexplained choice — *"We have a Log manually CTA. Do
                we actually need that? … It doesn't make that clear."*

                They were never a choice. "Log manually" did not log an EXTRA
                run; it logged the SAME prescribed session without a device.
                So the question the runner was being asked — match or manual? —
                is one the app can answer, and now does, above.

                ⚠️ THE TAP COUNT DOES NOT GET WORSE FOR ANYONE, and that is the
                condition this whole collapse turned on. No match goes STRAIGHT
                to manual entry, exactly as "Log manually" did: one tap, same as
                before. A match goes to the session screen, where the run is
                named and confirmed. There is deliberately no "we could not find
                a run" screen in between — that would tax the runner whose runs
                never reach HealthKit (ADR-011 §5) for our failure to find them.

                "run", not "session": the runner ran. `session` is the engine's
                noun. */}
            {(selectedSession.today || selectedSession.rawDate < now)
              && !completions[selectedCompletionKey]?.status && (
              <Button variant="primary" fullWidth
                onClick={() => {
                  if (todayAutoMatch) {
                    onOpenSession?.({
                      ...selectedSession,
                      rawDate: selectedSession.rawDate.toISOString(),
                      completion: completions[selectedCompletionKey],
                      isPast: false,
                      isFuture: false,
                      weekN: weekNum,
                      weekTheme,
                    })
                    return
                  }
                  setShowManualLog(true)
                }} style={{ marginTop: 'var(--space-3)' }}>
                Log this run
              </Button>
            )}
          </>
        )}

        {/* Rest day — show RestDayCard */}
        {!showSessionHero && (
          <RestDayCard
            onLogRun={() => setShowOffPlanLog(true)}
            session={selectedSession}
            nextSession={nextRunSession}
            weekPhase={(currentWeek as any).phase}
            weekType={(currentWeek as any).type}
            fitnessLevel={fitnessLevel}
            firstName={firstName}
          />
        )}

      </div>

      {/* ── RETROACTIVE RPE NUDGES (POST-RUN-01) ─────────────────────── */}
      {/* For paid users only — sessions auto-linked from Strava that the user
       *  never came back to rate. One subtle row per missing RPE; tap routes
       *  to PostRunScreen so they can add it now. Capped at 3. */}
      {hasPaidAccess && missingRpeNudges.length > 0 && onOpenPostRun && (
        <div style={{ padding: '12px 16px 0', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {missingRpeNudges.map(nudge => {
            // SESSION-DIST-UNITS-01 — km with a "mi"/"K" suffix, unconverted.
            const distLabel = nudge.distKm != null
              ? (formatDistance(nudge.distKm, preferredUnits, { exact: true }) ?? 'run')
              : 'run'
            return (
              <Button variant="secondary" fullWidth 
                key={`${nudge.weekN}-${nudge.dayKey}`}
                onClick={() => onOpenPostRun({
                  session: { ...nudge.session, key: nudge.dayKey, day: nudge.dayName, weekN: nudge.weekN },
                  weekN:   nudge.weekN,
                  pendingActivityId: null,  // already linked
                  linkedActivity: nudge.stravaActivityName ? {
                    name: nudge.stravaActivityName,
                    km:   nudge.distKm,
                  } : null,
                })}>
                <span aria-hidden="true" style={{
                  width: '6px', height: '6px', borderRadius: '50%',
                  background: 'var(--moss)', flexShrink: 0,
                }} />
                <span style={{
                  flex: 1, minWidth: 0,
                  fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 500,
                  color: 'var(--ink-2)', lineHeight: 1.4,
                }}>
                  Tell Kit how {nudge.dayName}&apos;s {distLabel} felt
                </span>
                <span aria-hidden="true" style={{
                  fontFamily: 'var(--font-ui)', fontSize: '14px',
                  color: 'var(--moss)', fontWeight: 600, flexShrink: 0,
                }}>
                  →
                </span>
              </Button>
            )
          })}
        </div>
      )}

      {/* ── VOICE ANCHOR STRIP (ZONE-VIS-02) ─────────────────────────────
          Replaces the Today-screen RestraintCard. The discipline NUMBER now
          lives on Coach (where retrospection belongs); Today keeps the
          discipline RHETORIC — a single moss line that anchors the day's
          job. Source: BRAND.voiceAnchor ("Hold the zone."). No card chrome:
          the strip earns presence through typography, not borders. */}
      <div style={{ padding: '18px 16px 0' }}>
        <div
          style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--moss)',
            letterSpacing: '-0.005em',
            lineHeight: 1.3,
          }}
        >
          {BRAND.voiceAnchor}
        </div>
      </div>

      {/* ── ATTRIBUTION (OPS-ATTRIB-01) ───────────────────────────────────
          LAST on the screen, by ruling. Silvanto: "today's job is the next
          decision; this is admin." It sits below the closing voice moment
          rather than interrupting it, and is visually inert so it cannot
          compete with the Moss line above. */}
      {attributionRow}

      {/* "Done this week" retrospective list removed — it duplicated the Plan
          calendar (which shows completed/skipped state per session) and added a
          second, review-shaped job to a present-moment screen. Today's own
          completion still shows via the hero card's `done` state above. */}

      {/* LOG-OFFPLAN-02 — no sessionKey, no sessionName, no planned distance.
          The modal's `offPlan` branch writes the activity row and nothing else. */}
      {showOffPlanLog && (
        <ManualRunModal
          weekN={weekNum}
          sessionKey={null}
          offPlan
          preferredUnits={preferredUnits}
          onClose={() => setShowOffPlanLog(false)}
          onSaved={() => { setShowOffPlanLog(false); onManualSaved?.() }}
        />
      )}

      {/* Manual log modal */}
      {showManualLog && (
        <ManualRunModal
          weekN={weekNum}
          sessionKey={selectedSession?.today ? selectedSession.key : null}
          sessionDate={selectedSession?.rawDate ?? null}
          preferredUnits={preferredUnits}
          onClose={() => setShowManualLog(false)}
          onSaved={() => { setShowManualLog(false); onManualSaved?.() }}
          sessionName={selectedSession?.title}
          sessionType={selectedSession?.type}
          plannedDistanceKm={selectedSession?.distance}
        />
      )}

      {/* Smoke tracker removed per brand-product-alignment v2 */}

    </div>
  )
}
