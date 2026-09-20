'use client'

import { FREE_FEATURES, PAID_FEATURES } from '@/lib/marketing/pricing'
import { PRICING } from '@/lib/brand'

/**
 * P-12 — the plan card on Me.
 *
 * WHAT THE TEARDOWN FOUND WORTH TAKING. A competitor's profile leads with
 * "0 WEEK STREAK · 0.0 mi · 0 RUNS", which we will never have — hard rule 4,
 * and the homepage already sells its absence. What they do better is the plan
 * card: **state what you already have, then what Pro adds.** Ours was a single
 * "View plans" row: a link, not a value statement. Stating what the runner
 * already holds before listing what they do not is the non-manipulative shape
 * of an upsell, and it is the one thing on that screen worth copying.
 *
 * ⚠️ THE LISTS ARE READ, NEVER RETYPED. `FREE_FEATURES` / `PAID_FEATURES` in
 * `lib/marketing/pricing.ts` are the same rows `/pricing` renders, each
 * carrying the `gate` it describes. A hand-written list here would be the
 * homepage "four answers" defect waiting to happen — prose about a rule always
 * drifts from the rule — and it would sit outside BOTH guards that already
 * cover those rows: `pricing.test.ts` (every paid gate has a row) and
 * `pricingRowTruth.test.ts` (mechanical rows are executed against the
 * product). Reading them means this card inherits both for free.
 *
 * ⚠️ NO RESTORE BUTTON HERE. It already exists on `UpgradeScreen`, which this
 * card links to. A second restore path is a second thing to keep working.
 */
export default function MePlanCard({
  hasPaidAccess,
  trialDaysLeft,
  onUpgrade,
}: {
  hasPaidAccess: boolean
  /** Non-null only while the reverse trial is running. */
  trialDaysLeft: number | null
  onUpgrade: () => void
}) {
  const onTrial    = trialDaysLeft != null
  // A subscriber is paid access WITHOUT a running trial. Ordering matters:
  // `resolveTier` puts subscription above trial, and a runner who paid mid
  // trial is a subscriber, not a trialist.
  const subscribed = hasPaidAccess && !onTrial

  const planName = subscribed ? 'Full access' : onTrial ? 'Free trial' : 'Free plan'
  const planNote = subscribed
    ? 'Everything is on.'
    : onTrial
      // ⚠️ States the END, not a countdown. P-09's hard rule 2: a timeline
      // describes what happens; urgency is the mechanism we refused.
      ? `${trialDaysLeft} day${trialDaysLeft === 1 ? '' : 's'} left, then you drop to the free plan and keep this plan.`
      : 'Your plan, your sessions and your zone rules. Free, with no time limit.'

  const label = (text: string) => (
    <div style={{
      fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em',
      textTransform: 'uppercase', color: 'var(--mute)', margin: '16px 0 8px',
    }}>{text}</div>
  )

  const row = (name: string, key: string) => (
    <div key={key} style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
      <span aria-hidden style={{ color: 'var(--moss)', fontWeight: 700, lineHeight: 1.5, flexShrink: 0 }}>·</span>
      <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--ink-2)', lineHeight: 1.5 }}>{name}</span>
    </div>
  )

  return (
    <div style={{
      background: 'var(--card)', borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-card)', border: '1px solid var(--line)', padding: '18px',
    }}>
      {/* Value large, label small underneath — the metric-pair rule, which the
          competitor does get right on this screen. */}
      <div style={{ fontFamily: 'var(--font-brand)', fontSize: '20px', fontWeight: 700, color: 'var(--ink)', lineHeight: 1.2 }}>
        {planName}
      </div>
      <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)', lineHeight: 1.5, marginTop: '4px' }}>
        {planNote}
      </div>

      {/* What you already have, FIRST. That order is the whole point. */}
      {label(subscribed || onTrial ? 'What you have' : 'On the free plan')}
      {(subscribed || onTrial ? [...FREE_FEATURES, ...PAID_FEATURES] : FREE_FEATURES)
        .map(f => row(f.name, f.gate ?? f.name))}

      {!subscribed && !onTrial && (
        <>
          {label('Full access adds')}
          {PAID_FEATURES.map(f => row(f.name, f.gate ?? f.name))}
        </>
      )}

      {!subscribed && (
        <>
          {/* P-09's per-week figure, from the same constant the paywall uses. */}
          <div style={{
            fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)',
            lineHeight: 1.5, margin: '16px 0 10px',
          }}>
            {PRICING.annual.perWeekDisplay} on the annual plan.
          </div>
          <button
            onClick={onUpgrade}
            style={{
              width: '100%', padding: '13px', borderRadius: 'var(--radius-md)',
              background: 'var(--moss)', border: 'none', cursor: 'pointer',
              fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: 600, color: 'var(--card)',
            }}
          >
            View plans
          </button>
        </>
      )}
    </div>
  )
}
