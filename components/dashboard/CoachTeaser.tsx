'use client'

// DASHBOARD-SCREEN-EXTRACT-02 — lifted verbatim out of `DashboardClient.tsx`.
//
// It was a module-level function in a 14k-line file, so it closed over nothing and this
// move changes no behaviour. What it changes is REACH: nothing could import it, so it
// could not be rendered by a harness or a mounting test.
//
// ⚠️ The body is UNCHANGED. Edit it in a separate commit so the move stays a move.

import AIMark from '@/components/shared/AIMark'
import CoachByline from '@/components/shared/CoachByline'
import CoachNoteBlock from '@/components/shared/CoachNoteBlock'
import PendingAdjustmentBanner from '@/components/shared/PendingAdjustmentBanner'
import type { Zone } from '@/components/shared/ZoneBar'
import { MICRO_LABELS } from '@/components/shared/microLabels'
import Button from '@/components/ui/Button'
import ScreenHeader from '@/components/ui/ScreenHeader'
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

// TIER-DIVERGENT — FREE: renders KIT-TASTE-01 weekly insight card (CoachByline
//                        + AIMark + headline + body) when available; falls
//                        through to risk-gated amber warning, an insufficient-
//                        logs hint, or a dimmed Kit identity placeholder. The
//                        SHARE-01 upsell + locked race-projections stub sit
//                        below the insight slot.
//                  PAID: rendered by CoachScreen instead — this component is
//                        never mounted for paid/trial users (router in
//                        DashboardClient picks the screen by tier).
export default function CoachTeaser({ plan, firstName, onUpgrade }: {
  plan: Plan; firstName?: string; onUpgrade: () => void
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

        {/* KIT-TASTE-01 — free insight card / risk warning / empty-state hint.
            Sits above the locked report. Locked stats below stay locked. */}
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
            <p style={{ fontFamily: 'var(--font-brand)', fontSize: '18px', fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.3px', lineHeight: 1.3, margin: '0 0 8px' }}>
              {insight.headline}
            </p>
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: '13.5px', color: 'var(--ink-2)', lineHeight: 1.55, margin: 0 }}>
              {insight.body}
            </p>
          </div>
        )}

        {/* Risk-gated: rule-engine warning, no AIMark — output is not from
            the model. Rail anatomy matches CoachNoteBlock; eyebrow type is
            canonical 10px 700 0.14em per Pattern 10. */}
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
            <div style={{ ...MICRO_LABELS.eyebrow, fontFamily: 'var(--font-ui)', color: 'var(--warn)', marginBottom: 'var(--space-2)' }}>
              Worth a look
            </div>
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--ink)', lineHeight: 1.55, margin: 0 }}>
              {insight.message}
            </p>
          </div>
        )}

        {/* Insufficient data: keep the locked identity card but with a clear
            "log to unlock" message instead of the marketing line. */}
        {insight.kind === 'insufficient' && (
          // KIT-PREVIEW-01 — Sample Kit reading. Shown to free users below
          // the RPE threshold so they can SEE what Kit produces before
          // earning their first real insight. Provenance honesty: the copy
          // is hand-authored, NOT model output — so we use CoachByline
          // (Kit's identity) but drop the AIMark and the moss left rail
          // (both of which signal "this card is AI-coached"). The eyebrow
          // "EXAMPLE — NOT YOUR DATA" explicitly disclaims authorship.
          <div style={{
            background: 'var(--card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--line)',
            padding: '16px 18px',
          }}>
            <div style={{ ...MICRO_LABELS.eyebrow, fontFamily: 'var(--font-ui)',
              color: 'var(--mute)',
              marginBottom: 'var(--space-3)' }}>
              Example &mdash; not your data
            </div>
            <div style={{ marginBottom: 'var(--space-3)' }}>
              <CoachByline role="EXAMPLE" />
            </div>
            <p style={{ fontFamily: 'var(--font-brand)', fontSize: '17px', fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.3px', lineHeight: 1.3, margin: '0 0 8px' }}>
              Easy days running hot.
            </p>
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: '13.5px', color: 'var(--ink-2)', lineHeight: 1.55, margin: '0 0 14px' }}>
              Three logs at RPE 7+ on what should be Zone 2. Pull the next
              one back from the first km.
            </p>
            <div style={{
              fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)', lineHeight: 1.55,
              paddingTop: 'var(--space-3)', borderTop: '1px solid var(--line)',
            }}>
              {insight.loggedCount === 0
                ? 'Log a session to unlock your own weekly reading. RPE + fatigue is all Kit needs.'
                : 'One more logged session and Kit reads your week.'}
            </div>
          </div>
        )}

        {/* Unavailable: keep the original dimmed identity placeholder so the
            layout doesn't collapse on a model failure or a totally fresh user. */}
        {insight.kind === 'unavailable' && (
        <div style={{
          background:   'var(--card)',
          borderRadius: 'var(--radius-lg)',
          border:       '1px solid var(--line)',
          borderLeft:   '3px solid var(--moss)',
          padding:      '16px 18px',
          opacity:      0.45,
          pointerEvents: 'none',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
            <CoachByline />
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--mute)' }}>
              W{weekNum} of {totalWeeks}
            </span>
          </div>
          <p style={{ fontFamily: 'var(--font-brand)', fontSize: '18px', fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.3px', lineHeight: 1.3, margin: 0 }}>
            Kit reads your sessions and surfaces what&apos;s worth knowing.
          </p>
        </div>
        )}

        {/* Locked report card — mirrors the paid CoachScreen weekly report card anatomy */}
        <div style={{ background: 'var(--card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--line)', overflow: 'hidden' }}>
          <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--mute)', opacity: 0.3 }} />
            <span style={{ ...MICRO_LABELS.sectionLabel, fontFamily: 'var(--font-ui)', color: 'var(--mute)' }}>This week</span>
          </div>
          <div style={{ padding: '16px' }}>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '17px', fontWeight: 600, color: 'var(--mute)', letterSpacing: '-0.3px', lineHeight: 1.3, marginBottom: 'var(--space-2)', opacity: 0.45 }}>
              Your weekly coaching report.
            </div>
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--mute)', lineHeight: 1.7, margin: 0, opacity: 0.5 }}>
              Log a few runs and we'll tell you exactly what's working, and what isn't.
            </p>
          </div>
          {/* Locked stats row */}
          <div style={{ padding: '10px 16px', borderTop: '1px solid var(--line)', display: 'flex', gap: 'var(--space-4)' }}>
            {(['Zone discipline', 'Load ratio'] as const).map((label) => (
              <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ ...MICRO_LABELS.dataLabel, fontFamily: 'var(--font-ui)', color: 'var(--mute)' }}>{label}</span>
                <span style={{ fontFamily: 'var(--font-ui)', fontSize: '18px', fontWeight: 600, color: 'var(--mute)', opacity: 0.3 }}>—</span>
              </div>
            ))}
          </div>
        </div>

        {/* Teaser card — same left-accent pattern as wizard teaser card */}
        <Button variant="secondary" 
          onClick={onUpgrade} style={{ justifyContent: 'flex-start', width: '100%', textAlign: 'left', background: 'var(--card)', borderLeft: '3px solid var(--moss)', borderRadius: '10px', padding: '14px 16px', gap: 'var(--space-3)' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '3px' }}>
              See your zone discipline score
            </div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)', lineHeight: 1.5 }}>
              Zone score and weekly coaching. Needs Strava.
            </div>
          </div>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--moss)', whiteSpace: 'nowrap', flexShrink: 0 }}>
            Upgrade →
          </span>
        </Button>

        {/* SHARE-01 — free-tier upsell for the shareable weekly zone card.
            Distinct from the zone-discipline teaser above: that one sells
            the score, this one sells the share moment. Same upgrade target. */}
        <Button variant="secondary" 
          onClick={onUpgrade} style={{ justifyContent: 'flex-start', width: '100%', textAlign: 'left', background: 'var(--card)', borderLeft: '3px solid var(--moss)', borderRadius: '10px', padding: '14px 16px', gap: 'var(--space-3)' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '3px' }}>
              Share your week
            </div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)', lineHeight: 1.5 }}>
              The card you can drop in a story.
            </div>
          </div>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--moss)', whiteSpace: 'nowrap', flexShrink: 0 }}>
            Upgrade →
          </span>
        </Button>

        {/* Locked race projections stub — display only, not a CTA */}
        <div style={{ width: '100%', background: 'var(--card)', boxShadow: 'var(--shadow-card)', border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
          <div style={{ fontFamily: 'var(--font-ui)', ...MICRO_LABELS.eyebrow, color: 'var(--mute)', marginBottom: 'var(--space-3)', opacity: 0.5 }}>
            Race projections
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0px', opacity: 0.25 }}>
            {(['5K', '10K', 'HM', 'Marathon'] as const).map((label, i) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < 3 ? '1px solid var(--line)' : undefined }}>
                <span style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--ink)' }}>{label}</span>
                <span style={{ fontFamily: 'var(--font-ui)', fontSize: '18px', fontWeight: 700, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>—:——</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
