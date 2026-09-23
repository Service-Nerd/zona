'use client'

import type { Plan } from '@/types/plan'
import { formatDistance } from '@/lib/format'
import { PAID_FEATURES } from '@/lib/marketing/pricing'

/**
 * P-06(c) — the hero metric panel on the plan preview.
 *
 * The preview told the runner the week count, the start date and the race
 * distance, and nothing about the SHAPE of what they had just been given. The
 * two numbers that answer "what am I actually signing up for" — how big the
 * biggest week gets, and how far the whole block runs — were computable from
 * the plan in front of them and never shown.
 *
 * ⚠️ DERIVED, NEVER STORED. The filing is explicit and the repo has the scar:
 * a total written at generation goes stale the moment a plan is reshaped, and
 * "a value read mid-pipeline was stale by the time the runner saw it" is a
 * recorded failure class here (LONG-SESSION-FUEL-01, COPY-STALE-GEN-01). Both
 * figures are computed from `plan.weeks` at render.
 *
 * ⚠️ WHAT WAS DELIBERATELY NOT TAKEN FROM THE TEARDOWN. The brief proposed a
 * deep-ink hero panel with a tonal wave and a ticket-notch divider. The Dark
 * Ground pattern is scoped in `ui-patterns.md` to **marketing pages** ("exactly
 * one near-black section per marketing page... a punctuation mark, not a
 * theme"), and the design principles bar decorative chrome outright: "No
 * chrome. No stacked box-shadows. No gradient on gradient. No decorative
 * dividers." So this takes the IDEA (lead with the numbers that matter) and
 * not the styling, which is how the rest of this teardown has been handled.
 * Our own hierarchy — value large, label small underneath — is already
 * specified and is what the panel uses.
 */

/** The `dynamic_reshape_r20` row. Its `detail` IS the adaptation promise. */
const RESHAPE_ROW = PAID_FEATURES.find(f => f.gate === 'dynamic_reshape_r20')

export default function PlanHeroMetrics({
  plan,
  units,
  canReshape,
}: {
  plan: Plan
  units: 'km' | 'mi'
  /**
   * `dynamic_reshape_r20`. Verified: FALSE for free, true for trial and paid.
   * A free runner must not be promised adaptation they do not get — hard rule
   * 7, and the same class as the "full access" claim that was false for weeks.
   */
  canReshape: boolean
}) {
  const weeklyKms = plan.weeks.map(w => w.weekly_km ?? 0)
  const peakKm    = weeklyKms.length ? Math.max(...weeklyKms) : 0
  const totalKm   = weeklyKms.reduce((a, b) => a + b, 0)

  const metric = (value: string, label: string) => (
    <div key={label} style={{ flex: 1, minWidth: 0 }}>
      <div style={{
        fontFamily: 'var(--font-ui)', fontSize: '22px', fontWeight: 800,
        color: 'var(--ink)', letterSpacing: '-0.3px', lineHeight: 1.1,
      }}>{value}</div>
      <div style={{
        fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--mute)',
        marginTop: '3px', lineHeight: 1.3,
      }}>{label}</div>
    </div>
  )

  return (
    <div style={{
      background: 'var(--card)', borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--line)', padding: '16px 18px',
    }}>
      <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
        {metric(String(plan.weeks.length), 'weeks')}
        {metric(formatDistance(peakKm, units) ?? '—', 'biggest week')}
        {metric(formatDistance(totalKm, units) ?? '—', 'in total')}
      </div>

      {/* The adaptation promise. ⚠️ The SENTENCE is the `/pricing` row's own,
          not a second string making the same claim — that row is already
          covered by `pricing.test.ts` and `pricingRowTruth.test.ts`, and a
          restatement here would be a second owner of one promise. */}
      {canReshape && RESHAPE_ROW && (
        <div style={{
          fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)',
          lineHeight: 1.55, marginTop: 'var(--space-4)', borderTop: '1px solid var(--line)', paddingTop: 'var(--space-3)',
        }}>
          {RESHAPE_ROW.detail}
        </div>
      )}
    </div>
  )
}
