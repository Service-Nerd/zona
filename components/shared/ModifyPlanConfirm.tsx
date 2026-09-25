'use client'

import AdjustmentDiff from './AdjustmentDiff'
import type { Plan } from '@/types/plan'
import { formatDistance, type DistanceUnits } from '@/lib/format'
import Button from '@/components/ui/Button'

/**
 * P-02 — the diff a runner accepts before a parameter edit lands.
 *
 * ⚠️ APPLY ALWAYS SHOWS THIS. It is an acceptance criterion of the item and a
 * brand rule: no silent structural change. ADR-012 already established that a
 * structural change surfaces a confirmation tile rather than auto-applying;
 * this is the user-initiated twin of that path and reuses its reasoning.
 *
 * ⚠️ TWO SCALES, BECAUSE ONE IS NOT ENOUGH HERE. `AdjustmentDiff` (already
 * shipped, two live call sites) diffs a WEEK's sessions, which is what the
 * runner feels on Monday. But a parameter edit can restructure the whole
 * block, and a week diff cannot show that the plan got two weeks shorter. So
 * the plan-level figures sit above it. Both are DERIVED from the two plans at
 * render — nothing is stored, because a total written once goes stale the
 * moment the plan is reshaped again.
 */
export default function ModifyPlanConfirm({
  before,
  after,
  weekIndex,
  units,
  resetsLoggedWeeks,
  onAccept,
  onCancel,
  applying,
}: {
  before: Plan
  after: Plan
  /** Array position of the week the runner is currently in. */
  weekIndex: number
  units: DistanceUnits
  resetsLoggedWeeks: boolean
  onAccept: () => void
  onCancel: () => void
  applying: boolean
}) {
  const shape = (p: Plan) => {
    const kms = p.weeks.map(w => w.weekly_km ?? 0)
    return {
      weeks: p.weeks.length,
      peak:  kms.length ? Math.max(...kms) : 0,
      total: kms.reduce((a, b) => a + b, 0),
    }
  }
  const a = shape(before)
  const b = shape(after)

  const sessionsOf = (p: Plan) => {
    const w = p.weeks[weekIndex] ?? p.weeks[0]
    return w ? Object.values(w.sessions ?? {}) : []
  }

  /** Only rows that actually moved. An unchanged figure is noise here. */
  const rows: { label: string; from: string; to: string }[] = []
  if (a.weeks !== b.weeks) rows.push({ label: 'Weeks', from: String(a.weeks), to: String(b.weeks) })
  if (Math.round(a.peak) !== Math.round(b.peak)) {
    rows.push({ label: 'Biggest week', from: formatDistance(a.peak, units) ?? '—', to: formatDistance(b.peak, units) ?? '—' })
  }
  if (Math.round(a.total) !== Math.round(b.total)) {
    rows.push({ label: 'In total', from: formatDistance(a.total, units) ?? '—', to: formatDistance(b.total, units) ?? '—' })
  }

  return (
    <div style={{ padding: '0 20px 24px' }}>
      <div style={{ fontFamily: 'var(--font-brand)', fontSize: '20px', fontWeight: 700, color: 'var(--ink)' }}>
        Here is what changes
      </div>
      <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)', lineHeight: 1.5, marginTop: '4px', marginBottom: 'var(--space-4)' }}>
        Nothing is saved until you accept.
      </div>

      {/* Plan-level. Absent when the shape did not move, rather than rendering
          three identical before/after pairs to prove nothing happened. */}
      {rows.length > 0 && (
        <div style={{ background: 'var(--card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--line)', padding: '14px 16px', marginBottom: 'var(--space-4)' }}>
          {rows.map((r, i) => (
            <div key={r.label} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: i < rows.length - 1 ? '10px' : 0 }}>
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--ink-2)' }}>{r.label}</span>
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--mute)' }}>
                {r.from} <span aria-hidden>{'→'}</span>{' '}
                <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{r.to}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* The week the runner is actually in. Renders null when that week is
          unchanged, which is the component's own contract. */}
      <AdjustmentDiff sessionsBefore={sessionsOf(before)} sessionsAfter={sessionsOf(after)} units={units} />

      {resetsLoggedWeeks && (
        <div style={{
          background: 'var(--warn-bg)', borderRadius: 'var(--radius-lg)', padding: '14px 16px',
          marginTop: 'var(--space-4)', fontFamily: 'var(--font-ui)', fontSize: '13px',
          color: 'var(--coach-ink)', lineHeight: 1.55,
        }}>
          Moving the race starts a new block, so the weeks you have already logged stop counting
          towards this plan. Your runs are kept.
        </div>
      )}

      <Button variant="primary" fullWidth
        onClick={onAccept} busy={applying} style={{ marginTop: 'var(--space-5)' }}>
        {applying ? 'Saving…' : 'Accept and save'}
      </Button>
      <button
        onClick={onCancel}
        disabled={applying}
        style={{
          width: '100%', padding: '14px', marginTop: '4px', minHeight: '44px',
          background: 'none', border: 'none', cursor: 'pointer',
          fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 500, color: 'var(--mute)',
        }}
      >
        Keep my current plan
      </button>
    </div>
  )
}
