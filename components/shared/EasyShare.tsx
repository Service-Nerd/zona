// COACH-DISCIPLINE-HEADLINE-01 — the zone rings' own headline and their weekly record (Design Board, Coach review
// 2026-10-30, Pattern 32 amended, not reversed; Coaching Board the same day; founder-approved mockup).
//
// The one metric no competitor shows, given the biggest moment on Coach: the share of this week's running in Zones
// 1–2. DESCRIBED, NEVER GRADED (Coaching Board): the number is ink, with no colour verdict, no target and no good/bad
// word. A week with a proper session in it reads lower, and that is not failure.
//
// The bars are a RECORD of past weeks (the pattern ruled for `LoadShape` the same day): no line, no smoothing, no
// projection, no number per bar, no emphasis on the tallest week (PlanArc's rule). A week without enough runs is an
// empty slot, never a zero. Always `EASY_SHARE_BARS` slots, filled from the right, so week three of a plan reads as
// the start of a record rather than three wide blocks.

import { MICRO_LABELS } from '@/components/shared/microLabels'
import EarnedLine from '@/components/shared/EarnedLine'
import { easiestWeekSentence } from '@/lib/coaching/moments'

/** How many weeks the record shows (Design Board, "up to 8"). */
export const EASY_SHARE_BARS = 8
const BAR_HEIGHT_PX = 64

/** `easiestSpan`: weeks drawn when this week is the easiest of them (`easiestWeekSpan`, §131); the line shows only then. */
export function EasyShareHeader({ share, runs, easiestSpan }: { share: number; runs: number; easiestSpan?: number | null }) {
  return (
    <div data-easy-share>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: 'var(--font-ui)', ...MICRO_LABELS.eyebrow, color: 'var(--mute)' }}>This week in zones</span>
        <span style={{ fontFamily: 'var(--font-ui)', ...MICRO_LABELS.eyebrow, color: 'var(--mute)' }}>across {runs} runs</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
        <span style={{ fontFamily: 'var(--font-brand)', fontSize: '56px', fontWeight: 800, color: 'var(--ink)', letterSpacing: '-1.5px', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
          {share}%
        </span>
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: '17px', fontWeight: 600, color: 'var(--moss-strong)' }}>easy</span>
      </div>
      <div style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: 400, color: 'var(--ink-2)', lineHeight: 1.5, marginTop: 'var(--space-2)' }}>
        of this week&apos;s running sat in Zones 1–2.
      </div>
      {easiestSpan != null && (
        <div style={{ marginTop: 'var(--space-3)' }}>
          <EarnedLine text={easiestWeekSentence(easiestSpan)} />
        </div>
      )}
    </div>
  )
}

/** `weeks`: oldest first, this week last, `null` for a week without enough runs. Renders nothing below two weeks. */
export function EasyShareBars({ weeks }: { weeks: (number | null)[] }) {
  const shown = weeks.slice(-EASY_SHARE_BARS)
  if (shown.length < 2) return null
  return (
    <div data-easy-share-bars style={{ marginTop: 'var(--space-5)' }}>
      <div
        role="img"
        aria-label={`Easy share, last ${shown.length} weeks: ${shown.map(w => (w == null ? 'not enough runs' : `${w}%`)).join(', ')}`}
        style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--space-1)', height: `${BAR_HEIGHT_PX}px` }}
      >
        {Array.from({ length: EASY_SHARE_BARS - shown.length }, (_, i) => <div key={`pad${i}`} style={{ flex: 1 }} />)}
        {shown.map((w, i) => (
          <div
            key={i}
            data-bar={w == null ? 'empty' : 'value'}
            style={{
              flex: 1,
              height: w == null ? 0 : `${Math.max(3, (w / 100) * BAR_HEIGHT_PX)}px`,
              borderRadius: '3px',
              background: 'var(--moss)',
              opacity: i === shown.length - 1 ? 1 : 0.35,
            }}
          />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-2)', fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)' }}>
        <span>{shown.length - 1} {shown.length - 1 === 1 ? 'week' : 'weeks'} ago</span>
        <span>This week</span>
      </div>
    </div>
  )
}
