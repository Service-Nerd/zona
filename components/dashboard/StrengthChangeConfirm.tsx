'use client'

// SAVE-PATTERN-01 (Design Board 2026-10-18) — "Here is what changes" for a strength plan that already exists.
//
// The same consent frame as the run plan (`ChangeConfirm`), so changing either plan is one journey. Two scales, each
// named (MODIFY-CONFIRM-DIFF-01 rule 1): the plan's shape (days, sessions a week, length) and this week's sessions,
// changed days only, through the same `AdjustmentDiff` the run plan uses. A first build skips this screen: there is
// nothing to compare against.

import AdjustmentDiff from '@/components/shared/AdjustmentDiff'
import ChangeConfirm, { ScaleLabel } from '@/components/shared/ChangeConfirm'
import { DIFF_DAY_ORDER } from '@/lib/coaching/diff/sessionDiff'
import { formatDuration } from '@/lib/format'
import { STRENGTH_SETUP, strengthSessionTitle } from '@/lib/strength-bridge/display'
import type { StrengthPlan } from '@/packages/strength'

const SHORT: Record<string, string> = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' }
const ORDINARY = new Set(['base', 'build', 'peak', 'deload'])

function liftDays(p: StrengthPlan): string {
  const days = p.profile.available_days?.length
    ? p.profile.available_days
    : (p.weeks.find(w => ORDINARY.has(w.phase) && w.sessions.length)?.sessions ?? []).map(s => s.day)
  return DIFF_DAY_ORDER.filter(d => days.includes(d)).map(d => SHORT[d]).join(', ') || 'None'
}

/** One week as the diff's seven day slots, each strength session as a session the diff can label. */
function weekSlots(p: StrengthPlan, weekN: number) {
  const w = p.weeks.find(x => x.n === weekN)
  return DIFF_DAY_ORDER.map(d => {
    const s = w?.sessions.find(x => x.day === d)
    // By KIND, not length: \`labelSession\` prefers a duration, and two different sessions of the same length then read
    // as no change at all ("strength 40 min → strength 40 min", seen on the fixture before this line was changed).
    return s ? { type: 'strength', label: strengthSessionTitle(s) } : null
  })
}

export default function StrengthChangeConfirm({ before, after, weekN, onAccept, onBack, onCancel, applying, error = null }: {
  before: StrengthPlan
  after: StrengthPlan
  /** The run plan's current week, which the strength plan shares its numbering with. */
  weekN: number
  onAccept: () => void
  onBack: () => void
  onCancel: () => void
  applying: boolean
  error?: string | null
}) {
  const rows: { label: string; from: string; to: string }[] = []
  if (liftDays(before) !== liftDays(after)) rows.push({ label: 'Days', from: liftDays(before), to: liftDays(after) })
  if (before.profile.sessions_per_week !== after.profile.sessions_per_week) {
    rows.push({ label: 'Sessions a week', from: String(before.profile.sessions_per_week), to: String(after.profile.sessions_per_week) })
  }
  if (before.profile.session_minutes !== after.profile.session_minutes) {
    rows.push({ label: 'Session length', from: formatDuration(before.profile.session_minutes) ?? '', to: formatDuration(after.profile.session_minutes) ?? '' })
  }
  const a = weekSlots(before, weekN), b = weekSlots(after, weekN)
  const weekChanged = JSON.stringify(a) !== JSON.stringify(b)

  return (
    <ChangeConfirm onBack={onBack} backLabel="Back to your strength answers" onAccept={onAccept} onCancel={onCancel}
      applying={applying} error={error}>
      {rows.length > 0 && <ScaleLabel>Your strength plan</ScaleLabel>}
      {rows.length > 0 && (
        <div style={{ background: 'var(--card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--line)', padding: '14px 16px', marginBottom: 'var(--space-4)' }}>
          {rows.map((r, i) => (
            <div key={r.label} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 'var(--space-3)', marginBottom: i < rows.length - 1 ? '10px' : 0 }}>
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--ink-2)' }}>{r.label}</span>
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--mute)', textAlign: 'right' }}>
                {r.from} <span aria-hidden>{'→'}</span>{' '}
                <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{r.to}</span>
              </span>
            </div>
          ))}
        </div>
      )}
      {weekChanged && <ScaleLabel>What changes this week</ScaleLabel>}
      <AdjustmentDiff sessionsBefore={a} sessionsAfter={b} scopeLabel="Strength changes this week" />
      {/* STRENGTH-CHOSEN-NO-LEGS-01 — said where the plan is in hand, from the engine's own note, never guessed. */}
      {after.notes.includes('legs_limited_by_run_week') && (
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--ink-2)', lineHeight: 1.5, marginTop: 'var(--space-3)' }}>
          {STRENGTH_SETUP.legsLimitedNote}
        </div>
      )}
      {rows.length === 0 && !weekChanged && (
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--ink-2)', lineHeight: 1.5 }}>
          Your sessions stay as they are.
        </div>
      )}
    </ChangeConfirm>
  )
}
