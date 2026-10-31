'use client'

// DASHBOARD-SCREEN-EXTRACT-02 — lifted verbatim out of `DashboardClient.tsx`.
//
// It was a module-level function in a 14k-line file, so it closed over nothing and this
// move changes no behaviour. What it changes is REACH: nothing could import it, so it
// could not be rendered by a harness or a mounting test.
//
// ⚠️ The body is UNCHANGED. Edit it in a separate commit so the move stays a move.

import CoachByline from '@/components/shared/CoachByline'
import EffortRecord from '@/components/shared/EffortRecord'
import KitReceipts from '@/components/shared/KitReceipts'
import { MICRO_LABELS } from '@/components/shared/microLabels'
import Button from '@/components/ui/Button'
import ScreenHeader from '@/components/ui/ScreenHeader'
import { BRAND, PRICING } from '@/lib/brand'
import type { KitReceipt } from '@/lib/coaching/kitReceipts'
import type { EffortRun } from '@/lib/coaching/runEffort'
import { getCurrentWeekIndex } from '@/lib/plan'
import { authedFetch } from '@/lib/supabase/authedFetch'
import type { Plan } from '@/types/plan'
import { useEffect, useState } from 'react'

type FreeInsightState =
  | { kind: 'loading' }
  | { kind: 'insight';      headline: string; body: string }
  | { kind: 'risk_gated';   message: string }
  | { kind: 'insufficient'; loggedCount: number }
  | { kind: 'unavailable' }

// TIER-DIVERGENT — FREE: COACH-KIT-CAUGHT-01 (boards 2026-10-31, founder-approved mockup). "What Kit caught": the
//                        runner's own receipts (`kitReceipts`) with one line on what Pro adds, then the every-run
//                        picture, free. With no receipt, Kit's free weekly insight is the fallback (SLT: never beside
//                        receipts, CO-ONE); with neither, "Nothing yet." The locked report, the two upsell buttons and
//                        the locked race list sold things paid Coach no longer has, and are gone. The risk warning
//                        always shows: it is a safety message from the rules, not a second Kit card.
//                  PAID: rendered by CoachScreen. A paid runner reaches THIS only with no current week
//                        (`coach_teaser_empty`), so `showUpgrade` is false there and no buy button shows.
export default function CoachTeaser({ plan, firstName, onUpgrade, receipts = [], effortRuns = [], showUpgrade = true }: {
  plan: Plan; firstName?: string; onUpgrade: () => void
  /** `kitReceipts(...)`; null while the activity log is still loading. */
  receipts?: KitReceipt[] | null
  /** `effortRecord(...)`, the free every-run picture (§132). */
  effortRuns?: EffortRun[]
  /** False for a paid runner who lands here without a current week. */
  showUpgrade?: boolean
}) {
  const weekNum    = getCurrentWeekIndex(plan.weeks) + 1
  const totalWeeks = plan.weeks.length

  // KIT-TASTE-01 — pull-on-view fetch of this week's free insight. Failure or
  // any non-insight state falls back to the existing locked layout below.
  const [insight, setInsight] = useState<FreeInsightState>({ kind: 'loading' })
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await authedFetch('/api/coaching/weekly-free-insight')
        if (!res.ok) { if (!cancelled) setInsight({ kind: 'unavailable' }); return }
        const data = await res.json()
        if (cancelled) return
        if (data.state === 'insight')      setInsight({ kind: 'insight', headline: data.headline, body: data.body })
        else if (data.state === 'risk_gated')   setInsight({ kind: 'risk_gated', message: data.message })
        else if (data.state === 'insufficient') setInsight({ kind: 'insufficient', loggedCount: data.loggedCount ?? 0 })
        else                                    setInsight({ kind: 'unavailable' })
      } catch {
        if (!cancelled) setInsight({ kind: 'unavailable' })
      }
    })()
    return () => { cancelled = true }
  }, [])

  return (
    <div>
      <ScreenHeader title="Your coach" sub={firstName ? `${firstName} · W${weekNum} of ${totalWeeks}` : `W${weekNum} of ${totalWeeks}`} sticky />
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>

        {/* The risk warning first: a safety message, shown whatever else is on the screen. */}
        {insight.kind === 'risk_gated' && (
          <div style={{
            position: 'relative',
            background: 'var(--card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--line)',
            padding: '16px 18px 16px 26px',
          }}>
            <span aria-hidden="true" style={{
              position: 'absolute', left: '8px', top: '16px', bottom: '16px',
              width: '3px', background: 'var(--warn)', borderRadius: '2px',
            }} />
            <div style={{ ...MICRO_LABELS.eyebrow, fontFamily: 'var(--font-ui)', color: 'var(--warn-strong)', marginBottom: 'var(--space-2)' }}>
              Worth a look
            </div>
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--ink)', lineHeight: 1.55, margin: 0 }}>
              {insight.message}
            </p>
          </div>
        )}

        {receipts === null && (
          <div data-receipts-loading style={{ background: 'var(--card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--line)', padding: '16px' }}>
            <div style={{ height: '10px', width: '35%', borderRadius: '4px', background: 'var(--bg-soft)', marginBottom: 'var(--space-3)' }} />
            <div style={{ height: '14px', width: '90%', borderRadius: '4px', background: 'var(--bg-soft)', marginBottom: 'var(--space-2)' }} />
            <div style={{ height: '14px', width: '70%', borderRadius: '4px', background: 'var(--bg-soft)' }} />
          </div>
        )}
        {receipts && receipts.length > 0 && (
          <KitReceipts receipts={receipts} meta="last 2 weeks">
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-body)', color: 'var(--ink-2)', lineHeight: 1.45, margin: 0 }}>
              {BRAND.coachName}&apos;s weekly read turns this into one thing to do next. That part is Pro.
            </p>
            {showUpgrade && (
              <Button variant="primary" onClick={onUpgrade} style={{ width: '100%', marginTop: 'var(--space-3)' }}>
                Get {BRAND.coachName} · {PRICING.monthly.perWeekDisplay}
              </Button>
            )}
          </KitReceipts>
        )}
        {receipts && receipts.length === 0 && (
          <>
        {insight.kind === 'loading' && (
          <div style={{
            background: 'var(--card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--line)',
            borderLeft: '3px solid var(--moss)', padding: '16px 18px',
          }}>
            <div style={{ marginBottom: 'var(--space-3)' }}>
              <CoachByline working />
            </div>
            <div style={{ height: '14px', width: '70%', borderRadius: '4px', background: 'var(--bg-soft)', marginBottom: 'var(--space-2)' }} />
            <div style={{ height: '12px', width: '92%', borderRadius: '4px', background: 'var(--bg-soft)' }} />
          </div>
        )}

        {insight.kind === 'insight' && (
          // AI-card anatomy per ui-patterns.md Pattern 16b § Companion — the
          // 3px left rail is an absolutely-positioned span (matches
          // CoachNoteBlock + PendingAdjustmentBanner), not a borderLeft.
          <div style={{
            position: 'relative',
            background: 'var(--card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--line)',
            padding: '16px 18px 16px 26px',
          }}>
            <span aria-hidden="true" style={{
              position: 'absolute', left: '8px', top: '16px', bottom: '16px',
              width: '3px', background: 'var(--moss)', borderRadius: '2px',
            }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
              <CoachByline role="THIS WEEK" />
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--mute)' }}>
                W{weekNum} of {totalWeeks}
              </span>
            </div>
            <p className="section-headline" style={{ margin: '0 0 8px' }}>
              {insight.headline}
            </p>
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: '13.5px', color: 'var(--ink-2)', lineHeight: 1.55, margin: 0 }}>
              {insight.body}
            </p>
          </div>
        )}

        {insight.kind !== 'loading' && insight.kind !== 'insight' && (
          <div data-kit-nothing-yet style={{ background: 'var(--card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--line)', padding: '16px' }}>
            <div style={{ fontFamily: 'var(--font-ui)', ...MICRO_LABELS.eyebrow, color: 'var(--mute)' }}>What {BRAND.coachName} caught</div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '17px', fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.2px', marginTop: 'var(--space-2)' }}>Nothing yet.</div>
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-body)', color: 'var(--ink-2)', lineHeight: 1.45, margin: 'var(--space-1) 0 0' }}>
              A run with heart rate is all {BRAND.coachName} needs to start noticing.
            </p>
          </div>
        )}
          </>
        )}
        <EffortRecord runs={effortRuns} weeks={8} />
      </div>
    </div>
  )
}
