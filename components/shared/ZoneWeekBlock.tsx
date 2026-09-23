'use client'

import { zoneWeekStatement, type RunZoneOutcome } from '@/lib/coaching/zoneWeekStatement'

/**
 * P-04 — the weekly zone-compliance block on the Plan screen.
 *
 * WHY IT EXISTS. Miles's plan screen shows distance covered, total distance,
 * current pace, race-day pace and projected finish: **every metric is volume
 * or speed, and there is no intensity metric anywhere** — in an app whose own
 * marketing argues runners go too fast. Ours did not have one either. The
 * question this whole product is built on, *"am I actually holding the zone?"*,
 * was answerable only on Coach.
 *
 * ⚠️ THE DERIVATION IS NOT HERE. `lib/coaching/zoneWeekStatement.ts` owns every
 * sentence and the counting rules the Coaching Board set. This renders. The
 * statement is reused everywhere the zone is scored, and a component that
 * assembled its own copy would become a second owner of the brand's central
 * claim.
 *
 * ⚠️ NO AIMark. Rule-engine output, not model output.
 *
 * ⚠️ NO CAUSE, NO ACTION. Hard rule 8 and the board's ruling: we hold
 * `hr_above_ceiling_pct` and nothing else, so a limiter sentence would be a
 * diagnosis the data cannot support.
 */
export default function ZoneWeekBlock({
  outcomes,
  locked,
}: {
  /** One entry per run completed this week. */
  outcomes: RunZoneOutcome[]
  /**
   * Free tier. Run analysis is `activity_intelligence` (PAID), so a free
   * runner can see the ceiling and never learn whether they held it.
   *
   * ⚠️ That is defensible under "gate richness, never access" — the plan, the
   * session and the rule are all free and only the MEASUREMENT is paid — but
   * it does mean the free tier states the thesis and never scores it. Rather
   * than invent a treatment, this follows `RestraintCard`'s locked state
   * (pattern 11), which was already ruled for exactly this data on Coach.
   */
  locked?: boolean
}) {
  const s = zoneWeekStatement(outcomes)

  // P-01's semantic pair: moss = held the zone, amber = cooked it. A rail, not
  // a fill — type accent, never a coloured card (Warm Slate accent-only rule).
  const rail =
    locked ? 'var(--line)'
    : s.tone === 'held' ? 'var(--moss)'
    : s.tone === 'drifted' ? 'var(--warn)'
    : 'var(--line)'

  return (
    <div style={{
      position: 'relative', background: locked ? 'var(--bg-soft)' : 'var(--card)',
      borderRadius: 'var(--radius-lg)', border: '1px solid var(--line)',
      padding: '16px 18px 16px 21px', overflow: 'hidden',
    }}>
      <span aria-hidden style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '3px', background: rail }} />
      <div style={{
        fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em',
        textTransform: 'uppercase', color: 'var(--mute)', marginBottom: 'var(--space-2)',
      }}>
        This week
      </div>
      <div style={{
        fontFamily: 'var(--font-ui)', fontSize: '14px', lineHeight: 1.55,
        color: locked ? 'var(--mute)' : 'var(--ink)',
      }}>
        {locked
          // Names what the score IS, so the thesis is legible before it is
          // scored, and says plainly what unlocks it. Same shape as
          // RestraintCard's locked copy.
          ? 'Whether your easy runs actually stayed easy. Connect a heart rate source and upgrade to start scoring it.'
          : s.line}
      </div>
      {!locked && s.gapLine && (
        // The gap, quieter. Runs we could not measure are NAMED rather than
        // folded into the denominator in either direction: "none of 4 held"
        // when two had no heart rate is a false statement.
        <div style={{
          fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)',
          lineHeight: 1.55, marginTop: 'var(--space-2)',
        }}>
          {s.gapLine}
        </div>
      )}
    </div>
  )
}
