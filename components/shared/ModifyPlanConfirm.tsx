'use client'

import AdjustmentDiff from './AdjustmentDiff'
import { explainPlanDelta } from '@/lib/plan/planDeltaExplain'
import { DIFF_DAY_ORDER } from '@/lib/coaching/diff/sessionDiff'
import type { Plan } from '@/types/plan'
import { formatDistance, type DistanceUnits } from '@/lib/format'
import Button from '@/components/ui/Button'
import BackButton from '@/components/shared/BackButton'
import { MICRO_LABELS } from './microLabels'

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
/** A section label naming WHICH SCALE the block below reports on. */
function ScaleLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: 'var(--font-ui)',
      ...MICRO_LABELS.eyebrow,
      color: 'var(--mute)',
      marginBottom: 'var(--space-2)',
    }}>{children}</div>
  )
}

export default function ModifyPlanConfirm({
  before,
  after,
  weekIndex,
  units,
  resetsLoggedWeeks,
  onAccept,
  onBack,
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
  /** 🔴 Back to the sheet, edits INTACT (MODIFY-CONFIRM-01 clause 1). */
  onBack: () => void
  /** Discard. Genuinely destructive, and since clause 3 nothing else is. */
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

  /** "Week 4 of 12" when the plan knows it, so "this week" is not ambiguous. */
  const weekN = (before.weeks[weekIndex] as { n?: number } | undefined)?.n ?? weekIndex + 1
  const weekLabel = `, week ${weekN} of ${a.weeks}`

  /**
   * 🔴 DAY-INDEXED, NOT `Object.values` (`MODIFY-DIFF-DAY-MAP-01`, 2026-10-13).
   *
   * `computeSessionDiff` consumes a SEVEN-element array indexed mon=0…sun=6 —
   * its own docstring says so. This returned `Object.values(w.sessions)`, which
   * is a COMPACT array of only the days that have a session, so a 3-day runner's
   * Wed/Fri/Sun week landed at indices 0,1,2 and rendered as **Mon/Tue/Wed**.
   *
   * Measured on the founder's own plan, from a screenshot of the live confirm
   * screen: a Mon/Wed/Fri/Sun week was shown as Mon/Tue/Wed/Thu, and Sunday's
   * 16.5 km long run was presented as a Monday 17 km easy run — on the screen
   * that asks the runner to accept a whole-plan rewrite. The session SIZES were
   * right the whole time, which is why nothing looked wrong.
   *
   * ⚠️ Both arrays must be built the same way, because `weekChanged` below diffs
   * them too: under the old code a week whose sessions MOVED DAY could compare
   * equal and the day strip would not render at all.
   */
  const sessionsOf = (p: Plan) => {
    const w = p.weeks[weekIndex] ?? p.weeks[0]
    if (!w) return DIFF_DAY_ORDER.map(() => null)
    const byDay = (w.sessions ?? {}) as Record<string, unknown>
    // Typed loosely on purpose: importing `computeSessionDiff` here would trip
    // `planAdjustmentsScreen.markup.test.ts`, which asserts this screen REUSES
    // `AdjustmentDiff` rather than building a second diff. It still does.
    return DIFF_DAY_ORDER.map(d => (byDay[d] ?? null)) as never[]
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

  const weekChanged = JSON.stringify(sessionsOf(before)) !== JSON.stringify(sessionsOf(after))

  /** Amendment 3 — null when there is nothing honest to say, which is most edits. */
  const deltaWhy = explainPlanDelta(
    { weeks: a.weeks, peak: a.peak, total: a.total },
    { weeks: b.weeks, peak: b.peak, total: b.total },
  )

  return (
    <div style={{ padding: '0 20px 24px' }}>
      {/* 🔴 CLAUSE 1 — `ux-principles.md:105`, "back arrow top-left; navigation
          is always predictable and reversible". This screen had none, and its
          only exit DISCARDED every edit. */}
      <BackButton onClick={onBack} ariaLabel="Back to your changes" style={{ marginBottom: 'var(--space-4)' }} />
      <div style={{ fontFamily: 'var(--font-brand)', fontSize: '26px', fontWeight: 800, color: 'var(--ink)' }}>
        Here is what changes
      </div>
      <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)', lineHeight: 1.5, marginTop: '4px', marginBottom: 'var(--space-4)' }}>
        Nothing is saved until you accept.
      </div>

      {/* 🔴 CLAUSE 2 — NAME THE SCALE. These two blocks are different objects:
          the card is the WHOLE PLAN, the day rows below are ONE WEEK. Nothing
          said so, and the founder read them as one list: "is that across the
          whole plan? it doesn't tell me a lot". */}
      {rows.length > 0 && <ScaleLabel>Your whole plan</ScaleLabel>}
      {rows.length > 0 && (
        <div style={{ background: 'var(--card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--line)', padding: '14px 16px', marginBottom: 'var(--space-4)' }}>
          {rows.map((r, i) => (
            <div key={r.label} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: i < rows.length - 1 ? '10px' : 0 }}>
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--ink-2)' }}>{r.label}</span>
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--mute)' }}>
                {r.from} <span aria-hidden>{'→'}</span>{' '}
                <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{r.to}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* The week the runner is actually in. Renders null when that week is
          unchanged, which is the component's own contract. */}
      {/* 🎓 AMENDMENT 3 (Design Board MODIFY-CONFIRM-DIFF-01, 2026-10-13) — Sierra:
          "'In total 373km → 221km' tells the runner a number. It does not tell
          them the only thing that matters: is that good or bad for me?" The
          engine knows why the totals moved; this screen did not say.
          ⚠️ FACTUAL ONLY. `explainPlanDelta` states arithmetic the runner can
          verify on this same screen and never claims the result is good, safe or
          enough — those are Coaching Board sentences (the W-03 precedent). */}
      {deltaWhy && (
        <div style={{
          // 14px, not 13: 13 is not in the declared type scale
          // (TYPESCALE-APP-GATE-01). I made this exact mistake on TodayScreen
          // this morning and repeated it here.
          fontFamily: 'var(--font-ui)', fontSize: '14px', lineHeight: 1.5,
          color: 'var(--ink-2)', marginTop: 'calc(-1 * var(--space-2))',
          marginBottom: 'var(--space-4)',
        }}>
          {deltaWhy}
        </div>
      )}

      {/* 🔴 AMENDMENT 1 — THE HEADER MUST SAY IT IS A DIFF. Wroblewski: "'THIS
          WEEK, WEEK 4 OF 12' implies a week and delivers a filter." Only CHANGED
          days render, and live plans carry a mean of 3.6 sessions across 7 days,
          so a whole week would be mostly rest rows. Keep the filter; name it. */}
      {weekChanged && <ScaleLabel>What changes this week{weekLabel}</ScaleLabel>}
      <AdjustmentDiff
        sessionsBefore={sessionsOf(before)}
        sessionsAfter={sessionsOf(after)}
        units={units}
        scopeLabel={`Changes to this week${weekLabel}`}
      />

      {resetsLoggedWeeks && (
        <div style={{
          background: 'var(--warn-bg)', borderRadius: 'var(--radius-lg)', padding: '14px 16px',
          marginTop: 'var(--space-4)', fontFamily: 'var(--font-ui)', fontSize: '14px',
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
      <Button variant="secondary" size="compact" fullWidth 
        onClick={onCancel}
        disabled={applying} style={{ marginTop: '4px' }}>
        Keep my current plan
      </Button>
    </div>
  )
}
